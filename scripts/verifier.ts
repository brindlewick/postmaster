// Make a verifier for one surface of a project: one model session, in a worktree of its
// own, writes the verifier and proves it once before handing it over (#323).
//
//   run verifier prompt <repo> <surface>
//   run verifier make <repo> <surface> --run <dispatch> [--timeout <seconds>]
//
//   surface    cli | web | library: the surface the verifier covers
//   prompt     print the session's instructions for the repo and surface
//   make       cut a worktree on a branch of its own beside the repo, removed again
//              when make fails before any session starts, render the prompt,
//              launch the coachman role headless through run launch under run host, wait,
//              fall back to coachman_fallback on a provider wall read from the session
//              stream, stop the session at the limit by the pid host recorded, and log
//              one dispatch action per launch
//   --timeout  seconds to wait for the session (default 3600, at most 9 digits)
//
//   exit 0  prompt printed; make: the session ended with no wall and HANDOVER.md present
//   exit 1  make failed: the launch would not start, the session was still running at the
//           limit, both roles walled, the handover, commit or verifier is missing, or the
//           action was not logged
//   exit 2  usage: an unknown command or surface, a missing argument, a bad timeout, a path
//           that is not a git repository or not its top, a repo holding no commit, or no
//           run at the dispatch
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { endingWallMessage, isWallMessage } from "./launch.ts";
import { beside, scriptsDir } from "./lib/paths.ts";
import { run } from "./lib/proc.ts";

const USAGE = `usage: run verifier prompt <repo> <surface>
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

/** Discovery check names accepted as surfaces, with the kind each denotes. */
const DISCOVERY_SURFACES: Record<string, Surface> = {
  "cli-examples": "cli",
  "browser-suite": "web",
  "web-journey": "web",
  "library-tests": "library",
};

/** The surface kind a name denotes, in either vocabulary, or null. */
export function surfaceKind(name: string): Surface | null {
  if (isSurface(name)) return name;
  return DISCOVERY_SURFACES[name] ?? null;
}

/** Distinct kinds in canonical cli, web, library order. */
export function orderKinds(kinds: Surface[]): Surface[] {
  return SURFACES.filter((k) => kinds.includes(k));
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
    if (argv.length !== 3) return { ok: false, error: "prompt takes a repo and a surface" };
    return { ok: true, req: { cmd, repo, surface } };
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
  handoverRule?: string;
}

/** Fill a template from explicit names and values. A leftover placeholder throws. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  // One pass, each value through a replacer function: an inserted value is
  // never rescanned, so $ patterns and placeholder-shaped text in a value
  // copy literally instead of expanding or throwing.
  return template.replace(/\{\{[A-Z_]+\}\}/gu, (m) => {
    const v: string | undefined = vars[m.slice(2, -2)];
    if (v === undefined) throw new Error(`unknown placeholder in the prompt template: ${m}`);
    return v;
  });
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
  if (vars.handoverRule !== undefined) known.HANDOVER_RULE = vars.handoverRule;
  return renderTemplate(template, known);
}

/** The upkeep line every verifier carries where an agent reads first. */
export const UPKEEP_LINE =
  "A change which adds, changes or removes a feature updates that feature's page in the same change.";

/** The upkeep line is present, ignoring case and whitespace runs. */
export function hasUpkeepLine(text: string): boolean {
  // LOWER: lowered for an ASCII keyword match
  const lower = (s: string): string => s.toLowerCase();
  // ASCII: widening to Unicode whitespace only folds more runs, never splits a match
  const flat = (s: string): string => s.replace(/\s+/gu, " ");
  return flat(lower(text)).includes(flat(lower(UPKEEP_LINE)));
}

/** The index names the kind's folder and its surface prose. */
export function indexNames(text: string, kind: Surface): boolean {
  // LOWER: lowered for an ASCII keyword match
  const lower = text.toLowerCase();
  return lower.includes(`verifier/${kind}`) && lower.includes(PROSE[kind]);
}

/** The kinds as prose for the multi header: "command line, web pages". */
export function proseList(kinds: Surface[]): string {
  return kinds.map((k) => PROSE[k]).join(", ");
}

/** One mapping line per kind for the multi header. */
export function dirLines(kinds: Surface[]): string {
  return kinds.map((k) => `- the ${PROSE[k]} (${k}) verifier goes in verifier/${k}/`).join("\n");
}

/** The no-verifier sentence for the kinds left out, or "" when none are. */
export function unlistedSentence(kinds: Surface[]): string {
  const left = SURFACES.filter((k) => !kinds.includes(k)).map((k) => `the ${PROSE[k]}`);
  if (left.length === 0) return "";
  const last = left.slice(-1).join("");
  const names = left.length === 1 ? last : `${left.slice(0, -1).join(", ")} and ${last}`;
  const it = left.length === 1 ? "it" : "them";
  return `- Make no verifier for ${names}. If you notice ${it} while you work, leave ${it} out.`;
}

/** The per-surface sections, numbered, separated by rules. */
export function joinBodies(bodies: { kind: Surface; text: string }[]): string {
  const total = bodies.length;
  return bodies
    .map(
      (b, n) =>
        `---\n\n**Verifier ${n + 1} of ${total}: ${PROSE[b.kind]} (${b.kind}).**\n\n${b.text}`,
    )
    .join("\n\n");
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

/** A committed blob's text, or null when the branch has no such file. */
export function branchFileText(repo: string, branch: string, path: string): string | null {
  const r = git(repo, ["show", `${branch}:${path}`]);
  return r.code === 0 ? r.out : null;
}

/** Committed paths under a directory on the branch, or null when unlistable. */
export function committedUnder(repo: string, branch: string, dir: string): string[] | null {
  // -z: NUL-separated and never quoted, so non-ASCII names count as written.
  const r = git(repo, ["ls-tree", "-z", "-r", "--name-only", branch, "--", `${dir}/`]);
  if (r.code !== 0) return null;
  return r.out.split("\0").filter((l) => l !== "");
}

/** Top-level names on a ref, or null when the ref cannot be listed. */
export function topLevelNames(repo: string, ref: string): string[] | null {
  // -z: NUL-separated and never quoted, so non-ASCII names list as written.
  const r = git(repo, ["ls-tree", "-z", "--name-only", ref]);
  if (r.code !== 0) return null;
  return r.out.split("\0").filter((l) => l !== "");
}

/** Added top-level names starting with verify-: verifier files outside verifier/. */
export function addedVerifyNames(branchTop: string[], baseTop: string[]): string[] {
  const before = new Set(baseTop);
  return branchTop.filter((n) => n.startsWith("verify-") && !before.has(n));
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

/** The handover paragraph for one verifier: the #323 sentences, byte for byte. */
const SINGLE_HANDOVER_RULE =
  "Then write HANDOVER.md at the top of this working\ncopy: what you proved and under which drive name, where the proof file sits as an\nabsolute path (or why there is none), and what you left undone. Send the same text as\nyour final message.";

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
    handoverRule: SINGLE_HANDOVER_RULE,
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
      handoverRule: SINGLE_HANDOVER_RULE,
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
