// Copy a finished lane or coachman thread into its project-local run record.
//
//   export-session.sh <dispatch> <name> <harness> <cwd> <events> [<harness-data>]
//   export-session.sh --self-test
//
// launch.sh calls this after a run launch exits. The host supplies the exact events path; the
// thread id is read from that harness's stream. Each thread gets a separate file under
// <dispatch>/sessions/<name>/, so coachman legs and review rounds do not overwrite one another.
import { spawnSync } from "node:child_process";
import type { Dirent } from "node:fs";
import {
  chmodSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { scriptsDir } from "./lib/paths.ts";
import { mkstempSync, run, signalExitCode, withTempDir } from "./lib/proc.ts";
import { SelfTest } from "./lib/selftest.ts";
import { D_CLASS, END_OF_STRING, pySplitLines } from "./lib/text.ts";

const HERE = scriptsDir(import.meta);
const USAGE =
  "usage: export-session.sh <dispatch> <name> <harness> <cwd> <events> [<harness-data>] | --self-test";

function die(msg: string): never {
  console.error(`export-session: ${msg}`);
  process.exit(1);
  throw new Error("unreachable");
}

function isSymlink(p: string): boolean {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

const HARNESSES = new Set(["codex", "grok", "agy", "claude", "pi", "muse", "mimo"]);
const ID_KEYS: Record<string, string[]> = {
  codex: ["thread_id"],
  grok: ["thread_id", "session_id", "sessionId", "conversationId", "uuid"],
  agy: ["conversationId", "conversation_id"],
  claude: ["session_id"],
  pi: [],
  muse: [],
  mimo: ["sessionID", "session_id"],
};
const EXTENSIONS: Record<string, string> = {
  grok: ".md",
  agy: ".events.jsonl",
  muse: ".json",
  mimo: ".export",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findId(value: unknown, harness: string): string | null {
  if (isRecord(value)) {
    if (harness === "muse") {
      const stream = value.stream;
      if (isRecord(stream) && stream.kind === "session" && typeof stream.id === "string") {
        return stream.id;
      }
    }
    if (harness === "pi" && value.type === "session" && typeof value.id === "string") {
      return value.id;
    }
    for (const key of ID_KEYS[harness] ?? []) {
      const v = value[key];
      if (typeof v === "string" && v !== "") return v;
    }
    // Object key order is insertion order, as in Python, except that
    // integer-like keys sort first; records keyed by bare numbers order
    // differently there, and the first id found can differ with them.
    for (const item of Object.values(value)) {
      const found = findId(item, harness);
      if (found) return found;
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      const found = findId(item, harness);
      if (found) return found;
    }
  }
  return null;
}

function topId(record: unknown, harness: string): string | null {
  // The record's own identity, without descending: a nested id inside an
  // earlier tool result must not win over a later top-level session identity.
  if (!isRecord(record)) return null;
  if (harness === "muse") {
    const stream = record.stream;
    if (isRecord(stream) && stream.kind === "session" && typeof stream.id === "string") {
      return stream.id;
    }
  }
  if (harness === "pi" && record.type === "session" && typeof record.id === "string") {
    return record.id;
  }
  for (const key of ID_KEYS[harness] ?? []) {
    const v = record[key];
    if (typeof v === "string" && v !== "") return v;
  }
  return null;
}

// The strerror half of a failed read, as Python reports it.
function strerror(e: unknown): string {
  switch ((e as NodeJS.ErrnoException)?.code ?? "") {
    case "ENOENT":
      return "No such file or directory";
    case "EACCES":
      return "Permission denied";
    case "EISDIR":
      return "Is a directory";
    case "ENOTDIR":
      return "Not a directory";
    case "ELOOP":
      return "Too many levels of symbolic links";
    default:
      return (e as Error)?.message ?? String(e);
  }
}

// json.loads accepts bare NaN, Infinity and -Infinity (what json.dumps
// writes for them); JSON.parse rejects them. A first plain parse keeps the
// common path; the fallback quotes bare constants outside strings as marker
// objects, which the id search walks past exactly as it walks past floats,
// and whatever still fails is skipped in both languages.
const JSON_CONST_RE = /"(?:[^"\\\n]|\\.)*"|(-?Infinity|NaN)/gu;
const PY_FLOAT_MARK = "$pyfloat";
function tolerantParse(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    // fall through to the constants-tolerant parse
  }
  const marked = line.replace(JSON_CONST_RE, (m, c: string | undefined) =>
    c === undefined
      ? m
      : `{"${PY_FLOAT_MARK}":"${c === "NaN" ? "nan" : c === "Infinity" ? "inf" : "-inf"}"}`,
  );
  return JSON.parse(marked);
}

function sessionId(eventsPath: string, harness: string): string | null {
  let text: string;
  try {
    text = readFileSync(eventsPath, "utf8");
  } catch (e) {
    die(`cannot read the events stream: ${strerror(e)}`);
  }
  const records: unknown[] = [];
  for (const line of pySplitLines(text)) {
    try {
      records.push(tolerantParse(line));
    } catch {
      // not JSON: skipped, as in main
    }
  }
  for (const record of records) {
    const found = topId(record, harness);
    if (found) return found;
  }
  for (const record of records) {
    const found = findId(record, harness);
    if (found) return found;
  }
  return null;
}

// Every *.jsonl under root, file order; the walk stops at the first
// unreadable directory, as main's rglob loop does under its OSError guard.
function collectJsonl(root: string): string[] {
  const found: string[] = [];
  let failed = false;
  const walk = (dir: string): void => {
    if (failed) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      failed = true;
      return;
    }
    for (const ent of entries) {
      if (failed) return;
      const full = join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith(".jsonl") && (ent.isFile() || ent.isSymbolicLink())) {
        found.push(full);
      }
    }
  };
  walk(root);
  return found;
}

// Python re.escape's effect outside a character class: syntax characters
// backslashed, the rest (here - and _) literal. re.escape also backslashes
// -, which a u pattern rejects outside a class, so - stays bare: it is
// literal there in both languages.
const REGEX_SPECIAL_RE = /[\^$\\.*+?()[\]{}|]/gu;
function regexEscape(s: string): string {
  return s.replace(REGEX_SPECIAL_RE, "\\$&");
}

function nativeRecord(harness: string, thread: string): string {
  const home = homedir();
  let root: string | null = null;
  if (harness === "codex") root = join(process.env.CODEX_HOME ?? join(home, ".codex"), "sessions");
  else if (harness === "claude")
    root = join(process.env.CLAUDE_CONFIG_DIR ?? join(home, ".claude"), "projects");
  else if (harness === "pi") root = join(home, ".pi", "agent", "sessions");
  if (root === null) die(`unknown harness: ${harness}`);
  if (!isDir(root)) die(`no durable ${harness} session store is available`);
  // A store holds many threads, and one id can hide inside another
  // (thread-1 inside thread-10, or inside other-thread-1), so neither a
  // substring nor a bare dash-suffix is a match. Codex names files
  // rollout-<timestamp>-<thread>.jsonl with a fixed timestamp shape, and only
  // that shape is matched; claude and pi name the file for the thread exactly.
  // If codex ever changes its timestamp shape this fails loudly, refusing the
  // export, rather than silently misattributing another session.
  const digit = `[${D_CLASS}]`;
  const codexStem = new RegExp(
    `^rollout-${digit}{4}-${digit}{2}-${digit}{2}T${digit}{2}-${digit}{2}-${digit}{2}-${regexEscape(thread)}${END_OF_STRING}`,
    "u",
  );
  const exact: string[] = [];
  const suffixed: string[] = [];
  for (const path of collectJsonl(root)) {
    const stem = basename(path).slice(0, -".jsonl".length);
    if (stem === thread) exact.push(path);
    else if (harness === "codex" && codexStem.test(stem)) suffixed.push(path);
  }
  const found = exact.length > 0 ? exact : suffixed;
  if (found.length === 0) die(`no durable ${harness} record was found for thread ${thread}`);
  // Thread ids are unique, so several records for one thread should not happen;
  // the newest is kept (a codex thread spanning midnight owns one file per day),
  // loudly rather than silently.
  if (found.length > 1) {
    console.error(
      `export-session: ${found.length} ${harness} records name thread ${thread}; keeping the newest`,
    );
  }
  // Main orders by nanoseconds; the runtimes expose milliseconds, so two
  // records stamped within one millisecond keep walk order between them.
  const withMtime = found.map((p) => ({ p, ms: statSync(p).mtimeMs }));
  withMtime.sort((a, b) => b.ms - a.ms);
  return withMtime[0]!.p;
}

function externalExport(
  harness: string,
  thread: string,
  data: string,
  destination: string,
): boolean {
  let command: string[] | null = null;
  const env: Record<string, string> = {};
  if (harness === "grok") {
    command = ["grok", "export", thread];
  } else if (harness === "muse") {
    if (!data) die("the run did not record a Muse data directory");
    env.XDG_DATA_HOME = data;
    command = ["muse", "export", "--session", thread, "--out", destination];
  } else if (harness === "mimo") {
    if (!data) die("the run did not record a MiMo data directory");
    env.XDG_DATA_HOME = data;
    env.MIMOCODE_DISABLE_CLAUDE_IMPORT = "1";
    command = ["mimo", "export", thread];
  }
  if (command === null) return false;
  // spawnSync direct, not run(): grok and mimo exports are stdout bytes of
  // unknown encoding, and run() decodes text. Same 60s timeout, same 64MB cap.
  const r = spawnSync(command[0]!, command.slice(1), {
    env: { ...process.env, ...env },
    timeout: 60000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const error = r.error as NodeJS.ErrnoException | undefined;
  const killed = error?.code === "ETIMEDOUT" && (r.status === null || r.status === undefined);
  if (killed) die(`${harness} export failed: TimeoutExpired`);
  if (error && (r.status === null || r.status === undefined) && !r.signal) {
    if (error.code === "ENOENT") die(`${harness} export failed: FileNotFoundError`);
    if (error.code === "EACCES") die(`${harness} export failed: PermissionError`);
    die(`${harness} export failed: OSError`);
  }
  if (r.status !== null && r.status !== undefined) {
    if (r.status !== 0) die(`${harness} export failed with exit ${r.status}`);
  } else if (r.signal) {
    // Dead by a signal, Python reports the negative signal number.
    die(`${harness} export failed with exit -${signalExitCode(r.signal) - 128}`);
  } else {
    die(`${harness} export failed: OSError`);
  }
  if (harness !== "muse") writeFileSync(destination, r.stdout ?? Buffer.alloc(0));
  let exported = false;
  try {
    const s = statSync(destination);
    exported = s.isFile() && s.size > 0;
  } catch {
    exported = false;
  }
  if (!exported) die(`${harness} export produced no durable session`);
  return true;
}

const NAME_RE = new RegExp(`^[A-Za-z0-9][A-Za-z0-9_.-]*${END_OF_STRING}`, "u");
const THREAD_RE = new RegExp(`^[A-Za-z0-9_.-]+${END_OF_STRING}`, "u");

function exportSession(
  dispatchRaw: string,
  name: string,
  harness: string,
  cwdRaw: string,
  eventsRaw: string,
  data: string,
): void {
  if (isSymlink(dispatchRaw) || !isDir(dispatchRaw)) die("dispatch must be a real run directory");
  let dispatch: string;
  try {
    dispatch = realpathSync(dispatchRaw);
  } catch {
    die("dispatch must be a real run directory");
  }
  if (
    basename(dirname(dispatch)) !== "runs" ||
    basename(dirname(dirname(dispatch))) !== ".postmaster"
  ) {
    // A run dispatched under the old layout finishes where it started:
    // nothing to export into, and the launch's own exit stands.
    console.error(`export-session: ${dispatch} is not under <project>/.postmaster/runs; skipping`);
    return;
  }
  if (!NAME_RE.test(name)) die("name must be a lane or role name");
  if (!HARNESSES.has(harness)) die(`unknown harness: ${harness}`);
  let cwd: string;
  try {
    cwd = realpathSync(cwdRaw);
  } catch {
    die("launch directory is missing");
  }
  if (!isDir(cwd)) die("launch directory is missing");
  if (isSymlink(eventsRaw) || !isFile(eventsRaw)) {
    die("events stream is missing or not a regular file");
  }
  let eventsReal: string;
  try {
    eventsReal = realpathSync(eventsRaw);
  } catch {
    die("events stream must be a direct file in the run's logs directory");
  }
  let logsDir: string;
  try {
    logsDir = realpathSync(join(dispatch, "logs"));
  } catch {
    logsDir = join(dispatch, "logs");
  }
  if (dirname(eventsReal) !== logsDir) {
    die("events stream must be a direct file in the run's logs directory");
  }
  const thread = sessionId(eventsRaw, harness);
  if (!thread || !THREAD_RE.test(thread)) {
    die(`no safe ${harness} thread id appears in the events stream`);
  }

  const extension = EXTENSIONS[harness] ?? ".jsonl";
  const sessionRoot = join(dispatch, "sessions");
  if (isSymlink(sessionRoot)) die("session export directory must not be a symlink");
  const folder = join(sessionRoot, name);
  if (isSymlink(folder)) die("session export directory must not be a symlink");
  let temporary: string | null = null;
  try {
    try {
      mkdirSync(sessionRoot);
    } catch (e) {
      // exist-ok for a directory, as main's mkdir(exist_ok=True) is.
      if ((e as NodeJS.ErrnoException)?.code !== "EEXIST" || !isDir(sessionRoot)) throw e;
    }
    mkdirSync(folder, { recursive: true });
    const destination = join(folder, thread + extension);
    if (isSymlink(destination)) die("session export destination must not be a symlink");
    temporary = mkstempSync(folder, `.${thread}.`);
    if (harness === "codex" || harness === "claude" || harness === "pi") {
      copyFileSync(nativeRecord(harness, thread), temporary);
    } else if (harness === "agy") {
      // Antigravity exposes no export command; its complete stream is the durable transcript.
      copyFileSync(eventsRaw, temporary);
    } else {
      externalExport(harness, thread, data, temporary);
    }
    // The temp file keeps mkstemp's 0600, as main's copy onto it does.
    chmodSync(temporary, 0o600);
    if (!isFile(temporary) || statSync(temporary).size === 0) {
      die(`${harness} produced an empty session export`);
    }
    renameSync(temporary, destination);
    temporary = null;
  } catch (e) {
    die(`cannot save the session export: ${(e as Error)?.message ?? String(e)}`);
  } finally {
    if (temporary !== null) {
      try {
        rmSync(temporary, { force: true });
      } catch {
        // cleanup is best-effort; the export's fate is already decided
      }
    }
  }
  console.error(`export-session: saved ${harness} thread ${thread}`);
}

const argv = process.argv.slice(2);

if (argv.length === 1 && argv[0] === "--self-test") {
  const self = join(HERE, "export-session.sh");
  const st = new SelfTest();
  withTempDir((root) => {
    const repo = join(root, "repo");
    const dispatch = join(repo, ".postmaster", "runs", "RUN-1");
    const cwd = join(root, "worktree");
    const home = join(root, "home");
    const binDir = join(root, "bin");
    mkdirSync(join(dispatch, "logs"), { recursive: true });
    mkdirSync(cwd);
    mkdirSync(home);
    mkdirSync(binDir);
    const logs = join(dispatch, "logs");
    // Store locations come from the planted HOME, never the machine's own.
    const baseEnv: Record<string, string | undefined> = {
      HOME: home,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
      CODEX_HOME: undefined,
      CLAUDE_CONFIG_DIR: undefined,
    };
    const savedOk = (thread: string, harness: string): boolean => {
      const saved = join(dispatch, "sessions", "lane", thread + (EXTENSIONS[harness] ?? ".jsonl"));
      try {
        const s = statSync(saved);
        return s.isFile() && s.size > 0;
      } catch {
        return false;
      }
    };
    let count = 0;
    const check = (
      harness: string,
      thread: string,
      row: unknown,
      native?: string,
      data = "",
    ): void => {
      const events = join(logs, `${harness}.jsonl`);
      writeFileSync(events, `${JSON.stringify(row)}\n`);
      if (native !== undefined) {
        const p = join(home, native);
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, `durable ${thread}\n`);
      }
      const r = run(self, [dispatch, "lane", harness, cwd, events, data], {
        env: baseEnv,
        timeout: 10000,
      });
      const ok = r.code === 0 && savedOk(thread, harness);
      if (ok) count++;
      st.check(
        `${harness} export is saved`,
        ok,
        r.code === 0 ? `no export for thread ${thread}` : r.err || r.out,
      );
    };

    // Native local stores are copied without reading or printing their contents.
    check(
      "codex",
      "thread-codex",
      { type: "thread.started", thread_id: "thread-codex" },
      ".codex/sessions/2026/01/03/rollout-2026-01-03T00-00-00-thread-codex.jsonl",
    );
    check(
      "claude",
      "thread-claude",
      { session_id: "thread-claude" },
      ".claude/projects/project/thread-claude.jsonl",
    );
    check(
      "pi",
      "thread-pi",
      { type: "session", id: "thread-pi" },
      ".pi/agent/sessions/--project--/thread-pi.jsonl",
    );
    check("agy", "thread-agy", { conversationId: "thread-agy" });

    writeFileSync(join(binDir, "grok"), "#!/bin/sh\nprintf 'grok export %s\\n' \"$2\"\n");
    chmodSync(join(binDir, "grok"), 0o755);
    check("grok", "thread-grok", { thread_id: "thread-grok" });
    writeFileSync(
      join(binDir, "muse"),
      '#!/bin/sh\n[ "$1" = export ] && { printf \'muse session\\n\' > "$5"; exit 0; }\nexit 1\n',
    );
    chmodSync(join(binDir, "muse"), 0o755);
    check(
      "muse",
      "thread-muse",
      { stream: { kind: "session", id: "thread-muse" } },
      undefined,
      join(root, "muse-data"),
    );
    writeFileSync(
      join(binDir, "mimo"),
      "#!/bin/sh\n[ \"$1\" = export ] && { printf 'mimo session\\n'; exit 0; }\nexit 1\n",
    );
    chmodSync(join(binDir, "mimo"), 0o755);
    check("mimo", "thread-mimo", { sessionID: "thread-mimo" }, undefined, join(root, "mimo-data"));
    st.check("all seven harnesses export", count === 7, `${count} of 7 exported`);

    const codexSessions = join(home, ".codex", "sessions");
    mkdirSync(join(codexSessions, "2026", "01", "01"), { recursive: true });
    mkdirSync(join(codexSessions, "2026", "01", "02"), { recursive: true });
    const right = join(
      codexSessions,
      "2026",
      "01",
      "01",
      "rollout-2026-01-01T00-00-00-thread-1.jsonl",
    );
    const wrong = join(
      codexSessions,
      "2026",
      "01",
      "02",
      "rollout-2026-01-02T00-00-00-thread-10.jsonl",
    );
    writeFileSync(right, "RIGHT thread one\n");
    writeFileSync(wrong, "WRONG thread ten\n");
    utimesSync(right, 1000000000, 1000000000);
    utimesSync(wrong, 1100000000, 1100000000);
    const decoyEvents = join(logs, "decoy.jsonl");
    writeFileSync(
      decoyEvents,
      `${JSON.stringify({ type: "thread.started", thread_id: "thread-1" })}\n`,
    );
    {
      const r = run(self, [dispatch, "lane", "codex", cwd, decoyEvents, ""], {
        env: baseEnv,
        timeout: 10000,
      });
      let saved = "";
      try {
        saved = readFileSync(join(dispatch, "sessions", "lane", "thread-1.jsonl"), "utf8");
      } catch {
        saved = "";
      }
      st.check(
        "a newer thread whose id extends the thread's does not shadow its session",
        r.code === 0 && saved === "RIGHT thread one\n",
        r.code === 0
          ? `export copied the newer prefix-sharing decoy: ${JSON.stringify(saved)}`
          : r.err,
      );
    }
    const loneHome = join(root, "lone-home");
    const loneSessions = join(loneHome, ".codex", "sessions", "2026", "01", "04");
    mkdirSync(loneSessions, { recursive: true });
    writeFileSync(
      join(loneSessions, "rollout-2026-01-04T00-00-00-other-thread-1.jsonl"),
      "WRONG other thread\n",
    );
    const loneEnv = { ...baseEnv, HOME: loneHome };
    const suffixEvents = join(logs, "suffix.jsonl");
    writeFileSync(
      suffixEvents,
      `${JSON.stringify({ type: "thread.started", thread_id: "thread-1" })}\n`,
    );
    {
      const r = run(self, [dispatch, "lone", "codex", cwd, suffixEvents, ""], {
        env: loneEnv,
        timeout: 10000,
      });
      st.check(
        "a thread whose id extends the thread's with a dash does not shadow its session",
        r.code === 1 && r.err.includes("no durable codex record was found"),
        `(exit ${r.code})\n${r.err}`,
      );
    }
    const claudeDir = join(home, ".claude", "projects", "project");
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, "thread-2.jsonl"), "RIGHT exact\n");
    writeFileSync(join(claudeDir, "other-thread-2.jsonl"), "WRONG suffix\n");
    utimesSync(join(claudeDir, "thread-2.jsonl"), 1000000000, 1000000000);
    utimesSync(join(claudeDir, "other-thread-2.jsonl"), 1100000000, 1100000000);
    const decoy2Events = join(logs, "decoy2.jsonl");
    writeFileSync(decoy2Events, `${JSON.stringify({ session_id: "thread-2" })}\n`);
    {
      const r = run(self, [dispatch, "lane", "claude", cwd, decoy2Events, ""], {
        env: baseEnv,
        timeout: 10000,
      });
      let saved = "";
      try {
        saved = readFileSync(join(dispatch, "sessions", "lane", "thread-2.jsonl"), "utf8");
      } catch {
        saved = "";
      }
      st.check(
        "an exact store file wins over a newer suffixed decoy",
        r.code === 0 && saved === "RIGHT exact\n",
        r.code === 0
          ? `export preferred a suffixed decoy over the exact file: ${JSON.stringify(saved)}`
          : r.err,
      );
    }
    const loneDir = join(home, ".claude", "projects", "lone");
    mkdirSync(loneDir, { recursive: true });
    writeFileSync(join(loneDir, "other-thread-9.jsonl"), "DECOY\n");
    const loneEvents = join(logs, "lone.jsonl");
    writeFileSync(loneEvents, `${JSON.stringify({ session_id: "thread-9" })}\n`);
    {
      const r = run(self, [dispatch, "lane", "claude", cwd, loneEvents, ""], {
        env: baseEnv,
        timeout: 10000,
      });
      st.check(
        "a suffixed decoy alone is no record for claude",
        r.code === 1 && r.err.includes("no durable claude record was found"),
        `(exit ${r.code})\n${r.err}`,
      );
    }
    const nestedEvents = join(logs, "nested.jsonl");
    writeFileSync(
      nestedEvents,
      `${JSON.stringify({ type: "tool_result", result: { session_id: "WRONG-nested" } })}\n` +
        `${JSON.stringify({ type: "session", session_id: "RIGHT-top" })}\n`,
    );
    writeFileSync(join(claudeDir, "WRONG-nested.jsonl"), "WRONG\n");
    writeFileSync(join(claudeDir, "RIGHT-top.jsonl"), "RIGHT\n");
    {
      const r = run(self, [dispatch, "lane", "claude", cwd, nestedEvents, ""], {
        env: baseEnv,
        timeout: 10000,
      });
      let saved = "";
      try {
        saved = readFileSync(join(dispatch, "sessions", "lane", "RIGHT-top.jsonl"), "utf8");
      } catch {
        saved = "";
      }
      st.check(
        "a top-level session id wins over a nested id in an earlier line",
        r.code === 0 && saved === "RIGHT\n",
        r.code === 0
          ? `a nested id beat the top-level session identity: ${JSON.stringify(saved)}`
          : r.err,
      );
    }
    const spanOld = join(
      codexSessions,
      "2026",
      "01",
      "01",
      "rollout-2026-01-01T23-59-00-thread-7.jsonl",
    );
    const spanNew = join(
      codexSessions,
      "2026",
      "01",
      "02",
      "rollout-2026-01-02T00-01-00-thread-7.jsonl",
    );
    writeFileSync(spanOld, "OLD segment\n");
    writeFileSync(spanNew, "NEW segment\n");
    utimesSync(spanOld, 1000000000, 1000000000);
    utimesSync(spanNew, 1100000000, 1100000000);
    const spanEvents = join(logs, "span.jsonl");
    writeFileSync(
      spanEvents,
      `${JSON.stringify({ type: "thread.started", thread_id: "thread-7" })}\n`,
    );
    {
      const r = run(self, [dispatch, "lane", "codex", cwd, spanEvents, ""], {
        env: baseEnv,
        timeout: 10000,
      });
      let saved = "";
      try {
        saved = readFileSync(join(dispatch, "sessions", "lane", "thread-7.jsonl"), "utf8");
      } catch {
        saved = "";
      }
      st.check(
        "several records for one thread keep the newest, loudly",
        r.code === 0 &&
          saved === "NEW segment\n" &&
          r.err.includes("2 codex records name thread thread-7; keeping the newest"),
        `(exit ${r.code}) saved=${JSON.stringify(saved)}\n${r.err}`,
      );
    }
    const shadow = join(root, "shadow");
    mkdirSync(shadow);
    writeFileSync(
      join(shadow, "json.py"),
      `import pathlib\npathlib.Path(r"${join(shadow, "marker")}").write_text("imported")\nraise SystemExit("shadow")\n`,
    );
    const shadowEvents = join(logs, "shadow.jsonl");
    writeFileSync(shadowEvents, `${JSON.stringify({ conversationId: "thread-shadow" })}\n`);
    {
      const r = run(self, [dispatch, "lane", "agy", shadow, shadowEvents, ""], {
        env: baseEnv,
        timeout: 10000,
        cwd: shadow,
      });
      let marker = false;
      let exported = false;
      try {
        statSync(join(shadow, "marker"));
        marker = true;
      } catch {
        marker = false;
      }
      try {
        exported = statSync(
          join(dispatch, "sessions", "lane", "thread-shadow.events.jsonl"),
        ).isFile();
      } catch {
        exported = false;
      }
      st.check(
        "worktree modules cannot shadow the exporter's standard library imports",
        r.code === 0 && !marker && exported,
        `(exit ${r.code}) marker=${marker} exported=${exported}\n${r.err}`,
      );
    }
    const legacy = join(root, "legacy", "RUN-0");
    mkdirSync(join(legacy, "logs"), { recursive: true });
    const legacyEvents = join(legacy, "logs", "lane.jsonl");
    writeFileSync(
      legacyEvents,
      `${JSON.stringify({ type: "thread.started", thread_id: "thread-old" })}\n`,
    );
    {
      const r = run(self, [legacy, "lane", "codex", cwd, legacyEvents, ""], {
        env: baseEnv,
        timeout: 10000,
      });
      let skipped = false;
      try {
        statSync(join(legacy, "sessions"));
        skipped = false;
      } catch {
        skipped = true;
      }
      st.check(
        "a dispatch outside the project run root is skipped, not failed",
        r.code === 0 && skipped,
        `(exit ${r.code}) skipped=${skipped}\n${r.err}`,
      );
    }
  }, "export-session-test-");
  st.finish();
} else {
  if (argv.length !== 6) die(USAGE);
  exportSession(argv[0], argv[1], argv[2], argv[3], argv[4], argv[5]);
}
