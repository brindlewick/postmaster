import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reviews } from "./analyze.ts";
import {
  candidatesIn,
  controlsReport,
  countControls,
  exitAfterHarvest,
  grepSevere,
  handReport,
  missingEvidence,
  parseSpan,
  reconcileCoachman,
  reconcileUsage,
  roundOneControls,
  sampleFindings,
  sampleReport,
  totalFromTable,
  verifiedColumn,
} from "./controls.ts";
import { parseOracle } from "./parse.ts";
import type { FindingRow, Gate, LaneTimes, RunRecord, UsageLaunch } from "./records.ts";

const lane = (name: string, over: Partial<LaneTimes> = {}): LaneTimes => ({
  lane: name,
  specRound: false,
  firstLaunch: null,
  implementFrom: null,
  finished: null,
  harvested: null,
  implementSeconds: null,
  outcome: "harvested",
  resumes: 0,
  ...over,
});

const gate = (laneName: string | null, result: string): Gate => ({
  name: "gate",
  ref: "r",
  sha: "a",
  result,
  exit: 0,
  seconds: 1,
  ts: "2026-10-03T00:00:00Z",
  lane: laneName,
});

const finding = (lanes: string[]): FindingRow => ({
  ts: "2026-10-03T00:00:00Z",
  target: "a.ts:1",
  class: "gating",
  severity: "P2",
  round: 1,
  lanes,
  lenses: [],
  pairs: null,
  dismissed: false,
  verified: "execution",
});

const usage = (over: Partial<UsageLaunch>): UsageLaunch => ({
  file: "f",
  role: "reviewer",
  lane: "opus",
  harness: "claude",
  lens: "security",
  round: 1,
  inputTokens: 10,
  outputTokens: 5,
  costUsd: null,
  readError: false,
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
  actions: 10,
  badLines: 0,
  actionsInWindow: 10,
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

describe("reconcileUsage", () => {
  const stream = (inputTokens: number, outputTokens: number) => ({
    role: "reviewer" as const,
    lane: "opus",
    harness: "claude",
    lens: "security",
    round: 1,
    inputTokens,
    outputTokens,
    costUsd: null,
  });

  test("a launch whose stream gives the same figures agrees", () => {
    const r = run({ usage: [usage({})], streams: [stream(10, 5)] });
    expect(reconcileUsage(r)).toEqual({ agree: 1, differ: [], recordOnly: 0 });
  });

  test("a launch whose stream gives other figures differs, and one with no stream is record only", () => {
    const r = run({ usage: [usage({}), usage({ round: 2 })], streams: [stream(14, 5)] });
    const out = reconcileUsage(r);
    expect(out.agree).toBe(0);
    expect(out.differ).toEqual([
      { group: "reviewer opus security 1", recorded: [10, 5], recomputed: [14, 5] },
    ]);
    expect(out.recordOnly).toBe(1);
  });

  test("a record with no figures is not compared", () => {
    expect(
      reconcileUsage(run({ usage: [usage({ inputTokens: null, outputTokens: null })] })),
    ).toEqual({
      agree: 0,
      differ: [],
      recordOnly: 0,
    });
  });
});

describe("reconcileCoachman", () => {
  const rec = (laneName: string, input: number) =>
    usage({ role: "coachman", lane: laneName, lens: null, round: null, inputTokens: input });

  test("equal where the leg ran once, larger where it was resumed, smaller never expected", () => {
    const r = run({
      usage: [rec("synthesis", 100), rec("review", 300), rec("ship", 500)],
      coachman: [
        { leg: 1, inputTokens: 100, outputTokens: 1 },
        { leg: 2, inputTokens: 450, outputTokens: 1 },
        { leg: 3, inputTokens: 400, outputTokens: 1 },
      ],
    });
    expect(reconcileCoachman(r)).toEqual({ equal: 1, larger: 1, smaller: 1 });
  });

  test("a leg with no session record is not compared", () => {
    expect(reconcileCoachman(run({ usage: [rec("review", 300)] }))).toEqual({
      equal: 0,
      larger: 0,
      smaller: 0,
    });
  });
});

describe("missingEvidence", () => {
  const incident = (ts: string) => ({
    id: "I1",
    kind: "wall",
    when: "",
    what: "",
    runs: ["200"],
    lanes: [],
    evidence: [{ run: "200", ts, action: "harvest" }],
  });
  const r = run({
    id: "200",
    incidents: [
      {
        ts: "2026-10-03T01:02:11Z",
        actor: "coachman",
        action: "harvest",
        kinds: ["wall"],
        text: "",
      },
    ],
  });

  test("a citation of an action that exists is found, a made-up one is missing", () => {
    expect(missingEvidence([incident("2026-10-03T01:02:11Z")], [r])).toEqual([]);
    expect(missingEvidence([incident("2000-01-01T00:00:00Z")], [r])).toEqual([
      "200 2000-01-01T00:00:00Z harvest",
    ]);
  });
});

describe("small checks", () => {
  test("a lane that exited after its harvest line is named", () => {
    const r = run({
      lanes: [
        lane("a", { finished: "2026-10-03T01:00:00Z", harvested: "2026-10-03T02:00:00Z" }),
        lane("b", { finished: "2026-10-03T03:00:00Z", harvested: "2026-10-03T02:00:00Z" }),
        lane("c", { finished: null, harvested: "2026-10-03T02:00:00Z" }),
      ],
    });
    expect(exitAfterHarvest(r)).toEqual(["b"]);
  });

  test("incident candidates are counted inside the window only", () => {
    const r = run({
      incidents: [
        { ts: "2026-10-03T01:00:00Z", actor: "a", action: "note", kinds: ["wall"], text: "" },
        { ts: "2026-09-01T01:00:00Z", actor: "a", action: "note", kinds: ["wall"], text: "" },
      ],
    });
    expect(candidatesIn(r, "2026-10-01T00:00:00Z", "2026-10-04T00:00:00Z")).toBe(1);
  });

  test("a span in hours, minutes and seconds", () => {
    expect(parseSpan("11h 33m")).toBe(41580);
    expect(parseSpan("38m")).toBe(2280);
    expect(parseSpan("45s")).toBe(45);
    expect(parseSpan("-")).toBeNull();
  });

  test("the total row of the table run-times.ts prints", () => {
    const table =
      "stage   started   took   waiting\ndone  2026  -  -\ntotal                                            3h 13m     33m 44s\n";
    expect(totalFromTable(table)).toBe(11580);
    expect(totalFromTable("no total here")).toBeNull();
  });

  test("the report marks a failed control and lists the notes", () => {
    const out = controlsReport(
      [
        { name: "a", positive: "p", negative: "n", ok: true },
        { name: "b", positive: "p", negative: "n", ok: false, detail: "why" },
      ],
      "",
    );
    expect(out).toContain("| ok | a | p | n |");
    expect(out).toContain("| FAIL | b | p | n |");
    expect(out).toContain("- b: why");
  });
});

describe("countControls", () => {
  const window = { since: "2026-09-30T15:40:00Z", until: "2026-10-03T15:40:00Z" };
  const candidate = (kind: "wall" | "kill" | "duplicate-launch") => ({
    ts: "2026-10-03T08:43:51Z",
    actor: "coachman",
    action: "note",
    kinds: [kind],
    text: "",
  });
  const launches = Array.from({ length: 12 }, (_, i) => ({
    ts: "2026-10-03T02:00:00Z",
    lane: "mimo",
    lens: "bug",
    round: (i % 4) + 1,
  }));
  const done = [1, 2, 3, 4].map((round) => ({
    round,
    lens: "bug",
    lane: "mimo",
    done: "2026-10-03T02:30:00Z",
  }));
  const runs = (): RunRecord[] => [
    run({
      id: "200",
      synthesis: {
        ranked: ["mimo", "astra"],
        took: {},
        rejected: {},
        basis: "",
        oracle: parseOracle("mimo:pass"),
        oracleRaw: "mimo:pass",
      },
      shares: { code: { runs: 100, lanes: { astra: 0, mimo: 64 }, shared: 0, neither: 36 } },
      lanes: [lane("astra"), lane("mimo")],
      gates: [gate("mimo", "pass")],
      findings: [finding(["astra", "opus"]), finding(["opus"])],
      reviewLaunches: launches,
      reviewDone: done,
      usage: [
        usage({}),
        usage({ role: "coachman", lane: "review", lens: null, round: null, inputTokens: 300 }),
      ],
      streams: [
        {
          role: "reviewer",
          lane: "opus",
          harness: "claude",
          lens: "security",
          round: 1,
          inputTokens: 10,
          outputTokens: 5,
          costUsd: null,
        },
      ],
      coachman: [{ leg: 2, inputTokens: 400, outputTokens: 1 }],
      stages: [
        { stage: "dispatched", at: "2026-10-03T00:00:00Z", seconds: 60 },
        { stage: "done", at: "2026-10-03T00:01:00Z", seconds: null },
      ],
      incidents: [candidate("wall")],
    }),
    run({
      id: "218",
      incidents: [candidate("wall"), candidate("duplicate-launch"), candidate("kill")],
    }),
    run({ id: "fixture-39", kind: "fixture" }),
    run({ id: "fixture-26", kind: "fixture" }),
    run({ id: "fixture-22", kind: "fixture" }),
  ];
  const curated = [
    {
      id: "I1",
      kind: "wall",
      when: "",
      what: "",
      runs: ["200"],
      lanes: [],
      evidence: [{ run: "200", ts: "2026-10-03T08:43:51Z", action: "note" }],
    },
  ];

  test("every control behaves on records that hold what it needs", () => {
    const checks = countControls(runs(), ["92"], curated, window, { "200": 60 });
    const failed = checks.filter((c) => !c.ok).map((c) => c.name);
    expect(failed).toEqual([]);
    expect(checks.length).toBe(15);
  });

  test("a control fails when its positive case reads zero", () => {
    const broken = runs().map((r) => (r.id === "218" ? { ...r, incidents: [] } : r));
    const failed = countControls(broken, ["92"], curated, window, { "200": 60 }).filter(
      (c) => !c.ok,
    );
    expect(failed.map((c) => c.name)).toEqual([
      "incident candidates are found where an incident happened and not in a clean run",
    ]);
  });

  test("a control fails when a run that should be outside the window is in", () => {
    const failed = countControls(runs(), [], curated, window, { "200": 60 }).filter((c) => !c.ok);
    expect(failed.map((c) => c.name)).toContain(
      "a run counts as in the window by its action times",
    );
  });

  test("a cited incident that no action matches fails its control", () => {
    const bad = [
      { ...curated[0]!, evidence: [{ run: "200", ts: "2000-01-01T00:00:00Z", action: "note" }] },
    ];
    const failed = countControls(runs(), ["92"], bad, window, { "200": 60 }).filter((c) => !c.ok);
    expect(failed.map((c) => c.name)).toEqual([
      "every curated incident cites an action that exists",
    ]);
  });
});

describe("sampleFindings", () => {
  const lines = [
    { run: "1", detail: "gating P2 r1 bug-astra:summary:verified by execution" },
    { run: "1", detail: "gating P3 r1 bug-astra:minor:verified by execution" },
    { run: "2", detail: "style P2 r1 style-mimo:wording:verified by reading" },
    { run: "3", detail: "gating P1 r1 bug luna mimo, verified by execution" },
    { run: "4", detail: "gating P2 r1 bug+style lenses, verified by execution" },
  ];

  test("only severe gating lines are drawn, the same lines each time, with the lanes parsed", () => {
    const a = sampleFindings(lines, 10, 7);
    expect(a.map((s) => s.run)).toEqual(["1", "3", "4"]);
    expect(a.map((s) => s.lanes)).toEqual([["astra"], ["luna", "mimo"], []]);
    expect(sampleFindings(lines, 10, 7)).toEqual(a);
  });

  test("a sample is no larger than asked for, and a smaller pool is taken whole", () => {
    expect(sampleFindings(lines, 2, 7).length).toBe(2);
    expect(sampleFindings([], 5, 7)).toEqual([]);
  });

  test("the report says none for a line that names no lane", () => {
    const out = sampleReport(sampleFindings(lines, 10, 7), 3);
    expect(out).toContain("| 4 | none |");
    expect(out).toContain("3 of the 3 severe finding lines");
  });
});

describe("verifiedColumn", () => {
  test("reads the Verified P1/P2 column of the first table by run, links and suffixes resolved", () => {
    const md = [
      "# Reviews",
      "",
      "| Run | Rounds | Verified P1/P2 | Names no lane |",
      "| --- | --- | --- | --- |",
      "| [#57](https://example.test/issues/57) | 6 | 24 | 0 |",
      "| [#200](https://example.test/issues/200)-parked-20261002 | 2 | 3 | 0 |",
      "| fixture-15 | 2 | 1 | 0 |",
      "",
      "| Run | Rounds | Verified P1/P2 |",
      "| --- | --- | --- |",
      "| 999 | 1 | 99 |",
    ].join("\n");
    expect([...verifiedColumn(md)]).toEqual([
      ["57", 24],
      ["200-parked-20261002", 3],
      ["fixture-15", 1],
    ]);
  });

  test("a table without the column, or no table, reads nothing", () => {
    expect(verifiedColumn("| a | b |\n| --- | --- |\n| 1 | 2 |").size).toBe(0);
    expect(verifiedColumn("no table here").size).toBe(0);
  });
});

describe("grepSevere", () => {
  const scratch = mkdtempSync(join(tmpdir(), "lane-audit-controls-"));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));
  const line = (action: string, detail: string): string =>
    `${JSON.stringify({ ts: "2026-10-03T00:00:00Z", action, target: "a.ts:1", detail })}\n`;
  const log = join(scratch, "actions.jsonl");
  writeFileSync(
    log,
    [
      line("finding", "gating P2 r1 bug luna, verified by execution: first"),
      line("finding", "gating P1 r1 style mimo, verified by reading: second"),
      line("finding", "gating P3 r1 bug mimo, verified by reading: minor"),
      line("finding", "style P3 r1 style mimo, verified by reading: style class"),
      line("finding", "gating P2 r1 bug luna DISMISSED: not a defect"),
      line("finding", "gating P2 r2 bug luna, verified by execution: later round"),
      line("note", "gating P2 r1 bug luna is only mentioned in a note"),
    ].join(""),
  );

  test("counts the gating P1 and P2 lines of a round that are not dismissed, from the log's own text", () => {
    const g = grepSevere(log, 1);
    expect(g.count).toBe(2);
    expect(g.lines[0]).toContain("first");
    expect(g.lines[1]).toContain("second");
  });

  test("a round with none, and a log that is not there, read zero", () => {
    expect(grepSevere(log, 3).count).toBe(0);
    expect(grepSevere(join(scratch, "missing.jsonl"), 1).count).toBe(0);
    expect(grepSevere(log, 2).count).toBe(1);
  });
});

describe("roundOneControls", () => {
  const sev = (round: number | null, n: number): FindingRow[] =>
    Array.from({ length: n }, () => ({ ...finding([]), round }));
  const launches = (rounds: number[]) =>
    rounds.map((round) => ({ ts: "t", lane: "luna", lens: "bug", round }));
  const harvests = (rounds: number[]) =>
    rounds.map((round) => ({
      ts: "t",
      lane: "luna",
      lens: "bug",
      round,
      verdict: "reviewed" as const,
      raw: null,
    }));
  const reviewed = (id: string, over: Partial<RunRecord>): RunRecord =>
    run({
      id,
      synthesis: {
        ranked: ["luna", "mimo"],
        took: {},
        rejected: {},
        basis: "",
        oracle: null,
        oracleRaw: "none",
      },
      ...over,
    });
  const runs = (): RunRecord[] => [
    reviewed("98", {
      findings: [...sev(1, 3), { ...finding([]), severity: "P3", round: 2 }],
      reviewLaunches: launches([1, 2]),
    }),
    reviewed("109", {
      findings: [...sev(1, 21), ...sev(null, 2)],
      reviewLaunches: [...launches([1, 13]), { ts: "t", lane: "luna", lens: null, round: null }],
    }),
    reviewed("110", {
      findings: sev(1, 4),
      reviewLaunches: launches([1, 2, 3, 4]),
      reviewHarvests: harvests([4, 5]),
    }),
    reviewed("160", { findings: sev(1, 1), reviewLaunches: launches([1, 2]) }),
    reviewed("182", { findings: sev(1, 1), reviewLaunches: launches([1, 2]) }),
    reviewed("200", {
      findings: sev(1, 4),
      reviewLaunches: launches([1, 2, 3, 4]),
      reviewHarvests: harvests([1, 2, 3, 4]),
    }),
    run({
      id: "fixture-30",
      kind: "fixture",
      synthesis: {
        ranked: ["luna", "mimo"],
        took: {},
        rejected: {},
        basis: "",
        oracle: null,
        oracleRaw: "none",
      },
      reviewLaunches: launches([1]),
    }),
  ];
  const table = (rs: RunRecord[]) => new Map(rs.map((r) => [r.id, reviews(r).severe] as const));
  const hand = [
    { run: "98", round: 1, grepped: 3, lines: [] },
    { run: "98", round: 2, grepped: 0, lines: [] },
    { run: "160", round: 1, grepped: 1, lines: [] },
    { run: "160", round: 2, grepped: 0, lines: [] },
    { run: "182", round: 1, grepped: 1, lines: [] },
    { run: "182", round: 2, grepped: 0, lines: [] },
  ];

  test("every control behaves on records that hold what it needs", () => {
    const rs = runs();
    const checks = roundOneControls(rs, table(rs), hand);
    expect(checks.filter((c) => !c.ok).map((c) => c.name)).toEqual([]);
    expect(checks.length).toBe(5);
  });

  test("without the run folders the grep control is left out", () => {
    const rs = runs();
    expect(roundOneControls(rs, table(rs), null).length).toBe(4);
  });

  test("a control fails when round 1 reads zero where it must read non-zero", () => {
    const broken = runs().map((r) => (r.id === "98" ? { ...r, findings: [] } : r));
    const failed = roundOneControls(broken, table(broken), null).filter((c) => !c.ok);
    expect(failed.map((c) => c.name)).toContain(
      "round 1 counts the severe findings whose lines name round 1 and no others",
    );
  });

  test("a control fails when the review table's total differs from the by-round counts", () => {
    const rs = runs();
    const wrong = table(rs);
    wrong.set("200", 5);
    const failed = roundOneControls(rs, wrong, null).filter((c) => !c.ok);
    expect(failed.map((c) => c.name)).toEqual([
      "a run's severe findings by round add up to its total, and the total is the review table's",
    ]);
  });

  test("a control fails when grep and the parser disagree", () => {
    const rs = runs();
    const bad = hand.map((h) => (h.run === "98" && h.round === 1 ? { ...h, grepped: 2 } : h));
    const failed = roundOneControls(rs, table(rs), bad).filter((c) => !c.ok);
    expect(failed.map((c) => c.name)).toEqual([
      "round 1 read again from a run's own log with grep gives the parser's count",
    ]);
  });

  test("a control fails when a round after the cap, named only by a harvest, is not counted", () => {
    const broken = runs().map((r) => (r.id === "110" ? { ...r, reviewHarvests: [] } : r));
    const failed = roundOneControls(broken, table(broken), null).filter((c) => !c.ok);
    expect(failed.map((c) => c.name)).toEqual([
      "a run's rounds are the highest round any launch, harvest or finding line names",
    ]);
  });

  test("two launch lines that name no round fail the control for them", () => {
    const broken = runs().map((r) =>
      r.id === "98"
        ? {
            ...r,
            reviewLaunches: [
              ...r.reviewLaunches,
              ...launches([1]).map((l) => ({ ...l, round: null })),
            ],
          }
        : r,
    );
    const failed = roundOneControls(broken, table(broken), null).filter((c) => !c.ok);
    expect(failed.map((c) => c.name)).toEqual([
      "review launch lines name a round, except one that has no text",
    ]);
  });

  test("the hand-read table has a row per run and round, with the lines scrubbed and the pipe escaped", () => {
    const rs = runs();
    const out = handReport(
      [{ run: "98", round: 1, grepped: 3, lines: ["gating P2 r1 a | b"] }],
      rs,
    );
    expect(out).toContain("| 98 | 1 | 3 | 3 | gating P2 r1 a / b |");
  });
});
