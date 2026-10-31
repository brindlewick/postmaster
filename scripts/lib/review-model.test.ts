// Tests beside scripts/lib/review-model.ts: the data a review page reads, built from a change's
// files, their diffs and a layout. Pure, so every case is a plain input and an expected shape.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMPTY_LAYOUT, mergeLayout, parseLayoutPartial } from "./review-layout.ts";
import {
  buildReviewData,
  type ChangeText,
  contentHash,
  packChunks,
  shownDiff,
} from "./review-model.ts";

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

// The content hash is the second half of a tick's key in the page bridge (`tick:<path>:<hash>`), so
// its preimage is a contract: change it and every kept tick of every page drops once.
describe("shownDiff", () => {
  const headers =
    "diff --git a/a.ts b/a.ts\nindex 1111111..2222222 100644\n--- a/a.ts\n+++ b/a.ts\n";

  test("it is the diff from the first hunk header on", () => {
    expect(shownDiff(`${headers}@@ -1 +1 @@\n-a\n+b\n`)).toBe("@@ -1 +1 @@\n-a\n+b\n");
    expect(shownDiff("@@ -1 +1 @@\n-a\n+b\n")).toBe("@@ -1 +1 @@\n-a\n+b\n");
  });

  test("a diff with no hunk shows nothing", () => {
    expect(shownDiff("")).toBe("");
    expect(
      shownDiff("diff --git a/x b/y\nsimilarity index 100%\nrename from x\nrename to y\n"),
    ).toBe("");
  });

  test("a line of the code that looks like a hunk header is not taken for the first one", () => {
    const diff = `${headers}@@ -1 +1 @@\n-x\n+@@ -9 +9 @@\n`;
    expect(shownDiff(diff)).toBe("@@ -1 +1 @@\n-x\n+@@ -9 +9 @@\n");
  });
});

describe("contentHash", () => {
  const modified = change("src/a.ts", "M", 1, 1);
  const hunks = "@@ -1 +1 @@\n-a\n+b\n";
  const headers = (a: string, b: string) =>
    `diff --git a/src/a.ts b/src/a.ts\nindex ${a}..${b} 100644\n--- a/src/a.ts\n+++ b/src/a.ts\n`;
  const shown = { withheld: false };

  test("it is the SHA-256 of the shown diff, as 64 lowercase hex digits", () => {
    const hash = contentHash(modified, hunks, shown);
    expect(hash).toMatch(/^[0-9a-f]{64}$/u);
    // Pinned: a change to the preimage drops every tick that pages have kept.
    expect(hash).toBe("8f6d60c84eb56273442a954f9d74e5deb0116026329438e8eca2655611a9d00a");
  });

  test("what git writes before the first hunk does not count: a moved base keeps the hash", () => {
    const one = contentHash(modified, `${headers("1111111", "2222222")}${hunks}`, shown);
    const other = contentHash(modified, `${headers("aaaaaaa", "2222222")}${hunks}`, shown);
    expect(other).toBe(one);
    expect(one).toBe(contentHash(modified, hunks, shown));
  });

  test("any change to what is drawn changes it: a line, a context line, a hunk header", () => {
    const base = contentHash(modified, hunks, shown);
    for (const changed of [
      "@@ -1 +1 @@\n-a\n+c\n",
      "@@ -1 +1 @@\n-z\n+b\n",
      "@@ -1,2 +1,2 @@\n-a\n+b\n ctx\n",
      "@@ -2 +2 @@\n-a\n+b\n",
      `${hunks}@@ -9 +9 @@\n-q\n+r\n`,
    ]) {
      expect(contentHash(modified, changed, shown)).not.toBe(base);
    }
  });

  test("the path is not part of it: the key adds the path, and a rename keeps the hash", () => {
    const other = change("docs/b.ts", "M", 1, 1);
    expect(contentHash(other, hunks, shown)).toBe(contentHash(modified, hunks, shown));
    const renamed = change("src/b.ts", "R", 1, 1, "src/a.ts");
    expect(contentHash(renamed, hunks, shown)).toBe(contentHash(modified, hunks, shown));
  });

  test("a rename with no change to its text, and an empty diff, share one hash", () => {
    const rename = "diff --git a/x b/y\nsimilarity index 100%\nrename from x\nrename to y\n";
    const pure = change("y", "R", 0, 0, "x");
    expect(contentHash(pure, rename, shown)).toBe(contentHash(pure, "", shown));
    expect(contentHash(pure, "", shown)).toBe(
      "7c4604d03f399eac32a48edbb7be1710838b70c83ad0e94b60137920945d6c40",
    );
  });

  test("a withheld file hashes its counts and nothing of its diff", () => {
    const env = change("apps/shop/.env.ci", "M", 1, 1);
    const withheld = { withheld: true };
    const a = contentHash(env, "@@ -1 +1 @@\n-KEY=a\n+KEY=b\n", withheld);
    expect(contentHash(env, "@@ -1 +1 @@\n-KEY=x\n+KEY=y\n", withheld)).toBe(a);
    expect(a).toBe("1fd08232799e6442d6a6f8b30d209349ffe4a365ad7c5f961eaee640d65c0850");
    expect(contentHash({ ...env, add: 2 }, "", withheld)).not.toBe(a);
    expect(contentHash({ ...env, del: 3 }, "", withheld)).not.toBe(a);
  });

  test("a binary file hashes the id of its content, so a changed picture drops its tick", () => {
    const image = { ...change("logo.png", "M", 0, 0), binary: true };
    const one = contentHash(image, "", { withheld: false, blob: "abc" });
    expect(one).toBe("f50f2bc0aaed7096fafac350fb26bbc1b791433b82c83a81a11c7d227e31fb49");
    expect(contentHash(image, "", { withheld: false, blob: "abc" })).toBe(one);
    expect(contentHash(image, "", { withheld: false, blob: "abd" })).not.toBe(one);
    expect(contentHash(image, "", { withheld: false })).not.toBe(one);
  });

  test("the kinds do not collide: a diff, a withheld file and a binary file", () => {
    const hashes = new Set([
      contentHash(modified, "", shown),
      contentHash(modified, "", { withheld: true }),
      contentHash({ ...modified, binary: true }, "", { withheld: false }),
    ]);
    expect(hashes.size).toBe(3);
  });
});

describe("the hash in the review data", () => {
  const build = (list: readonly ChangeText[], chunkBytes = 1_500_000) =>
    buildReviewData({ inputs: list, layout: defaults(), meta, chunkBytes }).review;
  const review = build(inputs);
  const hashOf = (data: typeof review, path: string) =>
    data.files.find((f) => f.path === path)?.hash;

  test("every file carries one, and it is not the signature", () => {
    for (const f of review.files) {
      expect(f.hash).toMatch(/^[0-9a-f]{64}$/u);
      expect(f.hash.startsWith(f.sig)).toBe(false);
    }
  });

  test("it follows the shown diff of the file and nothing else", () => {
    const changed = build(
      inputs.map((x) =>
        x.change.path === "apps/shop/src/cart.ts" ? { ...x, diff: `${x.diff}+d\n` } : x,
      ),
    );
    expect(hashOf(changed, "apps/shop/src/cart.ts")).not.toBe(
      hashOf(review, "apps/shop/src/cart.ts"),
    );
    for (const f of review.files) {
      if (f.path !== "apps/shop/src/cart.ts") expect(hashOf(changed, f.path)).toBe(f.hash);
    }
    expect(hashOf(build([...inputs].reverse(), 60), "apps/shop/src/cart.ts")).toBe(
      hashOf(review, "apps/shop/src/cart.ts"),
    );
  });

  test("a withheld file's hash does not depend on the text of its diff", () => {
    const env = "apps/shop/.env.ci";
    const other = build(
      inputs.map((x) =>
        x.change.path === env ? { ...x, diff: "@@ -1 +1 @@\n-KEY=q\n+KEY=r\n" } : x,
      ),
    );
    expect(hashOf(other, env)).toBe(hashOf(review, env));
  });

  test("a binary file's blob id reaches its hash", () => {
    const image: ChangeText = {
      change: { ...change("assets/logo.png", "M", 0, 0), binary: true },
      diff: "",
      text: null,
      blob: "abc",
    };
    const one = build([...inputs, image]);
    const two = build([...inputs, { ...image, blob: "abd" }]);
    expect(hashOf(one, "assets/logo.png")).not.toBe(hashOf(two, "assets/logo.png"));
  });
});
