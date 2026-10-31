// The requests a page has out to the viewer through the page bridge, and the clocks around them: the
// 1.5 second wait for bridge-ready, the 5 second wait for an answer, the pace of writes the viewer
// allows and the backoff after a refusal. Pure: the time is a number handed in, nothing is kept
// between calls. The review page inlines this file with its exports stripped.
import { READY_WAIT_MS, REQUEST_WAIT_MS } from "./page-bridge.ts";

export type RequestKind = "state-get" | "state-set" | "comments-get" | "comment-create";

/** A request sent and not yet answered. */
export interface Outstanding {
  readonly id: string;
  readonly kind: RequestKind;
  readonly sentAt: number;
  /** After this time with no answer the request counts as unavailable. */
  readonly dueAt: number;
  /** What the caller asked it for: the local id of a comment being created, else empty. */
  readonly tag: string;
}

export interface Tracker {
  /** The number in the next request's id. */
  readonly next: number;
  readonly outstanding: readonly Outstanding[];
}

export const EMPTY_TRACKER: Tracker = { next: 1, outstanding: [] };

/** Record a request as sent at `now`; its id is unique for the visit and valid for the viewer. */
export function openRequest(
  tracker: Tracker,
  kind: RequestKind,
  now: number,
  tag = "",
): { readonly tracker: Tracker; readonly id: string } {
  const id = `r${tracker.next}`;
  const entry: Outstanding = { id, kind, sentAt: now, dueAt: now + REQUEST_WAIT_MS, tag };
  return {
    tracker: { next: tracker.next + 1, outstanding: [...tracker.outstanding, entry] },
    id,
  };
}

/** An answer arrived: the request it answers, and the tracker without it. An unknown id settles nothing. */
export function settleRequest(
  tracker: Tracker,
  id: string,
): { readonly tracker: Tracker; readonly request: Outstanding | null } {
  const request = tracker.outstanding.find((r) => r.id === id) ?? null;
  if (request === null) return { tracker, request: null };
  return {
    tracker: { ...tracker, outstanding: tracker.outstanding.filter((r) => r.id !== id) },
    request,
  };
}

/** The requests unanswered for 5 seconds by `now`, which count as unavailable, and the tracker without them. */
export function expireRequests(
  tracker: Tracker,
  now: number,
): { readonly tracker: Tracker; readonly expired: readonly Outstanding[] } {
  const expired = tracker.outstanding.filter((r) => r.dueAt <= now);
  if (expired.length === 0) return { tracker, expired };
  return {
    tracker: { ...tracker, outstanding: tracker.outstanding.filter((r) => r.dueAt > now) },
    expired,
  };
}

/** The earliest time an outstanding request runs out, or null when none is out. */
export function nextDue(tracker: Tracker): number | null {
  return tracker.outstanding.reduce<number | null>(
    (soonest, r) => (soonest === null || r.dueAt < soonest ? r.dueAt : soonest),
    null,
  );
}

export function hasOutstanding(tracker: Tracker, kind: RequestKind): boolean {
  return tracker.outstanding.some((r) => r.kind === kind);
}

/** The time the wait for bridge-ready ends, counted from the hello. */
export function readyDeadline(helloAt: number): number {
  return helloAt + READY_WAIT_MS;
}

export function readyExpired(helloAt: number, now: number): boolean {
  return now >= readyDeadline(helloAt);
}

/** A tick is written this long after the last change, so a run of taps goes out as one write. */
export const DEBOUNCE_MS = 400;

/**
 * Whether a write (a state write or a new comment) may go at `now` under the viewer's limit of
 * `perSecond` writes in any second. If it may, the times of the writes still inside the second,
 * with this one; if not, how long to wait.
 */
export function writeSlot(
  sent: readonly number[],
  now: number,
  perSecond: number,
):
  | { readonly ok: true; readonly sent: readonly number[] }
  | { readonly ok: false; readonly waitMs: number } {
  const recent = sent.filter((t) => now - t < 1000);
  if (recent.length < perSecond) return { ok: true, sent: [...recent, now] };
  const leaves = (recent[recent.length - perSecond] ?? now) + 1000;
  return { ok: false, waitMs: Math.max(1, leaves - now) };
}

/** After a rate_limited answer a write is tried again this many times, each after a longer wait. */
export const MAX_BACKOFFS = 3;

/** The wait before try number `attempt` (0 for the first): a second, doubling to eight. */
export function backoffMs(attempt: number): number {
  return Math.min(8000, 1000 * 2 ** Math.max(0, attempt));
}
