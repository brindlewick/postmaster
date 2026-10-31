// Tests beside scripts/lib/page-bridge-state.ts: the saved document as a page keeps it, the changes
// the reader makes to it, and the writes that carry those changes to the viewer. Pure: every case
// is a model in and a model out, and a small stand-in for the viewer's merge closes the loop.
import { describe, expect, test } from "bun:test";
import { type BridgeLimits, messageBytes, SPEC_LIMITS, stateSetMessage } from "./page-bridge.ts";
import {
  delKey,
  docBytes,
  EMPTY_STATE,
  editTick,
  fileTickKey,
  hasChanges,
  isTicked,
  nextWrite,
  setKey,
  type StateModel,
  stateApplied,
  stateConflicted,
  stateLoaded,
  stateRefused,
  stateReturned,
  stateView,
  type Write,
} from "./page-bridge-state.ts";

const HASH = "0123456789abcdef".repeat(4);
const loaded = (doc: Record<string, unknown> = {}, rev = 0): StateModel =>
  stateLoaded(EMPTY_STATE, doc, rev);
const written = (m: StateModel, limits: BridgeLimits = SPEC_LIMITS): Write => {
  const next = nextWrite(m, limits);
  if (next.kind !== "write") throw new Error(`expected a write, got ${next.kind}`);
  return next.write;
};
const onItsWay = (m: StateModel, limits: BridgeLimits = SPEC_LIMITS): StateModel => {
  const next = nextWrite(m, limits);
  if (next.kind !== "write") throw new Error(`expected a write, got ${next.kind}`);
  return next.model;
};

describe("the key of a tick", () => {
  test("it is tick, the path and the content hash", () => {
    expect(fileTickKey("src/retry.ts", HASH)).toBe(`tick:src/retry.ts:${HASH}`);
  });

  test("a path that fits is kept whole, up to 186 characters", () => {
    const path = `${"d/".repeat(92)}ab`;
    expect(path.length).toBe(186);
    const key = fileTickKey(path, HASH);
    expect(key).toBe(`tick:${path}:${HASH}`);
    expect(key.length).toBe(256);
  });

  test("a longer path keeps its end, so the key stays within 256 characters and still ends in the hash", () => {
    const path = `top/${"x".repeat(300)}/file.ts`;
    const key = fileTickKey(path, HASH);
    expect(key.length).toBe(256);
    expect(key.startsWith("tick:")).toBe(true);
    expect(key.endsWith(`/file.ts:${HASH}`)).toBe(true);
  });

  test("a cut never starts in the middle of a pair of code units", () => {
    const path = `${"a".repeat(100)}\u{1F600}${"b".repeat(185)}`;
    const key = fileTickKey(path, HASH);
    expect(key.length).toBeLessThanOrEqual(256);
    expect(key.slice(5)).not.toMatch(/^[\udc00-\udfff]/u);
    const edge = `${"a".repeat(100)}\u{1F600}${"b".repeat(184)}`;
    expect(fileTickKey(edge, HASH).slice(5)).not.toMatch(/^[\udc00-\udfff]/u);
  });

  test("two files with the same content have different keys", () => {
    expect(fileTickKey("a.ts", HASH)).not.toBe(fileTickKey("b.ts", HASH));
  });
});

describe("what the reader sees", () => {
  test("a model with nothing in it shows nothing", () => {
    expect(stateView(EMPTY_STATE)).toEqual({});
    expect(isTicked(EMPTY_STATE, "tick:a:1")).toBe(false);
    expect(hasChanges(EMPTY_STATE)).toBe(false);
  });

  test("the viewer's document is shown once it is loaded", () => {
    const m = loaded({ "tick:a:1": true, other: 5 }, 7);
    expect(isTicked(m, "tick:a:1")).toBe(true);
    expect(stateView(m)).toEqual({ "tick:a:1": true, other: 5 });
    expect(m.rev).toBe(7);
    expect(m.loaded).toBe(true);
  });

  test("a tick the reader makes shows at once, before anything is sent", () => {
    const m = editTick(loaded(), "tick:a:1", true);
    expect(isTicked(m, "tick:a:1")).toBe(true);
    expect(hasChanges(m)).toBe(true);
  });

  test("an untick hides a tick the viewer holds, and a later tick brings it back", () => {
    const m = editTick(loaded({ "tick:a:1": true }, 3), "tick:a:1", false);
    expect(isTicked(m, "tick:a:1")).toBe(false);
    expect(isTicked(editTick(m, "tick:a:1", true), "tick:a:1")).toBe(true);
  });

  test("a change made before the document is loaded is kept and shown over it", () => {
    const early = editTick(EMPTY_STATE, "tick:a:1", true);
    const m = stateLoaded(early, { "tick:b:2": true }, 4);
    expect(stateView(m)).toEqual({ "tick:a:1": true, "tick:b:2": true });
  });

  test("setKey and delKey change any key, ticks being one use of them", () => {
    const m = delKey(setKey(loaded({ gone: 1 }), "kept", { n: 1 }), "gone");
    expect(stateView(m)).toEqual({ kept: { n: 1 } });
  });

  test("the view is a new object each time and the model is never changed in place", () => {
    const m = loaded({ "tick:a:1": true }, 1);
    const view = stateView(editTick(m, "tick:b:2", true));
    expect(view).not.toBe(m.doc);
    expect(m.doc).toEqual({ "tick:a:1": true });
    expect(m.pending).toEqual({});
  });
});

describe("the next write", () => {
  test("nothing goes before the document is loaded: its revision is not known", () => {
    const m = editTick(EMPTY_STATE, "tick:a:1", true);
    expect(nextWrite(m, SPEC_LIMITS).kind).toBe("none");
  });

  test("a loaded model with changes writes them against the revision it holds", () => {
    let m = loaded({ "tick:old:9": true }, 12);
    m = editTick(m, "tick:a:1", true);
    m = editTick(m, "tick:old:9", false);
    const next = nextWrite(m, SPEC_LIMITS);
    expect(next.kind).toBe("write");
    if (next.kind !== "write") return;
    expect(next.write).toEqual({ baseRev: 12, set: { "tick:a:1": true }, del: ["tick:old:9"] });
    expect(next.model.inFlight).toEqual({
      "tick:a:1": { kind: "set", value: true },
      "tick:old:9": { kind: "del" },
    });
    expect(next.model.pending).toEqual({});
  });

  test("nothing to write is no write", () => {
    expect(nextWrite(loaded({}, 3), SPEC_LIMITS).kind).toBe("none");
  });

  test("the reader still sees the changes while they are on their way", () => {
    const m = onItsWay(editTick(loaded({}, 1), "tick:a:1", true));
    expect(isTicked(m, "tick:a:1")).toBe(true);
  });

  test("one write is out at a time: a change made meanwhile waits for the answer", () => {
    const meanwhile = editTick(
      onItsWay(editTick(loaded({}, 1), "tick:a:1", true)),
      "tick:b:2",
      true,
    );
    expect(nextWrite(meanwhile, SPEC_LIMITS).kind).toBe("none");
    const answered = stateApplied(meanwhile, { "tick:a:1": true }, 2);
    expect(written(answered)).toEqual({ baseRev: 2, set: { "tick:b:2": true }, del: [] });
  });

  test("a change is written even where the copy we hold already agrees, since the viewer's may have moved", () => {
    const same = editTick(loaded({ "tick:a:1": true }, 5), "tick:a:1", true);
    expect(written(same)).toEqual({ baseRev: 5, set: { "tick:a:1": true }, del: [] });
    const absent = editTick(loaded({}, 5), "tick:a:1", false);
    expect(written(absent)).toEqual({ baseRev: 5, set: {}, del: ["tick:a:1"] });
  });

  test("a key is named once, and the last thing the reader did to it wins", () => {
    let m = loaded({}, 1);
    m = editTick(editTick(editTick(m, "tick:a:1", true), "tick:a:1", false), "tick:a:1", true);
    expect(written(m)).toEqual({ baseRev: 1, set: { "tick:a:1": true }, del: [] });
    let n = loaded({ "tick:a:1": true }, 1);
    n = editTick(editTick(n, "tick:a:1", false), "tick:a:1", true);
    expect(written(n)).toEqual({ baseRev: 1, set: { "tick:a:1": true }, del: [] });
  });

  test("a write that would not fit the viewer's message limit is split, in the order the changes were made", () => {
    const keys = Array.from({ length: 12 }, (_, i) => `tick:file-${i}.ts:${HASH}`);
    let m = loaded({}, 0);
    for (const key of keys) m = editTick(m, key, true);
    const limits = { ...SPEC_LIMITS, messageBytes: 600 };
    const seen: string[] = [];
    let writes = 0;
    let doc: Record<string, unknown> = {};
    let rev = 0;
    for (let round = 0; round < 20 && hasChanges(m); round++) {
      const next = nextWrite(m, limits);
      if (next.kind !== "write") throw new Error("expected a write");
      const { baseRev, set, del } = next.write;
      expect(messageBytes(stateSetMessage("r".repeat(64), baseRev, set, del))).toBeLessThanOrEqual(
        600,
      );
      seen.push(...Object.keys(set));
      doc = { ...doc, ...set };
      rev += 1;
      writes += 1;
      m = stateApplied(next.model, doc, rev);
    }
    expect(seen).toEqual(keys);
    expect(writes).toBeGreaterThan(1);
    expect(hasChanges(m)).toBe(false);
  });

  test("a change too big for any message is held, not sent and not lost from view", () => {
    const huge = "x".repeat(700);
    const m = setKey(loaded({}, 0), "big", huge);
    const limits = { ...SPEC_LIMITS, messageBytes: 600 };
    const next = nextWrite(m, limits);
    expect(next.kind).toBe("refused");
    expect(stateView(next.model).big).toBe(huge);
    expect(nextWrite(next.model, limits).kind).toBe("none");
  });

  test("a change too big for any message does not hold back the others", () => {
    const limits = { ...SPEC_LIMITS, messageBytes: 600 };
    let m = setKey(loaded({}, 0), "big", "x".repeat(700));
    m = editTick(m, `tick:a:${HASH}`, true);
    const next = nextWrite(m, limits);
    expect(next.kind).toBe("write");
    if (next.kind !== "write") return;
    expect(Object.keys(next.write.set)).toEqual([`tick:a:${HASH}`]);
    expect(Object.keys(next.model.held)).toEqual(["big"]);
  });

  test("the changes that fit the viewer's size limit go, and the one that would pass it is held", () => {
    const limits = { ...SPEC_LIMITS, stateBytes: 120 };
    let m = loaded({ "tick:old:1": true }, 3);
    m = editTick(editTick(m, `tick:a:${HASH}`, true), `tick:b:${HASH}`, true);
    const next = nextWrite(m, limits);
    expect(next.kind).toBe("write");
    if (next.kind !== "write") return;
    expect(Object.keys(next.write.set)).toEqual([`tick:a:${HASH}`]);
    expect(Object.keys(next.model.held)).toEqual([`tick:b:${HASH}`]);
    expect(isTicked(next.model, `tick:b:${HASH}`)).toBe(true);
    expect(hasChanges(next.model)).toBe(true);
  });

  test("when nothing fits the size limit, everything waiting is held and the answer is a refusal", () => {
    const limits = { ...SPEC_LIMITS, stateBytes: 60 };
    let m = loaded({ "tick:old:1": true }, 3);
    m = editTick(editTick(m, `tick:a:${HASH}`, true), `tick:b:${HASH}`, true);
    const next = nextWrite(m, limits);
    expect(next.kind).toBe("refused");
    expect(Object.keys(next.model.held).length).toBe(2);
    expect(next.model.pending).toEqual({});
    expect(isTicked(next.model, `tick:a:${HASH}`)).toBe(true);
    expect(nextWrite(next.model, limits).kind).toBe("none");
  });

  test("a tick the reader makes again after a refusal goes out afresh", () => {
    const limits = { ...SPEC_LIMITS, stateBytes: 40 };
    const refused = nextWrite(editTick(loaded({}, 1), `tick:a:${HASH}`, true), limits);
    expect(refused.kind).toBe("refused");
    const again = editTick(
      editTick(refused.model, `tick:a:${HASH}`, false),
      `tick:a:${HASH}`,
      true,
    );
    expect(Object.keys(again.held)).toEqual([]);
    expect(again.pending).toEqual({ [`tick:a:${HASH}`]: { kind: "set", value: true } });
  });
});

describe("what the viewer answers", () => {
  const sent = (): StateModel =>
    onItsWay(editTick(loaded({ "tick:old:1": true }, 5), "tick:a:1", true));

  test("an applied write is answered with the whole document, which replaces ours", () => {
    const m = stateApplied(sent(), { "tick:old:1": true, "tick:a:1": true, "tick:b:2": true }, 6);
    expect(m.inFlight).toEqual({});
    expect(m.rev).toBe(6);
    expect(stateView(m)).toEqual({ "tick:old:1": true, "tick:a:1": true, "tick:b:2": true });
    expect(hasChanges(m)).toBe(false);
  });

  test("a conflict hands back the current document, and our change goes back to be written again", () => {
    const m = stateConflicted(sent(), { "tick:old:1": true, "tick:c:3": true }, 9);
    expect(m.rev).toBe(9);
    expect(m.inFlight).toEqual({});
    expect(stateView(m)).toEqual({ "tick:old:1": true, "tick:c:3": true, "tick:a:1": true });
    expect(written(m)).toEqual({ baseRev: 9, set: { "tick:a:1": true }, del: [] });
  });

  test("a change made after the write was sent comes after the reapplied one", () => {
    const meanwhile = editTick(sent(), "tick:a:1", false);
    const m = stateConflicted(meanwhile, { "tick:old:1": true }, 8);
    expect(isTicked(m, "tick:a:1")).toBe(false);
    expect(written(m)).toEqual({ baseRev: 8, set: {}, del: ["tick:a:1"] });
  });

  test("a write that did not get through goes back to be written again, against the same revision", () => {
    const m = stateReturned(sent());
    expect(m.inFlight).toEqual({});
    expect(m.rev).toBe(5);
    expect(written(m)).toEqual({ baseRev: 5, set: { "tick:a:1": true }, del: [] });
  });

  test("a write the viewer refused is held: still shown, never sent again", () => {
    const m = stateRefused(sent());
    expect(m.inFlight).toEqual({});
    expect(isTicked(m, "tick:a:1")).toBe(true);
    expect(nextWrite(m, SPEC_LIMITS).kind).toBe("none");
    expect(hasChanges(m)).toBe(true);
  });
});

describe("the size of a document", () => {
  test("it is the JSON in UTF-8 bytes, as the viewer counts it", () => {
    const doc = { "tick:é:1": true };
    expect(docBytes(doc)).toBe(messageBytes(doc));
    expect(docBytes({})).toBe(2);
  });
});

// A reference for the viewer's merge: apply a write to a document, and say whether a key named in it
// changed after the revision it was based on.
function viewer() {
  const doc: Record<string, unknown> = {};
  let rev = 0;
  const changedAt = new Map<string, number>();
  return {
    get: () => ({ doc: { ...doc }, rev }),
    rival: (key: string, value: unknown) => {
      rev += 1;
      if (value === undefined) delete doc[key];
      else doc[key] = value;
      changedAt.set(key, rev);
    },
    write: (w: Write): "conflict" | "applied" => {
      const named = [...Object.keys(w.set), ...w.del];
      if (named.some((k) => (changedAt.get(k) ?? 0) > w.baseRev)) return "conflict";
      if (named.length === 0) return "applied";
      rev += 1;
      for (const k of w.del) {
        delete doc[k];
        changedAt.set(k, rev);
      }
      for (const [k, v] of Object.entries(w.set)) {
        doc[k] = v;
        changedAt.set(k, rev);
      }
      return "applied";
    },
  };
}

describe("a reader and a rival writing to one document", () => {
  // A small deterministic generator, so a failure can be replayed from its seed.
  const generator = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  };

  test("whatever the reader ticks and whoever else writes meanwhile, the document ends with the reader's last word on every key", () => {
    let conflicts = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const random = generator(seed);
      const host = viewer();
      const keys = Array.from({ length: 6 }, (_, i) => `tick:f${i}:${HASH}`);
      const pick = (list: readonly string[]): string =>
        list[Math.floor(random() * list.length)] ?? "";
      const last = new Map<string, boolean>();
      let m = stateLoaded(EMPTY_STATE, host.get().doc, host.get().rev);
      const flush = (): boolean => {
        const next = nextWrite(m, SPEC_LIMITS);
        if (next.kind !== "write") return false;
        const verdict = host.write(next.write);
        const now = host.get();
        if (verdict === "conflict") conflicts += 1;
        m =
          verdict === "applied"
            ? stateApplied(next.model, now.doc, now.rev)
            : stateConflicted(next.model, now.doc, now.rev);
        return true;
      };
      for (let step = 0; step < 80; step++) {
        const roll = random();
        const outstanding = Object.keys(m.pending);
        if (roll < 0.5) {
          const key = pick(keys);
          const on = random() < 0.6;
          m = editTick(m, key, on);
          last.set(key, on);
        } else if (roll < 0.65 && outstanding.length > 0) {
          // A rival strikes a key the reader has a change waiting on, so the write meets a conflict.
          host.rival(pick(outstanding), random() < 0.5 ? "rival" : undefined);
        } else {
          flush();
        }
      }
      for (let settle = 0; settle < 20 && flush(); settle++) {
        // keep writing until the reader has nothing left to say
      }
      for (const [key, on] of last) {
        expect([seed, key, host.get().doc[key] === true]).toEqual([seed, key, on]);
      }
    }
    expect(conflicts).toBeGreaterThan(10);
  });
});
