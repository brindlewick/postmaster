// Tests beside scripts/lib/review-layout.ts: reading and merging a layout config, placing the
// files of a change in groups, describing each file in one line, and finding the lines a ruling
// points at. Every path, name and number is invented. The one edge is the default layout file,
// read from disk in the last block.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  areaOf,
  arrange,
  type ChangedFile,
  defaultPurpose,
  EMPTY_LAYOUT,
  globToRegExp,
  type LayoutConfig,
  type LayoutGroup,
  mergeLayout,
  type PlacedFile,
  parseLayoutPartial,
  type ReviewGroup,
  type RulingLinkSpec,
  type RulingSpec,
  resolveRulings,
} from "./review-layout.ts";

// ---------- helpers ----------

function file(path: string, extra: Partial<ChangedFile> = {}): ChangedFile {
  return { path, old: null, status: "M", add: 1, del: 0, binary: false, ...extra };
}

function group(id: string, extra: Partial<LayoutGroup> = {}): LayoutGroup {
  return { id, num: "", title: id, sub: "", collapsed: false, ...extra };
}

function layoutWith(over: Partial<LayoutConfig>): LayoutConfig {
  return { ...EMPTY_LAYOUT, ...over };
}

function placedAt(files: readonly PlacedFile[], path: string): PlacedFile {
  const found = files.find((f) => f.path === path);
  if (!found) throw new Error(`no placed file for ${path}`);
  return found;
}

function titleOf(result: { groups: ReviewGroup[]; files: PlacedFile[] }, path: string): string {
  return result.groups[placedAt(result.files, path).group]?.title ?? "(no group)";
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** A deep copy of plain data, not frozen. */
function copyOf<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** A copy in which a property holding undefined shows up as text, as toEqual skips such a property. */
function exact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(exact);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [key, v === undefined ? "<undefined>" : exact(v)]),
  );
}

/** `expect` for a value that must not carry a property set to undefined. */
function strictly(actual: unknown): { toEqual(expected: unknown): void } {
  return expect(exact(actual));
}

/** A fixed shuffle: the same seed gives the same order, so a failure can be repeated. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = seed;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (state * 48_271) % 2_147_483_647;
    const j = state % (i + 1);
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

const DEFAULT_LAYOUT_FILE = join(
  import.meta.dir,
  "..",
  "..",
  "skills",
  "review-pages",
  "page",
  "layout.default.json",
);

function defaultLayoutJson(): unknown {
  return JSON.parse(readFileSync(DEFAULT_LAYOUT_FILE, "utf8"));
}

// ---------- reading a config ----------

describe("parseLayoutPartial", () => {
  test("a complete config comes back whole, with defaults for what a group leaves out", () => {
    const raw = {
      areaRoots: ["apps"],
      groups: [
        { id: "src", title: "Source" },
        {
          id: "docs",
          title: "Docs",
          num: "2",
          sub: "words",
          note: "Note.",
          collapsed: true,
          by: "area",
          priority: 3,
          order: ["a.md"],
          match: ["\\.md$", "^docs/"],
        },
        { id: "bare", title: "Bare", match: [] },
      ],
      withheld: [{ match: "\\.env", text: "Hidden." }],
      first: ["a.ts"],
      purposes: { "a.ts": "Does a." },
      rulings: [
        {
          n: 1,
          state: "open",
          title: "Q",
          links: [{ path: "a.ts", match: "x", to_match: "y", span: 2, label: "L" }],
        },
      ],
    };
    strictly(parseLayoutPartial(raw)).toEqual({
      over: {
        areaRoots: ["apps"],
        groups: [
          { id: "src", num: "", title: "Source", sub: "", collapsed: false },
          {
            id: "docs",
            num: "2",
            title: "Docs",
            sub: "words",
            note: "Note.",
            collapsed: true,
            by: "area",
            priority: 3,
            order: ["a.md"],
            match: ["\\.md$", "^docs/"],
          },
          { id: "bare", num: "", title: "Bare", sub: "", collapsed: false, match: [] },
        ],
        withheld: [{ match: "\\.env", text: "Hidden." }],
        first: ["a.ts"],
        purposes: { "a.ts": "Does a." },
        rulings: [
          {
            n: 1,
            state: "open",
            title: "Q",
            links: [{ path: "a.ts", match: "x", to_match: "y", span: 2, label: "L" }],
          },
        ],
      },
      problems: [],
    });
  });

  test("an empty object gives nothing and no problems", () => {
    strictly(parseLayoutPartial({})).toEqual({ over: {}, problems: [] });
  });

  test("anything but an object gives one problem and nothing else", () => {
    const cases: [unknown, string][] = [
      [null, "null"],
      [undefined, "nothing"],
      [[], "a list"],
      ["text", "text"],
      [5, "a number"],
      [true, "true or false"],
    ];
    for (const [input, kind] of cases) {
      strictly(parseLayoutPartial(input)).toEqual({
        over: {},
        problems: [`layout: expected an object, got ${kind}`],
      });
    }
  });

  test("an unknown top-level key is reported and the rest is kept", () => {
    strictly(parseLayoutPartial({ colour: 1, first: ["a.ts"] })).toEqual({
      over: { first: ["a.ts"] },
      problems: ["colour: unknown key, ignored"],
    });
  });

  test("a key of the wrong type is reported and left out", () => {
    const cases: [string, unknown, string][] = [
      ["areaRoots", "apps", "areaRoots: expected a list of text, ignored"],
      ["first", {}, "first: expected a list of text, ignored"],
      ["groups", {}, "groups: expected a list, ignored"],
      ["withheld", 3, "withheld: expected a list, ignored"],
      ["rulings", "x", "rulings: expected a list, ignored"],
      ["purposes", [], "purposes: expected an object, ignored"],
    ];
    for (const [key, value, problem] of cases) {
      strictly(parseLayoutPartial({ [key]: value })).toEqual({ over: {}, problems: [problem] });
    }
  });

  test("a bad item in a list of text is dropped and the rest is kept", () => {
    expect(parseLayoutPartial({ areaRoots: ["apps", 4, "libs"], first: [null, "a.ts"] })).toEqual({
      over: { areaRoots: ["apps", "libs"], first: ["a.ts"] },
      problems: ["areaRoots[1]: expected text, dropped", "first[0]: expected text, dropped"],
    });
  });

  test("a non-empty list with nothing usable counts as not given, an empty list is kept", () => {
    strictly(parseLayoutPartial({ areaRoots: [1, 2] })).toEqual({
      over: {},
      problems: [
        "areaRoots[0]: expected text, dropped",
        "areaRoots[1]: expected text, dropped",
        "areaRoots: no usable item left, ignored",
      ],
    });
    strictly(parseLayoutPartial({ groups: [], areaRoots: [] })).toEqual({
      over: { groups: [], areaRoots: [] },
      problems: [],
    });
  });

  test("purposes keep only text values, and a key called __proto__ stays an ordinary key", () => {
    const r = parseLayoutPartial(
      JSON.parse('{"purposes": {"a.ts": "Does a.", "b.ts": 4, "__proto__": "Odd name."}}'),
    );
    expect(r.problems).toEqual(['purposes["b.ts"]: expected text, dropped']);
    const purposes = r.over.purposes ?? {};
    expect(Object.keys(purposes)).toEqual(["a.ts", "__proto__"]);
    expect(Object.getPrototypeOf(purposes)).toBe(Object.prototype);
    expect(Object.hasOwn(purposes, "__proto__")).toBe(true);
  });

  test("a group without an id or a title is dropped, the others are kept", () => {
    const r = parseLayoutPartial({
      groups: [
        { title: "No id" },
        { id: "ok", title: "Ok" },
        { id: "no-title" },
        { id: 5, title: "Number id" },
        { id: " ", title: "Blank id" },
        {},
        7,
        null,
      ],
    });
    expect(r.over.groups).toEqual([{ id: "ok", num: "", title: "Ok", sub: "", collapsed: false }]);
    expect(r.problems).toEqual([
      "groups[0]: missing id, dropped",
      "groups[2]: missing title, dropped",
      "groups[3]: id has the wrong type, dropped",
      "groups[4]: missing id, dropped",
      "groups[5]: missing id, missing title, dropped",
      "groups[6]: expected an object, dropped",
      "groups[7]: expected an object, dropped",
    ]);
  });

  test("a duplicate group id keeps the first group and reports the later one", () => {
    const r = parseLayoutPartial({
      groups: [
        { id: "a", title: "One" },
        { id: "b", title: "B" },
        { id: "a", title: "Two" },
      ],
    });
    expect(r.over.groups?.map((g) => g.title)).toEqual(["One", "B"]);
    expect(r.problems).toEqual(['groups: duplicate id "a", the later group is dropped']);
  });

  test("an invalid pattern in match is dropped, the group and its other patterns stay", () => {
    const r = parseLayoutPartial({
      groups: [{ id: "a", title: "A", match: ["(", "\\.ts$", "\\-"] }],
    });
    expect(r.over.groups?.[0]?.match).toEqual(["\\.ts$"]);
    expect(r.problems).toEqual([
      'groups[0].match[0]: invalid pattern "(", dropped',
      'groups[0].match[2]: invalid pattern "\\\\-", dropped',
    ]);
  });

  test("a group with no usable pattern is dropped, so it cannot become the catch-all", () => {
    const r = parseLayoutPartial({
      groups: [
        { id: "a", title: "A", match: ["("] },
        { id: "b", title: "B", match: "\\.ts$" },
        { id: "c", title: "C" },
      ],
    });
    expect(r.over.groups?.map((g) => g.id)).toEqual(["c"]);
    expect(r.problems).toEqual([
      'groups[0].match[0]: invalid pattern "(", dropped',
      "groups[0]: no usable pattern in match, dropped",
      "groups[1].match: expected a list of text, ignored",
      "groups[1]: no usable pattern in match, dropped",
    ]);
  });

  test("optional group fields of the wrong type are ignored, the group stays", () => {
    const r = parseLayoutPartial({
      groups: [
        {
          id: "a",
          title: "A",
          num: 2,
          sub: [],
          note: 1,
          collapsed: "yes",
          by: "row",
          priority: "high",
          order: "a.ts",
        },
      ],
    });
    strictly(r.over.groups).toEqual([{ id: "a", num: "", title: "A", sub: "", collapsed: false }]);
    expect(r.problems).toEqual([
      "groups[0].num: expected text, ignored",
      "groups[0].sub: expected text, ignored",
      "groups[0].note: expected text, ignored",
      "groups[0].collapsed: expected true or false, ignored",
      'groups[0].by: expected "area", ignored',
      "groups[0].priority: expected a number, ignored",
      "groups[0].order: expected a list of text, ignored",
    ]);
  });

  test("a number that is not finite is not a number", () => {
    const r = parseLayoutPartial({
      groups: [{ id: "a", title: "A", priority: Number.POSITIVE_INFINITY }],
      rulings: [{ n: Number.NaN, state: "open", title: "Q" }],
    });
    strictly(r.over.groups).toEqual([{ id: "a", num: "", title: "A", sub: "", collapsed: false }]);
    expect(r.problems).toEqual([
      "groups[0].priority: expected a number, ignored",
      "rulings[0]: n has the wrong type, dropped",
      "rulings: no usable item left, ignored",
    ]);
  });

  test("a withheld rule needs a valid pattern and a text", () => {
    const r = parseLayoutPartial({
      withheld: [
        { match: "\\.env", text: "Hidden." },
        { match: "(", text: "x" },
        { match: "a" },
        { text: "y" },
        "z",
      ],
    });
    expect(r.over.withheld).toEqual([{ match: "\\.env", text: "Hidden." }]);
    expect(r.problems).toEqual([
      'withheld[1]: invalid pattern "(", dropped',
      "withheld[2]: missing text, dropped",
      "withheld[3]: missing match, dropped",
      "withheld[4]: expected an object, dropped",
    ]);
  });

  test("withheld rules that are all unusable leave the base rules in force", () => {
    const base = layoutWith({ withheld: [{ match: "\\.env", text: "Hidden." }] });
    const bad = parseLayoutPartial({ withheld: [{ match: "(", text: "x" }] });
    strictly(bad.over).toEqual({});
    expect(bad.problems).toEqual([
      'withheld[0]: invalid pattern "(", dropped',
      "withheld: no usable item left, ignored",
    ]);
    expect(mergeLayout(base, bad.over).withheld).toEqual(base.withheld);
    const none = parseLayoutPartial({ withheld: [] });
    strictly(none).toEqual({ over: { withheld: [] }, problems: [] });
    expect(mergeLayout(base, none.over).withheld).toEqual([]);
  });

  test("a ruling needs n, a state and a title, and its bad links are dropped", () => {
    const r = parseLayoutPartial({
      rulings: [
        {
          n: 1,
          state: "open",
          title: "Q1",
          links: [{ path: "a.ts", match: "m", label: "L" }, { path: "b.ts", label: "no match" }, 3],
        },
        { n: 2, state: "closed", title: "Q2", links: [] },
        { n: 3, state: "decided", title: "Q3" },
        { state: "open", title: "no n" },
        { n: 5, state: "open" },
      ],
    });
    expect(r.over.rulings).toEqual([
      { n: 1, state: "open", title: "Q1", links: [{ path: "a.ts", match: "m", label: "L" }] },
      { n: 3, state: "decided", title: "Q3", links: [] },
    ]);
    expect(r.problems).toEqual([
      "rulings[0].links[1]: missing match, dropped",
      "rulings[0].links[2]: expected an object, dropped",
      'rulings[1]: state must be "open" or "decided", dropped',
      "rulings[3]: missing n, dropped",
      "rulings[4]: missing title, dropped",
    ]);
  });

  test("a link option of the wrong type is ignored, the link and the ruling stay", () => {
    const r = parseLayoutPartial({
      rulings: [
        {
          n: 1,
          state: "open",
          title: "Q",
          links: [{ path: "a.ts", match: "m", label: "L", to_match: 5, span: -1 }],
        },
        { n: 2, state: "open", title: "Q2", links: "a.ts" },
      ],
    });
    strictly(r.over.rulings).toEqual([
      { n: 1, state: "open", title: "Q", links: [{ path: "a.ts", match: "m", label: "L" }] },
      { n: 2, state: "open", title: "Q2", links: [] },
    ]);
    expect(r.problems).toEqual([
      "rulings[0].links[0].to_match: expected text, ignored",
      "rulings[0].links[0].span: expected a whole number, 0 or more, ignored",
      "rulings[1].links: expected a list, ignored",
    ]);
  });

  test("an unknown key inside an item is reported, the item stays", () => {
    const r = parseLayoutPartial({
      groups: [{ id: "a", title: "A", matches: ["x"] }],
      withheld: [{ match: "a", text: "t", why: "x" }],
      rulings: [
        {
          n: 1,
          state: "open",
          title: "Q",
          note: "x",
          links: [{ path: "a", match: "m", label: "L", at: 1 }],
        },
      ],
    });
    expect(r.over.groups).toHaveLength(1);
    expect(r.over.withheld).toHaveLength(1);
    expect(r.over.rulings?.[0]?.links).toHaveLength(1);
    expect(r.problems).toEqual([
      "groups[0].matches: unknown key, ignored",
      "withheld[0].why: unknown key, ignored",
      "rulings[0].note: unknown key, ignored",
      "rulings[0].links[0].at: unknown key, ignored",
    ]);
  });

  test("the input is not changed and the result shares nothing with it", () => {
    const raw = deepFreeze({
      areaRoots: ["apps"],
      first: ["a.ts"],
      groups: [{ id: "a", title: "A", match: ["x"], order: ["a.ts"] }],
      purposes: { "a.ts": "Does a." },
    });
    const r = parseLayoutPartial(raw);
    expect(r.problems).toEqual([]);
    expect(r.over.areaRoots).not.toBe(raw.areaRoots);
    expect(r.over.first).not.toBe(raw.first);
    expect(r.over.groups?.[0]?.match).not.toBe(raw.groups[0]?.match);
    expect(r.over.groups?.[0]?.order).not.toBe(raw.groups[0]?.order);
    expect(r.over.purposes).not.toBe(raw.purposes);
  });
});

// ---------- merging ----------

describe("mergeLayout", () => {
  const base: LayoutConfig = {
    areaRoots: ["apps"],
    groups: [group("a")],
    withheld: [{ match: "x", text: "t" }],
    first: ["one", "two"],
    purposes: { "a.ts": "base a", "b.ts": "base b" },
    rulings: [{ n: 1, state: "open", title: "T", links: [] }],
  };

  test("groups, withheld, rulings and areaRoots given in over replace the base ones", () => {
    const merged = mergeLayout(base, {
      areaRoots: ["libs"],
      groups: [group("z")],
      withheld: [],
      rulings: [],
    });
    expect(merged.areaRoots).toEqual(["libs"]);
    expect(merged.groups).toEqual([group("z")]);
    expect(merged.withheld).toEqual([]);
    expect(merged.rulings).toEqual([]);
    expect(merged.first).toEqual(["one", "two"]);
    expect(merged.purposes).toEqual(base.purposes);
  });

  test("purposes merge with over winning per key, first is appended without duplicates", () => {
    const merged = mergeLayout(base, {
      purposes: { "b.ts": "over b", "c.ts": "over c" },
      first: ["two", "three", "three"],
    });
    expect(merged.purposes).toEqual({ "a.ts": "base a", "b.ts": "over b", "c.ts": "over c" });
    expect(merged.first).toEqual(["one", "two", "three"]);
  });

  test("keys over leaves out keep the base, in new containers", () => {
    const merged = mergeLayout(base, {});
    strictly(merged).toEqual(base);
    expect(merged).not.toBe(base);
    expect(merged.areaRoots).not.toBe(base.areaRoots);
    expect(merged.groups).not.toBe(base.groups);
    expect(merged.withheld).not.toBe(base.withheld);
    expect(merged.first).not.toBe(base.first);
    expect(merged.purposes).not.toBe(base.purposes);
    expect(merged.rulings).not.toBe(base.rulings);
  });

  test("neither argument is changed", () => {
    const frozenBase = deepFreeze(copyOf(base));
    const frozenOver = deepFreeze({
      groups: [group("z")],
      first: ["three"],
      purposes: { "c.ts": "over c" },
    });
    const merged = mergeLayout(frozenBase, frozenOver);
    expect(merged.groups).toEqual([group("z")]);
    strictly(frozenBase).toEqual(base);
    expect(frozenOver.first).toEqual(["three"]);
  });

  test("the empty layout is empty in every key and survives being merged into", () => {
    const merged = mergeLayout(EMPTY_LAYOUT, { first: ["a"], purposes: { "a.ts": "x" } });
    expect(merged.first).toEqual(["a"]);
    strictly(EMPTY_LAYOUT).toEqual({
      areaRoots: [],
      groups: [],
      withheld: [],
      first: [],
      purposes: {},
      rulings: [],
    });
  });
});

// ---------- areas ----------

describe("areaOf", () => {
  const roots = ["apps", "packages"];

  test("a top-level file has no folder", () => {
    expect(areaOf("main.ts", roots)).toBe("(top level)");
    expect(areaOf("main.ts", [])).toBe("(top level)");
  });

  test("under a root, the area is the root and the next folder", () => {
    expect(areaOf("apps/shop/src/cart.ts", roots)).toBe("apps/shop");
    expect(areaOf("packages/ui/index.ts", roots)).toBe("packages/ui");
    expect(areaOf("apps/shop/cart.ts", roots)).toBe("apps/shop");
  });

  test("a file straight under a root belongs to the root", () => {
    expect(areaOf("apps/x.ts", roots)).toBe("apps");
  });

  test("anywhere else the area is the first folder", () => {
    expect(areaOf("docs/guide.md", roots)).toBe("docs");
    expect(areaOf("tools/lint/rule.ts", roots)).toBe("tools");
    expect(areaOf("apps/shop/cart.ts", [])).toBe("apps");
  });
});

// ---------- globs ----------

describe("globToRegExp", () => {
  test("a star stays inside one folder, and the pattern is anchored at both ends", () => {
    const re = globToRegExp("*.md");
    expect(re.test("README.md")).toBe(true);
    expect(re.test("docs/guide.md")).toBe(false);
    expect(re.test("README.mdx")).toBe(false);
    expect(re.test("old-README.md")).toBe(true);
    expect(re.test("x/README.md")).toBe(false);
    expect(globToRegExp("src/*/index.ts").test("src/a/index.ts")).toBe(true);
    expect(globToRegExp("src/*/index.ts").test("src/a/b/index.ts")).toBe(false);
  });

  test("two stars run across folders", () => {
    const re = globToRegExp("apps/shop/src/**");
    expect(re.test("apps/shop/src/cart.ts")).toBe(true);
    expect(re.test("apps/shop/src/a/b/c.ts")).toBe(true);
    expect(re.test("apps/shop/src/")).toBe(true);
    expect(re.test("apps/shop/srcx/cart.ts")).toBe(false);
    expect(re.test("other/apps/shop/src/cart.ts")).toBe(false);
    expect(re.test("apps/shop/src/a\nb")).toBe(true);
  });

  test("two stars are a plain run of characters, so a leading **/ needs a slash", () => {
    const re = globToRegExp("**/*.md");
    expect(re.test("docs/a/guide.md")).toBe(true);
    expect(re.test("guide.md")).toBe(false);
  });

  test("a question mark is one character that is not a slash", () => {
    const re = globToRegExp("a?c");
    expect(re.test("abc")).toBe(true);
    expect(re.test("a/c")).toBe(false);
    expect(re.test("ac")).toBe(false);
    expect(re.test("abbc")).toBe(false);
  });

  test("everything else is literal, whatever it means in a regular expression", () => {
    expect(globToRegExp("a.b").test("axb")).toBe(false);
    expect(globToRegExp("a.b").test("a.b")).toBe(true);
    expect(globToRegExp("src/(a)+[b]^$|{c}.ts").test("src/(a)+[b]^$|{c}.ts")).toBe(true);
    expect(globToRegExp("src/(a)+[b]^$|{c}.ts").test("src/a+b.ts")).toBe(false);
    expect(globToRegExp("back\\slash").test("back\\slash")).toBe(true);
  });

  test("the regular expression uses only the u flag", () => {
    expect(globToRegExp("x").flags).toBe("u");
  });
});

// ---------- one line for a file ----------

describe("defaultPurpose", () => {
  test("lockfiles", () => {
    const names = [
      "pnpm-lock.yaml",
      "package-lock.json",
      "yarn.lock",
      "bun.lock",
      "bun.lockb",
      "Cargo.lock",
      "go.sum",
      "poetry.lock",
      "Gemfile.lock",
      "composer.lock",
      "Pipfile.lock",
    ];
    for (const name of names) {
      expect(defaultPurpose(file(name))).toBe(
        "Dependency lockfile, rewritten by the package manager.",
      );
      expect(defaultPurpose(file(`apps/shop/${name}`, { binary: true }))).toBe(
        "Dependency lockfile, rewritten by the package manager.",
      );
    }
    expect(defaultPurpose(file("lock.yaml"))).toBe("Changed file, +1 -0 lines.");
  });

  test("a package manifest is named package.json", () => {
    expect(defaultPurpose(file("package.json"))).toBe(
      "Package manifest: dependencies, scripts and settings.",
    );
    expect(defaultPurpose(file("apps/shop/package.json"))).toBe(
      "Package manifest: dependencies, scripts and settings.",
    );
    expect(defaultPurpose(file("tools/my-package.json"))).toBe("Changed file, +1 -0 lines.");
  });

  test("environment files are named by their last segment", () => {
    const text = "Environment settings (content not shown).";
    expect(defaultPurpose(file(".env"))).toBe(text);
    expect(defaultPurpose(file("apps/shop/.env.ci"))).toBe(text);
    expect(defaultPurpose(file("apps/shop/.env.local", { status: "A" }))).toBe(text);
    expect(defaultPurpose(file("apps/.env/readme.txt"))).toBe("Changed file, +1 -0 lines.");
    expect(defaultPurpose(file("apps/shop/environment.ts"))).toBe("Changed file, +1 -0 lines.");
  });

  test("generated files", () => {
    expect(defaultPurpose(file("src/api.gen.ts"))).toBe("Generated file.");
    expect(defaultPurpose(file("src/schema.generated.json"))).toBe("Generated file.");
    expect(defaultPurpose(file("src/generated.ts"))).toBe("Changed file, +1 -0 lines.");
  });

  test("tests name what they test", () => {
    expect(defaultPurpose(file("apps/shop/src/cart.test.ts"))).toBe("Tests for cart.");
    expect(defaultPurpose(file("apps/shop/src/cart.spec.tsx"))).toBe("Tests for cart.");
    expect(defaultPurpose(file("lib/a.b.test.ts"))).toBe("Tests for a.b.");
    expect(defaultPurpose(file("lib/foo.test.helper.test.ts"))).toBe("Tests for foo.");
    expect(defaultPurpose(file("lib/.test.ts"))).toBe("Tests.");
  });

  test("documentation", () => {
    expect(defaultPurpose(file("README.md"))).toBe("Documentation.");
    expect(defaultPurpose(file("docs/guide.mdx"))).toBe("Documentation.");
    expect(defaultPurpose(file("docs/guide.md", { status: "D", del: 9 }))).toBe("Documentation.");
    expect(defaultPurpose(file("docs/diagram.md", { binary: true }))).toBe("Documentation.");
  });

  test("binary files", () => {
    expect(defaultPurpose(file("img/logo.png", { binary: true }))).toBe("Binary file.");
    expect(defaultPurpose(file("img/logo.png", { binary: true, status: "A" }))).toBe(
      "Binary file.",
    );
  });

  test("the first rule that matches wins", () => {
    expect(defaultPurpose(file("a.gen.test.ts"))).toBe("Generated file.");
    expect(defaultPurpose(file("notes.test.md"))).toBe("Tests for notes.");
    expect(defaultPurpose(file("x.generated.md"))).toBe("Generated file.");
    expect(defaultPurpose(file(".env.md"))).toBe("Environment settings (content not shown).");
    expect(defaultPurpose(file(".env.gen.ts"))).toBe("Environment settings (content not shown).");
    expect(defaultPurpose(file(".env.test.ts"))).toBe("Environment settings (content not shown).");
    expect(defaultPurpose(file("package.json", { status: "D", del: 4 }))).toBe(
      "Package manifest: dependencies, scripts and settings.",
    );
  });

  test("otherwise the status decides, with the counts in plain words", () => {
    expect(defaultPurpose(file("src/a.ts", { status: "D", add: 0, del: 12 }))).toBe(
      "Deleted file, 12 lines removed.",
    );
    expect(defaultPurpose(file("src/a.ts", { status: "A", add: 7 }))).toBe("New file, 7 lines.");
    expect(defaultPurpose(file("src/b.ts", { status: "R", old: "src/a.ts", add: 3, del: 2 }))).toBe(
      "Renamed from src/a.ts, +3 -2 lines.",
    );
    expect(defaultPurpose(file("src/a.ts", { add: 4, del: 5 }))).toBe("Changed file, +4 -5 lines.");
    expect(defaultPurpose(file("src/a.ts", { status: "T", add: 4, del: 5 }))).toBe(
      "Changed file, +4 -5 lines.",
    );
  });

  test("a status that git writes with a score counts as its letter", () => {
    expect(defaultPurpose(file("b.ts", { status: "R100", old: "a.ts", add: 0, del: 0 }))).toBe(
      "Renamed from a.ts, +0 -0 lines.",
    );
    expect(defaultPurpose(file("c.ts", { status: "AM", add: 2 }))).toBe("New file, 2 lines.");
  });

  test("exactly one line is singular, nothing and many are plural", () => {
    expect(defaultPurpose(file("a.ts", { status: "A", add: 1 }))).toBe("New file, 1 line.");
    expect(defaultPurpose(file("a.ts", { status: "A", add: 0 }))).toBe("New file, 0 lines.");
    expect(defaultPurpose(file("a.ts", { status: "D", add: 0, del: 1 }))).toBe(
      "Deleted file, 1 line removed.",
    );
    expect(defaultPurpose(file("a.ts", { status: "D", add: 0, del: 2 }))).toBe(
      "Deleted file, 2 lines removed.",
    );
  });

  test("a rename without an old path still reads well", () => {
    expect(defaultPurpose(file("b.ts", { status: "R", old: null, add: 1, del: 1 }))).toBe(
      "Renamed file, +1 -1 lines.",
    );
  });

  test("a line is plain ASCII of at most 110 characters, however odd the path", () => {
    const long = `${"deep/".repeat(60)}old.ts`;
    const cases: ChangedFile[] = [
      file("b.ts", { status: "R", old: long, add: 30, del: 2 }),
      file(`${"x".repeat(300)}.test.ts`),
      file("c.ts", { status: "R", old: "src/naïve-ü.ts", add: 1, del: 1 }),
      file("c.ts", { status: "R", old: "src/文件.ts", add: 1, del: 1 }),
      file("src/😀.test.ts"),
    ];
    for (const c of cases) {
      const line = defaultPurpose(c);
      expect(line.length).toBeLessThanOrEqual(110);
      expect(/^[\x20-\x7e]*$/u.test(line)).toBe(true);
    }
    const renamed = defaultPurpose(cases[0] as ChangedFile);
    expect(renamed.startsWith("Renamed from ...")).toBe(true);
    expect(renamed.endsWith("old.ts, +30 -2 lines.")).toBe(true);
    expect(defaultPurpose(cases[1] as ChangedFile).endsWith("xxx.")).toBe(true);
    expect(defaultPurpose(cases[2] as ChangedFile)).toBe(
      "Renamed from src/naive-u.ts, +1 -1 lines.",
    );
    expect(defaultPurpose(cases[3] as ChangedFile)).toBe("Renamed from src/??.ts, +1 -1 lines.");
  });
});

// ---------- placing a change ----------

describe("arrange", () => {
  test("a withheld rule sets the text for the files it matches, whatever their group", () => {
    const layout = layoutWith({
      groups: [group("env", { match: ["env"] })],
      withheld: [
        { match: "\\.env", text: "First rule." },
        { match: "env", text: "Second rule." },
      ],
    });
    const { files } = arrange(
      [file("a/.env.ci"), file("a/environment.ts"), file("a/plain.ts")],
      layout,
    );
    expect(placedAt(files, "a/.env.ci").withheld).toBe("First rule.");
    expect(placedAt(files, "a/environment.ts").withheld).toBe("Second rule.");
    expect("withheld" in placedAt(files, "a/plain.ts")).toBe(false);
  });

  test("groups are tried by priority, higher first, and config order breaks ties", () => {
    const groups = [
      group("negative", { match: ["\\.ts$"], priority: -1 }),
      group("first", { match: ["\\.ts$"] }),
      group("second", { match: ["\\.ts$"], priority: 0 }),
      group("high", { match: ["\\.ts$"], priority: 5 }),
    ];
    const idsFor = (gs: LayoutGroup[]): string[] =>
      arrange([file("a.ts")], layoutWith({ groups: gs })).groups.map((g) => g.id);
    expect(idsFor(groups)).toEqual(["high"]);
    expect(idsFor(groups.slice(0, 3))).toEqual(["first"]);
    expect(
      idsFor([groups[2] as LayoutGroup, groups[1] as LayoutGroup, groups[0] as LayoutGroup]),
    ).toEqual(["second"]);
    expect(idsFor([groups[0] as LayoutGroup])).toEqual(["negative"]);
  });

  test("the groups come out in config order whatever their priority", () => {
    const layout = layoutWith({
      groups: [
        group("docs", { match: ["\\.md$"] }),
        group("tests", { match: ["\\.test\\."], priority: 1 }),
        group("rest"),
      ],
    });
    const result = arrange([file("c.ts"), file("b.md"), file("a.test.md")], layout);
    expect(result.groups.map((g) => g.id)).toEqual(["docs", "tests", "rest"]);
    expect(titleOf(result, "a.test.md")).toBe("tests");
    expect(titleOf(result, "b.md")).toBe("docs");
    expect(titleOf(result, "c.ts")).toBe("rest");
  });

  test("a file no group matches joins the first group in config order that has no match", () => {
    const layout = layoutWith({
      groups: [group("tests", { match: ["\\.test\\."] }), group("a-rest"), group("b-rest")],
    });
    const result = arrange([file("x.test.ts"), file("plain.ts")], layout);
    expect(result.groups.map((g) => g.id)).toEqual(["tests", "a-rest"]);
    expect(titleOf(result, "plain.ts")).toBe("a-rest");
  });

  test("an empty match list counts as no match", () => {
    const layout = layoutWith({ groups: [group("a", { match: [] }), group("b")] });
    expect(titleOf(arrange([file("plain.ts")], layout), "plain.ts")).toBe("a");
  });

  test("with no fallback group, unplaced files go to an implicit last group", () => {
    const layout = layoutWith({
      groups: [
        group("docs", { match: ["\\.md$"] }),
        group("tests", { match: ["\\.test\\."], num: "4" }),
      ],
    });
    const result = arrange([file("plain.ts"), file("a.test.ts"), file("b.md")], layout);
    strictly(result.groups).toEqual([
      { id: "docs", num: "", title: "docs", sub: "", collapsed: false },
      { id: "tests", num: "4", title: "tests", sub: "", collapsed: false },
      {
        id: "other",
        num: "",
        title: "Other files",
        sub: "files the layout does not place",
        collapsed: false,
      },
    ]);
    expect(placedAt(result.files, "plain.ts").group).toBe(2);
  });

  test("an empty layout puts every file in the implicit group", () => {
    const result = arrange([file("b.ts"), file("a.ts")], EMPTY_LAYOUT);
    expect(result.groups.map((g) => g.id)).toEqual(["other"]);
    expect(result.files.map((f) => f.path)).toEqual(["a.ts", "b.ts"]);
    strictly(arrange([], EMPTY_LAYOUT)).toEqual({ groups: [], files: [] });
  });

  test("a by-area group splits into one group per area, the biggest first, then by name", () => {
    const layout = layoutWith({
      areaRoots: ["apps"],
      groups: [
        group("source", {
          num: "2",
          title: "Source",
          sub: "production code",
          note: "Read these.",
          collapsed: true,
          by: "area",
        }),
      ],
    });
    const result = arrange(
      [
        file("main.ts", { add: 1 }),
        file("tools/c.ts", { add: 5, del: 5 }),
        file("apps/shop/a.ts", { add: 4, del: 6 }),
        file("apps/blog/c.ts", { add: 10 }),
        file("apps/blog/b.ts", { add: 50 }),
      ],
      layout,
    );
    const area = (id: string, title: string): ReviewGroup => ({
      id,
      num: "2",
      title,
      sub: "production code",
      note: "Read these.",
      collapsed: true,
    });
    strictly(result.groups).toEqual([
      area("source:apps/blog", "apps/blog"),
      area("source:apps/shop", "apps/shop"),
      area("source:tools", "tools"),
      area("source:(top level)", "(top level)"),
    ]);
    expect(result.files.map((f) => [f.path, f.group])).toEqual([
      ["apps/blog/b.ts", 0],
      ["apps/blog/c.ts", 0],
      ["apps/shop/a.ts", 1],
      ["tools/c.ts", 2],
      ["main.ts", 3],
    ]);
  });

  test("groups with no files are left out, and each file points at its returned group", () => {
    const layout = layoutWith({
      groups: [group("a", { match: ["\\.a$"] }), group("b", { match: ["\\.b$"] }), group("c")],
    });
    const result = arrange([file("y.c"), file("x.b")], layout);
    expect(result.groups.map((g) => g.id)).toEqual(["b", "c"]);
    expect(result.files.map((f) => [f.path, f.group])).toEqual([
      ["x.b", 0],
      ["y.c", 1],
    ]);
  });

  test("in a group, listed paths come first, then the most changed lines, then the name", () => {
    const layout = layoutWith({
      groups: [group("all", { order: ["z.ts", "m.ts", "absent.ts", "z.ts"] })],
    });
    const { files } = arrange(
      [
        file("c.ts", { add: 50 }),
        file("a.ts", { add: 100 }),
        file("b.ts", { add: 20, del: 30 }),
        file("m.ts", { add: 1 }),
        file("z.ts", { add: 1 }),
      ],
      layout,
    );
    expect(files.map((f) => f.path)).toEqual(["z.ts", "m.ts", "a.ts", "b.ts", "c.ts"]);
  });

  test("a by-area group applies its order inside each area", () => {
    const layout = layoutWith({
      areaRoots: ["apps"],
      groups: [group("src", { by: "area", order: ["apps/shop/z.ts"] })],
    });
    const result = arrange(
      [
        file("apps/shop/a.ts", { add: 10 }),
        file("apps/shop/z.ts", { add: 1 }),
        file("apps/blog/q.ts", { add: 100 }),
      ],
      layout,
    );
    expect(result.groups.map((g) => g.title)).toEqual(["apps/blog", "apps/shop"]);
    expect(result.files.map((f) => f.path)).toEqual([
      "apps/blog/q.ts",
      "apps/shop/z.ts",
      "apps/shop/a.ts",
    ]);
  });

  test("names are compared without regard to case", () => {
    const { files } = arrange([file("c.ts"), file("B.ts"), file("a.ts")], EMPTY_LAYOUT);
    expect(files.map((f) => f.path)).toEqual(["a.ts", "B.ts", "c.ts"]);
  });

  test("first marks exact paths and globs", () => {
    const layout = layoutWith({ first: ["apps/shop/src/**", "*.md", "exact/file.ts"] });
    const { files } = arrange(
      [
        file("apps/shop/src/cart.ts"),
        file("apps/shop/src/deep/er/x.ts"),
        file("apps/shop/lib/x.ts"),
        file("README.md"),
        file("docs/guide.md"),
        file("exact/file.ts"),
        file("exact/file.tsx"),
      ],
      layout,
    );
    expect(Object.fromEntries(files.map((f) => [f.path, f.first]))).toEqual({
      "apps/shop/src/cart.ts": true,
      "apps/shop/src/deep/er/x.ts": true,
      "apps/shop/lib/x.ts": false,
      "README.md": true,
      "docs/guide.md": false,
      "exact/file.ts": true,
      "exact/file.tsx": false,
    });
  });

  test("an entry without a star is compared as it is, not read as a pattern", () => {
    const layout = layoutWith({ first: ["src/a.b", "src/(c)", "src/?.ts"] });
    const { files } = arrange(
      [
        file("src/a.b"),
        file("src/axb"),
        file("src/(c)"),
        file("src/c"),
        file("src/?.ts"),
        file("src/x.ts"),
      ],
      layout,
    );
    expect(Object.fromEntries(files.map((f) => [f.path, f.first]))).toEqual({
      "src/a.b": true,
      "src/axb": false,
      "src/(c)": true,
      "src/c": false,
      "src/?.ts": true,
      "src/x.ts": false,
    });
  });

  test("a purpose in the layout beats the heuristic, and the source says which was used", () => {
    const layout = layoutWith({
      purposes: { "src/a.ts": "Adds the thing.", "src/blank.ts": "  " },
    });
    const { files } = arrange(
      [
        file("src/a.ts"),
        file("src/b.ts", { status: "A", add: 3 }),
        file("src/blank.ts"),
        file("constructor"),
        file("toString"),
      ],
      layout,
    );
    const purposeOf = (path: string): [string, string] => {
      const placed = placedAt(files, path);
      return [placed.purpose, placed.purposeSource];
    };
    expect(purposeOf("src/a.ts")).toEqual(["Adds the thing.", "layout"]);
    expect(purposeOf("src/b.ts")).toEqual(["New file, 3 lines.", "heuristic"]);
    expect(purposeOf("src/blank.ts")).toEqual(["Changed file, +1 -0 lines.", "heuristic"]);
    expect(purposeOf("constructor")).toEqual(["Changed file, +1 -0 lines.", "heuristic"]);
    expect(purposeOf("toString")).toEqual(["Changed file, +1 -0 lines.", "heuristic"]);
  });

  test("a placed file keeps the change's fields and adds the page's", () => {
    const input = file("src/new.ts", { old: "src/older.ts", status: "R", add: 2, del: 1 });
    const placed = arrange([input], EMPTY_LAYOUT).files[0];
    strictly(placed).toEqual({
      path: "src/new.ts",
      old: "src/older.ts",
      status: "R",
      add: 2,
      del: 1,
      binary: false,
      group: 0,
      first: false,
      purpose: "Renamed from src/older.ts, +2 -1 lines.",
      purposeSource: "heuristic",
    });
  });

  test("a returned group carries only its display fields, and a note only when it has one", () => {
    const layout = layoutWith({
      groups: [
        group("a", { match: ["\\.a$"], priority: 3, order: ["x.a"], by: "area", note: "N." }),
        group("b"),
      ],
    });
    const result = arrange([file("x.a"), file("y.b")], layout);
    expect(result.groups.map((g) => Object.keys(g).toSorted())).toEqual([
      ["collapsed", "id", "note", "num", "sub", "title"],
      ["collapsed", "id", "num", "sub", "title"],
    ]);
  });

  const mixedLayout = layoutWith({
    areaRoots: ["apps", "libs"],
    groups: [
      group("source", { by: "area", order: ["libs/core/index.ts"] }),
      group("config", { match: ["\\.(json|md)$"], priority: 10 }),
      group("tests", { match: ["\\.test\\."], priority: 20, order: ["apps/shop/b.test.ts"] }),
    ],
    withheld: [{ match: "\\.env", text: "Hidden." }],
    first: ["libs/**", "README.md"],
    purposes: { "tools/run.ts": "Starts the tool." },
  });
  const mixedChange: ChangedFile[] = [
    file("apps/shop/a.ts", { add: 5 }),
    file("apps/shop/b.ts", { add: 5 }),
    file("apps/shop/c.ts", { add: 5 }),
    file("apps/shop/B.ts", { add: 5 }),
    file("apps/blog/post.ts", { add: 9, del: 1 }),
    file("libs/core/index.ts", { add: 2 }),
    file("libs/core/util.ts", { add: 20 }),
    file("tools/run.ts", { add: 7 }),
    file("main.ts", { add: 1 }),
    file("README.md", { add: 3 }),
    file("package.json", { add: 4, del: 4 }),
    file("apps/shop/.env.ci", { add: 1 }),
    file("apps/shop/a.test.ts", { add: 8 }),
    file("apps/shop/b.test.ts", { add: 2 }),
    file("apps/blog/post.test.ts", { add: 2 }),
  ];

  test("the result does not depend on the order the files arrive in", () => {
    const expected = arrange(mixedChange, mixedLayout);
    expect(expected.files).toHaveLength(mixedChange.length);
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      strictly(arrange(shuffled(mixedChange, seed), mixedLayout)).toEqual(expected);
    }
    strictly(arrange(mixedChange.toReversed(), mixedLayout)).toEqual(expected);
  });

  test("neither the layout nor the files are changed, and the result shares nothing with them", () => {
    const files = deepFreeze(copyOf(mixedChange));
    const layout = deepFreeze(copyOf(mixedLayout));
    const result = arrange(files, layout);
    strictly(files).toEqual(mixedChange);
    strictly(layout).toEqual(mixedLayout);
    for (const placed of result.files) {
      expect(files.includes(placed)).toBe(false);
    }
    expect(result.files.map((f) => f.path).toSorted()).toEqual(
      mixedChange.map((f) => f.path).toSorted(),
    );
  });
});

// ---------- rulings ----------

describe("resolveRulings", () => {
  const TEXTS: Readonly<Record<string, string>> = {
    "src/a.ts": "alpha\nbeta\ngamma\nbeta again\ndelta\n",
    "src/b.ts": "one\ntwo",
    "src/crlf.ts": "a\r\nb\r\nc\r\n",
  };
  const textOf = (path: string): string | undefined =>
    Object.hasOwn(TEXTS, path) ? TEXTS[path] : undefined;

  function spec(n: number, links: RulingLinkSpec[], extra: Partial<RulingSpec> = {}): RulingSpec {
    return { n, state: "open", title: `Question ${n}`, links, ...extra };
  }

  function link(match: string, extra: Partial<RulingLinkSpec> = {}): RulingLinkSpec {
    return { path: "src/a.ts", match, label: `at ${match}`, ...extra };
  }

  function resolved(l: RulingLinkSpec): { from: number; to: number } | undefined {
    const first = resolveRulings([spec(1, [l])], textOf).rulings[0]?.links[0];
    return first && { from: first.from, to: first.to };
  }

  test("a link starts at the first line that holds its text", () => {
    strictly(resolveRulings([spec(1, [link("beta")])], textOf)).toEqual({
      rulings: [
        {
          n: 1,
          state: "open",
          title: "Question 1",
          links: [{ path: "src/a.ts", from: 2, to: 2, label: "at beta" }],
        },
      ],
      problems: [],
    });
  });

  test("the text may be part of a line, and the first such line counts", () => {
    expect(resolved(link("again"))).toEqual({ from: 4, to: 4 });
    expect(resolved(link("et"))).toEqual({ from: 2, to: 2 });
    expect(resolved(link("lph"))).toEqual({ from: 1, to: 1 });
  });

  test("to_match ends the range at the first line from the start line on that holds it", () => {
    expect(resolved(link("beta", { to_match: "delta" }))).toEqual({ from: 2, to: 5 });
    expect(resolved(link("gamma", { to_match: "gamma" }))).toEqual({ from: 3, to: 3 });
    expect(resolved(link("beta", { to_match: "beta" }))).toEqual({ from: 2, to: 2 });
    expect(resolved(link("gamma", { to_match: "beta" }))).toEqual({ from: 3, to: 4 });
  });

  test("span adds lines to the start, and stops at the last line", () => {
    expect(resolved(link("alpha", { span: 2 }))).toEqual({ from: 1, to: 3 });
    expect(resolved(link("alpha", { span: 0 }))).toEqual({ from: 1, to: 1 });
    expect(resolved(link("gamma", { span: 50 }))).toEqual({ from: 3, to: 5 });
    expect(resolved(link("alpha", { to_match: "gamma", span: 1 }))).toEqual({ from: 1, to: 3 });
  });

  test("a final newline ends the last line rather than starting another", () => {
    expect(resolved(link("delta", { span: 5 }))).toEqual({ from: 5, to: 5 });
    expect(resolved(link("one", { path: "src/b.ts", span: 5 }))).toEqual({ from: 1, to: 2 });
  });

  test("windows line endings do not matter", () => {
    expect(resolved(link("b", { path: "src/crlf.ts", span: 9 }))).toEqual({ from: 2, to: 3 });
  });

  test("a file that is not in the change gives a problem and the link is dropped", () => {
    const r = resolveRulings([spec(7, [link("x", { path: "src/gone.ts" })])], textOf);
    expect(r.problems).toEqual(["ruling 7: file not in the change: src/gone.ts"]);
    strictly(r.rulings).toEqual([{ n: 7, state: "open", title: "Question 7", links: [] }]);
  });

  test("text that is not found names the ruling and the text, and the link is dropped", () => {
    const r = resolveRulings(
      [
        spec(2, [link("nope")]),
        spec(3, [link("delta", { to_match: "alpha" })]),
        spec(4, [link("alpha", { to_match: "missing end" })]),
      ],
      textOf,
    );
    expect(r.problems).toEqual([
      'ruling 2: text not found in src/a.ts: "nope"',
      'ruling 3: text not found in src/a.ts: "alpha"',
      'ruling 4: text not found in src/a.ts: "missing end"',
    ]);
    expect(r.rulings.map((x) => x.links)).toEqual([[], [], []]);
  });

  test("a dropped link leaves the ruling and its other links, in order", () => {
    const r = resolveRulings(
      [
        spec(
          3,
          [link("alpha", { label: "First" }), link("nope"), link("delta", { label: "Last" })],
          {
            state: "decided",
            title: "Which one?",
          },
        ),
        spec(1, [link("gamma")]),
      ],
      textOf,
    );
    expect(r.rulings.map((x) => x.n)).toEqual([3, 1]);
    strictly(r.rulings[0]).toEqual({
      n: 3,
      state: "decided",
      title: "Which one?",
      links: [
        { path: "src/a.ts", from: 1, to: 1, label: "First" },
        { path: "src/a.ts", from: 5, to: 5, label: "Last" },
      ],
    });
    expect(r.problems).toEqual(['ruling 3: text not found in src/a.ts: "nope"']);
  });

  test("the text of each link is asked for by that link's path", () => {
    const asked: string[] = [];
    resolveRulings(
      [
        spec(1, [link("alpha"), link("one", { path: "src/b.ts" })]),
        spec(2, [link("a", { path: "src/crlf.ts" })]),
      ],
      (path) => {
        asked.push(path);
        return textOf(path);
      },
    );
    expect(asked).toEqual(["src/a.ts", "src/b.ts", "src/crlf.ts"]);
  });

  test("no rulings give no rulings and no problems", () => {
    strictly(resolveRulings([], textOf)).toEqual({ rulings: [], problems: [] });
  });

  test("the specs are not changed", () => {
    const specs = deepFreeze([spec(1, [link("beta", { to_match: "delta" })])]);
    const r = resolveRulings(specs, textOf);
    expect(r.rulings[0]?.links[0]).toEqual({ path: "src/a.ts", from: 2, to: 5, label: "at beta" });
  });
});

// ---------- the default layout file ----------

describe("the default layout file", () => {
  const change: ChangedFile[] = [
    file("pnpm-lock.yaml", { add: 300, del: 200 }),
    file("apps/shop/src/cart.test.ts", { add: 20 }),
    file("apps/shop/src/cart.ts", { add: 30, del: 5 }),
    file("apps/blog/src/post.ts", { add: 80, del: 10 }),
    file("docs/guide.md", { add: 4 }),
    file(".github/workflows/ci.yml", { add: 3 }),
    file("README.md", { add: 2 }),
    file("apps/shop/.env.ci", { add: 1 }),
    file("tools/x.ts", { add: 6 }),
    file("main.ts", { add: 1 }),
  ];

  function loaded(): LayoutConfig {
    return mergeLayout(EMPTY_LAYOUT, parseLayoutPartial(defaultLayoutJson()).over);
  }

  test("it parses with no problems and names all six keys", () => {
    const { over, problems } = parseLayoutPartial(defaultLayoutJson());
    expect(problems).toEqual([]);
    expect(Object.keys(over).toSorted()).toEqual([
      "areaRoots",
      "first",
      "groups",
      "purposes",
      "rulings",
      "withheld",
    ]);
    expect(over.groups?.map((g) => g.id)).toEqual(["source", "config", "tests", "generated"]);
  });

  test("its groups come out as source areas, config, tests, generated", () => {
    const result = arrange(change, loaded());
    strictly(result.groups).toEqual([
      {
        id: "source:apps/blog",
        num: "2",
        title: "apps/blog",
        sub: "production code",
        collapsed: false,
      },
      {
        id: "source:apps/shop",
        num: "2",
        title: "apps/shop",
        sub: "production code",
        collapsed: false,
      },
      { id: "source:tools", num: "2", title: "tools", sub: "production code", collapsed: false },
      {
        id: "source:(top level)",
        num: "2",
        title: "(top level)",
        sub: "production code",
        collapsed: false,
      },
      {
        id: "config",
        num: "3",
        title: "Config and docs",
        sub: "settings, CI and documentation",
        collapsed: false,
      },
      {
        id: "tests",
        num: "4",
        title: "Tests",
        sub: "unit tests, browser checks and test helpers",
        collapsed: true,
      },
      {
        id: "generated",
        num: "",
        title: "Generated files and lockfiles",
        sub: "written by tools, not by hand",
        note: "Written by tools, not by hand. Skim them only if a dependency change worries you.",
        collapsed: true,
      },
    ]);
    expect(result.files.map((f) => f.path)).toEqual([
      "apps/blog/src/post.ts",
      "apps/shop/src/cart.ts",
      "tools/x.ts",
      "main.ts",
      "docs/guide.md",
      ".github/workflows/ci.yml",
      "README.md",
      "apps/shop/.env.ci",
      "apps/shop/src/cart.test.ts",
      "pnpm-lock.yaml",
    ]);
  });

  test("it places each kind of file where the layout says", () => {
    const result = arrange(change, loaded());
    expect(titleOf(result, "pnpm-lock.yaml")).toBe("Generated files and lockfiles");
    expect(titleOf(result, "apps/shop/src/cart.test.ts")).toBe("Tests");
    expect(titleOf(result, "apps/shop/src/cart.ts")).toBe("apps/shop");
    expect(titleOf(result, "docs/guide.md")).toBe("Config and docs");
    expect(titleOf(result, ".github/workflows/ci.yml")).toBe("Config and docs");
    expect(titleOf(result, "apps/shop/.env.ci")).toBe("Config and docs");
    expect(titleOf(result, "README.md")).toBe("Config and docs");
    expect(titleOf(result, "tools/x.ts")).toBe("tools");
    expect(titleOf(result, "main.ts")).toBe("(top level)");
  });

  test("it withholds environment files and nothing else", () => {
    const { files } = arrange(change, loaded());
    expect(files.filter((f) => "withheld" in f).map((f) => f.path)).toEqual(["apps/shop/.env.ci"]);
    expect(placedAt(files, "apps/shop/.env.ci").withheld).toBe(
      "Environment files are not shown on review pages. Only their name and size of change are listed.",
    );
    expect(files.some((f) => f.first)).toBe(false);
    expect(files.every((f) => f.purposeSource === "heuristic")).toBe(true);
  });

  test("a more specific kind of file lands in the right group", () => {
    const result = arrange(
      [
        file("packages/ui/dist/bundle.js"),
        file("packages/ui/src/button.snap"),
        file("services/api/tests/login.py"),
        file("services/api/login_test.go"),
        file("crates/core/Cargo.toml"),
        file("crates/core/Cargo.lock"),
        file("deploy/config.yaml"),
        file("web/app.min.css"),
        file("web/app.css"),
      ],
      loaded(),
    );
    expect(titleOf(result, "packages/ui/dist/bundle.js")).toBe("Generated files and lockfiles");
    expect(titleOf(result, "packages/ui/src/button.snap")).toBe("Generated files and lockfiles");
    expect(titleOf(result, "services/api/tests/login.py")).toBe("Tests");
    expect(titleOf(result, "services/api/login_test.go")).toBe("Tests");
    expect(titleOf(result, "crates/core/Cargo.toml")).toBe("Config and docs");
    expect(titleOf(result, "crates/core/Cargo.lock")).toBe("Generated files and lockfiles");
    expect(titleOf(result, "deploy/config.yaml")).toBe("Config and docs");
    expect(titleOf(result, "web/app.min.css")).toBe("Generated files and lockfiles");
    expect(titleOf(result, "web/app.css")).toBe("web");
  });
});
