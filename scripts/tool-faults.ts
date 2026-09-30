// Turn the faults a run met in postmaster itself into tickets on postmaster's own tracker, once
// the run has closed. A run never fixes postmaster: each fault is logged as it happens, as a
// `tool-fault` action (scripts/log-action.sh), and this script collects them afterwards.
//
//   tool-faults.sh harvest <dispatch>
//   tool-faults.sh comment <dispatch> <id> [<ticket>]
//   tool-faults.sh file <dispatch> <id>
//   tool-faults.sh decline <dispatch> <id> <word>
//   tool-faults.sh --self-test
//
//   exit 0  done; harvest prints a line for the run, then one per fault, then any notes
//   exit 1  usage; no such dispatch, fault or draft; a run still open; the tracker could not
//           be read or refused a write; or the log could not be written
//   exit 2  comment or file refused: a changed draft is not safe to publish, a draft fails
//           scripts/ticket-check.sh, a fault to comment on has no ticket, or one to file has one

import { createHash, randomBytes } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, posix, resolve, sep } from "node:path";
import { scriptsDir, toolRoot } from "./lib/paths.ts";
import { mkstempSync, run, withTempDir } from "./lib/proc.ts";
import { SelfTest } from "./lib/selftest.ts";
import {
  casefold,
  END_OR_BEFORE_NL,
  isDigit,
  isDigitChar,
  literalI,
  NAME_L,
  NAME_R,
  PY_DOT,
  PY_M_END,
  PY_M_START,
  PY_S_CLASS,
  pyRstrip,
  pySplitLines,
  pyTrim,
  pyWords,
  WORD_CHAR_RE,
  WORD_CLASS,
  WORD_RUN_RE,
} from "./lib/text.ts";

const HERE = scriptsDir(import.meta);
const TOOL = toolRoot(import.meta);
// text.ts: BOUND_R — BASE's trailing \b after the run id.
const DONE_RE =
  /^tool fault (tf-[0-9a-f]{8}) (filed|seen again|declined) in run ([0-9a-f]+)(?![\p{L}\p{N}_])/u;

// text.ts: BOUND_R — harvest-output normalizer for the self-test's
// BASE-vs-port comparisons (run ids end at a Unicode boundary).
function normRid(s: string): string {
  return s
    .replace(/(run )[0-9a-f]{10}(?![\p{L}\p{N}_])/gu, "$1RID")
    .replace(/(tool-faults\/)[0-9a-f]{10}/g, "$1RID");
}

// File-scope so the pattern-parity suite diffs these exact objects.
const TICKET_RE = /^#?\p{Nd}+$/u; // text.ts: BASE fullmatches #?\d+ in Unicode.
const STATE_RE = new RegExp(`${PY_M_START}state: ([^${PY_S_CLASS}]+)`, "m");
const RURL_M1 =
  /^[A-Za-z][A-Za-z0-9+.-]*:\/\/(?:[^@/]*@)?([^/:?#]+)(?::\p{Nd}+)?\/+([^\n]*?)(?:\.git)?\/?$/u;
const RURL_M2 = /^(?:[^@/:]+@)?([^/:]+):(?!\/\/)([^\n]*?)(?:\.git)?\/?$/;

function fidBoundaryRe(fid: string): RegExp {
  // text.ts: BASE's [\w-] lookarounds are Unicode; \w needs the \p spelling.
  return new RegExp(
    `(?<![\\p{L}\\p{N}_-])${fid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}_-])`,
    "u",
  );
}

// text.ts: BASE's re.M ^/$ split \n only; its \S and dots are Python's.
const PROFILE_HEAD_RE = new RegExp(`${PY_M_START}## Project profile[ \\t]*${PY_M_END}`, "gm");
const PROFILE_END_RE = new RegExp(`${PY_M_START}## `, "m");
const CONTROLS_VALUE_RE = /^[\p{L}\p{N}_-]+$/u; // text.ts: BASE's [\w-] is Unicode.
const PROFILE_REPO_RE = new RegExp(
  `${PY_M_START}repo:[ \\t]*([^${PY_S_CLASS}]${PY_DOT}*?)(?:[ \\t]{2,}[^${PY_S_CLASS}]${PY_DOT}*)?[ \\t]*${PY_M_END}`,
  "m",
);
const ASKING = new Set(["new", "asked", "unchecked", "kept"]);

function dieTF(msg: string, code = 1): never {
  console.error(`tool-faults: ${msg}`);
  process.exit(code);
  throw new Error("unreachable");
}

function sha256hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function newId(): string {
  while (true) {
    const rid = randomBytes(5).toString("hex");
    // ASCII: rid is machine hex (token_hex), so \d never meets Unicode.
    if (/\d/.test(rid)) return rid;
  }
}

function seen(n: number): string {
  return n === 1 ? "once" : `${n} times`;
}

function gitCmd(where: string, ...args: string[]): string {
  const r = run("git", ["-C", where, ...args]);
  // text.ts: BASE's git() strips Python whitespace.
  return r.code === 0 ? pyTrim(r.out) : "";
}

function whyR(r: { code: number; out: string; err: string }): string {
  // text.ts: BASE's why() is strip().splitlines()[-1].
  const lines = pySplitLines(pyTrim(r.err || r.out));
  return lines.length > 0 ? lines[lines.length - 1]! : `exit ${r.code}`;
}

function readLog(logPath: string): { entries: Array<Record<string, unknown>>; bad: number[] } {
  const entries: Array<Record<string, unknown>> = [];
  const bad: number[] = [];
  let text: string;
  try {
    text = readFileSync(logPath, "utf8");
  } catch {
    return { entries, bad };
  }
  const _str = Buffer.isBuffer(text) ? text.toString("utf-8") : String(text);
  // decode with replacement
  const decoded = Buffer.from(text as any).toString("utf-8");
  const lines = decoded.split("\n");
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n] ?? "";
    // text.ts: BASE skips lines blank under Python strip (split stays \n:
    // only a newline ends a line, on both sides).
    if (!pyTrim(line)) continue;
    try {
      const e = JSON.parse(line);
      if (e && typeof e === "object") entries.push(e as Record<string, unknown>);
      else bad.push(n + 1);
    } catch {
      bad.push(n + 1);
    }
  }
  return { entries, bad };
}

function fields(e: Record<string, unknown>): Record<string, string> {
  const f = e.fault;
  return f && typeof f === "object" ? (f as Record<string, string>) : {};
}

function tidy(text: string): string {
  // text.ts: BASE's " ".join(text.split()) splits Python whitespace.
  return pyWords(text).join(" ");
}

function clip(text: string, n: number): string {
  if (text.length <= n) return text;
  const cut = text.slice(0, n - 3);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;:]+$/, "")}...`;
}

// --- run helpers -------------------------------------------------------------------------------

interface RunR {
  code: number;
  out: string;
  err: string;
}

function runCmd(argv: string[]): RunR {
  const r = run(argv[0]!, argv.slice(1));
  return { code: r.code, out: r.out, err: r.err };
}

// --- state helpers -----------------------------------------------------------------------------

function closedCheck(d: string, ongoing: boolean): void {
  if (ongoing) return;
  let stage: string;
  try {
    const m = JSON.parse(readFileSync(join(d, "manifest.json"), "utf8"));
    stage = m.stage ?? "";
  } catch {
    dieTF(`${d} has no manifest to read`);
  }
  if (stage !== "done" && stage !== "abandoned") {
    dieTF(`the run is still open (stage ${stage}); its faults are harvested when it closes`);
  }
}

function loadState(statePath: string): Record<string, any> {
  try {
    const st = JSON.parse(readFileSync(statePath, "utf8"));
    return st && typeof st === "object" ? st : {};
  } catch {
    return {};
  }
}

function saveState(statePath: string, st: Record<string, any>): void {
  const tmp = mkstempSync(dirname(statePath), "tmp");
  writeFileSync(tmp, `${JSON.stringify(st, null, 2)}\n`);
  renameSync(tmp, statePath);
}

function postmasterRun(runJsonPath: string): Record<string, any> {
  try {
    const pm = JSON.parse(readFileSync(runJsonPath, "utf8")).postmaster;
    return pm && typeof pm === "object" ? pm : {};
  } catch {
    return {};
  }
}

function ownIds(st: Record<string, any>, runJsonPath: string): Set<string> {
  const commit = String(postmasterRun(runJsonPath).commit || "");
  const ids = new Set<string>();
  for (const r of st.runs || []) {
    if (r.run_id) ids.add(String(r.run_id));
  }
  if (commit) {
    ids.add(commit);
    ids.add(commit.slice(0, 12));
  }
  return ids;
}

function metaStr(runJsonPath: string): string {
  const pm = postmasterRun(runJsonPath);
  if (!pm.commit) return "";
  return `, which ran postmaster ${String(pm.commit).slice(0, 12)}${pm.uncommitted_changes ? " with uncommitted changes" : ""}`;
}

// --- whose repository is whose ------------------------------------------------------------------

function ownCheckout(): boolean {
  const top = gitCmd(TOOL, "rev-parse", "--show-toplevel");
  if (!top) return false;
  try {
    return realpathSync(top) === realpathSync(TOOL);
  } catch {
    return false;
  }
}

function commonDir(where: string): string {
  const out = gitCmd(where, "rev-parse", "--git-common-dir");
  if (!out || out.includes("\n")) return "";
  try {
    return realpathSync(join(where, out));
  } catch {
    return "";
  }
}

function remoteUrl(where: string): [string, string] | null {
  const url = gitCmd(where, "remote", "get-url", "origin");
  if (!url) return null;
  // text.ts: BASE's port is \d (Unicode); its dots bar only \n.
  const m1 = url.match(RURL_M1);
  const m2 = url.match(RURL_M2);
  const m = m1 || m2;
  // LOWER: BASE's own .lower() on the host, ported exactly, never folded.
  if (m?.[2]) return [m[1]?.toLowerCase(), m[2]!];
  return ["", url.replace(/\/+$/, "")];
}

function sameRepo(repo: string): boolean {
  if (!ownCheckout()) return false;
  const a = commonDir(repo);
  const b = commonDir(TOOL);
  if (a && a === b) return true;
  const ra = remoteUrl(repo);
  const rb = remoteUrl(TOOL);
  return !!(ra && rb && ra[0] && ra[0] === rb[0] && casefold(ra[1]) === casefold(rb[1]));
}

function profileRepo(waybill: string): string | null {
  const starts: number[] = [];
  PROFILE_HEAD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PROFILE_HEAD_RE.exec(waybill)) !== null) starts.push(m.index + m[0].length);
  if (starts.length === 0) return null;
  const body = waybill.slice(starts[starts.length - 1]!);
  const endM = PROFILE_END_RE.exec(body);
  const searchIn = endM ? body.slice(0, endM.index) : body;
  const rm = PROFILE_REPO_RE.exec(searchIn);
  // text.ts: BASE strips the group Python-style before expanduser.
  return rm ? resolve(pyTrim(rm[1]!).replace(/^~(?=\/|$)/, homedir())) : null;
}

// --- what may be published ----------------------------------------------------------------------

const TOKEN = /[~<>\p{L}\p{N}_.@+/-]+/gu;
// text.ts: \w is [\p{L}\p{N}_], \d is \p{Nd}, \b is the lookaround pair, all /u.
// text.ts: PY_S_CLASS — BASE's tail runs on Python \s, not JS \s.
const URL_RE = new RegExp(
  `(?<![\\p{L}\\p{N}_])[A-Za-z][A-Za-z0-9+.-]{0,30}:\\/\\/[^${PY_S_CLASS})\\]>'"\`]+`,
  "gu",
);
const EMAIL_RE = /(?<![\p{L}\p{N}_.+-])[\p{L}\p{N}_.+-]+@[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)+/gu;
const IPV4_RE = /(?<![\p{L}\p{N}_.])\p{Nd}{1,3}(?:\.\p{Nd}{1,3}){3}(?![\p{L}\p{N}_.])/gu;
const KEY_RE = /(?<![\p{L}\p{N}_-])[A-Z][A-Z0-9]{1,9}-\p{Nd}+(?![\p{L}\p{N}_-])/gu;
const FILELIKE = /[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)*\.[A-Za-z][\p{L}\p{N}_]{1,7}/u;
const FAULT_ID_RE = /(?<![\p{L}\p{N}_])tf-[0-9a-f]{8}(?![\p{L}\p{N}_])/gu;
const HEX_RE = /(?<![\p{L}\p{N}_])(?=[0-9a-f]*\p{Nd})[0-9a-f]{7,40}(?![\p{L}\p{N}_])/gu;
const MARK_RE = /\[(?:path|project|ticket text|ticket|code|link|address|withheld)\]/g;
const WORD_RE = new RegExp(`[${WORD_CLASS}]+(?:'[${WORD_CLASS}]+)*`, "gu");
const WTOK_RE = /[\p{L}\p{N}_]+/gu;
const TICKS_RE = /`([^`\n]+)`/g;
// ASCII: publish strips \x01/\x02 from input first, so only our own
// decimal holds reach this; BASE's twin matches the same ASCII.
// ASCII: placeholders are machine counters, and publish strips \x01/\x02 first.
const HELD_RE = /\x01(\d+)\x02/g;
const N = 4;

function wordsOf(text: string): string[] {
  return [...text.matchAll(WORD_RE)].map((m) => casefold(m[0]!));
}

function gramsOf(ws: string[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + N <= ws.length; i++) {
    out.add(ws.slice(i, i + N).join("\x00"));
  }
  return out;
}

class Safe {
  vocab: Set<string>;
  grams: Set<string>;
  tokens: Set<string>;
  paths: Set<string>;
  files: Set<string>;
  urls: Set<string>;
  keys: Set<string>;
  ids: Set<string>;
  names: RegExp | null;
  waybillWords: Set<string>;
  waybillGrams: Set<string>;

  constructor(ids: Iterable<string> = [], d: string, ongoing: boolean) {
    const files: string[] = [];
    for (const sub of ["scripts", "skills", "wiki"]) {
      const dir = join(TOOL, sub);
      if (existsSync(dir)) {
        for (const p of walkFiles(dir)) files.push(p);
      }
    }
    try {
      for (const p of readdirSync(TOOL)) {
        if (p.endsWith(".md")) files.push(join(TOOL, p));
      }
    } catch {
      /* empty */
    }
    files.push(join(TOOL, "config.example.toml"));
    const texts: string[] = [];
    for (const p of files) {
      try {
        texts.push(readFileSync(p, "utf-8"));
      } catch {
        /* empty */
      }
    }
    const own = texts.join("\n");
    const ws = wordsOf(own);
    this.vocab = new Set(ws);
    this.grams = gramsOf(ws);
    this.tokens = new Set([...own.matchAll(WTOK_RE)].map((m) => casefold(m[0]!)));
    const toks = [...own.matchAll(TOKEN)].map((m) => m[0]!);
    this.paths = new Set(toks.filter((t) => t.includes("/")).map((t) => casefold(t)));
    this.files = new Set(
      toks.filter((t) => FILELIKE.test(t) && FILELIKE.exec(t)?.[0] === t).map((t) => casefold(t)),
    );
    for (const p of files) this.files.add(casefold(basename(p)));
    this.urls = new Set(
      [...own.matchAll(URL_RE)].map((m) => casefold(m[0]!).replace(/[.,;:]+$/, "")),
    );
    this.keys = new Set([...own.matchAll(KEY_RE)].map((m) => m[0]!));
    this.ids = new Set(ids);
    let waybill = "";
    try {
      waybill = readFileSync(join(d, "brief.md"), "utf-8");
    } catch {
      /* empty */
    }
    const repo = profileRepo(waybill);
    const names = new Set<string>();
    if (repo && existsSync(repo) && sameRepo(repo)) {
      waybill = "";
    } else {
      names.add(basename(dirname(d)));
      if (!ongoing) names.add(basename(d));
      if (!ongoing) {
        // text.ts: \d is \p{Nd}, $ is END_OR_BEFORE_NL (BASE re.match, not fullmatch).
        const km = basename(d).match(
          // text.ts: END_OR_BEFORE_NL — BASE's match-anchored $ on the dir name.
          new RegExp(`^([A-Za-z][A-Za-z0-9]*)[-_]\\p{Nd}+${END_OR_BEFORE_NL}`, "u"),
        );
        if (km) names.add(km[1]!);
      }
      if (repo) {
        names.add(basename(repo));
        const r = existsSync(repo) ? remoteUrl(repo) : null;
        if (r?.[0]) {
          const parts = r[1].split("/").slice(-2);
          for (const p of parts) names.add(p);
        } else if (r) {
          names.add(basename(r[1]));
        }
      }
    }
    const sortedNames = [...names]
      .filter((n) => [...n].length >= 2 && !isDigit(n) && !this.vocab.has(casefold(n)))
      .sort((a, b) => b.length - a.length);
    // text.ts: [^\W_] is NAME_L/R (double negation: L+N, never _),
    // re.I is iu + literalI.
    this.names =
      sortedNames.length > 0
        ? new RegExp(`${NAME_L}(${sortedNames.map((n) => literalI(n)).join("|")})${NAME_R}`, "giu")
        : null;
    const wws = wordsOf(waybill);
    this.waybillWords = new Set(wws.filter((w) => !this.vocab.has(w)));
    this.waybillGrams = new Set([...gramsOf(wws)].filter((g) => !this.grams.has(g)));
  }

  ownPath(p: string): string | null {
    let q = p.startsWith("./") ? p.slice(2) : p;
    try {
      if (q.startsWith("/")) {
        const real = realpathSync(q);
        const root = realpathSync(TOOL);
        if (!real.startsWith(`${root}/`)) return null;
        q = real.slice(root.length + 1);
      }
      if (q && !q.startsWith("~") && !q.split("/").includes("..") && existsSync(join(TOOL, q))) {
        return posix.normalize(q);
      }
    } catch {
      return null;
    }
    return this.paths.has(casefold(p)) ? p : null;
  }

  publish(text: string): string {
    const held: string[] = [];
    const hold = (s: string): string => {
      held.push(s);
      return `\x01${held.length - 1}\x02`;
    };

    let t = text.replace(/\x01/g, "").replace(/\x02/g, "");
    t = t.replace(MARK_RE, (m) => hold(m));
    t = t.replace(FAULT_ID_RE, (m) => hold(m));
    t = t.replace(URL_RE, (m) =>
      hold(this.urls.has(casefold(m).replace(/[.,;:]+$/, "")) ? m : "[link]"),
    );
    t = t.replace(EMAIL_RE, () => hold("[address]"));
    t = t.replace(IPV4_RE, () => hold("[address]"));
    t = t.replace(TOKEN, (tok) => {
      const core = tok.replace(/[.,:]+$/, "");
      if (core.includes("/") && WORD_CHAR_RE.test(core)) {
        return hold(this.ownPath(core) || "[path]") + tok.slice(core.length);
      }
      if (FILELIKE.test(core) && FILELIKE.exec(core)?.[0] === core) {
        return hold(this.files.has(casefold(core)) ? core : "[path]") + tok.slice(core.length);
      }
      return tok;
    });
    t = t.replace(HEX_RE, (m) => (this.ids.has(m) ? hold(m) : m));
    t = t.replace(KEY_RE, (m) => hold(this.keys.has(m) ? m : "[ticket]"));
    if (this.names) {
      t = t.replace(this.names, () => hold("[project]"));
    }
    // waybill 4-gram word runs
    const spans = [...t.matchAll(WORD_RE)].map((m) => ({
      start: m.index!,
      end: m.index! + m[0].length,
      word: casefold(m[0]!),
    }));
    const hide = new Set<number>();
    for (let i = 0; i + N <= spans.length; i++) {
      const g = spans
        .slice(i, i + N)
        .map((s) => s.word)
        .join("\x00");
      if (this.waybillGrams.has(g)) {
        for (let j = i; j < i + N; j++) hide.add(j);
      }
    }
    const runs: Array<[number, number]> = [];
    for (const i of [...hide].sort((a, b) => a - b)) {
      if (runs.length > 0 && runs[runs.length - 1]?.[1] === i - 1) {
        runs[runs.length - 1]![1] = i;
      } else {
        runs.push([i, i]);
      }
    }
    for (let ri = runs.length - 1; ri >= 0; ri--) {
      const [a, b] = runs[ri]!;
      t = t.slice(0, spans[a]?.start) + hold("[ticket text]") + t.slice(spans[b]?.end);
    }
    // text.ts: BASE's isdigit is isDigit/isDigitChar (lengths in code points).
    t = t.replace(TICKS_RE, (_m, inner: string) => {
      const replaced = inner.replace(WTOK_RE, (tok) => {
        return this.tokens.has(casefold(tok)) || ([...tok].length < 7 && isDigit(tok))
          ? tok
          : hold("[code]");
      });
      return `\`${replaced}\``;
    });
    t = t.replace(WTOK_RE, (tok) => {
      if (this.tokens.has(casefold(tok)) || ([...tok].length < 7 && isDigit(tok))) return tok;
      const looks =
        isDigit(tok) ||
        tok.includes("_") ||
        [...tok].some((ch) => isDigitChar(ch)) ||
        /[a-z][A-Z]/.test(tok);
      return looks ? hold("[code]") : tok;
    });
    t = t.replace(WORD_RE, (w) => {
      const cf = casefold(w);
      if (this.vocab.has(cf)) return w;
      // LOWER: BASE's own w.lower() on both sides, ported exactly, never folded.
      if (this.waybillWords.has(cf) || !/^[\x00-\x7f]*$/.test(w) || w !== w.toLowerCase()) {
        return hold("[withheld]");
      }
      return w;
    });
    return t.replace(HELD_RE, (_m, idx: string) => held[parseInt(idx, 10)]!);
  }

  key(failed: string): string {
    let t = failed.replace(TOKEN, (m) => {
      if (m.includes("/") && WORD_CHAR_RE.test(m)) {
        return ` ${this.ownPath(m.replace(/[.,:]+$/, "")) || "path"} `;
      }
      return m;
    });
    if (this.names) {
      t = t.replace(this.names, " project ");
    }
    t = casefold(t).replace(FAULT_ID_RE, " id ").replace(HEX_RE, " id ");
    t = t.replace(/\p{Nd}+/gu, " n "); // text.ts: BASE re.sub(r"\d+") is Unicode.
    return [...t.matchAll(WORD_RUN_RE)].map((m) => m[0]).join(" ");
  }
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) out.push(...walkFiles(p));
      else if (e.isFile()) out.push(p);
    }
  } catch {
    /* empty */
  }
  return out;
}

// --- the run's faults ----------------------------------------------------------------------------

function controlsList(): Record<string, string> {
  const out: Record<string, string> = {};
  let text: string;
  try {
    text = readFileSync(join(TOOL, "skills/postmaster/controls.md"), "utf-8");
  } catch {
    return out;
  }
  // text.ts: BASE walks splitlines() and strips Python-style.
  for (const line of pySplitLines(text)) {
    const cells = pyTrim(line)
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => pyTrim(c));
    if (cells.length >= 2) {
      const m = cells[0]?.match(/^`(?:<tool>\/)?([^`]+)`$/);
      if (m && CONTROLS_VALUE_RE.test(cells[1]!)) {
        out[m[1]!] = cells[1]!;
      }
    }
  }
  return out;
}

interface FaultGroup {
  id: string;
  file: string;
  entries: Array<Record<string, unknown>>;
  at: number;
  control: string;
  workarounds: string[];
  escalated: boolean;
}

/** BASE's fault id: `tf-` plus the first 8 hex digits of sha256 over the
 * target file, a newline, and the failure's key. */
function faultId(file: string, key: string): string {
  return `tf-${sha256hex(`${file}\n${key}`).slice(0, 8)}`;
}

function faultsOf(
  entries: Array<Record<string, unknown>>,
  safe: Safe,
  first: number,
): FaultGroup[] {
  const listed = controlsList();
  const groups = new Map<string, FaultGroup>();
  let k = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.action !== "tool-fault") continue;
    k++;
    if (k <= first) continue;
    const file = String(e.target || "");
    const fid = faultId(file, safe.key(String(fields(e).failed || "")));
    let g = groups.get(fid);
    if (!g) {
      g = { id: fid, file, entries: [], at: i, control: "", workarounds: [], escalated: false };
      groups.set(fid, g);
    }
    g.entries.push(e);
  }
  const result: FaultGroup[] = [];
  for (const g of groups.values()) {
    const es = g.entries;
    g.control = es.map((e) => fields(e).control).find((c) => c) || listed[g.file] || "";
    g.workarounds = es.map((e) => fields(e).workaround).filter((w): w is string => !!w);
    g.escalated = entries.slice(g.at + 1).some((e) => {
      return e.action === "escalate" && safe.ownPath(String(e.target || "")) === g?.file;
    });
    result.push(g);
  }
  return result;
}

function doneOf(entries: Array<Record<string, unknown>>): Map<string, [string, string]> {
  const out = new Map<string, [string, string]>();
  for (const e of entries) {
    const m = DONE_RE.exec(String(e.detail || ""));
    if (
      m &&
      e.actor === "postmaster" &&
      ["ticket-create", "ticket-comment", "note"].includes(String(e.action))
    ) {
      const state = m[2] === "filed" ? "filed" : m[2] === "seen again" ? "commented" : "declined";
      out.set(`${m[1]}!${m[3]}`, [state, e.action === "note" ? "" : String(e.target || "")]);
    }
  }
  return out;
}

// --- postmaster's own tracker -------------------------------------------------------------------

class Unreached extends Error {}

class GitHub {
  call(...args: string[]): RunR {
    return runCmd([join(HERE, "github.sh"), TOOL, ...args]);
  }
  search(text: string): Array<[string, string, string]> {
    const r = this.call("search", text);
    if (r.code !== 0) throw new Unreached(`github.sh search: ${whyR(r)}`);
    // text.ts: BASE walks stdout.splitlines().
    return pySplitLines(r.out)
      .filter(Boolean)
      .map((l) => {
        const parts = l.split("\t");
        return [parts[0]!, parts[1]!, parts.slice(2).join("\t")] as [string, string, string];
      })
      .filter((t) => t[0] && t[1]);
  }
  read(number: string): string {
    const r = this.call("read", number.replace(/^#/, ""));
    if (r.code !== 0) throw new Unreached(`github.sh read ${number}: ${whyR(r)}`);
    return r.out;
  }
}

function reach(): { tracker: GitHub | null; reason: string } {
  if (!ownCheckout()) {
    return { tracker: null, reason: "postmaster here is not a git checkout of its own" };
  }
  const r = remoteUrl(TOOL);
  if (r?.[0] !== "github.com") {
    return { tracker: null, reason: "postmaster's checkout has no origin on GitHub" };
  }
  const a = runCmd([join(HERE, "github.sh"), TOOL, "access"]);
  if (a.code !== 0) {
    return { tracker: null, reason: `github.sh access: ${whyR(a)}` };
  }
  if (a.out.trim() !== "ADMIN") {
    return {
      tracker: null,
      reason: `the user does not own postmaster's repository (github.sh access: ${a.out.trim()})`,
    };
  }
  return { tracker: new GitHub(), reason: "" };
}

function lookup(
  t: GitHub,
  fid: string,
  file: string,
): { known: [string, string] | null; like: string[] } {
  for (const [number, state] of t.search(fid)) {
    const body = t.read(number);
    if (fidBoundaryRe(fid).test(body)) {
      return { known: [number, state], like: [] };
    }
  }
  const prefix = `Tool fault in ${file}:`;
  const like = t
    .search(prefix.slice(0, -1))
    .filter(([_number, _state, title]) => title.startsWith(prefix))
    .map(([number]) => number);
  return { known: null, like };
}

// --- the drafts ---------------------------------------------------------------------------------

function draft(g: FaultGroup, rid: string, safe: Safe, runJsonPath: string): [string, string] {
  const es = g.entries;
  const file = safe.publish(g.file);
  const failed = tidy(safe.publish(String(fields(es[0]!).failed || "")));
  const fixes = [...new Set(es.map((e) => tidy(safe.publish(String(fields(e).fix || "")))))];
  const roles = safe.publish([...new Set(es.map((e) => String(e.actor || "")))].join(" and "));
  const title = `Tool fault in ${file}: ${clip(failed.replace(/\.$/, ""), 90)} [${g.id}]`;
  const facts: string[] = [
    `A run met a fault in \`${file}\`: ${failed}${failed.endsWith(".") || failed.endsWith("!") || failed.endsWith("?") ? "" : "."}`,
  ];
  if (g.control) facts.push(`It is a fault in a control (${g.control}), which stops the leg.`);
  if (g.workarounds.length > 0) facts.push("The run worked around it.");
  if (g.escalated) facts.push("The run stopped and escalated.");
  facts.push(`It was seen ${seen(es.length)} in run ${rid}${metaStr(runJsonPath)}.`);
  let direction: string[];
  if (fixes.length === 1) {
    direction = [`The fix the ${roles} that met it proposed: ${fixes[0]}`];
  } else {
    direction = [
      `The fixes proposed by the ${roles} that met it:`,
      "",
      ...fixes.map((f) => `- ${f}`),
    ];
  }
  const body = [
    "## Problem / feature",
    facts.join(" "),
    "",
    "## Acceptance criteria",
    "1. The fault above no longer happens.",
    "2. A control that fails on this fault, and passes with the fix, is part of the change.",
    "",
    "## Direction",
    ...direction,
    "",
    "## Turnpikes",
    "default",
    "",
    "## Notes",
    `Filed from run ${rid} by \`scripts/tool-faults.sh\`. The run's own records keep the full evidence: ` +
      "what ran, the error and the diagnosis. This ticket carries only the file, the failure and the " +
      "proposed fix. If the fix changes the coachman contract (markers, the waybill shape, completion " +
      `detection), a fixture run confirms it before it merges.`,
    "",
    `Tool fault id: \`${g.id}\`.`,
  ];
  return [title, `${body.join("\n")}\n`];
}

function digest(titlePath: string, bodyPath: string): string {
  return sha256hex(
    Buffer.concat([readFileSync(titlePath), Buffer.from("\0"), readFileSync(bodyPath)]),
  );
}

function checked(titlePath: string, bodyPath: string, safe: Safe, sha: string): string {
  // text.ts: BASE strips the title and walks the body by splitlines().
  const title = pyTrim(readFileSync(titlePath, "utf-8"));
  const body = readFileSync(bodyPath, "utf-8");
  if (digest(titlePath, bodyPath) !== sha) {
    const bad: Array<[string, string]> = [];
    if (safe.publish(title) !== title) bad.push(["title", title]);
    for (const l of pySplitLines(body)) {
      if (safe.publish(l) !== l) bad.push(["body", l]);
    }
    if (bad.length > 0) {
      return (
        "not safe to publish:\n" +
        bad.map(([w, t]) => `  ${w}: ${t}\n  made safe: ${safe.publish(t)}`).join("\n")
      );
    }
  }
  const r = runCmd([join(HERE, "ticket-check.sh"), "--body", bodyPath, "--title", title]);
  // text.ts: BASE rstrips the failure tail Python-style.
  return r.code === 0 ? "" : `the draft fails scripts/ticket-check.sh:\n${pyRstrip(r.out + r.err)}`;
}

// --- the commands -------------------------------------------------------------------------------

interface FaultState {
  run_id: string;
  id: string;
  file: string;
  control: string;
  count: number;
  state: string;
  ticket: string;
  ticket_state?: string;
  like: string[];
  sha: string;
  draft: string;
}

function harvestCmd(d: string, ongoing: boolean): void {
  closedCheck(d, ongoing);
  const logPath = join(d, "actions.jsonl");
  const statePath = join(d, "tool-faults.json");
  const draftsDir = join(d, "tool-faults");
  const { entries, bad } = readLog(logPath);
  const lines = entries.filter((e) => e.action === "tool-fault").length;
  const st = loadState(statePath);
  let runs: Array<Record<string, any>> = st.runs || [];
  if (runs.length === 0 || (ongoing && lines > (st.lines || 0))) {
    runs = [
      ...runs,
      {
        run_id: newId(),
        first: runs.length > 0 ? st.lines || 0 : 0,
        // ASCII: toISOString is machine ASCII; BASE formats the same stamp.
        harvested: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
      },
    ];
    st.runs = runs;
    saveState(statePath, st);
  }
  const rid = runs[runs.length - 1]?.run_id as string;
  const first = runs[runs.length - 1]?.first as number;
  const safe = new Safe(ownIds(st, join(d, "run.json")), d, ongoing);
  const groups = faultsOf(entries, safe, first);
  const done = doneOf(entries);
  const prior = new Map<string, any>();
  for (const x of st.faults || []) {
    prior.set(`${x.run_id}!${x.id}`, x);
  }
  const anyNew = groups.some((g) => !done.has(`${g.id}!${rid}`));
  const { tracker: t, reason } = anyNew ? reach() : { tracker: null, reason: "" };
  const rows: string[] = [];
  const found: FaultState[] = [];
  const notes: string[] = bad.map(
    (n) => `  line ${n} of actions.jsonl is not a log line, and was left out`,
  );
  for (const g of groups) {
    const fid = g.id;
    const was = prior.get(`${rid}!${fid}`) || {};
    const x: FaultState = {
      run_id: rid,
      id: fid,
      file: g.file,
      control: g.control,
      count: g.entries.length,
      state: "",
      ticket: "",
      like: [],
      sha: "",
      draft: "",
    };
    const doneKey = `${fid}!${rid}`;
    if (done.has(doneKey)) {
      const [state, ticket] = done.get(doneKey)!;
      x.state = state;
      x.ticket = ticket;
    } else if (!t) {
      x.state = "kept";
    } else {
      try {
        const { known: k, like } = lookup(t, fid, safe.publish(g.file));
        x.like = like;
        if (k) {
          x.state = "known";
          x.ticket = k[0];
          x.ticket_state = k[1];
        } else {
          x.state = was.state === "new" || was.state === "asked" ? "asked" : "new";
        }
      } catch (e) {
        x.state = "unchecked";
        notes.push(
          `  ${fid}: the tracker could not be read: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
    const folder = join(draftsDir, rid);
    const titlePath = join(folder, `${fid}.title`);
    const bodyPath = join(folder, `${fid}.md`);
    if (existsSync(titlePath) && existsSync(bodyPath)) {
      x.sha = was.sha || "";
    } else {
      mkdirSync(folder, { recursive: true });
      const [title, body] = draft(g, rid, safe, join(d, "run.json"));
      writeFileSync(titlePath, `${title}\n`);
      writeFileSync(bodyPath, body);
      x.sha = digest(titlePath, bodyPath);
    }
    x.draft = join("tool-faults", rid, `${fid}.md`);
    let what =
      x.state + (x.ticket ? ` ${x.ticket}` : "") + (x.ticket_state ? ` (${x.ticket_state})` : "");
    if (x.like.length > 0) what += `, like ${x.like.join(" ")}`;
    if (ASKING.has(x.state)) what += `  ${x.draft}`;
    rows.push(
      `${fid}  ${g.file}  ${g.control ? `control (${g.control})  ` : ""}${seen(x.count)}  ${what}`,
    );
    if (!["commented", "filed", "declined"].includes(x.state)) {
      if (g.control && !g.escalated) {
        notes.push(
          `  ${fid}: a fault in a control, and the log has no escalate naming its file after it`,
        );
      }
      if (g.control) {
        for (const w of g.workarounds) {
          notes.push(`  ${fid}: a fault in a control, worked around: ${w}`);
        }
      }
    }
    if (ASKING.has(x.state)) {
      const problem = checked(titlePath, bodyPath, safe, x.sha);
      if (problem) {
        notes.push(`  ${fid}: ${problem.replace(/\n/g, "\n    ")}`);
      }
    }
    found.push(x);
  }
  st.faults = [...(st.faults || []).filter((x: any) => x.run_id !== rid), ...found];
  st.lines = lines;
  saveState(statePath, st);
  const tally: Record<string, number> = {};
  for (const x of found) {
    tally[x.state] = (tally[x.state] || 0) + 1;
  }
  if (groups.length === 0) {
    console.log(`run ${rid}: no tool faults`);
  } else {
    const where =
      (t ? "postmaster's own tracker, on GitHub" : `no tracker of postmaster's own: ${reason}`) ||
      "every fault dealt with";
    console.log(`run ${rid}: ${groups.length} fault${groups.length === 1 ? "" : "s"}; ${where}`);
    console.log(rows.join("\n"));
  }
  if (notes.length > 0) {
    console.log(notes.join("\n"));
  }
  const tallyStr = Object.entries(tally)
    .sort()
    .map(([s, n]) => `, ${n} ${s}`)
    .join("");
  const r = runCmd([
    join(HERE, "log-action.sh"),
    d,
    "postmaster",
    "note",
    rid,
    `tool faults harvested: ${groups.length}${tallyStr}`,
  ]);
  if (r.code !== 0) {
    dieTF(`the log could not be written: ${whyR(r)}`);
  }
}

function begin(
  fid: string,
  d: string,
  ongoing: boolean,
): { st: Record<string, any>; x: any; entries: Array<Record<string, unknown>> } {
  closedCheck(d, ongoing);
  const statePath = join(d, "tool-faults.json");
  const st = loadState(statePath);
  const xs = (st.faults || []).filter((x: any) => x.id === fid);
  if (xs.length === 0) {
    dieTF(`no fault ${fid} in ${statePath}; harvest first`);
  }
  const { entries } = readLog(join(d, "actions.jsonl"));
  const d2 = doneOf(entries).get(`${fid}!${xs[xs.length - 1].run_id}`);
  if (d2) {
    console.log(`${fid}: already ${d2.filter(Boolean).join(" ")}`);
    process.exit(0);
  }
  return { st, x: xs[xs.length - 1], entries };
}

function settle(
  st: Record<string, any>,
  x: any,
  state: string,
  ticket: string,
  statePath: string,
): void {
  x.state = state;
  x.ticket = ticket;
  saveState(statePath, st);
}

function trackerOrDie(): GitHub {
  const { tracker: t, reason } = reach();
  if (!t) dieTF(`no tracker of postmaster's own: ${reason}`);
  return t;
}

function commentCmd(fid: string, ticket: string, d: string, ongoing: boolean): void {
  const statePath = join(d, "tool-faults.json");
  const { st, x, entries } = begin(fid, d, ongoing);
  const t = trackerOrDie();
  const safe = new Safe(ownIds(st, join(d, "run.json")), d, ongoing);
  const first = (st.runs || []).find((r: any) => r.run_id === x.run_id)?.first || 0;
  const g = faultsOf(entries, safe, first).find((g) => g.id === fid);
  if (!g) {
    dieTF(`the run's log no longer gives ${fid}; harvest it again`);
  }
  let number: string;
  let state: string;
  try {
    if (ticket) {
      if (!TICKET_RE.test(ticket)) {
        dieTF(`not a ticket number: ${ticket}`);
      }
      number = `#${ticket.replace(/^#/, "")}`;
      const body = t.read(number);
      const m = body.match(STATE_RE);
      state = m ? m[1]! : "";
    } else {
      const { known: k } = lookup(t, fid, safe.publish(g?.file));
      if (!k) {
        dieTF(
          `${fid} has no ticket on postmaster's tracker, so it is new: file it, or decline it`,
          2,
        );
      }
      number = k[0];
      state = k[1];
    }
  } catch (e) {
    if (e instanceof Unreached) dieTF(`the tracker could not be read: ${e.message}`);
    throw e;
  }
  let text = `tool fault ${fid} seen again: ${seen(g?.entries.length)} in run ${x.run_id}${metaStr(join(d, "run.json"))}.`;
  if (["closed", "done", "cancelled"].includes(state)) text += " This ticket is closed.";
  const r = t.call("comment", number.replace(/^#/, ""), "postmaster", text);
  if (r.code !== 0) {
    dieTF(`the tracker refused the comment: ${whyR(r)}`);
  }
  const lr = runCmd([
    join(HERE, "log-action.sh"),
    d,
    "postmaster",
    "ticket-comment",
    number,
    `tool fault ${fid} seen again in run ${x.run_id}, on postmaster's own tracker`,
  ]);
  if (lr.code !== 0) dieTF(`the log could not be written: ${whyR(lr)}`);
  settle(st, x, "commented", number, statePath);
  console.log(`${fid}: commented on ${number}`);
}

function fileCmd(fid: string, d: string, ongoing: boolean): void {
  const statePath = join(d, "tool-faults.json");
  const { st, x } = begin(fid, d, ongoing);
  const folder = join(d, "tool-faults", x.run_id);
  const titlePath = join(folder, `${fid}.title`);
  const bodyPath = join(folder, `${fid}.md`);
  if (!existsSync(titlePath) || !existsSync(bodyPath)) {
    dieTF(`no draft for ${fid} in ${folder}`);
  }
  const t = trackerOrDie();
  const safe = new Safe(ownIds(st, join(d, "run.json")), d, ongoing);
  try {
    const { known: k } = lookup(t, fid, safe.publish(x.file));
    if (k) {
      dieTF(`${fid} is already ${k[0]} on postmaster's tracker: comment on it instead`, 2);
    }
  } catch (e) {
    if (e instanceof Unreached)
      dieTF(`the tracker could not be read, so nothing is filed: ${e.message}`);
    throw e;
  }
  const problem = checked(titlePath, bodyPath, safe, x.sha || "");
  if (problem) {
    dieTF(`${fid} is not filed: ${problem}`, 2);
  }
  const title = readFileSync(titlePath, "utf-8").trim();
  const r = t.call("create", title, bodyPath);
  // text.ts: BASE takes strip().splitlines()[-1] and .isdigit()s it.
  const made = pySplitLines(pyTrim(r.out)).filter(Boolean).pop() || "";
  if (![0, 5].includes(r.code) || !isDigit(made)) {
    dieTF(`the tracker refused the ticket: ${whyR(r)}`);
  }
  const lr = runCmd([
    join(HERE, "log-action.sh"),
    d,
    "postmaster",
    "ticket-create",
    `#${made}`,
    `tool fault ${fid} filed in run ${x.run_id}, on postmaster's own tracker`,
  ]);
  if (lr.code !== 0) dieTF(`the log could not be written: ${whyR(lr)}`);
  settle(st, x, "filed", `#${made}`, statePath);
  console.log(
    `${fid}: filed as #${made}${r.code === 5 ? "; it is not on the board, so add it there" : ""}`,
  );
}

function declineCmd(fid: string, word: string, d: string, ongoing: boolean): void {
  const statePath = join(d, "tool-faults.json");
  const { st, x } = begin(fid, d, ongoing);
  const lr = runCmd([
    join(HERE, "log-action.sh"),
    d,
    "postmaster",
    "note",
    fid,
    `tool fault ${fid} declined in run ${x.run_id}, by the user: ${word}`,
  ]);
  if (lr.code !== 0) dieTF(`the log could not be written: ${whyR(lr)}`);
  settle(st, x, "declined", "", statePath);
  console.log(`${fid}: declined`);
}

// --- entry ---------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
function usageDie(): never {
  console.error(usage);
  process.exit(1);
  throw new Error("unreachable");
}
const usage =
  "usage: tool-faults.sh harvest <dispatch> | comment <dispatch> <id> [<ticket>] | file <dispatch> <id> | decline <dispatch> <id> <the user's word> | --self-test";

if (argv[0] === "--self-test") {
  // fall through to self-test below
} else {
  if (!argv[0]) usageDie();
  const dispatch = argv[1];
  if (!dispatch) usageDie();
  if (!existsSync(dispatch) || !statSync(dispatch).isDirectory()) {
    dieTF(`no such dispatch directory: ${dispatch}`);
  }
  const d = resolve(dispatch);
  const ongoing = basename(d) === "postmaster";

  if (argv[0] === "harvest") {
    if (argv.length !== 2) usageDie();
    harvestCmd(d, ongoing);
  } else if (argv[0] === "comment") {
    if (argv.length < 3 || argv.length > 4) usageDie();
    const fid = argv[2]!;
    if (!/^tf-[0-9a-f]{8}$/.test(fid)) dieTF(`not a fault id: ${fid}`);
    commentCmd(fid, argv[3] || "", d, ongoing);
  } else if (argv[0] === "file") {
    if (argv.length !== 3) usageDie();
    const fid = argv[2]!;
    if (!/^tf-[0-9a-f]{8}$/.test(fid)) dieTF(`not a fault id: ${fid}`);
    fileCmd(fid, d, ongoing);
  } else if (argv[0] === "decline") {
    if (argv.length < 4) usageDie();
    const fid = argv[2]!;
    if (!/^tf-[0-9a-f]{8}$/.test(fid)) dieTF(`not a fault id: ${fid}`);
    declineCmd(fid, argv.slice(3).join(" "), d, ongoing);
  } else {
    usageDie();
  }
  process.exit(0);
}

// Round-10 pattern parity: every regex above, diffed against BASE's own
// pattern text (bb782a9 scripts/tool-faults.sh) on the vectors where
// Unicode meets the pattern. The port side runs the real consts, so a
// routed pattern that drifts fails here before any harvest runs.
// Multi-slash remote tails are absent on purpose: BASE's /*$ and the
// port's /?$ disagree there, and that P3 rides a card, not this suite.
function runPatternParity(st: SelfTest, tmp: string): void {
  interface PatCase {
    id: string;
    op: "search" | "fullmatch" | "findall" | "profile" | "remote";
    pyPat: string;
    pyFlags: string;
    s: string;
  }
  const FID = "tf-abcdef12";
  // Split for the same reason the harvest vectors split: whole, these
  // would sit in this file, hence in the tool's own tokens, and the
  // harvest control's matching vectors would keep by membership instead
  // of exercising their patterns.
  const S_AR3 = "١٢" + "٣";
  const S_HXAB = "abcdefab" + "٣";
  const namesShape = (words: string[]): RegExp =>
    new RegExp(`${NAME_L}(${words.map((w) => literalI(w)).join("|")})${NAME_R}`, "giu");
  const NAMES_WORDS = ["harbor", "illegal", "straße"];
  const NAMES_PY = "(?<![^\\W_])(harbor|illegal|straße)(?![^\\W_])";
  const normGroup = (v: unknown): unknown => (v === undefined ? "" : v);
  const runPort = (c: PatCase): unknown => {
    if (c.op === "profile") return profileRepo(c.s);
    if (c.op === "remote") return remoteUrl(c.s);
    let re: RegExp;
    switch (c.id) {
      case "done":
        re = DONE_RE;
        break;
      case "url":
        re = URL_RE;
        break;
      case "email":
        re = EMAIL_RE;
        break;
      case "ipv4":
        re = IPV4_RE;
        break;
      case "key":
        re = KEY_RE;
        break;
      case "filelike":
        re = FILELIKE;
        break;
      case "faultid":
        re = FAULT_ID_RE;
        break;
      case "hex":
        re = HEX_RE;
        break;
      case "mark":
        re = MARK_RE;
        break;
      case "word":
        re = WORD_RE;
        break;
      case "wtok":
        re = WTOK_RE;
        break;
      case "ticks":
        re = TICKS_RE;
        break;
      case "token":
        re = TOKEN;
        break;
      case "names":
        re = namesShape(NAMES_WORDS);
        break;
      case "ticket":
        re = TICKET_RE;
        break;
      case "state":
        re = STATE_RE;
        break;
      case "fid":
        re = fidBoundaryRe(FID);
        break;
      case "controls":
        re = CONTROLS_VALUE_RE;
        break;
      case "rurl1":
        re = RURL_M1;
        break;
      case "rurl2":
        re = RURL_M2;
        break;
      case "phead":
        re = PROFILE_HEAD_RE;
        break;
      case "pend":
        re = PROFILE_END_RE;
        break;
      case "prepo":
        re = PROFILE_REPO_RE;
        break;
      default:
        throw new Error(`unknown pattern ${c.id}`);
    }
    re.lastIndex = 0;
    if (c.op === "search") {
      const m = re.exec(c.s);
      return m ? [m[0], ...[...m].slice(1).map(normGroup)] : [];
    }
    if (c.op === "fullmatch") {
      const m = re.exec(c.s);
      return m !== null && m[0] === c.s;
    }
    const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
    return [...c.s.matchAll(new RegExp(re.source, flags))].map((m) => {
      const gs = [...m].slice(1).map(normGroup);
      if (gs.length === 0) return m[0];
      return gs.length === 1 ? gs[0] : gs;
    });
  };
  const P = (
    id: string,
    op: PatCase["op"],
    pyPat: string,
    pyFlags: string,
    s: string,
  ): PatCase => ({
    id,
    op,
    pyPat,
    pyFlags,
    s,
  });
  const cases: PatCase[] = [
    P(
      "done",
      "search",
      "^tool fault (tf-[0-9a-f]{8}) (filed|seen again|declined) in run ([0-9a-f]+)\\b",
      "",
      "tool fault tf-abcdef12 filed in run abc123",
    ),
    P(
      "done",
      "search",
      "^tool fault (tf-[0-9a-f]{8}) (filed|seen again|declined) in run ([0-9a-f]+)\\b",
      "",
      "tool fault tf-abcdef12 seen again in run 123",
    ),
    P(
      "done",
      "search",
      "^tool fault (tf-[0-9a-f]{8}) (filed|seen again|declined) in run ([0-9a-f]+)\\b",
      "",
      "tool fault tf-abcdef12 declined in run abc123xyz",
    ),
    P(
      "done",
      "search",
      "^tool fault (tf-[0-9a-f]{8}) (filed|seen again|declined) in run ([0-9a-f]+)\\b",
      "",
      "tool fault tf-abcdef12 filed in run abc123é",
    ),
    P(
      "done",
      "search",
      "^tool fault (tf-[0-9a-f]{8}) (filed|seen again|declined) in run ([0-9a-f]+)\\b",
      "",
      "xtool fault tf-abcdef12 filed in run abc",
    ),
    P(
      "url",
      "search",
      "\\b[A-Za-z][A-Za-z0-9+.-]{0,30}://[^\\s)\\]>'\"`]+",
      "",
      "open https://example.com/x now",
    ),
    P(
      "url",
      "search",
      "\\b[A-Za-z][A-Za-z0-9+.-]{0,30}://[^\\s)\\]>'\"`]+",
      "",
      "see https://a.com/x\x1cy here",
    ),
    P(
      "url",
      "search",
      "\\b[A-Za-z][A-Za-z0-9+.-]{0,30}://[^\\s)\\]>'\"`]+",
      "",
      "see https://a.com/x\u0085y here",
    ),
    P(
      "url",
      "search",
      "\\b[A-Za-z][A-Za-z0-9+.-]{0,30}://[^\\s)\\]>'\"`]+",
      "",
      "see https://a.com/x\ufeffy here",
    ),
    P(
      "url",
      "search",
      "\\b[A-Za-z][A-Za-z0-9+.-]{0,30}://[^\\s)\\]>'\"`]+",
      "",
      "get ftp://h/x ok",
    ),
    P(
      "url",
      "search",
      "\\b[A-Za-z][A-Za-z0-9+.-]{0,30}://[^\\s)\\]>'\"`]+",
      "",
      "open ßhttp://x.com/a now",
    ),
    P(
      "email",
      "search",
      "(?<![\\w.+-])[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+",
      "",
      "mailed to ü@internal.example today",
    ),
    P(
      "email",
      "search",
      "(?<![\\w.+-])[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+",
      "",
      "ping admin@exämple.com now",
    ),
    P(
      "email",
      "search",
      "(?<![\\w.+-])[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+",
      "",
      "mail qzxvndr@例え.テスト ok",
    ),
    P(
      "email",
      "search",
      "(?<![\\w.+-])[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+",
      "",
      "ask josé@acme-corp.com please",
    ),
    P(
      "email",
      "search",
      "(?<![\\w.+-])[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+",
      "",
      "mail u@example.com ok",
    ),
    P("email", "search", "(?<![\\w.+-])[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+", "", "note aü@b.co here"),
    P("ipv4", "search", "(?<![\\w.])\\d{1,3}(?:\\.\\d{1,3}){3}(?![\\w.])", "", "ping 10.0.0.1 now"),
    P(
      "ipv4",
      "search",
      "(?<![\\w.])\\d{1,3}(?:\\.\\d{1,3}){3}(?![\\w.])",
      "",
      `ping ${S_AR3}.${S_AR3}.${S_AR3}.${S_AR3} now`,
    ),
    P(
      "ipv4",
      "search",
      "(?<![\\w.])\\d{1,3}(?:\\.\\d{1,3}){3}(?![\\w.])",
      "",
      "ping 1.2.3.9999 now",
    ),
    P(
      "ipv4",
      "search",
      "(?<![\\w.])\\d{1,3}(?:\\.\\d{1,3}){3}(?![\\w.])",
      "",
      "ping é10.0.0.1 now",
    ),
    P(
      "ipv4",
      "search",
      "(?<![\\w.])\\d{1,3}(?:\\.\\d{1,3}){3}(?![\\w.])",
      "",
      "ping 10.0.0.1é now",
    ),
    P("key", "search", "(?<![\\w-])[A-Z][A-Z0-9]{1,9}-\\d+(?![\\w-])", "", "see PM-12 here"),
    P(
      "key",
      "search",
      "(?<![\\w-])[A-Z][A-Z0-9]{1,9}-\\d+(?![\\w-])",
      "",
      "see ü" + "PM-12 and more",
    ),
    P("key", "search", "(?<![\\w-])[A-Z][A-Z0-9]{1,9}-\\d+(?![\\w-])", "", "see PM-١٢ here"),
    P("key", "search", "(?<![\\w-])[A-Z][A-Z0-9]{1,9}-\\d+(?![\\w-])", "", "see PM-12x here"),
    P("key", "search", "(?<![\\w-])[A-Z][A-Z0-9]{1,9}-\\d+(?![\\w-])", "", "see P-1 here"),
    P("filelike", "fullmatch", "[\\w-]+(?:\\.[\\w-]+)*\\.[A-Za-z]\\w{1,7}", "", "data.txt"),
    P("filelike", "fullmatch", "[\\w-]+(?:\\.[\\w-]+)*\\.[A-Za-z]\\w{1,7}", "", "data." + "ßx"),
    P("filelike", "fullmatch", "[\\w-]+(?:\\.[\\w-]+)*\\.[A-Za-z]\\w{1,7}", "", "secret." + "éxt"),
    P("filelike", "fullmatch", "[\\w-]+(?:\\.[\\w-]+)*\\.[A-Za-z]\\w{1,7}", "", "data." + "日本"),
    P("filelike", "fullmatch", "[\\w-]+(?:\\.[\\w-]+)*\\.[A-Za-z]\\w{1,7}", "", "dx.aé9"),
    P("filelike", "fullmatch", "[\\w-]+(?:\\.[\\w-]+)*\\.[A-Za-z]\\w{1,7}", "", "a.b_c-d.e2"),
    P("filelike", "fullmatch", "[\\w-]+(?:\\.[\\w-]+)*\\.[A-Za-z]\\w{1,7}", "", "notafile"),
    P("faultid", "search", "\\btf-[0-9a-f]{8}\\b", "", "see tf-abcdef12 here"),
    P("faultid", "search", "\\btf-[0-9a-f]{8}\\b", "", `again étf-${"1234" + "5678"} broke`),
    P("faultid", "search", "\\btf-[0-9a-f]{8}\\b", "", "see tf-abcdef12é here"),
    P("faultid", "search", "\\btf-[0-9a-f]{8}\\b", "", "see TF-ABCDEF12 here"),
    P("faultid", "search", "\\btf-[0-9a-f]{8}\\b", "", "see tf-abcdef1 here"),
    P("hex", "search", "\\b(?=[0-9a-f]*\\d)[0-9a-f]{7,40}\\b", "", "hash abcdef1 done"),
    // The lookahead's \d is provably inert (its satisfying digit always
    // kills the trailing \b), so the \p{Nd} spelling is exactness by
    // construction; these vectors lock the agreed match-or-nothing.
    P("hex", "search", "\\b(?=[0-9a-f]*\\d)[0-9a-f]{7,40}\\b", "", `hash ${S_HXAB}! done`),
    P("hex", "search", "\\b(?=[0-9a-f]*\\d)[0-9a-f]{7,40}\\b", "", "hash abcdefab done"),
    P("hex", "search", "\\b(?=[0-9a-f]*\\d)[0-9a-f]{7,40}\\b", "", `hash ${"ßabc" + "def1"} done`),
    P("hex", "search", "\\b(?=[0-9a-f]*\\d)[0-9a-f]{7,40}\\b", "", `id ${"123" + "4567"} ok`),
    P(
      "mark",
      "search",
      "\\[(?:path|project|ticket text|ticket|code|link|address|withheld)\\]",
      "",
      "a [code] b",
    ),
    P(
      "mark",
      "search",
      "\\[(?:path|project|ticket text|ticket|code|link|address|withheld)\\]",
      "",
      "a [bogus] b",
    ),
    P("word", "fullmatch", "[^\\W\\d_]+(?:'[^\\W\\d_]+)*", "", "l'homme"),
    P("word", "fullmatch", "[^\\W\\d_]+(?:'[^\\W\\d_]+)*", "", "½x"),
    P("word", "fullmatch", "[^\\W\\d_]+(?:'[^\\W\\d_]+)*", "", "1a"),
    P("word", "fullmatch", "[^\\W\\d_]+(?:'[^\\W\\d_]+)*", "", "a'b'c"),
    P("word", "findall", "[^\\W\\d_]+", "", "ab 12 c3 _x Aé㈠"),
    P("word", "findall", "[^\\W\\d_]+", "", "a1b₂c3"),
    P("wtok", "findall", "\\w+", "", "a_b ٣ x-y ½"),
    P("ticks", "findall", "`([^`\\n]+)`", "", "`a`b`c`"),
    P("ticks", "findall", "`([^`\\n]+)`", "", "``"),
    P("token", "fullmatch", "[~<>\\w.@+/-]+", "", "a/b.c_d@e~f<g>h+i:j"),
    P("token", "fullmatch", "[~<>\\w.@+/-]+", "", "a b"),
    P("token", "fullmatch", "[~<>\\w.@+/-]+", "", "héllo/x"),
    P("names", "search", NAMES_PY, "i", "see harbor here"),
    P("names", "search", NAMES_PY, "i", "see _harbor fail"),
    P("names", "search", NAMES_PY, "i", "see harbor_ fail"),
    P("names", "search", NAMES_PY, "i", "see éharbor fail"),
    P("names", "search", NAMES_PY, "i", "see harboré fail"),
    P("names", "search", NAMES_PY, "i", "see HARBOR here"),
    P("names", "search", NAMES_PY, "i", "see İllegal here"),
    P("names", "search", NAMES_PY, "i", "see ıllegal here"),
    P("names", "search", NAMES_PY, "i", "see straße here"),
    P("names", "search", NAMES_PY, "i", "see STRAẞE here"),
    P("names", "search", NAMES_PY, "i", "see 1harbor fail"),
    P("ticket", "fullmatch", "#?\\d+", "", "12"),
    P("ticket", "fullmatch", "#?\\d+", "", "#12"),
    P("ticket", "fullmatch", "#?\\d+", "", S_AR3),
    P("ticket", "fullmatch", "#?\\d+", "", `#${S_AR3}`),
    P("ticket", "fullmatch", "#?\\d+", "", "1a"),
    P("ticket", "fullmatch", "#?\\d+", "", "##12"),
    P("state", "search", "^state: (\\S+)", "m", "state: OPEN"),
    P("state", "search", "^state: (\\S+)", "m", "x\nstate: OPEN"),
    P("state", "search", "^state: (\\S+)", "m", "x\rstate: OPEN"),
    P("state", "search", "^state: (\\S+)", "m", "state: closed\ufeff"),
    P("state", "search", "^state: (\\S+)", "m", "state: \u0085x"),
    P("state", "search", "^state: (\\S+)", "m", "state: "),
    P("fid", "search", "(?<![\\w-])tf-abcdef12(?![\\w-])", "", "see tf-abcdef12 here"),
    P("fid", "search", "(?<![\\w-])tf-abcdef12(?![\\w-])", "", "see étf-abcdef12 here"),
    P("fid", "search", "(?<![\\w-])tf-abcdef12(?![\\w-])", "", "see tf-abcdef12é here"),
    P("fid", "search", "(?<![\\w-])tf-abcdef12(?![\\w-])", "", "see -tf-abcdef12- here"),
    P("controls", "fullmatch", "[\\w-]+", "", "kind-name_2"),
    P("controls", "fullmatch", "[\\w-]+", "", "héllo"),
    P("controls", "fullmatch", "[\\w-]+", "", "has space"),
    P(
      "rurl1",
      "search",
      "^[A-Za-z][A-Za-z0-9+.-]*://(?:[^@/]*@)?([^/:?#]+)(?::\\d+)?/+(.*?)(?:\\.git)?/*$",
      "",
      `https://host:${S_AR3}/path`,
    ),
    P(
      "rurl1",
      "search",
      "^[A-Za-z][A-Za-z0-9+.-]*://(?:[^@/]*@)?([^/:?#]+)(?::\\d+)?/+(.*?)(?:\\.git)?/*$",
      "",
      "https://user@host:8080/a/b",
    ),
    P(
      "rurl1",
      "search",
      "^[A-Za-z][A-Za-z0-9+.-]*://(?:[^@/]*@)?([^/:?#]+)(?::\\d+)?/+(.*?)(?:\\.git)?/*$",
      "",
      "https://host/path/",
    ),
    P(
      "rurl1",
      "search",
      "^[A-Za-z][A-Za-z0-9+.-]*://(?:[^@/]*@)?([^/:?#]+)(?::\\d+)?/+(.*?)(?:\\.git)?/*$",
      "",
      "https://host/path.git",
    ),
    P(
      "rurl1",
      "search",
      "^[A-Za-z][A-Za-z0-9+.-]*://(?:[^@/]*@)?([^/:?#]+)(?::\\d+)?/+(.*?)(?:\\.git)?/*$",
      "",
      "https://host:abc/path",
    ),
    P(
      "rurl2",
      "search",
      "^(?:[^@/:]+@)?([^/:]+):(?!//)(.*?)(?:\\.git)?/*$",
      "",
      "git@host:path/to.git",
    ),
    P("rurl2", "search", "^(?:[^@/:]+@)?([^/:]+):(?!//)(.*?)(?:\\.git)?/*$", "", "host:path"),
    P("rurl2", "search", "^(?:[^@/:]+@)?([^/:]+):(?!//)(.*?)(?:\\.git)?/*$", "", "a:b:c"),
    P("rurl2", "search", "^(?:[^@/:]+@)?([^/:]+):(?!//)(.*?)(?:\\.git)?/*$", "", "x://y"),
    P("phead", "findall", "^## Project profile[ \\t]*$", "m", "## Project profile\n"),
    P("phead", "findall", "^## Project profile[ \\t]*$", "m", "x\n## Project profile  \n"),
    P("phead", "findall", "^## Project profile[ \\t]*$", "m", "## Project profile\r\n"),
    P("phead", "findall", "^## Project profile[ \\t]*$", "m", "## Other\n## Project profile\n"),
    P("pend", "search", "^## ", "m", "x\n## y"),
    P("pend", "search", "^## ", "m", "x\r## y"),
    P("pend", "search", "^## ", "m", "## y"),
    P("prepo", "search", "^repo:[ \\t]*(\\S.*?)(?:[ \\t]{2,}\\S.*)?[ \\t]*$", "m", "repo: ~/x\n"),
    P(
      "prepo",
      "search",
      "^repo:[ \\t]*(\\S.*?)(?:[ \\t]{2,}\\S.*)?[ \\t]*$",
      "m",
      "repo: /a/b  comment here\n",
    ),
    P(
      "prepo",
      "search",
      "^repo:[ \\t]*(\\S.*?)(?:[ \\t]{2,}\\S.*)?[ \\t]*$",
      "m",
      "repo: \x1cfoo\n",
    ),
    P("prepo", "search", "^repo:[ \\t]*(\\S.*?)(?:[ \\t]{2,}\\S.*)?[ \\t]*$", "m", "x\rrepo: /a\n"),
    P("prepo", "search", "^repo:[ \\t]*(\\S.*?)(?:[ \\t]{2,}\\S.*)?[ \\t]*$", "m", "repo: ~/x\r\n"),
  ];
  // profile_repo / remote differentials: BASE's functions inlined in the
  // program above. Relative results are resolved on the BASE side (the
  // port absolutizes where BASE keeps Path-relative: a carded P3 outside
  // this suite, as are ~user tails and multi-slash remote tails).
  for (const s of [
    "## Project profile\nrepo: /tmp/ppp\n",
    "## Project profile\nrepo: ~/ppp\n",
    "## Project profile\nrepo: /a/b  see ticket\n",
    "## Project profile\r\nrepo: /a\r\n",
    "## Project profile\nrepo: \x1cfoo\n",
    "## Project profile\nx\rrepo: /a\n",
    "## Project profile\nrepo: /a\u0085\n",
    "no sections here",
    "## Project profile\nnothing\n",
    "## Project profile\nrepo: /first\n## Project profile\nrepo: /second\n",
    "## Project profile\nrepo: /a\n## Next\nrepo: /b\n",
  ])
    cases.push(P("profile", "profile", "", "", s));
  const mkRemote = (name: string, url: string | null): string => {
    const d = join(tmp, `pat-${name}`);
    mkdirSync(d, { recursive: true });
    run("git", ["-C", d, "init", "-q"]);
    if (url !== null) run("git", ["-C", d, "remote", "add", "origin", url]);
    return d;
  };
  for (const [name, url] of [
    ["remArPort", `https://h:${S_AR3}/p`],
    ["remFoldHost", "https://Straße:8080/p"],
    ["remStd", "https://User@Host:8080/a/b"],
    ["remScp", "git@host:path/to.git"],
    ["remBare", "host:path"],
    ["remDotGit", "https://host/path.git"],
    ["remSlash", "https://host/path/"],
    ["remNone", null],
  ] as Array<[string, string | null]>)
    cases.push(P("remote", "remote", "", "", mkRemote(name, url)));
  if (run("sh", ["-c", "command -v python3"]).code !== 0) {
    st.skip("pattern parity with BASE", "python3 not on PATH: the pattern comparison did not run");
  } else {
    const prog = join(tmp, "pat-parity.py");
    writeFileSync(
      prog,
      [
        "import json, os, re, subprocess, sys",
        "out = []",
        "def base_profile(s):",
        "    starts = [m.end() for m in re.finditer(r'^## Project profile[ \\t]*$', s, re.M)]",
        "    if not starts: return None",
        "    body = s[starts[-1]:]",
        "    end = re.search(r'^## ', body, re.M)",
        "    m = re.search(r'^repo:[ \\t]*(\\S.*?)(?:[ \\t]{2,}\\S.*)?[ \\t]*$', body[:end.start()] if end else body, re.M)",
        "    return os.path.abspath(os.path.expanduser(m.group(1).strip())) if m else None",
        "def base_remote(where):",
        "    r0 = subprocess.run(['git', '-C', where, 'remote', 'get-url', 'origin'], capture_output=True, text=True)",
        "    url = r0.stdout.strip() if r0.returncode == 0 else ''",
        "    if not url: return None",
        "    m = (re.match(r'^[A-Za-z][A-Za-z0-9+.-]*://(?:[^@/]*@)?([^/:?#]+)(?::\\d+)?/+(.*?)(?:\\.git)?/*$', url) or re.match(r'^(?:[^@/:]+@)?([^/:]+):(?!//)(.*?)(?:\\.git)?/*$', url))",
        "    return [m.group(1).lower(), m.group(2)] if m and m.group(2) else ['', url.rstrip('/')]",
        "for c in json.load(sys.stdin):",
        "    try:",
        "        fl = 0",
        "        if 'i' in c['pyFlags']: fl |= re.I",
        "        if 'm' in c['pyFlags']: fl |= re.M",
        "        if c['op'] == 'profile': r = base_profile(c['s'])",
        "        elif c['op'] == 'remote': r = base_remote(c['s'])",
        "        elif c['op'] == 'search':",
        "            m = re.search(c['pyPat'], c['s'], fl)",
        "            r = [m.group(0)] + [g if g is not None else '' for g in m.groups()] if m else []",
        "        elif c['op'] == 'fullmatch':",
        "            r = bool(re.fullmatch(c['pyPat'], c['s'], fl))",
        "        else:",
        "            f = re.findall(c['pyPat'], c['s'], fl)",
        "            r = [[g if g is not None else '' for g in t] if isinstance(t, tuple) else t for t in f]",
        "        out.append({'ok': True, 'r': r})",
        "    except Exception as e:",
        "        out.append({'ok': False, 'r': '%s: %s' % (type(e).__name__, e)})",
        "print(json.dumps(out))",
      ].join("\n"),
    );
    const r = run("python3", [prog], { input: JSON.stringify(cases) });
    const mism: string[] = [];
    if (r.code !== 0) {
      mism.push(`python3 failed: ${r.err.slice(0, 300)}`);
    } else {
      const truth = JSON.parse(r.out) as Array<{ ok: boolean; r: unknown }>;
      for (let i = 0; i < cases.length; i++) {
        let mine: unknown;
        try {
          mine = runPort(cases[i]!);
        } catch (e) {
          mine = `Error: ${String((e as Error).message ?? e)}`;
        }
        const want = truth[i]!;
        if (JSON.stringify(mine) !== JSON.stringify(want.r)) {
          const c = cases[i]!;
          mism.push(
            `${c.id} ${c.op} ${JSON.stringify(c.s.slice(0, 50))}: port ${JSON.stringify(mine)} vs BASE ${JSON.stringify(want.r)}`,
          );
        }
      }
    }
    // doneOf wiring: the fixed DONE_RE parses clean details and rejects
    // run-ons (the regex itself is differenced above; this locks the call).
    const doneCases: Array<[Record<string, unknown>, string | null]> = [
      [
        {
          detail: "tool fault tf-abcdef12 filed in run abc123",
          actor: "postmaster",
          action: "ticket-create",
          target: "t",
        },
        "tf-abcdef12!abc123",
      ],
      [
        {
          detail: "tool fault tf-abcdef12 seen again in run abc123xyz",
          actor: "postmaster",
          action: "ticket-comment",
          target: "t",
        },
        null,
      ],
      [
        {
          detail: "tool fault tf-abcdef12 declined in run abc123é",
          actor: "postmaster",
          action: "note",
          target: "t",
        },
        null,
      ],
    ];
    for (const [entry, want] of doneCases) {
      const got = [...doneOf([entry]).keys()];
      const wantKeys = want === null ? [] : [want];
      if (JSON.stringify(got) !== JSON.stringify(wantKeys)) {
        mism.push(`doneOf ${JSON.stringify(entry.detail)}: got ${JSON.stringify(got)}`);
      }
    }
    st.check(
      `pattern parity with BASE (${cases.length} cases)`,
      mism.length === 0,
      mism.slice(0, 12).join("\n"),
    );
  }
}

// --- self-test -----------------------------------------------------------------------------------
// Runs a copy of postmaster's scripts and skills, whose checkout's origin is a stand-in GitHub
// repository, with a stub gh first on PATH that keeps its issues and comments in a file and
// records every issue it creates and every comment it adds, so nothing reaches GitHub. The
// target's names, paths, ids, words and a sentence of its ticket are made up afresh on each run,
// so that none of them is in postmaster's own text, this file included.
withTempDir((tmp) => {
  const T = join(tmp, "tool");
  const S = join(tmp, "stub");
  const RUNS = join(tmp, "runs");
  mkdirSync(join(T, "skills"), { recursive: true });
  mkdirSync(S, { recursive: true });
  mkdirSync(join(tmp, "bin"), { recursive: true });

  // Copy scripts and skills (plus the bunfig the copied wrappers resolve beside themselves)
  run("cp", ["-R", HERE, join(T, "scripts")]);
  copyFileSync(join(TOOL, "bunfig.toml"), join(T, "bunfig.toml"));
  run("cp", ["-R", join(TOOL, "skills/postmaster"), join(T, "skills/postmaster")]);
  run("git", ["-C", T, "init", "-q"]);
  run("git", ["-C", T, "remote", "add", "origin", "https://github.com/o/postmaster.git"]);

  // Write the stub gh
  const stubGh = join(tmp, "bin", "gh");
  writeFileSync(
    stubGh,
    `#!/usr/bin/env bun
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { casefold } from "${scriptsDir(import.meta)}/lib/text.ts";
const d = process.env.TOOL_FAULTS_STUB!;
const a = process.argv.slice(2);
const dbPath = d + "/db.json";
const db = JSON.parse(readFileSync(dbPath, "utf-8"));
function save() { writeFileSync(dbPath, JSON.stringify(db)); }
function arg(flag: string): string { const i = a.indexOf(flag); return i >= 0 ? a[i + 1] ?? "" : ""; }
function write(line: string) { appendFileSync(d + "/writes.log", line + "\\n"); }

if (a[0] === "auth" && a[1] === "status") process.exit(0);
if (a[0] === "api" && a[1] === "graphql") {
  const q = a.find((x: string) => x.startsWith("query=")) ?? "";
  if (q.includes("viewerPermission")) {
    console.log(JSON.stringify({ data: { repository: { viewerPermission: db.access } } }));
  } else if (q.includes("projectsV2")) {
    console.log(JSON.stringify({ data: { repository: { projectsV2: { nodes: [{ id: "PVT_1", number: 1, title: "postmaster", closed: false, url: "https://github.com/users/o/projects/1", owner: { login: "o" } }] } } } }));
  } else if (q.includes("issue(number:")) {
    const n = (a.find((x: string) => x.startsWith("number=")) ?? "").split("=")[1] ?? "";
    const i = db.issues[n];
    console.log(JSON.stringify({ data: { repository: { issue: i == null ? null : {
      number: parseInt(n), title: i.title, body: i.body, state: i.state, stateReason: null,
      url: "https://github.com/o/postmaster/issues/" + n, createdAt: "2026-01-01T00:00:00Z",
      labels: { nodes: [] },
      comments: { nodes: i.comments.map((c: string) => ({ body: c, createdAt: "2026-01-01T00:00:00Z", author: { login: "o" } })) },
    } } } }));
  } else {
    console.error("stub gh: unexpected query"); process.exit(1);
  }
} else if (a[0] === "search" && a[1] === "issues") {
  if (existsSync(d + "/no-search")) { console.error("stub gh: search is down"); process.exit(1); }
  const q = casefold((a[2] ?? "").replace(/^"|"$/g, ""));
  const hits = Object.entries(db.issues).filter(([n, i]: [string, any]) =>
    q in {} ? false : casefold(i.title + "\\n" + i.body + "\\n" + i.comments.join("\\n")).includes(q)
  ).map(([n, i]: [string, any]) => ({ number: parseInt(n), title: i.title, state: i.state }));
  console.log(JSON.stringify(hits));
} else if (a[0] === "project" && a[1] === "item-list") {
  console.log('{"items": []}');
} else if (a[0] === "project" && a[1] === "field-list") {
  console.log('{"fields": [{"id": "F1", "name": "Status", "options": [{"id": "o1", "name": "Todo"}, {"id": "o2", "name": "In Progress"}, {"id": "o3", "name": "Done"}]}]}');
} else if (a[0] === "project" && a[1] === "item-add") {
  if (existsSync(d + "/no-item-add")) { console.error("stub gh: item-add refused"); process.exit(1); }
  console.log('{"id": "PVTI_new"}');
} else if (a[0] === "project" && a[1] === "item-edit") {
  // pass
} else if (a[0] === "issue" && a[1] === "create") {
  const n = String(db.next); db.next += 1;
  db.issues[n] = { title: arg("--title"), body: readFileSync(arg("--body-file"), "utf-8"), state: "OPEN", comments: [] };
  save(); write("create #" + n + " " + arg("--title"));
  writeFileSync(d + "/created-" + n + ".md", db.issues[n].body);
  console.log("https://github.com/o/postmaster/issues/" + n);
} else if (a[0] === "issue" && a[1] === "comment") {
  db.issues[a[2]].comments.push(arg("--body")); save();
  write("comment #" + a[2] + " " + arg("--body"));
} else {
  console.error("stub gh: unexpected: " + a.join(" ")); process.exit(1);
}
`,
  );
  run("chmod", ["+x", stubGh]);

  const db = (access: string, ...rest: string[]): void => {
    const issues: Record<string, any> = {};
    for (let i = 0; i < rest.length; i += 4) {
      issues[rest[i]!] = {
        state: rest[i + 1],
        title: rest[i + 2],
        body: rest[i + 3],
        comments: [],
      };
    }
    writeFileSync(join(S, "db.json"), JSON.stringify({ access, next: 60, issues }));
  };

  const tf = (...args: string[]): RunR => {
    return run("bash", [join(T, "scripts", "tool-faults.sh"), ...args], {
      env: { ...process.env, PATH: `${join(tmp, "bin")}:${process.env.PATH}`, TOOL_FAULTS_STUB: S },
    });
  };

  const logf = (d: string, ...args: string[]): void => {
    run("bash", [join(T, "scripts", "log-action.sh"), d, ...args]);
  };

  const writes = (prefix: string): number => {
    try {
      return readFileSync(join(S, "writes.log"), "utf-8")
        .split("\n")
        .filter((l) => l.startsWith(`${prefix} `)).length;
    } catch {
      return 0;
    }
  };

  // Random name generators
  const rand = (n: number, chars = "abcdefghijklmnopqrstuvwxyz"): string => {
    let s = "";
    for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };

  const NAME = `zq${rand(6)}`;
  // ASCII: NAME is rand() lowercase, uppercased for ticket keys below.
  const NAME_UP = NAME.toUpperCase();
  const OWNER = `yq${rand(6)}`;
  const WORD = `xq${rand(6)}`;
  const IDENT = `vq${rand(5)}Totals`;
  const IDENT2 = `wq${rand(5)}Revenue`;
  const UUID = crypto.randomUUID
    ? crypto.randomUUID()
    : `${rand(8)}-${rand(4)}-${rand(4)}-${rand(4)}-${rand(12)}`;
  const HOMEP = `/home/wq${rand(5)}/code/${NAME}/${UUID}`;
  const SECRET = rand(32, "0123456789abcdef");
  const CYR = rand(7, "абвгдежзиклмнопрстуфхцчшщ");
  const CYR2 = rand(7, "αβγδεζηθικλμνξπρστυφχψω");
  const KEYX = `QZ${rand(3, "ABCDEFGHJKLMNPRSTUVWXYZ")}-${rand(3, "123456789")}`;
  const PROPER = `Q${rand(7)}`;
  const EMAIL = `jq${rand(5)}@kq${rand(5)}.example`;
  const IP = `10.${rand(2, "123456789")}.${rand(2, "123456789")}.${rand(2, "123456789")}`;
  const NG = ["column", "harness", "before", "board", "lane", "every", "merge"];
  const SENTENCE = `${NG[6]} ${NG[5]} ${NG[4]} ${NG[3]} ${NG[2]} the ${NG[1]} ${NG[0]}`;
  const TICKET = `${NAME_UP}-12`;
  const REPO = join(tmp, "home", "My Code", NAME);
  mkdirSync(REPO, { recursive: true });
  run("git", ["-C", REPO, "init", "-q"]);
  run("git", ["-C", REPO, "remote", "add", "origin", `https://github.com/${OWNER}/${NAME}.git`]);

  const PLANTED = [
    NAME,
    OWNER,
    WORD,
    IDENT,
    IDENT2,
    HOMEP,
    REPO,
    TICKET,
    SENTENCE,
    `${NG[6]} ${NG[5]} ${NG[4]} ${NG[3]}`,
    UUID.split("-")[0]!,
    UUID.split("-").pop()!,
    SECRET,
    CYR,
    CYR2,
    KEYX,
    EMAIL,
    IP,
    PROPER,
  ];

  // BASE's `leaks()` is `grep -qiF`, whose case-insensitivity is the C
  // library's locale-defined 1:1 matching — not lowercasing and not
  // casefold (it equates σ/ς/Σ but neither ß/s nor i/İ). Spawning the
  // same binary under the same environment is the only exact port, so
  // this runs grep itself, one marker at a time, matching on status.
  // The markers parameter exists for the control; production passes
  // the planted set.
  const leaks = (text: string, markers: string[] = PLANTED): string[] => {
    return markers.filter((p) => run("grep", ["-qiF", "--", p], { input: text }).code === 0);
  };

  const newrun = (project: string, ticket: string, stage: string): string => {
    const d = join(RUNS, project, ticket);
    mkdirSync(d, { recursive: true });
    writeFileSync(
      join(d, "brief.md"),
      `# Waybill: ${ticket}\n\n## Ticket\nThe ${WORD} ledger for ${NAME}: ${SENTENCE}. ${CYR}.\n\nrepo: ${T}\n\n## Project profile\nrepo: ${REPO}          default branch: main       BASE: 0123abc\n`,
    );
    writeFileSync(
      join(d, "manifest.json"),
      `${JSON.stringify({ stage, leg: 3, base: "0123abc", lanes: {}, coachman: { legs: {} } })}\n`,
    );
    writeFileSync(
      join(d, "run.json"),
      `${JSON.stringify({
        postmaster: {
          commit: "89abcdef0123456789abcdef0123456789abcdef",
          uncommitted_changes: false,
        },
      })}\n`,
    );
    return d;
  };

  const lineOf = (out: string, id: string): string => {
    return out.split("\n").find((l) => l.startsWith(`${id}  `)) || "";
  };

  const idWhere = (out: string, pattern: string): string => {
    const re = new RegExp(`^tf-[0-9a-f]{8}  ${pattern}`);
    const line = out.split("\n").find((l) => re.test(l));
    return line ? line.slice(0, 11) : "";
  };

  const stateOf = (d: string, id: string): string => {
    try {
      const st = JSON.parse(readFileSync(join(d, "tool-faults.json"), "utf-8"));
      return (st.faults || [])
        .filter((x: any) => x.id === id)
        .map((x: any) => x.state)
        .join(" ");
    } catch {
      return "";
    }
  };

  const draftOf = (d: string, id: string): string => {
    const st = JSON.parse(readFileSync(join(d, "tool-faults.json"), "utf-8"));
    const x = (st.faults || []).filter((x: any) => x.id === id).pop();
    return join(d, x.draft);
  };

  const draftsAll = (): string => {
    const out: string[] = [];
    const walk = (dir: string) => {
      try {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const p = join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else if (
            (e.name.endsWith(".md") || e.name.endsWith(".title")) &&
            p.split(sep).includes("tool-faults")
          )
            out.push(readFileSync(p, "utf-8"));
        }
      } catch {
        /* empty */
      }
    };
    walk(RUNS);
    return out.join("");
  };

  const st = new SelfTest();

  // Set up the main run
  const d = newrun(NAME, TICKET, "done");
  logf(d, "postmaster", "dispatch", TICKET, "leg 1");
  logf(
    d,
    "coachman",
    "tool-fault",
    "scripts/wait-for-markers.sh",
    "--ran",
    `scripts/wait-for-markers.sh ${REPO}/logs 'r1-*.done' 3 2400`,
    "--failed",
    `returned before 1 of 3 markers were in ${HOMEP}/logs`,
    "--error",
    `exit 0; ${NAME} has 1 marker`,
    "--diagnosis",
    `\`${IDENT}\` wrote its marker early`,
    "--fix",
    "count only regular files, with find -type f",
  );
  logf(d, "coachman", "escalate", "scripts/wait-for-markers.sh", "the wait is a control");
  logf(
    d,
    "coachman",
    "tool-fault",
    `${T}/scripts/wait-for-markers.sh`,
    "--ran",
    "the same wait, round 2",
    "--failed",
    "Returned before 2 of 3 markers were in /elsewhere/logs.",
    "--error",
    "none",
    "--diagnosis",
    "same",
    "--fix",
    "count only regular files, with find -type f",
  );
  logf(
    d,
    "coachman",
    "tool-fault",
    "scripts/wait-for-markers.sh",
    "--ran",
    "the same wait, round 3",
    "--failed",
    `returned before 1 of 3 markers were in ${HOMEP}/logs`,
    "--error",
    "none",
    "--diagnosis",
    "same",
    "--fix",
    "count only regular files",
  );
  logf(
    d,
    "coachman",
    "tool-fault",
    "skills/postmaster/harnesses.md",
    "--ran",
    `resume of ${TICKET}'s leg 2`,
    "--failed",
    `the resume form hung while the ${WORD} ledger was open, reading src/${WORD}/billing.ts in ${NAME} of ${OWNER} for ${PROPER}, ${CYR} and ${CYR2} and ${KEYX}, mailed to ${EMAIL}, after scripts/ticket-check.sh quoted: ${SENTENCE}`,
    "--error",
    `timeout after 600s in ${HOMEP}`,
    "--diagnosis",
    `the prompt went to ${OWNER}/${NAME}`,
    "--fix",
    `pass the prompt on stdin, as for \`${IDENT}\` and cfg[${IDENT2}] in ${HOMEP}/src at ${IP}, key ${SECRET}; see https://github.com/${OWNER}/${NAME}`,
    "--workaround",
    "resumed by hand in the recorded form",
  );
  logf(
    d,
    "coachman",
    "tool-fault",
    "scripts/wait-for-markers.sh",
    "--ran",
    "wait, round 4",
    "--failed",
    "counted a directory named like a marker",
    "--error",
    "none",
    "--diagnosis",
    "find has no -type",
    "--fix",
    "add -type f to the find",
  );
  logf(d, "postmaster", "escalate", TICKET, "a scope ruling, about nothing here");
  logf(
    d,
    "coachman",
    "tool-fault",
    "skills/postmaster/coachman.md",
    "--ran",
    "stage 2",
    "--failed",
    "the step runs scripts/stage.sh with a flag it does not take",
    "--error",
    "none",
    "--diagnosis",
    "x",
    "--fix",
    "drop the flag",
    "--control",
    "action-log",
  );
  logf(
    d,
    "coachman",
    "tool-fault",
    "skills/postmaster/coachman.md",
    "--ran",
    "stage 2",
    "--failed",
    "the step runs scripts/handoff-check.sh with a flag it does not take",
    "--error",
    "none",
    "--diagnosis",
    "x",
    "--fix",
    "drop the flag",
    "--control",
    "check",
  );
  logf(d, "coachman", "ticket-comment", TICKET, "ready to merge");
  appendFileSync(join(d, "actions.jsonl"), "this line is not JSON\n");
  appendFileSync(
    join(d, "actions.jsonl"),
    '{"ts":"2026-01-01T00:00:00Z","project":"p","run":"r","actor":"coachman","action":"note","target":"x","detail":"a raw \\u2028 line separator"}\n',
  );

  // --- positive controls ---
  console.log("positive controls");
  db("ADMIN", "12", "OPEN", "An ordinary issue", "Nothing to do with faults.");
  let outR = tf("harvest", d);
  let out = outR.out + outR.err;
  let rc = outR.code;
  const A = idWhere(out, String.raw`scripts/wait-for-markers.sh  control \(wait\)  3 times`);
  const B = idWhere(out, "skills/postmaster/harnesses.md");
  const C = idWhere(out, String.raw`scripts/wait-for-markers.sh  control \(wait\)  once`);
  const D1 = idWhere(out, String.raw`skills/postmaster/coachman.md  control \(action-log\)`);
  const D2 = idWhere(out, String.raw`skills/postmaster/coachman.md  control \(check\)`);
  const faultCount = out.split("\n").filter((l) => /^tf-[0-9a-f]{8} {2}/.test(l)).length;
  st.check(
    "seven fault lines are five faults: one seen three ways, and two naming different scripts kept apart",
    rc === 0 &&
      faultCount === 5 &&
      !!(A && B && C && D1 && D2) &&
      D1.length === 11 &&
      D2.length === 11 &&
      D1 !== D2,
    `exit ${rc}, ${faultCount} faults, A=${A} B=${B} C=${C} D1=${D1} D2=${D2}`,
  );
  const badLineCount = out
    .split("\n")
    .filter((l) => l.includes("is not a log line, and was left out")).length;
  st.check(
    "a line that is not JSON is left out, and said so; one with a raw line separator is read",
    badLineCount === 1,
    out,
  );
  {
    const rid = out.split(" ")[1]?.replace(/:/, "") || "";
    const logContent = readFileSync(join(d, "actions.jsonl"), "utf-8");
    st.check(
      "the harvest logs what it found",
      logContent.includes(
        `"action":"note","target":"${rid}","detail":"tool faults harvested: 5, 5 new"`,
      ),
      logContent.split("\n").slice(-2).join("\n"),
    );
  }
  {
    const bDraft = draftOf(d, B);
    const bLine = lineOf(out, B);
    st.check(
      "a fault no ticket holds is new, and its line names its draft",
      stateOf(d, B) === "new" && existsSync(bDraft) && bLine.includes("new  tool-faults/"),
      `state=${stateOf(d, B)} draft=${bDraft} line=${bLine}`,
    );
  }
  {
    const cLine = out
      .split("\n")
      .find(
        (l) =>
          l ===
          `  ${C}: a fault in a control, and the log has no escalate naming its file after it`,
      );
    const aLine = out.includes(`  ${A}: a fault in a control, and`);
    const aDraft = readFileSync(draftOf(d, A), "utf-8");
    const cDraft = readFileSync(draftOf(d, C), "utf-8");
    st.check(
      "only an escalate naming the fault's file counts as its escalation",
      !!cLine &&
        !aLine &&
        aDraft.includes("The run stopped and escalated.") &&
        !cDraft.includes("The run stopped and escalated."),
      out,
    );
  }
  {
    let shape = 0;
    for (const fid of [A, B, C]) {
      const f = draftOf(d, fid);
      const r = run("bash", [
        join(T, "scripts", "ticket-check.sh"),
        "--body",
        f,
        "--title",
        readFileSync(f.replace(/\.md$/, ".title"), "utf-8").trim(),
      ]);
      if (r.code !== 0) shape++;
      if (!readFileSync(f, "utf-8").split("\n").includes("## Turnpikes")) shape++;
    }
    st.check(
      "each draft is in the ticket shape, with its turnpikes, and passes scripts/ticket-check.sh",
      shape === 0,
      `${shape} fail`,
    );
  }
  {
    const rid = JSON.parse(readFileSync(join(d, "tool-faults.json"), "utf-8")).runs.pop().run_id;
    const aDraft = readFileSync(draftOf(d, A), "utf-8");
    st.check(
      "a draft names the run by its public id, and the postmaster it ran",
      aDraft.includes(`It was seen 3 times in run ${rid}, which ran postmaster 89abcdef0123.`),
      aDraft,
    );
  }
  {
    const bMd = draftOf(d, B);
    const bTitle = readFileSync(bMd.replace(/\.md$/, ".title"), "utf-8");
    const bBody = readFileSync(bMd, "utf-8");
    const all = bTitle + bBody;
    const marks = [
      "path",
      "project",
      "code",
      "link",
      "withheld",
      "ticket text",
      "ticket",
      "address",
    ];
    const marked = marks.every((m) => all.includes(`[${m}]`));
    st.check(
      "postmaster's own files and words are kept, and what is withheld is marked",
      bTitle.includes("skills/postmaster/harnesses.md") &&
        bBody.includes("pass the prompt on stdin") &&
        bBody.includes("scripts/ticket-check.sh") &&
        marked,
      `${bTitle}\n${bBody}`,
    );
  }
  // Re-harvest with known tickets
  db(
    "ADMIN",
    "12",
    "OPEN",
    "An ordinary issue",
    "Nothing to do with faults.",
    "57",
    "OPEN",
    `Tool fault in scripts/wait-for-markers.sh: returned early [${A}]`,
    "A body.",
    "58",
    "OPEN",
    "Retitled by hand",
    `Tool fault id: \`${D1}\`.`,
  );
  outR = tf("harvest", d);
  out = outR.out + outR.err;
  {
    const aLine = lineOf(out, A);
    const cLine = lineOf(out, C);
    const d1Line = lineOf(out, D1);
    const bLine = lineOf(out, B);
    st.check(
      "a ticket holding the id in its title or its body is known; one only like it is not; a draft already shown is asked",
      / known #57 \(open\)$/.test(aLine) &&
        / asked, like #57 {2}tool-faults\//.test(cLine) &&
        / known #58 \(open\)$/.test(d1Line) &&
        / asked {2}tool-faults\//.test(bLine),
      out,
    );
  }
  // comment
  writeFileSync(join(S, "writes.log"), "");
  outR = tf("comment", d, A);
  out = outR.out + outR.err;
  rc = outR.code;
  {
    const logContent = readFileSync(join(d, "actions.jsonl"), "utf-8");
    const writesLog = readFileSync(join(S, "writes.log"), "utf-8");
    const rid = JSON.parse(readFileSync(join(d, "tool-faults.json"), "utf-8")).runs.pop().run_id;
    st.check(
      "comment says once, on the ticket that holds it, that it was seen again, and logs it",
      rc === 0 &&
        writes("comment") === 1 &&
        writesLog.includes("comment #57 ") &&
        writesLog.includes(`tool fault ${A} seen again: 3 times in run ${rid}`) &&
        logContent.includes(`"target":"#57","detail":"tool fault ${A} seen again in run ${rid}`),
      `exit ${rc}\n${writesLog}\n${out}`,
    );
  }
  outR = tf("comment", d, C, "12");
  out = outR.out + outR.err;
  rc = outR.code;
  {
    const writesLog = readFileSync(join(S, "writes.log"), "utf-8");
    const rid = JSON.parse(readFileSync(join(d, "tool-faults.json"), "utf-8")).runs.pop().run_id;
    const lastLine = writesLog.trim().split("\n").pop() || "";
    st.check(
      "on the user's word that a ticket holds a new fault, comment names it there",
      rc === 0 &&
        lastLine.includes("comment #12 ") &&
        lastLine.includes(`tool fault ${C} seen again: once in run ${rid}`),
      `exit ${rc}\n${writesLog}`,
    );
  }
  // file
  const bMdPath = draftOf(d, B);
  outR = tf("file", d, B);
  out = outR.out + outR.err;
  rc = outR.code;
  {
    const writesLog = readFileSync(join(S, "writes.log"), "utf-8");
    const created = readFileSync(join(S, "created-60.md"), "utf-8");
    const bBody = readFileSync(bMdPath, "utf-8");
    const logContent = readFileSync(join(d, "actions.jsonl"), "utf-8");
    const rid = JSON.parse(readFileSync(join(d, "tool-faults.json"), "utf-8")).runs.pop().run_id;
    st.check(
      "file files the draft as it is, once, and logs the new ticket",
      rc === 0 &&
        writes("create") === 1 &&
        created === bBody &&
        out.trim() === `${B}: filed as #60` &&
        logContent.includes(`"target":"#60","detail":"tool fault ${B} filed in run ${rid}`),
      `exit ${rc}\n${out}\n${writesLog}`,
    );
  }
  tf("comment", d, D1);
  outR = tf("decline", d, D2, "the user: not worth a ticket");
  out = outR.out + outR.err;
  rc = outR.code;
  {
    const logContent = readFileSync(join(d, "actions.jsonl"), "utf-8");
    const rid = JSON.parse(readFileSync(join(d, "tool-faults.json"), "utf-8")).runs.pop().run_id;
    st.check(
      "decline records the user's no, and files nothing",
      rc === 0 &&
        writes("create") === 1 &&
        logContent.includes(
          `"target":"${D2}","detail":"tool fault ${D2} declined in run ${rid}, by the user: the user: not worth a ticket"`,
        ),
      `exit ${rc}\n${out}`,
    );
  }
  // later harvest reads from log
  {
    const stateWas = readFileSync(join(d, "tool-faults.json"), "utf-8");
    const stObj = JSON.parse(stateWas);
    for (const x of stObj.faults) x.state = "new";
    writeFileSync(join(d, "tool-faults.json"), JSON.stringify(stObj));
    outR = tf("harvest", d);
    out = outR.out + outR.err;
    const checks = [
      `${A} commented #57`,
      `${B} filed #60`,
      `${C} commented #12`,
      `${D1} commented #58`,
      `${D2} declined`,
    ];
    let allOk = true;
    for (const f of checks) {
      const [id, ...rest] = f.split(" ");
      const want = rest.join(" ");
      const line = out.split("\n").find((l) => l.startsWith(`${id}  `));
      if (!line?.trim().endsWith(want)) {
        allOk = false;
        break;
      }
    }
    st.check(
      "a later harvest reads what was done from the run's log, not its state file",
      allOk,
      out,
    );
  }
  // later run
  const again = newrun(NAME, `${NAME_UP}-16`, "done");
  logf(
    again,
    "coachman",
    "tool-fault",
    "scripts/wait-for-markers.sh",
    "--ran",
    "wait",
    "--failed",
    "counted a directory named like a marker",
    "--error",
    "none",
    "--diagnosis",
    "find has no -type",
    "--fix",
    "add -type f to the find",
    "--control",
    "wait",
  );
  // set issue 12 to CLOSED
  {
    const dbObj = JSON.parse(readFileSync(join(S, "db.json"), "utf-8"));
    dbObj.issues["12"].state = "CLOSED";
    writeFileSync(join(S, "db.json"), JSON.stringify(dbObj));
  }
  outR = tf("harvest", again);
  out = outR.out + outR.err;
  {
    const cLine = lineOf(out, C);
    st.check(
      "in a later run, a fault a comment names on any ticket is known there",
      / known #12 \(closed\)$/.test(cLine),
      out,
    );
  }
  outR = tf("comment", again, C);
  out = outR.out + outR.err;
  rc = outR.code;
  {
    const writesLog = readFileSync(join(S, "writes.log"), "utf-8");
    const lastLine = writesLog.trim().split("\n").pop() || "";
    st.check(
      "a comment on a closed ticket says it is closed",
      rc === 0 && lastLine.includes("comment #12 ") && lastLine.includes("This ticket is closed."),
      `exit ${rc}\n${lastLine}`,
    );
  }
  // postmaster's own faults
  const pmDir = join(RUNS, NAME, "postmaster");
  mkdirSync(pmDir, { recursive: true });
  logf(
    pmDir,
    "postmaster",
    "tool-fault",
    "scripts/runs-status.sh",
    "--ran",
    "the poll",
    "--failed",
    "listed a run twice",
    "--error",
    "none",
    "--diagnosis",
    "x",
    "--fix",
    "list each once",
  );
  outR = tf("harvest", pmDir);
  out = outR.out + outR.err;
  const P = idWhere(out, "scripts/runs-status.sh");
  outR = tf("file", pmDir, P);
  out = outR.out + outR.err;
  // close issue 61
  {
    const dbObj = JSON.parse(readFileSync(join(S, "db.json"), "utf-8"));
    dbObj.issues["61"].state = "CLOSED";
    writeFileSync(join(S, "db.json"), JSON.stringify(dbObj));
  }
  logf(
    pmDir,
    "postmaster",
    "tool-fault",
    "scripts/runs-status.sh",
    "--ran",
    "the poll, later",
    "--failed",
    "listed a run twice",
    "--error",
    "none",
    "--diagnosis",
    "x",
    "--fix",
    "list each once",
  );
  outR = tf("harvest", pmDir);
  out = outR.out + outR.err;
  const P2 = idWhere(out, "scripts/runs-status.sh");
  const PR = JSON.parse(readFileSync(join(pmDir, "tool-faults.json"), "utf-8")).runs.length;
  {
    const pLine = lineOf(out, P);
    st.check(
      "the postmaster's own faults: a recurrence after its ticket is filed is a new harvest, and known",
      P2 === P && PR === 2 && /once {2}known #61 \(closed\)$/.test(pLine),
      out,
    );
  }
  // draft checks
  const notesDir = newrun("notes", "IT-12", "done");
  writeFileSync(join(S, "writes.log"), "");
  const PAY = ["late", "was", "it", "refused", "payment"];
  appendFileSync(
    join(notesDir, "brief.md"),
    `The ${PAY[4]} ${PAY[1]} ${PAY[3]} ${PAY[2]} ${PAY[1]} ${PAY[0]}.\n`,
  );
  logf(
    notesDir,
    "coachman",
    "tool-fault",
    "scripts/launch.sh",
    "--ran",
    "launch",
    "--failed",
    "the stream flag was refused",
    "--error",
    "none",
    "--diagnosis",
    "renamed",
    "--fix",
    "use the new flag",
  );
  logf(
    notesDir,
    "coachman",
    "tool-fault",
    "scripts/cut-scratch.sh",
    "--ran",
    "cut",
    "--failed",
    "cloned a directory twice",
    "--error",
    "none",
    "--diagnosis",
    "a loop",
    "--fix",
    "clone each once",
  );
  outR = tf("harvest", notesDir);
  out = outR.out + outR.err;
  const N1 = idWhere(out, "scripts/launch.sh");
  const N2 = idWhere(out, "scripts/cut-scratch.sh");
  outR = tf("file", notesDir, N1);
  out = outR.out + outR.err;
  rc = outR.code;
  {
    const n1Draft = draftOf(notesDir, N1);
    const n1Body = readFileSync(n1Draft, "utf-8");
    st.check(
      "a draft as the harvest wrote it is filed as written, though a check of the whole would withhold a phrase",
      rc === 0 && writes("create") === 1 && n1Body.split("\n").includes("## Notes"),
      `exit ${rc}\n${out}`,
    );
  }
  appendFileSync(draftOf(notesDir, N2), "It was seen on a quiet day.\n");
  outR = tf("file", notesDir, N2);
  out = outR.out + outR.err;
  rc = outR.code;
  st.check(
    "a changed draft is filed when it is still safe, in a project named with words postmaster uses",
    rc === 0 && writes("create") === 2,
    `exit ${rc}\n${out}`,
  );
  {
    const pad = "the step ran on ".repeat(10).slice(0, 70);
    logf(
      notesDir,
      "coachman",
      "tool-fault",
      "skills/postmaster/coachman.md",
      "--ran",
      "stage 2",
      "--failed",
      `${pad} then scripts/wait-for-markers.sh waited for ever`,
      "--error",
      "none",
      "--diagnosis",
      "x",
      "--fix",
      "bound the wait",
      "--control",
      "wait",
    );
  }
  outR = tf("harvest", notesDir);
  out = outR.out + outR.err;
  const N3 = idWhere(out, "skills/postmaster/coachman.md");
  appendFileSync(draftOf(notesDir, N3), "It was seen once more.\n");
  outR = tf("file", notesDir, N3);
  out = outR.out + outR.err;
  rc = outR.code;
  st.check(
    "a title is cut between words, so a changed draft keeps its paths whole",
    rc === 0 && writes("create") === 3,
    `exit ${rc}\n${out}`,
  );
  // control kinds
  const kindsDir = newrun(NAME, `${NAME_UP}-19`, "done");
  writeFileSync(
    join(kindsDir, "actions.jsonl"),
    '{"ts":"2026-01-01T00:00:00Z","project":"p","run":"r","actor":"coachman","action":"tool-fault","target":"scripts/wait-for-markers.sh","detail":"waited on the wrong folder","fault":{"ran":"x","failed":"waited on the wrong folder","error":"none","diagnosis":"x","fix":"y","workaround":"","control":"gate"}}\n' +
      '{"ts":"2026-01-01T00:00:00Z","project":"p","run":"r","actor":"coachman","action":"tool-fault","target":"scripts/log-action.sh","detail":"wrote nothing","fault":{"ran":"x","failed":"wrote nothing","error":"none","diagnosis":"x","fix":"y","workaround":"","control":""}}\n',
  );
  outR = tf("harvest", kindsDir);
  out = outR.out + outR.err;
  st.check(
    "a fault keeps the kind of control its line recorded; with none recorded, the list's",
    /^tf-[0-9a-f]{8} {2}scripts\/wait-for-markers\.sh {2}control \(gate\) {2}once/m.test(out) &&
      /^tf-[0-9a-f]{8} {2}scripts\/log-action\.sh {2}control \(action-log\) {2}once/m.test(out),
    out,
  );
  // long token
  const longDir = newrun(NAME, `${NAME_UP}-20`, "done");
  logf(
    longDir,
    "coachman",
    "tool-fault",
    "scripts/launch.sh",
    "--ran",
    "x",
    "--failed",
    `choked on ${rand(100000, "abcdefghij")}`,
    "--error",
    "none",
    "--diagnosis",
    "x",
    "--fix",
    "y",
  );
  const startSec = Date.now();
  outR = tf("harvest", longDir);
  out = outR.out + outR.err;
  rc = outR.code;
  const elapsed = (Date.now() - startSec) / 1000;
  st.check(
    "a fault with a 100,000-character token is harvested in seconds",
    rc === 0 && elapsed < 25,
    `exit ${rc}, ${elapsed.toFixed(1)}s`,
  );
  // fault the log no longer gives
  {
    const stObj = JSON.parse(readFileSync(join(longDir, "tool-faults.json"), "utf-8"));
    stObj.faults.push({ ...stObj.faults[0], id: "tf-0badf00d", state: "new" });
    writeFileSync(join(longDir, "tool-faults.json"), JSON.stringify(stObj));
    outR = tf("comment", longDir, "tf-0badf00d");
    out = outR.out + outR.err;
    rc = outR.code;
    st.check(
      "a fault the log no longer gives is refused by name",
      rc === 1 && out.includes("no longer gives tf-0badf00d") && !out.includes("Traceback"),
      `exit ${rc}\n${out}`,
    );
  }
  // board
  const boardDir = newrun(NAME, `${NAME_UP}-17`, "done");
  writeFileSync(join(S, "writes.log"), "");
  logf(
    boardDir,
    "coachman",
    "tool-fault",
    "scripts/cut-scratch.sh",
    "--ran",
    "cut",
    "--failed",
    "cloned no dependency directory",
    "--error",
    "none",
    "--diagnosis",
    "x",
    "--fix",
    "clone them",
  );
  outR = tf("harvest", boardDir);
  out = outR.out + outR.err;
  const K1 = idWhere(out, "scripts/cut-scratch.sh");
  writeFileSync(join(S, "no-item-add"), "");
  outR = tf("file", boardDir, K1);
  out = outR.out + outR.err;
  rc = outR.code;
  rmSync(join(S, "no-item-add"), { force: true });
  outR = tf("harvest", boardDir);
  const out2 = outR.out + outR.err;
  {
    const k1Line = out2.split("\n").find((l) => l.startsWith(`${K1}  `)) || "";
    st.check(
      "a ticket created but not put on the board is still filed, and logged",
      rc === 0 && out.includes("it is not on the board") && / filed #6[0-9]$/.test(k1Line.trim()),
      `exit ${rc}\n${out}\n${out2}`,
    );
  }
  st.check(
    "the leak check finds a planted piece",
    leaks(`zz ${NAME} zz`).length > 0,
    `NAME=${NAME}`,
  );

  // --- negative controls ---
  console.log("negative controls");
  {
    const all =
      draftsAll() +
      readFileSync(join(S, "writes.log"), "utf-8") +
      readdirSync(S)
        .filter((f) => f.startsWith("created-"))
        .map((f) => readFileSync(join(S, f), "utf-8"))
        .join("");
    const l = leaks(all);
    st.check(
      "no planted name, path, id, word, key, address, code or ticket text reaches a draft, a ticket or a comment",
      l.length === 0,
      l.join("\n"),
    );
  }
  writeFileSync(join(S, "writes.log"), "");
  outR = tf("comment", d, A);
  const rc1 = outR.code;
  const out1 = outR.out + outR.err;
  outR = tf("file", d, B);
  const rc2 = outR.code;
  const out2b = outR.out + outR.err;
  {
    const writesLog = readFileSync(join(S, "writes.log"), "utf-8");
    st.check(
      "a second comment or file says it is done, and writes nothing",
      rc1 === 0 &&
        rc2 === 0 &&
        out1.trim() === `${A}: already commented #57` &&
        out2b.trim() === `${B}: already filed #60` &&
        writesLog.trim() === "",
      `(${rc1}, ${rc2})\n${out1}\n${out2b}`,
    );
  }
  {
    const cleanDir = newrun(NAME, `${NAME_UP}-13`, "done");
    logf(cleanDir, "coachman", "note", TICKET, "nothing went wrong");
    outR = tf("harvest", cleanDir);
    out = outR.out + outR.err;
    rc = outR.code;
    const rid = JSON.parse(readFileSync(join(cleanDir, "tool-faults.json"), "utf-8")).runs.pop()
      .run_id;
    st.check(
      "a clean log yields no fault and no draft",
      rc === 0 &&
        out.trim() === `run ${rid}: no tool faults` &&
        !existsSync(join(cleanDir, "tool-faults")),
      `exit ${rc}\n${out}`,
    );
  }
  {
    const openDir = newrun(NAME, `${NAME_UP}-14`, "review");
    logf(
      openDir,
      "coachman",
      "tool-fault",
      "scripts/launch.sh",
      "--ran",
      "x",
      "--failed",
      "y",
      "--error",
      "none",
      "--diagnosis",
      "z",
      "--fix",
      "w",
    );
    outR = tf("harvest", openDir);
    out = outR.out + outR.err;
    rc = outR.code;
    st.check(
      "a run still open is not harvested",
      rc === 1 && out.includes("still open") && !existsSync(join(openDir, "tool-faults.json")),
      `exit ${rc}\n${out}`,
    );
  }
  const mineDir = newrun(NAME, `${NAME_UP}-15`, "abandoned");
  logf(
    mineDir,
    "coachman",
    "tool-fault",
    "scripts/launch.sh",
    "--ran",
    "launch",
    "--failed",
    "the model flag was refused",
    "--error",
    "none",
    "--diagnosis",
    "renamed",
    "--fix",
    "use the new flag",
  );
  // set access to READ
  {
    const dbObj = JSON.parse(readFileSync(join(S, "db.json"), "utf-8"));
    dbObj.access = "READ";
    writeFileSync(join(S, "db.json"), JSON.stringify(dbObj));
  }
  outR = tf("harvest", mineDir);
  out = outR.out + outR.err;
  rc = outR.code;
  const F = idWhere(out, "scripts/launch.sh");
  st.check(
    "a repository the user does not own is no tracker: the faults are kept",
    rc === 0 &&
      out.includes("the user does not own postmaster's repository") &&
      stateOf(mineDir, F) === "kept",
    `exit ${rc}\n${out}`,
  );
  outR = tf("file", mineDir, F);
  out = outR.out + outR.err;
  rc = outR.code;
  {
    const writesLog = readFileSync(join(S, "writes.log"), "utf-8");
    st.check(
      "and nothing is filed there",
      rc === 1 && out.includes("no tracker of postmaster's own") && writesLog.trim() === "",
      `exit ${rc}\n${out}`,
    );
  }
  // restore ADMIN
  {
    const dbObj = JSON.parse(readFileSync(join(S, "db.json"), "utf-8"));
    dbObj.access = "ADMIN";
    writeFileSync(join(S, "db.json"), JSON.stringify(dbObj));
  }
  // vendored copy
  mkdirSync(join(REPO, "tools/postmaster"), { recursive: true });
  run("cp", ["-R", join(T, "scripts"), join(REPO, "tools/postmaster/")]);
  run("cp", ["-R", join(T, "skills"), join(REPO, "tools/postmaster/")]);
  copyFileSync(join(T, "bunfig.toml"), join(REPO, "tools/postmaster/bunfig.toml"));
  const vendDir = newrun(NAME, `${NAME_UP}-18`, "done");
  logf(
    vendDir,
    "coachman",
    "tool-fault",
    "scripts/launch.sh",
    "--ran",
    "launch",
    "--failed",
    `the effort flag was refused for ${NAME}`,
    "--error",
    "none",
    "--diagnosis",
    "x",
    "--fix",
    "use the new flag",
  );
  outR = run("bash", [join(REPO, "tools/postmaster/scripts/tool-faults.sh"), "harvest", vendDir], {
    env: { ...process.env, PATH: `${join(tmp, "bin")}:${process.env.PATH}`, TOOL_FAULTS_STUB: S },
  });
  out = outR.out + outR.err;
  rc = outR.code;
  {
    const draftsContent = (() => {
      try {
        return readdirSync(join(vendDir, "tool-faults"), { recursive: true })
          .map((f) => {
            try {
              return readFileSync(join(vendDir, "tool-faults", String(f)), "utf-8");
            } catch {
              return "";
            }
          })
          .join("");
      } catch {
        return "";
      }
    })();
    st.check(
      "a copy of postmaster inside the target is no tracker, and withholds the target all the same",
      rc === 0 &&
        out.includes("not a git checkout of its own") &&
        leaks(draftsContent).length === 0,
      `exit ${rc}\n${out}`,
    );
  }
  // no-search
  outR = tf("harvest", mineDir);
  writeFileSync(join(S, "no-search"), "");
  outR = tf("harvest", mineDir);
  outR = tf("file", mineDir, F);
  out = outR.out + outR.err;
  rc = outR.code;
  rmSync(join(S, "no-search"), { force: true });
  {
    const writesLog = readFileSync(join(S, "writes.log"), "utf-8");
    st.check(
      "a tracker that cannot be searched leaves the fault unchecked, and nothing is filed",
      stateOf(mineDir, F) === "unchecked" &&
        rc === 1 &&
        out.includes("could not be read, so nothing is filed") &&
        writesLog.trim() === "",
      `exit ${rc}\n${out}`,
    );
  }
  // unsafe draft
  appendFileSync(draftOf(mineDir, F), `\`${IDENT}\` is the one to fix\n`);
  outR = tf("file", mineDir, F);
  out = outR.out + outR.err;
  rc = outR.code;
  {
    const writesLog = readFileSync(join(S, "writes.log"), "utf-8");
    st.check(
      "file refuses a draft changed to carry the target's code",
      rc === 2 && writesLog.trim() === "" && out.includes("not safe to publish"),
      `exit ${rc}\n${out}`,
    );
  }

  // Fault ids are BASE's sha256 over "file\nkey", first 8 hex digits; a draft's
  // digest is sha256 over title, NUL, body. Both pin to goldens captured from
  // python3's hashlib once, on 2026-09-29: the same inputs must give the same
  // id on both sides, or a run across the cutover files under another fault's
  // name. Regenerate under python3 with -c and, respectively:
  //   "import hashlib; print('tf-'+hashlib.sha256(b'<file>\n<key>').hexdigest()[:8])"
  //   "import hashlib; print(hashlib.sha256(open('<title>','rb').read()+b'\0'+open('<body>','rb').read()).hexdigest())"
  // The formula control below uses fixed keys on purpose: the keys the
  // grouping derives come from the tool vocabulary, so end-to-end ids would
  // bake the vocabulary into the golden. The wiring control then checks the
  // grouping files each entry under faultId of its own target and key.
  {
    const cases: Array<[string, string, string]> = [
      ["scripts/launch.sh", "codex --json hung", "tf-e2ae0dba"],
      ["scripts/host.sh", "tmux: no server running", "tf-eb56942b"],
      ["", "", "tf-01ba4719"],
      ["a", "b\nc", "tf-ea7fb08b"],
      ["snowman ☃", "key ☃", "tf-b1776d54"],
    ];
    const seen: string[] = [];
    let fidsMatch = true;
    for (const [file, key, want] of cases) {
      const got = faultId(file, key);
      seen.push(`${JSON.stringify(file)} ${JSON.stringify(key)}: ${got} vs ${want}`);
      if (got !== want) fidsMatch = false;
    }
    st.check("fault ids are BASE's sha256 over file, newline, key", fidsMatch, seen.join("\n"));
  }
  {
    const d = join(tmp, "fid");
    mkdirSync(d, { recursive: true });
    const safe = new Safe([], d, false);
    const entries = [
      {
        action: "tool-fault",
        target: "scripts/launch.sh",
        fault: { failed: "codex --json hung", control: "", workaround: "" },
      },
      {
        action: "tool-fault",
        target: "scripts/host.sh",
        fault: { failed: "tmux: no server running", control: "retry", workaround: "" },
      },
    ];
    const groups = faultsOf(entries, safe, 0);
    let wiredOk = groups.length === 2;
    const seen: string[] = [];
    for (const g of groups) {
      const e = g.entries[0]!;
      const want = faultId(String(e.target || ""), safe.key(String(fields(e).failed || "")));
      seen.push(`${g.id} vs ${want}`);
      if (g.id !== want) wiredOk = false;
    }
    st.check("grouping files each entry under its fault id", wiredOk, seen.join("\n"));
  }
  {
    const cases: Array<[Buffer, Buffer, string]> = [
      [
        Buffer.from("A title\n", "utf8"),
        Buffer.from("A body.\n", "utf8"),
        "7318098db1171d190bf06cb08ac941f67a6dc4cbbd11be829fd849d3ca0d19c3",
      ],
      [
        Buffer.from(new Uint8Array([0x54, 0xff, 0x0a])),
        Buffer.from("body\0with NUL\n", "utf8"),
        "be4624694fee7015471a8b74f6c0787794fb99db785e7bd5d554169f108ddc81",
      ],
    ];
    let digestsMatch = true;
    const seen: string[] = [];
    cases.forEach(([title, body, want], i) => {
      const titlePath = join(tmp, `t${i}.title`);
      const bodyPath = join(tmp, `b${i}.md`);
      writeFileSync(titlePath, title);
      writeFileSync(bodyPath, body);
      const got = digest(titlePath, bodyPath);
      seen.push(`${got} vs ${want}`);
      if (got !== want) digestsMatch = false;
    });
    st.check(
      "draft digests are BASE's sha256 over title, NUL, body",
      digestsMatch,
      seen.join("\n"),
    );
  }
  // The casefold primitive, pinned to goldens captured from python3's
  // str.casefold once, on 2026-09-29: every entry below is a code point
  // where folding differs from lowercasing (plus sigma, where the
  // context-free fold beats the final-sigma lower). Regenerate under
  // python3 with -c and: "print(repr('<chars>'.casefold()))".
  {
    const cases: Array<[string, string]> = [
      ["ß", "ss"],
      ["İ", "i\u0307"],
      ["ς", "σ"],
      ["Σ", "σ"],
      ["ﬀ", "ff"],
      ["ﬁ", "fi"],
      ["ſ", "s"],
      ["ŉ", "\u02bcn"],
      ["ǰ", "j\u030c"],
      ["µ", "μ"],
      ["Straße", "strasse"],
      ["ςigma DBΣ", "σigma dbσ"],
    ];
    const seen: string[] = [];
    let foldOk = true;
    for (const [input, want] of cases) {
      const got = casefold(input);
      if (got !== want) {
        foldOk = false;
        seen.push(`${JSON.stringify(input)}: ${JSON.stringify(got)} vs ${JSON.stringify(want)}`);
      }
    }
    st.check("casefold folds as Python's str.casefold", foldOk, seen.join("\n"));
  }
  if (run("sh", ["-c", "command -v python3"]).code !== 0) {
    st.skip(
      "BASE tool-faults harvest replay (folding)",
      "python3 not on PATH: the 11-vector casefold comparison did not run",
    );
  } else {
    const T2 = join(tmp, "tool2");
    mkdirSync(join(T2, "skills"), { recursive: true });
    run("cp", ["-R", HERE, join(T2, "scripts")]);
    copyFileSync(join(TOOL, "bunfig.toml"), join(T2, "bunfig.toml"));
    run("cp", ["-R", join(TOOL, "skills/postmaster"), join(T2, "skills/postmaster")]);
    writeFileSync(
      join(T2, "skills/postmaster/probe.md"),
      "see docs/straße.md and straße.md for the probe\nthe straße word lives here\nref https://straße.example/x here\n",
    );
    const shown = run("git", [
      "-C",
      TOOL,
      "show",
      "bb782a973e69427c820ce16a676718e87f51995b:scripts/tool-faults.sh",
    ]);
    const baseLines = shown.out.split("\n");
    const ghStart = baseLines.findIndex((l) => l.startsWith("cat > ") && l.includes("<<'GH'"));
    const ghEnd = baseLines.findIndex((l, i) => i > ghStart && l === "GH");
    const baseTf = join(T2, "scripts", "base-tf.sh");
    writeFileSync(baseTf, shown.out);
    run("chmod", ["+x", baseTf]);
    run("git", ["-C", T2, "init", "-q"]);
    run("git", ["-C", T2, "remote", "add", "origin", "https://github.com/o/postmaster.git"]);
    // BASE's stub gh, extracted from its self-test (the `cat ... <<'GH'` body).
    const binB = join(tmp, "binB");
    mkdirSync(binB, { recursive: true });
    writeFileSync(join(binB, "gh"), `${baseLines.slice(ghStart + 1, ghEnd).join("\n")}\n`);
    run("chmod", ["+x", join(binB, "gh")]);
    const S2 = join(tmp, "stub2");
    const S2B = join(tmp, "stub2B");
    for (const s of [S2, S2B]) {
      mkdirSync(s, { recursive: true });
      writeFileSync(join(s, "db.json"), JSON.stringify({ access: "ADMIN", next: 60, issues: {} }));
    }
    const faults: Array<[string, string]> = [
      ["scripts/launch.sh", "crash in Straße 42"],
      ["scripts/launch.sh", "ςigma failed on DBΣ now"],
      ["scripts/launch.sh", "İllegal instruction"],
      ["scripts/launch.sh", "see İ/ſ docs"],
      ["scripts/launch.sh", "see docs/STRASSE.md"],
      ["scripts/launch.sh", "STRASSE broke it"],
      ["scripts/launch.sh", "großartig qzxv jkwv bnpm"],
      ["scripts/launch.sh", "run `STRASSE` now"],
      ["scripts/launch.sh", "see STRASSE.MD"],
      ["scripts/launch.sh", "see https://STRASSE.example/x"],
      ["scripts/launch.sh", "plain ascii failure"],
    ];
    const mkDisp = (name: string): string => {
      const d = join(tmp, name);
      mkdirSync(d, { recursive: true });
      writeFileSync(
        join(d, "manifest.json"),
        '{"stage": "done", "leg": 3, "base": "0123abc", "lanes": {}, "coachman": {"legs": {}}}\n',
      );
      writeFileSync(join(d, "run.json"), '{"written": "2026-01-01T00:00:00Z", "run": "t"}\n');
      writeFileSync(
        join(d, "brief.md"),
        "# Waybill: t\n\nGROSSARTIG QZXV JKWV BNPM are waybill words.\n",
      );
      writeFileSync(
        join(d, "actions.jsonl"),
        `${faults
          .map(([target, failed], i) =>
            JSON.stringify({
              ts: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
              project: "postmaster",
              run: "t",
              actor: "coachman",
              action: "tool-fault",
              target,
              detail: "x",
              fault: { failed, control: "", workaround: "" },
            }),
          )
          .join("\n")}\n`,
      );
      return d;
    };
    const mismatches: string[] = [];
    if (shown.code !== 0 || ghStart < 0 || ghEnd < 0) {
      mismatches.push("could not extract BASE tool-faults.sh and its stub gh");
    } else {
      const dB = mkDisp("runsB");
      const dP = mkDisp("runsP");
      const base = run("bash", [baseTf, "harvest", dB], {
        env: { ...process.env, PATH: `${binB}:${process.env.PATH}`, TOOL_FAULTS_STUB: S2B },
      });
      const port = run("bash", [join(T2, "scripts", "tool-faults.sh"), "harvest", dP], {
        env: {
          ...process.env,
          PATH: `${join(tmp, "bin")}:${process.env.PATH}`,
          TOOL_FAULTS_STUB: S2,
        },
      });
      const rid = normRid;
      if (base.code !== 0 || port.code !== 0) {
        mismatches.push(
          `exits: base ${base.code} port ${port.code}\nbase: ${base.err}\nport: ${port.err}`,
        );
      } else if (rid(base.out) !== rid(port.out)) {
        mismatches.push(
          `harvest output differs:\n--- base\n${rid(base.out)}\n--- port\n${rid(port.out)}`,
        );
      } else {
        const drafts = (d: string): Map<string, string> => {
          const m = new Map<string, string>();
          for (const sub of readdirSync(join(d, "tool-faults"))) {
            for (const f of readdirSync(join(d, "tool-faults", sub))) {
              if (f === "tool-faults.json") continue;
              m.set(f, rid(readFileSync(join(d, "tool-faults", sub, f), "utf-8")));
            }
          }
          return m;
        };
        const b = drafts(dB);
        const p = drafts(dP);
        for (const [f, body] of b) {
          if (!p.has(f)) mismatches.push(`draft only on BASE: ${f}`);
          else if (p.get(f) !== body) mismatches.push(`draft differs: ${f}`);
        }
        for (const f of p.keys()) {
          if (!b.has(f)) mismatches.push(`draft only on port: ${f}`);
        }
      }
    }
    st.check(
      "folding parity: BASE and port harvests agree on ids and drafts, ß/İ/ς alike",
      mismatches.length === 0,
      mismatches.join("\n\n").slice(0, 4000),
    );
    // Round-10 Unicode primitives: every routed pattern, both harvest CLIs
    // on one synthetic dispatch. Vectors: non-ASCII emails, Arabic-Indic
    // digits, ſ, ß, dotted İ, plus an ASCII control per pattern. SK and AR7
    // are joined, never written whole: whole, they would sit in this file,
    // hence in the tool's vocab/tokens, and neutralize their own vectors.
    const SK = "s" + "kib" + "idi";
    const AR7 = "١٢٣٤" + "٥٦٧";
    const AR3 = "١٢" + "٣";
    const O3 = "١٢" + "٣";
    const AB3 = "ab" + "٣";
    const D7 = "123" + "4567";
    const D3 = "78" + "9";
    const ID8 = "1234" + "5678";
    // Q, D3A and the halves below stay split for the same reason as SK and
    // AR7: whole, they would sit in this file, hence in the tool's own
    // vocab/tokens, and neutralize their own vectors. Every break-sensitive
    // fault below is alone in its key group: the group draft shows only the
    // first entry, so a sensitive second entry would be shadowed and dead.
    const Q = "qu" + "ay";
    const D3A = "٣";
    const C12 = "abcdef" + "123456";
    const HXAB = "abcdefab" + "٣";
    const FS = "\x1c";
    const primFaults: Array<[string, string]> = [
      ["scripts/launch.sh", "mailed to ü@internal.example today"],
      ["scripts/launch.sh", "ping admin@exämple.com now"],
      ["scripts/launch.sh", "note user@exämple.com here"],
      ["scripts/launch.sh", "mail qzxvndr@例え.テスト ok"],
      ["scripts/launch.sh", "ask josé@acme-corp.com please"],
      ["scripts/launch.sh", "mail u@example.com ok"],
      ["scripts/launch.sh", `see ${"üP" + "M"}-12 and more`],
      ["scripts/launch.sh", `see ${"xüP" + "M"}-99 here`],
      ["scripts/launch.sh", "see PM-12 here"],
      ["scripts/launch.sh", `again ${"é" + "tf"}-${ID8} broke`],
      ["scripts/launch.sh", `again ${"ß" + "tf"}-${ID8} broke`],
      ["scripts/launch.sh", `again ${"İ" + "tf"}-${ID8} broke`],
      ["scripts/launch.sh", `again tf-${ID8} broke`],
      ["scripts/launch.sh", `still TF-${ID8} broke`],
      ["scripts/launch.sh", `open ${"ßht" + "tp"}://x.com/a now`],
      ["scripts/launch.sh", `open ${"αht" + "tp"}://x.com/a now`],
      ["scripts/launch.sh", `open ß${"http" + "/x"} now`],
      ["scripts/launch.sh", `hash ${"ßabc" + "def1"} done`],
      ["scripts/launch.sh", `hash ${HXAB}! done`],
      ["scripts/launch.sh", `saw ß${C12} here`],
      ["scripts/launch.sh", `read data.${"ß" + "x"} now`],
      ["scripts/launch.sh", `read secret.${"é" + "xt"} now`],
      ["scripts/launch.sh", `read file.${"日" + "本"} now`],
      ["scripts/launch.sh", "read data.txt now"],
      ["scripts/launch.sh", `run \`${AR7}\` now`],
      ["scripts/launch.sh", `call ${AR7} ok`],
      ["scripts/launch.sh", `run \`${D7}\` now`],
      ["scripts/launch.sh", `hail \`${AR3}\` now`],
      ["scripts/launch.sh", `ring ${AR3} ok`],
      ["scripts/launch.sh", `call ${AB3} ok`],
      ["scripts/launch.sh", `see ${D3} here`],
      ["scripts/launch.sh", `ſ${SK.slice(1)} failed`],
      ["scripts/launch.sh", `${SK} failed`],
      ["scripts/launch.sh", `see _${SK} fail`],
      ["scripts/launch.sh", `see ${D3A}${SK} fail`],
      ["scripts/launch.sh", `see ${SK}${D3A}x fail`],
      ["scripts/launch.sh", `see _${Q} fail`],
      ["scripts/launch.sh", `spot ${Q}_ fail`],
      ["scripts/launch.sh", `see é${Q} fail`],
      ["scripts/launch.sh", `see ${Q}é fail`],
      ["scripts/launch.sh", `note ${Q} fails`],
      ["scripts/launch.sh", `see a${FS}b here`],
      ["scripts/launch.sh", `ping ${"ü1" + "0"}.0.0.1 now`],
      ["scripts/launch.sh", `ping ${O3}.${O3}.${O3}.${O3} now`],
      ["scripts/launch.sh", "ping 10.0.0.1 yet"],
    ];
    const primMismatches: string[] = [];
    {
      const S10 = join(tmp, "stub10");
      const S10B = join(tmp, "stub10B");
      for (const s of [S10, S10B]) {
        mkdirSync(s, { recursive: true });
        writeFileSync(
          join(s, "db.json"),
          JSON.stringify({ access: "ADMIN", next: 60, issues: {} }),
        );
      }
      const mkPrim = (sub: string): string => {
        const d = join(tmp, SK, sub);
        mkdirSync(d, { recursive: true });
        writeFileSync(join(d, "manifest.json"), '{"stage": "done", "leg": 3}\n');
        writeFileSync(
          join(d, "run.json"),
          '{"postmaster": {"commit": "abcdef1234567890abcdef1234567890abcdef12"}}\n',
        );
        writeFileSync(
          join(d, "brief.md"),
          "# Waybill: t\n\nPlain ascii waybill words here.\nQuay work happens here.\n",
        );
        writeFileSync(
          join(d, "actions.jsonl"),
          `${primFaults
            .map(([target, failed], i) =>
              JSON.stringify({
                ts: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
                project: "postmaster",
                run: "t",
                actor: "coachman",
                action: "tool-fault",
                target,
                detail: "x",
                fault: { failed, control: "", workaround: "" },
              }),
            )
            .join("\n")}\n`,
        );
        return d;
      };
      const pB = mkPrim("runsB10");
      const pP = mkPrim("runsP10");
      const bOut = run("bash", [baseTf, "harvest", pB], {
        env: { ...process.env, PATH: `${binB}:${process.env.PATH}`, TOOL_FAULTS_STUB: S10B },
      });
      const pOut = run("bash", [join(T2, "scripts", "tool-faults.sh"), "harvest", pP], {
        env: {
          ...process.env,
          PATH: `${join(tmp, "bin")}:${process.env.PATH}`,
          TOOL_FAULTS_STUB: S10,
        },
      });
      const rid10 = normRid;
      if (bOut.code !== 0 || pOut.code !== 0) {
        primMismatches.push(
          `exits: base ${bOut.code} port ${pOut.code}\nbase: ${bOut.err}\nport: ${pOut.err}`,
        );
      } else if (rid10(bOut.out) !== rid10(pOut.out)) {
        primMismatches.push(
          `harvest output differs:\n--- base\n${rid10(bOut.out)}\n--- port\n${rid10(pOut.out)}`,
        );
      } else {
        const drafts10 = (d: string): Map<string, string> => {
          const m = new Map<string, string>();
          for (const sub of readdirSync(join(d, "tool-faults"))) {
            for (const f of readdirSync(join(d, "tool-faults", sub))) {
              if (f === "tool-faults.json") continue;
              m.set(f, rid10(readFileSync(join(d, "tool-faults", sub, f), "utf-8")));
            }
          }
          return m;
        };
        const b = drafts10(pB);
        const p = drafts10(pP);
        for (const [f, body] of b) {
          if (!p.has(f)) primMismatches.push(`draft only on BASE: ${f}`);
          else if (p.get(f) !== body) primMismatches.push(`draft differs: ${f}`);
        }
        for (const f of p.keys()) {
          if (!b.has(f)) primMismatches.push(`draft only on port: ${f}`);
        }
      }
    }
    st.check(
      "unicode primitives: BASE and port harvests agree, email/digits/ſßİ alike",
      primMismatches.length === 0,
      primMismatches.join("\n\n").slice(0, 4000),
    );
    // Round-10 pattern parity: every regex above, diffed against BASE's own
    // pattern text (bb782a9 scripts/tool-faults.sh) on the vectors where
    // Unicode meets the pattern. The port side runs the real consts, so a
    // routed pattern that drifts fails here before any harvest runs.
    // Multi-slash remote tails are absent on purpose: BASE's /*$ and the
    // port's /?$ disagree there, and that P3 rides a card, not this suite.
    runPatternParity(st, tmp);
    // sameRepo under casefold: the tool copy's own remote is Straße-form,
    // the waybill target's STRASSE-form, so BASE takes the own-repo path
    // (waybill public) and a toLowerCase port takes the foreign one.
    // A foreign remote pair pins the else branch on both. The load-bearing
    // word is joined, never written whole: whole, it would sit in this
    // file, hence in the tool's own vocab, published on both sides.
    {
      const word = "zx" + "qv";
      const T3 = join(tmp, "tool3");
      run("cp", ["-R", T2, T3]);
      run("git", ["-C", T3, "remote", "set-url", "origin", "https://github.com/o/Straße-tool.git"]);
      const mkRepo = (name: string, origin: string): string => {
        const d = join(tmp, name);
        mkdirSync(d, { recursive: true });
        run("git", ["-C", d, "init", "-q"]);
        run("git", ["-C", d, "remote", "add", "origin", origin]);
        return d;
      };
      const ownR = mkRepo("repo-own", "https://github.com/o/STRASSE-tool.git");
      const forR = mkRepo("repo-for", "https://github.com/other/thing.git");
      const S11 = join(tmp, "stub11");
      const S11B = join(tmp, "stub11B");
      for (const s of [S11, S11B]) {
        mkdirSync(s, { recursive: true });
        writeFileSync(
          join(s, "db.json"),
          JSON.stringify({ access: "ADMIN", next: 60, issues: {} }),
        );
      }
      const mkSame = (sub: string, repo: string): string => {
        const d = join(tmp, sub);
        mkdirSync(d, { recursive: true });
        writeFileSync(join(d, "manifest.json"), '{"stage": "done", "leg": 3}\n');
        writeFileSync(join(d, "run.json"), '{"written": "2026-01-01T00:00:00Z", "run": "t"}\n');
        writeFileSync(
          join(d, "brief.md"),
          `## Project profile\nrepo: ${repo}\n\n${word} is load-bearing.\n`,
        );
        writeFileSync(
          join(d, "actions.jsonl"),
          `${JSON.stringify({
            ts: "2026-01-01T00:00:00Z",
            project: "postmaster",
            run: "t",
            actor: "coachman",
            action: "tool-fault",
            target: "scripts/launch.sh",
            detail: "x",
            fault: { failed: `${word} broke the build`, control: "", workaround: "" },
          })}\n`,
        );
        return d;
      };
      const sameMismatches: string[] = [];
      for (const [label, repo] of [
        ["own", ownR],
        ["foreign", forR],
      ] as Array<[string, string]>) {
        const dB = mkSame(`sameB-${label}`, repo);
        const dP = mkSame(`sameP-${label}`, repo);
        const bOut = run("bash", [join(T3, "scripts", "base-tf.sh"), "harvest", dB], {
          env: { ...process.env, PATH: `${binB}:${process.env.PATH}`, TOOL_FAULTS_STUB: S11B },
        });
        const pOut = run("bash", [join(T3, "scripts", "tool-faults.sh"), "harvest", dP], {
          env: {
            ...process.env,
            PATH: `${join(tmp, "bin")}:${process.env.PATH}`,
            TOOL_FAULTS_STUB: S11,
          },
        });
        const norm = normRid;
        if (bOut.code !== 0 || pOut.code !== 0) {
          sameMismatches.push(
            `${label}: exits base ${bOut.code} port ${pOut.code}\nbase: ${bOut.err}\nport: ${pOut.err}`,
          );
        } else {
          if (norm(bOut.out) !== norm(pOut.out)) {
            sameMismatches.push(
              `${label} output differs:\n--- base\n${norm(bOut.out)}\n--- port\n${norm(pOut.out)}`,
            );
          }
          const drafts11 = (d: string): Map<string, string> => {
            const m = new Map<string, string>();
            for (const sub of readdirSync(join(d, "tool-faults"))) {
              for (const f of readdirSync(join(d, "tool-faults", sub))) {
                if (f === "tool-faults.json") continue;
                m.set(f, norm(readFileSync(join(d, "tool-faults", sub, f), "utf-8")));
              }
            }
            return m;
          };
          const b = drafts11(dB);
          const p = drafts11(dP);
          for (const [f, body] of b) {
            if (!p.has(f)) sameMismatches.push(`${label} draft only on BASE: ${f}`);
            else if (p.get(f) !== body) {
              sameMismatches.push(
                `${label} draft differs: ${f}\n--- base\n${body}\n--- port\n${p.get(f)}`,
              );
            }
          }
          for (const f of p.keys()) {
            if (!b.has(f)) sameMismatches.push(`${label} draft only on port: ${f}`);
          }
        }
      }
      st.check(
        "sameRepo folds remotes as BASE: own-repo waybill public, foreign withheld",
        sameMismatches.length === 0,
        sameMismatches.join("\n\n").slice(0, 4000),
      );
    }
  }
  if (run("sh", ["-c", "command -v python3"]).code !== 0) {
    st.skip(
      "BASE stub gh search replay (folding)",
      "python3 not on PATH: the casefold search comparison did not run",
    );
  } else {
    const shown = run("git", [
      "-C",
      TOOL,
      "show",
      "bb782a973e69427c820ce16a676718e87f51995b:scripts/tool-faults.sh",
    ]);
    const baseLines = shown.out.split("\n");
    const ghStart = baseLines.findIndex((l) => l.startsWith("cat > ") && l.includes("<<'GH'"));
    const ghEnd = baseLines.findIndex((l, i) => i > ghStart && l === "GH");
    const mismatches: string[] = [];
    if (shown.code !== 0 || ghStart < 0 || ghEnd < 0) {
      mismatches.push("could not extract BASE's stub gh");
    } else {
      const binS = join(tmp, "binS");
      mkdirSync(binS, { recursive: true });
      writeFileSync(join(binS, "gh"), `${baseLines.slice(ghStart + 1, ghEnd).join("\n")}\n`);
      run("chmod", ["+x", join(binS, "gh")]);
      const mkDb = (dir: string): void => {
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          join(dir, "db.json"),
          JSON.stringify({
            access: "ADMIN",
            next: 80,
            issues: {
              "70": {
                state: "OPEN",
                title: "Straße outage",
                body: "The straße broke",
                comments: [],
              },
              "71": { state: "OPEN", title: "ςigma alert", body: "on DBΣ", comments: ["σighting"] },
              "72": { state: "CLOSED", title: "İllegal state", body: "plain", comments: [] },
              "73": { state: "OPEN", title: "plain ascii", body: "nothing special", comments: [] },
            },
          }),
        );
      };
      const sB = join(tmp, "stubB");
      const sP = join(tmp, "stubP");
      mkDb(sB);
      mkDb(sP);
      const hits = (
        gh: string,
        stub: string,
        q: string,
      ): Array<{ number: number; title: string; state: string }> => {
        const r = run(gh, ["search", "issues", q], {
          env: { ...process.env, TOOL_FAULTS_STUB: stub },
        });
        if (r.code !== 0) {
          mismatches.push(`search ${JSON.stringify(q)} exited ${r.code} on ${gh}: ${r.err}`);
          return [];
        }
        const parsed = JSON.parse(r.out) as Array<{ number: number; title: string; state: string }>;
        return [...parsed].sort((a, b) => a.number - b.number);
      };
      for (const q of ["strasse", "STRASSE", "σ", "ς", "Σ", "i", "i\u0307", "plain"]) {
        const b = hits(join(binS, "gh"), sB, q);
        const p = hits(join(tmp, "bin", "gh"), sP, q);
        if (JSON.stringify(b) !== JSON.stringify(p)) {
          mismatches.push(
            `query ${JSON.stringify(q)}: base ${JSON.stringify(b)} vs port ${JSON.stringify(p)}`,
          );
        }
      }
    }
    st.check(
      "the stub tracker search folds as BASE's stub does, ß/İ/ς alike",
      mismatches.length === 0,
      mismatches.join("\n"),
    );
  }
  // The planted-marker search is BASE's `grep -qiF` invocation, marker
  // for marker: the port runs the same binary under the same environment,
  // so the only thing to pin is the wiring, on the vectors where folding
  // would lie (σ held against ς, i held out of İ). Needs no python3.
  {
    const markers = ["Straße", "İ", "ς", "plain", "i"];
    const texts = [
      "STRASSE here",
      "nothing",
      "İ and i",
      "Σ ς σ",
      "PLAIN plain",
      "straße",
      "σ only",
      "İ",
    ];
    const mismatches: string[] = [];
    for (const text of texts) {
      const want = markers.filter(
        (p) => run("grep", ["-qiF", "--", p], { input: text }).code === 0,
      );
      const got = leaks(text, markers);
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        mismatches.push(
          `${JSON.stringify(text)}: ${JSON.stringify(got)} vs ${JSON.stringify(want)}`,
        );
      }
    }
    st.check(
      "the planted-marker search matches grep -qiF marker for marker, ß/İ/ς alike",
      mismatches.length === 0,
      mismatches.join("\n"),
    );
  }

  st.finish();
});
