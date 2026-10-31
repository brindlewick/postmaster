// Tests beside scripts/lib/page-bridge-comments.ts: the line comments of a page as it paints them,
// those the viewer keeps and those the reader has written that the viewer has not yet kept. Pure:
// every case is a book in and a book out.
import { describe, expect, test } from "bun:test";
import type { BridgeComment } from "./page-bridge.ts";
import {
  bookFailed,
  bookKept,
  bookLoaded,
  bookQueued,
  bookRequeued,
  bookSending,
  type CommentBook,
  type CommentDraft,
  draftComment,
  dueComments,
  EMPTY_BOOK,
  fromBridgeComment,
  nextCommentWake,
} from "./page-bridge-comments.ts";

const hostComment = (id: number | string, over: Partial<BridgeComment> = {}): BridgeComment => ({
  id,
  status: "open",
  author: "reviewer",
  body: "Why is this retried?",
  createdAt: "2026-10-31T09:12:00Z",
  anchor: { kind: "line", file: "src/retry.ts", side: "new", from: 18, to: 22, quote: "retry()" },
  version: 3,
  ...over,
});

const draft = (over: Partial<CommentDraft> = {}): CommentDraft => ({
  path: "src/retry.ts",
  side: "new",
  from: 18,
  to: 22,
  quote: "retry()",
  text: "Why is this retried?",
  at: "2026-10-31T10:00:00.000Z",
  ...over,
});

const ids = (book: CommentBook): string[] => book.entries.map((e) => e.id);

describe("a comment the viewer keeps", () => {
  test("it is painted from the contract's shape: its place, its words, who and when", () => {
    expect(fromBridgeComment(hostComment(41))).toEqual({
      id: "c41",
      path: "src/retry.ts",
      side: "new",
      from: 18,
      to: 22,
      text: "Why is this retried?",
      by: "reviewer",
      at: "2026-10-31T09:12:00Z",
      status: "open",
      source: "bridge",
      save: "kept",
      line: null,
      quote: "retry()",
      sendAt: 0,
      tries: 0,
    });
  });

  test("an id the viewer gives as text is kept as text, and a closed comment says so", () => {
    const c = fromBridgeComment(hostComment("a-7", { status: "closed" }));
    expect(c.id).toBe("ca-7");
    expect(c.status).toBe("closed");
  });

  test("a comment without a quote has an empty one", () => {
    const anchor = { kind: "line", file: "a.ts", side: "old", from: 1, to: 1 } as const;
    expect(fromBridgeComment(hostComment(1, { anchor })).quote).toBe("");
  });
});

describe("a comment the reader writes", () => {
  test("it is in the book at once, queued, with an id of its own", () => {
    const { book, id } = draftComment(EMPTY_BOOK, draft(), 5000);
    expect(id).toBe("local-1");
    expect(book.entries).toHaveLength(1);
    expect(book.entries[0]).toMatchObject({
      id: "local-1",
      path: "src/retry.ts",
      side: "new",
      from: 18,
      to: 22,
      text: "Why is this retried?",
      by: "",
      at: "2026-10-31T10:00:00.000Z",
      status: "open",
      save: "queued",
      line: null,
      sendAt: 5000,
      tries: 0,
    });
  });

  test("each gets a new id", () => {
    const one = draftComment(EMPTY_BOOK, draft(), 1);
    const two = draftComment(one.book, draft({ from: 3, to: 3 }), 2);
    expect(two.id).toBe("local-2");
    expect(ids(two.book)).toEqual(["local-1", "local-2"]);
  });

  test("it can be put in the book already failed, with the line to show", () => {
    const { book } = draftComment(EMPTY_BOOK, draft(), 1, "Not saved: too long.");
    expect(book.entries[0]).toMatchObject({ save: "failed", line: "Not saved: too long." });
    expect(dueComments(book, 99)).toEqual([]);
  });

  test("it goes out when it is due, and then it is sending", () => {
    const { book, id } = draftComment(EMPTY_BOOK, draft(), 5000);
    expect(dueComments(book, 4999)).toEqual([]);
    expect(dueComments(book, 5000).map((e) => e.id)).toEqual([id]);
    const sending = bookSending(book, id);
    expect(sending.entries[0]?.save).toBe("sending");
    expect(dueComments(sending, 9999)).toEqual([]);
  });

  test("the viewer keeps it: the book holds the viewer's comment in its place", () => {
    const { book, id } = draftComment(EMPTY_BOOK, draft(), 1);
    const kept = bookKept(bookSending(book, id), id, hostComment(41));
    expect(ids(kept)).toEqual(["c41"]);
    expect(kept.entries[0]).toMatchObject({ save: "kept", by: "reviewer", line: null });
  });

  test("if the list already holds the comment the viewer kept, it is not shown twice", () => {
    const { book, id } = draftComment(EMPTY_BOOK, draft(), 1);
    const listed = bookLoaded(bookSending(book, id), [hostComment(41)]);
    expect(ids(listed)).toEqual(["c41", "local-1"]);
    const kept = bookKept(listed, id, hostComment(41));
    expect(ids(kept)).toEqual(["c41"]);
  });

  test("an answer for a comment the book does not hold changes nothing", () => {
    const { book } = draftComment(EMPTY_BOOK, draft(), 1);
    expect(bookKept(book, "local-9", hostComment(41))).toBe(book);
  });

  test("a rate limited answer puts it back in the queue for later, counting the try", () => {
    const { book, id } = draftComment(EMPTY_BOOK, draft(), 1);
    const again = bookRequeued(bookSending(book, id), id, 9000, 1);
    expect(again.entries[0]).toMatchObject({ save: "queued", sendAt: 9000, tries: 1 });
    expect(dueComments(again, 8999)).toEqual([]);
    expect(dueComments(again, 9000)).toHaveLength(1);
  });

  test("a comment that could not be kept stays in the book with the reason to show", () => {
    const { book, id } = draftComment(EMPTY_BOOK, draft(), 1);
    const failed = bookFailed(
      bookSending(book, id),
      id,
      "Not saved: the viewer could not be reached.",
    );
    expect(failed.entries[0]).toMatchObject({
      save: "failed",
      line: "Not saved: the viewer could not be reached.",
    });
    expect(failed.entries[0]?.text).toBe("Why is this retried?");
  });

  test("a queued comment can be queued again for now", () => {
    const { book, id } = draftComment(EMPTY_BOOK, draft(), 1, "Not saved");
    const queued = bookQueued(book, id, 77);
    expect(queued.entries[0]).toMatchObject({ save: "queued", sendAt: 77, line: null });
  });
});

describe("the list the viewer answers with", () => {
  test("it replaces the comments the viewer kept, in its order", () => {
    const first = bookLoaded(EMPTY_BOOK, [hostComment(1), hostComment(2)]);
    expect(ids(first)).toEqual(["c1", "c2"]);
    const second = bookLoaded(first, [hostComment(2, { status: "closed" }), hostComment(3)]);
    expect(ids(second)).toEqual(["c2", "c3"]);
    expect(second.entries[0]?.status).toBe("closed");
    expect(ids(bookLoaded(second, []))).toEqual([]);
  });

  test("the reader's own comments that the viewer has not kept stay after it", () => {
    const { book } = draftComment(EMPTY_BOOK, draft(), 1);
    const failed = draftComment(book, draft({ from: 2, to: 2 }), 2, "Not saved");
    const loaded = bookLoaded(failed.book, [hostComment(1)]);
    expect(ids(loaded)).toEqual(["c1", "local-1", "local-2"]);
  });

  test("the numbering of the reader's comments goes on", () => {
    const { book } = draftComment(EMPTY_BOOK, draft(), 1);
    const loaded = bookLoaded(book, []);
    expect(draftComment(loaded, draft(), 2).id).toBe("local-2");
  });
});

describe("when the next queued comment is due", () => {
  test("there is none to wait for when nothing is queued", () => {
    expect(nextCommentWake(EMPTY_BOOK)).toBeNull();
    const { book, id } = draftComment(EMPTY_BOOK, draft(), 10);
    expect(nextCommentWake(bookSending(book, id))).toBeNull();
    expect(nextCommentWake(bookKept(book, id, hostComment(1)))).toBeNull();
  });

  test("the earliest of the queued", () => {
    const one = draftComment(EMPTY_BOOK, draft(), 300);
    const two = draftComment(one.book, draft(), 200);
    expect(nextCommentWake(two.book)).toBe(200);
  });
});
