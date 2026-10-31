// The data a review page reads (review.json and its chunks), built from a change: its files, the
// diff of each, the text of each at the head, a layout and a few facts. Pure: the same input gives
// the same data, byte for byte, whatever order the files arrive in.
import { createHash } from "node:crypto";
import {
  arrange,
  type ChangedFile,
  type LayoutConfig,
  type PlacedFile,
  type ReviewGroup,
  type Ruling,
  resolveRulings,
} from "./review-layout.ts";
import { langOf } from "./page-text.ts";

export interface ChangeText {
  change: ChangedFile;
  /** The file's unified diff, already scrubbed. */
  diff: string;
  /** The file at the head, already scrubbed; null for a deleted or binary file. */
  text: string | null;
  /** For a binary file at the head: the id git gives its content, which stands in for bytes the page cannot show. */
  blob?: string;
}

export interface ReviewMeta {
  pr: number | null;
  ticket: number | null;
  ticketTitle: string;
  ticketBody: string;
  body: string;
  mergedAt: string | null;
  base: string;
  head: string;
  redactions: number;
  /** Prefix of the keys the page keeps in the reader's browser; default "review-page". */
  storageKey?: string;
}

export interface ReviewFile extends PlacedFile {
  lang: string;
  chunk: number;
  /** Short hash of the path and the diff: the key of the reviewed tick kept in the reader's browser. */
  sig: string;
  /**
   * SHA-256, 64 lowercase hex digits, of the file's content as the page shows it (contentHash). With
   * the file's path it is the key of the tick kept through the page bridge: `tick:<path>:<hash>`.
   */
  hash: string;
}

export interface ReviewData {
  version: 2;
  pr: number | null;
  ticket: number | null;
  ticketTitle: string;
  ticketBody: string;
  body: string;
  mergedAt: string | null;
  base: string;
  head: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  redactions: number;
  storageKey?: string;
  groups: ReviewGroup[];
  files: ReviewFile[];
  rulings: Ruling[];
}

export interface ChunkItem {
  i: number;
  diff: string;
}

/** The chunk each item goes in: a new chunk once the next item would pass the limit. */
export function packChunks(sizes: number[], limit: number): number[] {
  const out: number[] = [];
  let k = 0;
  let size = 0;
  for (const n of sizes) {
    if (size > 0 && size + n > limit) {
      k += 1;
      size = 0;
    }
    out.push(k);
    size += n;
  }
  return out;
}

const blobOf = (input: ChangeText | undefined): { blob?: string } =>
  input?.blob === undefined ? {} : { blob: input.blob };

const signature = (path: string, diff: string, file: ChangedFile, withheld: boolean): string =>
  createHash("sha1")
    .update(`${path}\0${withheld ? `withheld ${file.add} ${file.del}` : diff}`)
    .digest("hex")
    .slice(0, 10);

/**
 * What the page draws of a file's diff: everything from the first hunk header on. The lines git
 * writes before it (the names, the blob ids, the mode and rename lines) are not drawn, so a base
 * that moves under a file whose hunks did not change does not change what is shown.
 */
export function shownDiff(diff: string): string {
  if (diff.startsWith("@@")) return diff;
  const at = diff.indexOf("\n@@");
  return at < 0 ? "" : diff.slice(at + 1);
}

/**
 * The hash of a file's content as the page shows it, for the key of a kept tick. It covers what a
 * reader judges and nothing else, so an unchanged file keeps its tick on a new head and a changed
 * one starts unticked:
 *   a file with a diff   `diff`, a line break, then shownDiff of the scrubbed diff;
 *   a withheld file      `withheld` and its added and deleted counts, one to a line;
 *   a binary file        `binary`, a line break, then the id of its content at the head.
 * The path is not part of it (the key adds the path), and neither is anything the page does not
 * draw. The preimage is a contract: change it and every kept tick of every page drops once.
 */
export function contentHash(
  file: ChangedFile,
  diff: string,
  how: { withheld: boolean; blob?: string },
): string {
  const preimage = how.withheld
    ? `withheld\n${file.add}\n${file.del}`
    : file.binary
      ? `binary\n${how.blob ?? ""}`
      : `diff\n${shownDiff(diff)}`;
  return createHash("sha256").update(preimage).digest("hex");
}

/** Build the review data and its diff chunks. `problems` names what the layout asked for and the change lacks. */
export function buildReviewData(input: {
  inputs: readonly ChangeText[];
  layout: LayoutConfig;
  meta: ReviewMeta;
  chunkBytes: number;
}): { review: ReviewData; chunks: ChunkItem[][]; problems: string[] } {
  const { inputs, layout, meta } = input;
  const byPath = new Map(inputs.map((x) => [x.change.path, x]));
  const arranged = arrange(
    inputs.map((x) => x.change),
    layout,
  );
  const rulings = resolveRulings(layout.rulings, (path) => byPath.get(path)?.text ?? undefined);
  const items = arranged.files.map((f, i): ChunkItem => {
    const diff = f.withheld ? "" : (byPath.get(f.path)?.diff ?? "");
    return { i, diff };
  });
  const chunkOf = packChunks(
    items.map((it) => JSON.stringify(it).length),
    input.chunkBytes,
  );
  const files = arranged.files.map(
    (f, i): ReviewFile => ({
      ...f,
      lang: langOf(f.path),
      chunk: chunkOf[i] ?? 0,
      sig: signature(f.path, items[i]?.diff ?? "", f, f.withheld !== undefined),
      hash: contentHash(f, items[i]?.diff ?? "", {
        withheld: f.withheld !== undefined,
        ...blobOf(byPath.get(f.path)),
      }),
    }),
  );
  const chunks: ChunkItem[][] = [];
  items.forEach((it, i) => {
    const k = chunkOf[i] ?? 0;
    chunks[k] = [...(chunks[k] ?? []), it];
  });
  const review: ReviewData = {
    version: 2,
    pr: meta.pr,
    ticket: meta.ticket,
    ticketTitle: meta.ticketTitle,
    ticketBody: meta.ticketBody,
    body: meta.body,
    mergedAt: meta.mergedAt,
    base: meta.base,
    head: meta.head,
    additions: files.reduce((n, f) => n + f.add, 0),
    deletions: files.reduce((n, f) => n + f.del, 0),
    changedFiles: files.length,
    redactions: meta.redactions,
    ...(meta.storageKey === undefined ? {} : { storageKey: meta.storageKey }),
    groups: arranged.groups,
    files,
    rulings: rulings.rulings,
  };
  return { review, chunks, problems: rulings.problems };
}
