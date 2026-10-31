// Tests beside scripts/review-page.ts. The pure helpers are called directly; the script runs
// against a throwaway repository with a base and a head commit, so its totals are held to git's
// own for the same range (positive control) and a file with no address keeps its text (negative).
// The demo build runs on an invented sample repository with fixed commits, so its data and the
// page's structure are compared with goldens, and two builds are compared byte for byte.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dataBlock, withData } from "./lib/page-text.ts";
import { run } from "./lib/proc.ts";
import { chunkBlockId, readBlock, reviewBlockId } from "./lib/review-source.ts";
import { layoutFrom, lineCount, packChunks, parseChanges, titled } from "./review-page.ts";

const script = join(import.meta.dir, "review-page.ts");
const GOLDEN = join(import.meta.dir, "fixtures", "review-page");
const UPDATE = process.env.REVIEW_PAGE_GOLDEN === "update";

/** A document over built HTML: the text of the block with an id, as a browser gives it. */
function documentOf(html: string) {
  return {
    getElementById(id: string) {
      const open = `<script type="application/json" id="${id}">`;
      const at = html.indexOf(open);
      if (at < 0) return null;
      const from = at + open.length;
      return { textContent: html.slice(from, html.indexOf("</script>", from)) };
    },
  };
}

/** The chunk files of a built folder, in chunk order. */
function chunkFiles(dir: string): unknown[] {
  const names = readdirSync(join(dir, "chunks"));
  return names.map((_n, k) => JSON.parse(readFileSync(join(dir, "chunks", `${k}.json`), "utf8")));
}

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

  test("a chunk closes before it would pass the limit", () => {
    expect(packChunks([4, 4, 4, 9, 1], 10)).toEqual([0, 0, 1, 2, 2]);
    expect(packChunks([], 10)).toEqual([]);
  });

  test("the title is replaced, and markup in it dropped", () => {
    expect(titled("<title>Review</title><p>x</p>", "#12 <review>")).toBe(
      "<title>#12 review</title><p>x</p>",
    );
  });

  test("the default layout reads cleanly, and a later config merges over it", () => {
    const base = layoutFrom([]);
    expect(base.problems).toEqual([]);
    expect(base.layout.groups.map((g) => g.id)).toEqual(["source", "config", "tests", "generated"]);
    const merged = layoutFrom([{ purposes: { "a.ts": "Does a." }, first: ["a.ts"] }]);
    expect(merged.layout.purposes["a.ts"]).toBe("Does a.");
    expect(merged.layout.first).toEqual(["a.ts"]);
  });

  test("a config that does not parse is reported, not applied", () => {
    const bad = layoutFrom([{ groups: [{ id: "x", title: "X", match: ["("] }], nope: 1 }]);
    expect(bad.problems.length).toBeGreaterThan(0);
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
  mkdirSync(join(repo, "src"), { recursive: true });
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

const build = (out: string, ...more: string[]) =>
  run(
    "bun",
    [script, "change", out, "--base", base, "--head", head, "--title", "Two edits", ...more],
    {
      cwd: repo,
    },
  );

describe("the script: change", () => {
  test("totals match git's, the address is removed, the page is assembled and titled", () => {
    const out = join(repo, ".out-change");
    const r = build(out);
    expect(r.code).toBe(0);
    expect(r.out).toContain("3 files in");
    const review = JSON.parse(readFileSync(join(out, "review.json"), "utf8"));
    const short = run("git", ["-C", repo, "diff", "--shortstat", base, head]).out;
    expect(short).toContain(`${review.changedFiles} files changed`);
    expect(short).toContain(`${review.additions} insertions`);
    expect(short).toContain(`${review.deletions} deletion`);
    expect(review.version).toBe(2);
    // once, in the diff: the file's whole text is no longer read
    expect(review.redactions).toBe(1);
    const chunk = readFileSync(join(out, "chunks", "0.json"), "utf8");
    expect(chunk).toContain("<address removed>");
    expect(chunk).not.toContain("som" + "eon" + "e@c" + "omp" + "any" + ".co");
    expect(chunk).toContain("one\\n-two\\n+2");
    const items = JSON.parse(chunk) as { i: number; diff: string }[];
    expect(items.every((x) => Object.keys(x).sort().join() === "diff,i")).toBe(true);
    const html = readFileSync(join(out, "index.html"), "utf8");
    expect(html).toContain("<title>Code Review</title>");
    expect(html).not.toMatch(/@@(TITLE|CSS|SCRIPT)@@/u);
    const gone = review.files.find((f: { path: string }) => f.path === "gone.txt");
    expect(gone.status).toBe("D");
    expect(gone.purpose).toBe("Deleted file, 1 line removed.");
  });

  test("publish.html is the page with its data inside it, for a host that stores one file", () => {
    const out = join(repo, ".out-publish");
    const r = build(out);
    expect(r.code).toBe(0);
    expect(r.out).toContain(join(out, "publish.html"));
    const index = readFileSync(join(out, "index.html"), "utf8");
    const single = readFileSync(join(out, "publish.html"), "utf8");
    const review = JSON.parse(readFileSync(join(out, "review.json"), "utf8"));
    const chunks = chunkFiles(out);
    expect(chunks.length).toBeGreaterThan(0);
    // The blocks hold what the data files hold, read the way the page reads them.
    const doc = documentOf(single);
    expect(readBlock(doc, reviewBlockId())).toEqual(review);
    chunks.forEach((items, k) => expect(readBlock(doc, chunkBlockId(k))).toEqual(items));
    expect(readBlock(doc, chunkBlockId(chunks.length))).toBeNull();
    // Nothing else differs: with the blocks put into index.html, it is publish.html, byte for byte.
    const blocks = [
      dataBlock(reviewBlockId(), review),
      ...chunks.map((items, k) => dataBlock(chunkBlockId(k), items)),
    ];
    expect(withData(index, blocks)).toBe(single);
    // The page checked in a browser is index.html, which holds no data of its own.
    expect(index).not.toContain('type="application/json"');
    expect(single).toContain("<title>Code Review</title>");
    expect(single).not.toMatch(/@@(TITLE|CSS|SCRIPT)@@/u);
    // The one file carries the address-free text the data files carry.
    expect(single).toContain("<address removed>");
    expect(single).not.toContain("som" + "eon" + "e@c" + "omp" + "any" + ".co");
  });

  test("the page name, the storage key, a layout and a purposes file are taken from the options", () => {
    const out = join(repo, ".out-options");
    const layoutFile = join(repo, "layout.json");
    const purposesFile = join(repo, "purposes.json");
    const ticketFile = join(repo, "ticket.md");
    writeFileSync(layoutFile, JSON.stringify({ first: ["keep.txt"] }));
    writeFileSync(ticketFile, "The ticket says: keep the numbers.\n");
    writeFileSync(purposesFile, JSON.stringify({ "keep.txt": "Holds the numbers." }));
    const r = build(
      out,
      "--page-title",
      "Numbers Review",
      "--key",
      "numbers",
      "--layout",
      layoutFile,
      "--purposes",
      purposesFile,
      "--ticket-body",
      ticketFile,
    );
    expect(r.code).toBe(0);
    const review = JSON.parse(readFileSync(join(out, "review.json"), "utf8"));
    expect(review.storageKey).toBe("numbers");
    expect(review.ticketBody).toBe("The ticket says: keep the numbers.\n");
    const keep = review.files.find((f: { path: string }) => f.path === "keep.txt");
    expect(keep.purpose).toBe("Holds the numbers.");
    expect(keep.purposeSource).toBe("layout");
    expect(keep.first).toBe(true);
    expect(readFileSync(join(out, "index.html"), "utf8")).toContain(
      "<title>Numbers Review</title>",
    );
  });

  test("a layout that does not parse, or a ruling the change cannot resolve, exits 1 and says why", () => {
    const badLayout = join(repo, "bad-layout.json");
    writeFileSync(badLayout, "{ not json");
    const r1 = build(join(repo, ".out-bad1"), "--layout", badLayout);
    expect(r1.code).toBe(1);
    expect(r1.err).toContain("layout");
    const lost = join(repo, "lost.json");
    writeFileSync(
      lost,
      JSON.stringify({
        rulings: [
          {
            n: 1,
            state: "open",
            title: "T",
            links: [{ path: "keep.txt", match: "nothing here", label: "L" }],
          },
        ],
      }),
    );
    const r2 = build(join(repo, ".out-bad2"), "--layout", lost);
    expect(r2.code).toBe(1);
    expect(r2.err).toContain("nothing here");
  });

  test("a rebuild into the same folder leaves no chunk of the earlier build behind", () => {
    const out = join(repo, ".out-rebuild");
    mkdirSync(join(out, "chunks"), { recursive: true });
    writeFileSync(join(out, "chunks", "7.json"), "[]");
    expect(build(out).code).toBe(0);
    expect(readdirSync(join(out, "chunks"))).toEqual(["0.json"]);
  });

  test("the same input gives the same bytes", () => {
    const a = join(repo, ".out-same-a");
    const b = join(repo, ".out-same-b");
    expect(build(a).code).toBe(0);
    expect(build(b).code).toBe(0);
    for (const f of ["index.html", "publish.html", "review.json", "chunks/0.json"]) {
      expect(readFileSync(join(a, f), "utf8")).toBe(readFileSync(join(b, f), "utf8"));
    }
  });
});

describe("the script: change, on a new head", () => {
  const g = (...a: string[]) => {
    const r = run("git", ["-C", repo, ...a]);
    if (r.code !== 0) throw new Error(r.err);
    return r.out.trim();
  };
  const hashesOf = (dir: string): Record<string, string> =>
    Object.fromEntries(
      (
        JSON.parse(readFileSync(join(dir, "review.json"), "utf8")).files as {
          path: string;
          hash: string;
        }[]
      ).map((f) => [f.path, f.hash]),
    );
  const buildAt = (out: string, at: string) =>
    run("bun", [script, "change", out, "--base", base, "--head", at, "--title", "Two edits"], {
      cwd: repo,
    });
  let more = "";
  let pictureOne = "";
  let pictureTwo = "";

  beforeAll(() => {
    appendFileSync(join(repo, "src", "new.ts"), "export const m = 2;\n");
    writeFileSync(join(repo, "logo.bin"), Buffer.from([0, 1, 2, 3, 0, 255]));
    g("add", "-A");
    g("commit", "-q", "-m", "more");
    more = g("rev-parse", "HEAD");
    pictureOne = more;
    writeFileSync(join(repo, "logo.bin"), Buffer.from([0, 1, 2, 9, 0, 255]));
    g("add", "-A");
    g("commit", "-q", "-m", "picture");
    pictureTwo = g("rev-parse", "HEAD");
  });

  test("a file whose diff did not change keeps its hash on a new head, and the changed one gets another", () => {
    const first = join(repo, ".out-hash-v1");
    const second = join(repo, ".out-hash-v2");
    expect(build(first).code).toBe(0);
    expect(buildAt(second, more).code).toBe(0);
    const a = hashesOf(first);
    const b = hashesOf(second);
    for (const h of Object.values(a)) expect(h).toMatch(/^[0-9a-f]{64}$/u);
    expect(b["keep.txt"]).toBe(a["keep.txt"]);
    expect(b["gone.txt"]).toBe(a["gone.txt"]);
    expect(b["src/new.ts"]).not.toBe(a["src/new.ts"]);
  });

  test("the same head gives the same hashes, whichever folder it is built into", () => {
    const one = join(repo, ".out-hash-same-a");
    const two = join(repo, ".out-hash-same-b");
    expect(buildAt(one, more).code).toBe(0);
    expect(buildAt(two, more).code).toBe(0);
    expect(Object.keys(hashesOf(one)).length).toBeGreaterThan(3);
    expect(hashesOf(two)).toEqual(hashesOf(one));
    for (const h of Object.values(hashesOf(one))) expect(h).toMatch(/^[0-9a-f]{64}$/u);
  });

  test("a binary file has no diff to show, so its hash follows the id of its content", () => {
    const one = join(repo, ".out-hash-bin-1");
    const two = join(repo, ".out-hash-bin-2");
    const same = join(repo, ".out-hash-bin-3");
    expect(buildAt(one, pictureOne).code).toBe(0);
    expect(buildAt(two, pictureTwo).code).toBe(0);
    expect(buildAt(same, pictureOne).code).toBe(0);
    expect(hashesOf(two)["logo.bin"]).not.toBe(hashesOf(one)["logo.bin"]);
    expect(hashesOf(same)["logo.bin"]).toBe(hashesOf(one)["logo.bin"]);
  });
});

describe("the script: files", () => {
  test("each path as it stands at the ref, in one file that needs nothing beside it", () => {
    const out = join(repo, ".out-files");
    const r = run("bun", [script, "files", out, head, "keep.txt", "src/new.ts"], { cwd: repo });
    expect(r.code).toBe(0);
    expect(readdirSync(out)).toEqual(["index.html"]);
    expect(r.out).toContain(`page to publish: ${join(out, "index.html")}`);
    const html = readFileSync(join(out, "index.html"), "utf8");
    const data = readBlock(documentOf(html), "files-data") as {
      title: string;
      ref: string;
      files: { id: string; path: string; lang: string; lines: number; text: string }[];
    };
    expect(data.ref).toBe(head);
    expect(data.title).toBe(`2 files at ${head.slice(0, 7)}`);
    expect(data.files.map((f) => [f.id, f.path, f.lines])).toEqual([
      ["f0", "keep.txt", 4],
      ["f1", "src/new.ts", 2],
    ]);
    expect(data.files[0]?.text).toBe("one\n2\nthree\nfour\n");
    expect(data.files[1]?.text).toContain("<address removed>");
    expect(html).not.toContain("som" + "eon" + "e@c" + "omp" + "any" + ".co");
    expect(html).not.toContain("<!-- page data -->");
    expect(html).toContain("<title>Code</title>");
    // the page reads its files from the block, fetches nothing, and reaches the window only for
    // highlight.js and the hash change
    expect(html).not.toMatch(/fetch\(/u);
    const windowUses = [...html.matchAll(/window\.([A-Za-z]+)/gu)].map((m) => m[1]).sort();
    expect(windowUses).toEqual(["addEventListener", "hljs"]);
  });

  test("the viewer's own script parses, and the page loads only highlight.js and the fonts", () => {
    const out = join(repo, ".out-files-script");
    expect(run("bun", [script, "files", out, head, "keep.txt"], { cwd: repo }).code).toBe(0);
    const html = readFileSync(join(out, "index.html"), "utf8");
    const scripts = [...html.matchAll(/<script>\n([^]*?)\n<\/script>/gu)].map((m) => m[1] ?? "");
    expect(scripts.length).toBe(1);
    expect(() => new Function(scripts[0] ?? "")).not.toThrow();
    const loads = (html.match(/(?:src|href)="(https?:[^"]+)"/gu) ?? []).map((l) =>
      l.slice(l.indexOf('"') + 1, -1),
    );
    for (const url of loads) {
      expect(
        /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)(\/|$)/u.test(url) ||
          url === "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js",
      ).toBe(true);
    }
  });

  test("text that would close a script tag stays text", () => {
    const tricky = join(repo, "tricky.html");
    writeFileSync(tricky, "<p>x</p>\n<" + "/script><script>alert(1)</" + "script>\n");
    const g = (...a: string[]) => run("git", ["-C", repo, ...a]);
    g("add", "tricky.html");
    g("commit", "-q", "-m", "tricky");
    const sha = g("rev-parse", "HEAD").out.trim();
    const out = join(repo, ".out-files-tricky");
    expect(run("bun", [script, "files", out, sha, "tricky.html"], { cwd: repo }).code).toBe(0);
    const html = readFileSync(join(out, "index.html"), "utf8");
    const data = readBlock(documentOf(html), "files-data") as { files: { text: string }[] };
    expect(data.files[0]?.text).toBe(readFileSync(tricky, "utf8"));
    expect(html.split("<script>alert(1)").length).toBe(1);
  });

  test("usage and an unknown ref exit 1", () => {
    expect(run("bun", [script], { cwd: repo }).code).toBe(1);
    expect(
      run("bun", [script, "files", join(repo, ".x"), "no-such-ref", "keep.txt"], { cwd: repo })
        .code,
    ).toBe(1);
  });
});

// ---------- the demo build: an invented sample repository, fixed commits ----------

// ASCII: the page is machine-made HTML, where a link ends at a space, a quote or a bracket.
const EXTERNAL = /https?:\/\/[^"'\s)<>]+/gu;
// ASCII: an attribute follows an ASCII space in the page's own markup.
const IDS = /\sid="([^"]+)"/gu;

/** What the page is made of, in a form a person can read in a diff: the loads, the ids, the assets. */
function pageStructure(html: string): string {
  const loads = [...new Set(html.match(EXTERNAL) ?? [])].sort();
  const ids = [...html.matchAll(IDS)].map((m) => m[1] ?? "");
  const scripts = (html.match(/<script[ >]/gu) ?? []).length;
  const styles = (html.match(/<style[ >]/gu) ?? []).length;
  return [
    `title: ${/<title>([^<]*)<\/title>/u.exec(html)?.[1] ?? ""}`,
    `scripts: ${scripts}, styles: ${styles}`,
    "external loads:",
    ...loads.map((l) => `  ${l}`),
    "ids in the markup, in order:",
    ...ids.map((i) => `  ${i}`),
    "",
  ].join("\n");
}

function golden(name: string, actual: string): void {
  const path = join(GOLDEN, name);
  if (UPDATE) {
    mkdirSync(GOLDEN, { recursive: true });
    writeFileSync(path, actual);
  }
  expect(actual).toBe(readFileSync(path, "utf8"));
}

describe("the script: demo", () => {
  const outA = mkdtempSync(join(tmpdir(), "review-demo-a-"));
  const outB = mkdtempSync(join(tmpdir(), "review-demo-b-"));
  let resultA: { code: number; out: string; err: string };
  beforeAll(() => {
    resultA = run("bun", [script, "demo", outA]);
    run("bun", [script, "demo", outB]);
  });
  afterAll(() => {
    rmSync(outA, { recursive: true, force: true });
    rmSync(outB, { recursive: true, force: true });
  });

  test("the sample change builds, and the summary line counts its files, groups and withheld file", () => {
    expect(resultA.code).toBe(0);
    expect(resultA.out).toMatch(/[0-9]+ files in [0-9]+ groups/u);
    expect(resultA.out).toContain("1 withheld");
  });

  test("two builds, from two sample repositories in two folders, are byte for byte the same", () => {
    const names = [
      "index.html",
      "publish.html",
      "review.json",
      ...readdirSync(join(outA, "chunks")).map((n) => `chunks/${n}`),
    ];
    for (const n of names)
      expect(readFileSync(join(outB, n), "utf8")).toBe(readFileSync(join(outA, n), "utf8"));
    expect(readdirSync(join(outB, "chunks"))).toEqual(readdirSync(join(outA, "chunks")));
  });

  test("the data model matches its golden", () => {
    const review = JSON.parse(readFileSync(join(outA, "review.json"), "utf8"));
    golden("demo-review.json", `${JSON.stringify(review, null, 2)}\n`);
  });

  test("the diff chunks hold exactly the files, each under its index", () => {
    const review = JSON.parse(readFileSync(join(outA, "review.json"), "utf8"));
    const items = readdirSync(join(outA, "chunks"))
      .flatMap((n) => JSON.parse(readFileSync(join(outA, "chunks", n), "utf8")) as { i: number }[])
      .map((x) => x.i)
      .sort((a, b) => a - b);
    expect(items).toEqual(review.files.map((_: unknown, i: number) => i));
  });

  test("the page structure matches its golden", () => {
    golden(
      "demo-page-structure.txt",
      pageStructure(readFileSync(join(outA, "index.html"), "utf8")),
    );
  });

  test("the page script is one function body that parses, and no slot marker is left", () => {
    const html = readFileSync(join(outA, "index.html"), "utf8");
    const scripts = [...html.matchAll(/<script>\n([^]*?)\n<\/script>/gu)].map((m) => m[1] ?? "");
    expect(scripts.length).toBe(1);
    expect(() => new Function(scripts[0] ?? "")).not.toThrow();
    expect(html).not.toMatch(/@@(TITLE|CSS|SCRIPT)@@/u);
  });

  test("the page loads only highlight.js 11.11.1 from cdnjs and fonts from Google Fonts", () => {
    const html = readFileSync(join(outA, "index.html"), "utf8");
    const loads = (html.match(/(?:src|href)="(https?:[^"]+)"/gu) ?? []).map((l) =>
      l.slice(l.indexOf('"') + 1, -1),
    );
    for (const url of loads) {
      expect(
        /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)(\/|$)/u.test(url) ||
          url === "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js",
      ).toBe(true);
    }
    // ASCII: the page's own source, where a word boundary is an ASCII one.
    expect(html).not.toMatch(/\bfetch\(["'`]https?:/u);
  });

  test("the sample's rulings resolve to lines, the env file is withheld, no purpose is blank", () => {
    const review = JSON.parse(readFileSync(join(outA, "review.json"), "utf8"));
    expect(review.rulings.length).toBe(2);
    for (const r of review.rulings) for (const l of r.links) expect(l.from).toBeGreaterThan(0);
    const env = review.files.find((f: { path: string }) => f.path.endsWith(".env.ci"));
    expect(env.withheld).toContain("not shown");
    for (const f of review.files) expect(f.purpose.length).toBeGreaterThan(5);
    expect(review.storageKey).toBe("review-demo");
  });
});
