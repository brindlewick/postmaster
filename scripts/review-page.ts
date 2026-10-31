// Build a review page or a code viewer page as one self-contained HTML file, for a session
// to publish on the Artifact Shelf. skills/review-pages/SKILL.md says how a page is published
// and how its comments are read and answered.
//
//   scripts/run review-page change <out-dir> --pr <number>
//   scripts/run review-page change <out-dir> --base <ref> --head <ref> [--ticket <number>] [--title <text>]
//                  [--summary <file>]
//   scripts/run review-page files <out-dir> <ref> <path>...
//
// change: diffs the head against its merge base with the base, as GitHub does, and writes
// <out-dir>/index.html, the review page titled for its ticket, with every file's diff and text
// inline. With --pr, the title, the summary (the pull request's text), the base and the head
// come from `gh api` on the repository's origin. With --ticket, or a pull request titled
// "#<n>, <title>", the ticket's text comes from that issue. --summary is a Markdown file
// containing the change's summary. Files are grouped by their first folder, top-level files
// first, and the page draws a file's diff and text only when it is opened.
//
// files: writes the code viewer with each path as it stands at <ref> inline: <out-dir>/index.html,
// or index-1.html, index-2.html and so on when the files pass the shelf's limit together. Each
// file keeps its id (f0, f1, ...) whichever page holds it.
//
// Either way, an email address outside the reserved example domains becomes <address removed>,
// with line numbers unchanged, and a page over the shelf's 10 MB limit is refused. Run it from
// the repository the change belongs to.
//
//   exit 0  written; a summary line is printed, then one line per page: its path and its
//           shelf slug, and for the viewer the ids of the files it holds
//   exit 1  usage, git or gh failed, or a page would pass the limit
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { dataBlock, langOf, SHELF_LIMIT, scrub, shelfSlug, withData } from "./lib/page-text.ts";
import { run } from "./lib/proc.ts";

export { langOf, scrub };

export const USAGE = [
  "usage: review-page.ts change <out-dir> --pr <number>",
  "       review-page.ts change <out-dir> --base <ref> --head <ref> [--ticket <number>] [--title <text>] [--summary <file>]",
  "       review-page.ts files <out-dir> <ref> <path>...",
].join("\n");

const TEMPLATES = join(import.meta.dir, "..", "skills", "review-pages");

/** Lines in a file's text: a final newline ends the last line rather than starting one. */
export function lineCount(text: string): number {
  if (text === "") return 0;
  return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

export interface Change {
  path: string;
  old: string | null;
  status: string;
  add: number;
  del: number;
  binary: boolean;
}

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

/** Group by first folder, top-level files first, each group and its files in path order. */
export function groupChanges(changes: Change[]): {
  order: { title: string }[];
  files: (Change & { group: number })[];
} {
  const folder = (p: string): string => (p.includes("/") ? (p.split("/")[0] ?? "") : "");
  const names = [...new Set(changes.map((c) => folder(c.path)))].sort((a, b) =>
    a === "" ? -1 : b === "" ? 1 : a.localeCompare(b),
  );
  const order = names.map((n) => ({ title: n === "" ? "Top level" : `${n}/` }));
  const files = [...changes]
    .sort(
      (a, b) =>
        names.indexOf(folder(a.path)) - names.indexOf(folder(b.path)) ||
        a.path.localeCompare(b.path),
    )
    .map((c) => ({ ...c, group: names.indexOf(folder(c.path)) }));
  return { order, files };
}

/** The page each item goes in: a new page once the next item would pass the limit. */
export function packChunks(sizes: number[], limit: number): number[] {
  const out: number[] = [];
  let k = 0;
  let size = 0;
  for (const n of sizes) {
    if (size > 0 && size + n > limit) {
      k += 1;
      size = 0;
    }
    out.push(k);
    size += n;
  }
  return out;
}

/** The template with its title replaced. */
export function titled(template: string, title: string): string {
  const safe = title.replace(/[<>&]/gu, "");
  return template.replace(/<title>[^<]*<\/title>/u, `<title>${safe}</title>`);
}

/** Refuse a page the shelf would refuse: the error names its size and the limit. */
export function checkSize(name: string, html: string, limit: number = SHELF_LIMIT): void {
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > limit) {
    const mb = (n: number): string => (n / 1024 / 1024).toFixed(1);
    throw new Error(`${name} is ${mb(bytes)} MB, over the shelf's ${mb(limit)} MB limit`);
  }
}

// ---------- edges ----------

function git(args: string[]): string {
  const r = run("git", args);
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

/** The repository's name, for the page's slug: its main checkout's folder, from any worktree. */
function repoName(): string {
  const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"]).trim();
  return basename(common) === ".git" ? basename(dirname(common)) : basename(common, ".git");
}

function buildChange(out: string, args: string[]): string[] {
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
  const summaryFile = flag(args, "--summary");
  if (summaryFile) body = readFileSync(summaryFile, "utf8");
  const mb = git(["merge-base", base, head]).trim();
  const changes = parseChanges(
    git(["diff", "--numstat", "-M", mb, head]),
    git(["diff", "--name-status", "-M", mb, head]),
  );
  const { order, files } = groupChanges(changes);
  let removed = 0;
  const items = files.map((f, i) => {
    const paths = f.old ? [f.old, f.path] : [f.path];
    const diff = f.binary
      ? { text: "", removed: 0 }
      : scrub(git(["diff", "-U3", "-M", mb, head, "--", ...paths]));
    const text = f.status === "D" || f.binary ? null : scrub(git(["show", `${head}:${f.path}`]));
    removed += diff.removed + (text ? text.removed : 0);
    return { i, diff: diff.text, text: text ? text.text : null };
  });
  const additions = files.reduce((n, f) => n + f.add, 0);
  const deletions = files.reduce((n, f) => n + f.del, 0);
  const review = {
    pr,
    ticket: ticket ? Number(ticket) : null,
    ticketTitle: title || `${head.slice(0, 7)} against ${mb.slice(0, 7)}`,
    ticketBody: scrub(ticketBody).text,
    body: scrub(body).text,
    mergedAt,
    base: mb,
    head,
    additions,
    deletions,
    changedFiles: files.length,
    order,
    redactions: removed,
    files: files.map((f, i) => ({
      ...f,
      lang: langOf(f.path),
      lines: items[i]?.text == null ? null : lineCount(items[i]?.text ?? ""),
    })),
  };
  const name = ticket ? `#${ticket} review` : `${head.slice(0, 7)} review`;
  const html = withData(titled(readFileSync(join(TEMPLATES, "review-page.html"), "utf8"), name), [
    dataBlock("review-data", review),
    dataBlock("review-items", items),
  ]);
  checkSize("the review page", html);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "index.html"), html);
  const mbytes = (Buffer.byteLength(html, "utf8") / 1024 / 1024).toFixed(1);
  const slug = shelfSlug(["review", repoName(), ticket ?? head.slice(0, 7)]);
  return [
    `review page for ${name.replace(/ review$/u, "")}: ${files.length} files, +${additions} -${deletions}, ${mbytes} MB, ${removed} address(es) removed`,
    `${join(out, "index.html")} ${slug}`,
  ];
}

function buildFiles(out: string, ref: string, paths: string[]): string[] {
  if (paths.length === 0) throw new Error(USAGE);
  const sha = git(["rev-parse", "--verify", `${ref}^{commit}`]).trim();
  let removed = 0;
  const files = paths.map((p, k) => {
    const t = scrub(git(["show", `${sha}:${p}`]));
    removed += t.removed;
    return { id: `f${k}`, path: p, lang: langOf(p), lines: lineCount(t.text), text: t.text };
  });
  const template = titled(readFileSync(join(TEMPLATES, "viewer.html"), "utf8"), "Code");
  // Room for the template and the page's own fields around the files.
  const room = SHELF_LIMIT - Buffer.byteLength(template, "utf8") - 4096;
  const pageOf = packChunks(
    files.map((f) => Buffer.byteLength(dataBlock("", f), "utf8")),
    room,
  );
  const count = (pageOf.at(-1) ?? 0) + 1;
  const pages = Array.from({ length: count }, (_, p) => files.filter((_, i) => pageOf[i] === p));
  const whole =
    paths.length === 1 ? (paths[0] ?? "Code") : `${paths.length} files at ${sha.slice(0, 7)}`;
  const htmls = pages.map((list, p) => {
    const title = count === 1 ? whole : `${whole}, part ${p + 1} of ${count}`;
    const html = withData(titled(template, count === 1 ? "Code" : `Code ${p + 1} of ${count}`), [
      dataBlock("files-data", { title, ref: sha, files: list }),
    ]);
    checkSize(list.length === 1 ? (list[0]?.path ?? "a file") : `page ${p + 1}`, html);
    return html;
  });
  mkdirSync(out, { recursive: true });
  const name = repoName();
  const lines = htmls.map((html, p) => {
    const file = join(out, count === 1 ? "index.html" : `index-${p + 1}.html`);
    writeFileSync(file, html);
    const slug = shelfSlug(["code", name, sha.slice(0, 7), ...(count === 1 ? [] : [`${p + 1}`])]);
    return `${file} ${slug}: ${(pages[p] ?? []).map((f) => f.id).join(" ")}`;
  });
  return [
    `code viewer: ${files.length} file(s) at ${sha.slice(0, 7)}, ${count} page(s), ${removed} address(es) removed`,
    ...lines,
  ];
}

export function main(args: string[]): number {
  const [mode, out, ...rest] = args;
  try {
    if (mode === "change" && out) {
      for (const line of buildChange(out, rest)) console.log(line);
      return 0;
    }
    if (mode === "files" && out && rest[0]) {
      for (const line of buildFiles(out, rest[0], rest.slice(1))) console.log(line);
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
