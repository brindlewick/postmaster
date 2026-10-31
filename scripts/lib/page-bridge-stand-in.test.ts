// Tests beside scripts/lib/page-bridge-stand-in.ts: a stand-in for the viewer that the render gate
// puts around the review page. It answers the way the page bridge says a viewer must, and can be
// told to delay, drop, conflict or rate-limit, so the gate can see what the page does. These tests
// hold the stand-in to the spec first, since a gate is only as good as the viewer it plays.
import { describe, expect, test } from "bun:test";
import {
  createStandIn,
  EMPTY_STAND_IN,
  focusMessage,
  type StandInOptions,
  type StandInState,
  standInAnswer,
  standInConfigured,
  standInPage,
  VIEWER_SCRIPT,
} from "./page-bridge-stand-in.ts";

const env = { bridge: "page-bridge", v: 1 } as const;
const hello = { ...env, type: "bridge-hello", versions: [1], want: ["state", "comments"] };
const anchor = { kind: "line", file: "src/retry.ts", side: "new", from: 18, to: 22 } as const;

/** Play messages in order against one stand-in; the clock starts at 1000 ms and moves 1 ms a message. */
function play(initial: StandInState = EMPTY_STAND_IN) {
  let state = initial;
  let now = 1000;
  const send = (data: unknown, at = now++) => {
    const answer = standInAnswer(state, data, at);
    state = answer.state;
    return answer;
  };
  return {
    get state() {
      return state;
    },
    send,
    reply: (data: unknown, at?: number) => send(data, at).reply,
    hello: () => send(hello).reply,
    at: (t: number) => {
      now = t;
    },
  };
}

const tweak = (patch: Partial<StandInOptions>) => standInConfigured(EMPTY_STAND_IN, patch);

describe("the handshake", () => {
  test("a hello is answered with the version, the capabilities asked for and granted, and the limits", () => {
    expect(play().hello()).toEqual({
      ...env,
      type: "bridge-ready",
      version: 1,
      caps: ["state", "comments"],
      limits: { messageBytes: 65536, stateBytes: 262144, bodyChars: 4000, writesPerSecond: 10 },
    });
  });

  test("only the capabilities asked for are granted, and only those the stand-in offers", () => {
    const some = play(tweak({ grant: ["state"] }));
    expect(some.hello()).toMatchObject({ caps: ["state"] });
    const asked = play();
    expect(asked.reply({ ...hello, want: ["comments"] })).toMatchObject({ caps: ["comments"] });
  });

  test("smaller limits can be announced", () => {
    const limits = { messageBytes: 4096, stateBytes: 1024, bodyChars: 100, writesPerSecond: 2 };
    expect(play(tweak({ limits })).hello()).toMatchObject({ limits });
  });

  test("no shared version is unsupported", () => {
    expect(play().reply({ ...hello, versions: [2, 3] })).toMatchObject({
      type: "bridge-error",
      code: "unsupported",
    });
  });

  test("a hello with fields of the wrong kind is bad_message", () => {
    for (const bad of [
      { ...hello, versions: "1" },
      { ...hello, versions: [] },
      { ...hello, versions: [1.5] },
      { ...hello, want: [3] },
      { ...hello, want: "state" },
    ]) {
      expect([bad, play().reply(bad)]).toMatchObject([
        bad,
        { type: "bridge-error", code: "bad_message" },
      ]);
    }
  });

  test("a request before a hello is dropped without an answer", () => {
    const p = play();
    expect(p.reply({ ...env, type: "state-get", id: "r1" })).toBeNull();
    expect(p.reply({ ...env, type: "comments-get", id: "r2" })).toBeNull();
  });

  test("anything that is not a bridge message gets no answer", () => {
    const p = play();
    p.hello();
    for (const data of [
      null,
      "x",
      3,
      [],
      {},
      { bridge: "other", v: 1, type: "state-get", id: "r1" },
    ]) {
      expect([data, p.reply(data)]).toEqual([data, null]);
    }
  });
});

describe("the checks on a request", () => {
  const ready = () => {
    const p = play();
    p.hello();
    return p;
  };

  test("a request needs an id of 1 to 64 safe characters", () => {
    const p = ready();
    for (const id of [undefined, "", "a b", "x".repeat(65), 7]) {
      expect([id, p.reply({ ...env, type: "state-get", id })]).toMatchObject([
        id,
        { type: "bridge-error", code: "bad_message" },
      ]);
    }
  });

  test("an unknown type and a wrong version are bad_message, with the id when there is one", () => {
    const p = ready();
    expect(p.reply({ ...env, type: "teapot", id: "r1" })).toMatchObject({
      code: "bad_message",
      id: "r1",
    });
    expect(p.reply({ ...env, v: 2, type: "state-get", id: "r2" })).toMatchObject({
      code: "bad_message",
      id: "r2",
    });
  });

  test("a message over the size limit is too_large", () => {
    const p = play(tweak({ limits: { ...EMPTY_STAND_IN.options.limits, messageBytes: 300 } }));
    p.hello();
    const big = { ...env, type: "comment-create", id: "r1", body: "x".repeat(400), anchor };
    expect(p.reply(big)).toMatchObject({ code: "too_large", id: "r1" });
  });

  test("a capability that was not granted is unsupported", () => {
    const p = play(tweak({ grant: ["state"] }));
    p.hello();
    expect(p.reply({ ...env, type: "comments-get", id: "r1" })).toMatchObject({
      code: "unsupported",
      id: "r1",
    });
    expect(p.reply({ ...env, type: "state-get", id: "r2" })).toMatchObject({ type: "state" });
  });

  test("writes are held to the limit a second, and the rest are rate_limited", () => {
    const p = play(tweak({ limits: { ...EMPTY_STAND_IN.options.limits, writesPerSecond: 2 } }));
    p.hello();
    const write = (n: number, at: number) =>
      p.reply(
        { ...env, type: "state-set", id: `r${n}`, baseRev: 0, set: { [`k${n}`]: true }, del: [] },
        at,
      );
    expect(write(1, 2000)).toMatchObject({ type: "state" });
    expect(write(2, 2100)).toMatchObject({ type: "state" });
    expect(write(3, 2200)).toMatchObject({ code: "rate_limited", id: "r3" });
    expect(write(4, 3100)).toMatchObject({ type: "state" });
  });
});

describe("state", () => {
  const set = (
    id: string,
    baseRev: number,
    setKeys: Record<string, unknown>,
    del: string[] = [],
  ) => ({
    ...env,
    type: "state-set",
    id,
    baseRev,
    set: setKeys,
    del,
  });
  const ready = () => {
    const p = play();
    p.hello();
    return p;
  };

  test("a page with no state has revision 0 and an empty document", () => {
    expect(ready().reply({ ...env, type: "state-get", id: "r1" })).toEqual({
      ...env,
      type: "state",
      id: "r1",
      doc: {},
      rev: 0,
    });
  });

  test("a write applies at once, the revision rises by one, and the answer is the document", () => {
    const p = ready();
    expect(p.reply(set("r1", 0, { "tick:a:1": true }))).toMatchObject({
      type: "state",
      id: "r1",
      doc: { "tick:a:1": true },
      rev: 1,
    });
    expect(p.reply(set("r2", 1, { "tick:b:2": true }, ["tick:a:1"]))).toMatchObject({
      doc: { "tick:b:2": true },
      rev: 2,
    });
  });

  test("a write that names no key answers the document and does not raise the revision", () => {
    const p = ready();
    p.reply(set("r1", 0, { k: 1 }));
    expect(p.reply(set("r2", 1, {}))).toMatchObject({ type: "state", doc: { k: 1 }, rev: 1 });
  });

  test("two readers writing different keys never collide, even from the same base", () => {
    const p = ready();
    p.reply(set("r1", 0, { "tick:a:1": true }));
    expect(p.reply(set("r2", 0, { "tick:b:2": true }))).toMatchObject({
      type: "state",
      doc: { "tick:a:1": true, "tick:b:2": true },
      rev: 2,
    });
  });

  test("a key changed after the base revision is a conflict, with the current document and revision", () => {
    const p = ready();
    p.reply(set("r1", 0, { "tick:a:1": true }));
    expect(p.reply(set("r2", 0, { "tick:a:1": false }))).toEqual({
      ...env,
      type: "bridge-error",
      id: "r2",
      code: "conflict",
      message: "a key in this write changed after baseRev",
      doc: { "tick:a:1": true },
      rev: 1,
    });
    expect(p.reply(set("r3", 1, { "tick:a:1": false }))).toMatchObject({ type: "state", rev: 2 });
  });

  test("a deleted key counts as changed for the conflict rule, and a base above the revision conflicts", () => {
    const p = ready();
    p.reply(set("r1", 0, { k: 1 }));
    p.reply(set("r2", 1, {}, ["k"]));
    expect(p.reply(set("r3", 1, { k: 2 }))).toMatchObject({ code: "conflict" });
    expect(p.reply(set("r4", 99, { z: 1 }))).toMatchObject({ code: "conflict" });
  });

  test("a write that would pass the size limit is too_large", () => {
    const p = play(tweak({ limits: { ...EMPTY_STAND_IN.options.limits, stateBytes: 40 } }));
    p.hello();
    expect(p.reply(set("r1", 0, { k: "x".repeat(50) }))).toMatchObject({ code: "too_large" });
    expect(p.reply(set("r2", 0, { k: 1 }))).toMatchObject({ type: "state" });
  });

  test("each field is checked", () => {
    const p = ready();
    const bad: unknown[] = [
      { ...set("r1", -1, {}) },
      { ...set("r1", 1.5, {}) },
      { ...set("r1", 0, {}), set: [] },
      { ...set("r1", 0, {}), del: "k" },
      { ...set("r1", 0, {}), del: undefined },
      { ...set("r1", 0, {}), set: undefined },
      set("r1", 0, { "": true }),
      set("r1", 0, { ["k".repeat(257)]: true }),
      set("r1", 0, {}, [""]),
      set("r1", 0, { k: 1 }, ["k"]),
      set("r1", 0, {}, ["k", "k"]),
    ];
    for (const message of bad) {
      expect([message, p.reply(message)]).toMatchObject([
        message,
        { code: "bad_message", id: "r1" },
      ]);
    }
  });

  test("a key of 256 characters is allowed", () => {
    expect(ready().reply(set("r1", 0, { ["k".repeat(256)]: true }))).toMatchObject({
      type: "state",
    });
  });
});

describe("comments", () => {
  const create = (id: string, body: unknown, over: Record<string, unknown> = {}) => ({
    ...env,
    type: "comment-create",
    id,
    body,
    anchor: { ...anchor, quote: "retry()" },
    ...over,
  });
  const ready = () => {
    const p = play();
    p.hello();
    return p;
  };

  test("a comment is kept with its anchor and answered in the contract's shape", () => {
    const p = ready();
    expect(p.reply(create("r1", "Why is this retried?"), 5000)).toEqual({
      ...env,
      type: "comment",
      id: "r1",
      comment: {
        id: 1,
        status: "open",
        author: "reader",
        body: "Why is this retried?",
        createdAt: new Date(5000).toISOString(),
        version: 1,
        anchor: { ...anchor, quote: "retry()" },
      },
    });
  });

  test("the list holds every comment with a line anchor, in the order they were made", () => {
    const p = ready();
    p.reply(create("r1", "one"));
    p.reply(create("r2", "two"));
    const list = p.reply({ ...env, type: "comments-get", id: "r3" }) as {
      list: { id: number; body: string }[];
    };
    expect(list).toMatchObject({ type: "comments", id: "r3" });
    expect(list.list.map((c) => [c.id, c.body])).toEqual([
      [1, "one"],
      [2, "two"],
    ]);
  });

  test("comments belong to the stand-in, not to the visit: a later hello sees them", () => {
    const p = ready();
    p.reply(create("r1", "kept"));
    p.hello();
    const list = p.reply({ ...env, type: "comments-get", id: "r9" }) as { list: unknown[] };
    expect(list.list).toHaveLength(1);
  });

  test("the version shown is stamped on a new comment", () => {
    const p = ready();
    const bumped = standInConfigured(p.state, {}, 3);
    const q = play(bumped);
    q.hello();
    expect(q.reply(create("r1", "on v3"))).toMatchObject({ comment: { version: 3 } });
  });

  test("the body is plain text of 1 to the limit characters, once trimmed", () => {
    const p = ready();
    for (const body of ["", "   ", 5, null, "x".repeat(4001)]) {
      expect([body, p.reply(create("r1", body))]).toMatchObject([body, { code: "bad_message" }]);
    }
    expect(p.reply(create("r2", "  hi  "))).toMatchObject({ comment: { body: "hi" } });
    expect(p.reply(create("r3", "x".repeat(4000)))).toMatchObject({ type: "comment" });
  });

  test("the anchor must be a line anchor", () => {
    const p = ready();
    const bad: unknown[] = [
      undefined,
      { ...anchor, kind: "text" },
      { ...anchor, file: "" },
      { ...anchor, file: "x".repeat(1025) },
      { ...anchor, side: "left" },
      { ...anchor, from: 0 },
      { ...anchor, from: 9, to: 3 },
      { ...anchor, quote: "q".repeat(2001) },
    ];
    for (const a of bad) {
      expect([a, p.reply(create("r1", "ok", { anchor: a }))]).toMatchObject([
        a,
        { code: "bad_message" },
      ]);
    }
  });
});

describe("faults the gate can ask for", () => {
  const stateSet = (id: string, baseRev: number, key: string) => ({
    ...env,
    type: "state-set",
    id,
    baseRev,
    set: { [key]: true },
    del: [],
  });

  test("a delay is handed back with every answer", () => {
    const p = play(tweak({ delayMs: 800 }));
    expect(p.send(hello).delayMs).toBe(800);
    expect(play().send(hello).delayMs).toBe(0);
  });

  test("a type that is dropped gets no answer, and a hello can be dropped too", () => {
    const p = play(tweak({ drop: ["state-set"] }));
    p.hello();
    expect(p.reply(stateSet("r1", 0, "k"))).toBeNull();
    expect(p.reply({ ...env, type: "state-get", id: "r2" })).toMatchObject({ type: "state" });
    expect(play(tweak({ drop: ["bridge-hello"] })).hello()).toBeNull();
  });

  test("a dropped write is not applied", () => {
    const p = play(tweak({ drop: ["state-set"] }));
    p.hello();
    p.reply(stateSet("r1", 0, "k"));
    expect(p.state.rev).toBe(0);
  });

  test("a type can be answered with a fixed error", () => {
    const p = play(tweak({ fail: { "state-set": "unavailable", "comment-create": "too_large" } }));
    p.hello();
    expect(p.reply(stateSet("r1", 0, "k"))).toMatchObject({ code: "unavailable", id: "r1" });
    expect(p.reply({ ...env, type: "comment-create", id: "r2", body: "x", anchor })).toMatchObject({
      code: "too_large",
    });
    expect(p.state.rev).toBe(0);
  });

  test("the next writes can be rate limited, and then they are not", () => {
    const p = play(tweak({ rateLimited: 2 }));
    p.hello();
    expect(p.reply(stateSet("r1", 0, "a"))).toMatchObject({ code: "rate_limited" });
    expect(p.reply({ ...env, type: "comment-create", id: "r2", body: "x", anchor })).toMatchObject({
      code: "rate_limited",
    });
    expect(p.reply(stateSet("r3", 0, "a"))).toMatchObject({ type: "state", rev: 1 });
    expect(p.state.options.rateLimited).toBe(0);
  });

  test("a conflict is made real: a rival's write to the same key lands first, with a mark of its own", () => {
    const p = play(tweak({ conflicts: 1 }));
    p.hello();
    const answer = p.reply(stateSet("r1", 0, "tick:a:1")) as {
      code: string;
      doc: Record<string, unknown>;
      rev: number;
    };
    expect(answer).toMatchObject({ type: "bridge-error", code: "conflict", id: "r1" });
    expect(answer.doc["tick:a:1"]).toBe("rival");
    expect(Object.keys(answer.doc).some((k) => k.startsWith("rival:"))).toBe(true);
    expect(answer.rev).toBe(1);
    // asked again against the new revision, the write goes through and the rival's mark stays
    const again = p.reply(stateSet("r2", answer.rev, "tick:a:1")) as {
      doc: Record<string, unknown>;
      rev: number;
    };
    expect(again.doc["tick:a:1"]).toBe(true);
    expect(Object.keys(again.doc).some((k) => k.startsWith("rival:"))).toBe(true);
    expect(again.rev).toBe(2);
    expect(p.state.options.conflicts).toBe(0);
  });

  test("a stand-in with no comment capability can still be asked for state", () => {
    const p = play(tweak({ grant: ["state"] }));
    p.hello();
    expect(p.reply(stateSet("r1", 0, "k"))).toMatchObject({ type: "state" });
  });
});

describe("what the gate reads back", () => {
  test("the log names each message, its id and what became of it", () => {
    const p = play(tweak({ drop: ["comments-get"] }));
    p.hello();
    p.reply({ ...env, type: "state-get", id: "r1" });
    p.reply({ ...env, type: "comments-get", id: "r2" });
    p.reply({ ...env, type: "teapot", id: "r3" });
    expect(p.state.log.map((l) => [l.type, l.id, l.outcome])).toEqual([
      ["bridge-hello", null, "bridge-ready"],
      ["state-get", "r1", "state"],
      ["comments-get", "r2", "dropped"],
      ["teapot", "r3", "error:bad_message"],
    ]);
  });

  test("a conflict is logged as such", () => {
    const p = play(tweak({ conflicts: 1 }));
    p.hello();
    p.reply({ ...env, type: "state-set", id: "r1", baseRev: 0, set: { k: 1 }, del: [] });
    expect(p.state.log.at(-1)).toMatchObject({ type: "state-set", outcome: "error:conflict" });
  });

  test("the focus message the viewer sends carries the anchor", () => {
    expect(focusMessage(anchor)).toEqual({ ...env, type: "comment-focus", anchor });
  });
});

describe("the stand-in as an object", () => {
  test("it keeps the state between messages and can be reset to a fresh page", () => {
    const stand = createStandIn(() => 5000);
    expect(stand.receive(hello).reply).toMatchObject({ type: "bridge-ready" });
    stand.receive({
      ...env,
      type: "state-set",
      id: "r1",
      baseRev: 0,
      set: { "tick:a.ts:1": true, other: 2 },
      del: [],
    });
    stand.receive({ ...env, type: "comment-create", id: "r2", body: "hi", anchor });
    expect(stand.tickKeys()).toEqual(["tick:a.ts:1"]);
    expect(stand.rev()).toBe(1);
    expect(stand.doc()).toEqual({ "tick:a.ts:1": true, other: 2 });
    expect(stand.comments()).toHaveLength(1);
    expect(stand.log().length).toBe(3);
    stand.configure({ delayMs: 10 });
    stand.reset();
    expect(stand.tickKeys()).toEqual([]);
    expect(stand.comments()).toEqual([]);
    expect(stand.log()).toEqual([]);
    expect(stand.rev()).toBe(0);
    expect(stand.receive(hello).delayMs).toBe(0);
  });

  test("it can be configured and told which version of the page is shown", () => {
    const stand = createStandIn(() => 5000);
    stand.configure({ drop: ["bridge-hello"] });
    expect(stand.receive(hello)).toEqual({ reply: null, delayMs: 0 });
    stand.configure({ drop: [] });
    stand.receive(hello);
    stand.setVersion(4);
    const made = stand.receive({ ...env, type: "comment-create", id: "r1", body: "x", anchor });
    expect(made.reply).toMatchObject({ comment: { version: 4 } });
  });

  test("only ticks that hold true count as ticks", () => {
    const stand = createStandIn(() => 1);
    stand.receive(hello);
    stand.receive({
      ...env,
      type: "state-set",
      id: "r1",
      baseRev: 0,
      set: { "tick:a:1": true, "tick:b:2": "rival", "tick:c:3": false },
      del: [],
    });
    expect(stand.tickKeys()).toEqual(["tick:a:1"]);
  });
});

describe("the viewer page", () => {
  test("it frames the page without letting it share the viewer's origin", () => {
    const html = standInPage("/index.html");
    expect(html).toContain('<iframe id="doc" sandbox="allow-scripts" src="/index.html"');
    expect(html).not.toContain("allow-same-origin");
    expect(html).toContain('name="viewport"');
  });

  test("its script is valid JavaScript", () => {
    expect(() => new Function(VIEWER_SCRIPT)).not.toThrow();
  });

  test("its script accepts a message only from the frame's own window and the opaque origin", () => {
    expect(VIEWER_SCRIPT).toContain("event.source !== frame.contentWindow");
    expect(VIEWER_SCRIPT).toContain('event.origin !== "null"');
  });

  test("its script answers through the stand-in and can ask the page to show lines", () => {
    expect(VIEWER_SCRIPT).toContain("/__stand-in/message");
    expect(VIEWER_SCRIPT).toContain("window.__viewer");
    expect(VIEWER_SCRIPT).toContain("comment-focus");
  });

  test("the page and its script hold no em or en dash", () => {
    expect(`${standInPage("/index.html")}${VIEWER_SCRIPT}`).not.toMatch(/[–—]/u);
  });
});
