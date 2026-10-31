// Tests beside scripts/review-page-gate-bridge.ts: the verdicts the render gate gives on how the
// review page keeps its ticks and comments through the page bridge. Pure: each case is the facts the
// gate would read from the page and from the stand-in viewer, and the verdict they earn. A verdict
// that cannot fail is no check, so every one has a case that makes it say what went wrong.
import { describe, expect, test } from "bun:test";
import { contentHash } from "./lib/review-model.ts";
import {
  allOf,
  bridgeTicksVerdict,
  commentVerdict,
  conflictVerdict,
  constantHashes,
  focusVerdict,
  newVersionOverrides,
  newVersionVerdict,
  notSavedVerdict,
  protocolProblems,
  unansweredVerdict,
  withoutComposerNote,
  withoutSaveNotes,
  withProtocol,
} from "./review-page-gate-bridge.ts";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const key = (path: string, hash: string) => `tick:${path}:${hash}`;

describe("ticks kept and found again", () => {
  const ticked = [
    { fi: 3, key: key("src/a.ts", HASH_A) },
    { fi: 5, key: key("src/b.ts", HASH_B) },
  ];
  const good = {
    ticked,
    written: [key("src/b.ts", HASH_B), key("src/a.ts", HASH_A)],
    after: { fis: [3, 5], count: 2, notes: [] as string[] },
  };

  test("two ticks written as tick:<path>:<hash> and found again after a reload pass", () => {
    const v = bridgeTicksVerdict(good);
    expect(v.ok).toBe(true);
    expect(v.detail).toContain("2 ticks");
  });

  test("a viewer that holds nothing is named", () => {
    const v = bridgeTicksVerdict({ ...good, written: [] });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("the viewer holds 0 ticks");
  });

  test("a key that is not the one the spec gives is named, with the one it should be", () => {
    const v = bridgeTicksVerdict({ ...good, written: [key("src/a.ts", HASH_A), "tick:src/b.ts"] });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("tick:src/b.ts");
    expect(v.detail).toContain(key("src/b.ts", HASH_B));
  });

  test("a tick lost after a reload is named by file", () => {
    const v = bridgeTicksVerdict({ ...good, after: { fis: [3], count: 1, notes: [] } });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("after a reload");
    expect(v.detail).toContain("file 5");
  });

  test("a count that disagrees with the ticks is named", () => {
    const v = bridgeTicksVerdict({ ...good, after: { fis: [3, 5], count: 1, notes: [] } });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("count is 1");
  });

  test("a Not saved line shown while the viewer keeps the ticks is named", () => {
    const v = bridgeTicksVerdict({
      ...good,
      after: {
        fis: [3, 5],
        count: 2,
        notes: ["Not saved. Ticks may be lost when you close this page."],
      },
    });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("Not saved");
  });
});

describe("a new version of the page", () => {
  test("the file whose diff changed starts unticked and the unchanged one keeps its tick", () => {
    const v = newVersionVerdict({ changed: 3, kept: 5, ticked: [5], count: 1 });
    expect(v.ok).toBe(true);
  });

  test("a changed file that keeps its tick is named", () => {
    const v = newVersionVerdict({ changed: 3, kept: 5, ticked: [3, 5], count: 2 });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("file 3 kept its tick although its diff changed");
  });

  test("an unchanged file that loses its tick is named", () => {
    const v = newVersionVerdict({ changed: 3, kept: 5, ticked: [], count: 0 });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("file 5 lost its tick although its diff did not change");
  });

  test("a count that disagrees is named", () => {
    const v = newVersionVerdict({ changed: 3, kept: 5, ticked: [5], count: 4 });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("count is 4");
  });

  test("a review with one file to tick only has the changed file to judge", () => {
    expect(newVersionVerdict({ changed: 3, kept: null, ticked: [], count: 0 }).ok).toBe(true);
    const kept = newVersionVerdict({ changed: 3, kept: null, ticked: [3], count: 1 });
    expect(kept.ok).toBe(false);
    expect(kept.detail).toContain("file 3 kept its tick although its diff changed");
  });
});

describe("no viewer answers", () => {
  const note = [{ scope: "ticks", text: "Not saved. Ticks may be lost when you close this page." }];
  const comment = [
    { scope: "comments", text: "Not saved. Comments are lost when you close this page." },
  ];
  const screens = [
    { name: "overview", scope: "ticks", notes: note },
    { name: "tree", scope: "ticks", notes: note },
    { name: "file", scope: "ticks", notes: note },
    { name: "composer", scope: "comments", notes: comment },
  ];
  const good = { early: [], late: note, screens, ticked: true, sent: 0 };

  test("nothing is said while the page still waits, then Not saved on every screen, and a tick still works", () => {
    const v = notSavedVerdict(good);
    expect(v.ok).toBe(true);
    expect(v.detail).toContain("composer");
  });

  test("a line shown before the 1.5 seconds are up is named", () => {
    const v = notSavedVerdict({ ...good, early: note });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("before the wait for the viewer was over");
  });

  test("no line at all after the wait is named", () => {
    const v = notSavedVerdict({ ...good, late: [] });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("never said Not saved");
  });

  test("a line that does not say Not saved is named", () => {
    const v = notSavedVerdict({ ...good, late: [{ scope: "ticks", text: "Saving" }] });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("never said Not saved");
  });

  test("a screen with no line, or a line about the wrong thing, is named with its screen", () => {
    const missing = notSavedVerdict({
      ...good,
      screens: [...screens.slice(0, 3), { name: "composer", scope: "comments", notes: [] }],
    });
    expect(missing.ok).toBe(false);
    expect(missing.detail).toContain("no Not saved line for comments on the composer screen");
    const wrong = notSavedVerdict({
      ...good,
      screens: [{ name: "composer", scope: "comments", notes: note }],
    });
    expect(wrong.ok).toBe(false);
    expect(wrong.detail).toContain("no Not saved line for comments on the composer screen");
  });

  test("a tick that does not work for the visit is named", () => {
    const v = notSavedVerdict({ ...good, ticked: false });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("tick did not work");
  });

  test("anything sent to a viewer that never said ready is named", () => {
    const v = notSavedVerdict({ ...good, sent: 2 });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("sent 2 messages");
  });

  test("a request unanswered for 5 seconds counts as unavailable: nothing before, Not saved after", () => {
    expect(unansweredVerdict({ before: [], after: note, ticked: true }).ok).toBe(true);
    const early = unansweredVerdict({ before: note, after: note, ticked: true });
    expect(early.ok).toBe(false);
    expect(early.detail).toContain("before the 5 seconds were up");
    const never = unansweredVerdict({ before: [], after: [], ticked: true });
    expect(never.ok).toBe(false);
    expect(never.detail).toContain("never said Not saved");
    const lost = unansweredVerdict({ before: [], after: note, ticked: false });
    expect(lost.ok).toBe(false);
    expect(lost.detail).toContain("tick did not stay");
  });
});

describe("a conflict", () => {
  const k = key("src/a.ts", HASH_A);
  const good = {
    outcomes: ["error:conflict", "state"],
    doc: { [k]: true, "rival:1": true } as Record<string, unknown>,
    key: k,
    ticked: true,
    notes: [] as string[],
  };

  test("the change is reapplied and written again once, and the other reader's key is left alone", () => {
    expect(conflictVerdict(good).ok).toBe(true);
  });

  test("a page that never gets its change through is named by what the viewer answered", () => {
    const v = conflictVerdict({
      ...good,
      outcomes: ["error:conflict", "error:conflict", "error:conflict"],
    });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("error:conflict, error:conflict, error:conflict");
  });

  test("a page that does not write again after a conflict is named", () => {
    const v = conflictVerdict({
      ...good,
      outcomes: ["error:conflict"],
      doc: { [k]: "rival", "rival:1": true },
    });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("error:conflict");
  });

  test("a document that lost the other reader's key is named", () => {
    const v = conflictVerdict({ ...good, doc: { [k]: true } });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("the other reader's key");
  });

  test("a tick that does not show, or a Not saved line shown, is named", () => {
    expect(conflictVerdict({ ...good, ticked: false }).detail).toContain("not shown as ticked");
    const said = conflictVerdict({
      ...good,
      notes: ["Not saved. Ticks may be lost when you close this page."],
    });
    expect(said.ok).toBe(false);
    expect(said.detail).toContain("Not saved");
  });
});

describe("a comment", () => {
  const row = { path: "src/a.ts", side: "new", line: 12, text: "  const x = 1;", blank: false };
  const good = {
    typed: "Why is this retried?",
    row,
    atOnce: { text: "Why is this retried?", save: "sending" },
    stored: [
      {
        body: "Why is this retried?",
        anchor: {
          kind: "line",
          file: "src/a.ts",
          side: "new",
          from: 12,
          to: 12,
          quote: "  const x = 1;",
        },
      },
    ],
    settled: "kept",
    reloaded: [{ text: "Why is this retried?", save: "kept", note: "" }],
  };

  test("it shows at once, reaches the viewer as a line anchor, settles, and is there after a reload", () => {
    const v = commentVerdict(good);
    expect(v.ok).toBe(true);
    expect(v.detail).toContain("src/a.ts");
  });

  test("a comment that waits for the viewer before it shows is named", () => {
    const v = commentVerdict({ ...good, atOnce: null });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("not on the page right after Save");
  });

  test("a comment shown as already kept before any answer is named", () => {
    const v = commentVerdict({ ...good, atOnce: { text: good.typed, save: "kept" } });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("showed as kept");
  });

  test("a comment the viewer never received is named", () => {
    const v = commentVerdict({ ...good, stored: [] });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("the viewer keeps 0 comments");
  });

  test("a wrong word, file, side, line or quote in what the viewer kept is named", () => {
    const anchor = good.stored[0]?.anchor ?? {};
    const cases: readonly [Record<string, unknown>, string][] = [
      [{ ...anchor, file: "src/other.ts" }, "file"],
      [{ ...anchor, side: "old" }, "side"],
      [{ ...anchor, from: 11 }, "lines"],
      [{ ...anchor, to: 13 }, "lines"],
      [{ ...anchor, kind: "text" }, "kind"],
      [{ ...anchor, quote: "something else" }, "quote"],
    ];
    for (const [changed, word] of cases) {
      const v = commentVerdict({ ...good, stored: [{ body: good.typed, anchor: changed }] });
      expect([word, v.ok]).toEqual([word, false]);
      expect(v.detail).toContain(word);
    }
    const body = commentVerdict({ ...good, stored: [{ body: "other", anchor }] });
    expect(body.ok).toBe(false);
    expect(body.detail).toContain("body");
  });

  test("a quote left out of a line that has text is named", () => {
    const { quote: _quote, ...bare } = good.stored[0]?.anchor ?? {};
    const v = commentVerdict({ ...good, stored: [{ body: good.typed, anchor: bare }] });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("quote");
  });

  test("a blank line has no quote, and a space for it is named", () => {
    const blank = { ...row, text: " ", blank: true };
    const { quote: _quote, ...bare } = good.stored[0]?.anchor ?? {};
    expect(
      commentVerdict({ ...good, row: blank, stored: [{ body: good.typed, anchor: bare }] }).ok,
    ).toBe(true);
    const spaced = commentVerdict({
      ...good,
      row: blank,
      stored: [{ body: good.typed, anchor: { ...bare, quote: " " } }],
    });
    expect(spaced.ok).toBe(false);
    expect(spaced.detail).toContain("quote");
  });

  test("the quote of a line over 2000 characters is the line cut at 2000", () => {
    const long = { ...row, text: "x".repeat(2500) };
    const anchor = { ...good.stored[0]?.anchor, quote: "x".repeat(2000) };
    expect(commentVerdict({ ...good, row: long, stored: [{ body: good.typed, anchor }] }).ok).toBe(
      true,
    );
    const whole = { ...anchor, quote: "x".repeat(2500) };
    expect(
      commentVerdict({ ...good, row: long, stored: [{ body: good.typed, anchor: whole }] }).ok,
    ).toBe(false);
  });

  test("a comment that never settles as kept is named", () => {
    const v = commentVerdict({ ...good, settled: "sending" });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("never settled");
  });

  test("a comment missing after a reload, or shown twice, is named", () => {
    const gone = commentVerdict({ ...good, reloaded: [] });
    expect(gone.ok).toBe(false);
    expect(gone.detail).toContain("after a reload");
    const said = commentVerdict({
      ...good,
      reloaded: [
        {
          text: good.typed,
          save: "kept",
          note: "The lines have changed since this comment was left.",
        },
      ],
    });
    expect(said.ok).toBe(false);
    expect(said.detail).toContain("The lines have changed");
    const entry = { text: good.typed, save: "kept", note: "" };
    const twice = commentVerdict({ ...good, reloaded: [entry, entry] });
    expect(twice.ok).toBe(false);
    expect(twice.detail).toContain("2 times");
  });
});

describe("the viewer asks to show lines", () => {
  const good = {
    side: "new",
    from: 12,
    to: 14,
    flagged: [
      { side: "new", line: 12 },
      { side: "new", line: 13 },
      { side: "new", line: 14 },
    ],
    fileShown: true,
    fname: "a.ts",
    expectedName: "a.ts",
  };

  test("the file opens at those lines, which are marked", () => {
    expect(focusVerdict(good).ok).toBe(true);
  });

  test("nothing marked is named", () => {
    const v = focusVerdict({ ...good, flagged: [] });
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("no line was marked");
  });

  test("the wrong lines, or lines on the wrong side, are named", () => {
    const wrong = focusVerdict({ ...good, flagged: [{ side: "new", line: 12 }] });
    expect(wrong.ok).toBe(false);
    expect(wrong.detail).toContain("12");
    const side = focusVerdict({
      ...good,
      flagged: good.flagged.map((f) => ({ ...f, side: "old" })),
    });
    expect(side.ok).toBe(false);
    expect(side.detail).toContain("old");
  });

  test("a file that is not shown, or another file, is named", () => {
    expect(focusVerdict({ ...good, fileShown: false }).detail).toContain("file screen");
    const other = focusVerdict({ ...good, fname: "b.ts" });
    expect(other.ok).toBe(false);
    expect(other.detail).toContain("b.ts");
  });
});

describe("making a new version of the page", () => {
  const files = [
    {
      path: "src/a.ts",
      old: null,
      status: "M",
      add: 1,
      del: 1,
      binary: false,
      chunk: 0,
      hash: HASH_A,
    },
    {
      path: "src/b.ts",
      old: null,
      status: "M",
      add: 1,
      del: 1,
      binary: false,
      chunk: 1,
      hash: HASH_B,
    },
  ];
  const review = JSON.stringify({ files });
  const chunkA = JSON.stringify([{ i: 0, diff: "@@ -1 +1 @@\n-a\n+b\n" }]);
  const chunkB = JSON.stringify([{ i: 1, diff: "@@ -1 +1 @@\n-c\n+d\n" }]);
  const chunks = new Map([
    ["/chunks/0.json", chunkA],
    ["/chunks/1.json", chunkB],
  ]);

  test("one file's diff and hash change, and nothing else does", () => {
    const over = newVersionOverrides(review, chunks, 1);
    expect([...over.keys()].sort()).toEqual(["/chunks/1.json", "/review.json"]);
    const next = JSON.parse(over.get("/review.json") ?? "{}") as {
      files: { hash: string; path: string }[];
    };
    expect(next.files[0]?.hash).toBe(HASH_A);
    expect(next.files[1]?.hash).not.toBe(HASH_B);
    const diff =
      (JSON.parse(over.get("/chunks/1.json") ?? "[]") as { diff: string }[])[0]?.diff ?? "";
    expect(diff.startsWith("@@ -1 +1 @@\n-c\n+d\n")).toBe(true);
    expect(diff.length).toBeGreaterThan("@@ -1 +1 @@\n-c\n+d\n".length);
  });

  test("the new hash is the one the builder gives for the new diff", () => {
    const over = newVersionOverrides(review, chunks, 0);
    const next = JSON.parse(over.get("/review.json") ?? "{}") as { files: { hash: string }[] };
    const diff =
      (JSON.parse(over.get("/chunks/0.json") ?? "[]") as { diff: string }[])[0]?.diff ?? "";
    expect(next.files[0]?.hash).toBe(
      contentHash(
        { path: "src/a.ts", old: null, status: "M", add: 1, del: 1, binary: false },
        diff,
        {
          withheld: false,
        },
      ),
    );
  });

  test("a file that is not in the review is refused", () => {
    expect(() => newVersionOverrides(review, chunks, 9)).toThrow(/file 9/u);
  });

  test("a fault that gives every file the same hash leaves the rest of the data alone", () => {
    const flat = JSON.parse(constantHashes(review)) as { files: { hash: string; path: string }[] };
    expect(flat.files.map((f) => f.hash)).toEqual(["0".repeat(64), "0".repeat(64)]);
    expect(flat.files.map((f) => f.path)).toEqual(["src/a.ts", "src/b.ts"]);
  });

  test("a fault that hides the Not saved lines adds a rule at the end of the page", () => {
    const html = "<style>a{}</style><div></div>";
    expect(withoutSaveNotes(html)).toContain(".savenote{display:none!important}");
    expect(withoutSaveNotes(html).startsWith(html)).toBe(true);
  });
});

describe("what the stand-in refused or ignored", () => {
  const log = (...entries: [string, string | null, string][]) =>
    entries.map(([type, id, outcome], k) => ({ at: 1000 + k, type, id, outcome }));
  const clean = log(
    ["bridge-hello", null, "bridge-ready"],
    ["state-get", "r1", "state"],
    ["comments-get", "r2", "comments"],
    ["state-set", "r3", "state"],
    ["comment-create", "r4", "comment"],
  );

  test("a visit with every message accepted has nothing to name", () => {
    expect(protocolProblems(clean, { conflict: false })).toEqual([]);
  });

  test("a message that was ignored, or refused as bad, unsupported or too large, is named with its id", () => {
    const problems = protocolProblems(
      log(
        ["state-set", "r1", "ignored"],
        ["state-set", "r2", "error:bad_message"],
        ["comments-get", "r3", "error:unsupported"],
        ["comment-create", "r4", "error:too_large"],
        ["state-set", "r5", "error:rate_limited"],
        ["state-get", "r6", "error:unavailable"],
      ),
      { conflict: false },
    );
    expect(problems).toHaveLength(6);
    expect(problems[0]).toContain("state-set r1");
    expect(problems.join(" ")).toContain("ignored");
    expect(problems.join(" ")).toContain("error:bad_message");
  });

  test("a message the stand-in was told to drop is not a refusal", () => {
    expect(protocolProblems(log(["bridge-hello", null, "dropped"]), { conflict: false })).toEqual(
      [],
    );
  });

  test("a conflict is a refusal only where none was asked for", () => {
    const conflict = log(["state-set", "r1", "error:conflict"], ["state-set", "r2", "state"]);
    expect(protocolProblems(conflict, { conflict: true })).toEqual([]);
    expect(protocolProblems(conflict, { conflict: false })).toHaveLength(1);
  });

  test("a verdict that passed fails when the log holds a refusal, and says both", () => {
    const passed = { ok: true, detail: "all fine" };
    const problems = ["state-set r2: error:bad_message"];
    const v = withProtocol(passed, problems);
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("state-set r2");
    expect(withProtocol(passed, [])).toEqual(passed);
    const failed = withProtocol({ ok: false, detail: "no tick" }, problems);
    expect(failed.ok).toBe(false);
    expect(failed.detail).toContain("no tick");
    expect(failed.detail).toContain("state-set r2");
  });

  test("verdicts combine: all must pass, and what failed is said", () => {
    expect(
      allOf([
        { ok: true, detail: "a" },
        { ok: true, detail: "b" },
      ]),
    ).toEqual({ ok: true, detail: "a; b" });
    const v = allOf([
      { ok: true, detail: "a" },
      { ok: false, detail: "b broke" },
    ]);
    expect(v.ok).toBe(false);
    expect(v.detail).toBe("b broke");
    expect(allOf([]).ok).toBe(false);
  });
});

describe("faults put into the page", () => {
  test("a rule at the end of the page can hide the Not saved line of the comment box alone", () => {
    const html = "<style>a{}</style><div></div>";
    const hidden = withoutComposerNote(html);
    expect(hidden.startsWith(html)).toBe(true);
    expect(hidden).toContain(".composer .savenote{display:none!important}");
  });
});
