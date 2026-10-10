// Tests beside scripts/ticket-cut.ts: the usage contract and the pass-through.
// The cut shapes are pinned by the #407 oracle through the same command.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./lib/proc.ts";

const SELF = join(import.meta.dir, "run");

describe("usage", () => {
  test("no file exits 1 and prints usage", () => {
    const r = run(SELF, ["ticket-cut"]);
    expect(r.code).toBe(1);
    expect(r.err).toContain("usage: run ticket-cut <ticket-file>");
  });

  test("an unreadable file exits 1 and names it", () => {
    const r = run(SELF, ["ticket-cut", join(tmpdir(), "ticket-cut-no-such-file.md")]);
    expect(r.code).toBe(1);
    expect(r.err).toContain("cannot read");
  });
});

describe("pass-through", () => {
  test("a ticket with no agents part prints unchanged", () => {
    const dir = mkdtempSync(join(tmpdir(), "ticket-cut-"));
    try {
      const text = "# T\n\n## Problem / feature\n\nP.\n";
      const path = join(dir, "plain.md");
      writeFileSync(path, text, "utf8");
      const r = run(SELF, ["ticket-cut", path]);
      expect(r.code).toBe(0);
      expect(r.out).toBe(text);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an agents part with neither section prints unchanged", () => {
    const dir = mkdtempSync(join(tmpdir(), "ticket-cut-"));
    try {
      const text = "# T\n\n## For the agents\n\n### Checks\n\n- **C1** One.\n";
      const path = join(dir, "checks.md");
      writeFileSync(path, text, "utf8");
      const r = run(SELF, ["ticket-cut", path]);
      expect(r.code).toBe(0);
      expect(r.out).toBe(text);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
