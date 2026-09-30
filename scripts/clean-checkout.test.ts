import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, sep } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { cleanCheckout } from "./clean-checkout";

const helper = join(import.meta.dir, "clean-checkout.ts");
const roots: string[] = [];

const command = (program: string, args: string[], cwd?: string): void => {
  const result = spawnSync(program, args, { cwd, stdio: "ignore" });
  if (result.status !== 0) throw new Error(`${program} exited ${result.status ?? "without a status"}`);
};

const withRepo = (run: (repo: string) => void): void => {
  const root = mkdtempSync(join(tmpdir(), "clean-checkout-test-"));
  roots.push(root);
  const repo = join(root, "repo");
  mkdirSync(repo);
  command("git", ["init", "-q", "-b", "main", repo]);
  command("git", ["-C", repo, "config", "user.name", "test"]);
  command("git", ["-C", repo, "config", "user.email", "test@example.invalid"]);
  // The check a folder-walking project would use: fail whenever a copy exists under .worktrees/
  writeFileSync(
    join(repo, "check.sh"),
    [
      "#!/usr/bin/env bash",
      'if [ -d .worktrees ] && [ -n "$(ls -A .worktrees 2>/dev/null)" ]; then',
      '  echo "check: a copy exists under .worktrees/" >&2',
      "  exit 1",
      "fi",
      "exit 0",
      "",
    ].join("\n"),
  );
  writeFileSync(join(repo, "app.ts"), "export const x = 1;\n");
  command("git", ["-C", repo, "add", "check.sh", "app.ts"]);
  command("git", ["-C", repo, "commit", "-q", "-m", "base"]);
  writeFileSync(join(repo, ".git", "info", "exclude"), ".worktrees/\n");
  run(repo);
};

const inside = (parent: string, child: string): boolean => {
  const rel = relative(parent, child);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`));
};

const worktreeList = (repo: string): string =>
  spawnSync("git", ["-C", repo, "worktree", "list", "--porcelain"], { encoding: "utf8" }).stdout ?? "";

const runHelper = (args: string[], env?: Record<string, string>): { status: number; out: string } => {
  const r = spawnSync("bun", [helper, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: env ? { ...process.env, ...env } : process.env,
  });
  return { status: r.status ?? 1, out: (r.stdout || "") + (r.stderr || "") };
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("cleanCheckout", () => {
  test("AC3: the identical check fails in the project and passes from the clean checkout", () => {
    withRepo((repo) => {
      const marker = join(repo, ".worktrees", "lane");
      mkdirSync(marker, { recursive: true });
      writeFileSync(join(marker, "copy.txt"), "uncommitted lane copy\n");

      const negative = spawnSync("bash", ["./check.sh"], { cwd: repo, stdio: "ignore" });
      expect(negative.status).not.toBe(0);

      const positive = cleanCheckout(repo, "main", "bash ./check.sh");
      expect(positive.exitCode).toBe(0);
      expect(inside(realpathSync(repo), positive.checkoutPath)).toBe(false);
      expect(existsSync(positive.checkoutPath)).toBe(false);
      expect(worktreeList(repo)).not.toContain(positive.checkoutPath);
    });
  });

  test("runs the command on the branch's content", () => {
    withRepo((repo) => {
      const result = cleanCheckout(repo, "main", "test -f app.ts && test -f check.sh && test ! -e .worktrees");
      expect(result.exitCode).toBe(0);
    });
  });

  test("removes the temporary checkout when the command fails and preserves its exit", () => {
    withRepo((repo) => {
      const result = cleanCheckout(repo, "main", "exit 23");
      expect(result.exitCode).toBe(23);
      expect(existsSync(result.checkoutPath)).toBe(false);
      expect(worktreeList(repo)).not.toContain(result.checkoutPath);
    });
  });

  test("refuses a repo that is not a repository, and a branch it does not have", () => {
    withRepo((repo) => {
      const plain = mkdtempSync(join(tmpdir(), "clean-checkout-plain-"));
      roots.push(plain);
      const notRepo = runHelper([plain, "main", "true"]);
      expect(notRepo.status).toBe(1);
      expect(notRepo.out).toContain("not in a git repository");
      const branch = runHelper([repo, "no-such-branch", "true"]);
      expect(branch.status).toBe(1);
      expect(branch.out).toContain("has no branch or commit");
    });
  });

  test("a refusal leaves no scratch behind", () => {
    withRepo((repo) => {
      const priv = mkdtempSync(join(tmpdir(), "clean-checkout-tmpdir-"));
      roots.push(priv);
      const refused = runHelper([repo, "no-such-branch", "true"], { TMPDIR: priv });
      expect(refused.status).toBe(1);
      expect(readdirSync(priv).filter((n) => n.startsWith("postmaster-clean-checkout-"))).toEqual([]);
    });
  });
});
