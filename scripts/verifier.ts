// Make a verifier for one surface of a project: one model session, in a worktree of its
// own, writes the verifier and proves it once before handing it over (#323). Land what a
// session made only when the project's own checks pass with it in place (#325).
//
//   run verifier prompt <repo> <surface>
//   run verifier make <repo> <surface> --run <dispatch> [--timeout <seconds>]
//   run verifier check <repo> <branch> --run <dispatch> --handover <file>
//     [--folder <dir>] [--timeout <seconds>]
//   run verifier land <repo> <branch> --run <dispatch> --handover <file>
//     [--folder <dir>] [--timeout <seconds>] [--landing <local|pull-request>]
//
//   surface    cli | web | library: the surface the verifier covers
//   prompt     print the session's instructions for the repo and surface
//   make       cut a worktree on a branch of its own beside the repo, removed again
//              when make fails before any session starts, render the prompt,
//              launch the coachman role headless through run launch under run host, wait,
//              fall back to coachman_fallback on a provider wall read from the session
//              stream, stop the session at the limit by the pid host recorded, and log
//              one dispatch action per launch
//   check      decide whether the branch lands: its proven verifiers pass the project's
//              checks on a scratch, its diff touches only the verifiers' folder, and
//              every failed verifier's folder is absent. Prints one accept: or refuse:
//              line and logs the same line
//   land       check, then land an accepted branch once: local merges with git merge
//              --no-ff under the merge authority from the run, pull-request pushes and
//              opens one pull request, never merging. Prints the verdict plus one
//              merge:, waiting:, pull-request: or error: line, each logged as printed
//   --handover the session's HANDOVER.md, with one ## Verifier: section per verifier
//              carrying a Folder: line and a Proof: line (the proof file's absolute
//              path alone, or none with the reason). Proven means the file exists
//   --folder   the verifiers' folder, relative to the repo top (default verify-<slug>)
//   --landing  local or pull-request (default pull-request with an origin remote)
//   --timeout  seconds to wait for the session (make), or to run the project's checks
//              for (check, land); past it the branch lands nothing (default 3600 each,
//              at most 9 digits)
//
//   exit 0  prompt printed; make: the session ended with no wall and HANDOVER.md present;
//           check: the branch lands; land: merged, or the pull request waits for the word
//   exit 1  make failed: the launch would not start, the session was still running at the
//           limit, both roles walled, the handover, commit or verifier is missing, or the
//           action was not logged; check, land: the branch lands nothing, or the landing
//           failed after it was accepted
//   exit 2  usage: an unknown command or surface, a missing argument, a bad timeout, a path
//           that is not a git repository or not its top, a repo holding no commit, no
//           run at the dispatch, or a branch that is not a verifier branch
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { endingWallMessage, isWallMessage } from "./launch.ts";
import { beside, scriptsDir } from "./lib/paths.ts";
import { run } from "./lib/proc.ts";
import { RESULT_RE } from "./verify.ts";

const USAGE = `usage: run verifier prompt <repo> <surface>
       run verifier make <repo> <surface> --run <dispatch> [--timeout <seconds>]
       run verifier check <repo> <branch> --run <dispatch> --handover <file>
         [--folder <dir>] [--timeout <seconds>]
       run verifier land <repo> <branch> --run <dispatch> --handover <file>
         [--folder <dir>] [--timeout <seconds>] [--landing <local|pull-request>]

       surface is cli, web or library; landing is local or pull-request`;

const RUN = beside(import.meta, "run");
const DEFAULT_TIMEOUT = 3600;

export const SURFACES = ["cli", "web", "library"] as const;
export type Surface = (typeof SURFACES)[number];

const PROSE: Record<Surface, string> = {
  cli: "command line",
  web: "web pages",
  library: "library interface",
};

export function isSurface(s: string): s is Surface {
  return (SURFACES as readonly string[]).includes(s);
}

/** The prose name the instructions call the surface. Throws on an unknown surface. */
export function surfaceProse(surface: string): string {
  if (!isSurface(surface)) throw new Error(`unknown surface: ${surface}`);
  return PROSE[surface];
}

export interface ParsedPrompt {
  cmd: "prompt";
  repo: string;
  surface: Surface;
}

export interface ParsedMake {
  cmd: "make";
  repo: string;
  surface: Surface;
  dispatch: string;
  timeout: number;
}

export interface ParsedCheck {
  cmd: "check";
  repo: string;
  branch: string;
  dispatch: string;
  handover: string;
  folder: string | null;
  timeout: number;
}

export interface ParsedLand {
  cmd: "land";
  repo: string;
  branch: string;
  dispatch: string;
  handover: string;
  folder: string | null;
  timeout: number;
  landing: string | null;
}

export type Parsed =
  | { ok: true; req: ParsedPrompt | ParsedMake | ParsedCheck | ParsedLand }
  | { ok: false; error: string };

function parseTimeoutText(
  value: string | undefined,
): { ok: true; timeout: number } | { ok: false; error: string } {
  if (value === undefined || !/^[0-9]{1,9}$/u.test(value) || Number(value) <= 0) {
    return { ok: false, error: `bad timeout: ${value ?? "none"}` };
  }
  return { ok: true, timeout: Number(value) };
}

export function parseArgs(argv: string[]): Parsed {
  const cmd = argv[0];
  if (cmd === undefined) return { ok: false, error: "no command" };
  if (cmd !== "prompt" && cmd !== "make" && cmd !== "check" && cmd !== "land") {
    return { ok: false, error: `unknown command: ${cmd}` };
  }
  const repo = argv[1];
  const second = argv[2];
  if (cmd === "prompt" || cmd === "make") {
    if (repo === undefined || second === undefined) {
      return { ok: false, error: `${cmd} takes a repo and a surface` };
    }
    if (!isSurface(second)) {
      return { ok: false, error: `unknown surface: ${second} (cli, web or library)` };
    }
  } else if (repo === undefined || second === undefined) {
    return { ok: false, error: `${cmd} takes a repo and a branch` };
  }
  if (cmd === "prompt") {
    if (argv.length !== 3) return { ok: false, error: "prompt takes a repo and a surface" };
    return { ok: true, req: { cmd, repo, surface: second as Surface } };
  }
  if (cmd === "make") {
    let dispatch: string | null = null;
    let timeout = DEFAULT_TIMEOUT;
    const rest = argv.slice(3);
    for (let i = 0; i < rest.length; i++) {
      const flag = rest[i] as string;
      if (flag === "--run") {
        const value = rest[i + 1];
        if (value === undefined) return { ok: false, error: "make needs --run <dispatch>" };
        dispatch = value;
        i++;
      } else if (flag === "--timeout") {
        const parsed = parseTimeoutText(rest[i + 1]);
        if (!parsed.ok) return parsed;
        timeout = parsed.timeout;
        i++;
      } else {
        return { ok: false, error: `unknown flag for make: ${flag}` };
      }
    }
    if (dispatch === null) return { ok: false, error: "make needs --run <dispatch>" };
    return { ok: true, req: { cmd, repo, surface: second as Surface, dispatch, timeout } };
  }
  const branch = second as string;
  let dispatch: string | null = null;
  let handover: string | null = null;
  let folder: string | null = null;
  let landing: string | null = null;
  let timeout = DEFAULT_TIMEOUT;
  const rest = argv.slice(3);
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i] as string;
    if (flag === "--run") {
      const value = rest[i + 1];
      if (value === undefined) return { ok: false, error: `${cmd} needs --run <dispatch>` };
      dispatch = value;
      i++;
    } else if (flag === "--handover") {
      const value = rest[i + 1];
      if (value === undefined) return { ok: false, error: `${cmd} needs --handover <file>` };
      handover = value;
      i++;
    } else if (flag === "--folder") {
      const value = rest[i + 1];
      if (value === undefined) return { ok: false, error: `${cmd} needs --folder <dir>` };
      const normalized = normalizeFolder(value);
      if (!normalized.ok) return normalized;
      folder = normalized.folder;
      i++;
    } else if (flag === "--timeout") {
      const parsed = parseTimeoutText(rest[i + 1]);
      if (!parsed.ok) return parsed;
      timeout = parsed.timeout;
      i++;
    } else if (flag === "--landing") {
      if (cmd !== "land") return { ok: false, error: `unknown flag for check: ${flag}` };
      const value = rest[i + 1];
      if (value !== "local" && value !== "pull-request") {
        return { ok: false, error: `bad landing: ${value ?? "none"} (local or pull-request)` };
      }
      landing = value;
      i++;
    } else {
      return { ok: false, error: `unknown flag for ${cmd}: ${flag}` };
    }
  }
  if (dispatch === null) return { ok: false, error: `${cmd} needs --run <dispatch>` };
  if (handover === null) return { ok: false, error: `${cmd} needs --handover <file>` };
  if (cmd === "land") {
    return { ok: true, req: { cmd, repo, branch, dispatch, handover, folder, timeout, landing } };
  }
  return { ok: true, req: { cmd, repo, branch, dispatch, handover, folder, timeout } };
}

export interface PromptVars {
  repo: string;
  surface: string;
  surfaceProse: string;
  verifyDir: string;
  base: string;
}

/** Fill the template's placeholders. A placeholder left over is a bug, and throws. */
export function renderPrompt(template: string, vars: PromptVars): string {
  const known: Record<string, string> = {
    REPO: vars.repo,
    SURFACE: vars.surface,
    SURFACE_PROSE: vars.surfaceProse,
    VERIFY_DIR: vars.verifyDir,
    BASE: vars.base,
  };
  // One pass, each value through a replacer function: an inserted value is
  // never rescanned, so $ patterns and placeholder-shaped text in a value
  // copy literally instead of expanding or throwing.
  return template.replace(/\{\{[A-Z_]+\}\}/gu, (m) => {
    const v: string | undefined = known[m.slice(2, -2)];
    if (v === undefined) throw new Error(`unknown placeholder in the prompt template: ${m}`);
    return v;
  });
}

/** The verifier folder for a repo: verify- plus its slugged base name. */
export function verifyDirName(repoPath: string): string {
  const slug = basename(repoPath)
    .toLowerCase() // LOWER: lowered for an ASCII slug
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return slug === "" ? "verify-app" : `verify-${slug}`;
}

/** The session's branch: verify-<surface>, numbered past branches taken. */
export function pickBranch(taken: (name: string) => boolean, surface: string): string {
  const stem = `verify-${surface}`;
  let name = stem;
  let n = 2;
  while (taken(name)) {
    name = `${stem}-${n}`;
    n++;
  }
  return name;
}

/** The session's worktree: a sibling of the repo, numbered past paths taken. */
export function pickWorktree(
  repo: string,
  surface: string,
  exists: (p: string) => boolean,
): string {
  const stem = join(dirname(repo), `${basename(repo)}-verify-${surface}`);
  let wt = stem;
  let n = 2;
  while (exists(wt)) {
    wt = `${stem}-${n}`;
    n++;
  }
  return wt;
}

/** The remote branch origin/HEAD names, or null when it names none. */
export function remoteFromSymbolicRef(out: string): string | null {
  const ref = out.trim();
  const prefix = "refs/remotes/";
  if (!ref.startsWith(prefix) || ref.length === prefix.length) return null;
  return ref.slice(prefix.length);
}

/** Inherited variables that redirect git away from -C: dropped for every git call. */
export const GIT_REDIRECT_ENV = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_NAMESPACE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_INDEX_FILE",
];

/** A copy of the environment with the git redirectors dropped. */
export function scrubGitEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (!GIT_REDIRECT_ENV.includes(k) && v !== undefined) out[k] = v;
  }
  return out;
}

/** git in a repo, blind to any inherited redirectors. */
function git(repo: string, args: string[]) {
  const env: Record<string, string | undefined> = {};
  for (const k of GIT_REDIRECT_ENV) env[k] = undefined;
  return run("git", ["-C", repo, ...args], { env });
}

/** Drop stale worktree registrations, best-effort: a hand-deleted worktree blocks its path. */
export function pruneWorktrees(repo: string): void {
  git(repo, ["worktree", "prune"]);
}

/** The top of the repo holding a path, or null when no repo holds it. */
export function repoTop(repo: string): string | null {
  const r = git(repo, ["rev-parse", "--show-toplevel"]);
  if (r.code !== 0) return null;
  const top = r.out.trim();
  return top === "" ? null : top;
}

/** Commits on the branch past the base, or null when they cannot be counted. */
export function commitsPastBase(repo: string, base: string, branch: string): number | null {
  const r = git(repo, ["rev-list", "--count", `${base}..${branch}`]);
  if (r.code !== 0) return null;
  const n = Number(r.out.trim());
  return Number.isInteger(n) ? n : null;
}

/** A path is present in the branch's committed tree. */
export function branchHasPath(repo: string, branch: string, path: string): boolean {
  const r = git(repo, ["ls-tree", "--name-only", branch, "--", path]);
  return r.code === 0 && r.out.trim() !== "";
}

/** The handover was written after the cut, so this session made it. */
export function handoverFresh(handoverMtimeMs: number, cutMs: number): boolean {
  return handoverMtimeMs >= cutMs;
}

function handoverMtimeMs(path: string): number | null {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

/** Markdown pages committed under the verifier's features folder, besides its index. */
export function committedFeaturePages(repo: string, branch: string, vdir: string): string[] | null {
  // -z: NUL-separated and never quoted, so non-ASCII names count as written.
  const r = git(repo, ["ls-tree", "-z", "-r", "--name-only", branch, "--", `${vdir}/features/`]);
  if (r.code !== 0) return null;
  const index = `${vdir}/features/README.md`;
  return r.out.split("\0").filter((l) => l !== "" && l !== index && l.endsWith(".md"));
}

/** The base the session's branch is cut from: origin's head, main, master, or HEAD. */
export function defaultBase(repo: string): string | null {
  const sym = git(repo, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
  if (sym.code === 0) {
    const name = remoteFromSymbolicRef(sym.out);
    if (name !== null && git(repo, ["rev-parse", "--verify", "--quiet", name]).code === 0) {
      return name;
    }
  }
  for (const b of ["main", "master"]) {
    if (git(repo, ["show-ref", "--verify", "--quiet", `refs/heads/${b}`]).code === 0) {
      return b;
    }
  }
  const head = git(repo, ["rev-parse", "HEAD"]);
  if (head.code === 0) return head.out.trim();
  return null;
}

/**
 * The first line of the provider wall the stream ended on, or null. The
 * session runs under the coachman role, whose walls the launcher does not
 * record, so the verifier reads its own stream with the launcher's helpers.
 */
export function wallInStream(streamText: string, harness: string): string | null {
  const message = endingWallMessage(streamText, harness);
  if (message === null) return null;
  const first = message.split("\n")[0] ?? "";
  if (!isWallMessage(first)) return null;
  return first;
}

/** The harness the run recorded for a role, mirroring launch's per-leg pick. */
export function roleHarness(config: unknown, role: string, leg: string): string | null {
  if (typeof config !== "object" || config === null || Array.isArray(config)) return null;
  const team = (config as Record<string, unknown>)["team"];
  if (typeof team !== "object" || team === null || Array.isArray(team)) return null;
  const t = team as Record<string, unknown>;
  const harnessOf = (v: unknown): string | null => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
    const h = (v as Record<string, unknown>)["harness"];
    return typeof h === "string" && h !== "" ? h : null;
  };
  if (role === "coachman") {
    const legs = t["coachman_legs"];
    if (typeof legs === "object" && legs !== null && !Array.isArray(legs)) {
      const perLeg = harnessOf((legs as Record<string, unknown>)[leg]);
      if (perLeg !== null) return perLeg;
    }
    return harnessOf(t["coachman"]);
  }
  if (role === "coachman_fallback") return harnessOf(t["coachman_fallback"]);
  return null;
}

/** A repo-relative folder, stripped of a leading ./ and trailing slashes. */
export function normalizeFolder(
  raw: string,
): { ok: true; folder: string } | { ok: false; error: string } {
  let folder = raw;
  while (folder.startsWith("./")) folder = folder.slice(2);
  while (folder.endsWith("/") && folder.length > 1) folder = folder.slice(0, -1);
  if (folder === "" || folder === "/" || folder === ".") {
    return { ok: false, error: `bad folder: ${raw} is not a folder in the repo` };
  }
  if (folder.startsWith("/") || folder.split("/").includes("..")) {
    return { ok: false, error: `bad folder: ${raw} is not inside the repo` };
  }
  return { ok: true, folder };
}

export interface HandoverEntry {
  name: string;
  folder: string;
  /** The proof value as written, or null when the entry names none. */
  proof: string | null;
}

/**
 * The hand-over's verifier sections, in the order written. Only the section
 * headers and the first Folder: and Proof: line of each section are read; every
 * other line is prose. A missing Proof: line is not malformed: the entry names
 * no proof file and fails its proof.
 */
export function parseHandover(
  text: string,
): { ok: true; entries: HandoverEntry[] } | { ok: false; error: string } {
  const entries: HandoverEntry[] = [];
  const seen = new Set<string>();
  let current: { name: string; folder: string | null; proof: string | null } | null = null;
  const close = (): { ok: false; error: string } | null => {
    if (current === null) return null;
    if (current.folder === null || current.folder === "") {
      return { ok: false, error: `the hand-over names no folder for ${current.name}` };
    }
    const normalized = normalizeFolder(current.folder);
    if (!normalized.ok) {
      return {
        ok: false,
        error: `the hand-over folder for ${current.name} is not inside the repo: ${current.folder}`,
      };
    }
    entries.push({ name: current.name, folder: normalized.folder, proof: current.proof });
    current = null;
    return null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("## Verifier:")) {
      const failed = close();
      if (failed !== null) return failed;
      const name = line.slice("## Verifier:".length).trim();
      if (name === "") return { ok: false, error: "the hand-over has a verifier with no name" };
      if (seen.has(name)) return { ok: false, error: `the hand-over names ${name} twice` };
      seen.add(name);
      current = { name, folder: null, proof: null };
    } else if (current !== null && line.startsWith("Folder:") && current.folder === null) {
      current.folder = line.slice("Folder:".length).trim();
    } else if (current !== null && line.startsWith("Proof:") && current.proof === null) {
      current.proof = line.slice("Proof:".length).trim();
    }
  }
  const failed = close();
  if (failed !== null) return failed;
  return { ok: true, entries };
}

export interface ClassifiedEntry extends HandoverEntry {
  proven: boolean;
  /** Why a failed entry failed: no proof file, or the proof file missing. */
  failReason: string;
}

/** Proven means the entry names an absolute path holding a file. */
export function classifyEntries(
  entries: HandoverEntry[],
  isFile: (path: string) => boolean,
): ClassifiedEntry[] {
  return entries.map((e) => {
    const namesFile =
      e.proof !== null && e.proof !== "" && e.proof.startsWith("/") && isFile(e.proof);
    if (namesFile) return { ...e, proven: true, failReason: "" };
    const failReason =
      e.proof === null || e.proof === "" || !e.proof.startsWith("/")
        ? "no proof file"
        : `proof ${e.proof} missing`;
    return { ...e, proven: false, failReason };
  });
}

/** The diff paths outside the verifiers' folder, in the order git listed them. */
export function outsidePaths(paths: string[], folder: string): string[] {
  const prefix = `${folder}/`;
  return paths.filter((p) => !p.startsWith(prefix));
}

export interface VerifySummary {
  gate: string | null;
  failed: string[];
  /** Names reporting "not run", in the order reported. */
  notRun: string[];
  /** Every check's result, in the order reported, for the pull-request body. */
  results: Array<{ name: string; result: string }>;
}

/** The per-check results from run verify run's output. */
export function parseVerifyResults(output: string): VerifySummary {
  const results: Array<{ name: string; result: string }> = [];
  for (const line of output.split("\n")) {
    const m = RESULT_RE.exec(line);
    if (m !== null) results.push({ name: m[2] as string, result: m[3] as string });
  }
  return {
    gate: results.find((r) => r.name === "gate")?.result ?? null,
    failed: results.filter((r) => r.result === "fail").map((r) => r.name),
    notRun: results.filter((r) => r.result === "not run").map((r) => r.name),
    results,
  };
}

/**
 * The not-run checks that refuse the landing: every project check but the
 * gate, which its own rule covers. Tool checks report not run when the
 * landing brief gives them no ticket, which is expected; an unknown kind
 * fails closed.
 */
export function unrunProject(notRun: string[], kinds: Record<string, string>): string[] {
  return notRun.filter((n) => n !== "gate" && kinds[n] !== "tool");
}

/** The merge authority the run recorded, defaulting to the user when absent. */
export function mergeAuthorityOf(runJsonText: string): "user" | "postmaster" {
  try {
    const data = JSON.parse(runJsonText) as Record<string, unknown>;
    const config = data["config"] as Record<string, unknown> | undefined;
    const ship = config?.["ship"] as Record<string, unknown> | undefined;
    return ship?.["merge_authority"] === "postmaster" ? "postmaster" : "user";
  } catch {
    return "user";
  }
}

/** The landing route when none is named: pull-request with an origin remote. */
export function defaultLanding(hasOrigin: boolean): "local" | "pull-request" {
  return hasOrigin ? "pull-request" : "local";
}

/** Milliseconds to wait for the project's checks; capped past the timer's range. */
export function timeoutMs(seconds: number): number {
  return Math.min(seconds * 1000, 2147483647);
}

/** The last non-empty line, for a one-line verdict; the exit when there is none. */
export function lastLine(text: string, code: number): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  return lines.length === 0 ? `exit ${code}` : (lines[lines.length - 1] as string);
}

export interface CheapFacts {
  branch: string;
  classified: ClassifiedEntry[];
  /** Failed entries whose folder holds files on the branch. */
  failedPresent: ClassifiedEntry[];
  /** Proven entries with no files on the branch. */
  provenEmpty: ClassifiedEntry[];
  /** Diff paths outside the verifiers' folder. */
  outside: string[];
}

/**
 * The decision's cheap half, in fail-fast order: no proven verifier, a failed
 * folder still on the branch, a proven verifier with no files, paths outside
 * the folder. Null means the project's checks run next.
 */
export function decideCheap(facts: CheapFacts): string | null {
  const landed = facts.classified.filter((e) => e.proven);
  if (landed.length === 0) {
    const why =
      facts.classified.length === 0
        ? "the hand-over names none"
        : facts.classified.map((e) => `${e.name}: ${e.failReason}`).join("; ");
    return `no proven verifier (${why})`;
  }
  if (facts.failedPresent.length > 0) {
    const who = facts.failedPresent.map((e) => `${e.name} (${e.folder})`).join(", ");
    return `failed verifier still on the branch: ${who}`;
  }
  if (facts.provenEmpty.length > 0) {
    const who = facts.provenEmpty.map((e) => `${e.name} (${e.folder})`).join(", ");
    return `proven verifier has no files on the branch: ${who}`;
  }
  if (facts.outside.length > 0) {
    const shown = facts.outside.slice(0, 10).join(", ");
    const more = facts.outside.length > 10 ? ` and ${facts.outside.length - 10} more` : "";
    return `outside the verifiers' folder: ${shown}${more}`;
  }
  return null;
}

/** What the project's checks reported: their summary, a timeout, or no result. */
export type ChecksOutcome =
  | { kind: "ran"; summary: VerifySummary; unrunProject: string[] }
  | { kind: "timeout"; seconds: number }
  | { kind: "unrunnable"; error: string };

/** The decision's expensive half: the timeout, the failures, the unrun, then the gate. */
export function decideChecks(outcome: ChecksOutcome): string | null {
  if (outcome.kind === "timeout") {
    return `past its limit (the checks ran longer than ${outcome.seconds}s)`;
  }
  if (outcome.kind === "unrunnable") return outcome.error;
  if (outcome.summary.failed.length > 0) {
    return `checks failed (${outcome.summary.failed.map((n) => `${n}: fail`).join("; ")})`;
  }
  if (outcome.unrunProject.length > 0) {
    return `checks not run (${outcome.unrunProject.map((n) => `${n}: not run`).join("; ")})`;
  }
  if (outcome.summary.gate !== "pass") {
    return `gate did not pass (${outcome.summary.gate ?? "not reported"})`;
  }
  return null;
}

function landedText(landed: ClassifiedEntry[]): string {
  const word = landed.length === 1 ? "verifier" : "verifiers";
  const who = landed.map((e) => `${e.name} (${e.folder}, proof ${e.proof})`).join(", ");
  return `${landed.length} ${word}: ${who}`;
}

function leftOutText(leftOut: ClassifiedEntry[]): string {
  return leftOut.length === 0
    ? "none"
    : leftOut.map((e) => `${e.name} (${e.failReason})`).join(", ");
}

/** One line saying what lands and what stays out. */
export function acceptLine(branch: string, classified: ClassifiedEntry[]): string {
  const landed = classified.filter((e) => e.proven);
  const leftOut = classified.filter((e) => !e.proven);
  return `accept: ${branch} lands ${landedText(landed)}; left out: ${leftOutText(leftOut)}`;
}

/** One line saying nothing lands, and why. */
export function refuseLine(branch: string, reason: string): string {
  return `refuse: ${branch} lands nothing: ${reason}`;
}

class UsageError extends Error {}
class RunError extends Error {}

function isRepo(repo: string): boolean {
  return git(repo, ["rev-parse", "--git-dir"]).code === 0;
}

/** The path is the top of its repo, not a path below it. Symlinks resolved both sides. */
function isRepoTop(repo: string): boolean {
  const top = repoTop(repo);
  if (top === null) return false;
  try {
    return realpathSync(repo) === realpathSync(top);
  } catch {
    return false;
  }
}

function branchTaken(repo: string, name: string): boolean {
  return git(repo, ["show-ref", "--verify", "--quiet", `refs/heads/${name}`]).code === 0;
}

function readTemplate(): string {
  return readFileSync(join(scriptsDir(import.meta), "verifier-prompt.md"), "utf8");
}

function runPrompt(req: ParsedPrompt): number {
  const repo = resolve(req.repo);
  if (!isRepo(repo)) throw new UsageError(`not a git repository: ${req.repo}`);
  if (!isRepoTop(repo)) throw new UsageError(`not the top of its repository: ${req.repo}`);
  const base = defaultBase(repo);
  if (base === null) throw new UsageError(`no commit to cut from in ${req.repo}`);
  const out = renderPrompt(readTemplate(), {
    repo,
    surface: req.surface,
    surfaceProse: surfaceProse(req.surface),
    verifyDir: verifyDirName(repo),
    base,
  });
  process.stdout.write(out);
  return 0;
}

function fileText(path: string): string {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
}

interface Attempt {
  role: string;
  stream: string;
  thread: string;
  walled: boolean;
  wallDetail: string;
  failed: string;
}

/** A launch that started its process and then failed: its attempt is logged. */
class LaunchedError extends RunError {
  attempt: Attempt;
  constructor(message: string, attempt: Attempt) {
    super(message);
    this.attempt = attempt;
  }
}

interface LaunchOpts {
  role: string;
  leg: string;
  wt: string;
  name: string;
  logs: string;
  branch: string;
  surface: string;
  promptFile: string;
  dispatch: string;
  timeout: number;
}

function threadOf(stream: string): string {
  const id = run(RUN, ["launch", "thread-id", stream]);
  return id.code === 0 ? id.out.trim() : "none";
}

function streamText(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function readRunConfig(dispatch: string): unknown {
  try {
    const data = JSON.parse(readFileSync(join(dispatch, "run.json"), "utf8")) as Record<
      string,
      unknown
    >;
    return data["config"] ?? null;
  } catch {
    return null;
  }
}

function launchAndWait(o: LaunchOpts, sessionStarted: { started: boolean }): Attempt {
  const base = join(o.logs, `verifier-${o.branch}-${o.role}`);
  const stream = `${base}-events.jsonl`;
  const errFile = `${base}.err`;
  const marker = `${base}.done`;
  const pidFile = `${base}.pid`;
  const failed = (message: string): LaunchedError =>
    new LaunchedError(message, {
      role: o.role,
      stream,
      thread: threadOf(stream),
      walled: false,
      wallDetail: "",
      failed: message,
    });
  const started = run(RUN, [
    "host",
    "run",
    o.name,
    o.wt,
    "--under",
    o.dispatch,
    "--role",
    "coachman",
    "--run",
    o.dispatch,
    "--out",
    stream,
    "--err",
    errFile,
    "--marker",
    marker,
    "--pidfile",
    pidFile,
    "--",
    RUN,
    "launch",
    "launch",
    o.role,
    o.wt,
    o.promptFile,
    "--leg",
    o.leg,
    "--run",
    o.dispatch,
  ]);
  if (started.code !== 0) {
    throw new RunError(
      `the host would not start the ${o.role} session: ${fileText(errFile) || started.err.trim() || `exit ${started.code}`}`,
    );
  }
  sessionStarted.started = true;
  const waited = run(RUN, ["wait-for-markers", o.logs, basename(marker), "1", String(o.timeout)]);
  if (waited.code !== 0) {
    // Stopping an already-exited session is a no-op, so every wait failure
    // stops first; the stop result is checked before anything claims it.
    const stop = run(RUN, ["host", "stop", o.wt]);
    const stopFailed =
      stop.code === 0
        ? ""
        : `the stop failed: ${stop.err.trim() || stop.out.trim() || `exit ${stop.code}`}`;
    if (waited.code === 3) {
      throw failed(
        stop.code === 0
          ? `the ${o.role} session was still running after ${o.timeout} seconds; stopped`
          : `the ${o.role} session was still running after ${o.timeout} seconds; ${stopFailed}`,
      );
    }
    throw failed(
      `waiting for the ${o.role} session failed: ${waited.err.trim() || waited.out.trim()}${stopFailed === "" ? "" : `; ${stopFailed}`}`,
    );
  }
  const harness = roleHarness(readRunConfig(o.dispatch), o.role, o.leg);
  if (harness === null) {
    throw failed(`the run names no harness for ${o.role}`);
  }
  const wallDetail = wallInStream(streamText(stream), harness);
  return {
    role: o.role,
    stream,
    thread: threadOf(stream),
    walled: wallDetail !== null,
    wallDetail: wallDetail ?? "",
    failed: "",
  };
}

function logLaunch(dispatch: string, surface: string, branch: string, a: Attempt): void {
  const outcome = a.failed !== "" ? ` failed: ${a.failed}` : a.walled ? " walled" : "";
  const detail = `thread ${a.thread} role ${a.role} branch ${branch}${outcome}`;
  const r = run(RUN, [
    "log-action",
    dispatch,
    "coachman",
    "dispatch",
    `verifier-${surface}`,
    detail,
  ]);
  if (r.code !== 0)
    throw new RunError(`the launch was not logged: ${r.err.trim() || r.out.trim()}`);
}

/** One launch and its one dispatch line, on success and on every failure past the start. */
function attempt(o: LaunchOpts, sessionStarted: { started: boolean }): Attempt {
  try {
    const a = launchAndWait(o, sessionStarted);
    logLaunch(o.dispatch, o.surface, o.branch, a);
    return a;
  } catch (e) {
    if (e instanceof LaunchedError) logLaunch(o.dispatch, o.surface, o.branch, e.attempt);
    throw e;
  }
}

/**
 * Best-effort removal of a failed make's worktree and branch: "" when clean,
 * otherwise the failure to append to the error that caused the cleanup.
 */
export function removeProvisioning(repo: string, wt: string, branch: string): string {
  const problems: string[] = [];
  const rm = git(repo, ["worktree", "remove", "--force", wt]);
  if (rm.code !== 0) problems.push(rm.err.trim() || rm.out.trim() || `exit ${rm.code}`);
  const del = git(repo, ["branch", "-D", branch]);
  if (del.code !== 0) problems.push(del.err.trim() || del.out.trim() || `exit ${del.code}`);
  return problems.length === 0 ? "" : `; the cleanup failed too: ${problems.join("; ")}`;
}

/** What a make failure past the cut does with the branch and worktree. */
export interface FailureOutcome {
  cleanup: boolean;
  suffix: string;
}

/**
 * A failure before any session started cleans up pure scaffolding; once a
 * session ran, its work may hold the diagnosis, so the worktree and branch
 * stay, named in the error for the operator.
 */
export function failureOutcome(
  sessionStarted: boolean,
  wt: string,
  branch: string,
): FailureOutcome {
  if (sessionStarted) {
    return {
      cleanup: false,
      suffix: `; the worktree ${wt} and branch ${branch} were left behind`,
    };
  }
  return { cleanup: true, suffix: "" };
}

function runMake(req: ParsedMake): number {
  const repo = resolve(req.repo);
  if (!isRepo(repo)) throw new UsageError(`not a git repository: ${req.repo}`);
  if (!isRepoTop(repo)) throw new UsageError(`not the top of its repository: ${req.repo}`);
  const dispatch = resolve(req.dispatch);
  if (!existsSync(join(dispatch, "run.json"))) {
    throw new UsageError(`no run at the dispatch: ${req.dispatch}`);
  }
  const base = defaultBase(repo);
  if (base === null) throw new UsageError(`no commit to cut from in ${req.repo}`);
  pruneWorktrees(repo);
  const branch = pickBranch((name) => branchTaken(repo, name), req.surface);
  const wt = pickWorktree(repo, req.surface, existsSync);
  const vdir = verifyDirName(repo);
  const added = git(repo, ["worktree", "add", wt, "-b", branch, base]);
  if (added.code !== 0) {
    throw new RunError(`the worktree would not cut: ${added.err.trim() || added.out.trim()}`);
  }
  const sessionStarted = { started: false };
  const cutAt = Date.now();
  try {
    return runMakeLaunches(req, repo, dispatch, base, branch, wt, vdir, sessionStarted, cutAt);
  } catch (e) {
    const outcome = failureOutcome(sessionStarted.started, wt, branch);
    const extra = outcome.cleanup ? removeProvisioning(repo, wt, branch) : outcome.suffix;
    if (e instanceof RunError && extra !== "") throw new RunError(`${e.message}${extra}`);
    throw e;
  }
}

/** Everything past the cut: a thrower here cleans up only before any session starts. */
function runMakeLaunches(
  req: ParsedMake,
  repo: string,
  dispatch: string,
  base: string,
  branch: string,
  wt: string,
  vdir: string,
  sessionStarted: { started: boolean },
  cutAt: number,
): number {
  const logs = join(dispatch, "logs");
  mkdirSync(logs, { recursive: true });
  const promptFile = join(logs, `verifier-${branch}-prompt.txt`);
  writeFileSync(
    promptFile,
    renderPrompt(readTemplate(), {
      repo,
      surface: req.surface,
      surfaceProse: surfaceProse(req.surface),
      verifyDir: vdir,
      base,
    }),
  );
  const named = run(RUN, ["host", "name", dispatch, "role", `verifier-${req.surface}`]);
  if (named.code !== 0) {
    throw new RunError(`the launch could not be named: ${named.err.trim() || named.out.trim()}`);
  }
  const name = named.out.trim();
  const first = attempt(
    {
      role: "coachman",
      leg: "synthesis",
      wt,
      name,
      logs,
      branch,
      surface: req.surface,
      promptFile,
      dispatch,
      timeout: req.timeout,
    },
    sessionStarted,
  );
  let final = first;
  if (first.walled) {
    const second = attempt(
      {
        role: "coachman_fallback",
        leg: "synthesis",
        wt,
        name,
        logs,
        branch,
        surface: req.surface,
        promptFile,
        dispatch,
        timeout: req.timeout,
      },
      sessionStarted,
    );
    if (second.walled) {
      throw new RunError(
        `both roles walled: coachman: ${first.wallDetail}; coachman_fallback: ${second.wallDetail}`,
      );
    }
    final = second;
  }
  const handover = join(wt, "HANDOVER.md");
  const written = handoverMtimeMs(handover);
  if (written === null) {
    throw new RunError(`the session ended with no HANDOVER.md in ${wt}`);
  }
  if (!handoverFresh(written, cutAt)) {
    throw new RunError(`the HANDOVER.md in ${wt} predates this session`);
  }
  const made = commitsPastBase(wt, base, branch);
  if (made === null) {
    throw new RunError(`the session's commits could not be counted on ${branch}`);
  }
  if (made === 0) {
    throw new RunError(`the session committed nothing on ${branch}`);
  }
  if (!branchHasPath(wt, branch, `${vdir}/README.md`)) {
    throw new RunError(`the session left no ${vdir}/README.md committed on ${branch}`);
  }
  const pages = committedFeaturePages(wt, branch, vdir) ?? [];
  if (pages.length < 3) {
    throw new RunError(`the session left fewer than 3 feature pages committed on ${branch}`);
  }
  for (const line of [
    `branch ${branch}`,
    `base ${base}`,
    `worktree ${wt}`,
    `role ${final.role}`,
    `thread ${final.thread}`,
    `prompt ${promptFile}`,
    `stream ${final.stream}`,
    `handover ${handover}`,
  ]) {
    console.log(line);
  }
  return 0;
}

/** The ticket the project's checks read: none, so ticket checks report not run. */
const LAND_BRIEF = `# Verifier landing

## Ticket

The verifiers land only when the project's own checks pass. No ticket examples.

## Project profile

repo: the project under test
`;

function branchExists(repo: string, branch: string): boolean {
  return git(repo, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]).code === 0;
}

/**
 * The local branch landing targets: the default origin names, else main or
 * master. It follows the same default the scope check compares against, so
 * the merge or pull request never targets another history.
 */
export function landTarget(repo: string): string | null {
  const sym = git(repo, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
  if (sym.code === 0) {
    const name = remoteFromSymbolicRef(sym.out);
    if (
      name !== null &&
      name.startsWith("origin/") &&
      git(repo, ["rev-parse", "--verify", "--quiet", name]).code === 0
    ) {
      const local = name.slice("origin/".length);
      // The default is named but not checked out: refuse, since landing onto
      // any other local branch would target the wrong history.
      return branchExists(repo, local) ? local : null;
    }
  }
  for (const b of ["main", "master"]) {
    if (branchExists(repo, b)) return b;
  }
  return null;
}

function hasOrigin(repo: string): boolean {
  return git(repo, ["remote", "get-url", "origin"]).code === 0;
}

/** Files under a folder on a branch, or null when git cannot list them. */
function branchFilesUnder(repo: string, branch: string, folder: string): string[] | null {
  const r = git(repo, ["ls-tree", "-r", "--name-only", "-z", branch, "--", folder]);
  if (r.code !== 0) return null;
  return r.out.split("\0").filter((p) => p !== "");
}

/** What the branch adds past the merge base, or null when git cannot compare. */
function branchDiffPaths(repo: string, base: string, branch: string): string[] | null {
  // No rename detection: --name-only names a rename by its new path alone,
  // which would hide a deletion outside the folder from the scope check.
  const r = git(repo, ["diff", "--name-only", "--no-renames", "-z", `${base}...${branch}`]);
  if (r.code !== 0) return null;
  return r.out.split("\0").filter((p) => p !== "");
}

function proofIsFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** A fresh dir under the dispatch holding this decision's recorded checks. */
function freshChecksDir(dispatch: string, branch: string): string {
  const parent = join(dispatch, "verifier-land");
  mkdirSync(parent, { recursive: true });
  const stem = branch.replace(/[^A-Za-z0-9._-]+/gu, "-");
  let n = 1;
  let dir = join(parent, `${stem}-${n}`);
  while (existsSync(dir)) {
    n++;
    dir = join(parent, `${stem}-${n}`);
  }
  mkdirSync(dir);
  return dir;
}

interface Decided {
  classified: ClassifiedEntry[];
  accepted: boolean;
  summary: VerifySummary | null;
  line: string;
}

function refused(branch: string, classified: ClassifiedEntry[], reason: string): Decided {
  return { classified, accepted: false, summary: null, line: refuseLine(branch, reason) };
}

/** Check name to kind from the spec verify run wrote, or null when unreadable. */
function specKinds(checksDir: string): Record<string, string> | null {
  try {
    const raw = JSON.parse(
      readFileSync(join(checksDir, "verify", "spec", "spec.json"), "utf8"),
    ) as {
      checks?: unknown;
    };
    if (!Array.isArray(raw.checks)) return null;
    const kinds: Record<string, string> = {};
    for (const c of raw.checks) {
      if (typeof c === "object" && c !== null) {
        const name = (c as Record<string, unknown>).name;
        const kind = (c as Record<string, unknown>).kind;
        if (typeof name === "string" && typeof kind === "string") kinds[name] = kind;
      }
    }
    return kinds;
  } catch {
    return null;
  }
}

/** Run the project's checks on a scratch at the branch head, then remove it. */
function runProjectChecks(o: {
  repo: string;
  branch: string;
  dispatch: string;
  timeout: number;
}): ChecksOutcome {
  const head = git(o.repo, ["rev-parse", "--verify", `${o.branch}^{commit}`]);
  if (head.code !== 0) {
    return { kind: "unrunnable", error: `the branch ${o.branch} names no commit` };
  }
  const tmp = mkdtempSync(join(tmpdir(), "verifier-land-"));
  const scratch = join(tmp, "scratch");
  try {
    const cut = run(RUN, ["cut-scratch", o.repo, o.repo, scratch, head.out.trim()]);
    if (cut.code !== 0) {
      return {
        kind: "unrunnable",
        error: `a scratch would not cut: ${lastLine(cut.err, cut.code)}`,
      };
    }
    const checksDir = freshChecksDir(o.dispatch, o.branch);
    const record = run(RUN, ["verify", "record", scratch, checksDir]);
    if (record.code !== 0) {
      return {
        kind: "unrunnable",
        error: `the checks could not be recorded: ${lastLine(record.err, record.code)}`,
      };
    }
    writeFileSync(join(checksDir, "brief.md"), LAND_BRIEF);
    const verify = run(RUN, ["verify", "run", scratch, checksDir], {
      timeout: timeoutMs(o.timeout),
    });
    if (verify.timedOut) return { kind: "timeout", seconds: o.timeout };
    if (verify.code !== 0 && verify.code !== 2 && verify.code !== 3) {
      const text = verify.err.trim() !== "" ? verify.err : verify.out;
      return {
        kind: "unrunnable",
        error: `the checks could not run: ${lastLine(text, verify.code)}`,
      };
    }
    const summary = parseVerifyResults(verify.out);
    let unrun: string[] = [];
    if (summary.notRun.length > 0) {
      const kinds = specKinds(checksDir);
      if (kinds === null) {
        return {
          kind: "unrunnable",
          error: "the checks ran but their kinds could not be read",
        };
      }
      unrun = unrunProject(summary.notRun, kinds);
    }
    return { kind: "ran", summary, unrunProject: unrun };
  } finally {
    run(RUN, ["cut-scratch", "--remove", o.repo, scratch]);
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      // Best-effort: a leftover temp dir is not a verdict.
    }
  }
}

function decideBranch(o: {
  repo: string;
  branch: string;
  dispatch: string;
  folder: string;
  timeout: number;
  classified: ClassifiedEntry[];
  compareBase: string;
}): Decided {
  const failedPresent: ClassifiedEntry[] = [];
  for (const e of o.classified) {
    if (e.proven) continue;
    const files = branchFilesUnder(o.repo, o.branch, e.folder);
    if (files === null) {
      return refused(o.branch, o.classified, `the branch could not be read under ${e.folder}`);
    }
    if (files.length > 0) failedPresent.push(e);
  }
  const provenEmpty: ClassifiedEntry[] = [];
  for (const e of o.classified) {
    if (!e.proven) continue;
    const files = branchFilesUnder(o.repo, o.branch, e.folder);
    if (files === null) {
      return refused(o.branch, o.classified, `the branch could not be read under ${e.folder}`);
    }
    if (files.length === 0) provenEmpty.push(e);
  }
  const diff = branchDiffPaths(o.repo, o.compareBase, o.branch);
  if (diff === null) {
    return refused(o.branch, o.classified, `the branch could not be compared`);
  }
  const cheapReason = decideCheap({
    branch: o.branch,
    classified: o.classified,
    failedPresent,
    provenEmpty,
    outside: outsidePaths(diff, o.folder),
  });
  if (cheapReason !== null) return refused(o.branch, o.classified, cheapReason);
  const outcome = runProjectChecks(o);
  const checksReason = decideChecks(outcome);
  if (checksReason !== null) return refused(o.branch, o.classified, checksReason);
  return {
    classified: o.classified,
    accepted: true,
    summary: outcome.kind === "ran" ? outcome.summary : null,
    line: acceptLine(o.branch, o.classified),
  };
}

interface Validated {
  repo: string;
  branch: string;
  dispatch: string;
  folder: string;
  handoverText: string;
}

function validateLanding(req: ParsedCheck | ParsedLand): Validated {
  const repo = resolve(req.repo);
  if (!isRepo(repo)) throw new UsageError(`not a git repository: ${req.repo}`);
  if (!isRepoTop(repo)) throw new UsageError(`not the top of its repository: ${req.repo}`);
  const dispatch = resolve(req.dispatch);
  if (!existsSync(join(dispatch, "run.json"))) {
    throw new UsageError(`no run at the dispatch: ${req.dispatch}`);
  }
  if (!branchExists(repo, req.branch)) {
    throw new UsageError(`no such branch in ${req.repo}: ${req.branch}`);
  }
  const target = landTarget(repo);
  if (target !== null && req.branch === target) {
    throw new UsageError(`${req.branch} is the default branch; landing needs a verifier branch`);
  }
  let handoverText: string;
  try {
    handoverText = readFileSync(resolve(req.handover), "utf8");
  } catch {
    throw new UsageError(`no hand-over to read: ${req.handover}`);
  }
  return {
    repo,
    branch: req.branch,
    dispatch,
    folder: req.folder ?? verifyDirName(repo),
    handoverText,
  };
}

function decideFromValidated(v: Validated, timeout: number): Decided {
  const parsed = parseHandover(v.handoverText);
  if (!parsed.ok) return refused(v.branch, [], parsed.error);
  const classified = classifyEntries(parsed.entries, proofIsFile);
  const base = defaultBase(v.repo);
  if (base === null) {
    return refused(v.branch, classified, "no commit to compare the branch against");
  }
  return decideBranch({
    repo: v.repo,
    branch: v.branch,
    dispatch: v.dispatch,
    folder: v.folder,
    timeout,
    classified,
    compareBase: base,
  });
}

function logVerdict(dispatch: string, branch: string, verb: "note" | "merge", line: string): void {
  const r = run(RUN, ["log-action", dispatch, "coachman", verb, branch, line]);
  if (r.code !== 0)
    throw new RunError(`the verdict was not logged: ${r.err.trim() || r.out.trim()}`);
}

function runCheckCmd(req: ParsedCheck): number {
  const decided = decideFromValidated(validateLanding(req), req.timeout);
  console.log(decided.line);
  logVerdict(resolve(req.dispatch), req.branch, "note", decided.line);
  return decided.accepted ? 0 : 1;
}

function landLocal(
  o: { repo: string; branch: string; dispatch: string },
  target: string,
): { line: string; verb: "note" | "merge"; code: number } {
  const authority = mergeAuthorityOf(fileText(join(o.dispatch, "run.json")));
  if (authority !== "postmaster") {
    return {
      line: `waiting: ${o.branch} is ready to merge into ${target}; waiting for the user's word`,
      verb: "note",
      code: 0,
    };
  }
  const current = git(o.repo, ["symbolic-ref", "--short", "-q", "HEAD"]).out.trim();
  if (current === "") {
    return {
      line: `error: ${o.repo} is not on a branch; check out ${target} and run again`,
      verb: "note",
      code: 1,
    };
  }
  if (current !== target) {
    return {
      line: `error: ${o.repo} is on ${current}, not ${target}; check out ${target} and run again`,
      verb: "note",
      code: 1,
    };
  }
  if (git(o.repo, ["status", "--porcelain"]).out.trim() !== "") {
    return {
      line: `error: ${o.repo} has uncommitted changes; commit or stash them and run again`,
      verb: "note",
      code: 1,
    };
  }
  const merge = git(o.repo, ["merge", "--no-ff", "--no-edit", o.branch]);
  if (merge.code !== 0) {
    git(o.repo, ["merge", "--abort"]);
    const text = merge.err.trim() !== "" ? merge.err : merge.out;
    return {
      line: `error: the merge of ${o.branch} into ${target} failed and was aborted: ${lastLine(text, merge.code)}`,
      verb: "note",
      code: 1,
    };
  }
  const sha = git(o.repo, ["rev-parse", "--short", "HEAD"]).out.trim();
  return { line: `merge: ${o.branch} into ${target} (${sha})`, verb: "merge", code: 0 };
}

function landPullRequest(
  o: {
    repo: string;
    branch: string;
    acceptLine: string;
    summary: VerifySummary | null;
  },
  target: string,
): { line: string; verb: "note" | "merge"; code: number } {
  const push = git(o.repo, ["push", "origin", o.branch]);
  if (push.code !== 0) {
    const text = push.err.trim() !== "" ? push.err : push.out;
    return {
      line: `error: the push of ${o.branch} to origin failed: ${lastLine(text, push.code)}`,
      verb: "note",
      code: 1,
    };
  }
  const checks =
    o.summary === null
      ? "not reported"
      : o.summary.results.map((r) => `${r.name}: ${r.result}`).join(", ");
  const pr = run(
    "gh",
    [
      "pr",
      "create",
      "--base",
      target,
      "--head",
      o.branch,
      "--title",
      `Verifiers for ${basename(o.repo)}`,
      "--body",
      `${o.acceptLine}\n\nChecks: ${checks}`,
    ],
    { cwd: o.repo },
  );
  if (pr.code !== 0) {
    const text = pr.err.trim() !== "" ? pr.err : pr.out;
    return {
      line: `error: pushed ${o.branch} to origin, but gh pr create failed: ${lastLine(text, pr.code)}`,
      verb: "note",
      code: 1,
    };
  }
  const url = pr.out
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l !== "");
  if (url === undefined || url === "") {
    return {
      line:
        `pull-request: pushed ${o.branch} to origin and opened a pull request against ` +
        `${target} (the URL was not reported); waiting for the user's word that it merged`,
      verb: "note",
      code: 0,
    };
  }
  return {
    line:
      `pull-request: pushed ${o.branch} to origin and opened ${url} against ${target}; ` +
      "waiting for the user's word that it merged",
    verb: "note",
    code: 0,
  };
}

function runLandCmd(req: ParsedLand): number {
  const v = validateLanding(req);
  const decided = decideFromValidated(v, req.timeout);
  if (!decided.accepted) {
    console.log(decided.line);
    logVerdict(v.dispatch, v.branch, "note", decided.line);
    return 1;
  }
  console.log(decided.line);
  logVerdict(v.dispatch, v.branch, "note", decided.line);
  const route = req.landing ?? defaultLanding(hasOrigin(v.repo));
  const target = landTarget(v.repo);
  const outcome =
    target === null
      ? {
          line: `error: no local default branch to land ${v.branch} onto`,
          verb: "note" as const,
          code: 1,
        }
      : route === "pull-request"
        ? landPullRequest(
            { repo: v.repo, branch: v.branch, acceptLine: decided.line, summary: decided.summary },
            target,
          )
        : landLocal({ repo: v.repo, branch: v.branch, dispatch: v.dispatch }, target);
  console.log(outcome.line);
  logVerdict(v.dispatch, v.branch, outcome.verb, outcome.line);
  return outcome.code;
}

function main(argv: string[]): number {
  // The verifier names every repo explicitly, so inherited git redirectors
  // can only corrupt: drop them for this process and every session it starts.
  for (const k of GIT_REDIRECT_ENV) delete process.env[k];
  try {
    const parsed = parseArgs(argv);
    if (!parsed.ok) throw new UsageError(parsed.error);
    if (parsed.req.cmd === "prompt") return runPrompt(parsed.req);
    if (parsed.req.cmd === "check") return runCheckCmd(parsed.req);
    if (parsed.req.cmd === "land") return runLandCmd(parsed.req);
    return runMake(parsed.req);
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`verifier: ${e.message}\n${USAGE}`);
      return 2;
    }
    if (e instanceof RunError) {
      console.error(`verifier: ${e.message}`);
      return 1;
    }
    throw e;
  }
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
