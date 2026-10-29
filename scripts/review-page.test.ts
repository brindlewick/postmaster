// Tests beside scripts/review-page.ts. The pure helpers are called directly; the script runs
// against a throwaway repository with a base and a head commit, so its totals are held to git's
// own for the same range (positive control) and a file with no address keeps its text (negative).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { run } from "./lib/proc.ts";
import {
  checkSize,
  groupChanges,
  lineCount,
  packChunks,
  parseChanges,
  titled,
} from "./review-page.ts";

const script = join(import.meta.dir, "review-page.ts");

describe("pure core", () => {
  test("lines are counted as an editor numbers them", () => {
    expect(lineCount("")).toBe(0);
    expect(lineCount("a\nb\n")).toBe(2);
    expect(lineCount("a\nb")).toBe(2);
  });

  test("numstat and name-status read together, renames and binaries included", () => {
    const changes = parseChanges(
      "3\t1\tsrc/a.ts\n-\t-\timg.png\n2\t0\tsrc/{old.ts => new.ts}\n",
      "M\tsrc/a.ts\nA\timg.png\nR091\tsrc/old.ts\tsrc/new.ts\n",
    );
    expect(changes).toEqual([
      { path: "src/a.ts", old: null, status: "M", add: 3, del: 1, binary: false },
      { path: "img.png", old: null, status: "A", add: 0, del: 0, binary: true },
      { path: "src/new.ts", old: "src/old.ts", status: "R", add: 2, del: 0, binary: false },
    ]);
  });

  test("files group by first folder, top-level files first", () => {
    const c = (path: string) => ({ path, old: null, status: "M", add: 1, del: 0, binary: false });
    const { order, files } = groupChanges([
      c("scripts/b.ts"),
      c("README.md"),
      c("docs/x.md"),
      c("scripts/a.ts"),
    ]);
    expect(order.map((o) => o.title)).toEqual(["Top level", "docs/", "scripts/"]);
    expect(files.map((f) => [f.path, f.group])).toEqual([
      ["README.md", 0],
      ["docs/x.md", 1],
      ["scripts/a.ts", 2],
      ["scripts/b.ts", 2],
    ]);
  });

  test("a chunk closes before it would pass the limit", () => {
    expect(packChunks([4, 4, 4, 9, 1], 10)).toEqual([0, 0, 1, 2, 2]);
    expect(packChunks([], 10)).toEqual([]);
  });

  test("a page over the limit is refused with its size; one at the limit passes", () => {
    expect(() => checkSize("the page", "x".repeat(11), 10)).toThrow("the page is");
    expect(() => checkSize("the page", "x".repeat(10), 10)).not.toThrow();
  });

  test("the title is replaced, and markup in it dropped", () => {
    expect(titled("<title>Review</title><p>x</p>", "#12 <review>")).toBe(
      "<title>#12 review</title><p>x</p>",
    );
  });
});

let repo: string;
let base: string;
let head: string;

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), "review-page-"));
  const g = (...a: string[]) => {
    const r = run("git", ["-C", repo, ...a]);
    if (r.code !== 0) throw new Error(r.err);
    return r.out.trim();
  };
  g("init", "-q", "-b", "main");
  g("config", "user.name", "Test");
  g("config", "user.email", "test@example.invalid");
  writeFileSync(join(repo, "keep.txt"), "one\ntwo\nthree\n");
  writeFileSync(join(repo, "gone.txt"), "bye\n");
  g("add", "-A");
  g("commit", "-q", "-m", "base");
  base = g("rev-parse", "HEAD");
  writeFileSync(join(repo, "keep.txt"), "one\n2\nthree\nfour\n");
  rmSync(join(repo, "gone.txt"));
  run("mkdir", ["-p", join(repo, "src")]);
  writeFileSync(
    join(repo, "src", "new.ts"),
    "con" +
      "st " +
      "own" +
      "er " +
      '= "' +
      "som" +
      "eon" +
      "e@c" +
      "omp" +
      "any" +
      ".co" +
      '";\n' +
      "exp" +
      "ort" +
      " co" +
      "nst" +
      " n " +
      "= 1" +
      ";\n",
  );
  g("add", "-A");
  g("commit", "-q", "-m", "head");
  head = g("rev-parse", "HEAD");
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

/** The inline JSON block a page carries under an id. */
function block(html: string, id: string): unknown {
  const open = `<script type="application/json" id="${id}">`;
  const at = html.indexOf(open);
  expect(at).toBeGreaterThanOrEqual(0);
  return JSON.parse(html.slice(at + open.length, html.indexOf("</script>", at)));
}

describe("the script", () => {
  test("change: totals match git's, the address is removed, the page is titled", () => {
    const out = join(repo, ".out-change");
    const r = run(
      "bun",
      [script, "change", out, "--base", base, "--head", head, "--title", "Two edits"],
      { cwd: repo },
    );
    expect(r.code).toBe(0);
    expect(r.out).toContain(
      `index.html review-${basename(repo).toLowerCase()}-${head.slice(0, 7)}`,
    );
    // one file, nothing beside it: the shelf serves a page alone
    expect(readdirSync(out)).toEqual(["index.html"]);
    const html = readFileSync(join(out, "index.html"), "utf8");
    const review = block(html, "review-data") as {
      changedFiles: number;
      additions: number;
      deletions: number;
      redactions: number;
      files: { path: string; lines: number | null }[];
    };
    const short = run("git", ["-C", repo, "diff", "--shortstat", base, head]).out;
    expect(short).toContain(`${review.changedFiles} files changed`);
    expect(short).toContain(`${review.additions} insertions`);
    expect(short).toContain(`${review.deletions} deletion`);
    // once in the diff and once in the file as it stands
    expect(review.redactions).toBe(2);
    const items = JSON.stringify(block(html, "review-items"));
    expect(items).toContain("<address removed>");
    expect(html).not.toContain("som" + "eon" + "e@c" + "omp" + "any" + ".co");
    expect(items).toContain("one\\n2\\nthree\\nfour");
    expect(html).toContain(`<title>${head.slice(0, 7)} review</title>`);
    expect(html).not.toContain("<!-- page data -->");
    expect(html).not.toContain("window.claude");
    expect(review.files.find((f) => f.path === "gone.txt")?.lines).toBeNull();
  });

  test("files: each path as it stands at the ref, with its own file", () => {
    const out = join(repo, ".out-files");
    const r = run("bun", [script, "files", out, head, "keep.txt", "src/new.ts"], { cwd: repo });
    expect(r.code).toBe(0);
    expect(readdirSync(out)).toEqual(["index.html"]);
    expect(r.out).toContain(
      `index.html code-${basename(repo).toLowerCase()}-${head.slice(0, 7)}: f0 f1`,
    );
    const html = readFileSync(join(out, "index.html"), "utf8");
    const data = block(html, "files-data") as {
      files: { id: string; path: string; lines: number; text: string }[];
    };
    expect(data.files.map((f) => [f.id, f.path, f.lines])).toEqual([
      ["f0", "keep.txt", 4],
      ["f1", "src/new.ts", 2],
    ]);
    expect(data.files[0]?.text).toBe("one\n2\nthree\nfour\n");
    expect(data.files[1]?.text).toContain("<address removed>");
    expect(html).not.toContain("window.claude");
  });

  test("usage and an unknown ref exit 1", () => {
    expect(run("bun", [script], { cwd: repo }).code).toBe(1);
    expect(
      run("bun", [script, "files", join(repo, ".x"), "no-such-ref", "keep.txt"], { cwd: repo })
        .code,
    ).toBe(1);
  });
});
