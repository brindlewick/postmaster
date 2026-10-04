// Read a run's own records into one row (see ../method.md). Everything here only reads: a run's
// directory is never written, and nothing from it is kept that names the machine, a thread, a
// session or a path (`scrub`).
//
// The pure parsing is in `parse.ts`; this file is the edge that reads the files.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  type Action,
  type IncidentKind,
  incidentCandidates,
  inWindow,
  type KindShare,
  type ReviewEntry,
  parseActions,
  parseFinding,
  parseReviewHarvest,
  parseReviewReport,
  parseReviewRef,
  parseShares,
  parseSynthesis,
  parseUsageName,
  parseVerify,
  type StageSpan,
  type Synthesis,
  secondsBetween,
  stageSpans,
  type Verify,
} from "./parse.ts";

export type RunKind = "real" | "fixture";

export type RunSource = {
  id: string;
  kind: RunKind;
  /** where the run lives: the project's own `.postmaster/runs`, the older shared folder, a fixture */
  layout: "project" | "legacy" | "fixture";
  /** the ticket's number for a run of this repository, the fixture ticket's name for a fixture */
  ticket: string;
  dir: string;
};

export type LaneConfig = { harness: string; model: string; effort: string | null };

export type Team = {
  workhorses: string[];
  reviewers: string[];
  lensReviewers: Record<string, string[]>;
  coachman: LaneConfig | null;
  lanes: Record<string, LaneConfig>;
  contract: number | null;
};

export type LaneTimes = {
  lane: string;
  /** whether the lane wrote its own spec first, as runs before the one-spec change did */
  specRound: boolean;
  /** the lane's first launch, which for a run with a spec round is its spec round */
  firstLaunch: string | null;
  /** when it began implementing: its resume after the spec, else its first launch */
  implementFrom: string | null;
  /** when its process last exited, from its done marker */
  finished: string | null;
  /** the coachman's last harvest of it that is not a spec-only harvest */
  harvested: string | null;
  /** from implementFrom to finished, or to the harvest where there is no marker */
  implementSeconds: number | null;
  outcome: string | null;
  resumes: number;
};

export type Gate = Verify & { ts: string; lane: string | null };

export type ReviewLaunch = { ts: string; lane: string; lens: string | null; round: number | null };
export type ReviewHarvestRow = ReviewLaunch & {
  verdict: "reviewed" | "degraded" | "unstated";
  raw: number | null;
};

/** When a reviewer's process last exited, from the mtime of its `logs/review-r<round>-<lens>-<lane>.done`. */
export type ReviewDone = { round: number; lens: string; lane: string; done: string };

export type FindingRow = {
  ts: string;
  /** a repository path and line, else null where the target was a sentence */
  target: string | null;
  class: "gating" | "style" | null;
  severity: "P1" | "P2" | "P3" | null;
  round: number | null;
  lanes: string[];
  lenses: string[];
  pairs: Array<[string, string]> | null;
  dismissed: boolean;
  verified: "execution" | "reading" | null;
};

export type UsageLaunch = {
  file: string;
  role: "workhorse" | "reviewer" | "coachman";
  lane: string;
  harness: string;
  lens: string | null;
  round: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  readError: boolean;
};

/** One coachman thread's tokens, from its session record; the leg is null for a thread no leg names. */
export type CoachmanThread = {
  leg: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type IncidentCandidate = {
  ts: string;
  actor: string;
  action: string;
  kinds: IncidentKind[];
  text: string;
};

export type RunRecord = {
  id: string;
  kind: RunKind;
  layout: RunSource["layout"];
  ticket: string;
  parked: boolean;
  first: string;
  last: string;
  actions: number;
  badLines: number;
  actionsInWindow: number;
  stage: string | null;
  legs: number | null;
  team: Team | null;
  laneOutcomes: Record<string, string>;
  stages: StageSpan[];
  synthesis: Synthesis | null;
  synthesisAt: string | null;
  shares: Record<string, KindShare> | null;
  lanes: LaneTimes[];
  gates: Gate[];
  reviewLaunches: ReviewLaunch[];
  reviewHarvests: ReviewHarvestRow[];
  reviewDone: ReviewDone[];
  /** the finding list of the review checkpoint, where the run wrote one */
  reviewReport: ReviewEntry[];
  degrades: Array<{ ts: string; lane: string; text: string }>;
  findings: FindingRow[];
  applies: number;
  escalations: number;
  usage: UsageLaunch[];
  /** the coachman's threads, read again from their session records, which a leg's usage file can undercount */
  coachman: CoachmanThread[];
  /** each workhorse and reviewer launch, read again from its events stream */
  streams: StreamUsage[];
  incidents: IncidentCandidate[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const readText = (path: string): string => (existsSync(path) ? readFileSync(path, "utf8") : "");

const readJson = (path: string): unknown => {
  try {
    return JSON.parse(readText(path));
  } catch {
    return null;
  }
};

/**
 * Text kept in the derived data with what names the machine taken out: paths, thread and session
 * ids, host spaces and long hashes, and capped in length.
 */
export function scrub(value: string, max = 220): string {
  const out = value
    .replace(/\/(?:home|Users|tmp|var|root|opt)\/[^ \t,;:)"']*/gu, "<path>")
    .replace(/~\/[^ \t,;:)"']*/gu, "<path>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gu, "<id>")
    .replace(/\bses_[A-Za-z0-9]+/gu, "<id>")
    .replace(/\b(host|space|tab|pane)=[^ \t,;)]+/gu, "$1=<x>")
    .replace(/\b[0-9a-f]{20,}\b/gu, "<hash>")
    .replace(/[ \t]+/gu, " ")
    .trim();
  return out.length > max ? `${out.slice(0, max - 1)}…` : out;
}

/** A lane or role name as the records write it; anything else is text and is scrubbed. */
export const safeLane = (target: string): string =>
  /^[A-Za-z0-9._-]+$/u.test(target) ? target : scrub(target, 80);

const PRIVATE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  {
    name: "a home or system path",
    pattern: /(?:^|[^A-Za-z0-9_.-])\/(?:home|Users|root|tmp|var)\/[A-Za-z0-9_.-]/u,
  },
  {
    name: "a thread or session id",
    pattern:
      /\bses_[A-Za-z0-9]{6,}|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/u,
  },
  { name: "a tailnet name", pattern: /\.ts\.net\b|\btailnet\b/iu },
  { name: "a host space", pattern: /\b(?:space|tab|pane)=w[A-Za-z0-9]+/u },
];

/**
 * What in `text` names the machine or a session: each kind found, once. The derived data is
 * published, so the commands that write it refuse to when this finds anything.
 */
export function privacyFaults(text: string): string[] {
  return PRIVATE_PATTERNS.filter((p) => p.pattern.test(text)).map((p) => p.name);
}

const FIXTURE_DIR = /^todo-fixture-([0-9]+)$/u;

/** Every run under the three places runs live, each named the way the records name it. */
export function discover(roots: {
  project?: string;
  legacy?: string;
  fixtures?: string;
}): RunSource[] {
  const out: RunSource[] = [];
  const fromFolder = (folder: string, layout: "project" | "legacy"): void => {
    if (!existsSync(folder)) return;
    for (const name of readdirSync(folder).sort()) {
      const dir = join(folder, name);
      if (!statSync(dir).isDirectory() || !existsSync(join(dir, "actions.jsonl"))) continue;
      const ticket = /^([0-9]+)/u.exec(name);
      if (!ticket) continue;
      out.push({ id: name, kind: "real", layout, ticket: ticket[1] as string, dir });
    }
  };
  if (roots.project) fromFolder(join(roots.project, ".postmaster", "runs"), "project");
  if (roots.legacy) fromFolder(roots.legacy, "legacy");
  if (roots.fixtures && existsSync(roots.fixtures)) {
    for (const name of readdirSync(roots.fixtures).sort()) {
      const m = FIXTURE_DIR.exec(name);
      const dir = join(roots.fixtures, name, ".postmaster", "runs", "1");
      if (!m || !existsSync(join(dir, "actions.jsonl"))) continue;
      out.push({
        id: `fixture-${m[1]}`,
        kind: "fixture",
        layout: "fixture",
        ticket: "remove",
        dir,
      });
    }
  }
  return out;
}

const laneConfig = (value: unknown): LaneConfig | null =>
  isRecord(value)
    ? {
        harness: String(value.harness ?? ""),
        model: String(value.model ?? ""),
        effort: typeof value.effort === "string" ? value.effort : null,
      }
    : null;

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** The team a run was dispatched with, from its `run.json`. */
export function readTeam(dir: string): Team | null {
  const run = readJson(join(dir, "run.json"));
  if (!isRecord(run) || !isRecord(run.config)) return null;
  const config = run.config;
  const team = isRecord(config.team) ? config.team : {};
  const lensReviewers: Record<string, string[]> = {};
  if (isRecord(team.lens_reviewers)) {
    for (const [lens, lanes] of Object.entries(team.lens_reviewers)) {
      lensReviewers[lens] = stringList(lanes);
    }
  }
  const lanes: Record<string, LaneConfig> = {};
  if (isRecord(config.lanes)) {
    for (const [name, value] of Object.entries(config.lanes)) {
      const lane = laneConfig(value);
      if (lane) lanes[name] = lane;
    }
  }
  return {
    workhorses: stringList(team.workhorses),
    reviewers: stringList(team.reviewers),
    lensReviewers,
    coachman: laneConfig(team.coachman),
    lanes,
    contract: typeof run.coachman_contract === "number" ? run.coachman_contract : null,
  };
}

/** When a lane's process last exited, from the mtime of its `logs/<lane>.done` marker. */
export function doneTime(dir: string, lane: string): string | null {
  const marker = join(dir, "logs", `${lane}.done`);
  if (!existsSync(marker)) return null;
  return `${new Date(statSync(marker).mtimeMs).toISOString().slice(0, 19)}Z`;
}

/**
 * The launch and finish times of each workhorse lane. A lane's implementation starts at its
 * first launch, or, in a run that had each lane write its own spec first, at its first resume
 * after the spec-only harvest. It ends when its process exits (the marker), which is earlier
 * than the coachman's harvest line, since the coachman logs the harvest when it has read the work.
 */
export function laneTimes(
  actions: readonly Action[],
  lanes: readonly string[],
  outcomes: Record<string, string>,
  finishedAt: (lane: string) => string | null = () => null,
): LaneTimes[] {
  return lanes.map((lane) => {
    const mine = (name: string): Action[] =>
      actions.filter((a) => a.actor === "coachman" && a.action === name && a.target === lane);
    const dispatches = mine("dispatch");
    const resumes = mine("resume");
    const all = mine("harvest");
    const planned = all.find((a) => /^planned\b/iu.test(a.detail));
    const harvests = all.filter((a) => !/^planned\b/iu.test(a.detail));
    const firstLaunch = dispatches[0]?.ts ?? null;
    const afterSpec = planned ? resumes.find((a) => a.ts >= planned.ts) : undefined;
    const implementFrom = planned ? (afterSpec?.ts ?? null) : firstLaunch;
    const harvested = harvests[harvests.length - 1]?.ts ?? null;
    const finished = finishedAt(lane);
    const end = finished ?? harvested;
    return {
      lane,
      specRound: planned !== undefined,
      firstLaunch,
      implementFrom,
      finished,
      harvested,
      implementSeconds: implementFrom && end ? secondsBetween(implementFrom, end) : null,
      outcome: outcomes[lane] ?? null,
      resumes: resumes.length,
    };
  });
}

/** The lane a gate ran on, from the branch name `wb/<ticket>-<lane>`; null for the synthesis. */
export const gateLane = (ref: string, lanes: readonly string[]): string | null => {
  const m = /^wb\/.+-([A-Za-z0-9]+)$/u.exec(ref);
  return m && lanes.includes(m[1] as string) ? (m[1] as string) : null;
};

const REPO_TARGET = /^[A-Za-z0-9_./-]+(?::[0-9]+(?:-[0-9]+)?)?$/u;

/** The usage records a run's launches left, one per launch. */
export function readUsage(dir: string): UsageLaunch[] {
  const logs = join(dir, "logs");
  if (!existsSync(logs)) return [];
  const out: UsageLaunch[] = [];
  for (const file of readdirSync(logs).sort()) {
    const name = parseUsageName(file);
    if (!name) continue;
    const row = readJson(join(logs, file));
    if (!isRecord(row)) continue;
    const num = (key: string): number | null =>
      typeof row[key] === "number" ? (row[key] as number) : null;
    out.push({
      file,
      role: name.role,
      lane: String(row.lane ?? ""),
      harness: String(row.harness ?? ""),
      lens: name.lens,
      round: name.round,
      inputTokens: num("input_tokens"),
      outputTokens: num("output_tokens"),
      costUsd: num("cost_usd"),
      readError: row.read_error !== undefined,
    });
  }
  return out;
}

/** The tool's own reader of a harness's usage: `readHarnessUsage` in `scripts/usage.ts`. */
export type UsageReader = (
  harness: string,
  events: string,
  session?: string,
) => { input_tokens?: number; output_tokens?: number; cost_usd?: number };

/**
 * The reader from a checkout of this repository, so the figures are the ones the tool itself
 * would record and no harness is read by code written here.
 */
export async function loadReader(tool: string): Promise<UsageReader> {
  const mod = (await import(join(tool, "scripts", "usage.ts"))) as {
    readHarnessUsage: UsageReader;
  };
  return mod.readHarnessUsage;
}

const figure = (value: unknown): number | null => (typeof value === "number" ? value : null);

/**
 * The coachman's tokens per thread, read from `sessions/coachman/<thread>.json`. A leg's
 * `*-usage.json` is written when that launch exits, so a leg resumed afterwards carries more
 * than its file says.
 */
export function readCoachman(dir: string, reader: UsageReader | null): CoachmanThread[] {
  const folder = join(dir, "sessions", "coachman");
  if (reader === null || !existsSync(folder)) return [];
  const manifest = readJson(join(dir, "manifest.json"));
  const legs = new Map<string, number>();
  const named =
    isRecord(manifest) && isRecord(manifest.coachman) && isRecord(manifest.coachman.legs)
      ? manifest.coachman.legs
      : {};
  for (const [leg, v] of Object.entries(named)) {
    if (isRecord(v) && typeof v.thread_id === "string")
      legs.set(`${v.thread_id}.json`, Number(leg));
  }
  return readdirSync(folder)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      const f = reader("muse", "", readText(join(folder, file)));
      return {
        leg: legs.get(file) ?? null,
        inputTokens: figure(f.input_tokens),
        outputTokens: figure(f.output_tokens),
      };
    });
}

/** A workhorse's or reviewer's tokens, read again from its events stream. */
export type StreamUsage = {
  role: "workhorse" | "reviewer";
  lane: string;
  harness: string;
  lens: string | null;
  round: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
};

/**
 * Every workhorse and reviewer events stream of a run, read with the tool's reader for the
 * harness its lane runs on. Runs before the tool recorded usage have no usage file at all, so this
 * is their only figure; for the others it checks the record.
 */
export function readStreams(
  dir: string,
  lanes: Record<string, LaneConfig>,
  reader: UsageReader | null,
): StreamUsage[] {
  const logs = join(dir, "logs");
  if (reader === null || !existsSync(logs)) return [];
  const laneOf = (name: string): string | null => {
    const base = name.replace(/-retry$/u, "");
    return base in lanes ? base : null;
  };
  const out: StreamUsage[] = [];
  for (const file of readdirSync(logs).sort()) {
    const review = /^review-r([0-9]+)-(style|bug|security)-([A-Za-z0-9._-]+)\.jsonl$/u.exec(file);
    const work = /^([A-Za-z0-9]+)-events\.jsonl$/u.exec(file);
    const lane = review ? laneOf(review[3] as string) : work ? laneOf(work[1] as string) : null;
    if (!lane) continue;
    const harness = (lanes[lane] as LaneConfig).harness;
    const f = reader(harness, readText(join(logs, file)));
    out.push({
      role: review ? "reviewer" : "workhorse",
      lane,
      harness,
      lens: review ? (review[2] as string) : null,
      round: review ? Number(review[1]) : null,
      inputTokens: figure(f.input_tokens),
      outputTokens: figure(f.output_tokens),
      costUsd: figure(f.cost_usd),
    });
  }
  return out;
}

/** The exit time of every reviewer launch that left a done marker. */
export function readReviewDone(dir: string): ReviewDone[] {
  const logs = join(dir, "logs");
  if (!existsSync(logs)) return [];
  const out: ReviewDone[] = [];
  for (const file of readdirSync(logs).sort()) {
    const m = /^review-r([0-9]+)-(style|bug|security)-([A-Za-z0-9._-]+)\.done$/u.exec(file);
    if (!m) continue;
    out.push({
      round: Number(m[1]),
      lens: m[2] as string,
      lane: m[3] as string,
      done: `${new Date(statSync(join(logs, file)).mtimeMs).toISOString().slice(0, 19)}Z`,
    });
  }
  return out;
}

const completeness = (s: Synthesis): number =>
  [
    s.ranked.length > 0,
    Object.keys(s.took).length > 0,
    s.ranked.length > 0 && s.ranked.every((lane) => lane in s.took),
    Object.keys(s.rejected).length > 0,
    s.basis !== "",
    s.oracleRaw !== "",
  ].filter(Boolean).length;

/**
 * The SYNTHESIS line. A run log, a `synthesize` action or a note that corrects an earlier line
 * may each carry it; the most complete reading wins, and the earliest of equals.
 */
export function findSynthesis(
  runLog: string,
  actions: readonly Action[],
  lanes: readonly string[],
): { synthesis: Synthesis | null; at: string | null } {
  const texts = [
    ...runLog.split("\n").filter((line) => line.includes("ranked=")),
    ...actions
      .filter(
        (a) =>
          ["synthesize", "note"].includes(a.action) &&
          `${a.target} ${a.detail}`.includes("ranked="),
      )
      .map((a) => `${a.target} ${a.detail}`),
  ];
  const parsed = texts.flatMap((t) => {
    const s = parseSynthesis(t, lanes);
    return s ? [s] : [];
  });
  const synthesis = parsed.reduce<Synthesis | null>(
    (best, s) => (best === null || completeness(s) > completeness(best) ? s : best),
    null,
  );
  const first = actions.find((a) => a.action === "synthesize");
  return { synthesis, at: first?.ts ?? null };
}

const sharesFromJson = (dir: string): Record<string, KindShare> | null => {
  const json = readJson(join(dir, "shares.json"));
  if (!isRecord(json) || !isRecord(json.kinds)) return null;
  const out: Record<string, KindShare> = {};
  for (const [kind, value] of Object.entries(json.kinds)) {
    if (!isRecord(value)) continue;
    const lanes: Record<string, number> = {};
    for (const l of Array.isArray(value.laneOnly) ? value.laneOnly : []) {
      if (isRecord(l) && typeof l.name === "string" && typeof l.runs === "number") {
        lanes[l.name] = l.runs;
      }
    }
    const runs = (b: unknown): number => (isRecord(b) && typeof b.runs === "number" ? b.runs : 0);
    out[kind] = {
      runs: typeof value.totalRuns === "number" ? value.totalRuns : 0,
      lanes,
      shared: runs(value.shared),
      neither: runs(value.neither),
    };
  }
  return Object.keys(out).length === 0 ? null : out;
};

/** One run's row, from the files of its dispatch directory. */
export function readRun(
  source: RunSource,
  window: { since: string; until: string },
  reader: UsageReader | null = null,
): RunRecord {
  const dir = source.dir;
  const { actions, bad } = parseActions(readText(join(dir, "actions.jsonl")));
  const manifest = readJson(join(dir, "manifest.json"));
  const manifestLanes = isRecord(manifest) && isRecord(manifest.lanes) ? manifest.lanes : {};
  const laneOutcomes: Record<string, string> = {};
  for (const [lane, v] of Object.entries(manifestLanes)) {
    if (isRecord(v) && typeof v.outcome === "string") laneOutcomes[lane] = v.outcome;
  }
  const team = readTeam(dir);
  const workhorses = team?.workhorses.length ? team.workhorses : Object.keys(laneOutcomes);
  const reviewerLanes = [
    ...new Set([...(team?.reviewers ?? []), ...Object.values(team?.lensReviewers ?? {}).flat()]),
  ];
  const known = [...new Set([...workhorses, ...reviewerLanes, "coachman", "opus", "sol"])];
  const runLog = readText(join(dir, "run-log.md"));
  const { synthesis, at } = findSynthesis(runLog, actions, known);
  const shares = parseShares(runLog) ?? sharesFromJson(dir);

  const gates: Gate[] = actions
    .filter((a) => a.action === "verify")
    .flatMap((a) => {
      const v = parseVerify(a.target, a.detail);
      return v ? [{ ...v, ts: a.ts, lane: gateLane(v.ref, workhorses) }] : [];
    });

  const reviewLaunches: ReviewLaunch[] = actions
    .filter((a) => a.action === "review-launch")
    .map((a) => ({ ts: a.ts, lane: safeLane(a.target), ...parseReviewRef(a.detail) }));
  const reviewHarvests: ReviewHarvestRow[] = actions
    .filter((a) => a.action === "review-harvest")
    .map((a) => {
      const h = parseReviewHarvest(a.detail);
      return {
        ts: a.ts,
        lane: safeLane(a.target),
        lens: h.lens,
        round: h.round,
        verdict: h.verdict,
        raw: h.raw,
      };
    });
  const findings: FindingRow[] = actions
    .filter((a) => a.action === "finding")
    .map((a) => {
      const f = parseFinding(a.detail, known);
      return {
        ts: a.ts,
        target: REPO_TARGET.test(a.target) ? a.target : null,
        class: f.class,
        severity: f.severity,
        round: f.round,
        lanes: f.lanes,
        lenses: f.lenses,
        pairs: f.pairs,
        dismissed: f.dismissed,
        verified: f.verified,
      };
    });
  const incidents: IncidentCandidate[] = actions.flatMap((a) => {
    const kinds = incidentCandidates(a);
    return kinds.length === 0
      ? []
      : [
          {
            ts: a.ts,
            actor: a.actor,
            action: a.action,
            kinds,
            text: scrub(`${a.target} | ${a.detail}`),
          },
        ];
  });

  return {
    id: source.id,
    kind: source.kind,
    layout: source.layout,
    ticket: source.ticket,
    parked: source.id.includes("-parked-"),
    first: actions[0]?.ts ?? "",
    last: actions[actions.length - 1]?.ts ?? "",
    actions: actions.length,
    badLines: bad,
    actionsInWindow: actions.filter((a) => inWindow(a.ts, window.since, window.until)).length,
    stage: isRecord(manifest) && typeof manifest.stage === "string" ? manifest.stage : null,
    legs: isRecord(manifest) && typeof manifest.leg === "number" ? manifest.leg : null,
    team,
    laneOutcomes,
    stages: stageSpans(actions),
    synthesis,
    synthesisAt: at,
    shares,
    lanes: laneTimes(actions, workhorses, laneOutcomes, (lane) => doneTime(dir, lane)),
    gates,
    reviewLaunches,
    reviewHarvests,
    reviewDone: readReviewDone(dir),
    reviewReport: parseReviewReport(readText(join(dir, "checkpoint-review.md"))),
    degrades: actions
      .filter((a) => a.action === "degrade")
      .map((a) => ({ ts: a.ts, lane: safeLane(a.target), text: scrub(a.detail) })),
    findings,
    applies: actions.filter((a) => a.action === "apply").length,
    escalations: actions.filter((a) => a.action === "escalate").length,
    usage: readUsage(dir),
    coachman: readCoachman(dir, reader),
    streams: readStreams(dir, team?.lanes ?? {}, reader),
    incidents,
  };
}
