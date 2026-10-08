// Tests beside scripts/no-tracked-postmaster.ts: temp fixtures for each shape,
// plus the live tree, which is the gate step that fails when a root
// .postmaster/ file is tracked.
import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { scriptsDir, toolRoot } from "./lib/paths.ts";
import { run, withTempDir } from "./lib/proc.ts";
import { check } from "./no-tracked-postmaster.ts";

const HERE = scriptsDir(import.meta);
const TOOL = toolRoot(import.meta);
const SELF = join(HERE, "run");

function git(repo: string, ...args: string[]): void {
  const r = run("git", ["-C", repo, ...args]);
  if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.err.trim() || r.out.trim()}`);
}

function initRepo(repo: string): void {
  const r = run("git", ["init", "-q", "-b", "main", repo]);
  if (r.code !== 0) throw new Error(`git init: ${r.err.trim() || r.out.trim()}`);
  git(repo, "config", "user.name", "brindlewick");
  git(repo, "config", "user.email", "332054101+brindlewick@users.noreply.github.com");
}

function writeFile(repo: string, rel: string, text: string): void {
  const target = join(repo, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

function commitAll(repo: string, message: string): void {
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", message);
}

describe("temp fixtures", () => {
  test("no .postmaster/ directory passes", () => {
    const r = withTempDir((dir) => {
      const repo = join(dir, "repo");
      initRepo(repo);
      writeFile(repo, "README.md", "hi\n");
      commitAll(repo, "baseline");
      return check(repo);
    });
    expect(r.code).toBe(0);
    expect(r.out).toBe("");
  });

  test("untracked files under .postmaster/ pass", () => {
    const r = withTempDir((dir) => {
      const repo = join(dir, "repo");
      initRepo(repo);
      writeFile(repo, "README.md", "hi\n");
      commitAll(repo, "baseline");
      writeFile(repo, ".postmaster/settings.toml", "local = true\n");
      return check(repo);
    });
    expect(r.code).toBe(0);
    expect(r.out).toBe("");
  });

  test("a tracked root .postmaster file fails and names the file", () => {
    const r = withTempDir((dir) => {
      const repo = join(dir, "repo");
      initRepo(repo);
      writeFile(repo, ".postmaster/probe.toml", "probe = true\n");
      commitAll(repo, "probe");
      return check(repo);
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain(".postmaster/probe.toml");
  });

  test("a nested postmaster folder does not trip it", () => {
    const r = withTempDir((dir) => {
      const repo = join(dir, "repo");
      initRepo(repo);
      writeFile(repo, "fixtures/app/.postmaster/project.toml", "nested = true\n");
      commitAll(repo, "nested only");
      return check(repo);
    });
    expect(r.code).toBe(0);
    expect(r.out).toBe("");
  });

  test("root and nested together name the root file only", () => {
    const r = withTempDir((dir) => {
      const repo = join(dir, "repo");
      initRepo(repo);
      writeFile(repo, ".postmaster/probe.toml", "probe = true\n");
      writeFile(repo, "fixtures/app/.postmaster/project.toml", "nested = true\n");
      commitAll(repo, "both");
      return check(repo);
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain(".postmaster/probe.toml");
    expect(r.out).not.toContain("fixtures/app/.postmaster/project.toml");
  });

  test("called from a subdirectory still checks the root", () => {
    const r = withTempDir((dir) => {
      const repo = join(dir, "repo");
      initRepo(repo);
      writeFile(repo, ".postmaster/probe.toml", "probe = true\n");
      writeFile(repo, "sub/note.txt", "note\n");
      commitAll(repo, "probe plus sub");
      return check(join(repo, "sub"));
    });
    expect(r.code).toBe(1);
    expect(r.out).toContain(".postmaster/probe.toml");
  });

  test("outside a git repository exits 2", () => {
    const r = withTempDir((dir) => check(dir));
    expect(r.code).toBe(2);
    expect(r.err).toContain("cannot find the repository");
  });
});

describe("the command line", () => {
  test("an unknown flag exits 2", () => {
    const r = run(SELF, ["no-tracked-postmaster", "--no-such-flag"]);
    expect(r.code).toBe(2);
    expect(r.err).toBe("usage: run no-tracked-postmaster [repo]\n");
  });

  test("an extra argument exits 2", () => {
    const r = withTempDir((dir) => {
      const repo = join(dir, "repo");
      initRepo(repo);
      return run(SELF, ["no-tracked-postmaster", repo, "extra"]);
    });
    expect(r.code).toBe(2);
  });
});

describe("the live tree", () => {
  test("the repository tracks nothing under its root .postmaster/", () => {
    const r = check(TOOL);
    expect(r.out).toBe("");
    expect(r.code).toBe(0);
  });
});
