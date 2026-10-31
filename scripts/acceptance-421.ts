// Oracle helpers for #421: one command keeps a project's experiments, a
// page on the Artifact Shelf shows them, the postmaster keeps both current,
// and the README states the design goal. The tests spawn scripts/run and git
// as subprocesses over scratch repositories, and run the page's own script in
// a fresh process with its inline rows and a stub document; nothing here
// imports the change.
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beside, toolRoot } from "./lib/paths.ts";
import { type RunResult, run } from "./lib/proc.ts";

export const RUN = beside(import.meta, "run");
export const TOOL = toolRoot(import.meta);
export const EXPERIMENTS = join(TOOL, "scripts", "experiments.ts");
export const PAGE = join(TOOL, "skills", "experiments", "experiments-page.html");
export const SKILL = join(TOOL, "skills", "experiments", "SKILL.md");
export const POSTMASTER_MD = join(TOOL, "skills", "postmaster", "postmaster.md");
export const README = join(TOOL, "README.md");

export interface Staged {
  dir: string;
  repo: string;
}

export function tempDir(): string {
  // Resolved: the command prints git-resolved paths, and the tests compare
  // them with paths under this folder, which differ where tmp is a symlink.
  return realpathSync(mkdtempSync(join(tmpdir(), "acceptance-421-")));
}

/** A scratch git repository with one commit, as the ticket's checks stage it. */
export function stage(): Staged {
  const dir = tempDir();
  const repo = join(dir, "repo");
  mkdirSync(repo, { recursive: true });
  let r = run("git", ["init", "-q", "-b", "main", repo]);
  if (r.code !== 0) throw new Error(`git init: ${r.err.trim() || r.out.trim()}`);
  writeFileSync(join(repo, "note.txt"), "scratch\n");
  const identity = [
    "-c",
    "user.name=oracle",
    "-c",
    "user.email=oracle@example.invalid",
    "-c",
    "commit.gpgsign=false",
  ];
  r = run("git", ["-C", repo, ...identity, "add", "note.txt"]);
  if (r.code !== 0) throw new Error(`git add: ${r.err.trim() || r.out.trim()}`);
  r = run("git", ["-C", repo, ...identity, "commit", "-q", "-m", "one"]);
  if (r.code !== 0) throw new Error(`git commit: ${r.err.trim() || r.out.trim()}`);
  return { dir, repo };
}

export function cleanup(s: Staged): void {
  rmSync(s.dir, { recursive: true, force: true });
}

/** The command under test, form first, its project always explicit. */
export function experiments(repo: string, form: string, args: string[]): RunResult {
  return run(RUN, ["experiments", form, "--project", repo, ...args]);
}

export function asRecord(v: unknown): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new Error(`want an object, saw: ${JSON.stringify(v)}`);
  }
  return v as Record<string, unknown>;
}

export function str(v: unknown): string {
  if (typeof v !== "string") throw new Error(`want a string, saw: ${JSON.stringify(v)}`);
  return v;
}

function jsonLines(path: string): Record<string, unknown>[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l !== "")
    .map((l) => asRecord(JSON.parse(l) as unknown));
}

export function recordLines(repo: string): Record<string, unknown>[] {
  return jsonLines(join(repo, ".postmaster", "experiments.jsonl"));
}

export function ledgerLines(repo: string): Record<string, unknown>[] {
  return jsonLines(join(repo, ".postmaster", "runs", "ledger.jsonl"));
}

export function porcelain(repo: string): string {
  const r = run("git", ["-C", repo, "status", "--porcelain"]);
  if (r.code !== 0) throw new Error(`git status: ${r.err.trim() || r.out.trim()}`);
  return r.out;
}

/** A UTC calendar date, offset in days from today. */
export function utcDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

// --- the page, run as it ships ------------------------------------------------
// The harness reads the page file, takes its one inline script, and runs it
// in a fresh process with a stub document whose data block holds canned rows
// (or the block the built page carries) and that captures what the page
// mounts. The page must reach nothing else: no fetch, no storage, no location.

export interface PageDoc {
  id: string;
  row: Record<string, unknown>;
}

export interface PageRender {
  first: string | null;
  asOf: string | null;
}

const HARNESS = [
  'import { readFileSync } from "node:fs";',
  "const params = JSON.parse(readFileSync(process.argv[2], 'utf8'));",
  "const html = readFileSync(params.page, 'utf8');",
  'const parts = html.split("<script>");',
  "if (parts.length !== 2 || !parts[1].includes('</' + 'script>')) {",
  "  console.error('harness: want exactly one inline script');",
  "  process.exit(3);",
  "}",
  "const code = parts[1].split('</' + 'script>')[0];",
  "const els = new Map();",
  "function el(id) {",
  '  if (!els.has(id)) els.set(id, { innerHTML: "", textContent: "" });',
  "  return els.get(id);",
  "}",
  'const open = \'<script type="application/json" id="experiments-data">\';',
  "const at = html.indexOf(open);",
  "if (at >= 0) el('experiments-data').textContent = html.slice(at + open.length, html.indexOf('</' + 'script>', at));",
  "else if (params.docs !== null) el('experiments-data').textContent = JSON.stringify({",
  "  asOf: '2026-10-30 14:05 UTC',",
  "  rows: Object.fromEntries(params.docs.map((d) => [d.id, d.row])),",
  "});",
  "const documentStub = {",
  '  readyState: "complete",',
  "  getElementById: (id) => el(id),",
  "  addEventListener: () => {},",
  "};",
  'new Function("window", "document", code)({}, documentStub);',
  "await new Promise((r) => setTimeout(r, 50));",
  'const first = els.has("app") ? els.get("app").innerHTML : null;',
  'const asOf = els.has("asof") ? els.get("asof").textContent : null;',
  "console.log(JSON.stringify({ first, asOf }));",
  "",
].join("\n");

/**
 * Mount the page: the template against canned rows, docs null standing for a
 * page built with no data; or, given a built page's path, that page as built.
 */
export function renderPage(docs: PageDoc[] | null, built?: string): PageRender {
  const dir = tempDir();
  try {
    const harness = join(dir, "harness.mjs");
    const params = join(dir, "params.json");
    writeFileSync(harness, HARNESS);
    writeFileSync(params, JSON.stringify({ page: built ?? PAGE, docs }));
    const r = run(process.execPath, [harness, params]);
    if (r.code !== 0) {
      throw new Error(`page harness: exit ${r.code}\n--- out ---\n${r.out}\n--- err ---\n${r.err}`);
    }
    const v = asRecord(JSON.parse(r.out) as unknown);
    const text = (k: string): string | null => {
      const u = v[k];
      return u === null ? null : str(u);
    };
    return { first: text("first"), asOf: text("asOf") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
