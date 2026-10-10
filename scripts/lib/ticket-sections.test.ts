// Tests beside scripts/lib/ticket-sections.ts: the shared reading of the agents
// part's sections. ticket-parts and the cut both build on it.
import { describe, expect, test } from "bun:test";
import { agentsIndex, level3Sections, normalizeTicket } from "./ticket-sections.ts";

describe("normalizeTicket", () => {
  test("strips a byte-order mark and folds CRLF to LF", () => {
    expect(normalizeTicket("\uFEFF# T\r\n\r\nBody\r\n")).toBe("# T\n\nBody\n");
    expect(normalizeTicket("# T\n\nBody\n")).toBe("# T\n\nBody\n");
  });
});

describe("agentsIndex", () => {
  test("finds the heading case-insensitively, or -1", () => {
    expect(agentsIndex(["# T", "", "## For the Agents", ""])).toBe(2);
    expect(agentsIndex(["# T", "", "no agents part"])).toBe(-1);
  });
});

describe("level3Sections", () => {
  test("each section runs to the next heading of level 3 or above, skipping fences", () => {
    const lines = [
      "### Checks",
      "",
      "- **C1** One.",
      "",
      "### Technical notes",
      "",
      "```md",
      "### Not a section",
      "```",
      "",
      "## User journey",
      "",
      "Walk here.",
      "",
      "### Verified at abc1234",
      "",
      "Done.",
    ];
    const subs = level3Sections(lines, 0);
    expect(subs.map((s) => s.title)).toEqual(["Checks", "Technical notes", "Verified at abc1234"]);
    expect(subs.map((s) => [s.at, s.end])).toEqual([
      [0, 4],
      [4, 10],
      [14, 17],
    ]);
  });
});
