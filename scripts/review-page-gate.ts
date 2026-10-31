// Render gate for a built review page: the page is opened in a real headless Chromium, the way a
// phone, a tablet and a desktop see it, and checked.
//
//   scripts/run review-page-gate <page-dir> [--out <dir>] [--quick]
//
// <page-dir> holds what scripts/review-page.ts writes: index.html, review.json and chunks/*.json.
// The folder is served from loopback. /index.html is the page wrapped the way the Artifact
// publisher wraps it (a skeleton with a viewport and a style reset); /plain.html is the bare
// file, a plain browser with no reset. Everything else is served as it is.
//
// The matrix is the widths of the single-pane flow (390, 755, 823, 904, 1024 and 1199) and of the
// two-pane layout (1200 and 1440): 390, 823 and 1440 in light and dark, the others in light, then
// one plain run at 390. --quick keeps 390 light and dark, 1199 light, 1200 light and the plain run,
// so both sides of the split are always looked at. Every run audits the overview, the tree, the
// order and the file screen for sideways scroll, tap targets under 44 px, text under 13 px,
// controls cut off by the window or by a box around them, and the fonts. Single-pane runs (under
// WIDE_FROM) also drive the tree, Back, a tap right after Back, the browser's back, Next and
// Previous, ticks, the comment box, Wrap, the file list and the ruling links; two-pane runs check
// the split view; the plain run checks that nothing hidden is displayed. Every run but the plain
// one also checks the rows of a diff (diff-layout): no sign column and no number column, the code
// starting within 16 px of the left edge, and each line's number on a faint layer behind the code,
// below it in stacking order, left aligned a small fixed distance from the left edge of the row,
// never taking a tap, and staying at the left edge of what is shown as the code scrolls.
//
// The page bridge is driven too, on the runs bridgeChecksFor names. /host.html is a stand-in for
// the viewer around a page (scripts/lib/page-bridge-stand-in.ts): it frames /index.html in a sandbox
// with an origin of its own, answers the page's messages the way the page bridge says a viewer must,
// and can be told to delay, drop, fail, rate-limit or conflict. The bridge checks tick files and
// reload (ticks come back), play a new version (the file whose diff changed starts unticked), wait for
// a viewer that never answers (Not saved after 1.5 seconds, and after 5 seconds for a write), meet a
// conflict, leave a comment (it shows at once and reaches the viewer as a line anchor) and let the
// viewer ask for lines to be shown. Their verdicts are in scripts/review-page-gate-bridge.ts.
//
// Screenshots and report.json go into --out (default: a new temporary folder).
//
// Playwright is not a dependency of this repository: it is found at run time, in this order.
//   1. PLAYWRIGHT_CORE, the folder of a playwright-core or playwright package, imported by path
//   2. a plain import of "playwright-core"
//   3. a plain import of "playwright"
// Chromium is CHROMIUM_PATH, else the newest Chromium in the Playwright cache
// (~/Library/Caches/ms-playwright on macOS, ~/.cache/ms-playwright on Linux), else Playwright's
// own default.
//
//   exit 0  every check passed on every run
//   exit 1  a check failed (the problems are printed), or the arguments or the folder are wrong
//   exit 2  Playwright or Chromium cannot be found, so nothing was checked
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { extname, isAbsolute, join, posix, relative, resolve } from "node:path";
import {
  createStandIn,
  type StandIn,
  type StandInOptions,
  standInPage,
} from "./lib/page-bridge-stand-in.ts";
import {
  bridgeTicksVerdict,
  commentVerdict,
  conflictVerdict,
  focusVerdict,
  newVersionOverrides,
  newVersionVerdict,
  type Note,
  notSavedVerdict,
  unansweredVerdict,
} from "./review-page-gate-bridge.ts";

export const USAGE = [
  "usage: review-page-gate.ts <page-dir> [--out <dir>] [--quick]",
  "  <page-dir>   a built review page: index.html, review.json and chunks/*.json",
  "  --out <dir>  where screenshots and report.json go (default: a new temporary folder)",
  "  --quick      390 light and dark, 1199 light, 1200 light and the plain run only",
].join("\n");

export type Env = Readonly<Record<string, string | undefined>>;

/** What a check found: whether the page is right, and one plain line saying so. */
export interface Verdict {
  ok: boolean;
  detail: string;
}

export interface Check extends Verdict {
  id: string;
}

export interface RunReport {
  name: string;
  width: number;
  /** Console errors and page errors of the run. */
  errors: string[];
  /** Failed requests of the run, each "<url> <reason>". */
  failed: string[];
  checks: Check[];
}

export interface GateReport {
  runs: RunReport[];
}

const pass = (detail: string): Verdict => ({ ok: true, detail });
const fail = (detail: string): Verdict => ({ ok: false, detail });

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// ASCII: widening to Unicode whitespace only folds more runs into one space, never splits a match.
const oneLine = (text: string): string => text.replace(/\s+/gu, " ").trim();

const WHY_NOT_CLICKED =
  /intercepts|not visible|not stable|not enabled|disabled|detached|outside of the viewport/iu;

/** An error as one short line: the first line of its message and, from a Playwright call log, why a click did not land. */
export function failure(e: unknown): string {
  const lines = errorMessage(e).split("\n");
  const why = lines.findLast((line) => WHY_NOT_CLICKED.test(line));
  // ASCII: the call log's bullets are plain spaces and a hyphen.
  const reason = why === undefined ? "" : ` (${why.replace(/^\s*-\s*/u, "")})`;
  return oneLine(`${lines[0] ?? ""}${reason}`).slice(0, 300);
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

// ---------- the publisher skeleton and the content types ----------

const SKELETON_HEAD =
  '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>';
const SKELETON_TAIL = "</body></html>";

/** The page file inside the skeleton the Artifact publisher puts around it. */
export function wrapSkeleton(html: string): string {
  return SKELETON_HEAD + html + SKELETON_TAIL;
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export function contentType(path: string): string {
  // LOWER: lowered for a lookup among ASCII extensions.
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
}

/** The file a request path names inside `root`, or null when it names none or leaves the folder. */
export function servedPath(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const full = resolve(root, `.${decoded.startsWith("/") ? decoded : `/${decoded}`}`);
  const rel = relative(root, full);
  return rel === "" || rel.startsWith("..") || isAbsolute(rel) ? null : full;
}

// ---------- the runs ----------

export interface Run {
  name: string;
  width: number;
  height: number;
  scheme: "light" | "dark";
  /** "/index.html" (wrapped) or "/plain.html" (bare). */
  url: string;
}

const PLAIN_URL = "/plain.html";
/**
 * The width from which the tree is a left pane with the file beside it. Below it the page shows one
 * screen at a time (Overview, Tree, Order, then the file with Back, previous and next). The
 * stylesheet (css/80-wide.css) and the navigation script (js/09-nav.js) hold the same number, and
 * a test compares the three.
 */
export const WIDE_FROM = 1200;

const isPlain = (run: Run): boolean => run.url === PLAIN_URL;

interface Size {
  label: string;
  width: number;
  height: number;
  /** The colour schemes this size is run in. */
  schemes: readonly Run["scheme"][];
}

/**
 * Every width the gate walks. The first six are the single-pane flow, from a phone through a
 * folded-out phone (755 to 904) and a tablet to the last pixel below the split; the last two are the
 * two-pane layout, from its first pixel and on a desktop window.
 */
const SIZES: readonly Size[] = [
  { label: "phone", width: 390, height: 844, schemes: ["light", "dark"] },
  { label: "w755", width: 755, height: 904, schemes: ["light"] },
  { label: "w823", width: 823, height: 1000, schemes: ["light", "dark"] },
  { label: "w904", width: 904, height: 755, schemes: ["light"] },
  { label: "w1024", width: 1024, height: 768, schemes: ["light"] },
  { label: "w1199", width: 1199, height: 800, schemes: ["light"] },
  { label: "w1200", width: 1200, height: 800, schemes: ["light"] },
  { label: "desk", width: 1440, height: 900, schemes: ["light", "dark"] },
];

/** The quick matrix: a phone in both themes and the two sides of the split. */
const QUICK_RUNS: readonly string[] = ["phone-light", "phone-dark", "w1199-light", "w1200-light"];

export function matrix(quick: boolean): Run[] {
  const sized = SIZES.flatMap((size) =>
    size.schemes.map(
      (scheme): Run => ({
        name: `${size.label}-${scheme}`,
        width: size.width,
        height: size.height,
        scheme,
        url: "/index.html",
      }),
    ),
  );
  const plain: Run = {
    name: "phone-plain",
    width: 390,
    height: 844,
    scheme: "light",
    url: PLAIN_URL,
  };
  return [...(quick ? sized.filter((run) => QUICK_RUNS.includes(run.name)) : sized), plain];
}

/** The browser context of a run: every width of the single-pane flow gets touch and the mobile viewport, a plain run never. */
export function contextOptions(run: Run) {
  const touch = run.width < WIDE_FROM && !isPlain(run);
  return {
    viewport: { width: run.width, height: run.height },
    deviceScaleFactor: 2,
    hasTouch: touch,
    isMobile: touch,
    colorScheme: run.scheme,
  };
}

/** The steps photographed in a single-pane run (any width under WIDE_FROM). */
const PHONE_SHOTS = [
  "overview",
  "tree",
  "tree-search",
  "file",
  "composer",
  "order",
  "find",
  "not-saved",
  "bridge-comment",
];
/** The steps photographed in a two-pane run. */
const WIDE_SHOTS = ["overview", "tree-with-file"];

/** The screenshots a run takes, by step name. */
export function screenshotSteps(run: Run): ReadonlySet<string> {
  if (isPlain(run)) return new Set(["overview"]);
  return new Set(run.width < WIDE_FROM ? PHONE_SHOTS : WIDE_SHOTS);
}

export const shotPath = (out: string, runName: string, step: string): string =>
  join(out, `${runName}-${step}.png`);

// ---------- judging a report ----------

const ALLOWED_HOSTS: readonly string[] = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdnjs.cloudflare.com",
];
const FONT_HOSTS: readonly string[] = ["fonts.googleapis.com", "fonts.gstatic.com"];

/** The host of a failed-request entry ("<url> <reason>") or of a bare URL. */
function hostOf(entry: string): string | null {
  try {
    // ASCII: an entry is a URL, a space and a status, and a parsed hostname is ASCII.
    return new URL(entry.trim().split(/\s+/u)[0] ?? "").hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True for the hosts whose failures are no fault of the page: the font hosts and the CDN. */
export function isAllowedHost(entry: string): boolean {
  const host = hostOf(entry);
  return host !== null && ALLOWED_HOSTS.includes(host);
}

/** The lines in first-seen order, a line that repeats once with its count. */
function counted(lines: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(line, (counts.get(line) ?? 0) + 1);
  return [...counts].map(([line, n]) => (n === 1 ? line : `${line} (x${n})`));
}

/** Every problem of a report as one plain line, "<run name>: <id>: <detail>". */
export function judge(report: GateReport): { ok: boolean; problems: string[] } {
  const problems = report.runs.flatMap((run) => [
    ...counted(run.errors.map((e) => `${run.name}: console: ${oneLine(e)}`)),
    ...counted(
      run.failed.filter((f) => !isAllowedHost(f)).map((f) => `${run.name}: request: ${oneLine(f)}`),
    ),
    ...run.checks.filter((c) => !c.ok).map((c) => `${run.name}: ${c.id}: ${oneLine(c.detail)}`),
  ]);
  return { ok: problems.length === 0, problems };
}

const LINE_CLIP = 400;
const clip = (line: string): string =>
  line.length > LINE_CLIP ? `${line.slice(0, LINE_CLIP)}...` : line;

/** One line per run with its passed checks, then the problems. */
export function shortReport(report: GateReport): string {
  const runs = report.runs.map(
    (r) => `${r.name}: ${r.checks.filter((c) => c.ok).length} of ${r.checks.length} checks passed`,
  );
  const { problems } = judge(report);
  const tail =
    problems.length === 0
      ? ["no problems"]
      : [
          `${plural(problems.length, "problem", "problems")}:`,
          ...problems.map((p) => `- ${clip(p)}`),
        ];
  return [...runs, ...tail].join("\n");
}

// ---------- finding Playwright and Chromium ----------

const FULL_MAC = [
  "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
  "chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium",
];
const FULL_OTHER = ["chrome-linux64/chrome", "chrome-linux/chrome"];
const SHELL_MAC = [
  "chrome-headless-shell-mac-arm64/chrome-headless-shell",
  "chrome-headless-shell-mac-x64/chrome-headless-shell",
];
const SHELL_OTHER = [
  "chrome-headless-shell-linux64/chrome-headless-shell",
  "chrome-linux/headless_shell",
];
const BROWSER_FOLDER = /^(chromium|chromium_headless_shell)-([0-9]+)$/u;

function cacheFolder(env: Env, platform: string, home: string): string {
  const custom = env["PLAYWRIGHT_BROWSERS_PATH"];
  if (custom !== undefined && custom !== "" && custom !== "0") return custom;
  return platform === "darwin"
    ? posix.join(home, "Library", "Caches", "ms-playwright")
    : posix.join(home, ".cache", "ms-playwright");
}

/**
 * CHROMIUM_PATH if set, else the executable of the newest Chromium in the Playwright cache (a full
 * Chromium before a headless shell of the same revision), else null. The disk is reached only
 * through `listDir` and `exists`.
 */
export function findChromium(
  env: Env,
  platform: string,
  home: string,
  listDir: (dir: string) => readonly string[],
  exists: (path: string) => boolean,
): string | null {
  const override = env["CHROMIUM_PATH"];
  if (override !== undefined && override !== "") return override;
  const cache = cacheFolder(env, platform, home);
  const mac = platform === "darwin";
  const folders = listDir(cache)
    .flatMap((name) => {
      const m = BROWSER_FOLDER.exec(name);
      return m ? [{ name, shell: m[1] === "chromium_headless_shell", revision: Number(m[2]) }] : [];
    })
    .sort((a, b) => b.revision - a.revision || Number(a.shell) - Number(b.shell));
  for (const folder of folders) {
    const executables = folder.shell
      ? mac
        ? SHELL_MAC
        : SHELL_OTHER
      : mac
        ? FULL_MAC
        : FULL_OTHER;
    for (const relativePath of executables) {
      const path = posix.join(cache, folder.name, relativePath);
      if (exists(path)) return path;
    }
  }
  return null;
}

function listDirSafe(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

/** findChromium over this machine's disk; undefined lets Playwright use its own default. */
export function chromiumPath(env: Env): string | undefined {
  return findChromium(env, process.platform, homedir(), listDirSafe, existsSync) ?? undefined;
}

/** The message printed when Playwright or Chromium cannot be found. */
export function describeMissing(env: Env): string {
  const state = (name: string): string => {
    const value = env[name];
    return value === undefined || value === "" ? "not set" : `set to ${value}`;
  };
  return [
    "review-page-gate: Playwright or Chromium could not be loaded, so nothing was checked.",
    "Playwright is found at run time; it is not a dependency of this repository. Set:",
    `  PLAYWRIGHT_CORE  the folder of a playwright-core or playwright package (${state("PLAYWRIGHT_CORE")})`,
    `  CHROMIUM_PATH    the path of a Chromium or Chrome executable (${state("CHROMIUM_PATH")})`,
    "Without CHROMIUM_PATH the newest Chromium in the Playwright cache is used, then Playwright's own default.",
  ].join("\n");
}

// ---------- the Playwright surface the gate uses ----------

export interface PwConsoleMessage {
  type(): string;
  text(): string;
  location(): { url: string };
}
export interface PwRequest {
  url(): string;
  failure(): { errorText: string } | null;
}
export interface PwResponse {
  url(): string;
  status(): number;
}
export interface PwLocator {
  nth(index: number): PwLocator;
  click(): Promise<void>;
}
/** A frame of a page: what the gate uses of the page inside the stand-in viewer. */
export interface PwFrame {
  url(): string;
  evaluate(expression: string): Promise<unknown>;
  waitForFunction(
    expression: string,
    arg: undefined,
    options: { timeout: number; polling: number },
  ): Promise<unknown>;
  click(selector: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  locator(selector: string): PwLocator;
}
export interface PwPage {
  frames(): PwFrame[];
  on(event: "console", listener: (message: PwConsoleMessage) => void): unknown;
  on(event: "pageerror", listener: (error: Error) => void): unknown;
  on(event: "requestfailed", listener: (request: PwRequest) => void): unknown;
  on(event: "response", listener: (response: PwResponse) => void): unknown;
  goto(url: string, options: { waitUntil: "load"; timeout: number }): Promise<unknown>;
  reload(options: { waitUntil: "load"; timeout: number }): Promise<unknown>;
  goBack(options: { waitUntil: "load"; timeout: number }): Promise<unknown>;
  evaluate(expression: string): Promise<unknown>;
  waitForFunction(
    expression: string,
    arg: undefined,
    options: { timeout: number; polling: number },
  ): Promise<unknown>;
  click(selector: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  locator(selector: string): PwLocator;
  screenshot(options: { path: string }): Promise<unknown>;
}
export interface PwContext {
  newPage(): Promise<PwPage>;
  addInitScript(script: string): Promise<void>;
  setDefaultTimeout(timeout: number): void;
  close(): Promise<void>;
}
export interface PwBrowser {
  newContext(options: ReturnType<typeof contextOptions>): Promise<PwContext>;
  close(): Promise<void>;
}
export interface Playwright {
  chromium: {
    launch(options: { headless: boolean; executablePath?: string }): Promise<PwBrowser>;
  };
}

/** A module as Playwright's `chromium`, taken from a named export or from `default`; else null. */
export function asPlaywright(mod: unknown): Playwright | null {
  const holders = isRecord(mod) ? [mod, mod["default"]] : [];
  for (const holder of holders) {
    if (!isRecord(holder)) continue;
    const chromium = holder["chromium"];
    if (isRecord(chromium) && typeof chromium["launch"] === "function") {
      return { chromium } as unknown as Playwright;
    }
  }
  return null;
}

/** Playwright from PLAYWRIGHT_CORE (by path), then "playwright-core", then "playwright"; else null. */
export async function loadPlaywright(env: Env): Promise<Playwright | null> {
  const core = env["PLAYWRIGHT_CORE"];
  const places = [
    ...(core === undefined || core === "" ? [] : [resolve(core)]),
    "playwright-core",
    "playwright",
  ];
  for (const place of places) {
    try {
      const found = asPlaywright(await import(place));
      if (found !== null) return found;
    } catch {
      // not there: try the next place
    }
  }
  return null;
}

/** Playwright loaded but no Chromium could be started. */
export class BrowserUnavailable extends Error {}

// ---------- reading review.json ----------

export interface ReviewFile extends Record<string, unknown> {
  path: string;
}

/** The parts of review.json the gate reads. */
export interface ReviewInfo {
  changedFiles: number;
  files: ReviewFile[];
  groups: Record<string, unknown>[];
  /** How many rulings review.json lists, or null where it has no such list. */
  rulings: number | null;
}

const isReviewFile = (x: unknown): x is ReviewFile => isRecord(x) && typeof x["path"] === "string";

export function readReview(
  text: string,
): { ok: true; review: ReviewInfo } | { ok: false; error: string } {
  const refuse = (why: string) => ({ ok: false as const, error: `review.json ${why}` });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return refuse(`is not valid JSON (${failure(e)})`);
  }
  if (!isRecord(data)) return refuse("is not an object");
  const { changedFiles, files, groups, rulings } = data;
  if (typeof changedFiles !== "number") return refuse("has no changedFiles number");
  if (!Array.isArray(files)) return refuse("has no files list");
  const bad = files.findIndex((f) => !isReviewFile(f));
  if (bad >= 0) return refuse(`file ${bad} has no path`);
  return {
    ok: true,
    review: {
      changedFiles,
      files: files as ReviewFile[],
      groups: Array.isArray(groups) ? groups.filter(isRecord) : [],
      rulings: Array.isArray(rulings) ? rulings.length : null,
    },
  };
}

// ---------- the command line ----------

export type ParsedArgs =
  | { ok: true; dir: string; out: string | undefined; quick: boolean }
  | { ok: false; error: string };

export function parseArgs(args: readonly string[]): ParsedArgs {
  let dir: string | undefined;
  let out: string | undefined;
  let quick = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    if (arg === "--quick") {
      quick = true;
    } else if (arg === "--out") {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--"))
        return { ok: false, error: "--out needs a folder" };
      out = value;
      i++;
    } else if (arg.startsWith("--")) {
      return { ok: false, error: `unknown option ${arg}` };
    } else if (dir !== undefined) {
      return { ok: false, error: `unexpected argument ${arg}` };
    } else {
      dir = arg;
    }
  }
  return dir === undefined
    ? { ok: false, error: "the page folder is missing" }
    : { ok: true, dir, out, quick };
}

// ---------- choosing what to search for ----------

const stemTokens = (path: string): string[] =>
  (path.split("/").pop() ?? path)
    .replace(/\.[^.]*$/u, "")
    // LOWER: lowered to cut a name into ASCII words; a letter that does not lower to ASCII ends a word.
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);

/**
 * A word taken from the name of one file: of the words that keep some files out, the one that
 * keeps most out (then the longest, then the first in order), preferring four letters or more.
 * Null when there are no files.
 */
export function pickSearchWord(review: ReviewInfo): string | null {
  // LOWER: lowered for a case-blind match of ASCII search words.
  const paths = review.files.map((f) => f.path.toLowerCase());
  const words = [...new Set(review.files.flatMap((f) => stemTokens(f.path)))].map((word) => ({
    word,
    n: paths.filter((p) => p.includes(word)).length,
  }));
  const selective = words.filter((w) => w.n < paths.length || paths.length < 2);
  const best = (list: typeof words): string | undefined =>
    [...list].sort(
      (a, b) => a.n - b.n || b.word.length - a.word.length || (a.word < b.word ? -1 : 1),
    )[0]?.word;
  return (
    best(selective.filter((w) => w.word.length >= 4)) ?? best(selective) ?? best(words) ?? null
  );
}

/** Everything the page's search can reach for a file: its own text and its group's, and the status words. */
function reachableText(review: ReviewInfo, file: ReviewFile): string {
  const index = file["group"];
  const group = typeof index === "number" ? review.groups[index] : undefined;
  const strings = [...Object.values(file), ...Object.values(group ?? {})].filter(
    (v): v is string => typeof v === "string",
  );
  // LOWER: lowered for the same case-blind match.
  return [...strings, "new", "deleted", "renamed", "read closely"].join(" ").toLowerCase();
}

/**
 * The files shown for a search word must include every file whose path holds the word and stay
 * within the files whose text the word can reach (the page also searches purposes and group names).
 */
export function searchVerdict(review: ReviewInfo, word: string, shown: readonly number[]): Verdict {
  // ASCII: the word came from pickSearchWord, which builds it from ASCII letters and digits.
  const words = word.toLowerCase().split(/\s+/u).filter(Boolean);
  const holds = (text: string): boolean => words.every((w) => text.includes(w));
  const indexes = review.files.map((_f, fi) => fi);
  // LOWER: lowered for the same case-blind match.
  const must = indexes.filter((fi) => holds((review.files[fi]?.path ?? "").toLowerCase()));
  const may = indexes.filter((fi) => holds(reachableText(review, review.files[fi] as ReviewFile)));
  const named = (list: readonly number[]): string =>
    list
      .slice(0, 4)
      .map((fi) => review.files[fi]?.path ?? `#${fi}`)
      .join(", ");
  if (shown.length === 0)
    return fail(`no rows for "${word}" (${must.length} files hold it in their path)`);
  const missing = must.filter((fi) => !shown.includes(fi));
  if (missing.length > 0)
    return fail(`"${word}" hides ${missing.length} matching: ${named(missing)}`);
  const strangers = shown.filter((fi) => !may.includes(fi));
  if (strangers.length > 0) {
    return fail(`"${word}" shows ${strangers.length} that do not match: ${named(strangers)}`);
  }
  return pass(`${shown.length} of ${review.files.length} rows for "${word}"`);
}

/** The tree search: the right rows while the word is typed, and the original rows once it is cleared. */
export function treeSearchVerdict(
  review: ReviewInfo,
  word: string,
  shown: readonly number[],
  before: number,
  after: number,
): Verdict {
  const found = searchVerdict(review, word, shown);
  if (!found.ok) return found;
  return after === before
    ? pass(`${found.detail}; the original ${before} rows return when it is cleared`)
    : fail(
        `${found.detail}, but after clearing the box ${after} rows show, not the original ${before}`,
      );
}

/** The first index whose name differs from the next one's, or -1. */
export function firstDistinctPair(names: readonly string[]): number {
  return names.findIndex((name, i) => i + 1 < names.length && name !== names[i + 1]);
}

/** One file's diff as the page's data chunks hold it: the file's index and its unified diff. */
export interface DiffItem {
  i: number;
  diff: string;
}

const isDiffItem = (x: unknown): x is DiffItem =>
  isRecord(x) && typeof x["i"] === "number" && typeof x["diff"] === "string";

/** The lines of a diff that the page draws as code: everything after the first hunk header, bar the headers. */
function codeLines(diff: string): string[] {
  const lines = diff.split("\n");
  const first = lines.findIndex((line) => line.startsWith("@@"));
  return first < 0 ? [] : lines.slice(first).filter((line) => /^[ +-]/u.test(line));
}

/** The index of the file with the longest code line (the lowest index on a tie), or null when no file has code. */
export function widestFile(items: readonly DiffItem[]): number | null {
  const widest = items
    .map((item) => ({
      i: item.i,
      width: codeLines(item.diff).reduce((most, line) => Math.max(most, line.length - 1), 0),
    }))
    .filter((w) => w.width > 0)
    .sort((a, b) => b.width - a.width || a.i - b.i)[0];
  return widest === undefined ? null : widest.i;
}

// ---------- the audits of every screen ----------

export interface ScreenAudit {
  screen: string;
  scrollWidth: number;
  bodyScrollWidth: number;
  innerWidth: number;
  /** Visible targets under 44 px high or wide. */
  small: readonly { el: string; w: number; h: number; text: string }[];
  /** Visible text under 13 px, by element and size, with how many text nodes. */
  tiny: Readonly<Record<string, number>>;
  /** Visible controls that stick out of the window or of a box that clips them, by how many pixels. */
  clipped: readonly { el: string; cut: number; text: string }[];
  /** Elements with the hidden attribute that are displayed anyway. */
  hiddenShown: readonly string[];
}

const LISTED = 5;

/** The audits of the screens a run visited as checks: overflow, tap-targets, text-size, clipped-controls, and in the plain run hidden-attr. */
export function auditChecks(audits: readonly ScreenAudit[], plain: boolean): Check[] {
  const names = audits.map((a) => a.screen).join(", ");
  const summarize = (id: string, problems: readonly string[], good: string): Check => {
    if (audits.length === 0) return { id, ...fail("no screen was audited") };
    return { id, ...(problems.length === 0 ? pass(good) : fail(problems.join("; "))) };
  };
  const overflow = audits
    .filter((a) => a.scrollWidth > a.innerWidth || a.bodyScrollWidth > a.innerWidth)
    .map(
      (a) =>
        `${a.screen}: the page is ${Math.max(a.scrollWidth, a.bodyScrollWidth)}px wide in a ${a.innerWidth}px window`,
    );
  const taps = audits
    .filter((a) => a.small.length > 0)
    .map(
      (a) =>
        `${a.screen}: ${a.small.length} under 44px: ${a.small
          .slice(0, LISTED)
          .map((s) => `${s.el} ${s.w}x${s.h}${s.text === "" ? "" : ` "${s.text}"`}`)
          .join(", ")}`,
    );
  const text = audits
    .filter((a) => Object.keys(a.tiny).length > 0)
    .map(
      (a) =>
        `${a.screen}: ${Object.entries(a.tiny)
          .slice(0, LISTED)
          .map(([key, n]) => `${key} x${n}`)
          .join(", ")}`,
    );
  const cut = audits
    .filter((a) => a.clipped.length > 0)
    .map(
      (a) =>
        `${a.screen}: ${a.clipped.length} cut off: ${a.clipped
          .slice(0, LISTED)
          .map((c) => `${c.el} ${c.cut}px${c.text === "" ? "" : ` "${c.text}"`}`)
          .join(", ")}`,
    );
  const checks = [
    summarize("overflow", overflow, `${names} fit the width`),
    summarize("tap-targets", taps, `${names} have no target under 44px`),
    summarize("text-size", text, `${names} have no text under 13px`),
    summarize("clipped-controls", cut, `${names} have no control cut off`),
  ];
  if (!plain) return checks;
  const hidden = audits
    .filter((a) => a.hiddenShown.length > 0)
    .map((a) => `${a.screen}: ${a.hiddenShown.slice(0, LISTED).join(", ")}`);
  return [
    ...checks,
    summarize("hidden-attr", hidden, `${names}: every hidden element is not displayed`),
  ];
}

const FONTS_NEEDED = ["Red Hat Text", "Red Hat Mono"];

/** Both Red Hat faces loaded; an unreachable font host says nothing about the page. */
export function fontsVerdict(loaded: readonly string[], failed: readonly string[]): Verdict {
  const missing = FONTS_NEEDED.filter((f) => !loaded.includes(f));
  if (missing.length === 0) return pass(`${FONTS_NEEDED.join(" and ")} loaded`);
  const unreachable = failed.some((entry) => FONT_HOSTS.includes(hostOf(entry) ?? ""));
  if (unreachable)
    return pass(`skipped: the font host could not be reached (${missing.join(", ")} not loaded)`);
  const seen = [...new Set(loaded)];
  return fail(`not loaded: ${missing.join(", ")}; loaded: ${seen.join(", ") || "none"}`);
}

// ---------- verdicts on the facts the page gives ----------

export interface ScreenFacts {
  overview: boolean;
  tree: boolean;
  order: boolean;
  file: boolean;
  /** #app's data-screen and data-tab. */
  screen: string | null;
  tab: string | null;
}

/** Under WIDE_FROM exactly one screen is shown, and #app says which. */
export function treeVisibleVerdict(f: ScreenFacts): Verdict {
  const shown = (["overview", "tree", "order", "file"] as const).filter((name) => f[name]);
  const ok = shown.length === 1 && shown[0] === "tree" && f.screen === "tree" && f.tab === "tree";
  return ok
    ? pass("only the tree screen is shown")
    : fail(`shown: ${shown.join(", ") || "none"}; data-screen=${f.screen}, data-tab=${f.tab}`);
}

export interface EdgeFacts {
  left: number;
  right: number;
  innerWidth: number;
  /** Rows that run outside the window. */
  outside: number;
}

const ONE_PIXEL = 1;

export function edgeVerdict(f: EdgeFacts): Verdict {
  const ok =
    Math.abs(f.left) <= ONE_PIXEL &&
    Math.abs(f.right - f.innerWidth) <= ONE_PIXEL &&
    f.outside === 0;
  const span = `the list runs from ${Math.round(f.left)} to ${Math.round(f.right)} in a ${f.innerWidth}px window`;
  return ok
    ? pass(span)
    : fail(f.outside > 0 ? `${span}; ${plural(f.outside, "row", "rows")} outside it` : span);
}

export interface RowsFacts {
  dirs: number;
  files: number;
  /** Folders without a file count, files without a badge or a tick, by name. */
  noCount: string[];
  noBadge: string[];
  /** Folder rows that stand for a chain of folders. */
  compacted: number;
}

export function rowsVerdict(f: RowsFacts): Verdict {
  if (f.dirs + f.files === 0) return fail("the tree has no rows");
  const problems = [
    ...(f.noCount.length > 0 ? [`no file count on ${f.noCount.slice(0, LISTED).join(", ")}`] : []),
    ...(f.noBadge.length > 0
      ? [`no badge or tick on ${f.noBadge.slice(0, LISTED).join(", ")}`]
      : []),
  ];
  return problems.length > 0
    ? fail(problems.join("; "))
    : pass(
        `${plural(f.dirs, "folder", "folders")}, ${plural(f.files, "file", "files")}, ${f.compacted} compacted`,
      );
}

/** Collapse keeps only files that sit at the root; expand shows every changed file. */
export function expandVerdict(
  collapsed: number,
  expanded: number,
  rootFiles: number,
  changed: number,
): Verdict {
  const ok = collapsed === rootFiles && expanded === changed;
  return ok
    ? pass(`collapse left ${collapsed} root file rows, expand shows all ${changed} files`)
    : fail(
        `after collapse ${collapsed} file rows (${rootFiles} expected), after expand ${expanded} (${changed} expected)`,
      );
}

export interface FileFacts {
  screen: string | null;
  tab: string | null;
  fileShown: boolean;
  treeShown: boolean;
  /** Diff rows in #file-code. */
  rows: number;
  /** The first note in #file-code that is not "Loading", or "". */
  status: string;
  fname: string | null;
}

/** A file opened from the tree under WIDE_FROM: the file screen alone, its content or a note, its name. */
export function openFileVerdict(f: FileFacts, expectedName: string): Verdict {
  const notLoaded = /did not load/iu.test(f.status);
  const content = f.rows > 0 || (f.status !== "" && !notLoaded);
  const problems = [
    ...(f.fileShown && !f.treeShown ? [] : ["the file screen is not alone on screen"]),
    ...(f.screen === "file" && f.tab === "tree"
      ? []
      : [`data-screen=${f.screen}, data-tab=${f.tab}`]),
    ...(content ? [] : [f.status === "" ? "no diff rows and no note" : f.status]),
    ...(f.fname === expectedName ? [] : [`the file bar names ${f.fname}, not ${expectedName}`]),
  ];
  return problems.length === 0
    ? pass(`${expectedName}: ${f.rows > 0 ? plural(f.rows, "row", "rows") : f.status}`)
    : fail(problems.join("; "));
}

/** A file tapped right after Back is the file on screen once the page's own fallback for Back has run. */
export function openAfterBackVerdict(f: FileFacts, expectedName: string): Verdict {
  const opened = openFileVerdict(f, expectedName);
  return opened.ok
    ? pass(`${expectedName} stayed open after a tap right after Back`)
    : fail(`a tap right after Back did not leave the file open: ${opened.detail}`);
}

export interface Leave {
  y: number;
  open: string[];
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x) => b.includes(x));

const SCROLL_SLACK = 2;

/** Back returns to the tree with the same open folders and the scroll where it was. */
export function backVerdict(
  left: Leave,
  after: { y: number; open: string[]; treeShown: boolean; screen: string | null },
): Verdict {
  const problems = [
    ...(after.treeShown && after.screen === "tree" ? [] : ["the tree is not on screen"]),
    ...(sameSet(left.open, after.open)
      ? []
      : [`open folders changed from ${left.open.length} to ${after.open.length}`]),
    ...(Math.abs(after.y - left.y) <= SCROLL_SLACK
      ? []
      : [`scroll is ${Math.round(after.y)}px, was ${Math.round(left.y)}px`]),
  ];
  if (problems.length > 0) return fail(problems.join("; "));
  const scrolled =
    left.y > 0 ? `scroll ${Math.round(left.y)}px restored` : "the page did not scroll (too short)";
  return pass(`${plural(left.open.length, "folder", "folders")} open, ${scrolled}`);
}

/** The browser's back returns to the tree with the same open folders. */
export function historyVerdict(
  before: readonly string[],
  after: { open: string[]; treeShown: boolean },
): Verdict {
  if (!after.treeShown) return fail("the tree is not on screen");
  return sameSet(before, after.open)
    ? pass(`${plural(before.length, "folder", "folders")} still open`)
    : fail(`open folders changed from ${before.length} to ${after.open.length}`);
}

/** Next shows the next file in tree order, Previous the first again. */
export function navVerdict(
  first: string,
  second: string,
  afterNext: string | null,
  afterPrev: string | null,
): Verdict {
  const ok = afterNext === second && afterPrev === first;
  return ok
    ? pass(`${first}, next ${second}, back to ${first}`)
    : fail(
        `expected ${second} after Next and ${first} after Previous, got ${afterNext} and ${afterPrev}`,
      );
}

export interface TickFacts {
  before: number;
  ticked: { checked: string | null; n: number };
  reloaded: { checked: string | null; n: number };
}

export function tickVerdict(f: TickFacts): Verdict {
  const problems = [
    ...(f.ticked.checked === "true" ? [] : [`aria-checked is ${f.ticked.checked} after the tap`]),
    ...(f.ticked.n === f.before + 1 ? [] : [`the count went from ${f.before} to ${f.ticked.n}`]),
    ...(f.reloaded.checked === "true" && f.reloaded.n === f.before + 1
      ? []
      : [`after a reload aria-checked is ${f.reloaded.checked} and the count ${f.reloaded.n}`]),
  ];
  return problems.length === 0
    ? pass(`ticked, ${f.ticked.n} reviewed, still ticked after a reload`)
    : fail(problems.join("; "));
}

export interface ComposerFacts {
  shown: boolean;
  inside: boolean;
}

export function composerVerdict(f: ComposerFacts): Verdict {
  if (!f.shown) return fail("the comment box did not open");
  return f.inside
    ? pass("the comment box opened inside the code")
    : fail("the comment box is not inside the code");
}

export interface BoxFacts {
  boxScrolls: boolean;
  overflowX: string;
  scrollLeft: number;
  pageScrollWidth: number;
  innerWidth: number;
}

/** The page stays still while a wide code box scrolls by itself. */
export function sidewaysVerdict(f: BoxFacts): Verdict {
  if (f.pageScrollWidth > f.innerWidth) {
    return fail(`the page is ${f.pageScrollWidth}px wide in a ${f.innerWidth}px window`);
  }
  if (!f.boxScrolls) return pass("the code fits its box and the page does not scroll sideways");
  if (f.overflowX !== "auto" && f.overflowX !== "scroll") {
    return fail(`the code is wider than its box and overflow-x is ${f.overflowX}`);
  }
  return f.scrollLeft > 0
    ? pass(`the code box scrolls by itself (${Math.round(f.scrollLeft)}px), the page does not`)
    : fail("the code is wider than its box but the box did not scroll");
}

/** The Wrap button and the code rows at one moment. */
export interface WrapState {
  /** The button's aria-pressed. */
  pressed: string | null;
  /** The rows carry the class that wraps long lines. */
  wrapped: boolean;
  /** The code box is wider inside than it is on screen, so it scrolls sideways. */
  boxScrolls: boolean;
  pageScrollWidth: number;
  innerWidth: number;
}

/**
 * Wrap flips the lines with each tap and the second tap puts them back; lines that are wrapped fit
 * their box; the page is never wider than the window, wrapped or not. Which of the two states the
 * page starts in is its own choice.
 */
export function wrapVerdict(first: WrapState, tapped: WrapState, again: WrapState): Verdict {
  const states = [first, tapped, again];
  const problems = [
    ...(tapped.wrapped !== first.wrapped && tapped.pressed !== first.pressed
      ? []
      : ["a tap on Wrap did not change the lines and the button together"]),
    ...(again.wrapped === first.wrapped && again.pressed === first.pressed
      ? []
      : ["a second tap on Wrap did not bring the first state back"]),
    ...(states.every((s) => s.pressed === String(s.wrapped))
      ? []
      : ["the button says one thing and the lines show another"]),
    ...(states.some((s) => s.wrapped && s.boxScrolls)
      ? ["wrapped lines still scroll sideways in their box"]
      : []),
    ...states
      .filter((s) => s.pageScrollWidth > s.innerWidth)
      .slice(0, 1)
      .map((s) => `the page is ${s.pageScrollWidth}px wide in a ${s.innerWidth}px window`),
  ];
  return problems.length === 0
    ? pass(
        `Wrap flips the lines and back, wrapped lines fit their box, the page stays ${first.innerWidth}px wide`,
      )
    : fail(problems.join("; "));
}

/** The file list opens, narrows to the matches, and closes. */
export function findVerdict(
  review: ReviewInfo,
  word: string,
  f: { opened: boolean; fis: readonly number[]; closedHidden: boolean },
): Verdict {
  if (!f.opened) return fail("the file list did not open");
  const found = searchVerdict(review, word, f.fis);
  if (!found.ok) return found;
  return f.closedHidden
    ? pass(`${found.detail}; Close hides it`)
    : fail(`${found.detail}, but Close did not hide the list`);
}

/** A ruling link opens the file with its lines flagged; with no rulings there is nothing to follow. */
export function rulingVerdict(
  f: { expected: number | null; cards: number; links: number },
  after: { fileShown: boolean; flagged: number } | null,
): Verdict {
  if (f.cards === 0 && (f.expected ?? 0) === 0) return pass("no rulings");
  if (f.cards === 0)
    return fail(`review.json lists ${f.expected} rulings but the overview shows none`);
  if (f.links === 0) return pass(`${f.cards} rulings shown, none with a link to follow`);
  if (after === null) return fail("the first ruling link was not followed");
  return after.fileShown && after.flagged > 0
    ? pass(
        `the first of ${f.links} links opened a file with ${plural(after.flagged, "flagged line", "flagged lines")}`,
      )
    : fail(
        `the first ruling link left the file shown: ${after.fileShown}, flagged lines: ${after.flagged}`,
      );
}

export interface SplitFacts {
  treeShown: boolean;
  fileShown: boolean;
  treeRight: number;
  fileLeft: number;
  /** Diff rows once a file is opened. */
  rows: number;
  treeStillShown: boolean;
  backShown: boolean;
}

/** From WIDE_FROM (1200 px) the tree is a left pane with the file beside it, and Back is gone. */
export function splitVerdict(f: SplitFacts): Verdict {
  const problems = [
    ...(f.treeShown && f.fileShown ? [] : ["the tree and the file are not both on screen"]),
    ...(f.treeRight <= f.fileLeft + ONE_PIXEL
      ? []
      : [
          `the tree ends at ${Math.round(f.treeRight)}px, the file starts at ${Math.round(f.fileLeft)}px`,
        ]),
    ...(f.rows > 0 ? [] : ["opening a file showed no diff rows"]),
    ...(f.treeStillShown ? [] : ["the tree went away when a file opened"]),
    ...(f.backShown ? ["the back button is displayed"] : []),
  ];
  return problems.length === 0
    ? pass(`tree at the left (to ${Math.round(f.treeRight)}px), file beside it, no back button`)
    : fail(problems.join("; "));
}

// ---------- the rows of a diff ----------

/** How far the code of a diff may start from the left edge of its window, in pixels. */
export const MAX_CODE_OFFSET = 16;
/** The alpha of the line number behind the code: seen, and never as loud as the code over it. */
export const NUMBER_ALPHA_MIN = 0.15;
export const NUMBER_ALPHA_MAX = 0.5;
/**
 * How far in from the left edge of its row the left edge of a line number is, in pixels: clear of
 * the 3 px edge in a stronger colour that added and removed rows have, and nearer the edge than
 * the code starts.
 */
export const NUMBER_INSET = 6;
/** How far the left edge of a number may be from NUMBER_INSET, in pixels. */
const INSET_SLACK = 2;
/** How far the middle of a number may be from the middle of its row, down the page, in pixels. */
const CENTRE_SLACK = 2;

/** One diff row as the page draws it, measured at the moment the box is at its scroll position. */
export interface DiffRowFacts {
  /** The line the row stands for (its data-line). */
  line: string;
  /** The class of each child of the row, in order: n is a line number, c the code, anything else a column. */
  parts: readonly string[];
  /** The text of the number that is shown, or null when the row shows none. */
  numberText: string | null;
  /** Pixels between the left edge of the row and the left edge of its code column: what sits in front of the code. */
  gutter: number;
  /** Where the code starts: the left edge of the code column's content, in window pixels. */
  codeLeft: number;
  /** The z-index of the number and of the code ("auto" when none is set). */
  numberZ: string;
  codeZ: string;
  /** The number's pointer-events and text-align. */
  numberEvents: string;
  numberAlign: string;
  /** The alpha of the number's colour, 1 when it is opaque. */
  numberAlpha: number;
  /** The left edge of the number's text, in window pixels. */
  numberLeft: number;
  /** The middle of the number's text, down the page. */
  numberY: number;
  /** The middle of the row, down the page. */
  rowY: number;
  /** What a tap on the middle of the number reaches: the number itself, the row (or what is in it), something else, or nothing on screen. */
  tap: "number" | "row" | "other" | "none";
}

/** The code box, and the rows looked at in it, at one scroll position. */
export interface DiffLayoutFacts {
  box: { left: number; width: number; scrollLeft: number; scrolls: boolean };
  rows: readonly DiffRowFacts[];
}

/** The z-index as a number: no z-index set sits level with 0. */
const stackLevel = (z: string): number => (z === "auto" ? 0 : Number(z));

const px = (n: number): string => `${Math.round(n * 10) / 10}px`;

/** How far in from the left edge of its box the left edge of a row's number is. */
const insetOf = (r: DiffRowFacts, boxLeft: number): number => r.numberLeft - boxLeft;

/** The row whose number starts farthest from NUMBER_INSET, or undefined when every number is in place. */
function strayedNumber(rows: readonly DiffRowFacts[], boxLeft: number): DiffRowFacts | undefined {
  const off = (r: DiffRowFacts): number => Math.abs(insetOf(r, boxLeft) - NUMBER_INSET);
  const worst = rows.reduce<DiffRowFacts | undefined>(
    (a, r) => (a === undefined || off(r) > off(a) ? r : a),
    undefined,
  );
  return worst !== undefined && off(worst) > INSET_SLACK ? worst : undefined;
}

/** After a sideways scroll of the box: it moved, and every number is still at the left edge of what is shown. */
function scrollProblems(scrolled: DiffLayoutFacts): string[] {
  if (scrolled.box.scrollLeft <= 0) return ["the box did not scroll sideways when it was asked to"];
  const strayed = strayedNumber(scrolled.rows, scrolled.box.left);
  return strayed === undefined
    ? []
    : [
        `after the box scrolled sideways by ${Math.round(scrolled.box.scrollLeft)}px a number starts ${px(insetOf(strayed, scrolled.box.left))} from the left edge of the box, not ${NUMBER_INSET}px`,
      ];
}

/**
 * The rows of a diff are the code and nothing in front of it: no sign column, no number column. The
 * number of each line sits on a faint layer behind the code (below it in stacking order, left
 * aligned NUMBER_INSET px in from the left edge of the row and centered down the row, never taking
 * a tap), and the code starts within MAX_CODE_OFFSET of the left edge of the window (of its own
 * box, when a tree pane sits beside it). The left edge of a row is the left edge of the box.
 * `scrolled` is the same measurement after the box was scrolled sideways, or null when the box
 * does not scroll: the number stays NUMBER_INSET px in from the left edge of what is shown.
 */
export function diffLayoutVerdict(
  at: DiffLayoutFacts,
  scrolled: DiffLayoutFacts | null,
  windowEdge: boolean,
): Verdict {
  const { rows, box } = at;
  const first = rows[0];
  if (first === undefined) return fail("no diff rows to check");
  const of = (n: number): string => `${n} of ${plural(rows.length, "row", "rows")}`;
  const biggest = (read: (r: DiffRowFacts) => number): number => Math.max(...rows.map(read));
  const offset = (r: DiffRowFacts): number => r.codeLeft - (windowEdge ? 0 : box.left);
  const signs = rows.filter((r) => r.parts.includes("sg")).length;
  const misshapen = rows.filter((r) => r.parts.join(" ") !== "n c");
  const wrongText = rows.filter((r) => r.numberText !== r.line);
  const level = rows.find((r) => stackLevel(r.numberZ) >= stackLevel(r.codeZ));
  const events = rows.find((r) => r.numberEvents !== "none");
  // "start" is the left in a page written left to right, which this page is.
  const align = rows.find((r) => r.numberAlign !== "left" && r.numberAlign !== "start");
  const taking = rows.filter((r) => r.tap === "number").length;
  const strong = rows.find((r) => r.numberAlpha > NUMBER_ALPHA_MAX);
  const faint = rows.find((r) => r.numberAlpha < NUMBER_ALPHA_MIN);
  const strayed = strayedNumber(rows, box.left);
  const down = biggest((r) => Math.abs(r.numberY - r.rowY));
  const gutter = biggest((r) => r.gutter);
  const problems = [
    ...(signs > 0 ? [`${of(signs)} hold a sign column (sg) in front of the code`] : []),
    ...(misshapen[0] === undefined
      ? []
      : [
          `${of(misshapen.length)} are not one number layer and the code column alone (found: ${misshapen[0].parts.join(" ") || "nothing"})`,
        ]),
    ...(gutter > ONE_PIXEL
      ? [`the code starts ${px(gutter)} into its row, behind a column in front of it`]
      : []),
    ...(biggest(offset) > MAX_CODE_OFFSET
      ? [`the code starts ${px(biggest(offset))} from the left edge, at most ${MAX_CODE_OFFSET}px`]
      : []),
    ...(wrongText[0] === undefined
      ? []
      : [
          `${of(wrongText.length)} show a number that is not the row's line (line ${wrongText[0].line} shows ${wrongText[0].numberText ?? "none"})`,
        ]),
    ...(level === undefined
      ? []
      : [
          `the number is not below the code in stacking order (z-index ${level.numberZ} against ${level.codeZ})`,
        ]),
    ...(events === undefined
      ? []
      : [`the number takes taps (pointer-events ${events.numberEvents})`]),
    ...(taking > 0 ? [`a tap on the middle of the number lands on it in ${of(taking)}`] : []),
    ...(align === undefined ? [] : [`the number is text-align ${align.numberAlign}, not left`]),
    ...(strayed === undefined
      ? []
      : [
          `the number starts ${px(insetOf(strayed, box.left))} from the left edge of its row, not ${NUMBER_INSET}px`,
        ]),
    ...(down > CENTRE_SLACK ? [`the number is ${px(down)} off the middle of its row`] : []),
    ...(strong === undefined
      ? []
      : [`the number is too strong (alpha ${strong.numberAlpha}, at most ${NUMBER_ALPHA_MAX})`]),
    ...(faint === undefined
      ? []
      : [`the number is too faint (alpha ${faint.numberAlpha}, at least ${NUMBER_ALPHA_MIN})`]),
    ...(scrolled === null ? [] : scrollProblems(scrolled)),
  ];
  const pinned = scrolled === null ? "" : ", pinned while the box scrolls sideways";
  return problems.length === 0
    ? pass(
        `${plural(rows.length, "row", "rows")}: no sign or number column, code from ${px(biggest(offset))}, numbers left aligned ${NUMBER_INSET}px in on a layer behind it at alpha ${first.numberAlpha}${pinned}`,
      )
    : fail(problems.join("; "));
}

// ---------- the page server ----------

export interface PageServer {
  origin: string;
  stop(): void;
  /** Text served in place of a file, by request path: the data of a page made to look like a new version. */
  overrides: Map<string, string>;
  /** Applied last to the text of the page (before it is wrapped) and of the data files, to put a fault in. */
  setRewrite(rewrite: ((pathname: string, text: string) => string) | null): void;
}

const NO_STORE = { "cache-control": "no-store" };
/** A page in a sandbox with no origin of its own reads its data files only if they say any origin may. */
const ANY_ORIGIN = { "access-control-allow-origin": "*" };
/** The stand-in viewer around the page, and the path where its page posts what the page sent. */
export const VIEWER_URL = "/host.html";
const MESSAGE_URL = "/__stand-in/message";

function readText(path: string): string | null {
  try {
    return statSync(path).isFile() ? readFileSync(path, "utf8") : null;
  } catch {
    return null;
  }
}

function readBytes(path: string): Uint8Array | null {
  try {
    return statSync(path).isFile() ? readFileSync(path) : null;
  } catch {
    return null;
  }
}

/**
 * Serve `dir` on loopback: /index.html wrapped, /plain.html bare, anything else as the file it names.
 * With a stand-in viewer, /host.html is the viewer page that frames /index.html, and a POST to
 * /__stand-in/message is answered by the stand-in.
 */
export function startServer(dir: string, standIn?: StandIn): PageServer {
  const root = resolve(dir);
  const overrides = new Map<string, string>();
  let rewrite: ((pathname: string, text: string) => string) | null = null;
  const text = (pathname: string, built: string | null): string | null => {
    const base = overrides.get(pathname) ?? built;
    return base === null || rewrite === null ? base : rewrite(pathname, base);
  };
  const reply = (body: string, type: string, status = 200): Response =>
    new Response(body, { status, headers: { "content-type": type, ...NO_STORE, ...ANY_ORIGIN } });
  const html = (body: string): Response => reply(body, contentType("index.html"));
  const missing = (): Response => reply("not found", "text/plain", 404);
  const message = async (req: ServeRequest): Promise<Response> => {
    if (standIn === undefined) return missing();
    if (req.method !== "POST") return reply("use POST", "text/plain", 405);
    try {
      return reply(
        JSON.stringify(standIn.receive(JSON.parse(await req.text()))),
        "application/json",
      );
    } catch {
      return reply("not JSON", "text/plain", 400);
    }
  };
  const handler = (req: ServeRequest): Response | Promise<Response> => {
    const pathname = new URL(req.url).pathname;
    if (pathname === "/favicon.ico") return new Response(null, { status: 204 });
    if (pathname === MESSAGE_URL) return message(req);
    if (pathname === VIEWER_URL)
      return standIn === undefined ? missing() : html(standInPage("/index.html"));
    const wrapped = pathname === "/" || pathname === "/index.html";
    if (wrapped || pathname === PLAIN_URL) {
      const page = text("/index.html", readText(join(root, "index.html")));
      if (page === null) return missing();
      return html(wrapped ? wrapSkeleton(page) : page);
    }
    const file = servedPath(root, pathname);
    const replaced = text(
      pathname,
      file === null || !pathname.endsWith(".json") ? null : readText(file),
    );
    if (replaced !== null) return reply(replaced, contentType(pathname));
    const bytes = file === null ? null : readBytes(file);
    if (file === null || bytes === null) return missing();
    return new Response(bytes, {
      headers: { "content-type": contentType(file), ...NO_STORE, ...ANY_ORIGIN },
    });
  };
  // Bun.serve's declared options have no hostname, so the options are built first.
  const options = { hostname: "127.0.0.1", port: 0, fetch: handler };
  const server = Bun.serve(options);
  return {
    origin: `http://127.0.0.1:${server.port}`,
    stop: () => server.stop(true),
    overrides,
    setRewrite: (fn) => {
      rewrite = fn;
    },
  };
}

// ---------- the helpers that run inside the page ----------

/** Names of the functions on window.__gate; the calls below are checked against this list. */
export const GATE_FUNCTIONS = [
  "screens",
  "header",
  "audit",
  "fonts",
  "edges",
  "rows",
  "tree",
  "collapsed",
  "fileFacts",
  "fileReady",
  "box",
  "composer",
  "progress",
  "tick",
  "unticked",
  "find",
  "rulings",
  "flagged",
  "arm",
  "left",
  "scrollTo",
  "visibleFile",
  "panes",
  "wrapState",
  "boxSized",
  "diffLayout",
  "saveNotes",
  "tickedFiles",
  "threads",
  "flaggedLines",
  "rowsOf",
  "openPath",
] as const;

type GateFunction = (typeof GATE_FUNCTIONS)[number];

/**
 * Plain JavaScript, injected into every page before its own scripts run. Each function gathers
 * facts about the page and decides nothing; the verdicts are made above, where they are tested.
 * No backticks and no dollar-brace here: the text sits in a template literal.
 */
export const KIT = String.raw`
window.__gate = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const all = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const shown = (e) => {
    if (!e) return false;
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  // LOWER: tag names are ASCII.
  const label = (e) => e.tagName.toLowerCase()
    + (e.id ? "#" + e.id : "")
    + (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/[ \t\n\r\f]+/u).join(".") : "");
  const text = (sel) => { const e = $(sel); return e ? e.textContent.trim() : null; };
  const attr = (sel, name) => { const e = $(sel); return e ? e.getAttribute(name) : null; };
  const count = (sel, root) => all(sel, root).length;
  const number = (sel) => Number((text(sel) || "").replace(/[^0-9]/gu, "")) || 0;
  // The width the page must fit. In mobile emulation innerWidth grows with an over-wide page, so
  // the narrower of it and the root's client width is the viewport.
  const vw = () => Math.min(innerWidth, document.documentElement.clientWidth);
  const rowName = (li) => { const n = $(".tname", li); return n ? n.textContent.trim() : label(li); };
  const openIds = () => all('#tree li.trow.dir[aria-expanded="true"]').map((li) => li.dataset.id);
  const TARGETS = "button, a[href], input, select, summary, textarea, [role=checkbox], [role=tab]";

  const screens = () => ({
    overview: shown($("#screen-overview")), tree: shown($("#screen-tree")),
    order: shown($("#screen-order")), file: shown($("#screen-file")),
    screen: attr("#app", "data-screen"), tab: attr("#app", "data-tab"),
  });
  const header = () => ({ tabs: shown($("#hdr-tabs")), back: shown($("#back")) });

  // How many pixels of a control stick out of the window, or out of a box that clips what is
  // inside it, counted on both sides. A control inside a table that scrolls by design is left out.
  const cutOff = (e, r) => {
    let left = 0;
    let right = vw();
    for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      if (getComputedStyle(a).overflowX === "visible") continue;
      const b = a.getBoundingClientRect();
      left = Math.max(left, b.left);
      right = Math.min(right, b.right);
    }
    return Math.max(0, left - r.left) + Math.max(0, r.right - right);
  };

  const audit = (rootSel) => {
    const root = rootSel ? $(rootSel) : document.body;
    const docHeight = Math.max(document.documentElement.scrollHeight, innerHeight);
    const offscreen = (r) => r.right <= 0 || r.left >= vw()
      || r.bottom + window.scrollY <= 0 || r.top + window.scrollY >= docHeight;
    const small = [];
    const tiny = {};
    const clipped = [];
    if (root) {
      for (const e of all(TARGETS, root)) {
        if (e.closest(".r") || !shown(e)) continue;
        const r = e.getBoundingClientRect();
        const cut = e.closest(".tablewrap") ? 0 : cutOff(e, r);
        if (cut > 1) {
          clipped.push({ el: label(e), cut: Math.round(cut),
            text: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30) });
        }
        if (offscreen(r)) continue;
        if (r.width < 43.5 || r.height < 43.5) {
          small.push({ el: label(e), w: Math.round(r.width), h: Math.round(r.height),
            text: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30) });
        }
      }
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const t = walker.currentNode;
        if (!t.nodeValue.trim()) continue;
        const e = t.parentElement;
        if (!e || !shown(e)) continue;
        const px = parseFloat(getComputedStyle(e).fontSize);
        if (px < 13) { const k = label(e) + " " + px + "px"; tiny[k] = (tiny[k] || 0) + 1; }
      }
    }
    const hiddenShown = all("[hidden]")
      .filter((e) => e.getAttribute("hidden") !== "until-found" && getComputedStyle(e).display !== "none")
      .map((e) => label(e) + " (" + getComputedStyle(e).display + ")");
    return { scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth,
      innerWidth: vw(), small, tiny, clipped, hiddenShown };
  };

  const fonts = async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await document.fonts.ready;
    return Array.from(document.fonts).filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/gu, ""));
  };

  const edges = () => {
    const t = $("#tree");
    const r = t ? t.getBoundingClientRect() : null;
    const outside = all("#tree .trow").filter((li) => {
      const b = li.getBoundingClientRect();
      return b.left < -0.5 || b.right > vw() + 0.5;
    }).length;
    return { left: r ? r.left : 0, right: r ? r.right : 0, innerWidth: vw(), outside };
  };

  const rows = () => {
    const lis = all("#tree .trow");
    const dirs = lis.filter((li) => li.classList.contains("dir"));
    const files = lis.filter((li) => li.classList.contains("file"));
    return {
      dirs: dirs.length, files: files.length,
      noCount: dirs.filter((li) => !/[0-9]+ files?/u.test((($(".tmeta", li) || {}).textContent) || "")).map(rowName),
      noBadge: files.filter((li) => !$(".badge", li) || !$(".tick", li)).map(rowName),
      compacted: dirs.filter((li) => rowName(li).includes("/")).length,
    };
  };

  const tree = () => ({
    rows: count("#tree .trow"), open: openIds(),
    files: all("#tree li.trow.file").map((li) => ({ fi: Number(li.dataset.fi), name: rowName(li) })),
  });
  const collapsed = () => all('#tree li.trow.dir[aria-expanded="false"]').map((li) => ({
    id: li.dataset.id,
    files: Number((/([0-9,]+) files?/u.exec((($(".tmeta", li) || {}).textContent) || "") || [0, "0"])[1].replace(/,/gu, "")),
  }));

  const fileFacts = () => {
    const code = $("#file-code");
    const notes = code ? all(".status", code).map((e) => e.textContent.trim()) : [];
    return {
      screen: attr("#app", "data-screen"), tab: attr("#app", "data-tab"),
      fileShown: shown($("#screen-file")), treeShown: shown($("#screen-tree")),
      rows: code ? count(".r", code) : 0, status: notes.find((t) => !/^loading/iu.test(t)) || "",
      fname: text("#fname"),
    };
  };
  const fileReady = () => { const f = fileFacts(); return f.fileShown && (f.rows > 0 || f.status !== ""); };

  const box = (left) => {
    const c = $("#file-code");
    const page = document.documentElement.scrollWidth;
    if (!c) return { boxScrolls: false, overflowX: "", scrollLeft: 0, pageScrollWidth: page, innerWidth: vw() };
    const boxScrolls = c.scrollWidth > c.clientWidth;
    if (boxScrolls && typeof left === "number") {
      const was = c.style.scrollBehavior;
      c.style.scrollBehavior = "auto";
      c.scrollLeft = left;
      c.style.scrollBehavior = was;
    }
    return { boxScrolls, overflowX: getComputedStyle(c).overflowX, scrollLeft: c.scrollLeft,
      pageScrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), innerWidth: vw() };
  };

  const wrapState = () => {
    const b = $("#wrap");
    const rows = $("#file-code .rows");
    const c = $("#file-code");
    return { pressed: b ? b.getAttribute("aria-pressed") : null,
      wrapped: !!(rows && rows.classList.contains("wrap")),
      boxScrolls: !!c && c.scrollWidth > c.clientWidth,
      pageScrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      innerWidth: vw() };
  };

  const composer = () => {
    const c = $("#composer");
    const code = $("#file-code");
    return { shown: shown(c), inside: !!(c && code && code.contains(c)) };
  };
  const progress = () => ({ n: number("#prog-n") });
  const tick = (fi) => attr('#tree li.trow.file[data-fi="' + fi + '"] .tick', "aria-checked");
  const unticked = () => {
    const b = $('#tree li.trow.file .tick[aria-checked="false"]');
    return b ? Number(b.dataset.fi) : -1;
  };

  const find = () => {
    const list = all("#find-list .orow");
    const fiOf = (row) => {
      const own = row.getAttribute("data-fi");
      const inner = $(".tick[data-fi]", row);
      const v = own !== null ? own : inner ? inner.getAttribute("data-fi") : null;
      return v === null ? -1 : Number(v);
    };
    return { opened: shown($("#find")), fis: list.filter(shown).map(fiOf) };
  };
  const rulings = () => ({ cards: count("#ov-rulings .ruling"), links: count("#ov-rulings .lnk") });
  const flagged = () => count("#file-code .r.flag");

  const arm = () => {
    window.__left = null;
    document.addEventListener("click", () => { window.__left = { y: window.scrollY, open: openIds() }; },
      { capture: true, once: true });
    return true;
  };
  const left = () => window.__left || null;
  const scrollTo = (y) => {
    const root = document.documentElement;
    const was = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, y);
    root.style.scrollBehavior = was;
    return { y: window.scrollY, max: Math.max(0, root.scrollHeight - innerHeight) };
  };
  const visibleFile = () => {
    const h = $("#hdr");
    const top = h ? h.getBoundingClientRect().bottom : 0;
    const li = all("#tree li.trow.file").find((e) => {
      const r = e.getBoundingClientRect();
      return r.top >= top && r.bottom <= innerHeight;
    });
    return li ? Number(li.dataset.fi) : -1;
  };
  const panes = () => {
    const t = $("#screen-tree");
    const f = $("#screen-file");
    return { treeShown: shown(t), fileShown: shown(f), treeRight: t ? t.getBoundingClientRect().right : 0,
      fileLeft: f ? f.getBoundingClientRect().left : 0, backShown: shown($("#back")) };
  };

  // The page measures the code box once the browser has laid it out (--codew, the width of what the box
  // shows); the layers behind the code are as wide as that. True once it has.
  const boxSized = () => {
    const c = $("#file-code");
    return !!c && c.style.getPropertyValue("--codew") !== "";
  };
  // The alpha of a computed colour: rgba(r, g, b, a) or a colour function with "/ a"; 1 when there is none.
  const alphaOf = (color) => {
    const m = /^rgba\(.*,[ \t]*([0-9.]+)\)$/u.exec(color) || /\/[ \t]*([0-9.]+)[ \t]*\)$/u.exec(color);
    return m ? Number(m[1]) : 1;
  };
  // The rows of the open diff that are on screen below the header: up to five changed and five unchanged,
  // measured with the code box scrolled to "left" pixels when it scrolls (a number).
  const diffLayout = (left) => {
    const code = $("#file-code");
    if (!code) return { box: { left: 0, width: 0, scrollLeft: 0, scrolls: false }, rows: [] };
    const scrolls = code.scrollWidth > code.clientWidth;
    if (scrolls && typeof left === "number") {
      const was = code.style.scrollBehavior;
      code.style.scrollBehavior = "auto";
      code.scrollLeft = left;
      code.style.scrollBehavior = was;
    }
    const b = code.getBoundingClientRect();
    const h = $("#hdr");
    const top = h ? h.getBoundingClientRect().bottom : 0;
    const onScreen = all(".r", code).filter((r) => {
      const t = r.getBoundingClientRect();
      return t.top >= top && t.bottom <= innerHeight;
    });
    const changed = (r) => r.classList.contains("add") || r.classList.contains("del");
    const sample = onScreen.filter(changed).slice(0, 5).concat(onScreen.filter((r) => !changed(r)).slice(0, 5));
    const measured = sample.map((r) => {
      const kids = Array.from(r.children);
      const n = kids.find((k) => k.classList.contains("n") && shown(k)) || null;
      const c = kids.find((k) => k.classList.contains("c")) || null;
      const rr = r.getBoundingClientRect();
      const cr = c ? c.getBoundingClientRect() : rr;
      const cs = c ? getComputedStyle(c) : null;
      const ns = n ? getComputedStyle(n) : null;
      // The text of the number: its left edge is where it starts; a tap is tried at its middle.
      let edge = 0;
      let x = 0;
      let y = 0;
      if (n) {
        const range = document.createRange();
        range.selectNodeContents(n);
        const t = range.getBoundingClientRect();
        edge = t.left;
        x = t.left + t.width / 2;
        y = t.top + t.height / 2;
      }
      const hit = n ? document.elementFromPoint(x, y) : null;
      return {
        line: r.dataset.line || "",
        parts: kids.map((k) => k.className || k.localName),
        numberText: n ? n.textContent.trim() : null,
        gutter: cr.left - rr.left,
        codeLeft: cs ? cr.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth) : cr.left,
        numberZ: ns ? ns.zIndex : "auto",
        codeZ: cs ? cs.zIndex : "auto",
        numberEvents: ns ? ns.pointerEvents : "auto",
        numberAlign: ns ? ns.textAlign : "start",
        numberAlpha: ns ? alphaOf(ns.color) : 1,
        numberLeft: edge,
        numberY: y,
        rowY: rr.top + rr.height / 2,
        tap: !hit ? "none" : n.contains(hit) ? "number" : r.contains(hit) ? "row" : "other",
      };
    });
    return { box: { left: b.left, width: b.width, scrollLeft: code.scrollLeft, scrolls }, rows: measured };
  };

  // The lines the page shows where ticks and comments appear ("Not saved"), those on screen, by what they are about.
  const saveNotes = () => all(".savenote").filter(shown).map((e) => ({ scope: e.dataset.scope || "", text: e.textContent.trim() }));
  // Every file whose tick is on, in any list: the tree, the order and the file list each hold a tick for every file.
  const tickedFiles = () => Array.from(new Set(all(".tick[data-fi]")
    .filter((b) => b.getAttribute("aria-checked") === "true").map((b) => Number(b.dataset.fi)))).sort((a, b) => a - b);
  // The comments under the lines of the open file: who wrote them, what they say, and whether they are kept.
  const threads = () => all("#file-code .thread .cm").map((e) => ({
    who: (($(".who", e) || {}).textContent || "").trim(),
    text: Array.from(e.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.nodeValue).join("").trim(),
    save: e.dataset.save || "",
    note: (($(".cnote", e) || {}).textContent || "").trim(),
  }));
  // The rows of the open diff that are marked, as side and line.
  const flaggedLines = () => all("#file-code .r.flag").map((r) => ({ side: r.dataset.side, line: Number(r.dataset.line) }));
  // The first n rows of the open diff: side, line and the text of the line.
  const rowsOf = (n) => all("#file-code .r").slice(0, n).map((r) => ({
    side: r.dataset.side, line: Number(r.dataset.line), text: (($(".c", r) || {}).textContent || ""),
  }));
  // The path of the open file, as its head shows it.
  const openPath = () => (text("#file-head .fdir") || "") + (text("#file-head .fname") || "");

  return { screens, header, audit, fonts, edges, rows, tree, collapsed, fileFacts, fileReady, box, composer,
    progress, tick, unticked, find, rulings, flagged, arm, left, scrollTo, visibleFile, panes, wrapState,
    boxSized, diffLayout, saveNotes, tickedFiles, threads, flaggedLines, rowsOf, openPath };
})();
`;

// ---------- driving the page ----------

/** What the gate's helpers use of a page: a whole page, or the frame of one inside the stand-in viewer. */
type Driver = Pick<PwPage, "evaluate" | "waitForFunction" | "click" | "fill" | "locator">;

export interface Ctx {
  page: PwPage;
  run: Run;
  review: ReviewInfo;
  /** The page server's origin, for the data files the page itself fetches. */
  origin: string;
  out: string;
  steps: ReadonlySet<string>;
  audits: ScreenAudit[];
  failed: string[];
  /** The stand-in for the viewer, and the server that holds it and can serve a changed page. */
  standIn: StandIn;
  server: PageServer;
  /** Options the bridge checks give the stand-in on top of their own: how a control puts a fault in the viewer. */
  fault: Partial<StandInOptions>;
}

interface TreeFacts {
  rows: number;
  open: string[];
  files: { fi: number; name: string }[];
}

const ACTION_TIMEOUT_MS = 10_000;
const NAVIGATION_TIMEOUT_MS = 45_000;
const READY_TIMEOUT_MS = 30_000;
const WAIT_MS = 10_000;
const POLL_MS = 50;
/** How many files from the top of the tree are tried when a check needs a file with enough lines. */
const FILES_TRIED = 12;
const SCROLL_TARGET = 300;
/** How far a code box is scrolled sideways where a check needs it moved. */
const SIDEWAYS_PX = 200;
/**
 * Back goes through the browser's history, and the page shows the list itself if the step has not
 * arrived within 400 ms. The helpers that move around the page wait that window out after every
 * press of Back, so a tap never meets a half-finished Back; open-after-back taps inside it on purpose.
 */
const BACK_SETTLE_MS = 450;

/** Call window.__gate.<fn>(...args) in the page. */
function gate<T>(page: Driver, fn: GateFunction, ...args: readonly unknown[]): Promise<T> {
  const call = `window.__gate.${fn}(${args.map((a) => JSON.stringify(a)).join(",")})`;
  return page.evaluate(call) as Promise<T>;
}

async function until(
  page: Driver,
  expression: string,
  what: string,
  timeout = WAIT_MS,
): Promise<void> {
  try {
    await page.waitForFunction(expression, undefined, { timeout, polling: POLL_MS });
  } catch {
    throw new Error(`timed out waiting for ${what}`);
  }
}

/** Wait, and carry on if it never happens: the verdict reports what the page shows. */
async function tryUntil(page: Driver, expression: string, timeout = WAIT_MS): Promise<void> {
  try {
    await page.waitForFunction(expression, undefined, { timeout, polling: POLL_MS });
  } catch {
    // the verdict that follows reads the page as it is
  }
}

async function tap(page: Driver, selector: string): Promise<void> {
  try {
    await page.click(selector);
  } catch (e) {
    throw new Error(`click ${selector}: ${failure(e)}`);
  }
}

async function typeInto(page: Driver, selector: string, value: string): Promise<void> {
  try {
    await page.fill(selector, value);
  } catch (e) {
    throw new Error(`fill ${selector}: ${failure(e)}`);
  }
}

async function attempt(id: string, fn: () => Promise<Verdict>): Promise<Check> {
  try {
    return { id, ...(await fn()) };
  } catch (e) {
    return { id, ...fail(failure(e)) };
  }
}

const waitFileReady = (page: Driver): Promise<void> =>
  until(page, "window.__gate.fileReady()", "the file to load");

const rowSelector = (fi: number): string => `#tree li.trow.file[data-fi="${fi}"] button.tgo`;

const stamp = (page: Driver, scheme: string): Promise<unknown> =>
  page.evaluate(`document.documentElement.setAttribute("data-theme", ${JSON.stringify(scheme)})`);

/** The page is ready once its tree has rows. */
async function whenReady(page: Driver, scheme: string): Promise<void> {
  await stamp(page, scheme);
  await until(
    page,
    'document.querySelectorAll("#tree .trow").length > 0',
    "the page to build its tree",
    READY_TIMEOUT_MS,
  );
}

async function shot(ctx: Ctx, step: string): Promise<void> {
  if (ctx.steps.has(step))
    await ctx.page.screenshot({ path: shotPath(ctx.out, ctx.run.name, step) });
}

async function audit(ctx: Ctx, screen: string, root = ""): Promise<void> {
  const facts = await gate<Omit<ScreenAudit, "screen">>(ctx.page, "audit", root);
  ctx.audits.push({ screen, ...facts });
}

type Tab = "overview" | "tree" | "order";

/** Show a tab's screen; the file list is closed first, and under WIDE_FROM with a file open, Back is pressed, so the tabs are there. */
async function gotoTab(page: Driver, tab: Tab): Promise<void> {
  if ((await gate<{ opened: boolean }>(page, "find")).opened) await tap(page, "#find-close");
  const head = await gate<{ tabs: boolean; back: boolean }>(page, "header");
  if (!head.tabs && head.back) {
    await tap(page, "#back");
    await until(page, "window.__gate.header().tabs", "the tabs to return after Back");
    await Bun.sleep(BACK_SETTLE_MS);
  }
  await tap(page, `#tab-${tab}`);
  await until(page, `window.__gate.screens().${tab}`, `the ${tab} screen`);
}

/** Open files from the top of the tree until one has at least `min` diff lines; its index, or null. */
async function openFileWithRows(ctx: { page: Driver }, min: number): Promise<number | null> {
  const { page } = ctx;
  await gotoTab(page, "tree");
  await tap(page, "#tree-expand");
  const { files } = await gate<TreeFacts>(page, "tree");
  for (const file of files.slice(0, FILES_TRIED)) {
    await tap(page, rowSelector(file.fi));
    await waitFileReady(page);
    if ((await gate<FileFacts>(page, "fileFacts")).rows >= min) return file.fi;
    await gotoTab(page, "tree");
  }
  return null;
}

async function visit(ctx: Ctx, tab: Tab): Promise<Check[]> {
  try {
    await gotoTab(ctx.page, tab);
    if (tab === "order") {
      await until(
        ctx.page,
        'document.querySelectorAll("#order-list .orow").length > 0',
        "the order rows",
      );
    }
    await audit(ctx, tab);
    await shot(ctx, tab);
    return [];
  } catch (e) {
    return [{ id: `screen-${tab}`, ...fail(failure(e)) }];
  }
}

async function visitFile(ctx: Ctx): Promise<Check[]> {
  try {
    if ((await openFileWithRows(ctx, 1)) === null)
      throw new Error("no file in the tree opened with a diff");
    await audit(ctx, "file");
    await shot(ctx, "file");
    return [];
  } catch (e) {
    return [{ id: "screen-file", ...fail(failure(e)) }];
  }
}

// ---------- the checks ----------

type PhoneCheck = (ctx: Ctx) => Promise<Verdict>;

const treeOf = (page: Driver): Promise<TreeFacts> => gate<TreeFacts>(page, "tree");

async function checkTreeVisible({ page }: Ctx): Promise<Verdict> {
  await gotoTab(page, "tree");
  return treeVisibleVerdict(await gate<ScreenFacts>(page, "screens"));
}

async function checkEdges({ page }: Ctx): Promise<Verdict> {
  await gotoTab(page, "tree");
  return edgeVerdict(await gate<EdgeFacts>(page, "edges"));
}

async function checkRows({ page }: Ctx): Promise<Verdict> {
  await gotoTab(page, "tree");
  await tap(page, "#tree-expand");
  return rowsVerdict(await gate<RowsFacts>(page, "rows"));
}

async function checkSearch(ctx: Ctx): Promise<Verdict> {
  const { page, review } = ctx;
  const word = pickSearchWord(review);
  if (word === null) return fail("review.json lists no file to search for");
  await gotoTab(page, "tree");
  await tap(page, "#tree-expand");
  const before = (await treeOf(page)).rows;
  await typeInto(page, "#tree-q", word);
  const shownFiles = (await treeOf(page)).files.map((f) => f.fi);
  await shot(ctx, "tree-search");
  await typeInto(page, "#tree-q", "");
  const after = (await treeOf(page)).rows;
  return treeSearchVerdict(review, word, shownFiles, before, after);
}

async function checkExpandCollapse({ page, review }: Ctx): Promise<Verdict> {
  await gotoTab(page, "tree");
  await tap(page, "#tree-collapse");
  const collapsed = (await treeOf(page)).files.length;
  await tap(page, "#tree-expand");
  const expanded = (await treeOf(page)).files.length;
  const rootFiles = review.files.filter((f) => !f.path.includes("/")).length;
  return expandVerdict(collapsed, expanded, rootFiles, review.changedFiles);
}

async function checkOpenFile({ page }: Ctx): Promise<Verdict> {
  await gotoTab(page, "tree");
  await tap(page, "#tree-expand");
  const first = (await treeOf(page)).files[0];
  if (first === undefined) return fail("the tree has no file row");
  await tap(page, rowSelector(first.fi));
  await waitFileReady(page);
  return openFileVerdict(await gate<FileFacts>(page, "fileFacts"), first.name);
}

/** Collapse everything, then open the largest folders on screen until two are open and the page can scroll. */
async function openFolders(page: Driver): Promise<void> {
  await tap(page, "#tree-collapse");
  let opened = 0;
  for (let step = 0; step < FILES_TRIED; step++) {
    const scroll = await gate<{ max: number }>(page, "scrollTo", 0);
    const shownFiles = (await treeOf(page)).files.length;
    if (opened >= 2 && scroll.max >= SCROLL_TARGET && shownFiles > 0) break;
    const dirs = await gate<{ id: string; files: number }[]>(page, "collapsed");
    const biggest = [...dirs].sort((a, b) => b.files - a.files)[0];
    if (biggest === undefined) break;
    await tap(page, `#tree li.trow.dir[data-id=${JSON.stringify(biggest.id)}] button.tgo`);
    opened++;
  }
}

async function checkBack({ page }: Ctx): Promise<Verdict> {
  await gotoTab(page, "tree");
  await openFolders(page);
  await gate(page, "scrollTo", SCROLL_TARGET);
  const onScreen = await gate<number>(page, "visibleFile");
  const target = onScreen >= 0 ? onScreen : (await treeOf(page)).files[0]?.fi;
  if (target === undefined) return fail("no file row to open after opening folders");
  await gate(page, "arm");
  await tap(page, rowSelector(target));
  await waitFileReady(page);
  const left = await gate<Leave | null>(page, "left");
  if (left === null) throw new Error("the tap on the file row was not seen");
  await tap(page, "#back");
  await until(page, "window.__gate.screens().tree", "the tree after Back");
  await tryUntil(page, `Math.abs(window.scrollY - ${left.y}) <= ${SCROLL_SLACK}`, 3000);
  await Bun.sleep(BACK_SETTLE_MS);
  const tree = await treeOf(page);
  const facts = await gate<ScreenFacts>(page, "screens");
  const y = (await page.evaluate("window.scrollY")) as number;
  return backVerdict(left, { y, open: tree.open, treeShown: facts.tree, screen: facts.screen });
}

async function checkHistory({ page }: Ctx): Promise<Verdict> {
  await gotoTab(page, "tree");
  const before = (await treeOf(page)).open;
  const onScreen = await gate<number>(page, "visibleFile");
  const target = onScreen >= 0 ? onScreen : (await treeOf(page)).files[0]?.fi;
  if (target === undefined) return fail("the tree has no file row");
  await tap(page, rowSelector(target));
  await waitFileReady(page);
  // Without an entry of its own the browser's back would leave the page altogether.
  if (!(await page.evaluate("history.state !== null"))) {
    return fail(
      "opening a file added no history entry, so the browser's back would leave the page",
    );
  }
  await page.goBack({ waitUntil: "load", timeout: WAIT_MS });
  await tryUntil(page, "window.__gate.screens().tree", 5000);
  const facts = await gate<ScreenFacts>(page, "screens");
  return historyVerdict(before, { open: (await treeOf(page)).open, treeShown: facts.tree });
}

/** Back, then a tap on a file before the page's fallback for Back has run: the file stays open. */
async function checkOpenAfterBack({ page }: Ctx): Promise<Verdict> {
  await gotoTab(page, "tree");
  await tap(page, "#tree-expand");
  const first = (await treeOf(page)).files[0];
  if (first === undefined) return fail("the tree has no file row");
  await tap(page, rowSelector(first.fi));
  await waitFileReady(page);
  await tap(page, "#back");
  await until(page, "window.__gate.screens().tree", "the tree after Back");
  await tap(page, rowSelector(first.fi));
  await Bun.sleep(BACK_SETTLE_MS + 150);
  await tryUntil(page, "window.__gate.fileReady()", 2000);
  return openAfterBackVerdict(await gate<FileFacts>(page, "fileFacts"), first.name);
}

async function checkPrevNext({ page }: Ctx): Promise<Verdict> {
  await gotoTab(page, "tree");
  await tap(page, "#tree-expand");
  const { files } = await treeOf(page);
  const k = firstDistinctPair(files.map((f) => f.name));
  const first = files[k];
  const second = files[k + 1];
  if (first === undefined || second === undefined)
    return pass("fewer than two differently named files, nothing to step between");
  await tap(page, rowSelector(first.fi));
  await waitFileReady(page);
  const named = (name: string): string =>
    `window.__gate.fileFacts().fname === ${JSON.stringify(name)}`;
  await tap(page, "#next");
  await tryUntil(page, named(second.name));
  const afterNext = (await gate<FileFacts>(page, "fileFacts")).fname;
  if (afterNext !== second.name) return navVerdict(first.name, second.name, afterNext, null);
  await tap(page, "#prev");
  await tryUntil(page, named(first.name));
  const afterPrev = (await gate<FileFacts>(page, "fileFacts")).fname;
  return navVerdict(first.name, second.name, afterNext, afterPrev);
}

async function reload(ctx: Ctx): Promise<void> {
  await ctx.page.reload({ waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS });
  await whenReady(ctx.page, ctx.run.scheme);
}

async function checkTick(ctx: Ctx): Promise<Verdict> {
  const { page } = ctx;
  await gotoTab(page, "tree");
  await tap(page, "#tree-expand");
  const fi = await gate<number>(page, "unticked");
  if (fi < 0) return fail("every file is already ticked, so there is nothing to tick");
  const before = (await gate<{ n: number }>(page, "progress")).n;
  await tap(page, `#tree li.trow.file[data-fi="${fi}"] .tick`);
  const ticked = {
    checked: await gate<string | null>(page, "tick", fi),
    n: (await gate<{ n: number }>(page, "progress")).n,
  };
  await reload(ctx);
  await gotoTab(page, "tree");
  await tap(page, "#tree-expand");
  const reloaded = {
    checked: await gate<string | null>(page, "tick", fi),
    n: (await gate<{ n: number }>(page, "progress")).n,
  };
  return tickVerdict({ before, ticked, reloaded });
}

async function checkComposer(ctx: Ctx): Promise<Verdict> {
  const { page } = ctx;
  if ((await openFileWithRows(ctx, 5)) === null)
    return fail("no file in the tree has five lines to tap");
  await page.locator("#file-code .r").nth(4).click();
  await until(page, "window.__gate.composer().shown", "the comment box");
  const facts = await gate<ComposerFacts>(page, "composer");
  await shot(ctx, "composer");
  await audit(ctx, "composer", "#composer");
  return composerVerdict(facts);
}

/** The file with the longest code line, from the diff chunks the page itself loads; null when they cannot be read. */
async function widestOfChunks({ origin, review }: Ctx): Promise<number | null> {
  const chunks = new Set(
    review.files.flatMap((f) => (typeof f["chunk"] === "number" ? [f["chunk"]] : [])),
  );
  const loaded = await Promise.all(
    [...chunks].map(async (k): Promise<DiffItem[]> => {
      try {
        const res = await fetch(`${origin}/chunks/${k}.json`);
        const items = res.ok ? await res.json() : [];
        return Array.isArray(items) ? items.filter(isDiffItem) : [];
      } catch {
        return [];
      }
    }),
  );
  return widestFile(loaded.flat());
}

/**
 * Open the file with the longest code line, so that a box wider than its screen is really tried.
 * Its path; or undefined when the chunks hold no code, and the screen is left as it is.
 */
async function openWidest(ctx: Ctx): Promise<string | undefined> {
  const widest = await widestOfChunks(ctx);
  if (widest === null) return undefined;
  const { page, review } = ctx;
  await gotoTab(page, "tree");
  await tap(page, "#tree-expand");
  await tap(page, rowSelector(widest));
  await waitFileReady(page);
  return review.files[widest]?.path;
}

/** The code box of the file with the longest line scrolls by itself, and the page does not. */
async function checkSideways(ctx: Ctx): Promise<Verdict> {
  const name = await openWidest(ctx);
  const verdict = sidewaysVerdict(await gate<BoxFacts>(ctx.page, "box", SIDEWAYS_PX));
  return name === undefined ? verdict : { ...verdict, detail: `${name}: ${verdict.detail}` };
}

/**
 * On the file with the longest line: nothing in its head or the bars is cut off, Wrap flips the
 * lines and back, and the wrapped lines fit the box. A diff that fits the width, either way.
 */
async function checkWrap(ctx: Ctx): Promise<Verdict> {
  const { page } = ctx;
  if ((await openWidest(ctx)) === undefined && (await openFileWithRows(ctx, 1)) === null) {
    return fail("no file in the tree opened with a diff");
  }
  await audit(ctx, "file with the widest code");
  const first = await gate<WrapState>(page, "wrapState");
  await tap(page, "#wrap");
  const tapped = await gate<WrapState>(page, "wrapState");
  await tap(page, "#wrap");
  const again = await gate<WrapState>(page, "wrapState");
  return wrapVerdict(first, tapped, again);
}

/**
 * On the file with the longest line: the rows are the code and a faint number on a layer behind it,
 * with nothing in front of the code, and the number stays NUMBER_INSET px in from the left edge of
 * the box while the box scrolls sideways. In a single-pane run the code starts within
 * MAX_CODE_OFFSET of the window's edge; beside a tree pane, of its own box.
 */
async function checkDiffLayout(ctx: Ctx): Promise<Verdict> {
  const { page } = ctx;
  const name = await openWidest(ctx);
  if (name === undefined && (await openFileWithRows(ctx, 1)) === null) {
    return fail("no file in the tree opened with a diff");
  }
  await until(page, "window.__gate.boxSized()", "the code box to be measured");
  const at = await gate<DiffLayoutFacts>(page, "diffLayout", 0);
  const scrolled = at.box.scrolls
    ? await gate<DiffLayoutFacts>(page, "diffLayout", SIDEWAYS_PX)
    : null;
  if (scrolled !== null) await gate<DiffLayoutFacts>(page, "diffLayout", 0);
  const verdict = diffLayoutVerdict(at, scrolled, ctx.run.width < WIDE_FROM);
  return name === undefined ? verdict : { ...verdict, detail: `${name}: ${verdict.detail}` };
}

async function checkFind(ctx: Ctx): Promise<Verdict> {
  const { page, review } = ctx;
  const word = pickSearchWord(review);
  if (word === null) return fail("review.json lists no file to search for");
  await gotoTab(page, "tree");
  await tap(page, "#prog");
  await until(page, "window.__gate.find().opened", "the file list");
  await shot(ctx, "find");
  await audit(ctx, "find", "#find");
  await typeInto(page, "#find-q", word);
  const found = await gate<{ fis: number[] }>(page, "find");
  await tap(page, "#find-close");
  await tryUntil(page, "!window.__gate.find().opened", 3000);
  const closedHidden = !(await gate<{ opened: boolean }>(page, "find")).opened;
  return findVerdict(review, word, { opened: true, fis: found.fis, closedHidden });
}

async function checkRulings({ page, review }: Ctx): Promise<Verdict> {
  await gotoTab(page, "overview");
  const cards = await gate<{ cards: number; links: number }>(page, "rulings");
  const facts = { expected: review.rulings, ...cards };
  if (cards.links === 0) return rulingVerdict(facts, null);
  await tap(page, "#ov-rulings .lnk");
  await tryUntil(page, "window.__gate.fileFacts().fileShown && window.__gate.flagged() > 0");
  const after = {
    fileShown: (await gate<FileFacts>(page, "fileFacts")).fileShown,
    flagged: await gate<number>(page, "flagged"),
  };
  return rulingVerdict(facts, after);
}

// ---------- the page bridge ----------

/** The page's path in the stand-in viewer's frame. */
const FRAMED_PATH = "/index.html";
const FRAME_WAIT_MS = 10_000;
/** How long a write may take to reach the stand-in, and how long an answer the gate holds back lasts. */
const BRIDGE_WRITE_WAIT_MS = 5000;
const ANSWER_DELAY_MS = 900;
/** The page waits 1.5 seconds for bridge-ready and 5 seconds for an answer; the gate looks on both sides of each. */
const BEFORE_READY_MS = 700;
const AFTER_READY_MS = 2400;
const BEFORE_ANSWER_MS = 4000;
const AFTER_ANSWER_MS = 6200;
const COMMENT_TEXT = "Why is this retried?";

interface Thread {
  who: string;
  text: string;
  save: string;
  note: string;
}

interface RowFacts {
  side: string;
  line: number;
  text: string;
}

/**
 * The page inside the stand-in viewer's frame, driven as the gate drives a page. Each call finds the
 * frame afresh: a reload of the viewer makes a new one.
 */
function framedPage(top: PwPage): Driver {
  const frame = async (): Promise<PwFrame> => {
    for (let waited = 0; waited <= FRAME_WAIT_MS; waited += POLL_MS) {
      const found = top.frames().find((f) => f.url().endsWith(FRAMED_PATH));
      if (found !== undefined) return found;
      await Bun.sleep(POLL_MS);
    }
    throw new Error("the frame of the page did not appear in the viewer");
  };
  const locator = (selector: string, index = 0): PwLocator => ({
    nth: (i) => locator(selector, i),
    click: async () => (await frame()).locator(selector).nth(index).click(),
  });
  return {
    evaluate: async (expression) => (await frame()).evaluate(expression),
    waitForFunction: async (expression, arg, options) =>
      (await frame()).waitForFunction(expression, arg, options),
    click: async (selector) => (await frame()).click(selector),
    fill: async (selector, value) => (await frame()).fill(selector, value),
    locator: (selector) => locator(selector),
  };
}

/** Open the page in the stand-in viewer, as a person's viewer shows it, and wait for the page to build its tree. */
async function openViewer(ctx: Ctx): Promise<Driver> {
  await ctx.page.goto(`${ctx.origin}${VIEWER_URL}`, {
    waitUntil: "load",
    timeout: NAVIGATION_TIMEOUT_MS,
  });
  const doc = framedPage(ctx.page);
  await whenReady(doc, ctx.run.scheme);
  return doc;
}

async function reloadViewer(ctx: Ctx, doc: Driver): Promise<void> {
  await ctx.page.reload({ waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS });
  await whenReady(doc, ctx.run.scheme);
}

/** A fresh stand-in with the options a check wants, then the options a control asks for on top. */
function begin(ctx: Ctx, mine: Partial<StandInOptions> = {}): void {
  ctx.standIn.reset();
  ctx.server.overrides.clear();
  ctx.standIn.configure({ ...mine, ...ctx.fault });
}

/** The page asked for its state and the stand-in answered, after the first `since` entries of its log. */
const sawState = (standIn: StandIn, since: number): boolean =>
  standIn
    .log()
    .slice(since)
    .some((l) => l.type === "state-get" && l.outcome === "state");

async function waitHost(what: string, ready: () => boolean, timeout = WAIT_MS): Promise<void> {
  for (let waited = 0; waited <= timeout; waited += POLL_MS) {
    if (ready()) return;
    await Bun.sleep(POLL_MS);
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** Wait, and carry on if it never happens: the verdict reports what the stand-in holds. */
async function tryHost(ready: () => boolean, timeout = WAIT_MS): Promise<void> {
  try {
    await waitHost("the stand-in", ready, timeout);
  } catch {
    // the verdict that follows reads the stand-in as it is
  }
}

/** Sleep until `ms` after `since`, which is a time on this machine's clock. */
const sleepUntil = (since: number, ms: number): Promise<void> =>
  Bun.sleep(Math.max(0, since + ms - Date.now()));

const hasDiff = (f: ReviewFile | undefined): boolean =>
  f !== undefined && f["withheld"] === undefined && f["binary"] !== true;

/** The key the spec gives a file's tick: `tick:<path>:<hash>`, the hash being the one review.json carries. */
function tickKeyOf(review: ReviewInfo, fi: number): string {
  const f = review.files[fi];
  const hash = f?.["hash"];
  if (f === undefined || typeof hash !== "string") {
    throw new Error(`review.json carries no hash for file ${fi}`);
  }
  return `tick:${f.path}:${hash}`;
}

/** Tick `n` files whose diffs are shown, in the tree; their indexes. */
async function tickShown(ctx: Ctx, doc: Driver, n: number): Promise<number[]> {
  await gotoTab(doc, "tree");
  await tap(doc, "#tree-expand");
  const chosen = (await treeOf(doc)).files
    .map((f) => f.fi)
    .filter((fi) => hasDiff(ctx.review.files[fi]))
    .slice(0, n);
  if (chosen.length < n)
    throw new Error(`only ${chosen.length} files with a diff to tick, not ${n}`);
  for (const fi of chosen) await tap(doc, `#tree li.trow.file[data-fi="${fi}"] .tick`);
  return chosen;
}

const ticked = (doc: Driver): Promise<number[]> => gate<number[]>(doc, "tickedFiles");
const notesOf = (doc: Driver): Promise<Note[]> => gate<Note[]>(doc, "saveNotes");

async function checkBridgeTicks(ctx: Ctx): Promise<Verdict> {
  const { standIn } = ctx;
  begin(ctx);
  const doc = await openViewer(ctx);
  await waitHost("the page to ask the viewer for its state", () => sawState(standIn, 0));
  const fis = await tickShown(ctx, doc, 2);
  const keys = fis.map((fi) => ({ fi, key: tickKeyOf(ctx.review, fi) }));
  await tryHost(() => standIn.tickKeys().length >= fis.length, BRIDGE_WRITE_WAIT_MS);
  const written = standIn.tickKeys();
  const seen = standIn.log().length;
  await reloadViewer(ctx, doc);
  await tryHost(() => sawState(standIn, seen));
  await gotoTab(doc, "tree");
  await tryUntil(doc, `window.__gate.tickedFiles().length >= ${fis.length}`, 3000);
  const after = {
    fis: await ticked(doc),
    count: (await gate<{ n: number }>(doc, "progress")).n,
    notes: (await notesOf(doc)).map((n) => n.text),
  };
  return bridgeTicksVerdict({ ticked: keys, written, after });
}

/** The data of the page as if rebuilt on a new head where only file `fi`'s diff changed. */
async function versionOverrides(ctx: Ctx, fi: number): Promise<ReadonlyMap<string, string>> {
  const read = async (path: string): Promise<string> => {
    const res = await fetch(`${ctx.origin}${path}`);
    if (!res.ok) throw new Error(`${path} could not be read (${res.status})`);
    return res.text();
  };
  const chunk = ctx.review.files[fi]?.["chunk"];
  if (typeof chunk !== "number") throw new Error(`review.json names no chunk for file ${fi}`);
  const path = `/chunks/${chunk}.json`;
  return newVersionOverrides(await read("/review.json"), new Map([[path, await read(path)]]), fi);
}

async function checkBridgeNewVersion(ctx: Ctx): Promise<Verdict> {
  const { standIn, server } = ctx;
  begin(ctx);
  try {
    const doc = await openViewer(ctx);
    await waitHost("the page to ask the viewer for its state", () => sawState(standIn, 0));
    const [changed, kept] = await tickShown(ctx, doc, 2);
    if (changed === undefined || kept === undefined) return fail("no two files to tick");
    await tryHost(() => standIn.tickKeys().length >= 2, BRIDGE_WRITE_WAIT_MS);
    for (const [path, text] of await versionOverrides(ctx, changed))
      server.overrides.set(path, text);
    const seen = standIn.log().length;
    await reloadViewer(ctx, doc);
    await tryHost(() => sawState(standIn, seen));
    await gotoTab(doc, "tree");
    await tryUntil(doc, `window.__gate.tickedFiles().includes(${kept})`, 3000);
    return newVersionVerdict({
      changed,
      kept,
      ticked: await ticked(doc),
      count: (await gate<{ n: number }>(doc, "progress")).n,
    });
  } finally {
    server.overrides.clear();
  }
}

async function checkBridgeNotSaved(ctx: Ctx): Promise<Verdict> {
  const { standIn } = ctx;
  begin(ctx, { drop: ["bridge-hello"] });
  const doc = await openViewer(ctx);
  await waitHost("the page's hello", () => standIn.log().some((l) => l.type === "bridge-hello"));
  const helloAt = standIn.log().find((l) => l.type === "bridge-hello")?.at ?? Date.now();
  await sleepUntil(helloAt, BEFORE_READY_MS);
  if (Date.now() > helloAt + READY_LATEST_MS) {
    throw new Error(
      "the lines were looked at too late to tell whether the page waited 1.5 seconds",
    );
  }
  const early = await notesOf(doc);
  await sleepUntil(helloAt, AFTER_READY_MS);
  const late = await notesOf(doc);
  await shot(ctx, "not-saved");
  const [fi] = await tickShown(ctx, doc, 1);
  return notSavedVerdict({
    early,
    late,
    ticked: fi !== undefined && (await ticked(doc)).includes(fi),
    written: standIn.tickKeys().length,
  });
}

/** The latest the lines may be looked at and still count as before the 1.5 seconds ran out. */
const READY_LATEST_MS = 1300;

async function checkBridgeUnanswered(ctx: Ctx): Promise<Verdict> {
  const { standIn } = ctx;
  begin(ctx, { drop: ["state-set"] });
  const doc = await openViewer(ctx);
  await waitHost("the page to ask the viewer for its state", () => sawState(standIn, 0));
  const [fi] = await tickShown(ctx, doc, 1);
  await waitHost("the write", () => standIn.log().some((l) => l.type === "state-set"));
  const sentAt = standIn.log().find((l) => l.type === "state-set")?.at ?? Date.now();
  await sleepUntil(sentAt, BEFORE_ANSWER_MS);
  const before = await notesOf(doc);
  await sleepUntil(sentAt, AFTER_ANSWER_MS);
  const after = await notesOf(doc);
  return unansweredVerdict({
    before,
    after,
    ticked: fi !== undefined && (await ticked(doc)).includes(fi),
  });
}

async function checkBridgeConflict(ctx: Ctx): Promise<Verdict> {
  const { standIn } = ctx;
  begin(ctx, { conflicts: 1 });
  const doc = await openViewer(ctx);
  await waitHost("the page to ask the viewer for its state", () => sawState(standIn, 0));
  const [fi] = await tickShown(ctx, doc, 1);
  if (fi === undefined) return fail("no file to tick");
  const outcomes = (): string[] =>
    standIn
      .log()
      .filter((l) => l.type === "state-set")
      .map((l) => l.outcome);
  await tryHost(() => outcomes().length >= 2, BRIDGE_WRITE_WAIT_MS);
  await Bun.sleep(POLL_MS * 6);
  return conflictVerdict({
    outcomes: outcomes(),
    doc: standIn.doc(),
    key: tickKeyOf(ctx.review, fi),
    ticked: (await ticked(doc)).includes(fi),
    notes: (await notesOf(doc)).map((n) => n.text),
  });
}

const baseNameOf = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

async function checkBridgeComment(ctx: Ctx): Promise<Verdict> {
  const { standIn } = ctx;
  begin(ctx);
  const doc = await openViewer(ctx);
  await waitHost("the page to ask the viewer for its state", () => sawState(standIn, 0));
  if ((await openFileWithRows({ page: doc }, 5)) === null) {
    return fail("no file in the tree has five lines to tap");
  }
  const path = await gate<string>(doc, "openPath");
  await doc.locator("#file-code .r").nth(4).click();
  await until(doc, "window.__gate.composer().shown", "the comment box");
  const row = (await gate<RowFacts[]>(doc, "rowsOf", 5))[4];
  if (row === undefined) return fail("the fifth row of the diff is missing");
  await typeInto(doc, "#mtext", COMMENT_TEXT);
  standIn.configure({ delayMs: ANSWER_DELAY_MS });
  await tap(doc, "#msave");
  await tryUntil(doc, "window.__gate.threads().length > 0", ANSWER_DELAY_MS - 300);
  const first = (await gate<Thread[]>(doc, "threads"))[0];
  await tryHost(() => standIn.comments().length >= 1, BRIDGE_WRITE_WAIT_MS);
  await tryUntil(
    doc,
    'window.__gate.threads().some((t) => t.save === "kept")',
    BRIDGE_WRITE_WAIT_MS,
  );
  const settled = (await gate<Thread[]>(doc, "threads"))[0]?.save ?? null;
  await shot(ctx, "bridge-comment");
  standIn.configure({ delayMs: 0 });
  const stored = standIn.comments().map((c) => ({ body: c.body, anchor: { ...c.anchor } }));
  const seen = standIn.log().length;
  await reloadViewer(ctx, doc);
  await tryHost(() => sawState(standIn, seen));
  const fi = ctx.review.files.findIndex((f) => f.path === path);
  await gotoTab(doc, "tree");
  await tap(doc, "#tree-expand");
  await tap(doc, rowSelector(fi));
  await waitFileReady(doc);
  await tryUntil(doc, "window.__gate.threads().length > 0", 3000);
  const reloaded = await gate<Thread[]>(doc, "threads");
  return commentVerdict({
    typed: COMMENT_TEXT,
    row: { path, side: row.side, line: row.line, text: row.text },
    atOnce: first === undefined ? null : { text: first.text, save: first.save },
    stored,
    settled,
    reloaded: reloaded.map((t) => ({ text: t.text, save: t.save })),
  });
}

async function checkBridgeFocus(ctx: Ctx): Promise<Verdict> {
  const { standIn } = ctx;
  begin(ctx);
  const doc = await openViewer(ctx);
  await waitHost("the page to ask the viewer for its state", () => sawState(standIn, 0));
  if ((await openFileWithRows({ page: doc }, 5)) === null) {
    return fail("no file in the tree has five lines to tap");
  }
  const path = await gate<string>(doc, "openPath");
  const rows = await gate<RowFacts[]>(doc, "rowsOf", 12);
  const at = rows.findIndex(
    (r, k) => r.side === "new" && rows[k + 1]?.side === "new" && rows[k + 1]?.line === r.line + 1,
  );
  const start = rows[at >= 0 ? at : rows.findIndex((r) => r.side === "new")];
  if (start === undefined) return fail("the open file shows no line of the new side to ask for");
  const from = start.line;
  const to = at >= 0 ? from + 1 : from;
  await gotoTab(doc, "overview");
  const anchor = { kind: "line", file: path, side: "new", from, to };
  await ctx.page.evaluate(`window.__viewer.focus(${JSON.stringify(anchor)})`);
  await tryUntil(doc, "window.__gate.fileFacts().fileShown && window.__gate.flagged() > 0", 5000);
  const facts = await gate<FileFacts>(doc, "fileFacts");
  return focusVerdict({
    side: "new",
    from,
    to,
    flagged: await gate<{ side: string; line: number }[]>(doc, "flaggedLines"),
    fileShown: facts.fileShown,
    fname: facts.fname,
    expectedName: baseNameOf(path),
  });
}

/** The bridge checks, each with its id; the last waits 5 seconds for a write nobody answers. */
export const BRIDGE_CHECKS: readonly (readonly [string, PhoneCheck])[] = [
  ["bridge-ticks", checkBridgeTicks],
  ["bridge-new-version", checkBridgeNewVersion],
  ["bridge-not-saved", checkBridgeNotSaved],
  ["bridge-conflict", checkBridgeConflict],
  ["bridge-comment", checkBridgeComment],
  ["bridge-focus", checkBridgeFocus],
  ["bridge-unanswered", checkBridgeUnanswered],
];

const SLOW_BRIDGE_CHECK = "bridge-unanswered";
/** The runs that drive the bridge: a phone in both schemes and the widths of a folded-out phone. */
const BRIDGE_RUNS: readonly string[] = ["phone-light", "phone-dark", "w755-light", "w904-light"];

/** The bridge checks a run drives: none outside BRIDGE_RUNS, and the slow one on the phone in light only. */
export function bridgeChecksFor(run: Run): readonly string[] {
  if (!BRIDGE_RUNS.includes(run.name)) return [];
  return BRIDGE_CHECKS.map(([id]) => id).filter(
    (id) => id !== SLOW_BRIDGE_CHECK || run.name === "phone-light",
  );
}

const PHONE_CHECKS: readonly (readonly [string, PhoneCheck])[] = [
  ["tree-visible", checkTreeVisible],
  ["tree-edge-to-edge", checkEdges],
  ["tree-rows", checkRows],
  ["tree-search", checkSearch],
  ["tree-expand-collapse", checkExpandCollapse],
  ["open-file", checkOpenFile],
  ["back-restores", checkBack],
  ["history-back", checkHistory],
  ["open-after-back", checkOpenAfterBack],
  ["prev-next", checkPrevNext],
  ["tick", checkTick],
  ["comment-box", checkComposer],
  ["diff-layout", checkDiffLayout],
  ["sideways", checkSideways],
  ["wrap-toggle", checkWrap],
  ["find-sheet", checkFind],
  ["ruling-links", checkRulings],
];

async function checkFonts({ page, failed }: Ctx): Promise<Verdict> {
  return fontsVerdict(await gate<string[]>(page, "fonts"), failed);
}

/** Two-pane widths (WIDE_FROM and up): the tree is a left pane and the file opens beside it. */
async function checkSplit(ctx: Ctx): Promise<Verdict> {
  const { page } = ctx;
  await gotoTab(page, "tree");
  const before = await gate<{
    treeShown: boolean;
    fileShown: boolean;
    treeRight: number;
    fileLeft: number;
  }>(page, "panes");
  if ((await openFileWithRows(ctx, 1)) === null)
    throw new Error("no file in the tree opened with a diff");
  const after = await gate<{ treeShown: boolean; backShown: boolean }>(page, "panes");
  const { rows } = await gate<FileFacts>(page, "fileFacts");
  await shot(ctx, "tree-with-file");
  await audit(ctx, "file");
  return splitVerdict({
    treeShown: before.treeShown,
    fileShown: before.fileShown,
    treeRight: before.treeRight,
    fileLeft: before.fileLeft,
    rows,
    treeStillShown: after.treeShown,
    backShown: after.backShown,
  });
}

/** Every check of a run, by its width (single pane under WIDE_FROM, two panes from it); the audits of the screens it visited are added by the caller. */
async function runChecks(ctx: Ctx): Promise<Check[]> {
  const single = ctx.run.width < WIDE_FROM;
  const plain = isPlain(ctx.run);
  const walk = [
    ...(await visit(ctx, "overview")),
    ...(await visit(ctx, "tree")),
    ...(await visit(ctx, "order")),
    ...(single ? await visitFile(ctx) : []),
  ];
  const split = single
    ? []
    : [
        await attempt("split", () => checkSplit(ctx)),
        await attempt("diff-layout", () => checkDiffLayout(ctx)),
      ];
  const fonts = plain ? [] : [await attempt("fonts", () => checkFonts(ctx))];
  const driven: Check[] = [];
  if (single && !plain) {
    for (const [id, check] of PHONE_CHECKS) driven.push(await attempt(id, () => check(ctx)));
    const wanted = bridgeChecksFor(ctx.run);
    for (const [id, check] of BRIDGE_CHECKS) {
      if (wanted.includes(id)) driven.push(await attempt(id, () => check(ctx)));
    }
  }
  return [...walk, ...split, ...fonts, ...driven];
}

function watch(page: PwPage, errors: string[], failed: string[]): void {
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // A resource that failed to load is also in `failed`; for the hosts that may fail it is no error here.
    if (
      message.text().startsWith("Failed to load resource") &&
      isAllowedHost(message.location().url)
    )
      return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) =>
    failed.push(`${request.url()} ${request.failure()?.errorText ?? "failed"}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(`${response.url()} ${response.status()}`);
  });
}

async function runOne(
  browser: PwBrowser,
  run: Run,
  review: ReviewInfo,
  server: PageServer,
  standIn: StandIn,
  out: string,
): Promise<RunReport> {
  const origin = server.origin;
  const errors: string[] = [];
  const failed: string[] = [];
  let context: PwContext | undefined;
  let checks: Check[];
  try {
    context = await browser.newContext(contextOptions(run));
    context.setDefaultTimeout(ACTION_TIMEOUT_MS);
    await context.addInitScript(KIT);
    const page = await context.newPage();
    watch(page, errors, failed);
    const ctx: Ctx = {
      page,
      run,
      review,
      origin,
      out,
      steps: screenshotSteps(run),
      audits: [],
      failed,
      standIn,
      server,
      fault: {},
    };
    const ready = await attempt("ready", async () => {
      await page.goto(`${origin}${run.url}`, { waitUntil: "load", timeout: NAVIGATION_TIMEOUT_MS });
      await whenReady(page, run.scheme);
      return pass("the tree was built");
    });
    if (ready.ok) {
      const driven = await runChecks(ctx);
      checks = [...auditChecks(ctx.audits, isPlain(run)), ...driven];
    } else {
      checks = [ready];
    }
  } catch (e) {
    // A browser that died mid-run: the run reports it and the next run gets its own context.
    checks = [{ id: "run", ...fail(failure(e)) }];
  } finally {
    await context?.close().catch(() => undefined);
  }
  return { name: run.name, width: run.width, errors, failed, checks };
}

// ---------- the gate and the command ----------

export interface GateOptions {
  /** The built page folder. */
  dir: string;
  /** Where the screenshots and report.json go. */
  out: string;
  quick: boolean;
  playwright: Playwright;
  /** A Chromium executable, or undefined for Playwright's own default. */
  executablePath: string | undefined;
  review: ReviewInfo;
}

/** Serve the page, run the matrix in a real Chromium, write report.json, and return the report. */
export async function runGate(options: GateOptions): Promise<GateReport> {
  mkdirSync(options.out, { recursive: true });
  const standIn = createStandIn();
  const server = startServer(options.dir, standIn);
  let browser: PwBrowser | undefined;
  try {
    try {
      browser = await options.playwright.chromium.launch({
        headless: true,
        ...(options.executablePath === undefined ? {} : { executablePath: options.executablePath }),
      });
    } catch (e) {
      throw new BrowserUnavailable(failure(e));
    }
    const runs: RunReport[] = [];
    for (const run of matrix(options.quick)) {
      runs.push(await runOne(browser, run, options.review, server, standIn, options.out));
    }
    const report: GateReport = { runs };
    writeFileSync(join(options.out, "report.json"), JSON.stringify(report, null, 2));
    return report;
  } finally {
    await browser?.close().catch(() => undefined);
    server.stop();
  }
}

export interface Deps {
  env: Env;
  loadPlaywright(env: Env): Promise<Playwright | null>;
  chromiumPath(env: Env): string | undefined;
  tempDir(): string;
  gate(options: GateOptions): Promise<GateReport>;
}

const realDeps = (): Deps => ({
  env: process.env,
  loadPlaywright,
  chromiumPath,
  tempDir: () => mkdtempSync(join(tmpdir(), "review-page-gate-")),
  gate: runGate,
});

function readPage(dir: string): { ok: true; review: ReviewInfo } | { ok: false; error: string } {
  const index = join(dir, "index.html");
  const reviewFile = join(dir, "review.json");
  if (!existsSync(index))
    return { ok: false, error: `${index} is missing, so this is not a built review page` };
  if (!existsSync(reviewFile))
    return { ok: false, error: `${reviewFile} is missing, so this is not a built review page` };
  return readReview(readFileSync(reviewFile, "utf8"));
}

/** The whole command with its effects handed in: what to print, and the exit code. */
export async function cli(
  args: readonly string[],
  deps: Deps = realDeps(),
): Promise<{ code: number; out: string; err: string }> {
  const parsed = parseArgs(args);
  if (!parsed.ok) return { code: 1, out: "", err: `review-page-gate: ${parsed.error}\n${USAGE}\n` };
  const page = readPage(parsed.dir);
  if (!page.ok) return { code: 1, out: "", err: `review-page-gate: ${page.error}\n` };
  const playwright = await deps.loadPlaywright(deps.env);
  if (playwright === null) return { code: 2, out: "", err: `${describeMissing(deps.env)}\n` };
  const out = parsed.out ?? deps.tempDir();
  try {
    const report = await deps.gate({
      dir: parsed.dir,
      out,
      quick: parsed.quick,
      playwright,
      executablePath: deps.chromiumPath(deps.env),
      review: page.review,
    });
    return {
      code: judge(report).ok ? 0 : 1,
      out: `${shortReport(report)}\nscreenshots and report.json: ${out}\n`,
      err: "",
    };
  } catch (e) {
    if (e instanceof BrowserUnavailable) {
      return { code: 2, out: "", err: `${describeMissing(deps.env)}\n${e.message}\n` };
    }
    throw e;
  }
}

export async function main(args: readonly string[]): Promise<number> {
  const result = await cli(args);
  if (result.out !== "") process.stdout.write(result.out);
  if (result.err !== "") process.stderr.write(result.err);
  return result.code;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
