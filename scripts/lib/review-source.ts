// Where the review page takes its data from. A page published as one file carries its data in blocks of
// its own: `review-data` holds what review.json holds, and `review-chunk-<k>` what chunks/<k>.json holds.
// A page built beside those files has no blocks and fetches them. The builder
// (scripts/review-page.ts) writes the blocks under these names. The review page inlines this file with
// its exports stripped, so it stands alone: no imports, no platform calls, nothing kept between calls.

/** What a document gives: the element with an id, and its text. */
export interface BlockSource {
  getElementById(id: string): { textContent: string | null } | null;
}

/** The id of the block that holds the content of review.json. */
export function reviewBlockId(): string {
  return "review-data";
}

/** The id of the block that holds one chunk of diffs. */
export function chunkBlockId(k: number): string {
  return `review-chunk-${k}`;
}

/** The JSON in the block with this id, or null when the page has no such block. A block that is not JSON throws. */
export function readBlock(source: BlockSource, id: string): unknown {
  const node = source.getElementById(id);
  if (node === null) return null;
  return JSON.parse(node.textContent ?? "");
}
