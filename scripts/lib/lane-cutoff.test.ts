// Paired controls for the lane cut-off reading (#607): a Claude stream whose helpers the harness
// stopped while they ran reads as cut off, and every stream that merely ends in a short status
// line, finishes its helpers, or stops something that is not a helper reads as whole. A harness
// whose end this tool has no recorded shape for is never read. The marker the reading leaves
// beside a stream is written for a cut-off lane and removed for a whole one.
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CUTOFF_CAUSE,
  cutoffMarkerPath,
  readCutoff,
  readCutoffMarker,
  recordCutoff,
} from "./lane-cutoff.ts";

const line = (record: Record<string, unknown>): string => JSON.stringify(record);

const init = line({ type: "system", subtype: "init", session_id: "s-1", model: "stub-model" });
const started = (id: string, type = "local_agent"): string =>
  line({
    type: "system",
    subtype: "task_started",
    task_id: id,
    task_type: type,
    is_backgrounded: true,
    description: "check the fruit counter",
  });
const notified = (id: string, status: string): string =>
  line({ type: "system", subtype: "task_notification", task_id: id, status, summary: "done" });
const stats = (o: { spawned: number; completed: number; system?: number; parent?: number }) => ({
  spawned: o.spawned,
  completed: o.completed,
  failed: 0,
  killed: { parent: o.parent ?? 0, user: 0, system: o.system ?? 0 },
});
const result = (subagentStats?: unknown, text = "Review under way."): string =>
  line({
    type: "result",
    subtype: "success",
    is_error: false,
    result: text,
    ...(subagentStats === undefined ? {} : { subagent_stats: subagentStats }),
  });
const stream = (...lines: string[]): string => `${lines.join("\n")}\n`;

describe("readCutoff on a Claude stream", () => {
  test("a helper the harness stopped at exit reads as cut off, from the result and the notice", () => {
    const tail = stream(
      init,
      started("t1"),
      notified("t1", "stopped"),
      result(stats({ spawned: 1, completed: 0, system: 1 })),
    );
    expect(readCutoff("claude", tail)).toEqual({ state: "cut-off", stopped: 1 });
  });

  test("the result's count alone is enough, with no task records in the tail", () => {
    const tail = stream(init, result(stats({ spawned: 2, completed: 0, system: 2 })));
    expect(readCutoff("claude", tail)).toEqual({ state: "cut-off", stopped: 2 });
  });

  test("a stopped helper notice alone is enough, when the result carries no helper counts", () => {
    const tail = stream(init, started("t1"), started("t2"), notified("t2", "stopped"), result());
    expect(readCutoff("claude", tail)).toEqual({ state: "cut-off", stopped: 1 });
  });

  test("a cancelled or killed helper notice reads the same as a stopped one", () => {
    for (const status of ["cancelled", "canceled", "killed"]) {
      const tail = stream(init, started("t1"), notified("t1", status), result());
      expect(readCutoff("claude", tail)).toEqual({ state: "cut-off", stopped: 1 });
    }
  });

  test("the larger of the two counts is reported", () => {
    const tail = stream(
      init,
      started("t1"),
      notified("t1", "stopped"),
      result(stats({ spawned: 3, completed: 0, system: 3 })),
    );
    expect(readCutoff("claude", tail)).toEqual({ state: "cut-off", stopped: 3 });
  });

  test("a later result record that carries the stop is read, not only the first", () => {
    const tail = stream(
      init,
      result(stats({ spawned: 1, completed: 0 })),
      result(stats({ spawned: 1, completed: 0, system: 1 })),
    );
    expect(readCutoff("claude", tail)).toEqual({ state: "cut-off", stopped: 1 });
  });

  test("a normal finish whose helpers all reported reads as whole", () => {
    const tail = stream(
      init,
      started("t1"),
      notified("t1", "completed"),
      result(stats({ spawned: 1, completed: 1 }), "No findings."),
    );
    expect(readCutoff("claude", tail)).toEqual({ state: "whole" });
  });

  test("a short status line as the final message, with no kills, reads as whole", () => {
    const tail = stream(init, result(stats({ spawned: 0, completed: 0 }), "Done."));
    expect(readCutoff("claude", tail)).toEqual({ state: "whole" });
  });

  test("a stream with no helpers and no stats reads as whole", () => {
    expect(readCutoff("claude", stream(init, result()))).toEqual({ state: "whole" });
  });

  test("a stopped background shell is not a helper", () => {
    const tail = stream(init, started("b1", "local_bash"), notified("b1", "stopped"), result());
    expect(readCutoff("claude", tail)).toEqual({ state: "whole" });
  });

  test("a helper that failed, with nothing stopped, reads as whole", () => {
    const tail = stream(
      init,
      started("t1"),
      notified("t1", "failed"),
      result(stats({ spawned: 1, completed: 0 })),
    );
    expect(readCutoff("claude", tail)).toEqual({ state: "whole" });
  });

  test("a notice for a task the tail never saw start is not counted", () => {
    expect(readCutoff("claude", stream(init, notified("t9", "stopped"), result()))).toEqual({
      state: "whole",
    });
  });

  test("a result whose count is not a number reads as none", () => {
    const odd = { spawned: 1, completed: 0, killed: { parent: 0, user: 0, system: "1" } };
    expect(readCutoff("claude", stream(init, result(odd)))).toEqual({ state: "whole" });
  });

  test("lines that are not JSON, and an empty tail, are skipped", () => {
    const tail = `not an event\n${stream(init, result(stats({ spawned: 1, completed: 0, system: 1 })))}{broken`;
    expect(readCutoff("claude", tail)).toEqual({ state: "cut-off", stopped: 1 });
    expect(readCutoff("claude", "")).toEqual({ state: "whole" });
  });
});

describe("readCutoff on any other harness", () => {
  const cutOffLooking = stream(
    init,
    started("t1"),
    notified("t1", "stopped"),
    result(stats({ spawned: 1, completed: 0, system: 1 })),
  );

  test("is not read, whatever the stream holds", () => {
    for (const harness of ["codex", "grok", "agy", "muse", "pi", "mimo", "", "unknown"]) {
      expect(readCutoff(harness, cutOffLooking)).toEqual({ state: "not-read" });
    }
  });
});

describe("the marker", () => {
  const withTemp = (body: (dir: string) => void): void => {
    const dir = mkdtempSync(join(tmpdir(), "lane-cutoff-"));
    try {
      body(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const cut = stream(init, result(stats({ spawned: 1, completed: 0, system: 1 })));
  const whole = stream(init, result(stats({ spawned: 1, completed: 1 })));

  test("sits beside the stream under the same name, with .cutoff for .jsonl", () => {
    expect(cutoffMarkerPath("/runs/T/logs/review-r1-style-fruit.jsonl")).toBe(
      "/runs/T/logs/review-r1-style-fruit.cutoff",
    );
    expect(cutoffMarkerPath("/runs/T/logs/events")).toBe("/runs/T/logs/events.cutoff");
  });

  test("a cut-off lane leaves it with one line naming the count, and it reads back", () => {
    withTemp((dir) => {
      const streamPath = join(dir, "review-r2-bug-pear.jsonl");
      expect(recordCutoff({ stream: streamPath, harness: "claude", tail: cut })).toEqual({
        state: "cut-off",
        stopped: 1,
      });
      const marker = cutoffMarkerPath(streamPath);
      expect(readFileSync(marker, "utf8")).toBe("1 helper stopped before it reported\n");
      expect(readCutoffMarker(marker)).toBe("1 helper stopped before it reported");
    });
  });

  test("a count above one is plural", () => {
    withTemp((dir) => {
      const streamPath = join(dir, "s.jsonl");
      const many = stream(init, result(stats({ spawned: 5, completed: 0, system: 5 })));
      recordCutoff({ stream: streamPath, harness: "claude", tail: many });
      expect(readCutoffMarker(cutoffMarkerPath(streamPath))).toBe(
        "5 helpers stopped before they reported",
      );
    });
  });

  test("a whole lane removes a marker an earlier launch left", () => {
    withTemp((dir) => {
      const streamPath = join(dir, "s.jsonl");
      const marker = cutoffMarkerPath(streamPath);
      writeFileSync(marker, "1 helper stopped before it reported\n");
      expect(recordCutoff({ stream: streamPath, harness: "claude", tail: whole })).toEqual({
        state: "whole",
      });
      expect(existsSync(marker)).toBe(false);
      expect(readCutoffMarker(marker)).toBeNull();
    });
  });

  test("a harness that is not read writes nothing and removes nothing", () => {
    withTemp((dir) => {
      const streamPath = join(dir, "s.jsonl");
      const marker = cutoffMarkerPath(streamPath);
      expect(recordCutoff({ stream: streamPath, harness: "codex", tail: cut })).toEqual({
        state: "not-read",
      });
      expect(existsSync(marker)).toBe(false);
      writeFileSync(marker, "left by an earlier launch\n");
      recordCutoff({ stream: streamPath, harness: "codex", tail: whole });
      expect(existsSync(marker)).toBe(true);
    });
  });

  test("a marker that cannot be written is reported, never swallowed", () => {
    withTemp((dir) => {
      const streamPath = join(dir, "missing-folder", "s.jsonl");
      expect(() => recordCutoff({ stream: streamPath, harness: "claude", tail: cut })).toThrow();
    });
  });

  test("an empty marker still counts as a cut-off lane, with a generic note", () => {
    withTemp((dir) => {
      const marker = join(dir, "s.cutoff");
      writeFileSync(marker, "");
      expect(readCutoffMarker(marker)).toBe(CUTOFF_CAUSE);
    });
  });
});
