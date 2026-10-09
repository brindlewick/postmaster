// Make a verifier for one surface of a project: one model session, in a worktree of its
// own, writes the verifier and proves it once before handing it over (#323).
//
//   run verifier prompt <repo> <surface>
//   run verifier make <repo> <surface> --run <dispatch> [--timeout <seconds>]
//
//   surface    cli | web | library: the surface the verifier covers
//   prompt     print the session's instructions for the repo and surface
//   make       cut a worktree on a branch of its own beside the repo, render the prompt,
//              launch the coachman role headless through run launch under run host, wait,
//              fall back to coachman_fallback on a provider wall, stop the session at the
//              limit by the pid host recorded, and log one dispatch action per launch
//   --timeout  seconds to wait for the session (default 3600, at most 9 digits)
//
//   exit 0  prompt printed; make: the session ended with no wall and HANDOVER.md present
//   exit 1  make failed: the launch would not start, the session was still running at the
//           limit, both roles walled, the handover is missing, or the action was not logged
//   exit 2  usage: an unknown command or surface, a missing argument, a bad timeout, a repo
//           that is not a git repository or holds no commit, or no run at the dispatch
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
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

export type Parsed =
  | { ok: true; req: ParsedPrompt | ParsedMake }
  | { ok: false; error: string };

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
      if (value === undefined || !/^[0-9]{1,9}$/.test(value) || Number(value) <= 0) {
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
}

/** Fill the template's placeholders. A placeholder left over is a bug, and throws. */
export function renderPrompt(template: string, vars: PromptVars): string {
  const out = template
    .replaceAll("{{REPO}}", vars.repo)
    .replaceAll("{{SURFACE}}", vars.surface)
    .replaceAll("{{SURFACE_PROSE}}", vars.surfaceProse)
    .replaceAll("{{VERIFY_DIR}}", vars.verifyDir);
  const left = out.match(/{{[A-Z_]+}}/);
  if (left !== null) throw new Error(`unknown placeholder in the prompt template: ${left[0]}`);
  return out;
}

/** The verifier folder for a repo: verify- plus its slugged base name. */
export function verifyDirName(repoPath: string): string {
  const slug = basename(repoPath)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

/** The base the session's branch is cut from: origin's head, main, master, or HEAD. */
export function defaultBase(repo: string): string | null {
  const sym = run("git", ["-C", repo, "symbolic-ref", "refs/remotes/origin/HEAD"]);
  if (sym.code === 0) {
    const name = remoteFromSymbolicRef(sym.out);
    if (
      name !== null &&
      run("git", ["-C", repo, "rev-parse", "--verify", "--quiet", name]).code === 0
    ) {
      return name;
    }
  }
  for (const b of ["main", "master"]) {
    if (run("git", ["-C", repo, "show-ref", "--verify", "--quiet", `refs/heads/${b}`]).code === 0) {
      return b;
    }
  }
  const head = run("git", ["-C", repo, "rev-parse", "HEAD"]);
  if (head.code === 0) return head.out.trim();
  return null;
}

/** The wall detail for a role in the action lines, or null when it never walled. */
export function wallForRole(lines: string[], role: string): string | null {
  for (const line of lines) {
    let row: unknown;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof row !== "object" || row === null || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    if (r["action"] === "wall" && r["target"] === role) {
      return typeof r["detail"] === "string" ? r["detail"] : "";
    }
  }
  return null;
}

class UsageError extends Error {}
class RunError extends Error {}

function isRepo(repo: string): boolean {
  return run("git", ["-C", repo, "rev-parse", "--git-dir"]).code === 0;
}

function branchTaken(repo: string, name: string): boolean {
  return run("git", ["-C", repo, "show-ref", "--verify", "--quiet", `refs/heads/${name}`]).code === 0;
}

function readTemplate(): string {
  return readFileSync(join(scriptsDir(import.meta), "verifier-prompt.md"), "utf8");
}

function runPrompt(req: ParsedPrompt): number {
  const repo = resolve(req.repo);
  if (!isRepo(repo)) throw new UsageError(`not a git repository: ${req.repo}`);
  const out = renderPrompt(readTemplate(), {
    repo,
    surface: req.surface,
    surfaceProse: surfaceProse(req.surface),
    verifyDir: verifyDirName(repo),
  });
  process.stdout.write(out);
  return 0;
}

function readActionLines(dispatch: string): string[] {
  try {
    return readFileSync(join(dispatch, "actions.jsonl"), "utf8")
      .split("\n")
      .filter((l) => l !== "");
  } catch {
    return [];
  }
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
}

function launchAndWait(o: {
  role: string;
  leg: string[];
  wt: string;
  name: string;
  logs: string;
  branch: string;
  promptFile: string;
  dispatch: string;
  timeout: number;
}): Attempt {
  const base = join(o.logs, `verifier-${o.branch}-${o.role}`);
  const stream = `${base}-events.jsonl`;
  const errFile = `${base}.err`;
  const marker = `${base}.done`;
  const pidFile = `${base}.pid`;
  const before = readActionLines(o.dispatch).length;
  const started = run(RUN, [
    "host",
    "run",
    o.name,
    o.wt,
    "--under",
    o.dispatch,
    "--role",
    "lane",
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
    ...o.leg,
    "--run",
    o.dispatch,
  ]);
  if (started.code !== 0) {
    throw new RunError(
      `the host would not start the ${o.role} session: ${fileText(errFile) || started.err.trim() || `exit ${started.code}`}`,
    );
  }
  const waited = run(RUN, [
    "wait-for-markers",
    o.logs,
    basename(marker),
    "1",
    String(o.timeout),
  ]);
  if (waited.code === 3) {
    run(RUN, ["host", "stop", o.wt]);
    throw new RunError(
      `the ${o.role} session was still running after ${o.timeout} seconds; stopped`,
    );
  }
  if (waited.code !== 0) {
    throw new RunError(`waiting for the ${o.role} session failed: ${waited.err.trim() || waited.out.trim()}`);
  }
  const wallDetail = wallForRole(readActionLines(o.dispatch).slice(before), o.role);
  const id = run(RUN, ["launch", "thread-id", stream]);
  return {
    role: o.role,
    stream,
    thread: id.code === 0 ? id.out.trim() : "none",
    walled: wallDetail !== null,
    wallDetail: wallDetail ?? "",
  };
}

function logLaunch(dispatch: string, surface: string, branch: string, a: Attempt): void {
  const detail = `thread ${a.thread} role ${a.role} branch ${branch}${a.walled ? " walled" : ""}`;
  const r = run(RUN, ["log-action", dispatch, "coachman", "dispatch", `verifier-${surface}`, detail]);
  if (r.code !== 0) throw new RunError(`the launch was not logged: ${r.err.trim() || r.out.trim()}`);
}

function runMake(req: ParsedMake): number {
  const repo = resolve(req.repo);
  if (!isRepo(repo)) throw new UsageError(`not a git repository: ${req.repo}`);
  const dispatch = resolve(req.dispatch);
  if (!existsSync(join(dispatch, "run.json"))) {
    throw new UsageError(`no run at the dispatch: ${req.dispatch}`);
  }
  const base = defaultBase(repo);
  if (base === null) throw new UsageError(`no commit to cut from in ${req.repo}`);
  const branch = pickBranch((name) => branchTaken(repo, name), req.surface);
  const wt = pickWorktree(repo, req.surface, existsSync);
  const added = run("git", ["-C", repo, "worktree", "add", wt, "-b", branch, base]);
  if (added.code !== 0) {
    throw new RunError(`the worktree would not cut: ${added.err.trim() || added.out.trim()}`);
  }
  const logs = join(dispatch, "logs");
  mkdirSync(logs, { recursive: true });
  const promptFile = join(logs, `verifier-${branch}-prompt.txt`);
  writeFileSync(
    promptFile,
    renderPrompt(readTemplate(), {
      repo,
      surface: req.surface,
      surfaceProse: surfaceProse(req.surface),
      verifyDir: verifyDirName(repo),
    }),
  );
  const named = run(RUN, ["host", "name", dispatch, "role", `verifier-${req.surface}`]);
  if (named.code !== 0) {
    throw new RunError(`the launch could not be named: ${named.err.trim() || named.out.trim()}`);
  }
  const name = named.out.trim();
  const first = launchAndWait({
    role: "coachman",
    leg: ["--leg", "synthesis"],
    wt,
    name,
    logs,
    branch,
    promptFile,
    dispatch,
    timeout: req.timeout,
  });
  logLaunch(dispatch, req.surface, branch, first);
  let final = first;
  if (first.walled) {
    const second = launchAndWait({
      role: "coachman_fallback",
      leg: [],
      wt,
      name,
      logs,
      branch,
      promptFile,
      dispatch,
      timeout: req.timeout,
    });
    logLaunch(dispatch, req.surface, branch, second);
    if (second.walled) {
      throw new RunError(
        `both roles walled: coachman: ${first.wallDetail}; coachman_fallback: ${second.wallDetail}`,
      );
    }
    final = second;
  }
  const handover = join(wt, "HANDOVER.md");
  if (!existsSync(handover)) {
    throw new RunError(`the session ended with no HANDOVER.md in ${wt}`);
  }
  for (const line of [
    `branch ${branch}`,
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
