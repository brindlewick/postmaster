// The registrations a test run leaves in the tool's git folder. Tests pin the tool at its own commit
// in a temporary folder (run-meta pin), and deleting that folder leaves its entry under the
// repository's git folder, where `git worktree list` shows it as prunable. The test preload
// (test-defaults.ts) removes such entries when a run starts, for what an interrupted run left, and
// when a test file ends. An entry is removed only when its folder is gone and it sits under the
// system temporary folder: every other worktree, and every locked one, is left to its owner.
import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { sep } from "node:path";
import { run } from "./proc.ts";

/** A hung git must not hang the run it cleans up after. */
const GIT_TIMEOUT_MS = 20_000;

/** The checkouts in `git worktree list --porcelain` output that sit under `root`, have lost their
 * folder (`exists` says so) and are not locked. The first entry is the repository's own checkout
 * and is never one. */
export function strayWorktrees(
  porcelain: string,
  root: string,
  exists: (path: string) => boolean,
): string[] {
  const under = root.endsWith(sep) ? root : `${root}${sep}`;
  return porcelain
    .split("\n\n")
    .slice(1)
    .flatMap((block) => {
      const lines = block.split("\n");
      const head = lines[0] ?? "";
      if (!head.startsWith("worktree ")) return [];
      const path = head.slice("worktree ".length);
      const locked = lines.some((line) => line === "locked" || line.startsWith("locked "));
      return path.startsWith(under) && !locked && !exists(path) ? [path] : [];
    });
}

/** The system temporary folder as git prints paths under it: symlinks resolved. */
function systemTemp(): string {
  try {
    return realpathSync(tmpdir());
  } catch {
    return tmpdir();
  }
}

/** Remove the strays of the repository at `repo` that sit under `root` (the system temporary
 * folder unless given) and return the paths removed. Housekeeping, so a listing or a removal
 * that fails leaves its entry and never fails the run. */
export function removeStrayWorktrees(repo: string, root: string = systemTemp()): string[] {
  const listed = run("git", ["-C", repo, "worktree", "list", "--porcelain"], {
    timeout: GIT_TIMEOUT_MS,
  });
  if (listed.code !== 0) return [];
  const removed: string[] = [];
  for (const path of strayWorktrees(listed.out, root, existsSync)) {
    const r = run("git", ["-C", repo, "worktree", "remove", path], { timeout: GIT_TIMEOUT_MS });
    if (r.code === 0) removed.push(path);
  }
  return removed;
}
