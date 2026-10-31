// A page's whole visit through the page bridge as one reducer: it says hello, waits 1.5 seconds for
// bridge-ready, loads the saved document and the comments, writes the reader's ticks (debounced, at
// the pace the viewer allows) and sends the reader's line comments, and it answers every error
// code the viewer may send. An event goes in (the page starts, the viewer answers, the reader
// ticks or comments, the clock moves) and a new session comes out with the messages to send and
// the lines to show; the page's shell only carries those out and keeps one timer for `sessionWake`.
//
// What the reader is told is derived from the session: `ticksNote`, `commentsNote` and `entryNote`
// give the line to show, or null where nothing is wrong. Pure: no clock, no window, nothing kept
// between calls. The review page inlines this file with its exports stripped.
import type {
  BridgeCap,
  BridgeErrorCode,
  BridgeLimits,
  JsonObject,
  LineAnchor,
  PageMessage,
  ViewerMessage,
} from "./page-bridge.ts";
import {
  checkBody,
  commentCreateMessage,
  commentsGetMessage,
  helloMessage,
  lineAnchorOf,
  SPEC_LIMITS,
  stateGetMessage,
  stateSetMessage,
} from "./page-bridge.ts";
import type { CommentBook, CommentDraft, ReviewComment } from "./page-bridge-comments.ts";
import {
  bookFailed,
  bookKept,
  bookLoaded,
  bookQueued,
  bookRequeued,
  bookSending,
  draftComment,
  dueComments,
  EMPTY_BOOK,
  nextCommentWake,
} from "./page-bridge-comments.ts";
import type { Outstanding, RequestKind, Tracker } from "./page-bridge-requests.ts";
import {
  backoffMs,
  DEBOUNCE_MS,
  EMPTY_TRACKER,
  expireRequests,
  hasOutstanding,
  MAX_BACKOFFS,
  nextDue,
  openRequest,
  readyDeadline,
  readyExpired,
  settleRequest,
  writeSlot,
} from "./page-bridge-requests.ts";
import type { StateModel } from "./page-bridge-state.ts";
import {
  EMPTY_STATE,
  editTick,
  nextWrite,
  stateApplied,
  stateConflicted,
  stateLoaded,
  stateRefused,
  stateReturned,
} from "./page-bridge-state.ts";

/**
 * Where the visit stands. off: the page is not in a frame, so there is no viewer. waiting: hello is
 * sent and the 1.5 seconds have not run out. ready: the viewer answered and granted something.
 * unsaved: it did not answer in time, or granted nothing; a bridge-ready that comes later is still taken.
 */
export type Phase = "off" | "waiting" | "ready" | "unsaved";

export interface Session {
  readonly phase: Phase;
  /** The capabilities the viewer granted. */
  readonly caps: readonly BridgeCap[];
  /** Granted capabilities that are failing now (an unavailable answer or no answer); a later success clears them. */
  readonly down: readonly BridgeCap[];
  readonly limits: BridgeLimits;
  readonly helloAt: number | null;
  readonly tracker: Tracker;
  /** When the writes of the last second went. */
  readonly writes: readonly number[];
  readonly state: StateModel;
  readonly book: CommentBook;
  /** The tick write is due at this time. */
  readonly flushAt: number | null;
  /** Conflicts and rate_limited answers in a row on the tick write now going. */
  readonly conflicts: number;
  readonly limited: number;
  /** The line to show while the viewer holds back ticks it refused. */
  readonly refusal: string | null;
}

export const NEW_SESSION: Session = {
  phase: "off",
  caps: [],
  down: [],
  limits: SPEC_LIMITS,
  helloAt: null,
  tracker: EMPTY_TRACKER,
  writes: [],
  state: EMPTY_STATE,
  book: EMPTY_BOOK,
  flushAt: null,
  conflicts: 0,
  limited: 0,
  refusal: null,
};

export type SessionEvent =
  | { readonly type: "start"; readonly now: number; readonly framed: boolean }
  | { readonly type: "viewer"; readonly now: number; readonly message: ViewerMessage }
  | { readonly type: "tick"; readonly now: number; readonly key: string; readonly on: boolean }
  | { readonly type: "comment"; readonly now: number; readonly draft: CommentDraft }
  /** The page is being left: what waits is written without the wait. */
  | { readonly type: "hide"; readonly now: number }
  | { readonly type: "clock"; readonly now: number };

export type Effect =
  | { readonly type: "send"; readonly message: PageMessage }
  | { readonly type: "focus"; readonly anchor: LineAnchor };

export interface SessionStep {
  readonly session: Session;
  readonly effects: readonly Effect[];
}

const NOTE_TICKS = "Not saved. Ticks last until you close this page.";
const NOTE_COMMENTS = "Not saved. Comments last until you close this page.";

/** The line shown when the viewer refuses a tick or a comment for a reason the reader can act on. */
function refusalLine(code: "too_large" | "bad_message", scope: "ticks" | "comments"): string {
  if (scope === "ticks") {
    return code === "too_large"
      ? "Not saved: there is no room left for more ticks."
      : "Not saved: the viewer could not read a tick.";
  }
  return code === "too_large"
    ? "Not saved: the viewer would not keep a comment that long."
    : "Not saved: the viewer could not read the comment.";
}

// ---------- what the reader is told ----------

const hasHeld = (s: Session): boolean => Object.keys(s.state.held).length > 0;
const hasPending = (s: Session): boolean => Object.keys(s.state.pending).length > 0;
const hasInFlight = (s: Session): boolean => Object.keys(s.state.inFlight).length > 0;
const keeps = (s: Session, cap: BridgeCap): boolean =>
  s.phase === "ready" && s.caps.includes(cap) && !s.down.includes(cap);

/** The line to show where ticks appear, or null where they are kept (or the viewer has not yet answered). */
export function ticksNote(s: Session): string | null {
  if (s.phase === "waiting") return null;
  if (s.refusal !== null && hasHeld(s)) return s.refusal;
  return keeps(s, "state") ? null : NOTE_TICKS;
}

/** The line to show where comments are written, or null where they are kept. */
export function commentsNote(s: Session): string | null {
  if (s.phase === "waiting") return null;
  return keeps(s, "comments") ? null : NOTE_COMMENTS;
}

/** What to say beside one comment: nothing when kept, "Saving" while it is on its way, else why not. */
export function entryNote(s: Session, e: ReviewComment): string | null {
  if (e.save === "kept") return null;
  if (e.save === "failed") return e.line ?? NOTE_COMMENTS;
  return commentsNote(s) === null ? "Saving" : NOTE_COMMENTS;
}

/** The time the page wants its clock event, or null when it waits for nothing. */
export function sessionWake(s: Session): number | null {
  const times: number[] = [];
  if (s.phase === "waiting" && s.helloAt !== null) times.push(readyDeadline(s.helloAt));
  const due = nextDue(s.tracker);
  if (due !== null) times.push(due);
  const writable = s.phase === "ready" && s.caps.includes("state") && s.state.loaded;
  if (writable && !hasInFlight(s) && s.flushAt !== null) times.push(s.flushAt);
  if (s.phase === "ready" && s.caps.includes("comments")) {
    const queued = nextCommentWake(s.book);
    if (queued !== null) times.push(queued);
  }
  return times.length === 0 ? null : Math.min(...times);
}

// ---------- the reducer ----------

const send = (message: PageMessage): Effect => ({ type: "send", message });
const stay = (session: Session): SessionStep => ({ session, effects: [] });
const withCap = (list: readonly BridgeCap[], cap: BridgeCap): readonly BridgeCap[] =>
  list.includes(cap) ? list : [...list, cap];
const withoutCap = (list: readonly BridgeCap[], cap: BridgeCap): readonly BridgeCap[] =>
  list.filter((c) => c !== cap);

function ask(
  s: Session,
  kind: RequestKind,
  now: number,
  tag: string,
  build: (id: string) => PageMessage,
): { readonly session: Session; readonly message: PageMessage } {
  const opened = openRequest(s.tracker, kind, now, tag);
  return { session: { ...s, tracker: opened.tracker }, message: build(opened.id) };
}

export function reduceSession(s: Session, e: SessionEvent): SessionStep {
  switch (e.type) {
    case "start":
      return pump(start(s, e.now, e.framed), e.now);
    case "viewer":
      return pump(heard(s, e.now, e.message), e.now);
    case "tick":
      return pump(
        stay({
          ...s,
          state: editTick(s.state, e.key, e.on),
          flushAt: e.now + DEBOUNCE_MS,
          conflicts: 0,
          limited: 0,
        }),
        e.now,
      );
    case "comment":
      return pump(written(s, e.now, e.draft), e.now);
    case "hide":
      return pump(
        stay(
          hasPending(s)
            ? { ...s, flushAt: s.flushAt === null ? e.now : Math.min(s.flushAt, e.now) }
            : s,
        ),
        e.now,
      );
    case "clock":
      return pump(clocked(s, e.now), e.now);
  }
}

function start(s: Session, now: number, framed: boolean): SessionStep {
  if (!framed) return stay({ ...s, phase: "off" });
  return { session: { ...s, phase: "waiting", helloAt: now }, effects: [send(helloMessage())] };
}

/** Time has passed: the wait for bridge-ready may be over, and requests unanswered for 5 seconds count as unavailable. */
function clocked(s: Session, now: number): SessionStep {
  const timedOut = s.phase === "waiting" && s.helloAt !== null && readyExpired(s.helloAt, now);
  const expired = expireRequests(s.tracker, now);
  let step: SessionStep = stay({
    ...s,
    phase: timedOut ? "unsaved" : s.phase,
    tracker: expired.tracker,
  });
  for (const request of expired.expired) {
    const next = failed(step.session, request, "unavailable", now);
    step = { session: next.session, effects: [...step.effects, ...next.effects] };
  }
  return step;
}

function heard(s: Session, now: number, m: ViewerMessage): SessionStep {
  switch (m.type) {
    case "ready":
      return ready(s, now, m);
    case "focus":
      return { session: s, effects: [{ type: "focus", anchor: m.anchor }] };
    case "error":
      if (m.id === null) return stay(s.phase === "waiting" ? { ...s, phase: "unsaved" } : s);
      return answered(s, m.id, null, (x, request) => failed(x, request, m.code, now, m.doc, m.rev));
    case "state":
      return answered(s, m.id, ["state-get", "state-set"], (x, request) =>
        request.kind === "state-get"
          ? stay({
              ...x,
              state: stateLoaded(x.state, m.doc, m.rev),
              down: withoutCap(x.down, "state"),
              flushAt: hasPending(x) ? (x.flushAt ?? now) : null,
            })
          : stay(applied(x, m.doc, m.rev, now)),
      );
    case "comments":
      return answered(s, m.id, ["comments-get"], (x) =>
        stay({ ...x, book: bookLoaded(x.book, m.list), down: withoutCap(x.down, "comments") }),
      );
    case "comment":
      return answered(s, m.id, ["comment-create"], (x, request) =>
        stay({
          ...x,
          book: bookKept(x.book, request.tag, m.comment),
          down: withoutCap(x.down, "comments"),
        }),
      );
  }
}

/** Settle the request an answer is for and let `handle` use it; an answer for nothing asked, or of the wrong kind, changes nothing. */
function answered(
  s: Session,
  id: string,
  kinds: readonly RequestKind[] | null,
  handle: (s: Session, request: Outstanding) => SessionStep,
): SessionStep {
  const request = s.tracker.outstanding.find((r) => r.id === id);
  if (request === undefined || (kinds !== null && !kinds.includes(request.kind))) return stay(s);
  const settled = settleRequest(s.tracker, id);
  return handle({ ...s, tracker: settled.tracker }, request);
}

function ready(s: Session, now: number, m: Extract<ViewerMessage, { type: "ready" }>): SessionStep {
  if (s.phase === "ready" || s.phase === "off") return stay(s);
  if (m.caps.length === 0) return stay({ ...s, phase: "unsaved" });
  let session: Session = { ...s, phase: "ready", caps: m.caps, down: [], limits: m.limits };
  const effects: Effect[] = [];
  if (m.caps.includes("state")) {
    const a = ask(session, "state-get", now, "", stateGetMessage);
    session = a.session;
    effects.push(send(a.message));
  }
  if (m.caps.includes("comments")) {
    const a = ask(session, "comments-get", now, "", commentsGetMessage);
    session = a.session;
    effects.push(send(a.message));
  }
  return { session, effects };
}

/** The viewer applied our write and answered with its document. */
function applied(s: Session, doc: JsonObject, rev: number, now: number): Session {
  const state = stateApplied(s.state, doc, rev);
  const waiting = Object.keys(state.pending).length > 0;
  return {
    ...s,
    state,
    down: withoutCap(s.down, "state"),
    conflicts: 0,
    limited: 0,
    flushAt: waiting ? (s.flushAt ?? now) : null,
  };
}

/** A request failed, by an error from the viewer or by running out of time (unavailable). */
function failed(
  s: Session,
  request: Outstanding,
  code: BridgeErrorCode,
  now: number,
  doc?: JsonObject,
  rev?: number,
): SessionStep {
  switch (request.kind) {
    case "state-get":
      return stay(giveUp(s, "state", code));
    case "comments-get":
      return stay(giveUp(s, "comments", code));
    case "state-set":
      return stay(stateWriteFailed(s, code, now, doc, rev));
    case "comment-create":
      return stay(commentFailed(s, request.tag, code, now));
  }
}

/** Unsupported takes a capability away for the visit; anything else only marks it as failing. */
function giveUp(s: Session, cap: BridgeCap, code: BridgeErrorCode): Session {
  return code === "unsupported"
    ? { ...s, caps: withoutCap(s.caps, cap) }
    : { ...s, down: withCap(s.down, cap) };
}

function stateWriteFailed(
  s: Session,
  code: BridgeErrorCode,
  now: number,
  doc: JsonObject | undefined,
  rev: number | undefined,
): Session {
  switch (code) {
    case "conflict": {
      if (doc === undefined || rev === undefined) {
        return stateWriteFailed(s, "unavailable", now, undefined, undefined);
      }
      const state = stateConflicted(s.state, doc, rev);
      // Reapply the change to the document it returned and write again, once; a second conflict in
      // a row means another reader is racing on the same key, so the change waits for the next tick.
      return s.conflicts < 1
        ? { ...s, state, conflicts: s.conflicts + 1, flushAt: now }
        : {
            ...s,
            state,
            conflicts: s.conflicts + 1,
            flushAt: null,
            down: withCap(s.down, "state"),
          };
    }
    case "rate_limited": {
      const state = stateReturned(s.state);
      return s.limited < MAX_BACKOFFS
        ? { ...s, state, limited: s.limited + 1, flushAt: now + backoffMs(s.limited) }
        : { ...s, state, limited: s.limited + 1, flushAt: null, down: withCap(s.down, "state") };
    }
    case "too_large":
    case "bad_message":
      return {
        ...s,
        state: stateRefused(s.state),
        refusal: refusalLine(code, "ticks"),
        flushAt: hasPending(s) ? now : null,
      };
    case "unsupported":
      return {
        ...s,
        state: stateReturned(s.state),
        caps: withoutCap(s.caps, "state"),
        flushAt: null,
      };
    case "unavailable":
      return {
        ...s,
        state: stateReturned(s.state),
        down: withCap(s.down, "state"),
        flushAt: null,
      };
  }
}

function commentFailed(s: Session, id: string, code: BridgeErrorCode, now: number): Session {
  const entry = s.book.entries.find((e) => e.id === id);
  if (entry === undefined) return s;
  switch (code) {
    case "rate_limited":
      return entry.tries < MAX_BACKOFFS
        ? { ...s, book: bookRequeued(s.book, id, now + backoffMs(entry.tries), entry.tries + 1) }
        : { ...s, book: bookFailed(s.book, id, NOTE_COMMENTS) };
    case "too_large":
    case "bad_message":
      return { ...s, book: bookFailed(s.book, id, refusalLine(code, "comments")) };
    case "unsupported":
      return {
        ...s,
        caps: withoutCap(s.caps, "comments"),
        book: bookFailed(s.book, id, NOTE_COMMENTS),
      };
    default:
      return {
        ...s,
        down: withCap(s.down, "comments"),
        book: bookFailed(s.book, id, NOTE_COMMENTS),
      };
  }
}

/** The reader saved a comment: it goes into the book at once; `pump` sends it when it can. */
function written(s: Session, now: number, draft: CommentDraft): SessionStep {
  const body = checkBody(draft.text, s.limits);
  if (!body.ok && body.reason === "empty") return stay(s);
  const anchor = lineAnchorOf(draft.path, draft.side, draft.from, draft.to, draft.quote);
  const failure = !body.ok
    ? `Not saved: the comment is longer than ${s.limits.bodyChars} characters.`
    : anchor === null
      ? "Not saved: that place cannot be named to the viewer."
      : null;
  const text = body.ok ? body.body : draft.text.trim();
  return stay({ ...s, book: draftComment(s.book, { ...draft, text }, now, failure).book });
}

/** Send whatever is due: the document again if ticks wait on it, the tick write, and the queued comments. */
function pump(step: SessionStep, now: number): SessionStep {
  let s = step.session;
  const effects: Effect[] = [...step.effects];
  const ready = s.phase === "ready";
  if (
    ready &&
    s.caps.includes("state") &&
    !s.state.loaded &&
    hasPending(s) &&
    !hasOutstanding(s.tracker, "state-get")
  ) {
    const a = ask(s, "state-get", now, "", stateGetMessage);
    s = a.session;
    effects.push(send(a.message));
  }
  if (
    ready &&
    s.caps.includes("state") &&
    s.state.loaded &&
    s.flushAt !== null &&
    s.flushAt <= now &&
    !hasInFlight(s)
  ) {
    const slot = writeSlot(s.writes, now, s.limits.writesPerSecond);
    if (!slot.ok) {
      s = { ...s, flushAt: now + slot.waitMs };
    } else {
      const next = nextWrite(s.state, s.limits);
      if (next.kind === "none") {
        s = { ...s, state: next.model, flushAt: null };
      } else if (next.kind === "refused") {
        s = { ...s, state: next.model, refusal: refusalLine("too_large", "ticks"), flushAt: null };
      } else {
        const { baseRev, set, del } = next.write;
        const a = ask(s, "state-set", now, "", (id) => stateSetMessage(id, baseRev, set, del));
        s = { ...a.session, state: next.model, writes: slot.sent, flushAt: null };
        effects.push(send(a.message));
      }
    }
  }
  if (ready && s.caps.includes("comments")) {
    for (const entry of dueComments(s.book, now)) {
      const slot = writeSlot(s.writes, now, s.limits.writesPerSecond);
      if (!slot.ok) {
        s = { ...s, book: bookQueued(s.book, entry.id, now + slot.waitMs) };
        break;
      }
      const anchor = lineAnchorOf(entry.path, entry.side, entry.from, entry.to, entry.quote);
      if (anchor === null) {
        s = { ...s, book: bookFailed(s.book, entry.id, NOTE_COMMENTS) };
        continue;
      }
      const a = ask(s, "comment-create", now, entry.id, (id) =>
        commentCreateMessage(id, entry.text, anchor),
      );
      s = { ...a.session, writes: slot.sent, book: bookSending(a.session.book, entry.id) };
      effects.push(send(a.message));
    }
  }
  return s === step.session && effects.length === step.effects.length
    ? step
    : { session: s, effects };
}
