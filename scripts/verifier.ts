// Make a verifier for one surface of a project: one model session, in a worktree of its
// own, writes the verifier and proves it once before handing it over (#323). The session
// is interactive: it opens in a tab of its own where the user watches and answers it,
// asking only what the project does not show and taking secrets by file name (#344).
//
//   run verifier prompt <repo> <surface> [--headless]
//   run verifier make <repo> <surface> --run <dispatch> [--timeout <seconds>]
//
//   surface    cli | web | library: the surface the verifier covers
//   prompt     print the session's instructions for the repo and surface, the
//              interactive form, or with --headless the no-host form, which lists
//              each question it could not ask in HANDOVER.md instead of asking
//   make       cut a worktree on a branch of its own beside the repo, removed again
//              when make fails before any session starts, render the prompt, and open
//              the coachman role's interactive form through run launch in a fresh tab
//              through run host spawn, the way the booking clerk opens; send it the
//              instructions and wait for HANDOVER.md, leaving the tab open when done.
//              With no session host (spawn exits 3) run headless instead, as #323 did:
//              launch the coachman role through run launch under run host, wait, fall
//              back to coachman_fallback on a provider wall read from the session
//              stream, and stop the session at the limit; log one dispatch action per
//              launch either way
//   --timeout  seconds to wait for the session (default 3600, at most 9 digits)
//
//   exit 0  prompt printed; make: HANDOVER.md validated, the interactive session
//           left open in its tab, the headless one ended with no wall
//   exit 1  make failed: the launch would not start, the session was still running at the
//           limit, both roles walled, the handover, commit or verifier is missing, or the
//           action was not logged
//   exit 2  usage: an unknown command or surface, a missing argument, a bad flag or
//           timeout, a path that is not a git repository or not its top, a repo holding
//           no commit, or no run at the dispatch
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { splitCommand } from "./clerk.ts";
import { endingWallMessage, isWallMessage } from "./launch.ts";
import { beside, scriptsDir } from "./lib/paths.ts";
import { run } from "./lib/proc.ts";

const USAGE = `usage: run verifier prompt <repo> <surface> [--headless]
       run verifier make <repo> <surface> --run <dispatch> [--timeout <seconds>]

       surface is cli, web or library`;

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
  headless: boolean;
}

export interface ParsedMake {
  cmd: "make";
  repo: string;
  surface: Surface;
  dispatch: string;
  timeout: number;
}

export type Parsed = { ok: true; req: ParsedPrompt | ParsedMake } | { ok: false; error: string };

export function parseArgs(argv: string[]): Parsed {
  const cmd = argv[0];
  if (cmd === undefined) return { ok: false, error: "no command" };
  if (cmd !== "prompt" && cmd !== "make") return { ok: false, error: `unknown command: ${cmd}` };
  const repo = argv[1];
  const surface = argv[2];
  if (repo === undefined || surface === undefined) {
    return { ok: false, error: `${cmd} takes a repo and a surface` };
  }
  if (!isSurface(surface)) {
    return { ok: false, error: `unknown surface: ${surface} (cli, web or library)` };
  }
  if (cmd === "prompt") {
    const rest = argv.slice(3);
    if (rest.length > 1) return { ok: false, error: "prompt takes a repo and a surface" };
    if (rest.length === 1 && rest[0] !== "--headless") {
      return { ok: false, error: `unknown flag for prompt: ${rest[0]}` };
    }
    return { ok: true, req: { cmd, repo, surface, headless: rest.length === 1 } };
  }
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
      const value = rest[i + 1];
      if (value === undefined || !/^[0-9]{1,9}$/u.test(value) || Number(value) <= 0) {
        return { ok: false, error: `bad timeout: ${value ?? "none"}` };
      }
      timeout = Number(value);
      i++;
    } else {
      return { ok: false, error: `unknown flag for make: ${flag}` };
    }
  }
  if (dispatch === null) return { ok: false, error: "make needs --run <dispatch>" };
  return { ok: true, req: { cmd, repo, surface, dispatch, timeout } };
}

export interface PromptVars {
  repo: string;
  surface: string;
  surfaceProse: string;
  verifyDir: string;
  base: string;
  askRule: string;
  secretsRule: string;
  handoverUnasked: string;
}

/** Fill the template's placeholders. A placeholder left over is a bug, and throws. */
export function renderPrompt(template: string, vars: PromptVars): string {
  const known: Record<string, string> = {
    REPO: vars.repo,
    SURFACE: vars.surface,
    SURFACE_PROSE: vars.surfaceProse,
    VERIFY_DIR: vars.verifyDir,
    BASE: vars.base,
    ASK_RULE: vars.askRule,
    SECRETS_RULE: vars.secretsRule,
    HANDOVER_UNASKED: vars.handoverUnasked,
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

/**
 * What the session may ask, in the tool's own words from pstack's first step:
 * the project first, the user only for what it does not show. The headless
 * session cannot ask at all, so it records each open question for HANDOVER.md.
 */
export const INTERACTIVE_ASK_RULE =
  "Learn the project from its files first, and ask the user only what you cannot observe there. " +
  "A question the working copy answers is never asked; the user sits behind this session and answers " +
  "what the project does not show.";

export const HEADLESS_ASK_RULE =
  "Learn the project from its files, never from the user: this session cannot ask anyone anything. " +
  "For every question below the working copy does not answer, record it for HANDOVER.md's unasked list " +
  "instead of asking: what you needed, and what it would have taken.";

/**
 * A secret reaches the session as the name of the file that holds it, which the
 * user fills in themselves, as setup takes a tracker key; the value never passes
 * through the conversation, the hand-over or the verifiers. Headless, the need
 * joins the unasked list and no value is ever invented.
 */
export const INTERACTIVE_SECRETS_RULE =
  "When a step needs a secret — a login, a token or a key — ask the user for the name of the file " +
  "that holds it, never the value itself. The user fills that file in themselves; the verifier reads " +
  "the file when it drives the app. The value never appears in this conversation, in HANDOVER.md or in " +
  "the verifier: only the file's name does.";

export const HEADLESS_SECRETS_RULE =
  "When a step needs a secret — a login, a token or a key — record the file you would have asked the user " +
  "to name in the unasked list, with what the value unlocks. Never invent a value, and never write a " +
  "guessed one into the verifier: no value reaches HANDOVER.md or the verifier.";

/** The hand-over's extra section with no host; the interactive hand-over needs none. */
export const HEADLESS_HANDOVER_UNASKED =
  " It also carries an Unasked questions section: each question you could not ask, with what it would " +
  "have needed — the file, the value's purpose, the step it blocked.";

/** The template's mode blocks: the interactive session's, or the headless one's. */
export function modeBlocks(headless: boolean): {
  askRule: string;
  secretsRule: string;
  handoverUnasked: string;
} {
  if (headless) {
    return {
      askRule: HEADLESS_ASK_RULE,
      secretsRule: HEADLESS_SECRETS_RULE,
      handoverUnasked: HEADLESS_HANDOVER_UNASKED,
    };
  }
  return {
    askRule: INTERACTIVE_ASK_RULE,
    secretsRule: INTERACTIVE_SECRETS_RULE,
    handoverUnasked: "",
  };
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

/**
 * The spawn handle: the repo, the session's branch, and a tag from the repo's
 * path, since both hosts check session names globally: the branch numbers
 * past sessions taken in one repo, and the tag keeps two checkouts that share
 * a directory name apart.
 */
export function verifierHandle(repo: string, branch: string): string {
  const tag = createHash("sha256").update(resolve(repo)).digest("hex").slice(0, 8);
  return `verifier-${basename(repo)}-${branch}-${tag}`;
}

/**
 * The short first message the tab gets, clerk-style: the full instructions live
 * in the prompt file, and the session reads them there.
 */
export function sendText(promptFile: string): string {
  return (
    "You are making a verifier for one surface of a project. " +
    `Read your instructions at ${promptFile}, then follow them. ` +
    "This directory is your working copy.\n"
  );
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

/** Naps between handover checks: short enough that a small timeout keeps its shape. */
export const HANDOVER_NAP_SECONDS = 5;

/**
 * True once the worktree holds a HANDOVER.md this session wrote. An interactive
 * session has no marker, so its arrival is the completion signal; the prompt
 * orders the commit before it. The clock and the sleep are injected for tests.
 */
export function waitForHandover(
  wt: string,
  cutMs: number,
  timeoutSec: number,
  sleepMs: (ms: number) => void = (ms) => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  },
  nowMs: () => number = Date.now,
): boolean {
  const deadline = nowMs() + timeoutSec * 1000;
  for (;;) {
    const written = handoverMtimeMs(join(wt, "HANDOVER.md"));
    if (written !== null && handoverFresh(written, cutMs)) return true;
    const left = deadline - nowMs();
    if (left <= 0) return false;
    sleepMs(Math.min(left, HANDOVER_NAP_SECONDS * 1000));
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
    ...modeBlocks(req.headless),
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

/** Seconds one send waits for the session's turn, and how many sends before make gives up. */
export const SEND_WAIT_SECONDS = 60;
export const SEND_ATTEMPTS = 3;

/** What a `host send --wait` result means for delivery. */
export type SendVerdict = "sent" | "retry" | "failed";

/**
 * Read a `host send --wait` result. Exit 0 settled, and exit 3 short of
 * settling still received the instructions, so both proceed; exit 3 with no
 * turn started means the prompt was dropped and the send goes again; a
 * session that took the prompt and then stopped at an approval or a question
 * keeps its instructions while the user answers in the watched tab, so it
 * proceeds too. A block met before the prompt was accepted never received
 * it. Anything else failed.
 */
export function sendVerdict(code: number, output: string): SendVerdict {
  if (code === 0) return "sent";
  if (code === 3 && output.includes("did not settle")) return "sent";
  if (code === 3 && output.includes("no turn start")) return "retry";
  if (code === 3 && output.includes("stopped at an approval or a question")) return "sent";
  return "failed";
}

/**
 * Send the instructions with receipt confirmation: `host send --wait` reports
 * a dropped prompt as no turn started, and the send goes again, bounded, with
 * a read first (hosts.md). A handle the read cannot reach never registered,
 * so retrying is futile and the failure says so. The runner is injected for
 * tests. Tmux panes exec the harness directly, so the paste waits in the pty
 * buffer until the harness reads it; no readiness check is needed there.
 */
export function deliverInstructions(
  runFn: (args: string[]) => { code: number; out: string; err: string },
  handle: string,
  sendFile: string,
): { delivered: boolean; attempts: number; lastError: string } {
  let lastError = "";
  for (let attempt = 1; attempt <= SEND_ATTEMPTS; attempt++) {
    const sent = runFn(["host", "send", handle, sendFile, "--wait", String(SEND_WAIT_SECONDS)]);
    const text = `${sent.out}\n${sent.err}`;
    const verdict = sendVerdict(sent.code, text);
    if (verdict === "sent") return { delivered: true, attempts: attempt, lastError: "" };
    lastError = text.trim() || `exit ${sent.code}`;
    if (verdict === "failed") return { delivered: false, attempts: attempt, lastError };
    if (attempt === SEND_ATTEMPTS) return { delivered: false, attempts: attempt, lastError };
    const read = runFn(["host", "read", handle, "20"]);
    if (read.code !== 0) {
      return {
        delivered: false,
        attempts: attempt,
        lastError: `the session never registered under ${handle}: ${(read.out + read.err).trim() || `exit ${read.code}`}`,
      };
    }
  }
  return { delivered: false, attempts: SEND_ATTEMPTS, lastError };
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
  const promptVars = {
    repo,
    surface: req.surface,
    surfaceProse: surfaceProse(req.surface),
    verifyDir: vdir,
    base,
  };
  writeFileSync(promptFile, renderPrompt(readTemplate(), { ...promptVars, ...modeBlocks(false) }));
  const named = run(RUN, ["host", "name", dispatch, "role", `verifier-${req.surface}`]);
  if (named.code !== 0) {
    throw new RunError(`the launch could not be named: ${named.err.trim() || named.out.trim()}`);
  }
  const name = named.out.trim();
  const form = formOrNull(wt, name);
  const handle = verifierHandle(repo, branch);
  const spawned =
    form === null
      ? null
      : run(RUN, ["host", "spawn", handle, wt, "--label", name, "--", ...spawnCommand(wt, form)]);
  if (spawned === null || spawned.code === 3) {
    // No session host keeps an interactive session: run headless, as #323 did,
    // with the no-host instructions, which report what could not be asked. The
    // prompt file holds what the session read either way.
    writeFileSync(promptFile, renderPrompt(readTemplate(), { ...promptVars, ...modeBlocks(true) }));
    return runHeadless(
      req,
      dispatch,
      base,
      branch,
      wt,
      vdir,
      name,
      logs,
      promptFile,
      sessionStarted,
      cutAt,
    );
  }
  if (spawned.code !== 0) {
    throw new RunError(
      `the verifier session could not start: ${(spawned.out + spawned.err).trim() || `exit ${spawned.code}`}`,
    );
  }
  if (!spawned.out.includes("handle=")) {
    throw new RunError(
      `the verifier session started but the host did not confirm its handle (${spawned.out.trim()})`,
    );
  }
  sessionStarted.started = true;
  const sendFile = join(logs, `verifier-${branch}-send.txt`);
  writeFileSync(sendFile, sendText(promptFile));
  const delivery = deliverInstructions((args) => run(RUN, args), handle, sendFile);
  if (!delivery.delivered) {
    const tries =
      delivery.attempts === 1
        ? "could not be sent"
        : `could not be sent after ${delivery.attempts} tries`;
    const failed = `the instructions ${tries}: ${delivery.lastError}; the session was left open in ${handle}`;
    logInteractive(dispatch, req.surface, branch, handle, failed);
    throw new RunError(`${failed}; read the session and resend if it is idle`);
  }
  logInteractive(dispatch, req.surface, branch, handle, "");
  if (!waitForHandover(wt, cutAt, req.timeout)) {
    const failed = `the verifier session is still running after ${req.timeout} seconds; it was left open in ${handle}`;
    logInteractive(dispatch, req.surface, branch, handle, failed);
    throw new RunError(failed);
  }
  try {
    validateSession(wt, base, branch, vdir, cutAt);
  } catch (e) {
    logInteractive(
      dispatch,
      req.surface,
      branch,
      handle,
      e instanceof Error ? e.message : String(e),
    );
    throw e;
  }
  for (const line of [
    `branch ${branch}`,
    `base ${base}`,
    `worktree ${wt}`,
    `role coachman`,
    `handle ${handle}`,
    `prompt ${promptFile}`,
    `handover ${join(wt, "HANDOVER.md")}`,
  ]) {
    console.log(line);
  }
  return 0;
}

/**
 * The coachman role's interactive form, split for spawn. The form comes from the
 * live global config, as the clerk's does: run launch interactive takes no --run.
 * The leg is synthesis, as on the headless path, so a per-leg coachman agrees.
 */
function interactiveForm(wt: string, name: string): string[] {
  const printed = run(RUN, [
    "launch",
    "interactive",
    "coachman",
    "--project",
    wt,
    "--name",
    name,
    "--leg",
    "synthesis",
  ]);
  const form = printed.code === 0 ? splitCommand(printed.out) : [];
  if (form.length === 0) {
    throw new RunError(
      `run launch printed no interactive command for the coachman${printed.code === 0 ? "" : `: ${(printed.out + printed.err).trim() || `exit ${printed.code}`}`}`,
    );
  }
  return form;
}

/** Single-quote a word for sh, the twin of host.ts's quote, which stays there. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/gu, "'\\''")}'`;
}

/**
 * The argv spawn runs: the form wrapped so it starts in the worktree even when
 * the pane opens elsewhere. host spawn may place a linked worktree's pane at
 * the repo root instead (tool-fault, run 344), so the wrapper cds explicitly,
 * as host run's own pane line does, and execs the form, so the pane lists the
 * session itself, with the harness as the pane's own process as before.
 */
export function spawnCommand(wt: string, form: string[]): string[] {
  return ["bash", "-c", `cd -- ${shellQuote(wt)} && exec "$@"`, "_", ...form];
}

/**
 * The interactive form, or null when it would not print and no host could take
 * it: the form is only needed for the spawn, so with no host a broken coachman
 * entry still runs headless on the run's recorded config.
 */
function formOrNull(wt: string, name: string): string[] | null {
  try {
    return interactiveForm(wt, name);
  } catch (e) {
    if (!(e instanceof RunError)) throw e;
    const detected = run(RUN, ["host", "detect"]);
    if (detected.code === 0 && detected.out.trim() === "none") return null;
    throw e;
  }
}

/** One dispatch line for the interactive session, on success and past the spawn. */
function logInteractive(
  dispatch: string,
  surface: string,
  branch: string,
  handle: string,
  failed: string,
): void {
  const detail =
    `interactive handle ${handle} branch ${branch}` + (failed === "" ? "" : ` failed: ${failed}`);
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

/** The no-host session: the headless launches, as #323 ran them. */
function runHeadless(
  req: ParsedMake,
  dispatch: string,
  base: string,
  branch: string,
  wt: string,
  vdir: string,
  name: string,
  logs: string,
  promptFile: string,
  sessionStarted: { started: boolean },
  cutAt: number,
): number {
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
  validateSession(wt, base, branch, vdir, cutAt);
  for (const line of [
    `branch ${branch}`,
    `base ${base}`,
    `worktree ${wt}`,
    `role ${final.role}`,
    `thread ${final.thread}`,
    `prompt ${promptFile}`,
    `stream ${final.stream}`,
    `handover ${join(wt, "HANDOVER.md")}`,
  ]) {
    console.log(line);
  }
  return 0;
}

/**
 * The session's deliverables, on either path: a fresh handover, commits past the
 * base, the verifier's front page and at least three feature pages.
 */
function validateSession(
  wt: string,
  base: string,
  branch: string,
  vdir: string,
  cutAt: number,
): void {
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
}

function main(argv: string[]): number {
  // The verifier names every repo explicitly, so inherited git redirectors
  // can only corrupt: drop them for this process and every session it starts.
  for (const k of GIT_REDIRECT_ENV) delete process.env[k];
  try {
    const parsed = parseArgs(argv);
    if (!parsed.ok) throw new UsageError(parsed.error);
    if (parsed.req.cmd === "prompt") return runPrompt(parsed.req);
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
