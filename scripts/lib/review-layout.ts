// The layout of a review page: the group each file of a change belongs to, the order inside the
// group, a one-line purpose, which files are read closely and which are withheld, and the lines
// the review questions ("rulings") point at. Groups, purposes and rulings come from a declarative
// layout config (skills/review-pages/page/layout.default.json, plus a project's own, joined by
// mergeLayout), with heuristics for what the config does not name. Pure: no file, clock or
// environment access, and no argument is changed; the page builder reads the files and hands
// their text in.
import { compareNames } from "./review-tree.ts";

// ---------- types ----------

export interface LayoutGroup {
  id: string;
  num: string;
  title: string;
  sub: string;
  note?: string;
  collapsed: boolean;
  /** Regex sources, compiled with the "u" flag and tested against the whole path. */
  match?: string[];
  /** Split this group into one output group per area. */
  by?: "area";
  /** Matching order, higher first, default 0; config order breaks ties. */
  priority?: number;
  /** Exact paths placed first, in this order. */
  order?: string[];
}

export interface WithheldRule {
  match: string;
  text: string;
}

export interface RulingLinkSpec {
  path: string;
  match: string;
  to_match?: string;
  span?: number;
  label: string;
}

export interface RulingSpec {
  n: number;
  state: "open" | "decided";
  title: string;
  links: RulingLinkSpec[];
}

export interface LayoutConfig {
  areaRoots: string[];
  groups: LayoutGroup[];
  withheld: WithheldRule[];
  first: string[];
  purposes: Record<string, string>;
  rulings: RulingSpec[];
}

export interface ChangedFile {
  path: string;
  old: string | null;
  status: string;
  add: number;
  del: number;
  binary: boolean;
}

export interface ReviewGroup {
  id: string;
  num: string;
  title: string;
  sub: string;
  note?: string;
  collapsed: boolean;
}

export interface PlacedFile extends ChangedFile {
  /** Index into the returned groups. */
  group: number;
  /** Read closely. */
  first: boolean;
  purpose: string;
  purposeSource: "layout" | "heuristic";
  /** Text shown instead of the diff. */
  withheld?: string;
}

export interface RulingLink {
  path: string;
  from: number;
  to: number;
  label: string;
}

export interface Ruling {
  n: number;
  state: "open" | "decided";
  title: string;
  links: RulingLink[];
}

export const EMPTY_LAYOUT: LayoutConfig = {
  areaRoots: [],
  groups: [],
  withheld: [],
  first: [],
  purposes: {},
  rulings: [],
};

// ---------- small helpers ----------

/** `{ [key]: value }`, or an empty object when there is no value. */
function maybe<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };
}

// ---------- reading a config ----------

/** What one step of reading found, with what it had to say about it. */
interface Parsed<T> {
  readonly value: T;
  readonly problems: readonly string[];
}

type Json = Readonly<Record<string, unknown>>;

/** A required field: its value, or the reason there is none. */
type Field<T> = { readonly value: T } | { readonly reason: string };

const isRecord = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string";
const isFlag = (v: unknown): v is boolean => typeof v === "boolean";
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isCount = (v: unknown): v is number => isNumber(v) && Number.isInteger(v) && v >= 0;
const isArea = (v: unknown): v is "area" => v === "area";
const isState = (v: unknown): v is "open" | "decided" => v === "open" || v === "decided";

function compiles(source: string): boolean {
  try {
    new RegExp(source, "u");
    return true;
  } catch {
    return false;
  }
}

const isPattern = (v: unknown): v is string => isText(v) && compiles(v);

const KINDS: Readonly<Record<string, string>> = {
  string: "text",
  number: "a number",
  boolean: "true or false",
};

function kindOf(v: unknown): string {
  if (v === undefined) return "nothing";
  if (v === null) return "null";
  if (Array.isArray(v)) return "a list";
  return KINDS[typeof v] ?? "an object";
}

const kept = <T>(value: T): Parsed<T> => ({ value, problems: [] });
const dropped = (problem: string): Parsed<undefined> => ({ value: undefined, problems: [problem] });

/** A required field. Left out and blank text both count as missing. */
function field<T>(
  obj: Json,
  key: string,
  accepts: (v: unknown) => v is T,
  wrong: (v: unknown) => string = () => `${key} has the wrong type`,
): Field<T> {
  const v = obj[key];
  if (v === undefined || (isText(v) && v.trim() === "")) return { reason: `missing ${key}` };
  return accepts(v) ? { value: v } : { reason: wrong(v) };
}

const reasonsOf = (...fields: readonly Field<unknown>[]): string[] =>
  fields.flatMap((f) => ("reason" in f ? [f.reason] : []));

/** A field that may be left out; one of the wrong type is ignored, with a problem. */
function optional<T>(
  obj: Json,
  key: string,
  at: string,
  accepts: (v: unknown) => v is T,
  expected: string,
): Parsed<T | undefined> {
  const v = obj[key];
  if (v === undefined) return kept(undefined);
  return accepts(v) ? kept(v) : dropped(`${at}.${key}: expected ${expected}, ignored`);
}

const unknownKeys = (obj: Json, known: readonly string[], at: string): string[] =>
  Object.keys(obj)
    .filter((key) => !known.includes(key))
    .map((key) => `${at}.${key}: unknown key, ignored`);

/**
 * Each item of a list, read by `item`; one that comes back undefined is dropped. A non-empty list
 * with nothing usable left has no value, as does anything that is not a list.
 */
function listOf<T>(
  raw: unknown,
  at: string,
  expected: string,
  item: (v: unknown, at: string) => Parsed<T | undefined>,
): Parsed<T[] | undefined> {
  if (!Array.isArray(raw)) return dropped(`${at}: expected ${expected}, ignored`);
  const parsed = raw.map((v, i) => item(v, `${at}[${i}]`));
  const usable = parsed.flatMap((p) => (p.value === undefined ? [] : [p.value]));
  return {
    value: raw.length > 0 && usable.length === 0 ? undefined : usable,
    problems: parsed.flatMap((p) => p.problems),
  };
}

/** A list under a top-level key: a non-empty list with nothing usable counts as not given. */
function keyList<T>(
  raw: unknown,
  at: string,
  expected: string,
  item: (v: unknown, at: string) => Parsed<T | undefined>,
): Parsed<T[] | undefined> {
  const parsed = listOf(raw, at, expected, item);
  return parsed.value === undefined && Array.isArray(raw)
    ? { value: undefined, problems: [...parsed.problems, `${at}: no usable item left, ignored`] }
    : parsed;
}

const textItem = (v: unknown, at: string): Parsed<string | undefined> =>
  isText(v) ? kept(v) : dropped(`${at}: expected text, dropped`);

const patternItem = (v: unknown, at: string): Parsed<string | undefined> => {
  if (!isText(v)) return dropped(`${at}: expected text, dropped`);
  return compiles(v) ? kept(v) : dropped(`${at}: invalid pattern ${JSON.stringify(v)}, dropped`);
};

const GROUP_KEYS = [
  "id",
  "num",
  "title",
  "sub",
  "note",
  "collapsed",
  "by",
  "priority",
  "order",
  "match",
];

function parseGroup(raw: unknown, at: string): Parsed<LayoutGroup | undefined> {
  if (!isRecord(raw)) return dropped(`${at}: expected an object, dropped`);
  const extras = unknownKeys(raw, GROUP_KEYS, at);
  const id = field(raw, "id", isText);
  const title = field(raw, "title", isText);
  if ("reason" in id || "reason" in title) {
    return {
      value: undefined,
      problems: [...extras, `${at}: ${reasonsOf(id, title).join(", ")}, dropped`],
    };
  }
  const patterns =
    raw.match === undefined
      ? undefined
      : listOf(raw.match, `${at}.match`, "a list of text", patternItem);
  if (patterns !== undefined && patterns.value === undefined) {
    return {
      value: undefined,
      problems: [...extras, ...patterns.problems, `${at}: no usable pattern in match, dropped`],
    };
  }
  const num = optional(raw, "num", at, isText, "text");
  const sub = optional(raw, "sub", at, isText, "text");
  const note = optional(raw, "note", at, isText, "text");
  const collapsed = optional(raw, "collapsed", at, isFlag, "true or false");
  const by = optional(raw, "by", at, isArea, '"area"');
  const priority = optional(raw, "priority", at, isNumber, "a number");
  const order =
    raw.order === undefined
      ? kept(undefined)
      : listOf(raw.order, `${at}.order`, "a list of text", textItem);
  return {
    value: {
      id: id.value,
      num: num.value ?? "",
      title: title.value,
      sub: sub.value ?? "",
      ...maybe("note", note.value),
      collapsed: collapsed.value ?? false,
      ...maybe("by", by.value),
      ...maybe("priority", priority.value),
      ...maybe("order", order.value),
      ...maybe("match", patterns?.value),
    },
    problems: [
      ...extras,
      ...[num, sub, note, collapsed, by, priority, order].flatMap((p) => p.problems),
      ...(patterns?.problems ?? []),
    ],
  };
}

/** The groups of a config. The first of two groups with one id stays. */
function parseGroups(raw: unknown): Parsed<LayoutGroup[] | undefined> {
  const listed = keyList(raw, "groups", "a list", parseGroup);
  const groups = listed.value;
  if (groups === undefined) return listed;
  const firstWith = (g: LayoutGroup): number => groups.findIndex((h) => h.id === g.id);
  return {
    value: groups.filter((g, i) => firstWith(g) === i),
    problems: [
      ...listed.problems,
      ...groups
        .filter((g, i) => firstWith(g) !== i)
        .map((g) => `groups: duplicate id ${JSON.stringify(g.id)}, the later group is dropped`),
    ],
  };
}

function parseWithheld(raw: unknown, at: string): Parsed<WithheldRule | undefined> {
  if (!isRecord(raw)) return dropped(`${at}: expected an object, dropped`);
  const extras = unknownKeys(raw, ["match", "text"], at);
  const match = field(raw, "match", isPattern, (v) =>
    isText(v) ? `invalid pattern ${JSON.stringify(v)}` : "match has the wrong type",
  );
  const text = field(raw, "text", isText);
  if ("reason" in match || "reason" in text) {
    return {
      value: undefined,
      problems: [...extras, `${at}: ${reasonsOf(match, text).join(", ")}, dropped`],
    };
  }
  return { value: { match: match.value, text: text.value }, problems: extras };
}

function parseLink(raw: unknown, at: string): Parsed<RulingLinkSpec | undefined> {
  if (!isRecord(raw)) return dropped(`${at}: expected an object, dropped`);
  const extras = unknownKeys(raw, ["path", "match", "to_match", "span", "label"], at);
  const path = field(raw, "path", isText);
  const match = field(raw, "match", isText);
  const label = field(raw, "label", isText);
  if ("reason" in path || "reason" in match || "reason" in label) {
    return {
      value: undefined,
      problems: [...extras, `${at}: ${reasonsOf(path, match, label).join(", ")}, dropped`],
    };
  }
  const toMatch = optional(raw, "to_match", at, isText, "text");
  const span = optional(raw, "span", at, isCount, "a whole number, 0 or more");
  return {
    value: {
      path: path.value,
      match: match.value,
      ...maybe("to_match", toMatch.value),
      ...maybe("span", span.value),
      label: label.value,
    },
    problems: [...extras, ...toMatch.problems, ...span.problems],
  };
}

function parseRuling(raw: unknown, at: string): Parsed<RulingSpec | undefined> {
  if (!isRecord(raw)) return dropped(`${at}: expected an object, dropped`);
  const extras = unknownKeys(raw, ["n", "state", "title", "links"], at);
  const n = field(raw, "n", isNumber);
  const state = field(raw, "state", isState, () => 'state must be "open" or "decided"');
  const title = field(raw, "title", isText);
  if ("reason" in n || "reason" in state || "reason" in title) {
    return {
      value: undefined,
      problems: [...extras, `${at}: ${reasonsOf(n, state, title).join(", ")}, dropped`],
    };
  }
  const links =
    raw.links === undefined ? undefined : listOf(raw.links, `${at}.links`, "a list", parseLink);
  return {
    value: { n: n.value, state: state.value, title: title.value, links: links?.value ?? [] },
    problems: [...extras, ...(links?.problems ?? [])],
  };
}

function parsePurposes(raw: unknown): Parsed<Record<string, string> | undefined> {
  if (!isRecord(raw)) return dropped("purposes: expected an object, ignored");
  const entries = Object.entries(raw).map(([path, text]) =>
    isText(text)
      ? kept([path, text] as const)
      : dropped(`purposes[${JSON.stringify(path)}]: expected text, dropped`),
  );
  return {
    value: Object.fromEntries(entries.flatMap((e) => (e.value === undefined ? [] : [e.value]))),
    problems: entries.flatMap((e) => e.problems),
  };
}

/** One top-level key as a partial config, or nothing when its value is not usable. */
function only<K extends keyof LayoutConfig>(
  key: K,
  parsed: Parsed<LayoutConfig[K] | undefined>,
): Parsed<Partial<LayoutConfig>> {
  return { value: maybe(key, parsed.value) as Partial<LayoutConfig>, problems: parsed.problems };
}

function parseKey(key: string, value: unknown): Parsed<Partial<LayoutConfig>> {
  switch (key) {
    case "areaRoots":
      return only(key, keyList(value, key, "a list of text", textItem));
    case "first":
      return only(key, keyList(value, key, "a list of text", textItem));
    case "purposes":
      return only(key, parsePurposes(value));
    case "groups":
      return only(key, parseGroups(value));
    case "withheld":
      return only(key, keyList(value, key, "a list", parseWithheld));
    case "rulings":
      return only(key, keyList(value, key, "a list", parseRuling));
    default:
      return { value: {}, problems: [`${key}: unknown key, ignored`] };
  }
}

/**
 * Read a layout config of unknown shape (parsed JSON). `over` holds only the keys that are present
 * and usable; every defect goes to `problems` as a short sentence naming where it is, and a bad
 * item is dropped while the rest is kept. A non-empty list with no usable item counts as not
 * given, so the base keeps its own (a withheld rule is never lost to a typo), while an empty list
 * is kept as it is. A group whose patterns are all unusable is dropped, so that it cannot become
 * the catch-all.
 */
export function parseLayoutPartial(raw: unknown): {
  over: Partial<LayoutConfig>;
  problems: string[];
} {
  if (!isRecord(raw)) {
    return { over: {}, problems: [`layout: expected an object, got ${kindOf(raw)}`] };
  }
  const parts = Object.entries(raw).map(([key, value]) => parseKey(key, value));
  const over: Partial<LayoutConfig> = Object.assign({}, ...parts.map((part) => part.value));
  return { over, problems: parts.flatMap((part) => [...part.problems]) };
}

// ---------- merging ----------

/**
 * A new layout from a base and the keys of `over`: groups, withheld rules, rulings and area roots
 * replace the base's, purposes merge with `over` winning per key, and `first` is the base's entries
 * followed by the new ones. Keys `over` leaves out keep the base.
 */
export function mergeLayout(base: LayoutConfig, over: Partial<LayoutConfig>): LayoutConfig {
  return {
    areaRoots: [...(over.areaRoots ?? base.areaRoots)],
    groups: [...(over.groups ?? base.groups)],
    withheld: [...(over.withheld ?? base.withheld)],
    first: [...new Set([...base.first, ...(over.first ?? [])])],
    purposes: { ...base.purposes, ...over.purposes },
    rulings: [...(over.rulings ?? base.rulings)],
  };
}

// ---------- areas and globs ----------

/**
 * The area of a path: "(top level)" for a file at the root; the root folder and the next one when
 * the first folder is one of `roots` and the path goes at least three deep ("apps/shop"); otherwise
 * the first folder.
 */
export function areaOf(path: string, roots: readonly string[]): string {
  const parts = path.split("/");
  const [top = "", next = ""] = parts;
  if (parts.length === 1) return "(top level)";
  return parts.length >= 3 && roots.includes(top) ? `${top}/${next}` : top;
}

const GLOB_TOKEN = /\*\*|\*|\?|[^*?]+/gu;
const REGEX_SYNTAX = /[.+^${}()|[\]\\]/gu;

/**
 * A glob as a regular expression over a whole path: `**` is any run of characters, slashes
 * included (so `**` then `/x` needs a slash before x), `*` any run but a slash, `?` one character
 * but a slash, and everything else is literal.
 */
export function globToRegExp(glob: string): RegExp {
  const body = glob.replace(GLOB_TOKEN, (token) => {
    if (token === "**") return "[\\s\\S]*";
    if (token === "*") return "[^/]*";
    if (token === "?") return "[^/]";
    return token.replace(REGEX_SYNTAX, "\\$&");
  });
  return new RegExp(`^${body}$`, "u");
}

// ---------- one line for a file ----------

const LOCKFILES: ReadonlySet<string> = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "Cargo.lock",
  "go.sum",
  "poetry.lock",
  "Gemfile.lock",
  "composer.lock",
  "Pipfile.lock",
]);

const TEST_NAME = /^(.*?)\.(?:test|spec)\./u;
const MAX_PURPOSE = 110;

const lines = (n: number): string => `${n} ${n === 1 ? "line" : "lines"}`;

/** Printable ASCII only: accents are stripped and anything else becomes "?". */
function plain(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\x20-\x7e]/gu, "?");
}

/** `head`, `text`, `tail`, with the start of the text cut to "..." so the whole fits the limit. */
function fitted(head: string, text: string, tail: string): string {
  const room = MAX_PURPOSE - head.length - tail.length;
  const clean = plain(text);
  const shown = clean.length <= room ? clean : `...${clean.slice(clean.length - room + 3)}`;
  return `${head}${shown}${tail}`;
}

/**
 * What a file is, in plain ASCII words and at most 110 characters, from its name and its status.
 * The first rule that matches wins: lockfile, package manifest, environment file, generated file,
 * tests, documentation, binary, then the status (deleted, new, renamed, changed).
 */
export function defaultPurpose(file: ChangedFile): string {
  const name = file.path.split("/").at(-1) ?? file.path;
  if (LOCKFILES.has(name)) return "Dependency lockfile, rewritten by the package manager.";
  if (name === "package.json") return "Package manifest: dependencies, scripts and settings.";
  if (name.startsWith(".env")) return "Environment settings (content not shown).";
  if (name.includes(".gen.") || name.includes(".generated.")) return "Generated file.";
  const stem = TEST_NAME.exec(name)?.[1];
  if (stem !== undefined) return stem === "" ? "Tests." : fitted("Tests for ", stem, ".");
  if (/\.mdx?$/iu.test(name)) return "Documentation.";
  if (file.binary) return "Binary file.";
  const stats = `+${file.add} -${file.del} lines.`;
  switch (file.status.charAt(0)) {
    case "D":
      return `Deleted file, ${lines(file.del)} removed.`;
    case "A":
      return `New file, ${lines(file.add)}.`;
    case "R":
      return file.old ? fitted("Renamed from ", file.old, `, ${stats}`) : `Renamed file, ${stats}`;
    default:
      return `Changed file, ${stats}`;
  }
}

// ---------- placing a change ----------

/** A group of the page with the files in it, in review order. */
interface Section {
  readonly group: ReviewGroup;
  readonly files: readonly ChangedFile[];
}

const linesChanged = (f: ChangedFile): number => f.add + f.del;

/** Listed paths first, in the list's order; then the most changed lines; then by name. */
function ordered(files: readonly ChangedFile[], order: readonly string[] = []): ChangedFile[] {
  return files.toSorted((a, b) => {
    const ra = order.indexOf(a.path);
    const rb = order.indexOf(b.path);
    if (ra !== -1 || rb !== -1) return ra === -1 ? 1 : rb === -1 ? -1 : ra - rb;
    return linesChanged(b) - linesChanged(a) || compareNames(a.path, b.path);
  });
}

/** A group as the page shows it: its display fields only. */
function shown(group: LayoutGroup, id: string, title: string): ReviewGroup {
  return {
    id,
    num: group.num,
    title,
    sub: group.sub,
    ...maybe("note", group.note),
    collapsed: group.collapsed,
  };
}

/** The sections a config group gives, none when it has no files: one, or one per area. */
function sectionsOf(
  group: LayoutGroup,
  members: readonly ChangedFile[],
  roots: readonly string[],
): Section[] {
  if (members.length === 0) return [];
  if (group.by !== "area") {
    return [{ group: shown(group, group.id, group.title), files: ordered(members, group.order) }];
  }
  return [...new Set(members.map((f) => areaOf(f.path, roots)))]
    .map((area) => {
      const inArea = members.filter((f) => areaOf(f.path, roots) === area);
      return { area, inArea, lines: inArea.reduce((n, f) => n + linesChanged(f), 0) };
    })
    .toSorted((a, b) => b.lines - a.lines || compareNames(a.area, b.area))
    .map(({ area, inArea }) => ({
      group: shown(group, `${group.id}:${area}`, area),
      files: ordered(inArea, group.order),
    }));
}

/**
 * The index of the group a path joins: the first group by priority (higher first, config order
 * for ties) with a pattern that matches; else the first group in config order with no patterns;
 * else -1. A pattern is compiled with the "u" flag, and an invalid one throws: a layout is read
 * by parseLayoutPartial first.
 */
function homeFinder(groups: readonly LayoutGroup[]): (path: string) => number {
  const patterned = groups
    .map((group, index) => ({
      index,
      priority: group.priority ?? 0,
      patterns: (group.match ?? []).map((source) => new RegExp(source, "u")),
    }))
    .filter((g) => g.patterns.length > 0)
    .toSorted((a, b) => b.priority - a.priority || a.index - b.index);
  const fallback = groups.findIndex((group) => (group.match ?? []).length === 0);
  return (path) => patterned.find((g) => g.patterns.some((re) => re.test(path)))?.index ?? fallback;
}

/**
 * Adds what the page shows about a file: its group, whether to read it closely, its purpose and
 * any withheld text.
 */
function describer(layout: LayoutConfig): (file: ChangedFile, group: number) => PlacedFile {
  const exact = new Set(layout.first);
  const globs = layout.first.filter((entry) => entry.includes("*")).map(globToRegExp);
  const hiders = layout.withheld.map((rule) => ({
    re: new RegExp(rule.match, "u"),
    text: rule.text,
  }));
  return (file, group) => {
    const own = Object.hasOwn(layout.purposes, file.path) ? layout.purposes[file.path] : undefined;
    const custom = own !== undefined && own.trim() !== "";
    return {
      ...file,
      group,
      first: exact.has(file.path) || globs.some((re) => re.test(file.path)),
      purpose: custom ? own : defaultPurpose(file),
      purposeSource: custom ? "layout" : "heuristic",
      ...maybe("withheld", hiders.find((h) => h.re.test(file.path))?.text),
    };
  };
}

/**
 * Group, order and describe the files of a change. The groups come out in config order (a
 * by-area group gives one per area, in place), then an implicit "Other files" group for any file
 * the layout places nowhere; groups with no files are left out. The files come out in review
 * order, each pointing at its group by index. The result does not depend on the input order.
 */
export function arrange(
  files: readonly ChangedFile[],
  layout: LayoutConfig,
): { groups: ReviewGroup[]; files: PlacedFile[] } {
  const homeOf = homeFinder(layout.groups);
  const homes = files.map((f) => homeOf(f.path));
  const placed = layout.groups.flatMap((group, index) =>
    sectionsOf(
      group,
      files.filter((_, k) => homes[k] === index),
      layout.areaRoots,
    ),
  );
  const strays = files.filter((_, k) => homes[k] === -1);
  const sections: Section[] =
    strays.length === 0
      ? placed
      : [
          ...placed,
          {
            group: {
              id: "other",
              num: "",
              title: "Other files",
              sub: "files the layout does not place",
              collapsed: false,
            },
            files: ordered(strays),
          },
        ];
  const describe = describer(layout);
  return {
    groups: sections.map((s) => s.group),
    files: sections.flatMap((s, index) => s.files.map((f) => describe(f, index))),
  };
}

// ---------- rulings ----------

type Linked = { readonly link: RulingLink } | { readonly problem: string };

/** The lines of a text: a final newline ends the last line rather than starting another. */
function splitLines(text: string): string[] {
  if (text === "") return [];
  const all = text.split("\n");
  return text.endsWith("\n") ? all.slice(0, -1) : all;
}

function resolveLink(n: number, spec: RulingLinkSpec, text: string | undefined): Linked {
  if (text === undefined) return { problem: `ruling ${n}: file not in the change: ${spec.path}` };
  const all = splitLines(text);
  const lost = (what: string): Linked => ({
    problem: `ruling ${n}: text not found in ${spec.path}: ${JSON.stringify(what)}`,
  });
  const start = all.findIndex((line) => line.includes(spec.match));
  if (start === -1) return lost(spec.match);
  const from = start + 1;
  const endText = spec.to_match;
  if (endText !== undefined) {
    const offset = all.slice(start).findIndex((line) => line.includes(endText));
    if (offset === -1) return lost(endText);
    return { link: { path: spec.path, from, to: from + offset, label: spec.label } };
  }
  const to =
    spec.span === undefined ? from : Math.max(from, Math.min(from + spec.span, all.length));
  return { link: { path: spec.path, from, to, label: spec.label } };
}

/**
 * Find the lines each ruling's links point at. `textOf` gives the text of a file of the change, or
 * undefined for a path that is not in it. A link starts at the first line holding its `match`; it
 * ends at the first line from there holding `to_match`, else `span` lines further on (not past the
 * last line), else on the same line. A link whose file or text is not found is dropped, with a
 * problem. Rulings and links keep their order.
 */
export function resolveRulings(
  specs: readonly RulingSpec[],
  textOf: (path: string) => string | undefined,
): { rulings: Ruling[]; problems: string[] } {
  const resolved = specs.map((spec) => {
    const linked = spec.links.map((link) => resolveLink(spec.n, link, textOf(link.path)));
    return {
      ruling: {
        n: spec.n,
        state: spec.state,
        title: spec.title,
        links: linked.flatMap((l) => ("link" in l ? [l.link] : [])),
      },
      problems: linked.flatMap((l) => ("problem" in l ? [l.problem] : [])),
    };
  });
  return {
    rulings: resolved.map((r) => r.ruling),
    problems: resolved.flatMap((r) => r.problems),
  };
}
