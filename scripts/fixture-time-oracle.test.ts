// Blind acceptance tests for #265: a fixture score shows where the run's time
// went. Written by the coachman before reading any lane's work, at the
// ticket's interface; the synthetic runs are built by fixture-time-oracle.ts
// beside it. C6 needs a dispatched run, so no unit test proves it; the
// merge-condition fixture run is its proof.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { buildOracle, DESIGNS, ORDER1, ORDER2 } from "./fixture-time-oracle.ts";
import type { OracleCtx } from "./fixture-time-oracle.ts";

let ctx: OracleCtx | null = null;

beforeAll(() => {
  ctx = buildOracle();
}, 900000);

afterAll(() => {
  ctx?.restore();
  ctx = null;
});

function sc(name: string): { code: number; stdout: string } {
  return ctx?.scores[name] ?? { code: -1, stdout: "" };
}

function rt(name: string): { code: number; stdout: string } {
  return ctx?.runtimes[name] ?? { code: -1, stdout: "" };
}

// --- reading a score ----------------------------------------------------------
const CHECK_RE =
  /^(ok  |FAIL) (hidden-tests|gate|stages|markers|handoffs|run\.json|premises-order|efforts|ship-card) /u;

function timeSection(stdout: string): string[] {
  const lines = stdout.split("\n");
  let last = -1;
  lines.forEach((line, i) => {
    if (CHECK_RE.test(line)) last = i;
  });
  return lines.slice(last + 1).filter((line) => line.trim() !== "");
}

function fails(stdout: string): string[] {
  return stdout
    .split("\n")
    .filter((line) => line.startsWith("FAIL"))
    .map((line) => line.split(/\s+/u)[1] ?? "");
}

const FIG_RE = /\d+h \d+m|\d+m \d+s|\b\d+s\b/gu;

function figures(s: string): string[] {
  return [...new Set(s.match(FIG_RE) ?? [])];
}

function totalFigure(runTimesOut: string): string {
  const totalLine = runTimesOut.split("\n").find((line) => line.startsWith("total")) ?? "";
  return totalLine.match(FIG_RE)?.[0] ?? "";
}

function countOcc(haystack: string, needle: string): number {
  return needle ? haystack.split(needle).length - 1 : 0;
}

function wordPos(line: string, word: string): number {
  return line.search(new RegExp(`\\b${word}\\b`, "u"));
}

const STAGES = [
  "dispatched",
  "bootstrapped",
  "workhorses-running",
  "synthesis",
  "checkpoint-1",
  "review",
  "shipping",
  "shipped",
  "done",
];

function stagesIn(line: string): string[] {
  const toks = new Set(line.toLowerCase().split(/[^a-z0-9]+/u));
  return STAGES.filter((s) => (s.includes("-") ? line.includes(s) : toks.has(s)));
}

describe("sanity: the engineered timelines read back as designed", () => {
  test("floor totals 1h 13m with 11m 14s waiting, longest 6m 40s", () => {
    expect(rt("floor").code).toBe(0);
    expect(totalFigure(rt("floor").stdout)).toBe("1h 13m");
    for (const fig of ["2m 30s", "2m 00s", "6m 40s"]) {
      expect(rt("floor").stdout.includes(fig)).toBe(true);
    }
    const figs = (
      rt("floor")
        .stdout.split("\n")
        .find((l) => l.startsWith("total")) ?? ""
    ).match(FIG_RE);
    expect(figs?.[1]).toBe("11m 14s");
  });
  test("longwait waits 19m 31s and 13m 05s, totals 1h 40m", () => {
    expect(rt("longwait").code).toBe(0);
    expect(totalFigure(rt("longwait").stdout)).toBe("1h 40m");
    expect(rt("longwait").stdout.includes("19m 31s")).toBe(true);
    expect(rt("longwait").stdout.includes("13m 05s")).toBe(true);
  });
  test("short totals 56m 01s, noreview 16m 01s", () => {
    expect(totalFigure(rt("short").stdout)).toBe("56m 01s");
    expect(totalFigure(rt("noreview").stdout)).toBe("16m 01s");
  });
  test("notiming has no stage changes for run-times", () => {
    expect(rt("notiming").code).toBe(3);
    expect(rt("notiming").stdout.includes("no stage changes")).toBe(true);
  });
});

describe("C1: each stage's time, with waiting apart", () => {
  test("every run-times figure reappears in the score", () => {
    for (const name of ["floor", "short", "longwait"]) {
      for (const fig of figures(rt(name).stdout)) {
        expect(sc(name).stdout.includes(fig)).toBe(true);
      }
    }
  });
  test("every stage is named in the score", () => {
    for (const name of ["floor", "short", "longwait", "nocard"]) {
      for (const stage of ORDER2) {
        expect(sc(name).stdout.includes(stage)).toBe(true);
      }
    }
    for (const stage of ORDER1) {
      expect(sc("noreview").stdout.includes(stage)).toBe(true);
    }
  });
  test("a run with no stage lines says it could not be timed", () => {
    expect(sc("notiming").stdout).toMatch(/could not be timed/iu);
    expect(fails(sc("notiming").stdout)).toContain("stages");
  });
  test("a timed run never says it could not be timed", () => {
    for (const name of ["floor", "short", "longwait", "noreview", "nocard"]) {
      expect(sc(name).stdout).not.toMatch(/could not be timed/iu);
    }
  });
});

describe("C2: the slowest workhorse and reviewer, with times", () => {
  test("one line names the workhorses slowest first", () => {
    const lines = timeSection(sc("floor").stdout);
    const hit = lines.some((line) => {
      const a = wordPos(line, "one");
      const b = wordPos(line, "two");
      return a >= 0 && b >= 0 && a < b;
    });
    expect(hit).toBe(true);
  });
  test("the workhorses read slowest first across the time section", () => {
    const joined = timeSection(sc("floor").stdout).join("\n");
    const a = wordPos(joined, "one");
    const b = wordPos(joined, "two");
    expect(a >= 0 && b >= 0 && a < b).toBe(true);
  });
  test("one line per round names its reviewers slowest first, with lenses", () => {
    const lines = timeSection(sc("floor").stdout);
    const round1 = lines.some((line) => {
      const a = wordPos(line, "rslow");
      const b = wordPos(line, "rmid");
      const c = wordPos(line, "rfast");
      return (
        a >= 0 &&
        b >= 0 &&
        c >= 0 &&
        a < b &&
        b < c &&
        line.includes("bug") &&
        line.includes("style")
      );
    });
    const round2 = lines.some((line) => {
      const a = wordPos(line, "rslow2");
      const b = wordPos(line, "rfast2");
      return a >= 0 && b >= 0 && a < b && line.includes("bug") && line.includes("security");
    });
    expect(round1).toBe(true);
    expect(round2).toBe(true);
  });
  test("each reviewer shares a line with its lens", () => {
    const lines = timeSection(sc("floor").stdout);
    const pairs: Array<[string, string]> = [
      ["rslow", "bug"],
      ["rfast", "bug"],
      ["rmid", "style"],
      ["rslow2", "bug"],
      ["rfast2", "security"],
    ];
    for (const [rev, lens] of pairs) {
      const hit = lines.some((line) => wordPos(line, rev) >= 0 && wordPos(line, lens) >= 0);
      expect(hit).toBe(true);
    }
  });
  test("a run with no review leg names no lens", () => {
    expect(sc("noreview").stdout).not.toMatch(/\b(?:bug|security|style)\b/u);
  });
  test("a workhorse with no marker is named as such", () => {
    const joined = timeSection(sc("floor").stdout).join("\n");
    expect(wordPos(joined, "three") >= 0).toBe(true);
  });
});

describe("C3: stages that waited more than 10 minutes", () => {
  test("the long-wait line names checkpoint-1 and shipping together", () => {
    const hit = timeSection(sc("longwait").stdout).some(
      (line) => line.includes("checkpoint-1") && line.includes("shipping"),
    );
    expect(hit).toBe(true);
  });
  test("no line pairs two stages when every wait is short", () => {
    for (const name of ["floor", "short"]) {
      for (const line of timeSection(sc(name).stdout)) {
        expect(stagesIn(line).length).toBeLessThan(2);
      }
    }
  });
});

describe("C4: a run over the hour says so", () => {
  test("the over-hour total reads twice: table and over-hour line", () => {
    for (const name of ["floor", "longwait"]) {
      const total = totalFigure(rt(name).stdout);
      expect(total === "").toBe(false);
      expect(countOcc(sc(name).stdout, total)).toBeGreaterThanOrEqual(2);
    }
  });
  test("a short run's total reads once: table only", () => {
    for (const name of ["short", "noreview"]) {
      const total = totalFigure(rt(name).stdout);
      expect(total === "").toBe(false);
      expect(countOcc(sc(name).stdout, total)).toBe(1);
    }
  });
});

describe("C5 and D2: naming never changes the verdict", () => {
  test("the floor run scores clean with its over-hour line", () => {
    expect(sc("floor").code).toBe(0);
    expect(fails(sc("floor").stdout)).toEqual([]);
    expect(timeSection(sc("floor").stdout).join("\n").includes("checkpoint-1")).toBe(true);
  });
  test("without its card it fails ship-card and keeps its time lines", () => {
    expect(sc("nocard").code).toBe(2);
    expect(fails(sc("nocard").stdout)).toContain("ship-card");
    const total = totalFigure(rt("floor").stdout);
    expect(countOcc(sc("nocard").stdout, total)).toBeGreaterThanOrEqual(2);
    expect(timeSection(sc("nocard").stdout).join("\n").includes("checkpoint-1")).toBe(true);
  });
  test("the long-wait run fails its efforts check alone, with its time lines", () => {
    expect(sc("longwait").code).toBe(2);
    expect(fails(sc("longwait").stdout)).toEqual(["efforts"]);
    const hit = timeSection(sc("longwait").stdout).some(
      (line) => line.includes("checkpoint-1") && line.includes("shipping"),
    );
    expect(hit).toBe(true);
    const total = totalFigure(rt("longwait").stdout);
    expect(countOcc(sc("longwait").stdout, total)).toBeGreaterThanOrEqual(2);
  });
  test("every exit matches its checks: 0 when clean, 2 when a check fails", () => {
    for (const name of Object.keys(DESIGNS)) {
      expect(sc(name).code).toBe(fails(sc(name).stdout).length > 0 ? 2 : 0);
    }
  });
});
