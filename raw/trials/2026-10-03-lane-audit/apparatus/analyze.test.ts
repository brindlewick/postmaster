import { describe, expect, test } from "bun:test";
import {
  chapman,
  coverage,
  family,
  isSevere,
  laneGate,
  median,
  percentile,
  recallOf,
  reviewerRunning,
  reviewerShare,
  reviews,
  roundTimes,
  runTokens,
  severeTotals,
  singleLaneSufficed,
  spend,
  times,
  tokensByRole,
  workhorses,
} from "./analyze.ts";
import { parseOracle } from "./parse.ts";
import type { FindingRow, Gate, LaneTimes, RunRecord } from "./records.ts";

const lane = (name: string, seconds: number | null, outcome = "harvested"): LaneTimes => ({
  lane: name,
  specRound: false,
  firstLaunch: null,
  implementFrom: null,
  finished: null,
  harvested: null,
  implementSeconds: seconds,
  outcome,
  resumes: 0,
});

const gate = (ref: string, laneName: string | null, result: string, seconds = 10): Gate => ({
  name: "gate",
  ref,
  sha: "abc",
  result,
  exit: result === "pass" ? 0 : 1,
  seconds,
  ts: "2026-10-03T00:00:00Z",
  lane: laneName,
});

const finding = (over: Partial<FindingRow>): FindingRow => ({
  ts: "2026-10-03T00:00:00Z",
  target: "a.ts:1",
  class: "gating",
  severity: "P2",
  round: 1,
  lanes: [],
  lenses: [],
  pairs: null,
  dismissed: false,
  verified: "execution",
  ...over,
});

const run = (over: Partial<RunRecord> = {}): RunRecord => ({
  id: "1",
  kind: "real",
  layout: "project",
  ticket: "1",
  parked: false,
  first: "2026-10-03T00:00:00Z",
  last: "2026-10-03T05:00:00Z",
  actions: 1,
  badLines: 0,
  actionsInWindow: 1,
  stage: "done",
  legs: 2,
  team: null,
  laneOutcomes: {},
  stages: [],
  synthesis: null,
  synthesisAt: null,
  shares: null,
  lanes: [],
  gates: [],
  reviewLaunches: [],
  reviewHarvests: [],
  reviewDone: [],
  reviewReport: [],
  degrades: [],
  findings: [],
  applies: 0,
  escalations: 0,
  usage: [],
  coachman: [],
  streams: [],
  incidents: [],
  ...over,
});

const synthesis = (ranked: string[], oracle: string) => ({
  ranked,
  took: {},
  rejected: {},
  basis: "",
  oracle: parseOracle(oracle),
  oracleRaw: oracle,
});

describe("family", () => {
  test("the codex lanes are one family", () => {
    expect(["luna", "sol", "astra"].map(family)).toEqual(["codex", "codex", "codex"]);
    expect(family("mimo")).toBe("mimo");
  });
});

describe("laneGate", () => {
  const r = run({
    gates: [
      gate("wb/1-mimo", "mimo", "fail"),
      gate("wb/1-mimo", "mimo", "pass"),
      gate("1", null, "pass"),
      { ...gate("wb/1-sol", "sol", "pass"), name: "cli" },
    ],
  });

  test("the last gate run on the lane's own branch decides", () => {
    expect(laneGate(r, "mimo")).toBe("pass");
  });

  test("a lane with no gate run on its branch, or only another check, reads none", () => {
    expect(laneGate(r, "sol")).toBe("none");
    expect(laneGate(r, "luna")).toBe("none");
  });

  test("a failing last run reads fail", () => {
    expect(laneGate(run({ gates: [gate("wb/1-mimo", "mimo", "fail")] }), "mimo")).toBe("fail");
  });
});

describe("workhorses", () => {
  const r = run({
    synthesis: synthesis(["mimo", "astra"], "mimo:pass,astra:fail"),
    lanes: [lane("astra", 2914, "stalled"), lane("mimo", 5679)],
    gates: [gate("wb/1-mimo", "mimo", "pass")],
    shares: {
      code: { runs: 4000, lanes: { astra: 0, mimo: 2600 }, shared: 0, neither: 1400 },
    },
  });

  test("a run with no synthesis has no workhorse row", () => {
    expect(workhorses(run())).toBeNull();
  });

  test("ranking, blind tests, gates and the code shares", () => {
    const w = workhorses(r);
    expect(w?.first).toBe("mimo");
    expect(w?.second).toBe("astra");
    expect(w?.blind).toEqual({ mimo: true, astra: false });
    expect(w?.gate).toEqual({ astra: "none", mimo: "pass" });
    expect(w?.code).toEqual({ firstOnly: 65, secondOnly: 0, shared: 0, neither: 35 });
    expect(w?.minutes).toEqual({ astra: 49, mimo: 95 });
  });

  test("a stalled lane gives no extra wait", () => {
    expect(workhorses(r)?.extraWaitSeconds).toBeNull();
  });

  test("two lanes that finished: the later one's extra seconds, and which it was", () => {
    const both = run({
      synthesis: synthesis(["sol", "mimo"], "none"),
      lanes: [lane("sol", 161), lane("mimo", 523)],
    });
    const w = workhorses(both);
    expect(w?.extraWaitSeconds).toBe(362);
    expect(w?.slowerLane).toBe("mimo");
    expect(w?.blind).toBeNull();
  });
});

describe("singleLaneSufficed", () => {
  const w = (
    gateMap: Record<string, "pass" | "fail" | "none">,
    blind: Record<string, boolean> | null,
  ) => ({
    run: "1",
    ranked: [],
    first: null,
    second: null,
    outcome: {},
    blind,
    gate: gateMap,
    code: null,
    minutes: {},
    extraWaitSeconds: null,
    slowerLane: null,
  });

  test("one lane that passes the gate and the blind tests is enough", () => {
    expect(singleLaneSufficed(w({ a: "pass", b: "fail" }, { a: true, b: false }))).toBe("yes");
  });

  test("no lane passes both: not enough", () => {
    expect(singleLaneSufficed(w({ a: "pass", b: "pass" }, { a: false, b: false }))).toBe("no");
    expect(singleLaneSufficed(w({ a: "fail", b: "none" }, null))).toBe("no");
  });

  test("a ticket with no blind tests is judged on the gate alone", () => {
    expect(singleLaneSufficed(w({ a: "pass", b: "none" }, null))).toBe("yes");
  });

  test("nothing measured is unknown, not a no", () => {
    expect(singleLaneSufficed(w({ a: "none", b: "none" }, null))).toBe("unknown");
  });
});

describe("reviews", () => {
  const findings = [
    finding({ lanes: ["astra", "opus"] }),
    finding({ lanes: ["opus"] }),
    finding({ lanes: ["astra"], verified: "reading" }),
    finding({ lanes: [], severity: "P1" }),
    finding({ lanes: ["mimo"], severity: "P3" }),
    finding({ lanes: ["mimo"], class: "style" }),
    finding({ lanes: ["mimo"], dismissed: true }),
  ];
  const r = run({
    findings,
    reviewLaunches: [
      { ts: "t", lane: "astra", lens: "bug", round: 1 },
      { ts: "t", lane: "mimo", lens: "bug", round: 3 },
    ],
    reviewHarvests: [
      { ts: "t", lane: "astra", lens: "bug", round: 1, verdict: "reviewed", raw: null },
      { ts: "t", lane: "mimo", lens: "bug", round: 3, verdict: "degraded", raw: null },
    ],
  });

  test("severe means a verified gating P1 or P2 that was not dismissed", () => {
    expect(findings.map(isSevere)).toEqual([true, true, true, true, false, false, false]);
  });

  test("counts, who found what alone, shared and unattributed", () => {
    const s = reviews(r);
    expect(s.severe).toBe(4);
    expect(s.severeByExecution).toBe(3);
    expect(s.byLane).toEqual({
      astra: { found: 2, alone: 1 },
      opus: { found: 2, alone: 1 },
    });
    expect(s.shared).toBe(1);
    expect(s.unattributed).toBe(1);
    expect(s.rounds).toBe(3);
    expect(s.launches).toBe(2);
    expect(s.degraded).toBe(1);
  });

  test("a run with no findings reads zero everywhere", () => {
    const s = reviews(run());
    expect(s.severe).toBe(0);
    expect(s.byLane).toEqual({});
    expect(s.rounds).toBe(0);
  });
});

describe("recallOf", () => {
  const r = run({
    findings: [
      finding({ lanes: ["luna", "mimo"] }),
      finding({ lanes: ["mimo"] }),
      finding({ lanes: ["opus"] }),
      finding({ lanes: [] }),
    ],
    reviewLaunches: [
      { ts: "t", lane: "luna", lens: "bug", round: 1 },
      { ts: "t", lane: "mimo", lens: "bug", round: 1 },
      { ts: "t", lane: "opus", lens: "security", round: 1 },
    ],
  });

  test("what a review by some of the lanes would have found of the attributed severe findings", () => {
    expect(recallOf([r], ["mimo"])).toEqual({ lanes: ["mimo"], found: 2, of: 3 });
    expect(recallOf([r], ["luna"])).toEqual({ lanes: ["luna"], found: 1, of: 3 });
    expect(recallOf([r], ["luna", "mimo", "opus"])).toEqual({
      lanes: ["luna", "mimo", "opus"],
      found: 3,
      of: 3,
    });
  });

  test("runs where none of the lanes reviewed are left out", () => {
    expect(recallOf([r], ["sol"])).toEqual({ lanes: ["sol"], found: 0, of: 0 });
  });
});

describe("chapman", () => {
  test("two reviewers who each found 10 and shared 5 point to about 19 in all", () => {
    expect(chapman(10, 10, 5)).toBeCloseTo(19.17, 2);
  });

  test("full overlap points to what was found, and no overlap to a larger total", () => {
    expect(chapman(10, 10, 10)).toBeCloseTo(10, 5);
    expect(chapman(10, 10, 0)).toBeGreaterThan(100);
  });
});

describe("spend", () => {
  test("sums by role and lane, sums money only where reported, and counts launches without figures", () => {
    const r = run({
      usage: [
        {
          file: "a",
          role: "reviewer",
          lane: "opus",
          harness: "claude",
          lens: "security",
          round: 1,
          inputTokens: 10,
          outputTokens: 100,
          costUsd: 1.5,
          readError: false,
        },
        {
          file: "b",
          role: "reviewer",
          lane: "opus",
          harness: "claude",
          lens: "security",
          round: 2,
          inputTokens: 5,
          outputTokens: 50,
          costUsd: 0.5,
          readError: false,
        },
        {
          file: "c",
          role: "reviewer",
          lane: "astra",
          harness: "codex",
          lens: "bug",
          round: 1,
          inputTokens: null,
          outputTokens: null,
          costUsd: null,
          readError: true,
        },
      ],
    });
    const s = spend(r);
    expect(s["reviewer:opus"]).toEqual({ input: 15, output: 150, usd: 2, launches: 2, missing: 0 });
    expect(s["reviewer:astra"]).toEqual({
      input: 0,
      output: 0,
      usd: null,
      launches: 1,
      missing: 1,
    });
  });

  test("a run with no usage records spends nothing recorded", () => {
    expect(spend(run())).toEqual({});
  });
});

describe("times", () => {
  test("seconds per stage and the gate's seconds on lane branches and on the synthesis", () => {
    const r = run({
      stages: [
        { stage: "dispatched", at: "2026-10-03T00:00:00Z", seconds: 60 },
        { stage: "planning", at: "2026-10-03T00:01:00Z", seconds: 600 },
        { stage: "workhorses-running", at: "2026-10-03T00:11:00Z", seconds: 3600 },
        { stage: "done", at: "2026-10-03T05:00:00Z", seconds: null },
      ],
      gates: [
        gate("wb/1-mimo", "mimo", "pass", 850),
        gate("1", null, "pass", 872),
        gate("1", null, "pass", 877),
      ],
    });
    const t = times(r);
    expect(t.planning).toBe(600);
    expect(t.workhorses).toBe(3600);
    expect(t.synthesis).toBeNull();
    expect(t.total).toBe(18000);
    expect(t.gateSeconds).toEqual({ lanes: 850, synthesis: 1749 });
  });

  test("a run still going has no total", () => {
    const r = run({
      stages: [{ stage: "planning", at: "2026-10-03T00:01:00Z", seconds: null }],
    });
    expect(times(r).total).toBeNull();
  });
});

describe("median and percentile", () => {
  test("the middle of an odd count, the mean of the middle two of an even count, null for none", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  test("a percentile picks from the sorted values and stays inside them", () => {
    expect(percentile([5, 1, 3, 2, 4, 6, 7, 8, 9, 10], 0.9)).toBe(10);
    expect(percentile([5], 0.9)).toBe(5);
    expect(percentile([], 0.5)).toBeNull();
  });
});

describe("coverage", () => {
  const since = "2026-09-30T15:40:00Z";
  const runs = [
    run({
      id: "a",
      actionsInWindow: 3,
      stage: "done",
      synthesis: synthesis(["x", "y"], "none"),
      synthesisAt: "2026-10-01T00:00:00Z",
    }),
    run({
      id: "b",
      actionsInWindow: 1,
      stage: "done",
      synthesis: synthesis(["x", "y"], "none"),
      synthesisAt: "2026-09-29T00:00:00Z",
    }),
    run({ id: "c-parked-1", parked: true, actionsInWindow: 2, stage: "done" }),
    run({ id: "d", actionsInWindow: 5, stage: "planning" }),
    run({ id: "e", actionsInWindow: 0, stage: "done" }),
  ];

  test("counts what had activity, reached synthesis there or before, finished or is going", () => {
    expect(coverage(runs, since)).toEqual({
      folders: 5,
      inWindow: 4,
      parked: 1,
      reachedSynthesis: 2,
      synthesisInWindow: 1,
      finished: 3,
      inProgress: 1,
    });
  });

  test("a set with nothing in the window covers nothing", () => {
    expect(coverage([runs[4] as RunRecord], since).inWindow).toBe(0);
  });
});

describe("severeTotals", () => {
  const r = run({
    findings: [
      finding({ lanes: ["luna", "mimo"] }),
      finding({ lanes: ["mimo"] }),
      finding({ lanes: ["opus"] }),
      finding({ lanes: [] }),
      finding({ lanes: ["mimo"], severity: "P3" }),
    ],
  });

  test("alone, shared, named and unattributed, over severe findings only", () => {
    expect(severeTotals([r])).toEqual({
      total: 4,
      alone: { mimo: 1, opus: 1 },
      shared: 1,
      unattributed: 1,
      named: { luna: 1, mimo: 2, opus: 1 },
    });
  });

  test("no runs, no findings", () => {
    expect(severeTotals([])).toEqual({
      total: 0,
      alone: {},
      shared: 0,
      unattributed: 0,
      named: {},
    });
  });
});

describe("tokensByRole and runTokens", () => {
  const stream = (
    role: "workhorse" | "reviewer",
    laneName: string,
    input: number,
    output: number,
    usd: number | null,
  ) => ({
    role,
    lane: laneName,
    harness: "h",
    lens: null,
    round: null,
    inputTokens: input,
    outputTokens: output,
    costUsd: usd,
  });
  const r = run({
    streams: [
      stream("workhorse", "luna", 100, 10, null),
      stream("workhorse", "mimo", 20, 5, 0),
      stream("reviewer", "sol", 40, 4, null),
      stream("reviewer", "opus", 1, 9, 2.5),
      stream("reviewer", "opus", 1, 1, 0.5),
    ],
    coachman: [
      { leg: 1, inputTokens: 1000, outputTokens: 50 },
      { leg: 2, inputTokens: 2000, outputTokens: 70 },
    ],
  });

  test("by role, with codex lanes as one family and money only where reported", () => {
    const t = tokensByRole([r]);
    expect(t["workhorse codex"]).toEqual({ launches: 1, input: 100, output: 10, usd: null });
    expect(t["workhorse mimo"]).toEqual({ launches: 1, input: 20, output: 5, usd: 0 });
    expect(t["reviewer opus"]).toEqual({ launches: 2, input: 2, output: 10, usd: 3 });
    expect(t.coachman).toEqual({ launches: 2, input: 3000, output: 120, usd: null });
  });

  test("one run's tokens by role", () => {
    expect(runTokens(r)).toEqual({
      workhorse: { input: 120, output: 15 },
      reviewer: { input: 42, output: 14 },
      coachman: { input: 3000, output: 120 },
    });
  });

  test("a run with no streams spends nothing", () => {
    expect(runTokens(run()).workhorse).toEqual({ input: 0, output: 0 });
  });
});

describe("roundTimes", () => {
  const r = run({
    reviewLaunches: [
      { ts: "2026-10-03T00:00:00Z", lane: "sol", lens: "bug", round: 1 },
      { ts: "2026-10-03T00:00:01Z", lane: "mimo", lens: "bug", round: 1 },
      { ts: "2026-10-03T01:00:00Z", lane: "sol", lens: "bug", round: 2 },
    ],
    reviewDone: [
      { round: 1, lens: "bug", lane: "sol", done: "2026-10-03T00:10:00Z" },
      { round: 1, lens: "bug", lane: "mimo", done: "2026-10-03T00:25:00Z" },
      { round: 2, lens: "bug", lane: "sol", done: "2026-10-03T01:12:00Z" },
      { round: 3, lens: "bug", lane: "sol", done: "2026-10-03T02:00:00Z" },
    ],
  });

  test("a round's length is launch to last exit, and its spread needs two reviewers", () => {
    const t = roundTimes(r);
    expect(t.length).toBe(2);
    expect(t[0]).toEqual({
      round: 1,
      seconds: { "bug:sol": 600, "bug:mimo": 1500 },
      length: 1500,
      spread: 900,
    });
    expect(t[1]).toEqual({ round: 2, seconds: { "bug:sol": 720 }, length: 720, spread: null });
  });

  test("a round with no launch line is left out", () => {
    expect(roundTimes(r).some((x) => x.round === 3)).toBe(false);
  });
});

describe("reviewerRunning and reviewerShare", () => {
  const timed = run({
    stages: [
      { stage: "review", at: "2026-10-03T00:00:00Z", seconds: 7200 },
      { stage: "done", at: "2026-10-03T02:00:00Z", seconds: null },
    ],
    reviewLaunches: [
      { ts: "2026-10-03T00:00:00Z", lane: "sol", lens: "bug", round: 1 },
      { ts: "2026-10-03T01:00:00Z", lane: "sol", lens: "bug", round: 2 },
    ],
    reviewDone: [
      { round: 1, lens: "bug", lane: "sol", done: "2026-10-03T00:30:00Z" },
      { round: 2, lens: "bug", lane: "sol", done: "2026-10-03T01:15:00Z" },
    ],
  });

  test("the reviewers' time is the rounds summed, and its share of the review stage", () => {
    expect(reviewerRunning(timed)).toBe(2700);
    expect(reviewerShare(timed)).toBeCloseTo(0.375, 5);
  });

  test("a run with no timed round, or no review stage, has neither", () => {
    expect(reviewerRunning(run())).toBeNull();
    expect(reviewerShare(run())).toBeNull();
    expect(reviewerShare({ ...timed, stages: [] })).toBeNull();
  });
});
