// Switch-offs a run adds: comments that switch off a check, and changes to the
// settings of the project's checks, compared file by file between the ticket head
// and its merge base with the default branch. Only real comments count, so this
// uses a small scanner instead of a parser dependency: strings, template text and
// regex literals are skipped, while comments inside template substitutions stay
// comments. Each tool reads its own line: TypeScript the last line of a block
// comment, the linter the first non-empty one, Biome any line carrying the
// whole directive. Probed against Oxlint 1.86, tsc 7 and Biome 2.5 wherever
// the ticket's first-line note would miss what a tool honors. Blind spots a
// small scanner cannot close: a backtick in JSX text (a tagged template
// follows a word, so the quote rule cannot exclude it) and a /* opener in
// JSX text; both need a real parser to tell from live code.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { run } from "./proc.ts";
import { pyRstrip, pySplitLines, pyTrim, pyWords } from "./text.ts";

const UNSET_GIT = {
  GIT_DIR: undefined,
  GIT_WORK_TREE: undefined,
  GIT_COMMON_DIR: undefined,
  GIT_INDEX_FILE: undefined,
  GIT_OBJECT_DIRECTORY: undefined,
  GIT_ALTERNATE_OBJECT_DIRECTORIES: undefined,
  GIT_NAMESPACE: undefined,
};

export interface SwitchOffComment {
  id: string;
  path: string;
  line: number;
  form: string;
  rules: string;
  reason: string | null;
  approved: boolean;
}

export interface SwitchOffSetting {
  id: string;
  path: string;
  change: "added" | "changed" | "deleted";
  diff: string;
  approved: boolean;
}

export type SwitchOffStatus = "clear" | "held" | "no reason" | "refused";

export interface SwitchOffReport {
  status: SwitchOffStatus;
  comments: SwitchOffComment[];
  settings: SwitchOffSetting[];
  output: string;
}

export interface SwitchComment {
  line: number;
  raw: string;
  start: number;
  end: number;
}

/** The tokens after which a `/` starts a regex rather than dividing. The last
 * significant token in code decides; identifiers and values divide. */
const REGEX_AFTER = new Set([
  "",
  "(",
  ",",
  "=",
  ":",
  "[",
  "!",
  "&",
  "|",
  "?",
  "{",
  "}",
  ";",
  "+",
  "-",
  "*",
  "/",
  "%",
  "^",
  "~",
  "<",
  ">",
  ")stmt",
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "case",
  "do",
  "else",
  "yield",
  "await",
  "throw",
]);

/** Keywords whose parenthesized condition ends in statement position, where a
 * `/` opens a regex: `if (a) /re/` divides nowhere. Any other `)` keeps the
 * divide reading. */
const CONDITION_KEYWORDS = new Set(["if", "while", "for", "with", "switch", "catch"]);

/** Whether the `(` at this offset opens one of the condition keywords: the
 * keyword must be the last token, and not a property (`x.if (` calls). */
function isConditionParen(text: string, i: number, last: string): boolean {
  if (!CONDITION_KEYWORDS.has(last)) return false;
  let j = i - 1;
  while (j >= 0 && (text[j] === " " || text[j] === "\t" || text[j] === "\n" || text[j] === "\r"))
    j--;
  j -= last.length;
  while (j >= 0 && (text[j] === " " || text[j] === "\t" || text[j] === "\n" || text[j] === "\r"))
    j--;
  return j < 0 || text[j] !== ".";
}

/** Keywords after which a quote opens a string, past the regex set's: module
 * and type positions take string operands but never regexes. */
const QUOTE_EXTRA = new Set(["import", "from", "as", "satisfies", "is"]);

/** Whether a quote opens a string here: quotes open in operand positions
 * only, a twin of the regex rule. After a word, a value or `]` a quote can
 * only be JSX text or invalid code, and invalid code fails the gate loudly.
 * After `)` the paren stack decides: a condition ends in statement position
 * and a prologue string may follow, while an expression cannot be followed
 * by one. Backticks always open: a tagged template follows a word, so a
 * backtick in JSX text stays a known blind spot, documented with the tests. */
function quoteOpens(last: string): boolean {
  if (last === ")stmt" || QUOTE_EXTRA.has(last)) return true;
  if (last === "value" || last === ")") return false;
  if (last.length === 1) return !/[A-Za-z0-9_$\]]/u.test(last);
  return REGEX_AFTER.has(last);
}

/** The length of the JS line break at this offset: CRLF counts once, and a lone
 * CR, U+2028 or U+2029 breaks like LF does. tsc honors them as breaks, so a
 * scanner that counts LF alone attributes the wrong line and the wrong
 * covered code after one; Oxlint reads them as whitespace instead, which
 * only ever lists a directive it cannot honor, never misses a live one. */
function breakLen(text: string, i: number): number {
  const ch = text[i];
  if (ch === "\n" || ch === "\u2028" || ch === "\u2029") return 1;
  if (ch === "\r") return text[i + 1] === "\n" ? 2 : 1;
  return 0;
}

/** The comments in source text, told apart from strings, template literals (with
 * `${}` scanned as code) and regex literals. A string ends at LF or CR, never
 * at U+2028 or U+2029, which ES2019 allows inside; an unterminated quote is
 * JSX text or invalid code, never a string, so the rest of its line is
 * rescanned as code and swallows no directive on it or a later line. */
export function scanComments(text: string): SwitchComment[] {
  const out: SwitchComment[] = [];
  const n = text.length;
  let i = 0;
  let line = 1;
  let last = "";
  let noRegex = false;
  const parens: boolean[] = [];
  const frames: { tpl: boolean; interp: boolean; brace: number }[] = [
    { tpl: false, interp: false, brace: 0 },
  ];
  while (i < n) {
    const f = frames[frames.length - 1]!;
    const ch = text[i]!;
    if (f.tpl) {
      if (ch === "\\") {
        const b = breakLen(text, i + 1);
        if (b > 0) {
          line++;
          i += 1 + b;
        } else {
          i += 2;
        }
        continue;
      }
      if (ch === "`") {
        frames.pop();
        last = "value";
        i++;
        continue;
      }
      if (ch === "$" && text[i + 1] === "{") {
        frames.push({ tpl: false, interp: true, brace: 0 });
        i += 2;
        continue;
      }
      const bt = breakLen(text, i);
      if (bt > 0) {
        line++;
        i += bt;
        continue;
      }
      i++;
      continue;
    }
    const b = breakLen(text, i);
    if (b > 0) {
      line++;
      i += b;
      noRegex = false;
      continue;
    }
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      const start = line;
      const s = i;
      i += 2;
      while (i < n && breakLen(text, i) === 0) i++;
      out.push({ line: start, raw: pyRstrip(text.slice(s, i)), start: s, end: i });
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      const start = line;
      const s = i;
      i += 2;
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) {
        const b = breakLen(text, i);
        if (b > 0) {
          line++;
          i += b;
          continue;
        }
        i++;
      }
      i = i < n ? i + 2 : i;
      out.push({ line: start, raw: pyRstrip(text.slice(s, i)), start: s, end: i });
      continue;
    }
    if (ch === "'" || ch === '"') {
      if (!quoteOpens(last)) {
        i++;
        continue;
      }
      const opener = i;
      const resumeLine = line;
      const resumeLast = last;
      i++;
      while (i < n && text[i] !== ch) {
        if (text[i] === "\n" || text[i] === "\r") break;
        const sb = breakLen(text, i);
        if (sb > 0) {
          line++;
          i += sb;
          continue;
        }
        if (text[i] === "\\") {
          i++;
          const b = breakLen(text, i);
          if (b > 0) {
            line++;
            i += b;
          } else {
            i++;
          }
          continue;
        }
        i++;
      }
      if (i < n && text[i] === ch) {
        i++;
        last = "value";
        continue;
      }
      // No closer on this line: the quote was JSX text or invalid code, so
      // rewind past the opener and rescan the rest of the line as code. No
      // regex opens on the rescan, since a `/` in JSX text would take the
      // directive's own first slash as its closer. Anything the rescan
      // lists errs toward asking, and a genuinely unterminated string in
      // real code fails the gate loudly.
      i = opener + 1;
      line = resumeLine;
      last = resumeLast;
      noRegex = true;
      continue;
    }
    if (ch === "`") {
      frames.push({ tpl: true, interp: false, brace: 0 });
      i++;
      continue;
    }
    if (ch === "/") {
      // A tag-shaped close (`</div>`) is JSX text, not a regex: skipping to
      // its `>` keeps the divide-and-regex reading for real code, where a
      // `<` directly before a `/` never shapes a tag. Residual: a directive
      // comment between the slashes of a compared regex.
      if (
        last === "<" &&
        text[i - 1] === "<" &&
        /^<\/[A-Za-z][A-Za-z0-9._-]*[ \t]*>/u.test(text.slice(i - 1))
      ) {
        i = text.indexOf(">", i) + 1;
        last = "value";
        continue;
      }
      if (REGEX_AFTER.has(last) && !noRegex) {
        i++;
        let cls = false;
        let closed = false;
        while (i < n) {
          if (text[i] === "\n" || text[i] === "\r") break;
          const rb = breakLen(text, i);
          if (rb > 0) {
            line++;
            i += rb;
            continue;
          }
          const r = text[i]!;
          if (r === "\\") {
            i += 2;
            continue;
          }
          if (r === "[") cls = true;
          else if (r === "]") cls = false;
          else if (r === "/" && !cls) {
            i++;
            while (i < n && /[a-z]/iu.test(text[i]!)) i++;
            closed = true;
            break;
          }
          i++;
        }
        last = closed ? "value" : "/";
        continue;
      }
      last = "/";
      i++;
      continue;
    }
    if (ch === "(") {
      parens.push(isConditionParen(text, i, last));
      last = "(";
      i++;
      continue;
    }
    if (ch === ")") {
      last = (parens.pop() ?? false) ? ")stmt" : ")";
      i++;
      continue;
    }
    if (ch === "{") {
      if (f.interp) f.brace++;
      last = "{";
      i++;
      continue;
    }
    if (ch === "}") {
      if (f.interp && f.brace === 0) {
        frames.pop();
        last = "value";
        i++;
        continue;
      }
      if (f.interp) f.brace--;
      last = "}";
      i++;
      continue;
    }
    if (/[A-Za-z_$]/u.test(ch)) {
      const s = i;
      while (i < n && /[A-Za-z0-9_$]/u.test(text[i]!)) i++;
      last = text.slice(s, i);
      continue;
    }
    if (/[0-9]/u.test(ch)) {
      while (i < n && /[0-9a-fA-FxXoObB._]/u.test(text[i]!)) i++;
      last = "value";
      continue;
    }
    if ((ch === "+" || ch === "-") && text[i + 1] === ch) {
      last = "value";
      i += 2;
      continue;
    }
    last = ch;
    i++;
  }
  return out;
}

/** What a comment switches off, and how far. `line` covers its own line, `next`
 * the following one, `open` a block to its matching `close`, `file` the whole
 * file. */
export interface SwitchDirective {
  form: string;
  scope: "line" | "next" | "open" | "close" | "file";
  tool: "ts" | "linter" | "biome";
  rules: string;
  reason: string | null;
}

const TS_RE = /^@(ts-ignore|ts-expect-error|ts-nocheck)(?![A-Za-z0-9_-])/u;
const LINTER_RE =
  /^(eslint|oxlint)-(disable-line|disable-next-line|disable|enable)(?![A-Za-z0-9_-])/u;
const BIOME_RE =
  /^(biome-ignore-all|biome-ignore-start|biome-ignore-end|biome-ignore)(?![A-Za-z0-9_-])/u;

/** Split source text on JS line breaks only: LF, CRLF (once), CR, U+2028 and
 * U+2029. Python's wider set would split where the scanner counts no break
 * (VT, FF and the separators are whitespace or invalid there) and misalign
 * every covered line below one. */
function splitJsLines(text: string): string[] {
  const parts = text.split(/\r\n|[\n\r\u2028\u2029]/u);
  if (
    parts.length > 0 &&
    parts[parts.length - 1] === "" &&
    /(?:\r\n|[\n\r\u2028\u2029])$/u.test(text)
  )
    parts.pop();
  return parts;
}

function tsDirective(match: RegExpExecArray, line: string): SwitchDirective {
  const rest = pyTrim(line.slice(match[0].length));
  const reason = pyTrim(rest.replace(/^(?:--|:)[ \t]*/u, ""));
  return {
    form: match[1]!,
    scope: match[1] === "ts-nocheck" ? "file" : "next",
    tool: "ts",
    rules: "every rule",
    reason: reason === "" ? null : reason,
  };
}

function linterDirective(match: RegExpExecArray, rest: string): SwitchDirective {
  const what = match[2]!;
  const scope: SwitchDirective["scope"] =
    what === "disable"
      ? "open"
      : what === "enable"
        ? "close"
        : what === "disable-line"
          ? "line"
          : "next";
  let reason: string | null = null;
  if (rest.startsWith("-- ")) {
    reason = pyTrim(rest.slice(3));
    rest = "";
  } else {
    const k = rest.indexOf(" -- ");
    if (k >= 0) {
      reason = pyTrim(rest.slice(k + 4));
      rest = pyTrim(rest.slice(0, k));
    }
  }
  if (reason === "") reason = null;
  return {
    form: `${match[1]}-${what}`,
    scope,
    tool: "linter",
    rules: rest === "" ? "every rule" : pyWords(rest.replace(/,/gu, " ")).join(", "),
    reason,
  };
}

function biomeDirective(match: RegExpExecArray, line: string): SwitchDirective | null {
  const rest = pyTrim(line.slice(match[0].length));
  const colon = rest.indexOf(":");
  if (colon < 0) return null;
  const rules = pyTrim(rest.slice(0, colon));
  const reason = pyTrim(rest.slice(colon + 1));
  if (rules === "" || reason === "") return null;
  const what = match[1]!;
  return {
    form: what,
    scope:
      what === "biome-ignore"
        ? "next"
        : what === "biome-ignore-all"
          ? "file"
          : what === "biome-ignore-start"
            ? "open"
            : "close",
    tool: "biome",
    rules,
    reason,
  };
}

const noStars = (entry: string): string => pyTrim(entry.replace(/^\*+[ \t]*/u, ""));

/** The directives in a `//` comment: at most one, since one line leads with
 * one directive. TypeScript honors extra slashes after the opener (`///`
 * and more); the linter and Biome do not, and neither honors a star run
 * here. Whether ESLint honors `///` is unprobed; the strip stays
 * TypeScript-only until a probe says otherwise. */
function parseLineComment(body: string): SwitchDirective[] {
  const line = pyTrim(body);
  if (line === "") return [];
  const tsLine = pyTrim(body.replace(/^\/+/u, ""));
  const ts = TS_RE.exec(tsLine);
  if (ts !== null) return [tsDirective(ts, tsLine)];
  const lint = LINTER_RE.exec(line);
  if (lint !== null) return [linterDirective(lint, pyTrim(line.slice(lint[0].length)))];
  const biome = BIOME_RE.exec(line);
  if (biome !== null) {
    const off = biomeDirective(biome, line);
    if (off !== null) return [off];
  }
  return [];
}

/** The directives in a block comment: up to one per tool, since each tool
 * reads its own line. TypeScript reads the last line, stars dropped; the
 * linter's directive starts the first non-empty line, with rules and reason
 * running across the block's lines; Biome matches any line carrying
 * directive, category and reason together, stars dropped. All three rules
 * are probed against tsc, Oxlint 1.86 and Biome 2.5, and each differs from
 * the ticket's first-line note where the tool honors what that note would
 * miss. */
function parseBlockComment(body: string): SwitchDirective[] {
  const out: SwitchDirective[] = [];
  const lines = splitJsLines(body).map((entry) => pyTrim(entry));
  if (lines.every((entry) => entry === "")) return out;
  const tsLine = noStars(lines[lines.length - 1]!);
  const ts = TS_RE.exec(tsLine);
  if (ts !== null) out.push(tsDirective(ts, tsLine));
  const fi = lines.findIndex((entry) => entry !== "");
  const first = fi < 0 ? "" : lines[fi]!;
  const lint = first === "" ? null : LINTER_RE.exec(first);
  if (lint !== null) {
    const rest = pyTrim(`${first.slice(lint[0].length)} ${lines.slice(fi + 1).join(" ")}`);
    out.push(linterDirective(lint, rest));
  }
  for (const entry of lines) {
    const cand = noStars(entry);
    const biome = BIOME_RE.exec(cand);
    if (biome === null) continue;
    const off = biomeDirective(biome, cand);
    if (off !== null) out.push(off);
  }
  return out;
}

/** Parse one comment as a switch-off directive, or null when it is not one.
 * A reason is the text after ` -- ` in a linter comment (or after a leading
 * `--`), any text after a TypeScript directive (a leading `--` or `:`
 * dropped), and the text after the colon in Biome's; for Biome a missing
 * category or reason is null, which switches nothing off. Empty or blank
 * text is no reason. */
export function parseSwitchOff(raw: string): SwitchDirective | null {
  return parseAllDirectives(raw)[0] ?? null;
}

/** Every directive a comment carries, one per tool at most (Biome lines each
 * at most one). A block comment can honestly hold two tools' directives on
 * two lines, and both suppress; the single-shot parse above is its first. */
function parseAllDirectives(raw: string): SwitchDirective[] {
  if (raw.startsWith("//")) return parseLineComment(raw.slice(2));
  if (!raw.startsWith("/*")) return [];
  const body = raw.endsWith("*/") ? raw.slice(2, -2) : raw.slice(2);
  return parseBlockComment(body);
}

interface PlacedDirective extends SwitchDirective {
  line: number;
  raw: string;
}

function placeDirectives(text: string): PlacedDirective[] {
  const out: PlacedDirective[] = [];
  for (const c of scanComments(text)) {
    const found = parseAllDirectives(c.raw);
    if (found.length > 0) {
      for (const off of found) out.push({ ...off, line: c.line, raw: c.raw });
      continue;
    }
    // A // opener inside JSX text starts a comment the tools never see, and
    // a real directive trailing on the same line still suppresses. Reparse
    // after each later // on the line and list what parses there, under its
    // own text, so edits to the leading prose never invalidate it. The cost
    // is a spurious listing where prose itself quotes a directive; that errs
    // toward asking, never toward missing.
    if (!c.raw.startsWith("//")) continue;
    let k = c.raw.indexOf("//", 2);
    while (k >= 0) {
      const sub = c.raw.slice(k);
      for (const off of parseAllDirectives(sub)) out.push({ ...off, line: c.line, raw: sub });
      k = c.raw.indexOf("//", k + 2);
    }
  }
  return out;
}

function maskedLines(text: string, comments: SwitchComment[]): string[] {
  const masked = text.split("");
  for (const c of comments) {
    for (let i = c.start; i < c.end; i++) {
      const ch = masked[i];
      if (ch !== "\n" && ch !== "\r" && ch !== "\u2028" && ch !== "\u2029") masked[i] = " ";
    }
  }
  return splitJsLines(masked.join("")).map((line) => pyTrim(line));
}

/** The offset where each 0-based line starts, on the scanner's breaks. */
function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; ) {
    const b = breakLen(text, i);
    if (b > 0) {
      starts.push(i + b);
      i += b;
    } else {
      i++;
    }
  }
  return starts;
}

/** The code a TypeScript next-line suppression covers: the first line past
 * blanks and //-only lines, since tsc skips those when choosing. A line
 * holding a block comment stops the skip, tsc applying there instead; the
 * /* test consults the line-comment spans, so a /* inside a //-comment
 * does not stop it. Decorators stop it, as probed. */
function tsCovered(
  code: string[],
  rawLines: string[],
  starts: number[],
  comments: SwitchComment[],
  from: number,
): string[] {
  for (let k = from; k < code.length; k++) {
    if (code[k] !== "") return [code[k]!];
    const cut = (rawLines[k] ?? "").indexOf("/*");
    if (cut < 0) continue;
    const abs = (starts[k] ?? 0) + cut;
    const inside = comments.some((c) => c.raw.startsWith("//") && c.start <= abs && abs < c.end);
    if (inside) continue;
    return [""];
  }
  return [""];
}

/** The identity of an added switch-off: its file, its comment text and, for a
 * line or next-line form, the trimmed code of the line it covers; for a block
 * or file form, the code it covers and the close that ends it. The line number
 * is for the listing only: an approval holds wherever the comment moves, while
 * a changed comment or covered line needs a new word. Settings use the file's
 * content object id at the head instead. */
function switchOffId(kind: "comment" | "settings", parts: string[]): string {
  const hex = createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
  return `${kind}:${hex}`;
}

interface SwitchEntry {
  file: string;
  line: number;
  form: string;
  rules: string;
  reason: string | null;
  id: string;
}

const LISTED_SCOPES = new Set<SwitchDirective["scope"]>(["line", "next", "open", "file"]);

/** The rule names a linter open or close lists, or null for a bare one. The
 * parser normalizes separators already, so the names split on commas. */
function linterRuleSet(d: PlacedDirective): Set<string> | null {
  if (d.rules === "every rule") return null;
  return new Set(
    d.rules
      .split(",")
      .map((r) => r.trim())
      .filter((r) => r !== ""),
  );
}

interface BlockEnd {
  closes: { raw: string; line: number }[];
  end?: { raw: string; line: number };
}

/** The code a `biome-ignore` covers: the next node, approximated as the next
 * non-empty line plus its bracket continuation. Biome suppresses the whole
 * node, so hashing one line would let an edit to a later line of the node
 * keep an old approval. Single-quote spans are stripped before counting,
 * and a line holding a backtick never ends the run, since a template can
 * span lines. Residual: a bracket inside a multiline string can end the run
 * early; that errs toward the old one-line shape, never toward missing the
 * directive. */
function biomeCovered(code: string[], from: number): string[] {
  let start = from;
  while (start < code.length && code[start] === "") start++;
  if (start >= code.length) return [];
  let depth = 0;
  let end = start;
  for (let k = start; k < code.length; k++) {
    end = k;
    const stripped = code[k]!.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/gu, "");
    if (stripped.includes("`")) continue;
    for (const ch of stripped) {
      if (ch === "(" || ch === "[" || ch === "{") depth++;
      else if (ch === ")" || ch === "]" || ch === "}") depth--;
    }
    if (depth <= 0) break;
  }
  return code.slice(start, end + 1).filter((entry) => entry !== "");
}

/** Every listed switch-off in one file's text, each with its identity. The
 * linter's opens match closes by rule set, on one machine for both
 * spellings, since probes show Oxlint 1.86 honors either spelling against
 * either: a bare close ends bare opens only, a named close removes its
 * rules from every named open, and one close can narrow several opens.
 * (A bare close after a named open, and a named close after a bare open,
 * are both no-ops there; matching any close to any open would end blocks
 * the tool still honors.) Biome keeps stack pairing. Every close that
 * narrows an open joins its identity, so removing one counts the open as
 * added. */
function fileSwitches(file: string, text: string): SwitchEntry[] {
  const comments = scanComments(text);
  const code = maskedLines(text, comments);
  const rawLines = splitJsLines(text);
  const starts = lineStarts(text);
  const placed = placeDirectives(text);
  const ends = new Map<number, BlockEnd>();
  const endOf = (index: number): BlockEnd => {
    let e = ends.get(index);
    if (!e) {
      e = { closes: [] };
      ends.set(index, e);
    }
    return e;
  };
  const bareOpens: number[] = [];
  const namedOpens: { index: number; rules: Set<string> }[] = [];
  const biomeStack: number[] = [];
  placed.forEach((d, index) => {
    if (d.scope !== "open" && d.scope !== "close") return;
    if (d.tool === "linter") {
      const rules = linterRuleSet(d);
      if (d.scope === "open") {
        if (rules === null) bareOpens.push(index);
        else namedOpens.push({ index, rules });
        return;
      }
      const close = { raw: d.raw, line: d.line };
      if (rules === null) {
        for (const open of bareOpens.splice(0)) {
          const e = endOf(open);
          e.closes.push(close);
          e.end = close;
        }
        return;
      }
      for (const open of namedOpens) {
        let narrowed = false;
        for (const r of rules) if (open.rules.delete(r)) narrowed = true;
        if (!narrowed) continue;
        const e = endOf(open.index);
        e.closes.push(close);
        if (open.rules.size === 0 && e.end === undefined) e.end = close;
      }
      return;
    }
    if (d.scope === "open") {
      biomeStack.push(index);
    } else {
      const open = biomeStack.pop();
      if (open === undefined) return;
      const e = endOf(open);
      e.closes.push({ raw: d.raw, line: d.line });
      e.end = { raw: d.raw, line: d.line };
    }
  });
  const out: SwitchEntry[] = [];
  placed.forEach((d, index) => {
    if (!LISTED_SCOPES.has(d.scope)) return;
    let covered: string[];
    let tail = [""];
    if (d.scope === "line") {
      covered = [code[d.line - 1] ?? ""];
    } else if (d.scope === "next") {
      covered =
        d.form === "biome-ignore"
          ? biomeCovered(code, d.line)
          : d.tool === "ts"
            ? tsCovered(code, rawLines, starts, comments, d.line)
            : [code[d.line] ?? ""];
    } else if (d.scope === "file") {
      covered = code.filter((entry) => entry !== "");
    } else {
      const e = ends.get(index);
      const end = e?.end;
      tail = [
        ...(e?.closes.map((c) => c.raw) ?? []),
        ...(end === undefined ? ["to end of file"] : []),
      ];
      const stop = end === undefined ? code.length : Math.max(d.line, end.line - 1);
      covered = code.slice(d.line, stop).filter((entry) => entry !== "");
    }
    out.push({
      file,
      line: d.line,
      form: d.form,
      rules: d.rules,
      reason: d.reason,
      id: switchOffId("comment", [file, d.raw, ...covered, ...tail]),
    });
  });
  return out;
}

function git(repo: string, args: string[]): string {
  const r = run("git", ["-C", repo, ...args], { env: UNSET_GIT });
  if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.err.trim() || r.out.trim()}`);
  return r.out;
}

function commitOfRef(repo: string, ref: string): string {
  return git(repo, ["rev-parse", "--verify", `${ref}^{commit}`]).trim();
}

function isSource(path: string): boolean {
  return /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/u.test(path);
}

function treePaths(repo: string, ref: string): string[] {
  return git(repo, ["ls-tree", "-rz", "--full-tree", "--name-only", ref])
    .split("\0")
    .filter((path) => path !== "");
}

function changedPaths(repo: string, base: string, head: string): string[] {
  return git(repo, ["diff", "--no-renames", "--name-only", "-z", base, head])
    .split("\0")
    .filter((path) => path !== "");
}

function blobAt(repo: string, rev: string, path: string): string | null {
  const r = run("git", ["-C", repo, "cat-file", "blob", `${rev}:${path}`], { env: UNSET_GIT });
  if (r.code !== 0) return null;
  return r.out;
}

function blobShaAt(repo: string, rev: string, path: string): string | null {
  const r = run("git", ["-C", repo, "rev-parse", "--verify", "--quiet", `${rev}:${path}`], {
    env: UNSET_GIT,
  });
  if (r.code !== 0 || r.out === "") return null;
  return pySplitLines(r.out)[0] ?? null;
}

/** The switch-offs the head adds over the base, file by file: the head holds
 * more of an identity than the base does. */
function addedSwitches(repo: string, base: string, head: string): SwitchEntry[] {
  const before = new Set(treePaths(repo, base));
  const after = new Set(treePaths(repo, head));
  const paths = changedPaths(repo, base, head).filter(isSource);
  const oldCounts = new Map<string, number>();
  for (const path of paths) {
    if (!before.has(path)) continue;
    const source = blobAt(repo, base, path);
    if (source === null)
      throw new Error(
        `cannot read ${path} at ${base}: refusing to report clear over unreadable input`,
      );
    for (const entry of fileSwitches(path, source)) {
      oldCounts.set(entry.id, (oldCounts.get(entry.id) ?? 0) + 1);
    }
  }

  const found: SwitchEntry[] = [];
  const seen = new Map<string, number>();
  for (const path of paths) {
    if (!after.has(path)) continue;
    const source = blobAt(repo, head, path);
    if (source === null)
      throw new Error(
        `cannot read ${path} at ${head}: refusing to report clear over unreadable input`,
      );
    for (const entry of fileSwitches(path, source)) {
      const index = seen.get(entry.id) ?? 0;
      seen.set(entry.id, index + 1);
      if (index < (oldCounts.get(entry.id) ?? 0)) continue;
      found.push(entry);
    }
  }
  return found;
}

/** The settings files a check reads, by basename anywhere in the tree. */
function settingsKind(path: string): "plain" | "package" | null {
  const name = basename(path);
  if (name === "package.json") return "package";
  if (
    /^tsconfig.*\.json$/u.test(name) ||
    /^jsconfig.*\.json$/u.test(name) ||
    name === ".oxlintrc.json" ||
    name.startsWith(".eslintrc") ||
    name.startsWith("eslint.config.") ||
    name === ".eslintignore" ||
    name === "biome.json" ||
    name === "biome.jsonc" ||
    name.startsWith(".prettierrc") ||
    name.startsWith("prettier.config.") ||
    name === ".prettierignore" ||
    name === "bunfig.toml"
  ) {
    return "plain";
  }
  return null;
}

/** Stable JSON for comparing parsed blocks: object keys in order. */
function canonJson(v: unknown): string {
  if (v === undefined) return "<undefined>";
  if (Array.isArray(v)) return `[${v.map(canonJson).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/** Whether a package.json change touches what a check runs or a tool's settings:
 * its scripts, eslintConfig or prettier block, not a dependency. Text that does
 * not parse compares whole, so an unreadable file is never waved through. */
export function packageSettingsDiffer(a: string | null, b: string | null): boolean {
  if (a === null || b === null) {
    if (a === null && b === null) return false;
    let parsed: unknown;
    try {
      parsed = JSON.parse((a ?? b)!) as unknown;
    } catch {
      return true;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return true;
    const o = parsed as Record<string, unknown>;
    return ["scripts", "eslintConfig", "prettier"].some((k) => o[k] !== undefined);
  }
  if (a === b) return false;
  let pa: unknown;
  let pb: unknown;
  try {
    pa = JSON.parse(a) as unknown;
    pb = JSON.parse(b) as unknown;
  } catch {
    return true;
  }
  if (pa === null || typeof pa !== "object" || Array.isArray(pa)) return true;
  if (pb === null || typeof pb !== "object" || Array.isArray(pb)) return true;
  const oa = pa as Record<string, unknown>;
  const ob = pb as Record<string, unknown>;
  return ["scripts", "eslintConfig", "prettier"].some((k) => canonJson(oa[k]) !== canonJson(ob[k]));
}

interface SettingsEntry {
  file: string;
  change: "added" | "changed" | "deleted";
  id: string;
  diff: string;
}

function settingsChanges(repo: string, base: string, head: string): SettingsEntry[] {
  const before = new Set(treePaths(repo, base));
  const after = new Set(treePaths(repo, head));
  const candidates = changedPaths(repo, base, head)
    .filter((path) => settingsKind(path) !== null)
    .sort();
  const result: SettingsEntry[] = [];
  for (const path of candidates) {
    const kind = settingsKind(path)!;
    const oldText = before.has(path) ? blobAt(repo, base, path) : null;
    const newText = after.has(path) ? blobAt(repo, head, path) : null;
    const differs =
      kind === "package" ? packageSettingsDiffer(oldText, newText) : oldText !== newText;
    if (!differs) continue;
    const change = !before.has(path) ? "added" : !after.has(path) ? "deleted" : "changed";
    const d = run(
      "git",
      [
        "-C",
        repo,
        "diff",
        "--no-color",
        "--no-ext-diff",
        "--no-textconv",
        "--unified=3",
        "--no-renames",
        base,
        head,
        "--",
        `:(literal)${path}`,
      ],
      { env: UNSET_GIT },
    );
    if (d.code !== 0) throw new Error(`git diff ${path}: ${d.err.trim()}`);
    const sha = blobShaAt(repo, head, path) ?? "absent";
    result.push({
      file: path,
      change,
      id: switchOffId("settings", [path, sha]),
      diff: d.out.replace(/\n+$/u, ""),
    });
  }
  return result;
}

interface LoggedApproval {
  action: string;
  actor: string;
  target: string;
  detail: string;
  run: string;
}

/** The user's word per switch-off identity, from the run's record: the line must
 * sit in the run's actions and the project's ledger alike, be the postmaster's
 * word for this run, and open with approved or refused plus the user's words.
 * Anything else is ignored with a warning, never silently obeyed and never
 * fatal to the listing. Where the record holds both words for one identity,
 * refused wins: a refusal stands until the entry itself changes. */
function approvals(
  dispatch: string,
  warn: (message: string) => void,
): Map<string, "approved" | "refused"> {
  const root = resolve(dispatch);
  const runId = basename(root);
  const actionPath = join(root, "actions.jsonl");
  if (!existsSync(actionPath)) throw new Error(`no actions.jsonl in ${root}`);
  const ledgerPath = join(dirname(root), "ledger.jsonl");
  const ledgerText = existsSync(ledgerPath) ? readFileSync(ledgerPath, "utf8") : "";
  const ledgerKeys = new Set(pySplitLines(ledgerText).filter((line) => pyTrim(line) !== ""));
  const result = new Map<string, "approved" | "refused">();
  for (const line of pySplitLines(readFileSync(actionPath, "utf8"))) {
    if (pyTrim(line) === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      warn(`ignoring a line that is not JSON in ${actionPath}`);
      continue;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) continue;
    const rec = parsed as Partial<LoggedApproval>;
    if (rec.action !== "switch-off") continue;
    if (
      typeof rec.actor !== "string" ||
      typeof rec.target !== "string" ||
      typeof rec.detail !== "string" ||
      typeof rec.run !== "string"
    ) {
      warn(`ignoring a malformed switch-off line in ${actionPath}`);
      continue;
    }
    if (rec.actor !== "postmaster" || rec.run !== runId) continue;
    if (!ledgerKeys.has(line)) {
      warn(`ignoring a switch-off line missing from the ledger in ${actionPath}`);
      continue;
    }
    const words = pyWords(rec.detail);
    const decision = words[0] === "approved" ? "approved" : words[0] === "refused" ? "refused" : "";
    if (decision === "" || words.length < 3) {
      warn(`ignoring a malformed switch-off line in ${actionPath}`);
      continue;
    }
    if (decision === "refused" || !result.has(rec.target)) result.set(rec.target, decision);
  }
  return result;
}

export function renderSwitchOffs(
  comments: SwitchOffComment[],
  settings: SwitchOffSetting[],
): string {
  const lines: string[] = [];
  for (const item of comments) {
    lines.push(
      `- comment ${item.path}:${item.line} ${item.form} ${item.rules} -- reason: ` +
        `${item.reason ?? "missing"} (id ${item.id})${item.approved ? " (approved)" : ""}`,
    );
  }
  const ordered = [...settings].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const item of ordered) {
    lines.push(
      `- settings ${item.path} (${item.change}) (id ${item.id})${item.approved ? " (approved)" : ""}`,
    );
    const longestFence = Math.max(
      0,
      ...[...item.diff.matchAll(/`+/gu)].map((match) => match[0].length),
    );
    const fence = "`".repeat(Math.max(3, longestFence + 1));
    lines.push(`${fence}diff`);
    lines.push(item.diff === "" ? "(no textual diff)" : item.diff);
    lines.push(fence);
  }
  return `## Switch-offs\n\n${lines.length > 0 ? lines.join("\n") : "none"}\n`.replace(
    /<!--/gu,
    "&lt;!--",
  );
}

export function inspectSwitchOffs(options: {
  repo: string;
  defaultRef: string;
  ticketRef: string;
  dispatch?: string;
}): SwitchOffReport {
  const repo = resolve(options.repo);
  const defaultHead = commitOfRef(repo, options.defaultRef);
  const ticketHead = commitOfRef(repo, options.ticketRef);
  let base: string;
  try {
    base = git(repo, ["merge-base", defaultHead, ticketHead]).trim();
  } catch {
    throw new Error(`no merge base of ${options.defaultRef} and ${options.ticketRef}`);
  }
  if (base === "")
    throw new Error(`no merge base of ${options.defaultRef} and ${options.ticketRef}`);
  const comments = addedSwitches(repo, base, ticketHead);
  const settings = settingsChanges(repo, base, ticketHead);
  const warnings: string[] = [];
  const logged =
    options.dispatch === undefined
      ? new Map<string, "approved" | "refused">()
      : approvals(options.dispatch, (message) => warnings.push(message));
  for (const message of warnings) console.error(`switch-offs: ${message}`);
  const listedComments: SwitchOffComment[] = comments.map((entry) => ({
    id: entry.id,
    path: entry.file,
    line: entry.line,
    form: entry.form,
    rules: entry.rules,
    reason: entry.reason,
    approved: logged.get(entry.id) === "approved",
  }));
  const listedSettings: SwitchOffSetting[] = settings.map((entry) => ({
    id: entry.id,
    path: entry.file,
    change: entry.change,
    diff: entry.diff,
    approved: logged.get(entry.id) === "approved",
  }));
  const open = [
    ...listedComments.map((entry) => entry.id),
    ...listedSettings.map((entry) => entry.id),
  ].filter((id) => logged.get(id) !== "approved");
  const refused = open.some((id) => logged.get(id) === "refused");
  const missingReason = listedComments.some((entry) => entry.reason === null);
  const status: SwitchOffStatus = refused
    ? "refused"
    : missingReason
      ? "no reason"
      : open.length > 0
        ? "held"
        : "clear";
  return {
    status,
    comments: listedComments,
    settings: listedSettings,
    output: renderSwitchOffs(listedComments, listedSettings),
  };
}
