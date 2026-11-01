// Tests beside scripts/lib/greptile-record.ts: how a run's Greptile step reads from the action log.
import { describe, expect, test } from "bun:test";
import {
  askedAgain,
  decisionOf,
  gateVerdict,
  harvestOf,
  missOf,
  nextRound,
  parseRows,
  type Row,
  roundOf,
  ruleWord,
  settled,
  stepsOf,
} from "./greptile-record.ts";

const row = (action: string, target: string, detail: string): Row => ({ action, target, detail });
const launch = (n: number): Row => row("review-launch", "greptile", `greptile round ${n}`);
const finish = (n: number): Row => row("review-finish", "greptile", `greptile round ${n}`);
const harvest = (n: number, k: number): Row =>
  row("review-harvest", "greptile", `greptile round ${n} reported ${k} findings`);
const miss = (n: number, cause: string): Row =>
  row("degrade", "greptile", `greptile r${n}: ${cause}`);
const rule = (word: string): Row => row("rule", "greptile", `${word} the user's words`);

describe("reading the lines", () => {
  test("a launch, a finish and a harvest name their round", () => {
    expect(roundOf("greptile round 3")).toBe(3);
    expect(roundOf("greptile round 3 reported 2 findings")).toBe(3);
    expect(roundOf("style round 3")).toBeNull();
    expect(roundOf("greptile round 0")).toBeNull();
    expect(roundOf("greptile round three")).toBeNull();
    expect(roundOf("greptile r3")).toBeNull();
  });

  test("a harvest names its findings, and a miss its round and cause", () => {
    expect(harvestOf("greptile round 3 reported 0 findings")).toEqual({ round: 3, findings: 0 });
    expect(harvestOf("greptile round 3 reported 1 finding")).toEqual({ round: 3, findings: 1 });
    expect(harvestOf("greptile round 3")).toBeNull();
    expect(harvestOf("greptile round 3 reported many findings")).toBeNull();
    expect(missOf('greptile r3: "Not signed in."')).toEqual({
      round: 3,
      cause: '"Not signed in."',
    });
    expect(missOf("greptile r12: warning: 1 file")).toEqual({
      round: 12,
      cause: "warning: 1 file",
    });
    expect(missOf("bug r3: timeout")).toBeNull();
    expect(missOf("greptile round 3: timeout")).toBeNull();
  });

  test("a rule is the user's word on greptile and no other target", () => {
    expect(ruleWord(rule("go-on"))).toBe("go-on");
    expect(ruleWord(row("rule", "wall", "wall go-on"))).toBeNull();
    expect(ruleWord(row("note", "greptile", "go-on"))).toBeNull();
  });

  test("a log is rows, or the first line that is not one", () => {
    const good = `${JSON.stringify({ action: "gate", target: "x", detail: "d" })}\n\n${JSON.stringify({ action: "note" })}\n`;
    expect(parseRows(good)).toEqual({
      rows: [
        { action: "gate", target: "x", detail: "d" },
        { action: "note", target: "", detail: "" },
      ],
    });
    expect(parseRows("{}\n")).toEqual({ fault: "actions.jsonl line 1 has no action" });
    expect(parseRows("[]\n")).toEqual({ fault: "actions.jsonl line 1 is not an action object" });
    expect(parseRows(`${JSON.stringify({ action: "note" })}\nnot json\n`)).toEqual({
      fault: "actions.jsonl line 2 is not JSON",
    });
  });
});

describe("the steps a log shows", () => {
  test("none for a log without Greptile", () => {
    expect(stepsOf([row("review-launch", "luna", "bug round 1"), row("note", "x", "y")])).toEqual(
      [],
    );
  });

  test("a launch alone is unfinished, and a harvest or a miss after it is its outcome", () => {
    expect(stepsOf([launch(3)])).toEqual([{ round: 3, at: 0, outcome: { kind: "unfinished" } }]);
    expect(stepsOf([launch(3), finish(3), harvest(3, 2)])).toEqual([
      { round: 3, at: 2, outcome: { kind: "reviewed", findings: 2 } },
    ]);
    expect(stepsOf([launch(3), miss(3, "timeout after 5s")])).toEqual([
      { round: 3, at: 1, outcome: { kind: "missed", cause: "timeout after 5s" } },
    ]);
  });

  test("steps come oldest round first, and lines of other lenses and lanes are no part of them", () => {
    const rows = [
      launch(3),
      row("review-launch", "luna", "bug round 2"),
      miss(3, "x"),
      row("degrade", "luna", "bug r2: timeout"),
      launch(4),
      harvest(4, 0),
    ];
    expect(stepsOf(rows).map((s) => [s.round, s.outcome.kind])).toEqual([
      [3, "missed"],
      [4, "reviewed"],
    ]);
  });

  test("a miss with no launch before it is still a step", () => {
    expect(stepsOf([miss(2, "cause")]).map((s) => s.round)).toEqual([2]);
  });
});

describe("the user's word after a step", () => {
  const missed = [launch(3), miss(3, "x")];

  test("go-on, fix and rule-out settle it; try-again and review-again ask for another step", () => {
    for (const word of ["go-on", "fix", "rule-out"]) {
      const rows = [...missed, rule(word)];
      const [step] = stepsOf(rows);
      expect(settled(rows, step!)).toBe(true);
      expect(askedAgain(rows, step!)).toBe(false);
    }
    for (const word of ["try-again", "review-again"]) {
      const rows = [...missed, rule(word)];
      const [step] = stepsOf(rows);
      expect(settled(rows, step!)).toBe(false);
      expect(askedAgain(rows, step!)).toBe(true);
    }
  });

  test("a word before the step's outcome counts for nothing, and an unknown word settles nothing", () => {
    const rows = [rule("go-on"), launch(3), miss(3, "x"), rule("maybe")];
    const [step] = stepsOf(rows);
    expect(settled(rows, step!)).toBe(false);
    expect(askedAgain(rows, step!)).toBe(false);
  });

  test("the last word decides between settling and asking again", () => {
    const rows = [...missed, rule("go-on"), rule("try-again")];
    const [step] = stepsOf(rows);
    expect(settled(rows, step!)).toBe(false);
    expect(askedAgain(rows, step!)).toBe(true);
    const back = [...rows, rule("go-on")];
    expect(settled(back, stepsOf(back)[0]!)).toBe(true);
  });
});

describe("the gate before the ship card", () => {
  test("is clear where the waybill names no Greptile review, whatever the log holds", () => {
    expect(gateVerdict([launch(3), miss(3, "x")], false).clear).toBe(true);
    expect(gateVerdict([], false).clear).toBe(true);
  });

  test("is held where the waybill names it and no step has run", () => {
    expect(gateVerdict([], true)).toEqual({
      clear: false,
      why: "the waybill names greptile and no Greptile step has run",
    });
  });

  test("is clear after a review that reported no finding, and held for anything else", () => {
    expect(gateVerdict([launch(3), harvest(3, 0)], true).clear).toBe(true);
    expect(gateVerdict([launch(3), harvest(3, 1)], true).clear).toBe(false);
    expect(gateVerdict([launch(3), harvest(3, 1)], true).why).toContain("reported 1 finding;");
    expect(gateVerdict([launch(3), miss(3, "Not signed in.")], true).why).toContain(
      "missed: Not signed in.",
    );
    expect(gateVerdict([launch(3)], true).why).toContain("has no result");
  });

  test("a finding of any severity holds the card, the lowest included", () => {
    expect(gateVerdict([launch(3), harvest(3, 1)], true).clear).toBe(false);
  });

  test("is clear again once the user has settled the latest step, and not for a word that asks for another", () => {
    const failed = [launch(3), harvest(3, 2)];
    expect(gateVerdict([...failed, rule("fix")], true).clear).toBe(true);
    expect(gateVerdict([...failed, rule("go-on")], true).clear).toBe(true);
    expect(gateVerdict([...failed, rule("review-again")], true).clear).toBe(false);
  });

  test("judges the latest step alone", () => {
    const rows = [launch(3), miss(3, "x"), rule("try-again"), launch(4), harvest(4, 0)];
    expect(gateVerdict(rows, true).clear).toBe(true);
    const again = [launch(3), harvest(3, 0), rule("review-again"), launch(4), miss(4, "y")];
    expect(gateVerdict(again, true).clear).toBe(false);
  });
});

describe("the step's own decision", () => {
  test("a review that reported nothing ends the loop", () => {
    expect(decisionOf(3, { kind: "reviewed", findings: 0 })).toEqual({
      first: "STOP",
      cause: "greptile-clean",
      line: "STOP 3: the Greptile review reported no finding in round 3",
    });
  });

  test("a review that reported anything, or was missed, is a ruling at once", () => {
    expect(decisionOf(3, { kind: "reviewed", findings: 1 }).line).toBe(
      "RULING 3: the Greptile review reported 1 finding in round 3; escalate with residue",
    );
    expect(decisionOf(3, { kind: "reviewed", findings: 2 }).cause).toBe("greptile-findings");
    expect(decisionOf(3, { kind: "missed", cause: "x" })).toEqual({
      first: "RULING",
      cause: "greptile-missed",
      line: "RULING 3: the Greptile review was missed in round 3; escalate with residue",
    });
    expect(decisionOf(3, { kind: "unfinished" }).cause).toBe("greptile-missed");
  });
});

describe("the step's round", () => {
  test("is one more than the highest round any review has had", () => {
    expect(nextRound([], [])).toBe(1);
    expect(
      nextRound(
        [row("review-launch", "luna", "bug round 1"), row("review-launch", "luna", "bug round 2")],
        [],
      ),
    ).toBe(3);
    expect(nextRound([launch(3)], [])).toBe(4);
    expect(nextRound([], ["review-r2.json", "review-r2-bug-luna.done", "greptile-r9.json"])).toBe(
      3,
    );
  });

  test("ignores lines that are not launches and details that name no round", () => {
    expect(
      nextRound(
        [row("review-finish", "luna", "bug round 7"), row("review-launch", "luna", "odd")],
        [],
      ),
    ).toBe(1);
  });
});
