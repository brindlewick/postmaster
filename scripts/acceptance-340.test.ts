// Oracle for #340, committed before the change: postmaster's own .postmaster/
// holds no tracked file, and the gate fails when one is tracked. C1 reads the
// live tree through git; C2 drives the gate's check as a subprocess against
// temp fixtures, never importing the change.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./lib/proc.ts";
import { RUN, ROOT, commitAll, initRepo, writeRepoFile } from "./acceptance-340.ts";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "acceptance-340-"));
}

describe("C1: the repository tracks nothing in its own postmaster folder", () => {
  test("git ls-files .postmaster prints nothing", () => {
    const r = run("git", ["-C", ROOT, "ls-files", ".postmaster"]);
    expect(r.code).toBe(0);
    expect(r.out.trim()).toBe("");
  });
});

describe("C2: the gate fails when a file there is tracked", () => {
  test("the fixture app's postmaster file stays tracked, so the check must ignore it", () => {
    const r = run("git", ["-C", ROOT, "ls-files", "fixtures/app/.postmaster/project.toml"]);
    expect(r.code).toBe(0);
    expect(r.out.trim()).toBe("fixtures/app/.postmaster/project.toml");
  });

  test("a tracked root .postmaster file fails the check and names the file", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "repo");
      initRepo(repo);
      writeRepoFile(repo, ".postmaster/probe.toml", "probe = true\n");
      writeRepoFile(repo, "fixtures/app/.postmaster/project.toml", "nested = true\n");
      commitAll(repo, "probe plus nested");
      const r = run(RUN, ["no-tracked-postmaster", repo]);
      expect(r.code).toBe(1);
      expect(r.out).toContain(".postmaster/probe.toml");
      expect(r.out).not.toContain("fixtures/app/.postmaster/project.toml");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a clean root .postmaster passes while the nested file stays tracked", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "repo");
      initRepo(repo);
      writeRepoFile(repo, "fixtures/app/.postmaster/project.toml", "nested = true\n");
      commitAll(repo, "nested only");
      const r = run(RUN, ["no-tracked-postmaster", repo]);
      expect(r.code).toBe(0);
      expect(r.out).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
