// Take the steps that need no judgment, and wait until a run under a project's run root needs
// the postmaster. Then print runs-status.sh's table, name each run that needs it with its NEXT,
// and exit. This is the loop Stage D keeps in the background. A session that improvises this
// look loses it on a restart and fires on runs it must leave alone.
//
//   runs-watch.sh <project-run-root> [--timeout <seconds>]
//   runs-watch.sh --help
//
// Mechanical steps this script takes itself, logging each through log-action.sh with "the
// watcher took it" in the detail:
//
//   DISPATCH  the leg is done and its hand-off passes handoff-check.sh: dispatch the next leg
//             turnpikes.sh legs lists (Stage C). A hand-off that fails, a turnpikes.sh legs
//             that exits non-zero, no next leg after the ship leg, or a launch it cannot
//             complete are steps it could not complete: they wake the postmaster.
//   REMOUNT   the leg's process ended on a transient provider error the harness adapter names
//             (launch.sh transient, reading only the current launch's stream lines past the
//             skip in <run>/watcher.json): resume it on its own thread with the remount
//             prompt, at most three times per leg (the count is beside the skip and survives
//             a restart). A fourth such end, a non-transient end (quota, wall, launch refusal,
//             no thread id), or a resume it cannot complete wakes the postmaster.
//
// Everything that needs judgment still wakes the postmaster: RULE (an escalation), GATE (a
// ship card), READ (a checkpoint card), INSPECT (a stall), and any step the watcher could not
// complete. USER (already put to the user), WAIT (a leg at work) and - (closed) never do.
//
// It looks at once, then every postmaster.poll_seconds (default 120) from the config
// (POSTMASTER_CONFIG overrides the path). A run listed in <runs>/postmaster/held, one ticket
// per line, is never touched: hold a run by writing its ticket there exactly as the RUN column
// shows it, and release it by removing the line. A held line that matches no run warns on
// stderr. The held list and the config are read on every look, and the held list is re-read
// immediately before every mutation, so a hold takes effect without restarting the watcher.
// A hold that lands mid-step aborts the step: silently before its first mutation, and by
// waking the postmaster with the partial state after one.
// A missing config, or a poll interval that is not usable, gets the default, 120 seconds,
// which it says; an unset one is silent.
//
// With --timeout, a look that finds nothing for that many seconds prints the table and exits 3;
// the timeout counts the seconds it has slept, so a clock set forward does not end the wait
// early. A count or a timeout is at most 9 digits. Without --timeout it waits until a run needs
// the postmaster. Taking a step does not reset the timeout.
//
// POSTMASTER_WATCH_TEST_MODE stages the host boundary for the tests: with it set to 1,
// launches are recorded under POSTMASTER_WATCH_TEST_CALLS instead of started, the stream is
// faked, and the marker is cleared but never landed, so no agent thread is ever started.
// POSTMASTER_WATCH_TEST_FAIL=dispatch|resume makes that launch fail; =1 on
// POSTMASTER_WATCH_TEST_REFUSE lands a launch refusal instead: =1 a bare refusal,
// =2 a refusal under an uncapped host notice; =1 on
// POSTMASTER_WATCH_TEST_NO_THREAD fakes a stream with no thread id.
//
//   exit 0  a run needs the postmaster: the table, then one `needs <run> <NEXT>` line each
//   exit 3  --timeout passed with nothing to act on: the table
//   exit 1  usage, no such root, the held list cannot be read, or a timeout
//           that is not a whole number
//
// Controls: every step it takes (dispatch taken, resume taken) and every NEXT that must wake
// the postmaster names its run on exit 0 (positive), and WAIT, USER, -, and a held run leave
// it waiting until its timeout (negative). A held run is left alone entirely: no step, no
// count, no wake.
import { randomBytes } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tryJsonFile } from "./lib/data.ts";
import { beside, scriptsDir, toolRoot } from "./lib/paths.ts";
import { die, run } from "./lib/proc.ts";

const USAGE = "usage: runs-watch.sh <project-run-root> [--timeout <seconds>] | --help";

function printHelp(): never {
  const src = readFileSync(join(scriptsDir(import.meta), "runs-watch.ts"), "utf8");
  for (const l of src.split("\n")) {
    if (!l.startsWith("//")) break;
    console.log(l.replace(/^\/\/ ?/u, ""));
  }
  process.exit(0);
}

// --- Python %r for a TOML value, as the poll-seconds diagnostics print it --------------------
const CF_RANGES: Array<readonly [number, number]> = [
  [0xad, 0xad],
  [0x600, 0x605],
  [0x61c, 0x61c],
  [0x6dd, 0x6dd],
  [0x70f, 0x70f],
  [0x8e2, 0x8e2],
  [0x180e, 0x180e],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2064],
  [0x2066, 0x206f],
  [0xfeff, 0xfeff],
  [0xfff9, 0xfffb],
  [0x110bd, 0x110bd],
  [0x110cd, 0x110cd],
  [0x13430, 0x13438],
  [0x1bca0, 0x1bca3],
  [0x1d173, 0x1d17a],
  [0xe0001, 0xe0001],
  [0xe0020, 0xe007f],
  [0xe0100, 0xe01ef],
  [0xe0fff, 0xe0fff],
];

/** Non-printables Python escapes beyond the C0/C1 controls: format chars and separators. */
function isPyNonPrintable(cp: number): boolean {
  if (cp === 0x2028 || cp === 0x2029) return true;
  if (cp >= 0xd800 && cp <= 0xdfff) return true;
  for (const [lo, hi] of CF_RANGES) if (cp >= lo && cp <= hi) return true;
  return false;
}

/** Python repr of a string: single quotes unless it holds ' but no ". */
function pyStrRepr(s: string): string {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = q;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === q) out += `\\${q}`;
    else if (ch === "\t") out += "\\t";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f))
      out += `\\x${cp.toString(16).padStart(2, "0")}`;
    else if (isPyNonPrintable(cp)) {
      out +=
        cp <= 0xffff
          ? `\\u${cp.toString(16).padStart(4, "0")}`
          : `\\U${cp.toString(16).padStart(8, "0")}`;
    } else out += ch;
  }
  return out + q;
}

const EXP_RE = /^([0-9])(?:\.([0-9]+))?e([+-][0-9]+)$/u;

/** Python repr of a float: shortest digits (which toExponential gives), fixed
 * while 1e-4 <= |v| < 1e16, scientific with a 2-digit exponent otherwise. */
function pyFloatRepr(v: number): string {
  if (Number.isNaN(v)) return "nan";
  if (v === Infinity) return "inf";
  if (v === -Infinity) return "-inf";
  if (v === 0) return Object.is(v, -0) ? "-0.0" : "0.0";
  const sign = v < 0 ? "-" : "";
  const m = EXP_RE.exec(Math.abs(v).toExponential())!;
  const digits = `${m[1]}${m[2] ?? ""}`;
  const exp = parseInt(m[3]!, 10);
  const point = exp + 1;
  if (point >= -3 && point <= 16) {
    if (point <= 0) return `${sign}0.${"0".repeat(-point)}${digits}`;
    if (point >= digits.length) return `${sign}${digits}${"0".repeat(point - digits.length)}.0`;
    return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
  }
  const mant = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits[0]!;
  const e = Math.abs(exp);
  return `${sign}${mant}e${exp < 0 ? "-" : "+"}${e < 10 ? `0${e}` : `${e}`}`;
}

/** A time's trailing args as datetime.time/repr prints them: zeros elided. */
function pyTimeArgs(h: number, mi: number, s: number, ms: number, us: number, ns: number): string {
  const totalUs = ms * 1000 + us + Math.floor(ns / 1000);
  if (totalUs !== 0) return `${h}, ${mi}, ${s}, ${totalUs}`;
  if (s !== 0) return `${h}, ${mi}, ${s}`;
  return `${h}, ${mi}`;
}

interface PollLiteral {
  kind: "int" | "non-int" | "unknown";
  token: string | null;
}

const UNKNOWN_LITERAL: PollLiteral = { kind: "unknown", token: null };

/** Python %r of a TOML number. The literal scan says whether an integral value
 * came from an int (exact digits, however huge) or a float like 8.0. */
function pyNumRepr(v: number, lit: PollLiteral): string {
  if (lit.kind === "non-int") return pyFloatRepr(v);
  if (lit.kind === "int" && lit.token !== null) {
    return String(BigInt(lit.token.replace(/_/gu, "").replace(/^\+/u, "")));
  }
  if (Number.isInteger(v)) return String(v);
  return pyFloatRepr(v);
}

function pyRepr(v: unknown, lit: PollLiteral = UNKNOWN_LITERAL): string {
  if (typeof v === "string") return pyStrRepr(v);
  if (typeof v === "number") return pyNumRepr(v, lit);
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "bigint") return String(v);
  if (Array.isArray(v)) return `[${v.map((e) => pyRepr(e)).join(", ")}]`;
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, any>;
    const ctor = (v as object).constructor?.name;
    if (ctor === "PlainDate") return `datetime.date(${o.year}, ${o.month}, ${o.day})`;
    if (ctor === "PlainTime") {
      return `datetime.time(${pyTimeArgs(o.hour, o.minute, o.second, o.millisecond, o.microsecond, o.nanosecond)})`;
    }
    if (ctor === "PlainDateTime") {
      return `datetime.datetime(${o.year}, ${o.month}, ${o.day}, ${pyTimeArgs(o.hour, o.minute, o.second, o.millisecond, o.microsecond, o.nanosecond)})`;
    }
    if (ctor === "Instant") {
      // An offset datetime: Bun keeps the instant, not the offset, so this is
      // the UTC form where Python would keep the original offset.
      const ns = o.epochNanoseconds;
      const msNum =
        typeof ns === "bigint" ? Number(ns / 1000000n) : (o.epochMilliseconds as number);
      const us = typeof ns === "bigint" ? Number((ns / 1000n) % 1000000n) : 0;
      const d = new Date(msNum);
      return `datetime.datetime(${d.getUTCFullYear()}, ${d.getUTCMonth() + 1}, ${d.getUTCDate()}, ${d.getUTCHours()}, ${d.getUTCMinutes()}${d.getUTCSeconds() !== 0 || us !== 0 ? `, ${d.getUTCSeconds()}${us !== 0 ? `, ${us}` : ""}` : ""}, tzinfo=datetime.timezone.utc)`;
    }
    if (ctor !== "Object" && ctor !== undefined) return String(v);
    const parts: string[] = [];
    for (const [k, val] of Object.entries(v)) parts.push(`${pyStrRepr(k)}: ${pyRepr(val)}`);
    return `{${parts.join(", ")}}`;
  }
  return String(v);
}

// --- the poll_seconds literal: int or not -------------------------------------------------
// Bun parses 8.0 and 1e3 to integral numbers, where tomllib keeps them floats
// and the shell rejects them. The scan below re-reads the literal: it runs on a
// document Bun already accepted, and anything it cannot prove is "unknown",
// which trusts Bun. Only the postmaster table counts, however it is written.
const INT_TOKEN_RE = /^(?:[+-]?[0-9][0-9_]*|0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+)$/u;
const POLL_LHS_V = /^[ \t]*(?:"poll_seconds"|'poll_seconds'|poll_seconds)[ \t]*=[ \t]*(.*)$/u;
const DOTTED_LHS_V =
  /^[ \t]*postmaster[ \t]*\.[ \t]*(?:"poll_seconds"|'poll_seconds'|poll_seconds)[ \t]*=[ \t]*(.*)$/u;
const TOP_INLINE = /^[ \t]*postmaster[ \t]*=[ \t]*\{(.*)$/u;
const INLINE_POLL =
  /(?:^|,)[ \t]*(?:"poll_seconds"|'poll_seconds'|poll_seconds)[ \t]*=[ \t]*([^,}]*)/u;
const POLL_LHS = /^[ \t]*(?:"poll_seconds"|'poll_seconds'|poll_seconds)[ \t]*=/u;
const DOTTED_LHS =
  /^[ \t]*postmaster[ \t]*\.[ \t]*(?:"poll_seconds"|'poll_seconds'|poll_seconds)[ \t]*=/u;

/** The closer's index, or -1: in a basic string a closer behind an odd run of
 * backslashes is escaped, in a literal string the first one always closes. */
function findCloser(line: string, from: number, q: string): number {
  if (q === "'''") return line.indexOf(q, from);
  let i = line.indexOf(q, from);
  while (i >= 0) {
    let bs = 0;
    for (let j = i - 1; j >= from && line[j] === "\\"; j--) bs++;
    if (bs % 2 === 0) return i;
    i = line.indexOf(q, i + 1);
  }
  return -1;
}

interface CodePart {
  before: string;
  mlOpen: string | null;
}

/** The line up to its comment, strings skipped so a # or = inside one cannot
 * confuse the scan; mlOpen when it opens an unterminated multiline string. */
function codePart(line: string): CodePart {
  let i = 0;
  let inBasic = false;
  let inLit = false;
  while (i < line.length) {
    const ch = line[i]!;
    if (inBasic) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === '"') inBasic = false;
      i++;
      continue;
    }
    if (inLit) {
      if (ch === "'") inLit = false;
      i++;
      continue;
    }
    if (ch === "#") return { before: line.slice(0, i), mlOpen: null };
    if (ch === '"') {
      if (line.startsWith('"""', i)) {
        const end = findCloser(line, i + 3, '"""');
        if (end < 0) return { before: line.slice(0, i), mlOpen: '"""' };
        i = end + 3;
        continue;
      }
      inBasic = true;
      i++;
      continue;
    }
    if (ch === "'") {
      if (line.startsWith("'''", i)) {
        const end = line.indexOf("'''", i + 3);
        if (end < 0) return { before: line.slice(0, i), mlOpen: "'''" };
        i = end + 3;
        continue;
      }
      inLit = true;
      i++;
      continue;
    }
    i++;
  }
  return { before: line, mlOpen: null };
}

/** The [table] a header line names, quotes stripped; "" is the top level. */
function headerName(t: string): string {
  let inner = t.slice(1);
  const close = inner.lastIndexOf("]");
  if (close >= 0) inner = inner.slice(0, close);
  inner = inner.trim();
  if (inner.startsWith("[") && inner.endsWith("]")) inner = inner.slice(1, -1).trim();
  if (
    inner.length >= 2 &&
    ((inner.startsWith('"') && inner.endsWith('"')) ||
      (inner.startsWith("'") && inner.endsWith("'")))
  ) {
    inner = inner.slice(1, -1);
  }
  return inner;
}

/** Whether the code assigns postmaster.poll_seconds in this section. */
function isPollLhs(before: string, section: string): boolean {
  if (section === "postmaster") return POLL_LHS.test(before);
  if (section === "") return DOTTED_LHS.test(before);
  return false;
}

/** The assigned value's text, or null when the line assigns nothing of interest. */
function pollValue(t: string, section: string): string | null {
  if (section === "postmaster") {
    const m = POLL_LHS_V.exec(t);
    return m === null ? null : (m[1] ?? "").trim();
  }
  if (section !== "") return null;
  const m = DOTTED_LHS_V.exec(t);
  if (m !== null) return (m[1] ?? "").trim();
  const im = TOP_INLINE.exec(t);
  if (im === null) return null;
  const inner = im[1] ?? "";
  if (inner.includes("{")) return null;
  const am = INLINE_POLL.exec(inner);
  return am === null ? null : (am[1] ?? "").trim();
}

function classifyToken(v: string): PollLiteral {
  if (/^["'[{]/u.test(v) || /^[A-Za-z]/u.test(v)) return { kind: "non-int", token: null };
  const tok = /^[+-]?[0-9][0-9a-zA-Z_+:.~-]*/u.exec(v)?.[0] ?? "";
  if (INT_TOKEN_RE.test(tok)) return { kind: "int", token: tok };
  return { kind: "non-int", token: null };
}

function pollLiteral(text: string): PollLiteral {
  let section = "";
  let ml: string | null = null;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (ml !== null) {
      // Inside a multiline string only its closer matters; the line assigns nothing.
      if (findCloser(line, 0, ml) >= 0) ml = null;
      continue;
    }
    const code = codePart(line);
    if (code.mlOpen !== null) {
      // A line opening a multiline string assigns a string, never an int.
      if (isPollLhs(code.before, section)) return { kind: "non-int", token: null };
      ml = code.mlOpen;
      continue;
    }
    const t = code.before.trim();
    if (t.startsWith("[")) {
      section = headerName(t);
      continue;
    }
    const v = pollValue(t, section);
    if (v !== null && v !== "") return classifyToken(v);
  }
  return UNKNOWN_LITERAL;
}

// --- the config's poll interval -------------------------------------------------------------
function isPlainTable(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** The config's postmaster.poll_seconds, or the default, 120, which it says. */
function pollSeconds(configPath: string): number {
  const fallback = (msg: string): number => {
    console.error(msg);
    return 120;
  };
  let bytes: Buffer;
  try {
    bytes = readFileSync(configPath);
  } catch (e: any) {
    if (e?.code === "ENOENT") {
      return fallback(
        `runs-watch: no config at ${configPath}; the poll interval is the default, 120s`,
      );
    }
    return fallback(
      `runs-watch: cannot read ${configPath} (${e?.message ?? e}); the poll interval is the default, 120s`,
    );
  }
  // A byte-order mark is not valid TOML to tomllib (Bun's parser and the
  // decoder below both swallow it, so the bytes are checked first).
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return fallback(
      `runs-watch: cannot read ${configPath} (Invalid statement (at line 1, column 1)); the poll interval is the default, 120s`,
    );
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (e: any) {
    return fallback(
      `runs-watch: cannot read ${configPath} (${e?.message ?? e}); the poll interval is the default, 120s`,
    );
  }
  let cfg: Record<string, unknown>;
  try {
    cfg = Bun.TOML.parse(text);
  } catch (e: any) {
    return fallback(
      `runs-watch: cannot read ${configPath} (${e?.message ?? e}); the poll interval is the default, 120s`,
    );
  }
  const pm: unknown = "postmaster" in cfg ? cfg.postmaster : {};
  if (!isPlainTable(pm)) {
    return fallback(
      `runs-watch: postmaster is ${pyRepr(pm)}, not a table; the poll interval is the default, 120s`,
    );
  }
  if (!("poll_seconds" in pm)) return 120;
  const ps: unknown = pm.poll_seconds;
  if (typeof ps !== "number") {
    return fallback(
      `runs-watch: postmaster.poll_seconds is ${pyRepr(ps)}, not a whole number of seconds from 1 to 999999999; the poll interval is the default, 120s`,
    );
  }
  if (!Number.isInteger(ps)) {
    return fallback(
      `runs-watch: postmaster.poll_seconds is ${pyFloatRepr(ps)}, not a whole number of seconds from 1 to 999999999; the poll interval is the default, 120s`,
    );
  }
  const lit = pollLiteral(text);
  if (lit.kind === "non-int") {
    return fallback(
      `runs-watch: postmaster.poll_seconds is ${pyFloatRepr(ps)}, not a whole number of seconds from 1 to 999999999; the poll interval is the default, 120s`,
    );
  }
  if (ps < 1 || ps > 999999999) {
    const shown =
      lit.kind === "int" && lit.token !== null
        ? String(BigInt(lit.token.replace(/_/gu, "").replace(/^\+/u, "")))
        : String(ps);
    return fallback(
      `runs-watch: postmaster.poll_seconds is ${shown}, not a whole number of seconds from 1 to 999999999; the poll interval is the default, 120s`,
    );
  }
  return ps;
}

// --- the held list ----------------------------------------------------------------------------
/** The held tickets, one per line; nothing when no held file. */
function tryReadHeld(pmDir: string): string | null {
  let names: string[];
  try {
    names = readdirSync(pmDir);
  } catch (e: any) {
    if (e?.code === "ENOENT") {
      let link = false;
      try {
        lstatSync(pmDir);
        link = true;
      } catch {
        link = false;
      }
      if (link) console.error(`runs-watch: cannot read ${pmDir} (dangling link)`);
      else return "";
      return null;
    }
    console.error(`runs-watch: cannot read ${pmDir} (${e?.message ?? e})`);
    return null;
  }
  if (!names.includes("held")) return "";
  const p = join(pmDir, "held");
  let isFile = false;
  try {
    isFile = statSync(p).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) {
    console.error(`runs-watch: cannot read ${p} (not a regular file)`);
    return null;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(p));
  } catch (e: any) {
    console.error(`runs-watch: cannot read ${p} (${e?.message ?? e})`);
    return null;
  }
}

function readHeld(pmDir: string): string {
  const text = tryReadHeld(pmDir);
  if (text === null) process.exit(1);
  return text;
}

/** Refresh the held list immediately before a step: 0 held, 1 not held, 2 unreadable. */
function isHeldRun(wanted: string, pmDir: string): 0 | 1 | 2 {
  const text = tryReadHeld(pmDir);
  if (text === null) return 2;
  for (const raw of text.split("\n")) {
    if (raw.replace(/^[ \t]+|[ \t]+$/gu, "") === wanted) return 0;
  }
  return 1;
}

function markNeeds(needs: string[], runName: string, next: string, reason?: string): void {
  needs.push(`needs ${runName} ${next}`);
  if (reason) console.error(`runs-watch: ${runName} ${next}: ${reason}`);
}

// --- the waking runs ----------------------------------------------------------------------------
/** awk's fields: edge spaces and tabs stripped, runs split. */
function awkFields(line: string): string[] {
  const t = line.replace(/^[ \t]+|[ \t]+$/gu, "");
  return t === "" ? [] : t.split(/[ \t]+/u);
}

interface Waking {
  needs: string[];
  warnings: string[];
}

/** `needs <run> <NEXT>` per waking run; a held line matching no run warns. */
function wakingRuns(table: string, heldText: string): Waking {
  const hold: string[] = [];
  const holdSet = new Set<string>();
  for (const raw of heldText.split("\n")) {
    const h = raw.replace(/^[ \t]+|[ \t]+$/gu, "");
    if (h !== "" && !holdSet.has(h)) {
      holdSet.add(h);
      hold.push(h);
    }
  }
  const needs: string[] = [];
  const seen = new Set<string>();
  for (const line of table.split("\n")) {
    const f = awkFields(line);
    if (f.length > 0 && f[0] === "POSTMASTER") continue;
    if (f.length > 0 && f[0] === "RUN" && f[f.length - 1] === "NEXT") continue;
    if (f.length < 2) continue;
    const first = f[0]!;
    seen.add(first);
    const last = f[f.length - 1]!;
    if (last === "USER" || last === "WAIT" || last === "-") continue;
    if (holdSet.has(first)) continue;
    needs.push(`needs ${first} ${last}`);
  }
  const warnings: string[] = [];
  for (const h of hold) {
    if (!seen.has(h)) warnings.push(`runs-watch: held "${h}" matches no run`);
  }
  return { needs, warnings };
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// --- the watcher's mechanical steps -----------------------------------------------------------
/** The repo in the waybill's own Project profile, the last one, after the ticket. */
function repoFromBrief(dispatch: string): string {
  let waybill: string;
  try {
    waybill = readFileSync(join(dispatch, "brief.md"), "utf8");
  } catch {
    return "";
  }
  const starts: number[] = [];
  const re = /^## Project profile[ \t]*$/gmu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(waybill)) !== null) starts.push(m.index + m[0].length);
  if (starts.length === 0) return "";
  const body = waybill.slice(starts[starts.length - 1]!);
  const end = /^## /mu.exec(body);
  const scope = end ? body.slice(0, end.index) : body;
  const rm = /^repo:[ \t]*([^ \t].*?)(?:[ \t]{2,}[^ \t].*)?[ \t]*$/mu.exec(scope);
  return rm ? (rm[1] ?? "").trim() : "";
}

/** The repo the run recorded at dispatch. */
function repoFromChecks(dispatch: string): string {
  const d = tryJsonFile<Record<string, unknown>>(join(dispatch, "checks.json"));
  const repo = (d as Record<string, unknown> | null)?.repo;
  return typeof repo === "string" && repo.trim() !== "" ? repo.trim() : "";
}

/** The target repo, from the waybill or the recorded checks. */
function runRepo(dispatch: string): string | null {
  const brief = repoFromBrief(dispatch);
  if (brief.startsWith("/")) return brief;
  const checks = repoFromChecks(dispatch);
  if (checks.startsWith("/")) return checks;
  return null;
}

/** The one-line job from coachman.md's legs table. */
function legJob(number: string): string | null {
  let text: string;
  try {
    text = readFileSync(join(toolRoot(import.meta), "skills/postmaster/coachman.md"), "utf8");
  } catch {
    return null;
  }
  for (const line of text.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .trim()
      .replace(/^\|+/u, "")
      .replace(/\|+$/u, "")
      .split("|")
      .map((c) => c.trim());
    if (cells.length !== 4 || cells[0] !== number) continue;
    const [name, covers, ends] = [cells[1]!, cells[2]!, cells[3]!].map((v) => v.replace(/`/gu, ""));
    return `Your ${name} leg covers ${covers}; it ends with ${ends}.`;
  }
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Write JSON atomically, through a temp file in the same directory. */
function writeJsonAtomic(path: string, value: unknown): boolean {
  const tmp = join(dirname(path), `.watcher.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
    renameSync(tmp, path);
    return true;
  } catch {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // best effort
    }
    return false;
  }
}

/** Set the active leg and its coachman record. */
function manifestLeg(dispatch: string, number: string, thread: string): boolean {
  const path = join(dispatch, "manifest.json");
  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`runs-watch: cannot read ${path}: ${(e as Error)?.message ?? e}`);
    return false;
  }
  if (!isRecord(manifest)) {
    console.error(`runs-watch: ${path} is not a JSON object`);
    return false;
  }
  try {
    if (!("coachman" in manifest)) manifest.coachman = {};
    const coachman = manifest.coachman;
    if (!isRecord(coachman)) throw new Error("coachman.legs is not an object");
    if (!("legs" in coachman)) coachman.legs = {};
    const legs = coachman.legs;
    if (!isRecord(legs)) throw new Error("coachman.legs is not an object");
    if (!(number in legs)) legs[number] = {};
    const entry = legs[number];
    if (!isRecord(entry)) throw new Error("coachman.legs is not an object");
    manifest.leg = parseInt(number, 10);
    entry.name = "coachman";
    if (thread) entry.thread_id = thread;
    else delete entry.thread_id;
  } catch (e) {
    console.error(`runs-watch: cannot update ${path}: ${(e as Error)?.message ?? e}`);
    return false;
  }
  if (!writeJsonAtomic(path, manifest)) {
    console.error(`runs-watch: cannot write ${path}: the temp file could not be installed`);
    return false;
  }
  return true;
}

/** A persisted watcher.json table value: the count, or the skip, defaulting to 0. */
function watcherValue(dispatch: string, table: string, leg: string): number | null {
  const path = join(dispatch, "watcher.json");
  if (!existsSync(path)) return 0;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    console.error(`runs-watch: cannot read ${path}: ${(e as Error)?.message ?? e}`);
    return null;
  }
  if (!isRecord(data)) {
    console.error(`runs-watch: cannot read ${path}: not an object`);
    return null;
  }
  const counts = data[table];
  if (!isRecord(counts)) {
    console.error(`runs-watch: cannot read ${path}: ${table} is not an object`);
    return null;
  }
  const value = leg in counts ? counts[leg] : 0;
  if (
    typeof value === "boolean" ||
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    console.error(
      `runs-watch: cannot read ${path}: invalid ${table === "resume_attempts" ? "count" : "skip"}`,
    );
    return null;
  }
  return value;
}

/** Atomically persist the count and the stream lines the next launch starts after. */
function setResumeCount(
  dispatch: string,
  leg: string,
  count: number,
  skip: number | null,
): boolean {
  const path = join(dispatch, "watcher.json");
  let data: unknown = {};
  if (existsSync(path)) {
    try {
      data = JSON.parse(readFileSync(path, "utf8"));
    } catch (e) {
      console.error(`runs-watch: cannot update ${path}: ${(e as Error)?.message ?? e}`);
      return false;
    }
  }
  if (!isRecord(data)) {
    console.error(`runs-watch: cannot update ${path}: not an object`);
    return false;
  }
  const counts = data.resume_attempts ?? {};
  if (!isRecord(counts)) {
    console.error(`runs-watch: cannot update ${path}: resume_attempts is not an object`);
    return false;
  }
  data.resume_attempts = counts;
  counts[leg] = count;
  if (skip !== null) {
    const skips = data.stream_skip ?? {};
    if (!isRecord(skips)) {
      console.error(`runs-watch: cannot update ${path}: stream_skip is not an object`);
      return false;
    }
    data.stream_skip = skips;
    skips[leg] = skip;
  }
  if (!writeJsonAtomic(path, data)) {
    console.error(`runs-watch: cannot write ${path}: the temp file could not be installed`);
    return false;
  }
  return true;
}

// bash's printf %q, as the test double records the launch it would run: bare
// words stay bare, anything else printable is backslash-escaped, printable
// non-ASCII passes through raw, and a word holding a control character is
// ANSI-C quoted whole, short escapes where bash has them, octal elsewhere.
const Q_SAFE_CH = /[A-Za-z0-9_@%+=:./~-]/u;
function hasControlChar(s: string): boolean {
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}
function bashQuote(s: string): string {
  if (s === "") return "''";
  if (hasControlChar(s)) {
    let o = "$'";
    for (const ch of s) {
      const code = ch.codePointAt(0)!;
      if (ch === "\\") o += "\\\\";
      else if (ch === "'") o += "\\'";
      else if (code === 0x07) o += "\\a";
      else if (code === 0x08) o += "\\b";
      else if (code === 0x09) o += "\\t";
      else if (code === 0x0a) o += "\\n";
      else if (code === 0x0b) o += "\\v";
      else if (code === 0x0c) o += "\\f";
      else if (code === 0x0d) o += "\\r";
      else if (code === 0x1b) o += "\\E";
      else if (code < 0x20 || code === 0x7f) o += `\\${code.toString(8).padStart(3, "0")}`;
      else o += ch;
    }
    return `${o}'`;
  }
  const body = s.startsWith("~") || s.startsWith("#") ? s.slice(1) : s;
  let o = body === s ? "" : `\\${s[0]!}`;
  for (const ch of body) {
    const code = ch.codePointAt(0)!;
    o += code > 0x7e || Q_SAFE_CH.test(ch) ? ch : `\\${ch}`;
  }
  return o;
}

/** Run the host boundary, or record the launch the test double would run. */
function watchHost(
  kind: string,
  name: string,
  cwd: string,
  dispatch: string,
  out: string,
  err: string,
  marker: string,
  append: boolean,
  launch: string[],
): number {
  const command = ["run", name, cwd, "--role", "coachman", "--run", dispatch];
  if (append) command.push("--append");
  command.push("--out", out, "--err", err, "--marker", marker, "--", ...launch);
  if (process.env.POSTMASTER_WATCH_TEST_MODE === "1") {
    const calls = process.env.POSTMASTER_WATCH_TEST_CALLS;
    if (!calls) return 1;
    const dot = marker.lastIndexOf(".leg-");
    let legKey = dot >= 0 ? marker.slice(dot + 5) : marker;
    if (legKey.endsWith("-exited")) legKey = legKey.slice(0, -7);
    const callfile = join(calls, `${kind}-${basename(dispatch)}-${legKey}`);
    try {
      mkdirSync(calls, { recursive: true });
      mkdirSync(dirname(out), { recursive: true });
      mkdirSync(dirname(err), { recursive: true });
    } catch {
      return 1;
    }
    try {
      writeFileSync(
        callfile,
        `kind=${kind}\nname=${name}\ncwd=${cwd}\ndispatch=${dispatch}\nout=${out}\nerr=${err}\nmarker=${marker}\nappend=${append ? 1 : 0}\nhost_command=${command.map((w) => `${bashQuote(w)} `).join("")}\ncommand=${launch.map((w) => `${bashQuote(w)} `).join("")}\n`,
      );
    } catch {
      return 1;
    }
    rmSync(marker, { force: true });
    // host.sh run empties --err at every launch, resume included: --append
    // keeps only --out. The double does the same: .err always holds
    // one launch, so no stale line can survive into the refusal check.
    try {
      writeFileSync(err, "");
    } catch {
      return 1;
    }
    if (process.env.POSTMASTER_WATCH_TEST_FAIL === kind) {
      try {
        writeFileSync(err, `host: simulated ${kind} failure\n`);
        writeFileSync(marker, "");
      } catch {
        // best effort
      }
      return 1;
    }
    if (process.env.POSTMASTER_WATCH_TEST_REFUSE === "1") {
      try {
        writeFileSync(err, "launch: simulated refusal\n");
        writeFileSync(marker, "");
      } catch {
        // best effort
      }
      return 0;
    }
    if (process.env.POSTMASTER_WATCH_TEST_REFUSE === "2") {
      try {
        writeFileSync(
          err,
          "host: launch running uncapped (no supported per-launch limits available)\nlaunch: simulated refusal\n",
        );
        writeFileSync(marker, "");
      } catch {
        // best effort
      }
      return 0;
    }
    try {
      if (kind === "dispatch") {
        writeFileSync(
          out,
          process.env.POSTMASTER_WATCH_TEST_NO_THREAD === "1"
            ? '{"type":"result","message":"no session id"}\n'
            : '{"session_id":"watch-fixture-thread"}\n',
        );
      } else {
        writeFileSync(out, '{"type":"assistant","message":"continued"}\n', { flag: "a" });
      }
    } catch {
      return 1;
    }
    return 0;
  }
  const r = run(beside(import.meta, "host.sh"), command);
  if (r.out) process.stdout.write(r.out);
  if (r.err) process.stderr.write(r.err);
  return r.code;
}

export function noThreadError(
  leg: string,
  marker: string,
  limit: number,
  errPath: string,
  outPath: string,
  adapterOut: string,
): string {
  const extra = adapterOut ? ` (${adapterOut})` : "";
  if (existsSync(marker)) {
    return `the launch produced no thread id for leg ${leg}; read ${errPath} and ${outPath}${extra}`;
  }
  return `the launch produced no thread id within ${limit}s for leg ${leg} and may still be running; read ${errPath} and ${outPath}${extra}`;
}

/** The stream's line count, counting an unterminated last line, which wc -l misses. */
export function streamLines(path: string): number {
  let text: string;
  try {
    if (!statSync(path).isFile()) return 0;
    text = readFileSync(path, "utf8");
  } catch {
    return 0;
  }
  if (text === "") return 0;
  const parts = text.split("\n");
  return parts.length - (text.endsWith("\n") ? 1 : 0);
}

/** The launch: refusal line this launch wrote, if any. */
function refusalIn(path: string): string {
  let text: string;
  try {
    if (!statSync(path).isFile()) return "";
    text = readFileSync(path, "utf8");
  } catch {
    return "";
  }
  for (const line of text.split("\n")) {
    if (line.startsWith("launch:")) return line;
  }
  return "";
}

/** Print the thread id once the stream carries it. */
export function harvestThreadId(out: string, marker: string, limit: number): string | null {
  for (let i = 0; i < limit; i++) {
    const r = run(beside(import.meta, "launch.sh"), ["thread-id", out]);
    const id = r.out.replace(/\n+$/u, "");
    if (r.code === 0 && id !== "") return id;
    if (existsSync(marker)) return null;
    sleepSync(1000);
  }
  return null;
}

/** A UTC stamp as date -u +%Y%m%dT%H%M%SZ prints it. */
function utcStamp(): string {
  const d = new Date();
  const p = (n: number, w: number): string => String(n).padStart(w, "0");
  return `${p(d.getUTCFullYear(), 4)}${p(d.getUTCMonth() + 1, 2)}${p(d.getUTCDate(), 2)}T${p(d.getUTCHours(), 2)}${p(d.getUTCMinutes(), 2)}${p(d.getUTCSeconds(), 2)}Z`;
}

function isCanonicalLeg(current: string): boolean {
  return /^[1-9][0-9]*$/u.test(current);
}

interface StepResult {
  rc: number;
  error: string;
}

function listedLeg(list: string, current: string): string {
  for (const line of list.split("\n")) {
    const f = awkFields(line);
    if (f.length >= 2 && f[0] === current) return f[1]!;
  }
  return "";
}

function nextLeg(list: string, current: string): [string, string] | null {
  const n = parseInt(current, 10);
  for (const line of list.split("\n")) {
    const f = awkFields(line);
    if (f.length >= 1 && /^[0-9]+$/u.test(f[0]!) && parseInt(f[0]!, 10) > n) {
      return [f[0]!, f[1] ?? ""];
    }
  }
  return null;
}

/** Dispatch the next leg, or report why it could not. 0 took the step, 1 wakes, 3 held. */
function prepareDispatch(d: string, runName: string, current: string, root: string): StepResult {
  const heldDir = join(root, "postmaster");
  const legs = run(beside(import.meta, "turnpikes.sh"), ["legs", d]);
  if (legs.code !== 0) {
    return {
      rc: 1,
      error: `turnpikes.sh legs failed: ${(legs.out + legs.err).replace(/\n+$/u, "")}`,
    };
  }
  // The manifest leg is validated before anything uses it: it must be a canonical
  // integer and one of the run's listed legs. Anything else is reported as corrupt
  // and the run is skipped — never dispatched from, and never allowed near
  // arithmetic that would abort the whole watcher.
  if (!isCanonicalLeg(current)) {
    return {
      rc: 1,
      error: `manifest leg '${current}' is not a canonical integer; the run is corrupt`,
    };
  }
  if (!listedLeg(legs.out, current)) {
    return { rc: 1, error: `manifest leg ${current} is not a listed leg; the run is corrupt` };
  }
  const next = nextLeg(legs.out, current);
  if (!next) {
    return { rc: 1, error: "no later leg is listed; Stage G remains with the postmaster" };
  }
  const [number, leg] = next;
  const handoff = join(d, `handoff-${current}.md`);
  const check = run(beside(import.meta, "handoff-check.sh"), [handoff]);
  if (check.code !== 0) {
    return {
      rc: 1,
      error: `handoff check failed for ${handoff} (exit ${check.code}): ${(check.out + check.err).replace(/\n+$/u, "")}`,
    };
  }
  const repo = runRepo(d);
  if (!repo) {
    return {
      rc: 1,
      error: "neither the waybill nor the recorded checks name an absolute repo path",
    };
  }
  const worktree = join(repo, ".worktrees", runName);
  try {
    if (!statSync(worktree).isDirectory()) throw new Error("missing");
  } catch {
    return { rc: 1, error: `the synthesis worktree is missing: ${worktree}` };
  }
  const job = legJob(number);
  if (!job) return { rc: 1, error: `coachman.md has no job for leg ${number}` };
  // The Stage C name form names the new leg outright; a host.sh without role labels answers ticket and role.
  const named = run(beside(import.meta, "host.sh"), ["name", d, "coachman", leg, number]);
  if (named.code !== 0) {
    return {
      rc: 1,
      error: `host.sh name failed: ${(named.out + named.err).replace(/\n+$/u, "")}`,
    };
  }
  const hostName = named.out.replace(/\n+$/u, "");
  const prompt = join(d, `leg-${number}-prompt.txt`);
  const timeFile = `${prompt}.tmp.${process.pid}`;
  let held = isHeldRun(runName, heldDir);
  if (held === 0) return { rc: 3, error: "" };
  if (held !== 1) return { rc: 1, error: "cannot re-read the held list" };
  try {
    writeFileSync(
      timeFile,
      `You are the coachman for leg ${number} of ${runName}.\nRead ${d}/brief.md, then ${toolRoot(import.meta)}/skills/postmaster/coachman.md, then ${d}/handoff-${current}.md.\n${job}\n`,
    );
  } catch {
    return { rc: 1, error: `cannot write the leg prompt: ${prompt}` };
  }
  held = isHeldRun(runName, heldDir);
  if (held === 0) {
    rmSync(timeFile, { force: true });
    return { rc: 3, error: "" };
  }
  if (held !== 1) {
    rmSync(timeFile, { force: true });
    return { rc: 1, error: "cannot re-read the held list" };
  }
  try {
    renameSync(timeFile, prompt);
  } catch {
    return { rc: 1, error: `cannot install the leg prompt: ${prompt}` };
  }
  held = isHeldRun(runName, heldDir);
  if (held === 0) {
    return {
      rc: 1,
      error: `held mid-step after installing the leg ${number} prompt; the manifest and the launch are unchanged`,
    };
  }
  if (held !== 1) return { rc: 1, error: "cannot re-read the held list" };
  if (!manifestLeg(d, number, "")) {
    return { rc: 1, error: `could not record leg ${number} in manifest.json` };
  }
  const out = join(d, "logs", `coachman-leg-${number}-events.jsonl`);
  const err = join(d, "logs", `coachman-leg-${number}.err`);
  const marker = join(d, `.leg-${number}-exited`);
  held = isHeldRun(runName, heldDir);
  if (held === 0) {
    return {
      rc: 1,
      error: `held mid-step after recording leg ${number} in manifest.json with no launch and no thread`,
    };
  }
  if (held !== 1) return { rc: 1, error: "cannot re-read the held list" };
  const launched = watchHost("dispatch", hostName, worktree, d, out, err, marker, false, [
    beside(import.meta, "launch.sh"),
    "launch",
    "coachman",
    worktree,
    prompt,
    "--leg",
    leg,
    "--run",
    d,
  ]);
  if (launched !== 0) {
    return { rc: 1, error: `host.sh could not start coachman leg ${number}; read ${err}` };
  }
  const limit = process.env.POSTMASTER_WATCH_TEST_MODE === "1" ? 1 : 30;
  const thread = harvestThreadId(out, marker, limit);
  if (!thread) {
    const again = run(beside(import.meta, "launch.sh"), ["thread-id", out]);
    const adapterOut = (again.out + again.err).replace(/\n+$/u, "");
    return { rc: 1, error: noThreadError(number, marker, limit, err, out, adapterOut) };
  }
  if (!manifestLeg(d, number, thread)) {
    return { rc: 1, error: `could not record thread id for leg ${number}` };
  }
  if (parseInt(number, 10) > parseInt(current, 10) + 1) {
    const note = run(beside(import.meta, "log-action.sh"), [
      d,
      "postmaster",
      "note",
      runName,
      "turnpikes omit the review leg; the watcher followed the listed legs",
    ]);
    if (note.code !== 0) return { rc: 1, error: "could not log the omitted review leg" };
  }
  const logged = run(beside(import.meta, "log-action.sh"), [
    d,
    "postmaster",
    "dispatch",
    "coachman",
    `leg ${number}, thread ${thread}; the watcher took it`,
  ]);
  if (logged.code !== 0) return { rc: 1, error: `could not log dispatch of leg ${number}` };
  return { rc: 0, error: "" };
}

/** Resume the leg on its own thread. 0 took the step, 2 wakes, 3 held. */
function resumeTransient(d: string, runName: string, number: string, root: string): StepResult {
  const heldDir = join(root, "postmaster");
  const err = join(d, "logs", `coachman-leg-${number}.err`);
  const out = join(d, "logs", `coachman-leg-${number}-events.jsonl`);
  const legs = run(beside(import.meta, "turnpikes.sh"), ["legs", d]);
  if (legs.code !== 0) {
    return {
      rc: 2,
      error: `turnpikes.sh legs failed: ${(legs.out + legs.err).replace(/\n+$/u, "")}`,
    };
  }
  if (!isCanonicalLeg(number)) {
    return {
      rc: 2,
      error: `manifest leg '${number}' is not a canonical integer; the run is corrupt`,
    };
  }
  const leg = listedLeg(legs.out, number);
  if (!leg) return { rc: 2, error: `turnpikes.sh legs has no entry for current leg ${number}` };
  let name = "";
  let thread = "";
  try {
    const m: unknown = JSON.parse(readFileSync(join(d, "manifest.json"), "utf8"));
    if (!isRecord(m)) throw new Error("no manifest");
    const co = m.coachman;
    if (!isRecord(co)) throw new Error("no coachman");
    const legEntries = co.legs;
    if (!isRecord(legEntries)) throw new Error("no legs");
    const entry = number in legEntries ? legEntries[number] : {};
    if (!isRecord(entry)) throw new Error("no entry");
    name = entry.name === undefined ? "" : pyPrint(entry.name);
    thread = entry.thread_id === undefined ? "" : pyPrint(entry.thread_id);
  } catch {
    return { rc: 2, error: `cannot read coachman leg ${number} from manifest.json` };
  }
  if (name !== "coachman" && name !== "coachman_fallback") {
    return { rc: 2, error: `leg ${number} has no recorded coachman name` };
  }
  if (!thread) return { rc: 2, error: `leg ${number} has no recorded thread id` };
  const skip = watcherValue(d, "stream_skip", number);
  if (skip === null) return { rc: 2, error: `the stream skip for leg ${number} is unreadable` };
  const judged = run(beside(import.meta, "launch.sh"), ["transient", err, out, String(skip)]);
  const classifier = (judged.out + judged.err).replace(/\n+$/u, "") || `exit ${judged.code}`;
  if (judged.code !== 0) {
    return {
      rc: 2,
      error: `the leg is not eligible for automatic resume (adapter: ${classifier}); read ${err} and the stream tail`,
    };
  }
  const count = watcherValue(d, "resume_attempts", number);
  if (count === null) return { rc: 2, error: `the remount count for leg ${number} is unreadable` };
  if (count >= 3) {
    return {
      rc: 2,
      error: `leg ${number} ended on a transient provider error after three watcher resumes`,
    };
  }
  const repo = runRepo(d);
  if (!repo) {
    return {
      rc: 2,
      error: "neither the waybill nor the recorded checks name an absolute repo path",
    };
  }
  const worktree = join(repo, ".worktrees", runName);
  try {
    if (!statSync(worktree).isDirectory()) throw new Error("missing");
  } catch {
    return { rc: 2, error: `the synthesis worktree is missing: ${worktree}` };
  }
  const named = run(beside(import.meta, "host.sh"), ["name", d, "coachman", leg, number]);
  if (named.code !== 0) {
    return {
      rc: 2,
      error: `host.sh name failed: ${(named.out + named.err).replace(/\n+$/u, "")}`,
    };
  }
  const hostName = named.out.replace(/\n+$/u, "");
  let prompt = join(d, `leg-${number}-resume-${utcStamp()}.txt`);
  while (existsSync(prompt)) {
    const held = isHeldRun(runName, heldDir);
    if (held === 0) return { rc: 3, error: "" };
    if (held !== 1) return { rc: 2, error: "cannot re-read the held list" };
    sleepSync(1000);
    prompt = join(d, `leg-${number}-resume-${utcStamp()}.txt`);
  }
  let held = isHeldRun(runName, heldDir);
  if (held === 0) return { rc: 3, error: "" };
  if (held !== 1) return { rc: 2, error: "cannot re-read the held list" };
  try {
    writeFileSync(
      prompt,
      `Continue leg ${number}; your last written state is in the dispatch directory and the worktree.\n`,
    );
  } catch {
    return { rc: 2, error: `cannot write the remount prompt: ${prompt}` };
  }
  held = isHeldRun(runName, heldDir);
  if (held === 0) {
    return {
      rc: 2,
      error: `held mid-step after writing the remount prompt for leg ${number}; no count, no launch`,
    };
  }
  if (held !== 1) return { rc: 2, error: "cannot re-read the held list" };
  const newSkip = existsSync(out) ? streamLines(out) : 0;
  if (!setResumeCount(d, number, count + 1, newSkip)) {
    return { rc: 2, error: `cannot persist the remount count for leg ${number}` };
  }
  held = isHeldRun(runName, heldDir);
  if (held === 0) {
    return {
      rc: 2,
      error: `held mid-step after persisting resume ${count + 1} for leg ${number} with no launch`,
    };
  }
  if (held !== 1) return { rc: 2, error: "cannot re-read the held list" };
  const launchArgs = [
    beside(import.meta, "launch.sh"),
    "resume",
    name,
    worktree,
    thread,
    prompt,
    "--run",
    d,
  ];
  if (name === "coachman") launchArgs.push("--leg", leg);
  // The launch's outcome, the way the dispatch path harvests its own thread
  // id: a host that started the process does not mean the launch took it.
  // .err holds only this launch's errors, so the whole file is read.
  const resumed = watchHost(
    "resume",
    hostName,
    worktree,
    d,
    out,
    err,
    join(d, `.leg-${number}-exited`),
    true,
    launchArgs,
  );
  if (resumed !== 0) return { rc: 2, error: `host.sh could not resume leg ${number}; read ${err}` };
  const refusal = refusalIn(err);
  if (refusal) {
    // A refused resume is a refusal, not a success: the count is restored, no
    // success line is written, the refusal is logged, and the run is named in
    // this look. A refusal is deterministic, never retried on its own.
    if (!setResumeCount(d, number, count, newSkip)) {
      return { rc: 2, error: `cannot restore the remount count for leg ${number}` };
    }
    const logged = run(beside(import.meta, "log-action.sh"), [
      d,
      "postmaster",
      "refuse",
      "coachman",
      `leg ${number}, thread ${thread}, ${refusal}; the attempt was refused`,
    ]);
    if (logged.code !== 0) return { rc: 2, error: `could not log refusal of leg ${number}` };
    return {
      rc: 2,
      error: `launch.sh refused the resume of leg ${number} (${refusal}); read ${err}`,
    };
  }
  const logged = run(beside(import.meta, "log-action.sh"), [
    d,
    "postmaster",
    "resume",
    "coachman",
    `leg ${number}, thread ${thread}, ${classifier}, resume ${count + 1} of 3; the watcher took it`,
  ]);
  if (logged.code !== 0) return { rc: 2, error: `could not log resume of leg ${number}` };
  return { rc: 0, error: "" };
}

/** Python's print() for a manifest scalar, as the leg read joins it. */
function pyPrint(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  try {
    return JSON.stringify(v) ?? "";
  } catch {
    return "";
  }
}

/** The manifest's leg as the table read prints it: the value, or "" when unreadable. */
function manifestLegValue(manifestPath: string): string {
  try {
    const raw = readFileSync(manifestPath, "utf8");
    const m: unknown = JSON.parse(raw);
    if (!isRecord(m)) return "";
    const leg = m.leg;
    if (leg === undefined) return "";
    if (typeof leg === "string") return leg;
    if (typeof leg === "number") {
      // A float prints with its point; the raw token says whether it parsed as one.
      const tok = /"leg"[ \t\n\r]*:[ \t\n\r]*(-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/u.exec(
        raw,
      )?.[1];
      if (tok !== undefined && (tok.includes(".") || /[eE]/u.test(tok))) {
        return Number.isInteger(leg) ? `${String(leg)}.0` : String(leg);
      }
      return String(leg);
    }
    if (typeof leg === "bigint") return String(leg);
    if (leg === true) return "True";
    if (leg === false) return "False";
    if (leg === null) return "None";
    return JSON.stringify(leg) ?? "";
  } catch {
    return "";
  }
}

interface TableResult {
  needs: string[];
  heldUnreadable: boolean;
}

/** Take mechanical steps and fill NEEDS for the postmaster. */
function processTable(root: string, table: string): TableResult {
  const needs: string[] = [];
  for (const row of table.split("\n")) {
    const f = awkFields(row);
    const runName = f[0] ?? "";
    if (!runName || runName === "RUN" || runName === "POSTMASTER") continue;
    const next = f[f.length - 1] ?? "";
    const leg = manifestLegValue(join(root, runName, "manifest.json"));
    const held = isHeldRun(runName, join(root, "postmaster"));
    if (held === 0) continue;
    if (held !== 1) return { needs, heldUnreadable: true };
    if (next === "DISPATCH") {
      const r = prepareDispatch(join(root, runName), runName, leg, root);
      if (r.rc !== 0 && r.rc !== 3) markNeeds(needs, runName, "DISPATCH", r.error);
    } else if (next === "REMOUNT") {
      const r = resumeTransient(join(root, runName), runName, leg, root);
      if (r.rc === 0 || r.rc === 3) {
        // taken, or held before its first mutation
      } else markNeeds(needs, runName, "REMOUNT", r.error);
    } else if (next === "WAIT" || next === "USER" || next === "-") {
      // a leg at work, already put to the user, or closed: never wakes
    } else {
      markNeeds(needs, runName, next);
    }
  }
  return { needs, heldUnreadable: false };
}

/** The directory's physical path, as `cd -P -- dir && pwd -P` prints it:
 * symlinks resolved, `.` and `..` gone, no trailing slash, a leading `//`
 * kept. Bun's realpathSync mistakes `\` for a separator, so this resolves
 * component by component. Throws when there is no such directory. */
function physicalDir(path: string): string {
  const abs = path.startsWith("/") ? path : `${process.cwd()}/${path}`;
  let dbl = abs.startsWith("//") && !abs.startsWith("///");
  const parts = abs.split("/");
  const out: string[] = [];
  let links = 0;
  let i = 0;
  while (i < parts.length) {
    const part = parts[i]!;
    i++;
    if (part === "" || part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    const probe = out.length === 0 ? `/${part}` : `/${out.join("/")}/${part}`;
    let lst;
    try {
      lst = lstatSync(probe);
    } catch {
      throw new Error(`no such directory: ${path}`);
    }
    if (lst.isSymbolicLink()) {
      links++;
      if (links > 40) throw new Error(`too many levels of symbolic links: ${path}`);
      let target: string;
      try {
        target = readlinkSync(probe);
      } catch {
        throw new Error(`no such directory: ${path}`);
      }
      if (target.startsWith("/")) {
        out.length = 0;
        dbl = target.startsWith("//") && !target.startsWith("///");
      }
      parts.splice(i, 0, ...target.split("/"));
      continue;
    }
    out.push(part);
  }
  const resolved = out.length === 0 ? (dbl ? "//" : "/") : `${dbl ? "//" : "/"}${out.join("/")}`;
  try {
    if (!statSync(resolved).isDirectory()) throw new Error(`no such directory: ${path}`);
  } catch {
    throw new Error(`no such directory: ${path}`);
  }
  return resolved;
}

function watch(root: string, config: string, timeout: number | null): never {
  const pm = join(root, "postmaster");
  const statusSh = beside(import.meta, "runs-status.sh");
  let left = timeout ?? 0;
  for (;;) {
    const poll = pollSeconds(config);
    const held = readHeld(pm);
    let r = run(statusSh, [root]);
    if (r.code !== 0) {
      if (r.err) process.stderr.write(r.err);
      die(`runs-watch: runs-status.sh failed on ${root}`, 1);
    }
    const first = r.out.replace(/\n+$/u, "");
    // The waking read fires only for its held warnings; the steps below fill NEEDS.
    for (const w of wakingRuns(first, held).warnings) console.error(w);
    const steps = processTable(root, first);
    if (steps.heldUnreadable) die("runs-watch: could not read the held list", 1);
    r = run(statusSh, [root]);
    if (r.code !== 0) {
      if (r.err) process.stderr.write(r.err);
      die(`runs-watch: runs-status.sh failed on ${root}`, 1);
    }
    const table = r.out.replace(/\n+$/u, "");
    if (steps.needs.length > 0) {
      process.stdout.write(`${table}\n${steps.needs.join("\n")}\n`);
      process.exit(0);
    }
    if (timeout !== null && left <= 0) {
      process.stdout.write(`${table}\n`);
      process.exit(3);
    }
    const nap = timeout !== null ? Math.min(left, poll) : poll;
    sleepSync(nap * 1000);
    if (timeout !== null) left -= nap;
  }
}

// --- entry ------------------------------------------------------------------------------
/** This script's arguments as invoked: bun swallows one `--` right after the
 * script path, so the raw command line is re-read and everything past the
 * script entry is taken. Without /proc, or when the entry is not found,
 * bun's view stands. */
function rawArgv(): string[] {
  try {
    const raw = readFileSync("/proc/self/cmdline");
    const parts: string[] = [];
    let start = 0;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === 0) {
        parts.push(new TextDecoder().decode(raw.subarray(start, i)));
        start = i + 1;
      }
    }
    const here = import.meta.path;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === here || resolve(parts[i]!) === here) return parts.slice(i + 1);
    }
  } catch {
    /* fall through to bun's view */
  }
  return process.argv.slice(2);
}

if (import.meta.main) {
  const argv = rawArgv();

  if (argv[0] === "--help" || argv[0] === "-h") printHelp();

  let root = "";
  let timeoutStr: string | null = null;
  let i = 0;
  while (i < argv.length) {
    const a = argv[i]!;
    if (a === "--timeout") {
      if (i + 1 >= argv.length) die(USAGE, 1);
      const v = argv[i + 1]!;
      if (v === "") die("runs-watch: '' is not a whole number of seconds", 1);
      timeoutStr = v;
      i += 2;
    } else if (a.startsWith("-")) {
      die(USAGE, 1);
    } else {
      if (root !== "") die(USAGE, 1);
      root = a;
      i += 1;
    }
  }
  if (root === "") die(USAGE, 1);
  let timeout: number | null = null;
  if (timeoutStr !== null) {
    if (!/^[0-9]+$/u.test(timeoutStr)) {
      die(`runs-watch: '${timeoutStr}' is not a whole number of seconds`, 1);
    }
    const sig = timeoutStr.replace(/^0+/u, "");
    if (sig.length > 9) die(`runs-watch: '${timeoutStr}' is more than 9 digits`, 1);
    timeout = sig === "" ? 0 : parseInt(sig, 10);
  }
  try {
    root = physicalDir(root);
  } catch {
    // The shell assigns ROOT from a failing substitution, which empties it,
    // so the message names no root.
    die("runs-watch: no such root: ", 1);
  }
  const pc = process.env.POSTMASTER_CONFIG;
  const home = process.env.HOME;
  const config =
    pc !== undefined && pc !== ""
      ? pc
      : `${home !== undefined && home !== "" ? home : ""}/.postmaster/config.toml`;
  watch(root, config, timeout);
}
