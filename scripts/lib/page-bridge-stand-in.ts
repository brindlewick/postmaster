// A stand-in for the viewer around a page, for the render gate (scripts/review-page-gate.ts). It
// answers the way the page bridge says a viewer must: a hello with the version, the capabilities
// and the limits; the saved state of the page, merged by key under the base revision rule; the
// page's line comments. And it can be told to misbehave, so the gate can see what the page does:
// delay its answers, drop a kind of message, answer a kind with a fixed error, rate-limit the
// next writes, or make the next writes meet a rival's write to the same keys first (a real conflict).
//
// The stand-in checks messages on its own and shares nothing with the page's builders, so a page
// that sends something the contract forbids is caught here. The core is pure, `standInAnswer`
// taking a state and a message and returning the new state and the answer; `createStandIn` is the
// small mutable object the gate's server holds, and `standInPage` the viewer page that frames the
// page under test and carries its messages to the server.
import type { BridgeErrorCode, BridgeLimits } from "./page-bridge.ts";
import { messageBytes, SPEC_LIMITS } from "./page-bridge.ts";

export type StandInCap = "state" | "comments";

export interface StandInOptions {
  /** Every answer waits this many milliseconds. */
  readonly delayMs: number;
  /** Message types that get no answer, and are not acted on: "bridge-hello", "state-get", and so on. */
  readonly drop: readonly string[];
  /** The next this many state writes meet a rival's write to the same keys first, so they conflict. */
  readonly conflicts: number;
  /** The next this many writes (state or comment) are answered rate_limited. */
  readonly rateLimited: number;
  /** A message type answered with this error, whatever it says. */
  readonly fail: Readonly<Record<string, BridgeErrorCode>>;
  /** The capabilities the stand-in offers. */
  readonly grant: readonly StandInCap[];
  readonly limits: BridgeLimits;
}

export const DEFAULT_OPTIONS: StandInOptions = {
  delayMs: 0,
  drop: [],
  conflicts: 0,
  rateLimited: 0,
  fail: {},
  grant: ["state", "comments"],
  limits: SPEC_LIMITS,
};

export interface StoredAnchor {
  readonly kind: "line";
  readonly file: string;
  readonly side: "old" | "new";
  readonly from: number;
  readonly to: number;
  readonly quote?: string;
}

export interface StoredComment {
  readonly id: number;
  readonly status: "open" | "closed";
  readonly author: string;
  readonly body: string;
  readonly createdAt: string;
  readonly anchor: StoredAnchor;
  readonly version: number;
}

/** One message the stand-in saw: when, its type, its id, and what became of it. */
export interface Logged {
  /** The time it was seen, in milliseconds. */
  readonly at: number;
  readonly type: string;
  readonly id: string | null;
  /** "dropped", "ignored", the type of the answer ("state", "comment", ...), or "error:<code>". */
  readonly outcome: string;
}

export interface StandInState {
  readonly options: StandInOptions;
  readonly doc: Readonly<Record<string, unknown>>;
  readonly rev: number;
  /** The revision at which each key was last set or deleted. */
  readonly keyRevs: Readonly<Record<string, number>>;
  readonly comments: readonly StoredComment[];
  /** The version of the page shown, stamped on a new comment. */
  readonly version: number;
  /** A page that has said hello: what it was granted and when its writes and messages went. */
  readonly visit: {
    readonly caps: readonly StandInCap[];
    readonly writes: readonly number[];
    readonly messages: readonly number[];
  } | null;
  /** How many rival writes have landed, to give each its own mark. */
  readonly rivals: number;
  /** The time of the message being answered, for the log. */
  readonly now: number;
  readonly log: readonly Logged[];
}

export const EMPTY_STAND_IN: StandInState = {
  options: DEFAULT_OPTIONS,
  doc: {},
  rev: 0,
  keyRevs: {},
  comments: [],
  version: 1,
  visit: null,
  rivals: 0,
  now: 0,
  log: [],
};

export interface Answer {
  readonly state: StandInState;
  /** The message to send the page, or null for none. */
  readonly reply: Readonly<Record<string, unknown>> | null;
  readonly delayMs: number;
}

const ENVELOPE = { bridge: "page-bridge", v: 1 } as const;
const LOG_LIMIT = 500;
const REQUESTS = ["state-get", "state-set", "comments-get", "comment-create"];
const WRITES = ["state-set", "comment-create"];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const validId = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/u.test(v);

const validKey = (k: unknown): k is string =>
  typeof k === "string" && k.length >= 1 && k.length <= 256;

const isJson = (v: unknown, depth = 0): boolean => {
  if (depth > 64) return false;
  if (v === null || typeof v === "boolean" || typeof v === "string") return true;
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.every((x) => isJson(x, depth + 1));
  return isObject(v) && Object.values(v).every((x) => isJson(x, depth + 1));
};

const isLine = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 2 ** 31 - 1;

function lineAnchor(raw: unknown): StoredAnchor | null {
  if (!isObject(raw) || raw.kind !== "line") return null;
  const { file, side, from, to, quote } = raw;
  if (typeof file !== "string" || file.length < 1 || file.length > 1024) return null;
  if (side !== "old" && side !== "new") return null;
  if (!isLine(from) || !isLine(to) || from > to) return null;
  if (quote !== undefined && (typeof quote !== "string" || quote.length > 2000)) return null;
  return quote === undefined
    ? { kind: "line", file, side, from, to }
    : { kind: "line", file, side, from, to, quote };
}

const reply = (type: string, fields: Readonly<Record<string, unknown>>) => ({
  ...ENVELOPE,
  type,
  ...fields,
});

const errorReply = (
  id: string | null,
  code: BridgeErrorCode,
  message: string,
  extra: Readonly<Record<string, unknown>> = {},
) => reply("bridge-error", { ...(id === null ? {} : { id }), code, message, ...extra });

/** The times within the last second, and whether one more at `now` keeps to `perSecond`. */
function within(times: readonly number[], now: number, perSecond: number) {
  const recent = times.filter((t) => now - t < 1000);
  return recent.length < perSecond
    ? { ok: true, times: [...recent, now] }
    : { ok: false, times: recent };
}

function logged(s: StandInState, type: string, id: string | null, outcome: string): StandInState {
  return { ...s, log: [...s.log, { at: s.now, type, id, outcome }].slice(-LOG_LIMIT) };
}

function finish(
  s: StandInState,
  type: string,
  id: string | null,
  message: Readonly<Record<string, unknown>> | null,
): Answer {
  const outcome =
    message === null
      ? "dropped"
      : message.type === "bridge-error"
        ? `error:${String(message.code)}`
        : String(message.type);
  return {
    state: logged(s, type, id, outcome),
    reply: message,
    delayMs: message === null ? 0 : s.options.delayMs,
  };
}

/** The stand-in with some options changed, and, when given, a new version of the page shown. */
export function standInConfigured(
  s: StandInState,
  patch: Partial<StandInOptions>,
  version?: number,
): StandInState {
  return { ...s, options: { ...s.options, ...patch }, version: version ?? s.version };
}

/** The message a viewer sends when the reader taps a line comment in its list. */
export function focusMessage(anchor: StoredAnchor): Readonly<Record<string, unknown>> {
  return reply("comment-focus", { anchor });
}

function applyWrite(
  s: StandInState,
  baseRev: number,
  set: Readonly<Record<string, unknown>>,
  del: readonly string[],
): { readonly state: StandInState } | { readonly conflict: true } | { readonly tooLarge: true } {
  const named = [...Object.keys(set), ...del];
  if (baseRev > s.rev || named.some((k) => (s.keyRevs[k] ?? 0) > baseRev))
    return { conflict: true };
  if (named.length === 0) return { state: s };
  const doc: Record<string, unknown> = { ...s.doc };
  for (const k of del) delete doc[k];
  Object.assign(doc, set);
  if (messageBytes(doc) > s.options.limits.stateBytes) return { tooLarge: true };
  const rev = s.rev + 1;
  const keyRevs = { ...s.keyRevs, ...Object.fromEntries(named.map((k) => [k, rev])) };
  return { state: { ...s, doc, rev, keyRevs } };
}

/** Another reader's write to the same keys, landing first: each named key takes the value "rival". */
function rivalWrite(s: StandInState, named: readonly string[]): StandInState {
  const rivals = s.rivals + 1;
  const set = { ...Object.fromEntries(named.map((k) => [k, "rival"])), [`rival:${rivals}`]: true };
  const applied = applyWrite(s, s.rev, set, []);
  return "state" in applied ? { ...applied.state, rivals } : s;
}

/** A request whose fields have been checked. */
type Checked =
  | { readonly ok: false; readonly why: string }
  | { readonly ok: true; readonly request: Parsed };

type Parsed =
  | { readonly type: "state-get" | "comments-get" }
  | {
      readonly type: "state-set";
      readonly baseRev: number;
      readonly set: Readonly<Record<string, unknown>>;
      readonly del: readonly string[];
    }
  | { readonly type: "comment-create"; readonly body: string; readonly anchor: StoredAnchor };

/** The fields of a request, checked the way the page bridge says before anything is done with them. */
function check(type: string, data: Record<string, unknown>, limits: BridgeLimits): Checked {
  const no = (why: string): Checked => ({ ok: false, why });
  switch (type) {
    case "state-get":
    case "comments-get":
      return { ok: true, request: { type } };
    case "state-set": {
      const { baseRev, set, del } = data;
      if (typeof baseRev !== "number" || !Number.isSafeInteger(baseRev) || baseRev < 0) {
        return no("baseRev must be a whole number, 0 or more");
      }
      if (!isObject(set) || !Array.isArray(del))
        return no("state-set takes set (an object) and del (keys)");
      const setKeys = Object.keys(set);
      if (!setKeys.every(validKey) || !del.every(validKey))
        return no("a key must be 1 to 256 characters");
      if (new Set(del).size !== del.length || del.some((k) => setKeys.includes(k as string))) {
        return no("a key may be named once only");
      }
      if (!Object.values(set).every((v) => isJson(v))) return no("a value must be JSON");
      return { ok: true, request: { type, baseRev, set, del: del as string[] } };
    }
    default: {
      const body = typeof data.body === "string" ? data.body.trim() : "";
      if (body === "" || body.length > limits.bodyChars) {
        return no(`body must be plain text of 1 to ${limits.bodyChars} characters`);
      }
      const anchor = lineAnchor(data.anchor);
      return anchor === null
        ? no("the anchor must be a line anchor")
        : { ok: true, request: { type: "comment-create", body, anchor } };
    }
  }
}

/** Answer one message from the page, as a viewer that keeps to the page bridge. */
export function standInAnswer(before: StandInState, data: unknown, now: number): Answer {
  const s: StandInState = { ...before, now };
  if (!isObject(data) || data.bridge !== "page-bridge") {
    return { state: before, reply: null, delayMs: 0 };
  }
  const type = typeof data.type === "string" ? data.type : "";
  const id = validId(data.id) ? data.id : null;
  const limits = s.options.limits;
  if (s.options.drop.includes(type)) return finish(s, type, id, null);
  const size = messageBytes(data);
  if (size > limits.messageBytes) {
    return finish(s, type, id, errorReply(id, "too_large", `the message is ${size} bytes`));
  }
  if (data.v !== 1 || type === "") {
    return finish(
      s,
      type,
      id,
      errorReply(id, "bad_message", "v must be 1 and the message needs a type"),
    );
  }
  if (type === "bridge-hello") return hello(s, data);
  if (s.visit === null) return { state: logged(s, type, id, "ignored"), reply: null, delayMs: 0 };
  if (!REQUESTS.includes(type)) {
    return finish(s, type, id, errorReply(id, "bad_message", `unknown type ${type.slice(0, 40)}`));
  }
  if (id === null) {
    return finish(
      s,
      type,
      id,
      errorReply(null, "bad_message", "a request needs an id of 1 to 64 safe characters"),
    );
  }
  const checked = check(type, data, limits);
  if (!checked.ok) return finish(s, type, id, errorReply(id, "bad_message", checked.why));
  const visit = s.visit;
  const messages = within(visit.messages, now, limits.writesPerSecond * 5);
  const counted = { ...visit, messages: messages.times };
  const seen: StandInState = { ...s, visit: counted };
  if (!messages.ok)
    return finish(seen, type, id, errorReply(id, "rate_limited", "too many messages"));
  const fixed = s.options.fail[type];
  if (fixed !== undefined)
    return finish(seen, type, id, errorReply(id, fixed, "an error asked for"));
  let current = seen;
  if (WRITES.includes(type)) {
    if (s.options.rateLimited > 0) {
      const limited = standInConfigured(seen, { rateLimited: s.options.rateLimited - 1 });
      return finish(limited, type, id, errorReply(id, "rate_limited", "a rate limit asked for"));
    }
    const writes = within(visit.writes, now, limits.writesPerSecond);
    if (!writes.ok) {
      return finish(
        seen,
        type,
        id,
        errorReply(id, "rate_limited", `at most ${limits.writesPerSecond} writes a second`),
      );
    }
    current = { ...seen, visit: { ...counted, writes: writes.times } };
  }
  const cap: StandInCap = type.startsWith("state") ? "state" : "comments";
  if (!visit.caps.includes(cap)) {
    return finish(
      current,
      type,
      id,
      errorReply(id, "unsupported", `the ${cap} capability was not granted`),
    );
  }
  return perform(current, id, checked.request, now);
}

function hello(s: StandInState, data: Record<string, unknown>): Answer {
  const { versions, want } = data;
  const goodVersions =
    Array.isArray(versions) && versions.length >= 1 && versions.every((v) => Number.isInteger(v));
  const goodWant = Array.isArray(want) && want.every((w) => typeof w === "string");
  if (!goodVersions || !goodWant) {
    return finish(
      s,
      "bridge-hello",
      null,
      errorReply(null, "bad_message", "bridge-hello takes versions and want"),
    );
  }
  if (!versions.includes(1)) {
    return finish(
      s,
      "bridge-hello",
      null,
      errorReply(null, "unsupported", "this viewer speaks page-bridge v1"),
    );
  }
  const caps = s.options.grant.filter((c) => want.includes(c));
  const visit = { caps, writes: [], messages: [] };
  return finish(
    { ...s, visit },
    "bridge-hello",
    null,
    reply("bridge-ready", { version: 1, caps, limits: s.options.limits }),
  );
}

/** Do what a checked request asks and answer it. */
function perform(s: StandInState, id: string, r: Parsed, now: number): Answer {
  switch (r.type) {
    case "state-get":
      return finish(s, r.type, id, reply("state", { id, doc: s.doc, rev: s.rev }));
    case "comments-get":
      return finish(s, r.type, id, reply("comments", { id, list: s.comments }));
    case "state-set": {
      const named = [...Object.keys(r.set), ...r.del];
      const ready =
        s.options.conflicts > 0
          ? rivalWrite(standInConfigured(s, { conflicts: s.options.conflicts - 1 }), named)
          : s;
      const applied = applyWrite(ready, r.baseRev, r.set, r.del);
      if ("conflict" in applied) {
        const doc = ready.doc;
        const conflict = errorReply(id, "conflict", "a key in this write changed after baseRev", {
          doc,
          rev: ready.rev,
        });
        return finish(ready, r.type, id, conflict);
      }
      if ("tooLarge" in applied) {
        return finish(
          ready,
          r.type,
          id,
          errorReply(id, "too_large", "the document would be too large"),
        );
      }
      const { doc, rev } = applied.state;
      return finish(applied.state, r.type, id, reply("state", { id, doc, rev }));
    }
    case "comment-create": {
      const comment: StoredComment = {
        id: s.comments.length + 1,
        status: "open",
        author: "reader",
        body: r.body,
        createdAt: new Date(now).toISOString(),
        anchor: r.anchor,
        version: s.version,
      };
      return finish(
        { ...s, comments: [...s.comments, comment] },
        r.type,
        id,
        reply("comment", { id, comment }),
      );
    }
  }
}

// ---------- the object the gate holds ----------

export interface StandIn {
  /** Answer a message from the page; the viewer page waits `delayMs` before it hands `reply` to the page. */
  receive(data: unknown): { reply: Readonly<Record<string, unknown>> | null; delayMs: number };
  configure(patch: Partial<StandInOptions>): void;
  /** A fresh page: no state, no comments, the default options, an empty log. */
  reset(): void;
  setVersion(version: number): void;
  doc(): Readonly<Record<string, unknown>>;
  rev(): number;
  /** The keys of ticks held: `tick:` keys whose value is true. */
  tickKeys(): string[];
  comments(): readonly StoredComment[];
  log(): readonly Logged[];
}

export function createStandIn(clock: () => number = Date.now): StandIn {
  let state = EMPTY_STAND_IN;
  return {
    receive(data) {
      const answer = standInAnswer(state, data, clock());
      state = answer.state;
      return { reply: answer.reply, delayMs: answer.delayMs };
    },
    configure(patch) {
      state = standInConfigured(state, patch);
    },
    reset() {
      state = EMPTY_STAND_IN;
    },
    setVersion(version) {
      state = { ...state, version };
    },
    doc: () => state.doc,
    rev: () => state.rev,
    tickKeys: () =>
      Object.keys(state.doc).filter((k) => k.startsWith("tick:") && state.doc[k] === true),
    comments: () => state.comments,
    log: () => state.log,
  };
}

// ---------- the viewer page ----------

/**
 * The script of the viewer page. It takes a message only from the frame's own window with the opaque
 * origin of a sandboxed page, asks the server's stand-in what to answer, and posts the answer to the
 * frame after the delay, unless a new hello has begun a new visit meanwhile. `window.__viewer.focus`
 * is what the gate calls to make the viewer ask the page to show lines. No backtick and no dollar
 * brace here: the text sits in a template literal.
 */
export const VIEWER_SCRIPT = String.raw`
(function () {
  "use strict";
  var frame = document.getElementById("doc");
  var visit = 0;
  function post(message) {
    if (frame.contentWindow) frame.contentWindow.postMessage(message, "*");
  }
  window.__viewer = {
    seen: [],
    focus: function (anchor) {
      post({ bridge: "page-bridge", v: 1, type: "comment-focus", anchor: anchor });
    },
  };
  window.addEventListener("message", function (event) {
    if (event.source !== frame.contentWindow) return;
    if (event.origin !== "null") return;
    var data = event.data;
    if (!data || typeof data !== "object" || data.bridge !== "page-bridge") return;
    if (data.type === "bridge-hello") visit += 1;
    var mine = visit;
    window.__viewer.seen.push(data);
    fetch("/__stand-in/message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    })
      .then(function (res) { return res.json(); })
      .then(function (answer) {
        if (!answer || !answer.reply) return;
        setTimeout(function () {
          if (mine === visit) post(answer.reply);
        }, answer.delayMs || 0);
      })
      .catch(function () {});
  });
})();
`;

const escapeAttribute = (text: string): string =>
  text
    .replace(/&/gu, "&amp;")
    .replace(/"/gu, "&quot;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;");

/** A viewer page that frames `frameSrc` with no access to the viewer's origin, and fills the window with it. */
export function standInPage(frameSrc: string): string {
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    "<title>Viewer</title>",
    "<style>html,body{margin:0;height:100%;background:#fff}iframe{display:block;border:0;width:100%;height:100vh;height:100dvh}</style>",
    "</head><body>",
    `<iframe id="doc" sandbox="allow-scripts" src="${escapeAttribute(frameSrc)}" title="page"></iframe>`,
    `<script>${VIEWER_SCRIPT}</script>`,
    "</body></html>",
  ].join("");
}
