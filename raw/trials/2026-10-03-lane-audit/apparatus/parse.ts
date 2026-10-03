// The lane audit's parsers (see ../method.md): pure functions over the text of a run's own
// records, with no file read and no clock. `records.ts` reads the files and calls these.
//
// A record that does not parse is counted and reported by the caller, never guessed at.

export type Action = {
  ts: string;
  run: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
};

/** The lanes this window's runs used, and the coachman, which a finding may name as its source. */
export const KNOWN_LANES = ["luna", "mimo", "sol", "astra", "opus", "coachman"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** The rows of an `actions.jsonl`: blank lines are skipped, a line that is not an action is counted. */
export function parseActions(source: string): { actions: Action[]; bad: number } {
  const actions: Action[] = [];
  let bad = 0;
  for (const line of source.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const row: unknown = JSON.parse(line);
      if (!isRecord(row) || text(row.ts) === "" || text(row.action) === "") {
        bad += 1;
        continue;
      }
      actions.push({
        ts: text(row.ts),
        run: text(row.run),
        actor: text(row.actor),
        action: text(row.action),
        target: text(row.target),
        detail: text(row.detail),
      });
    } catch {
      bad += 1;
    }
  }
  return { actions, bad };
}

/** Seconds from `from` to `to`, both ISO timestamps. */
export const secondsBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / 1000);

/** Whether `ts` falls in [since, until]. */
export const inWindow = (ts: string, since: string, until: string): boolean => {
  const t = Date.parse(ts);
  return t >= Date.parse(since) && t <= Date.parse(until);
};

export type StageSpan = { stage: string; at: string; seconds: number | null };

/**
 * Each stage and how long the run stayed in it, from the `stage` lines, as `run-times.ts` reads
 * them: a stage ends at the next one, the first stage `dispatched` starts at the postmaster's
 * dispatch line, and the last stage has no span.
 */
export function stageSpans(actions: readonly Action[]): StageSpan[] {
  const points: Array<{ stage: string; at: string }> = [];
  const dispatch = actions.find((a) => a.actor === "postmaster" && a.action === "dispatch");
  const stages = actions.filter((a) => a.action === "stage");
  const first = stages[0];
  if (dispatch && first && Date.parse(dispatch.ts) <= Date.parse(first.ts)) {
    points.push({ stage: "dispatched", at: dispatch.ts });
  }
  for (const s of stages) points.push({ stage: s.target, at: s.ts });
  return points.map((p, i) => {
    const next = points[i + 1];
    return { ...p, seconds: next ? secondsBetween(p.at, next.at) : null };
  });
}

export type Oracle = Record<
  string,
  { raw: string; passed: boolean; counts: [number, number] | null }
>;

export type Synthesis = {
  ranked: string[];
  took: Record<string, string>;
  rejected: Record<string, string>;
  basis: string;
  /** null where the line says `none`: no blind tests for that ticket */
  oracle: Oracle | null;
  oracleRaw: string;
};

const SYNTHESIS_KEYS = ["ranked", "took", "rejected", "basis", "oracle"] as const;

/** `lane:text` entries joined by `;`, as the SYNTHESIS line writes `took=` and `rejected=`. */
export function splitByLane(value: string, lanes: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const alternation = lanes.join("|");
  const marks = [...value.matchAll(new RegExp(`(?:^|[;,][ ]*)(${alternation}):`, "gu"))];
  marks.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const next = marks[i + 1];
    const end = next ? (next.index ?? value.length) : value.length;
    const lane = m[1] as string;
    out[lane] = [out[lane], value.slice(start, end).trim()].filter(Boolean).join("; ");
  });
  return out;
}

/** `luna:pass,mimo:12/14` to each lane's result; `none…` is no oracle. */
export function parseOracle(value: string): Oracle | null {
  const head = value.split(" | ")[0]?.replace(/\([^)]*\)/gu, "") ?? "";
  if (/^[ ]*none/u.test(head)) return null;
  const out: Oracle = {};
  for (const m of head.matchAll(/([a-z]+):(pass|fail|[0-9]+\/[0-9]+)/gu)) {
    const lane = m[1] as string;
    const raw = m[2] as string;
    const counts = /^([0-9]+)\/([0-9]+)$/u.exec(raw);
    out[lane] = counts
      ? {
          raw,
          passed: counts[1] === counts[2],
          counts: [Number(counts[1]), Number(counts[2])],
        }
      : { raw, passed: raw === "pass", counts: null };
  }
  return Object.keys(out).length === 0 ? null : out;
}

/**
 * The SYNTHESIS line's fields, read from the first `ranked=` in `source`; null where there is
 * none. The coachman wrote the line after `SYNTHESIS:` in a run log, as a `synthesize` action's
 * target or detail, or in a note correcting an earlier line, so the prefix is not required.
 */
export function parseSynthesis(
  source: string,
  lanes: readonly string[] = KNOWN_LANES,
): Synthesis | null {
  const at = source.indexOf("ranked=");
  if (at < 0) return null;
  const body = source.slice(at).split("\n")[0] ?? "";
  const marks = [...body.matchAll(new RegExp(`(?:^|[ ])(${SYNTHESIS_KEYS.join("|")})=`, "gu"))];
  if (marks.length === 0) return null;
  const fields: Record<string, string> = {};
  marks.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const next = marks[i + 1];
    const key = m[1] as string;
    if (fields[key] === undefined) {
      fields[key] = body.slice(start, next ? (next.index ?? body.length) : body.length).trim();
    }
  });
  const oracleRaw = fields.oracle ?? "";
  return {
    ranked: (fields.ranked ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    took: splitByLane(fields.took ?? "", lanes),
    rejected: splitByLane(fields.rejected ?? "", lanes),
    basis: fields.basis ?? "",
    oracle: parseOracle(oracleRaw),
    oracleRaw,
  };
}

export type KindShare = {
  runs: number;
  /** each lane's runs of six words found in no other lane's diff */
  lanes: Record<string, number>;
  shared: number;
  neither: number;
};

/** `SHARES: code runs=4236 lane:astra=0/4236 … | docs runs=203 …` to each kind's counts. */
export function parseShares(source: string): Record<string, KindShare> | null {
  const at = source.indexOf("SHARES:");
  if (at < 0) return null;
  const body = (source.slice(at + "SHARES:".length).split("\n")[0] ?? "").trim();
  const out: Record<string, KindShare> = {};
  for (const part of body.split("|")) {
    const kind = /^[ ]*([a-z]+)[ ]+runs=([0-9]+)/u.exec(part);
    if (!kind) continue;
    const lanes: Record<string, number> = {};
    for (const m of part.matchAll(/lane:([A-Za-z0-9._-]+)=([0-9]+)\/[0-9]+/gu)) {
      lanes[m[1] as string] = Number(m[2]);
    }
    const count = (name: string): number => {
      const m = new RegExp(`${name}=([0-9]+)/[0-9]+`, "u").exec(part);
      return m ? Number(m[1]) : 0;
    };
    out[kind[1] as string] = {
      runs: Number(kind[2]),
      lanes,
      shared: count("shared"),
      neither: count("neither"),
    };
  }
  return Object.keys(out).length === 0 ? null : out;
}

export type FindingLine = {
  class: "gating" | "style" | null;
  severity: "P1" | "P2" | "P3" | null;
  round: number | null;
  /** the reviewer lanes the line names as its source, in order, without repeats */
  lanes: string[];
  lenses: string[];
  /** lens and lane together, where the line pairs them without ambiguity; else null */
  pairs: Array<[string, string]> | null;
  dismissed: boolean;
  /** how the coachman says it verified the finding */
  verified: "execution" | "reading" | null;
};

const LENSES = ["style", "bug", "security"] as const;

/**
 * A `finding` action's class, severity, round and sources. The coachman wrote these lines in
 * several shapes over the window (`bug/mimo`, `bug luna mimo`, `bug-astra,style-astra`,
 * `bug+luna`, `lens bug lanes luna,mimo`), so the sources are read as the run of lens and lane
 * words that follows the round, which ends at the first other word.
 */
export function parseFinding(detail: string, lanes: readonly string[] = KNOWN_LANES): FindingLine {
  const cls = /\b(gating|style)\b/u.exec(detail.slice(0, 40));
  const severity = /\b(P[123])\b/u.exec(detail);
  const round = /(?:\b|[ ])(?:r|round[ -]?)([0-9]+)\b/u.exec(detail);
  const afterRound = round ? detail.slice((round.index ?? 0) + round[0].length) : detail;
  const words = afterRound.match(/[A-Za-z0-9]+|[^A-Za-z0-9]/gu) ?? [];
  const lensSet = new Set<string>(LENSES);
  const laneSet = new Set<string>(lanes);
  const fillers = new Set(["lens", "lanes", "lane", "and"]);
  const tokens: Array<{ kind: "lens" | "lane"; word: string }> = [];
  for (const w of words) {
    if (/^[^A-Za-z0-9]$/u.test(w)) {
      // A colon ends the sources after a lane (`bug-astra:summary`), and joins a lens to its
      // lane before one (`bug:mimo`).
      if (w === ":" && tokens[tokens.length - 1]?.kind === "lane") break;
      if (w === ";" || w === "(" || w === "." || w === "|") break;
      continue;
    }
    if (lensSet.has(w)) tokens.push({ kind: "lens", word: w });
    else if (laneSet.has(w)) tokens.push({ kind: "lane", word: w });
    else if (!fillers.has(w)) break;
  }
  if (!tokens.some((t) => t.kind === "lane")) {
    // Some lines end with their sources instead: `…; luna mimo`.
    const tail = detail.slice(Math.max(detail.lastIndexOf(";"), detail.lastIndexOf(":")) + 1);
    const tailWords = tail.match(/[A-Za-z0-9]+/gu) ?? [];
    const allowed = tailWords.every((w) => lensSet.has(w) || laneSet.has(w) || fillers.has(w));
    if (allowed && tailWords.some((w) => laneSet.has(w))) {
      tokens.length = 0;
      for (const w of tailWords) {
        if (lensSet.has(w)) tokens.push({ kind: "lens", word: w });
        else if (laneSet.has(w)) tokens.push({ kind: "lane", word: w });
      }
    }
  }
  if (!tokens.some((t) => t.kind === "lane")) {
    // The coachman's own findings: `gating P1 card-withheld coachman: …`.
    const head = detail.slice(0, Math.max(detail.indexOf(":"), 0));
    if (laneSet.has("coachman") && /\bcoachman\b/u.test(head)) {
      tokens.push({ kind: "lane", word: "coachman" });
    }
  }
  const distinct = (kind: "lens" | "lane"): string[] => [
    ...new Set(tokens.filter((t) => t.kind === kind).map((t) => t.word)),
  ];
  // Pairs are unambiguous when every lens token is followed by at least one lane token before
  // the next lens token ("bug luna mimo style sol mimo"), or when each lens-lane pair is joined.
  const pairs: Array<[string, string]> = [];
  let ambiguous = false;
  let lens: string | null = null;
  let lensRun = 0;
  for (const t of tokens) {
    if (t.kind === "lens") {
      lensRun = lens === null || pairs.length > 0 ? 1 : lensRun + 1;
      if (lensRun > 1) ambiguous = true;
      lens = t.word;
    } else if (lens !== null) {
      pairs.push([lens, t.word]);
      lensRun = 0;
    }
  }
  const lastToken = tokens[tokens.length - 1];
  if (lastToken?.kind === "lens") ambiguous = true;
  const by = /verified[ -]by[ -](execution|reading)/u.exec(detail);
  const head = detail.slice(0, Math.max(detail.indexOf(":", 20), 80));
  const bare = /\b(execution|reading)\b/u.exec(head);
  const verified = (by?.[1] ?? bare?.[1] ?? null) as "execution" | "reading" | null;
  return {
    class: cls ? (cls[1] as "gating" | "style") : null,
    severity: severity ? (severity[1] as "P1" | "P2" | "P3") : null,
    round: round ? Number(round[1]) : null,
    lanes: distinct("lane"),
    lenses: distinct("lens"),
    pairs: ambiguous || pairs.length === 0 ? null : pairs,
    dismissed: /\bDISMISSED\b/u.test(detail),
    verified,
  };
}

export type Verify = {
  name: string;
  ref: string;
  sha: string;
  result: string;
  exit: number;
  seconds: number;
};

/** A `verify` action: `on=wb/200-mimo@d835e95feaaa result=pass exit=0 secs=850`. */
export function parseVerify(name: string, detail: string): Verify | null {
  const m =
    /on=([^@ ]+)@([0-9a-f]+)[ ]+result=([a-z-]+(?: [a-z]+)?)[ ]+exit=([0-9]+)[ ]+secs=([0-9]+)/u.exec(
      detail,
    );
  if (!m) return null;
  return {
    name,
    ref: m[1] as string,
    sha: m[2] as string,
    result: m[3] as string,
    exit: Number(m[4]),
    seconds: Number(m[5]),
  };
}

export type ReviewHarvest = {
  lens: string | null;
  round: number | null;
  verdict: "reviewed" | "degraded" | "unstated";
  /** findings the harvest line counts, where it counts them; 0 for CLEAN */
  raw: number | null;
};

/** The lens and round a `review-launch` or `review-harvest` detail names. */
export function parseReviewRef(detail: string): { lens: string | null; round: number | null } {
  const m = /\b(style|bug|security)[ ,]+(?:round[ -]?|r)([0-9]+)\b/u.exec(detail);
  return m ? { lens: m[1] as string, round: Number(m[2]) } : { lens: null, round: null };
}

/** A `review-harvest` line: which lens and round, whether the lane gave a verdict, how many findings. */
export function parseReviewHarvest(detail: string): ReviewHarvest {
  const ref = parseReviewRef(detail);
  const verdict = /\bDEGRADED\b/u.test(detail)
    ? "degraded"
    : /\b(REVIEWED|CLEAN)\b/u.test(detail)
      ? "reviewed"
      : "unstated";
  const stated = /\b([0-9]+)[ ]+findings?\b/u.exec(detail);
  const labelled = [...detail.matchAll(/\b([0-9]+)[ ]?(?:P[123]|medium|low|high)\b/gu)];
  const raw = stated
    ? Number(stated[1])
    : labelled.length > 0
      ? labelled.reduce((sum, m) => sum + Number(m[1]), 0)
      : /\bCLEAN\b/u.test(detail)
        ? 0
        : null;
  return { ...ref, verdict, raw };
}

export type UsageName = {
  role: "workhorse" | "reviewer" | "coachman";
  lens: string | null;
  round: number | null;
};

/** What a `logs/*-usage.json` file name says about the launch it records. */
export function parseUsageName(file: string): UsageName | null {
  const review = /^review-r([0-9]+)-(style|bug|security)-.+-usage\.json$/u.exec(file);
  if (review) return { role: "reviewer", lens: review[2] as string, round: Number(review[1]) };
  if (/^coachman-.*-usage\.json$/u.test(file)) return { role: "coachman", lens: null, round: null };
  if (file.endsWith("-usage.json")) return { role: "workhorse", lens: null, round: null };
  return null;
}

export type Cost = {
  role: string;
  lane: string;
  harness: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  /** launches the line counts, where it says `N of M launches` */
  coverage: string | null;
};

/** The lines `usage.ts sum` prints, one per role and lane, read back for the control. */
export function parseCostLines(source: string): Cost[] {
  const out: Cost[] = [];
  for (const line of source.split("\n")) {
    const m =
      /^cost: (workhorse|reviewer|coachman) ([^ ]+) \(([^)]*)\): (.*?) in, (.*?) out, (.*)$/u.exec(
        line.trim(),
      );
    if (!m) continue;
    const num = (s: string): number | null => {
      const n = /^([0-9]+)/u.exec(s);
      return n ? Number(n[1]) : null;
    };
    const money = /^\$([0-9.]+)/u.exec(m[6] as string);
    const cover = /\(([0-9]+ of [0-9]+ launches)\)/u.exec(line);
    out.push({
      role: m[1] as string,
      lane: m[2] as string,
      harness: m[3] as string,
      inputTokens: num(m[4] as string),
      outputTokens: num(m[5] as string),
      costUsd: money ? Number(money[1]) : null,
      coverage: cover ? (cover[1] as string) : null,
    });
  }
  return out;
}

export type IncidentKind =
  | "wall"
  | "auth"
  | "overload"
  | "kill"
  | "duplicate-launch"
  | "degraded"
  | "stalled";

const INCIDENT_PATTERNS: Array<{ kind: IncidentKind; pattern: RegExp }> = [
  { kind: "wall", pattern: /usage limit|walled|\bwall(?:ed)? on\b|rate limit/iu },
  { kind: "auth", pattern: /token_revoked|log in again|\b401\b/iu },
  { kind: "overload", pattern: /\b529\b|overloaded/iu },
  {
    kind: "kill",
    pattern:
      /memory[- ]cap kill|MemoryMax|out of memory|\bOOM\b|\bkilled\b|killed by|SIGKILL|machine reset/iu,
  },
  { kind: "duplicate-launch", pattern: /duplicate launch/iu },
];

/**
 * Candidate incidents in one action: the kinds whose words its text holds. A candidate is read
 * by a person before it is counted; the patterns only keep that reading to the lines that could
 * matter. A `degrade` action is always a candidate.
 */
export function incidentCandidates(
  a: Pick<Action, "action" | "target" | "detail">,
): IncidentKind[] {
  const hay = `${a.target} ${a.detail}`;
  const kinds = INCIDENT_PATTERNS.filter((p) => p.pattern.test(hay)).map((p) => p.kind);
  if (a.action === "degrade" && !kinds.includes("degraded")) kinds.push("degraded");
  return kinds;
}

export type ReviewEntry = {
  severity: "P1" | "P2" | "P3";
  lens: string;
  status: "closed" | "open" | "dismissed";
};

/**
 * The finding list of a `checkpoint-review.md`: `- [P2] bug-3: closed round 1`, `open` or
 * `dismissed: <reason>`, one line per finding the coachman judged. Only the newest runs write
 * this list; the older cards say the same in prose, which is not read.
 */
export function parseReviewReport(text: string): ReviewEntry[] {
  const out: ReviewEntry[] = [];
  for (const m of text.matchAll(
    /^- \[(P[123])\] (style|bug|security)-[0-9]+: (closed round [0-9]+|open|dismissed)/gmu,
  )) {
    out.push({
      severity: m[1] as "P1" | "P2" | "P3",
      lens: m[2] as string,
      status: (m[3] as string).startsWith("closed") ? "closed" : (m[3] as "open" | "dismissed"),
    });
  }
  return out;
}
