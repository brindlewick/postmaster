// Tests beside scripts/ticket-cut.ts: the usage contract, the pass-through and the Size section.
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

describe("large and odd inputs", () => {
  test("a ticket over the pipe buffer prints whole through a pipe", () => {
    const dir = mkdtempSync(join(tmpdir(), "ticket-cut-"));
    try {
      const filler = "Filler line for size padding 0123456789abcdef.\n".repeat(3000);
      const text =
        `# T\n\n## Problem / feature\n\n${filler}\n## For the agents\n\n` +
        "### Checks\n\n- **C1** One.\n\n### Technical notes\n\nDropped.\n\n### Verified at abc1234\n\n- V.\n";
      const path = join(dir, "big.md");
      writeFileSync(path, text, "utf8");
      const r = run(SELF, ["ticket-cut", path]);
      expect(r.code).toBe(0);
      expect(r.out).not.toContain("### Technical notes");
      expect(r.out).toContain("Filler line");
      expect(r.out.length).toBeGreaterThan(65536);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a CRLF ticket is cut like its LF twin", () => {
    const dir = mkdtempSync(join(tmpdir(), "ticket-cut-"));
    try {
      const lf =
        "# T\n\n## For the agents\n\n### Checks\n\n- **C1** One.\n\n" +
        "### Technical notes\n\nDropped.\n\n### Verified at abc1234\n\n- V.\n";
      const path = join(dir, "crlf.md");
      writeFileSync(path, lf.replace(/\n/gu, "\r\n"), "utf8");
      const r = run(SELF, ["ticket-cut", path]);
      expect(r.code).toBe(0);
      expect(r.out).not.toContain("### Technical notes");
      expect(r.out).not.toContain("\r");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the Size section, which goes to no lane", () => {
  const ticket = (size: string, title = "### Size"): string =>
    "# T\n\n## For the agents\n\n### Checks\n\n- **C1** One.\n\n" +
    "### Technical notes\n\n- A note. (C1)\n\n" +
    `${title}\n\n${size}\n\n` +
    "### Existing capabilities\n\nNone: nothing outside the repository is involved.\n\n" +
    "### Verified at abc1234\n\n- V.\n";

  function cut(text: string, ...flags: string[]) {
    const dir = mkdtempSync(join(tmpdir(), "ticket-cut-"));
    try {
      const path = join(dir, "ticket.md");
      writeFileSync(path, text, "utf8");
      return run(SELF, ["ticket-cut", path, ...flags]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  test("a run that holds its notes back gets neither them nor the number; one that is given them gets them but not the number", () => {
    for (const [flags, kept] of [
      [[], false],
      [["--keep-notes"], true],
    ] as const) {
      const r = cut(ticket("Expected changed lines: 180"), ...flags);
      expect(r.code).toBe(0);
      expect(r.out).toContain("### Existing capabilities");
      expect(r.out.includes("### Technical notes")).toBe(kept);
      expect(r.out.includes("### Verified at")).toBe(kept);
      for (const gone of ["### Size", "Expected changed lines", "180"]) {
        expect(r.out).not.toContain(gone);
      }
    }
  });

  test("whatever the section holds goes with it, files and approach included, under any case of its title", () => {
    const wide = "Expected changed lines: 180\n\n- list.ts 120\n\nSplit the sort out first.";
    for (const title of ["### Size", "### SIZE"]) {
      const out = cut(ticket(wide, title), "--keep-notes").out;
      for (const gone of ["list.ts", "Split the sort", "180"]) expect(out).not.toContain(gone);
    }
  });

  test("a ticket with no Size section is cut as before, and the flag alone is a usage fault", () => {
    const plain =
      "# T\n\n## For the agents\n\n### Checks\n\n- **C1** One.\n\n### Existing capabilities\n\nNone.\n";
    expect(cut(plain, "--keep-notes").out).toBe(plain);
    expect(cut(plain).out).toBe(plain);
    const bare = run(SELF, ["ticket-cut", "--keep-notes"]);
    expect(bare.code).toBe(1);
    expect(bare.err).toContain("usage: run ticket-cut <ticket-file>");
  });
});
