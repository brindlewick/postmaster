// Tests beside scripts/spec-decisions.ts, moved from its --self-test on #109: 20 controls.
// Each test sets up its own manifest and decisions file instead of relying on files an
// earlier control left behind; the wrapper is spawned directly rather than through bash.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SELF = join(import.meta.dir, "spec-decisions.sh");

interface Run {
  code: number;
  out: string;
  err: string;
}

function go(...args: string[]): Run {
  const r = spawnSync(SELF, args, { encoding: "utf8", timeout: 10000 });
  return { code: r.status ?? 1, out: String(r.stdout ?? ""), err: String(r.stderr ?? "") };
}

let tmp = "";
let d = "";
let decisions = "";
let actions = "";

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "spec-decisions-"));
  d = join(tmp, "project", ".postmaster", "runs", "RUN-1");
  mkdirSync(d, { recursive: true });
  decisions = join(d, "spec-decisions.md");
  actions = join(d, "actions.jsonl");
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function manifest(lanesJson: string): void {
  writeFileSync(join(d, "manifest.json"), `{"lanes": {${lanesJson}}}\n`);
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

// The self-test's stanzas(): grep -c '^## '.
function stanzas(): number {
  try {
    return readFileSync(decisions, "utf8")
      .split("\n")
      .filter((l) => l.startsWith("## ")).length;
  } catch {
    return 0;
  }
}

// The self-test's logged(): tail -1 of the action log.
function logged(): string {
  const lines = readFileSync(actions, "utf8")
    .split("\n")
    .filter((l) => l !== "");
  return lines.length > 0 ? lines[lines.length - 1]! : "";
}

function actionsText(): string {
  try {
    return readFileSync(actions, "utf8");
  } catch {
    return "";
  }
}

// The shell's $(...): trailing newlines stripped.
function strip(s: string): string {
  return s.replace(/\n+$/u, "");
}

function approvedLines(): number {
  return readFileSync(decisions, "utf8")
    .split("\n")
    .filter((l) => l.includes("decision: approved")).length;
}

describe("positive controls", () => {
  test("fresh starts an empty decisions file", () => {
    const r = go(d, "fresh");
    expect(r.code).toBe(0);
    expect(isFile(decisions)).toBe(true);
    expect(statSync(decisions).size).toBe(0);
  }, 10000);

  test("record writes the stanza and logs the spec-review line", () => {
    manifest('"alpha": {}');
    go(d, "fresh");
    const r = go(d, "record", "alpha", "approved", "abc123");
    expect(r.code).toBe(0);
    expect(stanzas()).toBe(1);
    expect(logged()).toContain('"detail":"approved abc123"');
  }, 10000);

  test("fresh truncates a decided file", () => {
    manifest('"alpha": {}');
    go(d, "fresh");
    go(d, "record", "alpha", "approved", "abc123");
    go(d, "fresh");
    expect(statSync(decisions).size).toBe(0);
  }, 10000);

  test("package 1 approves A and changes B, package 2 approves B: two approvals where the file alone reads one", () => {
    manifest('"alpha": {"outcome": "approved"}, "beta": {}');
    go(d, "fresh");
    const r = go(d, "record", "beta", "approved", "def456");
    const c = go(d, "count");
    expect(r.code).toBe(0);
    expect(c.code).toBe(0);
    expect(strip(c.out)).toBe("approved 2\nchanges 0");
    expect(approvedLines()).toBe(1);
  }, 10000);

  test("one approval and one drop across two packages reads as the under-two path", () => {
    manifest('"alpha": {"outcome": "approved"}, "beta": {}');
    go(d, "fresh");
    const r = go(d, "record", "beta", "dropped", "def456", "we only need one lane");
    const c = go(d, "count");
    expect(r.code).toBe(0);
    expect(c.code).toBe(0);
    expect(strip(c.out)).toBe("approved 1\nchanges 0");
  }, 10000);

  test("an approval and a changes read as one approval with one outstanding", () => {
    manifest('"alpha": {}, "beta": {}');
    go(d, "fresh");
    go(d, "record", "alpha", "approved", "abc123");
    const r = go(d, "record", "beta", "changes", "def456", "narrow", "the", "scope");
    const c = go(d, "count");
    expect(r.code).toBe(0);
    expect(c.code).toBe(0);
    expect(strip(c.out)).toBe("approved 1\nchanges 1");
    expect(logged()).toContain('"detail":"changes def456 narrow the scope"');
  }, 10000);

  test("a lane approved in both places counts once", () => {
    manifest('"alpha": {"outcome": "approved"}');
    go(d, "fresh");
    go(d, "record", "alpha", "approved", "abc123");
    const c = go(d, "count");
    expect(c.code).toBe(0);
    expect(strip(c.out)).toBe("approved 1\nchanges 0");
  }, 10000);

  test("a mistyped lane is refused, and the typo scenario reads one approval", () => {
    manifest('"alpha": {}, "beta": {}');
    go(d, "fresh");
    go(d, "record", "alpha", "approved", "abc123");
    const r = go(d, "record", "beta2", "approved", "def456");
    const c = go(d, "count");
    expect(r.code).toBe(2);
    expect(r.err).toContain("not a lane in the manifest");
    expect(c.code).toBe(0);
    expect(strip(c.out)).toBe("approved 1\nchanges 0");
  }, 10000);

  test("a duplicate stanza for one lane counts once", () => {
    manifest('"alpha": {}');
    writeFileSync(
      decisions,
      "## alpha\ndecision: approved\ncommit: abc123\nwords: \n\n## alpha\ndecision: changes\ncommit: def456\nwords: narrower\n\n",
    );
    const r = go(d, "count");
    expect(r.code).toBe(0);
    expect(strip(r.out)).toBe("approved 1\nchanges 1");
  }, 10000);

  test("an approved stanza with a blank commit contributes nothing", () => {
    manifest('"alpha": {}, "beta": {}');
    writeFileSync(
      decisions,
      "## alpha\ndecision: approved\ncommit: \nwords: \n\n## beta\ndecision: approved\ncommit: def456\nwords: \n\n",
    );
    const r = go(d, "count");
    expect(r.code).toBe(0);
    expect(strip(r.out)).toBe("approved 1\nchanges 0");
  }, 10000);
});

describe("negative controls", () => {
  test("a decision outside the triple is refused, and nothing is written", () => {
    manifest('"beta": {}');
    go(d, "fresh");
    const before = stanzas();
    const linesBefore = actionsText();
    const r = go(d, "record", "alpha", "ok", "abc123");
    expect(r.code).toBe(2);
    expect(stanzas()).toBe(before);
    expect(actionsText()).toBe(linesBefore);
    expect(r.err).toContain("a decision is approved, changes or dropped");
  }, 10000);

  test("a changes with no words is refused", () => {
    manifest('"beta": {}');
    go(d, "fresh");
    const r = go(d, "record", "beta", "changes", "def456");
    expect(r.code).toBe(2);
    expect(r.err).toContain("carries the user's words");
  }, 10000);

  test("an approval with words is refused", () => {
    manifest('"beta": {}');
    go(d, "fresh");
    const r = go(d, "record", "beta", "approved", "def456", "nice", "work");
    expect(r.code).toBe(2);
    expect(r.err).toContain("carries no words");
  }, 10000);

  test("a missing commit is a usage error", () => {
    const r = go(d, "record", "beta", "approved");
    expect(r.code).toBe(1);
    expect(r.err).toContain("usage:");
  }, 10000);

  test("a second stanza for one lane is refused", () => {
    manifest('"beta": {}');
    go(d, "fresh");
    go(d, "record", "beta", "approved", "def456");
    const r = go(d, "record", "beta", "dropped", "def456", "out");
    expect(r.code).toBe(2);
    expect(stanzas()).toBe(1);
    expect(r.err).toContain("already decided");
  }, 10000);

  test("a record with no package file is refused", () => {
    manifest('"beta": {}');
    go(d, "fresh");
    rmSync(decisions);
    const r = go(d, "record", "beta", "approved", "def456");
    expect(r.code).toBe(1);
    expect(r.err).toContain("run fresh first");
  }, 10000);

  test("a count with no package file is refused", () => {
    manifest('"beta": {}');
    rmSync(decisions, { force: true });
    const r = go(d, "count");
    expect(r.code).toBe(1);
    expect(r.err).toContain("run fresh first");
  }, 10000);

  test("a hand-mangled stanza is refused, not miscounted", () => {
    manifest('"beta": {}');
    writeFileSync(decisions, "## beta\ndecision: approved\n");
    const r = go(d, "count");
    expect(r.code).toBe(2);
    expect(r.err).toContain("incomplete stanza");
  }, 10000);

  test("a count with no manifest is refused", () => {
    manifest('"beta": {}');
    go(d, "fresh");
    rmSync(join(d, "manifest.json"));
    const r = go(d, "count");
    expect(r.code).toBe(1);
    expect(r.err).toContain("cannot read");
  }, 10000);

  test("a dispatch that does not exist is refused", () => {
    const r = go(join(tmp, "nowhere"), "count");
    expect(r.code).toBe(1);
    expect(r.err).toContain("no such dir");
  }, 10000);
});
