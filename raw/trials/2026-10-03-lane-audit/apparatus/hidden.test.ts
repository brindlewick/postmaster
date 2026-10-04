import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  allPass,
  describeScore,
  parseCounts,
  readManifest,
  runControls,
  scoreBranch,
} from "./hidden.ts";

const TOOL = resolve(dirname(import.meta.path), "../../../..");

describe("parseCounts", () => {
  test("reads the last pass and fail lines of a bun test report", () => {
    const report =
      "bun test v1.4.2\n\n 19 pass\n 1 fail\n 52 expect() calls\nRan 20 tests across 1 file.\n";
    expect(parseCounts(report)).toEqual({ passed: 19, failed: 1 });
  });

  test("a report with only pass lines has no failures", () => {
    expect(parseCounts(" 20 pass\n 0 fail\n")).toEqual({ passed: 20, failed: 0 });
    expect(parseCounts(" 3 pass\n")).toEqual({ passed: 3, failed: 0 });
  });

  test("text with no counts reads as none, and a count inside a sentence is not one", () => {
    expect(parseCounts("error: cannot find module\n")).toBeNull();
    expect(parseCounts("the suite had 20 pass and 0 fail overall\n")).toBeNull();
  });
});

describe("scores", () => {
  test("only a nonzero pass count with no failure is a pass", () => {
    expect(allPass({ kind: "counts", passed: 20, failed: 0 })).toBe(true);
    expect(allPass({ kind: "counts", passed: 19, failed: 1 })).toBe(false);
    expect(allPass({ kind: "counts", passed: 0, failed: 0 })).toBe(false);
    expect(allPass({ kind: "missing" })).toBe(false);
    expect(allPass({ kind: "at-base" })).toBe(false);
    expect(allPass({ kind: "failed-to-build" })).toBe(false);
  });

  test("each score reads as the tool prints it", () => {
    expect(describeScore({ kind: "counts", passed: 20, failed: 0 })).toBe("20 pass, 0 fail");
    expect(describeScore({ kind: "missing" })).toBe("missing");
    expect(describeScore({ kind: "at-base" })).toBe("at base");
    expect(describeScore({ kind: "failed-to-build" })).toBe("failed to build");
  });
});

describe("readManifest", () => {
  test("the lanes a manifest names, in name order, and its base", () => {
    expect(readManifest('{"base":"abc123","lanes":{"sol":{},"mimo":{}}}')).toEqual({
      lanes: ["mimo", "sol"],
      base: "abc123",
    });
  });

  test("a manifest with no lanes, or none at all, names none", () => {
    expect(readManifest("{}")).toEqual({ lanes: [], base: null });
    expect(readManifest("not json")).toEqual({ lanes: [], base: null });
  });
});

describe("scoreBranch", () => {
  const withRepo = (body: (repo: string, scratch: string, base: string) => void): void => {
    const scratch = mkdtempSync(join(tmpdir(), "lane-audit-test-"));
    try {
      const repo = join(scratch, "repo");
      mkdirSync(repo);
      const git = (...args: string[]): string =>
        String(
          execFileSync(
            "git",
            ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.com", ...args],
            {
              encoding: "utf8",
            },
          ),
        );
      git("init", "-q", "-b", "main");
      writeFileSync(join(repo, "a.txt"), "a\n");
      git("add", ".");
      git("commit", "-q", "-m", "a");
      const base = git("rev-parse", "HEAD").trim();
      git("branch", "wb/1-idle");
      body(repo, scratch, base);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  };

  test("a branch that is not in the repository is missing, and nothing is run", () => {
    withRepo((repo, scratch) => {
      expect(scoreBranch(TOOL, repo, "wb/1-nobody", "remove", scratch)).toEqual({
        kind: "missing",
      });
    });
  });

  test("a branch that points at the base holds no work and is not scored", () => {
    withRepo((repo, scratch, base) => {
      expect(scoreBranch(TOOL, repo, "wb/1-idle", "remove", scratch, base)).toEqual({
        kind: "at-base",
      });
    });
  });
});

describe("controls", () => {
  test("the same suite passes the reference solution and fails the app before the ticket", () => {
    const scratch = mkdtempSync(join(tmpdir(), "lane-audit-test-"));
    try {
      const c = runControls(TOOL, "remove", scratch);
      expect(allPass(c.reference)).toBe(true);
      expect(allPass(c.base)).toBe(false);
      expect(c.base.kind).toBe("counts");
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 240_000);
});
