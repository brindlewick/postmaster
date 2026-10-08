import { describe, expect, test } from "bun:test";
import { blocks, kept, render } from "./passages.ts";

const notes = `# Notes

preamble that is dropped

## A1 Lifecycle

### A1.2 Idle timeout
- finding: set it per object
- quote: "Without a timeout, Cloudflare stops the container shortly after." (verbatim)
  and a continuation line
- source: https://example.com/a ; docs/a.mdx@6e1b964 lines 1-2 ; read 2026-10-08
- strength: stated

### A1.9 A mere comment
- finding: nothing quoted here
- strength: argued

### A3.8 Not found: a rate limit
- finding: absent
- quote: n/a
- strength: not found

### A4.1 Another
- finding: kept
- quote: "A second sentence that is long enough to count." (verbatim)
- internal: not kept
- source: https://example.com/b
- strength: stated
`;

describe("blocks", () => {
  test("splits on ### headings and drops the preamble", () => {
    expect(blocks(notes).map((b) => b.id)).toEqual(["A1.2", "A1.9", "A3.8", "A4.1"]);
  });
});

describe("kept", () => {
  test("keeps finding, quote, source and strength lines with their continuations, and no other bullet", () => {
    const b = blocks(notes)[3];
    expect(kept(b as never).some((l) => l.includes("internal"))).toBe(false);
    const first = kept(blocks(notes)[0] as never);
    expect(first.some((l) => l.includes("a continuation line"))).toBe(true);
  });
});

describe("render", () => {
  const text = render(blocks(notes), "# Passages relied on");

  test("positive control: entries with a quotation and entries of absence are written", () => {
    expect(text).toContain("### A1.2 Idle timeout");
    expect(text).toContain("### A3.8 Not found: a rate limit");
    expect(text).toContain("### A4.1 Another");
  });

  test("negative control: an entry with no quotation and no absence is left out", () => {
    expect(text).not.toContain("A1.9");
  });

  test("a prefix numbers the entries that are written, in order, keeping the reader's own heading", () => {
    const numbered = render(blocks(notes), "# P", { prefix: "P" });
    expect(numbered).toContain("### P1 A1.2 Idle timeout");
    expect(numbered).toContain("### P2 A3.8 Not found: a rate limit");
    expect(numbered).toContain("### P3 A4.1 Another");
  });

  test("an always pattern keeps a named entry that holds no quotation", () => {
    const kept = render(blocks(notes), "# P", { always: /^A1\.9$/u });
    expect(kept).toContain("### A1.9 A mere comment");
    expect(kept).toContain("- finding: nothing quoted here");
    expect(render(blocks(notes), "# P")).not.toContain("### A1.9");
  });

  test("an ids filter and a drop pattern narrow the output", () => {
    const only = render(blocks(notes), "# P", { ids: /^A4/u, drop: /^- source:/u });
    expect(only).toContain("A4.1");
    expect(only).not.toContain("A1.2");
    expect(only).not.toContain("- source:");
  });
});
