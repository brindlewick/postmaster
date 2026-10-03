// The lane audit's tables as markdown, from the derived data alone (see ../method.md): a reader
// with this folder can draw them again without any run's records. Pure functions; `render.ts`
// reads the files and writes these.
import {
  chapman,
  coverage,
  family,
  isSevere,
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
  tokensByRole,
  type Workhorses,
  workhorses,
} from "./analyze.ts";
import type { FixtureScore, LaneScore } from "./hidden.ts";
import type { RunRecord } from "./records.ts";

export const REPO = "https://github.com/brindlewick/postmaster";

export type Judgement = {
  run: string;
  part: "A" | "B" | "C";
  firstLaneDefect: boolean;
  evidence: string;
  note: string;
  /** a second reader's class for the same card, written without sight of the first reader's */
  secondReader?: { part: "A" | "B" | "C"; firstLaneDefect: boolean; evidence: string };
};

export type Judgements = { runs: Judgement[]; earlierAudit: Record<string, "A" | "B" | "C"> };

export type Incident = {
  id: string;
  kind: string;
  when: string;
  what: string;
  runs: string[];
  lanes: string[];
  evidence: Array<{ run: string; ts: string; action: string }>;
};

/** A markdown table; cells are written as given. */
export function md(headers: readonly string[], rows: ReadonlyArray<readonly string[]>): string {
  const line = (cells: readonly string[]): string => `| ${cells.join(" | ")} |`;
  return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
}

const ticketLink = (id: string): string => {
  const n = /^([0-9]+)/u.exec(id)?.[1];
  const suffix = id.slice((n ?? "").length);
  return n ? `[#${n}](${REPO}/issues/${n})${suffix}` : id;
};

export const runLabel = (r: RunRecord): string => (r.kind === "fixture" ? r.id : ticketLink(r.id));

/** `10-01 09:20`, UTC, from an ISO time. */
export const when = (iso: string): string =>
  iso.length >= 16 ? `${iso.slice(5, 10)} ${iso.slice(11, 16)}` : "–";

export const minutes = (seconds: number | null): string =>
  seconds === null ? "–" : `${Math.round(seconds / 60)}`;

/** `1h 52m`, or `38m`, or `–`. */
export const hm = (seconds: number | null): string => {
  if (seconds === null) return "–";
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
};

const mega = (n: number): string =>
  n / 1e6 >= 10 ? `${Math.round(n / 1e6)}M` : `${(n / 1e6).toFixed(1)}M`;
const kilo = (n: number): string => `${Math.round(n / 1e3)}k`;
const pct = (n: number, d: number): string => (d === 0 ? "–" : `${Math.round((100 * n) / d)}%`);

export type Data = {
  runs: RunRecord[];
  since: string;
  titles: Record<string, string>;
  judgements: Judgements;
  incidents: Incident[];
  hidden: FixtureScore[];
};

/** Every run found in the window, one row each. */
export function inventory(d: Data): string {
  const rows = d.runs.map((r) => [
    runLabel(r),
    r.kind === "fixture" ? `fixture, ${d.titles.fixture ?? ""}` : (d.titles[r.ticket] ?? ""),
    r.team ? r.team.workhorses.join(", ") : "–",
    `${when(r.first)} to ${when(r.last)}`,
    r.stage ?? "–",
    r.synthesis ? `${r.synthesis.ranked[0]} first` : "no",
    [
      r.parked ? "set aside" : "",
      r.layout === "legacy" ? "synthesis audited earlier" : "",
      r.stage !== "done" && r.stage !== "abandoned" ? "not finished" : "",
    ]
      .filter(Boolean)
      .join("; ") || "–",
  ]);
  return md(
    [
      "Run",
      "Ticket",
      "Workhorses",
      "First to last action (UTC)",
      "Stage at the end",
      "Synthesis",
      "Notes",
    ],
    rows,
  );
}

/** Counts of what the window holds, real runs and fixture runs apart. */
export function coverageTable(d: Data): string {
  const rows = (["real", "fixture"] as const).map((kind) => {
    const c = coverage(
      d.runs.filter((r) => r.kind === kind),
      d.since,
    );
    return [
      kind === "real" ? "this repository's tickets" : "fixture runs",
      String(c.inWindow),
      String(c.parked),
      String(c.reachedSynthesis),
      String(c.synthesisInWindow),
      String(c.finished),
      String(c.inProgress),
    ];
  });
  return md(
    [
      "Runs",
      "With activity in the window",
      "Set aside",
      "Reached synthesis",
      "of them, synthesis in the window",
      "Finished",
      "Not finished",
    ],
    rows,
  );
}

const laneList = (xs: string[]): string => xs.join(", ");

const blind = (w: Workhorses, raw: string): string => {
  if (w.blind === null) return "none";
  return raw;
};

const gates = (w: Workhorses): string =>
  Object.entries(w.gate)
    .map(([lane, g]) => `${lane} ${g}`)
    .join(", ");

const shares = (w: Workhorses): string =>
  w.code
    ? `${w.code.firstOnly} / ${w.code.secondOnly} / ${w.code.shared} / ${w.code.neither}`
    : "–";

/** Real runs that reached synthesis: what each lane did and what the second lane's part was. */
export function realWorkhorses(d: Data): string {
  const part = new Map(d.judgements.runs.map((j) => [j.run, j.part]));
  const rows = d.runs
    .filter((r) => r.kind === "real" && !r.parked && r.synthesis)
    .map((r) => {
      const w = workhorses(r) as Workhorses;
      const judged =
        part.get(r.id) ??
        (d.judgements.earlierAudit[r.id]
          ? `${d.judgements.earlierAudit[r.id]} (earlier audit)`
          : "–");
      return [
        runLabel(r),
        laneList(w.ranked),
        blind(w, r.synthesis?.oracleRaw ?? ""),
        gates(w),
        shares(w),
        judged,
        w.extraWaitSeconds === null ? "–" : `${minutes(w.extraWaitSeconds)} (${w.slowerLane})`,
        singleLaneSufficed(w),
      ];
    });
  return md(
    [
      "Run",
      "Ranked",
      "Blind tests",
      "Gate on each lane's branch",
      "Code share: first only / second only / shared / neither, %",
      "Second lane's part",
      "Slower lane's extra wait, min",
      "One lane alone sufficed",
    ],
    rows,
  );
}

/** The real-run table with the columns the report quotes: the second lane's part and what it cost. */
export function realWorkhorsesCompact(d: Data): string {
  const part = new Map(d.judgements.runs.map((j) => [j.run, j.part]));
  const rows = d.runs
    .filter((r) => r.kind === "real" && !r.parked && r.synthesis)
    .map((r) => {
      const w = workhorses(r) as Workhorses;
      const judged =
        part.get(r.id) ??
        (d.judgements.earlierAudit[r.id]
          ? `${d.judgements.earlierAudit[r.id]}, earlier audit`
          : "–");
      return [
        runLabel(r),
        d.titles[r.ticket] ?? "",
        laneList(w.ranked),
        w.blind === null ? "none" : (r.synthesis?.oracleRaw.split(" (")[0] ?? ""),
        judged,
        w.code ? `${w.code.secondOnly}%` : "–",
        w.extraWaitSeconds === null ? "–" : `${minutes(w.extraWaitSeconds)} (${w.slowerLane})`,
      ];
    });
  return md(
    [
      "Run",
      "Ticket",
      "Ranked",
      "Blind tests",
      "Second lane's part",
      "Its own share of the code",
      "Slower lane's extra wait, min",
    ],
    rows,
  );
}

const score = (s: LaneScore | undefined): string =>
  !s
    ? "–"
    : s.kind === "counts"
      ? `${s.passed}/${s.passed + s.failed}`
      : s.kind === "at-base"
        ? "at base"
        : s.kind;

/** Fixture runs: each lane's branch and the merged result on the hidden tests. */
export function fixtureWorkhorses(d: Data): string {
  const byRun = new Map(d.hidden.map((h) => [h.run, h]));
  const rows = d.runs
    .filter((r) => r.kind === "fixture" && r.synthesis)
    .map((r) => {
      const w = workhorses(r) as Workhorses;
      const h = byRun.get(r.id);
      const [first, second] = w.ranked;
      return [
        r.id,
        laneList(w.ranked),
        score(h?.lanes[first ?? ""]),
        score(h?.lanes[second ?? ""]),
        score(h?.merged),
        shares(w),
        w.extraWaitSeconds === null ? "–" : `${minutes(w.extraWaitSeconds)} (${w.slowerLane})`,
      ];
    });
  return md(
    [
      "Run",
      "Ranked",
      "Hidden tests, first lane's branch",
      "Hidden tests, second lane's branch",
      "Hidden tests, merged result",
      "Code share: first only / second only / shared / neither, %",
      "Slower lane's extra wait, min",
    ],
    rows,
  );
}

/** What the lanes and the synthesis scored on the fixture's hidden tests, in words and counts. */
export function fixtureSummary(hidden: readonly FixtureScore[]): {
  scorable: number;
  bothPass: number;
  laneRuns: number;
  laneRunsPass: number;
  mergedPass: number;
  merged: number;
} {
  const scorable = hidden.filter(
    (h) =>
      Object.values(h.lanes).length > 0 && Object.values(h.lanes).every((s) => s.kind === "counts"),
  );
  const pass = (s: LaneScore): boolean => s.kind === "counts" && s.passed > 0 && s.failed === 0;
  const laneScores = scorable.flatMap((h) => Object.values(h.lanes));
  const merged = hidden.filter((h) => h.merged.kind === "counts");
  return {
    scorable: scorable.length,
    bothPass: scorable.filter((h) => Object.values(h.lanes).every(pass)).length,
    laneRuns: laneScores.length,
    laneRunsPass: laneScores.filter(pass).length,
    merged: merged.length,
    mergedPass: merged.filter((h) => pass(h.merged)).length,
  };
}

/** Review results per run: the severe findings and who named them. */
export function reviewTable(runs: readonly RunRecord[]): string {
  const rows = runs
    .filter((r) => r.reviewLaunches.length > 0 || r.findings.length > 0)
    .map((r) => {
      const v = reviews(r);
      const alone: Record<string, number> = {};
      for (const [lane, c] of Object.entries(v.byLane)) {
        alone[family(lane)] = (alone[family(lane)] ?? 0) + c.alone;
      }
      const cell = (k: string): string => String(alone[k] ?? 0);
      return [
        runLabel(r),
        String(v.rounds),
        String(v.launches),
        String(v.degraded),
        String(v.severe),
        cell("codex"),
        cell("mimo"),
        cell("opus"),
        cell("coachman"),
        String(v.shared),
        String(v.unattributed),
      ];
    });
  return md(
    [
      "Run",
      "Rounds",
      "Reviewer launches",
      "Degraded",
      "Verified P1/P2",
      "Only a codex lane",
      "Only mimo",
      "Only opus",
      "Only the coachman",
      "Two or more lanes",
      "Names no lane",
    ],
    rows,
  );
}

const DESIGNS: Array<{ name: string; lanes: string[] }> = [
  { name: "one codex lane", lanes: ["luna", "sol", "astra"] },
  { name: "mimo only", lanes: ["mimo"] },
  { name: "opus only", lanes: ["opus"] },
  { name: "codex lane and mimo", lanes: ["luna", "sol", "astra", "mimo"] },
  { name: "codex lane and opus", lanes: ["luna", "sol", "astra", "opus"] },
  { name: "mimo and opus", lanes: ["mimo", "opus"] },
  { name: "all three, as run", lanes: ["luna", "sol", "astra", "mimo", "opus"] },
];

/** The verified severe findings a reviewer set would have found, from who named each. */
export function recallTable(
  sets: ReadonlyArray<{ label: string; runs: readonly RunRecord[] }>,
): string {
  const rows = DESIGNS.map((design) => [
    design.name,
    ...sets.map((s) => {
      const r = recallOf(s.runs, design.lanes);
      return r.of === 0 ? "–" : `${r.found} of ${r.of}, ${pct(r.found, r.of)}`;
    }),
  ]);
  return md(["Reviewers", ...sets.map((s) => s.label)], rows);
}

/** Tokens by role and lane family, summed over a set of runs. */
export function tokensTable(
  sets: ReadonlyArray<{ label: string; runs: readonly RunRecord[] }>,
): string {
  const totals = sets.map((s) => tokensByRole(s.runs));
  const keys = [...new Set(totals.flatMap((t) => Object.keys(t)))].sort();
  const rows = keys.map((key) => [
    key,
    ...totals.map((t) => {
      const r = t[key];
      if (!r) return "–";
      const money = r.usd === null ? "" : `, $${r.usd.toFixed(2)} reported`;
      return `${r.launches} launches, ${mega(r.input)} in, ${kilo(r.output)} out${money}`;
    }),
  ]);
  return md(["Role and lane", ...sets.map((s) => s.label)], rows);
}

/** A run's typical spend by role: the median over runs of tokens in and out. */
export function perRunTokens(
  sets: ReadonlyArray<{ label: string; runs: readonly RunRecord[] }>,
): string {
  const rows = (["workhorse", "reviewer", "coachman"] as const).map((role) => [
    role,
    ...sets.map((s) => {
      const usable = s.runs.filter((r) => runTokens(r)[role].input > 0);
      const input = median(usable.map((r) => runTokens(r)[role].input));
      const output = median(usable.map((r) => runTokens(r)[role].output));
      return input === null || output === null ? "–" : `${mega(input)} in, ${kilo(output)} out`;
    }),
  ]);
  return md(
    ["Role, median per run", ...sets.map((s) => `${s.label} (${s.runs.length} runs)`)],
    rows,
  );
}

const stageMedian = (runs: readonly RunRecord[], stage: string): number | null =>
  median(
    runs.flatMap((r) => {
      const v = r.stages
        .filter((s) => s.stage === stage && s.seconds !== null)
        .reduce((sum, s) => sum + (s.seconds ?? 0), 0);
      return r.stages.some((s) => s.stage === stage && s.seconds !== null) ? [v] : [];
    }),
  );

/** Where a run's time goes, and what the second workhorse and the extra reviewers add to it. */
export function timeTable(
  sets: ReadonlyArray<{ label: string; runs: readonly RunRecord[] }>,
): string {
  const extraWait = (runs: readonly RunRecord[]): number[] =>
    runs.flatMap((r) => {
      const w = workhorses(r);
      return w?.extraWaitSeconds != null ? [w.extraWaitSeconds] : [];
    });
  const rounds = (runs: readonly RunRecord[]) => runs.flatMap((r) => roundTimes(r));
  const rows: string[][] = [
    [
      "planning, with the wait for the spec's review",
      ...sets.map((s) => hm(stageMedian(s.runs, "planning"))),
    ],
    ["workhorses running", ...sets.map((s) => hm(stageMedian(s.runs, "workhorses-running")))],
    ["synthesis", ...sets.map((s) => hm(stageMedian(s.runs, "synthesis")))],
    ["review", ...sets.map((s) => hm(stageMedian(s.runs, "review")))],
    [
      "of which the reviewers running, each round from launch to last exit",
      ...sets.map((s) => {
        const v = s.runs.flatMap((r) => {
          const x = reviewerRunning(r);
          return x === null ? [] : [x];
        });
        return v.length === 0 ? "–" : hm(median(v));
      }),
    ],
    [
      "slower workhorse's extra wait, median (90th percentile)",
      ...sets.map((s) => {
        const v = extraWait(s.runs);
        return v.length === 0 ? "–" : `${minutes(median(v))} min (${minutes(percentile(v, 0.9))})`;
      }),
    ],
    [
      "one review round, launch to last reviewer, median (90th percentile)",
      ...sets.map((s) => {
        const v = rounds(s.runs).map((r) => r.length);
        return v.length === 0 ? "–" : `${minutes(median(v))} min (${minutes(percentile(v, 0.9))})`;
      }),
    ],
    [
      "gap between the first and last reviewer of a round, median (90th percentile)",
      ...sets.map((s) => {
        const v = rounds(s.runs).flatMap((r) => (r.spread === null ? [] : [r.spread]));
        return v.length === 0 ? "–" : `${minutes(median(v))} min (${minutes(percentile(v, 0.9))})`;
      }),
    ],
    [
      "review rounds per run, median (most)",
      ...sets.map((s) => {
        const v = s.runs.filter((r) => r.reviewLaunches.length > 0).map((r) => reviews(r).rounds);
        return v.length === 0 ? "–" : `${median(v)} (${Math.max(...v)})`;
      }),
    ],
  ];
  return md(["", ...sets.map((s) => `${s.label} (${s.runs.length} runs)`)], rows);
}

/** The curated incidents, one row each. */
export function incidentTable(incidents: readonly Incident[]): string {
  return md(
    ["", "Kind", "When (UTC)", "What happened", "Runs"],
    incidents.map((i) => [
      i.id,
      i.kind,
      i.when,
      i.what,
      i.runs.map((r) => (r.startsWith("fixture") ? r : ticketLink(r))).join(", "),
    ]),
  );
}

/** Severe findings by lane across a set of runs, for the prose. */
export const severeSummary = (runs: readonly RunRecord[]) => severeTotals(runs);

export { isSevere };

const num = (n: number | null, digits = 0): string =>
  n === null ? "–" : n.toLocaleString("en-US", { maximumFractionDigits: digits });

/**
 * Every figure the report's prose quotes, named, so that each sentence can cite one file. The
 * figures are computed here from the same data as the tables and are not typed in by hand.
 */
export function figures(d: Data): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const add = (name: string, value: string): void => {
    out.push([name, value]);
  };
  const real = d.runs.filter((r) => r.kind === "real" && !r.parked && r.synthesis);
  const fixtures = d.runs.filter((r) => r.kind === "fixture" && r.synthesis);
  const rc = coverage(
    d.runs.filter((r) => r.kind === "real"),
    d.since,
  );
  const fc = coverage(
    d.runs.filter((r) => r.kind === "fixture"),
    d.since,
  );
  add("real runs with activity in the window", String(rc.inWindow));
  add("real runs set aside", String(rc.parked));
  add("real runs that reached synthesis", String(rc.reachedSynthesis));
  add("real runs that reached synthesis in the window", String(rc.synthesisInWindow));
  add("real runs finished", String(rc.finished));
  add("real runs not finished", String(rc.inProgress));
  add("fixture runs with activity in the window", String(fc.inWindow));
  add("fixture runs that reached synthesis", String(fc.reachedSynthesis));

  const parts = new Map(d.judgements.runs.map((j) => [j.run, j.part]));
  const tally = (ids: string[]): string =>
    (["A", "B", "C"] as const)
      .map((p) => `${p} ${ids.filter((id) => parts.get(id) === p).length}`)
      .join(", ");
  const judged = d.judgements.runs.map((j) => j.run);
  add("second lane's part, runs judged in this audit", `${judged.length}: ${tally(judged)}`);
  const inWindow = real.filter((r) => (r.synthesisAt ?? "") >= d.since).map((r) => r.id);
  add(
    "second lane's part, of those, synthesis in the window",
    `${inWindow.filter((id) => parts.has(id)).length}: ${tally(inWindow.filter((id) => parts.has(id)))}`,
  );
  add(
    "second lane's part, of those, synthesis before the window",
    `${judged.filter((id) => !inWindow.includes(id)).length}: ${tally(judged.filter((id) => !inWindow.includes(id)))}`,
  );
  const earlier = Object.values(d.judgements.earlierAudit);
  add(
    "second lane's part, earlier audit's reading of the four runs also in this window",
    `${earlier.length}: ${(["A", "B", "C"] as const).map((p) => `${p} ${earlier.filter((x) => x === p).length}`).join(", ")}`,
  );
  add(
    "first lane's version had a defect the card names",
    `${d.judgements.runs.filter((j) => j.firstLaneDefect).length} of ${judged.length}`,
  );
  const seconds = d.judgements.runs.filter((j) => j.secondReader !== undefined);
  const same = seconds.filter((j) => j.secondReader?.part === j.part);
  add("second reader, same class as the first", `${same.length} of ${seconds.length}`);
  add(
    "second reader, differs on",
    seconds
      .filter((j) => j.secondReader?.part !== j.part)
      .map((j) => `#${j.run} ${j.part} against ${j.secondReader?.part}`)
      .join(", ") || "none",
  );
  add(
    "second reader, same view of the first lane's defect",
    `${seconds.filter((j) => j.secondReader?.firstLaneDefect === j.firstLaneDefect).length} of ${seconds.length}`,
  );
  add(
    "second reader, totals",
    (["A", "B", "C"] as const)
      .map((p) => `${p} ${seconds.filter((j) => j.secondReader?.part === p).length}`)
      .join(", "),
  );

  const withBlind = real.filter((r) => r.synthesis?.oracle !== null && r.layout === "project");
  add(
    "real runs with blind tests (this audit's runs)",
    `${withBlind.length} of ${real.filter((r) => r.layout === "project").length}`,
  );

  const fs = fixtureSummary(d.hidden);
  add("fixture runs whose lane branches could be scored", String(fs.scorable));
  add("fixture lane branches passing every hidden test", `${fs.laneRunsPass} of ${fs.laneRuns}`);
  add("fixture merged results passing every hidden test", `${fs.mergedPass} of ${fs.merged}`);
  add(
    "fixture runs whose lane branches could not be scored",
    d.hidden
      .filter((h) => Object.values(h.lanes).some((s) => s.kind !== "counts"))
      .map((h) => h.run)
      .join(", "),
  );
  const fxShares = fixtures.flatMap((r) => {
    const w = workhorses(r);
    return w?.code ? [w.code.secondOnly] : [];
  });
  add(
    "fixture second lane's own share of the synthesis's code, median (90th percentile)",
    `${num(median(fxShares), 1)}% (${num(percentile(fxShares, 0.9), 1)}%)`,
  );
  add(
    "fixture runs with that share 2% or less",
    `${fxShares.filter((x) => x <= 2).length} of ${fxShares.length}`,
  );
  add(
    "fixture runs with that share 10% or more",
    `${fxShares.filter((x) => x >= 10).length} of ${fxShares.length}`,
  );
  const fxFirst = (r: RunRecord): string => r.synthesis?.ranked[0] ?? "?";
  add(
    "fixture runs ranked mimo first",
    `${fixtures.filter((r) => fxFirst(r) === "mimo").length} of ${fixtures.length}`,
  );
  const realShares = real.flatMap((r) => {
    const w = workhorses(r);
    return w?.code ? [`${r.id} ${w.code.secondOnly}%`] : [];
  });
  add("real runs with shares recorded, second lane's own share", realShares.join(", "));

  const waits = (runs: readonly RunRecord[]): number[] =>
    runs.flatMap((r) => {
      const w = workhorses(r);
      return w?.extraWaitSeconds != null ? [w.extraWaitSeconds] : [];
    });
  add(
    "real runs, slower workhorse's extra wait, median (90th percentile), runs",
    `${minutes(median(waits(real)))} min (${minutes(percentile(waits(real), 0.9))}), ${waits(real).length}`,
  );
  add(
    "fixture runs, slower workhorse's extra wait, median (90th percentile), runs",
    `${minutes(median(waits(fixtures)))} min (${minutes(percentile(waits(fixtures), 0.9))}), ${waits(fixtures).length}`,
  );

  const sev = severeTotals(real);
  add("real runs, verified P1 and P2 findings", String(sev.total));
  add(
    "real runs, findings only one lane named, by lane",
    Object.entries(sev.alone)
      .map(([l, n]) => `${l} ${n}`)
      .join(", "),
  );
  add("real runs, findings two or more lanes named", String(sev.shared));
  add("real runs, findings naming no lane", String(sev.unattributed));
  const fsev = severeTotals(fixtures);
  add("fixture runs, verified P1 and P2 findings", String(fsev.total));
  add(
    "fixture runs, findings only one lane named, by lane",
    Object.entries(fsev.alone)
      .map(([l, n]) => `${l} ${n}`)
      .join(", "),
  );

  const codex = ["luna", "sol", "astra"];
  const a = recallOf(real, codex);
  const b = recallOf(real, ["mimo"]);
  const both = recallOf(real, [...codex, "mimo"]);
  const overlap = a.found + b.found - both.found;
  add("real runs, found by a codex lane and by mimo, both", String(overlap));
  add(
    "real runs, Chapman estimate of what two such reviewers could find",
    num(chapman(a.found, b.found, overlap)),
  );
  add("real runs, found by either of them", `${both.found} of ${both.of}`);

  const usd = tokensByRole(real);
  add(
    "real runs, opus reviews recorded cost",
    `$${num(usd["reviewer opus"]?.usd ?? null, 2)} over ${usd["reviewer opus"]?.launches} launches`,
  );
  add(
    "real runs, coachman tokens",
    `${num((usd.coachman?.input ?? 0) / 1e6)}M in, ${num((usd.coachman?.output ?? 0) / 1e3)}k out`,
  );
  add(
    "real runs, workhorse tokens",
    `${num(((usd["workhorse codex"]?.input ?? 0) + (usd["workhorse mimo"]?.input ?? 0)) / 1e6)}M in, ${num(((usd["workhorse codex"]?.output ?? 0) + (usd["workhorse mimo"]?.output ?? 0)) / 1e3)}k out`,
  );
  add(
    "real runs, reviewer tokens",
    `${num(((usd["reviewer codex"]?.input ?? 0) + (usd["reviewer mimo"]?.input ?? 0) + (usd["reviewer opus"]?.input ?? 0)) / 1e6)}M in, ${num(((usd["reviewer codex"]?.output ?? 0) + (usd["reviewer mimo"]?.output ?? 0) + (usd["reviewer opus"]?.output ?? 0)) / 1e3)}k out`,
  );

  const outputShares = (runs: readonly RunRecord[]): string => {
    const rows = runs
      .map((r) => runTokens(r))
      .filter((t) => t.coachman.input > 0)
      .map((t) => {
        const all = t.workhorse.output + t.reviewer.output + t.coachman.output;
        return {
          w: t.workhorse.output / all,
          v: t.reviewer.output / all,
          c: t.coachman.output / all,
        };
      });
    const pc = (xs: number[]): string => `${Math.round(100 * (median(xs) ?? 0))}%`;
    return `workhorses ${pc(rows.map((x) => x.w))}, reviewers ${pc(rows.map((x) => x.v))}, coachman ${pc(rows.map((x) => x.c))}, over ${rows.length} runs`;
  };
  add("real runs, share of a run's output tokens, median", outputShares(real));
  add("fixture runs, share of a run's output tokens, median", outputShares(fixtures));
  const degradedLaunches = (runs: readonly RunRecord[]): number =>
    runs.reduce((s, r) => s + reviews(r).degraded, 0);
  add("reviewer launches that ended degraded, real runs", String(degradedLaunches(real)));
  add("reviewer launches that ended degraded, fixture runs", String(degradedLaunches(fixtures)));
  add(
    "reviewer launches, real runs",
    String(real.reduce((s, r) => s + r.reviewLaunches.length, 0)),
  );

  const workhorseOutput = (runs: readonly RunRecord[]): string => {
    const first: number[] = [];
    const second: number[] = [];
    for (const r of runs) {
      const ranked = r.synthesis?.ranked ?? [];
      if (ranked.length < 2) continue;
      const out = (lane: string): number =>
        r.streams
          .filter((s) => s.role === "workhorse" && s.lane === lane)
          .reduce((sum, s) => sum + (s.outputTokens ?? 0), 0);
      const a = out(ranked[0] as string);
      const b = out(ranked[1] as string);
      if (a > 0 && b > 0) {
        first.push(a);
        second.push(b);
      }
    }
    return `${kilo(median(first) ?? 0)} for the first-ranked lane, ${kilo(median(second) ?? 0)} for the second, over ${first.length} runs`;
  };
  add("real runs, workhorse output tokens, median", workhorseOutput(real));
  add("fixture runs, workhorse output tokens, median", workhorseOutput(fixtures));
  add(
    "set-aside runs that launched workhorses, input tokens",
    d.runs
      .filter((r) => r.parked && r.streams.length > 0)
      .map(
        (r) =>
          `${r.id}: workhorses ${mega(r.streams.reduce((sum, s) => sum + (s.inputTokens ?? 0), 0))}, coachman ${mega(r.coachman.reduce((sum, c) => sum + (c.inputTokens ?? 0), 0))}`,
      )
      .join("; "),
  );

  const gateTime = (runs: readonly RunRecord[], lanes: boolean): [number, number] => {
    const g = runs.flatMap((r) =>
      r.gates.filter((x) => x.name === "gate" && (x.lane !== null) === lanes),
    );
    return [g.length, g.reduce((s, x) => s + x.seconds, 0)];
  };
  const [ln, ls] = gateTime(real, true);
  const [sn, ss] = gateTime(real, false);
  add("real runs, gate runs on lane branches", `${ln}, ${num(ls / 3600, 1)} hours`);
  add("real runs, gate runs on the synthesis branch", `${sn}, ${num(ss / 3600, 1)} hours`);

  const rounds = real.flatMap((r) => roundTimes(r));
  const lengths = rounds.map((r) => r.length);
  const spreads = rounds.flatMap((r) => (r.spread === null ? [] : [r.spread]));
  add(
    "real runs, review round length, median (90th percentile), rounds",
    `${minutes(median(lengths))} min (${minutes(percentile(lengths, 0.9))}), ${lengths.length}`,
  );
  add(
    "real runs, gap between first and last reviewer of a round, median (90th percentile)",
    `${minutes(median(spreads))} min (${minutes(percentile(spreads, 0.9))})`,
  );
  const stage = (name: string): string => hm(stageMedian(real, name));
  add(
    "real runs, median time in workhorses-running, synthesis, review",
    `${stage("workhorses-running")}, ${stage("synthesis")}, ${stage("review")}`,
  );

  for (const kind of ["real", "fixture"] as const) {
    const listed = d.runs.filter((r) => r.kind === kind && r.reviewReport.length > 0);
    const entries = listed.flatMap((r) => r.reviewReport);
    const severeEntries = entries.filter((e) => e.severity !== "P3");
    const by = (rows: typeof entries): string =>
      (["closed", "open", "dismissed"] as const)
        .map((st) => `${st} ${rows.filter((e) => e.status === st).length}`)
        .join(", ");
    add(`${kind} runs whose review checkpoint lists each finding`, String(listed.length));
    add(`${kind} runs, listed findings, all severities`, `${entries.length}: ${by(entries)}`);
    add(`${kind} runs, listed P1 and P2 findings`, `${severeEntries.length}: ${by(severeEntries)}`);
  }

  const shares = real.flatMap((r) => {
    const x = reviewerShare(r);
    return x === null ? [] : [x];
  });
  add(
    "real runs, reviewers' running time as a share of the review stage, median",
    `${Math.round(100 * (median(shares) ?? 0))}% over ${shares.length} runs`,
  );
  const long = real.filter((r) => reviews(r).rounds > 3);
  add(
    "real runs with more than three review rounds, each past the third needing a ruling",
    `${long.length} of ${real.length}`,
  );

  const kinds = new Map<string, number>();
  for (const i of d.incidents) kinds.set(i.kind, (kinds.get(i.kind) ?? 0) + 1);
  add("incidents by kind", [...kinds.entries()].map(([k, n]) => `${k} ${n}`).join(", "));
  add("incidents, runs touched", String(new Set(d.incidents.flatMap((i) => i.runs)).size));
  return out;
}

/** The figures as a markdown list. */
export const figuresList = (d: Data): string =>
  figures(d)
    .map(([name, value]) => `- ${name}: ${value}`)
    .join("\n");
