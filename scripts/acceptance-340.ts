// Oracle helpers for #340: postmaster's own .postmaster/ is never committed.
// C1 asserts `git ls-files .postmaster` prints nothing at the repo root.
// C2 asserts the gate's check fails on a tracked root .postmaster file and
// names it, passes when clean, and ignores a nested postmaster folder.
// The tests spawn git and scripts/run as subprocesses; nothing here imports
// the change.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { beside, toolRoot } from "./lib/paths.ts";
import { run } from "./lib/proc.ts";

export const ROOT = toolRoot(import.meta);
export const RUN = beside(import.meta, "run");

export function gitOrThrow(repo: string, ...args: string[]): string {
  const r = run("git", ["-C", repo, ...args]);
  if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.err.trim() || r.out.trim()}`);
  return r.out;
}

export function initRepo(repo: string): void {
  const r = run("git", ["init", "-q", "-b", "main", repo]);
  if (r.code !== 0) throw new Error(`git init: ${r.err.trim() || r.out.trim()}`);
  gitOrThrow(repo, "config", "user.name", "brindlewick");
  gitOrThrow(repo, "config", "user.email", "332054101+brindlewick@users.noreply.github.com");
}

export function writeRepoFile(repo: string, rel: string, text: string): void {
  const target = join(repo, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

export function commitAll(repo: string, message: string): void {
  gitOrThrow(repo, "add", ".");
  gitOrThrow(repo, "commit", "-q", "-m", message);
}
