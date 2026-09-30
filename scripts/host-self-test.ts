import { spawn, spawnSync } from "node:child_process";
import {
  accessSync,
  closeSync,
  constants,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { scriptsDir } from "./lib/paths.ts";

const HERE = scriptsDir(import.meta);
const SELF = join(HERE, "host.sh");
const SCRIPT = join(HERE, "host-self-test.ts");
type Result = { code: number; out: string; err: string };
const sleep = (ms: number) => Bun.sleep(ms);
function exec(
  program: string,
  args: string[] = [],
  options: { cwd?: string; env?: Record<string, string | undefined>; timeout?: number } = {},
): Result {
  const result = spawnSync(program, args, {
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeout,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    code: typeof result.status === "number" ? result.status : 127,
    out: String(result.stdout ?? ""),
    err: String(result.stderr ?? ""),
  };
}
function json(path: string, fallback: any): any {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}
function save(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value));
}
function opt(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}
function flag(path: string): boolean {
  return existsSync(path);
}
function next(st: any, prefix: string): string {
  st.n++;
  return prefix + st.n;
}
function out(value: unknown): void {
  console.log(JSON.stringify({ id: "stub", result: value }));
}
function fail(code: string): never {
  console.error(JSON.stringify({ error: { code, message: code } }));
  process.exit(1);
}
function git(...args: string[]): string {
  return exec("git", args).out.trim();
}
function mainRepo(path: string): string {
  const common = git("-C", path, "rev-parse", "--path-format=absolute", "--git-common-dir");
  return common ? resolve(dirname(common)) : "";
}
function b36(n: number): string {
  let s = "";
  while (n > 0) {
    const r = n % 36;
    n = Math.floor(n / 36);
    s = `${"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[r]!}${s}`;
  }
  return s;
}
function newTab(st: any, ws: string): string {
  st.tab_n[ws] = (st.tab_n[ws] ?? 0) + 1;
  return `${ws}:t${b36(st.tab_n[ws])}`;
}
function space(st: any, label: string, cwd = ""): any {
  const ws = next(st, "w"),
    tab = newTab(st, ws),
    pane = next(st, "p");
  const path = cwd ? resolve(cwd) : null;
  st.spaces[ws] = { label, tokens: {}, panes: [pane], tabs: [tab], path };
  st.panes[pane] = { ws, tab, cwd, tokens: {} };
  st.tabs[tab] = { ws, pane, cwd, label };
  return { workspace: { workspace_id: ws }, tab: { tab_id: tab }, root_pane: { pane_id: pane } };
}
function destroySpace(st: any, ws: string): void {
  const w = st.spaces[ws];
  delete st.spaces[ws];
  if (!w) return;
  for (const tab of w.tabs ?? []) delete st.tabs[tab];
  for (const pane of w.panes ?? []) delete st.panes[pane];
  for (const [cwd, opened] of Object.entries(st.open)) if (opened === ws) delete st.open[cwd];
}
function tokens(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i + 1 < args.length; i++)
    if (args[i] === "--token") {
      const [key, value] = args[i + 1]!.split("=", 2);
      result[key!] = value ?? "";
    }
  return result;
}
async function herdrStub(args: string[]): Promise<void> {
  const stateDir = process.env.STUB ?? ".";
  const callPath = join(stateDir, "herdr.calls");
  writeFileSync(callPath, `${args.join("\t")}\n`, { flag: "a" });
  if (flag(join(stateDir, "herdr.down"))) process.exit(1);
  if (args.length === 1 && args[0] === "agent") {
    console.error("herdr agent commands:\n  kinds: pi|claude|codex");
    process.exit(2);
  }
  const path = join(stateDir, "herdr.json");
  const st = json(path, {
    n: 0,
    spaces: {},
    panes: {},
    tabs: {},
    tab_n: {},
    open: {},
    agents: [],
    prompt: [],
  });
  const command = args.slice(0, 2).join(" ");
  if (command === "workspace list") {
    out({ workspaces: Object.keys(st.spaces).map((workspace_id) => ({ workspace_id })) });
    return;
  }
  if (command === "worktree list") {
    const cwd = opt(args, "--cwd") ?? "";
    const root = mainRepo(cwd);
    if (!root) process.exit(1);
    const output = git("-C", cwd, "worktree", "list", "--porcelain");
    const worktrees = output
      .split("\n\n")
      .filter(Boolean)
      .map((block) => {
        const worktreePath = resolve(block.split("\n", 1)[0]!.slice(9));
        const entry: any = { path: worktreePath, is_linked_worktree: worktreePath !== root };
        if (st.open[worktreePath]) entry.open_workspace_id = st.open[worktreePath];
        return entry;
      });
    const source: any = { repo_root: root, repo_name: basename(root) };
    if (st.open[root]) source.source_workspace_id = st.open[root];
    out({ source, worktrees });
    return;
  }
  if (command === "workspace create") {
    const result = space(st, opt(args, "--label") ?? "", opt(args, "--cwd") ?? "");
    const cwd = resolve(opt(args, "--cwd") ?? "");
    if (mainRepo(cwd) === cwd) st.open[cwd] = result.workspace.workspace_id;
    save(path, st);
    out(result);
    return;
  }
  if (command === "worktree open") {
    const result = space(st, opt(args, "--label") ?? "", opt(args, "--path") ?? "");
    st.open[resolve(opt(args, "--path") ?? "")] = result.workspace.workspace_id;
    save(path, st);
    out(result);
    return;
  }
  if (command === "tab create") {
    const ws = opt(args, "--workspace") ?? "";
    const tab = newTab(st, ws),
      pane = next(st, "p");
    const cwd = opt(args, "--cwd") ?? "";
    const label = opt(args, "--label") ?? "";
    st.spaces[ws].panes.push(pane);
    st.spaces[ws].tabs.push(tab);
    st.panes[pane] = { ws, tab, cwd, tokens: {} };
    st.tabs[tab] = { ws, pane, cwd, label };
    save(path, st);
    out({ tab: { tab_id: tab }, root_pane: { pane_id: pane } });
    return;
  }
  if (command === "tab rename") {
    if (st.tabs[args[2]!]) st.tabs[args[2]!].label = args[3];
    save(path, st);
    return;
  }
  if (command === "tab close") {
    const tab = args[2]!;
    const t = st.tabs[tab];
    delete st.tabs[tab];
    if (t) {
      const ws = t.ws;
      st.spaces[ws].tabs = st.spaces[ws].tabs.filter((id: string) => id !== tab);
      st.spaces[ws].panes = st.spaces[ws].panes.filter((id: string) => id !== t.pane);
      delete st.panes[t.pane];
      if (!st.spaces[ws].tabs.length) destroySpace(st, ws);
    }
    save(path, st);
    return;
  }
  if (command === "pane close") {
    const pane = args[2]!;
    const p = st.panes[pane];
    delete st.panes[pane];
    if (p) {
      const ws = p.ws;
      st.spaces[ws].panes = st.spaces[ws].panes.filter((id: string) => id !== pane);
      for (const tab of [...st.spaces[ws].tabs]) {
        const kept = Object.values(st.panes as Record<string, any>).some(
          (q) => q.ws === ws && (q.tab || tab) === tab,
        );
        if (!kept) {
          st.spaces[ws].tabs = st.spaces[ws].tabs.filter((id: string) => id !== tab);
          delete st.tabs[tab];
        }
      }
      if (!st.spaces[ws].tabs.length) destroySpace(st, ws);
    }
    save(path, st);
    return;
  }
  if (command === "workspace report-metadata") {
    st.spaces[args[2]!].tokens = tokens(args);
    save(path, st);
    return;
  }
  if (command === "pane report-metadata") {
    st.panes[args[2]!].tokens = tokens(args);
    save(path, st);
    return;
  }
  if (command === "workspace get") {
    const w = st.spaces[args[2]!] ?? {};
    out({
      workspace: {
        workspace_id: args[2],
        label: w.label,
        tokens: w.tokens ?? {},
        worktree: { path: w.path ?? null, checkout_path: w.path ?? null },
      },
    });
    return;
  }
  if (command === "workspace close") {
    destroySpace(st, args[2]!);
    save(path, st);
    return;
  }
  if (command === "pane list") {
    const ws = opt(args, "--workspace") ?? "";
    out({
      panes: (st.spaces[ws]?.panes ?? []).map((pane_id: string) => ({
        pane_id,
        tab_id: st.panes[pane_id]?.tab ?? null,
        tokens: st.panes[pane_id]?.tokens ?? {},
      })),
    });
    return;
  }
  if (command === "pane get") {
    out({ pane: { pane_id: args[2], agent: null } });
    return;
  }
  if (command === "pane run") {
    const pane = args[2]!,
      text = args[3]!,
      ws = st.panes[pane].ws;
    save(path, st);
    if (flag(join(stateDir, "pane.dead"))) return;
    const prefix = flag(join(stateDir, "pane.late")) ? "sleep 5; " : "";
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      STUB: stateDir,
      HERDR_ENV: "pane-env",
      HERDR_SOCKET_PATH: "/stub/herdr.sock",
      HERDR_BIN_PATH: "/stub/herdr-bin",
      HERDR_PANE_ID: pane,
      HERDR_TAB_ID: `tab-of-${pane}`,
      HERDR_WORKSPACE_ID: ws,
    };
    const paneOut = openSync(join(stateDir, `pane-${pane}.out`), "a");
    const child = spawn("/bin/bash", ["-c", prefix + text], {
      env,
      detached: true,
      stdio: ["ignore", paneOut, paneOut],
    });
    closeSync(paneOut);
    writeFileSync(join(stateDir, `pane-${pane}.pid`), String(child.pid));
    child.unref();
    return;
  }
  if (command === "agent get") {
    if (!st.agents.includes(args[2])) fail("agent_not_found");
    out({
      agent: {
        name: args[2],
        agent_status: flag(join(stateDir, "agent.blocked")) ? "blocked" : "idle",
      },
    });
    return;
  }
  if (command === "agent start") {
    if (st.agents.includes(args[2])) fail("agent_name_taken");
    st.agents.push(args[2]);
    save(path, st);
    if (flag(join(stateDir, "agent.notready"))) fail("agent_not_ready");
    return;
  }
  if (command === "agent prompt") {
    st.prompt.push(args.slice(2));
    save(path, st);
    if (flag(join(stateDir, "agent.blocked"))) fail("agent_blocked");
    out({ accepted: true });
    return;
  }
  if (command === "agent wait") {
    if (flag(join(stateDir, "agent.blocked"))) fail("agent_blocked");
    out({ settled: true });
    return;
  }
  if (command === "agent read") {
    console.log(`stub screen of ${args[2]}`);
    return;
  }
  return;
}
function tmuxStub(args: string[]): void {
  const stateDir = process.env.STUB ?? ".";
  writeFileSync(join(stateDir, "tmux.calls"), `${args.join("\t")}\n`, { flag: "a" });
  const path = join(stateDir, "tmux.json");
  const st = json(path, { n: 0, sessions: [], windows: {} });
  const fmt = opt(args, "-F") ?? "";
  const flag = (name: string) => args.includes(name);
  const launch = (session: string): void => {
    st.n++;
    const win = `@${st.n}`;
    st.windows[win] = { session, name: opt(args, "-n"), opts: {} };
    if (!st.sessions.includes(session)) st.sessions.push(session);
    save(path, st);
    const pane = `%${st.n}`;
    const env: Record<string, string> = {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "/",
      STUB: stateDir,
      TMUX: "/stub/tmux,1,0",
      TMUX_PANE: pane,
    };
    for (let i = 0; i + 1 < args.length; i++)
      if (args[i] === "-e") {
        const [key, ...value] = args[i + 1]!.split("=");
        env[key!] = value.join("=");
      }
    writeFileSync(
      join(stateDir, `win-${st.n}.env`),
      Object.entries(env)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("\n"),
    );
    const cwdAt = args.indexOf("-c");
    const commandAt = cwdAt < 0 ? args.length : cwdAt + 2;
    const childArgs = args.slice(commandAt);
    if (childArgs.length) {
      const outputFd = openSync(join(stateDir, `win-${st.n}.out`), "a");
      const child = spawn(childArgs[0]!, childArgs.slice(1), {
        cwd: cwdAt < 0 ? undefined : args[cwdAt + 1],
        env,
        detached: true,
        stdio: ["ignore", outputFd, outputFd],
      });
      closeSync(outputFd);
      writeFileSync(join(stateDir, `win-${st.n}.pid`), String(child.pid));
      child.unref();
    }
    console.log(win);
  };
  const command = args[0] ?? "";
  if (command === "has-session") {
    process.exit(st.sessions.includes((opt(args, "-t") ?? "").replace(/^=/u, "")) ? 0 : 1);
  }
  if (command === "new-session") {
    launch(opt(args, "-s") ?? "");
    return;
  }
  if (command === "new-window") {
    launch((opt(args, "-t") ?? "").replace(/^=/u, "").replace(/:$/u, ""));
    return;
  }
  if (command === "set-option") {
    const target = opt(args, "-t") ?? "";
    const win = target in st.windows ? target : `@${target.replace(/^%/u, "")}`;
    if (st.windows[win]) {
      st.windows[win].opts[args[args.length - 2]!] = args[args.length - 1];
      save(path, st);
    }
    return;
  }
  if (command === "kill-window") {
    delete st.windows[opt(args, "-t") ?? ""];
    save(path, st);
    return;
  }
  if (command === "list-windows") {
    for (const [win, value] of Object.entries(st.windows) as Array<[string, any]>) {
      if (flag("-a")) console.log(fmt.includes("window_id") ? `${win}\t${value.name}` : value.name);
      else if (value.session === (opt(args, "-t") ?? "").replace(/^=/u, ""))
        console.log(`${win}\t${value.opts["@postmaster_cwd"] ?? ""}`);
    }
    return;
  }
  if (command === "capture-pane") {
    console.log("stub screen");
    return;
  }
}

function symlinkCommand(name: string, bin: string): void {
  for (const root of (process.env.PATH ?? "").split(":")) {
    const path = join(root, name);
    if (existsSync(path)) {
      try {
        symlinkSync(path, join(bin, name));
      } catch {}
      return;
    }
  }
}
function host(
  args: string[],
  path: string,
  root: string,
  cwd = `${root}/caller`,
  env: Record<string, string> = {},
): Result {
  const environment: Record<string, string> = {
    HOME: process.env.HOME ?? "/",
    PATH: path,
    STUB: join(root, "stub"),
    TMPDIR: root,
    POSTMASTER_HOST_STATE: join(root, "state"),
    POSTMASTER_HOST_FIXTURE: root,
    POSTMASTER_HOST_CLAIM_WAIT: "3",
    POSTMASTER_HOST_CLOSE_WAIT: "1",
    ...env,
  };
  return exec(SELF, [...args], { cwd, env: environment });
}
function callText(
  args: string[],
  path: string,
  root: string,
  cwd?: string,
  env?: Record<string, string>,
): string {
  const result = host(args, path, root, cwd, env);
  return result.out.trim();
}
function calls(root: string, which: string): string[] {
  try {
    return readFileSync(join(root, "stub", `${which}.calls`), "utf8")
      .trimEnd()
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}
function field(text: string, key: string): string {
  return new RegExp(`(?:^|\\n|\\|)${key}=([^|\\n]*)`, "u").exec(text)?.[1] ?? "";
}
const UNCAPPED_NOTICE = "host: launch running uncapped (no supported per-launch limits available)";
function titleAbsent(text: string): boolean {
  return ["#1", "Stop", "touch", "canary", "breaking", "shell"].every(
    (word) => !text.includes(word),
  );
}
function errStreamEqual(directErrPath: string, launchErrPath: string): boolean {
  const kept = readFileSync(launchErrPath, "utf8")
    .split("\n")
    .filter((line) => line !== UNCAPPED_NOTICE)
    .join("\n");
  return readFileSync(directErrPath, "utf8") === kept;
}
async function marker(path: string, seconds = 20): Promise<boolean> {
  for (let i = 0; i < seconds * 10; i++) {
    if (existsSync(path)) return true;
    await sleep(100);
  }
  return existsSync(path);
}
async function setup(
  root: string,
): Promise<{ repo: string; clone: string; name: string; caller: string; logs: string }> {
  const repo = join(root, "host-test");
  mkdirSync(join(repo, ".worktrees"), { recursive: true });
  let result = exec("git", ["init", "-q", "-b", "main", repo]);
  if (result.code) throw new Error(result.err);
  result = exec("git", [
    "-C",
    repo,
    "-c",
    "user.name=test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "first",
  ]);
  if (result.code) throw new Error(result.err);
  for (const name of ["T-1-luna", "T-1-sol"]) {
    result = exec("git", [
      "-C",
      repo,
      "worktree",
      "add",
      "-q",
      join(repo, ".worktrees", name),
      "-b",
      `wb/${name}`,
    ]);
    if (result.code) throw new Error(result.err);
  }
  result = exec("git", [
    "-C",
    repo,
    "worktree",
    "add",
    "-q",
    "--detach",
    join(repo, ".worktrees", "T-1-rev-luna"),
  ]);
  if (result.code) throw new Error(result.err);
  const clone = join(repo, ".worktrees", "T-1-rev-security-opus");
  result = exec(join(HERE, "cut-scratch.sh"), [
    repo,
    repo,
    clone,
    git("-C", repo, "rev-parse", "HEAD"),
    "--clone",
    "main",
  ]);
  if (result.code) throw new Error(result.err);
  const caller = join(root, "caller"),
    logs = join(root, "logs");
  mkdirSync(caller, { recursive: true });
  mkdirSync(logs, { recursive: true });
  writeFileSync(
    join(caller, "fixed.sh"),
    [
      "#!/usr/bin/env bash",
      'printf \'{"type":"system","subtype":"init","session_id":"fixed-1","model":"m"}\\n\'',
      'printf \'{"type":"assistant","message":{"content":[{"type":"text","text":"step one"}]}}\\n\'',
      "printf 'a line on stderr\\n' >&2",
      'sleep "$(printenv EMIT_SLEEP || printf 0)"',
      'printf \'{"type":"result","subtype":"success","num_turns":1}\\n\'',
      "exit 3",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(caller, "probe.sh"),
    [
      "#!/usr/bin/env bash",
      'printf \'{"type":"system","subtype":"init","session_id":"probe-1","model":"m"}\\n\'',
      "if (: < /dev/tty) 2>/dev/null; then tty=yes; else tty=no; fi",
      'printf \'from=%s|name=%s|pane=%s|tmuxpane=%s|var=%s|sid=%s|pid=%s|pgid=%s|tty=%s\\n\' "$PWD" "$POSTMASTER_LAUNCH_NAME" "$HERDR_PANE_ID" "$TMUX_PANE" "$CALLER_VAR" "$(ps -o sid= -p $$ | tr -d \' \')" "$$" "$(ps -o pgid= -p $$ | tr -d \' \')" "$tty"',
      'count_path=$(printenv COUNT); if [ -n "$count_path" ]; then echo x >> "$count_path"; fi',
      'sleep "$(printenv EMIT_SLEEP || printf 0)"',
      "",
    ].join("\n"),
  );
  for (const path of [join(caller, "fixed.sh"), join(caller, "probe.sh")])
    exec("chmod", ["+x", path]);
  const run = join(root, "run-1");
  const canary = join(root, "canary");
  const hostile = `#1, Stop \`touch ${canary}\` $(touch ${canary}) "breaking" a shell`;
  const briefFor = (dispatch: string, turnpikes: string): string =>
    `# Waybill: 1\nturnpikes: ${turnpikes}\n\n## Ticket\nname: not this one\n\n## Dispatch\nname: ${hostile}\ndispatch: ${dispatch}\nsynthesis worktree: ${join(repo, ".worktrees", "T-1-luna")}\n`;
  const storeRun1 =
    '{"config":{"lanes":{"luna":{"harness":"codex","model":"gpt-6-luna"},"mimo":{"harness":"mimo","model":"xiaomi-token-plan-sgp/mimo-v2.6-pro"},"opus":{"harness":"claude","model":"claude-opus-5-5"},"bare":{"harness":"codex"}},"team":{"workhorses":["luna"],"coachman":{"harness":"muse","model":"muse-spark-1.3-contributor"},"coachman_legs":{"review":{"harness":"claude","model":"claude-opus-5-5"}}}}}\n';
  mkdirSync(join(run, "logs"), { recursive: true });
  writeFileSync(join(run, "brief.md"), briefFor(run, "style, bug, security"));
  writeFileSync(join(run, "manifest.json"), '{"leg":2}\n');
  writeFileSync(join(run, "run.json"), storeRun1);
  writeFileSync(join(run, "logs", "review-r2.json"), '{"attempt":"test"}\n');
  const run2 = join(root, "run-2");
  mkdirSync(join(run2, "logs"), { recursive: true });
  writeFileSync(join(run2, "brief.md"), briefFor(run2, "default"));
  writeFileSync(join(run2, "manifest.json"), '{"leg":2}\n');
  writeFileSync(join(run2, "run.json"), storeRun1);
  writeFileSync(join(run2, "logs", "review-r2.json"), '{"attempt":"test"}\n');
  const run3 = join(root, "run-3");
  mkdirSync(run3, { recursive: true });
  writeFileSync(join(run3, "brief.md"), briefFor(run3, "style, bug, security"));
  writeFileSync(join(run3, "run.json"), storeRun1);
  writeFileSync(join(run3, "manifest.json"), '{"leg":0}\n');
  const run4 = join(root, "run-4");
  mkdirSync(run4, { recursive: true });
  writeFileSync(join(run4, "brief.md"), briefFor(run4, "style, bug, security"));
  writeFileSync(join(run4, "run.json"), storeRun1);
  const run5 = join(root, "run-5");
  mkdirSync(run5, { recursive: true });
  writeFileSync(join(run5, "brief.md"), briefFor(run5, "style, bug, security"));
  writeFileSync(join(run5, "manifest.json"), '{"leg":2}\n');
  writeFileSync(
    join(run5, "run.json"),
    '{"config":{"lanes":{"weird":"x"},"team":{"workhorses":7,"coachman":{"harness":"muse"},"coachman_legs":{"review":{"harness":"claude"}}}}}\n',
  );
  const run6 = join(root, "run-6");
  mkdirSync(run6, { recursive: true });
  writeFileSync(join(run6, "brief.md"), briefFor(run6, "style, bug, security"));
  writeFileSync(join(run6, "manifest.json"), '{"leg":2}\n');
  writeFileSync(join(run6, "run.json"), "[]\n");
  const badLegs = ['{"leg": true}\n', '{"leg": 2.5}\n', '{"leg": 2,\n'];
  for (const [index, leg] of badLegs.entries()) {
    const dispatch = join(root, `run-${7 + index}`);
    mkdirSync(dispatch, { recursive: true });
    writeFileSync(join(dispatch, "brief.md"), briefFor(dispatch, "style, bug, security"));
    writeFileSync(join(dispatch, "run.json"), storeRun1);
    writeFileSync(join(dispatch, "manifest.json"), leg);
  }
  return { repo: resolve(repo), clone: resolve(clone), name: hostile, caller, logs };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/gu, "'\\''")}'`;
}
async function makeHarness(root: string): Promise<{ sys: string; stubs: string }> {
  const bin = join(root, "bin"),
    sys = join(root, "sys");
  mkdirSync(bin);
  mkdirSync(sys);
  mkdirSync(join(root, "stub"));
  const tools = [
    "bun",
    "bash",
    "sh",
    "git",
    "env",
    "printenv",
    "cat",
    "mkdir",
    "rmdir",
    "rm",
    "mkfifo",
    "mktemp",
    "sleep",
    "date",
    "touch",
    "wc",
    "tr",
    "sed",
    "awk",
    "dirname",
    "basename",
    "grep",
    "head",
    "tail",
    "cut",
    "sort",
    "cmp",
    "ls",
    "seq",
    "timeout",
    "find",
    "cksum",
    "ps",
    "sysctl",
    "getconf",
    "chmod",
    "ln",
    "cp",
    "mv",
    "tee",
  ];
  for (const tool of tools) symlinkCommand(tool, sys);
  for (const tool of ["herdr", "tmux"]) {
    const script = `#!/bin/sh\nexec bun ${shellQuote(SCRIPT)} --stub ${tool} "$@"\n`;
    const path = join(bin, tool);
    writeFileSync(path, script, { mode: 0o755 });
  }
  return { sys, stubs: `${bin}:${sys}` };
}
function resetHarness(root: string): void {
  const dir = join(root, "stub");
  for (const name of readdirSync(dir)) rmSync(join(dir, name), { recursive: true, force: true });
}
function readdir(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

async function check(
  label: string,
  test: () => boolean | Promise<boolean>,
  detail = "",
): Promise<boolean> {
  try {
    if (await test()) {
      console.log(`  ok   ${label}`);
      return true;
    }
  } catch (error) {
    detail = detail || String((error as Error).message ?? error);
  }
  console.log(`  FAIL ${label}`);
  if (detail) console.log(`         ${detail.replace(/\n/gu, "\n         ")}`);
  return false;
}
// text.ts: BASE cuts where-values at the first ASCII space (${v%% *}, host.sh:1111);
// a tab or exotic space inside a value survives there, so it must survive here.
export function kvOf(text: string, key: string): string {
  // [^ \r\n]: BASE reads command-substitution (trailing newlines already
  // stripped); the port reads .out raw, so the value stops at line breaks itself.
  return new RegExp(`(?:^|[ \t\r\n])${key}=([^ \r\n]+)`, "u").exec(text)?.[1] ?? "";
}
export const TRIPLE_RE = /space=([^ \r\n]+) tab=([^ \r\n]+) pane=([^ \r\n]+)/u;

export async function runControls(): Promise<number> {
  const root = mkdtempSync(join(HERE, ".host-self-test-"));
  let failures = 0;
  const pass = async (label: string, test: () => boolean | Promise<boolean>, detail = "") => {
    if (!(await check(label, test, detail))) failures++;
  };
  try {
    await pass(
      "where-values keep a tab like BASE ${v%% *}",
      () => kvOf("host=herdr space=a\tb tab=t", "space") === "a\tb",
    );
    await pass(
      "where-values keep U+001C like BASE ${v%% *}",
      () => kvOf("space=a\x1cb", "space") === "a\x1cb",
    );
    await pass("where-values stop at an ASCII space", () => kvOf("space=a b", "space") === "a");
    await pass(
      "the where-triple keeps a tabby value",
      () => TRIPLE_RE.exec("space=a\tb tab=t pane=p")?.[1] === "a\tb",
    );
    await pass("where-values stop at a trailing newline", () => kvOf("space=a\n", "space") === "a");
    await pass(
      "the where-triple stops at a trailing newline",
      () => TRIPLE_RE.exec("space=a tab=t pane=p\n")?.[3] === "p",
    );
    const paths = await makeHarness(root);
    const f = await setup(root);
    const noHost = paths.sys,
      stubs = paths.stubs;
    const stub = join(root, "stub"),
      logs = f.logs;
    const execHost = (
      args: string[],
      path = noHost,
      cwd = f.caller,
      env: Record<string, string> = {},
    ) => host(args, path, root, cwd, env);
    const markerPath = (name: string) => join(logs, `${name}.done`);
    const readCalls = (name: string) => calls(root, name).join("\n");
    console.log("detect");
    await pass(
      "a Herdr server that answers is the host",
      () => callText(["detect"], stubs, root) === "herdr",
    );
    writeFileSync(join(stub, "herdr.down"), "");
    await pass(
      "with no Herdr server answering, tmux is",
      () => callText(["detect"], stubs, root) === "tmux",
    );
    resetHarness(root);
    await pass("with neither on PATH, none", () => callText(["detect"], noHost, root) === "none");
    await pass(
      "POSTMASTER_HOST=none wins over a live Herdr",
      () => callText(["detect"], stubs, root, undefined, { POSTMASTER_HOST: "none" }) === "none",
    );
    await pass(
      "POSTMASTER_HOST=tmux wins over a live Herdr",
      () => callText(["detect"], stubs, root, undefined, { POSTMASTER_HOST: "tmux" }) === "tmux",
    );
    console.log("launch labels and run identity");
    const run1 = join(root, "run-1");
    const RUN_NAME = callText(["name", run1], noHost, root);
    const NAME = callText(["name", run1, "workhorse", "luna"], noHost, root);
    const COACHMAN_LABEL = callText(["name", run1, "coachman", "review", "2"], noHost, root);
    const STYLE_LABEL = callText(["name", run1, "review", "mimo", "style", "2"], noHost, root);
    const BUG_LABEL = callText(["name", run1, "review", "mimo", "bug", "2"], noHost, root);
    const SECURITY_LABEL = callText(
      ["name", run1, "review", "opus", "security", "2"],
      noHost,
      root,
    );
    const POSTMASTER_LABEL = callText(["name", run1, "postmaster"], noHost, root);
    const LEGACY_COACHMAN_LABEL = callText(["name", run1, "coachman"], noHost, root);
    const LEGACY_WORKHORSE_LABEL = callText(["name", run1, "luna"], noHost, root);
    const LEGACY_REVIEW_LABEL = callText(["name", run1, "mimo bug review"], noHost, root);
    const ROLE_LABEL = callText(["name", run1, "role", "preview server"], noHost, root);
    const refused = (result: Result): boolean => result.code !== 0 && result.out === "";
    await pass(
      "the run level carries the ticket number and title",
      () => RUN_NAME.startsWith("#1, Stop") && RUN_NAME.includes("breaking"),
      RUN_NAME,
    );
    await pass(
      "a coachman label leads with its role, then model and leg",
      () => COACHMAN_LABEL === "coachman · claude-opus-5-5 · leg 2" && titleAbsent(COACHMAN_LABEL),
      COACHMAN_LABEL,
    );
    await pass(
      "a workhorse label leads with its lane and role, then model",
      () => NAME === "luna · workhorse · gpt-6-luna" && titleAbsent(NAME),
      NAME,
    );
    await pass(
      "the style reviewer label includes its model and round",
      () => STYLE_LABEL === "mimo · style review · mimo-v2.6-pro · r2" && titleAbsent(STYLE_LABEL),
      STYLE_LABEL,
    );
    await pass(
      "the bug reviewer label includes its model and round",
      () => BUG_LABEL === "mimo · bug review · mimo-v2.6-pro · r2" && titleAbsent(BUG_LABEL),
      BUG_LABEL,
    );
    await pass(
      "a provider-prefixed model id shows its basename, so the round survives the ellipsis",
      () => !BUG_LABEL.includes("xiaomi") && !BUG_LABEL.includes("/"),
      BUG_LABEL,
    );
    await pass(
      "the security reviewer label includes its model and round",
      () =>
        SECURITY_LABEL === "opus · security review · claude-opus-5-5 · r2" &&
        titleAbsent(SECURITY_LABEL),
      SECURITY_LABEL,
    );
    await pass(
      "the project-level postmaster label leads with its role and has no ticket",
      () => POSTMASTER_LABEL === "postmaster" && titleAbsent(POSTMASTER_LABEL),
      POSTMASTER_LABEL,
    );
    await pass(
      "any other launch is named by its role alone",
      () => ROLE_LABEL === "preview server" && titleAbsent(ROLE_LABEL),
      ROLE_LABEL,
    );
    await pass(
      "the old coachman name form resolves the same per-leg model as the typed form",
      () => LEGACY_COACHMAN_LABEL === COACHMAN_LABEL && titleAbsent(LEGACY_COACHMAN_LABEL),
      LEGACY_COACHMAN_LABEL,
    );
    await pass(
      "the old workhorse name form still adds its role and model",
      () =>
        LEGACY_WORKHORSE_LABEL === "luna · workhorse · gpt-6-luna" &&
        titleAbsent(LEGACY_WORKHORSE_LABEL),
      LEGACY_WORKHORSE_LABEL,
    );
    await pass(
      "the old review name form still adds its model and current round",
      () =>
        LEGACY_REVIEW_LABEL === "mimo · bug review · mimo-v2.6-pro · r2" &&
        titleAbsent(LEGACY_REVIEW_LABEL),
      LEGACY_REVIEW_LABEL,
    );
    await pass("an unrecorded lane is refused, never labelled bare or empty", () =>
      refused(execHost(["name", run1, "workhorse", "nobody"])),
    );
    await pass(
      "a lane with no recorded model is refused, not labelled without it",
      () =>
        refused(execHost(["name", run1, "workhorse", "bare"])) &&
        refused(execHost(["name", run1, "review", "bare", "bug", "2"])),
    );
    await pass("a review round that never ran is refused, never labelled", () =>
      refused(execHost(["name", run1, "review", "mimo", "bug", "999"])),
    );
    await pass("round 0 is refused: rounds are 1-based", () =>
      refused(execHost(["name", run1, "review", "mimo", "bug", "0"])),
    );
    await pass("a non-ASCII round is refused with a clean error, not a traceback", () => {
      const result = execHost(["name", run1, "review", "mimo", "bug", "²"]);
      return result.err.trim() === "host: review round must be a whole number" && result.out === "";
    });
    await pass("a non-ASCII leg number is refused the same way", () => {
      const result = execHost(["name", run1, "coachman", "review", "²"]);
      return (
        result.err.trim() === "host: coachman leg number must be a whole number" &&
        result.out === ""
      );
    });
    await pass("the two-argument coachman form is refused, never labelled without its leg", () =>
      refused(execHost(["name", run1, "coachman", "review"])),
    );
    await pass("the old coachman form is refused when the waybill's turnpikes do not resolve", () =>
      refused(execHost(["name", join(root, "run-2"), "coachman"])),
    );
    await pass(
      "and when the manifest records no leg, or there is no manifest",
      () =>
        refused(execHost(["name", join(root, "run-3"), "coachman"])) &&
        refused(execHost(["name", join(root, "run-4"), "coachman"])),
    );
    const LONG = "9".repeat(5000);
    await pass("a round past the integer conversion limit is refused cleanly", () => {
      const result = execHost(["name", run1, "review", "mimo", "bug", LONG]);
      return result.err.trim() === "host: review round must be a whole number" && result.out === "";
    });
    await pass("a leg past it is refused the same way", () => {
      const result = execHost(["name", run1, "coachman", "review", LONG]);
      return (
        result.err.trim() === "host: coachman leg number must be a whole number" &&
        result.out === ""
      );
    });
    await pass(
      "an empty or unknown leg name is refused, never silently generic",
      () =>
        refused(execHost(["name", run1, "coachman", "", "2"])) &&
        refused(execHost(["name", run1, "coachman", "nonsense", "2"])),
    );
    await pass(
      "while a known leg without an override still takes the generic coachman model",
      () =>
        callText(["name", run1, "coachman", "synthesis", "1"], noHost, root) ===
        "coachman · muse-spark-1.3-contributor · leg 1",
    );
    await pass("an empty leg number is refused, never labelled without its leg", () => {
      const result = execHost(["name", run1, "coachman", "review", ""]);
      return (
        result.err.trim() === "host: coachman leg number must be a whole number" &&
        result.out === ""
      );
    });
    await pass("leg 0 is refused like round 0", () => {
      const result = execHost(["name", run1, "coachman", "synthesis", "0"]);
      return (
        result.err.trim() === "host: coachman leg number must be 1 or more" && result.out === ""
      );
    });
    await pass("a coachman with no recorded model is refused, override, generic or legacy", () => {
      const run5 = join(root, "run-5");
      return (
        execHost(["name", run5, "coachman", "synthesis", "1"]).err.trim() ===
          "host: no recorded model for coachman leg synthesis" &&
        execHost(["name", run5, "coachman", "review", "2"]).err.trim() ===
          "host: no recorded model for coachman leg review" &&
        execHost(["name", run5, "coachman"]).err.trim() ===
          "host: no recorded model for coachman leg review"
      );
    });
    await pass(
      "a manifest leg that is not an integer is refused, never coerced",
      () =>
        execHost(["name", join(root, "run-7"), "coachman"]).err.trim() ===
          "host: cannot resolve the coachman leg from manifest.json" &&
        execHost(["name", join(root, "run-8"), "coachman"]).err.trim() ===
          "host: cannot resolve the coachman leg from manifest.json",
    );
    await pass(
      "a manifest that is not JSON is refused",
      () =>
        execHost(["name", join(root, "run-9"), "coachman"]).err.trim() ===
        "host: cannot resolve the coachman leg from manifest.json",
    );
    await pass(
      "a malformed store is refused cleanly, never a traceback",
      () =>
        execHost(["name", join(root, "run-5"), "workhorse", "weird"]).err.trim() ===
          "host: no recorded model for workhorse lane weird" &&
        execHost(["name", join(root, "run-5"), "weird"]).err.trim() ===
          "host: invalid launch identity; use coachman, workhorse, review, postmaster or role" &&
        execHost(["name", join(root, "run-6"), "workhorse", "luna"]).err.trim() ===
          "host: no recorded model for workhorse lane luna",
    );

    console.log("name: from the waybill, so no title is typed into a shell");
    await pass(
      "a role-first launch name comes from the recorded lane model",
      () => NAME === "luna · workhorse · gpt-6-luna" && titleAbsent(NAME),
      NAME,
    );
    await pass(
      "a waybill without one falls back to the run's directory",
      () => callText(["name", logs], noHost, root) === "logs",
    );
    await pass(
      "and a role name with no waybill is still only its parts",
      () => callText(["name", logs, "role", "verify x"], noHost, root) === "verify x",
    );
    writeFileSync(
      join(logs, "brief.md"),
      "## Dispatch\nname: #2, a bell\u0007 and an escape\u001b]0;x\u0007 · y\n",
    );
    await pass(
      "control characters never reach a label",
      () => callText(["name", logs], noHost, root) === "#2, a bell and an escape]0;x · y",
    );
    writeFileSync(join(logs, "brief.md"), "## Dispatch\nname: Bell\x1c\x1c(a note)\n");
    await pass(
      "a template note after exotic spaces strips like BASE",
      () => callText(["name", logs], noHost, root) === "Bell",
    );
    rmSync(join(logs, "brief.md"), { force: true });

    console.log("run, no host: headless launch");
    const direct = exec(join(f.caller, "fixed.sh"), [], { cwd: f.caller, env: { ...process.env } });
    writeFileSync(join(root, "direct.out"), direct.out);
    writeFileSync(join(root, "direct.err"), direct.err);
    const headless = execHost([
      "run",
      f.name,
      join(f.repo, ".worktrees/T-1-luna"),
      "--out",
      "../logs/n1.out",
      "--err",
      "../logs/n1.err",
      "--marker",
      "../logs/n1.done",
      "--",
      "./fixed.sh",
    ]);
    await pass(
      "it says it ran in the background",
      () => headless.code === 0 && headless.out.trim() === "host=none",
      headless.err,
    );
    await marker(markerPath("n1"));
    await pass(
      "the command's output matches a direct run, and uncapped execution is disclosed",
      () =>
        readFileSync(join(logs, "n1.out"), "utf8") ===
          readFileSync(join(root, "direct.out"), "utf8") &&
        errStreamEqual(join(root, "direct.err"), join(logs, "n1.err")) &&
        readFileSync(join(logs, "n1.err"), "utf8").split("\n").includes(UNCAPPED_NOTICE),
    );
    await pass("and the title's shell syntax never ran", () => !existsSync(join(root, "canary")));
    writeFileSync(markerPath("n2"), "old marker");
    const pending = execHost(
      ["run", f.name, f.repo, "--marker", "../logs/n2.done", "--", "./fixed.sh"],
      noHost,
      f.caller,
      { EMIT_SLEEP: "1" },
    );
    await pass(
      "an earlier launch's marker is gone once run returns",
      () => pending.code === 0 && !existsSync(markerPath("n2")),
    );
    await pass("and it lands again when this one exits, whatever its exit", () =>
      marker(markerPath("n2"), 15),
    );
    const _probe = execHost(
      [
        "run",
        f.name,
        join(f.repo, ".worktrees/T-1-luna"),
        "--out",
        "../logs/n3.out",
        "--marker",
        "../logs/n3.done",
        "--pidfile",
        "../logs/n3.pid",
        "--",
        "./probe.sh",
      ],
      noHost,
      f.caller,
      { CALLER_VAR: "v", HERDR_PANE_ID: "caller-pane", TMUX_PANE: "%9" },
    );
    await marker(markerPath("n3"));
    const probeText = readFileSync(join(logs, "n3.out"), "utf8");
    await pass(
      "it runs from the caller's directory, with the caller's environment and its name",
      () =>
        field(probeText, "from") === f.caller &&
        field(probeText, "var") === "v" &&
        field(probeText, "name") === f.name,
      JSON.stringify({
        from: field(probeText, "from"),
        expected: f.caller,
        var: field(probeText, "var"),
        name: field(probeText, "name"),
        expectedName: f.name,
      }),
    );
    await pass(
      "but never with its caller's pane",
      () => field(probeText, "pane") === "" && field(probeText, "tmuxpane") === "",
      probeText,
    );
    await pass(
      "it is a session of its own: its group is its pid, not the caller's session",
      () =>
        field(probeText, "pgid") === field(probeText, "pid") &&
        field(probeText, "sid") === field(probeText, "pid"),
      probeText,
    );
    await pass(
      "--pidfile holds the launch's pid",
      () => readFileSync(join(logs, "n3.pid"), "utf8").trim() === field(probeText, "pid"),
    );
    writeFileSync(
      join(f.caller, "argv.sh"),
      ["#!/usr/bin/env bash", 'printf "<%s>\\n" "$@"', ""].join("\n"),
    );
    exec("chmod", ["+x", join(f.caller, "argv.sh")]);
    execHost(
      [
        "run",
        f.name,
        f.repo,
        "--out",
        "../logs/n6.out",
        "--marker",
        "../logs/n6.done",
        "--",
        "./argv.sh",
        "",
        "hello",
      ],
      noHost,
      f.caller,
    );
    await marker(markerPath("n6"));
    const argvText = readFileSync(join(logs, "n6.out"), "utf8");
    await pass(
      "an empty argument survives the launch record",
      () => argvText === "<>\n<hello>\n",
      argvText,
    );
    const live = execHost(
      [
        "run",
        f.name,
        f.repo,
        "--pidfile",
        "../logs/n5.pid",
        "--marker",
        "../logs/n5.done",
        "--",
        "./fixed.sh",
      ],
      noHost,
      f.caller,
      { EMIT_SLEEP: "2" },
    );
    await pass(
      "and it is there, for a live process, the moment run returns",
      () => live.code === 0 && existsSync(join(logs, "n5.pid")),
    );
    await marker(markerPath("n5"), 20);
    writeFileSync(join(logs, "n4.out"), "before\n");
    writeFileSync(join(logs, "n4.err"), "old error\n");
    execHost([
      "run",
      f.name,
      f.repo,
      "--out",
      "../logs/n4.out",
      "--err",
      "../logs/n4.err",
      "--append",
      "--marker",
      "../logs/n4.done",
      "--",
      "./fixed.sh",
    ]);
    await marker(markerPath("n4"));
    await pass(
      "--append keeps what the stream held, and --err holds only this launch's errors",
      () =>
        readFileSync(join(logs, "n4.out"), "utf8").split("\n")[0] === "before" &&
        readFileSync(join(logs, "n4.out"), "utf8").split("\n").length - 1 === 4 &&
        errStreamEqual(join(root, "direct.err"), join(logs, "n4.err")) &&
        readFileSync(join(logs, "n4.err"), "utf8").split("\n").includes(UNCAPPED_NOTICE),
    );
    const missingSeparator = execHost([
      "run",
      f.name,
      f.repo,
      "--marker",
      markerPath("n6"),
      "./fixed.sh",
    ]);
    await pass(
      "a command without -- is refused, and its marker lands",
      () => missingSeparator.code === 1 && existsSync(markerPath("n6")),
    );
    const noDir = execHost([
      "run",
      f.name,
      join(root, "nowhere"),
      "--err",
      join(logs, "n7.err"),
      "--marker",
      markerPath("n7"),
      "--",
      "./fixed.sh",
    ]);
    await pass(
      "a directory that does not exist: refused, the marker lands and --err says why",
      () =>
        noDir.code === 1 &&
        existsSync(markerPath("n7")) &&
        readFileSync(join(logs, "n7.err"), "utf8").includes("no such directory"),
    );
    const invalid = execHost(
      ["run", f.name, f.repo, "--marker", markerPath("n8"), "--", "./fixed.sh"],
      noHost,
      f.caller,
      { POSTMASTER_HOST_CLAIM_WAIT: "2.5" },
    );
    await pass(
      "a count that is not a whole number is refused, and never reaches the tests",
      () => invalid.code === 1 && existsSync(markerPath("n8")) && !invalid.out.includes("controls"),
    );
    const invalidWait = execHost(["wait", "postmaster-x", "10m"], stubs);
    await pass(
      "the same for wait",
      () => invalidWait.code === 1 && !invalidWait.out.includes("controls"),
    );

    console.log("stop: owned process trees and refusal controls");
    const sol = join(f.repo, ".worktrees/T-1-sol");
    const treeScript = join(f.caller, "tree.sh");
    mkdirSync(join(root, "tree"), { recursive: true });
    writeFileSync(
      treeScript,
      '#!/usr/bin/env bash\nsleep 60 & echo $! > "$TREE/child.pid"\nwait\n',
    );
    exec("chmod", ["+x", treeScript]);
    const treeRun = execHost(
      [
        "run",
        f.name,
        sol,
        "--marker",
        "../logs/tree.done",
        "--pidfile",
        "../logs/tree.pid",
        "--",
        "./tree.sh",
      ],
      noHost,
      f.caller,
      { TREE: join(root, "tree") },
    );
    for (let i = 0; i < 30 && !existsSync(join(root, "tree/child.pid")); i++) await sleep(100);
    const stop = execHost(["stop", sol], noHost, root, { POSTMASTER_HOST_STOP_WAIT: "1" });
    await pass(
      "stop reaches a child the launch runs in a session of its own",
      () => treeRun.code === 0 && stop.code === 0,
    );
    await pass("its marker lands", () => marker(markerPath("tree"), 10));

    const termScript = join(f.caller, "term-tree.sh");
    writeFileSync(
      termScript,
      [
        "#!/usr/bin/env bash",
        "trap 'echo term >> \"$TREE/term\"; exit 0' TERM",
        'setsid sleep 120 & echo $! > "$TREE/escapee.pid"',
        'sh -c \'trap "" TERM; while :; do sleep 1; done\' & echo $! > "$TREE/deaf.pid"',
        "sleep 120 & wait",
        "",
      ].join("\n"),
    );
    exec("chmod", ["+x", termScript]);
    const termRun = execHost(
      [
        "run",
        f.name,
        join(f.repo, ".worktrees/T-1-luna"),
        "--marker",
        "../logs/k1.done",
        "--pidfile",
        "../logs/k1.pid",
        "--",
        "./term-tree.sh",
      ],
      noHost,
      f.caller,
      { TREE: join(root, "tree") },
    );
    for (
      let i = 0;
      i < 50 &&
      (!existsSync(join(root, "tree/escapee.pid")) || !existsSync(join(root, "tree/deaf.pid")));
      i++
    )
      await sleep(100);
    const outsider = spawn("sleep", ["60"], { cwd: sol, detached: true, stdio: "ignore" });
    outsider.unref();
    const termStop = execHost(["stop", join(f.repo, ".worktrees/T-1-luna")], noHost, root, {
      POSTMASTER_HOST_STOP_WAIT: "2",
    });
    const alive = (pid: string) => {
      try {
        return !readFileSync(`/proc/${pid}/stat`, "utf8")
          .slice(readFileSync(`/proc/${pid}/stat`, "utf8").lastIndexOf(")") + 1)
          .trim()
          .startsWith("Z");
      } catch {
        return false;
      }
    };
    const escapee = readFileSync(join(root, "tree/escapee.pid"), "utf8").trim();
    const deaf = readFileSync(join(root, "tree/deaf.pid"), "utf8").trim();
    await pass(
      "the launch got TERM first, and a child deaf to it is killed after the wait",
      () =>
        termRun.code === 0 &&
        termStop.code === 0 &&
        existsSync(join(root, "tree/term")) &&
        !alive(deaf),
    );
    await pass(
      "a process that works in the worktree but that no launch started is left alone",
      () => !!outsider.pid && alive(String(outsider.pid)) && !alive(escapee),
    );
    try {
      if (outsider.pid) process.kill(outsider.pid, "SIGKILL");
    } catch {}
    await pass("its marker lands", () => marker(markerPath("k1"), 10));

    console.log("stop: registry identity and process membership");
    const launchDir = join(root, "state", "launches");
    mkdirSync(launchDir, { recursive: true });
    const boot = readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
    const bootLine =
      readFileSync("/proc/stat", "utf8")
        .split("\n")
        .find((line: string) => line.startsWith("btime ")) ?? "btime 0";
    // ASCII: /proc/stat is kernel-emitted ASCII; btime's fields split on spaces.
    const bootSeconds = Number(bootLine.split(/\s+/u)[1]);
    const ticks = Number(exec("getconf", ["CLK_TCK"]).out.trim()) || 100;
    const procStart = (pid: string): string => {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      return (
        stat
          .slice(stat.lastIndexOf(")") + 1)
          .trim()
          // ASCII: /proc/<pid>/stat past the name is kernel-emitted ASCII numerics.
          .split(/\s+/u)[19] ?? ""
      );
    };
    const startedSeconds = (pid: string) => bootSeconds + Number(procStart(pid)) / ticks;
    const record = (pid: string) => join(launchDir, pid);
    const stale = spawn("sleep", ["60"], { detached: true, stdio: "ignore" });
    stale.unref();
    const stalePid = String(stale.pid);
    const stopSol = () => execHost(["stop", sol], noHost, root, { POSTMASTER_HOST_STOP_WAIT: "1" });
    writeFileSync(record(stalePid), `${sol}\nnot this\nstart 1\nboot ${boot}\n`);
    let staleStop = stopSol();
    await pass(
      "a record whose leader has another start time is removed, and stop signals nothing",
      () =>
        staleStop.code === 0 &&
        staleStop.out.trim() === `no launch is running in ${sol}` &&
        alive(stalePid) &&
        !existsSync(record(stalePid)),
    );
    writeFileSync(
      record(stalePid),
      `${sol}\nnot this\nstart ${procStart(stalePid)}\nboot another-boot\n`,
    );
    staleStop = stopSol();
    await pass(
      "a record from another boot is removed, and stop signals nothing",
      () => staleStop.code === 0 && alive(stalePid) && !existsSync(record(stalePid)),
    );
    writeFileSync(record(stalePid), `${sol}\nnot this\n`);
    utimesSync(
      record(stalePid),
      new Date((bootSeconds - 60) * 1000),
      new Date((bootSeconds - 60) * 1000),
    );
    staleStop = stopSol();
    await pass(
      "a record from before this change, written before this boot, is removed",
      () => staleStop.code === 0 && alive(stalePid) && !existsSync(record(stalePid)),
    );
    writeFileSync(record(stalePid), `${sol}\nnot this\n`);
    const began = startedSeconds(stalePid) - 30;
    utimesSync(record(stalePid), new Date(began * 1000), new Date(began * 1000));
    staleStop = stopSol();
    await pass(
      "a record from before this change, naming a pid that started after it was written, is removed",
      () => staleStop.code === 0 && alive(stalePid) && !existsSync(record(stalePid)),
    );
    writeFileSync(record(stalePid), `${sol}\nlegacy\n`);
    const legacyClose = execHost(["close", sol], noHost, root);
    const upgraded = readFileSync(record(stalePid), "utf8");
    await pass(
      "a record from before this change, written by a leader already running, is kept and rewritten",
      () =>
        legacyClose.code === 2 &&
        upgraded.includes(`start ${procStart(stalePid)}\n`) &&
        upgraded.includes(`boot ${boot}\n`),
    );
    try {
      if (stale.pid) process.kill(stale.pid, "SIGKILL");
    } catch {}
    rmSync(record(stalePid), { force: true });

    const leaves = join(f.caller, "leaves.sh");
    writeFileSync(leaves, '#!/usr/bin/env bash\nsleep 60 & echo $! > "$TREE/left.pid"\n');
    exec("chmod", ["+x", leaves]);
    execHost(
      [
        "run",
        f.name,
        sol,
        "--marker",
        "../logs/k2.done",
        "--pidfile",
        "../logs/k2.pid",
        "--",
        "./leaves.sh",
      ],
      noHost,
      f.caller,
      { TREE: join(root, "tree") },
    );
    await marker(markerPath("k2"));
    const leader = readFileSync(join(logs, "k2.pid"), "utf8").trim();
    const leftPid = readFileSync(join(root, "tree/left.pid"), "utf8").trim();
    let memberText = "";
    for (let i = 0; i < 30; i++) {
      memberText = readFileSync(record(leader), "utf8");
      if (memberText.includes(`member ${leftPid}`)) break;
      await sleep(100);
    }
    await pass(
      "a leader that exits leaving a process behind: its record names that process",
      () =>
        memberText.split("\n").some((line) => line === `member ${leftPid} ${procStart(leftPid)}`),
      memberText,
    );
    const stopMember = stopSol();
    await pass("and stop ends that process", () => stopMember.code === 0 && !alive(leftPid));

    for (const [args, label] of [
      [["bash", "-c", "exec -a systemd sleep 60"], "a systemd manager"],
      [
        ["bash", "-c", "exec -a moshi-hook bash -c 'while :; do sleep 1; done' serve"],
        "the moshi-hook daemon",
      ],
    ] as Array<[string[], string]>) {
      const guarded = execHost(
        [
          "run",
          f.name,
          sol,
          "--marker",
          "../logs/guard.done",
          "--pidfile",
          "../logs/guard.pid",
          "--",
          ...args,
        ],
        noHost,
        f.caller,
      );
      for (let i = 0; i < 30 && !existsSync(join(logs, "guard.pid")); i++) await sleep(100);
      await sleep(300);
      const refused = stopSol();
      const guardedPid = readFileSync(join(logs, "guard.pid"), "utf8").trim();
      await pass(
        `stop refuses a tree holding ${label}, and leaves it all running`,
        () =>
          guarded.code === 0 &&
          refused.code === 2 &&
          refused.err.includes(label) &&
          alive(guardedPid) &&
          !existsSync(markerPath("guard")),
        refused.err,
      );
      try {
        process.kill(-Number(guardedPid), "SIGKILL");
      } catch {
        try {
          process.kill(Number(guardedPid), "SIGKILL");
        } catch {}
      }
      await marker(markerPath("guard"), 10);
      rmSync(join(logs, "guard.pid"), { force: true });
    }

    const wide = execHost(
      [
        "run",
        f.name,
        sol,
        "--marker",
        "../logs/wide.done",
        "--pidfile",
        "../logs/wide.pid",
        "--",
        "bash",
        "-c",
        "sleep 60 & sleep 60 & sleep 60 & sleep 60 & wait",
      ],
      noHost,
      f.caller,
    );
    await sleep(300);
    const overMax = execHost(["stop", sol], noHost, root, {
      POSTMASTER_HOST_STOP_MAX: "3",
      POSTMASTER_HOST_STOP_WAIT: "0",
    });
    await pass(
      "stop refuses a tree larger than POSTMASTER_HOST_STOP_MAX, and leaves it running",
      () =>
        wide.code === 0 &&
        overMax.code === 2 &&
        overMax.err.includes("more than POSTMASTER_HOST_STOP_MAX (3)") &&
        existsSync(join(logs, "wide.pid")) &&
        !existsSync(markerPath("wide")),
      overMax.err,
    );
    const withinBound = stopSol();
    await pass(
      "within the bound, the same tree is stopped",
      () => withinBound.code === 0 && marker(markerPath("wide"), 10),
    );

    const unrelated = spawn("sleep", ["60"], { cwd: sol, detached: true, stdio: "ignore" });
    unrelated.unref();
    const unrelatedRun = execHost(
      [
        "run",
        f.name,
        sol,
        "--marker",
        "../logs/unrelated.done",
        "--pidfile",
        "../logs/unrelated.pid",
        "--",
        "sleep",
        "60",
      ],
      noHost,
      f.caller,
    );
    const unrelatedStop = execHost(["stop", sol], noHost, root, { POSTMASTER_HOST_STOP_WAIT: "0" });
    await pass(
      "a process that works in the worktree but that no launch started is left alone",
      () => {
        if (unrelatedRun.code !== 0 || unrelatedStop.code !== 0 || !unrelated.pid) return false;
        try {
          process.kill(unrelated.pid, 0);
          return true;
        } catch {
          return false;
        }
      },
    );
    try {
      if (unrelated.pid) process.kill(unrelated.pid, "SIGKILL");
    } catch {}
    await marker(markerPath("unrelated"), 10);
    const inside = execHost(["stop", sol], noHost, sol);
    await pass(
      "stop refuses to run from inside the worktree it would stop",
      () => inside.code === 1 && inside.err.includes("from inside it"),
    );
    const badMaxRun = execHost(
      [
        "run",
        f.name,
        sol,
        "--marker",
        "../logs/wide.done",
        "--pidfile",
        "../logs/wide.pid",
        "--",
        "bash",
        "-c",
        "sleep 60 & sleep 60 & wait",
      ],
      noHost,
      f.caller,
    );
    const badMax = execHost(["stop", sol], noHost, root, {
      POSTMASTER_HOST_STOP_MAX: "1",
      POSTMASTER_HOST_STOP_WAIT: "0",
    });
    await pass(
      "stop refuses a tree larger than POSTMASTER_HOST_STOP_MAX, and leaves it running",
      () =>
        badMaxRun.code === 0 &&
        badMax.code === 2 &&
        badMax.err.includes("more than POSTMASTER_HOST_STOP_MAX"),
    );
    const withinMax = execHost(["stop", sol], noHost, root, { POSTMASTER_HOST_STOP_WAIT: "0" });
    await pass(
      "within the bound, the same tree is stopped",
      () => withinMax.code === 0 && marker(markerPath("wide"), 10),
    );
    const outsideFixture = execHost(["stop", sol], noHost, root, {
      POSTMASTER_HOST_STATE: `${root}.elsewhere`,
    });
    await pass(
      "while a self-test runs, a registry outside its fixture is refused",
      () =>
        outsideFixture.code === 1 &&
        outsideFixture.err.includes("refusing the registry") &&
        !existsSync(`${root}.elsewhere`),
    );

    console.log("run, Herdr (stub): pane placement and environment handover");
    resetHarness(root);
    const herdrRun = execHost(
      [
        "run",
        f.name,
        join(f.repo, ".worktrees/T-1-luna"),
        "--out",
        "../logs/h1.out",
        "--err",
        "../logs/h1.err",
        "--marker",
        "../logs/h1.done",
        "--",
        "./probe.sh",
      ],
      stubs,
      f.caller,
      { CALLER_VAR: "v", HERDR_PANE_ID: "caller-pane" },
    );
    const place = TRIPLE_RE.exec(herdrRun.out);
    await pass(
      "it says where it ran",
      () => herdrRun.code === 0 && !!place,
      herdrRun.out + herdrRun.err,
    );
    const pane = place?.[3] ?? "";
    const state = json(join(stub, "herdr.json"), { spaces: {}, panes: {}, open: {} });
    const spaceId = place?.[1] ?? "";
    const worktree = join(f.repo, ".worktrees/T-1-luna");
    const listedCalls = readCalls("herdr");
    await pass(
      "a repository with no space gets one first, labelled with its name",
      () =>
        listedCalls.includes(
          `workspace\tcreate\t--cwd\t${f.repo}\t--label\t${basename(f.repo)}\t--no-focus`,
        ),
      listedCalls,
    );
    await pass(
      "the worktree opens as a space under it, labelled with the launch's name",
      () =>
        listedCalls.includes(
          `worktree\topen\t--workspace\tw1\t--path\t${worktree}\t--label\t${f.name}\t--no-focus`,
        ),
      listedCalls,
    );
    await pass(
      "host.sh marks the space it opened as its own",
      () => state.spaces[spaceId]?.tokens?.postmaster === "opened",
    );
    await marker(markerPath("h1"));
    await sleep(300);
    const herdrOut = readFileSync(join(logs, "h1.out"), "utf8");
    await pass(
      "the launch ran in that pane, with that pane's identity",
      () => field(herdrOut, "pane") === pane,
      herdrOut,
    );
    await pass(
      "and with its caller's environment, handed over by host.sh",
      () => field(herdrOut, "var") === "v" && field(herdrOut, "from") === f.caller,
      JSON.stringify({
        from: field(herdrOut, "from"),
        expected: f.caller,
        var: field(herdrOut, "var"),
      }),
    );
    await pass(
      "the pane shows the name and the rendered stream, not raw JSON",
      () =>
        existsSync(join(stub, `pane-${pane}.out`)) &&
        !readFileSync(join(stub, `pane-${pane}.out`), "utf8").includes('{"type"'),
    );
    const reportCalls = readCalls("herdr");
    await pass(
      "and reports the launch working, then releases it",
      () =>
        reportCalls.includes(`pane\treport-agent\t${pane}`) &&
        reportCalls.includes(`pane\trelease-agent\t${pane}`),
      reportCalls,
    );
    const secondHerdr = execHost(
      ["run", f.name, worktree, "--marker", "../logs/h2.done", "--", "./fixed.sh"],
      stubs,
      f.caller,
    );
    await pass(
      "a second launch in the same worktree is a new tab in the same space",
      () =>
        secondHerdr.code === 0 &&
        calls(root, "herdr").filter((line) => line.startsWith("worktree\topen")).length === 1 &&
        calls(root, "herdr").some((line) =>
          line.startsWith(`tab\tcreate\t--workspace\t${spaceId}`),
        ),
    );
    await marker(markerPath("h2"));
    const directOut = exec(join(f.caller, "fixed.sh"), [], { cwd: f.caller, env: process.env });
    writeFileSync(join(root, "direct.out"), directOut.out);
    writeFileSync(join(root, "direct.err"), directOut.err);
    const sameStreams = execHost(
      [
        "run",
        f.name,
        worktree,
        "--out",
        "../logs/h3.out",
        "--err",
        "../logs/h3.err",
        "--marker",
        "../logs/h3.done",
        "--",
        "./fixed.sh",
      ],
      stubs,
      f.caller,
    );
    await marker(markerPath("h3"));
    await pass(
      "the command streams and marker are what a background run writes, with any cap notice",
      () =>
        sameStreams.code === 0 &&
        readFileSync(join(logs, "h3.out"), "utf8") ===
          readFileSync(join(root, "direct.out"), "utf8") &&
        errStreamEqual(join(root, "direct.err"), join(logs, "h3.err")),
    );

    writeFileSync(join(stub, "pane.dead"), "");
    const deadFallback = execHost(
      [
        "run",
        f.name,
        join(f.repo, ".worktrees/T-1-sol"),
        "--out",
        "../logs/h4.out",
        "--marker",
        "../logs/h4.done",
        "--",
        "./probe.sh",
      ],
      stubs,
      f.caller,
      { COUNT: join(logs, "h4.count") },
    );
    await marker(markerPath("h4"));
    await pass(
      "a pane that never starts the launch: it runs in the background instead",
      () =>
        deadFallback.code === 0 &&
        deadFallback.out.trim() === "host=none" &&
        readFileSync(join(logs, "h4.count"), "utf8").trim().split("\n").length === 1,
      deadFallback.err,
    );
    rmSync(join(stub, "pane.dead"), { force: true });
    writeFileSync(join(stub, "pane.late"), "");
    const late = execHost(
      [
        "run",
        f.name,
        join(f.repo, ".worktrees/T-1-sol"),
        "--marker",
        "../logs/h5.done",
        "--",
        "./probe.sh",
      ],
      stubs,
      f.caller,
      { POSTMASTER_HOST_CLAIM_WAIT: "1", COUNT: join(logs, "h5.count") },
    );
    await marker(markerPath("h5"));
    await sleep(5200);
    await pass(
      "a pane that starts it late: it still runs exactly once",
      () =>
        late.out.trim() === "host=none" &&
        readFileSync(join(logs, "h5.count"), "utf8").trim().split("\n").length === 1,
    );
    rmSync(join(stub, "pane.late"), { force: true });
    await pass("no launch leaves its hand-over directory behind", () =>
      readdir(root).every((name) => !name.startsWith("postmaster-host.")),
    );

    console.log("stop and close, Herdr (stub)");
    const closedHerdr = execHost(["close", worktree], stubs, root);
    await pass(
      "a space host.sh opened, its launches done, is closed",
      () =>
        closedHerdr.code === 0 &&
        (json(join(stub, "herdr.json"), { open: {} }).open[worktree] ?? "") === "",
      closedHerdr.err,
    );
    const ownClose = execHost(["close", f.repo], stubs, root);
    await pass(
      "the repository's own checkout is refused",
      () => ownClose.code === 2 && ownClose.err.includes("own checkout"),
    );
    const herdrStatePath = join(stub, "herdr.json");
    const currentState = json(herdrStatePath, {
      n: 0,
      spaces: {},
      panes: {},
      tabs: {},
      tab_n: {},
      open: {},
      agents: [],
      prompt: [],
    });
    currentState.n++;
    const userSpace = `w${currentState.n}`;
    currentState.n++;
    const userPane = `p${currentState.n}`;
    const revLuna = join(f.repo, ".worktrees/T-1-rev-luna");
    currentState.spaces[userSpace] = {
      label: "the user's",
      tokens: {},
      panes: [userPane],
      tabs: [],
      path: resolve(revLuna),
    };
    currentState.panes[userPane] = {
      ws: userSpace,
      tokens: { postmaster: "launch", state: "done" },
    };
    currentState.open[revLuna] = userSpace;
    save(herdrStatePath, currentState);
    const userSpaceClose = execHost(["close", revLuna], stubs, root);
    await pass(
      "a space host.sh did not open is refused, and left open",
      () =>
        userSpaceClose.code === 2 &&
        !calls(root, "herdr").includes(`workspace\tclose\t${userSpace}`),
      userSpaceClose.err,
    );
    writeFileSync(join(stub, "pane.dead"), "");
    const liveFallback = execHost(
      [
        "run",
        f.name,
        join(f.repo, ".worktrees/T-1-sol"),
        "--marker",
        "../logs/s1.done",
        "--",
        "sleep",
        "60",
      ],
      stubs,
      f.caller,
    );
    rmSync(join(stub, "pane.dead"), { force: true });
    const refusedClose = execHost(["close", join(f.repo, ".worktrees/T-1-sol")], stubs, root);
    await pass(
      "a launch that fell back to the background still holds its worktree: close refuses",
      () => liveFallback.out.trim() === "host=none" && refusedClose.code === 2,
    );
    const stopFallback = execHost(["stop", join(f.repo, ".worktrees/T-1-sol")], stubs, root, {
      POSTMASTER_HOST_STOP_WAIT: "0",
    });
    await pass(
      "stop ends it, and its marker lands",
      () => stopFallback.code === 0 && marker(markerPath("s1"), 10),
    );
    const closeAfterStop = execHost(["close", join(f.repo, ".worktrees/T-1-sol")], stubs, root);
    await pass("then close closes the space", () => closeAfterStop.code === 0);

    console.log("a reviewer's scratch clone, Herdr (stub)");
    resetHarness(root);
    const cloneRun = execHost(
      ["run", f.name, f.clone, "--marker", "../logs/c1.done", "--", "./fixed.sh"],
      stubs,
      f.caller,
    );
    const cloneSpace = kvOf(cloneRun.out, "space");
    const cloneCalls = calls(root, "herdr");
    await pass(
      "it opens as a space of the launch's own, labelled with its name, and no other",
      () =>
        cloneCalls.filter((line) => line.startsWith("workspace\tcreate")).length === 1 &&
        cloneCalls.some((line) => line.includes(`--cwd\t${f.clone}\t--label\t${f.name}`)),
    );
    await pass(
      "host.sh marks that space as its own",
      () =>
        json(join(stub, "herdr.json"), { spaces: {} }).spaces[cloneSpace]?.tokens?.postmaster ===
        "opened",
    );
    await marker(markerPath("c1"));
    const cloneAgain = execHost(
      ["run", f.name, f.clone, "--marker", "../logs/c2.done", "--", "./fixed.sh"],
      stubs,
      f.caller,
    );
    await pass(
      "a second launch there is a new tab in the same space",
      () =>
        cloneAgain.code === 0 &&
        calls(root, "herdr").filter((line) => line.startsWith("workspace\tcreate")).length === 1 &&
        calls(root, "herdr").some((line) =>
          line.startsWith(`tab\tcreate\t--workspace\t${cloneSpace}`),
        ),
    );
    await marker(markerPath("c2"));
    const cloneClose = execHost(["close", f.clone], stubs, root);
    await pass(
      "close shuts it",
      () =>
        cloneClose.code === 0 &&
        (json(join(stub, "herdr.json"), { open: {} }).open[f.clone] ?? "") === "",
      cloneClose.err,
    );
    const plain = join(root, "plain");
    exec("git", ["clone", "-q", f.repo, plain]);
    const plainRun = execHost(
      ["run", f.name, plain, "--marker", "../logs/c3.done", "--", "./fixed.sh"],
      stubs,
      f.caller,
    );
    await marker(markerPath("c3"));
    const plainSpace = kvOf(plainRun.out, "space");
    const plainClose = execHost(["close", plain], stubs, root);
    await pass(
      "a plain clone is no scratch: it opens as a repository, and close refuses its space",
      () =>
        calls(root, "herdr").some((line) => line.includes(`--cwd\t${plain}\t--label\tplain`)) &&
        plainClose.code === 2 &&
        !calls(root, "herdr").includes(`workspace\tclose\t${plainSpace}`),
    );

    console.log("run, stop and close, tmux (stub)");
    resetHarness(root);
    const tmuxEnvRun = execHost(
      [
        "run",
        f.name,
        worktree,
        "--out",
        "../logs/t1.out",
        "--marker",
        "../logs/t1.done",
        "--",
        "./probe.sh",
      ],
      stubs,
      f.caller,
      { POSTMASTER_HOST: "tmux", CALLER_VAR: "v" },
    );
    await marker(markerPath("t1"));
    await pass(
      "a first launch opens session postmaster-<repo>, a window named for it",
      () =>
        tmuxEnvRun.out.trim() === `host=tmux session=postmaster-${basename(f.repo)} window=@1` &&
        calls(root, "tmux").some((line) =>
          line.startsWith(
            `new-session\t-d\t-P\t-F\t#{window_id}\t-s\tpostmaster-${basename(f.repo)}\t-n\t${f.name}`,
          ),
        ),
      `${tmuxEnvRun.out}\n${readFileSync(join(stub, "win-1.out"), "utf8")}`,
    );
    const tmuxProbe = readFileSync(join(logs, "t1.out"), "utf8");
    await pass(
      "the launch ran with that window's pane and its caller's environment",
      () => field(tmuxProbe, "tmuxpane") === "%1" && field(tmuxProbe, "var") === "v",
      tmuxProbe +
        "\nwindow:\n" +
        readFileSync(join(stub, "win-1.env"), "utf8") +
        "\npane out:\n" +
        readFileSync(join(stub, "win-1.out"), "utf8"),
    );
    const nextTmux = execHost(
      ["run", f.name, worktree, "--marker", "../logs/t2.done", "--", "sleep", "60"],
      stubs,
      f.caller,
      { POSTMASTER_HOST: "tmux" },
    );
    await pass(
      "the next is a window in the same session",
      () =>
        nextTmux.code === 0 &&
        calls(root, "tmux").some((line) =>
          line.startsWith(
            `new-window\t-d\t-P\t-F\t#{window_id}\t-t\t=postmaster-${basename(f.repo)}:`,
          ),
        ),
    );
    const closeWhileRunning = execHost(["close", worktree], stubs, root, {
      POSTMASTER_HOST: "tmux",
    });
    await pass(
      "close refuses while a launch still runs in the worktree",
      () =>
        closeWhileRunning.code === 2 &&
        !calls(root, "tmux").some((line) => line.startsWith("kill-window")),
    );
    const stopTmux = execHost(["stop", worktree], stubs, root, {
      POSTMASTER_HOST: "tmux",
      POSTMASTER_HOST_STOP_WAIT: "0",
    });
    await marker(markerPath("t2"));
    const closeTmux = execHost(["close", worktree], stubs, root, { POSTMASTER_HOST: "tmux" });
    await pass(
      "once it is stopped, close kills that worktree's windows",
      () =>
        stopTmux.code === 0 &&
        closeTmux.code === 0 &&
        calls(root, "tmux").filter((line) => line.startsWith("kill-window")).length === 2,
    );
    const cloneTmux = execHost(
      ["run", f.name, f.clone, "--marker", "../logs/t3.done", "--", "./fixed.sh"],
      stubs,
      f.caller,
      { POSTMASTER_HOST: "tmux" },
    );
    await marker(markerPath("t3"));
    const tmuxState = json(join(stub, "tmux.json"), { sessions: [], windows: {} });
    const cloneWindow = Object.values(tmuxState.windows).some(
      (window: any) =>
        window.session === `postmaster-${basename(f.repo)}` &&
        window.opts["@postmaster_cwd"] === f.clone,
    );
    await pass(
      "a reviewer's scratch clone gets a window in the session of the repository it was cut from",
      () => cloneTmux.code === 0 && cloneWindow && tmuxState.sessions.length === 1,
    );
    const cloneTmuxClose = execHost(["close", f.clone], stubs, root, { POSTMASTER_HOST: "tmux" });
    await pass(
      "and close kills it",
      () =>
        cloneTmuxClose.code === 0 &&
        calls(root, "tmux").filter((line) => line.startsWith("kill-window")).length === 3,
    );
    // The session name is BASE's tmux_session: postmaster-<repo> with the
    // characters tmux refuses replaced, so both sides address one session.
    // After the exact kill counts above, which a new session would disturb.
    const dotted = join(root, "dot.ted:repo");
    mkdirSync(dotted, { recursive: true });
    exec("git", ["init", "-q", dotted]);
    const dottedRun = execHost(
      ["run", "dotlane", dotted, "--marker", markerPath("td"), "--", "true"],
      stubs,
      f.caller,
      { POSTMASTER_HOST: "tmux" },
    );
    await pass(
      "a dotted repo opens session postmaster-<repo> with dots and colons replaced",
      () =>
        dottedRun.code === 0 &&
        dottedRun.out.includes("session=postmaster-dot_ted_repo") &&
        calls(root, "tmux").some((line) => line.includes("\t-s\tpostmaster-dot_ted_repo\t")),
      dottedRun.out,
    );
    execHost(["close", dotted], stubs, root, { POSTMASTER_HOST: "tmux" });

    console.log("interactive sessions");
    const noSpawn = execHost(["spawn", "postmaster-repo", f.repo, "--", "claude"]);
    const noSend = execHost(["send", "postmaster-repo", join(f.caller, "fixed.sh")]);
    const noRead = execHost(["read", "postmaster-repo"]);
    await pass(
      "with no host, spawn, send and read say so, exit 3",
      () => noSpawn.code === 3 && noSend.code === 3 && noRead.code === 3,
    );
    resetHarness(root);
    const spawnHerdr = execHost(
      [
        "spawn",
        "postmaster-repo",
        join(f.repo, ".worktrees/T-1-luna"),
        "--label",
        POSTMASTER_LABEL,
        "--",
        "claude",
        "--model",
        "m",
      ],
      stubs,
      root,
      { POSTMASTER_CONFIG: "/elsewhere/config.toml" },
    );
    const herdrCalls = calls(root, "herdr");
    await pass(
      "Herdr: spawn starts the agent in a tab of the repository's own space",
      () =>
        spawnHerdr.code === 0 &&
        herdrCalls.includes("tab\trename\tw1:t1\tpostmaster") &&
        herdrCalls.includes(
          "agent\tstart\tpostmaster-repo\t--kind\tclaude\t--pane\tp2\t--\t--model\tm",
        ),
      herdrCalls.join("\n"),
    );
    await pass("with the caller's POSTMASTER_ settings in its pane", () =>
      herdrCalls.some((line) => line.includes("--env\tPOSTMASTER_CONFIG=/elsewhere/config.toml")),
    );
    const duplicate = execHost(["spawn", "postmaster-repo", f.repo, "--", "claude"], stubs, root);
    await pass(
      "a handle a live agent already has is refused",
      () =>
        duplicate.code === 1 &&
        calls(root, "herdr").filter((line) => line.startsWith("agent\tstart\tpostmaster-repo"))
          .length === 1,
    );
    writeFileSync(join(stub, "agent.notready"), "");
    const notReady = execHost(["spawn", "postmaster-other", f.repo, "--", "claude"], stubs, root);
    rmSync(join(stub, "agent.notready"), { force: true });
    await pass(
      "a harness asking something on first start: spawn says so, and does not fail",
      () => notReady.code === 0 && notReady.err.includes("asking something"),
    );
    const normalized = execHost(
      ["spawn", "My.Project postmaster", f.repo, "--", "claude"],
      stubs,
      root,
    );
    await pass(
      "a handle becomes a Herdr agent name: lowercase, no dots or spaces",
      () =>
        normalized.code === 0 &&
        calls(root, "herdr").some((line) =>
          line.startsWith("agent\tstart\tmy-project-postmaster\t"),
        ),
    );
    const long1 = callText(["_handle", "postmaster-acme-platform-service-billing"], noHost, root);
    const long2 = callText(["_handle", "postmaster-acme-platform-service-payments"], noHost, root);
    await pass(
      "two long names that share a start get two handles, each always the same, none over 32",
      () =>
        long1 !== long2 &&
        long1 === callText(["_handle", "postmaster-acme-platform-service-billing"], noHost, root) &&
        long1.length <= 32 &&
        long2.length <= 32,
    );
    // Handles are BASE's handle_of through tr and cksum, byte for byte: tr folds
    // ASCII case and replaces every other BYTE, so non-ASCII widens to dashes.
    const baseHandle =
      "h=$(printf '%s' \"$1\" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9_-' '-'); " +
      "case $h in [a-z]*) ;; *) h=p$h;; esac; " +
      "if [ ${#h} -gt 32 ]; then sum=$(printf '%s' \"$1\" | cksum | cut -d' ' -f1); " +
      'h=$(printf \'%s-%08x\' "${h:0:23}" "$sum"); fi; printf \'%s\' "$h"';
    const baseOf = (text: string): string => exec("bash", ["-c", baseHandle, "_", text]).out;
    const handleCases = [
      "My.Project 1",
      "9lives",
      "café au lait",
      "postmaster-acme-platform-service-billing",
      "Ünïcödé-rün-näme-with-many-characters",
      "",
      "A",
    ];
    await pass("every handle is BASE's handle_of, ASCII and non-ASCII, short and long", () =>
      handleCases.every((text) => callText(["_handle", text], noHost, root) === baseOf(text)),
    );
    const message = join(root, "message.txt");
    writeFileSync(message, "Read the brief.");
    const sent = execHost(["send", "postmaster-repo", message], stubs, root);
    await pass(
      "Herdr: send submits the file's text as the agent's prompt",
      () =>
        sent.code === 0 &&
        calls(root, "herdr").some(
          (line) => line === "agent\tprompt\tpostmaster-repo\tRead the brief.",
        ),
    );
    const sentWait = execHost(["send", "postmaster-repo", message, "--wait", "30"], stubs, root);
    await pass(
      "Herdr: send --wait sends and waits in one call, never a prompt then a wait",
      () =>
        sentWait.code === 0 &&
        calls(root, "herdr").some(
          (line) =>
            line === "agent\tprompt\tpostmaster-repo\tRead the brief.\t--wait\t--timeout\t30000",
        ) &&
        !calls(root, "herdr").some((line) => line.startsWith("agent\twait")),
    );
    writeFileSync(join(stub, "agent.blocked"), "");
    const blockedSend = execHost(["send", "postmaster-repo", message, "--wait", "30"], stubs, root);
    const blockedWait = execHost(["wait", "postmaster-repo", "5"], stubs, root);
    rmSync(join(stub, "agent.blocked"), { force: true });
    await pass(
      "a turn that stops at an approval or a question is not settled: exit 3",
      () => blockedSend.code === 3 && blockedWait.code === 3,
    );
    const waited = execHost(["wait", "postmaster-repo", "5"], stubs, root);
    const read = execHost(["read", "postmaster-repo", "7"], stubs, root);
    await pass(
      "Herdr: wait and read go to the agent by its handle",
      () =>
        waited.code === 0 &&
        calls(root, "herdr").includes("agent\twait\tpostmaster-repo\t--timeout\t5000") &&
        read.code === 0 &&
        calls(root, "herdr").includes(
          "agent\tread\tpostmaster-repo\t--source\trecent-unwrapped\t--lines\t7",
        ),
    );
    resetHarness(root);
    const tmuxSpawn = execHost(["spawn", "postmaster-repo", f.repo, "--", "claude"], stubs, root, {
      POSTMASTER_HOST: "tmux",
      POSTMASTER_CONFIG: "/elsewhere/config.toml",
    });
    await pass(
      "tmux: spawn passes the caller's POSTMASTER_ settings to the window",
      () =>
        tmuxSpawn.code === 0 &&
        readFileSync(join(stub, "win-1.env"), "utf8").includes(
          "POSTMASTER_CONFIG=/elsewhere/config.toml",
        ),
    );
    const tmuxSend = execHost(["send", "postmaster-repo", message], stubs, root, {
      POSTMASTER_HOST: "tmux",
    });
    const tmuxCalls = calls(root, "tmux").map(
      (line) => line.split("\t")[0] + (line.startsWith("paste-buffer\t-p") ? "(-p)" : ""),
    );
    await pass(
      "tmux: send pastes bracketed, then presses Enter as its own key",
      () =>
        tmuxSend.code === 0 &&
        tmuxCalls.slice(-3).join(" ") === "load-buffer paste-buffer(-p) send-keys",
    );
    const tmuxWait = execHost(["wait", "postmaster-repo", "20"], stubs, root, {
      POSTMASTER_HOST: "tmux",
      POSTMASTER_HOST_QUIET: "2",
    });
    const tmuxRead = execHost(["read", "postmaster-repo", "7"], stubs, root, {
      POSTMASTER_HOST: "tmux",
    });
    await pass(
      "tmux: wait settles on a quiet screen, and read takes the lines asked for",
      () =>
        tmuxWait.code === 0 &&
        calls(root, "tmux").some((line) => line === "capture-pane\t-p\t-J\t-S\t-7\t-t\t@1") &&
        tmuxRead.code === 0,
    );

    console.log("run role: the explicit host role");
    const capDispatch = join(root, "cap-dispatch");
    mkdirSync(join(capDispatch, "logs"), { recursive: true });
    writeFileSync(
      join(capDispatch, "run.json"),
      '{"config":{"limits":{"memory_max":"8G","tasks_max":512,"lane":{"memory_max":"64M","tasks_max":16},"coachman":{"memory_max":"128M","tasks_max":32},"reviewer":{"tasks_max":24}}}}\n',
    );
    writeFileSync(
      join(f.caller, "launch.sh"),
      ["#!/usr/bin/env bash", "printf 'role=%s\\n' \"${POSTMASTER_LAUNCH_ROLE:-unset}\"", ""].join(
        "\n",
      ),
    );
    exec("chmod", ["+x", join(f.caller, "launch.sh")]);
    execHost(
      [
        "run",
        NAME,
        f.repo,
        "--role",
        "reviewer",
        "--run",
        capDispatch,
        "--out",
        "../logs/role.out",
        "--marker",
        "../logs/role.done",
        "--",
        "./launch.sh",
      ],
      noHost,
      f.caller,
      { POSTMASTER_LAUNCH_ROLE: "spoof" },
    );
    await marker(markerPath("role"));
    const roleOut = readFileSync(join(logs, "role.out"), "utf8");
    await pass(
      "the run's explicit host role reaches launch.sh and an inherited role cannot replace it",
      () => roleOut === "role=reviewer\n",
      roleOut,
    );

    console.log(
      "run environment identity, Claude session and lane env file: Herdr, tmux and no host",
    );
    const claudeIdentityNames = [
      "CLAUDECODE",
      "CLAUDE_PID",
      "CLAUDE_CODE_SESSION_ID",
      "CLAUDE_CODE_CHILD_SESSION",
      "CLAUDE_CODE_ENTRYPOINT",
      "CLAUDE_CODE_EXECPATH",
      "CLAUDE_CODE_SESSION_ATTENDED",
      "CLAUDE_CODE_MESSAGING_SOCKET",
      "CLAUDE_CODE_MESSAGING_TOKEN",
      "CLAUDE_CODE_TOOL_USE_ID",
      "CLAUDE_CODE_SESSION_EXTRA",
      "CLAUDE_CODE_MESSAGING_EXTRA",
      "CLAUDE_CODE_CHILD_EXTRA",
    ];
    const herdrIdentityNames = [
      "HERDR_PANE_ID",
      "HERDR_TAB_ID",
      "HERDR_WORKSPACE_ID",
      "HERDR_ENV",
      "HERDR_SOCKET_PATH",
      "HERDR_BIN_PATH",
      "HERDR_CUSTOM",
    ];
    const claudeIdentityEnv: Record<string, string> = {
      CLAUDECODE: "caller-claudecode",
      CLAUDE_PID: "caller-pid",
      CLAUDE_CODE_SESSION_ID: "caller-thread",
      CLAUDE_CODE_CHILD_SESSION: "caller-child",
      CLAUDE_CODE_ENTRYPOINT: "caller-entry",
      CLAUDE_CODE_EXECPATH: "caller-exec",
      CLAUDE_CODE_SESSION_ATTENDED: "caller-attended",
      CLAUDE_CODE_MESSAGING_SOCKET: "caller-socket",
      CLAUDE_CODE_MESSAGING_TOKEN: "caller-token",
      CLAUDE_CODE_TOOL_USE_ID: "caller-tool-use",
      CLAUDE_CODE_SESSION_EXTRA: "caller-session-extra",
      CLAUDE_CODE_MESSAGING_EXTRA: "caller-messaging-extra",
      CLAUDE_CODE_CHILD_EXTRA: "caller-child-extra",
    };
    const herdrIdentityEnv: Record<string, string> = {
      HERDR_PANE_ID: "caller-pane",
      HERDR_TAB_ID: "caller-tab",
      HERDR_WORKSPACE_ID: "caller-workspace",
      HERDR_ENV: "caller-env",
      HERDR_SOCKET_PATH: "/caller/herdr.sock",
      HERDR_BIN_PATH: "/caller/herdr-bin",
      HERDR_CUSTOM: "caller-herdr-extra",
    };
    const callerConfigEnv: Record<string, string> = {
      CALLER_VAR: "caller-value",
      POSTMASTER_CUSTOM: "caller-postmaster",
      POSTMASTER_CONFIG: join(root, "claude-launch.toml"),
      CLAUDE_CONFIG_DIR: join(root, "claude-config"),
      CLAUDE_EFFORT: "high",
      CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS: "123",
      CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY: "1",
      ANTHROPIC_BASE_URL: "https://caller.invalid",
      ANTHROPIC_AUTH_TOKEN: "fixture-auth-token",
    };
    const exactIdentity =
      " CLAUDECODE CLAUDE_PID CLAUDE_CODE_SESSION_ID CLAUDE_CODE_CHILD_SESSION CLAUDE_CODE_ENTRYPOINT CLAUDE_CODE_EXECPATH CLAUDE_CODE_SESSION_ATTENDED CLAUDE_CODE_MESSAGING_SOCKET CLAUDE_CODE_MESSAGING_TOKEN CLAUDE_CODE_TOOL_USE_ID ";
    writeFileSync(
      join(f.caller, "env-probe.sh"),
      [
        "#!/usr/bin/env bash",
        "# Reports the caller identity a launch still sees: every Claude session name and family",
        "# member present, every HERDR_* variable present, the pane's six values, and caller",
        "# configuration.",
        `exact="${exactIdentity}"`,
        'claude_keys=""',
        'herdr_keys=""',
        "while IFS= read -r name; do",
        '  case "$name" in',
        "    CLAUDE_CODE_SESSION_*|CLAUDE_CODE_MESSAGING_*|CLAUDE_CODE_CHILD_*)",
        '      claude_keys="${claude_keys}${claude_keys:+,}$name" ;;',
        '    HERDR_*) herdr_keys="${herdr_keys}${herdr_keys:+,}$name" ;;',
        "    *)",
        '      case "$exact" in *" $name "*) claude_keys="${claude_keys}${claude_keys:+,}$name" ;; esac ;;',
        "  esac",
        "done < <(compgen -e | sort)",
        "printf '%s\\n' \"claude_keys=$claude_keys|herdr_keys=$herdr_keys|herdr_pane=${HERDR_PANE_ID:-unset}|herdr_tab=${HERDR_TAB_ID:-unset}|herdr_workspace=${HERDR_WORKSPACE_ID:-unset}|herdr_env=${HERDR_ENV:-unset}|herdr_socket=${HERDR_SOCKET_PATH:-unset}|herdr_bin=${HERDR_BIN_PATH:-unset}|herdr_custom=${HERDR_CUSTOM:-unset}|caller=${CALLER_VAR:-unset}|postmaster_custom=${POSTMASTER_CUSTOM:-unset}|postmaster_config=${POSTMASTER_CONFIG:-unset}|claude_config_dir=${CLAUDE_CONFIG_DIR:-unset}|claude_effort=${CLAUDE_EFFORT:-unset}|claude_bg_wait=${CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS:-unset}|claude_feedback=${CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY:-unset}|anthropic_base=${ANTHROPIC_BASE_URL:-unset}|anthropic_auth=${ANTHROPIC_AUTH_TOKEN:-unset}\"",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(f.caller, "lane.env"),
      [
        "LANE_ENV_ONLY=from-lane-env-file",
        "ANTHROPIC_BASE_URL=https://lane.invalid",
        "CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=456",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(root, "claude-launch.toml"),
      [
        "[lanes.test]",
        'harness = "claude"',
        'model = "host-self-test"',
        `env_file = "${join(f.caller, "lane.env")}"`,
        "",
      ].join("\n"),
    );
    writeFileSync(join(f.caller, "prompt.txt"), "Continue.\n");
    writeFileSync(
      join(root, "bin", "claude"),
      [
        "#!/usr/bin/env bash",
        "# A claude harness for the identity controls: it records the session identity and",
        "# configuration it saw, then behaves like a headless run. Inherited session identity",
        "# answers without owning a record; a fresh launch owns thread-$HOST_TEST_RUN; a resume",
        "# continues its thread.",
        `exact="${exactIdentity}"`,
        "identity_names=()",
        "herdr_names=()",
        "while IFS= read -r name; do",
        '  case "$name" in',
        "    CLAUDE_CODE_SESSION_*|CLAUDE_CODE_MESSAGING_*|CLAUDE_CODE_CHILD_*)",
        '      identity_names+=("$name") ;;',
        '    HERDR_*) herdr_names+=("$name") ;;',
        "    *)",
        '      case "$exact" in *" $name "*) identity_names+=("$name") ;; esac ;;',
        "  esac",
        "done < <(compgen -e | sort)",
        'identity_json=""',
        'for name in "${identity_names[@]}"; do',
        '  identity_json="${identity_json}${identity_json:+,}\\"$name\\""',
        "done",
        'herdr_json=""',
        'for name in "${herdr_names[@]}"; do',
        "  value=${!name}",
        "  value=${value//\\\\/\\\\\\\\}",
        '  value=${value//\\"/\\\\\\"}',
        '  herdr_json="${herdr_json}${herdr_json:+,}\\"$name\\":\\"$value\\""',
        "done",
        'env_json=""',
        "for name in CALLER_VAR POSTMASTER_CUSTOM POSTMASTER_CONFIG CLAUDE_CONFIG_DIR CLAUDE_EFFORT CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN LANE_ENV_ONLY; do",
        '  if [ -n "${!name+x}" ]; then value=${!name}; else value=unset; fi',
        "  value=${value//\\\\/\\\\\\\\}",
        '  value=${value//\\"/\\\\\\"}',
        '  env_json="${env_json}${env_json:+,}\\"$name\\":\\"$value\\""',
        "done",
        'if [ -n "${HOST_TEST_OBSERVED:-}" ]; then',
        `  printf '{"env":{%s},"herdr":{%s},"identity":[%s]}\\n' "$env_json" "$herdr_json" "$identity_json" >> "$HOST_TEST_OBSERVED"`,
        "fi",
        'if [ "${#identity_names[@]}" -gt 0 ]; then',
        "  # Model #67's failure: a nested headless run can finish without owning a record.",
        `  printf '{"type":"system","subtype":"init","session_id":"%s","model":"stub"}\\n' "\${CLAUDE_CODE_SESSION_ID:-caller-thread}"`,
        `  printf '{"type":"result","subtype":"success","num_turns":1}\\n'`,
        "  exit 0",
        "fi",
        "resume=0",
        'session_id=""',
        'prev=""',
        'for arg in "$@"; do',
        '  if [ "$prev" = "--resume" ]; then resume=1; session_id="$arg"; fi',
        '  prev="$arg"',
        "done",
        'if [ "$resume" = 1 ]; then',
        '  record="$CLAUDE_CONFIG_DIR/sessions/$session_id.jsonl"',
        '  if [ ! -f "$record" ]; then echo "Session not found" >&2; exit 1; fi',
        "  printf 'resume\\n' >> \"$record\"",
        "else",
        '  session_id="thread-$HOST_TEST_RUN"',
        '  record="$CLAUDE_CONFIG_DIR/sessions/$session_id.jsonl"',
        '  mkdir -p "$CLAUDE_CONFIG_DIR/sessions"',
        "  printf 'new\\n' > \"$record\"",
        "fi",
        `printf '{"type":"system","subtype":"init","session_id":"%s","model":"stub"}\\n' "$session_id"`,
        `printf '{"type":"result","subtype":"success","num_turns":1}\\n'`,
        "",
      ].join("\n"),
    );
    exec("chmod", ["+x", join(f.caller, "env-probe.sh")]);
    exec("chmod", ["+x", join(root, "bin", "claude")]);
    const containsAll = (values: string, names: string[]): boolean =>
      names.every((name) => `,${values},`.includes(`,${name},`));
    const readText = (path: string): string => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return "";
      }
    };
    const lastLine = (path: string): string => {
      const lines = readText(path).trimEnd().split("\n");
      return lines[lines.length - 1] ?? "";
    };
    const observe = (path: string, key: string): string => {
      const record = JSON.parse(lastLine(path));
      if (key === "identity_keys") return (record.identity as string[]).join(",");
      if (key === "herdr_keys")
        return Object.keys(record.herdr as Record<string, string>)
          .sort()
          .join(",");
      if (key.startsWith("herdr:"))
        return (record.herdr as Record<string, string>)[key.slice("herdr:".length)] ?? "unset";
      return (record.env as Record<string, string>)[key] ?? "unset";
    };
    const streamSessions = (path: string): string =>
      readText(path)
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line))
        .filter((event: any) => event.subtype === "init")
        .map((event: any) => String(event.session_id ?? ""))
        .join(",");
    const lunaWorktree = join(f.repo, ".worktrees/T-1-luna");
    for (const mode of ["herdr", "tmux", "none"]) {
      const under = mode === "herdr" ? ["--under", run1] : [];
      const launchEnv = { ...claudeIdentityEnv, ...herdrIdentityEnv, ...callerConfigEnv };
      const inputProbe = exec(join(f.caller, "env-probe.sh"), [], {
        cwd: f.caller,
        env: { HOME: process.env.HOME ?? "/", PATH: stubs, STUB: stub, ...launchEnv },
      }).out;
      await pass(
        `AC1 ${mode} positive control: caller carries every Claude identity name`,
        () => containsAll(field(inputProbe, "claude_keys"), claudeIdentityNames),
        inputProbe,
      );
      await pass(
        `AC2 ${mode} positive control: caller carries every Herdr variable`,
        () =>
          containsAll(field(inputProbe, "herdr_keys"), herdrIdentityNames) &&
          field(inputProbe, "herdr_custom") === "caller-herdr-extra",
        inputProbe,
      );
      await pass(
        `AC3 ${mode} positive control: caller configuration is present before the handoff`,
        () =>
          field(inputProbe, "caller") === "caller-value" &&
          field(inputProbe, "postmaster_custom") === "caller-postmaster" &&
          field(inputProbe, "claude_bg_wait") === "123" &&
          field(inputProbe, "anthropic_base") === "https://caller.invalid",
        inputProbe,
      );

      const outputProbe = join(logs, `${mode}.identity-output`);
      const probeMarker = join(logs, `${mode}.identity-probe.done`);
      const probeRun = execHost(
        [
          "run",
          NAME,
          lunaWorktree,
          ...under,
          "--out",
          outputProbe,
          "--marker",
          probeMarker,
          "--",
          "./env-probe.sh",
        ],
        stubs,
        f.caller,
        { ...launchEnv, POSTMASTER_HOST: mode },
      );
      await marker(probeMarker, 60);
      const placed = probeRun.out.trim();
      const placedHost =
        mode === "herdr"
          ? placed.startsWith("host=herdr ")
          : mode === "tmux"
            ? placed.startsWith("host=tmux ")
            : placed === "host=none";
      await pass(
        `AC5 ${mode} positive host control: launch used the requested host`,
        () => placedHost,
        placed,
      );
      const output = readFileSync(outputProbe, "utf8");
      await pass(
        `AC1 ${mode} negative control: launch receives no Claude session identity`,
        () => field(output, "claude_keys") === "",
        output,
      );
      if (mode === "herdr") {
        await pass(
          "AC2 Herdr negative control: launch receives only its pane's six Herdr values",
          () =>
            field(output, "herdr_keys") ===
              "HERDR_BIN_PATH,HERDR_ENV,HERDR_PANE_ID,HERDR_SOCKET_PATH,HERDR_TAB_ID,HERDR_WORKSPACE_ID" &&
            field(output, "herdr_pane") === kvOf(placed, "pane") &&
            field(output, "herdr_tab") === `tab-of-${kvOf(placed, "pane")}` &&
            field(output, "herdr_workspace") === kvOf(placed, "space") &&
            field(output, "herdr_env") === "pane-env" &&
            field(output, "herdr_socket") === "/stub/herdr.sock" &&
            field(output, "herdr_bin") === "/stub/herdr-bin" &&
            field(output, "herdr_custom") === "unset",
          output,
        );
      } else {
        await pass(
          `AC2 ${mode} negative control: launch receives no Herdr variables`,
          () =>
            field(output, "herdr_keys") === "" &&
            field(output, "herdr_pane") === "unset" &&
            field(output, "herdr_custom") === "unset",
          output,
        );
      }
      await pass(
        `AC3 ${mode} negative identity control: other caller configuration still reaches launch`,
        () =>
          field(output, "caller") === "caller-value" &&
          field(output, "postmaster_custom") === "caller-postmaster" &&
          field(output, "postmaster_config") === join(root, "claude-launch.toml") &&
          field(output, "claude_config_dir") === join(root, "claude-config") &&
          field(output, "claude_effort") === "high" &&
          field(output, "claude_bg_wait") === "123" &&
          field(output, "claude_feedback") === "1" &&
          field(output, "anthropic_base") === "https://caller.invalid" &&
          field(output, "anthropic_auth") === "fixture-auth-token",
        output,
      );

      const directStream = join(logs, `${mode}.inherited-identity.events`);
      const directObserved = join(logs, `${mode}.inherited-identity.jsonl`);
      const directClaude = exec(join(root, "bin", "claude"), ["-p", "direct"], {
        cwd: f.caller,
        env: {
          HOME: process.env.HOME ?? "/",
          PATH: stubs,
          STUB: stub,
          ...launchEnv,
          HOST_TEST_RUN: mode,
          HOST_TEST_OBSERVED: directObserved,
        },
      });
      writeFileSync(directStream, directClaude.out);
      const sessionRecord = join(root, "claude-config", "sessions", `thread-${mode}.jsonl`);
      await pass(
        `AC4 ${mode} negative control: inherited Claude identity writes no caller-thread record`,
        () =>
          streamSessions(directStream) === "caller-thread" &&
          !existsSync(join(root, "claude-config", "sessions", "caller-thread.jsonl")) &&
          observe(directObserved, "identity_keys") !== "",
        directClaude.out,
      );

      const launchEvents = join(logs, `${mode}.claude.events`);
      const launchErr = join(logs, `${mode}.claude.err`);
      const launchMarker = join(logs, `${mode}.claude.done`);
      const launchObserved = join(logs, `${mode}.claude.jsonl`);
      const claudeRun = execHost(
        [
          "run",
          NAME,
          lunaWorktree,
          ...under,
          "--out",
          launchEvents,
          "--err",
          launchErr,
          "--marker",
          launchMarker,
          "--",
          join(HERE, "launch.sh"),
          "launch",
          "test",
          lunaWorktree,
          join(f.caller, "prompt.txt"),
        ],
        stubs,
        f.caller,
        {
          ...launchEnv,
          POSTMASTER_HOST: mode,
          HOST_TEST_RUN: mode,
          HOST_TEST_OBSERVED: launchObserved,
        },
      );
      await marker(launchMarker, 60);
      const claudePlaced = claudeRun.out.trim();
      const thread = streamSessions(launchEvents);
      await pass(
        `AC1 ${mode} Claude control: host launch strips caller identity before the harness`,
        () => observe(launchObserved, "identity_keys") === "",
        lastLine(launchObserved),
      );
      await pass(
        `AC2 ${mode} Claude control: harness sees only the pane's Herdr identity`,
        () =>
          mode === "herdr"
            ? observe(launchObserved, "herdr_keys") ===
                "HERDR_BIN_PATH,HERDR_ENV,HERDR_PANE_ID,HERDR_SOCKET_PATH,HERDR_TAB_ID,HERDR_WORKSPACE_ID" &&
              observe(launchObserved, "herdr:HERDR_PANE_ID") === kvOf(claudePlaced, "pane") &&
              observe(launchObserved, "herdr:HERDR_TAB_ID") ===
                `tab-of-${kvOf(claudePlaced, "pane")}` &&
              observe(launchObserved, "herdr:HERDR_WORKSPACE_ID") === kvOf(claudePlaced, "space") &&
              observe(launchObserved, "herdr:HERDR_ENV") === "pane-env" &&
              observe(launchObserved, "herdr:HERDR_SOCKET_PATH") === "/stub/herdr.sock" &&
              observe(launchObserved, "herdr:HERDR_BIN_PATH") === "/stub/herdr-bin"
            : observe(launchObserved, "herdr_keys") === "",
        lastLine(launchObserved),
      );
      await pass(
        `AC3 ${mode} Claude control: caller and lane env-file settings reach the harness`,
        () =>
          observe(launchObserved, "CALLER_VAR") === "caller-value" &&
          observe(launchObserved, "POSTMASTER_CUSTOM") === "caller-postmaster" &&
          observe(launchObserved, "POSTMASTER_CONFIG") === join(root, "claude-launch.toml") &&
          observe(launchObserved, "CLAUDE_CONFIG_DIR") === join(root, "claude-config") &&
          observe(launchObserved, "CLAUDE_EFFORT") === "high" &&
          observe(launchObserved, "CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS") === "456" &&
          observe(launchObserved, "CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY") === "1" &&
          observe(launchObserved, "ANTHROPIC_BASE_URL") === "https://lane.invalid" &&
          observe(launchObserved, "ANTHROPIC_AUTH_TOKEN") === "fixture-auth-token" &&
          observe(launchObserved, "LANE_ENV_ONLY") === "from-lane-env-file",
        lastLine(launchObserved),
      );
      await pass(
        `AC4 ${mode} positive control: streamed session id owns its record`,
        () =>
          thread === `thread-${mode}` &&
          existsSync(sessionRecord) &&
          readText(sessionRecord).split("\n").includes("new"),
        thread,
      );

      const resumeMarker = join(logs, `${mode}.resume.done`);
      execHost(
        [
          "run",
          NAME,
          lunaWorktree,
          ...under,
          "--append",
          "--out",
          launchEvents,
          "--err",
          launchErr,
          "--marker",
          resumeMarker,
          "--",
          join(HERE, "launch.sh"),
          "resume",
          "test",
          lunaWorktree,
          `thread-${mode}`,
          join(f.caller, "prompt.txt"),
        ],
        stubs,
        f.caller,
        {
          ...launchEnv,
          POSTMASTER_HOST: mode,
          HOST_TEST_RUN: mode,
          HOST_TEST_OBSERVED: launchObserved,
        },
      );
      await marker(resumeMarker, 60);
      await pass(
        `AC4 ${mode} positive resume control: resume continues the streamed thread`,
        () =>
          streamSessions(launchEvents) === `thread-${mode},thread-${mode}` &&
          readText(sessionRecord).split("\n").includes("resume"),
        `${streamSessions(launchEvents)} / ${readText(sessionRecord)}`,
      );
      await pass(
        `AC1 and AC3 ${mode} resume control: identity stays stripped and env file stays present`,
        () =>
          observe(launchObserved, "identity_keys") === "" &&
          observe(launchObserved, "LANE_ENV_ONLY") === "from-lane-env-file" &&
          observe(launchObserved, "CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS") === "456",
        lastLine(launchObserved),
      );
    }
  } catch (error) {
    failures++;
    console.error(`host self-test setup failed: ${String((error as Error).message ?? error)}`);
  } finally {
    for (const directory of [join(root, "logs"), join(root, "tree"), join(root, "stub")]) {
      for (const name of readdir(directory)) {
        if (!name.endsWith(".pid")) continue;
        try {
          const pid = Number(readFileSync(join(directory, name), "utf8").trim());
          if (!pid) continue;
          try {
            process.kill(-pid, "SIGKILL");
          } catch {
            try {
              process.kill(pid, "SIGKILL");
            } catch {}
          }
        } catch {}
      }
    }
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {}
  }
  if (failures) {
    console.log("");
    console.log(`self-test: ${failures} control(s) misbehaved`);
    return failures;
  }
  console.log("");
  console.log("self-test: all controls behaved");
  return 0;
}

function available(program: string): boolean {
  return (process.env.PATH ?? "").split(":").some((path) => {
    try {
      accessSync(join(path || ".", program), constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

function parseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function at(value: any, path: string[]): any {
  return path.reduce((current, key) => current?.[key], value);
}

function liveHerdr(...args: string[]): Result {
  return exec("herdr", args, { timeout: 5000 });
}

function liveHost(
  args: string[],
  cwd: string,
  root: string,
  env: Record<string, string> = {},
): Result {
  return exec(SELF, [...args], {
    cwd,
    env: {
      ...process.env,
      POSTMASTER_HOST_STATE: join(root, "state"),
      POSTMASTER_HOST_FIXTURE: root,
      ...env,
    },
  });
}

function value(text: string, path: string[]): string {
  const result = at(parseJson(text), path);
  return result === undefined || result === null ? "" : String(result);
}

function worktreeSpace(text: string, path: string): string {
  const worktrees = at(parseJson(text), ["result", "worktrees"]);
  if (!Array.isArray(worktrees)) return "";
  const worktree = worktrees.find((entry: any) => entry.path === path);
  return worktree?.open_workspace_id ?? "";
}

export async function live(): Promise<void> {
  const root = mkdtempSync(join(HERE, ".host-live-test-"));
  mkdirSync(join(root, "state"), { recursive: true });
  const opened: string[] = [];
  let tmuxSession = "";
  let failures = 0;
  const pass = async (label: string, test: () => boolean | Promise<boolean>, detail = "") => {
    if (!(await check(label, test, detail))) failures++;
  };
  const openspace = (path: string): string => {
    const result = liveHerdr("worktree", "list", "--cwd", path);
    return worktreeSpace(result.out, path);
  };
  try {
    const f = await setup(root);
    const direct = exec(join(f.caller, "fixed.sh"), [], { cwd: f.caller });
    writeFileSync(join(f.logs, "direct.out"), direct.out);
    writeFileSync(join(f.logs, "direct.err"), direct.err);
    const detected = liveHost(["detect"], f.caller, root);
    console.log(`detected here: ${detected.out.trim()}`);

    const herdrReady = available("herdr") && liveHerdr("workspace", "list").code === 0;
    if (herdrReady) {
      console.log("Herdr, the positive control");
      const repoSpace = liveHerdr(
        "workspace",
        "create",
        "--cwd",
        f.repo,
        "--label",
        basename(f.repo),
        "--no-focus",
      );
      const rs = value(repoSpace.out, ["result", "workspace", "workspace_id"]);
      if (rs) opened.push(rs);
      const wt = join(f.repo, ".worktrees", "T-1-luna");
      const got = liveHost(
        [
          "run",
          f.name,
          wt,
          "--out",
          "../logs/l1.out",
          "--err",
          "../logs/l1.err",
          "--marker",
          "../logs/l1.done",
          "--",
          "./fixed.sh",
        ],
        f.caller,
        root,
        { EMIT_SLEEP: "8" },
      );
      const launch = got.out.trim();
      const space = kvOf(launch, "space");
      const pane = kvOf(launch, "pane");
      const tab = kvOf(launch, "tab");
      if (space) opened.push(space);
      await pass(
        "the launch runs in Herdr",
        () => got.code === 0 && launch.startsWith("host=herdr"),
        launch,
      );
      await pass(
        "in a pane of its own worktree's space",
        () => Boolean(space) && openspace(wt) === space,
      );

      const infoResult = liveHerdr("workspace", "get", space);
      const info = parseJson(infoResult.out);
      const source = liveHerdr("worktree", "list", "--cwd", wt);
      await pass(
        "that space is a linked worktree of the repository, whose own space is its parent",
        () =>
          at(info, ["result", "workspace", "worktree", "is_linked_worktree"]) === true &&
          at(info, ["result", "workspace", "worktree", "repo_root"]) === f.repo &&
          value(source.out, ["result", "source", "source_workspace_id"]) === rs,
        `${infoResult.out}\n${source.out}`,
      );
      const tabResult = liveHerdr("tab", "get", tab);
      await pass(
        "the space and the tab carry the launch's name, shell syntax and all, as written",
        () =>
          at(info, ["result", "workspace", "label"]) === f.name &&
          value(tabResult.out, ["result", "tab", "label"]) === f.name &&
          !existsSync(join(root, "canary")),
        `${infoResult.out}\n${tabResult.out}`,
      );

      let seen = "";
      for (let i = 0; i < 30; i++) {
        const paneInfo = parseJson(liveHerdr("pane", "get", pane).out);
        seen = `${at(paneInfo, ["result", "pane", "agent_status"]) ?? ""}|${at(paneInfo, ["result", "pane", "terminal_title_stripped"]) ?? ""}`;
        if (seen === `working|${f.name}`) break;
        await sleep(250);
      }
      await pass(
        "while it runs, the pane is working and its terminal title is the name",
        () => seen === `working|${f.name}`,
        seen,
      );
      await pass("its marker lands", () => marker(join(f.logs, "l1.done"), 60));
      await pass(
        "its stream and errors are what a direct run writes",
        () =>
          existsSync(join(f.logs, "l1.out")) &&
          existsSync(join(f.logs, "l1.err")) &&
          readFileSync(join(f.logs, "direct.out")).equals(readFileSync(join(f.logs, "l1.out"))) &&
          readFileSync(join(f.logs, "direct.err")).equals(readFileSync(join(f.logs, "l1.err"))),
      );
      await sleep(1000);
      const screen = liveHerdr(
        "pane",
        "read",
        pane,
        "--source",
        "recent-unwrapped",
        "--lines",
        "40",
      ).out;
      await pass(
        "the pane shows one line per event, not raw JSON",
        () =>
          screen.includes("says: step one") &&
          screen.includes("result: success") &&
          !screen.includes('{"type"'),
        screen,
      );
      await pass(
        "and the launch is released when it ends",
        () =>
          value(liveHerdr("pane", "get", pane).out, ["result", "pane", "agent_status"]) !==
          "working",
      );

      const noTty = liveHost(
        [
          "run",
          f.name,
          wt,
          "--out",
          "../logs/l6.out",
          "--marker",
          "../logs/l6.done",
          "--",
          "./probe.sh",
        ],
        f.caller,
        root,
      );
      await marker(join(f.logs, "l6.done"), 30);
      const probe = readFileSync(join(f.logs, "l6.out"), "utf8");
      await pass(
        "the launch has no terminal, and a group of its own",
        () => field(probe, "tty") === "no" && field(probe, "pgid") === field(probe, "pid"),
        `${noTty.out}\n${probe}`,
      );

      const stopped = liveHost(
        [
          "run",
          f.name,
          wt,
          "--marker",
          "../logs/l5.done",
          "--pidfile",
          "../logs/l5.pid",
          "--",
          "sleep",
          "120",
        ],
        f.caller,
        root,
      );
      await sleep(2000);
      const stoppedTab = kvOf(stopped.out, "tab");
      liveHerdr("tab", "close", stoppedTab);
      const childPid = Number(readFileSync(join(f.logs, "l5.pid"), "utf8").trim());
      await pass(
        "closing a launch's pane mid-run stops it, and its marker still lands",
        async () => (await marker(join(f.logs, "l5.done"), 10)) && !processExists(childPid),
        stopped.out,
      );

      const rev = join(f.repo, ".worktrees", "T-1-rev-luna");
      const reviewer = liveHost(
        ["run", `${f.name} review`, rev, "--marker", "../logs/l2.done", "--", "./fixed.sh"],
        f.caller,
        root,
      );
      const reviewSpace = kvOf(reviewer.out, "space");
      if (reviewSpace) opened.push(reviewSpace);
      await pass(
        "a detached reviewer scratch opens as a space too",
        async () =>
          Boolean(reviewSpace) &&
          openspace(rev) === reviewSpace &&
          (await marker(join(f.logs, "l2.done"), 60)),
        reviewer.out,
      );
      const clone = liveHost(
        [
          "run",
          `${f.name} security review`,
          f.clone,
          "--marker",
          "../logs/l7.done",
          "--",
          "./fixed.sh",
        ],
        f.caller,
        root,
      );
      const cloneSpace = kvOf(clone.out, "space");
      if (cloneSpace) opened.push(cloneSpace);
      await pass(
        "a reviewer's scratch clone opens as a space of its own",
        async () =>
          Boolean(cloneSpace) &&
          openspace(f.clone) === cloneSpace &&
          value(liveHerdr("workspace", "get", cloneSpace).out, ["result", "workspace", "label"]) ===
            `${f.name} security review` &&
          (await marker(join(f.logs, "l7.done"), 60)),
        clone.out,
      );
      const closeClone = liveHost(["close", f.clone], f.caller, root);
      await pass("and close shuts it", () => closeClone.code === 0 && !openspace(f.clone));
      const closeRepo = liveHost(["close", f.repo], f.caller, root);
      await pass(
        "close refuses the repository's own space",
        () => closeRepo.code === 2,
        closeRepo.err,
      );
      const closeWt = liveHost(["close", wt], f.caller, root);
      await pass(
        "close shuts the worktree's space, and only that",
        () => closeWt.code === 0 && !openspace(wt) && openspace(rev) === reviewSpace,
      );
      const closeReview = liveHost(["close", rev], f.caller, root);
      await pass("and the reviewer's", () => closeReview.code === 0 && !openspace(rev));

      console.log("no host, the negative control");
      const plain = join(f.repo, ".worktrees", "T-1-sol");
      const countBefore = Array.isArray(
        at(parseJson(liveHerdr("workspace", "list").out), ["result", "workspaces"]),
      )
        ? at(parseJson(liveHerdr("workspace", "list").out), ["result", "workspaces"]).length
        : -1;
      const background = liveHost(
        [
          "run",
          f.name,
          plain,
          "--out",
          "../logs/l3.out",
          "--err",
          "../logs/l3.err",
          "--marker",
          "../logs/l3.done",
          "--",
          "./fixed.sh",
        ],
        f.caller,
        root,
        { POSTMASTER_HOST: "none" },
      );
      await pass(
        "the same launch runs in the background",
        () => background.code === 0 && background.out.trim() === "host=none",
        background.out,
      );
      const noHostSpaces = liveHerdr("workspace", "list");
      const countAfter = Array.isArray(at(parseJson(noHostSpaces.out), ["result", "workspaces"]))
        ? at(parseJson(noHostSpaces.out), ["result", "workspaces"]).length
        : -1;
      await pass(
        "no space opens for it",
        () => !openspace(plain) && countAfter === countBefore,
        noHostSpaces.out,
      );
      await pass("its marker lands", () => marker(join(f.logs, "l3.done"), 60));
      await pass(
        "its stream and errors are the same",
        () =>
          existsSync(join(f.logs, "l3.out")) &&
          existsSync(join(f.logs, "l3.err")) &&
          readFileSync(join(f.logs, "direct.out")).equals(readFileSync(join(f.logs, "l3.out"))) &&
          readFileSync(join(f.logs, "direct.err")).equals(readFileSync(join(f.logs, "l3.err"))),
      );
    } else {
      console.log("Herdr: no server answers here; its controls are skipped");
    }

    if (available("tmux")) {
      console.log("tmux");
      const wt = join(f.repo, ".worktrees", "T-1-sol");
      const got = liveHost(
        [
          "run",
          f.name,
          wt,
          "--out",
          "../logs/l4.out",
          "--err",
          "../logs/l4.err",
          "--marker",
          "../logs/l4.done",
          "--",
          "./fixed.sh",
        ],
        f.caller,
        root,
        { POSTMASTER_HOST: "tmux" },
      );
      const launch = got.out.trim();
      tmuxSession = kvOf(launch, "session");
      await pass(
        "the launch runs in a window of session postmaster-<repo>, named for it",
        () =>
          got.code === 0 &&
          tmuxSession === `postmaster-${basename(f.repo)}` &&
          exec("tmux", [
            "list-windows",
            "-t",
            `=${tmuxSession}`,
            "-F",
            "#{window_name}",
          ]).out.trim() === f.name,
        launch,
      );
      await pass("its marker lands", () => marker(join(f.logs, "l4.done"), 60));
      await pass(
        "its stream and errors are the same",
        () =>
          existsSync(join(f.logs, "l4.out")) &&
          existsSync(join(f.logs, "l4.err")) &&
          readFileSync(join(f.logs, "direct.out")).equals(readFileSync(join(f.logs, "l4.out"))) &&
          readFileSync(join(f.logs, "direct.err")).equals(readFileSync(join(f.logs, "l4.err"))),
      );
      const closeTmux = liveHost(["close", wt], f.caller, root, { POSTMASTER_HOST: "tmux" });
      const windows = exec("tmux", [
        "list-windows",
        "-t",
        `=${tmuxSession}`,
        "-F",
        "#{window_name}",
      ]);
      await pass(
        "close kills the worktree's window",
        () => closeTmux.code === 0 && !windows.out.split("\n").includes(f.name),
      );
    } else {
      console.log("tmux: not on PATH; its controls are skipped");
    }
  } catch (error) {
    failures++;
    console.error(`host live-test setup failed: ${String((error as Error).message ?? error)}`);
  } finally {
    for (const workspace of opened.reverse()) liveHerdr("workspace", "close", workspace);
    if (tmuxSession) exec("tmux", ["kill-session", "-t", `=${tmuxSession}`]);
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {}
  }
  if (failures) {
    console.log("");
    console.log(`live test: ${failures} control(s) misbehaved`);
    process.exit(1);
  }
  console.log("");
  console.log("live test: all controls behaved");
}

function processExists(pid: number): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as { code?: string }).code !== "ESRCH";
  }
}

if (resolve(process.argv[1] ?? "") === resolve(SCRIPT)) {
  const args = process.argv.slice(2);
  if (args[0] === "--stub" && args[1] === "herdr") void herdrStub(args.slice(2));
  else if (args[0] === "--stub" && args[1] === "tmux") tmuxStub(args.slice(2));
  else
    runControls().catch((error: unknown) => {
      console.error(`host self-test failed: ${String((error as Error).message ?? error)}`);
      process.exit(1);
    });
}
