// The line comments of a page as the page paints them: those the viewer keeps (listed by
// `comments-get` or answered to a `comment-create`) and those the reader has just written, which
// the page shows at once and the viewer has not yet kept. A written comment is queued, then
// sending, then kept; or it fails and stays in view with the reason, since the reader's words are
// not thrown away. Pure: every function takes a book and returns a new one; the review page inlines
// this file with its exports stripped.
import type { BridgeComment } from "./page-bridge.ts";

export type SaveState = "kept" | "queued" | "sending" | "failed";

/** A comment as the page paints it. */
export interface ReviewComment {
  /** `c<id>` for a comment the viewer keeps, `local-<n>` for one the reader wrote and the viewer has not kept. */
  readonly id: string;
  readonly path: string;
  readonly side: "old" | "new";
  readonly from: number;
  readonly to: number;
  readonly text: string;
  /** Who wrote it, as the viewer names them; empty for the reader's own comment before it is kept. */
  readonly by: string;
  readonly at: string;
  readonly status: "open" | "closed";
  readonly source: "bridge";
  readonly save: SaveState;
  /** Why it was not kept, when it was not. */
  readonly line: string | null;
  /** The text of the lines it is on, as the anchor carries it; empty when the anchor has none. */
  readonly quote: string;
  /** For a queued comment: the time it may be sent, in milliseconds. */
  readonly sendAt: number;
  /** How many times the viewer answered rate_limited. */
  readonly tries: number;
}

/** What the reader wrote and where. */
export interface CommentDraft {
  readonly path: string;
  readonly side: "old" | "new";
  readonly from: number;
  readonly to: number;
  readonly quote: string;
  readonly text: string;
  readonly at: string;
}

export interface CommentBook {
  readonly entries: readonly ReviewComment[];
  /** The number in the next local id. */
  readonly next: number;
}

export const EMPTY_BOOK: CommentBook = { entries: [], next: 1 };

export function fromBridgeComment(c: BridgeComment): ReviewComment {
  return {
    id: `c${String(c.id)}`,
    path: c.anchor.file,
    side: c.anchor.side,
    from: c.anchor.from,
    to: c.anchor.to,
    text: c.body,
    by: c.author,
    at: c.createdAt,
    status: c.status,
    source: "bridge",
    save: "kept",
    line: null,
    quote: c.anchor.quote ?? "",
    sendAt: 0,
    tries: 0,
  };
}

const replace = (
  book: CommentBook,
  id: string,
  change: (e: ReviewComment) => ReviewComment,
): CommentBook =>
  book.entries.some((e) => e.id === id)
    ? { ...book, entries: book.entries.map((e) => (e.id === id ? change(e) : e)) }
    : book;

/**
 * The reader's comment goes into the book at once. It is queued to be sent from `now`, or, when
 * `failure` is given, put in already failed with that line to show.
 */
export function draftComment(
  book: CommentBook,
  draft: CommentDraft,
  now: number,
  failure: string | null = null,
): { readonly book: CommentBook; readonly id: string } {
  const id = `local-${book.next}`;
  const entry: ReviewComment = {
    id,
    path: draft.path,
    side: draft.side,
    from: draft.from,
    to: draft.to,
    text: draft.text,
    by: "",
    at: draft.at,
    status: "open",
    source: "bridge",
    save: failure === null ? "queued" : "failed",
    line: failure,
    quote: draft.quote,
    sendAt: now,
    tries: 0,
  };
  return { book: { entries: [...book.entries, entry], next: book.next + 1 }, id };
}

/** The viewer's list replaces the comments it keeps; the reader's own that it has not kept stay after them. */
export function bookLoaded(book: CommentBook, list: readonly BridgeComment[]): CommentBook {
  return {
    ...book,
    entries: [...list.map(fromBridgeComment), ...book.entries.filter((e) => e.save !== "kept")],
  };
}

export const bookSending = (book: CommentBook, id: string): CommentBook =>
  replace(book, id, (e) => ({ ...e, save: "sending", line: null }));

/** The viewer kept a comment the reader wrote: its comment takes the place of ours, once. */
export function bookKept(book: CommentBook, id: string, kept: BridgeComment): CommentBook {
  if (!book.entries.some((e) => e.id === id)) return book;
  const made = fromBridgeComment(kept);
  const others = book.entries.filter((e) => e.id !== made.id);
  return { ...book, entries: others.map((e) => (e.id === id ? made : e)) };
}

/** A rate_limited answer: the comment waits to be sent again at `sendAt`, and the try is counted. */
export const bookRequeued = (
  book: CommentBook,
  id: string,
  sendAt: number,
  tries: number,
): CommentBook => replace(book, id, (e) => ({ ...e, save: "queued", sendAt, tries, line: null }));

/** The comment is queued to be sent from `sendAt`. */
export const bookQueued = (book: CommentBook, id: string, sendAt: number): CommentBook =>
  replace(book, id, (e) => ({ ...e, save: "queued", sendAt, line: null }));

/** The comment was not kept: it stays in view with the reason. */
export const bookFailed = (book: CommentBook, id: string, line: string): CommentBook =>
  replace(book, id, (e) => ({ ...e, save: "failed", line }));

/** The queued comments whose time has come, in the order they were written. */
export const dueComments = (book: CommentBook, now: number): readonly ReviewComment[] =>
  book.entries.filter((e) => e.save === "queued" && e.sendAt <= now);

/** The earliest time a queued comment is to be sent, or null when none is queued. */
export function nextCommentWake(book: CommentBook): number | null {
  return book.entries.reduce<number | null>(
    (soonest, e) =>
      e.save === "queued" && (soonest === null || e.sendAt < soonest) ? e.sendAt : soonest,
    null,
  );
}
