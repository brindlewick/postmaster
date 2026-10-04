import { describe, expect, test } from "bun:test";
import type { FixtureScore } from "./hidden.ts";
import { parseOracle } from "./parse.ts";
import type { FindingRow, Gate, LaneTimes, RunRecord, StreamUsage } from "./records.ts";
import {
  coverageTable,
  type Data,
  fixtureSummary,
  fixtureWorkhorses,
  hm,
  incidentTable,
  inventory,
  md,
  minutes,
  perRunTokens,
  rankedFirst,
  realWorkhorses,
  recallTable,
  reviewTable,
  runLabel,
  timeTable,
  tokensTable,
  when,
} from "./tables.ts";

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

const gate = (ref: string, laneName: string | null, result: string): Gate => ({
  name: "gate",
  ref,
  sha: "abc",
  result,
  exit: 0,
  seconds: 10,
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

const stream = (
  role: "workhorse" | "reviewer",
  laneName: string,
  input: number,
  output: number,
  usd: number | null = null,
): StreamUsage => ({
  role,
  lane: laneName,
  harness: "h",
  lens: null,
  round: null,
  inputTokens: input,
  outputTokens: output,
  costUsd: usd,
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

describe("small formats", () => {
  test("a table has a header, a rule and a row each", () => {
    expect(md(["a", "b"], [["1", "2"]])).toBe("| a | b |\n| --- | --- |\n| 1 | 2 |");
  });

  test("minutes, hours and the time of day", () => {
    expect(minutes(362)).toBe("6");
    expect(minutes(null)).toBe("–");
    expect(hm(2280)).toBe("38m");
    expect(hm(41580)).toBe("11h 33m");
    expect(hm(null)).toBe("–");
    expect(when("2026-10-03T00:31:02Z")).toBe("10-03 00:31");
    expect(when("")).toBe("–");
  });

  test("a real run links its ticket, a parked one keeps its suffix, a fixture is plain", () => {
    expect(runLabel(run({ id: "200" }))).toBe(
      "[#200](https://github.com/brindlewick/postmaster/issues/200)",
    );
    expect(runLabel(run({ id: "200-parked-20261002" }))).toBe(
      "[#200](https://github.com/brindlewick/postmaster/issues/200)-parked-20261002",
    );
    expect(runLabel(run({ id: "fixture-39", kind: "fixture" }))).toBe("fixture-39");
  });
});

const data = (runs: RunRecord[], over: Partial<Data> = {}): Data => ({
  runs,
  since: "2026-09-30T15:40:00Z",
  titles: { "200": "Run every lane in its own process space", fixture: "Remove tasks by id" },
  judgements: {
    runs: [{ run: "200", part: "C", firstLaneDefect: false, evidence: "", note: "" }],
    earlierAudit: { "109": "A" },
  },
  incidents: [],
  hidden: [],
  ...over,
});

const real200 = run({
  id: "200",
  ticket: "200",
  synthesis: synthesis(["mimo", "astra"], "mimo:pass,astra:fail"),
  synthesisAt: "2026-10-03T02:05:08Z",
  lanes: [lane("astra", 2914, "stalled"), lane("mimo", 5679)],
  gates: [gate("wb/200-mimo", "mimo", "pass")],
  shares: { code: { runs: 100, lanes: { astra: 0, mimo: 64 }, shared: 0, neither: 36 } },
  team: {
    workhorses: ["astra", "mimo"],
    reviewers: [],
    lensReviewers: {},
    coachman: null,
    lanes: {},
    contract: 2,
  },
});

describe("tables over runs", () => {
  test("the inventory has a row per run and says which were set aside or unfinished", () => {
    const parked = run({ id: "200-parked-20261002", parked: true, stage: "done" });
    const going = run({ id: "218", stage: "workhorses-running" });
    const out = inventory(data([real200, parked, going]));
    expect(out.split("\n").length).toBe(5);
    expect(out).toContain("set aside");
    expect(out).toContain("not finished");
    expect(out).toContain("Run every lane in its own process space");
  });

  test("coverage counts real and fixture runs apart", () => {
    const out = coverageTable(
      data([
        real200,
        run({ id: "fixture-1", kind: "fixture", synthesis: synthesis(["a", "b"], "none") }),
      ]),
    );
    expect(out).toContain("this repository's tickets | 1 |");
    expect(out).toContain("fixture runs | 1 |");
  });

  test("the real-run table gives the second lane's part, the shares and the single-lane verdict", () => {
    const out = realWorkhorses(data([real200]));
    expect(out).toContain("mimo, astra");
    expect(out).toContain("mimo:pass,astra:fail");
    expect(out).toContain("64 / 0 / 0 / 36");
    expect(out).toContain("| C |");
    expect(out).toContain("| yes |");
  });

  test("a run the earlier audit judged says so, and a run with no synthesis has no row", () => {
    const legacy = run({
      id: "109",
      layout: "legacy",
      synthesis: synthesis(["luna", "mimo"], "none"),
      lanes: [lane("luna", 100), lane("mimo", 200)],
    });
    const out = realWorkhorses(data([legacy, run({ id: "5" })]));
    expect(out).toContain("A (earlier audit)");
    expect(out.split("\n").length).toBe(3);
  });
});

const hiddenOf = (
  run_: string,
  a: FixtureScore["merged"],
  b: FixtureScore["merged"],
  merged: FixtureScore["merged"],
): FixtureScore => ({
  run: run_,
  lanes: { mimo: a, sol: b },
  merged,
});
const pass = { kind: "counts", passed: 20, failed: 0 } as const;

describe("fixture tables", () => {
  const hidden = [
    hiddenOf("fixture-1", pass, pass, pass),
    hiddenOf("fixture-2", pass, { kind: "counts", passed: 19, failed: 1 }, pass),
    hiddenOf("fixture-3", { kind: "at-base" }, { kind: "at-base" }, pass),
    hiddenOf("fixture-4", pass, pass, { kind: "at-base" }),
  ];

  test("the summary counts only runs whose every lane could be scored", () => {
    expect(fixtureSummary(hidden)).toEqual({
      scorable: 3,
      bothPass: 2,
      laneRuns: 6,
      laneRunsPass: 5,
      merged: 3,
      mergedPass: 3,
    });
  });

  test("the table shows each lane's counts, at base and the merged result", () => {
    const runs = [1, 3].map((n) =>
      run({
        id: `fixture-${n}`,
        kind: "fixture",
        synthesis: synthesis(["mimo", "sol"], "none"),
        lanes: [lane("mimo", 600), lane("sol", 200)],
      }),
    );
    const out = fixtureWorkhorses(data(runs, { hidden }));
    expect(out).toContain("| fixture-1 | mimo, sol | 20/20 | 20/20 | 20/20 |");
    expect(out).toContain("| fixture-3 | mimo, sol | at base | at base | 20/20 |");
    expect(out).toContain("7 (mimo)");
  });
});

describe("review and token tables", () => {
  const reviewed = run({
    id: "200",
    reviewLaunches: [
      { ts: "t", lane: "astra", lens: "bug", round: 2 },
      { ts: "t", lane: "opus", lens: "security", round: 2 },
    ],
    findings: [
      finding({ lanes: ["astra"] }),
      finding({ lanes: ["opus"] }),
      finding({ lanes: ["astra", "opus"] }),
    ],
    streams: [
      stream("workhorse", "mimo", 2_000_000, 30_000, 0),
      stream("reviewer", "opus", 5, 90_000, 16.09),
    ],
    coachman: [{ leg: 1, inputTokens: 30_000_000, outputTokens: 100_000 }],
  });

  test("the review table counts who found what alone", () => {
    const out = reviewTable([reviewed]);
    expect(out).toContain("| 2 | 2 | 0 | 3 | 1 | 0 | 1 | 0 | 1 | 0 |");
  });

  test("a smaller reviewer set reads as found of all", () => {
    const out = recallTable([{ label: "runs", runs: [reviewed] }]);
    expect(out).toContain("| opus only | 2 of 3, 67% |");
    expect(out).toContain("| all three, as run | 3 of 3, 100% |");
    expect(recallTable([{ label: "none", runs: [run()] }])).toContain("| – |");
  });

  test("tokens by role show money only where reported", () => {
    const out = tokensTable([{ label: "runs", runs: [reviewed] }]);
    expect(out).toContain("reviewer opus | 1 launches, 0.0M in, 90k out, $16.09 reported");
    expect(out).toContain("coachman | 1 launches, 30M in, 100k out");
    expect(out).toContain("workhorse mimo | 1 launches, 2.0M in, 30k out, $0.00 reported");
  });

  test("the per-run medians skip runs with nothing in that role", () => {
    const out = perRunTokens([{ label: "runs", runs: [reviewed, run()] }]);
    expect(out).toContain("workhorse | 2.0M in, 30k out");
    expect(out).toContain("(2 runs)");
  });
});

describe("time and incident tables", () => {
  test("time shows stage medians, the extra wait and the review rounds", () => {
    const r = run({
      synthesis: synthesis(["sol", "mimo"], "none"),
      lanes: [lane("sol", 600), lane("mimo", 1200)],
      stages: [
        { stage: "workhorses-running", at: "t", seconds: 5400 },
        { stage: "review", at: "t", seconds: 31_620 },
        { stage: "done", at: "t", seconds: null },
      ],
      reviewLaunches: [
        { ts: "2026-10-03T00:00:00Z", lane: "sol", lens: "bug", round: 1 },
        { ts: "2026-10-03T00:00:00Z", lane: "mimo", lens: "bug", round: 1 },
      ],
      reviewDone: [
        { round: 1, lens: "bug", lane: "sol", done: "2026-10-03T00:05:00Z" },
        { round: 1, lens: "bug", lane: "mimo", done: "2026-10-03T00:20:00Z" },
      ],
    });
    const out = timeTable([{ label: "runs", runs: [r] }]);
    expect(out).toContain("| workhorses running | 1h 30m |");
    expect(out).toContain("| review | 8h 47m |");
    expect(out).toContain(
      "| slower workhorse's extra wait, median (90th percentile) | 10 min (10) |",
    );
    expect(out).toContain(
      "| one review round, launch to last reviewer, median (90th percentile) | 20 min (20) |",
    );
    expect(out).toContain(
      "| gap between the first and last reviewer of a round, median (90th percentile) | 15 min (15) |",
    );
    expect(out).toContain("| review rounds per run, median (most) | 1 (1) |");
  });

  test("an empty set reads as dashes", () => {
    expect(timeTable([{ label: "none", runs: [] }])).toContain("| – |");
  });

  test("incidents link real runs and leave fixtures plain", () => {
    const out = incidentTable([
      {
        id: "I1",
        kind: "wall",
        when: "t",
        what: "w",
        runs: ["200", "fixture-37"],
        lanes: [],
        evidence: [],
      },
    ]);
    expect(out).toContain(
      "[#200](https://github.com/brindlewick/postmaster/issues/200), fixture-37",
    );
  });
});

describe("rankedFirst", () => {
  const ranked = (...lanes: string[]) => run({ synthesis: synthesis(lanes, "none") });

  test("counts the lane each run ranked first, most first, ties by name", () => {
    expect(
      rankedFirst([
        ranked("mimo", "luna"),
        ranked("luna", "mimo"),
        ranked("mimo", "sol"),
        ranked("sol", "mimo"),
      ]),
    ).toBe("mimo 2, luna 1, sol 1");
  });

  test("a run with no synthesis is not counted, and no runs give nothing", () => {
    expect(rankedFirst([run(), ranked("mimo", "luna")])).toBe("mimo 1");
    expect(rankedFirst([])).toBe("");
  });
});
