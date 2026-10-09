// Blind acceptance oracle for #237: the run layout the ticket's checks judge, with the
// runners and readers the cases need. The cases in walls-oracle.test.ts run the ticket's
// own interface (the coachman's launch step through run host with stub harnesses first on
// PATH, run walls, run runs-status, run runs-watch, run review-round wait) and match only what
// the ticket pins: exits, the wall line's contents, the reset moment, the quoted wordings,
// the needs and NEXT names. Lanes never see these files; at harvest they are
// cherry-picked onto a scratch of each lane and run.
// Covered: C1-C11, C13-C16, C18-C21, and the script half of C22 (skill-refs, the quote
// corpus, the contract entry). Not covered: C12 (the runbook already restores a DEGRADED
// lane; verified by reading); C17 and the postmaster halves of C5, C6, C9, C14 and C18
// (postmaster.md prose, verified by reading); the coachman halves of C13, C14 and C16 and
// the harvest half of C20 (coachman.md prose, verified by reading); C22's fixture run
// (scored at landing).
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { processStart } from "./lib/processes.ts";

export interface Run {
  code: number;
  out: string;
  err: string;
}

export function both(r: Run): string {
  return `${r.out}${r.err}`;
}

const GIT_ENV: Record<string, string | undefined> = {
  ...process.env,
  GIT_AUTHOR_NAME: "walls-oracle",
  GIT_AUTHOR_EMAIL: "oracle@example.invalid",
  GIT_COMMITTER_NAME: "walls-oracle",
  GIT_COMMITTER_EMAIL: "oracle@example.invalid",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
};

export function git(...args: string[]): Run {
  const r = spawnSync("git", args, { encoding: "utf8", env: GIT_ENV });
  return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

export function need(r: Run, what: string): void {
  if (r.code !== 0) throw new Error(`${what} failed with exit ${r.code}: ${both(r)}`);
}

export function sh(
  cmd: string,
  args: string[],
  env: Record<string, string | undefined>,
  cwd?: string,
): Run {
  const r = spawnSync(cmd, args, { encoding: "utf8", env, cwd });
  return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

// The two provider messages the ticket quotes verbatim, byte for byte: the Codex wall
// uses U+2019, the Claude limit an ASCII apostrophe and U+00B7.
export const CODEX_WALL_MESSAGE =
  "You’ve hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/codex/settings/usage to purchase more credits or try again at 2:29 AM.";
export const CLAUDE_WALL_MESSAGE = "You've hit your weekly limit · resets 3am (UTC)";

// --- stub harness streams ----------------------------------------------------

export function codexThread(id: string): string {
  return JSON.stringify({ type: "thread.started", thread_id: id });
}

export function codexWall(message: string): string {
  return JSON.stringify({ type: "turn.failed", error: { message } });
}

export function codexCmdFailed(command: string, output: string): string {
  return JSON.stringify({
    type: "item.completed",
    item: {
      type: "command_execution",
      command,
      aggregated_output: output,
      exit_code: 1,
      status: "failed",
    },
  });
}

export function codexProse(text: string): string {
  return JSON.stringify({ type: "item.completed", item: { type: "agent_message", text } });
}

export function codexDone(): string {
  return JSON.stringify({
    type: "turn.completed",
    usage: { input_tokens: 7, output_tokens: 3 },
  });
}

export function claudeInit(id: string): string {
  return JSON.stringify({ type: "system", subtype: "init", session_id: id, model: "test-model" });
}

export function claudeWall(): string {
  return JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: true,
    result: CLAUDE_WALL_MESSAGE,
    api_error_status: 429,
  });
}

export function claudeErrorResult(result: string, status: number): string {
  return JSON.stringify({
    type: "result",
    subtype: "error",
    is_error: true,
    result,
    api_error_status: status,
  });
}

export function mimoStart(id: string): string {
  return JSON.stringify({ type: "step_start", sessionID: id, part: {} });
}

export function mimoText(id: string, text: string): string {
  return JSON.stringify({ type: "text", sessionID: id, part: { type: "text", text } });
}

export function mimoToolError(id: string, tool: string, command: string, output: string): string {
  return JSON.stringify({
    type: "tool_use",
    sessionID: id,
    part: {
      type: "tool",
      tool,
      state: {
        status: "error",
        input: { command },
        output,
        metadata: { exit: 1 },
      },
    },
  });
}

export function mimoError(id: string, name: string, message: string): string {
  return JSON.stringify({
    type: "error",
    sessionID: id,
    error: { name, data: { message } },
  });
}

export function mimoFinish(id: string): string {
  return JSON.stringify({ type: "step_finish", sessionID: id, part: { reason: "stop" } });
}

// --- layout ------------------------------------------------------------------

export interface Layout {
  tmp: string;
  home: string;
  stubDir: string;
  calls: string;
  repo: string;
  root: string;
  dispatch: string;
  syn: string;
  prompt: string;
  config: string;
  env: Record<string, string | undefined>;
  cleanup(): void;
}

function writeStub(bin: string, harness: string): void {
  // Log the call, print the case's events, run the case's setup, exit its code.
  writeFileSync(
    join(bin, harness),
    `#!/bin/sh\necho "${harness} $@" >> "$WALLS_CALLS"\ncat "$WALLS_STUB_DIR/${harness}.events" 2>/dev/null\nif [ -f "$WALLS_STUB_DIR/${harness}.setup" ]; then . "$WALLS_STUB_DIR/${harness}.setup"; fi\ncode=$(cat "$WALLS_STUB_DIR/${harness}.exit" 2>/dev/null)\nexit "\${code:-0}"\n`,
  );
  chmodSync(join(bin, harness), 0o755);
}

function writeDead(bin: string, harness: string): void {
  writeFileSync(
    join(bin, harness),
    `#!/bin/sh\necho "oracle: ${harness} must not run" >&2\nexit 1\n`,
  );
  chmodSync(join(bin, harness), 0o755);
}

export function makeLayout(repoRoot: string): Layout {
  void repoRoot;
  const tmp = mkdtempSync(join(tmpdir(), "walls-oracle-"));
  const home = join(tmp, "home");
  const bin = join(tmp, "bin");
  const stubDir = join(tmp, "stub");
  const calls = join(tmp, "calls.log");
  const repo = join(tmp, "proj");
  const root = join(repo, ".postmaster", "runs");
  const dispatch = join(root, "T");
  const syn = join(repo, ".worktrees", "T");
  mkdirSync(home, { recursive: true });
  mkdirSync(bin, { recursive: true });
  mkdirSync(stubDir, { recursive: true });
  mkdirSync(join(dispatch, "logs"), { recursive: true });
  mkdirSync(syn, { recursive: true });
  for (const h of ["codex", "claude", "mimo", "grok"]) writeStub(bin, h);
  for (const h of ["muse", "pi", "agy", "herdr", "tmux"]) writeDead(bin, h);

  need(git("init", "-q", "-b", "main", repo), "init repo");
  writeFileSync(join(repo, "README.md"), "oracle fixture\n");
  need(git("-C", repo, "add", "README.md"), "add readme");
  need(git("-C", repo, "commit", "-qm", "init"), "commit init");

  const prompt = join(tmp, "prompt.txt");
  writeFileSync(prompt, "Do the ticketed thing.\n");
  const config = join(tmp, "config.toml");
  writeFileSync(config, "[postmaster]\npoll_seconds = 1\n");

  writeFileSync(
    join(dispatch, "run.json"),
    `${JSON.stringify(
      {
        config: {
          confine: "off",
          lanes: {
            stub: { harness: "codex", model: "stub-model", effort: "high" },
            mimo: { harness: "mimo", model: "p/mimo-model", effort: "high" },
            sec: { harness: "claude", model: "sec-model", effort: "max" },
            grok: { harness: "grok", model: "grok-model", effort: "max" },
          },
          team: { workhorses: ["stub", "mimo"] },
          review: { round_timeout_seconds: 2400 },
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(dispatch, "manifest.json"),
    `${JSON.stringify(
      {
        stage: "workhorses-running",
        leg: 1,
        lanes: { stub: { outcome: "approved" }, mimo: { outcome: "approved" } },
        coachman: { legs: { 1: { thread_id: "T-oracle-1", name: "coachman" } } },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(dispatch, "brief.md"),
    `# Waybill: T\nturnpikes: style, bug, security\n\n## Ticket\n\n## Project profile\nrepo: ${repo}\n\n## Dispatch\nname: #1, Oracle fixture\nsynthesis worktree: ${syn}\n`,
  );
  writeFileSync(join(dispatch, "run-log.md"), "");
  writeFileSync(join(dispatch, "actions.jsonl"), "");
  writeFileSync(join(root, "ledger.jsonl"), "");

  const env: Record<string, string | undefined> = { ...process.env };
  delete env.POSTMASTER_LAUNCH_NAME;
  delete env.POSTMASTER_LAUNCH_ROLE;
  env.PATH = `${bin}:${process.env.PATH ?? ""}`;
  env.HOME = home;
  env.WALLS_CALLS = calls;
  env.WALLS_STUB_DIR = stubDir;
  env.POSTMASTER_HOST = "none";
  env.POSTMASTER_HOST_STATE = join(tmp, "host");
  env.POSTMASTER_HOST_STOP_WAIT = "5";
  env.POSTMASTER_HOST_CLOSE_WAIT = "1";
  env.POSTMASTER_CONFIG = config;
  env.TZ = "UTC";

  return {
    tmp,
    home,
    stubDir,
    calls,
    repo,
    root,
    dispatch,
    syn,
    prompt,
    config,
    env,
    cleanup: () => {
      rmSync(tmp, { recursive: true, force: true });
    },
  };
}

export function setStub(
  lay: Layout,
  harness: string,
  events: string[],
  exit: number,
  setup?: string,
): void {
  writeFileSync(join(lay.stubDir, `${harness}.events`), `${events.join("\n")}\n`);
  writeFileSync(join(lay.stubDir, `${harness}.exit`), `${exit}\n`);
  rmSync(join(lay.stubDir, `${harness}.setup`), { force: true });
  if (setup !== undefined) writeFileSync(join(lay.stubDir, `${harness}.setup`), `${setup}\n`);
}

export function callCount(lay: Layout): number {
  try {
    return readFileSync(lay.calls, "utf8")
      .split("\n")
      .filter((l) => l !== "").length;
  } catch {
    return 0;
  }
}

export function mkWt(lay: Layout, name: string): string {
  const wt = join(lay.tmp, name);
  mkdirSync(wt, { recursive: true });
  return wt;
}

export function mkScratch(lay: Layout, name: string): { wt: string; base: string } {
  const wt = join(lay.tmp, name);
  need(git("init", "-q", "-b", "main", wt), `init ${name}`);
  writeFileSync(join(wt, "file.txt"), "scratch\n");
  need(git("-C", wt, "add", "file.txt"), `add ${name}`);
  need(git("-C", wt, "commit", "-qm", "base"), `commit ${name}`);
  const head = git("-C", wt, "rev-parse", "HEAD");
  need(head, `head ${name}`);
  return { wt, base: head.out.trim() };
}

export function mkRun(lay: Layout, name: string): string {
  const d = join(lay.root, name);
  mkdirSync(join(d, "logs"), { recursive: true });
  for (const f of ["run.json", "manifest.json", "brief.md", "run-log.md"]) {
    writeFileSync(join(d, f), readFileSync(join(lay.dispatch, f)));
  }
  writeFileSync(join(d, "actions.jsonl"), "");
  return d;
}

export function patchRunJson(dispatch: string, patch: Record<string, unknown>): void {
  const p = join(dispatch, "run.json");
  const data = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
  Object.assign(data, patch);
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
}

export function patchManifestLanes(dispatch: string, lanes: Record<string, unknown>): void {
  const p = join(dispatch, "manifest.json");
  const data = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
  data.lanes = lanes;
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
}

export interface LaunchOpts {
  lane: string;
  role: "lane" | "reviewer";
  form: "launch" | "review";
  stream: string;
  marker: string;
  cwd: string;
  base?: string;
  dispatch?: string;
}

export function launchStep(repoRoot: string, lay: Layout, o: LaunchOpts): void {
  const scripts = join(repoRoot, "scripts");
  const d = o.dispatch ?? lay.dispatch;
  const streamPath = join(d, "logs", o.stream);
  const errPath = `${streamPath}.err`;
  const lastPath = `${streamPath}.last.md`;
  const inner =
    o.form === "launch"
      ? ["launch", o.lane, o.cwd, lay.prompt]
      : ["review", o.lane, o.cwd, o.base ?? ""];
  const r = sh(
    join(scripts, "run"),
    [
      "host",
      "run",
      `oracle-${o.lane}-${o.role}`,
      o.cwd,
      "--under",
      d,
      "--role",
      o.role,
      "--run",
      d,
      "--out",
      streamPath,
      "--err",
      errPath,
      "--marker",
      join(d, "logs", o.marker),
      "--",
      join(scripts, "run"),
      "launch",
      ...inner,
      "--last",
      lastPath,
      "--run",
      d,
    ],
    lay.env,
    lay.tmp,
  );
  if (r.code !== 0) throw new Error(`run host run failed with exit ${r.code}: ${both(r)}`);
  waitMarker(join(d, "logs", o.marker), errPath, 30);
}

export function waitMarker(markerPath: string, errPath: string, timeoutSec: number): void {
  // A tight poll: run wait-for-markers naps 20s between looks, which would put
  // a blind oracle with dozens of launches to sleep.
  const shared = new Int32Array(new SharedArrayBuffer(4));
  for (let i = 0; i < timeoutSec * 10; i++) {
    try {
      if (statSync(markerPath).isFile()) return;
    } catch {
      /* not yet */
    }
    Atomics.wait(shared, 0, 0, 100);
  }
  let err = "";
  try {
    err = readFileSync(errPath, "utf8");
  } catch {
    err = "";
  }
  throw new Error(`marker ${markerPath} never landed within ${timeoutSec}s\n--- err ---\n${err}`);
}

// --- readers -----------------------------------------------------------------

export interface ActionLine {
  ts: string;
  action: string;
  target: string;
  detail: string;
  raw: string;
}

export function readActions(dispatch: string): ActionLine[] {
  let text = "";
  try {
    text = readFileSync(join(dispatch, "actions.jsonl"), "utf8");
  } catch {
    return [];
  }
  const out: ActionLine[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const rec = JSON.parse(line) as Record<string, unknown>;
    out.push({
      ts: typeof rec.ts === "string" ? rec.ts : "",
      action: typeof rec.action === "string" ? rec.action : "",
      target: typeof rec.target === "string" ? rec.target : "",
      detail: typeof rec.detail === "string" ? rec.detail : "",
      raw: line,
    });
  }
  return out;
}

export function wallLines(dispatch: string): ActionLine[] {
  return readActions(dispatch).filter((l) => l.action === "wall");
}

// Everything a case may match on: the target, the detail, and any extra object
// the lane's line carries, but never the line's own ts, project, run or actor.
export function lineBody(l: ActionLine): string {
  const rec = JSON.parse(l.raw) as Record<string, unknown>;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(rec)) {
    if (k === "ts" || k === "project" || k === "run" || k === "actor" || k === "action") continue;
    parts.push(typeof v === "string" ? v : JSON.stringify(v));
  }
  return parts.join("\n");
}

const ISO_RE =
  /([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(?::[0-9]{2})?(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:?[0-9]{2}))/gu;

export function findIsos(text: string): Array<{ raw: string; epoch: number }> {
  const out: Array<{ raw: string; epoch: number }> = [];
  for (const m of text.matchAll(ISO_RE)) {
    const epoch = Date.parse(m[1] ?? "");
    if (Number.isFinite(epoch)) out.push({ raw: m[1] ?? "", epoch });
  }
  return out;
}

// The first HH:MM (machine zone, which the oracle pins to UTC) at or after the
// mark, per D4 and the technical notes: a time alone is its first occurrence no
// earlier than five minutes before the wall line.
export function expectedDaily(hour: number, minute: number, wallTs: string): number {
  const wall = Date.parse(wallTs);
  const mark = wall - 5 * 60 * 1000;
  const d = new Date(mark);
  let cand = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute, 0, 0);
  if (cand < mark) cand += 24 * 60 * 60 * 1000;
  return cand;
}

export function nextOf(repoRoot: string, lay: Layout, run: string): string {
  const r = sh(join(repoRoot, "scripts", "run"), ["runs-status", lay.root], lay.env, lay.tmp);
  need(r, "runs-status");
  for (const line of r.out.split("\n")) {
    const cells = line.trim().split(/[ \t\n]+/u);
    if (cells[0] === run) return cells[cells.length - 1] ?? "";
  }
  throw new Error(`no status row for ${run}:\n${r.out}`);
}

export function touchEpoch(path: string, epochSec: number): void {
  utimesSync(path, epochSec, epochSec);
}

export function liveLock(dispatch: string, leg: string): void {
  // The lock's owner is this test run, alive throughout it.
  const start = processStart(process.pid);
  if (start === null) throw new Error("the oracle's own start time is unreadable");
  writeFileSync(join(dispatch, `.leg-${leg}-active`), `${process.pid} ${start}\n`);
}

export function ageFiles(dir: string, secondsAgo: number): void {
  const t = Date.now() / 1000 - secondsAgo;
  const walk = (d: string): void => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else {
        try {
          utimesSync(p, t, t);
        } catch {
          /* ignore */
        }
      }
    }
  };
  walk(dir);
}

export function validHandoff(dispatch: string, n: string): void {
  writeFileSync(
    join(dispatch, `handoff-${n}.md`),
    "## Decisions\nsettled\n## Deferred findings\nnone\n## Verified by execution\nnone\n## Unverified\nnone\n## Branches and lanes\nnone\n## Open questions\nnone\n## Next leg\nnone\n",
  );
}

export function watch(
  repoRoot: string,
  lay: Layout,
  timeout: string,
  extraEnv?: Record<string, string>,
): Run {
  return sh(
    join(repoRoot, "scripts", "run"),
    ["runs-watch", lay.root, "--timeout", timeout],
    { ...lay.env, ...extraEnv },
    lay.tmp,
  );
}

export function watchTest(repoRoot: string, lay: Layout, callsDir: string): Run {
  mkdirSync(callsDir, { recursive: true });
  return sh(
    join(repoRoot, "scripts", "run"),
    ["runs-watch", lay.root, "--timeout", "0"],
    { ...lay.env, POSTMASTER_WATCH_TEST_MODE: "1", POSTMASTER_WATCH_TEST_CALLS: callsDir },
    lay.tmp,
  );
}

export function walls(repoRoot: string, lay: Layout, ...args: string[]): Run {
  return sh(join(repoRoot, "scripts", "run"), ["walls", ...args], lay.env, lay.tmp);
}

export function wallsEnv(
  repoRoot: string,
  lay: Layout,
  extraEnv: Record<string, string>,
  ...args: string[]
): Run {
  return sh(
    join(repoRoot, "scripts", "run"),
    ["walls", ...args],
    { ...lay.env, ...extraEnv },
    lay.tmp,
  );
}
