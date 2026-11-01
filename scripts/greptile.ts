// The adapter for Greptile, an outside code review service. Everything particular to it is here: how
// it starts, what it reports and how it fails. No model lane is spent on it, and it knows nothing of
// a run's steps: whatever runs it names the project, the checkout, the commit to review since and
// the prefix of the files it writes.
//
//   run greptile review <repo> <checkout> <base> <prefix>
//
// It runs `greptile review --json -b <base>` in <checkout>: the committed change since <base>,
// reviewed by the project's own Greptile rules, which Greptile gathers from the checkout itself, so
// the adapter passes no instructions. <repo> is the project: its settings name the effort, as
// `greptile_level`: `plus` and `apex` add the flag of that name, `base` and none add nothing. Greptile's
// usage reports, its daily update check and its diagram download are off, and no Greptile key is
// passed on: Greptile is signed in once on the machine, and run host removes GREPTILE_API_KEY from
// every launch.
//
// Greptile refuses a detached HEAD, and finds the repository from the web address of the remote of
// the checked-out branch, then of origin, then of the only remote. The checkout is a clone of its own
// whose origin is the project folder (`cut-scratch`, which `cut-scratch --kind` and `--remove` read),
// so the adapter puts a detached checkout on a branch and gives the branch a remote of its own that
// holds the origin URL of <repo>, leaving origin alone. Where that address is a folder, Greptile
// cannot identify the repository and the review misses.
//
// A review is reviewed when the adapter exits 0 and leaves <prefix>-findings.json: one record per
// comment, in the record review-findings writes, with Greptile's severity as the proposed one and
// greptile as the source. A report with no comments is an empty list, and still a finished review.
// Beside it, <prefix>-left-out.txt names, one path to a line, the changed files the project's own
// ignore rules hold back: Greptile skips those without a word, so they are no miss, and the ship
// card names them.
//
// Anything else is a missed review, however it ended: Greptile not on PATH, signed out or not allowed
// the feature, a review it could not finish, output that is no report, and any warning line but the
// one about binary files, since a warning is Greptile saying it left a file out (a file that looks
// like a secret, a file it could not review) and a warning this adapter does not know stops the run
// rather than passing. A miss exits 1, leaves neither file, and ends its stderr with one line,
// `greptile: missed: <cause>`: Greptile's own error or warning line where it printed one, else the
// cause. Greptile's own output is passed through, stdout and stderr.
//
// Greptile signs in through https://auth.greptile.com and reviews through https://api.greptile.com:
// where a machine limits network hosts, allow both.
//
//   exit 0  reviewed
//   exit 1  missed
//   exit 2  usage
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { isInstalled } from "./lib/config-check.ts";
import { greptileLevelOf, isDie } from "./lib/effective-config.ts";
import { mkstempSync, run, type RunResult } from "./lib/proc.ts";
import { pyWords } from "./lib/text.ts";
import { type Finding, isObj, isReportError, normalizeItem } from "./review-findings.ts";

const USAGE = "usage: run greptile review <repo> <checkout> <base> <prefix>";
const BRANCH = "greptile-review";
const REMOTE = "project-origin";
const ENV: Record<string, string | undefined> = {
  GREPTILE_TELEMETRY_DISABLED: "1",
  GREPTILE_NO_UPDATE_CHECK: "1",
  GREPTILE_NO_AUTO_INSTALL: "1",
  // Never passed on, whatever the caller holds: the sign-in Greptile stored is the one it uses.
  GREPTILE_API_KEY: undefined,
};

/** The file a finished review leaves its findings in, for a prefix. */
export const findingsPath = (prefix: string): string => `${prefix}-findings.json`;

/** The file that names the changed files the project's ignore rules hold back, for a prefix. */
export const leftOutPath = (prefix: string): string => `${prefix}-left-out.txt`;

/** Greptile's arguments for a review since <base> at a project's level (base, plus or apex). */
export const reviewArgs = (base: string, level: string): string[] => [
  "review",
  "--json",
  "-b",
  base,
  ...(level === "base" ? [] : [`--${level}`]),
];

const lineOf = (text: string): string => pyWords(text).join(" ");

/** The lines Greptile printed, trimmed and without the empty ones, stderr before stdout. */
function linesOf(res: Pick<RunResult, "out" | "err">): string[] {
  return `${res.err}\n${res.out}`
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** Greptile's own error line: the first line it marked error or notice, else the first it printed
 * that is no warning, else the exit. */
export function errorLine(res: Pick<RunResult, "code" | "out" | "err">): string {
  const lines = linesOf(res).filter((line) => !/^warning:/iu.test(line));
  return (
    lines.find((line) => /^(error|notice):/iu.test(line)) ??
    lines[0] ??
    `greptile exited ${res.code} with no message`
  );
}

// The one warning that leaves nothing out of the review: a binary file has no text to review.
const BINARY_WARNING = /^warning: [0-9]+ binary files? not included in the review/iu;

/** The warning lines of a finished review that leave a file out, or one this adapter does not
 * know: every warning but the one about binary files. */
export function warningsOf(res: Pick<RunResult, "out" | "err">): string[] {
  return linesOf(res).filter((line) => /^warning:/iu.test(line) && !BINARY_WARNING.test(line));
}

/** A Greptile comment as the record's reader takes it: the first line of its body is the summary,
 * its suggestion rides in the body, and a comment on the removed side of the diff says so. */
function itemOf(comment: unknown): unknown {
  if (!isObj(comment)) return comment;
  const body = typeof comment.body === "string" ? comment.body : "";
  const parts = [
    body,
    comment.suggestion ? `Suggested change:\n${String(comment.suggestion)}` : "",
    comment.side === "old"
      ? "Greptile put this on the removed side of the diff: the line is the base's."
      : "",
  ];
  return {
    path: comment.path,
    startLine: comment.startLine,
    endLine: comment.endLine,
    severity: comment.severity ?? "P2",
    summary: body.split("\n")[0],
    body: parts.filter((part) => part !== "").join("\n\n"),
    evidence: comment.verifiedEvidence,
    category: [comment.category, comment.securityIssue === true ? "security issue" : ""]
      .filter((word) => typeof word === "string" && word !== "")
      .join(", "),
  };
}

export type Outcome = { findings: Finding[] } | { miss: string };

/** What a finished `greptile review --json` came to: the findings of a readable report from an exit
 * 0 that printed no warning but the one about binary files, else the reason it missed. */
export function outcomeOf(res: Pick<RunResult, "code" | "out" | "err">, checkout: string): Outcome {
  if (res.code !== 0) return { miss: errorLine(res) };
  let report: unknown = null;
  try {
    report = JSON.parse(res.out);
  } catch {
    // not JSON: no report
  }
  if (!isObj(report) || !Array.isArray(report.comments)) {
    return { miss: "greptile exited 0 but printed no readable report" };
  }
  let findings: Finding[];
  try {
    findings = report.comments.map((comment) =>
      normalizeItem(itemOf(comment), "greptile", checkout),
    );
  } catch (e) {
    if (isReportError(e)) return { miss: `greptile's report could not be read: ${e.message}` };
    throw e;
  }
  const warnings = warningsOf(res);
  if (warnings.length > 0) return { miss: warnings.join("; ") };
  return { findings };
}

/** The changed files, since <base>, that the project's own ignore rules hold back: the committed
 * files `git check-ignore --no-index` matches, which Greptile skips without a word. A file the
 * change deletes is no file at the head, so it is not asked. */
export function heldBack(checkout: string, base: string): { files: string[] } | { miss: string } {
  const diff = run("git", [
    "-C",
    checkout,
    "diff",
    "-z",
    "--name-only",
    "--no-renames",
    "--diff-filter=d",
    `${base}...HEAD`,
  ]);
  if (diff.code !== 0) {
    return { miss: `the changed files could not be listed: ${lineOf(diff.err)}` };
  }
  const changed = diff.out.split("\0").filter((path) => path !== "");
  if (changed.length === 0) return { files: [] };
  const ignored = run("git", ["-C", checkout, "check-ignore", "--no-index", "--stdin", "-z"], {
    input: `${changed.join("\0")}\0`,
  });
  // Exit 1 is no path matched; anything but 0 and 1 is git failing to read the rules.
  if (ignored.code !== 0 && ignored.code !== 1) {
    return { miss: `the project's ignore rules could not be read: ${lineOf(ignored.err)}` };
  }
  return { files: ignored.out.split("\0").filter((path) => path !== "") };
}

/** Put the checkout where Greptile can find the repository: on a branch, whose remote holds the web
 * address of the project's origin. Null when it is ready, else why it could not be. */
function readyCheckout(repo: string, checkout: string): string | null {
  const origin = run("git", ["-C", repo, "remote", "get-url", "origin"]);
  if (origin.code !== 0) return "the project has no origin, which Greptile finds it by";
  const git = (...args: string[]) => run("git", ["-C", checkout, ...args]);
  const current = git("symbolic-ref", "-q", "--short", "HEAD");
  const branch = current.code === 0 ? current.out.trim() : BRANCH;
  const steps: string[][] = [
    ...(current.code === 0 ? [] : [["checkout", "-q", "-B", BRANCH]]),
    ["config", `remote.${REMOTE}.url`, origin.out.trim()],
    ["config", `branch.${branch}.remote`, REMOTE],
  ];
  for (const step of steps) {
    const done = git(...step);
    if (done.code !== 0) {
      return `the checkout could not be set up for Greptile: ${lineOf(done.err)}`;
    }
  }
  return null;
}

/** Write a file whole or not at all, so a file that is there is a file that is finished. */
function writeWhole(path: string, text: string): void {
  const temporary = mkstempSync(dirname(path), ".greptile-");
  writeFileSync(temporary, text);
  renameSync(temporary, path);
}

function review(repo: string, checkout: string, base: string, prefix: string): number {
  rmSync(findingsPath(prefix), { force: true });
  rmSync(leftOutPath(prefix), { force: true });
  const missed = (why: string): number => {
    console.error(`greptile: missed: ${lineOf(why)}`);
    return 1;
  };
  if (!isInstalled("greptile")) return missed("greptile is not installed: it is not on PATH");
  const setup = readyCheckout(repo, checkout);
  if (setup !== null) return missed(setup);
  let level: string;
  try {
    level = greptileLevelOf(repo);
  } catch (e) {
    if (isDie(e)) return missed(e.message);
    throw e;
  }
  const res = run("greptile", reviewArgs(base, level), { cwd: checkout, env: ENV });
  process.stdout.write(res.out);
  process.stderr.write(res.err);
  const outcome = outcomeOf(res, checkout);
  if ("miss" in outcome) return missed(outcome.miss);
  const held = heldBack(checkout, base);
  if ("miss" in held) return missed(held.miss);
  mkdirSync(dirname(prefix), { recursive: true });
  // The file that says the review is finished comes last.
  if (held.files.length > 0) writeWhole(leftOutPath(prefix), `${held.files.join("\n")}\n`);
  writeWhole(findingsPath(prefix), `${JSON.stringify(outcome.findings, null, 2)}\n`);
  return 0;
}

if (import.meta.main) {
  const [cmd, repo, checkout, base, prefix] = process.argv.slice(2);
  if (
    cmd !== "review" ||
    process.argv.length !== 7 ||
    !repo ||
    !checkout ||
    !base ||
    base.startsWith("-") ||
    !prefix
  ) {
    console.error(USAGE);
    process.exit(2);
  }
  process.exit(review(repo, checkout, base, prefix));
}
