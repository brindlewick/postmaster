// The turnpikes: the checks a run must pass through before it ships. The project's gate is not
// one of them; it runs on every run. This is the one place the turnpikes and the default set are
// defined. A ticket names its run's turnpikes in its `## Turnpikes` section, and
// scripts/ticket-check.sh, the postmaster and the coachman all read them from here.
//
//   turnpikes.sh --list                 every turnpike, one per line: its name, `default` or `-`,
//                                       the leg that runs it, and what it checks
//   turnpikes.sh resolve [--project <repo>] [<text>...] a `## Turnpikes` section's text, as the turnpikes it
//                                       names; with no text given, the section is read from stdin
//   turnpikes.sh legs <dispatch> [--expect <line>]
//                                       a run's legs, from the `turnpikes:` line under its
//                                       waybill's title; with --expect, that line must be <line>
//   turnpikes.sh legs --line <line>     the legs a waybill with that `turnpikes:` line would have
//   turnpikes.sh short [--project <repo>] <line> the default turnpikes a `turnpikes:` line leaves out
//
//   exit 0  printed
//   exit 1  usage, no waybill, or a table that breaks its rules
//   exit 2  resolve: the text is not a turnpikes section; legs and short: the line is missing,
//           is not names or none, or is not the one --expect gives. One line per fault, on stdout.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { scriptsDir } from "./lib/paths.ts";
import { die, run } from "./lib/proc.ts";
import { NAME_CLASS, PY_S_CLASS, pyLower, pyTrim, pyWords } from "./lib/text.ts";

export const TABLE = `# name     set      leg     what it checks
style      default  review  idiom, naming, abstraction and consistency with the project's own conventions
bug        default  review  correctness, logic, and whether the tests are adequate
security   default  review  exploit paths through the project's risk surfaces`;

export const LEGS: Array<[number, string]> = [
  [1, "synthesis"],
  [2, "review"],
  [3, "ship"],
];
export const ALWAYS = new Set(["synthesis", "ship"]);
const RESERVED = ["default", "none"];
const BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/u;
// Python's strerror, for the read errors BASE reports concisely.
const STRERROR: Record<string, string> = {
  EACCES: "Permission denied",
  EISDIR: "Is a directory",
  ELOOP: "Too many levels of symbolic links",
  ENAMETOOLONG: "File name too long",
  ENOENT: "No such file or directory",
  ENOTDIR: "Not a directory",
};
const STRIP3_RE = new RegExp(
  `^[^${PY_S_CLASS}]+[${PY_S_CLASS}]+[^${PY_S_CLASS}]+[${PY_S_CLASS}]+[^${PY_S_CLASS}]+[${PY_S_CLASS}]+`,
  "u",
);
export const WORD_SPLIT_RE = new RegExp(`[${PY_S_CLASS},;]+`, "u");
export const NAME_CHAR_RE = new RegExp(`[${NAME_CLASS}]`, "u");
export const MARKER = /^[ \t]*(?:[-*+]|\p{Nd}{1,9}[.)])(?:[ \t]+|$)/u;
const LINE = /^[ \t]*turnpikes[ \t]*:/u;

type Row = { name: string; d: boolean; leg: string; what: string };

export function parseTable(table: string): { rows: Row[]; faults: string[] } {
  const rows: Row[] = [];
  const faults: string[] = [];
  const lines = table.split("\n");
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n] ?? "";
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    // actually need up to 4 fields: name, mark, leg, what (what may have spaces)
    const parts = pyWords(line);
    if (parts.length < 4 || !NAME_CHAR_RE.test(parts.slice(3).join(" "))) {
      faults.push(`line ${n + 1} needs a name, default or -, a leg, and what it checks`);
      continue;
    }
    const name = parts[0] ?? "";
    const mark = parts[1] ?? "";
    const leg = parts[2] ?? "";
    const what = pyTrim(pyTrim(line).replace(STRIP3_RE, ""));
    if (!/^[a-z][a-z0-9-]*$/u.test(name)) {
      faults.push(`line ${n + 1}: "${name}" is not a lowercase word`);
    } else if (RESERVED.includes(name)) {
      faults.push(
        `line ${n + 1}: "${name}" already means something in a ticket, so no turnpike is named it`,
      );
    } else if (rows.some((r) => r.name === name)) {
      faults.push(`line ${n + 1}: "${name}" is listed twice`);
    }
    if (mark !== "default" && mark !== "-") {
      faults.push(`line ${n + 1}: "${mark}" is neither default nor -`);
    }
    if (!LEGS.some(([, l]) => l === leg)) {
      faults.push(
        `line ${n + 1}: "${leg}" is not a leg; the legs are ${LEGS.map(([, l]) => l).join(", ")}`,
      );
    }
    rows.push({ name, d: mark === "default", leg, what });
  }
  return { rows, faults };
}

function wordsOf(text: string): string[] {
  const words: string[] = [];
  // remove Cf (format) characters, the whole category as unicodedata does
  const cleaned = [...text].filter((ch) => !/\p{Cf}/u.test(ch)).join("");
  for (const rawLine of cleaned.split("\n")) {
    let line = rawLine.replace(/\r$/u, "").replace(/\\+$/u, "");
    if (BREAK.test(line)) continue;
    const m = MARKER.exec(line);
    if (m) line = line.slice(m[0].length);
    for (const tok of line.split(WORD_SPLIT_RE)) {
      if (tok) {
        // BASE: tok.strip("`*_").rstrip(".").strip("`*_").lower() or tok
        const stripped = pyLower(
          tok
            .replace(/^[*_`]+/u, "")
            .replace(/[*_`]+$/u, "")
            .replace(/\.+$/u, "")
            .replace(/^[*_`]+/u, "")
            .replace(/[*_`]+$/u, ""),
        );
        words.push(stripped || tok);
      }
    }
  }
  return words;
}

let cachedProject = "\n";
let cachedDefaults: string[] | null = null;

function projectDefaults(): string[] | null {
  const project = process.env.POSTMASTER_PROJECT ?? "";
  if (project === "") return null;
  if (project === cachedProject) return cachedDefaults;
  const r = run(join(scriptsDir(import.meta), "project-settings.sh"), ["inspect", project]);
  if (r.code !== 0) {
    console.error(r.err.trim() || "turnpikes: cannot read project settings");
    process.exit(1);
  }
  let profile: Record<string, any>;
  try {
    profile = JSON.parse(r.out);
  } catch (e) {
    console.error(
      `turnpikes: project settings gave no JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
    process.exit(1);
  }
  const declared = profile.project?.default_turnpikes;
  cachedProject = project;
  cachedDefaults = declared === undefined || declared === null ? null : declared;
  return cachedDefaults;
}

export function resolve(table: string, text: string): { names: string[] | null; faults: string[] } {
  const { rows, faults: tableFaults } = parseTable(table);
  if (tableFaults.length > 0) {
    // already handled by caller
  }
  const names = rows.map((r) => r.name);
  const defaults = projectDefaults() ?? rows.filter((r) => r.d).map((r) => r.name);
  const words = wordsOf(text);
  const holds = `the section holds only default, none, or names from: ${names.join(", ") || "(no turnpikes)"}`;
  if (words.length === 0) {
    return { names: null, faults: [`names no turnpike; ${holds}`] };
  }
  const out: string[] = [];
  const uniqueUnknown = [...new Set(words)].filter(
    (w) => !names.includes(w) && !RESERVED.includes(w),
  );
  const unknown = uniqueUnknown.map((w) => `"${w}"`);
  if (unknown.length > 0) {
    const which =
      unknown.length === 1
        ? unknown[0]
        : `${unknown.slice(0, -1).join(", ")} and ${unknown[unknown.length - 1]}`;
    out.push(
      `${which} ${unknown.length === 1 ? "is not a turnpike" : "are not turnpikes"}; ${holds}`,
    );
  }
  if (words.includes("none") && new Set(words).size > 1) {
    out.push("none stands alone, and is not listed with other turnpikes");
  }
  if (out.length > 0) return { names: null, faults: out };
  const chosen = new Set(words);
  if (words.includes("default")) for (const d of defaults) chosen.add(d);
  return { names: names.filter((n) => chosen.has(n)), faults: [] };
}

export function named(table: string, line: string): string[] | null {
  if (line.includes("\n") || !LINE.test(line)) {
    console.log(`"${line.replace(/\n/gu, "\\n")}" is not a turnpikes: line`);
    process.exit(2);
  }
  const _value = line.replace(LINE, "").replace(/^([ \t]*turnpikes[ \t]*:)/u, "");
  // LINE.sub("", line, count=1) removes the matched prefix
  const value2 = line.replace(/^[ \t]*turnpikes[ \t]*:/u, "");
  if (wordsOf(value2).includes("default")) {
    console.log(
      "the waybill's turnpikes line says default; it carries the names ticket-check.sh printed for the ticket",
    );
    process.exit(2);
  }
  const { names, faults } = resolve(table, value2);
  if (faults.length > 0) {
    console.log(faults.map((o) => `the waybill's turnpikes: ${o}`).join("\n"));
    process.exit(2);
  }
  return names ?? [];
}

function legsOf(table: string, line: string): void {
  const got = named(table, line);
  for (const [n, leg] of LEGS) {
    const runs = (got ?? []).filter((x) => {
      const { rows } = parseTable(table);
      return rows.find((r) => r.name === x)?.leg === leg;
    });
    if (ALWAYS.has(leg) || runs.length > 0) {
      console.log([String(n), leg, ...runs].join(" "));
    }
  }
}

const USAGE =
  "usage: turnpikes.sh --list | resolve [--project <repo>] [<text>...] | legs <dispatch> [--expect <line>] | legs --line <line> | short [--project <repo>] <line>";

// --- entry -----------------------------------------------------------------------------------
function main(argv: string[]): number {
  if (argv[0] === "--list") {
    if (argv.length !== 1) die(USAGE, 1);
    const { rows, faults } = parseTable(TABLE);
    if (faults.length > 0) {
      console.error(faults.map((f) => `turnpikes: the table's ${f}`).join("\n"));
      return 1;
    }
    for (const r of rows) {
      console.log(
        `${r.name.padEnd(10)} ${(r.d ? "default" : "-").padEnd(8)} ${r.leg.padEnd(9)} ${r.what}`,
      );
    }
    return 0;
  }
  if (argv[0] === "resolve") {
    let rest = argv.slice(1);
    if (rest[0] === "--project") {
      if (rest.length < 2) die(USAGE, 1);
      if (rest[1] === "") {
        console.error("turnpikes: no such project directory: ");
        return 1;
      }
      process.env.POSTMASTER_PROJECT = rest[1];
      rest = rest.slice(2);
    }
    const text = rest.length > 0 ? rest.join(" ") : readFileSync(0, "utf8");
    // BASE's core refused any command on a table that breaks its rules; resolve must too.
    const tableCheck = parseTable(TABLE);
    if (tableCheck.faults.length > 0) {
      console.error(tableCheck.faults.map((f) => `turnpikes: the table's ${f}`).join("\n"));
      return 1;
    }
    const { names, faults } = resolve(TABLE, text);
    if (faults.length > 0) {
      console.log(faults.join("\n"));
      return 2;
    }
    console.log(`turnpikes: ${(names ?? []).join(", ") || "none"}`);
    return 0;
  }
  if (argv[0] === "short") {
    let rest = argv.slice(1);
    if (rest[0] === "--project") {
      if (rest.length !== 3) die(USAGE, 1);
      if (rest[1] === "") {
        console.error("turnpikes: no such project directory: ");
        return 1;
      }
      process.env.POSTMASTER_PROJECT = rest[1];
      rest = rest.slice(2);
    }
    if (rest.length !== 1) die(USAGE, 1);
    const got = named(TABLE, rest[0] ?? "");
    const { rows } = parseTable(TABLE);
    const defaults = projectDefaults() ?? rows.filter((r) => r.d).map((r) => r.name);
    for (const name of defaults) {
      if (!(got ?? []).includes(name)) console.log(name);
    }
    return 0;
  }
  if (argv[0] === "legs") {
    if (argv[1] === "--line") {
      if (argv.length !== 3) die(USAGE, 1);
      legsOf(TABLE, argv[2] ?? "");
      return 0;
    }
    const ok1 = argv.length === 2;
    const ok2 = argv.length === 4 && argv[2] === "--expect";
    if (!ok1 && !ok2) die(USAGE, 1);
    const brief = join(argv[1] ?? "", "brief.md");
    let regular = false;
    try {
      regular = existsSync(brief) && statSync(brief).isFile();
    } catch {
      regular = false;
    }
    if (!regular) {
      console.error(`turnpikes: no waybill at ${brief}`);
      return 1;
    }
    let lines: string[];
    try {
      lines = readFileSync(brief, "utf8").split("\n");
    } catch (e) {
      const code = (e as NodeJS.ErrnoException)?.code ?? "";
      console.error(`turnpikes: cannot read ${brief}: ${STRERROR[code] ?? code}`);
      return 1;
    }
    const above: string[] = [];
    for (const l of lines) {
      if (l.startsWith("## ")) break;
      above.push(l.replace(/\r$/u, ""));
    }
    const found = above.filter((l) => LINE.test(l));
    if (found.length !== 1) {
      console.log(
        `the waybill has ${found.length === 0 ? "no" : String(found.length)} turnpikes: line${found.length === 1 ? "" : "s"} under its title, above the ticket, and one is needed; none is never assumed`,
      );
      return 2;
    }
    if (ok2 && pyWords(found[0] ?? "").join(" ") !== pyWords(argv[3] ?? "").join(" ")) {
      console.log(
        `the waybill says "${(found[0] ?? "").trim()}", and the ticket's check printed "${(argv[3] ?? "").trim()}"`,
      );
      return 2;
    }
    legsOf(TABLE, found[0] ?? "");
    return 0;
  }
  die(USAGE, 1);
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
