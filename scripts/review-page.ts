// Build the data a review page or a code viewer page shows, for a session to publish as a
// private artifact. skills/review-pages/SKILL.md says how a page is published and how its
// comments are read and answered; docs/review-page.md says what the page is, and
// docs/review-page/improve-it.md how it is made and improved.
//
//   scripts/run review-page change <out-dir> --pr <number> [options]
//   scripts/run review-page change <out-dir> --base <ref> --head <ref> [--ticket <number>]
//                  [--title <text>] [--ticket-body <file>] [--summary <file>] [options]
//   scripts/run review-page demo <out-dir> [options]
//   scripts/run review-page files <out-dir> <ref> <path>...
//
// options:  --layout <file>      a layout config (JSON) merged over the default one
//           --purposes <file>    a JSON object of file path to one-line purpose
//           --page-title <name>  the page's name, which is the artifact's title (default Code Review)
//           --key <name>         prefix of what the page keeps in the reader's browser (default review-page)
//
// change: diffs the head against its merge base with the base, as GitHub does, and writes
// <out-dir>/index.html (the phone-first review page, assembled from skills/review-pages/page),
// review.json and chunks/<k>.json, which index.html loads, and <out-dir>/publish.html: the same page
// with that data inside it, the one file to publish. Files are grouped by importance, ordered and described by the
// layout (skills/review-pages/page/layout.default.json, then --layout and --purposes), and the page
// loads a file's diff only when it is opened. With --pr, the title, the summary (the pull request's
// text), the base and the head come from `gh api` on the repository's origin. With --ticket, or a
// pull request titled "#<n>, <title>", the ticket's text comes from that issue; --ticket-body is a
// Markdown file holding the ticket's text instead, for a ticket that is not a GitHub issue.
// --summary is a Markdown file containing the change's summary.
//
// demo: builds the same page for an invented sample repository made in a temporary folder, so a
// session can see the page, and the page's own tests have a fixed input.
//
// files: writes the code viewer as one file, <out-dir>/index.html, with each path as it stands at <ref>
// inside it (the files are f0, f1, ... in the order given), the one file to publish.
//
// Either way, an email address outside the reserved example domains becomes <address removed>,
// with line numbers unchanged. Run it from the repository the change belongs to.
//
//   exit 0  written; one summary line is printed
//   exit 1  usage, a layout that does not parse or names what the change lacks, or git or gh failed
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dataBlock, langOf, scrub, withData } from "./lib/page-text.ts";
import { run } from "./lib/proc.ts";
import { assemblePage } from "./lib/review-assemble.ts";
import { loadPageAssets } from "./lib/review-assets.ts";
import {
  type ChangedFile,
  EMPTY_LAYOUT,
  type LayoutConfig,
  mergeLayout,
  parseLayoutPartial,
} from "./lib/review-layout.ts";
import { buildReviewData, type ChangeText, packChunks } from "./lib/review-model.ts";
import { chunkBlockId, reviewBlockId } from "./lib/review-source.ts";
import { createSampleRepo, SAMPLE_LAYOUT, SAMPLE_SUMMARY } from "./lib/review-sample.ts";

export { langOf, packChunks, scrub };

export const USAGE = [
  "usage: review-page.ts change <out-dir> --pr <number> [options]",
  "       review-page.ts change <out-dir> --base <ref> --head <ref> [--ticket <number>] [--title <text>] [--ticket-body <file>] [--summary <file>] [options]",
  "       review-page.ts demo <out-dir> [options]",
  "       review-page.ts files <out-dir> <ref> <path>...",
  "options: --layout <file>  --purposes <file>  --page-title <name>  --key <name>",
].join("\n");

const CHUNK_BYTES = 1_500_000;
const TOOL = join(import.meta.dir, "..");
const TEMPLATES = join(TOOL, "skills", "review-pages");

/** Lines in a file's text: a final newline ends the last line rather than starting one. */
export function lineCount(text: string): number {
  if (text === "") return 0;
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

export type Change = ChangedFile;

/** git diff --numstat -M and --name-status -M, read together. */
export function parseChanges(numstat: string, nameStatus: string): Change[] {
  const status = new Map<string, { kind: string; old: string | null }>();
  for (const line of nameStatus.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    const kind = (parts[0] ?? "M").charAt(0);
    status.set(parts.at(-1) ?? "", {
      kind,
      old: kind === "R" || kind === "C" ? (parts[1] ?? null) : null,
    });
  }
  const changes: Change[] = [];
  for (const line of numstat.split("\n")) {
    if (!line.trim()) continue;
    const [add = "0", del = "0", ...rest] = line.split("\t");
    const raw = rest.join("\t");
    const path = raw.includes(" => ")
      ? raw
          .replace(/\{([^{}]*) => ([^{}]*)\}/u, "$2")
          .replace(/\/\//gu, "/")
          .replace(/^.* => /u, "")
      : raw;
    const s = status.get(path) ?? { kind: "M", old: null };
    const binary = add === "-";
    changes.push({
      path,
      old: s.old,
      status: s.kind,
      add: binary ? 0 : Number(add),
      del: binary ? 0 : Number(del),
      binary,
    });
  }
  return changes;
}

/** The template with its title replaced. */
export function titled(template: string, title: string): string {
  const safe = title.replace(/[<>&]/gu, "");
  return template.replace(/<title>[^<]*<\/title>/u, `<title>${safe}</title>`);
}

/** The default layout, then each extra config merged over it, in order; the problems they carry. */
export function layoutFrom(extra: readonly unknown[]): {
  layout: LayoutConfig;
  problems: string[];
} {
  const defaults: unknown = JSON.parse(
    readFileSync(join(TEMPLATES, "page", "layout.default.json"), "utf8"),
  );
  let layout = EMPTY_LAYOUT;
  const problems: string[] = [];
  for (const raw of [defaults, ...extra]) {
    const parsed = parseLayoutPartial(raw);
    problems.push(...parsed.problems);
    layout = mergeLayout(layout, parsed.over);
  }
  return { layout, problems };
}

// ---------- edges ----------

function git(args: string[], cwd?: string): string {
  const r = run("git", args, cwd === undefined ? {} : { cwd });
  if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.err.trim() || `exit ${r.code}`}`);
  return r.out;
}

function gh(path: string): Record<string, unknown> {
  const r = run("gh", ["api", path]);
  if (r.code !== 0) throw new Error(`gh api ${path}: ${r.err.trim() || `exit ${r.code}`}`);
  return JSON.parse(r.out) as Record<string, unknown>;
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function readJson(path: string, what: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`${what} ${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function extraLayouts(args: string[]): unknown[] {
  const layoutFile = flag(args, "--layout");
  const purposesFile = flag(args, "--purposes");
  return [
    ...(layoutFile ? [readJson(layoutFile, "layout")] : []),
    ...(purposesFile ? [{ purposes: readJson(purposesFile, "purposes") }] : []),
  ];
}

interface Facts {
  pr: number | null;
  ticket: number | null;
  title: string;
  ticketBody: string;
  body: string;
  mergedAt: string | null;
  base: string;
  head: string;
}

/** Build the page for the change between two refs of the repository at `cwd`. */
function buildFrom(out: string, args: string[], facts: Facts, extra: unknown[], cwd?: string) {
  const { layout, problems } = layoutFrom(extra);
  if (problems.length > 0) throw new Error(`layout: ${problems.join("; ")}`);
  const mb = git(["merge-base", facts.base, facts.head], cwd).trim();
  const changes = parseChanges(
    git(["diff", "--numstat", "-M", mb, facts.head], cwd),
    git(["diff", "--name-status", "-M", mb, facts.head], cwd),
  );
  // Only a file a ruling points into is read whole: its text resolves the ruling's lines.
  const wanted = new Set(layout.rulings.flatMap((r) => r.links.map((l) => l.path)));
  let removed = 0;
  const inputs = changes.map((f): ChangeText => {
    const paths = f.old ? [f.old, f.path] : [f.path];
    const diff = f.binary
      ? { text: "", removed: 0 }
      : scrub(git(["diff", "-U3", "-M", mb, facts.head, "--", ...paths], cwd));
    const text =
      wanted.has(f.path) && f.status !== "D" && !f.binary
        ? scrub(git(["show", `${facts.head}:${f.path}`], cwd))
        : null;
    removed += diff.removed + (text ? text.removed : 0);
    // A binary file has no diff to show, so the id of its content at the head stands in for it.
    const blob =
      f.binary && f.status !== "D"
        ? git(["rev-parse", `${facts.head}:${f.path}`], cwd).trim()
        : undefined;
    return {
      change: f,
      diff: diff.text,
      text: text ? text.text : null,
      ...(blob === undefined ? {} : { blob }),
    };
  });
  const key = flag(args, "--key");
  const built = buildReviewData({
    inputs,
    layout,
    meta: {
      pr: facts.pr,
      ticket: facts.ticket,
      ticketTitle: facts.title || `${facts.head.slice(0, 7)} against ${mb.slice(0, 7)}`,
      ticketBody: scrub(facts.ticketBody).text,
      body: scrub(facts.body).text,
      mergedAt: facts.mergedAt,
      base: mb,
      head: facts.head,
      redactions: removed,
      ...(key === undefined ? {} : { storageKey: key }),
    },
    chunkBytes: CHUNK_BYTES,
  });
  if (built.problems.length > 0) throw new Error(`layout: ${built.problems.join("; ")}`);
  mkdirSync(join(out, "chunks"), { recursive: true });
  for (const name of readdirSync(join(out, "chunks"))) {
    if (/^[0-9]+\.json$/u.test(name)) rmSync(join(out, "chunks", name));
  }
  built.chunks.forEach((items, k) => {
    writeFileSync(join(out, "chunks", `${k}.json`), JSON.stringify(items));
  });
  writeFileSync(join(out, "review.json"), JSON.stringify(built.review));
  const pageTitle = flag(args, "--page-title") ?? "Code Review";
  const page = assemblePage({ ...loadPageAssets(TOOL), title: pageTitle });
  writeFileSync(join(out, "index.html"), page);
  // The same page with its data inside it: the one file to publish, for a host that stores one file.
  writeFileSync(
    join(out, "publish.html"),
    withData(page, [
      dataBlock(reviewBlockId(), built.review),
      ...built.chunks.map((items, k) => dataBlock(chunkBlockId(k), items)),
    ]),
  );
  const files = built.review.files;
  const heuristic = files.filter((f) => f.purposeSource === "heuristic").length;
  const withheld = files.filter((f) => f.withheld !== undefined).length;
  return `review page for ${facts.head.slice(0, 7)}: ${files.length} files in ${built.review.groups.length} groups, +${built.review.additions} -${built.review.deletions}, ${built.chunks.length} chunk(s), ${removed} address(es) removed, ${heuristic} purpose(s) from the heuristics, ${withheld} withheld, in ${out}\npage to publish: ${join(out, "publish.html")}`;
}

function buildChange(out: string, args: string[]): string {
  const prArg = flag(args, "--pr");
  let base = flag(args, "--base");
  let head = flag(args, "--head");
  let ticket = flag(args, "--ticket");
  let title = flag(args, "--title") ?? "";
  let body = "";
  let mergedAt: string | null = null;
  let pr: number | null = null;
  if (prArg) {
    const p = gh(`repos/{owner}/{repo}/pulls/${prArg}`);
    pr = Number(prArg);
    base = String((p.base as Record<string, unknown>).sha);
    head = String((p.head as Record<string, unknown>).sha);
    body = String(p.body ?? "");
    mergedAt = (p.merged_at as string | null) ?? null;
    title = String(p.title ?? "");
    const m = /^#([0-9]+), (.*)$/u.exec(title);
    if (m && !ticket) {
      ticket = m[1];
      title = m[2] ?? title;
    }
  }
  if (!base || !head) throw new Error(USAGE);
  let ticketBody = "";
  if (ticket) {
    const issue = gh(`repos/{owner}/{repo}/issues/${ticket}`);
    ticketBody = String(issue.body ?? "");
    if (!title) title = String(issue.title ?? "");
  }
  const ticketFile = flag(args, "--ticket-body");
  if (ticketFile) ticketBody = readFileSync(ticketFile, "utf8");
  const summaryFile = flag(args, "--summary");
  if (summaryFile) body = readFileSync(summaryFile, "utf8");
  return buildFrom(
    out,
    args,
    { pr, ticket: ticket ? Number(ticket) : null, title, ticketBody, body, mergedAt, base, head },
    extraLayouts(args),
  );
}

function buildDemo(out: string, args: string[]): string {
  const parent = mkdtempSync(join(tmpdir(), "review-demo-"));
  try {
    const repo = createSampleRepo(parent);
    const given = (name: string): boolean => args.includes(name);
    const pageArgs = [
      ...(given("--page-title") ? [] : ["--page-title", "Mobile Review Demo"]),
      ...(given("--key") ? [] : ["--key", "review-demo"]),
      ...args,
    ];
    return buildFrom(
      out,
      pageArgs,
      {
        pr: null,
        ticket: null,
        title: "Gift wrapping in the cart",
        ticketBody: "",
        body: SAMPLE_SUMMARY,
        mergedAt: null,
        base: repo.base,
        head: repo.head,
      },
      [SAMPLE_LAYOUT, ...extraLayouts(args)],
      repo.dir,
    );
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}

function buildFiles(out: string, ref: string, paths: string[]): string {
  if (paths.length === 0) throw new Error(USAGE);
  const sha = git(["rev-parse", "--verify", `${ref}^{commit}`]).trim();
  let removed = 0;
  const files = paths.map((p, k) => {
    const t = scrub(git(["show", `${sha}:${p}`]));
    removed += t.removed;
    return { id: `f${k}`, path: p, lang: langOf(p), lines: lineCount(t.text), text: t.text };
  });
  const title =
    paths.length === 1 ? (paths[0] ?? "Code") : `${paths.length} files at ${sha.slice(0, 7)}`;
  const html = withData(titled(readFileSync(join(TEMPLATES, "viewer.html"), "utf8"), "Code"), [
    dataBlock("files-data", { title, ref: sha, files }),
  ]);
  mkdirSync(out, { recursive: true });
  const page = join(out, "index.html");
  writeFileSync(page, html);
  return `code viewer: ${files.length} file(s) at ${sha.slice(0, 7)}, ${removed} address(es) removed, in ${out}\npage to publish: ${page}`;
}

export function main(args: string[]): number {
  const [mode, out, ...rest] = args;
  try {
    if (mode === "change" && out) {
      console.log(buildChange(out, rest));
      return 0;
    }
    if (mode === "demo" && out) {
      console.log(buildDemo(out, rest));
      return 0;
    }
    if (mode === "files" && out && rest[0]) {
      console.log(buildFiles(out, rest[0], rest.slice(1)));
      return 0;
    }
    console.error(USAGE);
    return 1;
  } catch (e) {
    console.error(`review-page: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
