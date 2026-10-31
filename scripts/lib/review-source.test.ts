// Tests beside scripts/lib/review-source.ts: the review page takes its data from blocks inside the page
// when it has them, which is how a page published as one file carries it.
import { describe, expect, test } from "bun:test";
import { dataBlock } from "./page-text.ts";
import { chunkBlockId, readBlock, reviewBlockId } from "./review-source.ts";

/** A document with the given blocks, each by id, as the page's `document` answers. */
const documentWith = (blocks: Record<string, string>) => ({
  getElementById: (id: string) => (id in blocks ? { textContent: blocks[id] ?? null } : null),
});

/** The text a browser gives for a block the builder wrote. */
const textOf = (block: string): string =>
  block.slice(block.indexOf(">") + 1, block.lastIndexOf("<"));

describe("the block names", () => {
  test("one block holds the review, one holds each chunk of diffs", () => {
    expect(reviewBlockId()).toBe("review-data");
    expect(chunkBlockId(0)).toBe("review-chunk-0");
    expect(chunkBlockId(12)).toBe("review-chunk-12");
  });
});

describe("readBlock", () => {
  test("gives back what the builder wrote, however the text is escaped", () => {
    const value = { files: [{ path: "a.ts", diff: "-</script>\n+<b>& ok" }], n: 3 };
    const doc = documentWith({ [reviewBlockId()]: textOf(dataBlock(reviewBlockId(), value)) });
    expect(readBlock(doc, reviewBlockId())).toEqual(value);
  });

  test("a page without the block gives null, so the page fetches the file instead", () => {
    expect(readBlock(documentWith({}), reviewBlockId())).toBeNull();
    const doc = documentWith({ [chunkBlockId(0)]: "[]" });
    expect(readBlock(doc, chunkBlockId(0))).toEqual([]);
    expect(readBlock(doc, chunkBlockId(1))).toBeNull();
  });

  test("a block that is not JSON is an error, not an empty page", () => {
    expect(() => readBlock(documentWith({ x: "{ nope" }), "x")).toThrow();
    expect(() => readBlock(documentWith({ x: "" }), "x")).toThrow();
  });
});
