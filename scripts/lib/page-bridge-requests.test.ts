// Tests beside scripts/lib/page-bridge-requests.ts: the requests a page has out to the viewer, the
// 1.5 second wait for bridge-ready, the 5 second wait for an answer, the pace of writes and the
// backoff. Pure: the clock is a number handed in.
import { describe, expect, test } from "bun:test";
import { isRequestId, READY_WAIT_MS, REQUEST_WAIT_MS } from "./page-bridge.ts";
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
  type Tracker,
  writeSlot,
} from "./page-bridge-requests.ts";

const open = (t: Tracker, kind: Parameters<typeof openRequest>[1], now: number, tag?: string) =>
  openRequest(t, kind, now, tag);

describe("requests out to the viewer", () => {
  test("each gets an id the viewer accepts, never used twice in a visit", () => {
    let t: Tracker = EMPTY_TRACKER;
    const ids: string[] = [];
    for (let i = 0; i < 200; i++) {
      const opened = open(t, "state-get", i);
      t = opened.tracker;
      ids.push(opened.id);
    }
    expect(new Set(ids).size).toBe(200);
    expect(ids.every(isRequestId)).toBe(true);
    expect(ids[0]).toBe("r1");
  });

  test("a request is due 5 seconds after it was sent", () => {
    const { tracker } = open(EMPTY_TRACKER, "state-set", 1000);
    expect(tracker.outstanding).toEqual([
      { id: "r1", kind: "state-set", sentAt: 1000, dueAt: 1000 + REQUEST_WAIT_MS, tag: "" },
    ]);
    expect(REQUEST_WAIT_MS).toBe(5000);
  });

  test("an answer settles its request by id and hands back what was asked", () => {
    const one = open(EMPTY_TRACKER, "comment-create", 10, "local-1");
    const two = open(one.tracker, "state-get", 20);
    const settled = settleRequest(two.tracker, one.id);
    expect(settled.request).toMatchObject({ id: one.id, kind: "comment-create", tag: "local-1" });
    expect(settled.tracker.outstanding.map((r) => r.id)).toEqual([two.id]);
  });

  test("an answer with an id nobody asked about, or asked about before, settles nothing", () => {
    const one = open(EMPTY_TRACKER, "state-get", 10);
    expect(settleRequest(one.tracker, "r99")).toEqual({ tracker: one.tracker, request: null });
    const settled = settleRequest(one.tracker, one.id);
    expect(settleRequest(settled.tracker, one.id).request).toBeNull();
  });

  test("a request unanswered for 5 seconds expires and is no longer out", () => {
    const one = open(EMPTY_TRACKER, "state-get", 0);
    const two = open(one.tracker, "comments-get", 3000);
    expect(expireRequests(two.tracker, 4999).expired).toEqual([]);
    const at = expireRequests(two.tracker, 5000);
    expect(at.expired.map((r) => r.id)).toEqual([one.id]);
    expect(at.tracker.outstanding.map((r) => r.id)).toEqual([two.id]);
    const later = expireRequests(at.tracker, 8000);
    expect(later.expired.map((r) => r.id)).toEqual([two.id]);
    expect(later.tracker.outstanding).toEqual([]);
  });

  test("an answer that comes after expiry settles nothing", () => {
    const one = open(EMPTY_TRACKER, "state-set", 0);
    const gone = expireRequests(one.tracker, 6000).tracker;
    expect(settleRequest(gone, one.id).request).toBeNull();
  });

  test("the next time to look is the earliest due, or none", () => {
    expect(nextDue(EMPTY_TRACKER)).toBeNull();
    const one = open(EMPTY_TRACKER, "state-get", 100);
    const two = open(one.tracker, "state-set", 50);
    expect(nextDue(two.tracker)).toBe(50 + REQUEST_WAIT_MS);
  });

  test("a kind that is out is found by its kind", () => {
    const one = open(EMPTY_TRACKER, "state-set", 0);
    expect(hasOutstanding(one.tracker, "state-set")).toBe(true);
    expect(hasOutstanding(one.tracker, "state-get")).toBe(false);
  });
});

describe("the wait for bridge-ready", () => {
  test("the deadline is 1.5 seconds after the hello", () => {
    expect(READY_WAIT_MS).toBe(1500);
    expect(readyDeadline(2000)).toBe(3500);
  });

  test("it has run out at the deadline and not a moment before", () => {
    expect(readyExpired(2000, 3499)).toBe(false);
    expect(readyExpired(2000, 3500)).toBe(true);
    expect(readyExpired(2000, 90000)).toBe(true);
  });
});

describe("the pace of writes", () => {
  test("up to the limit in a second go at once", () => {
    let sent: readonly number[] = [];
    for (let i = 0; i < 3; i++) {
      const slot = writeSlot(sent, 1000 + i, 3);
      expect(slot.ok).toBe(true);
      if (slot.ok) sent = slot.sent;
    }
    expect(sent).toEqual([1000, 1001, 1002]);
  });

  test("one more waits until the oldest of the last second has left it", () => {
    const slot = writeSlot([1000, 1001, 1002], 1500, 3);
    expect(slot).toEqual({ ok: false, waitMs: 500 });
    expect(writeSlot([1000, 1001, 1002], 2000, 3)).toEqual({ ok: true, sent: [1001, 1002, 2000] });
  });

  test("with a limit of one, a write every second", () => {
    expect(writeSlot([5000], 5400, 1)).toEqual({ ok: false, waitMs: 600 });
    expect(writeSlot([5000], 6000, 1)).toEqual({ ok: true, sent: [6000] });
  });

  test("a wait is at least a millisecond, and old sends are forgotten", () => {
    const slot = writeSlot([0, 1, 2], 999, 3);
    expect(slot.ok === false && slot.waitMs >= 1).toBe(true);
    const fresh = writeSlot([0, 1, 2], 5000, 3);
    expect(fresh).toEqual({ ok: true, sent: [5000] });
  });

  test("a hundred writes spread by the pace never put more than the limit in any second", () => {
    let sent: readonly number[] = [];
    let now = 0;
    const all: number[] = [];
    for (let i = 0; i < 100; i++) {
      for (;;) {
        const slot = writeSlot(sent, now, 4);
        if (slot.ok) {
          sent = slot.sent;
          all.push(now);
          break;
        }
        now += slot.waitMs;
      }
    }
    for (const t of all) {
      expect(all.filter((u) => u >= t && u < t + 1000).length).toBeLessThanOrEqual(4);
    }
  });
});

describe("waiting before a write and after a refusal", () => {
  test("a tick is written 0.4 seconds after the last change", () => {
    expect(DEBOUNCE_MS).toBe(400);
  });

  test("the backoff doubles from a second to eight, and stops after three", () => {
    expect([0, 1, 2, 3, 4, 9].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 8000, 8000]);
    expect(MAX_BACKOFFS).toBe(3);
    expect(backoffMs(-1)).toBe(1000);
  });
});
