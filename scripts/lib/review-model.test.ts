// Tests beside scripts/lib/review-model.ts: the data a review page reads, built from a change's
// files, their diffs and a layout. Pure, so every case is a plain input and an expected shape.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMPTY_LAYOUT, mergeLayout, parseLayoutPartial } from "./review-layout.ts";
import { buildReviewData, packChunks, type ChangeText } from "./review-model.ts";

const defaults = (): ReturnType<typeof mergeLayout> => {
  const raw = JSON.parse(
    readFileSync(
      join(import.meta.dir, "..", "..", "skills", "review-pages", "page", "layout.default.json"),
      "utf8",
    ),
  );
  return mergeLayout(EMPTY_LAYOUT, parseLayoutPartial(raw).over);
};

const change = (
  path: string,
  status: string,
  add: number,
  del: number,
  old: string | null = null,
) => ({
  path,
  old,
  status,
  add,
  del,
  binary: false,
});

const inputs: ChangeText[] = [
  { change: change("pnpm-lock.yaml", "M", 4, 2), diff: "@@ -1 +1 @@\n-a\n+b\n", text: "b\n" },
  {
    change: change("apps/shop/src/cart.ts", "M", 3, 1),
    diff: "@@ -1,2 +1,4 @@\n a\n+b\n+c\n",
    text: "a\nb\nc\n",
  },
  {
    change: change("apps/shop/src/cart.test.ts", "A", 5, 0),
    diff: "@@ -0,0 +1,5 @@\n+t\n",
    text: "t\n",
  },
  {
    change: change("apps/shop/.env.ci", "M", 1, 1),
    diff: "@@ -1 +1 @@\n-KEY=a\n+KEY=b\n",
    text: "KEY=b\n",
  },
  { change: change("docs/gone.md", "D", 0, 9), diff: "@@ -1,9 +0,0 @@\n-x\n", text: null },
];

const meta = {
  pr: null,
  ticket: null,
  ticketTitle: "Gift wrapping",
  ticketBody: "Ticket text",
  body: "Summary text",
  mergedAt: null,
  base: "b".repeat(40),
  head: "h".repeat(40),
  redactions: 2,
};

describe("packChunks", () => {
  test("a chunk closes before it would pass the limit", () => {
    expect(packChunks([4, 4, 4, 9, 1], 10)).toEqual([0, 0, 1, 2, 2]);
    expect(packChunks([], 10)).toEqual([]);
  });
});

describe("buildReviewData", () => {
  const { review, chunks, problems } = buildReviewData({
    inputs,
    layout: defaults(),
    meta,
    chunkBytes: 1_500_000,
  });

  test("the data is versioned and carries the change's totals", () => {
    expect(problems).toEqual([]);
    expect(review.version).toBe(2);
    expect(review.changedFiles).toBe(5);
    expect(review.additions).toBe(13);
    expect(review.deletions).toBe(13);
    expect(review.head).toBe(meta.head);
    expect(review.redactions).toBe(2);
    expect(review.ticketTitle).toBe("Gift wrapping");
  });

  test("files come in review order, each pointing at its group", () => {
    expect(review.files.map((f) => f.path)).toEqual([
      "apps/shop/src/cart.ts",
      "docs/gone.md",
      "apps/shop/.env.ci",
      "apps/shop/src/cart.test.ts",
      "pnpm-lock.yaml",
    ]);
    const titleOf = (path: string) =>
      review.groups[review.files.find((f) => f.path === path)?.group ?? -1]?.title;
    expect(titleOf("apps/shop/src/cart.ts")).toBe("apps/shop");
    expect(titleOf("apps/shop/.env.ci")).toBe("Config and docs");
    expect(titleOf("apps/shop/src/cart.test.ts")).toBe("Tests");
    expect(titleOf("pnpm-lock.yaml")).toBe("Generated files and lockfiles");
  });

  test("a file's language, purpose and read-closely mark are filled in", () => {
    const cart = review.files.find((f) => f.path === "apps/shop/src/cart.ts");
    expect(cart?.lang).toBe("typescript");
    expect(cart?.purposeSource).toBe("heuristic");
    expect(cart?.purpose.length).toBeGreaterThan(0);
    expect(cart?.first).toBe(false);
  });

  test("a withheld file keeps its row but its diff is empty in the chunk", () => {
    const i = review.files.findIndex((f) => f.path === "apps/shop/.env.ci");
    const env = review.files[i];
    expect(env?.withheld).toContain("not shown");
    const item = chunks.flat().find((x) => x.i === i);
    expect(item?.diff).toBe("");
  });

  test("every other file's diff is in its chunk under the file's index, with no whole-file text", () => {
    const i = review.files.findIndex((f) => f.path === "apps/shop/src/cart.ts");
    const item = chunks.flat().find((x) => x.i === i);
    expect(item?.diff).toContain("+b");
    expect(Object.keys(item ?? {}).sort()).toEqual(["diff", "i"]);
    expect(chunks.flat().length).toBe(5);
  });

  test("the signature changes with the diff and not with the file's place in the list", () => {
    const sigOf = (data: typeof review, path: string) =>
      data.files.find((f) => f.path === path)?.sig;
    expect(sigOf(review, "apps/shop/src/cart.ts")).toMatch(/^[0-9a-f]{10}$/u);
    const changed = buildReviewData({
      inputs: inputs.map((x) =>
        x.change.path === "apps/shop/src/cart.ts" ? { ...x, diff: `${x.diff}+d\n` } : x,
      ),
      layout: defaults(),
      meta,
      chunkBytes: 1_500_000,
    }).review;
    expect(sigOf(changed, "apps/shop/src/cart.ts")).not.toBe(
      sigOf(review, "apps/shop/src/cart.ts"),
    );
    expect(sigOf(changed, "pnpm-lock.yaml")).toBe(sigOf(review, "pnpm-lock.yaml"));
    const reversed = buildReviewData({
      inputs: [...inputs].reverse(),
      layout: defaults(),
      meta,
      chunkBytes: 1_500_000,
    }).review;
    expect(sigOf(reversed, "apps/shop/src/cart.ts")).toBe(sigOf(review, "apps/shop/src/cart.ts"));
  });

  test("the same input gives byte-identical data, whatever the input order", () => {
    const again = buildReviewData({
      inputs: [...inputs].reverse(),
      layout: defaults(),
      meta,
      chunkBytes: 1_500_000,
    });
    expect(JSON.stringify(again.review)).toBe(JSON.stringify(review));
    expect(JSON.stringify(again.chunks)).toBe(JSON.stringify(chunks));
  });

  test("a small chunk limit splits the diffs over chunks, and each file names its chunk", () => {
    const split = buildReviewData({ inputs, layout: defaults(), meta, chunkBytes: 60 });
    expect(split.chunks.length).toBeGreaterThan(1);
    split.review.files.forEach((f, i) => {
      expect(split.chunks[f.chunk]?.some((x) => x.i === i)).toBe(true);
    });
  });

  test("rulings are resolved against the file texts, and a lost link is a problem", () => {
    const layout = mergeLayout(defaults(), {
      rulings: [
        {
          n: 1,
          state: "open",
          title: "Is it right",
          links: [
            { path: "apps/shop/src/cart.ts", match: "b", label: "the second line" },
            { path: "apps/shop/src/cart.ts", match: "zzz", label: "nowhere" },
          ],
        },
      ],
    });
    const out = buildReviewData({ inputs, layout, meta, chunkBytes: 1_500_000 });
    expect(out.review.rulings[0]?.links).toEqual([
      { path: "apps/shop/src/cart.ts", from: 2, to: 2, label: "the second line" },
    ]);
    expect(out.problems.join(" ")).toContain("zzz");
  });

  test("a storage key is carried into the data only when given", () => {
    expect("storageKey" in review).toBe(false);
    const keyed = buildReviewData({
      inputs,
      layout: defaults(),
      meta: { ...meta, storageKey: "demo-review" },
      chunkBytes: 1_500_000,
    }).review;
    expect(keyed.storageKey).toBe("demo-review");
  });
});
