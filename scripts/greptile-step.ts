// The Greptile step: a Greptile review of a run's final change, once, after the model reviewers'
// loop and before the ship card, and the gate that keeps the card back until the review has passed
// or the user has said what happens next. Everything particular to Greptile is in its adapter
// (scripts/greptile.ts); this script starts it the way a round starts a reviewer, waits on it with
// the round's time limit, and records what came of it.
//
//   run greptile-step run <dispatch> <repo> <synthesis-wt>
//   run greptile-step escalate <dispatch>
//   run greptile-step gate <dispatch>
//   run greptile-step card-line <dispatch>
//
// run reviews the commit the synthesis worktree is at, which must hold everything the run changed,
// from the base the manifest names. It cuts a clone of the project on a branch at that commit
// (`cut-scratch --cut-workhorse`), starts the adapter in it through `run host run` as a reviewer
// would be, with its own logs/greptile-r<N>.jsonl, .err and .done, and waits for the marker for
// review.round_timeout_seconds. N is the step's round, one more than the highest round any review
// has had. Its lines in the action log are written by this script (scripts/lib/greptile-record.ts):
// a review-launch when it begins, a review-finish when the launch has ended, and then one of a
// review-harvest saying how many findings the review reported, or a degrade saying why it was
// missed. A review still running at the time limit is stopped, as a reviewer is. The scratch is
// torn down whatever came of the step. No model lane is resolved for any of it.
//
// There are three outcomes. PASSED: Greptile reported no finding. FAILED: it reported findings,
// any of them, whatever its severity; logs/greptile-r<N>-findings.json holds them in the record
// review-findings writes, and ESCALATION.md is written with each finding's severity, file and line,
// Greptile's words and a line, `Coachman's assessment: pending`, for the coachman to fill in. MISSED:
// anything but a finished review, or a finished one that left a file out unexpectedly (a file that
// looks like a secret, a file Greptile says it could not review), or one that has no result because
// the step was interrupted; ESCALATION.md is written with the cause, the escalation is made ready
// at once and nothing is retried, since a missed review is most often a sign-in, credit or setup
// fault that a retry cannot fix. The coachman fixes nothing and starts no round on its own: the
// user's word comes back as a resume and is logged as a `rule` line for greptile whose detail opens
// with try-again or review-again, which ask for another step, or go-on, fix or rule-out, which
// settle this one. A second step runs only after one of the first two, never on its own.
//
// run is safe to run again. A step that has no result is picked up where it was, never started a
// second time: its marker is collected, or its wait goes on for what is left of its limit. A step
// that has a result is reported again, not repeated. A harness that cuts a command short
// therefore costs nothing but the call.
//
// escalate, for a review that reported findings, checks that the coachman has replaced every
// `pending` in ESCALATION.md with its assessment, touches .escalation-ready and logs the
// escalation. The coachman's assessment is shown beside each finding and clears none.
//
// gate exits 0 when the ship card may be written: the waybill names no Greptile review, the latest
// step reported no finding, or the user has said what happens next after the latest step. It exits
// 1 while the waybill names greptile and no step has run, or the latest step missed, reported
// findings or has no result, and the user has not settled it. card-line prints the one line for
// Greptile that the ship card's Turnpikes section carries: how often it reviewed, at what head, its
// result, and the changed files the project's own ignore rules held back, which it names.
//
//   run      exit 0  PASSED, which a run again with no word for another review reports again
//            exit 2  FAILED, likewise
//            exit 3  MISSED, likewise
//            exit 1  usage, a waybill that names no greptile, a tree that is not committed, or a
//                    record that could not be written
//   escalate exit 0  the escalation is ready
//            exit 1  usage, no findings to escalate, a step the user has settled already, or an
//                    assessment still pending
//   gate     exit 0  clear
//            exit 1  held, one line saying why
//   card-line exit 0  the line
//            exit 1  held, as the gate
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { BRANCH, findingsPath, leftOutPath } from "./greptile.ts";
import { bootId, sameBoot } from "./lib/processes.ts";
import { scriptsDir } from "./lib/paths.ts";
import { run } from "./lib/proc.ts";
import { pyWords } from "./lib/text.ts";
import {
  askedAgain,
  decisionOf,
  gateVerdict,
  LENS,
  nextRound,
  parseRows,
  type Row,
  settled,
  settlingWord,
  type Step,
  stepsOf,
} from "./lib/greptile-record.ts";
import {
  DEFAULT_LIMIT,
  manifestBase,
  MAX_LIMIT,
  monotonic,
  roundTimeLimit,
  scratchPath,
} from "./review-round.ts";
import { renderEscalation } from "./review-survey.ts";
import { uncommittedFiles } from "./verify.ts";
import { countdown, sleepMs } from "./wait-for-markers.ts";

const ENTRY = join(scriptsDir(import.meta), "run");
const USAGE =
  "usage: run greptile-step run <dispatch> <repo> <synthesis-wt> | escalate <dispatch> | gate <dispatch> | card-line <dispatch>";
const ASSESSMENT = "Coachman's assessment:";
const PENDING = "pending";

interface Child {
  code: number;
  out: string;
  err: string;
}

const tool = (name: string, args: string[]): Child => {
  const r = run(ENTRY, [name, ...args]);
  return { code: r.code, out: r.out, err: r.err };
};

function fail(message: string): never {
  console.error(`greptile-step: ${message}`);
  process.exit(1);
}

const firstLine = (text: string): string =>
  text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l !== "") ?? "";

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

// --- the files of a step -------------------------------------------------------------------------

const prefixOf = (dispatch: string, round: number): string =>
  join(dispatch, "logs", `greptile-r${round}`);
const doneOf = (dispatch: string, round: number): string => `${prefixOf(dispatch, round)}.done`;
const statePath = (dispatch: string, round: number): string => `${prefixOf(dispatch, round)}.json`;

/** What a step recorded when it began: the commit it reviews, from where, and when it must end. */
interface State {
  round: number;
  head: string;
  base: string;
  boot: string;
  limit: number;
  deadline: number;
  started: string;
}

function readState(dispatch: string, round: number): State | null {
  try {
    const state = JSON.parse(readFileSync(statePath(dispatch, round), "utf8")) as State;
    return state.round === round && typeof state.deadline === "number" ? state : null;
  } catch {
    return null;
  }
}

/** The records the run's action log holds, or a fault: a log that cannot be read is no log. */
function rowsOf(dispatch: string): Row[] {
  let text: string;
  try {
    text = readFileSync(join(dispatch, "actions.jsonl"), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    return fail(`cannot read the action log: ${String(e)}`);
  }
  const parsed = parseRows(text);
  if ("fault" in parsed) return fail(parsed.fault);
  return parsed.rows;
}

function record(dispatch: string, verb: string, target: string, detail: string): void {
  const r = tool("log-action", [dispatch, "coachman", verb, target, detail]);
  if (r.code !== 0) fail(`the ${verb} line was not recorded: ${firstLine(r.err || r.out)}`);
}

/** A line of the run's narrative; one that does not take is said, never fatal. */
function note(dispatch: string, text: string): void {
  if (tool("run-log", [dispatch, text]).code !== 0) {
    console.error(`greptile-step: run-log.md did not take: ${text}`);
  }
}

/** The turnpikes of the run's review leg, or why they cannot be read. */
function reviewTurnpikes(dispatch: string): { names: string[] } | { fault: string } {
  const legs = tool("turnpikes", ["legs", dispatch]);
  if (legs.code !== 0) {
    return { fault: `the run's legs cannot be read: ${firstLine(legs.out || legs.err)}` };
  }
  const review = legs.out
    .split("\n")
    .map((l) => l.trim().split(/[ \t]+/u))
    .find((fields) => fields[1] === "review");
  return { names: review ? review.slice(2) : [] };
}

// --- what is said about a step -------------------------------------------------------------------

/** The changed files the project's ignore rules held back in a step's review, or none. */
function leftOutOf(dispatch: string, round: number): string[] {
  try {
    return readFileSync(leftOutPath(prefixOf(dispatch, round)), "utf8")
      .split("\n")
      .filter((path) => path !== "");
  } catch {
    return [];
  }
}

interface FoundFinding {
  file: string;
  line: number;
  line_end: number | string;
  severity: string;
  summary: string;
  body: string;
}

function findingsOf(dispatch: string, round: number): FoundFinding[] | null {
  try {
    const parsed: unknown = JSON.parse(
      readFileSync(findingsPath(prefixOf(dispatch, round)), "utf8"),
    );
    return Array.isArray(parsed) ? (parsed as FoundFinding[]) : null;
  } catch {
    return null;
  }
}

const placeOf = (f: FoundFinding): string =>
  typeof f.line_end === "number" && f.line_end > f.line
    ? `${f.file}:${f.line}-${f.line_end}`
    : `${f.file}:${f.line}`;

const quoted = (text: string): string =>
  text
    .split("\n")
    .map((line) => (line === "" ? ">" : `> ${line}`))
    .join("\n");

const leftOutLine = (files: string[]): string =>
  `Left out by the project's own ignore rules, as it chose: ${files.join(", ")}.`;

/** ESCALATION.md for a review that reported findings. Each finding carries a line for the
 * coachman's assessment that says `pending` until the coachman has written it. */
export function findingsEscalation(a: {
  round: number;
  head: string;
  findings: FoundFinding[];
  leftOut: string[];
}): string {
  const n = a.findings.length;
  const residue = [
    `Greptile reviewed the run's final change once, at ${a.head.slice(0, 12)}, and reported ${plural(n, "finding", "findings")}. Its review does not pass when it reports any finding, whatever the severity, and the coachman's assessment beside each finding clears none. Nothing is fixed and no review round has started. Greptile's report is in logs/greptile-r${a.round}.jsonl and the findings are in logs/greptile-r${a.round}-findings.json.`,
    ...(a.leftOut.length > 0 ? ["", leftOutLine(a.leftOut)] : []),
    ...a.findings.flatMap((f, i) => [
      "",
      `greptile-${i + 1}: ${placeOf(f)}`,
      `Greptile's severity: ${f.severity}`,
      "Greptile's words:",
      quoted(f.body === "not provided" ? f.summary : f.body),
      `${ASSESSMENT} ${PENDING}`,
    ]),
  ].join("\n");
  const options = [
    "- Fix: say which findings to fix. The coachman fixes those and no others, and lists each as applied on your word, not re-reviewed.",
    "- Rule out: say which findings to rule out and why. Each is listed as dismissed, with your reason.",
    "- Go on: the ship card is written with the findings left open, as they stand.",
    "- Review again: say so, and Greptile reviews the change once more, which costs credits, or the model reviewers run another round.",
  ].join("\n");
  const advice =
    "Read the coachman's assessment beside each finding first. A finding it says does not hold can be ruled out; one that holds is worth fixing before the pull request goes to the team. Nothing is retried or reviewed again without your word.";
  return renderEscalation(
    a.round,
    decisionOf(a.round, { kind: "reviewed", findings: n }).line,
    { reason: "this stop is the Greptile review of the final change, which no survey covers" },
    { residue, options, advice },
  );
}

/** ESCALATION.md for a review that was missed. */
export function missEscalation(a: { round: number; head: string; cause: string }): string {
  const residue = [
    `Greptile did not review the run's final change${a.head === "" ? "" : ` at ${a.head.slice(0, 12)}`}: ${a.cause}`,
    "",
    `Greptile's own output is in logs/greptile-r${a.round}.jsonl and logs/greptile-r${a.round}.err. No ship card is written until Greptile passes or you say what happens next. Nothing was retried, since a missed review is most often a sign-in, credit or setup fault that a retry cannot fix.`,
  ].join("\n");
  const options = [
    "- Try again: Greptile reviews once more, once the cause is dealt with. A review costs credits.",
    "- Go on without Greptile: the ship card is written without a Greptile review, and says so.",
  ].join("\n");
  const advice =
    "Deal with the cause on this machine first, then say try again. If the pull request's own Greptile review is enough, say go on.";
  return renderEscalation(
    a.round,
    decisionOf(a.round, { kind: "missed", cause: a.cause }).line,
    { reason: "this stop is the Greptile review of the final change, which no survey covers" },
    { residue, options, advice },
  );
}

/** The ship card's one line for Greptile, or why the card is held. */
export function cardLineOf(a: {
  rows: Row[];
  head: string;
  leftOut: string[];
}): { line: string } | { held: string } {
  const steps = stepsOf(a.rows);
  const latest = steps.at(-1);
  if (latest === undefined) return { held: "no Greptile step has run" };
  const reviews = steps.filter((s) => s.outcome.kind === "reviewed").length;
  const times = reviews === 1 ? "once" : reviews === 2 ? "twice" : `${reviews} times`;
  const word = settlingWord(a.rows, latest);
  const outside =
    a.leftOut.length > 0
      ? ` Left out by the project's own ignore rules: ${a.leftOut.join(", ")}.`
      : "";
  const { outcome } = latest;
  if (outcome.kind === "reviewed" && outcome.findings === 0) {
    return {
      line: `greptile: reviewed ${times}, the last at ${a.head.slice(0, 12)}, no findings.${outside}`,
    };
  }
  if (word === null) return { held: gateVerdict(a.rows, true).why };
  if (outcome.kind === "reviewed") {
    return {
      line: `greptile: reviewed ${times}, the last at ${a.head.slice(0, 12)}, ${plural(outcome.findings, "finding", "findings")} that the user settled (${word}); the Open findings and Not re-reviewed sections give their states.${outside}`,
    };
  }
  return {
    line: `greptile: DEGRADED, ${outcome.kind === "missed" ? outcome.cause : "no result"}; the user said to go on without a Greptile review.`,
  };
}

// --- the outcomes --------------------------------------------------------------------------------

function printVerdict(dispatch: string, step: Step, head: string): number {
  const { outcome, round } = step;
  const short = head === "" ? "an unknown commit" : head.slice(0, 12);
  if (outcome.kind === "reviewed") {
    const found = findingsOf(dispatch, round) ?? [];
    const leftOut = leftOutOf(dispatch, round);
    const where = leftOut.length > 0 ? [leftOutLine(leftOut)] : [];
    if (outcome.findings === 0) {
      console.log(`PASSED greptile round ${round}: reviewed at ${short}, no finding`);
      for (const line of where) console.log(line);
      return 0;
    }
    console.log(
      `FAILED greptile round ${round}: ${plural(outcome.findings, "finding", "findings")} at ${short}. ESCALATION.md holds them with a line for your assessment of each; replace pending, then run greptile-step escalate. Fix nothing and start no round.`,
    );
    found.forEach((f, i) => {
      console.log(`greptile-${i + 1} [${f.severity}] ${placeOf(f)}: ${f.summary}`);
    });
    for (const line of where) console.log(line);
    return 2;
  }
  const cause = outcome.kind === "missed" ? outcome.cause : "the step has no result";
  console.log(
    `MISSED greptile round ${round}: ${cause}. ESCALATION.md is written and the escalation is ready; end the leg here. Nothing is retried.`,
  );
  return 3;
}

/** The step's cause, where the adapter left it: the last `greptile: missed:` line of its stderr. */
function causeOf(dispatch: string, round: number): string {
  let lines: string[] = [];
  try {
    lines = readFileSync(`${prefixOf(dispatch, round)}.err`, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "");
  } catch {
    lines = [];
  }
  const said = lines.findLast((l) => l.startsWith("greptile: missed: "));
  if (said !== undefined) return said.slice("greptile: missed: ".length);
  return lines.at(-1) ?? "the adapter ended without a review or a cause";
}

// What the scratch's teardown said: printed after the verdict, which is the first line out.
const afterwards: string[] = [];

/** Tear down the step's scratch: stop what runs in it, close its panes, remove it. */
function tearDown(a: { dispatch: string; repo: string }, round: number): void {
  const r = tool("review-round", [
    "teardown",
    a.dispatch,
    String(round),
    a.repo,
    `${LENS}:${LENS}`,
  ]);
  for (const line of (r.out + r.err).split("\n")) if (line.trim() !== "") afterwards.push(line);
}

/** A missed review: say why in the log, write the escalation and make it ready. */
function missed(
  a: { dispatch: string; repo: string },
  round: number,
  head: string,
  cause: string,
): number {
  const text = pyWords(cause).join(" ");
  record(a.dispatch, "degrade", LENS, `greptile r${round}: ${text}`);
  note(a.dispatch, `greptile round ${round}: DEGRADED, ${text}`);
  tearDown(a, round);
  writeEscalation(a.dispatch, missEscalation({ round, head, cause: text }), round, true);
  return printVerdict(a.dispatch, { round, at: 0, outcome: { kind: "missed", cause: text } }, head);
}

function writeEscalation(dispatch: string, text: string, round: number, ready: boolean): void {
  try {
    writeFileSync(join(dispatch, "ESCALATION.md"), text);
    if (ready) writeFileSync(join(dispatch, ".escalation-ready"), "");
  } catch (e) {
    fail(`cannot write ESCALATION.md: ${String(e)}`);
  }
  if (ready) {
    record(dispatch, "escalate", "ESCALATION.md", `greptile round ${round}: the review was missed`);
  }
}

/** What the adapter left once its marker is in: finish the step. */
function collect(a: { dispatch: string; repo: string }, round: number, head: string): number {
  if (!stepsOfFinish(a.dispatch, round)) {
    record(a.dispatch, "review-finish", LENS, `greptile round ${round}`);
  }
  const found = findingsOf(a.dispatch, round);
  if (found === null) {
    return missed(a, round, head, causeOf(a.dispatch, round));
  }
  tearDown(a, round);
  const leftOut = leftOutOf(a.dispatch, round);
  if (found.length > 0) {
    // The escalation first, so a step that is cut short here is finished by the next run.
    writeEscalation(
      a.dispatch,
      findingsEscalation({ round, head, findings: found, leftOut }),
      round,
      false,
    );
  }
  record(
    a.dispatch,
    "review-harvest",
    LENS,
    `greptile round ${round} reported ${plural(found.length, "finding", "findings")}`,
  );
  note(
    a.dispatch,
    `greptile round ${round}: reviewed at ${head.slice(0, 12)}, ${plural(found.length, "finding", "findings")}`,
  );
  return printVerdict(
    a.dispatch,
    { round, at: 0, outcome: { kind: "reviewed", findings: found.length } },
    head,
  );
}

/** Whether the log already holds the step's review-finish line. */
function stepsOfFinish(dispatch: string, round: number): boolean {
  return rowsOf(dispatch).some(
    (row) =>
      row.action === "review-finish" &&
      row.target === LENS &&
      row.detail.trim() === `greptile round ${round}`,
  );
}

/** Wait for the step's marker for what is left of its limit; on the limit, stop what runs. */
function waitAndCollect(
  a: { dispatch: string; repo: string },
  round: number,
  state: State,
): number {
  const done = doneOf(a.dispatch, round);
  const left = Math.max(0, Math.ceil(state.deadline - monotonic()));
  const got = countdown(() => (existsSync(done) ? 1 : 0), 1, left, sleepMs, 1);
  if (got === "present") return collect(a, round, state.head);
  const scratch = scratchPath(a.repo, basename(a.dispatch), LENS, LENS);
  const stop = tool("host", ["stop", scratch]);
  const cause =
    stop.code === 0
      ? `timeout after ${state.limit}s`
      : `timeout after ${state.limit}s, and it could not be stopped: ${firstLine(stop.out || stop.err)}`;
  return missed(a, round, state.head, cause);
}

// --- run -----------------------------------------------------------------------------------------

interface Args {
  dispatch: string;
  repo: string;
  synthesis: string;
}

/** A step that began and has no result: pick it up where it was, or call it missed. */
function attach(a: Args, step: Step): number {
  const state = readState(a.dispatch, step.round);
  if (state === null) {
    return missed(
      a,
      step.round,
      "",
      "the step began and left no record of its wait, so it cannot be picked up",
    );
  }
  const boot = bootId();
  if (state.boot !== "" && boot !== "" && !sameBoot(state.boot, boot)) {
    return missed(
      a,
      step.round,
      state.head,
      "the machine restarted since the step began, so its review is gone",
    );
  }
  return waitAndCollect(a, step.round, state);
}

/** The commit to review: the one the synthesis worktree is at, which must hold all the run changed. */
function headToReview(a: Args): string {
  const status = run("git", ["-C", a.synthesis, "status", "--porcelain", "--untracked-files=all"]);
  if (status.code !== 0) fail(`cannot read the synthesis worktree status at ${a.synthesis}`);
  const dirt = uncommittedFiles(status.out);
  if (dirt.length > 0) {
    const listed =
      dirt.slice(0, 10).join(", ") + (dirt.length > 10 ? ` and ${dirt.length - 10} more` : "");
    fail(
      `${a.synthesis} has files git sees that its commit does not hold, so Greptile would review less than the run changed: ${listed}`,
    );
  }
  const head = run("git", ["-C", a.synthesis, "rev-parse", "HEAD"]);
  if (head.code !== 0 || head.out.trim() === "") fail(`no commit at ${a.synthesis}`);
  return head.out.trim();
}

/** Begin a step: cut its scratch, start the adapter in it, and wait for it. */
function begin(a: Args, rows: Row[]): number {
  const head = headToReview(a);
  const base = manifestBase(a.dispatch);
  if (base === "") return fail("manifest.json gives no base");
  let files: string[] = [];
  try {
    files = readdirSync(join(a.dispatch, "logs"));
  } catch {
    files = [];
  }
  const round = nextRound(rows, files);
  const timed = roundTimeLimit(join(a.dispatch, "run.json"), DEFAULT_LIMIT, MAX_LIMIT);
  if (timed.notice !== null) console.error(timed.notice);
  const prefix = prefixOf(a.dispatch, round);
  mkdirSync(join(a.dispatch, "logs"), { recursive: true });
  for (const suffix of [".jsonl", ".err", ".done", ".json", "-findings.json", "-left-out.txt"]) {
    rmSync(`${prefix}${suffix}`, { force: true });
  }
  tool("run-log", [a.dispatch, "--section", `greptile step, round ${round}`]);
  record(a.dispatch, "review-launch", LENS, `greptile round ${round}`);

  const scratch = scratchPath(a.repo, basename(a.dispatch), LENS, LENS);
  if (existsSync(scratch)) tearDown(a, round);
  if (existsSync(scratch)) {
    return missed(
      a,
      round,
      head,
      `a scratch left by an earlier step could not be removed: ${scratch}`,
    );
  }
  const cut = tool("cut-scratch", ["--cut-workhorse", a.repo, scratch, head, BRANCH]);
  if (cut.code !== 0) {
    return missed(
      a,
      round,
      head,
      `the review's scratch could not be cut: ${firstLine(cut.err || cut.out)}`,
    );
  }
  const ready = tool("cut-scratch", ["--check-workhorse", a.repo, scratch, head, BRANCH]);
  if (ready.code !== 0) {
    return missed(
      a,
      round,
      head,
      `the review's scratch is not ready: ${firstLine(ready.err || ready.out)}`,
    );
  }
  const named = tool("host", ["name", a.dispatch, "role", `greptile review r${round}`]);
  if (named.code !== 0 || named.out.trim() === "") {
    return missed(a, round, head, `no name for the launch: ${firstLine(named.err || named.out)}`);
  }
  const state: State = {
    round,
    head,
    base,
    boot: bootId(),
    limit: timed.limit,
    deadline: monotonic() + timed.limit,
    started: new Date().toISOString().replace(/\.[0-9]+Z$/u, "Z"),
  };
  writeFileSync(statePath(a.dispatch, round), `${JSON.stringify(state, null, 2)}\n`);
  const started = tool("host", [
    "run",
    named.out.trim(),
    scratch,
    "--under",
    a.dispatch,
    "--role",
    "reviewer",
    "--run",
    a.dispatch,
    "--out",
    `${prefix}.jsonl`,
    "--err",
    `${prefix}.err`,
    "--marker",
    doneOf(a.dispatch, round),
    "--",
    ENTRY,
    "greptile",
    "review",
    a.repo,
    scratch,
    base,
    prefix,
  ]);
  if (started.code !== 0) {
    return missed(
      a,
      round,
      head,
      `the review did not start: ${firstLine(started.err || started.out)}`,
    );
  }
  note(
    a.dispatch,
    `greptile round ${round}: launched at ${head.slice(0, 12)} from ${base.slice(0, 12)}, time limit ${timed.limit}s (${timed.source})`,
  );
  return waitAndCollect(a, round, state);
}

/** A step cut short between its record and its escalation leaves the escalation unwritten: write
 * it, from the record, where ESCALATION.md is not this step's. */
function raiseAgain(a: Args, step: Step, head: string): void {
  const { outcome, round } = step;
  if (outcome.kind === "unfinished") return;
  let text = "";
  try {
    text = readFileSync(join(a.dispatch, "ESCALATION.md"), "utf8");
  } catch {
    text = "";
  }
  if (outcome.kind === "missed") {
    if (text.includes(`Decision: RULING ${round}: the Greptile review was missed`)) return;
    writeEscalation(a.dispatch, missEscalation({ round, head, cause: outcome.cause }), round, true);
    return;
  }
  if (outcome.findings === 0 || text.includes(`Decision: RULING ${round}: the Greptile review`)) {
    return;
  }
  writeEscalation(
    a.dispatch,
    findingsEscalation({
      round,
      head,
      findings: findingsOf(a.dispatch, round) ?? [],
      leftOut: leftOutOf(a.dispatch, round),
    }),
    round,
    false,
  );
}

function runCmd(a: Args): number {
  const turnpikes = reviewTurnpikes(a.dispatch);
  if ("fault" in turnpikes) return fail(turnpikes.fault);
  if (!turnpikes.names.includes(LENS)) {
    return fail(
      "the waybill names no greptile among its review turnpikes, so there is no step to run",
    );
  }
  const rows = rowsOf(a.dispatch);
  const latest = stepsOf(rows).at(-1);
  if (latest !== undefined) {
    if (latest.outcome.kind === "unfinished") return attach(a, latest);
    if (!askedAgain(rows, latest)) {
      // The recorded outcome again; a second review is the user's word alone.
      const head = readState(a.dispatch, latest.round)?.head ?? "";
      raiseAgain(a, latest, head);
      const again = printVerdict(a.dispatch, latest, head);
      console.error(
        "greptile-step: this is the step's recorded result; a second Greptile review runs only on the user's word, logged as a rule line for greptile that opens try-again or review-again",
      );
      return again;
    }
  }
  return begin(a, rows);
}

// --- escalate, gate, card-line -------------------------------------------------------------------

/** The findings of ESCALATION.md whose assessment line still says pending. */
export function pendingIds(text: string): string[] {
  const out: string[] = [];
  let id = "";
  for (const line of text.split("\n")) {
    const found = /^(greptile-[0-9]+): /u.exec(line);
    if (found) id = found[1] ?? "";
    else if (line.startsWith(ASSESSMENT)) {
      const rest = line.slice(ASSESSMENT.length).trim();
      if (rest === "" || rest === PENDING) out.push(id);
    }
  }
  return out;
}

function escalateCmd(dispatch: string): number {
  const rows = rowsOf(dispatch);
  const latest = stepsOf(rows).at(-1);
  if (latest === undefined || latest.outcome.kind !== "reviewed" || latest.outcome.findings === 0) {
    return fail("the latest Greptile step reported no finding, so there is nothing to escalate");
  }
  if (settled(rows, latest)) {
    return fail(
      `the user has already said what happens next after the Greptile step of round ${latest.round}, so there is nothing to escalate`,
    );
  }
  const path = join(dispatch, "ESCALATION.md");
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return fail("there is no ESCALATION.md: run greptile-step run first");
  }
  if (!text.includes(`Decision: RULING ${latest.round}: the Greptile review`)) {
    return fail(`ESCALATION.md is not the Greptile step's of round ${latest.round}`);
  }
  const pending = pendingIds(text);
  if (pending.length > 0) {
    return fail(`the coachman's assessment is still pending for ${pending.join(", ")}`);
  }
  try {
    writeFileSync(join(dispatch, ".escalation-ready"), "");
  } catch (e) {
    return fail(`cannot write .escalation-ready: ${String(e)}`);
  }
  record(
    dispatch,
    "escalate",
    "ESCALATION.md",
    `greptile round ${latest.round}: ${plural(latest.outcome.findings, "finding", "findings")}`,
  );
  console.log(path);
  return 0;
}

function gateCmd(dispatch: string): number {
  const turnpikes = reviewTurnpikes(dispatch);
  if ("fault" in turnpikes) {
    console.log(`held: ${turnpikes.fault}`);
    return 1;
  }
  const verdict = gateVerdict(rowsOf(dispatch), turnpikes.names.includes(LENS));
  console.log(`${verdict.clear ? "clear" : "held"}: ${verdict.why}`);
  return verdict.clear ? 0 : 1;
}

function cardLineCmd(dispatch: string): number {
  const rows = rowsOf(dispatch);
  const reviewed = stepsOf(rows).findLast((step) => step.outcome.kind === "reviewed");
  const head = reviewed === undefined ? "" : (readState(dispatch, reviewed.round)?.head ?? "");
  const leftOut = reviewed === undefined ? [] : leftOutOf(dispatch, reviewed.round);
  const got = cardLineOf({ rows, head, leftOut });
  if ("held" in got) {
    console.log(`held: ${got.held}`);
    return 1;
  }
  console.log(got.line);
  return 0;
}

// --- entry ---------------------------------------------------------------------------------------

function directory(path: string, what: string): string {
  try {
    return realpathSync(path);
  } catch {
    return fail(`no such ${what}: ${path}`);
  }
}

if (import.meta.main) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "run" && rest.length === 3 && rest.every((r) => r !== "")) {
    const dispatch = directory(rest[0] ?? "", "dispatch directory");
    const repo = directory(rest[1] ?? "", "repo");
    const synthesis = directory(rest[2] ?? "", "synthesis worktree");
    if (run("git", ["-C", repo, "rev-parse", "--git-dir"]).code !== 0) {
      fail(`not a git repository: ${repo}`);
    }
    const code = runCmd({ dispatch, repo, synthesis });
    for (const line of afterwards) console.log(line);
    process.exit(code);
  }
  if ((cmd === "escalate" || cmd === "gate" || cmd === "card-line") && rest.length === 1) {
    const dispatch = directory(rest[0] ?? "", "dispatch directory");
    if (cmd === "escalate") process.exit(escalateCmd(dispatch));
    if (cmd === "gate") process.exit(gateCmd(dispatch));
    process.exit(cardLineCmd(dispatch));
  }
  console.error(USAGE);
  process.exit(1);
}
