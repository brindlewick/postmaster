import { describe, expect, test } from "bun:test";
import {
  chapman,
  coverage,
  family,
  groupByRoundOne,
  isSevere,
  laneGate,
  lastRound,
  median,
  percentile,
  recallOf,
  reviewerRunning,
  reviewerShare,
  reviews,
  roundTimes,
  runTokens,
  sampleSd,
  severeByRound,
  severeTotals,
  singleLaneSufficed,
  spend,
  ticketsPerGroup,
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

describe("lastRound", () => {
  const launch = (round: number | null) => ({ ts: "t", lane: "luna", lens: "bug", round });
  const harvest = (round: number | null) => ({
    ...launch(round),
    verdict: "reviewed" as const,
    raw: null,
  });

  test("the highest round any launch line names", () => {
    expect(lastRound(run({ reviewLaunches: [launch(1), launch(3), launch(2)] }))).toBe(3);
  });

  test("a round past the cap has a harvest and no launch line, and still counts", () => {
    const r = run({
      reviewLaunches: [launch(1), launch(2), launch(3), launch(4)],
      reviewHarvests: [harvest(4), harvest(5)],
    });
    expect(lastRound(r)).toBe(5);
  });

  test("a finding's round counts where no review line names one", () => {
    expect(lastRound(run({ findings: [finding({ round: 1 }), finding({ round: 4 })] }))).toBe(4);
  });

  test("lines that name no round, and a run with no review lines, read zero", () => {
    expect(
      lastRound(run({ reviewLaunches: [launch(null)], reviewHarvests: [harvest(null)] })),
    ).toBe(0);
    expect(lastRound(run())).toBe(0);
  });
});

describe("severeByRound", () => {
  const r = run({
    findings: [
      finding({ round: 1 }),
      finding({ round: 1, severity: "P1" }),
      finding({ round: 2 }),
      finding({ round: 1, severity: "P3" }),
      finding({ round: 1, class: "style" }),
      finding({ round: 1, dismissed: true }),
      finding({ round: null }),
    ],
  });

  test("severe findings in all and in each round, by the round the line names", () => {
    expect(severeByRound(r)).toEqual({
      run: "1",
      byRound: { 1: 2, 2: 1 },
      noRound: 1,
      total: 4,
      roundOne: 2,
      lastWithFinding: 2,
    });
  });

  test("a finding with no round is in the total and in no round", () => {
    const s = severeByRound(run({ findings: [finding({ round: null })] }));
    expect(s.total).toBe(1);
    expect(s.byRound).toEqual({});
    expect(s.roundOne).toBe(0);
  });

  test("the total is the one reviews() reports", () => {
    expect(severeByRound(r).total).toBe(reviews(r).severe);
  });

  test("no findings, or only P3, style or dismissed ones, read zero everywhere", () => {
    expect(severeByRound(run())).toEqual({
      run: "1",
      byRound: {},
      noRound: 0,
      total: 0,
      roundOne: 0,
      lastWithFinding: 0,
    });
    const minor = run({
      findings: [
        finding({ severity: "P3" }),
        finding({ class: "style" }),
        finding({ dismissed: true }),
      ],
    });
    expect(severeByRound(minor).total).toBe(0);
    expect(severeByRound(minor).roundOne).toBe(0);
  });
});

describe("groupByRoundOne", () => {
  const rows = [
    { run: "a", roundOne: 1, rounds: 2 },
    { run: "b", roundOne: 3, rounds: 3 },
    { run: "c", roundOne: 4, rounds: 4 },
    { run: "d", roundOne: 7, rounds: 6 },
    { run: "e", roundOne: 8, rounds: 5 },
    { run: "f", roundOne: 21, rounds: 13 },
  ];

  test("three groups by the round-1 count, with each group's rounds and their median", () => {
    expect(groupByRoundOne(rows)).toEqual([
      { label: "3 or fewer", runs: ["a", "b"], rounds: [2, 3], median: 2.5 },
      { label: "4 to 7", runs: ["c", "d"], rounds: [4, 6], median: 5 },
      { label: "8 or more", runs: ["e", "f"], rounds: [5, 13], median: 9 },
    ]);
  });

  test("a group with no run has no median", () => {
    const groups = groupByRoundOne(rows.filter((x) => x.roundOne < 4));
    expect(groups[1]).toEqual({ label: "4 to 7", runs: [], rounds: [], median: null });
  });
});

describe("sampleSd and ticketsPerGroup", () => {
  test("the sample standard deviation divides by n minus one", () => {
    expect(sampleSd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(sampleSd([3, 3, 3])).toBe(0);
  });

  test("fewer than two values have none", () => {
    expect(sampleSd([5])).toBeNull();
    expect(sampleSd([])).toBeNull();
  });

  test("a difference of one standard deviation needs 16 a group, and the need scales with 1/delta squared", () => {
    expect(ticketsPerGroup(1, 1)).toBe(16);
    expect(ticketsPerGroup(1, 2)).toBe(4);
    expect(ticketsPerGroup(2, 1)).toBe(63);
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
