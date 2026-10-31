// Tests beside scripts/lib/page-bridge.ts: the messages a page sends through the page bridge and
// the checks on the messages it gets back. Pure, so every case is a plain value in and a plain
// value out. The viewer is untrusted from the page's side as much as the page is from the
// viewer's: nothing it sends is used before it passes these checks.
import { describe, expect, test } from "bun:test";
import {
  BRIDGE_TAG,
  BRIDGE_VERSION,
  type BridgeLimits,
  checkBody,
  commentCreateMessage,
  commentsGetMessage,
  cutText,
  helloMessage,
  isRequestId,
  type LineAnchor,
  lineAnchorOf,
  messageBytes,
  parseLineAnchor,
  parseViewerMessage,
  READY_WAIT_MS,
  readLimits,
  REQUEST_WAIT_MS,
  SPEC_LIMITS,
  stateGetMessage,
  stateSetMessage,
} from "./page-bridge.ts";

const envelope = { bridge: "page-bridge", v: 1 } as const;
const anchor: LineAnchor = { kind: "line", file: "src/retry.ts", side: "new", from: 18, to: 22 };
const contractComment = {
  id: 41,
  status: "open",
  author: "reviewer",
  body: "Why is this retried?",
  createdAt: "2026-10-31T09:12:00Z",
  anchor,
  version: 3,
};

describe("the constants the spec fixes", () => {
  test("the envelope names the bridge and version 1", () => {
    expect(BRIDGE_TAG).toBe("page-bridge");
    expect(BRIDGE_VERSION).toBe(1);
  });

  test("the page waits 1.5 seconds for the viewer and 5 seconds for an answer", () => {
    expect(READY_WAIT_MS).toBe(1500);
    expect(REQUEST_WAIT_MS).toBe(5000);
  });

  test("the limits a viewer may announce are at most these", () => {
    expect(SPEC_LIMITS).toEqual({
      messageBytes: 65536,
      stateBytes: 262144,
      bodyChars: 4000,
      writesPerSecond: 10,
    });
  });
});

describe("the messages the page sends", () => {
  test("hello offers version 1 and asks for state and comments", () => {
    expect(helloMessage()).toEqual({
      ...envelope,
      type: "bridge-hello",
      versions: [1],
      want: ["state", "comments"],
    });
  });

  test("a request carries its id", () => {
    expect(stateGetMessage("r1")).toEqual({ ...envelope, type: "state-get", id: "r1" });
    expect(commentsGetMessage("r2")).toEqual({ ...envelope, type: "comments-get", id: "r2" });
  });

  test("a state write names its base revision, the keys it sets and the keys it deletes", () => {
    expect(stateSetMessage("r8", 12, { "tick:src/retry.ts:9f2c41": true }, ["tick:old"])).toEqual({
      ...envelope,
      type: "state-set",
      id: "r8",
      baseRev: 12,
      set: { "tick:src/retry.ts:9f2c41": true },
      del: ["tick:old"],
    });
  });

  test("a comment carries its body and its line anchor", () => {
    expect(commentCreateMessage("r9", "Why is this retried?", anchor)).toEqual({
      ...envelope,
      type: "comment-create",
      id: "r9",
      body: "Why is this retried?",
      anchor,
    });
  });

  test("the spec's example messages are what the builders write", () => {
    const text = JSON.stringify(
      stateSetMessage("r8", 12, { "tick:src/retry.ts:9f2c41": true }, []),
    );
    expect(text).toBe(
      '{"bridge":"page-bridge","v":1,"type":"state-set","id":"r8","baseRev":12,"set":{"tick:src/retry.ts:9f2c41":true},"del":[]}',
    );
  });

  test("a message's size is its JSON in UTF-8 bytes", () => {
    expect(messageBytes({ a: "é" })).toBe(new TextEncoder().encode('{"a":"é"}').byteLength);
    expect(messageBytes(helloMessage())).toBe(JSON.stringify(helloMessage()).length);
  });
});

describe("request ids", () => {
  test("1 to 64 characters of letters, digits, underscore and hyphen", () => {
    for (const id of ["r1", "a-b_C9", "x", "r".repeat(64)]) expect(isRequestId(id)).toBe(true);
  });

  test("anything else is not an id", () => {
    for (const id of ["", "r".repeat(65), "a b", "é", "a.b", 7, null, undefined, {}]) {
      expect(isRequestId(id)).toBe(false);
    }
  });
});

describe("the limits a viewer announces", () => {
  test("a complete set is taken as it is, smaller values included", () => {
    const small: BridgeLimits = {
      messageBytes: 2048,
      stateBytes: 4096,
      bodyChars: 500,
      writesPerSecond: 2,
    };
    expect(readLimits(small)).toEqual(small);
    expect(readLimits({ ...SPEC_LIMITS })).toEqual(SPEC_LIMITS);
  });

  test("a missing set is the spec's", () => {
    for (const raw of [undefined, null, 7, "x", [], {}])
      expect(readLimits(raw)).toEqual(SPEC_LIMITS);
  });

  test("a field that is not a positive whole number falls back alone", () => {
    const got = readLimits({
      messageBytes: 0,
      stateBytes: -5,
      bodyChars: 1.5,
      writesPerSecond: "10",
    });
    expect(got).toEqual(SPEC_LIMITS);
    expect(readLimits({ messageBytes: 1000, bodyChars: Number.NaN, writesPerSecond: 3 })).toEqual({
      ...SPEC_LIMITS,
      messageBytes: 1000,
      writesPerSecond: 3,
    });
    expect(readLimits({ stateBytes: Number.POSITIVE_INFINITY }).stateBytes).toBe(
      SPEC_LIMITS.stateBytes,
    );
  });

  test("a field it does not know is ignored, not carried", () => {
    expect(readLimits({ ...SPEC_LIMITS, futureLimit: 3 })).toEqual(SPEC_LIMITS);
  });
});

describe("a line anchor", () => {
  test("the page's own anchor reads back as it was written", () => {
    expect(parseLineAnchor(anchor)).toEqual(anchor);
    expect(parseLineAnchor({ ...anchor, quote: "retry()" })).toEqual({
      ...anchor,
      quote: "retry()",
    });
  });

  test("a field it does not know is dropped", () => {
    expect(parseLineAnchor({ ...anchor, extra: 1 })).toEqual(anchor);
  });

  test("each field is held to the contract", () => {
    const bad: unknown[] = [
      null,
      "src/a.ts",
      [],
      { ...anchor, kind: "text" },
      { ...anchor, kind: undefined },
      { ...anchor, file: "" },
      { ...anchor, file: "x".repeat(1025) },
      { ...anchor, file: 3 },
      { ...anchor, side: "left" },
      { ...anchor, from: 0 },
      { ...anchor, from: 1.5 },
      { ...anchor, from: 23 },
      { ...anchor, to: "22" },
      { ...anchor, to: 2 ** 31 },
      { ...anchor, quote: 5 },
      { ...anchor, quote: "q".repeat(2001) },
    ];
    for (const raw of bad) expect([raw, parseLineAnchor(raw)]).toEqual([raw, null]);
  });

  test("a file of 1024 characters and a quote of 2000 are allowed", () => {
    const edge = { ...anchor, file: "f".repeat(1024), quote: "q".repeat(2000) };
    expect(parseLineAnchor(edge)).toEqual(edge);
  });

  test("an anchor is built from what the page knows, with the quote cut to 2000 characters", () => {
    expect(lineAnchorOf("src/retry.ts", "new", 18, 22, "")).toEqual(anchor);
    expect(lineAnchorOf("src/retry.ts", "old", 3, 3, "x = 1")).toEqual({
      kind: "line",
      file: "src/retry.ts",
      side: "old",
      from: 3,
      to: 3,
      quote: "x = 1",
    });
    const long = lineAnchorOf("a.ts", "new", 1, 2, "q".repeat(2500));
    expect(long?.quote).toBe("q".repeat(2000));
  });

  test("an anchor the contract refuses is not built", () => {
    expect(lineAnchorOf("", "new", 1, 1, "")).toBeNull();
    expect(lineAnchorOf("x".repeat(1025), "new", 1, 1, "")).toBeNull();
    expect(lineAnchorOf("a.ts", "both", 1, 1, "")).toBeNull();
    expect(lineAnchorOf("a.ts", "new", 5, 4, "")).toBeNull();
    expect(lineAnchorOf("a.ts", "new", 0, 4, "")).toBeNull();
  });
});

describe("cutting a quote", () => {
  test("text within the limit is left alone", () => {
    expect(cutText("short", 10)).toBe("short");
    expect(cutText("1234567890", 10)).toBe("1234567890");
  });

  test("longer text is cut at the limit", () => {
    expect(cutText("1234567890x", 10)).toBe("1234567890");
  });

  test("a cut never leaves half of a character that takes two code units", () => {
    const pair = "\u{1F600}";
    const cut = cutText(`${"a".repeat(9)}${pair}tail`, 10);
    expect(cut).toBe("a".repeat(9));
    expect(cutText(`${"a".repeat(8)}${pair}tail`, 10)).toBe(`${"a".repeat(8)}${pair}`);
  });
});

describe("a comment body", () => {
  test("it is trimmed, and must hold something within the limit", () => {
    expect(checkBody("  why?  ", SPEC_LIMITS)).toEqual({ ok: true, body: "why?" });
    expect(checkBody("   ", SPEC_LIMITS)).toEqual({ ok: false, reason: "empty" });
    expect(checkBody("", SPEC_LIMITS)).toEqual({ ok: false, reason: "empty" });
  });

  test("the limit is the viewer's, and 4000 characters is the most the spec allows", () => {
    expect(checkBody("x".repeat(4000), SPEC_LIMITS).ok).toBe(true);
    expect(checkBody("x".repeat(4001), SPEC_LIMITS)).toEqual({ ok: false, reason: "long" });
    const small = { ...SPEC_LIMITS, bodyChars: 10 };
    expect(checkBody("x".repeat(10), small).ok).toBe(true);
    expect(checkBody("x".repeat(11), small)).toEqual({ ok: false, reason: "long" });
  });
});

describe("a message from the viewer", () => {
  test("bridge-ready carries the version, the capabilities granted and the limits", () => {
    const ready = parseViewerMessage({
      ...envelope,
      type: "bridge-ready",
      version: 1,
      caps: ["state", "comments"],
      limits: SPEC_LIMITS,
    });
    expect(ready).toEqual({
      type: "ready",
      version: 1,
      caps: ["state", "comments"],
      limits: SPEC_LIMITS,
    });
  });

  test("a capability it does not know is ignored, and a version other than 1 is no answer", () => {
    const ready = parseViewerMessage({
      ...envelope,
      type: "bridge-ready",
      version: 1,
      caps: ["state", "voice", 7],
      limits: SPEC_LIMITS,
    });
    expect(ready).toMatchObject({ type: "ready", caps: ["state"] });
    expect(
      parseViewerMessage({ ...envelope, type: "bridge-ready", version: 2, caps: [], limits: {} }),
    ).toBeNull();
    expect(parseViewerMessage({ ...envelope, type: "bridge-ready", caps: "state" })).toBeNull();
  });

  test("bridge-ready without limits falls back to the spec's", () => {
    expect(
      parseViewerMessage({ ...envelope, type: "bridge-ready", version: 1, caps: ["state"] }),
    ).toMatchObject({ limits: SPEC_LIMITS });
  });

  test("state carries the document and its revision", () => {
    expect(
      parseViewerMessage({
        ...envelope,
        type: "state",
        id: "r1",
        doc: { "tick:a:1": true },
        rev: 4,
      }),
    ).toEqual({ type: "state", id: "r1", doc: { "tick:a:1": true }, rev: 4 });
    expect(parseViewerMessage({ ...envelope, type: "state", id: "r1", doc: {}, rev: 0 })).toEqual({
      type: "state",
      id: "r1",
      doc: {},
      rev: 0,
    });
  });

  test("state with a document that is not an object, a bad revision or a bad id is refused", () => {
    for (const bad of [
      { id: "r1", doc: [], rev: 1 },
      { id: "r1", doc: null, rev: 1 },
      { id: "r1", doc: {}, rev: -1 },
      { id: "r1", doc: {}, rev: 1.5 },
      { id: "r1", doc: {}, rev: "1" },
      { id: "", doc: {}, rev: 1 },
      { doc: {}, rev: 1 },
    ]) {
      expect([bad, parseViewerMessage({ ...envelope, type: "state", ...bad })]).toEqual([
        bad,
        null,
      ]);
    }
  });

  test("comment carries one comment in the contract's shape", () => {
    expect(
      parseViewerMessage({ ...envelope, type: "comment", id: "r9", comment: contractComment }),
    ).toEqual({ type: "comment", id: "r9", comment: contractComment });
  });

  test("a comment whose anchor is not a line anchor, or with no body, is refused", () => {
    const text = { kind: "text", quote: "a", prefix: "", suffix: "" };
    expect(
      parseViewerMessage({
        ...envelope,
        type: "comment",
        id: "r9",
        comment: { ...contractComment, anchor: text },
      }),
    ).toBeNull();
    expect(
      parseViewerMessage({
        ...envelope,
        type: "comment",
        id: "r9",
        comment: { ...contractComment, body: 5 },
      }),
    ).toBeNull();
  });

  test("comments carries a list, and an entry that fails the contract is left out of it", () => {
    const got = parseViewerMessage({
      ...envelope,
      type: "comments",
      id: "r2",
      list: [contractComment, { id: 1 }, { ...contractComment, id: "c2", status: "closed" }],
    });
    expect(got).toMatchObject({ type: "comments", id: "r2", truncated: false });
    expect(got?.type === "comments" ? got.list.map((c) => c.id) : []).toEqual([41, "c2"]);
    expect(
      parseViewerMessage({ ...envelope, type: "comments", id: "r2", list: [], truncated: true }),
    ).toEqual({ type: "comments", id: "r2", list: [], truncated: true });
    expect(parseViewerMessage({ ...envelope, type: "comments", id: "r2", list: "no" })).toBeNull();
  });

  test("an unknown status reads as open and a missing author as empty", () => {
    const got = parseViewerMessage({
      ...envelope,
      type: "comment",
      id: "r9",
      comment: { id: 5, body: "b", anchor, status: "weird" },
    });
    expect(got).toMatchObject({
      type: "comment",
      comment: { id: 5, status: "open", author: "", body: "b", createdAt: "", version: 0 },
    });
  });

  test("comment-focus carries a line anchor", () => {
    expect(parseViewerMessage({ ...envelope, type: "comment-focus", anchor })).toEqual({
      type: "focus",
      anchor,
    });
    expect(
      parseViewerMessage({ ...envelope, type: "comment-focus", anchor: { kind: "text" } }),
    ).toBeNull();
  });

  test("bridge-error carries its code, its text and the request it answers", () => {
    expect(
      parseViewerMessage({
        ...envelope,
        type: "bridge-error",
        id: "r3",
        code: "rate_limited",
        message: "slow down",
      }),
    ).toEqual({ type: "error", id: "r3", code: "rate_limited", message: "slow down" });
    expect(parseViewerMessage({ ...envelope, type: "bridge-error", code: "unsupported" })).toEqual({
      type: "error",
      id: null,
      code: "unsupported",
      message: "",
    });
  });

  test("a conflict carries the current document and revision", () => {
    expect(
      parseViewerMessage({
        ...envelope,
        type: "bridge-error",
        id: "r8",
        code: "conflict",
        doc: { "tick:a:1": true },
        rev: 13,
      }),
    ).toEqual({
      type: "error",
      id: "r8",
      code: "conflict",
      message: "",
      doc: { "tick:a:1": true },
      rev: 13,
    });
  });

  test("a conflict without a usable document is read as unavailable, since it cannot be reapplied", () => {
    for (const extra of [{}, { doc: {} }, { rev: 3 }, { doc: [], rev: 3 }, { doc: {}, rev: -1 }]) {
      expect(
        parseViewerMessage({
          ...envelope,
          type: "bridge-error",
          id: "r8",
          code: "conflict",
          ...extra,
        }),
      ).toMatchObject({ type: "error", id: "r8", code: "unavailable" });
    }
  });

  test("an error code it does not know is read as unavailable", () => {
    expect(
      parseViewerMessage({ ...envelope, type: "bridge-error", id: "r3", code: "teapot" }),
    ).toMatchObject({ code: "unavailable" });
  });

  test("anything that is not a version 1 bridge message is not for the page", () => {
    for (const data of [
      null,
      "text",
      7,
      [],
      {},
      { type: "state", id: "r1", doc: {}, rev: 0 },
      { bridge: "other", v: 1, type: "state", id: "r1", doc: {}, rev: 0 },
      { ...envelope, v: 2, type: "state", id: "r1", doc: {}, rev: 0 },
      { ...envelope, type: "bridge-hello", versions: [1], want: [] },
      { ...envelope, type: "teapot" },
      { ...envelope },
    ]) {
      expect([data, parseViewerMessage(data)]).toEqual([data, null]);
    }
  });

  test("fields it does not know are ignored", () => {
    expect(
      parseViewerMessage({ ...envelope, type: "state", id: "r1", doc: {}, rev: 0, future: 1 }),
    ).toEqual({ type: "state", id: "r1", doc: {}, rev: 0 });
  });
});
