// How a run's Greptile step shows in the run's action log, and what the log says about it. The step
// (scripts/greptile-step.ts), the gate before the ship card and the loop's decision
// (scripts/review-decide.ts) all read the step from these lines, so the reading is here once.
//
// A step is a Greptile review of the run's final change, numbered by its round: one more than the
// highest round any review has had, so that nothing the model reviewers logged in a round shares a
// number with it. Its lines, all written by the step through `run log-action`, the lens in the detail
// being greptile and the lane in the target being greptile as well:
//
//   review-launch  greptile  greptile round <N>                          the attempt began
//   review-finish  greptile  greptile round <N>                          the launch has ended
//   review-harvest greptile  greptile round <N> reported <K> findings    the review finished
//   degrade        greptile  greptile r<N>: <cause>                      the review was missed
//   rule           greptile  <word> <the user's words>                   the user's word
//
// A step with neither a harvest nor a degrade after its launch is unfinished. The user's words are
// try-again and review-again, which ask for another step, and go-on, fix and rule-out, which settle
// the latest one. A step the user has not settled holds the ship card back (`greptile-step gate`).

export const LENS = "greptile";

/** The words of the user's ruling that settle a step that missed or reported findings. */
export const SETTLING = ["go-on", "fix", "rule-out"] as const;

/** The words of the user's ruling that ask for another step. */
export const AGAIN = ["try-again", "review-again"] as const;

/** One action line, as much of it as the step's reading needs. */
export interface Row {
  action: string;
  target: string;
  detail: string;
}

export type Outcome =
  | { kind: "missed"; cause: string }
  | { kind: "reviewed"; findings: number }
  | { kind: "unfinished" };

export interface Step {
  round: number;
  /** The position in the log of the step's last line: the launch, then the outcome. */
  at: number;
  outcome: Outcome;
}

/** The rows of an actions.jsonl text, or what is wrong with the first line that is not an action. */
export function parseRows(text: string): { rows: Row[] } | { fault: string } {
  const rows: Row[] = [];
  const lines = text.split("\n");
  for (const [i, line] of lines.entries()) {
    if (line.trim() === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return { fault: `actions.jsonl line ${i + 1} is not JSON` };
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { fault: `actions.jsonl line ${i + 1} is not an action object` };
    }
    const row = parsed as Record<string, unknown>;
    if (typeof row.action !== "string" || row.action === "") {
      return { fault: `actions.jsonl line ${i + 1} has no action` };
    }
    rows.push({
      action: row.action,
      target: typeof row.target === "string" ? row.target : "",
      detail: typeof row.detail === "string" ? row.detail : "",
    });
  }
  return { rows };
}

const words = (text: string): string[] => text.split(/[ \t\r\n]+/u).filter((w) => w !== "");
const WHOLE = /^[1-9][0-9]*$/u;

/** The round a `review-launch`, `review-finish` or `review-harvest` detail names, `<lens> round <N>`
 * and whatever follows, for the lens given, else null. */
export function roundOf(detail: string, lens: string = LENS): number | null {
  const w = words(detail);
  if (w[0] !== lens || w[1] !== "round" || !WHOLE.test(w[2] ?? "")) return null;
  return Number(w[2]);
}

/** The round and cause of a Greptile `degrade` detail, `greptile r<N>: <cause>`, else null. */
export function missOf(detail: string): { round: number; cause: string } | null {
  const m = /^greptile r([1-9][0-9]*):[ \t]*(.*)$/su.exec(detail.trim());
  if (!m) return null;
  return { round: Number(m[1]), cause: (m[2] ?? "").trim() };
}

/** The round and the number of findings of a Greptile `review-harvest` detail, else null. */
export function harvestOf(detail: string): { round: number; findings: number } | null {
  const w = words(detail);
  const round = roundOf(detail);
  if (round === null || w[3] !== "reported" || !/^(0|[1-9][0-9]*)$/u.test(w[4] ?? "")) return null;
  if (w[5] !== "findings" && w[5] !== "finding") return null;
  return { round, findings: Number(w[4]) };
}

/** The word a Greptile `rule` row opens with, else null. */
export function ruleWord(row: Row): string | null {
  if (row.action !== "rule" || row.target !== LENS) return null;
  return words(row.detail)[0] ?? null;
}

/** Every Greptile step the log shows, the oldest round first. */
export function stepsOf(rows: readonly Row[]): Step[] {
  const steps = new Map<number, Step>();
  const touch = (round: number, at: number): Step => {
    const step = steps.get(round) ?? { round, at, outcome: { kind: "unfinished" } as Outcome };
    step.at = at;
    steps.set(round, step);
    return step;
  };
  rows.forEach((row, at) => {
    if (row.target !== LENS) return;
    if (row.action === "review-launch" || row.action === "review-finish") {
      const round = roundOf(row.detail);
      if (round !== null) touch(round, at);
    } else if (row.action === "degrade") {
      const miss = missOf(row.detail);
      if (miss !== null) touch(miss.round, at).outcome = { kind: "missed", cause: miss.cause };
    } else if (row.action === "review-harvest") {
      const harvest = harvestOf(row.detail);
      if (harvest !== null) {
        touch(harvest.round, at).outcome = { kind: "reviewed", findings: harvest.findings };
      }
    }
  });
  return [...steps.values()].sort((a, b) => a.round - b.round);
}

/** The words of the user's rulings on Greptile after a position in the log, in order. */
export function rulingsAfter(rows: readonly Row[], at: number): string[] {
  const out: string[] = [];
  rows.forEach((row, i) => {
    const word = i > at ? ruleWord(row) : null;
    if (word !== null) out.push(word);
  });
  return out;
}

/** Whether a step has what ends its wait: it missed, or it reported findings. A step that reported
 * none passed, and a step with no outcome has none. */
export const holdsCard = (step: Step): boolean =>
  step.outcome.kind === "missed" || (step.outcome.kind === "reviewed" && step.outcome.findings > 0);

/** Whether the user has asked for another step after this one's last line. The last word counts. */
export function askedAgain(rows: readonly Row[], step: Step): boolean {
  const last = rulingsAfter(rows, step.at).at(-1);
  return last !== undefined && (AGAIN as readonly string[]).includes(last);
}

/** The last word after this step's last line that settles it, else null. */
export function settlingWord(rows: readonly Row[], step: Step): string | null {
  const after = rulingsAfter(rows, step.at);
  const asked = after.findLastIndex((w) => (AGAIN as readonly string[]).includes(w));
  const at = after.findLastIndex((w) => (SETTLING as readonly string[]).includes(w));
  return at !== -1 && at > asked ? (after[at] ?? null) : null;
}

/** Whether the user has settled this step: some word after its last line settles it, and no later
 * word asks for another step. */
export function settled(rows: readonly Row[], step: Step): boolean {
  return settlingWord(rows, step) !== null;
}

/** What the gate before the ship card says: held while the waybill names Greptile and the latest
 * step missed or did not pass and the user has not settled it, or no step has run at all. */
export function gateVerdict(rows: readonly Row[], named: boolean): { clear: boolean; why: string } {
  if (!named) return { clear: true, why: "the waybill names no Greptile review" };
  const latest = stepsOf(rows).at(-1);
  if (latest === undefined) {
    return { clear: false, why: "the waybill names greptile and no Greptile step has run" };
  }
  const where = `the latest Greptile step (round ${latest.round})`;
  const { outcome } = latest;
  if (outcome.kind === "reviewed" && outcome.findings === 0) {
    return { clear: true, why: `${where} passed: it reported no finding` };
  }
  if (settled(rows, latest)) {
    return { clear: true, why: `${where} did not pass, and the user has said what happens next` };
  }
  if (outcome.kind === "missed") {
    return {
      clear: false,
      why: `${where} missed: ${outcome.cause}; no word from the user settles it`,
    };
  }
  if (outcome.kind === "reviewed") {
    return {
      clear: false,
      why: `${where} reported ${outcome.findings} ${outcome.findings === 1 ? "finding" : "findings"}; no word from the user settles it`,
    };
  }
  return { clear: false, why: `${where} has no result; no word from the user settles it` };
}

/** The step's own decision, as review-decide prints it for the step's round: a review that passed
 * ends the loop, and one that missed or reported anything is a ruling at once, with no retry of
 * its own. The step's findings are no part of the loop's count. */
export function decisionOf(
  round: number,
  outcome: Outcome,
): { first: "STOP" | "RULING"; cause: string; line: string } {
  if (outcome.kind === "reviewed" && outcome.findings === 0) {
    return {
      first: "STOP",
      cause: "greptile-clean",
      line: `STOP ${round}: the Greptile review reported no finding in round ${round}`,
    };
  }
  if (outcome.kind === "reviewed") {
    const n = outcome.findings;
    return {
      first: "RULING",
      cause: "greptile-findings",
      line: `RULING ${round}: the Greptile review reported ${n} ${n === 1 ? "finding" : "findings"} in round ${round}; escalate with residue`,
    };
  }
  return {
    first: "RULING",
    cause: "greptile-missed",
    line: `RULING ${round}: the Greptile review was missed in round ${round}; escalate with residue`,
  };
}

/** One more than the highest review round the log or the round files show, or 1 where none has been
 * launched: the number of the step's round. `fileNames` are the names in the run's logs folder. */
export function nextRound(rows: readonly Row[], fileNames: readonly string[]): number {
  let highest = 0;
  for (const row of rows) {
    if (row.action !== "review-launch") continue;
    const w = words(row.detail);
    if (w[1] === "round" && WHOLE.test(w[2] ?? "")) highest = Math.max(highest, Number(w[2]));
  }
  for (const name of fileNames) {
    const m = /^review-r([1-9][0-9]*)\.json$/u.exec(name);
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return highest + 1;
}
