import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extract, serialize } from "./extract.ts";
import { privacyFaults } from "./records.ts";

const scratch = mkdtempSync(join(tmpdir(), "lane-audit-extract-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const put = (name: string, text: string): void => {
  mkdirSync(join(scratch, name, ".."), { recursive: true });
  writeFileSync(join(scratch, name), text);
};

const action = (ts: string, actor: string, name: string, target = "", detail = ""): string =>
  `${JSON.stringify({ ts, project: "p", run: "r", actor, action: name, target, detail })}\n`;

const window = { since: "2026-09-30T15:40:00Z", until: "2026-10-03T15:40:00Z" };

describe("extract", () => {
  put(
    "proj/.postmaster/runs/200/actions.jsonl",
    action("2026-10-03T01:00:00Z", "postmaster", "dispatch", "#200"),
  );
  put(
    "proj/.postmaster/runs/92/actions.jsonl",
    action("2026-09-30T13:57:56Z", "postmaster", "dispatch", "#92"),
  );
  put(
    "proj/.postmaster/runs/57/actions.jsonl",
    action("2026-09-29T10:00:00Z", "postmaster", "dispatch", "#57") +
      action("2026-10-01T13:01:59Z", "postmaster", "stage", "done"),
  );

  test("a run is covered when any action falls in the window, however early it began", () => {
    const out = extract({ project: join(scratch, "proj") }, window, null, "abc1234");
    expect(out.runs.map((r) => r.id).sort()).toEqual(["200", "57"]);
    expect(out.outside).toEqual(["92"]);
    expect(out.tool).toBe("abc1234");
    expect(out.runs.find((r) => r.id === "57")?.actionsInWindow).toBe(1);
  });

  test("a window that holds nothing covers no run, and the output names no machine", () => {
    const out = extract(
      { project: join(scratch, "proj") },
      { since: "2027-01-01T00:00:00Z", until: "2027-01-02T00:00:00Z" },
      null,
    );
    expect(out.runs).toEqual([]);
    expect(
      privacyFaults(JSON.stringify(extract({ project: join(scratch, "proj") }, window, null))),
    ).toEqual([]);
  });
});

describe("serialize", () => {
  test("is valid JSON with one run to a line", () => {
    const out = extract({ project: join(scratch, "proj") }, window, null, "abc1234");
    const text = serialize(out);
    expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(out)));
    expect(text.trimEnd().split("\n").length).toBe(out.runs.length + 2);
  });

  test("a window with no run still parses", () => {
    const out = extract(
      { project: join(scratch, "proj") },
      { since: "2027-01-01T00:00:00Z", until: "2027-01-02T00:00:00Z" },
      null,
    );
    expect(JSON.parse(serialize(out)).runs).toEqual([]);
  });
});
