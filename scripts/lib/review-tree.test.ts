// Tests beside scripts/lib/review-tree.ts: the tree of a change's files, the numbers each
// directory carries, and the rows a phone lists. Every path here is invented.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type TreeDir,
  type TreeFile,
  type TreeInput,
  type TreeNode,
  type TreeRow,
  allDirIds,
  buildTree,
  compareNames,
  defaultOpen,
  fileOrder,
  matchWords,
  visibleRows,
} from "./review-tree.ts";

// Builders and readers, written apart from the module so no test leans on its code.

const input = (path: string, add = 1, del = 0, status = "M", quiet?: boolean): TreeInput =>
  quiet === undefined ? { path, add, del, status } : { path, add, del, status, quiet };

const quietInput = (path: string, add = 1, del = 0, status = "M"): TreeInput =>
  input(path, add, del, status, true);

/** Every directory row, parents before children. */
const dirsIn = (nodes: readonly TreeNode[]): TreeDir[] =>
  nodes.flatMap((n) => (n.kind === "dir" ? [n, ...dirsIn(n.children)] : []));

/** Every file row, in tree order. */
const filesIn = (nodes: readonly TreeNode[]): TreeFile[] =>
  nodes.flatMap((n) => (n.kind === "dir" ? filesIn(n.children) : [n]));

/** The tree as text: two spaces per level of the row's own depth, a slash after a directory. */
const outline = (nodes: readonly TreeNode[]): string[] =>
  nodes.flatMap((n) =>
    n.kind === "dir"
      ? [`${"  ".repeat(n.depth)}${n.label}/`, ...outline(n.children)]
      : [`${"  ".repeat(n.depth)}${n.name}`],
  );

/** The id of every row of a tree, depth first. */
const idsIn = (nodes: readonly TreeNode[]): string[] =>
  nodes.flatMap((n) => (n.kind === "dir" ? [n.id, ...idsIn(n.children)] : [n.id]));

/** Listed rows as [id, open, shown], one line each. */
const listed = (rows: readonly TreeRow[]): [string, boolean, number][] =>
  rows.map((row) => [row.node.id, row.open, row.shown]);

/** The tree with every `fi` zeroed, to compare shapes built from differently ordered input. */
const sansFi = (nodes: readonly TreeNode[]): TreeNode[] =>
  nodes.map((n) => (n.kind === "dir" ? { ...n, children: sansFi(n.children) } : { ...n, fi: 0 }));

const ascending = (a: number, b: number): number => a - b;

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

/** A seeded generator of floats in [0, 1), so a failing case can be replayed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], seed: number): T[] {
  const next = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The main sample. The index is the position in this list, which is not the tree order.
const CHANGE: TreeInput[] = [
  input("apps/shop/src/cart.ts", 40, 5), // 0
  quietInput("apps/shop/src/cart.test.ts", 60, 2, "A"), // 1
  input("apps/shop/src/checkout.ts", 12, 12), // 2
  quietInput("apps/shop/tests/cart.spec.ts", 18, 0, "A"), // 3
  quietInput("apps/shop/tests/helpers.ts", 9, 3), // 4
  input("apps/shop/package.json", 1, 1), // 5
  input("packages/pricing/src/index.ts", 2, 0), // 6
  input("packages/pricing/src/rules/volume/tiers.ts", 30, 0, "A"), // 7
  quietInput("packages/pricing/src/rules/volume/tiers.test.ts", 25, 0, "A"), // 8
  input("packages/pricing/src/rules/rounding/half-even.ts", 14, 6), // 9
  input("docs/guide/start.md", 10, 4), // 10
  input("docs/guide/advanced.md", 7, 0, "A"), // 11
  input("README.md", 3, 1), // 12
];

const CHANGE_OUTLINE = [
  "apps/shop/",
  "  src/",
  "    cart.test.ts",
  "    cart.ts",
  "    checkout.ts",
  "  tests/",
  "    cart.spec.ts",
  "    helpers.ts",
  "  package.json",
  "docs/guide/",
  "  advanced.md",
  "  start.md",
  "packages/pricing/src/",
  "  rules/",
  "    rounding/",
  "      half-even.ts",
  "    volume/",
  "      tiers.test.ts",
  "      tiers.ts",
  "  index.ts",
  "README.md",
];

const ALL_DIR_IDS = [
  "apps/shop",
  "apps/shop/src",
  "apps/shop/tests",
  "docs/guide",
  "packages/pricing/src",
  "packages/pricing/src/rules",
  "packages/pricing/src/rules/rounding",
  "packages/pricing/src/rules/volume",
];

describe("compareNames", () => {
  test("case is ignored first: a capital Z still follows a lower-case a", () => {
    expect(compareNames("Zeta", "alpha")).toBe(1);
    expect(compareNames("alpha", "Zeta")).toBe(-1);
    expect(compareNames("beta", "BETA2")).toBe(-1);
  });

  test("names that differ only in case: the capital comes first, equal names are equal", () => {
    expect(compareNames("A", "a")).toBe(-1);
    expect(compareNames("a", "A")).toBe(1);
    expect(compareNames("Élan", "élan")).toBe(-1);
    expect(compareNames("a.ts", "a.ts")).toBe(0);
  });

  test("order is by code unit, so it is the same in every browser and locale", () => {
    expect(compareNames("file10.ts", "file9.ts")).toBe(-1);
    expect(compareNames("é", "z")).toBe(1);
    expect(compareNames("a_b", "a-b")).toBe(1);
    expect(compareNames("日本", "zebra")).toBe(1);
  });

  test("the answer is exactly -1, 0 or 1, flips with the arguments, and 0 means identical", () => {
    const names = ["a", "A", "ab", "Ab", "b", "B", "é", "É", "z", "Z", "a.b", "a-b", "", "日本"];
    for (const x of names) {
      for (const y of names) {
        const forward = compareNames(x, y);
        expect([-1, 0, 1]).toContain(forward);
        expect(forward).toBe(0 - compareNames(y, x));
        expect(forward === 0).toBe(x === y);
      }
    }
  });

  test("sorting with it gives one order from any starting order", () => {
    const names = ["Zeta", "alpha", "a", "A", "Alpha", "zeta", "é", "Z", "10", "9"];
    const expected = ["10", "9", "A", "a", "Alpha", "alpha", "Z", "Zeta", "zeta", "é"];
    expect([...names].sort(compareNames)).toEqual(expected);
    expect([...names].reverse().sort(compareNames)).toEqual(expected);
    expect([...names.slice(4), ...names.slice(0, 4)].sort(compareNames)).toEqual(expected);
  });
});

describe("buildTree: files", () => {
  test("a file row carries its path, last segment, depth and the numbers of its input", () => {
    expect(buildTree([input("src/lib/a.ts", 3, 1, "R", true)])).toEqual([
      {
        kind: "dir",
        id: "src/lib",
        label: "src/lib",
        depth: 0,
        files: 1,
        add: 3,
        del: 1,
        quiet: true,
        children: [
          {
            kind: "file",
            id: "src/lib/a.ts",
            fi: 0,
            name: "a.ts",
            depth: 1,
            status: "R",
            add: 3,
            del: 1,
            quiet: true,
          },
        ],
      },
    ]);
  });

  test("fi is each file's position in the input, wherever it lands in the tree", () => {
    const nodes = filesIn(buildTree(CHANGE));
    expect(nodes).toHaveLength(CHANGE.length);
    for (const n of nodes) expect(CHANGE[n.fi].path).toBe(n.id);
    expect(nodes.map((n) => n.fi).sort(ascending)).toEqual(CHANGE.map((_, i) => i));
  });

  test("quiet is true only for an input marked true: absent and false both give false", () => {
    const tree = buildTree([input("a.ts"), input("b.ts", 1, 0, "M", false), quietInput("c.ts")]);
    expect(tree.map((n) => [n.id, n.quiet])).toEqual([
      ["a.ts", false],
      ["b.ts", false],
      ["c.ts", true],
    ]);
  });

  test("a path without a slash is a file at the root, depth 0", () => {
    const tree = buildTree([input("README.md", 3, 1), input(".gitignore", 1, 0, "A")]);
    expect(tree).toEqual([
      {
        kind: "file",
        id: ".gitignore",
        fi: 1,
        name: ".gitignore",
        depth: 0,
        status: "A",
        add: 1,
        del: 0,
        quiet: false,
      },
      {
        kind: "file",
        id: "README.md",
        fi: 0,
        name: "README.md",
        depth: 0,
        status: "M",
        add: 3,
        del: 1,
        quiet: false,
      },
    ]);
  });

  test("one single file in the repo", () => {
    const flat = buildTree([input("only.ts")]);
    expect(outline(flat)).toEqual(["only.ts"]);
    expect(fileOrder(flat)).toEqual([0]);
    expect(allDirIds(flat)).toEqual([]);
    expect(defaultOpen(flat)).toEqual([]);
    expect(listed(visibleRows(flat, new Set()))).toEqual([["only.ts", false, 1]]);

    const nested = buildTree([input("src/only.ts")]);
    expect(outline(nested)).toEqual(["src/", "  only.ts"]);
    expect(listed(visibleRows(nested, new Set(["src"])))).toEqual([
      ["src", true, 1],
      ["src/only.ts", false, 1],
    ]);
  });

  test("an empty change is an empty tree, and every function copes", () => {
    const tree = buildTree([]);
    expect(tree).toEqual([]);
    expect(fileOrder(tree)).toEqual([]);
    expect(allDirIds(tree)).toEqual([]);
    expect(defaultOpen(tree)).toEqual([]);
    expect(visibleRows(tree, new Set())).toEqual([]);
    expect(visibleRows(tree, new Set(), () => true)).toEqual([]);
  });

  test("the sample change builds the whole expected tree", () => {
    expect(outline(buildTree(CHANGE))).toEqual(CHANGE_OUTLINE);
  });
});

describe("buildTree: order", () => {
  test("directories come before files, each kind in name order", () => {
    const tree = buildTree([
      input("zeta.txt"),
      input("docs/a.md"),
      input("Aardvark.txt"),
      input("Beta/b.md"),
    ]);
    expect(outline(tree)).toEqual([
      "Beta/",
      "  b.md",
      "docs/",
      "  a.md",
      "Aardvark.txt",
      "zeta.txt",
    ]);
  });

  test("mixed-case names sort case-blind first, then capitals before lower case", () => {
    const files = ["lib/Zeta.ts", "lib/alpha.ts", "lib/a.ts", "lib/A.ts"].map((p) => input(p));
    expect(outline(buildTree(files))).toEqual([
      "lib/",
      "  A.ts",
      "  a.ts",
      "  alpha.ts",
      "  Zeta.ts",
    ]);

    const dirs = ["Zeta/x.ts", "alpha/x.ts", "a/x.ts", "A/x.ts"].map((p) => input(p));
    expect(outline(buildTree(dirs))).toEqual([
      "A/",
      "  x.ts",
      "a/",
      "  x.ts",
      "alpha/",
      "  x.ts",
      "Zeta/",
      "  x.ts",
    ]);
  });

  test("unicode names sort by code unit after lower-casing", () => {
    const names = ["zebra.md", "élan.md", "Überblick.md", "日本語.md", "Élan.md"];
    expect(outline(buildTree(names.map((n) => input(`docs/${n}`))))).toEqual([
      "docs/",
      "  zebra.md",
      "  Élan.md",
      "  élan.md",
      "  Überblick.md",
      "  日本語.md",
    ]);

    const [row] = buildTree([input("日本語/メモ/今日.md")]);
    expect(row.id).toBe("日本語/メモ");
    expect(outline([row])).toEqual(["日本語/メモ/", "  今日.md"]);
  });

  test("dots in names are ordinary: v1.2 and .github are directories, .gitignore a file", () => {
    const tree = buildTree([
      input("api/v1.2/routes.ts"),
      input("api/v1.2/schema.ts"),
      input(".github/workflows/ci.yml"),
    ]);
    expect(outline(tree)).toEqual([
      ".github/workflows/",
      "  ci.yml",
      "api/v1.2/",
      "  routes.ts",
      "  schema.ts",
    ]);
    expect(dirsIn(tree).map((d) => d.id)).toEqual([".github/workflows", "api/v1.2"]);
  });

  test("many files in one directory: one row, sorted, with the right totals", () => {
    const pad = (i: number): string => String(i).padStart(3, "0");
    const many = Array.from({ length: 150 }, (_, i) => input(`bulk/file-${pad(i)}.ts`, i, 1));
    const shuffledMany = shuffled(many, 7);
    const tree = buildTree(shuffledMany);
    const [dir] = dirsIn(tree);
    expect(tree).toHaveLength(1);
    expect([dir.label, dir.depth, dir.files, dir.add, dir.del]).toEqual([
      "bulk",
      0,
      150,
      11175,
      150,
    ]);
    expect(dir.children.map((n) => n.id)).toEqual(
      Array.from({ length: 150 }, (_, i) => `bulk/file-${pad(i)}.ts`),
    );
    for (const n of filesIn(tree)) expect(shuffledMany[n.fi].path).toBe(n.id);
  });

  test("names that look like object properties are ordinary names", () => {
    const tree = buildTree([
      input("__proto__/constructor/x.ts"),
      input("constructor/a.ts"),
      input("toString.ts"),
    ]);
    expect(outline(tree)).toEqual([
      "__proto__/constructor/",
      "  x.ts",
      "constructor/",
      "  a.ts",
      "toString.ts",
    ]);
  });

  test("a file replaced by a directory of the same name keeps both rows, directory first", () => {
    const tree = buildTree([input("docs", 0, 3, "D"), input("docs/readme.md", 3, 0, "A")]);
    expect(outline(tree)).toEqual(["docs/", "  readme.md", "docs"]);
    expect(fileOrder(tree)).toEqual([1, 0]);
  });

  test("the same path twice keeps both indices, in input order", () => {
    const tree = buildTree([input("a/x.ts", 1), input("a/x.ts", 2)]);
    expect(filesIn(tree).map((n) => [n.fi, n.add])).toEqual([
      [0, 1],
      [1, 2],
    ]);
    expect(dirsIn(tree).map((d) => [d.files, d.add])).toEqual([[2, 3]]);
  });

  test("shuffling the input changes only fi, never the shape", () => {
    const shape = sansFi(buildTree(CHANGE));
    for (const seed of [1, 2, 3, 4, 5]) {
      const mixed = shuffled(CHANGE, seed);
      const tree = buildTree(mixed);
      expect(sansFi(tree)).toEqual(shape);
      for (const n of filesIn(tree)) expect(mixed[n.fi].path).toBe(n.id);
    }
    const reversed = [...CHANGE].reverse();
    expect(sansFi(buildTree(reversed))).toEqual(shape);
  });
});

describe("compaction", () => {
  test("a single-directory chain of two, three or four segments is one row at depth 0", () => {
    for (const [path, label] of [
      ["docs/guide/start.md", "docs/guide"],
      ["apps/shop/src/cart.ts", "apps/shop/src"],
      ["libs/core/utils/strings/pad.ts", "libs/core/utils/strings"],
    ] as const) {
      const tree = buildTree([input(path)]);
      const rows = dirsIn(tree);
      expect(rows).toHaveLength(1);
      expect([rows[0].label, rows[0].id, rows[0].depth]).toEqual([label, label, 0]);
      expect(rows[0].children.map((n) => [n.id, n.depth])).toEqual([[path, 1]]);
    }
  });

  test("a chain stops where a directory has a file of its own, and starts again below it", () => {
    const tree = buildTree([input("libs/core/index.ts"), input("libs/core/utils/strings/pad.ts")]);
    expect(outline(tree)).toEqual(["libs/core/", "  utils/strings/", "    pad.ts", "  index.ts"]);
    expect(dirsIn(tree).map((d) => [d.id, d.label, d.depth])).toEqual([
      ["libs/core", "libs/core", 0],
      ["libs/core/utils/strings", "utils/strings", 1],
    ]);
  });

  test("a directory with two subdirectories merges with neither", () => {
    const tree = buildTree([input("lib/a/x.ts"), input("lib/b/y.ts")]);
    expect(outline(tree)).toEqual(["lib/", "  a/", "    x.ts", "  b/", "    y.ts"]);
    expect(dirsIn(tree).map((d) => [d.id, d.depth])).toEqual([
      ["lib", 0],
      ["lib/a", 1],
      ["lib/b", 1],
    ]);
  });

  test("a directory holding one file keeps its own row, and the repo root never merges", () => {
    const tree = buildTree([input("src/main.ts"), input("README.md")]);
    expect(outline(tree)).toEqual(["src/", "  main.ts", "README.md"]);
  });

  test("depth counts rows, not path segments", () => {
    const tree = buildTree([input("a/b/c/x.ts"), input("a/b/c/d/e/y.ts"), input("a/b/z.ts")]);
    expect(outline(tree)).toEqual(["a/b/", "  c/", "    d/e/", "      y.ts", "    x.ts", "  z.ts"]);
    expect(dirsIn(tree).map((d) => [d.id, d.label, d.depth])).toEqual([
      ["a/b", "a/b", 0],
      ["a/b/c", "c", 1],
      ["a/b/c/d/e", "d/e", 2],
    ]);
  });

  test("a merged row takes the children and the rollups of its deepest directory", () => {
    const tree = buildTree([input("a/b/c/x.ts", 5, 2), input("a/b/c/y.ts", 7, 1)]);
    const [row] = dirsIn(tree);
    expect(tree).toHaveLength(1);
    expect(row.id).toBe("a/b/c");
    expect(row.children.map((n) => n.id)).toEqual(["a/b/c/x.ts", "a/b/c/y.ts"]);
    expect([row.files, row.add, row.del]).toEqual([2, 12, 3]);
  });
});

describe("rollups", () => {
  test("every directory matches a hand-computed table", () => {
    const table = Object.fromEntries(
      dirsIn(buildTree(CHANGE)).map((d) => [d.id, [d.files, d.add, d.del, d.quiet]]),
    );
    expect(table).toEqual({
      "apps/shop": [6, 140, 23, false],
      "apps/shop/src": [3, 112, 19, false],
      "apps/shop/tests": [2, 27, 3, true],
      "docs/guide": [2, 17, 4, false],
      "packages/pricing/src": [4, 71, 6, false],
      "packages/pricing/src/rules": [3, 69, 6, false],
      "packages/pricing/src/rules/rounding": [1, 14, 6, false],
      "packages/pricing/src/rules/volume": [2, 55, 0, false],
    });
  });

  test("the top rows add up to the whole change", () => {
    const tree = buildTree(CHANGE);
    const files = tree.reduce((sum, n) => sum + (n.kind === "dir" ? n.files : 1), 0);
    expect([
      files,
      tree.reduce((s, n) => s + n.add, 0),
      tree.reduce((s, n) => s + n.del, 0),
    ]).toEqual([13, 231, 34]);
  });

  test("a directory is quiet when every file under it is quiet, and not otherwise", () => {
    const quietOf = (files: TreeInput[]): Record<string, boolean> =>
      Object.fromEntries(dirsIn(buildTree(files)).map((d) => [d.id, d.quiet]));

    expect(quietOf(CHANGE)["apps/shop/tests"]).toBe(true);
    expect(quietOf(CHANGE)["apps/shop/src"]).toBe(false);

    const snaps = [quietInput("snapshots/a/x.snap"), quietInput("snapshots/b/y.snap")];
    expect(quietOf(snaps)).toEqual({ snapshots: true, "snapshots/a": true, "snapshots/b": true });

    expect(quietOf([...snaps, input("snapshots/z.ts")])).toEqual({
      snapshots: false,
      "snapshots/a": true,
      "snapshots/b": true,
    });
  });
});

describe("fileOrder and allDirIds", () => {
  test("file indices come out in tree order, directories before files", () => {
    expect(fileOrder(buildTree(CHANGE))).toEqual([1, 0, 2, 3, 4, 5, 11, 10, 9, 8, 7, 6, 12]);
  });

  test("every input index appears exactly once", () => {
    expect(fileOrder(buildTree(CHANGE)).sort(ascending)).toEqual(CHANGE.map((_, i) => i));
    expect(fileOrder(buildTree(shuffled(CHANGE, 9))).sort(ascending)).toEqual(
      CHANGE.map((_, i) => i),
    );
  });

  test("fileOrder is the order of the file rows when every directory is open", () => {
    for (const files of [CHANGE, shuffled(CHANGE, 3), [input("only.ts")], []]) {
      const tree = buildTree(files);
      const rows = visibleRows(tree, new Set(allDirIds(tree)));
      const fromRows = rows.flatMap((r) => (r.node.kind === "file" ? [r.node.fi] : []));
      expect(fileOrder(tree)).toEqual(fromRows);
    }
  });

  test("allDirIds lists every directory row, parents before children", () => {
    expect(allDirIds(buildTree(CHANGE))).toEqual(ALL_DIR_IDS);
    expect(allDirIds(buildTree([input("a.ts"), input("b.ts")]))).toEqual([]);
  });
});

describe("defaultOpen", () => {
  const tree = buildTree(CHANGE);

  test("one level opens the top rows", () => {
    expect(defaultOpen(tree, 1)).toEqual(["apps/shop", "docs/guide", "packages/pricing/src"]);
  });

  test("two levels is the default, and a quiet directory stays shut", () => {
    const two = [
      "apps/shop",
      "apps/shop/src",
      "docs/guide",
      "packages/pricing/src",
      "packages/pricing/src/rules",
    ];
    expect(defaultOpen(tree, 2)).toEqual(two);
    expect(defaultOpen(tree)).toEqual(two);
    expect(defaultOpen(tree)).not.toContain("apps/shop/tests");
  });

  test("three levels reach the third row, still skipping quiet directories", () => {
    expect(defaultOpen(tree, 3)).toEqual([
      "apps/shop",
      "apps/shop/src",
      "docs/guide",
      "packages/pricing/src",
      "packages/pricing/src/rules",
      "packages/pricing/src/rules/rounding",
      "packages/pricing/src/rules/volume",
    ]);
  });

  test("zero levels opens nothing, and a quiet top directory is never opened", () => {
    expect(defaultOpen(tree, 0)).toEqual([]);
    const withSnaps = buildTree([quietInput("snaps/a.snap"), input("src/a.ts")]);
    expect(defaultOpen(withSnaps, 9)).toEqual(["src"]);
  });
});

describe("matchWords", () => {
  test("every word of the query must appear, in any order", () => {
    expect(matchWords("apps/shop/src/cart.ts", "shop cart")).toBe(true);
    expect(matchWords("apps/shop/src/cart.ts", "cart shop")).toBe(true);
    expect(matchWords("apps/shop/src/cart.ts", "shop checkout")).toBe(false);
    expect(matchWords("", "cart")).toBe(false);
  });

  test("case is ignored on both sides", () => {
    expect(matchWords("Apps/Shop/README.MD", "readme.md SHOP")).toBe(true);
    expect(matchWords("élan.md", "ÉLAN")).toBe(true);
  });

  test("a word only has to be a substring", () => {
    expect(matchWords("apps/shop/src/cart.ts", "art")).toBe(true);
    expect(matchWords("apps/shop/src/cart.ts", "carts")).toBe(false);
  });

  test("an empty or blank query matches everything", () => {
    expect(matchWords("cart.ts", "")).toBe(true);
    expect(matchWords("cart.ts", "   ")).toBe(true);
    expect(matchWords("cart.ts", "\t\n ")).toBe(true);
    expect(matchWords("", "")).toBe(true);
  });

  test("any run of whitespace separates words", () => {
    expect(matchWords("apps/shop/src/cart.ts", "  shop \t\n  cart  ")).toBe(true);
    expect(matchWords("apps/shop/src/cart.ts", "shop\u00a0cart")).toBe(true);
  });

  test("words are plain text, never patterns", () => {
    expect(matchWords("cart.ts", "c.rt")).toBe(false);
    expect(matchWords("cart.ts", ".ts")).toBe(true);
    expect(matchWords("src/[id].ts", "[id]")).toBe(true);
    expect(matchWords("a+b", "a+b")).toBe(true);
    expect(matchWords("ab", "(")).toBe(false);
  });
});

describe("visibleRows", () => {
  const tree = buildTree(CHANGE);

  test("with nothing open only the top rows are listed", () => {
    expect(listed(visibleRows(tree, new Set()))).toEqual([
      ["apps/shop", false, 6],
      ["docs/guide", false, 2],
      ["packages/pricing/src", false, 4],
      ["README.md", false, 1],
    ]);
  });

  test("an open directory lists its children; shut ones stay shut", () => {
    expect(listed(visibleRows(tree, new Set(["apps/shop"])))).toEqual([
      ["apps/shop", true, 6],
      ["apps/shop/src", false, 3],
      ["apps/shop/tests", false, 2],
      ["apps/shop/package.json", false, 1],
      ["docs/guide", false, 2],
      ["packages/pricing/src", false, 4],
      ["README.md", false, 1],
    ]);
  });

  test("an open flag below a shut directory has no effect", () => {
    const none = listed(visibleRows(tree, new Set()));
    expect(listed(visibleRows(tree, new Set(["packages/pricing/src/rules/volume"])))).toEqual(none);
    expect(
      listed(
        visibleRows(tree, new Set(["packages/pricing/src", "packages/pricing/src/rules/volume"])),
      ),
    ).toEqual([
      ["apps/shop", false, 6],
      ["docs/guide", false, 2],
      ["packages/pricing/src", true, 4],
      ["packages/pricing/src/rules", false, 3],
      ["packages/pricing/src/index.ts", false, 1],
      ["README.md", false, 1],
    ]);
  });

  test("with every directory open the whole tree is listed, depth first", () => {
    const rows = visibleRows(tree, new Set(allDirIds(tree)));
    expect(rows.map((r) => r.node.id)).toEqual([
      "apps/shop",
      "apps/shop/src",
      "apps/shop/src/cart.test.ts",
      "apps/shop/src/cart.ts",
      "apps/shop/src/checkout.ts",
      "apps/shop/tests",
      "apps/shop/tests/cart.spec.ts",
      "apps/shop/tests/helpers.ts",
      "apps/shop/package.json",
      "docs/guide",
      "docs/guide/advanced.md",
      "docs/guide/start.md",
      "packages/pricing/src",
      "packages/pricing/src/rules",
      "packages/pricing/src/rules/rounding",
      "packages/pricing/src/rules/rounding/half-even.ts",
      "packages/pricing/src/rules/volume",
      "packages/pricing/src/rules/volume/tiers.test.ts",
      "packages/pricing/src/rules/volume/tiers.ts",
      "packages/pricing/src/index.ts",
      "README.md",
    ]);
    for (const row of rows) {
      if (row.node.kind === "dir") {
        expect([row.open, row.shown]).toEqual([true, row.node.files]);
      } else {
        expect([row.open, row.shown]).toEqual([false, 1]);
      }
    }
  });

  test("a filter lists the matches with their ancestors, open whatever the open set says", () => {
    expect(listed(visibleRows(tree, new Set(), (fi) => fi === 8))).toEqual([
      ["packages/pricing/src", true, 1],
      ["packages/pricing/src/rules", true, 1],
      ["packages/pricing/src/rules/volume", true, 1],
      ["packages/pricing/src/rules/volume/tiers.test.ts", false, 1],
    ]);
  });

  test("a filter counts the kept files under each directory", () => {
    const keep = (fi: number): boolean => fi >= 7 && fi <= 9;
    const expected = [
      ["packages/pricing/src", true, 3],
      ["packages/pricing/src/rules", true, 3],
      ["packages/pricing/src/rules/rounding", true, 1],
      ["packages/pricing/src/rules/rounding/half-even.ts", false, 1],
      ["packages/pricing/src/rules/volume", true, 2],
      ["packages/pricing/src/rules/volume/tiers.test.ts", false, 1],
      ["packages/pricing/src/rules/volume/tiers.ts", false, 1],
    ];
    expect(listed(visibleRows(tree, new Set(), keep))).toEqual(expected);
    expect(listed(visibleRows(tree, new Set(allDirIds(tree)), keep))).toEqual(expected);
  });

  test("a filter across branches keeps each branch's own count and drops the rest", () => {
    const keep = (fi: number): boolean => fi === 0 || fi === 9 || fi === 12;
    expect(listed(visibleRows(tree, new Set(), keep))).toEqual([
      ["apps/shop", true, 1],
      ["apps/shop/src", true, 1],
      ["apps/shop/src/cart.ts", false, 1],
      ["packages/pricing/src", true, 1],
      ["packages/pricing/src/rules", true, 1],
      ["packages/pricing/src/rules/rounding", true, 1],
      ["packages/pricing/src/rules/rounding/half-even.ts", false, 1],
      ["README.md", false, 1],
    ]);
  });

  test("a filter that keeps nothing lists nothing; one that keeps everything lists everything", () => {
    const everyDir = new Set(allDirIds(tree));
    expect(visibleRows(tree, everyDir, () => false)).toEqual([]);
    expect(visibleRows(tree, new Set(), () => false)).toEqual([]);
    expect(visibleRows(tree, new Set(), () => true)).toEqual(visibleRows(tree, everyDir));
  });

  test("a filter asks about every file by its index, and only about files", () => {
    const asked: number[] = [];
    visibleRows(tree, new Set(), (fi) => {
      asked.push(fi);
      return false;
    });
    expect([...new Set(asked)].sort(ascending)).toEqual(CHANGE.map((_, i) => i));
  });
});

// Generated changes: a few repeating names so directories share prefixes and chains form,
// merge and break in every shape. Each check lists its offenders and expects none, with the
// seed beside the list so a failure can be replayed.

const SEGMENTS = ["src", "Src", "lib", "v1.2", "é", "docs", "tests", "a", "B", "x.y"];
const LEAVES = ["index.ts", "Index.ts", "a.md", "B.md", "é.ts", "notes.txt", "z.json"];
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

/** One to thirty files, up to four directories deep, with no path repeated. */
function generated(seed: number): TreeInput[] {
  const next = mulberry32(seed);
  const pick = (items: readonly string[]): string => items[Math.floor(next() * items.length)];
  const paths = new Set<string>();
  const count = 1 + Math.floor(next() * 30);
  for (let i = 0; i < count; i++) {
    const dirs = Array.from({ length: Math.floor(next() * 5) }, () => pick(SEGMENTS));
    paths.add([...dirs, pick(LEAVES)].join("/"));
  }
  return [...paths].map((path) =>
    input(path, Math.floor(next() * 50), Math.floor(next() * 20), "M", next() < 0.3),
  );
}

describe("generated changes", () => {
  test("every file is one row with its own numbers, at the depth of its row ancestors", () => {
    for (const seed of SEEDS) {
      const files = generated(seed);
      const tree = buildTree(files);
      const dirs = dirsIn(tree);
      const nodes = filesIn(tree);
      const offenders = nodes
        .filter((n) => {
          const f = files[n.fi];
          const rowsAbove = dirs.filter((d) => n.id.startsWith(`${d.id}/`)).length;
          return (
            f.path !== n.id ||
            n.name !== f.path.split("/").at(-1) ||
            n.status !== f.status ||
            n.add !== f.add ||
            n.del !== f.del ||
            n.quiet !== (f.quiet === true) ||
            n.depth !== rowsAbove
          );
        })
        .map((n) => n.id);
      expect({ seed, offenders }).toEqual({ seed, offenders: [] });
      expect({ seed, indices: nodes.map((n) => n.fi).sort(ascending) }).toEqual({
        seed,
        indices: files.map((_, i) => i),
      });
    }
  });

  test("directory rows: depth by row ancestors, chains merged, label ends the id", () => {
    for (const seed of SEEDS) {
      const dirs = dirsIn(buildTree(generated(seed)));
      const wrongDepth = dirs
        .filter(
          (d) =>
            d.depth !== dirs.filter((a) => a.id !== d.id && d.id.startsWith(`${a.id}/`)).length,
        )
        .map((d) => d.id);
      const unmerged = dirs
        .filter((d) => d.children.length === 1 && d.children[0].kind === "dir")
        .map((d) => d.id);
      const badLabel = dirs
        .filter((d) => d.id !== d.label && !d.id.endsWith(`/${d.label}`))
        .map((d) => d.id);
      const repeated = dirs.map((d) => d.id).filter((id, i, all) => all.indexOf(id) !== i);
      expect({ seed, wrongDepth, unmerged, badLabel, repeated }).toEqual({
        seed,
        wrongDepth: [],
        unmerged: [],
        badLabel: [],
        repeated: [],
      });
    }
  });

  test("rollups equal the sums over the files below, found by path", () => {
    for (const seed of SEEDS) {
      const files = generated(seed);
      const tree = buildTree(files);
      const offenders = dirsIn(tree)
        .filter((d) => {
          const below = files.filter((f) => f.path.startsWith(`${d.id}/`));
          return (
            d.files !== below.length ||
            d.add !== below.reduce((s, f) => s + f.add, 0) ||
            d.del !== below.reduce((s, f) => s + f.del, 0) ||
            d.quiet !== (below.length > 0 && below.every((f) => f.quiet === true))
          );
        })
        .map((d) => d.id);
      expect({ seed, offenders }).toEqual({ seed, offenders: [] });

      const totals = [
        tree.reduce((s, n) => s + (n.kind === "dir" ? n.files : 1), 0),
        tree.reduce((s, n) => s + n.add, 0),
        tree.reduce((s, n) => s + n.del, 0),
      ];
      expect({ seed, totals }).toEqual({
        seed,
        totals: [
          files.length,
          files.reduce((s, f) => s + f.add, 0),
          files.reduce((s, f) => s + f.del, 0),
        ],
      });
    }
  });

  test("every list of children has directories first, then files, each strictly in name order", () => {
    const increasing = (names: string[]): boolean =>
      names.every((name, i) => i === 0 || compareNames(names[i - 1], name) < 0);
    for (const seed of SEEDS) {
      const tree = buildTree(generated(seed));
      const lists = [tree, ...dirsIn(tree).map((d) => d.children)];
      const offenders = lists
        .filter((list) => {
          const firstFile = list.findIndex((n) => n.kind === "file");
          const dirAfterFile =
            firstFile >= 0 && list.slice(firstFile).some((n) => n.kind === "dir");
          const dirNames = list.flatMap((n) => (n.kind === "dir" ? [n.label] : []));
          const fileNames = list.flatMap((n) => (n.kind === "file" ? [n.name] : []));
          return dirAfterFile || !increasing(dirNames) || !increasing(fileNames);
        })
        .map((list) => list.map((n) => n.id));
      expect({ seed, offenders }).toEqual({ seed, offenders: [] });
    }
  });

  test("input order changes only fi", () => {
    for (const seed of SEEDS) {
      const files = generated(seed);
      const mixed = shuffled(files, seed + 1000);
      const tree = buildTree(mixed);
      expect({ seed, shape: sansFi(tree) }).toEqual({ seed, shape: sansFi(buildTree(files)) });
      const offenders = filesIn(tree)
        .filter((n) => mixed[n.fi].path !== n.id)
        .map((n) => n.id);
      expect({ seed, offenders }).toEqual({ seed, offenders: [] });
    }
  });

  test("rows: all open lists the tree, none open the top rows, a filter its matches and their ancestors", () => {
    const keep = (fi: number): boolean => fi % 3 === 0;
    for (const seed of SEEDS) {
      const files = generated(seed);
      const tree = buildTree(files);
      const dirs = dirsIn(tree);

      const all = visibleRows(tree, new Set(dirs.map((d) => d.id)));
      expect({ seed, count: all.length }).toEqual({ seed, count: dirs.length + files.length });
      expect({ seed, ids: all.map((r) => r.node.id) }).toEqual({ seed, ids: idsIn(tree) });
      expect({
        seed,
        order: all.flatMap((r) => (r.node.kind === "file" ? [r.node.fi] : [])),
      }).toEqual({
        seed,
        order: fileOrder(tree),
      });

      expect({ seed, top: visibleRows(tree, new Set()).map((r) => r.node.id) }).toEqual({
        seed,
        top: tree.map((n) => n.id),
      });

      const keptBelow = (d: TreeDir): number =>
        files.filter((f, i) => keep(i) && f.path.startsWith(`${d.id}/`)).length;
      const rows = visibleRows(tree, new Set(), keep);
      expect({
        seed,
        dirs: rows.flatMap((r) => (r.node.kind === "dir" ? [[r.node.id, r.open, r.shown]] : [])),
      }).toEqual({
        seed,
        dirs: dirs.filter((d) => keptBelow(d) > 0).map((d) => [d.id, true, keptBelow(d)]),
      });
      expect({
        seed,
        kept: rows.flatMap((r) => (r.node.kind === "file" ? [r.node.fi] : [])),
      }).toEqual({
        seed,
        kept: fileOrder(tree).filter(keep),
      });
    }
  });
});

describe("purity", () => {
  test("the same input gives the same output, call after call", () => {
    const first = buildTree(CHANGE);
    const second = buildTree(CHANGE.map((f) => ({ ...f })));
    expect(second).toEqual(first);

    const open = new Set(["apps/shop", "docs/guide"]);
    const runs: ((t: TreeNode[]) => unknown)[] = [
      (t) => fileOrder(t),
      (t) => allDirIds(t),
      (t) => defaultOpen(t, 3),
      (t) => visibleRows(t, open),
      (t) => visibleRows(t, open, (fi) => fi % 2 === 0),
    ];
    for (const run of runs) {
      expect(run(second)).toEqual(run(first));
      expect(run(first)).toEqual(run(first));
    }
    expect(matchWords("apps/shop", "shop apps")).toBe(matchWords("apps/shop", "shop apps"));
    expect(compareNames("Zeta", "alpha")).toBe(compareNames("Zeta", "alpha"));
  });

  test("a returned list is the caller's own: changing it leaves later calls alone", () => {
    const tree = buildTree(CHANGE);
    const open = new Set(allDirIds(tree));
    const ids = allDirIds(tree);
    ids.push("extra");
    expect(allDirIds(tree)).toEqual(ALL_DIR_IDS);

    const order = fileOrder(tree);
    order.reverse();
    expect(fileOrder(tree)).toEqual([1, 0, 2, 3, 4, 5, 11, 10, 9, 8, 7, 6, 12]);

    const rows = visibleRows(tree, open);
    const count = rows.length;
    rows.pop();
    expect(visibleRows(tree, open)).toHaveLength(count);

    const defaults = defaultOpen(tree);
    defaults.length = 0;
    expect(defaultOpen(tree)).toHaveLength(5);
  });

  test("no function changes what it is given: frozen input goes through untouched", () => {
    const files = deepFreeze(CHANGE.map((f) => ({ ...f })));
    const tree = deepFreeze(buildTree(files));
    const open = new Set(allDirIds(tree));
    const openBefore = [...open];

    expect(fileOrder(tree)).toEqual([1, 0, 2, 3, 4, 5, 11, 10, 9, 8, 7, 6, 12]);
    expect(allDirIds(tree)).toEqual(ALL_DIR_IDS);
    expect(defaultOpen(tree, 3)).toHaveLength(7);
    expect(visibleRows(tree, open)).toHaveLength(21);
    expect(visibleRows(tree, open, (fi) => fi < 6).map((r) => r.node.id)).toEqual([
      "apps/shop",
      "apps/shop/src",
      "apps/shop/src/cart.test.ts",
      "apps/shop/src/cart.ts",
      "apps/shop/src/checkout.ts",
      "apps/shop/tests",
      "apps/shop/tests/cart.spec.ts",
      "apps/shop/tests/helpers.ts",
      "apps/shop/package.json",
    ]);
    expect(matchWords("apps/shop", "shop")).toBe(true);

    expect([...open]).toEqual(openBefore);
    expect(tree).toEqual(buildTree(CHANGE));
    expect(files).toEqual(CHANGE);
  });
});

describe("inline safety", () => {
  // The review page inlines this file with its exports stripped, so the file has to stand alone.
  const text = readFileSync(join(import.meta.dir, "review-tree.ts"), "utf8");
  const code = text.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\/\/.*$/gmu, "");

  test("no import, default export, export list or locale-aware compare", () => {
    expect(text.split("\n").filter((line) => line.startsWith("import "))).toEqual([]);
    expect(text).not.toContain("export default");
    expect(text).not.toContain("export {");
    expect(text).not.toContain("localeCompare");
  });

  test("no dynamic import, platform global, clock, chance, locale call, class or enum", () => {
    for (const banned of [
      /\bimport\s*\(/u,
      /\brequire\s*\(/u,
      /\bexport\s+\*/u,
      /\b(?:Bun|process|document|window|globalThis|navigator|console)\b/u,
      /\bDate\b/u,
      /\bMath\.random\b/u,
      /\bIntl\b/u,
      /\btoLocale\w*/u,
      /^\s*(?:export\s+)?(?:abstract\s+)?(?:class|enum|namespace)\s/mu,
    ]) {
      expect(banned.test(code)).toBe(false);
    }
  });

  test("the top level holds only declarations", () => {
    const stray = code
      .split("\n")
      .filter((line) => /^\S/u.test(line))
      .filter((line) => !/^(?:export |function |const |interface |type |[}\])])/u.test(line));
    expect(stray).toEqual([]);
  });

  test("the file runs on its own once the exports are stripped and it is transpiled", () => {
    const js = new Bun.Transpiler({ loader: "ts" }).transformSync(text.replace(/^export /gmu, ""));
    const alone = new Function(
      `${js}\nreturn { buildTree, fileOrder, allDirIds, visibleRows };`,
    )() as {
      buildTree: typeof buildTree;
      fileOrder: typeof fileOrder;
      allDirIds: typeof allDirIds;
      visibleRows: typeof visibleRows;
    };
    const tree = alone.buildTree(CHANGE);
    expect(tree).toEqual(buildTree(CHANGE));
    expect(alone.fileOrder(tree)).toEqual(fileOrder(tree));
    const open = new Set(alone.allDirIds(tree));
    expect(alone.visibleRows(tree, open)).toEqual(visibleRows(tree, open));
  });
});
