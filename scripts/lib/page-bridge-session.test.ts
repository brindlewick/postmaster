// Tests beside scripts/lib/page-bridge-session.ts: the whole page side of a visit as one reducer.
// Each case plays a visit as a list of events (the page starts, the viewer answers, the reader
// ticks or comments, the clock moves) and reads what the page sent, what it shows and when it
// wants to be woken. Pure: no timer, no window; the clock is the `now` of each event.
import { describe, expect, test } from "bun:test";
import {
  type BridgeComment,
  type BridgeErrorCode,
  type BridgeLimits,
  type BridgeCap,
  isRequestId,
  type JsonObject,
  type LineAnchor,
  messageBytes,
  type PageMessage,
  READY_WAIT_MS,
  REQUEST_WAIT_MS,
  SPEC_LIMITS,
  type ViewerMessage,
} from "./page-bridge.ts";
import type { CommentDraft } from "./page-bridge-comments.ts";
import { DEBOUNCE_MS } from "./page-bridge-requests.ts";
import {
  commentsNote,
  entryNote,
  NEW_SESSION,
  reduceSession,
  type Session,
  type SessionEvent,
  sessionWake,
  ticksNote,
} from "./page-bridge-session.ts";
import { isTicked, stateView } from "./page-bridge-state.ts";

const T = 1_000_000;
const HASH = "0123456789abcdef".repeat(4);
const KEY_A = `tick:a.ts:${HASH}`;
const KEY_B = `tick:b.ts:${HASH}`;
const TICKS_NOTE = "Not saved. Ticks last until you close this page.";
const COMMENTS_NOTE = "Not saved. Comments last until you close this page.";

/** A visit played by hand: the session so far, what it sent and what it asked the page to show. */
function visit(initial: Session = NEW_SESSION) {
  let session = initial;
  const sent: PageMessage[] = [];
  const focused: LineAnchor[] = [];
  const dispatch = (event: SessionEvent) => {
    const step = reduceSession(session, event);
    session = step.session;
    const now: PageMessage[] = [];
    for (const effect of step.effects) {
      if (effect.type === "send") now.push(effect.message);
      else focused.push(effect.anchor);
    }
    sent.push(...now);
    return now;
  };
  const viewer = (now: number, message: ViewerMessage) =>
    dispatch({ type: "viewer", now, message });
  return {
    get session() {
      return session;
    },
    sent,
    focused,
    dispatch,
    viewer,
    start: (now: number, framed = true) => dispatch({ type: "start", now, framed }),
    clock: (now: number) => dispatch({ type: "clock", now }),
    tick: (now: number, key: string, on = true) => dispatch({ type: "tick", now, key, on }),
    hide: (now: number) => dispatch({ type: "hide", now }),
    comment: (now: number, over: Partial<CommentDraft> = {}) =>
      dispatch({ type: "comment", now, draft: draft(over) }),
    ready: (
      now: number,
      caps: readonly BridgeCap[] = ["state", "comments"],
      limits = SPEC_LIMITS,
    ) => viewer(now, { type: "ready", version: 1, caps, limits }),
    state: (now: number, id: string, doc: JsonObject = {}, rev = 0) =>
      viewer(now, { type: "state", id, doc, rev }),
    error: (
      now: number,
      id: string | null,
      code: BridgeErrorCode,
      extra: { doc?: JsonObject; rev?: number } = {},
    ) => viewer(now, { type: "error", id, code, message: "", ...extra }),
    last: (type: string): PageMessage => {
      const found = sent.findLast((m) => m.type === type);
      if (found === undefined) throw new Error(`nothing of type ${type} was sent`);
      return found;
    },
    count: (type: string) => sent.filter((m) => m.type === type).length,
  };
}

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

const hostComment = (id: number, over: Partial<BridgeComment> = {}): BridgeComment => ({
  id,
  status: "open",
  author: "reviewer",
  body: "Why is this retried?",
  createdAt: "2026-10-31T09:12:00Z",
  anchor: { kind: "line", file: "src/retry.ts", side: "new", from: 18, to: 22, quote: "retry()" },
  version: 3,
  ...over,
});

const idOf = (message: PageMessage): string => String(message.id);

/** A visit that has said hello, been told it is ready, and been given its document. */
function connected(
  caps: readonly BridgeCap[] = ["state", "comments"],
  doc: JsonObject = {},
  rev = 0,
  limits: BridgeLimits = SPEC_LIMITS,
) {
  const v = visit();
  v.start(T);
  v.ready(T + 20, caps, limits);
  if (caps.includes("state")) v.state(T + 40, idOf(v.last("state-get")), doc, rev);
  if (caps.includes("comments")) {
    v.viewer(T + 41, {
      type: "comments",
      id: idOf(v.last("comments-get")),
      list: [],
      truncated: false,
    });
  }
  return v;
}

describe("starting a visit", () => {
  test("a page that is not in a frame has no viewer: it says nothing and shows Not saved", () => {
    const v = visit();
    expect(v.start(T, false)).toEqual([]);
    expect(v.session.phase).toBe("off");
    expect(ticksNote(v.session)).toBe(TICKS_NOTE);
    expect(commentsNote(v.session)).toBe(COMMENTS_NOTE);
    expect(sessionWake(v.session)).toBeNull();
  });

  test("a page in a frame says hello once, offering version 1 and asking for state and comments", () => {
    const v = visit();
    const sent = v.start(T);
    expect(sent).toEqual([
      {
        bridge: "page-bridge",
        v: 1,
        type: "bridge-hello",
        versions: [1],
        want: ["state", "comments"],
      },
    ]);
    expect(v.session.phase).toBe("waiting");
  });

  test("while it waits it shows nothing, and it wants to be woken when the wait runs out", () => {
    const v = visit();
    v.start(T);
    expect(ticksNote(v.session)).toBeNull();
    expect(commentsNote(v.session)).toBeNull();
    expect(sessionWake(v.session)).toBe(T + READY_WAIT_MS);
  });
});

describe("the handshake", () => {
  test("bridge-ready with both capabilities asks for the document and the comments", () => {
    const v = visit();
    v.start(T);
    const sent = v.ready(T + 30);
    expect(sent.map((m) => m.type)).toEqual(["state-get", "comments-get"]);
    expect(sent.every((m) => isRequestId(m.id))).toBe(true);
    expect(v.session.phase).toBe("ready");
    expect(v.session.caps).toEqual(["state", "comments"]);
  });

  test("the limits it announces are the limits the page keeps", () => {
    const v = visit();
    v.start(T);
    const small = { ...SPEC_LIMITS, bodyChars: 100, writesPerSecond: 2 };
    v.ready(T + 30, ["state", "comments"], small);
    expect(v.session.limits).toEqual(small);
  });

  test("a capability not granted is not asked for, and its Not saved shows", () => {
    const onlyState = visit();
    onlyState.start(T);
    expect(onlyState.ready(T + 5, ["state"]).map((m) => m.type)).toEqual(["state-get"]);
    expect(ticksNote(onlyState.session)).toBeNull();
    expect(commentsNote(onlyState.session)).toBe(COMMENTS_NOTE);
    const onlyComments = visit();
    onlyComments.start(T);
    expect(onlyComments.ready(T + 5, ["comments"]).map((m) => m.type)).toEqual(["comments-get"]);
    expect(ticksNote(onlyComments.session)).toBe(TICKS_NOTE);
    expect(commentsNote(onlyComments.session)).toBeNull();
  });

  test("a viewer that grants nothing is no viewer: Not saved, and no request", () => {
    const v = visit();
    v.start(T);
    expect(v.ready(T + 5, [])).toEqual([]);
    expect(v.session.phase).toBe("unsaved");
    expect(ticksNote(v.session)).toBe(TICKS_NOTE);
  });

  test("a second bridge-ready in the same visit is ignored", () => {
    const v = connected();
    const before = v.sent.length;
    expect(v.ready(T + 900)).toEqual([]);
    expect(v.sent.length).toBe(before);
  });

  test("no bridge-ready in 1.5 seconds: the page keeps its state in memory and shows Not saved", () => {
    const v = visit();
    v.start(T);
    v.clock(T + READY_WAIT_MS - 1);
    expect(v.session.phase).toBe("waiting");
    v.clock(T + READY_WAIT_MS);
    expect(v.session.phase).toBe("unsaved");
    expect(ticksNote(v.session)).toBe(TICKS_NOTE);
    expect(commentsNote(v.session)).toBe(COMMENTS_NOTE);
    expect(sessionWake(v.session)).toBeNull();
  });

  test("a bridge-error with no id, such as no shared version, is the end of the wait", () => {
    const v = visit();
    v.start(T);
    v.error(T + 10, null, "unsupported");
    expect(v.session.phase).toBe("unsaved");
    expect(ticksNote(v.session)).toBe(TICKS_NOTE);
  });

  test("a bridge-ready that comes late is taken, and the work kept in memory goes out", () => {
    const v = visit();
    v.start(T);
    v.clock(T + READY_WAIT_MS);
    v.tick(T + 2000, KEY_A);
    v.comment(T + 2100);
    expect(v.count("state-set")).toBe(0);
    expect(v.count("comment-create")).toBe(0);
    v.ready(T + 3000);
    expect(v.session.phase).toBe("ready");
    expect(v.count("comment-create")).toBe(1);
    v.state(T + 3010, idOf(v.last("state-get")), {}, 4);
    v.clock(T + 3010);
    expect(v.last("state-set")).toMatchObject({ baseRev: 4, set: { [KEY_A]: true }, del: [] });
    expect(ticksNote(v.session)).toBeNull();
  });
});

describe("ticks", () => {
  test("the viewer's document shows the ticks it holds", () => {
    const v = connected(["state", "comments"], { [KEY_A]: true, other: 1 }, 7);
    expect(isTicked(v.session.state, KEY_A)).toBe(true);
    expect(v.session.state.rev).toBe(7);
    expect(ticksNote(v.session)).toBeNull();
  });

  test("a tick shows at once and is written 0.4 seconds later, against the revision held", () => {
    const v = connected(["state", "comments"], {}, 12);
    v.tick(T + 100, KEY_A);
    expect(isTicked(v.session.state, KEY_A)).toBe(true);
    expect(sessionWake(v.session)).toBe(T + 100 + DEBOUNCE_MS);
    expect(v.clock(T + 100 + DEBOUNCE_MS - 1)).toEqual([]);
    const sent = v.clock(T + 100 + DEBOUNCE_MS);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: "state-set",
      baseRev: 12,
      set: { [KEY_A]: true },
      del: [],
    });
    expect(isRequestId(sent[0]?.id)).toBe(true);
  });

  test("a run of taps goes out as one write", () => {
    const v = connected(["state", "comments"], { [KEY_B]: true }, 3);
    v.tick(T + 100, KEY_A);
    v.tick(T + 300, KEY_B, false);
    expect(v.clock(T + 100 + DEBOUNCE_MS)).toEqual([]);
    const sent = v.clock(T + 300 + DEBOUNCE_MS);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ set: { [KEY_A]: true }, del: [KEY_B] });
  });

  test("a tick before the document is loaded waits for it, and goes out against its revision", () => {
    const v = visit();
    v.start(T);
    v.ready(T + 10);
    v.tick(T + 20, KEY_A);
    expect(v.clock(T + 20 + DEBOUNCE_MS)).toEqual([]);
    expect(isTicked(v.session.state, KEY_A)).toBe(true);
    const sent = v.state(T + 700, idOf(v.last("state-get")), { [KEY_B]: true }, 9);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "state-set", baseRev: 9, set: { [KEY_A]: true } });
    expect(stateView(v.session.state)).toMatchObject({ [KEY_A]: true, [KEY_B]: true });
  });

  test("the viewer applies the write and answers with the document, which the page then holds", () => {
    const v = connected(["state", "comments"], {}, 1);
    v.tick(T + 100, KEY_A);
    const sent = v.clock(T + 600);
    v.state(T + 650, idOf(sent[0] as PageMessage), { [KEY_A]: true, [KEY_B]: true }, 2);
    expect(v.session.state.rev).toBe(2);
    expect(v.session.state.inFlight).toEqual({});
    expect(isTicked(v.session.state, KEY_B)).toBe(true);
    expect(ticksNote(v.session)).toBeNull();
    expect(v.clock(T + 5000)).toEqual([]);
    expect(sessionWake(v.session)).toBeNull();
  });

  test("a tick made while a write is out waits for its answer and then goes against the new revision", () => {
    const v = connected(["state", "comments"], {}, 1);
    v.tick(T + 100, KEY_A);
    const first = v.clock(T + 600);
    v.tick(T + 700, KEY_B);
    expect(v.clock(T + 700 + DEBOUNCE_MS)).toEqual([]);
    const second = v.state(T + 1200, idOf(first[0] as PageMessage), { [KEY_A]: true }, 2);
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ baseRev: 2, set: { [KEY_B]: true } });
  });

  test("leaving the page writes what waits without the wait", () => {
    const v = connected(["state", "comments"], {}, 1);
    v.tick(T + 100, KEY_A);
    const sent = v.hide(T + 150);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: "state-set", set: { [KEY_A]: true } });
    expect(v.hide(T + 160)).toEqual([]);
  });

  test("writes keep to the pace the viewer allows", () => {
    const v = connected(["state", "comments"], {}, 1, { ...SPEC_LIMITS, writesPerSecond: 1 });
    v.tick(T + 100, KEY_A);
    const first = v.clock(T + 500);
    v.state(T + 520, idOf(first[0] as PageMessage), { [KEY_A]: true }, 2);
    v.tick(T + 530, KEY_B);
    expect(v.clock(T + 930)).toEqual([]);
    expect(sessionWake(v.session)).toBe(T + 500 + 1000);
    expect(v.clock(T + 1499)).toEqual([]);
    expect(v.clock(T + 1500)).toHaveLength(1);
  });

  test("every message it sends fits the viewer's message limit, and a long run of ticks takes several writes", () => {
    const limits = { ...SPEC_LIMITS, messageBytes: 700 };
    const v = connected(["state", "comments"], {}, 0, limits);
    for (let i = 0; i < 20; i++) v.tick(T + 100 + i, `tick:file-${i}.ts:${HASH}`);
    v.clock(T + 600);
    let answered = 0;
    while (v.count("state-set") > answered && answered < 12) {
      answered += 1;
      v.state(
        T + 700 + answered * 10,
        idOf(v.last("state-set")),
        { ...stateView(v.session.state) },
        answered,
      );
    }
    for (const message of v.sent) expect(messageBytes(message)).toBeLessThanOrEqual(700);
    expect(v.count("state-set")).toBeGreaterThan(2);
    expect(v.session.state.pending).toEqual({});
    expect(v.session.state.inFlight).toEqual({});
  });
});

describe("a conflict", () => {
  test("the page reapplies its change to the document it is given and writes again, once", () => {
    const v = connected(["state", "comments"], {}, 1);
    v.tick(T + 100, KEY_A);
    const first = v.clock(T + 600);
    const retry = v.error(T + 650, idOf(first[0] as PageMessage), "conflict", {
      doc: { [KEY_B]: true },
      rev: 5,
    });
    expect(retry).toHaveLength(1);
    expect(retry[0]).toMatchObject({
      type: "state-set",
      baseRev: 5,
      set: { [KEY_A]: true },
      del: [],
    });
    expect(idOf(retry[0] as PageMessage)).not.toBe(idOf(first[0] as PageMessage));
    // what the other reader ticked is in view as well
    expect(isTicked(v.session.state, KEY_B)).toBe(true);
    expect(isTicked(v.session.state, KEY_A)).toBe(true);
    v.state(T + 700, idOf(retry[0] as PageMessage), { [KEY_A]: true, [KEY_B]: true }, 6);
    expect(ticksNote(v.session)).toBeNull();
    expect(v.session.state.rev).toBe(6);
  });

  test("a second conflict in a row is not retried at once: the change waits, Not saved shows, the next tick tries again", () => {
    const v = connected(["state", "comments"], {}, 1);
    v.tick(T + 100, KEY_A);
    const first = v.clock(T + 600);
    const retry = v.error(T + 650, idOf(first[0] as PageMessage), "conflict", { doc: {}, rev: 5 });
    const after = v.error(T + 700, idOf(retry[0] as PageMessage), "conflict", { doc: {}, rev: 8 });
    expect(after).toEqual([]);
    expect(v.session.state.rev).toBe(8);
    expect(ticksNote(v.session)).toBe(TICKS_NOTE);
    expect(v.clock(T + 9000)).toEqual([]);
    expect(isTicked(v.session.state, KEY_A)).toBe(true);
    v.tick(T + 10000, KEY_B);
    const again = v.clock(T + 10000 + DEBOUNCE_MS);
    expect(again).toHaveLength(1);
    expect(again[0]).toMatchObject({ baseRev: 8, set: { [KEY_A]: true, [KEY_B]: true } });
    v.state(T + 10500, idOf(again[0] as PageMessage), { [KEY_A]: true, [KEY_B]: true }, 9);
    expect(ticksNote(v.session)).toBeNull();
  });
});

describe("a write that is refused", () => {
  test("rate_limited: the same change goes again after a second, then two, then four, then it waits", () => {
    const v = connected(["state", "comments"], {}, 1);
    v.tick(T + 100, KEY_A);
    let now = T + 600;
    let out = v.clock(now)[0] as PageMessage;
    const waits = [1000, 2000, 4000];
    for (const wait of waits) {
      const before = v.count("state-set");
      v.error(now + 10, idOf(out), "rate_limited");
      expect(sessionWake(v.session)).toBe(now + 10 + wait);
      expect(v.clock(now + 10 + wait - 1)).toEqual([]);
      now += 10 + wait;
      const sent = v.clock(now);
      expect(v.count("state-set")).toBe(before + 1);
      expect(sent[0]).toMatchObject({ baseRev: 1, set: { [KEY_A]: true } });
      out = sent[0] as PageMessage;
    }
    v.error(now + 10, idOf(out), "rate_limited");
    expect(v.clock(now + 100000)).toEqual([]);
    expect(ticksNote(v.session)).toBe(TICKS_NOTE);
    expect(isTicked(v.session.state, KEY_A)).toBe(true);
  });

  test("a write that gets through resets the count of refusals", () => {
    const v = connected(["state", "comments"], {}, 1);
    v.tick(T + 100, KEY_A);
    const first = v.clock(T + 600)[0] as PageMessage;
    v.error(T + 610, idOf(first), "rate_limited");
    const second = v.clock(T + 1610)[0] as PageMessage;
    v.state(T + 1700, idOf(second), { [KEY_A]: true }, 2);
    v.tick(T + 2000, KEY_B);
    const third = v.clock(T + 2400)[0] as PageMessage;
    v.error(T + 2410, idOf(third), "rate_limited");
    expect(sessionWake(v.session)).toBe(T + 2410 + 1000);
  });

  test("too_large: the change is held, an error line shows, and later ticks still go", () => {
    const v = connected(["state", "comments"], {}, 1);
    v.tick(T + 100, KEY_A);
    const out = v.clock(T + 600)[0] as PageMessage;
    v.error(T + 650, idOf(out), "too_large");
    expect(v.session.phase).toBe("ready");
    expect(isTicked(v.session.state, KEY_A)).toBe(true);
    expect(ticksNote(v.session)).toBe("Not saved: there is no room left for more ticks.");
    expect(v.clock(T + 20000)).toEqual([]);
    v.tick(T + 21000, KEY_B);
    const next = v.clock(T + 21000 + DEBOUNCE_MS);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ set: { [KEY_B]: true } });
    expect(Object.keys(next[0]?.set as object)).toEqual([KEY_B]);
  });

  test("the line goes when the held tick is taken back", () => {
    const v = connected(["state", "comments"], {}, 1);
    v.tick(T + 100, KEY_A);
    const out = v.clock(T + 600)[0] as PageMessage;
    v.error(T + 650, idOf(out), "too_large");
    v.tick(T + 700, KEY_A, false);
    expect(ticksNote(v.session)).toBeNull();
  });

  test("bad_message: the same, with a line of its own", () => {
    const v = connected(["state", "comments"], {}, 1);
    v.tick(T + 100, KEY_A);
    const out = v.clock(T + 600)[0] as PageMessage;
    v.error(T + 650, idOf(out), "bad_message");
    expect(ticksNote(v.session)).toBe("Not saved: the viewer could not read a tick.");
    expect(v.clock(T + 20000)).toEqual([]);
  });

  test("unavailable: the change goes back to wait, Not saved shows, and the next tick tries again", () => {
    const v = connected(["state", "comments"], {}, 1);
    v.tick(T + 100, KEY_A);
    const out = v.clock(T + 600)[0] as PageMessage;
    v.error(T + 650, idOf(out), "unavailable");
    expect(ticksNote(v.session)).toBe(TICKS_NOTE);
    expect(v.clock(T + 30000)).toEqual([]);
    expect(isTicked(v.session.state, KEY_A)).toBe(true);
    v.tick(T + 31000, KEY_B);
    const again = v.clock(T + 31000 + DEBOUNCE_MS);
    expect(again).toHaveLength(1);
    expect(again[0]).toMatchObject({ baseRev: 1, set: { [KEY_A]: true, [KEY_B]: true } });
    v.state(T + 31500, idOf(again[0] as PageMessage), { [KEY_A]: true, [KEY_B]: true }, 2);
    expect(ticksNote(v.session)).toBeNull();
  });

  test("unsupported: the capability is dropped for the visit, and Not saved stays", () => {
    const v = connected(["state", "comments"], {}, 1);
    v.tick(T + 100, KEY_A);
    const out = v.clock(T + 600)[0] as PageMessage;
    v.error(T + 650, idOf(out), "unsupported");
    expect(v.session.caps).toEqual(["comments"]);
    expect(ticksNote(v.session)).toBe(TICKS_NOTE);
    v.tick(T + 700, KEY_B);
    expect(v.clock(T + 5000)).toEqual([]);
    expect(isTicked(v.session.state, KEY_B)).toBe(true);
  });

  test("no answer in 5 seconds counts as unavailable", () => {
    const v = connected(["state", "comments"], {}, 1);
    v.tick(T + 100, KEY_A);
    const out = v.clock(T + 600)[0] as PageMessage;
    v.clock(T + 600 + REQUEST_WAIT_MS - 1);
    expect(ticksNote(v.session)).toBeNull();
    expect(sessionWake(v.session)).toBe(T + 600 + REQUEST_WAIT_MS);
    v.clock(T + 600 + REQUEST_WAIT_MS);
    expect(ticksNote(v.session)).toBe(TICKS_NOTE);
    expect(isTicked(v.session.state, KEY_A)).toBe(true);
    // an answer that arrives after that is for a request the page has given up on
    expect(v.state(T + 9000, idOf(out), { [KEY_A]: true }, 2)).toEqual([]);
    expect(v.session.state.rev).toBe(1);
  });

  test("an answer with an id the page did not send, or of the wrong kind, changes nothing", () => {
    const v = connected(["state", "comments"], {}, 1);
    const before = v.session;
    v.state(T + 100, "r99", { x: 1 }, 5);
    v.error(T + 110, "r99", "unavailable");
    expect(v.session).toBe(before);
    v.tick(T + 200, KEY_A);
    const out = v.clock(T + 700)[0] as PageMessage;
    v.viewer(T + 710, { type: "comments", id: idOf(out), list: [], truncated: false });
    expect(v.session.state.inFlight).toEqual({ [KEY_A]: { kind: "set", value: true } });
    // the write is still out, waiting for its own answer
    expect(v.session.tracker.outstanding.map((r) => r.id)).toEqual([idOf(out)]);
  });

  test("the state request is asked again with the next tick if it never got an answer", () => {
    const v = visit();
    v.start(T);
    v.ready(T + 10);
    v.clock(T + 10 + REQUEST_WAIT_MS);
    expect(ticksNote(v.session)).toBe(TICKS_NOTE);
    expect(v.session.state.loaded).toBe(false);
    v.tick(T + 6000, KEY_A);
    expect(v.count("state-get")).toBe(2);
    const second = v.last("state-get");
    v.state(T + 6100, idOf(second), {}, 3);
    expect(ticksNote(v.session)).toBeNull();
    const sent = v.clock(T + 6000 + DEBOUNCE_MS);
    expect(sent[0]).toMatchObject({ type: "state-set", baseRev: 3, set: { [KEY_A]: true } });
  });
});

describe("comments", () => {
  test("a comment shows at once and is sent with its place, its words and the lines it is on", () => {
    const v = connected();
    const sent = v.comment(T + 100);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      type: "comment-create",
      body: "Why is this retried?",
      anchor: {
        kind: "line",
        file: "src/retry.ts",
        side: "new",
        from: 18,
        to: 22,
        quote: "retry()",
      },
    });
    expect(isRequestId(sent[0]?.id)).toBe(true);
    const entry = v.session.book.entries[0];
    expect(entry).toMatchObject({ id: "local-1", text: "Why is this retried?", save: "sending" });
    expect(entryNote(v.session, entry as never)).toBe("Saving");
  });

  test("the viewer keeps it and answers with the comment; the page holds that comment in its place", () => {
    const v = connected();
    const out = v.comment(T + 100)[0] as PageMessage;
    v.viewer(T + 150, { type: "comment", id: idOf(out), comment: hostComment(41) });
    expect(v.session.book.entries.map((e) => [e.id, e.save, e.by])).toEqual([
      ["c41", "kept", "reviewer"],
    ]);
    expect(commentsNote(v.session)).toBeNull();
  });

  test("the body is trimmed, and an empty comment is not a comment", () => {
    const v = connected();
    expect(v.comment(T + 100, { text: "   " })).toEqual([]);
    expect(v.session.book.entries).toEqual([]);
    const sent = v.comment(T + 200, { text: "  why?  " });
    expect(sent[0]).toMatchObject({ body: "why?" });
  });

  test("an anchor without a quote is sent without one", () => {
    const v = connected();
    const sent = v.comment(T + 100, { quote: "" });
    expect(sent[0]?.anchor).toEqual({
      kind: "line",
      file: "src/retry.ts",
      side: "new",
      from: 18,
      to: 22,
    });
  });

  test("a comment longer than the viewer allows is kept in view as not saved, and is not sent", () => {
    const v = connected(["state", "comments"], {}, 0, { ...SPEC_LIMITS, bodyChars: 20 });
    const sent = v.comment(T + 100, { text: "x".repeat(21) });
    expect(sent).toEqual([]);
    expect(v.session.book.entries[0]).toMatchObject({ save: "failed" });
    expect(v.session.book.entries[0]?.line).toContain("20 characters");
  });

  test("a comment written while the page waits for the viewer is sent when it is ready", () => {
    const v = visit();
    v.start(T);
    expect(v.comment(T + 50)).toEqual([]);
    expect(entryNote(v.session, v.session.book.entries[0] as never)).toBe("Saving");
    const sent = v.ready(T + 100);
    expect(sent.map((m) => m.type)).toEqual(["state-get", "comments-get", "comment-create"]);
  });

  test("with no viewer a comment stays in view for the visit and says it is not saved", () => {
    const v = visit();
    v.start(T, false);
    expect(v.comment(T + 50)).toEqual([]);
    const entry = v.session.book.entries[0];
    expect(entry).toMatchObject({ id: "local-1", text: "Why is this retried?" });
    expect(entryNote(v.session, entry as never)).toBe(COMMENTS_NOTE);
  });

  test("the list the viewer answers with is painted, and the reader's own comments stay after it", () => {
    const v = visit();
    v.start(T);
    v.ready(T + 10);
    v.comment(T + 20);
    const list = v.viewer(T + 30, {
      type: "comments",
      id: idOf(v.last("comments-get")),
      list: [hostComment(1), hostComment(2, { status: "closed" })],
      truncated: false,
    });
    expect(list).toEqual([]);
    expect(v.session.book.entries.map((e) => e.id)).toEqual(["c1", "c2", "local-1"]);
  });

  test("a list that never comes leaves the comments Not saved, but a comment can still be written", () => {
    const v = visit();
    v.start(T);
    v.ready(T + 10, ["comments"]);
    v.clock(T + 10 + REQUEST_WAIT_MS);
    expect(commentsNote(v.session)).toBe(COMMENTS_NOTE);
    const sent = v.comment(T + 6000);
    expect(sent).toHaveLength(1);
    v.viewer(T + 6100, {
      type: "comment",
      id: idOf(sent[0] as PageMessage),
      comment: hostComment(5),
    });
    expect(commentsNote(v.session)).toBeNull();
  });

  test("rate_limited: the comment is queued again and sent after the wait, up to three times", () => {
    const v = connected();
    let now = T + 100;
    let out = v.comment(now)[0] as PageMessage;
    for (const wait of [1000, 2000, 4000]) {
      v.error(now + 10, idOf(out), "rate_limited");
      expect(v.session.book.entries[0]).toMatchObject({ save: "queued" });
      expect(sessionWake(v.session)).toBe(now + 10 + wait);
      expect(v.clock(now + 10 + wait - 1)).toEqual([]);
      now += 10 + wait;
      const sent = v.clock(now);
      expect(sent).toHaveLength(1);
      out = sent[0] as PageMessage;
    }
    v.error(now + 10, idOf(out), "rate_limited");
    expect(v.session.book.entries[0]).toMatchObject({ save: "failed" });
    expect(v.session.book.entries[0]?.text).toBe("Why is this retried?");
  });

  test("too_large and bad_message: the comment stays in view with a line saying why, and the page goes on", () => {
    const v = connected();
    const one = v.comment(T + 100)[0] as PageMessage;
    v.error(T + 150, idOf(one), "too_large");
    const two = v.comment(T + 200, { text: "second" })[0] as PageMessage;
    v.error(T + 250, idOf(two), "bad_message");
    expect(v.session.book.entries.map((e) => e.save)).toEqual(["failed", "failed"]);
    expect(v.session.book.entries[0]?.line).toBe(
      "Not saved: the viewer would not keep a comment that long.",
    );
    expect(v.session.book.entries[1]?.line).toBe(
      "Not saved: the viewer could not read the comment.",
    );
    expect(commentsNote(v.session)).toBeNull();
  });

  test("unavailable: the comment stays in view as not saved, comments show Not saved, and the next one tries again", () => {
    const v = connected();
    const one = v.comment(T + 100)[0] as PageMessage;
    v.error(T + 150, idOf(one), "unavailable");
    expect(v.session.book.entries[0]).toMatchObject({ save: "failed" });
    expect(commentsNote(v.session)).toBe(COMMENTS_NOTE);
    expect(v.count("comment-create")).toBe(1);
    const two = v.comment(T + 5000, { text: "again" })[0] as PageMessage;
    v.viewer(T + 5100, {
      type: "comment",
      id: idOf(two),
      comment: hostComment(9, { body: "again" }),
    });
    expect(commentsNote(v.session)).toBeNull();
    expect(v.session.book.entries.map((e) => e.save)).toEqual(["failed", "kept"]);
  });

  test("no answer in 5 seconds counts as unavailable for a comment too", () => {
    const v = connected();
    v.comment(T + 100);
    v.clock(T + 100 + REQUEST_WAIT_MS);
    expect(v.session.book.entries[0]).toMatchObject({ save: "failed" });
    expect(commentsNote(v.session)).toBe(COMMENTS_NOTE);
  });

  test("writes of both kinds share the pace the viewer allows", () => {
    const v = connected(["state", "comments"], {}, 1, { ...SPEC_LIMITS, writesPerSecond: 1 });
    v.tick(T + 100, KEY_A);
    expect(v.clock(T + 500)).toHaveLength(1);
    expect(v.comment(T + 600)).toEqual([]);
    expect(sessionWake(v.session)).toBe(T + 500 + 1000);
    expect(v.clock(T + 1500)).toHaveLength(1);
    expect(v.count("comment-create")).toBe(1);
  });
});

describe("the viewer asks to show lines", () => {
  test("comment-focus becomes a request to the page to show those lines", () => {
    const v = connected();
    const anchor: LineAnchor = {
      kind: "line",
      file: "src/retry.ts",
      side: "new",
      from: 18,
      to: 22,
    };
    expect(v.viewer(T + 100, { type: "focus", anchor })).toEqual([]);
    expect(v.focused).toEqual([anchor]);
  });

  test("it is shown even before the viewer has said ready, since the viewer decides when to ask", () => {
    const v = visit();
    v.start(T);
    const anchor: LineAnchor = { kind: "line", file: "a.ts", side: "old", from: 1, to: 1 };
    v.viewer(T + 5, { type: "focus", anchor });
    expect(v.focused).toEqual([anchor]);
  });
});

describe("what the page asks for the clock", () => {
  test("it wants nothing when it has nothing to wait for", () => {
    const v = connected();
    expect(sessionWake(v.session)).toBeNull();
  });

  test("it wants the earliest of the things it waits for", () => {
    const v = connected(["state", "comments"], {}, 1);
    v.tick(T + 100, KEY_A);
    const out = v.clock(T + 600)[0] as PageMessage;
    v.comment(T + 700, { text: "hi" });
    expect(sessionWake(v.session)).toBe(
      Math.min(T + 600 + REQUEST_WAIT_MS, T + 700 + REQUEST_WAIT_MS),
    );
    v.state(T + 800, idOf(out), { [KEY_A]: true }, 2);
    expect(sessionWake(v.session)).toBe(T + 700 + REQUEST_WAIT_MS);
  });

  test("every request in a visit has an id of its own", () => {
    const v = connected();
    for (let i = 0; i < 6; i++) {
      v.tick(T + 1000 * i, `tick:f${i}:${HASH}`);
      const out = v.clock(T + 1000 * i + 500).find((m) => m.type === "state-set");
      if (out !== undefined) v.state(T + 1000 * i + 600, idOf(out), {}, i + 2);
      v.comment(T + 1000 * i + 700, { text: `c${i}` });
    }
    const ids = v.sent.flatMap((m) => (m.id === undefined ? [] : [String(m.id)]));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(10);
  });
});
