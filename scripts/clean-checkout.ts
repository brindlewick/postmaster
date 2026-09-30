#!/usr/bin/env bun
// Run a command in a clean checkout of a branch, outside the project folder, so a project
// tool that walks the whole folder never reads the run's working copies under .worktrees/.
// Why: wiki/concepts/clean-checkout-gates.md.
//
//   bun scripts/clean-checkout.ts <repo> <branch> <command>
//
// Makes a detached git worktree of <branch> (a branch, tag, or commit) in a temporary
// directory outside the project folder, populates its submodules where the branch has any,
// runs <command> there through bash -e -o pipefail (the project check contract's flags),
// removes the checkout afterwards even when the command fails, and reports the command's
// exit. The checkout holds only that branch's content: no .worktrees/, no uncommitted
// files. A git worktree, rather than an archive export, so gates that read git metadata
// keep working.
//
//   exit 0..255  the command's own exit, which wins whenever the command ran, even when
//                the checkout could not be removed afterwards (that failure is on stderr)
//   exit 1       usage, no such repo or branch, the checkout could not be made (the command
//                is not run), or the checkout could not be removed after a passing command
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, realpathSync, rmSync, rmdirSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { tmpdir } from "node:os";

export type CleanCheckoutResult = {
  readonly exitCode: number;
  readonly checkoutPath: string;
};

const contains = (parent: string, child: string): boolean => {
  const rel = relative(parent, child);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
};

const temporaryRoot = (repo: string): string => {
  const candidates = [...new Set([tmpdir(), dirname(repo)])];
  for (const candidate of candidates) {
    try {
      const parent = realpathSync(candidate);
      if (!contains(repo, parent)) return mkdtempSync(join(parent, "postmaster-clean-checkout-"));
    } catch {
      // Try the next parent when this one is unavailable or inside the project.
    }
  }
  throw new Error(`could not create a temporary checkout outside ${repo}`);
};

const status = (result: ReturnType<typeof spawnSync>): number => result.status ?? 1;

const gitOk = (repo: string, args: string[]): boolean =>
  spawnSync("git", ["-C", repo, ...args], { stdio: "ignore" }).status === 0;

export const cleanCheckout = (repoArg: string, branch: string, command: string): CleanCheckoutResult => {
  if (!repoArg || !branch || !command) throw new Error("repo, branch and command are required");

  const repo = realpathSync(repoArg);
  if (!gitOk(repo, ["rev-parse", "--show-toplevel"])) throw new Error(`${repoArg} is not in a git repository`);
  if (!gitOk(repo, ["rev-parse", "--verify", "-q", `${branch}^{commit}`]))
    throw new Error(`${repo} has no branch or commit ${branch}`);

  const scratch = temporaryRoot(repo);
  const checkoutPath = join(scratch, "checkout");
  const added = spawnSync("git", ["-C", repo, "worktree", "add", "--quiet", "--detach", checkoutPath, branch], {
    stdio: "inherit",
  });

  if (added.error) process.stderr.write(`clean-checkout: ${added.error.message}\n`);
  let exitCode = status(added);
  let registered = exitCode === 0;
  if (!registered) exitCode = 1;

  if (registered && existsSync(join(checkoutPath, ".gitmodules"))) {
    // Local-path submodule URLs need the file transport, which this git blocks by default;
    // no new trust: the checkout already runs the branch's own gate as this user.
    const sub = spawnSync(
      "git",
      ["-C", checkoutPath, "-c", "protocol.file.allow=always", "submodule", "update", "--init"],
      { stdio: "inherit" },
    );
    if (status(sub) !== 0)
      process.stderr.write("clean-checkout: could not populate submodules; running on the checkout as made\n");
  }

  if (registered) {
    const run = spawnSync("bash", ["-e", "-o", "pipefail", "-c", command], {
      cwd: checkoutPath,
      stdio: "inherit",
    });
    if (run.error) process.stderr.write(`clean-checkout: ${run.error.message}\n`);
    exitCode = status(run);
  }

  const scratchType = (() => {
    try {
      return lstatSync(scratch).isDirectory() ? "directory" : "other";
    } catch {
      return "missing";
    }
  })();
  let checkoutRemoved = false;
  if (registered && scratchType !== "other") {
    const removed = spawnSync("git", ["-C", repo, "worktree", "remove", "--force", checkoutPath], {
      stdio: "ignore",
    });
    checkoutRemoved = removed.status === 0;
    if (!checkoutRemoved) process.stderr.write("clean-checkout: could not remove the temporary git worktree\n");
  }

  try {
    if (scratchType === "directory") {
      if (!checkoutRemoved) rmSync(checkoutPath, { recursive: true, force: true });
      rmdirSync(scratch);
    } else if (scratchType === "other") {
      throw new Error("the temporary parent is no longer a directory");
    }
  } catch (error) {
    process.stderr.write(`clean-checkout: could not remove ${scratch}: ${String(error)}\n`);
    if (exitCode === 0) exitCode = 1;
  }

  if (registered && !checkoutRemoved && scratchType === "directory") {
    // The directory is gone; drop the stale registration too. Prune only touches entries
    // whose directory no longer exists, so live worktrees are unaffected.
    const pruned = spawnSync("git", ["-C", repo, "worktree", "prune"], { stdio: "ignore" });
    if (pruned.status !== 0)
      process.stderr.write("clean-checkout: could not prune the worktree registration\n");
  }

  if (registered && !checkoutRemoved && exitCode === 0) exitCode = 1;

  return { exitCode, checkoutPath };
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    process.stderr.write("usage: clean-checkout.ts <repo> <branch> <command>\n");
    process.exitCode = 1;
  } else {
    try {
      process.exitCode = cleanCheckout(args[0], args[1], args[2]).exitCode;
    } catch (error) {
      process.stderr.write(`clean-checkout: ${String(error)}\n`);
      process.exitCode = 1;
    }
  }
}
