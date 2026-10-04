// The lane audit's measures: pure functions from run rows (`records.ts`) to the numbers the
// tables report (see ../method.md). Nothing here reads a file or the clock.
import type { FindingRow, RunRecord } from "./records.ts";

/** codex serves luna, sol and astra: one vendor harness, three model assignments over the window. */
export const family = (lane: string): string =>
  ["luna", "sol", "astra"].includes(lane) ? "codex" : lane;

export type GateStatus = "pass" | "fail" | "none";

/**
 * A lane's own branch on the gate, as harvested: the result of the last `gate` run the coachman
 * logged on `wb/<ticket>-<lane>`. A lane with no gate run on its branch reads `none`.
 */
export function laneGate(run: RunRecord, lane: string): GateStatus {
  const runs = run.gates.filter((g) => g.name === "gate" && g.lane === lane);
  const last = runs[runs.length - 1];
  return last ? (last.result === "pass" ? "pass" : "fail") : "none";
}

export type Workhorses = {
  run: string;
  ranked: string[];
  first: string | null;
  second: string | null;
  outcome: Record<string, string | null>;
  /** each lane's result on the coachman's blind tests; null where the ticket had none */
  blind: Record<string, boolean> | null;
  gate: Record<string, GateStatus>;
  /** shares of the synthesis's code, in percent of its runs of six words */
  code: { firstOnly: number; secondOnly: number; shared: number; neither: number } | null;
  /** minutes from implementation start to process exit, per lane */
  minutes: Record<string, number | null>;
  /** the later lane's finish minus the earlier's, where both finished; and which was later */
  extraWaitSeconds: number | null;
  slowerLane: string | null;
};

const percent = (n: number, d: number): number => (d === 0 ? 0 : Math.round((1000 * n) / d) / 10);

/** What each workhorse did in a run that reached synthesis; null for a run that did not. */
export function workhorses(run: RunRecord): Workhorses | null {
  const syn = run.synthesis;
  if (!syn) return null;
  const lanes = run.lanes.map((l) => l.lane);
  const first = syn.ranked[0] ?? null;
  const second = syn.ranked[1] ?? null;
  const share = run.shares?.code;
  const code =
    share && first && second && share.runs > 0
      ? {
          firstOnly: percent(share.lanes[first] ?? 0, share.runs),
          secondOnly: percent(share.lanes[second] ?? 0, share.runs),
          shared: percent(share.shared, share.runs),
          neither: percent(share.neither, share.runs),
        }
      : null;
  const finished = run.lanes.filter(
    (l) => l.outcome === "harvested" && l.implementSeconds !== null,
  );
  const slow = finished.reduce<(typeof finished)[number] | null>(
    (a, l) => (a === null || (l.implementSeconds ?? 0) > (a.implementSeconds ?? 0) ? l : a),
    null,
  );
  const fast = finished.reduce<(typeof finished)[number] | null>(
    (a, l) => (a === null || (l.implementSeconds ?? 0) < (a.implementSeconds ?? 0) ? l : a),
    null,
  );
  const both = finished.length >= 2 && slow && fast && slow.lane !== fast.lane;
  return {
    run: run.id,
    ranked: syn.ranked,
    first,
    second,
    outcome: Object.fromEntries(run.lanes.map((l) => [l.lane, l.outcome])),
    blind: syn.oracle
      ? Object.fromEntries(Object.entries(syn.oracle).map(([k, v]) => [k, v.passed]))
      : null,
    gate: Object.fromEntries(lanes.map((lane) => [lane, laneGate(run, lane)])),
    code,
    minutes: Object.fromEntries(
      run.lanes.map((l) => [
        l.lane,
        l.implementSeconds === null ? null : Math.round(l.implementSeconds / 60),
      ]),
    ),
    extraWaitSeconds: both ? (slow.implementSeconds ?? 0) - (fast.implementSeconds ?? 0) : null,
    slowerLane: both ? slow.lane : null,
  };
}

/**
 * Whether some one lane alone would have passed what the run measured: its own branch on the gate,
 * and the blind tests where the ticket had them. `unknown` where the run measured neither for any
 * lane.
 */
export function singleLaneSufficed(w: Workhorses): "yes" | "no" | "unknown" {
  const lanes = Object.keys(w.gate);
  const measured = lanes.some((l) => w.gate[l] !== "none") || w.blind !== null;
  if (!measured) return "unknown";
  const ok = lanes.some((l) => {
    const gateOk = w.gate[l] === "pass";
    const blindOk = w.blind === null || w.blind[l] === true;
    return gateOk && blindOk;
  });
  return ok ? "yes" : "no";
}

/** A finding the loop had to act on: a verified gating P1 or P2 that was not dismissed. */
export const isSevere = (f: FindingRow): boolean =>
  f.class === "gating" && (f.severity === "P1" || f.severity === "P2") && !f.dismissed;

export type Reviews = {
  run: string;
  rounds: number;
  launches: number;
  degraded: number;
  findings: number;
  severe: number;
  severeByExecution: number;
  /** severe findings each lane's reviews named as a source, and those it alone named */
  byLane: Record<string, { found: number; alone: number }>;
  /** severe findings that two or more lanes named */
  shared: number;
  unattributed: number;
};

/**
 * The highest review round a run's launch, harvest or finding lines name. A round past the cap
 * runs on the user's ruling, and some runs logged no launch line for it, so the launch lines alone
 * read low there; a harvest or a finding names a round that happened.
 */
export function lastRound(run: RunRecord): number {
  return Math.max(
    0,
    ...run.reviewLaunches.map((l) => l.round ?? 0),
    ...run.reviewHarvests.map((h) => h.round ?? 0),
    ...run.findings.map((f) => f.round ?? 0),
  );
}

export function reviews(run: RunRecord): Reviews {
  const severe = run.findings.filter(isSevere);
  const byLane: Reviews["byLane"] = {};
  let shared = 0;
  let unattributed = 0;
  for (const f of severe) {
    if (f.lanes.length === 0) unattributed += 1;
    if (f.lanes.length > 1) shared += 1;
    for (const lane of f.lanes) {
      const row = (byLane[lane] ??= { found: 0, alone: 0 });
      row.found += 1;
      if (f.lanes.length === 1) row.alone += 1;
    }
  }
  return {
    run: run.id,
    rounds: lastRound(run),
    launches: run.reviewLaunches.length,
    degraded: run.reviewHarvests.filter((h) => h.verdict === "degraded").length,
    findings: run.findings.length,
    severe: severe.length,
    severeByExecution: severe.filter((f) => f.verified === "execution").length,
    byLane,
    shared,
    unattributed,
  };
}

export type Recall = { lanes: string[]; found: number; of: number };

/**
 * What a review done by only `lanes` would have found of the severe findings, in runs where at
 * least one of them reviewed: findings that any of them named as a source, over all such findings.
 */
export function recallOf(runs: readonly RunRecord[], lanes: readonly string[]): Recall {
  let found = 0;
  let of = 0;
  for (const run of runs) {
    const present = new Set(run.reviewLaunches.map((l) => l.lane));
    if (!lanes.some((l) => present.has(l))) continue;
    for (const f of run.findings.filter(isSevere)) {
      if (f.lanes.length === 0) continue;
      of += 1;
      if (f.lanes.some((l) => lanes.includes(l))) found += 1;
    }
  }
  return { lanes: [...lanes], found, of };
}

/**
 * Chapman's form of the Lincoln-Petersen estimate of how many defects two independent reviewers
 * could find between them, from what each found and what both found. It assumes independence and
 * equal catchability, and defects differ in how easy they are, so it reads low.
 */
export function chapman(a: number, b: number, both: number): number {
  return ((a + 1) * (b + 1)) / (both + 1) - 1;
}

export type Spend = {
  input: number;
  output: number;
  usd: number | null;
  launches: number;
  missing: number;
};

/** Tokens and money by role and lane, summed over a run's launch records. */
export function spend(run: RunRecord): Record<string, Spend> {
  const out: Record<string, Spend> = {};
  for (const u of run.usage) {
    const key = `${u.role}:${u.lane}`;
    const row = (out[key] ??= { input: 0, output: 0, usd: null, launches: 0, missing: 0 });
    row.launches += 1;
    if (u.inputTokens === null && u.outputTokens === null) row.missing += 1;
    row.input += u.inputTokens ?? 0;
    row.output += u.outputTokens ?? 0;
    if (u.costUsd !== null) row.usd = (row.usd ?? 0) + u.costUsd;
  }
  return out;
}

const stageSeconds = (run: RunRecord, stage: string): number | null => {
  const rows = run.stages.filter((s) => s.stage === stage && s.seconds !== null);
  return rows.length === 0 ? null : rows.reduce((sum, s) => sum + (s.seconds ?? 0), 0);
};

export type Times = {
  run: string;
  planning: number | null;
  workhorses: number | null;
  synthesis: number | null;
  review: number | null;
  total: number | null;
  gateSeconds: { lanes: number; synthesis: number };
};

/** Seconds in each stage, from the `stage` lines, and the gate's seconds on lane branches and on the synthesis. */
export function times(run: RunRecord): Times {
  const last = run.stages[run.stages.length - 1];
  const first = run.stages[0];
  const done = last && ["done", "abandoned"].includes(last.stage);
  const gates = run.gates.filter((g) => g.name === "gate");
  return {
    run: run.id,
    planning: stageSeconds(run, "planning"),
    workhorses: stageSeconds(run, "workhorses-running"),
    synthesis: stageSeconds(run, "synthesis"),
    review: stageSeconds(run, "review"),
    total: done && first ? Math.round((Date.parse(last.at) - Date.parse(first.at)) / 1000) : null,
    gateSeconds: {
      lanes: gates.filter((g) => g.lane !== null).reduce((s, g) => s + g.seconds, 0),
      synthesis: gates.filter((g) => g.lane === null).reduce((s, g) => s + g.seconds, 0),
    },
  };
}

export type RoundTime = {
  round: number;
  /** seconds from the round's launch to each reviewer's exit, by lane and lens */
  seconds: Record<string, number>;
  /** the round's length: launch to the last exit */
  length: number;
  /** the last reviewer's exit less the first's, where two or more finished */
  spread: number | null;
};

/**
 * How long each review round took and how far apart its reviewers finished, from the launch
 * lines and the reviewers' done markers. A round with no launch line or no marker is left out.
 */
export function roundTimes(run: RunRecord): RoundTime[] {
  const rounds = [...new Set(run.reviewDone.map((d) => d.round))].sort((a, b) => a - b);
  return rounds.flatMap((round) => {
    const launches = run.reviewLaunches
      .filter((l) => l.round === round)
      .map((l) => Date.parse(l.ts));
    if (launches.length === 0) return [];
    const start = Math.min(...launches);
    const done = run.reviewDone.filter((d) => d.round === round);
    const seconds = Object.fromEntries(
      done.map((d) => [`${d.lens}:${d.lane}`, Math.round((Date.parse(d.done) - start) / 1000)]),
    );
    const values = Object.values(seconds);
    return [
      {
        round,
        seconds,
        length: Math.max(...values),
        spread: values.length >= 2 ? Math.max(...values) - Math.min(...values) : null,
      },
    ];
  });
}

/** Whether a run is a real run that reached its synthesis, which is what the workhorse tables cover. */
export const reachedSynthesis = (run: RunRecord): boolean => run.synthesis !== null;

/** The median of numbers, null for none. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** The value at the fraction `p` of the way through the sorted numbers, null for none. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] as number;
}

export type Coverage = {
  folders: number;
  inWindow: number;
  parked: number;
  reachedSynthesis: number;
  synthesisInWindow: number;
  finished: number;
  inProgress: number;
};

/** What a set of runs covers: how many had activity, reached synthesis, finished or were set aside. */
export function coverage(runs: readonly RunRecord[], since: string): Coverage {
  const live = runs.filter((r) => r.actionsInWindow > 0);
  return {
    folders: runs.length,
    inWindow: live.length,
    parked: live.filter((r) => r.parked).length,
    reachedSynthesis: live.filter((r) => r.synthesis !== null).length,
    synthesisInWindow: live.filter((r) => r.synthesis !== null && (r.synthesisAt ?? "") >= since)
      .length,
    finished: live.filter((r) => r.stage === "done" || r.stage === "abandoned").length,
    inProgress: live.filter((r) => r.stage !== "done" && r.stage !== "abandoned").length,
  };
}

export type SevereTotals = {
  total: number;
  /** severe findings only this lane named, by lane */
  alone: Record<string, number>;
  /** severe findings two or more lanes named */
  shared: number;
  unattributed: number;
  /** severe findings each lane named, alone or not */
  named: Record<string, number>;
};

/** The severe findings of many runs, by who named them. */
export function severeTotals(runs: readonly RunRecord[]): SevereTotals {
  const out: SevereTotals = { total: 0, alone: {}, shared: 0, unattributed: 0, named: {} };
  for (const run of runs) {
    for (const f of run.findings.filter(isSevere)) {
      out.total += 1;
      if (f.lanes.length === 0) out.unattributed += 1;
      if (f.lanes.length > 1) out.shared += 1;
      if (f.lanes.length === 1) {
        const lane = f.lanes[0] as string;
        out.alone[lane] = (out.alone[lane] ?? 0) + 1;
      }
      for (const lane of f.lanes) out.named[lane] = (out.named[lane] ?? 0) + 1;
    }
  }
  return out;
}

export type SevereByRound = {
  run: string;
  /** severe findings by the review round their line names */
  byRound: Record<number, number>;
  /** severe findings whose line names no round: in the total, in no round */
  noRound: number;
  total: number;
  roundOne: number;
  /** the last round that holds a severe finding, 0 for none */
  lastWithFinding: number;
};

/** A run's severe findings, in all and in each review round, by the round each finding's line names. */
export function severeByRound(run: RunRecord): SevereByRound {
  const byRound: Record<number, number> = {};
  let noRound = 0;
  let total = 0;
  for (const f of run.findings.filter(isSevere)) {
    total += 1;
    if (f.round === null) noRound += 1;
    else byRound[f.round] = (byRound[f.round] ?? 0) + 1;
  }
  return {
    run: run.id,
    byRound,
    noRound,
    total,
    roundOne: byRound[1] ?? 0,
    lastWithFinding: Math.max(0, ...Object.keys(byRound).map(Number)),
  };
}

export type RoundOneGroup = {
  label: string;
  runs: string[];
  /** the rounds each of the group's runs took, smallest first */
  rounds: number[];
  median: number | null;
};

/** The groups the report reads rounds by: runs with 3 or fewer severe findings in round 1, 4 to 7, 8 or more. */
export function groupByRoundOne(
  rows: ReadonlyArray<{ run: string; roundOne: number; rounds: number }>,
): RoundOneGroup[] {
  const groups: Array<{ label: string; has: (n: number) => boolean }> = [
    { label: "3 or fewer", has: (n) => n <= 3 },
    { label: "4 to 7", has: (n) => n >= 4 && n <= 7 },
    { label: "8 or more", has: (n) => n >= 8 },
  ];
  return groups.map((g) => {
    const members = rows.filter((r) => g.has(r.roundOne));
    const rounds = members.map((r) => r.rounds).sort((a, b) => a - b);
    return { label: g.label, runs: members.map((r) => r.run), rounds, median: median(rounds) };
  });
}

/** The sample standard deviation (n minus one), null for fewer than two values. */
export function sampleSd(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const sumSquares = values.reduce((s, v) => s + (v - mean) ** 2, 0);
  return Math.sqrt(sumSquares / (values.length - 1));
}

/**
 * The most rounds an ordinary run took, for the spread the sample sizes use. No run in the audit
 * took between 7 and 12, so the cut sits in the gap the data has; it was set after seeing it.
 */
export const ORDINARY_MAX_ROUNDS = 6;

/**
 * Tickets needed in each of two groups to see a difference of `delta` rounds between their means,
 * by the normal approximation for a two-sided test at 5% and 80% power: 2 (z1 + z2)^2 sd^2 / delta^2,
 * rounded up. Rough: rounds are whole numbers and skewed.
 */
export function ticketsPerGroup(sd: number, delta: number): number {
  const z = 1.959964 + 0.841621;
  return Math.ceil((2 * z * z * sd * sd) / (delta * delta));
}

export type RoleTokens = { launches: number; input: number; output: number; usd: number | null };

/**
 * Tokens by role from the runs' own events streams and session records, with the lane family
 * for workhorses and reviewers. Money is the sum of what the harnesses reported, null where none did.
 */
export function tokensByRole(runs: readonly RunRecord[]): Record<string, RoleTokens> {
  const out: Record<string, RoleTokens> = {};
  const add = (
    key: string,
    input: number | null,
    output: number | null,
    usd: number | null,
  ): void => {
    const row = (out[key] ??= { launches: 0, input: 0, output: 0, usd: null });
    row.launches += 1;
    row.input += input ?? 0;
    row.output += output ?? 0;
    if (usd !== null) row.usd = (row.usd ?? 0) + usd;
  };
  for (const run of runs) {
    for (const s of run.streams)
      add(`${s.role} ${family(s.lane)}`, s.inputTokens, s.outputTokens, s.costUsd);
    for (const c of run.coachman) add("coachman", c.inputTokens, c.outputTokens, null);
  }
  return out;
}

/** One run's tokens by role: workhorses, reviewers and coachman, input and output. */
export function runTokens(run: RunRecord): {
  workhorse: { input: number; output: number };
  reviewer: { input: number; output: number };
  coachman: { input: number; output: number };
} {
  const sum = (
    rows: ReadonlyArray<{ inputTokens: number | null; outputTokens: number | null }>,
  ) => ({
    input: rows.reduce((s, r) => s + (r.inputTokens ?? 0), 0),
    output: rows.reduce((s, r) => s + (r.outputTokens ?? 0), 0),
  });
  return {
    workhorse: sum(run.streams.filter((s) => s.role === "workhorse")),
    reviewer: sum(run.streams.filter((s) => s.role === "reviewer")),
    coachman: sum(run.coachman),
  };
}

/** Seconds the reviewers ran: each round's launch to its last exit, summed; null for a run with no timed round. */
export function reviewerRunning(run: RunRecord): number | null {
  const rounds = roundTimes(run);
  return rounds.length === 0 ? null : rounds.reduce((sum, r) => sum + r.length, 0);
}

/** The reviewers' running time as a fraction of the run's review stage; null where either is missing. */
export function reviewerShare(run: RunRecord): number | null {
  const running = reviewerRunning(run);
  const stage = run.stages
    .filter((s) => s.stage === "review" && s.seconds !== null)
    .reduce((sum, s) => sum + (s.seconds ?? 0), 0);
  return running === null || stage <= 0 ? null : running / stage;
}
