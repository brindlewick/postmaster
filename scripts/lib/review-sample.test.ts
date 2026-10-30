// Tests beside scripts/lib/review-sample.ts. The file texts, the layout and the summary are pure, so
// they are checked directly. The repository is built in two folders, and again under a hostile
// environment: its commits must come out identical (positive control), and every count read from
// git is also read for an empty range through the same command (negative control).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, posix } from "node:path";
import { run } from "./proc.ts";
import {
  createSampleRepo,
  SAMPLE_LAYOUT,
  SAMPLE_SUMMARY,
  type SampleRepo,
  sampleFiles,
} from "./review-sample.ts";

type Files = Record<string, string>;

const BASE: Files = sampleFiles("base");
const HEAD: Files = sampleFiles("head");
const BASE_PATHS = Object.keys(BASE).sort();
const HEAD_PATHS = Object.keys(HEAD).sort();

const DELETED = "apps/shop/src/features/cart/giftNote.ts";
const RENAMED_FROM = "apps/shop/src/features/cart/totals.ts";
const RENAMED_TO = "apps/shop/src/features/cart/cartTotals.ts";

/** The paths the sample must have at head, by the status each is designed to show. */
const REQUIRED_ADDED = [
  "apps/admin/src/orders/export/formats/csv.ts",
  "apps/admin/src/orders/export/formats/json.ts",
  "apps/shop/src/features/cart/cartTotals.test.ts",
  RENAMED_TO,
  "apps/shop/src/features/cart/components/GiftWrapToggle.test.tsx",
  "apps/shop/src/features/cart/components/GiftWrapToggle.tsx",
  "docs/gift-wrap.md",
  "packages/pricing/src/rules/volume/tiers/wrap.test.ts",
  "packages/pricing/src/rules/volume/tiers/wrap.ts",
  "packages/ui/src/Toggle.tsx",
  "packages/ui/src/icons/outline/box.tsx",
  "packages/ui/src/icons/outline/gift.tsx",
];
const REQUIRED_MODIFIED = [
  ".github/workflows/ci.yml",
  "README.md",
  "apps/admin/src/orders/orderList.ts",
  "apps/shop/.env.ci",
  "apps/shop/src/features/cart/cart.test.ts",
  "apps/shop/src/features/cart/cart.ts",
  "apps/shop/src/features/cart/components/CartList.tsx",
  "apps/shop/src/features/checkout/checkout.ts",
  "apps/shop/src/features/checkout/shipping.ts",
  "apps/shop/src/routeTree.gen.ts",
  "apps/shop/src/routes/cart.tsx",
  "apps/shop/src/routes/checkout.tsx",
  "docs/architecture.md",
  "e2e/cart.spec.ts",
  "e2e/checkout.spec.ts",
  "e2e/helpers/server.ts",
  "package.json",
  "packages/pricing/package.json",
  "packages/pricing/src/index.ts",
  "packages/pricing/src/rules/volume/tiers/standard.ts",
  "packages/pricing/src/tax.ts",
  "packages/pricing/src/testing/fixtures.ts",
  "packages/ui/src/Button.tsx",
  "pnpm-lock.yaml",
];
const REQUIRED_UNCHANGED = ["packages/pricing/src/discount.ts", "packages/pricing/src/rounding.ts"];

// The pure view of the change, from the two stages alone.
const ADDED = HEAD_PATHS.filter((p) => !(p in BASE));
const REMOVED = BASE_PATHS.filter((p) => !(p in HEAD));
const MODIFIED = HEAD_PATHS.filter((p) => p in BASE && BASE[p] !== HEAD[p]);
const UNCHANGED = HEAD_PATHS.filter((p) => p in BASE && BASE[p] === HEAD[p]);

/** The longest stretch of lines a ruling link may cite. */
const MAX_RANGE = 40;

/**
 * The commit ids every machine must produce. They change only when the sample's files or its commit
 * data change on purpose; the test that holds them then fails and shows the new ids to record here.
 */
const RECORDED_IDS = {
  base: "789b76e39b5d55651d4f6a630a038fadf7485b9f",
  head: "619e0696d18b1061cbcac4cfb7f90bd81585ad5a",
};

// Small pure readers. Each has a control below, so a mistake in one cannot make a check vacuous.

const lineCount = (text: string): number => text.split("\n").length - 1;

const missingFrom = (have: readonly string[], want: readonly string[]): string[] =>
  want.filter((p) => !have.includes(p));

/** The numbers of the lines that hold the text. */
const linesHolding = (text: string, needle: string): number[] =>
  text.split("\n").flatMap((line, i) => (line.includes(needle) ? [i] : []));

// ASCII: the sample's prose is plain ASCII, where a sentence ends at an ASCII space.
const sentences = (text: string): string[] => text.split(/(?<=[.?!])\s+/u).filter(Boolean);

interface Section {
  readonly heading: string;
  readonly body: string;
}

/** A markdown text cut at its three-hash headings. */
function sections(markdown: string): Section[] {
  const parts = markdown.split(/^(### .*)$/mu);
  return Array.from({ length: (parts.length - 1) / 2 }, (_, i) => ({
    heading: parts[1 + 2 * i]!,
    body: parts[2 + 2 * i]!,
  }));
}

const escapeRegExp = (text: string): string => text.replace(/[.+?^${}()|[\]\\]/gu, "\\$&");

function globToRegExp(glob: string): RegExp {
  const body = glob
    .split("**")
    .map((part) => part.split("*").map(escapeRegExp).join("[^/]*"))
    .join(".*");
  return new RegExp(`^${body}$`, "u");
}

const importSpecifiers = (source: string): string[] =>
  // ASCII: the import statements of the sample's source are ASCII.
  [...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/gu)].map((m) => m[1]!);

const EXTENSIONS = ["", ".ts", ".tsx", ".css", "/index.ts", "/index.tsx"];
const resolves = (files: Files, target: string): boolean =>
  EXTENSIONS.some((ext) => target + ext in files);

interface Stat {
  readonly files: number;
  readonly insertions: number;
  readonly deletions: number;
}

function parseShortstat(text: string): Stat {
  const pick = (pattern: RegExp): number => Number(pattern.exec(text)?.[1] ?? 0);
  return {
    files: pick(/([0-9]+) files? changed/u),
    insertions: pick(/([0-9]+) insertions?\(\+\)/u),
    deletions: pick(/([0-9]+) deletions?\(-\)/u),
  };
}

interface Change {
  readonly status: string;
  readonly score: number;
  readonly paths: readonly string[];
}

function parseNameStatus(text: string): Change[] {
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [code, ...paths] = line.split("\t");
      return { status: code![0]!, score: Number(code!.slice(1) || 0), paths };
    });
}

/** Directories whose only child is another directory, for a list of file paths. */
function singleChildDirs(paths: readonly string[]): string[] {
  const children = new Map<string, Set<string>>();
  for (const path of paths) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join("/");
      const child = i < parts.length - 1 ? `${parts[i]}/` : parts[i]!;
      children.set(dir, (children.get(dir) ?? new Set<string>()).add(child));
    }
  }
  return [...children]
    .filter(([, names]) => names.size === 1 && [...names][0]!.endsWith("/"))
    .map(([dir]) => dir)
    .sort();
}

/** The id git gives a file's text: the hash of "blob", the length, a zero byte and the text. */
const blobId = (text: string): string =>
  createHash("sha1")
    .update(`blob ${Buffer.byteLength(text)}\0${text}`)
    .digest("hex");

// Bun reads YAML; the declarations in types/bun.d.ts do not list it.
const YAML = (Bun as unknown as { YAML: { parse(text: string): unknown } }).YAML;

function withEnv<T>(vars: Record<string, string>, fn: () => T): T {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// What this test's own git calls need: no user or system settings, and no inherited directory
// overrides that would make git ignore -C.
const GIT_ENV: Record<string, string | undefined> = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_DIR: undefined,
  GIT_WORK_TREE: undefined,
  GIT_INDEX_FILE: undefined,
  GIT_COMMON_DIR: undefined,
  GIT_OBJECT_DIRECTORY: undefined,
  GIT_ALTERNATE_OBJECT_DIRECTORIES: undefined,
};

function git(repo: SampleRepo, ...args: string[]): string {
  const r = run("git", ["-C", repo.dir, ...args], { env: GIT_ENV });
  if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.err}`);
  return r.out.replace(/\n$/u, "");
}

/** Mode and blob id of every file in a commit, by path. */
function listing(repo: SampleRepo, commit: string): Record<string, { mode: string; oid: string }> {
  const rows = git(repo, "ls-tree", "-r", commit).split("\n").filter(Boolean);
  return Object.fromEntries(
    rows.map((row) => {
      const [meta, path] = row.split("\t");
      const [mode, , oid] = meta!.split(" ");
      return [path!, { mode: mode!, oid: oid! }];
    }),
  );
}

const expectedListing = (files: Files): Record<string, { mode: string; oid: string }> =>
  Object.fromEntries(
    Object.entries(files).map(([path, text]) => [path, { mode: "100644", oid: blobId(text) }]),
  );

const stat = (repo: SampleRepo, from: string, to: string): Stat =>
  parseShortstat(git(repo, "diff", "-M", "--shortstat", from, to));

const changes = (repo: SampleRepo): Change[] =>
  parseNameStatus(git(repo, "diff", "--name-status", "-M", repo.base, repo.head));

const pathsWith = (rows: readonly Change[], status: string): string[] =>
  rows
    .filter((c) => c.status === status)
    .map((c) => c.paths.at(-1)!)
    .sort();

describe("the readers used below", () => {
  test("shortstat: git's line is read, and an empty range reads zero", () => {
    expect(parseShortstat(" 43 files changed, 1200 insertions(+), 90 deletions(-)\n")).toEqual({
      files: 43,
      insertions: 1200,
      deletions: 90,
    });
    expect(parseShortstat(" 1 file changed, 2 insertions(+)\n")).toEqual({
      files: 1,
      insertions: 2,
      deletions: 0,
    });
    expect(parseShortstat("")).toEqual({ files: 0, insertions: 0, deletions: 0 });
  });

  test("name-status: the status letter, the similarity score and the paths", () => {
    expect(parseNameStatus("A\ta.ts\nR087\tb.ts\tc.ts\nD\td.ts\n")).toEqual([
      { status: "A", score: 0, paths: ["a.ts"] },
      { status: "R", score: 87, paths: ["b.ts", "c.ts"] },
      { status: "D", score: 0, paths: ["d.ts"] },
    ]);
    expect(parseNameStatus("")).toEqual([]);
  });

  test("single-child directories: found in a chain, absent where a folder holds files", () => {
    expect(singleChildDirs(["a/b/c/x.ts", "a/b/c/y.ts", "a/z.ts"])).toEqual(["a/b"]);
    expect(singleChildDirs(["a/b/x.ts", "a/b/y.ts"])).toEqual(["a"]);
    expect(singleChildDirs(["a/x.ts", "a/y.ts"])).toEqual([]);
  });

  test("lines, sentences, sections, globs and imports read as described", () => {
    expect(linesHolding("one\ntwo\none again\n", "one")).toEqual([0, 2]);
    expect(linesHolding("one\ntwo\n", "three")).toEqual([]);
    expect(sentences("One. Two? Three costs $3.50, flat.")).toHaveLength(3);
    expect(sentences("Just one.")).toHaveLength(1);
    expect(sections("### A\n\nx\n\n### B\n\ny\n").map((s) => [s.heading, s.body.trim()])).toEqual([
      ["### A", "x"],
      ["### B", "y"],
    ]);
    expect(globToRegExp("a/*.ts").test("a/b.ts")).toBe(true);
    expect(globToRegExp("a/*.ts").test("a/b/c.ts")).toBe(false);
    expect(globToRegExp("a/**/c.ts").test("a/b/d/c.ts")).toBe(true);
    expect(importSpecifiers('import { a } from "./a";\nimport "./b.css";\nimport("./c");')).toEqual(
      ["./a", "./b.css", "./c"],
    );
    expect(importSpecifiers("const x = 1;\n")).toEqual([]);
    expect(resolves({ "src/a.ts": "x", "src/ui/index.tsx": "y" }, "src/a")).toBe(true);
    expect(resolves({ "src/a.ts": "x", "src/ui/index.tsx": "y" }, "src/ui")).toBe(true);
    expect(resolves({ "src/a.ts": "x" }, "src/b")).toBe(false);
  });

  test("blobId is the id git gives the same text", () => {
    const text = "export const one = 1;\n";
    const r = run("git", ["hash-object", "--stdin"], { input: text, env: GIT_ENV });
    expect(r.code).toBe(0);
    expect(blobId(text)).toBe(r.out.trim());
    expect(blobId(`${text} `)).not.toBe(r.out.trim());
  });
});

describe("sampleFiles", () => {
  test("head differs from base as designed: added, modified, removed and unchanged", () => {
    expect(REMOVED).toEqual([DELETED, RENAMED_FROM].sort());
    expect(missingFrom(ADDED, REQUIRED_ADDED)).toEqual([]);
    expect(missingFrom(MODIFIED, REQUIRED_MODIFIED)).toEqual([]);
    expect(missingFrom(UNCHANGED, REQUIRED_UNCHANGED)).toEqual([]);
    expect(UNCHANGED.length).toBeGreaterThanOrEqual(4);
    expect(RENAMED_TO in BASE).toBe(false);
    expect(RENAMED_FROM in HEAD).toBe(false);
    expect(DELETED in HEAD).toBe(false);
  });

  test("head has about 45 files, and one path of six or more parts", () => {
    expect(HEAD_PATHS.length).toBeGreaterThanOrEqual(40);
    expect(HEAD_PATHS.length).toBeLessThanOrEqual(55);
    expect(HEAD_PATHS.some((p) => p.split("/").length >= 6)).toBe(true);
  });

  test("it is pure: each call returns a fresh object holding the same texts", () => {
    const a = sampleFiles("head");
    const b = sampleFiles("head");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
    a["README.md"] = "changed";
    expect(sampleFiles("head")["README.md"]).toBe(HEAD["README.md"]);
    expect(sampleFiles("head")["README.md"]).not.toBe("changed");
    expect(sampleFiles("base")).not.toEqual(sampleFiles("head"));
  });

  for (const [stage, files] of [
    ["base", BASE],
    ["head", HEAD],
  ] as const) {
    test(`${stage}: no file is empty, none is too short or too long, all end in one newline`, () => {
      const entries = Object.entries(files);
      expect(entries.filter(([, t]) => t.trim() === "").map(([p]) => p)).toEqual([]);
      expect(
        entries.filter(([, t]) => lineCount(t) < 10 || lineCount(t) > 120).map(([p]) => p),
      ).toEqual([]);
      expect(
        entries.filter(([, t]) => !t.endsWith("\n") || t.endsWith("\n\n")).map(([p]) => p),
      ).toEqual([]);
    });

    test(`${stage}: no line ends in a space or a tab, and every file is plain ASCII`, () => {
      const entries = Object.entries(files);
      expect(entries.filter(([, t]) => /[ \t]$/mu.test(t)).map(([p]) => p)).toEqual([]);
      expect(entries.filter(([, t]) => /[^\x20-\x7e\n]/u.test(t)).map(([p]) => p)).toEqual([]);
    });

    test(`${stage}: package files are valid JSON`, () => {
      const jsonFiles = Object.entries(files).filter(([p]) => p.endsWith(".json"));
      expect(jsonFiles.length).toBeGreaterThanOrEqual(3);
      const invalid = jsonFiles.filter(([, text]) => {
        try {
          JSON.parse(text);
          return false;
        } catch {
          return true;
        }
      });
      expect(invalid.map(([p]) => p)).toEqual([]);
    });

    test(`${stage}: the YAML files parse`, () => {
      expect(() => YAML.parse("a: [")).toThrow();
      const yamlFiles = Object.entries(files).filter(([p]) => /\.ya?ml$/u.test(p));
      expect(yamlFiles.map(([p]) => p).sort()).toEqual([
        ".github/workflows/ci.yml",
        "pnpm-lock.yaml",
      ]);
      const invalid = yamlFiles.filter(([, text]) => {
        try {
          YAML.parse(text);
          return false;
        } catch {
          return true;
        }
      });
      expect(invalid.map(([p]) => p)).toEqual([]);
    });

    test(`${stage}: every relative import resolves to a file of the same stage`, () => {
      const unresolved = Object.entries(files)
        .filter(([p]) => /\.tsx?$/u.test(p))
        .flatMap(([path, text]) =>
          importSpecifiers(text)
            .filter((spec) => spec.startsWith("."))
            .filter((spec) => !resolves(files, posix.join(posix.dirname(path), spec)))
            .map((spec) => `${path} imports ${spec}`),
        );
      expect(unresolved).toEqual([]);
    });

    test(`${stage}: both shared packages have an index and are imported by name`, () => {
      const packageFiles = ["packages/pricing/src/index.ts", "packages/ui/src/index.ts"];
      expect(missingFrom(Object.keys(files), packageFiles)).toEqual([]);
      const users = Object.entries(files).filter(([, t]) =>
        importSpecifiers(t).some((s) => s === "orchard-pricing" || s === "orchard-ui"),
      );
      expect(users.length).toBeGreaterThanOrEqual(5);
    });
  }
});

let parents: string[] = [];
let first: SampleRepo;
let second: SampleRepo;

beforeAll(() => {
  parents = [
    mkdtempSync(join(tmpdir(), "review-sample-test-")),
    mkdtempSync(join(tmpdir(), "review-sample-test-")),
  ];
  first = createSampleRepo(parents[0]!);
  second = createSampleRepo(parents[1]!);
});

afterAll(() => {
  for (const parent of parents) rmSync(parent, { recursive: true, force: true });
});

describe("createSampleRepo", () => {
  test("two builds in two folders give the same two commit ids", () => {
    expect(second.base).toBe(first.base);
    expect(second.head).toBe(first.head);
    expect(first.dir).not.toBe(second.dir);
    expect(dirname(first.dir)).toBe(parents[0]!);
    expect(dirname(second.dir)).toBe(parents[1]!);
    expect(basename(first.dir).startsWith("review-sample-")).toBe(true);
    expect(first.base).toMatch(/^[0-9a-f]{40}$/u);
    expect(first.head).toMatch(/^[0-9a-f]{40}$/u);
    expect(first.base).not.toBe(first.head);
  });

  test("the ids are the recorded ones, so they are the same on every machine", () => {
    expect({ base: first.base, head: first.head }).toEqual(RECORDED_IDS);
  });

  test("a second build in the same folder is a new directory with the same ids", () => {
    const again = createSampleRepo(parents[0]!);
    expect(again.dir).not.toBe(first.dir);
    expect(dirname(again.dir)).toBe(parents[0]!);
    expect(again.base).toBe(first.base);
    expect(again.head).toBe(first.head);
  });

  test("the head commit changes the tree, so equal ids are not a constant", () => {
    expect(git(first, "rev-parse", `${first.head}^{tree}`)).not.toBe(
      git(first, "rev-parse", `${first.base}^{tree}`),
    );
  });

  test("two commits on main, a clean tree, and nothing from the git template", () => {
    expect(git(first, "symbolic-ref", "--short", "HEAD")).toBe("main");
    expect(git(first, "rev-parse", "HEAD")).toBe(first.head);
    expect(git(first, "rev-parse", "HEAD^")).toBe(first.base);
    expect(git(first, "rev-list", "--count", "HEAD")).toBe("2");
    expect(git(first, "status", "--porcelain")).toBe("");
    const gitDir = readdirSync(join(first.dir, ".git"));
    for (const name of ["hooks", "info", "description"]) expect(gitDir).not.toContain(name);
  });

  test("each commit holds the fixed identity, dates and message, and nothing else", () => {
    const baseTime = Date.UTC(2026, 0, 5, 10, 0, 0) / 1000;
    const headTime = Date.UTC(2026, 0, 6, 10, 0, 0) / 1000;
    const raw = (sha: string): string[] => git(first, "cat-file", "commit", sha).split("\n");
    expect(raw(first.base)).toEqual([
      `tree ${git(first, "rev-parse", `${first.base}^{tree}`)}`,
      `author Test <test@example.invalid> ${baseTime} +0000`,
      `committer Test <test@example.invalid> ${baseTime} +0000`,
      "",
      "Base: the shop before gift wrapping",
    ]);
    expect(raw(first.head)).toEqual([
      `tree ${git(first, "rev-parse", `${first.head}^{tree}`)}`,
      `parent ${first.base}`,
      `author Test <test@example.invalid> ${headTime} +0000`,
      `committer Test <test@example.invalid> ${headTime} +0000`,
      "",
      "Add gift wrapping to the cart",
    ]);
  });

  test("each commit holds exactly the files of its stage, as plain files", () => {
    expect(listing(first, first.base)).toEqual(expectedListing(BASE));
    expect(listing(first, first.head)).toEqual(expectedListing(HEAD));
    const onDisk = HEAD_PATHS.filter((p) => readFileSync(join(first.dir, p), "utf8") !== HEAD[p]);
    expect(onDisk).toEqual([]);
  });

  test("git sees added, modified, deleted and renamed files, as the pure view says", () => {
    const rows = changes(first);
    expect(new Set(rows.map((c) => c.status))).toEqual(new Set(["A", "M", "D", "R"]));
    expect(pathsWith(rows, "A")).toEqual(ADDED.filter((p) => p !== RENAMED_TO));
    expect(pathsWith(rows, "M")).toEqual(MODIFIED);
    expect(pathsWith(rows, "D")).toEqual([DELETED]);
    const renames = rows.filter((c) => c.status === "R");
    expect(renames.map((c) => c.paths)).toEqual([[RENAMED_FROM, RENAMED_TO]]);
    // a rename with changes: similar enough to pair, not identical
    expect(renames[0]!.score).toBeGreaterThanOrEqual(50);
    expect(renames[0]!.score).toBeLessThanOrEqual(99);
  });

  test("the diff is 40 to 60 files and 800 to 2200 changed lines; an empty range reads zero", () => {
    const whole = stat(first, first.base, first.head);
    expect(whole.files).toBeGreaterThanOrEqual(40);
    expect(whole.files).toBeLessThanOrEqual(60);
    expect(whole.insertions + whole.deletions).toBeGreaterThanOrEqual(800);
    expect(whole.insertions + whole.deletions).toBeLessThanOrEqual(2200);
    expect(whole.files).toBe(changes(first).length);
    expect(stat(first, first.base, first.base)).toEqual({ files: 0, insertions: 0, deletions: 0 });
  });

  test("the changed paths hold a deep path and single-child directory chains", () => {
    const paths = changes(first).map((c) => c.paths.at(-1)!);
    expect(paths.some((p) => p.split("/").length >= 6)).toBe(true);
    const chains = singleChildDirs(paths);
    // export > formats, rules > volume > tiers, icons > outline
    for (const dir of [
      "apps/admin/src/orders/export",
      "packages/pricing/src/rules",
      "packages/pricing/src/rules/volume",
      "packages/ui/src/icons",
    ]) {
      expect(chains).toContain(dir);
    }
    // a folder that holds files ends a chain
    expect(chains).not.toContain("apps/admin/src/orders/export/formats");
    expect(chains).not.toContain("packages/pricing/src/rules/volume/tiers");
  });

  test("ambient git settings, identity, dates, directories and time zone change nothing", () => {
    const parent = parents[1]!;
    const ignore = join(parent, "ambient-ignore");
    const config = join(parent, "ambient.gitconfig");
    writeFileSync(ignore, ".env.ci\n*.gen.ts\n");
    writeFileSync(
      config,
      ["[i18n]", "\tcommitEncoding = ISO-8859-1", "[core]", `\texcludesFile = ${ignore}`, ""].join(
        "\n",
      ),
    );
    const identity: Record<string, string> = {
      GIT_AUTHOR_NAME: "Ambient",
      GIT_AUTHOR_EMAIL: "ambient@example.invalid",
      GIT_COMMITTER_NAME: "Ambient",
      GIT_COMMITTER_EMAIL: "ambient@example.invalid",
      GIT_AUTHOR_DATE: "2001-02-03T04:05:06+0900",
      GIT_COMMITTER_DATE: "2001-02-03T04:05:06+0900",
    };
    const hostile: Record<string, string> = {
      ...identity,
      GIT_CONFIG_GLOBAL: config,
      GIT_DIR: join(parent, "no-such-git-dir"),
      GIT_WORK_TREE: parent,
      GIT_INDEX_FILE: join(parent, "no-such-index"),
      TZ: "Pacific/Auckland",
    };
    // positive controls: these settings do reach git, so the equal ids below mean something
    const armed = run("git", ["var", "GIT_AUTHOR_IDENT"], { env: identity });
    expect(armed.out).toContain("Ambient <ambient@example.invalid>");
    const encoding = run("git", ["config", "--get", "i18n.commitEncoding"], {
      env: { GIT_CONFIG_GLOBAL: config },
    });
    expect(encoding.out.trim()).toBe("ISO-8859-1");

    const built = withEnv(hostile, () => createSampleRepo(parent));
    expect(built.base).toBe(first.base);
    expect(built.head).toBe(first.head);
  });
});

/** Every sample text a reader could see, by name. */
const TEXTS: ReadonlyArray<readonly [string, string]> = [
  ...Object.entries(BASE).map(([p, t]) => [`base:${p}`, t] as const),
  ...Object.entries(HEAD).map(([p, t]) => [`head:${p}`, t] as const),
  ["SAMPLE_SUMMARY", SAMPLE_SUMMARY],
  ["SAMPLE_LAYOUT", JSON.stringify(SAMPLE_LAYOUT)],
];

// Built from their code points, so that this file holds no dash itself.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

/** What must not appear anywhere, with a text that does hold it, so the check can be seen to work. */
const FORBIDDEN: ReadonlyArray<{ what: string; pattern: RegExp; control: string }> = [
  { what: "an at sign", pattern: /@/u, control: "name@example.invalid" },
  { what: "a Users path", pattern: /\/Users\//u, control: "/Users/" },
  { what: "a home path", pattern: /\/home\//u, control: "/home/" },
  { what: "an http address", pattern: /http:\/\//u, control: "http://" },
  { what: "an https address", pattern: /https:\/\//u, control: "https://" },
  { what: "an em dash", pattern: new RegExp(EM_DASH, "u"), control: `a${EM_DASH}b` },
  { what: "an en dash", pattern: new RegExp(EN_DASH, "u"), control: `a${EN_DASH}b` },
  { what: "the word password", pattern: /password/iu, control: "A Password" },
  { what: "the word secret", pattern: /secret/iu, control: "a SECRET" },
];

describe("privacy", () => {
  for (const { what, pattern, control } of FORBIDDEN) {
    test(`no sample text holds ${what}`, () => {
      expect(pattern.test(control)).toBe(true);
      expect(TEXTS.filter(([, text]) => pattern.test(text)).map(([name]) => name)).toEqual([]);
    });
  }

  test("the texts checked are every file of both stages, the summary and the layout", () => {
    expect(TEXTS.length).toBe(BASE_PATHS.length + HEAD_PATHS.length + 2);
    expect(TEXTS.every(([, text]) => text.length > 0)).toBe(true);
  });
});

describe("SAMPLE_LAYOUT", () => {
  test("purposes: about a dozen paths, each one short plain sentence", () => {
    const entries = Object.entries(SAMPLE_LAYOUT.purposes);
    expect(entries.length).toBeGreaterThanOrEqual(10);
    expect(entries.length).toBeLessThanOrEqual(16);
    // a removed file has no head path, so its purpose is keyed by the path it had
    expect(entries.map(([p]) => p).filter((p) => !(p in HEAD) && p !== DELETED)).toEqual([]);
    const sentenceShaped = /^[A-Z][\x20-\x7e]*\.$/u;
    expect(entries.filter(([, s]) => s.length > 110 || !sentenceShaped.test(s))).toEqual([]);
    expect(entries.filter(([, s]) => /[.!?] /u.test(s))).toEqual([]);
  });

  test("purposes cover an added, a modified, a renamed and a removed file", () => {
    const keys = Object.keys(SAMPLE_LAYOUT.purposes);
    expect(keys.some((p) => ADDED.includes(p) && p !== RENAMED_TO)).toBe(true);
    expect(keys.some((p) => MODIFIED.includes(p))).toBe(true);
    expect(keys).toContain(RENAMED_TO);
    expect(keys).toContain(DELETED);
  });

  test("first: three entries, the plain ones are head paths, the glob matches head paths", () => {
    const { first: entries } = SAMPLE_LAYOUT;
    expect(entries).toHaveLength(3);
    const globs = entries.filter((e) => e.includes("*"));
    expect(globs).toHaveLength(1);
    expect(entries.filter((e) => !e.includes("*") && !(e in HEAD))).toEqual([]);
    const matching = HEAD_PATHS.filter((p) => globToRegExp(globs[0]!).test(p));
    expect(matching.length).toBeGreaterThanOrEqual(2);
  });

  test("rulings: numbered in order, one open then one decided, each with a title and links", () => {
    const { rulings } = SAMPLE_LAYOUT;
    expect(rulings.map((r) => r.n)).toEqual([1, 2]);
    expect(rulings.map((r) => r.state)).toEqual(["open", "decided"]);
    expect(rulings.filter((r) => !/^[A-Z][\x20-\x7e]*[.?]$/u.test(r.title))).toEqual([]);
    expect(rulings.filter((r) => r.links.length < 1 || r.links.length > 4)).toEqual([]);
    const labels = rulings.flatMap((r) => r.links.map((l) => l.label));
    expect(labels.filter((l) => !/^[\x20-\x7e]{3,40}$/u.test(l))).toEqual([]);
  });

  test("every link cites one line of a head file; a range starts there, ends on text and stays short", () => {
    const problems: string[] = [];
    for (const { links } of SAMPLE_LAYOUT.rulings) {
      for (const link of links) {
        const text = HEAD[link.path];
        if (text === undefined) {
          problems.push(`${link.path} is not a head path`);
          continue;
        }
        const holding = linesHolding(text, link.match);
        if (holding.length !== 1) {
          problems.push(`${link.path}: "${link.match}" is on ${holding.length} lines`);
          continue;
        }
        if (link.to_match !== undefined && link.span !== undefined) {
          problems.push(`${link.path}: both to_match and span`);
          continue;
        }
        const start = holding[0]!;
        // The last line of the link: the first line from the start that holds to_match, or span
        // lines after the start, or the start itself.
        const end =
          link.to_match !== undefined
            ? linesHolding(text, link.to_match).find((i) => i >= start)
            : start + (link.span ?? 0);
        if (link.span !== undefined && !(Number.isInteger(link.span) && link.span >= 0)) {
          problems.push(`${link.path}: span ${link.span} is not a whole number from 0`);
        } else if (end === undefined) {
          problems.push(`${link.path}: "${link.to_match}" is not at or after the first line`);
        } else if (end >= lineCount(text)) {
          problems.push(`${link.path}: the range runs past the last line`);
        } else if (text.split("\n")[end]!.trim() === "") {
          problems.push(`${link.path}: the range ends on a blank line`);
        } else if (end - start + 1 > MAX_RANGE) {
          problems.push(`${link.path}: the range is too long`);
        }
      }
    }
    expect(problems).toEqual([]);
    const all = SAMPLE_LAYOUT.rulings.flatMap((r) => r.links);
    expect(all.some((l) => l.to_match !== undefined)).toBe(true);
    expect(all.some((l) => l.span !== undefined)).toBe(true);
  });
});

describe("SAMPLE_SUMMARY", () => {
  const parts = sections(SAMPLE_SUMMARY);

  test("three-hash headings in order, the last about the rulings", () => {
    expect(parts.map((s) => s.heading).slice(0, 3)).toEqual([
      "### What the change does",
      "### How the files are grouped",
      "### Where to look first",
    ]);
    expect(parts).toHaveLength(4);
    expect(parts[3]!.heading).toMatch(/^### .*rulings/iu);
    expect(
      SAMPLE_SUMMARY.split("\n").filter((l) => l.startsWith("#") && !l.startsWith("### ")),
    ).toEqual([]);
    expect(parts.filter((s) => s.body.trim() === "")).toEqual([]);
  });

  test("plain text: no bold, no stray markup, ASCII, one closing newline", () => {
    expect(SAMPLE_SUMMARY.startsWith("### ")).toBe(true);
    expect(SAMPLE_SUMMARY.includes("**")).toBe(false);
    expect(SAMPLE_SUMMARY.includes("__")).toBe(false);
    expect(/[^\x20-\x7e\n]/u.test(SAMPLE_SUMMARY)).toBe(false);
    expect(SAMPLE_SUMMARY.endsWith("\n") && !SAMPLE_SUMMARY.endsWith("\n\n")).toBe(true);
  });

  test("where to look first names two or three head files, all in the layout's first list", () => {
    const named = [...parts[2]!.body.matchAll(/`([^`]+)`/gu)].map((m) => m[1]!);
    expect(named.length).toBeGreaterThanOrEqual(2);
    expect(named.length).toBeLessThanOrEqual(3);
    expect(named.filter((p) => !(p in HEAD))).toEqual([]);
    const wanted = SAMPLE_LAYOUT.first.map((e) => globToRegExp(e));
    expect(named.filter((p) => !wanted.some((w) => w.test(p)))).toEqual([]);
  });

  test("every path named in backticks is a head path or a folder of one", () => {
    const named = [...SAMPLE_SUMMARY.matchAll(/`([^`]+)`/gu)].map((m) => m[1]!);
    const missing = named
      .filter((t) => t.includes("/"))
      .filter((t) => !(t in HEAD) && !HEAD_PATHS.some((p) => p.startsWith(`${t}/`)));
    expect(missing).toEqual([]);
  });

  test("the rulings are an ordered list that matches the layout, item by item", () => {
    const { rulings } = SAMPLE_LAYOUT;
    const body = parts[3]!.body;
    const rows = body.split("\n").filter((l) => l.trim() !== "");
    expect(rows.filter((l) => !/^[0-9]+\. /u.test(l))).toEqual([]);
    expect(rows).toHaveLength(rulings.length);
    rulings.forEach((ruling, i) => {
      const row = rows[i]!;
      expect(row.startsWith(`${i + 1}. ${ruling.title} `)).toBe(true);
      const word = ruling.state === "open" ? "Open." : "Decided.";
      const afterTitle = row.slice(`${i + 1}. ${ruling.title} `.length);
      expect(afterTitle.startsWith(`${word} `)).toBe(true);
      const prose = sentences(afterTitle.slice(word.length + 1));
      expect(prose.length).toBeGreaterThanOrEqual(2);
      expect(prose.length).toBeLessThanOrEqual(3);
    });
  });
});
