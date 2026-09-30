// Normalize native bug-review reports and harvest Claude's forked task transcripts.
//
//   review-findings.sh normalize <lane> <scratch> <events> --run <dispatch> [--last <file>]
//   review-findings.sh harvest <events> <logs-dir> --prefix <name>
//   review-findings.sh --self-test
//
//   exit 0  printed
//   exit 1  usage; a report that cannot be read; a harvest that cannot be completed
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { scriptsDir, toolRoot } from "./lib/paths.ts";
import { run, withTempDir } from "./lib/proc.ts";
import { SelfTest } from "./lib/selftest.ts";
import {
  BOUND_L,
  BOUND_R,
  D_CLASS,
  DOT_ALL,
  digitValue,
  literalI,
  PY_DOT,
  PY_S_CLASS,
  pyLower,
  pySplitLines,
  pyTrim,
  pyWords,
} from "./lib/text.ts";

const HERE = scriptsDir(import.meta);
const USAGE =
  "usage: review-findings.sh normalize <lane> <scratch> <events> --run <dispatch> [--last <file>] | harvest <events> <logs-dir> --prefix <name> | --self-test";

// --- failures ---------------------------------------------------------------------------
// BASE raises ReportError; a ported method that returns it cannot also fail loudly, so the
// failure is a thrown tagged Error instead of a class. The entry point catches the tag and
// prints it the way BASE does; anything else propagates the way BASE's tracebacks do.
interface ReportFailure {
  readonly tag: "ReportError";
  readonly message: string;
}

function isReportError(e: unknown): e is ReportFailure {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { tag?: unknown }).tag === "ReportError" &&
    typeof (e as { message?: unknown }).message === "string"
  );
}

function fail(message: string): never {
  const e = new Error(message);
  (e as unknown as { tag: string }).tag = "ReportError";
  throw e;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// --- small mirrors ----------------------------------------------------------------------
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const uid = (): number => process.getuid?.() ?? 0;

/** Python str() for %s slots: None/True/False spellings, nan/inf lowercased. */
function pyStr(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "nan";
    if (value === Infinity) return "inf";
    if (value === -Infinity) return "-inf";
    return String(value);
  }
  return String(value);
}

/** Python int(): truncation for numbers, True/False as 1/0, sign and single underscores
 * between Unicode decimal digits for strings. Throws where int() raises. */
function pyInt(value: unknown): number {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("not an integer");
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    let t = pyTrim(value);
    let neg = false;
    if (t.startsWith("+") || t.startsWith("-")) {
      neg = t.startsWith("-");
      t = t.slice(1);
    }
    const parts = t.split("_");
    for (const part of parts) if (part === "") throw new Error("not an integer");
    const digits = digitValue(parts.join(""));
    const n = Number((neg ? "-" : "") + digits);
    if (!Number.isFinite(n)) throw new Error("not an integer");
    return n;
  }
  throw new Error("not an integer");
}

function stripChars(s: string, chars: string): string {
  let a = 0;
  let b = s.length;
  while (a < b && chars.includes(s[a]!)) a++;
  while (b > a && chars.includes(s[b - 1]!)) b--;
  return s.slice(a, b);
}

function lstripChars(s: string, chars: string): string {
  let a = 0;
  while (a < s.length && chars.includes(s[a]!)) a++;
  return s.slice(a);
}

function rstripChars(s: string, chars: string): string {
  let b = s.length;
  while (b > 0 && chars.includes(s[b - 1]!)) b--;
  return s.slice(0, b);
}

/** Path.resolve(strict=False): symlinks resolved through the longest existing prefix, the
 * missing tail joined lexically. Only a missing path falls back to a shorter prefix; any
 * other failure propagates, as BASE's OSError does. */
function pyResolve(p: string): string {
  const abs = resolve(p);
  const parts = abs.split("/");
  for (let i = parts.length; i >= 1; i--) {
    const prefix = parts.slice(0, i).join("/") || "/";
    try {
      const real = realpathSync(prefix);
      return i === parts.length ? real : join(real, ...parts.slice(i));
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT" || code === "ENOTDIR") continue;
      throw e;
    }
  }
  return abs;
}

const decodeUtf8 = (buf: Buffer): string => new TextDecoder("utf-8", { fatal: true }).decode(buf);

/** BASE's event.get(), which raises AttributeError on a non-dict event instead of skipping
 * it: a stray scalar line fails the run, never harvests clean. The throw is untagged, so it
 * escapes the entry point the way BASE's traceback does. */
function eventField(event: unknown, key: string): unknown {
  if (!isObj(event)) throw new Error(`review event has no ${key}`);
  return event[key];
}

const firstTruthy = (o: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) {
    const v = o[k];
    if (v) return v;
  }
  return null;
};

const firstPresent = (o: Record<string, unknown>, keys: string[]): unknown => {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null) return v;
  }
  return null;
};

// --- patterns ---------------------------------------------------------------------------
const LOCATION_SRC =
  "(?<path>(?:[A-Za-z]:)?[^" +
  PY_S_CLASS +
  "`*<>]+):(?<line>[" +
  D_CLASS +
  "]+)(?:-(?<end>[" +
  D_CLASS +
  "]+))?";
const LOCATION = new RegExp(LOCATION_SRC, "u");
const LOCATION_G = new RegExp(LOCATION_SRC, "gu");
const HASHLOC_G = new RegExp(
  "(?<path>(?:[A-Za-z]:)?[^" + PY_S_CLASS + "`*<>]+?)#L(?<line>[" + D_CLASS + "]+)",
  "gu",
);
const ATLINE_G = new RegExp(
  "(?<path>[A-Za-z][^" +
    PY_S_CLASS +
    "`*<>:,;()]*?)[" +
    PY_S_CLASS +
    "]+" +
    BOUND_L +
    literalI("at line") +
    "[" +
    PY_S_CLASS +
    "]+(?<line>[" +
    D_CLASS +
    "]+)",
  "giu",
);
const PRIORITY_TAG = /\[P[123]\]/u;
const FINDING_WORDS = new RegExp(
  BOUND_L +
    "(?:" +
    literalI("bug") +
    "s?|" +
    literalI("buggy") +
    "|" +
    literalI("finding") +
    "s?|" +
    literalI("issue") +
    "s?|" +
    literalI("defect") +
    "s?)" +
    BOUND_R,
  "iu",
);
const HAS_LETTER = /[A-Za-z]/u;
const EMBEDDED = new RegExp(
  "^(" + PY_DOT + "*?):([" + D_CLASS + "]+)(?:-([" + D_CLASS + "]+))?$",
  "u",
);
const FENCE_OPEN = new RegExp("^```(?:json)?[" + PY_S_CLASS + "]*$", "iu");
const CODEX_LINE = new RegExp(
  "^[" +
    PY_S_CLASS +
    "]*[-*][" +
    PY_S_CLASS +
    "]*\\[(P[123])\\][" +
    PY_S_CLASS +
    "]*(" +
    PY_DOT +
    "+?)[" +
    PY_S_CLASS +
    "]+[—–][" +
    PY_S_CLASS +
    "]+(" +
    PY_DOT +
    "+):([" +
    D_CLASS +
    "]+)(?:-([" +
    D_CLASS +
    "]+))?[" +
    PY_S_CLASS +
    "]*$",
  "u",
);
const PREFIX_SANITIZE = /[^A-Za-z0-9_.-]+/gu;
const SH_BLOCKS = new RegExp("```sh\\n(" + DOT_ALL + "*?)```", "gsu");
const FOR_LOOP = /for L in \$\([^;]*?; do/gu;
const LEAD_HASH = /^#+/u;
const JSON_NUM = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/uy;
const HEX4 = /^[0-9a-fA-F]{4}$/u;

// --- JSON with an end index ---------------------------------------------------------------
// json.JSONDecoder.raw_decode, which the scans below need: the value starting exactly at
// the bracket, and the index just past it. NaN/Infinity are values, as BASE's decoder has
// them; a raw control character or a bad escape fails, as its strict mode does.
function rawDecodeJson(text: string, start: number): { value: unknown; end: number } {
  let i = start;
  const failJson = (): never => {
    throw new Error(`invalid JSON at offset ${i}`);
  };
  const skipWs = (): void => {
    while (i < text.length) {
      const c = text[i]!;
      if (c === " " || c === "\t" || c === "\n" || c === "\r") i++;
      else break;
    }
  };
  const parseString = (): string => {
    i++;
    let out = "";
    for (;;) {
      if (i >= text.length) failJson();
      const c = text[i]!;
      if (c === '"') {
        i++;
        return out;
      }
      if (c === "\\") {
        const e = text[i + 1];
        if (e === '"' || e === "\\" || e === "/") {
          out += e;
          i += 2;
        } else if (e === "b") {
          out += "\b";
          i += 2;
        } else if (e === "f") {
          out += "\f";
          i += 2;
        } else if (e === "n") {
          out += "\n";
          i += 2;
        } else if (e === "r") {
          out += "\r";
          i += 2;
        } else if (e === "t") {
          out += "\t";
          i += 2;
        } else if (e === "u") {
          const hex = text.slice(i + 2, i + 6);
          if (!HEX4.test(hex)) failJson();
          let cp = Number.parseInt(hex, 16);
          i += 6;
          if (cp >= 0xd800 && cp <= 0xdbff && text[i] === "\\" && text[i + 1] === "u") {
            const lo = text.slice(i + 2, i + 6);
            if (HEX4.test(lo)) {
              const locp = Number.parseInt(lo, 16);
              if (locp >= 0xdc00 && locp <= 0xdfff) {
                cp = 0x10000 + ((cp - 0xd800) << 10) + (locp - 0xdc00);
                i += 6;
              }
            }
          }
          out += String.fromCodePoint(cp);
        } else {
          failJson();
        }
      } else {
        if (c < " ") failJson();
        out += c;
        i++;
      }
    }
  };
  const parseValue = (): unknown => {
    if (i >= text.length) failJson();
    const c = text[i]!;
    if (c === '"') return parseString();
    if (c === "{") return parseObject();
    if (c === "[") return parseArray();
    if (c === "t" && text.startsWith("true", i)) {
      i += 4;
      return true;
    }
    if (c === "f" && text.startsWith("false", i)) {
      i += 5;
      return false;
    }
    if (c === "n" && text.startsWith("null", i)) {
      i += 4;
      return null;
    }
    if (c === "N" && text.startsWith("NaN", i)) {
      i += 3;
      return NaN;
    }
    if (c === "I" && text.startsWith("Infinity", i)) {
      i += 8;
      return Infinity;
    }
    if (c === "-" && text.startsWith("-Infinity", i)) {
      i += 9;
      return -Infinity;
    }
    JSON_NUM.lastIndex = i;
    const m = JSON_NUM.exec(text);
    if (m && m.index === i) {
      i += m[0].length;
      return Number(m[0]);
    }
    return failJson();
  };
  const parseArray = (): unknown[] => {
    i++;
    const out: unknown[] = [];
    skipWs();
    if (text[i] === "]") {
      i++;
      return out;
    }
    for (;;) {
      out.push(parseValue());
      skipWs();
      if (text[i] === ",") {
        i++;
        skipWs();
      } else if (text[i] === "]") {
        i++;
        return out;
      } else {
        return failJson();
      }
    }
  };
  const parseObject = (): Record<string, unknown> => {
    i++;
    const out: Record<string, unknown> = {};
    skipWs();
    if (text[i] === "}") {
      i++;
      return out;
    }
    for (;;) {
      if (text[i] !== '"') failJson();
      const key = parseString();
      skipWs();
      if (text[i] !== ":") failJson();
      i++;
      skipWs();
      const value = parseValue();
      // An own __proto__ key, as JSON.parse keeps one: a plain assignment would move the
      // prototype instead.
      if (key === "__proto__") {
        Object.defineProperty(out, key, {
          value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      } else {
        out[key] = value;
      }
      skipWs();
      if (text[i] === ",") {
        i++;
        skipWs();
      } else if (text[i] === "}") {
        i++;
        return out;
      } else {
        return failJson();
      }
    }
  };
  const value = parseValue();
  return { value, end: i };
}

/** Python == over decoded JSON: True is 1, dict order never matters, NaN is never equal. */
function pyDeepEqual(a: unknown, b: unknown): boolean {
  if (typeof a === "number" || typeof a === "boolean") {
    if (typeof b !== "number" && typeof b !== "boolean") return false;
    return Number(a) === Number(b);
  }
  if (typeof b === "number" || typeof b === "boolean") return false;
  if (typeof a === "string" || typeof b === "string") return a === b;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, n) => pyDeepEqual(v, b[n]));
  }
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Object.hasOwn(b, k) && pyDeepEqual(a[k], b[k]));
  }
  return a === b;
}

interface JsonSpan {
  value: unknown;
  start: number;
  end: number;
}

/** Every JSON list in the text with its character span; undecodable brackets skipped. */
function scanSpans(ntext: string): JsonSpan[] {
  const found: JsonSpan[] = [];
  for (let i = 0; i < ntext.length; i++) {
    if (ntext[i] !== "[") continue;
    try {
      const { value, end } = rawDecodeJson(ntext, i);
      if (Array.isArray(value)) found.push({ value, start: i, end });
    } catch {
      // undecodable brackets skipped
    }
  }
  return found;
}

/** The text with the picked list's first literal removed. A twin literal stays outside,
// where the second-list check finds it. */
function exciseFirst(ntext: string, picked: unknown): string {
  for (const span of scanSpans(ntext)) {
    if (pyDeepEqual(span.value, picked)) return ntext.slice(0, span.start) + ntext.slice(span.end);
  }
  fail("cannot parse review output from claude"); // unreachable: the literal parsed from this text
}

/** The one normalization for clean-matching and JSON parsing: a fence wrapping the whole
 * report, meaning its first and last lines, comes off, and edges are stripped. */
function normalizeText(text: string): string {
  const lines = pySplitLines(pyTrim(text));
  if (
    lines.length >= 2 &&
    FENCE_OPEN.test(pyTrim(lines[0]!)) &&
    pyTrim(lines[lines.length - 1]!) === "```"
  ) {
    return pyTrim(lines.slice(1, -1).join("\n"));
  }
  return pyTrim(text);
}

// The exact clean forms: the whole report, normalized, is a bare verdict, an empty JSON
// list, or {"findings": []} with no other key.
const CLEAN_VERDICTS = new Set([
  "no findings",
  "no findings.",
  "no findings found",
  "no findings found.",
  "no bugs found",
  "no bugs found.",
  "no issues found",
  "no issues found.",
  "no actionable findings",
  "no actionable findings.",
  "none",
  "none.",
]);
const DECLARED_KEYS = ["findings", "review_findings", "issues"];
const FILE_KEYS = ["file", "path", "file_path", "filePath", "filename"];
const LINE_KEYS = ["line", "line_number", "lineNumber", "start", "start_line", "startLine"];
const NO_OTHER_PHRASES = new Set([
  "no other findings found",
  "no other bugs found",
  "no other issues found",
  "no additional findings found",
  "no additional bugs found",
  "no additional issues found",
]);
// Headings whose sections hold non-findings, exactly as the recorded reports use them:
// mimo's "Not issues". Anything unrecorded still parses, loudly, not guessed at.
const SKIP_SECTIONS = ["not issues"];

/** The one findings list among candidates: non-empty and holding an object. Scalar or
 * empty lists say nothing; two findings lists fail loudly rather than guessing. */
function pickFindings(found: unknown[][]): unknown[] | null {
  const candidates = found.filter((v) => v.length > 0 && v.some((item) => isObj(item)));
  if (candidates.length > 1) {
    fail(
      `review output holds ${candidates.length} JSON finding lists; refusing to guess which holds the findings`,
    );
  }
  return candidates.length > 0 ? candidates[0]! : null;
}

/** (items, outside) for a claude report: the one JSON findings list and the text around
 * it. None when the text holds no JSON findings structure at all, so the markdown
 * fallback tries; anything else parses or fails loudly here. */
function claudeJson(ntext: string): [unknown[], string] | null {
  let whole: unknown;
  try {
    whole = JSON.parse(ntext);
  } catch {
    whole = undefined;
  }
  if (Array.isArray(whole)) return [whole as unknown[], ""];
  if (isObj(whole)) {
    const keyed: unknown[][] = [];
    for (const key of DECLARED_KEYS) {
      const v = whole[key];
      if (Array.isArray(v)) keyed.push(v as unknown[]);
    }
    if (keyed.length > 0) {
      // Declared keys are held strictly before anything is picked: a non-empty list with
      // no objects is a malformed report even beside a valid list, which must not
      // silently win over the malformed one.
      for (const found of keyed) {
        if (found.length > 0 && !found.some((item) => isObj(item))) {
          fail("review output's findings lists hold no objects; refusing to read as clean");
        }
      }
      const picked = pickFindings(keyed);
      if (picked !== null) return [picked, exciseFirst(ntext, picked)];
    }
    const objectLists = scanSpans(ntext)
      .map((s) => s.value as unknown[])
      .filter((v) => Array.isArray(v) && v.length > 0 && v.some((item) => isObj(item)));
    const picked = pickFindings(objectLists);
    if (picked === null) fail("cannot parse review output from claude");
    return [picked, exciseFirst(ntext, picked)];
  }
  const objectLists = scanSpans(ntext)
    .map((s) => s.value as unknown[])
    .filter((v) => Array.isArray(v) && v.length > 0 && v.some((item) => isObj(item)));
  const picked = pickFindings(objectLists);
  if (picked === null) return null;
  return [picked, exciseFirst(ntext, picked)];
}

/** The report normalized is exactly a clean form and nothing else. */
function isCleanForm(ntext: string): boolean {
  if (CLEAN_VERDICTS.has(pyWords(pyLower(ntext)).join(" "))) return true;
  try {
    const parsed: unknown = JSON.parse(ntext);
    return pyDeepEqual(parsed, []) || pyDeepEqual(parsed, { findings: [] });
  } catch {
    return false;
  }
}

/** Every JSON value the report decodes to: the whole text, then each bracket-led
 * fragment. Undecodable brackets are skipped. */
function decodedJsonValues(text: string): unknown[] {
  const values: unknown[] = [];
  try {
    values.push(JSON.parse(pyTrim(text)) as unknown);
  } catch {
    // the whole text is not JSON; fragments still try
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c !== "[" && c !== "{") continue;
    try {
      values.push(rawDecodeJson(text, i).value);
    } catch {
      // undecodable brackets are skipped
    }
  }
  return values;
}

/** Decoded string values, and (file, line-or-None) for objects naming a file, under a
 * JSON value. Keys are not values: a citation smuggled into a key stays visible to the
 * raw-text scan instead. */
function walkJson(value: unknown, strings: string[], cited: Array<[unknown, unknown]>): void {
  if (typeof value === "string") {
    strings.push(value);
  } else if (isObj(value)) {
    const fileValue = firstTruthy(value, FILE_KEYS);
    if (fileValue !== null) cited.push([fileValue, firstPresent(value, LINE_KEYS)]);
    for (const v of Object.values(value)) walkJson(v, strings, cited);
  } else if (Array.isArray(value)) {
    for (const v of value) walkJson(v, strings, cited);
  }
}

interface Cite {
  path: string;
  line: number;
  shown: string;
}

/** (path, line, shown) for every location a string names: path:line with a letter in it,
 * path#L<n>, and at line <n> against a path-like name on the same line. */
function scanLocations(s: string): Cite[] {
  const out: Cite[] = [];
  for (const m of s.matchAll(LOCATION_G)) {
    const path = m.groups!.path!;
    if (HAS_LETTER.test(path)) {
      out.push({ path, line: pyInt(m.groups!.line!), shown: `${path}:${m.groups!.line!}` });
    }
  }
  for (const m of s.matchAll(HASHLOC_G)) {
    const path = m.groups!.path!;
    out.push({ path, line: pyInt(m.groups!.line!), shown: `${path}#L${m.groups!.line!}` });
  }
  for (const m of s.matchAll(ATLINE_G)) {
    const path = m.groups!.path!;
    if (path.includes("/") || path.includes(".")) {
      out.push({ path, line: pyInt(m.groups!.line!), shown: `${path} at line ${m.groups!.line!}` });
    }
  }
  return out;
}

/** A line the markdown parser would file: a heading, item or em-dash line citing a
 * path:line with a letter in it. */
function isFindingFormLine(line: string): boolean {
  if (
    !(
      line.startsWith("#") ||
      line.startsWith("-") ||
      line.startsWith("*") ||
      line.startsWith("`") ||
      line.includes(" — ") ||
      line.includes(" – ")
    )
  ) {
    return false;
  }
  const m = LOCATION.exec(line);
  return m !== null && HAS_LETTER.test(m.groups!.path!);
}

/** A line that is exactly a no-other-issues phrase, heading markers and end punctuation
 * aside. Anything longer — a citation beside the phrase — is not skipped. */
function isExactNoOther(line: string): boolean {
  return NO_OTHER_PHRASES.has(
    pyLower(pyTrim(rstripChars(pyTrim(lstripChars(pyTrim(line), "#")), ".:"))),
  );
}

function matchOrLoud(
  path: unknown,
  number: unknown,
  shown: string,
  targets: Set<string>,
  scratch: string,
): void {
  let file = "";
  let line = 0;
  try {
    const r = normalizeLocation(path, number, null, scratch);
    file = r[0];
    line = r[1];
  } catch (e) {
    if (isReportError(e)) fail(`review output cites ${shown} outside its filed findings`);
    throw e;
  }
  if (!targets.has(`${file}\0${line}`)) {
    fail(`review output cites ${shown} outside its filed findings`);
  }
}

/** Nothing outside the one recognised structure may look like a finding: no second list,
 * no finding-form line, no priority tag; a prose location must name a filed finding's
 * file and line, nothing more. */
function checkOutside(outside: string, filed: Finding[], scratch: string): void {
  const targets = new Set(filed.map((f) => `${f.file}\0${f.line}`));
  for (const span of scanSpans(outside)) {
    const v = span.value;
    if (Array.isArray(v) && v.length > 0 && v.some((item) => isObj(item))) {
      fail("review output holds a second findings list outside its filed findings");
    }
  }
  for (const line of pySplitLines(outside)) {
    if (isFindingFormLine(pyTrim(line))) {
      fail("review output holds a markdown finding outside its filed findings");
    }
  }
  if (PRIORITY_TAG.test(outside)) {
    fail("review output holds a priority tag outside its filed findings");
  }
  for (const c of scanLocations(outside)) matchOrLoud(c.path, c.line, c.shown, targets, scratch);
  const strings: string[] = [];
  const cited: Array<[unknown, unknown]> = [];
  for (const value of decodedJsonValues(outside)) walkJson(value, strings, cited);
  for (const item of strings) {
    for (const c of scanLocations(item)) matchOrLoud(c.path, c.line, c.shown, targets, scratch);
  }
  for (const [fileValue, lineValue] of cited) {
    if (lineValue === null || lineValue === undefined) {
      fail(`review output names file ${pyStr(fileValue)} outside its filed findings`);
    }
    matchOrLoud(fileValue, lineValue, `${pyStr(fileValue)}:${pyStr(lineValue)}`, targets, scratch);
  }
}

/** No finding words beside an empty declared list: a report claiming no findings in one
 * key while describing bugs in another fails loudly. */
function checkFindingWords(ntext: string): void {
  for (const value of decodedJsonValues(ntext)) {
    if (
      isObj(value) &&
      DECLARED_KEYS.some(
        (key) => Array.isArray(value[key]) && (value[key] as unknown[]).length === 0,
      )
    ) {
      for (const item of Object.values(value)) {
        if (typeof item === "string" && FINDING_WORDS.test(item)) {
          fail("review output describes findings beside its empty findings list");
        }
      }
    }
  }
}

// --- findings ---------------------------------------------------------------------------
interface Finding {
  file: string;
  line: number;
  line_end: number | string;
  target: string;
  severity: string;
  summary: string;
  body: string;
  evidence: string;
  confidence: string;
  category: string;
  source: string;
}

/** json.dumps with sort_keys and ensure_ascii=False: sorted keys, ", "/"": " separators,
 * NaN/Infinity spelled the way allow_nan does. */
function sortedJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "string") return JSON.stringify(value) as string;
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (value === Infinity) return "Infinity";
    if (value === -Infinity) return "-Infinity";
    return JSON.stringify(value) as string;
  }
  if (Array.isArray(value)) return `[${value.map((v) => sortedJson(v)).join(", ")}]`;
  if (isObj(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}: ${sortedJson(value[k])}`).join(", ")}}`;
  }
  return "null";
}

function valueOrMissing(value: unknown): string {
  if (value === null || value === undefined) return "not provided";
  if (Array.isArray(value) || isObj(value)) return sortedJson(value);
  const text = pyTrim(pyStr(value));
  return text === "" ? "not provided" : text;
}

function normalizeLocation(
  pathValue: unknown,
  lineValue: unknown,
  endValue: unknown,
  scratch: string,
): [string, number, number | string] {
  const trimmed = stripChars(pyTrim(pyStr(pathValue)), "`'\"()[]");
  let p = trimmed;
  let lv: unknown = lineValue;
  let ev: unknown = endValue;
  const m = EMBEDDED.exec(p);
  if (m) {
    p = m[1]!;
    if (lv === undefined || lv === null) lv = m[2]!;
    if (ev === undefined || ev === null) ev = m[3] ?? null;
  }
  let line: number;
  try {
    line = pyInt(lv);
  } catch {
    fail(`finding has no numeric line: ${p}`);
  }
  if (line < 1) fail(`finding has an invalid line: ${line}`);
  let rel: string;
  try {
    const root = pyResolve(scratch);
    const abs = isAbsolute(p) ? pyResolve(p) : pyResolve(join(root, p));
    rel = relative(root, abs);
    if (rel === "") rel = ".";
    if (rel === ".." || rel.startsWith("../") || isAbsolute(rel)) throw new Error("outside");
  } catch (e) {
    if (isReportError(e)) throw e;
    fail(`finding path is outside its review scratch: ${p}`);
  }
  if (rel === "" || rel === "." || rel.startsWith("../")) {
    fail(`finding path is not a file in its review scratch: ${p}`);
  }
  let lineEnd: number | string;
  if (ev === undefined || ev === null) {
    lineEnd = "not provided";
  } else {
    try {
      lineEnd = pyInt(ev);
    } catch {
      fail(`finding has an invalid end line: ${pyStr(ev)}`);
    }
  }
  if (typeof lineEnd === "number" && lineEnd < line) {
    fail("finding end line precedes its start line");
  }
  return [rel, line, lineEnd];
}

function normalizeItem(item: unknown, harness: string, scratch: string): Finding {
  if (!isObj(item)) fail("finding is not an object");
  const path = firstTruthy(item, ["file", "path", "file_path", "filePath", "filename"]);
  const line = firstPresent(item, [
    "line",
    "line_number",
    "lineNumber",
    "start",
    "start_line",
    "startLine",
  ]);
  const end = firstPresent(item, ["end", "end_line", "line_end", "endLine"]);
  if (path === null) fail("finding has no file");
  const [file, number, lineEnd] = normalizeLocation(path, line, end, scratch);
  let severity: unknown = "severity" in item ? item["severity"] : item["priority"];
  if (
    (typeof severity === "number" &&
      Number.isInteger(severity) &&
      (severity === 1 || severity === 2 || severity === 3)) ||
    severity === true
  ) {
    severity = `P${Number(severity)}`;
  }
  const summary = firstTruthy(item, [
    "summary",
    "short_summary",
    "title",
    "description",
    "message",
    "failure_scenario",
  ]);
  const evidence = firstTruthy(item, ["evidence", "quoted_code", "code", "snippet"]);
  const body = item["body"] || item["failure_scenario"];
  return {
    file,
    line: number,
    line_end: lineEnd,
    target: `${file}:${number}`,
    severity: valueOrMissing(severity),
    summary: valueOrMissing(summary),
    body: valueOrMissing(body),
    evidence: valueOrMissing(evidence),
    confidence: valueOrMissing(item["confidence"]),
    category: valueOrMissing(item["category"]),
    source: harness,
  };
}

/** The body and evidence after a finding's line: following prose until a blank line, the
 * next heading or item; a fenced block is the finding's evidence, not its end. Also the
 * first line past the block, so the outside check knows what the finding consumed. */
function findingBody(lines: string[], index: number): [string | null, string | null, number] {
  const body: string[] = [];
  let evidence: string | null = null;
  let following = index + 1;
  const total = lines.length;
  while (following < total) {
    const textLine = pyTrim(lines[following]!);
    if (textLine === "") {
      if (body.length > 0) break;
      following++;
      continue;
    }
    if (
      textLine.startsWith("#") ||
      textLine.startsWith("- ") ||
      textLine.startsWith("* ") ||
      textLine.startsWith("Review comment:")
    ) {
      break;
    }
    if (textLine.startsWith("```")) {
      following++;
      const fence: string[] = [];
      while (following < total && !pyTrim(lines[following]!).startsWith("```")) {
        fence.push(rstripChars(lines[following]!, "\n"));
        following++;
      }
      following++;
      if (evidence === null) {
        const joined = pyTrim(fence.join("\n"));
        evidence = joined === "" ? null : joined;
      }
      continue;
    }
    body.push(textLine);
    following++;
  }
  return [body.length > 0 ? body.join("\n") : null, evidence, following];
}

function checkFencesClosed(lines: string[]): void {
  const depth = lines.filter((raw) => pyTrim(raw).startsWith("```")).length;
  if (depth % 2 === 1) fail("review output has an unclosed code fence");
}

/** A path:line citation: the path must hold a letter, so Makefile:8 counts and 12:30
 * does not. */
function citesLocation(line: string): boolean {
  const m = LOCATION.exec(line);
  return m !== null && HAS_LETTER.test(m.groups!.path!);
}

/** Blank citations and fenced lines under recorded not-issues headings, keeping line
 * numbers and prose, so their citations neither parse as findings nor trip the outside
 * check. */
function descopeNotIssues(text: string): string {
  const out: string[] = [];
  let inFence = false;
  let skip = false;
  let skipLevel = 0;
  for (const raw of pySplitLines(text)) {
    const stripped = pyTrim(raw);
    if (stripped.startsWith("```")) {
      inFence = !inFence;
      out.push(skip ? "" : raw);
      continue;
    }
    if (!inFence && stripped.startsWith("#")) {
      const hashes = LEAD_HASH.exec(stripped)![0].length;
      if (SKIP_SECTIONS.includes(rstripChars(pyLower(pyTrim(lstripChars(stripped, "#"))), ":"))) {
        skip = true;
        skipLevel = hashes;
      } else if (skip && hashes <= skipLevel) {
        skip = false;
      }
    }
    if (skip && (inFence || citesLocation(stripped))) out.push("");
    else out.push(raw);
  }
  return out.join("\n");
}

/** Findings plus the text outside them: every line no finding block consumed and no fence
 * quotes, for the outside check. */
function markdownFindingsSpans(
  text: string,
  harness: string,
  scratch: string,
): [Finding[], string] {
  const findings: Finding[] = [];
  const consumed = new Set<number>();
  const fenced = new Set<number>();
  let inFence = false;
  const lines = pySplitLines(text);
  for (let index = 0; index < lines.length; index++) {
    const line = pyTrim(lines[index]!);
    if (line.startsWith("```")) {
      inFence = !inFence;
      fenced.add(index);
      continue;
    }
    if (inFence) {
      fenced.add(index);
      continue;
    }
    if (isExactNoOther(line)) continue;
    if (!isFindingFormLine(line)) continue;
    const m = LOCATION.exec(line)!;
    let prefix = stripChars(line.slice(0, m.index), "#*-` :—–");
    const suffix = stripChars(line.slice(m.index + m[0].length), "` :—–-");
    if (pyLower(prefix) === "bug") prefix = "";
    const title = pyTrim([prefix, suffix].filter((part) => part !== "").join(" "));
    const [body, evidence, end] = findingBody(lines, index);
    try {
      findings.push(
        normalizeItem(
          {
            file: m.groups!.path!,
            line: m.groups!.line!,
            end_line: m.groups!.end ?? null,
            summary: title,
            body,
            evidence,
          },
          harness,
          scratch,
        ),
      );
    } catch (e) {
      if (isReportError(e)) fail(`report line ${index + 1}: ${e.message}`);
      throw e;
    }
    for (let n = index; n < end; n++) consumed.add(n);
  }
  const rest: string[] = [];
  for (let n = 0; n < lines.length; n++) {
    if (!consumed.has(n) && !fenced.has(n)) rest.push(lines[n]!);
  }
  return [findings, rest.join("\n")];
}

/** Findings plus the text outside them, as markdownFindingsSpans. */
function codexFindingsSpans(text: string, scratch: string): [Finding[], string] {
  const findings: Finding[] = [];
  const consumed = new Set<number>();
  const fenced = new Set<number>();
  let inFence = false;
  const lines = pySplitLines(text);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const stripped = pyTrim(line);
    if (stripped.startsWith("```")) {
      inFence = !inFence;
      fenced.add(index);
      continue;
    }
    if (inFence) {
      fenced.add(index);
      continue;
    }
    const m = CODEX_LINE.exec(line);
    if (m) {
      const severity = m[1]!;
      const title = m[2]!;
      const path = m[3]!;
      const start = m[4]!;
      const end = m[5] ?? null;
      const [body, evidence, blockEnd] = findingBody(lines, index);
      try {
        findings.push(
          normalizeItem(
            {
              file: path,
              line: start,
              end_line: end,
              severity,
              title,
              body,
              evidence,
            },
            "codex",
            scratch,
          ),
        );
      } catch (e) {
        if (isReportError(e)) fail(`report line ${index + 1}: ${e.message}`);
        throw e;
      }
      for (let n = index; n < blockEnd; n++) consumed.add(n);
    }
  }
  const rest: string[] = [];
  for (let n = 0; n < lines.length; n++) {
    if (!consumed.has(n) && !fenced.has(n)) rest.push(lines[n]!);
  }
  return [findings, rest.join("\n")];
}

function parseReport(harness: string, text: string, scratch: string): Finding[] {
  if (pyTrim(text) === "") fail("review output is empty");
  const ntext = normalizeText(text);
  if (isCleanForm(ntext)) return [];
  if (harness === "claude") {
    const found = claudeJson(ntext);
    if (found !== null) {
      const [items, outside] = found;
      const normalized: Finding[] = [];
      items.forEach((item, position) => {
        try {
          normalized.push(normalizeItem(item, harness, scratch));
        } catch (e) {
          if (isReportError(e)) fail(`finding ${position}: ${e.message}`);
          throw e;
        }
      });
      checkFindingWords(ntext);
      checkOutside(outside, normalized, scratch);
      return uniqueFindings(normalized);
    }
  }
  checkFencesClosed(pySplitLines(text));
  const scoped = descopeNotIssues(text);
  if (harness === "codex") {
    const [findings, outside] = codexFindingsSpans(scoped, scratch);
    if (findings.length > 0) {
      checkOutside(outside, findings, scratch);
      return uniqueFindings(findings);
    }
  }
  const [findings, outside] = markdownFindingsSpans(scoped, harness, scratch);
  if (findings.length > 0) {
    checkOutside(outside, findings, scratch);
    return uniqueFindings(findings);
  }
  fail(`cannot parse review output from ${harness}`);
}

function uniqueFindings(findings: Finding[]): Finding[] {
  const unique: Finding[] = [];
  const seen = new Map<string, number>();
  for (const finding of findings) {
    const key = JSON.stringify([
      finding.file,
      finding.line,
      finding.line_end,
      finding.severity,
      finding.summary,
    ]);
    const at = seen.get(key);
    if (at === undefined) {
      seen.set(key, unique.length);
      unique.push(finding);
    } else {
      const prev = unique[at]!;
      for (const f of Object.keys(finding) as (keyof Finding)[]) {
        if (prev[f] === "not provided" && finding[f] !== "not provided") {
          (prev as unknown as Record<string, unknown>)[f] = finding[f];
        }
      }
    }
  }
  return unique;
}

// --- streams ----------------------------------------------------------------------------
function readEvents(path: string): unknown[] {
  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch (e) {
    fail(`cannot read ${path}: ${errMsg(e)}`);
  }
  const lines = pySplitLines(decodeUtf8(buf));
  const events: unknown[] = [];
  lines.forEach((line, n) => {
    if (pyTrim(line) === "") return;
    try {
      events.push(JSON.parse(line) as unknown);
    } catch (e) {
      fail(`${path} line ${n + 1} is not JSON: ${errMsg(e)}`);
    }
  });
  return events;
}

function finalReport(harness: string, eventsPath: string, lastPath: string | null): string {
  const events = readEvents(eventsPath);
  if (harness === "claude") {
    const results: Record<string, unknown>[] = [];
    for (const event of events) {
      if (eventField(event, "type") === "result") results.push(event as Record<string, unknown>);
    }
    if (results.length === 0) fail("Claude stream has no final result text");
    // The last result rules, whatever shape it is: a run that ended in error, or ended
    // without text, is a failed reviewer, never a clean review.
    const last = results[results.length - 1]!;
    if (last["subtype"] !== "success") {
      fail(`claude review run did not succeed (subtype: ${last["subtype"] || "missing"})`);
    }
    if (typeof last["result"] !== "string") {
      fail("claude review run ended with no result text");
    }
    return last["result"];
  }
  if (harness === "mimo") {
    const reports: string[] = [];
    for (const event of events) {
      if (eventField(event, "type") !== "text") continue;
      const partRaw = eventField(event, "part");
      const part = partRaw ? partRaw : {};
      if (!isObj(part)) throw new Error("review event part is not an object");
      if (typeof part["text"] === "string") reports.push(part["text"]);
    }
    if (reports.length === 0) fail("MiMo Code stream has no final text event");
    return reports[reports.length - 1]!;
  }
  if (harness === "codex") {
    if (!lastPath) fail("Codex review normalization needs the --last output file");
    // The --last file is trusted only when the review's turn completed: codex writes -o
    // only on success, so a failed turn's file is an earlier attempt's.
    if (events.some((event) => eventField(event, "type") === "turn.failed")) {
      fail("codex review turn failed; refusing its --last output as stale");
    }
    if (!events.some((event) => eventField(event, "type") === "turn.completed")) {
      fail("codex stream shows no completed turn; refusing its --last output as stale");
    }
    let buf: Buffer;
    try {
      buf = readFileSync(lastPath);
    } catch (e) {
      fail(`cannot read Codex --last output ${lastPath}: ${errMsg(e)}`);
    }
    return decodeUtf8(buf);
  }
  fail(`${harness} has no code-review form`);
}

const SUPPORTED = new Set(["claude", "codex", "mimo"]);

function normalizeCli(
  lane: string,
  scratch: string,
  eventsPath: string,
  runDir: string,
  lastPath: string | null,
): Finding[] {
  const at = (v: unknown): Record<string, unknown> => {
    if (!isObj(v)) throw new TypeError("not an object");
    return v;
  };
  let harness: unknown;
  try {
    const run = JSON.parse(decodeUtf8(readFileSync(join(runDir, "run.json")))) as unknown;
    harness = at(at(at(at(run)["config"])["lanes"])[lane])["harness"];
  } catch (e) {
    if (isReportError(e)) throw e;
    fail(`cannot read recorded harness for lane ${lane} from ${runDir}/run.json: ${errMsg(e)}`);
  }
  if (typeof harness !== "string" || !SUPPORTED.has(harness)) {
    fail(`${pyStr(harness)} has no code-review form`);
  }
  return parseReport(harness, finalReport(harness, eventsPath, lastPath), scratch);
}

function sameBytes(aPath: string, bPath: string): boolean {
  return readFileSync(aPath).equals(readFileSync(bPath));
}

function harvest(
  eventsPath: string,
  logsDir: string,
  prefix: string,
  taskRoot: string | null = null,
): string[] {
  const wanted: string[] = [];
  for (const event of readEvents(eventsPath)) {
    if (
      eventField(event, "type") === "system" &&
      eventField(event, "subtype") === "task_notification"
    ) {
      const path = eventField(event, "output_file");
      if (!path) fail("task_notification names no output file");
      if (typeof path !== "string") fail("task_notification output_file is not text");
      if (!wanted.includes(path)) wanted.push(path);
    }
  }
  mkdirSync(logsDir, { recursive: true });
  const scrubbed = stripChars(prefix.replace(PREFIX_SANITIZE, "-"), ".-");
  const clean = scrubbed === "" ? "review" : scrubbed;
  // The root is resolved before comparing: the task path always is, so an unresolved root
  // under a symlinked /tmp would refuse its own files. The override exists for fixtures.
  const root = taskRoot !== null ? pyResolve(taskRoot) : pyResolve(`/tmp/claude-${uid()}`);
  const planned: Array<[string, string]> = [];
  wanted.forEach((path, n) => {
    const index = n + 1;
    let resolved: string;
    try {
      resolved = realpathSync(path);
    } catch {
      fail(`Claude task output named by task_notification is missing: ${path}`);
    }
    const rel = relative(root, resolved);
    if (rel === ".." || rel.startsWith("../") || isAbsolute(rel)) {
      fail(`Claude task output is outside ${root}: ${path}`);
    }
    let isFile = false;
    try {
      isFile = statSync(resolved).isFile();
    } catch {
      isFile = false;
    }
    if (!isFile) fail(`Claude task output named by task_notification is not a file: ${path}`);
    const destination = join(
      logsDir,
      `${clean}-claude-task-${String(index).padStart(2, "0")}-${basename(path)}`,
    );
    if (existsSync(destination) && !sameBytes(resolved, destination)) {
      fail(`refusing to overwrite harvested task output: ${destination}`);
    }
    planned.push([resolved, destination]);
  });
  const copied: string[] = [];
  for (const [resolved, destination] of planned) {
    // Every destination was vetted above: a refused harvest copies nothing.
    if (existsSync(destination)) {
      copied.push(destination);
      continue;
    }
    try {
      copyFileSync(resolved, destination);
    } catch (e) {
      fail(`cannot copy Claude task output ${resolved}: ${errMsg(e)}`);
    }
    copied.push(destination);
  }
  return copied;
}

// --- entry ------------------------------------------------------------------------------
function main(argv: string[]): number {
  if (argv.length > 0 && argv[0] === "normalize" && argv.length >= 6) {
    const lane = argv[1]!;
    const scratch = argv[2]!;
    const eventsPath = argv[3]!;
    let runDir: string | null = null;
    let lastPath: string | null = null;
    const rest = argv.slice(4);
    while (rest.length > 0) {
      const option = rest.shift()!;
      if ((option === "--run" || option === "--last") && rest.length > 0) {
        const value = rest.shift()!;
        if (option === "--run") runDir = value;
        else lastPath = value;
      } else {
        fail(`unknown or incomplete option: ${option}`);
      }
    }
    if (!runDir) fail("normalize needs --run <dispatch>");
    console.log(JSON.stringify(normalizeCli(lane, scratch, eventsPath, runDir, lastPath), null, 2));
    return 0;
  }
  if (argv.length > 0 && argv[0] === "harvest" && argv.length === 5 && argv[3] === "--prefix") {
    for (const p of harvest(argv[1]!, argv[2]!, argv[4]!)) console.log(p);
    return 0;
  }
  console.error(USAGE);
  return 1;
}

// --- self-test ----------------------------------------------------------------------------
function selfTest(): void {
  const SELF = join(HERE, "review-findings.sh");
  const TOOL = toolRoot(import.meta);
  const st = new SelfTest();
  withTempDir((directory: string) => {
    const root = directory;
    const scratch = join(root, "scratch");
    mkdirSync(join(scratch, "src"), { recursive: true });
    const logs = join(root, "logs");
    const taskHome = join(`/tmp/claude-${uid()}`, `postmaster-selftest-${process.pid}`);
    mkdirSync(taskHome, { recursive: true });
    const external = join(taskHome, "claude-task-output.txt");
    writeFileSync(external, "review task tools\n");

    const runConfig = (name: string, harness: string): string => {
      const folder = join(root, name);
      mkdirSync(folder, { recursive: true });
      writeFileSync(
        folder + "/run.json",
        JSON.stringify({ config: { lanes: { one: { harness } } } }),
      );
      return folder;
    };
    const cli = (...args: string[]) => run(SELF, args);
    const detail = (r: { out: string; err: string }): string => r.err || r.out;
    const writeEvents = (name: string, events: unknown[]): string => {
      const eventFile = join(root, name);
      writeFileSync(eventFile, events.map((e) => JSON.stringify(e)).join("\n") + "\n");
      return eventFile;
    };

    const claudeResult =
      '[{"file":"src/page.js","line":8,"summary":"Page includes one extra item","category":"correctness"}]\nA sentence that is not a finding.';
    const fixtures: Array<[string, unknown[]]> = [
      [
        "claude",
        [
          { type: "system", subtype: "task_notification", output_file: external },
          { type: "result", subtype: "success", result: claudeResult },
        ],
      ],
      ["codex", [{ type: "turn.completed" }]],
      [
        "mimo",
        [
          {
            type: "text",
            sessionID: "ses_1",
            part: {
              type: "text",
              text: "### Bug — \\`src/page.js:8\\`: Page includes one extra item\n\nThe exclusive end repeats the boundary record.\n\n### No other issues found.",
            },
          },
        ],
      ],
    ];
    for (const [harness, events] of fixtures) {
      const folder = runConfig(harness, harness);
      const eventFile = writeEvents(`${harness}.events`, events);
      const args = ["normalize", "one", scratch, eventFile, "--run", folder];
      if (harness === "codex") {
        const last = join(root, "codex.last");
        writeFileSync(
          last,
          `- [P1] Page includes one extra item — ${scratch}/src/page.js:8-8\n\nReview comment:\n\n- [P1] Page includes one extra item — ${scratch}/src/page.js:8-8\n  \\\`slice\\\` uses an exclusive end index.\n`,
        );
        args.push("--last", last);
      }
      const r = cli(...args);
      try {
        const parsed = JSON.parse(r.out) as Array<Record<string, unknown>>;
        const finding = parsed[0]!;
        let positive =
          r.code === 0 &&
          parsed.length === 1 &&
          finding["file"] === "src/page.js" &&
          finding["line"] === 8 &&
          finding["target"] === "src/page.js:8";
        if (harness === "codex") {
          positive =
            positive &&
            finding["severity"] === "P1" &&
            String(finding["body"]).includes("exclusive end index");
        }
        if (harness === "claude") {
          positive =
            positive &&
            finding["severity"] === "not provided" &&
            finding["category"] === "correctness";
        }
        if (harness === "mimo") {
          positive = positive && String(finding["body"]).includes("boundary record");
        }
        st.check(
          `${harness} recorded finding is normalized at its file and line`,
          positive,
          detail(r),
        );
      } catch {
        st.check(
          `${harness} recorded finding is normalized at its file and line`,
          false,
          detail(r),
        );
      }
    }

    const emptyText: Array<[string, unknown]> = [
      ["claude", { type: "result", subtype: "success", result: "[]" }],
      ["codex", null],
      ["mimo", { type: "text", part: { type: "text", text: "No findings." } }],
    ];
    for (const [harness, event] of emptyText) {
      const folder = runConfig(`${harness}-empty`, harness);
      const eventFile = writeEvents(`${harness}-empty.events`, [
        event ?? { type: "turn.completed" },
      ]);
      const args = ["normalize", "one", scratch, eventFile, "--run", folder];
      if (harness === "codex") {
        const last = join(root, "codex-empty.last");
        writeFileSync(last, "No findings.\n");
        args.push("--last", last);
      }
      const r = cli(...args);
      st.check(
        `${harness} recorded empty report yields no findings`,
        r.code === 0 && pyTrim(r.out) === "[]",
        detail(r),
      );
    }

    const fenced = writeEvents("claude-fenced.events", [
      {
        type: "result",
        subtype: "success",
        result:
          'Nine findings remain.\n\n```json\n[{"file": "src/page.js", "line": 8, "summary": "Off-by-one in slice"}]\n```\n',
      },
    ]);
    {
      const r = cli("normalize", "one", scratch, fenced, "--run", runConfig("fenced", "claude"));
      try {
        const parsed = JSON.parse(r.out) as Array<Record<string, unknown>>;
        st.check(
          "claude fenced JSON array is read as findings",
          r.code === 0 &&
            parsed.length === 1 &&
            parsed[0]!["file"] === "src/page.js" &&
            parsed[0]!["line"] === 8,
          detail(r),
        );
      } catch {
        st.check("claude fenced JSON array is read as findings", false, detail(r));
      }
    }

    // The reader preserves or refuses, never alters: only a fence wrapping the whole
    // report comes off, never one inside a string value.
    const evidenceText = "```js\nx\n```";
    const innerFence = writeEvents("claude-inner-fence.events", [
      {
        type: "result",
        subtype: "success",
        result: JSON.stringify([
          { file: "src/a.js", line: 1, summary: "s", evidence: evidenceText },
        ]),
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        innerFence,
        "--run",
        runConfig("inner-fence", "claude"),
      );
      try {
        const parsed = JSON.parse(r.out) as Array<Record<string, unknown>>;
        st.check(
          "a fenced snippet inside evidence normalizes byte for byte",
          r.code === 0 && parsed.length === 1 && parsed[0]!["evidence"] === evidenceText,
          detail(r),
        );
      } catch {
        st.check("a fenced snippet inside evidence normalizes byte for byte", false, detail(r));
      }
    }
    const wrapped = writeEvents("claude-wrapped.events", [
      {
        type: "result",
        subtype: "success",
        result:
          "```json\n" + JSON.stringify([{ file: "src/a.js", line: 1, summary: "s" }]) + "\n```\n",
      },
    ]);
    {
      const r = cli("normalize", "one", scratch, wrapped, "--run", runConfig("wrapped", "claude"));
      try {
        const parsed = JSON.parse(r.out) as Array<Record<string, unknown>>;
        st.check(
          "a report wrapped in one fence still parses",
          r.code === 0 && parsed.length === 1 && parsed[0]!["file"] === "src/a.js",
          detail(r),
        );
      } catch {
        st.check("a report wrapped in one fence still parses", false, detail(r));
      }
    }

    // A claude item's reproduction reaches triage: with no body, its failure_scenario
    // becomes the body instead of being dropped.
    const scenario = "Store holds r0..r9; page(1, 3) returns 4 items.";
    const scenarioEvents = writeEvents("claude-scenario.events", [
      {
        type: "result",
        subtype: "success",
        result: JSON.stringify([
          { file: "src/a.js", line: 1, summary: "Off by one", failure_scenario: scenario },
        ]),
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        scenarioEvents,
        "--run",
        runConfig("scenario", "claude"),
      );
      try {
        const parsed = JSON.parse(r.out) as Array<Record<string, unknown>>;
        st.check(
          "an item with summary and failure_scenario normalizes with that scenario as its body",
          r.code === 0 && parsed.length === 1 && parsed[0]!["body"] === scenario,
          detail(r),
        );
      } catch {
        st.check(
          "an item with summary and failure_scenario normalizes with that scenario as its body",
          false,
          detail(r),
        );
      }
    }

    const proseClean = writeEvents("mimo-prose.events", [
      {
        type: "text",
        part: {
          type: "text",
          text: "Nothing to review. The worktree has no uncommitted changes.\n",
        },
      },
    ]);
    {
      const r = cli("normalize", "one", scratch, proseClean, "--run", runConfig("prose", "mimo"));
      st.check(
        "a clean verdict in longer prose fails loudly",
        r.code === 1 && r.err.includes("cannot parse review output"),
        detail(r),
      );
    }

    const guarded = writeEvents("codex-guarded.events", [{ type: "turn.completed" }]);
    const guardedLast = join(root, "codex-guarded.last");
    writeFileSync(
      guardedLast,
      "No problems found in the files I read.\n- [P1] Something is wrong somewhere\n",
    );
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        guarded,
        "--run",
        runConfig("guarded", "codex"),
        "--last",
        guardedLast,
      );
      st.check(
        "a clean phrase beside a finding marker still fails loudly",
        r.code === 1 && r.err.includes("cannot parse review output"),
        detail(r),
      );
    }

    // Codex's --last file is trusted only when the review's turn completed: codex writes
    // -o only on success, so a failed turn's file is stale.
    const staleClean = join(root, "codex-stale.last");
    writeFileSync(staleClean, "No findings.\n");
    const failedTurn = writeEvents("codex-failed.events", [
      { type: "thread.started" },
      { type: "turn.started" },
      { type: "turn.failed", error: { message: "provider wall" } },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        failedTurn,
        "--run",
        runConfig("failed-turn", "codex"),
        "--last",
        staleClean,
      );
      st.check(
        "a stale clean --last beside a failed turn fails loudly, never clean",
        r.code === 1 && r.err.includes("turn failed"),
        detail(r),
      );
    }
    const noTurn = writeEvents("codex-noturn.events", [
      { type: "thread.started" },
      { type: "turn.started" },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        noTurn,
        "--run",
        runConfig("no-turn", "codex"),
        "--last",
        staleClean,
      );
      st.check(
        "a clean --last with no completed turn fails loudly, never clean",
        r.code === 1 && r.err.includes("no completed turn"),
        detail(r),
      );
    }

    for (const harness of SUPPORTED) {
      const folder = runConfig(`bad-${harness}`, harness);
      const report = "Maybe everything looks fine.";
      const event =
        harness === "claude"
          ? { type: "result", subtype: "success", result: report }
          : harness === "mimo"
            ? { type: "text", part: { type: "text", text: report } }
            : { type: "turn.completed" };
      const eventFile = writeEvents(`bad-${harness}.events`, [event]);
      const args = ["normalize", "one", scratch, eventFile, "--run", folder];
      if (harness === "codex") {
        const last = join(root, "bad-codex.last");
        writeFileSync(last, "Maybe everything looks fine.\n");
        args.push("--last", last);
      }
      const r = cli(...args);
      st.check(
        `${harness} unrecognized report fails instead of becoming clean`,
        r.code === 1 && r.err.includes("cannot parse review output"),
        detail(r),
      );
    }

    const harvestEvents = writeEvents("harvest.events", [
      { type: "system", subtype: "task_notification", output_file: external },
    ]);
    {
      const r = cli("harvest", harvestEvents, logs, "--prefix", "r1-bug-one");
      const copied = join(logs, `r1-bug-one-claude-task-01-${basename(external)}`);
      st.check(
        "Claude task_notification transcript is copied into run logs",
        r.code === 0 &&
          existsSync(copied) &&
          readFileSync(copied, "utf8").includes("review task tools"),
        detail(r),
      );
    }
    const partial = writeEvents("harvest-partial.events", [
      { type: "system", subtype: "task_notification", output_file: external },
      { type: "system", subtype: "task_notification", output_file: join(taskHome, "absent.txt") },
    ]);
    const partialLogs = join(root, "logs-partial");
    {
      const r = cli("harvest", partial, partialLogs, "--prefix", "partial");
      st.check(
        "a missing task file fails before anything is copied",
        r.code === 1 && r.err.includes("missing") && readdirSync(partialLogs).length === 0,
        detail(r),
      );
    }
    const one = writeEvents("harvest-one.events", [
      { type: "system", subtype: "task_notification", output_file: external },
    ]);
    const retryLogs = join(root, "logs-retry");
    const first = cli("harvest", one, retryLogs, "--prefix", "retry");
    const again = cli("harvest", one, retryLogs, "--prefix", "retry");
    st.check(
      "an identical re-harvest is a no-op",
      first.code === 0 && again.code === 0 && again.out === first.out,
      detail(first) + detail(again),
    );
    writeFileSync(join(retryLogs, `retry-claude-task-01-${basename(external)}`), "changed\n");
    {
      const clobber = cli("harvest", one, retryLogs, "--prefix", "retry");
      st.check(
        "a re-harvest over different content still refuses",
        clobber.code === 1 && clobber.err.includes("refusing to overwrite"),
        detail(clobber),
      );
    }
    const outside = join(root, "outside-task-output.txt");
    writeFileSync(outside, "not a task file\n");
    const negatives: Array<[string, unknown, string]> = [
      [
        "a task_notification without an output file fails",
        { type: "system", subtype: "task_notification" },
        "names no output file",
      ],
      [
        "a task_notification with an empty output file fails",
        { type: "system", subtype: "task_notification", output_file: "" },
        "names no output file",
      ],
      [
        "a task_notification with a non-text output file fails",
        { type: "system", subtype: "task_notification", output_file: 7 },
        "not text",
      ],
      [
        "a task_notification naming a missing file fails",
        { type: "system", subtype: "task_notification", output_file: join(taskHome, "absent.txt") },
        "missing",
      ],
    ];
    negatives.forEach(([label, notification, message], number) => {
      const events = writeEvents(`harvest-neg-${number}.events`, [notification]);
      const r = cli("harvest", events, logs, "--prefix", "neg");
      st.check(label, r.code === 1 && r.err.includes(message), detail(r));
    });
    // The outside-tree case names its allowed root explicitly: a scratchpad TMPDIR sits
    // inside the default root, so a tempfile fixture is outside it only by luck.
    const tree = join(root, "task-tree");
    mkdirSync(tree);
    const outsideEvents = writeEvents("harvest-outside.events", [
      { type: "system", subtype: "task_notification", output_file: outside },
    ]);
    try {
      harvest(outsideEvents, join(root, "logs-outside"), "outside", tree);
      st.check("a task_notification naming a file outside the task tree fails", false, "no error");
    } catch (e) {
      st.check(
        "a task_notification naming a file outside the task tree fails",
        isReportError(e) && e.message.includes("outside"),
        errMsg(e),
      );
    }
    const inner = join(taskHome, "inner-task-output.txt");
    writeFileSync(inner, "inside the default root\n");
    const innerEvents = writeEvents("harvest-inner.events", [
      { type: "system", subtype: "task_notification", output_file: inner },
    ]);
    try {
      harvest(innerEvents, join(root, "logs-inner"), "inner", tree);
      st.check(
        "a file inside the default root but outside the named root still fails",
        false,
        "no error",
      );
    } catch (e) {
      st.check(
        "a file inside the default root but outside the named root still fails",
        isReportError(e) && e.message.includes("outside"),
        errMsg(e),
      );
    }
    const quiet = writeEvents("harvest-quiet.events", [{ type: "turn.completed" }]);
    {
      const r = cli("harvest", quiet, logs, "--prefix", "quiet");
      st.check(
        "a stream with no task_notification harvests nothing and exits 0",
        r.code === 0 && r.out === "",
        detail(r),
      );
    }
    // The coachman.md sample degrades a lane whose harvest failed: no normalize, no
    // findings JSON. Both sides of that branch, on the one stream.
    const degradeEvents = writeEvents("degrade.events", [
      { type: "system", subtype: "task_notification", output_file: join(taskHome, "absent.txt") },
      { type: "result", subtype: "success", result: "[]" },
    ]);
    const degradeHarvest = cli(
      "harvest",
      degradeEvents,
      join(root, "logs-degrade"),
      "--prefix",
      "degrade",
    );
    const degradeJson = join(root, "logs-degrade-findings.json");
    if (degradeHarvest.code === 0) {
      const passed = cli(
        "normalize",
        "one",
        scratch,
        degradeEvents,
        "--run",
        runConfig("degrade", "claude"),
      );
      if (passed.code === 0) writeFileSync(degradeJson, passed.out);
    }
    st.check(
      "a lane whose task file is missing ends DEGRADED with no findings JSON",
      degradeHarvest.code === 1 &&
        degradeHarvest.err.includes("missing") &&
        !existsSync(degradeJson),
      detail(degradeHarvest),
    );
    {
      const skipped = cli(
        "normalize",
        "one",
        scratch,
        degradeEvents,
        "--run",
        runConfig("degrade-skip", "claude"),
      );
      st.check(
        "the same stream still normalizes, so skipping it is what keeps the verdict uncounted",
        skipped.code === 0 && pyTrim(skipped.out) === "[]",
        detail(skipped),
      );
    }
    const presentEvents = writeEvents("degrade-present.events", [
      { type: "system", subtype: "task_notification", output_file: external },
      { type: "result", subtype: "success", result: claudeResult },
    ]);
    const presentHarvest = cli(
      "harvest",
      presentEvents,
      join(root, "logs-degrade-present"),
      "--prefix",
      "present",
    );
    const presentJson = join(root, "logs-degrade-present-findings.json");
    if (presentHarvest.code === 0) {
      const present = cli(
        "normalize",
        "one",
        scratch,
        presentEvents,
        "--run",
        runConfig("degrade-present", "claude"),
      );
      if (present.code === 0) writeFileSync(presentJson, present.out);
    }
    try {
      const parsed = JSON.parse(readFileSync(presentJson, "utf8")) as Array<
        Record<string, unknown>
      >;
      st.check(
        "the same stream with the file present harvests and normalizes to its finding",
        presentHarvest.code === 0 &&
          parsed.length === 1 &&
          parsed[0]!["file"] === "src/page.js" &&
          parsed[0]!["line"] === 8,
        detail(presentHarvest),
      );
    } catch {
      st.check(
        "the same stream with the file present harvests and normalizes to its finding",
        false,
        detail(presentHarvest),
      );
    }
    // Consequence (1): the sample's degrade arm writes the run-log line as well as the
    // degrade action. This executes the sample itself, read from the runbook as
    // launch.sh's self-test reads it, not a copy of its logic.
    const coachman = readFileSync(join(TOOL, "skills", "postmaster", "coachman.md"), "utf8");
    const blocks = [...coachman.matchAll(SH_BLOCKS)].map((m) => m[1]!);
    const samples = blocks.filter(
      (block) => block.includes('NORMALIZE_FAILED=""') && block.includes("HARVEST_ERR"),
    );
    const sampleDispatch = join(root, "sample-dispatch");
    mkdirSync(join(sampleDispatch, "logs"), { recursive: true });
    writeFileSync(
      join(sampleDispatch, "logs", "review-r9-bug-one.jsonl"),
      JSON.stringify({
        type: "system",
        subtype: "task_notification",
        output_file: join(taskHome, "absent.txt"),
      }) +
        "\n" +
        JSON.stringify({ type: "result", subtype: "success", result: "[]" }) +
        "\n",
    );
    if (samples.length !== 1) {
      st.check(
        "executing the sample on the missing-file fixture writes both lines",
        false,
        `${samples.length} degrade samples in coachman.md`,
      );
    } else {
      let sample = samples[0]!.split("<tool>").join(TOOL);
      sample = sample.split("<dispatch>").join(sampleDispatch).split("<repo>").join(root);
      sample = sample.split("<TICKET>").join("T").split("<round>").join("9");
      sample = sample.replace(FOR_LOOP, "for L in one; do");
      sample = sample.split(`DEST=${root}/.worktrees/T-rev-bug-$L`).join(`DEST=${scratch}`);
      writeFileSync(join(root, "sample.sh"), sample);
      const ran = run("bash", [join(root, "sample.sh")]);
      const logged: unknown[] = [];
      if (existsSync(join(sampleDispatch, "actions.jsonl"))) {
        for (const raw of pySplitLines(
          readFileSync(join(sampleDispatch, "actions.jsonl"), "utf8"),
        )) {
          try {
            logged.push(JSON.parse(raw) as unknown);
          } catch {
            // a non-JSON line is not a logged action
          }
        }
      }
      const degraded = logged.filter(
        (entry) => isObj(entry) && entry["action"] === "degrade" && entry["target"] === "one",
      );
      const narrative = existsSync(join(sampleDispatch, "run-log.md"))
        ? readFileSync(join(sampleDispatch, "run-log.md"), "utf8")
        : "";
      st.check(
        "executing the sample on the missing-file fixture writes both lines",
        ran.code === 0 && degraded.length === 1 && narrative.includes("one bug: DEGRADED,"),
        ran.err || JSON.stringify(logged) + narrative,
      );
    }
    const emptyFirst = writeEvents("claude-empty-first.events", [
      {
        type: "result",
        subtype: "success",
        result: '[]\n[{"file": "src/page.js", "line": 8, "summary": "bug"}]',
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        emptyFirst,
        "--run",
        runConfig("empty-first", "claude"),
      );
      try {
        const parsed = JSON.parse(r.out) as Array<Record<string, unknown>>;
        st.check(
          "an empty JSON list before findings does not read as clean",
          r.code === 0 &&
            parsed.length === 1 &&
            parsed[0]!["file"] === "src/page.js" &&
            parsed[0]!["line"] === 8,
          detail(r),
        );
      } catch {
        st.check("an empty JSON list before findings does not read as clean", false, detail(r));
      }
    }
    const ambiguous = writeEvents("claude-ambiguous.events", [
      {
        type: "result",
        subtype: "success",
        result:
          '[{"file": "src/a.js", "line": 1, "summary": "one"}]\n[{"file": "src/b.js", "line": 2, "summary": "two"}]',
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        ambiguous,
        "--run",
        runConfig("ambiguous", "claude"),
      );
      st.check(
        "two non-empty JSON lists fail loudly",
        r.code === 1 && r.err.includes("JSON finding lists"),
        detail(r),
      );
    }
    const scalarFirst = writeEvents("claude-scalar-first.events", [
      {
        type: "result",
        subtype: "success",
        result: 'Counts [1, 2, 3] aside.\n[{"file": "src/page.js", "line": 8, "summary": "bug"}]',
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        scalarFirst,
        "--run",
        runConfig("scalar-first", "claude"),
      );
      try {
        const parsed = JSON.parse(r.out) as Array<Record<string, unknown>>;
        st.check(
          "an incidental scalar list does not hide the findings",
          r.code === 0 && parsed.length === 1 && parsed[0]!["file"] === "src/page.js",
          detail(r),
        );
      } catch {
        st.check("an incidental scalar list does not hide the findings", false, detail(r));
      }
    }
    const timed = writeEvents("mimo-timed.events", [
      { type: "text", part: { type: "text", text: "No findings. Checked at 12:30." } },
    ]);
    {
      const r = cli("normalize", "one", scratch, timed, "--run", runConfig("timed", "mimo"));
      st.check(
        "a clean verdict mentioning a time fails loudly",
        r.code === 1 && r.err.includes("cannot parse review output"),
        detail(r),
      );
    }
    const fencedEvidence = writeEvents("mimo-fenced-evidence.events", [
      {
        type: "text",
        part: {
          type: "text",
          text: "### Bug — `src/page.js:8`: off by one\n\n```js\nreturn all().slice(start, start + size + 1);\n```\n\nThe exclusive end repeats the boundary record.\n",
        },
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        fencedEvidence,
        "--run",
        runConfig("fenced-evidence", "mimo"),
      );
      try {
        const parsed = JSON.parse(r.out) as Array<Record<string, unknown>>;
        st.check(
          "a fenced block after a finding is kept as its evidence",
          r.code === 0 &&
            parsed.length === 1 &&
            String(parsed[0]!["evidence"]).includes("slice(start, start + size") &&
            String(parsed[0]!["body"]).includes("boundary record"),
          detail(r),
        );
      } catch {
        st.check("a fenced block after a finding is kept as its evidence", false, detail(r));
      }
    }
    const mixed = writeEvents("claude-mixed.events", [
      {
        type: "result",
        subtype: "success",
        result:
          '[{"file": "src/a.js", "line": 1, "summary": "good"}, {"summary": "no file"}, {"file": "src/b.js", "line": 2, "summary": "good"}]',
      },
    ]);
    {
      const r = cli("normalize", "one", scratch, mixed, "--run", runConfig("mixed", "claude"));
      st.check(
        "a bad item names its index when the batch fails",
        r.code === 1 && r.err.includes("finding 1"),
        detail(r),
      );
    }
    const dictEmptyFirst = writeEvents("claude-dict-empty-first.events", [
      {
        type: "result",
        subtype: "success",
        result:
          '{"findings": [], "issues": [{"file": "src/page.js", "line": 8, "summary": "bug"}]}',
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        dictEmptyFirst,
        "--run",
        runConfig("dict-empty-first", "claude"),
      );
      try {
        const parsed = JSON.parse(r.out) as Array<Record<string, unknown>>;
        st.check(
          "an empty findings list does not win over a real issues list",
          r.code === 0 && parsed.length === 1 && parsed[0]!["file"] === "src/page.js",
          detail(r),
        );
      } catch {
        st.check("an empty findings list does not win over a real issues list", false, detail(r));
      }
    }
    const dictTwoFull = writeEvents("claude-dict-two-full.events", [
      {
        type: "result",
        subtype: "success",
        result:
          '{"findings": [{"file": "src/a.js", "line": 1, "summary": "one"}], "issues": [{"file": "src/b.js", "line": 2, "summary": "two"}]}',
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        dictTwoFull,
        "--run",
        runConfig("dict-two-full", "claude"),
      );
      st.check(
        "two populated dict lists fail loudly",
        r.code === 1 && r.err.includes("JSON finding lists"),
        detail(r),
      );
    }
    const dictEmptyOnly = writeEvents("claude-dict-empty-only.events", [
      { type: "result", subtype: "success", result: '{"findings": []}' },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        dictEmptyOnly,
        "--run",
        runConfig("dict-empty-only", "claude"),
      );
      st.check(
        "a whole report of only empty lists stays clean",
        r.code === 0 && pyTrim(r.out) === "[]",
        detail(r),
      );
    }
    const makefile = writeEvents("mimo-makefile.events", [
      {
        type: "text",
        part: {
          type: "text",
          text: "### Build\n- Check `Makefile:8`: the clean target removes the wrong dir.\n",
        },
      },
    ]);
    {
      const r = cli("normalize", "one", scratch, makefile, "--run", runConfig("makefile", "mimo"));
      try {
        const parsed = JSON.parse(r.out) as Array<Record<string, unknown>>;
        st.check(
          "an extensionless file with a line is a finding",
          r.code === 0 &&
            parsed.length === 1 &&
            parsed[0]!["file"] === "Makefile" &&
            parsed[0]!["line"] === 8,
          detail(r),
        );
      } catch {
        st.check("an extensionless file with a line is a finding", false, detail(r));
      }
    }
    const unclosed = writeEvents("mimo-unclosed.events", [
      {
        type: "text",
        part: {
          type: "text",
          text: "### Bug one `src/page.js:8`\n```js\nreturn all().slice(start, start + size + 1);\n\n### Bug two `src/count.js:6`\nSomething else is wrong.\n",
        },
      },
    ]);
    {
      const r = cli("normalize", "one", scratch, unclosed, "--run", runConfig("unclosed", "mimo"));
      st.check(
        "an unclosed fence fails loudly",
        r.code === 1 && r.err.includes("unclosed code fence"),
        detail(r),
      );
    }
    const codexUnclosed = writeEvents("codex-unclosed.events", [{ type: "turn.completed" }]);
    const codexUnclosedLast = join(root, "codex-unclosed.last");
    writeFileSync(
      codexUnclosedLast,
      "- [P1] First — src/a.js:1-1\n```\n- [P1] Second — src/b.js:2-2\n",
    );
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        codexUnclosed,
        "--run",
        runConfig("codex-unclosed", "codex"),
        "--last",
        codexUnclosedLast,
      );
      st.check(
        "an unclosed fence in a codex report fails loudly",
        r.code === 1 && r.err.includes("unclosed code fence"),
        detail(r),
      );
    }
    const codexFenced = writeEvents("codex-fenced.events", [{ type: "turn.completed" }]);
    const codexFencedLast = join(root, "codex-fenced.last");
    writeFileSync(
      codexFencedLast,
      "The fix is:\n```\n- [P1] Example bug — src/page.js:8-8\n```\n- [P1] Real bug — src/count.js:6-6\n  Real body.\n",
    );
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        codexFenced,
        "--run",
        runConfig("codex-fenced", "codex"),
        "--last",
        codexFencedLast,
      );
      try {
        const parsed = JSON.parse(r.out) as Array<Record<string, unknown>>;
        st.check(
          "a codex finding inside a fence is not filed",
          r.code === 0 && parsed.length === 1 && parsed[0]!["file"] === "src/count.js",
          detail(r),
        );
      } catch {
        st.check("a codex finding inside a fence is not filed", false, detail(r));
      }
    }
    const notissues = writeEvents("mimo-notissues.events", [
      {
        type: "text",
        part: {
          type: "text",
          text: "### Not issues\n- Validation is fine — `src/count.js:6`: empty stores yield zero pages, which is correct.\n\nNo issues found.\n",
        },
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        notissues,
        "--run",
        runConfig("notissues", "mimo"),
      );
      st.check(
        "a location cited under Not issues is not a finding",
        r.code === 1 && r.err.includes("cannot parse review output"),
        detail(r),
      );
    }
    const notissuesResume = writeEvents("mimo-notissues-resume.events", [
      {
        type: "text",
        part: {
          type: "text",
          text: "### Bugs\n- Broken — `src/a.js:1`: wrong.\n### Not issues\n- Fine — `src/b.js:2`: not wrong.\n### More\n- Also broken — `src/c.js:3`: wrong.\n",
        },
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        notissuesResume,
        "--run",
        runConfig("notissues-resume", "mimo"),
      );
      try {
        const parsed = JSON.parse(r.out) as Array<Record<string, unknown>>;
        st.check(
          "findings outside Not issues still parse",
          r.code === 0 &&
            JSON.stringify(parsed.map((f) => f["target"]).sort()) ===
              JSON.stringify(["src/a.js:1", "src/c.js:3"]),
          detail(r),
        );
      } catch {
        st.check("findings outside Not issues still parse", false, detail(r));
      }
    }
    const errSubtype = writeEvents("claude-err-subtype.events", [
      { type: "result", subtype: "error_during_execution", result: "No findings." },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        errSubtype,
        "--run",
        runConfig("err-subtype", "claude"),
      );
      st.check(
        "an error result is a failed reviewer, never clean",
        r.code === 1 && r.err.includes("did not succeed"),
        detail(r),
      );
    }
    const strList = writeEvents("claude-str-list.events", [
      { type: "result", subtype: "success", result: '{"findings": ["bug at src/a.js:1"]}' },
    ]);
    {
      const r = cli("normalize", "one", scratch, strList, "--run", runConfig("str-list", "claude"));
      st.check("a findings list of strings fails closed", r.code === 1, detail(r));
    }
    const nullList = writeEvents("claude-null-list.events", [
      { type: "result", subtype: "success", result: '{"findings": [null, null]}' },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        nullList,
        "--run",
        runConfig("null-list", "claude"),
      );
      st.check("a findings list of nulls fails closed", r.code === 1, detail(r));
    }
    const mixedList = writeEvents("claude-mixed-list.events", [
      {
        type: "result",
        subtype: "success",
        result: '{"issues": [{"file": "src/a.js", "line": 1, "summary": "one"}, "junk"]}',
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        mixedList,
        "--run",
        runConfig("mixed-list", "claude"),
      );
      st.check("a findings list mixing an object with junk fails closed", r.code === 1, detail(r));
    }
    const emptyNotes = writeEvents("claude-empty-notes.events", [
      {
        type: "result",
        subtype: "success",
        result: '{"findings": [], "notes": "Bug at src/page.js:8"}',
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        emptyNotes,
        "--run",
        runConfig("empty-notes", "claude"),
      );
      st.check(
        "a citation in another key defeats an empty findings list",
        r.code === 1 && r.err.includes("cannot parse review output"),
        detail(r),
      );
    }
    const emptyPlainNotes = writeEvents("claude-empty-plain-notes.events", [
      { type: "result", subtype: "success", result: '{"findings": [], "notes": "all good"}' },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        emptyPlainNotes,
        "--run",
        runConfig("empty-plain-notes", "claude"),
      );
      st.check(
        "an empty findings list with other keys fails loudly",
        r.code === 1 && r.err.includes("cannot parse review output"),
        detail(r),
      );
    }
    const noneCited = writeEvents("mimo-none-cited.events", [
      {
        type: "text",
        part: {
          type: "text",
          text: "## Findings\nnone\n\nThe bug at src/page.js:8 is real and needs fixing.\n",
        },
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        noneCited,
        "--run",
        runConfig("none-cited", "mimo"),
      );
      st.check(
        "a Findings/none verdict beside a cited line fails loudly",
        r.code === 1 && r.err.includes("cannot parse review output"),
        detail(r),
      );
    }
    const noneCitedCodex = writeEvents("codex-none-cited.events", [{ type: "turn.completed" }]);
    const noneCitedLast = join(root, "codex-none-cited.last");
    writeFileSync(noneCitedLast, "Findings\nnone\n\nPlease fix src/a.js:1 though.\n");
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        noneCitedCodex,
        "--run",
        runConfig("none-cited-codex", "codex"),
        "--last",
        noneCitedLast,
      );
      st.check(
        "a codex Findings/none verdict beside a cited line fails loudly",
        r.code === 1 && r.err.includes("cannot parse review output"),
        detail(r),
      );
    }
    const undeclared = writeEvents("claude-undeclared.events", [
      {
        type: "result",
        subtype: "success",
        result:
          '{"findings": [], "bugs": [{"file": "src/a.js", "line": 1, "summary": "off by one"}]}',
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        undeclared,
        "--run",
        runConfig("undeclared", "claude"),
      );
      try {
        const parsed = JSON.parse(r.out) as Array<Record<string, unknown>>;
        st.check(
          "an empty declared list does not block an undeclared findings list",
          r.code === 0 && parsed.length === 1 && parsed[0]!["target"] === "src/a.js:1",
          detail(r),
        );
      } catch {
        st.check(
          "an empty declared list does not block an undeclared findings list",
          false,
          detail(r),
        );
      }
    }
    const malformedBeside = writeEvents("claude-malformed-beside.events", [
      {
        type: "result",
        subtype: "success",
        result:
          '{"findings": ["unparsed bug at src/page.js:8"], "issues": [{"file": "src/a.js", "line": 1, "summary": "other"}]}',
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        malformedBeside,
        "--run",
        runConfig("malformed-beside", "claude"),
      );
      st.check(
        "a malformed list beside a valid one fails loudly",
        r.code === 1 && r.err.includes("hold no objects"),
        detail(r),
      );
    }
    const errNoText = writeEvents("claude-err-no-text.events", [
      { type: "result", subtype: "success", result: "No findings." },
      { type: "result", subtype: "error_during_execution" },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        errNoText,
        "--run",
        runConfig("err-no-text", "claude"),
      );
      st.check(
        "a trailing error result without text fails loudly",
        r.code === 1 && r.err.includes("did not succeed"),
        detail(r),
      );
    }
    const okNoText = writeEvents("claude-ok-no-text.events", [
      { type: "result", subtype: "success" },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        okNoText,
        "--run",
        runConfig("ok-no-text", "claude"),
      );
      st.check(
        "a success result without text fails loudly",
        r.code === 1 && r.err.includes("no result text"),
        detail(r),
      );
    }
    const escapedCite = writeEvents("claude-escaped-cite.events", [
      {
        type: "result",
        subtype: "success",
        result: '{"findings": [], "notes": "see src/page.js\\u003a8"}',
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        escapedCite,
        "--run",
        runConfig("escaped-cite", "claude"),
      );
      st.check(
        "an escaped citation in another key defeats an empty findings list",
        r.code === 1 && r.err.includes("cannot parse review output"),
        detail(r),
      );
    }
    const pairObject = writeEvents("claude-pair-object.events", [
      {
        type: "result",
        subtype: "success",
        result: '{"findings": [], "bug": {"file": "src/a.js", "line": 1}}',
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        pairObject,
        "--run",
        runConfig("pair-object", "claude"),
      );
      st.check(
        "a file-and-line pair outside any list defeats an empty findings list",
        r.code === 1 && r.err.includes("cannot parse review output"),
        detail(r),
      );
    }
    const keyCite = writeEvents("claude-key-cite.events", [
      { type: "result", subtype: "success", result: '{"findings": [], "src/a.js:1": "seen"}' },
    ]);
    {
      const r = cli("normalize", "one", scratch, keyCite, "--run", runConfig("key-cite", "claude"));
      st.check(
        "a citation as a JSON key defeats an empty findings list",
        r.code === 1 && r.err.includes("cannot parse review output"),
        detail(r),
      );
    }
    const unrecog = writeEvents("claude-unrecog.events", [
      {
        type: "result",
        subtype: "success",
        result: '{"status": "error", "message": "review timed out"}',
      },
    ]);
    {
      const r = cli("normalize", "one", scratch, unrecog, "--run", runConfig("unrecog", "claude"));
      st.check(
        "an unrecognized JSON shape fails loudly",
        r.code === 1 && r.err.includes("cannot parse review output"),
        detail(r),
      );
    }
    const trailing = writeEvents("claude-trailing.events", [
      {
        type: "result",
        subtype: "success",
        result: '[{"file": "src/a.js", "line": 1, "summary": "s"}]\nAlso src/b.js:2 is wrong.',
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        trailing,
        "--run",
        runConfig("trailing", "claude"),
      );
      st.check(
        "an unfiled location outside the findings list fails loudly",
        r.code === 1 && r.err.includes("outside its filed findings"),
        detail(r),
      );
    }
    const example = writeEvents("claude-example.events", [
      {
        type: "result",
        subtype: "success",
        result:
          'Example:\n```json\n[{"file": "src/fake.js", "line": 1, "summary": "s"}]\n```\n- Bug at src/real.js:2: actual',
      },
    ]);
    {
      const r = cli("normalize", "one", scratch, example, "--run", runConfig("example", "claude"));
      st.check(
        "a finding outside the findings list fails loudly",
        r.code === 1 && r.err.includes("outside its filed findings"),
        detail(r),
      );
    }
    for (const [name, report] of [
      ["fenced-empty", "```json\n[]\n```"],
      ["fenced-empty-dict", '```json\n{"findings": []}\n```'],
    ]) {
      const events = writeEvents(`claude-${name}.events`, [
        { type: "result", subtype: "success", result: report },
      ]);
      const r = cli("normalize", "one", scratch, events, "--run", runConfig(name, "claude"));
      st.check(
        "a fenced clean report stays clean",
        r.code === 0 && pyTrim(r.out) === "[]",
        detail(r),
      );
    }
    for (const [name, report] of [
      ["noline", '{"findings": [], "bug": {"file": "src/a.js", "summary": "broken"}}'],
      [
        "nullline",
        '{"findings": [], "bug": {"file": "src/a.js", "line": null, "summary": "broken"}}',
      ],
      ["hashline", '{"findings": [], "notes": "src/a.js#L8 is wrong"}'],
      ["atline", '{"findings": [], "notes": "bug in src/a.js at line 3"}'],
      [
        "prose-notes",
        '{"findings": [], "notes": "There is a bug in the sorting logic somewhere."}',
      ],
      ["issues-empty", '{"issues": []}'],
    ]) {
      const events = writeEvents(`claude-${name}.events`, [
        { type: "result", subtype: "success", result: report },
      ]);
      const r = cli("normalize", "one", scratch, events, "--run", runConfig(name, "claude"));
      st.check(
        "a non-clean shape with no findings list fails loudly",
        r.code === 1 && r.err.includes("cannot parse review output"),
        detail(r),
      );
    }
    const nootherBoth = writeEvents("mimo-noother-both.events", [
      {
        type: "text",
        part: {
          type: "text",
          text: "### Bug — src/a.js:1: one\n\n### No other issues found — src/b.js:2: two\n",
        },
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        nootherBoth,
        "--run",
        runConfig("noother-both", "mimo"),
      );
      try {
        const parsed = JSON.parse(r.out) as Array<Record<string, unknown>>;
        st.check(
          "a citation beside the no-other phrase is filed",
          r.code === 0 &&
            JSON.stringify(parsed.map((f) => f["target"]).sort()) ===
              JSON.stringify(["src/a.js:1", "src/b.js:2"]),
          detail(r),
        );
      } catch {
        st.check("a citation beside the no-other phrase is filed", false, detail(r));
      }
    }
    for (const [name, report, targets] of [
      [
        "match-colon",
        '[{"file": "src/a.js", "line": 1, "summary": "s"}]\nThe bug at src/a.js:1 is the one.',
        ["src/a.js:1"],
      ],
      [
        "match-hash",
        '[{"file": "src/a.js", "line": 1, "summary": "s"}]\nSee src/a.js#L1.',
        ["src/a.js:1"],
      ],
      [
        "match-atline",
        '[{"file": "src/a.js", "line": 1, "summary": "s"}]\nBug in src/a.js at line 1.',
        ["src/a.js:1"],
      ],
    ]) {
      const events = writeEvents(`claude-${name}.events`, [
        { type: "result", subtype: "success", result: report },
      ]);
      const r = cli(
        "normalize",
        "one",
        scratch,
        events,
        "--run",
        runConfig(name as string, "claude"),
      );
      try {
        const parsed = JSON.parse(r.out) as Array<Record<string, unknown>>;
        st.check(
          "an outside location naming a filed finding parses",
          r.code === 0 &&
            JSON.stringify(parsed.map((f) => f["target"])) === JSON.stringify(targets),
          detail(r),
        );
      } catch {
        st.check("an outside location naming a filed finding parses", false, detail(r));
      }
    }
    for (const [name, report] of [
      ["novel-hash", '[{"file": "src/a.js", "line": 1, "summary": "s"}]\nSee src/b.js#L2.'],
      [
        "novel-atline",
        '[{"file": "src/a.js", "line": 1, "summary": "s"}]\nBug in src/b.js at line 2.',
      ],
    ]) {
      const events = writeEvents(`claude-${name}.events`, [
        { type: "result", subtype: "success", result: report },
      ]);
      const r = cli("normalize", "one", scratch, events, "--run", runConfig(name, "claude"));
      st.check(
        "an unfiled outside location fails loudly",
        r.code === 1 && r.err.includes("outside its filed findings"),
        detail(r),
      );
    }
    const words = writeEvents("claude-words.events", [
      {
        type: "result",
        subtype: "success",
        result:
          '{"findings": [], "bugs": [{"file": "src/a.js", "line": 1, "summary": "s"}], "notes": "There is a bug here too."}',
      },
    ]);
    {
      const r = cli("normalize", "one", scratch, words, "--run", runConfig("words", "claude"));
      st.check(
        "finding words beside an empty findings list fail loudly",
        r.code === 1 && r.err.includes("beside its empty findings list"),
        detail(r),
      );
    }
    const second = writeEvents("claude-second.events", [
      {
        type: "result",
        subtype: "success",
        result:
          '{"issues": [{"file": "src/a.js", "line": 1, "summary": "s"}], "bugs": [{"file": "src/b.js", "line": 2, "summary": "s"}]}',
      },
    ]);
    {
      const r = cli("normalize", "one", scratch, second, "--run", runConfig("second", "claude"));
      st.check(
        "a second findings list under another key fails loudly",
        r.code === 1 && r.err.includes("outside its filed findings"),
        detail(r),
      );
    }
    const trial = join(TOOL, "raw", "trials", "code-review-launch");
    const recorded = readFileSync(join(trial, "opus-report.md"), "utf8");
    const rederive = writeEvents("claude-rederive.events", [
      { type: "result", subtype: "success", result: recorded },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        rederive,
        "--run",
        runConfig("rederive", "claude"),
      );
      st.check(
        "the recorded claude report re-normalizes byte-identical",
        r.code === 0 && r.out === readFileSync(join(trial, "opus-findings.json"), "utf8"),
        detail(r),
      );
    }
    const unfiled = writeEvents("claude-unfiled.events", [
      {
        type: "result",
        subtype: "success",
        result: recorded + "\nAlso src/unfiled.js:9 is wrong.\n",
      },
    ]);
    {
      const r = cli("normalize", "one", scratch, unfiled, "--run", runConfig("unfiled", "claude"));
      st.check(
        "the recorded report with an unfiled outside location fails loudly",
        r.code === 1 && r.err.includes("outside its filed findings"),
        detail(r),
      );
    }
    for (const [name, report, message] of [
      [
        "matched-bullet",
        '[{"file": "src/a.js", "line": 1, "summary": "s"}]\n- See src/a.js:1 again.',
        "a markdown finding outside",
      ],
      [
        "twin-list",
        '{"issues": [{"file": "src/a.js", "line": 1, "summary": "s"}], "bugs": [{"file": "src/a.js", "line": 1, "summary": "s"}]}',
        "a second findings list",
      ],
      [
        "tag-only",
        '[{"file": "src/a.js", "line": 1, "summary": "s"}]\nDowngraded from [P1] after review.',
        "a priority tag",
      ],
    ]) {
      const events = writeEvents(`claude-${name}.events`, [
        { type: "result", subtype: "success", result: report },
      ]);
      const r = cli("normalize", "one", scratch, events, "--run", runConfig(name, "claude"));
      st.check(
        "structure outside the filed findings fails loudly",
        r.code === 1 && r.err.includes(message as string),
        detail(r),
      );
    }
    const locationless = writeEvents("claude-locationless.events", [
      {
        type: "result",
        subtype: "success",
        result:
          '{"findings": ["no locations here"], "issues": [{"file": "src/a.js", "line": 1, "summary": "s"}]}',
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        locationless,
        "--run",
        runConfig("locationless", "claude"),
      );
      st.check(
        "a locationless malformed list beside a valid one fails loudly",
        r.code === 1 && r.err.includes("hold no objects"),
        detail(r),
      );
    }
    const nestedSkip = writeEvents("mimo-nested-skip.events", [
      {
        type: "text",
        part: {
          type: "text",
          text: "### Not issues\n#### Sub\n- Broken — `src/a.js:1`: wrong.\n\nNo issues found.\n",
        },
      },
    ]);
    {
      const r = cli(
        "normalize",
        "one",
        scratch,
        nestedSkip,
        "--run",
        runConfig("nested-skip", "mimo"),
      );
      st.check(
        "a subsection under Not issues stays skipped",
        r.code === 1 && r.err.includes("cannot parse review output"),
        detail(r),
      );
    }
    const secondTask = join(taskHome, "second-task-output.txt");
    writeFileSync(secondTask, "second task tools\n");
    const clashLogs = join(root, "logs-clash");
    mkdirSync(clashLogs);
    writeFileSync(join(clashLogs, `clash-claude-task-02-${basename(secondTask)}`), "changed\n");
    const clash = writeEvents("harvest-clash.events", [
      { type: "system", subtype: "task_notification", output_file: external },
      { type: "system", subtype: "task_notification", output_file: secondTask },
    ]);
    {
      const r = cli("harvest", clash, clashLogs, "--prefix", "clash");
      st.check(
        "a refused harvest copies nothing",
        r.code === 1 &&
          r.err.includes("refusing to overwrite") &&
          !existsSync(join(clashLogs, `clash-claude-task-01-${basename(external)}`)),
        detail(r),
      );
    }
    const linkRoot = join(root, "task-link");
    const realRoot = join(root, "task-real");
    mkdirSync(realRoot);
    writeFileSync(join(realRoot, "linked-task-output.txt"), "linked task tools\n");
    symlinkSync(realRoot, linkRoot, "dir");
    const linkEvents = writeEvents("harvest-link.events", [
      {
        type: "system",
        subtype: "task_notification",
        output_file: join(realRoot, "linked-task-output.txt"),
      },
    ]);
    try {
      const got = harvest(linkEvents, join(root, "logs-link"), "link", linkRoot);
      st.check(
        "a symlinked task root still contains its files",
        got.length === 1 && existsSync(got[0]!),
        "",
      );
    } catch (e) {
      st.check("a symlinked task root still contains its files", false, errMsg(e));
    }
    try {
      harvest(linkEvents, join(root, "logs-link2"), "link", join(root, "elsewhere"));
      st.check("a task file outside the given root is still refused", false, "no error");
    } catch (e) {
      st.check(
        "a task file outside the given root is still refused",
        isReportError(e) && e.message.includes("outside"),
        errMsg(e),
      );
    }
    try {
      rmSync(taskHome, { recursive: true, force: true });
    } catch {
      // cleanup is best-effort
    }
  });
  st.finish();
}

// --- run ----------------------------------------------------------------------------------
const argv = process.argv.slice(2);
if (argv.length === 1 && argv[0] === "--self-test") {
  selfTest();
} else {
  try {
    process.exit(main(argv));
  } catch (e) {
    if (isReportError(e)) {
      console.error(`review-findings: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}
