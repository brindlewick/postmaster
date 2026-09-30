// Write a run's fixed facts to <dispatch>/run.json, once, at dispatch, and pin the run to the
// postmaster commit it was dispatched from. Written once and never edited: the manifest is the
// run's current state, this is what the run started from and the checkout it runs on.
//
//   run-meta.sh <dispatch> <repo>   <repo> is the target project's checkout; also cuts the pin
//   run-meta.sh pin <repo> <commit> a shared checkout of <repo> at <commit> under $POSTMASTER_TOOL_PINS
//   run-meta.sh path <dispatch>     print the canonical path of the run's tool checkout
//   run-meta.sh check <dispatch>    the run's checkout still serves its dispatch commit
//   run-meta.sh release <dispatch>  remove the pin when no claimed run is in flight
//   run-meta.sh --self-test
//
// Records when it was written; the run and project; the target repo's HEAD and branch; the
// postmaster commit that dispatched it, and whether that checkout had uncommitted changes,
// since a run keeps the runbooks it started with; the pinned checkout of that commit, which
// every leg launch, resume and takeover runs from (the waybill's `tool:`); the machine config
// with local role choices resolved; the project settings and their sources; and the version
// each harness reports. Env files are named by the machine config, never read. A run.json that
// already exists is left alone.
//
// The pin is a detached worktree of the postmaster repo at the dispatch commit, under
// $POSTMASTER_TOOL_PINS (default ~/.postmaster/tool-pins), one directory per commit so every
// run dispatched at that commit shares it. It is the run's `<tool>`: its host.sh, its launch.sh
// and the runbooks its prompts name. The live checkout still serves the front door and the
// postmaster's own supervision. A bare `pin` holds no claim; each dispatch appends its own
// path to the pin's claims file beside it, so release finds every run that names the pin,
// whatever project it lives in and whichever runs layout it uses.
//
// check is the control that a run still runs on its own versions after main has moved on: it
// reads the pin's HEAD and tree against the commit run.json records. release removes the pin
// only when no claimed run is still in flight (manifest stage other than done or abandoned,
// a claim that cannot be read counting as in flight); a pin with no claims file falls back to
// scanning the runs root the dispatch sits under, and runs it cannot list keep the pin.
// Dispatch holds one lock across its pin, claim and run.json write and release across its
// check and removal, so the two serialize; release force-removes an unreferenced pin that is
// not clean, and leaves a locked one alone. A dispatch whose run.json write fails drops the
// claim it just made, so the pin stays unreferenced; a crash between the two leaves a stale
// claim that keeps the pin, for manual recovery. The postmaster releases
// after it closes or abandons a run, never
// before the last leg's process has exited. A run with no checkout recorded (an old unpinned
// waybill) resolves to the tool path its waybill already names; check asks only that it is a
// git checkout, and release leaves it alone.
//
//   exit 0  written, already there, a pin made or reused, path printed, the pin still serves
//           its commit, or the pin was released or kept as the in-flight runs require
//   exit 1  usage, no such dispatch directory or repo or commit, no config, the file could not
//           be written, the pin lock could not be taken, no pin or it does not serve its
//           commit, or git could not make or remove it
//
// Port notes (main scripts/run-meta.sh): the flock(2) pin lock is an O_EXCL lock file holding
// the owner's PID, stolen only from a dead owner and never by age, since a dispatch
// legitimately holds it across 15-second harness probes; the lock file is removed on release
// rather than left empty. The pin scan keeps its subprocess shape (a hidden `run-meta-scan`
// mode of this same script, exit 42 the reserved drop signal) so a killed scan is still
// observed and kept; the child is spawned with PATH alone, the tool bunfig.toml anchoring
// config discovery the way the wrapper does. POSTMASTER_SCAN_HOLD_MS is self-test-only: the
// scan child sleeps that long before enumerating, so the killed-scan control kills
// deterministically instead of racing a millisecond scan.
import { spawnSync } from "node:child_process";
import {
  accessSync,
  appendFileSync,
  chmodSync,
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, delimiter, dirname, join } from "node:path";
import { tryTomlFile } from "./lib/data.ts";
import { scriptsDir, toolRoot } from "./lib/paths.ts";
import { mkstempSync, run, signalExitCode, withTempDir } from "./lib/proc.ts";
import { SelfTest } from "./lib/selftest.ts";
import { pySplitLines, pyTrim } from "./lib/text.ts";

const TOOL = toolRoot(import.meta);
const SCRIPT = import.meta.path;

const USAGE =
  "usage: run-meta.sh <dispatch> <repo> | pin <repo> <commit> | path <dispatch> | check <dispatch> | release <dispatch> | --self-test";

// Every command returns its exit code with the bytes for each stream; the CLI boundary writes
// them, and the self-test inspects them. stdout carries results (the pin path, the checkout,
// kept/removed, wrote, already-written); stderr carries failures.
interface Outcome {
  code: number;
  out: string;
  err: string;
}

const ok = (out = ""): Outcome => ({ code: 0, out, err: "" });
const fail = (err: string, code = 1): Outcome => ({ code, out: "", err });

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

function git(where: string, ...args: string[]): string | null {
  const r = run("git", ["-C", where, ...args]);
  return r.code === 0 ? r.out.trim() : null;
}

// canon <dir>: its absolute physical path, or null. cd -P requires a directory that exists.
function canon(p: string): string | null {
  try {
    const rp = realpathSync(p);
    return statSync(rp).isDirectory() ? rp : null;
  } catch {
    return null;
  }
}

const short12 = (s: string): string => s.slice(0, 12);

// strftime("%Y-%m-%dT%H:%M:%SZ"): UTC, second resolution, no fractional part.
function utcStamp(d: Date): string {
  const p2 = (n: number): string => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}` +
    `T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}Z`
  );
}

// json.dump(ensure_ascii=True): every non-ASCII code point leaves as \uXXXX, astral ones as a
// surrogate pair, hex lowercase. JSON.stringify escapes neither, so the port escapes after.
function asciiJson(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/[^\x00-\x7F]/gu, (c) => {
    const cp = c.codePointAt(0) as number;
    if (cp < 0x10000) return `\\u${cp.toString(16).padStart(4, "0")}`;
    const h = 0xd800 + ((cp - 0x10000) >> 10);
    const l = 0xdc00 + ((cp - 0x10000) & 0x3ff);
    return `\\u${h.toString(16)}\\u${l.toString(16)}`;
  });
}

function version(harness: string): string {
  if (Bun.which(harness) === null) return "not on PATH";
  // BASE names the exception: TimeoutExpired for the 15-second cutoff, the
  // OSError kind otherwise. spawnSync reports both in error, never by throwing.
  const r = spawnSync(harness, ["--version"], { encoding: "utf8", timeout: 15000 });
  const err = r.error as NodeJS.ErrnoException | undefined;
  if (err?.code === "ETIMEDOUT") return "no version: TimeoutExpired";
  if (err?.code === "ENOENT") return "no version: FileNotFoundError";
  if (err?.code === "EACCES") return "no version: PermissionError";
  if (err) return "no version: OSError";
  const lines = pySplitLines(pyTrim((r.stdout || r.stderr || "") as string));
  return lines.length > 0 ? (lines[0] as string) : "no version output";
}

// --- pin lock -------------------------------------------------------------------------------
// flock(2) has no Node spelling, so the pin lock is a lock file holding the owner's PID:
// O_EXCL creation is the mutual exclusion, and only a dead owner loses it. Never by age: a
// dispatch legitimately holds the lock across 15-second harness probes, so an old lock is
// still live. An empty or unreadable lock file is waited on, never stolen; past two minutes
// the wait fails as "could not lock", the way flock failing does.
function lockOwnerDead(lockPath: string): boolean {
  let text: string;
  try {
    text = readFileSync(lockPath, "utf8");
  } catch (e) {
    // Gone between the failed creation and this read: nobody holds it.
    return (e as NodeJS.ErrnoException)?.code === "ENOENT";
  }
  const pid = Number(text.trim());
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return false;
  } catch (e) {
    return (e as NodeJS.ErrnoException)?.code === "ESRCH";
  }
}

function withPinLock<T>(
  tools: string,
  action: () => T,
): { locked: true; value: T } | { locked: false } {
  const lockPath = join(tools, ".pin.lock");
  const start = Date.now();
  for (;;) {
    try {
      const fd = openSync(lockPath, "wx", 0o644);
      try {
        writeSync(fd, `${process.pid}\n`);
      } catch {
        // Best effort: a missing PID only costs a later waiter its fast steal.
      }
      try {
        closeSync(fd);
      } catch {
        // ignore
      }
      try {
        return { locked: true, value: action() };
      } finally {
        try {
          rmSync(lockPath, { force: true });
        } catch {
          // ignore
        }
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code !== "EEXIST") return { locked: false };
      if (lockOwnerDead(lockPath)) {
        try {
          rmSync(lockPath, { force: true });
        } catch {
          // ignore; the wait below still times out
        }
      }
      if (Date.now() - start > 120000) return { locked: false };
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
}

// --- run.json reads ---------------------------------------------------------------------------
type Claim = { kind: "unknown" } | { kind: "no" } | { kind: "checkout"; path: string };

// claim <run.json>: `checkout` with the path when the run names one, `no` when its postmaster
// record names none, `unknown` when the record cannot be read at all; the scan fails closed
// on unknown. JSON.parse reads in-process, so no user site or startup file can reach the read.
function claim(runJson: string): Claim {
  let r: unknown;
  try {
    r = JSON.parse(readFileSync(runJson, "utf8")) as unknown;
  } catch {
    return { kind: "unknown" };
  }
  if (typeof r !== "object" || r === null || Array.isArray(r)) return { kind: "unknown" };
  const pm = (r as Record<string, unknown>).postmaster;
  if (typeof pm !== "object" || pm === null || Array.isArray(pm)) return { kind: "unknown" };
  const co = (pm as Record<string, unknown>).checkout;
  if (co === undefined || co === null || co === "") return { kind: "no" };
  if (typeof co !== "string") return { kind: "unknown" };
  return { kind: "checkout", path: co };
}

// stage_of <manifest>: its stage, or "" when it cannot be read. Only "done" and "abandoned"
// ever compare equal downstream, so every non-string stage reads as "" with the same outcome.
function stageOf(manifest: string): string {
  try {
    const r = JSON.parse(readFileSync(manifest, "utf8")) as unknown;
    if (typeof r !== "object" || r === null || Array.isArray(r)) return "";
    const stage = (r as Record<string, unknown>).stage;
    return typeof stage === "string" ? stage : "";
  } catch {
    return "";
  }
}

// field <run.json>: the postmaster commit the record names, "" when it names none. Only
// reached when claim already read the postmaster record, so a missing record reads as "".
function fieldCommit(runJson: string): string {
  const c = claim(runJson);
  if (c.kind !== "checkout") return "";
  let r: unknown;
  try {
    r = JSON.parse(readFileSync(runJson, "utf8")) as unknown;
  } catch {
    return "";
  }
  const pm = (r as Record<string, unknown>).postmaster as Record<string, unknown>;
  const commit = pm.commit;
  if (commit === undefined || commit === null) return "";
  if (typeof commit === "string") return commit;
  // main prints str(commit): True/False for booleans, str() for numbers (an integer-valued
  // float prints "1.0" there, "1" here). Objects and arrays would print Python repr; JSON is
  // the documented approximation for those pathological shapes, which compare unequal to a
  // commit either way.
  if (typeof commit === "boolean") return commit ? "True" : "False";
  if (typeof commit === "number") return String(commit);
  return JSON.stringify(commit) ?? "";
}

// --- waybill fallback ---------------------------------------------------------------------------
// grep/sed [[:space:]] is the C-locale six (glibc isspace is ASCII-only in every locale), and
// awk splits records on \n only, so the port splits on \n and trims an explicit class.
const WS_LEAD_RE = /^[ \t\v\f\r]+/u;
const WS_TRAIL_RE = /[ \t\v\f\r]+$/u;
const TRAIL_NL_RE = /\n+$/u;

// The Dispatch section of a waybill: after the last "## Dispatch" header up to the next "## "
// header, the way the awk reset (buf="" on every match) reads it. "" when there is none.
function dispatchSection(brief: string): string {
  const buf: string[] = [];
  let f = false;
  for (const line of brief.split("\n")) {
    if (line.startsWith("## Dispatch")) {
      buf.length = 0;
      f = true;
      continue;
    }
    if (f && line.startsWith("## ")) f = false;
    if (f) buf.push(line);
  }
  if (buf.length === 0) return "";
  return `${buf.join("\n")}\n`.replace(TRAIL_NL_RE, "");
}

// Every `tool:` line's path, the way grep -E '^tool:[[:space:]]*\S' plus the two sed strips
// reads them: "tool:", spaces, a non-space, then trailing spaces off.
function toolCandidates(section: string): string[] {
  const found: string[] = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("tool:")) continue;
    const rest = line.slice("tool:".length).replace(WS_LEAD_RE, "");
    if (rest === "") continue;
    found.push(rest.replace(WS_TRAIL_RE, ""));
  }
  return found;
}

// path_of <dispatch>: the run's tool checkout, canonical; the waybill's for an old run.
function pathOf(d: string): Outcome {
  const runJson = join(d, "run.json");
  if (!isFile(runJson)) return fail(`run-meta: no run.json in ${d}\n`);
  const c = claim(runJson);
  if (c.kind === "unknown") {
    return fail(`run-meta: ${d}/run.json records an unreadable checkout\n`);
  }
  let checkout: string;
  if (c.kind === "checkout") {
    checkout = c.path;
  } else {
    // An old unpinned waybill keeps the tool path it already names. The ticket travels in
    // the waybill verbatim and may show a tool: line of its own, so only the Dispatch
    // section counts; a waybill without one reads whole, as before.
    const briefPath = join(d, "brief.md");
    if (!isFile(briefPath)) {
      return fail(`run-meta: ${d}/run.json records no checkout and there is no waybill\n`);
    }
    let section: string;
    try {
      const brief = readFileSync(briefPath, "utf8");
      section = dispatchSection(brief);
      if (section === "") section = brief.replace(TRAIL_NL_RE, "");
    } catch {
      return fail(`run-meta: the waybill must name exactly one tool: path\n`);
    }
    const tools = toolCandidates(section);
    if (tools.length !== 1) {
      return fail("run-meta: the waybill must name exactly one tool: path\n");
    }
    checkout = tools[0] as string;
  }
  const original = checkout;
  const canonical = canon(checkout);
  if (canonical === null) return fail(`run-meta: no checkout at ${original}\n`);
  return ok(`${canonical}\n`);
}

// check_pin <dispatch>: the run's checkout still serves its dispatch commit. Silent on success.
function checkPin(d: string): Outcome {
  const runJson = join(d, "run.json");
  const at = pathOf(d);
  if (at.code !== 0) return at;
  const checkout = at.out.trim();
  const c = claim(runJson);
  if (c.kind === "unknown") {
    return fail(`run-meta: ${d}/run.json records an unreadable checkout\n`);
  }
  if (c.kind === "no") {
    // An old unpinned waybill: the path only has to be a git checkout.
    if (git(checkout, "rev-parse", "--git-dir") === null) {
      return fail(`run-meta: ${checkout} is not a git checkout\n`);
    }
    return ok();
  }
  const commit = fieldCommit(runJson);
  if (commit === "") return fail(`run-meta: ${d}/run.json records no postmaster commit\n`);
  if (!isDir(checkout)) return fail(`run-meta: no pinned checkout at ${checkout}\n`);
  const head = git(checkout, "rev-parse", "--verify", "-q", "HEAD");
  if (head === null) return fail(`run-meta: ${checkout} is not a git checkout\n`);
  if (head !== commit) {
    return fail(
      `run-meta: ${checkout} is at ${short12(head)}, not the recorded ${short12(commit)}\n`,
    );
  }
  const dirty = git(checkout, "status", "--porcelain");
  if (dirty === null) return fail(`run-meta: could not read ${checkout}\n`);
  if (dirty !== "") {
    return fail(
      `run-meta: ${checkout} is not clean at ${short12(commit)}; ` +
        "it does not serve that commit's versions\n",
    );
  }
  return ok();
}

// --- pin scan -------------------------------------------------------------------------------
// pin_scan <runs-root> <checkout>: code 42 when no run uses this pin, 0 otherwise. The
// enumeration reads directories literally, so star-named, bracket-named, mixed-case and
// dot-prefixed projects all enumerate, and no shell state can reach it. Only directories
// descend, the way the `*/` globs do; symlinks to directories count, dangling ones do not.
function childDirs(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    // The glob that cannot list matches nothing; the -r/-x checks below are what keep.
    return [];
  }
  const found: string[] = [];
  for (const e of entries) {
    const full = join(dir, e);
    try {
      if (statSync(full).isDirectory()) found.push(full);
    } catch {
      // A dangling link or a vanished entry: the glob would not match it either.
    }
  }
  return found.sort();
}

function readableDir(p: string): boolean {
  try {
    accessSync(p, constants.R_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function isLiveStage(stage: string): boolean {
  return stage !== "done" && stage !== "abandoned";
}

function pinScan(root: string, checkout: string): { code: number; err: string } {
  // Two loops so an unreadable level is seen: one flat pass drops its branch silently.
  if (!readableDir(root)) {
    return { code: 0, err: `run-meta: cannot list ${root}; keeping ${checkout}\n` };
  }
  for (const p of childDirs(root)) {
    if (!readableDir(p)) {
      return { code: 0, err: `run-meta: cannot list ${p}/; keeping ${checkout}\n` };
    }
    for (const d of childDirs(p)) {
      if (!readableDir(d)) {
        return { code: 0, err: `run-meta: cannot list ${d}/; keeping ${checkout}\n` };
      }
      if (!isFile(join(d, "run.json"))) {
        // No record attributes this directory: a live manifest keeps the pin, so a
        // run whose record vanished still protects it; no manifest or a done one
        // drops, which is what an empty directory is. An unreadable manifest is a
        // file, so it reads as "" below and keeps.
        if (!isFile(join(d, "manifest.json"))) continue;
        if (isLiveStage(stageOf(join(d, "manifest.json")))) return { code: 0, err: "" };
        continue;
      }
      const c = claim(join(d, "run.json"));
      if (c.kind === "unknown") return { code: 0, err: "" };
      if (c.kind === "no") continue;
      const got = c.path;
      if (got !== checkout) {
        // The same checkout recorded through a symlink spells differently; a path that
        // resolves nowhere cannot be this pin, which exists.
        const resolved = canon(got);
        if (resolved === null || resolved !== checkout) continue;
      }
      if (isLiveStage(stageOf(join(d, "manifest.json")))) return { code: 0, err: "" };
    }
  }
  return { code: 42, err: "" }; // the one reserved drop signal; the caller keeps on anything else
}

const HOLD_RE = /^[0-9]+$/u;

// POSTMASTER_SCAN_HOLD_MS, self-test-only: the scan child sleeps this long before enumerating.
function scanHoldMs(): number {
  const v = process.env.POSTMASTER_SCAN_HOLD_MS ?? "";
  if (!HOLD_RE.test(v)) return 0;
  return Math.min(Number(v), 120000);
}

function runScanChild(root: string, checkout: string): { code: number; out: string; err: string } {
  const bun = Bun.which("bun");
  if (bun === null) return { code: 127, out: "", err: "" };
  const args = [
    "--no-env-file",
    `--config=${join(TOOL, "bunfig.toml")}`,
    SCRIPT,
    "run-meta-scan",
    root,
    checkout,
  ];
  const hold = scanHoldMs();
  if (hold > 0) args.push(String(hold));
  // The scan runs where the caller's environment cannot reach it: PATH alone crosses over,
  // and the tool bunfig.toml anchors config discovery, so no HOME, no startup file and no
  // working-directory config reaches the scan.
  const r = spawnSync(bun, args, { encoding: "utf8", env: { PATH: process.env.PATH ?? "" } });
  let code: number;
  if (r.status !== null && r.status !== undefined) code = r.status;
  else if (r.signal) code = signalExitCode(r.signal);
  else code = 1;
  return { code, out: String(r.stdout ?? ""), err: String(r.stderr ?? "") };
}

// in_flight <runs-root> <checkout>: yes when some run still uses this pin.
function inFlight(root: string, checkout: string): { flying: boolean; out: string; err: string } {
  const r = runScanChild(root, checkout);
  if (r.code === 42) return { flying: false, out: r.out, err: r.err };
  if (r.code === 0) return { flying: true, out: r.out, err: r.err };
  return {
    flying: true,
    out: r.out,
    err:
      r.err +
      `run-meta: pin scan ended status ${r.code}, not its drop signal; keeping ${checkout}\n`,
  };
}

// worktree_locked <common-dir> <checkout>: yes when an admin locked this pin.
function worktreeLocked(common: string, checkout: string): boolean {
  if (isFile(join(common, "worktrees", basename(checkout), "locked"))) return true;
  const r = run("git", ["--git-dir", common, "worktree", "list", "--porcelain"]);
  let w = "";
  for (const line of r.out.split("\n")) {
    if (line.startsWith("worktree ")) w = line.slice("worktree ".length);
    if (w === checkout && line.startsWith("locked")) return true;
  }
  return false;
}

// unclaim <commit> <dispatch>: drop one claim line; the caller holds the lock.
function unclaim(tools: string, commit: string, dispatch: string): Outcome {
  const claims = join(tools, `${commit}.claims`);
  if (!isFile(claims)) return ok();
  let text: string;
  try {
    text = readFileSync(claims, "utf8");
  } catch {
    return fail(`run-meta: could not rewrite ${claims}\n`);
  }
  // grep -vxF: every line but the claim, each newline-terminated; an emptied file stays empty.
  const lines = text.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const kept = lines.filter((l) => l !== dispatch);
  const tmp = `${claims}.tmp`;
  try {
    writeFileSync(tmp, kept.length > 0 ? `${kept.join("\n")}\n` : "");
    renameSync(tmp, claims);
  } catch {
    return fail(`run-meta: could not rewrite ${claims}\n`);
  }
  return ok();
}

// claimed_in_flight <claims-file>: yes when a claimed run is still in flight. A claim that
// cannot be read counts as in flight. Lines read raw: a suffixed carriage return or a blank
// line names no manifest, whose stage reads "" and keeps.
function claimedInFlight(claims: string): { flying: boolean; err: string } {
  const unreadable = `run-meta: claims file ${claims} cannot be read; keeping the pin\n`;
  let text: string;
  try {
    text = readFileSync(claims, "utf8");
  } catch {
    return { flying: true, err: unreadable };
  }
  const lines = text.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  for (const line of lines) {
    if (isLiveStage(stageOf(`${line}/manifest.json`))) return { flying: true, err: "" };
  }
  return { flying: false, err: "" };
}

// --- pin -------------------------------------------------------------------------------
// pin_inner <repo> <commit> <dest>: cut or reuse the pin; the caller holds the lock.
function pinInner(repo: string, commit: string, dest: string): Outcome {
  if (existsSync(dest)) {
    const at = git(dest, "rev-parse", "--verify", "-q", "HEAD");
    if (at === null) {
      return fail(`run-meta: ${dest} exists but is not a git checkout; left alone\n`);
    }
    if (at !== commit) {
      return fail(`run-meta: ${dest} is at ${short12(at)}, not ${short12(commit)}; left alone\n`);
    }
    // The same commit is the same content, whatever repo cut it, so any checkout at the
    // commit is shared; but it must be clean, or it does not serve that commit's versions.
    const dirty = git(dest, "status", "--porcelain");
    if (dirty === null) return fail(`run-meta: could not read ${dest}\n`);
    if (dirty !== "") {
      return fail(
        `run-meta: ${dest} is not clean at ${short12(commit)}; clean it or remove it with ` +
          "'git worktree remove --force' and dispatch again\n",
      );
    }
    return ok(`${dest}\n`);
  }
  const r = run("git", ["-C", repo, "worktree", "add", "--detach", dest, commit]);
  if (r.code !== 0) return fail(`run-meta: git could not create ${dest} at ${commit}\n`);
  return ok(`${dest}\n`);
}

// pin <repo> <commit>: a checkout of <repo> at <commit> under the pins root, shared per commit.
function pin(repo: string, want: string, tools: string): Outcome {
  const commit = git(repo, "rev-parse", "--verify", "-q", `${want}^{commit}`);
  if (commit === null) return fail(`run-meta: no such commit in ${repo}: ${want}\n`);
  const dest = join(tools, commit);
  try {
    mkdirSync(tools, { recursive: true });
  } catch {
    return fail(`run-meta: could not make ${tools}\n`);
  }
  // One lock around cutting, recording and removing pins: dispatch takes it across its pin
  // and run.json write and release across its scan and removal, so a pin is never removed
  // between the two.
  const held = withPinLock(tools, () => pinInner(repo, commit, dest));
  if (!held.locked) return fail(`run-meta: could not lock ${tools}\n`);
  return held.value;
}

// --- record -------------------------------------------------------------------------------
function projectName(dispatch: string): string {
  // <project>/.postmaster/runs/<TICKET>: the project root's basename. An older
  // runs/<project>/<TICKET> layout is still read as that project.
  const p = realpathSync(dispatch);
  const parent = basename(dirname(p));
  const grand = basename(dirname(dirname(p)));
  if (parent === "runs" && grand === ".postmaster") return basename(dirname(dirname(dirname(p))));
  return parent;
}

function collectHarnesses(cfg: Record<string, unknown>): string[] {
  const harnesses = new Set<string>();
  const lanes = (cfg.lanes ?? {}) as Record<string, Record<string, unknown>>;
  for (const lane of Object.values(lanes)) {
    if (lane && typeof lane === "object" && lane.harness) harnesses.add(String(lane.harness));
  }
  const team = (cfg.team ?? {}) as Record<string, unknown>;
  for (const role of ["coachman", "coachman_fallback", "postmaster"]) {
    const v = team[role];
    if (v && typeof v === "object" && (v as Record<string, unknown>).harness) {
      harnesses.add(String((v as Record<string, unknown>).harness));
    }
  }
  const legs = (team.coachman_legs ?? {}) as Record<string, Record<string, unknown>>;
  for (const leg of Object.values(legs)) {
    if (leg && typeof leg === "object" && leg.harness) harnesses.add(String(leg.harness));
  }
  return [...harnesses].sort();
}

type Built = { ok: true; record: Record<string, unknown> } | { ok: false; messages: string[] };

function parseSettingsJson(text: string, what: string): { value: unknown } | { error: string } {
  try {
    return { value: JSON.parse(text) as unknown };
  } catch (e) {
    // main reports the Python JSON error; V8's text is the documented approximation.
    return { error: `${what} gave no JSON: ${(e as Error).message}` };
  }
}

// The python heredoc: resolve the effective config and project settings, then build the
// record. Expected failures report their message; unexpected throws fail bare, the way an
// uncaught exception (including a bad TOML load, whose value main never uses) fails the
// heredoc with only the traceback main prints and this port does not.
function buildRecord(
  d: string,
  resolvedRepo: string,
  config: string,
  checkout: string,
  pinnedCommit: string,
): Built {
  if (tryTomlFile(config) === null) return { ok: false, messages: [] };
  const settingsScript = join(TOOL, "scripts", "project-settings.sh");
  const inspected = run(settingsScript, ["inspect", resolvedRepo]);
  if (inspected.code !== 0) {
    return { ok: false, messages: [pyTrim(inspected.err) || "project settings could not be read"] };
  }
  const settings = parseSettingsJson(inspected.out, "project settings");
  if ("error" in settings) return { ok: false, messages: [settings.error] };
  const effective = run(settingsScript, ["effective", resolvedRepo, config]);
  if (effective.code !== 0) {
    return {
      ok: false,
      messages: [pyTrim(effective.err) || "effective machine config could not be resolved"],
    };
  }
  const cfg = parseSettingsJson(effective.out, "effective machine config");
  if ("error" in cfg) return { ok: false, messages: [cfg.error] };
  const harnessVersions: Record<string, string> = {};
  for (const h of collectHarnesses(cfg.value as Record<string, unknown>))
    harnessVersions[h] = version(h);
  return {
    ok: true,
    record: {
      written: utcStamp(new Date()),
      project: projectName(d),
      run: basename(realpathSync(d)),
      project_settings: settings.value,
      target: {
        head: git(resolvedRepo, "rev-parse", "HEAD"),
        branch: git(resolvedRepo, "symbolic-ref", "--short", "-q", "HEAD"),
      },
      postmaster: {
        commit: pinnedCommit,
        uncommitted_changes: (git(TOOL, "status", "--porcelain") ?? "") !== "",
        checkout,
      },
      config: cfg.value,
      harness_versions: harnessVersions,
    },
  };
}

function readConfig(): string {
  return process.env.POSTMASTER_CONFIG ?? join(homedir(), ".postmaster/config.toml");
}

function readTools(): string {
  return process.env.POSTMASTER_TOOL_PINS ?? join(homedir(), ".postmaster/tool-pins");
}

// meta <dispatch> <repo>
function meta(d: string, repo: string): Outcome {
  const config = readConfig();
  const tools = readTools();
  if (!isDir(d)) return fail(`run-meta: no such dispatch directory: ${d}\n`);
  if (git(repo, "rev-parse", "--git-dir") === null) {
    return fail(`run-meta: not a git repo: ${repo}\n`);
  }
  if (!isFile(config)) return fail(`run-meta: no config at ${config}\n`);
  const resolvedRepo = canon(repo);
  if (resolvedRepo === null) return fail(`run-meta: cannot resolve project ${repo}\n`);
  const runJson = join(d, "run.json");
  if (existsSync(runJson)) return ok(`run-meta: ${d}/run.json already written; left alone\n`);
  const head = run("git", ["-C", TOOL, "rev-parse", "HEAD"]);
  if (head.code !== 0) return fail(`${head.err}run-meta: no commit in ${TOOL}\n`);
  const commit = head.out.trim();
  try {
    mkdirSync(tools, { recursive: true });
  } catch {
    return fail(`run-meta: could not make ${tools}\n`);
  }
  // The pin, the claim on it and the run.json that records it land under one lock, which
  // release takes across its check and removal: a dispatch either lands wholly before a
  // release's check and is kept, or cuts wholly after its removal.
  const held = withPinLock(tools, (): Outcome => {
    if (existsSync(runJson)) return ok(`run-meta: ${d}/run.json already written; left alone\n`);
    const cut = pinInner(TOOL, commit, join(tools, commit));
    if (cut.code !== 0) return cut;
    const checkout = cut.out.trim();
    const dc = canon(d);
    if (dc === null) return fail(`run-meta: cannot resolve dispatch ${d}\n`);
    try {
      appendFileSync(join(tools, `${commit}.claims`), `${dc}\n`);
    } catch {
      return fail(`run-meta: could not record the claim on ${checkout}\n`);
    }
    let built: Built;
    try {
      built = buildRecord(d, resolvedRepo, config, checkout, commit);
    } catch {
      built = { ok: false, messages: [] };
    }
    if (!built.ok) {
      let err = "";
      for (const m of built.messages) err += `${m}\n`;
      err += `run-meta: could not write ${d}/run.json\n`;
      err += unclaim(tools, commit, dc).err;
      return { code: 1, out: "", err };
    }
    let tmp: string | null = null;
    try {
      tmp = mkstempSync(d, "tmp");
      writeFileSync(tmp, `${asciiJson(built.record)}\n`);
      renameSync(tmp, runJson);
    } catch {
      if (tmp !== null) {
        try {
          rmSync(tmp);
        } catch {
          // ignore
        }
      }
      let err = `run-meta: could not write ${d}/run.json\n`;
      err += unclaim(tools, commit, dc).err;
      return { code: 1, out: "", err };
    }
    const commit12 = (commit === "" ? "?" : commit).slice(0, 12);
    return ok(`run-meta: wrote ${runJson} (postmaster ${commit12}, pinned at ${checkout})\n`);
  });
  if (!held.locked) return fail(`run-meta: could not lock ${tools}\n`);
  return held.value;
}

// --- release ------------------------------------------------------------------------------
// release_pin <dispatch>: remove the pin when no claimed run is in flight.
function releasePin(d: string): Outcome {
  const tools = readTools();
  const runJson = join(d, "run.json");
  if (!isFile(runJson)) return fail(`run-meta: no run.json in ${d}\n`);
  const c = claim(runJson);
  if (c.kind === "unknown") {
    return fail(`run-meta: ${d}/run.json records an unreadable checkout; left alone\n`);
  }
  if (c.kind === "no") {
    return ok(`run-meta: ${d}/run.json records no pinned checkout; nothing to release\n`);
  }
  const recorded = c.path;
  if (!isDir(recorded)) {
    return ok(`run-meta: no pinned checkout at ${recorded}; nothing to release\n`);
  }
  const canonical = canon(recorded);
  if (canonical === null) {
    return ok(`run-meta: no pinned checkout at ${recorded}; nothing to release\n`);
  }
  const checkout = canonical;
  let toolsCanon: string;
  try {
    toolsCanon = realpathSync(tools);
  } catch {
    toolsCanon = tools;
  }
  if (!checkout.startsWith(`${toolsCanon}/`)) {
    return {
      code: 1,
      out: `run-meta: ${checkout} is not a pin under ${tools}; left alone\n`,
      err: "",
    };
  }
  const commit = basename(checkout);
  const claims = join(tools, `${commit}.claims`);
  // The check and the removal hold one lock, which dispatch takes across its pin, claim and
  // run.json write: a release either sees a dispatch's claim and keeps the pin, or removes
  // wholly before the dispatch cuts. Every check below re-runs under the lock, so two
  // releases at once serialize and the loser finds the pin already gone.
  const held = withPinLock(tools, (): Outcome => {
    if (existsSync(claims) && !isFile(claims)) {
      return fail(`run-meta: ${claims} is not a file; keeping ${checkout}\n`, 0);
    }
    let out = "";
    let err = "";
    if (isFile(claims)) {
      const cif = claimedInFlight(claims);
      err += cif.err;
      if (cif.flying) {
        out += `run-meta: kept ${checkout}; another run in flight still uses it\n`;
        return { code: 0, out, err };
      }
    } else {
      let root: string | null;
      try {
        root = realpathSync(join(d, "..", ".."));
      } catch {
        root = null;
      }
      if (root === null) {
        return fail(`run-meta: could not determine the runs root for ${d}; left alone\n`);
      }
      const flying = inFlight(root, checkout);
      out += flying.out;
      err += flying.err;
      if (flying.flying) {
        out += `run-meta: kept ${checkout}; another run in flight still uses it\n`;
        return { code: 0, out, err };
      }
    }
    const dropClaims = (): void => {
      try {
        rmSync(claims, { force: true });
      } catch {
        // ignore
      }
    };
    if (!existsSync(checkout)) {
      dropClaims();
      out += `run-meta: ${checkout} was already removed\n`;
      return { code: 0, out, err };
    }
    const common = git(checkout, "rev-parse", "--path-format=absolute", "--git-common-dir");
    if (common === null) {
      err += `run-meta: ${checkout} is not a git checkout; left alone\n`;
      return { code: 1, out, err };
    }
    if (run("git", ["--git-dir", common, "worktree", "remove", checkout]).code === 0) {
      dropClaims();
      out += `run-meta: removed ${checkout}\n`;
      return { code: 0, out, err };
    }
    if (!existsSync(checkout)) {
      dropClaims();
      out += `run-meta: ${checkout} was already removed\n`;
      return { code: 0, out, err };
    }
    if (worktreeLocked(common, checkout)) {
      err += `run-meta: ${checkout} is locked; left alone\n`;
      return { code: 1, out, err };
    }
    const dirty = git(checkout, "status", "--porcelain") ?? "?";
    if (
      dirty !== "" &&
      run("git", ["--git-dir", common, "worktree", "remove", "--force", checkout]).code === 0
    ) {
      dropClaims();
      out += `run-meta: removed ${checkout}, which was not clean\n`;
      return { code: 0, out, err };
    }
    if (dirty !== "") {
      err += `run-meta: git could not remove ${checkout} even with --force\n`;
      return { code: 1, out, err };
    }
    err += `run-meta: git could not remove ${checkout}\n`;
    return { code: 1, out, err };
  });
  if (!held.locked) return fail(`run-meta: could not lock ${tools}\n`);
  return held.value;
}

// --- entry ------------------------------------------------------------------------------
function usage(): never {
  process.stderr.write(`${USAGE}\n`);
  process.exit(1);
  throw new Error("unreachable");
}

const argv = process.argv.slice(2);
if (argv[0] === "--self-test" && argv.length === 1) {
  process.exit(await selfTestMain());
}
// Hidden scan mode: the pin scan as a child process, so a scan that dies mid-way is observed
// and keeps the pin. Never in usage; release is its only caller.
if (argv[0] === "run-meta-scan" && (argv.length === 3 || argv.length === 4)) {
  const holdRaw = argv.length === 4 ? (argv[3] as string) : "";
  let holdMs = 0;
  if (HOLD_RE.test(holdRaw)) holdMs = Math.min(Number(holdRaw), 120000);
  if (holdMs > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, holdMs);
  const found = pinScan(argv[1] as string, argv[2] as string);
  if (found.err !== "") process.stderr.write(found.err);
  process.exit(found.code);
}
{
  const cmd = argv[0];
  const verbs = ["pin", "path", "check", "release"];
  let outcome: Outcome;
  if (cmd === "pin" && argv.length === 3)
    outcome = pin(argv[1] as string, argv[2] as string, readTools());
  else if (cmd === "path" && argv.length === 2) outcome = pathOf(argv[1] as string);
  else if (cmd === "check" && argv.length === 2) outcome = checkPin(argv[1] as string);
  else if (cmd === "release" && argv.length === 2) outcome = releasePin(argv[1] as string);
  else if (
    cmd !== undefined &&
    cmd !== "--self-test" &&
    !verbs.includes(cmd) &&
    argv.length === 2
  ) {
    outcome = meta(argv[0] as string, argv[1] as string);
  } else usage();
  if (outcome.out !== "") process.stdout.write(outcome.out);
  if (outcome.err !== "") process.stderr.write(outcome.err);
  process.exit(outcome.code);
}

// --- self-test ----------------------------------------------------------------------------
async function selfTestMain(): Promise<number> {
  const st = new SelfTest();
  const wrapper = join(scriptsDir(import.meta), "run-meta.sh");
  const fails = await withTempDir(async (raw: string): Promise<number> => {
    const tmp = realpathSync(raw);
    const tools = join(tmp, "tools");
    process.env.POSTMASTER_TOOL_PINS = tools;
    const d = join(tmp, "project", "RUN-1");
    const repo = join(tmp, "target");
    mkdirSync(d, { recursive: true });
    mkdirSync(repo, { recursive: true });
    run("git", ["-C", repo, "init", "-q", "-b", "main"]);
    run("git", [
      "-C",
      repo,
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@t",
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "first",
    ]);
    const configPath = join(tmp, "config.toml");
    writeFileSync(
      configPath,
      '[lanes.one]\nharness = "bash"\nmodel = "m1"\nenv_file = "~/somewhere/secret.env"\n' +
        '[lanes.two]\nharness = "no-such-harness-xyz"\nmodel = "m2"\n[team]\n' +
        'workhorses = ["one", "two"]\ncoachman = { harness = "bash", model = "judge" }\n' +
        'coachman_fallback = { harness = "bash", model = "backup" }\n',
    );
    process.env.POSTMASTER_CONFIG = configPath;

    const cli = (
      args: string[],
      env?: Record<string, string | undefined>,
    ): { code: number; out: string } => {
      const r = env === undefined ? run(wrapper, args) : run(wrapper, args, { env });
      return { code: r.code, out: r.out + r.err };
    };
    const spawnCli = (
      args: string[],
      env?: Record<string, string | undefined>,
    ): Promise<{ code: number; out: string }> => {
      // Bun.spawn without env does not inherit this process's environment, so the
      // current environment always crosses explicitly.
      const child: any = Bun.spawn([wrapper, ...args], {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, ...(env ?? {}) },
      });
      return (async () => {
        const code = (await child.exited) as number;
        const out = (await new Response(child.stdout).text()) as string;
        const err = (await new Response(child.stderr).text()) as string;
        return { code, out: out + err };
      })();
    };
    // Command substitution strips trailing newlines; $(...) comparisons strip the same way.
    const sh = (s: string): string => s.replace(TRAIL_NL_RE, "");
    const gitOut = (args: string[]): string => run("git", args).out.trim();
    const headOf = (where: string): string => gitOut(["-C", where, "rev-parse", "HEAD"]);
    const runJson = (dir: string): Record<string, any> =>
      JSON.parse(readFileSync(join(dir, "run.json"), "utf8")) as Record<string, any>;
    const check = (label: string, fn: (r: Record<string, any>) => boolean): void => {
      try {
        if (fn(runJson(d))) st.ok(label);
        else st.fail(label);
      } catch {
        st.fail(label);
      }
    };
    const cutPin = (
      label: string,
      repoArg: string,
      commit: string,
    ): { code: number; dest: string; out: string } => {
      const r = pin(repoArg, commit, tools);
      const dest = r.out.trim();
      if (r.code !== 0) st.fail(label, r.out + r.err);
      return { code: r.code, dest, out: r.out + r.err };
    };

    console.log("positive controls");
    if (meta(d, repo).code === 0) st.ok("run.json is written");
    else st.fail("run.json is written");
    check("it names the postmaster commit", (r) => r.postmaster.commit === headOf(TOOL));
    check(
      "it names the target's HEAD and branch",
      (r) =>
        r.target.head === headOf(repo) &&
        r.target.branch === "main" &&
        Object.keys(r.target).length === 2,
    );
    check(
      "it keeps the resolved config as it was",
      (r) =>
        r.config.lanes.one.model === "m1" &&
        JSON.stringify(r.config.team.workhorses) === '["one","two"]',
    );
    check(
      "it names an old-layout run from its parent",
      (r) => r.project === "project" && r.run === "RUN-1",
    );
    check(
      "it records project settings and their source",
      (r) =>
        !r.project_settings.shared_present &&
        r.project_settings.sources["project.default_turnpikes"] === "discovery",
    );
    check("it records each harness's version", (r) =>
      String(r.harness_versions.bash).startsWith("GNU bash"),
    );
    check(
      "a harness not installed says so",
      (r) => r.harness_versions["no-such-harness-xyz"] === "not on PATH",
    );
    // main gives --version 15 seconds, then records "no version: TimeoutExpired".
    // Through the CLI: Bun.which reads PATH once, so only a child sees the stub.
    {
      const bindir = join(tmp, "slowbin");
      mkdirSync(bindir, { recursive: true });
      writeFileSync(join(bindir, "slowharness"), "#!/bin/sh\nsleep 60\n");
      chmodSync(join(bindir, "slowharness"), 0o755);
      const slowCfg = join(tmp, "slow.toml");
      writeFileSync(slowCfg, '[lanes.one]\nharness = "slowharness"\nmodel = "m1"\n[team]\n');
      const slowD = join(tmp, "slowrun");
      mkdirSync(slowD, { recursive: true });
      const t0 = Date.now();
      const r = run(wrapper, [slowD, repo], {
        env: {
          ...process.env,
          PATH: `${bindir}${delimiter}${process.env.PATH ?? ""}`,
          POSTMASTER_CONFIG: slowCfg,
        },
      });
      const secs = (Date.now() - t0) / 1000;
      let ver = "";
      try {
        ver = (JSON.parse(readFileSync(join(slowD, "run.json"), "utf8")) as Record<string, any>)
          .harness_versions.slowharness as string;
      } catch {
        ver = "";
      }
      st.check(
        "a harness stuck on --version records BASE's TimeoutExpired after 15 seconds",
        r.code === 0 && ver === "no version: TimeoutExpired" && secs >= 14 && secs < 60,
        `exit ${r.code} ver=[${ver}] after ${secs.toFixed(1)}s`,
      );
      // The claim this dispatch made must read done for the later claims-based releases.
      writeFileSync(join(slowD, "manifest.json"), '{"stage": "done"}\n');
    }
    check(
      "an env file is named, never read",
      (r) => r.config.lanes.one.env_file === "~/somewhere/secret.env",
    );
    const liveHead = headOf(TOOL);
    const livePin = join(tools, liveHead);
    check("it names the pinned checkout", (r) => r.postmaster.checkout === livePin);
    {
      const t = cli(["path", d]);
      st.check("path prints the pin", t.code === 0 && sh(t.out) === livePin, t.out);
    }
    {
      const t = cli(["check", d]);
      st.check("check passes a pin that serves its commit", t.code === 0, t.out);
    }
    const shared = join(tmp, "project", "RUN-2");
    mkdirSync(shared, { recursive: true });
    meta(shared, repo);
    {
      const t = cli(["path", shared]);
      st.check(
        "a second run at the same commit shares the pin",
        t.code === 0 && sh(t.out) === livePin,
        t.out,
      );
    }

    // AC3: a run dispatched at one commit still serves its versions after main moves on.
    // The identical command is `check`; the runbook and the script are read from both
    // checkouts, and the script is run from both.
    const fake = join(tmp, "fake-tool");
    run("git", ["-C", tmp, "init", "-q", "-b", "main", fake]);
    run("git", ["-C", fake, "config", "user.name", "t"]);
    run("git", ["-C", fake, "config", "user.email", "t@t"]);
    mkdirSync(join(fake, "skills", "postmaster"), { recursive: true });
    mkdirSync(join(fake, "scripts"), { recursive: true });
    writeFileSync(join(fake, "skills", "postmaster", "coachman.md"), "# coachman MARKER=A\n");
    writeFileSync(join(fake, "scripts", "foo.sh"), "#!/bin/sh\necho MARKER=A\n");
    chmodSync(join(fake, "scripts", "foo.sh"), 0o755);
    run("git", ["-C", fake, "add", "-A"]);
    run("git", ["-C", fake, "commit", "-qm", "A"]);
    const commitA = headOf(fake);
    const pinA = cutPin("a pin of a tool repo at A is cut", fake, commitA).dest;
    writeFileSync(join(fake, "skills", "postmaster", "coachman.md"), "# coachman MARKER=B\n");
    writeFileSync(join(fake, "scripts", "foo.sh"), "#!/bin/sh\necho MARKER=B\n");
    run("git", ["-C", fake, "add", "-A"]);
    run("git", ["-C", fake, "commit", "-qm", "B"]);
    const runPinned = join(tmp, "project", "RUN-PINNED");
    const runLive = join(tmp, "project", "RUN-LIVE");
    mkdirSync(runPinned, { recursive: true });
    mkdirSync(runLive, { recursive: true });
    for (const [dd, co, cm] of [
      [runPinned, pinA, commitA],
      [runLive, fake, commitA],
    ]) {
      writeFileSync(
        join(dd as string, "run.json"),
        `${JSON.stringify({ postmaster: { commit: cm, checkout: co }, stage: "synthesis" })}\n`,
      );
      writeFileSync(join(dd as string, "manifest.json"), '{"stage": "synthesis"}\n');
    }
    const markerIn = (file: string): string => {
      const text = readFileSync(file, "utf8");
      const i = text.indexOf("MARKER=");
      return i < 0 ? "" : text.slice(i, i + "MARKER=X".length);
    };
    {
      const got = markerIn(join(pinA, "skills", "postmaster", "coachman.md"));
      const want = markerIn(join(fake, "skills", "postmaster", "coachman.md"));
      st.check(
        "after main moved on, the pin still reads A while main reads B (marker_of)",
        got === "MARKER=A" && want === "MARKER=B",
        `pin=${got} main=${want}`,
      );
    }
    {
      const got = markerIn(join(pinA, "scripts", "foo.sh"));
      const want = markerIn(join(fake, "scripts", "foo.sh"));
      st.check(
        "and the script reads A on the pin while main reads B",
        got === "MARKER=A" && want === "MARKER=B",
        `pin=${got} main=${want}`,
      );
    }
    {
      const got = run("bash", [join(pinA, "scripts", "foo.sh")]).out.trim();
      const want = run("bash", [join(fake, "scripts", "foo.sh")]).out.trim();
      st.check(
        "and the script runs A from the pin while main runs B (script_of)",
        got === "MARKER=A" && want === "MARKER=B",
        `pin=${got} main=${want}`,
      );
    }
    {
      const t = cli(["check", runPinned]);
      st.check("check passes the run pinned at A", t.code === 0, t.out);
    }
    {
      const t = cli(["check", runLive]);
      st.check(
        "check fails the run pointed at main after it moved on (identical command)",
        t.code === 1,
        t.out,
      );
    }
    appendFileSync(join(pinA, "skills", "postmaster", "coachman.md"), "drift\n");
    {
      const t = cli(["check", runPinned]);
      st.check("check fails a pin that no longer serves its commit", t.code === 1, t.out);
    }
    run("git", ["-C", pinA, "checkout", "-q", "--", "skills/postmaster/coachman.md"]);

    console.log("negative controls");
    copyFileSync(join(d, "run.json"), join(tmp, "before.json"));
    await Bun.sleep(1000);
    meta(d, repo);
    st.check(
      "a second call leaves run.json alone",
      readFileSync(join(d, "run.json"), "utf8") === readFileSync(join(tmp, "before.json"), "utf8"),
    );

    rmSync(join(d, "run.json"));
    process.env.POSTMASTER_CONFIG = join(tmp, "none.toml");
    const rcNoCfg = meta(d, repo).code;
    process.env.POSTMASTER_CONFIG = configPath;
    st.check(
      "no config is refused, and nothing is written",
      rcNoCfg === 1 && !existsSync(join(d, "run.json")),
    );

    const rcNoRepo = meta(d, join(tmp, "not-a-repo")).code;
    st.check("a target that is not a repo is refused", rcNoRepo === 1);
    {
      const t = cli(["path", join(tmp, "project", "no-such-run")]);
      st.check("path on a run with no run.json is refused", t.code === 1, t.out);
    }
    {
      const t = cli(["pin", fake, "no-such-commit"]);
      st.check(
        "a commit the repo does not have is refused, and no pin is cut",
        t.code === 1,
        t.out,
      );
    }
    // AC4: release keeps a pin another in-flight run uses, and removes it once none does.
    // RUN-PINNED and a third run share pinA; RUN-LIVE is the negative control that moved.
    const runThird = join(tmp, "project", "RUN-THIRD");
    mkdirSync(runThird, { recursive: true });
    writeFileSync(
      join(runThird, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: pinA } })}\n`,
    );
    writeFileSync(join(runThird, "manifest.json"), '{"stage": "shipping"}\n');
    {
      const t = cli(["release", runPinned]);
      st.check(
        "release keeps the pin while another run in flight still uses it",
        t.code === 0 && t.out.includes("kept") && isDir(pinA),
        t.out,
      );
    }
    writeFileSync(join(runThird, "manifest.json"), '{"stage": "done"}\n');
    {
      const t = cli(["release", runPinned]);
      st.check(
        "release keeps the pin while its own run is still in flight",
        t.code === 0 && t.out.includes("kept") && isDir(pinA),
        t.out,
      );
    }
    writeFileSync(join(runPinned, "manifest.json"), '{"stage": "done"}\n');
    {
      const t = cli(["release", runPinned]);
      st.check(
        "release removes the pin once no run in flight uses it",
        t.code === 0 && t.out.includes("removed") && !existsSync(pinA),
        t.out,
      );
    }
    {
      const t = cli(["release", runPinned]);
      st.check("release again is a no-op", t.code === 0, t.out);
    }
    const noco = join(tmp, "project", "RUN-OLD");
    mkdirSync(noco, { recursive: true });
    writeFileSync(join(noco, "run.json"), '{"postmaster": {"commit": "abc"}}\n');
    {
      const t = cli(["release", noco]);
      st.check("release of a run with no pinned checkout is a no-op", t.code === 0, t.out);
    }
    const badown = join(tmp, "project", "RUN-BADOWN");
    mkdirSync(badown, { recursive: true });
    writeFileSync(
      join(badown, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: 12345 } })}\n`,
    );
    writeFileSync(join(badown, "manifest.json"), '{"stage": "done"}\n');
    {
      const t = cli(["release", badown]);
      st.check(
        "release refuses a run whose own checkout is not a string",
        t.code === 1 && t.out.includes("unreadable"),
        t.out,
      );
    }
    rmSync(badown, { recursive: true, force: true }); // unknown to every later scan; its control is done
    // A sibling whose record cannot be read keeps the pin; one that records no checkout is skipped.
    const g4rel = join(tmp, "project", "RUN-G4");
    const g4sib = join(tmp, "project", "RUN-G4SIB");
    mkdirSync(g4rel, { recursive: true });
    mkdirSync(g4sib, { recursive: true });
    const pinG4 = cutPin("a pin is cut for the unreadable-sibling controls", fake, commitA).dest;
    writeFileSync(
      join(g4rel, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: pinG4 } })}\n`,
    );
    writeFileSync(join(g4rel, "manifest.json"), '{"stage": "done"}\n');
    writeFileSync(join(g4sib, "manifest.json"), '{"stage": "synthesis"}\n');
    writeFileSync(join(g4sib, "run.json"), "NOT JSON\n");
    {
      const t = cli(["release", g4rel]);
      st.check(
        "release keeps the pin for a sibling whose run.json does not parse",
        t.code === 0 && t.out.includes("kept") && isDir(pinG4),
        t.out,
      );
    }
    writeFileSync(join(g4sib, "run.json"), '{"postmaster": ["not", "an", "object"]}\n');
    {
      const t = cli(["release", g4rel]);
      st.check(
        "release keeps the pin for a sibling whose postmaster is not an object",
        t.code === 0 && t.out.includes("kept") && isDir(pinG4),
        t.out,
      );
    }
    writeFileSync(
      join(g4sib, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: 12345 } })}\n`,
    );
    {
      const t = cli(["release", g4rel]);
      st.check(
        "release keeps the pin for a sibling whose checkout is not a string",
        t.code === 0 && t.out.includes("kept") && isDir(pinG4),
        t.out,
      );
    }
    writeFileSync(join(g4sib, "run.json"), "{}\n");
    {
      const t = cli(["release", g4rel]);
      st.check(
        "release keeps the pin for a sibling with no postmaster record",
        t.code === 0 && t.out.includes("kept") && isDir(pinG4),
        t.out,
      );
    }
    writeFileSync(
      join(g4sib, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA } })}\n`,
    );
    {
      const t = cli(["release", g4rel]);
      st.check(
        "release removes past a sibling that records no checkout",
        t.code === 0 && t.out.includes("removed") && !existsSync(pinG4),
        t.out,
      );
    }

    const hidrun = join(tmp, ".hidden", "RUN-HID");
    const hidrel = join(tmp, "project", "RUN-HIDREL");
    mkdirSync(hidrun, { recursive: true });
    mkdirSync(hidrel, { recursive: true });
    const pinHid = cutPin("a pin is cut for the hidden-project controls", fake, commitA).dest;
    writeFileSync(
      join(hidrun, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: pinHid } })}\n`,
    );
    writeFileSync(join(hidrun, "manifest.json"), '{"stage": "synthesis"}\n');
    writeFileSync(
      join(hidrel, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: pinHid } })}\n`,
    );
    writeFileSync(join(hidrel, "manifest.json"), '{"stage": "done"}\n');
    {
      const t = cli(["release", hidrel]);
      st.check(
        "release keeps the pin for an in-flight run under a dot-prefixed project",
        t.code === 0 && t.out.includes("kept") && isDir(pinHid),
        t.out,
      );
    }
    writeFileSync(join(hidrun, "manifest.json"), '{"stage": "done"}\n');
    {
      const t = cli(["release", hidrel]);
      st.check(
        "release removes once the hidden run is done",
        t.code === 0 && t.out.includes("removed") && !existsSync(pinHid),
        t.out,
      );
    }
    const nphid = join(tmp, "noproj", "RUN-NP");
    const nprel = join(tmp, "project", "RUN-NPREL");
    mkdirSync(nphid, { recursive: true });
    mkdirSync(nprel, { recursive: true });
    const pinNP = cutPin("a pin is cut for the unreadable-directory controls", fake, commitA).dest;
    writeFileSync(
      join(nphid, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: pinNP } })}\n`,
    );
    writeFileSync(join(nphid, "manifest.json"), '{"stage": "synthesis"}\n');
    writeFileSync(
      join(nprel, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: pinNP } })}\n`,
    );
    writeFileSync(join(nprel, "manifest.json"), '{"stage": "done"}\n');
    chmodSync(join(tmp, "noproj"), 0);
    {
      const t = cli(["release", nprel]);
      st.check(
        "release keeps the pin when a project directory cannot be listed",
        t.code === 0 && t.out.includes("kept") && isDir(pinNP),
        t.out,
      );
    }
    chmodSync(join(tmp, "noproj"), 0o755);
    chmodSync(nphid, 0);
    {
      const t = cli(["release", nprel]);
      st.check(
        "release keeps the pin when a run directory cannot be listed",
        t.code === 0 && t.out.includes("kept") && isDir(pinNP),
        t.out,
      );
    }
    chmodSync(nphid, 0o755);
    {
      const t = cli(["release", nprel]);
      st.check(
        "release still keeps the pin for the readable in-flight run",
        t.code === 0 && t.out.includes("kept") && isDir(pinNP),
        t.out,
      );
    }
    writeFileSync(join(nphid, "manifest.json"), '{"stage": "done"}\n');
    {
      const t = cli(["release", nprel]);
      st.check(
        "release removes once the unreadable run is done",
        t.code === 0 && t.out.includes("removed") && !existsSync(pinNP),
        t.out,
      );
    }
    // A literal star in a directory name is data: the scan reads through it and keeps the
    // pin for the in-flight runs, without crying unreadable.
    mkdirSync(join(tmp, "project", "*EMPTY"), { recursive: true });
    mkdirSync(join(tmp, "project", "RUN-SALIVE"), { recursive: true });
    mkdirSync(join(tmp, "project", "STAR*RUN"), { recursive: true });
    mkdirSync(join(tmp, "star*proj", "RUN-PALIVE"), { recursive: true });
    const pinStar = cutPin("a pin is cut for the star-name controls", fake, commitA).dest;
    for (const r of [
      join(tmp, "project", "RUN-SALIVE"),
      join(tmp, "project", "STAR*RUN"),
      join(tmp, "star*proj", "RUN-PALIVE"),
    ]) {
      writeFileSync(
        join(r, "run.json"),
        `${JSON.stringify({ postmaster: { commit: commitA, checkout: pinStar } })}\n`,
      );
      writeFileSync(join(r, "manifest.json"), '{"stage": "synthesis"}\n');
    }
    const starrel = join(tmp, "project", "RUN-STARREL");
    mkdirSync(starrel, { recursive: true });
    writeFileSync(
      join(starrel, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: pinStar } })}\n`,
    );
    writeFileSync(join(starrel, "manifest.json"), '{"stage": "done"}\n');
    {
      const t = cli(["release", starrel]);
      st.check(
        "release keeps the pin past star-named directories, crying nothing unreadable",
        t.code === 0 && t.out.includes("kept") && !t.out.includes("cannot list") && isDir(pinStar),
        t.out,
      );
    }
    for (const r of [
      join(tmp, "project", "RUN-SALIVE"),
      join(tmp, "project", "STAR*RUN"),
      join(tmp, "star*proj", "RUN-PALIVE"),
    ]) {
      writeFileSync(join(r, "manifest.json"), '{"stage": "done"}\n');
    }
    {
      const t = cli(["release", starrel]);
      st.check(
        "release removes once the star-named runs are done",
        t.code === 0 && t.out.includes("removed") && !existsSync(pinStar),
        t.out,
      );
    }

    const giRun = join(tmp, "giproj", "RUN-GI");
    const giRel = join(tmp, "project", "RUN-GIREL");
    mkdirSync(giRun, { recursive: true });
    mkdirSync(giRel, { recursive: true });
    const pinGI = cutPin("a pin is cut for the GLOBIGNORE controls", fake, commitA).dest;
    writeFileSync(
      join(giRun, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: pinGI } })}\n`,
    );
    writeFileSync(join(giRun, "manifest.json"), '{"stage": "synthesis"}\n');
    writeFileSync(
      join(giRel, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: pinGI } })}\n`,
    );
    writeFileSync(join(giRel, "manifest.json"), '{"stage": "done"}\n');
    writeFileSync(join(tmp, "benv-ignore.sh"), `GLOBIGNORE=${join(tmp, "giproj")}/\n`);
    {
      const t = cli(["release", giRel], { BASH_ENV: join(tmp, "benv-ignore.sh") });
      st.check(
        "release keeps the pin under a BASH_ENV that ignores the live project",
        t.code === 0 && t.out.includes("kept") && isDir(pinGI),
        t.out,
      );
    }
    // The hostile controls: release under every ambient vector at once — a BASH_ENV
    // holding a readonly GLOBIGNORE, set -f, failglob, the opposite of every scan
    // setting and a python3 shadow, plus an exported SHELLOPTS with noglob and an
    // exported python3 function — over a fixture shaped to show each one: an empty
    // project level, a dot-named project holding the live run, and star-named,
    // bracket-named and mixed-case projects. The enumeration reads directories
    // literally, so the vectors are inert and the names do the work.
    const hroot = join(tmp, "hruns");
    mkdirSync(join(hroot, "empty-proj"), { recursive: true });
    mkdirSync(join(hroot, ".dotproj", "RUN-HDOT"), { recursive: true });
    mkdirSync(join(hroot, "giproj", "RUN-HGI"), { recursive: true });
    mkdirSync(join(hroot, "STAR*PROJ", "RUN-HS"), { recursive: true });
    mkdirSync(join(hroot, "br[ack]et", "RUN-HB"), { recursive: true });
    mkdirSync(join(hroot, "MiXeD", "RUN-HM"), { recursive: true });
    mkdirSync(join(hroot, "project", "RUN-HREL"), { recursive: true });
    // The hostile pin is its own commit, so the hostile remove below does not eat the
    // GLOBIGNORE pin, which is still needed after; the fake repo's HEAD is B here.
    const commitH = headOf(fake);
    const pinHos = cutPin("a pin is cut for the hostile controls", fake, commitH).dest;
    for (const r of [
      join(hroot, ".dotproj", "RUN-HDOT"),
      join(hroot, "giproj", "RUN-HGI"),
      join(hroot, "STAR*PROJ", "RUN-HS"),
      join(hroot, "br[ack]et", "RUN-HB"),
      join(hroot, "MiXeD", "RUN-HM"),
      join(hroot, "project", "RUN-HREL"),
    ]) {
      writeFileSync(
        join(r, "run.json"),
        `${JSON.stringify({ postmaster: { commit: commitH, checkout: pinHos } })}\n`,
      );
      writeFileSync(join(r, "manifest.json"), '{"stage": "done"}\n');
    }
    writeFileSync(join(hroot, ".dotproj", "RUN-HDOT", "manifest.json"), '{"stage": "synthesis"}\n');
    writeFileSync(
      join(tmp, "benv-hostile.sh"),
      `GLOBIGNORE=${join(hroot, "giproj")}/\n` +
        "readonly GLOBIGNORE\n" +
        "set -f\n" +
        "shopt -s failglob nocaseglob extglob globstar nocasematch\n" +
        "shopt -u dotglob nullglob globskipdots globasciiranges\n" +
        'python3() { case "$*" in *RUN-HS*) echo weird;; *) command python3 "$@";; esac; }\n',
    );
    // An exported shell function crosses to children as BASH_FUNC_<name>%%.
    const hostileEnv = {
      BASH_ENV: join(tmp, "benv-hostile.sh"),
      SHELLOPTS: "noglob",
      "BASH_FUNC_python3%%":
        '() { case "$*" in *RUN-HS*) echo weird;; *) command python3 "$@";; esac; }',
    };
    {
      const t = cli(["release", join(hroot, "project", "RUN-HREL")], hostileEnv);
      st.check(
        "release keeps the pin under every hostile vector at once",
        t.code === 0 &&
          t.out.includes("kept") &&
          !t.out.includes("cannot list") &&
          !t.out.includes("not its drop signal") &&
          isDir(pinHos),
        t.out,
      );
    }
    writeFileSync(join(hroot, ".dotproj", "RUN-HDOT", "manifest.json"), '{"stage": "done"}\n');
    {
      const t = cli(["release", join(hroot, "project", "RUN-HREL")], hostileEnv);
      st.check(
        "release removes under every hostile vector at once when nothing is live",
        t.code === 0 && t.out.includes("removed") && !existsSync(pinHos),
        t.out,
      );
    }
    // A scan that dies mid-way keeps the pin: only the reserved drop signal removes.
    // The hold keeps the scan alive until the kill lands; the kill is scoped to a scan
    // whose command line holds this test's own tmp.
    const kroot = join(tmp, "kroot");
    const krel = join(kroot, "project", "RUN-KREL");
    mkdirSync(krel, { recursive: true });
    const pinK = cutPin("a pin is cut for the killed-scan control", fake, commitH).dest;
    for (let i = 1; i <= 150; i++) {
      const r = join(kroot, "project", `RUN-K${i}`);
      mkdirSync(r, { recursive: true });
      writeFileSync(
        join(r, "run.json"),
        `${JSON.stringify({ postmaster: { commit: commitH, checkout: pinK } })}\n`,
      );
      writeFileSync(join(r, "manifest.json"), '{"stage": "done"}\n');
    }
    writeFileSync(
      join(krel, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitH, checkout: pinK } })}\n`,
    );
    writeFileSync(join(krel, "manifest.json"), '{"stage": "done"}\n');
    {
      const relChild: any = Bun.spawn([wrapper, "release", krel], {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, POSTMASTER_SCAN_HOLD_MS: "20000" },
      });
      let killed = false;
      for (let i = 0; i < 300 && !killed; i++) {
        const pg = run("pgrep", ["-f", "run-meta-scan"]);
        const pids = pg.out.trim() === "" ? [] : pg.out.trim().split("\n");
        for (const pid of pids) {
          let cmd = "";
          try {
            cmd = readFileSync(`/proc/${pid}/cmdline`, "utf8");
          } catch {
            continue;
          }
          if (cmd.includes(tmp)) {
            try {
              process.kill(Number(pid), 9);
              killed = true;
            } catch {
              // Already gone; keep looking.
            }
          }
        }
        if (killed) break;
        const status = await Promise.race([
          (relChild.exited as Promise<number>).then(() => "exited"),
          Promise.resolve("waiting"),
        ]);
        if (status === "exited") break;
        await Bun.sleep(100);
      }
      const rcKill = (await relChild.exited) as number;
      const outKill =
        ((await new Response(relChild.stdout).text()) as string) +
        ((await new Response(relChild.stderr).text()) as string);
      st.check(
        "release keeps the pin when the pin scan is killed",
        killed &&
          rcKill === 0 &&
          outKill.includes("kept") &&
          outKill.includes("not its drop signal") &&
          isDir(pinK),
        `killed=${killed} rc=${rcKill} ${outKill}`,
      );
    }
    rmSync(kroot, { recursive: true, force: true });

    // A sibling whose record claims an unexpected shape keeps the pin, without noise.
    // main forces the shape with a shadow python3 answering weird; the port reads JSON
    // in-process, so the unexpected shape is a record that parses yet is no object at
    // all. Restored after: the shell's weirdness was PATH-scoped and transient, and later
    // scans must read this run normally.
    const wroot = join(tmp, "wroot");
    const weirdRun = join(wroot, "project", "RUN-WEIRD");
    const wrel = join(wroot, "project", "RUN-WREL");
    mkdirSync(weirdRun, { recursive: true });
    mkdirSync(wrel, { recursive: true });
    const pinU = cutPin("a pin is cut for the unexpected-shape control", fake, commitH).dest;
    const normalWeird = `${JSON.stringify({ postmaster: { commit: commitH, checkout: pinU } })}\n`;
    for (const r of [weirdRun, wrel]) {
      writeFileSync(join(r, "run.json"), normalWeird);
      writeFileSync(join(r, "manifest.json"), '{"stage": "done"}\n');
    }
    writeFileSync(join(weirdRun, "run.json"), '"weird"\n');
    {
      const t = cli(["release", wrel]);
      st.check(
        "release keeps the pin for a sibling whose record claims an unexpected shape",
        t.code === 0 && t.out.includes("kept") && isDir(pinU),
        t.out,
      );
    }
    writeFileSync(join(weirdRun, "run.json"), normalWeird);
    // A run whose run.json is missing, a directory or a broken link keeps the pin while
    // its manifest is live — the record's absence is not safety — and drops once done.
    const mroot = join(tmp, "mroot");
    const mMissing = join(mroot, "missing", "RUN-MM");
    const mDir = join(mroot, "dirrec", "RUN-MD");
    const mLink = join(mroot, "linkrec", "RUN-ML");
    const mrel = join(mroot, "project", "RUN-MREL");
    mkdirSync(mMissing, { recursive: true });
    mkdirSync(mDir, { recursive: true });
    mkdirSync(mLink, { recursive: true });
    mkdirSync(mrel, { recursive: true });
    const pinM = cutPin("a pin is cut for the missing-record controls", fake, commitH).dest;
    mkdirSync(join(mDir, "run.json"), { recursive: true });
    symlinkSync(join(tmp, "nowhere-at-all"), join(mLink, "run.json"));
    for (const r of [mMissing, mDir, mLink]) {
      writeFileSync(join(r, "manifest.json"), '{"stage": "done"}\n');
    }
    writeFileSync(
      join(mrel, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitH, checkout: pinM } })}\n`,
    );
    writeFileSync(join(mrel, "manifest.json"), '{"stage": "done"}\n');
    writeFileSync(join(mMissing, "manifest.json"), '{"stage": "synthesis"}\n');
    {
      const t = cli(["release", mrel]);
      st.check(
        "release keeps the pin for a live run whose run.json is missing",
        t.code === 0 && t.out.includes("kept") && isDir(pinM),
        t.out,
      );
    }
    writeFileSync(join(mMissing, "manifest.json"), '{"stage": "done"}\n');
    writeFileSync(join(mDir, "manifest.json"), '{"stage": "synthesis"}\n');
    {
      const t = cli(["release", mrel]);
      st.check(
        "release keeps the pin for a live run whose run.json is a directory",
        t.code === 0 && t.out.includes("kept") && isDir(pinM),
        t.out,
      );
    }
    writeFileSync(join(mDir, "manifest.json"), '{"stage": "done"}\n');
    writeFileSync(join(mLink, "manifest.json"), '{"stage": "synthesis"}\n');
    {
      const t = cli(["release", mrel]);
      st.check(
        "release keeps the pin for a live run whose run.json is a broken link",
        t.code === 0 && t.out.includes("kept") && isDir(pinM),
        t.out,
      );
    }
    writeFileSync(join(mLink, "manifest.json"), '{"stage": "done"}\n');
    {
      const t = cli(["release", mrel]);
      st.check(
        "release removes once the recordless runs are done",
        t.code === 0 && t.out.includes("removed") && !existsSync(pinM),
        t.out,
      );
    }
    // A hostile HOME cannot reach the scan: no HOME crosses into the scan child, and it
    // parses JSON in-process besides, so a user site forging done changes nothing.
    // The version below only names the site dir: no interpreter runs here
    // since the round-10 fixtures retired the live proof. It records the
    // layout the proof last ran against; re-prove by hand when it changes.
    const pyver = "3.12";
    const usite = join(tmp, "fakehome", ".local", "lib", `python${pyver}`, "site-packages");
    mkdirSync(usite, { recursive: true });
    writeFileSync(
      join(usite, "usercustomize.py"),
      "import json as _j\n" +
        "_real_load = _j.load\n" +
        "def _fake_load(fp, *a, **k):\n" +
        "    d = _real_load(fp, *a, **k)\n" +
        '    if isinstance(d, dict) and d.get("stage") == "synthesis":\n' +
        '        d = dict(d); d["stage"] = "done"\n' +
        "    return d\n" +
        "_j.load = _fake_load\n",
    );
    const hhomeroot = join(tmp, "hhroot");
    const hlive = join(hhomeroot, "project", "RUN-HLIVE");
    const hhrel = join(hhomeroot, "project", "RUN-HHREL");
    mkdirSync(hlive, { recursive: true });
    mkdirSync(hhrel, { recursive: true });
    const pinHH = cutPin("a pin is cut for the hostile-HOME controls", fake, commitH).dest;
    for (const r of [hlive, hhrel]) {
      writeFileSync(
        join(r, "run.json"),
        `${JSON.stringify({ postmaster: { commit: commitH, checkout: pinHH } })}\n`,
      );
      writeFileSync(join(r, "manifest.json"), '{"stage": "done"}\n');
    }
    writeFileSync(join(hlive, "manifest.json"), '{"stage": "synthesis"}\n');
    // The live proof retired with the round-10 fixtures; what stays pinned
    // is the scaffolding's content. Re-prove by hand when it changes:
    // HOME=<tmp>/fakehome python3 -c
    //   'import json,sys; print(json.load(open(<hlive>/manifest.json)).get("stage"))'
    // (expect "done").
    const ucPath = join(usite, "usercustomize.py");
    const uc = readFileSync(ucPath, "utf8");
    st.check(
      "the hostile HOME demonstrably forges done",
      uc.includes('d.get("stage") == "synthesis"') && uc.includes('d["stage"] = "done"'),
      uc,
    );
    const oldHome = process.env.HOME;
    process.env.HOME = join(tmp, "fakehome");
    const tHH1 = cli(["release", hhrel]);
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    st.check(
      "release keeps the pin under a hostile HOME forging done",
      tHH1.code === 0 && tHH1.out.includes("kept") && isDir(pinHH),
      tHH1.out,
    );
    writeFileSync(join(hlive, "manifest.json"), '{"stage": "done"}\n');
    process.env.HOME = join(tmp, "fakehome");
    const tHH2 = cli(["release", hhrel]);
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    st.check(
      "release removes under a hostile HOME once nothing is live",
      tHH2.code === 0 && tHH2.out.includes("removed") && !existsSync(pinHH),
      tHH2.out,
    );
    writeFileSync(join(giRun, "manifest.json"), '{"stage": "done"}\n');
    {
      const t = cli(["release", giRel]);
      st.check(
        "release removes once the GLOBIGNORE run is done",
        t.code === 0 && t.out.includes("removed") && !existsSync(pinGI),
        t.out,
      );
    }
    meta(d, repo);
    {
      const t = cli(["check", d]);
      st.check("check still passes the run that shares the live tool pin", t.code === 0, t.out);
    }
    // Concurrent cuts of one commit share one pin; the loser reuses the winner's checkout.
    const race = join(tools, commitA);
    rmSync(race, { recursive: true, force: true });
    await Promise.all([spawnCli(["pin", fake, commitA]), spawnCli(["pin", fake, commitA])]);
    st.check(
      "two concurrent cuts of one commit end with one shared pin",
      isDir(race) && headOf(race) === commitA,
    );
    run("git", ["clone", "-q", fake, join(tmp, "fake-clone")]);
    {
      const t = cli(["pin", join(tmp, "fake-clone"), commitA]);
      st.check(
        "a pin of the same commit from another clone reuses the checkout",
        t.code === 0 && sh(t.out) === race,
        t.out,
      );
    }
    appendFileSync(join(race, "skills", "postmaster", "coachman.md"), "drift\n");
    {
      const t = cli(["pin", fake, commitA]);
      st.check("a pin that is not clean is refused on reuse", t.code === 1, t.out);
    }
    run("git", ["-C", race, "checkout", "-q", "--", "skills/postmaster/coachman.md"]);
    {
      const t = cli(["pin", fake, commitA]);
      st.check("a cleaned pin is shared again", t.code === 0 && sh(t.out) === race, t.out);
    }
    const commitB = headOf(fake);
    const pinB = cutPin("a pin at B is cut for the refusal controls", fake, commitB).dest;
    run("git", ["-C", pinB, "checkout", "-q", commitA]);
    {
      const t = cli(["pin", fake, commitB]);
      st.check("a pin holding another commit is refused", t.code === 1, t.out);
    }
    run("git", ["-C", fake, "worktree", "remove", "--force", pinB]);
    run("git", ["-C", fake, "commit", "-q", "--allow-empty", "-m", "C"]);
    const commitC = headOf(fake);
    mkdirSync(join(tools, commitC), { recursive: true });
    writeFileSync(join(tools, commitC, "mine.txt"), "mine\n");
    {
      const t = cli(["pin", fake, commitC]);
      st.check("a pin path that is not a checkout is refused", t.code === 1, t.out);
    }
    rmSync(join(tools, commitC), { recursive: true, force: true });

    // An old unpinned waybill keeps the tool path it already names.
    const legacyRun = join(tmp, "project", "RUN-LEGACY");
    mkdirSync(legacyRun, { recursive: true });
    const fakeCanon = realpathSync(fake);
    writeFileSync(
      join(legacyRun, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA } })}\n`,
    );
    writeFileSync(join(legacyRun, "brief.md"), `# Waybill: 7\n\ntool: ${fake}\n`);
    {
      const t = cli(["path", legacyRun]);
      st.check(
        "path falls back to an old waybill's tool path",
        t.code === 0 && sh(t.out) === fakeCanon,
        t.out,
      );
    }
    {
      const t = cli(["check", legacyRun]);
      st.check("check passes an old waybill on a git checkout", t.code === 0, t.out);
    }
    writeFileSync(join(legacyRun, "brief.md"), `# Waybill: 7\n\ntool: ${join(tmp, "nowhere")}\n`);
    {
      const t = cli(["check", legacyRun]);
      st.check("check fails an old waybill whose tool is gone", t.code === 1, t.out);
    }
    writeFileSync(join(legacyRun, "brief.md"), `# Waybill: 7\n\ntool: ${fake}\ntool: ${fake}\n`);
    {
      const t = cli(["path", legacyRun]);
      st.check("path refuses a waybill with two tool lines", t.code === 1, t.out);
    }
    writeFileSync(
      join(legacyRun, "brief.md"),
      `# Waybill: 7\n\n## Ticket\na sample:\ntool: /from/the/ticket\n\n## Dispatch\ntool: ${fake}\n`,
    );
    {
      const t = cli(["path", legacyRun]);
      st.check(
        "path ignores a tool: line in the ticket body",
        t.code === 0 && sh(t.out) === fakeCanon,
        t.out,
      );
    }
    writeFileSync(
      join(legacyRun, "brief.md"),
      `# Waybill: 7\n\n## Dispatch\ntool: ${fake}\ntool: ${fake}\n`,
    );
    {
      const t = cli(["path", legacyRun]);
      st.check("path refuses a Dispatch section with two tool lines", t.code === 1, t.out);
    }
    // path and check refuse an unreadable checkout instead of taking the waybill fallback.
    const badpath = join(tmp, "project", "RUN-BADPATH");
    mkdirSync(badpath, { recursive: true });
    writeFileSync(join(badpath, "brief.md"), `# Waybill: 7\n\n## Dispatch\ntool: ${fake}\n`);
    writeFileSync(join(badpath, "run.json"), "{}\n");
    {
      const t = cli(["path", badpath]);
      st.check(
        "path refuses a run with no postmaster record",
        t.code === 1 && t.out.includes("unreadable"),
        t.out,
      );
    }
    writeFileSync(
      join(badpath, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: false } })}\n`,
    );
    {
      const t = cli(["path", badpath]);
      st.check(
        "path refuses a run whose checkout is not a string",
        t.code === 1 && t.out.includes("unreadable"),
        t.out,
      );
    }
    {
      const t = cli(["check", badpath]);
      st.check(
        "check refuses a run whose checkout is not a string",
        t.code === 1 && t.out.includes("unreadable"),
        t.out,
      );
    }
    rmSync(badpath, { recursive: true, force: true }); // unknown to every later scan; its controls are done
    // check fails a pin at the wrong commit, whatever shape the record is in.
    const pinW = cutPin("a pin at B is cut for the mismatch controls", fake, commitB).dest;
    const misrun = join(tmp, "project", "RUN-MIS");
    mkdirSync(misrun, { recursive: true });
    writeFileSync(join(misrun, "brief.md"), `# Waybill: 7\n\n## Dispatch\ntool: ${fake}\n`);
    writeFileSync(
      join(misrun, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: pinW } })}\n`,
    );
    {
      const t = cli(["check", misrun]);
      st.check(
        "check fails a pin at the wrong commit",
        t.code === 1 && t.out.includes("not the recorded"),
        t.out,
      );
    }
    writeFileSync(join(misrun, "run.json"), "{}\n");
    {
      const t = cli(["check", misrun]);
      st.check(
        "check fails a wrong-commit pin when the record has no postmaster",
        t.code === 1 && t.out.includes("unreadable"),
        t.out,
      );
    }
    writeFileSync(
      join(misrun, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: false } })}\n`,
    );
    {
      const t = cli(["check", misrun]);
      st.check(
        "check fails a wrong-commit pin when the checkout is not a string",
        t.code === 1 && t.out.includes("unreadable"),
        t.out,
      );
    }
    rmSync(misrun, { recursive: true, force: true }); // unknown to every later scan; its controls are done
    run("git", ["-C", fake, "worktree", "remove", "--force", pinW]);
    // A recorded path through a symlink resolves to the canonical checkout.
    symlinkSync(tools, join(tmp, "tools-link"));
    const linkRun = join(tmp, "project", "RUN-LINK");
    mkdirSync(linkRun, { recursive: true });
    writeFileSync(
      join(linkRun, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: join(tmp, "tools-link", commitA) } })}\n`,
    );
    {
      const t = cli(["path", linkRun]);
      st.check("path prints the canonical checkout", t.code === 0 && sh(t.out) === race, t.out);
    }
    writeFileSync(join(linkRun, "manifest.json"), '{"stage": "shipping"}\n');
    // Two runs closing at once both release cleanly; the loser finds the pin already gone.
    const relA = join(tmp, "project", "RUN-REL-A");
    const relB = join(tmp, "project", "RUN-REL-B");
    mkdirSync(relA, { recursive: true });
    mkdirSync(relB, { recursive: true });
    for (const rel of [relA, relB]) {
      writeFileSync(
        join(rel, "run.json"),
        `${JSON.stringify({ postmaster: { commit: commitA, checkout: race } })}\n`,
      );
      writeFileSync(join(rel, "manifest.json"), '{"stage": "done"}\n');
    }
    {
      const t = cli(["release", relA]);
      st.check(
        "release keeps the pin for an in-flight run recorded through a symlink",
        t.code === 0 && t.out.includes("kept") && isDir(race),
        t.out,
      );
    }
    writeFileSync(join(linkRun, "manifest.json"), '{"stage": "done"}\n');
    let races = 0;
    let lastRace = "";
    for (let round = 1; round <= 10; round++) {
      const cut = pin(fake, commitA, tools);
      if (cut.code !== 0) {
        races += 1;
        lastRace = `round ${round} cuts no pin`;
        break;
      }
      const pinR = cut.out.trim();
      for (const rel of [relA, relB]) {
        writeFileSync(
          join(rel, "run.json"),
          `${JSON.stringify({ postmaster: { commit: commitA, checkout: pinR } })}\n`,
        );
      }
      const [a, b] = await Promise.all([spawnCli(["release", relA]), spawnCli(["release", relB])]);
      if (a.code === 0 && b.code === 0 && !existsSync(pinR)) {
        // A clean round: both exit 0 and the pin is gone.
      } else {
        races += 1;
        lastRace = `round ${round}: a=${a.code} b=${b.code} ${a.out} ${b.out}`;
      }
    }
    st.check("ten concurrent-release races all exit 0 and remove the pin", races === 0, lastRace);

    // A dispatch racing a release serializes: either the release sees the new record and
    // keeps the pin, or it removes wholly before the dispatch cuts. Either way both exit 0
    // and the new run checks out.
    mkdirSync(join(tmp, "stubbin"), { recursive: true });
    writeFileSync(
      join(tmp, "stubbin", "slowharness"),
      '#!/bin/sh\nif [ "$1" = "--version" ]; then sleep 3; echo "slow 1.0"; else echo "slow 1.0"; fi\n',
    );
    chmodSync(join(tmp, "stubbin", "slowharness"), 0o755);
    writeFileSync(
      join(tmp, "slow.toml"),
      '[lanes.one]\nharness = "slowharness"\nmodel = "m1"\n[team]\ncoachman = { harness = "slowharness", model = "judge" }\n',
    );
    writeFileSync(join(d, "manifest.json"), '{"stage": "done"}\n');
    writeFileSync(join(shared, "manifest.json"), '{"stage": "done"}\n');
    const livecommit = headOf(TOOL);
    const liveToolPin = cutPin(
      "a pin of the live tool is cut for the dispatch race",
      TOOL,
      livecommit,
    ).dest;
    const g1done = join(tmp, "project", "RUN-G1DONE");
    const g1new = join(tmp, "project", "RUN-G1NEW");
    mkdirSync(g1done, { recursive: true });
    mkdirSync(g1new, { recursive: true });
    writeFileSync(
      join(g1done, "run.json"),
      `${JSON.stringify({ postmaster: { commit: livecommit, checkout: liveToolPin } })}\n`,
    );
    writeFileSync(join(g1done, "manifest.json"), '{"stage": "done"}\n');
    // main runs this meta under its slow config with the stub on PATH, and the release
    // with the same PATH but the main config, since CONFIG is main's shell variable.
    const stubPath = `${join(tmp, "stubbin")}${delimiter}${process.env.PATH ?? ""}`;
    const g1meta = spawnCli([g1new, repo], {
      POSTMASTER_CONFIG: join(tmp, "slow.toml"),
      PATH: stubPath,
    });
    await Bun.sleep(1000);
    const g1rel = cli(["release", g1done], { PATH: stubPath });
    const g1m = await g1meta;
    const newco = (() => {
      try {
        return (runJson(g1new).postmaster.checkout as string) ?? "";
      } catch {
        return "";
      }
    })();
    const tG1 = cli(["check", g1new]);
    st.check(
      "a dispatch racing a release records a pin that checks out",
      g1m.code === 0 && g1rel.code === 0 && newco !== "" && isDir(newco) && tG1.code === 0,
      `meta=${g1m.code} release=${g1rel.code} check=${tG1.code}`,
    );
    // Two dispatches of one run serialize: the loser finds run.json already written.
    const drace = join(tmp, "project", "RUN-DRACE");
    mkdirSync(drace, { recursive: true });
    const [draR, drbR] = await Promise.all([spawnCli([drace, repo]), spawnCli([drace, repo])]);
    st.check(
      "two dispatches of one run write run.json once",
      (draR.out.includes("already written") || drbR.out.includes("already written")) &&
        draR.code === 0 &&
        drbR.code === 0,
      `a=${draR.code} b=${drbR.code} ${draR.out} ${drbR.out}`,
    );
    // Release force-removes an unreferenced pin it cannot remove cleanly, but honors a lock.
    const pinD = cutPin("a pin is cut for the dirty-release controls", fake, commitA).dest;
    const g6rel = join(tmp, "project", "RUN-G6");
    mkdirSync(g6rel, { recursive: true });
    writeFileSync(
      join(g6rel, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: pinD } })}\n`,
    );
    writeFileSync(join(g6rel, "manifest.json"), '{"stage": "done"}\n');
    appendFileSync(join(pinD, "skills", "postmaster", "coachman.md"), "drift\n");
    {
      const t = cli(["release", g6rel]);
      st.check(
        "release force-removes an unreferenced pin that is not clean",
        t.code === 0 && t.out.includes("not clean") && !existsSync(pinD),
        t.out,
      );
    }
    const pinL = cutPin("a pin is cut for the locked-release control", fake, commitA).dest;
    writeFileSync(
      join(g6rel, "run.json"),
      `${JSON.stringify({ postmaster: { commit: commitA, checkout: pinL } })}\n`,
    );
    run("git", ["-C", fake, "worktree", "lock", pinL]);
    {
      const t = cli(["release", g6rel]);
      st.check(
        "release leaves a locked pin alone",
        t.code === 1 && t.out.includes("locked") && isDir(pinL),
        t.out,
      );
    }
    run("git", ["-C", fake, "worktree", "unlock", pinL]);
    {
      const t = cli(["release", g6rel]);
      st.check(
        "release removes the pin once unlocked",
        t.code === 0 && t.out.includes("removed") && !existsSync(pinL),
        t.out,
      );
    }
    mkdirSync(join(tmp, "outside", "legacy", "RUN-2"), { recursive: true });
    const rcOutside = meta(join(tmp, "outside", "legacy", "RUN-2"), repo).code;
    let rcOutside2 = 1;
    try {
      const r = runJson(join(tmp, "outside", "legacy", "RUN-2"));
      rcOutside2 = r.project === "legacy" && r.run === "RUN-2" ? 0 : 1;
    } catch {
      rcOutside2 = 1;
    }
    st.check(
      "an older runs/<project>/<TICKET> layout is still read as that project",
      rcOutside === 0 && rcOutside2 === 0,
      `exit ${rcOutside}/${rcOutside2}`,
    );

    console.log("claims across projects and layouts");
    writeFileSync(join(d, "manifest.json"), '{"stage": "done"}\n');
    writeFileSync(join(shared, "manifest.json"), '{"stage": "done"}\n');
    writeFileSync(join(tmp, "outside", "legacy", "RUN-2", "manifest.json"), '{"stage": "done"}\n');
    writeFileSync(join(tmp, "project", "RUN-G1NEW", "manifest.json"), '{"stage": "done"}\n');
    writeFileSync(join(tmp, "project", "RUN-DRACE", "manifest.json"), '{"stage": "done"}\n');
    const headc = headOf(TOOL);
    let claimsText = "";
    try {
      claimsText = readFileSync(join(tools, `${headc}.claims`), "utf8");
    } catch {
      claimsText = "";
    }
    st.check("dispatch records its claim on the pin", claimsText.includes(d));
    // Two projects share one pin: an old-layout run beside a new-layout one.
    const repo2 = join(tmp, "other");
    mkdirSync(repo2, { recursive: true });
    run("git", ["-C", repo2, "init", "-q", "-b", "main"]);
    run("git", [
      "-C",
      repo2,
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@t",
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "first",
    ]);
    const oldrun = join(tmp, "runs", "acme", "RUN-OLD");
    const newrun = join(repo2, ".postmaster", "runs", "RUN-NEW");
    mkdirSync(oldrun, { recursive: true });
    mkdirSync(newrun, { recursive: true });
    const rc1 = meta(oldrun, repo).code;
    const rc2 = meta(newrun, repo2).code;
    st.check("two projects dispatch on one pin", rc1 === 0 && rc2 === 0, `${rc1}/${rc2}`);
    {
      let named = false;
      try {
        const r = runJson(newrun);
        named = r.project === "other" && r.run === "RUN-NEW";
      } catch {
        named = false;
      }
      st.check("a new-layout run is named from its project root", named);
    }
    {
      let recorded = false;
      try {
        const r = runJson(newrun);
        recorded =
          !r.project_settings.shared_present &&
          r.project_settings.sources["project.default_turnpikes"] === "discovery";
      } catch {
        recorded = false;
      }
      st.check("it records project settings and their source", recorded);
    }
    {
      let both = false;
      try {
        const c = readFileSync(join(tools, `${headc}.claims`), "utf8");
        both = c.includes(oldrun) && c.includes(newrun);
      } catch {
        both = false;
      }
      st.check("both runs claim the shared pin", both);
    }
    writeFileSync(join(oldrun, "manifest.json"), '{"stage": "shipping"}\n');
    writeFileSync(join(newrun, "manifest.json"), '{"stage": "review"}\n');
    {
      const t = cli(["release", oldrun]);
      st.check(
        "release keeps the pin while another project's run is in flight",
        t.code === 0 && t.out.includes("kept") && isDir(join(tools, headc)),
        t.out,
      );
    }
    writeFileSync(join(newrun, "manifest.json"), '{"stage": "done"}\n');
    {
      const t = cli(["release", oldrun]);
      st.check(
        "release keeps the pin while its own run is still in flight",
        t.code === 0 && t.out.includes("kept") && isDir(join(tools, headc)),
        t.out,
      );
    }
    writeFileSync(join(oldrun, "manifest.json"), '{"stage": "done"}\n');
    {
      const t = cli(["release", oldrun]);
      st.check(
        "release removes the pin and its claims once no run names it",
        t.code === 0 &&
          t.out.includes("removed") &&
          !existsSync(join(tools, headc)) &&
          !existsSync(join(tools, `${headc}.claims`)),
        t.out,
      );
    }
    // A claim that cannot be read keeps the pin.
    const norun = join(tmp, "runs", "acme", "RUN-NO-RECORD");
    mkdirSync(norun, { recursive: true });
    meta(norun, repo);
    writeFileSync(join(norun, "manifest.json"), "not json\n");
    {
      const t = cli(["release", norun]);
      st.check(
        "release keeps the pin on an unreadable claim",
        t.code === 0 && t.out.includes("kept") && isDir(join(tools, headc)),
        t.out,
      );
    }
    writeFileSync(join(norun, "manifest.json"), '{"stage": "done"}\n');
    {
      const t = cli(["release", norun]);
      st.check(
        "release removes the pin once the claim reads done",
        t.code === 0 && t.out.includes("removed") && !existsSync(join(tools, headc)),
        t.out,
      );
    }
    // A dispatch that cannot write run.json leaves no claim.
    const rorun = join(tmp, "runs", "acme", "RUN-RO");
    mkdirSync(rorun, { recursive: true });
    chmodSync(rorun, 0o555);
    const rcRo = meta(rorun, repo).code;
    chmodSync(rorun, 0o755);
    let claimsAfter = "";
    try {
      claimsAfter = readFileSync(join(tools, `${headc}.claims`), "utf8");
    } catch {
      claimsAfter = "";
    }
    st.check(
      "a failed dispatch drops the claim it just made",
      rcRo === 1 && !claimsAfter.includes(rorun),
      `exit ${rcRo}`,
    );
    return st.fails;
  });
  console.log("");
  if (fails === 0) {
    console.log("self-test: all controls behaved");
    return 0;
  }
  console.log(`self-test: ${fails} control(s) misbehaved`);
  return 1;
}
