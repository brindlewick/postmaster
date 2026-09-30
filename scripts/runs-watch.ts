// Wait until a run under a project's run root needs the postmaster, then print runs-status.sh's
// table, name each run that needs it with its NEXT, and exit. This is the loop Stage D keeps in
// the background: it reads runs, sleeps and prints, and nothing else. A session that improvises
// this look loses it on a restart and fires on runs it must leave alone.
//
//   runs-watch.sh <project-run-root> [--timeout <seconds>]
//   runs-watch.sh --help
//
// It looks at once, then every postmaster.poll_seconds (default 120) from the config
// (POSTMASTER_CONFIG overrides the path). A run needs the postmaster when its NEXT is anything
// but WAIT (a leg at work), USER (already put to the user) or - (closed). A run listed in
// <runs>/postmaster/held, one ticket per line, never does: hold a run by writing its ticket
// there exactly as the RUN column shows it, and release it by removing the line. A held line
// that matches no run warns on stderr. The held list and the config are read on every look,
// so a hold takes effect without restarting the watcher. A missing config, or a poll interval
// that is not usable, gets the default, 120 seconds, which it says; an unset one is silent.
//
// With --timeout, a look that finds nothing for that many seconds prints the table and exits 3;
// the timeout counts the seconds it has slept, so a clock set forward does not end the wait
// early. A count or a timeout is at most 9 digits. Without --timeout it waits until a run needs
// the postmaster.
//
//   exit 0  a run needs the postmaster: the table, then one `needs <run> <NEXT>` line each
//   exit 3  --timeout passed with nothing to act on: the table
//   exit 1  usage, no such root, the held list cannot be read, or a timeout
//           that is not a whole number
//
// Controls: every NEXT that must wake the postmaster names its run on exit 0 (positive), and
// WAIT, USER, -, and a held run leave it waiting until its timeout (negative).
import { lstatSync, readdirSync, readFileSync, readlinkSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { beside, scriptsDir } from "./lib/paths.ts";
import { die, run } from "./lib/proc.ts";

const USAGE = "usage: runs-watch.sh <project-run-root> [--timeout <seconds>] | --help";

function printHelp(): never {
  const src = readFileSync(join(scriptsDir(import.meta), "runs-watch.ts"), "utf8");
  for (const l of src.split("\n").slice(0, 30)) console.log(l.replace(/^\/\/ ?/u, ""));
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
function readHeld(pmDir: string): string {
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
      if (link) die(`runs-watch: cannot read ${pmDir} (dangling link)`, 1);
      return "";
    }
    die(`runs-watch: cannot read ${pmDir} (${e?.message ?? e})`, 1);
  }
  if (!names.includes("held")) return "";
  const p = join(pmDir, "held");
  let isFile = false;
  try {
    isFile = statSync(p).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) die(`runs-watch: cannot read ${p} (not a regular file)`, 1);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(p));
  } catch (e: any) {
    die(`runs-watch: cannot read ${p} (${e?.message ?? e})`, 1);
  }
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
    const r = run(statusSh, [root]);
    if (r.code !== 0) {
      if (r.err) process.stderr.write(r.err);
      die(`runs-watch: runs-status.sh failed on ${root}`, 1);
    }
    const table = r.out.replace(/\n+$/u, "");
    const { needs, warnings } = wakingRuns(table, held);
    for (const w of warnings) console.error(w);
    if (needs.length > 0) {
      process.stdout.write(`${table}\n${needs.join("\n")}\n`);
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
