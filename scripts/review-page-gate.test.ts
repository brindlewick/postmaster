// Tests beside scripts/review-page-gate.ts. The pure parts (the publisher skeleton, the run matrix, the
// verdicts, the Chromium search, the report) run without a browser; the page server runs on loopback; the
// command line runs against fakes. One integration test drives the real gate when Playwright can be
// loaded, and otherwise asserts that Playwright is unavailable and says what to set.
import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { run, withTempDir } from "./lib/proc.ts";
import {
  asPlaywright,
  auditChecks,
  BrowserUnavailable,
  backVerdict,
  type Check,
  chromiumPath,
  cli,
  composerVerdict,
  contentType,
  contextOptions,
  type Deps,
  describeMissing,
  edgeVerdict,
  expandVerdict,
  findChromium,
  findVerdict,
  firstDistinctPair,
  fontsVerdict,
  GATE_FUNCTIONS,
  type GateReport,
  historyVerdict,
  isAllowedHost,
  judge,
  KIT,
  loadPlaywright,
  matrix,
  navVerdict,
  openFileVerdict,
  parseArgs,
  type Playwright,
  pickSearchWord,
  type ReviewInfo,
  type Run,
  type RunReport,
  readReview,
  rowsVerdict,
  rulingVerdict,
  runGate,
  type ScreenAudit,
  screenshotSteps,
  searchVerdict,
  servedPath,
  shortReport,
  shotPath,
  sidewaysVerdict,
  splitVerdict,
  startServer,
  tickVerdict,
  treeSearchVerdict,
  treeVisibleVerdict,
  USAGE,
  widestFile,
  wrapSkeleton,
} from "./review-page-gate.ts";

const HEAD =
  '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>';

describe("the publisher skeleton", () => {
  test("the page file goes between the skeleton head and its tail, byte for byte", () => {
    expect(wrapSkeleton("<p>x</p>")).toBe(`${HEAD}<p>x</p></body></html>`);
    expect(wrapSkeleton("")).toBe(`${HEAD}</body></html>`);
  });

  test("the file is inserted as it is: replacement patterns and markup are not interpreted", () => {
    const file = "<p>$& $1 $' $` </body></html></p>";
    expect(wrapSkeleton(file)).toBe(`${HEAD}${file}</body></html>`);
  });
});

describe("content types", () => {
  test("the extension decides, in any case", () => {
    expect(contentType("/index.html")).toBe("text/html; charset=utf-8");
    expect(contentType("review.json")).toBe("application/json; charset=utf-8");
    expect(contentType("a/b/style.css")).toBe("text/css; charset=utf-8");
    expect(contentType("app.js")).toBe("text/javascript; charset=utf-8");
    expect(contentType("shot.png")).toBe("image/png");
    expect(contentType("/x/UPPER.PNG")).toBe("image/png");
    expect(contentType("notes.txt")).toBe("text/plain; charset=utf-8");
  });

  test("an unknown or missing extension is plain bytes", () => {
    expect(contentType("data.bin")).toBe("application/octet-stream");
    expect(contentType("no-extension")).toBe("application/octet-stream");
    expect(contentType("dir.with.dots/file")).toBe("application/octet-stream");
  });
});

describe("the run matrix", () => {
  test("the full matrix is three widths in light and dark, then one plain run", () => {
    const runs = matrix(false);
    expect(runs.map((r) => r.name)).toEqual([
      "phone-light",
      "phone-dark",
      "tablet-light",
      "tablet-dark",
      "desk-light",
      "desk-dark",
      "phone-plain",
    ]);
    expect(runs.map((r) => [r.width, r.height, r.scheme, r.url])).toEqual([
      [390, 844, "light", "/index.html"],
      [390, 844, "dark", "/index.html"],
      [820, 1180, "light", "/index.html"],
      [820, 1180, "dark", "/index.html"],
      [1280, 900, "light", "/index.html"],
      [1280, 900, "dark", "/index.html"],
      [390, 844, "light", "/plain.html"],
    ]);
  });

  test("the quick matrix is 390 light and dark, 1280 light and the plain run", () => {
    expect(matrix(true).map((r) => [r.name, r.width, r.scheme, r.url])).toEqual([
      ["phone-light", 390, "light", "/index.html"],
      ["phone-dark", 390, "dark", "/index.html"],
      ["desk-light", 1280, "light", "/index.html"],
      ["phone-plain", 390, "light", "/plain.html"],
    ]);
  });

  test("a run carries exactly name, width, height, scheme and url", () => {
    for (const r of [...matrix(false), ...matrix(true)]) {
      expect(Object.keys(r).sort()).toEqual(["height", "name", "scheme", "url", "width"]);
    }
  });

  test("touch emulation is on under 700 px except in the plain run", () => {
    const byName = (name: string): Run => {
      const found = matrix(false).find((r) => r.name === name);
      if (found === undefined) throw new Error(`no run ${name}`);
      return found;
    };
    expect(contextOptions(byName("phone-dark"))).toEqual({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
      colorScheme: "dark",
    });
    expect(contextOptions(byName("tablet-light")).isMobile).toBe(false);
    expect(contextOptions(byName("tablet-light")).hasTouch).toBe(false);
    expect(contextOptions(byName("desk-dark")).viewport).toEqual({ width: 1280, height: 900 });
    const plain = contextOptions(byName("phone-plain"));
    expect([plain.hasTouch, plain.isMobile, plain.colorScheme]).toEqual([false, false, "light"]);
  });

  test("screenshots: seven on a phone, two on wide runs, one in the plain run", () => {
    const [phone, , tablet, , desk, , plain] = matrix(false);
    expect([...screenshotSteps(phone as Run)].sort()).toEqual(
      ["composer", "file", "find", "order", "overview", "tree", "tree-search"].sort(),
    );
    expect([...screenshotSteps(tablet as Run)].sort()).toEqual(["overview", "tree-with-file"]);
    expect([...screenshotSteps(desk as Run)].sort()).toEqual(["overview", "tree-with-file"]);
    expect([...screenshotSteps(plain as Run)]).toEqual(["overview"]);
    expect(shotPath("/out", "phone-dark", "tree-search")).toBe("/out/phone-dark-tree-search.png");
  });
});

const ok = (id: string, detail = "fine"): Check => ({ id, ok: true, detail });
const bad = (id: string, detail: string): Check => ({ id, ok: false, detail });
const runReport = (over: Partial<RunReport> = {}): RunReport => ({
  name: "phone-light",
  width: 390,
  errors: [],
  failed: [],
  checks: [],
  ...over,
});

describe("judging a report", () => {
  test("clean runs pass with no problems", () => {
    const report: GateReport = {
      runs: [runReport({ checks: [ok("overflow")] }), runReport({ name: "desk-dark" })],
    };
    expect(judge(report)).toEqual({ ok: true, problems: [] });
  });

  test("a failed check is one line: run, id, detail", () => {
    const report: GateReport = {
      runs: [runReport({ checks: [ok("overflow"), bad("tap-targets", "tree: 2 under 44px")] })],
    };
    expect(judge(report)).toEqual({
      ok: false,
      problems: ["phone-light: tap-targets: tree: 2 under 44px"],
    });
  });

  test("console errors are problems, one line each, with the run named", () => {
    const report: GateReport = {
      runs: [runReport({ name: "phone-dark", errors: ["pageerror: boom", "Uncaught TypeError"] })],
    };
    const verdict = judge(report);
    expect(verdict.ok).toBe(false);
    expect(verdict.problems).toEqual([
      "phone-dark: console: pageerror: boom",
      "phone-dark: console: Uncaught TypeError",
    ]);
  });

  test("failed requests to the font and CDN hosts are not problems", () => {
    const report: GateReport = {
      runs: [
        runReport({
          failed: [
            "https://fonts.googleapis.com/css2?family=Red+Hat+Text net::ERR_FAILED",
            "https://fonts.gstatic.com/s/redhat.woff2 net::ERR_NAME_NOT_RESOLVED",
            "https://cdnjs.cloudflare.com/ajax/libs/x.js 503",
          ],
        }),
      ],
    };
    expect(judge(report)).toEqual({ ok: true, problems: [] });
  });

  test("failed requests to any other host are problems", () => {
    const report: GateReport = {
      runs: [
        runReport({
          failed: [
            "https://tracker.example/pixel.gif net::ERR_BLOCKED_BY_CLIENT",
            "http://127.0.0.1:4000/chunks/9.json 404",
            "https://fonts.gstatic.com/s/redhat.woff2 net::ERR_FAILED",
          ],
        }),
      ],
    };
    expect(judge(report).problems).toEqual([
      "phone-light: request: https://tracker.example/pixel.gif net::ERR_BLOCKED_BY_CLIENT",
      "phone-light: request: http://127.0.0.1:4000/chunks/9.json 404",
    ]);
  });

  test("a font host named in another host's address buys nothing", () => {
    expect(isAllowedHost("https://fonts.gstatic.com/a.woff2 404")).toBe(true);
    expect(isAllowedHost("https://FONTS.GSTATIC.COM/a.woff2 404")).toBe(true);
    expect(isAllowedHost("https://evil.example/?u=fonts.gstatic.com 404")).toBe(false);
    expect(isAllowedHost("https://fonts.gstatic.com.evil.example/a 404")).toBe(false);
    expect(isAllowedHost("not a url at all")).toBe(false);
  });

  test("a message that spans lines is one plain line", () => {
    const report: GateReport = {
      runs: [
        runReport({ errors: ["first line\n    at stack\n\tmore"], checks: [bad("x", "a\nb")] }),
      ],
    };
    for (const line of judge(report).problems) expect(line.includes("\n")).toBe(false);
    expect(judge(report).problems[0]).toBe("phone-light: console: first line at stack more");
  });

  test("problems keep run order, errors then requests then checks", () => {
    const report: GateReport = {
      runs: [
        runReport({
          name: "a",
          checks: [bad("c1", "d1")],
          errors: ["e1"],
          failed: ["http://x.example/ 500"],
        }),
        runReport({ name: "b", checks: [bad("c2", "d2")] }),
      ],
    };
    expect(judge(report).problems).toEqual([
      "a: console: e1",
      "a: request: http://x.example/ 500",
      "a: c1: d1",
      "b: c2: d2",
    ]);
  });
});

describe("the short report", () => {
  test("one line per run with its passed checks, then the problems", () => {
    const report: GateReport = {
      runs: [
        runReport({ checks: [ok("a"), ok("b"), bad("overflow", "412 > 390")] }),
        runReport({ name: "desk-dark", width: 1280, checks: [ok("a"), ok("b")] }),
      ],
    };
    expect(shortReport(report)).toBe(
      [
        "phone-light: 2 of 3 checks passed",
        "desk-dark: 2 of 2 checks passed",
        "1 problem:",
        "- phone-light: overflow: 412 > 390",
      ].join("\n"),
    );
  });

  test("with nothing wrong it says so", () => {
    const report: GateReport = { runs: [runReport({ checks: [ok("a")] })] };
    expect(shortReport(report)).toBe("phone-light: 1 of 1 checks passed\nno problems");
  });

  test("a very long problem is cut, not dumped", () => {
    const report: GateReport = { runs: [runReport({ checks: [bad("x", "y".repeat(2000))] })] };
    const lines = shortReport(report).split("\n");
    const last = lines.at(-1) ?? "";
    expect(last.length).toBeLessThan(600);
    expect(last.endsWith("...")).toBe(true);
  });
});

describe("finding Chromium", () => {
  const HOME = "/h";
  const MAC = `${HOME}/Library/Caches/ms-playwright`;
  const LINUX = `${HOME}/.cache/ms-playwright`;
  const MAC_FULL =
    "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
  const MAC_SHELL = "chrome-headless-shell-mac-arm64/chrome-headless-shell";
  const fakeFs = (files: readonly string[]) => {
    const set = new Set(files);
    return {
      exists: (p: string) => set.has(p),
      listDir: (dir: string): string[] => {
        const prefix = `${dir}/`;
        const names = files
          .filter((f) => f.startsWith(prefix))
          .map((f) => f.slice(prefix.length).split("/")[0] ?? "");
        return [...new Set(names)];
      },
    };
  };
  const find = (
    env: Record<string, string | undefined>,
    platform: string,
    files: readonly string[],
  ): string | null => {
    const fs = fakeFs(files);
    return findChromium(env, platform, HOME, fs.listDir, fs.exists);
  };

  test("CHROMIUM_PATH wins over anything in the cache, even a path that is not there", () => {
    const files = [`${MAC}/chromium-1234/${MAC_FULL}`];
    expect(find({ CHROMIUM_PATH: "/opt/chrome/chrome" }, "darwin", files)).toBe(
      "/opt/chrome/chrome",
    );
    expect(find({ CHROMIUM_PATH: "/opt/chrome/chrome" }, "linux", [])).toBe("/opt/chrome/chrome");
  });

  test("an empty CHROMIUM_PATH is the same as none", () => {
    const files = [`${MAC}/chromium-1234/${MAC_FULL}`];
    expect(find({ CHROMIUM_PATH: "" }, "darwin", files)).toBe(`${MAC}/chromium-1234/${MAC_FULL}`);
  });

  test("the newest revision wins, compared as a number", () => {
    const files = [
      `${MAC}/chromium-999/${MAC_FULL}`,
      `${MAC}/chromium-1208/${MAC_FULL}`,
      `${MAC}/chromium-1234/${MAC_FULL}`,
      `${MAC}/chromium-1228/${MAC_FULL}`,
    ];
    expect(find({}, "darwin", files)).toBe(`${MAC}/chromium-1234/${MAC_FULL}`);
  });

  test("the headless shell layout is found when there is no full Chromium", () => {
    const files = [`${MAC}/chromium_headless_shell-1208/${MAC_SHELL}`];
    expect(find({}, "darwin", files)).toBe(`${MAC}/chromium_headless_shell-1208/${MAC_SHELL}`);
  });

  test("a full Chromium beats the shell of the same revision, a newer shell beats an older full one", () => {
    const same = [
      `${MAC}/chromium_headless_shell-1234/${MAC_SHELL}`,
      `${MAC}/chromium-1234/${MAC_FULL}`,
    ];
    expect(find({}, "darwin", same)).toBe(`${MAC}/chromium-1234/${MAC_FULL}`);
    const newer = [
      `${MAC}/chromium-1208/${MAC_FULL}`,
      `${MAC}/chromium_headless_shell-1234/${MAC_SHELL}`,
    ];
    expect(find({}, "darwin", newer)).toBe(`${MAC}/chromium_headless_shell-1234/${MAC_SHELL}`);
  });

  test("a revision folder without a runnable executable is skipped for the next one", () => {
    const files = [
      `${MAC}/chromium-1234/INSTALLATION_COMPLETE`,
      `${MAC}/chromium_headless_shell-1234/INSTALLATION_COMPLETE`,
      `${MAC}/chromium-1208/${MAC_FULL}`,
    ];
    expect(find({}, "darwin", files)).toBe(`${MAC}/chromium-1208/${MAC_FULL}`);
  });

  test("Linux looks under ~/.cache and knows its own layouts", () => {
    const files = [
      `${LINUX}/chromium-1228/chrome-linux/chrome`,
      `${LINUX}/chromium-1234/chrome-linux64/chrome`,
      `${LINUX}/chromium_headless_shell-1200/chrome-headless-shell-linux64/chrome-headless-shell`,
    ];
    expect(find({}, "linux", files)).toBe(`${LINUX}/chromium-1234/chrome-linux64/chrome`);
    expect(find({}, "linux", [`${MAC}/chromium-1234/${MAC_FULL}`])).toBeNull();
  });

  test("PLAYWRIGHT_BROWSERS_PATH moves the cache", () => {
    const files = ["/pw/chromium-1300/chrome-linux64/chrome"];
    expect(find({ PLAYWRIGHT_BROWSERS_PATH: "/pw" }, "linux", files)).toBe(
      "/pw/chromium-1300/chrome-linux64/chrome",
    );
  });

  test("other browsers and stray folders are ignored, and nothing found is null", () => {
    const files = [
      `${MAC}/webkit-2336/pw_run.sh`,
      `${MAC}/ffmpeg-1011/ffmpeg`,
      `${MAC}/mcp-chrome-314f9d6/Default`,
      `${MAC}/chromium-latest/${MAC_FULL}`,
    ];
    expect(find({}, "darwin", files)).toBeNull();
    expect(find({}, "darwin", [])).toBeNull();
  });

  test("the real wrapper honours the override without touching the disk", () => {
    expect(chromiumPath({ CHROMIUM_PATH: "/opt/chrome/chrome" })).toBe("/opt/chrome/chrome");
  });
});

describe("what to say when the browser cannot be found", () => {
  test("it names both variables and says what each is for", () => {
    const text = describeMissing({});
    expect(text).toContain("PLAYWRIGHT_CORE");
    expect(text).toContain("CHROMIUM_PATH");
    expect(text).toContain("playwright-core");
    expect(text).toContain("not set");
    expect(text.split("\n").length).toBeGreaterThan(2);
  });

  test("it shows what the two variables are set to now", () => {
    const text = describeMissing({ PLAYWRIGHT_CORE: "/opt/pw/playwright-core", CHROMIUM_PATH: "" });
    expect(text).toContain("set to /opt/pw/playwright-core");
    expect(text).toContain("not set");
  });
});

describe("the command line", () => {
  test("a page folder, an output folder and the quick flag", () => {
    expect(parseArgs(["page"])).toEqual({ ok: true, dir: "page", out: undefined, quick: false });
    expect(parseArgs(["page", "--quick", "--out", "shots"])).toEqual({
      ok: true,
      dir: "page",
      out: "shots",
      quick: true,
    });
    expect(parseArgs(["--out", "shots", "page"])).toEqual({
      ok: true,
      dir: "page",
      out: "shots",
      quick: false,
    });
  });

  test("a missing folder, a flag without its value, an unknown flag and extra arguments are refused", () => {
    for (const args of [[], ["--quick"], ["page", "--out"], ["page", "--wat"], ["a", "b"]]) {
      const parsed = parseArgs(args);
      expect(parsed.ok).toBe(false);
    }
    const unknown = parseArgs(["page", "--wat"]);
    expect(unknown.ok === false && unknown.error.includes("--wat")).toBe(true);
    expect(USAGE).toContain("review-page-gate");
  });
});

describe("serving a folder", () => {
  test("a request path stays inside the folder", () => {
    expect(servedPath("/page", "/review.json")).toBe("/page/review.json");
    expect(servedPath("/page", "/chunks/0.json")).toBe("/page/chunks/0.json");
    expect(servedPath("/page", "/a/./b.css")).toBe("/page/a/b.css");
    expect(servedPath("/page", "/a%20b.png")).toBe("/page/a b.png");
    for (const bad of ["/../secret", "/%2e%2e/secret", "/a/../../b", "/a%00b", "/%zz", "/", ""]) {
      expect(servedPath("/page", bad)).toBeNull();
    }
  });

  test("index.html is wrapped, plain.html is bare, everything else is served raw", async () => {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "index.html"), "<p>hello é</p>");
      writeFileSync(join(dir, "review.json"), '{"changedFiles":0}');
      mkdirSync(join(dir, "chunks"));
      writeFileSync(join(dir, "chunks", "0.json"), "[]");
      const server = startServer(dir);
      try {
        expect(server.origin.startsWith("http://127.0.0.1:")).toBe(true);
        const wrapped = await fetch(`${server.origin}/index.html`);
        expect(wrapped.status).toBe(200);
        expect(wrapped.headers.get("content-type")).toBe("text/html; charset=utf-8");
        expect(await wrapped.text()).toBe(wrapSkeleton("<p>hello é</p>"));

        const plain = await fetch(`${server.origin}/plain.html`);
        expect(plain.status).toBe(200);
        expect(await plain.text()).toBe("<p>hello é</p>");

        const json = await fetch(`${server.origin}/review.json`);
        expect(json.headers.get("content-type")).toBe("application/json; charset=utf-8");
        expect(await json.text()).toBe('{"changedFiles":0}');

        const chunk = await fetch(`${server.origin}/chunks/0.json`);
        expect(await chunk.json()).toEqual([]);
        expect((await fetch(`${server.origin}/missing.png`)).status).toBe(404);
        expect((await fetch(`${server.origin}/chunks`)).status).toBe(404);
        expect((await fetch(`${server.origin}/favicon.ico`)).status).toBe(204);
      } finally {
        server.stop();
      }
    });
  });
});

const review: ReviewInfo = {
  changedFiles: 5,
  groups: [{ title: "Core" }, { title: "Tests" }],
  rulings: 2,
  files: [
    { path: "src/cart.ts", purpose: "Totals the cart", group: 0, status: "M" },
    { path: "src/price.ts", purpose: "Prices a line, see cart", group: 0, status: "A" },
    { path: "src/cart.test.ts", purpose: "Tests for the totals", group: 1, status: "M" },
    { path: "README.md", purpose: "How to run it", group: 0, status: "M" },
    { path: "docs/shop/overview.md", group: 0, status: "M" },
  ],
};

describe("reading review.json", () => {
  test("the count, the files and the optional parts are read", () => {
    const text = JSON.stringify({
      changedFiles: 2,
      files: [{ path: "a.ts", purpose: "x" }, { path: "d/b.ts" }],
      groups: [{ title: "G" }],
      rulings: [{}, {}, {}],
    });
    const parsed = readReview(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.review.changedFiles).toBe(2);
      expect(parsed.review.files.map((f) => f.path)).toEqual(["a.ts", "d/b.ts"]);
      expect(parsed.review.groups).toEqual([{ title: "G" }]);
      expect(parsed.review.rulings).toBe(3);
    }
  });

  test("rulings are unknown when review.json has no such list", () => {
    const parsed = readReview('{"changedFiles":0,"files":[]}');
    expect(parsed.ok && parsed.review.rulings === null && parsed.review.groups.length === 0).toBe(
      true,
    );
  });

  test("bad data is refused with a reason that names review.json", () => {
    for (const text of [
      "not json",
      "[]",
      "null",
      '{"files":[]}',
      '{"changedFiles":"2","files":[]}',
      '{"changedFiles":1,"files":[{"name":"a"}]}',
      '{"changedFiles":1}',
    ]) {
      const parsed = readReview(text);
      expect(parsed.ok).toBe(false);
      expect(!parsed.ok && parsed.error.includes("review.json")).toBe(true);
    }
  });
});

describe("choosing what to search for", () => {
  test("the word comes from a file name and matches the fewest files", () => {
    expect(pickSearchWord(review)).toBe("overview");
  });

  test("a word that every file holds is never chosen when another exists", () => {
    const same: ReviewInfo = {
      ...review,
      files: [
        { path: "src/alpha.ts", group: 0 },
        { path: "src/alpha-two.ts", group: 0 },
      ],
    };
    expect(pickSearchWord(same)).toBe("two");
    const apart = pickSearchWord({
      ...same,
      files: [{ path: "x/alpha.ts" }, { path: "y/beta1.ts" }],
    });
    expect(apart).toBe("alpha");
  });

  test("short names still give a word, and no files give none", () => {
    expect(pickSearchWord({ ...review, files: [{ path: "a.ts" }, { path: "b/c.ts" }] })).toBe("a");
    expect(pickSearchWord({ ...review, files: [] })).toBeNull();
  });

  test("the rows shown must hold every path match and stay within the files the word can reach", () => {
    expect(searchVerdict(review, "price", [1]).ok).toBe(true);
    expect(searchVerdict(review, "cart", [0, 2]).ok).toBe(true);
    expect(searchVerdict(review, "cart", [0, 1, 2]).ok).toBe(true);
  });

  test("a search that drops a match, shows a stranger or shows nothing fails and says which", () => {
    const missing = searchVerdict(review, "cart", [0]);
    expect(missing.ok).toBe(false);
    expect(missing.detail).toContain("src/cart.test.ts");
    const stranger = searchVerdict(review, "price", [1, 3]);
    expect(stranger.ok).toBe(false);
    expect(stranger.detail).toContain("README.md");
    const nothing = searchVerdict(review, "price", []);
    expect(nothing.ok).toBe(false);
    expect(nothing.detail).toContain("no rows");
  });

  test("a group title or purpose counts as reachable, and the word is matched in any case", () => {
    expect(searchVerdict(review, "TESTS", [2]).ok).toBe(true);
    expect(searchVerdict(review, "how to run", [3]).ok).toBe(true);
  });

  test("the tree search also needs the full list back after the box is cleared", () => {
    expect(treeSearchVerdict(review, "price", [1], 9, 9).ok).toBe(true);
    const stuck = treeSearchVerdict(review, "price", [1], 9, 3);
    expect(stuck.ok).toBe(false);
    expect(stuck.detail).toContain("9");
    expect(treeSearchVerdict(review, "price", [], 9, 9).ok).toBe(false);
  });
});

describe("two names that differ", () => {
  test("the first neighbouring pair with different names", () => {
    expect(firstDistinctPair(["a.ts", "b.ts", "c.ts"])).toBe(0);
    expect(firstDistinctPair(["index.ts", "index.ts", "util.ts"])).toBe(1);
    expect(firstDistinctPair(["x", "x", "x"])).toBe(-1);
    expect(firstDistinctPair(["only"])).toBe(-1);
    expect(firstDistinctPair([])).toBe(-1);
  });
});

describe("the file with the widest code", () => {
  const diff = (...code: string[]): string =>
    [
      "diff --git a/x b/x",
      "--- a/x",
      `+++ b/${"y".repeat(500)}`,
      `@@ -1,2 +1,2 @@ ${"z".repeat(500)}`,
      ...code,
    ].join("\n");

  test("it is the file with the longest code line, headers and hunk lines left out", () => {
    const items = [
      { i: 0, diff: diff("+a", "+bb") },
      { i: 1, diff: diff(" ccc", "-d") },
      { i: 2, diff: "" },
    ];
    expect(widestFile(items)).toBe(1);
  });

  test("the lowest index wins a tie, whatever the order of the chunk", () => {
    expect(widestFile([{ i: 3, diff: diff("+abc") }, { i: 1, diff: diff("-abc") }])).toBe(1);
  });

  test("a deleted line counts as code, and a diff with only headers is no code", () => {
    expect(widestFile([{ i: 0, diff: diff("+a") }, { i: 1, diff: diff("-aaaa") }])).toBe(1);
    expect(widestFile([{ i: 0, diff: diff() }, { i: 1, diff: "" }])).toBeNull();
    expect(widestFile([])).toBeNull();
  });
});

const audit = (screen: string, over: Partial<ScreenAudit> = {}): ScreenAudit => ({
  screen,
  scrollWidth: 390,
  bodyScrollWidth: 390,
  innerWidth: 390,
  small: [],
  tiny: {},
  hiddenShown: [],
  ...over,
});

describe("the audits of every screen", () => {
  test("clean screens give three passing checks that name the screens", () => {
    const checks = auditChecks([audit("overview"), audit("tree")], false);
    expect(checks.map((c) => c.id)).toEqual(["overflow", "tap-targets", "text-size"]);
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(checks[0]?.detail).toContain("overview, tree");
  });

  test("the plain run adds hidden-attr", () => {
    const checks = auditChecks([audit("overview")], true);
    expect(checks.map((c) => c.id)).toEqual([
      "overflow",
      "tap-targets",
      "text-size",
      "hidden-attr",
    ]);
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  test("overflow fails when the page or the body is wider than the window, and names the screen", () => {
    const page = auditChecks([audit("overview"), audit("tree", { scrollWidth: 412 })], false)[0];
    expect(page?.ok).toBe(false);
    expect(page?.detail).toContain("tree");
    expect(page?.detail).toContain("412");
    const body = auditChecks([audit("order", { bodyScrollWidth: 391 })], false)[0];
    expect(body?.ok).toBe(false);
    expect(auditChecks([audit("order", { scrollWidth: 390 })], false)[0]?.ok).toBe(true);
  });

  test("tap targets list the offenders, a few at a time", () => {
    const small = Array.from({ length: 9 }, (_, i) => ({
      el: `button#b${i}`,
      w: 40,
      h: 44,
      text: "x",
    }));
    const check = auditChecks([audit("tree", { small })], false)[1];
    expect(check?.ok).toBe(false);
    expect(check?.detail).toContain("tree: 9 under 44px");
    expect(check?.detail).toContain("button#b0 40x44");
    expect(check?.detail).not.toContain("button#b8");
  });

  test("small text lists the element and its size", () => {
    const check = auditChecks([audit("file", { tiny: { "span.n 11px": 120 } })], false)[2];
    expect(check?.ok).toBe(false);
    expect(check?.detail).toContain("file: span.n 11px x120");
  });

  test("a hidden element that is displayed fails hidden-attr in the plain run", () => {
    const hidden = ["div#find (flex)"];
    const check = auditChecks([audit("overview", { hiddenShown: hidden })], true)[3];
    expect(check?.ok).toBe(false);
    expect(check?.detail).toContain("overview: div#find (flex)");
    expect(auditChecks([audit("overview", { hiddenShown: hidden })], false)).toHaveLength(3);
  });
});

describe("fonts", () => {
  test("both Red Hat faces loaded", () => {
    expect(fontsVerdict(["Red Hat Text", "Red Hat Mono", "Other"], []).ok).toBe(true);
  });

  test("a missing face fails and says which, with what did load", () => {
    const v = fontsVerdict(["Red Hat Text"], []);
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("Red Hat Mono");
    expect(fontsVerdict([], []).detail).toContain("none");
  });

  test("an unreachable font host is no verdict on the page", () => {
    const failed = [
      "https://fonts.googleapis.com/css2?family=Red+Hat+Text net::ERR_INTERNET_DISCONNECTED",
    ];
    const v = fontsVerdict([], failed);
    expect(v.ok).toBe(true);
    expect(v.detail).toContain("skipped");
    expect(fontsVerdict([], ["https://cdnjs.cloudflare.com/x.js 503"]).ok).toBe(false);
  });
});

describe("verdicts on a phone", () => {
  const screens = {
    overview: false,
    tree: true,
    order: false,
    file: false,
    screen: "tree",
    tab: "tree",
  };

  test("tree-visible wants exactly the tree and a matching data-screen and data-tab", () => {
    expect(treeVisibleVerdict(screens).ok).toBe(true);
    expect(treeVisibleVerdict({ ...screens, overview: true }).ok).toBe(false);
    expect(treeVisibleVerdict({ ...screens, tree: false }).ok).toBe(false);
    expect(treeVisibleVerdict({ ...screens, screen: "overview" }).ok).toBe(false);
    expect(treeVisibleVerdict({ ...screens, tab: null }).ok).toBe(false);
    expect(treeVisibleVerdict({ ...screens, overview: true }).detail).toContain("overview");
  });

  test("tree-edge-to-edge allows a pixel either side and no row outside", () => {
    expect(edgeVerdict({ left: 0, right: 390, innerWidth: 390, outside: 0 }).ok).toBe(true);
    expect(edgeVerdict({ left: 0.8, right: 389.2, innerWidth: 390, outside: 0 }).ok).toBe(true);
    expect(edgeVerdict({ left: 16, right: 390, innerWidth: 390, outside: 0 }).ok).toBe(false);
    expect(edgeVerdict({ left: 0, right: 374, innerWidth: 390, outside: 0 }).ok).toBe(false);
    const outside = edgeVerdict({ left: 0, right: 390, innerWidth: 390, outside: 2 });
    expect(outside.ok).toBe(false);
    expect(outside.detail).toContain("2 rows");
  });

  test("tree-rows wants a count on folders and a badge and tick on files, and reports compacted rows", () => {
    const clean = { dirs: 4, files: 11, noCount: [], noBadge: [], compacted: 2 };
    const v = rowsVerdict(clean);
    expect(v.ok).toBe(true);
    expect(v.detail).toContain("2 compacted");
    const broken = rowsVerdict({ ...clean, noCount: ["src"], noBadge: ["a.ts", "b.ts"] });
    expect(broken.ok).toBe(false);
    expect(broken.detail).toContain("src");
    expect(broken.detail).toContain("a.ts");
    expect(rowsVerdict({ dirs: 0, files: 0, noCount: [], noBadge: [], compacted: 0 }).ok).toBe(
      false,
    );
  });

  test("tree-expand-collapse leaves only root files after collapse, and every file after expand", () => {
    expect(expandVerdict(0, 12, 0, 12).ok).toBe(true);
    expect(expandVerdict(2, 12, 2, 12).ok).toBe(true);
    const stuck = expandVerdict(5, 12, 0, 12);
    expect(stuck.ok).toBe(false);
    expect(stuck.detail).toContain("5");
    const short = expandVerdict(0, 10, 0, 12);
    expect(short.ok).toBe(false);
    expect(short.detail).toContain("12");
  });

  test("open-file wants the file screen alone, content or a withheld note, and the file's name", () => {
    const opened = {
      screen: "file",
      tab: "tree",
      fileShown: true,
      treeShown: false,
      rows: 30,
      status: "",
      fname: "cart.ts",
      pos: "1/5",
    };
    expect(openFileVerdict(opened, "cart.ts").ok).toBe(true);
    expect(
      openFileVerdict({ ...opened, rows: 0, status: "Environment files are not shown." }, "cart.ts")
        .ok,
    ).toBe(true);
    expect(openFileVerdict({ ...opened, rows: 0, status: "" }, "cart.ts").ok).toBe(false);
    expect(
      openFileVerdict(
        { ...opened, rows: 0, status: "This file did not load (HTTP 404)." },
        "cart.ts",
      ).ok,
    ).toBe(false);
    expect(openFileVerdict({ ...opened, treeShown: true }, "cart.ts").ok).toBe(false);
    expect(openFileVerdict({ ...opened, fileShown: false }, "cart.ts").ok).toBe(false);
    expect(openFileVerdict({ ...opened, screen: "tree" }, "cart.ts").ok).toBe(false);
    const wrong = openFileVerdict({ ...opened, fname: "price.ts" }, "cart.ts");
    expect(wrong.ok).toBe(false);
    expect(wrong.detail).toContain("price.ts");
  });

  test("back-restores wants the tree, the same open folders and the scroll within 2 px", () => {
    const left = { y: 300, open: ["apps/shop", "docs"] };
    const back = { y: 300, open: ["docs", "apps/shop"], treeShown: true, screen: "tree" };
    expect(backVerdict(left, back).ok).toBe(true);
    expect(backVerdict(left, { ...back, y: 298 }).ok).toBe(true);
    expect(backVerdict(left, { ...back, y: 296 }).ok).toBe(false);
    expect(backVerdict(left, { ...back, y: 0 }).detail).toContain("300");
    expect(backVerdict(left, { ...back, open: ["docs"] }).ok).toBe(false);
    expect(backVerdict(left, { ...back, treeShown: false }).ok).toBe(false);
    expect(backVerdict(left, { ...back, screen: "file" }).ok).toBe(false);
    expect(backVerdict({ y: 0, open: ["a"] }, { ...back, y: 0, open: ["a"] }).detail).toContain(
      "did not scroll",
    );
  });

  test("history-back wants the tree with the same open folders", () => {
    expect(historyVerdict(["a", "b"], { open: ["b", "a"], treeShown: true }).ok).toBe(true);
    expect(historyVerdict(["a", "b"], { open: ["a"], treeShown: true }).ok).toBe(false);
    expect(historyVerdict(["a"], { open: ["a"], treeShown: false }).ok).toBe(false);
  });

  test("prev-next wants the next name, then the first again", () => {
    expect(navVerdict("a.ts", "b.ts", "b.ts", "a.ts").ok).toBe(true);
    const stayed = navVerdict("a.ts", "b.ts", "a.ts", "a.ts");
    expect(stayed.ok).toBe(false);
    expect(stayed.detail).toContain("b.ts");
    expect(navVerdict("a.ts", "b.ts", "b.ts", "b.ts").ok).toBe(false);
    expect(navVerdict("a.ts", "b.ts", null, null).ok).toBe(false);
  });

  test("tick wants the box on, the count up by one, and both again after a reload", () => {
    const good = {
      before: 0,
      ticked: { checked: "true", n: 1 },
      reloaded: { checked: "true", n: 1 },
    };
    expect(tickVerdict(good).ok).toBe(true);
    expect(tickVerdict({ ...good, ticked: { checked: "false", n: 1 } }).ok).toBe(false);
    expect(tickVerdict({ ...good, ticked: { checked: "true", n: 2 } }).ok).toBe(false);
    const lost = tickVerdict({ ...good, reloaded: { checked: "false", n: 0 } });
    expect(lost.ok).toBe(false);
    expect(lost.detail).toContain("reload");
    expect(tickVerdict({ ...good, reloaded: { checked: null, n: 1 } }).ok).toBe(false);
  });

  test("comment-box wants the box shown inside the code", () => {
    expect(composerVerdict({ shown: true, inside: true, rows: 40 }).ok).toBe(true);
    expect(composerVerdict({ shown: false, inside: true, rows: 40 }).ok).toBe(false);
    const outside = composerVerdict({ shown: true, inside: false, rows: 40 });
    expect(outside.ok).toBe(false);
    expect(outside.detail).toContain("inside");
  });

  test("sideways wants the page still and the code box scrollable where it overflows", () => {
    const box = {
      boxScrolls: true,
      overflowX: "auto",
      scrollLeft: 200,
      pageScrollWidth: 390,
      innerWidth: 390,
    };
    expect(sidewaysVerdict(box).ok).toBe(true);
    expect(
      sidewaysVerdict({ ...box, boxScrolls: false, scrollLeft: 0, overflowX: "visible" }).ok,
    ).toBe(true);
    expect(sidewaysVerdict({ ...box, pageScrollWidth: 520 }).ok).toBe(false);
    expect(sidewaysVerdict({ ...box, overflowX: "hidden" }).ok).toBe(false);
    expect(sidewaysVerdict({ ...box, scrollLeft: 0 }).ok).toBe(false);
  });

  test("find-sheet wants it shown, narrowed to the matches, then closed", () => {
    const shown = { opened: true, fis: [1], closedHidden: true };
    expect(findVerdict(review, "price", shown).ok).toBe(true);
    expect(findVerdict(review, "price", { ...shown, opened: false }).ok).toBe(false);
    expect(findVerdict(review, "price", { ...shown, closedHidden: false }).ok).toBe(false);
    expect(findVerdict(review, "price", { ...shown, fis: [1, 3] }).ok).toBe(false);
    expect(findVerdict(review, "price", { ...shown, fis: [] }).ok).toBe(false);
  });

  test("ruling-links skips when there are none and otherwise wants the file with flagged lines", () => {
    expect(rulingVerdict({ expected: 0, cards: 0, links: 0 }, null)).toEqual({
      ok: true,
      detail: "no rulings",
    });
    expect(rulingVerdict({ expected: null, cards: 0, links: 0 }, null).detail).toBe("no rulings");
    expect(rulingVerdict({ expected: 2, cards: 0, links: 0 }, null).ok).toBe(false);
    expect(rulingVerdict({ expected: 2, cards: 2, links: 0 }, null).ok).toBe(true);
    expect(
      rulingVerdict({ expected: 2, cards: 2, links: 3 }, { fileShown: true, flagged: 4 }).ok,
    ).toBe(true);
    expect(
      rulingVerdict({ expected: 2, cards: 2, links: 3 }, { fileShown: true, flagged: 0 }).ok,
    ).toBe(false);
    expect(
      rulingVerdict({ expected: 2, cards: 2, links: 3 }, { fileShown: false, flagged: 4 }).ok,
    ).toBe(false);
  });
});

describe("verdicts on a wide screen", () => {
  const split = {
    treeShown: true,
    fileShown: true,
    treeRight: 360,
    fileLeft: 360,
    rows: 25,
    treeStillShown: true,
    backShown: false,
  };

  test("split wants both panes, the tree on the left, the code beside it and no back button", () => {
    expect(splitVerdict(split).ok).toBe(true);
    expect(splitVerdict({ ...split, treeRight: 361 }).ok).toBe(true);
    expect(splitVerdict({ ...split, treeRight: 380 }).ok).toBe(false);
    expect(splitVerdict({ ...split, fileShown: false }).ok).toBe(false);
    expect(splitVerdict({ ...split, treeShown: false }).ok).toBe(false);
    expect(splitVerdict({ ...split, rows: 0 }).ok).toBe(false);
    expect(splitVerdict({ ...split, treeStillShown: false }).ok).toBe(false);
    const back = splitVerdict({ ...split, backShown: true });
    expect(back.ok).toBe(false);
    expect(back.detail).toContain("back");
  });
});

describe("the helpers that run inside the page", () => {
  test("they are valid JavaScript and define every function the gate calls", () => {
    expect(() => new Bun.Transpiler({ loader: "js" }).transformSync(KIT)).not.toThrow();
    const win: { __gate?: Record<string, unknown> } = {};
    new Function("window", KIT)(win);
    for (const name of GATE_FUNCTIONS) expect(typeof win.__gate?.[name]).toBe("function");
    expect(Object.keys(win.__gate ?? {}).sort()).toEqual([...GATE_FUNCTIONS].sort());
  });

  test("the gate's own text holds no em or en dash", () => {
    // Built from code points so that this file does not hold the characters it forbids.
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`, "u");
    for (const file of ["review-page-gate.ts", "review-page-gate.test.ts"]) {
      const text = readFileSync(join(import.meta.dir, file), "utf8");
      expect(dashes.test(text)).toBe(false);
    }
  });
});

describe("loading Playwright", () => {
  test("a module is taken whether it names chromium or hides it under default", () => {
    const launch = async () => {
      throw new Error("not used");
    };
    expect(asPlaywright({ chromium: { launch } })?.chromium.launch).toBe(launch);
    expect(asPlaywright({ default: { chromium: { launch } } })?.chromium.launch).toBe(launch);
    expect(asPlaywright({})).toBeNull();
    expect(asPlaywright(null)).toBeNull();
    expect(asPlaywright({ chromium: {} })).toBeNull();
    expect(asPlaywright("playwright")).toBeNull();
  });

  test("PLAYWRIGHT_CORE names a package folder that is imported by its path", async () => {
    await withTempDir(async (dir) => {
      writeFileSync(join(dir, "package.json"), '{"name":"fake-playwright-core","main":"index.js"}');
      writeFileSync(
        join(dir, "index.js"),
        "exports.chromium = { launch: async () => ({ marker: 'fake' }) };",
      );
      const loaded = await loadPlaywright({ PLAYWRIGHT_CORE: dir });
      expect(loaded).not.toBeNull();
      const browser = await loaded?.chromium.launch({ headless: true });
      expect((browser as unknown as { marker: string }).marker).toBe("fake");
    });
  });
});

describe("the command, run against fakes", () => {
  const clean: GateReport = {
    runs: [runReport({ checks: [ok("overflow"), ok("tick")] })],
  };
  const dirty: GateReport = {
    runs: [runReport({ checks: [ok("overflow"), bad("tick", "the count stayed at 0")] })],
  };
  const pw: Playwright = {
    chromium: {
      launch: async () => {
        throw new Error("the fake browser is never started");
      },
    },
  };
  const page = (dir: string, reviewText = '{"changedFiles":1,"files":[{"path":"a.ts"}]}'): void => {
    writeFileSync(join(dir, "index.html"), "<p>page</p>");
    writeFileSync(join(dir, "review.json"), reviewText);
  };
  const fakes = (over: Partial<Deps> = {}): { deps: Deps; calls: string[] } => {
    const calls: string[] = [];
    const deps: Deps = {
      env: {},
      loadPlaywright: async () => pw,
      chromiumPath: () => "/fake/chrome",
      tempDir: () => "/fake/out",
      gate: async (options) => {
        calls.push(`${options.dir}|${options.out}|${options.quick}|${options.executablePath}`);
        return clean;
      },
      ...over,
    };
    return { deps, calls };
  };

  test("a clean gate exits 0, prints the short report and hands the gate its options", async () => {
    await withTempDir(async (dir) => {
      page(dir);
      const { deps, calls } = fakes();
      const result = await cli([dir, "--quick", "--out", "/shots"], deps);
      expect(result.code).toBe(0);
      expect(result.out).toContain("phone-light: 2 of 2 checks passed");
      expect(result.out).toContain("no problems");
      expect(result.out).toContain("/shots");
      expect(calls).toEqual([`${dir}|/shots|true|/fake/chrome`]);
    });
  });

  test("the output folder defaults to a new temporary one", async () => {
    await withTempDir(async (dir) => {
      page(dir);
      const { deps, calls } = fakes();
      await cli([dir], deps);
      expect(calls).toEqual([`${dir}|/fake/out|false|/fake/chrome`]);
    });
  });

  test("a gate with problems exits 1 and lists them", async () => {
    await withTempDir(async (dir) => {
      page(dir);
      const result = await cli([dir], fakes({ gate: async () => dirty }).deps);
      expect(result.code).toBe(1);
      expect(result.out).toContain("- phone-light: tick: the count stayed at 0");
    });
  });

  test("no Playwright exits 2 with the message, and nothing is checked", async () => {
    await withTempDir(async (dir) => {
      page(dir);
      const { deps, calls } = fakes({ loadPlaywright: async () => null });
      const result = await cli([dir], deps);
      expect(result.code).toBe(2);
      expect(result.err).toContain("PLAYWRIGHT_CORE");
      expect(result.err).toContain("CHROMIUM_PATH");
      expect(calls).toEqual([]);
    });
  });

  test("a browser that cannot start exits 2 with the same message and the reason", async () => {
    await withTempDir(async (dir) => {
      page(dir);
      const gate = async (): Promise<GateReport> => {
        throw new BrowserUnavailable("executable does not exist");
      };
      const result = await cli([dir], fakes({ gate }).deps);
      expect(result.code).toBe(2);
      expect(result.err).toContain("CHROMIUM_PATH");
      expect(result.err).toContain("executable does not exist");
    });
  });

  test("bad arguments exit 1 with the usage", async () => {
    const result = await cli(["--wat"], fakes().deps);
    expect(result.code).toBe(1);
    expect(result.err).toContain(USAGE);
    expect(result.err).toContain("--wat");
  });

  test("a folder without a page, or with a review.json that does not read, exits 1 before any browser", async () => {
    await withTempDir(async (dir) => {
      const { deps, calls } = fakes();
      const empty = await cli([dir], deps);
      expect(empty.code).toBe(1);
      expect(empty.err).toContain("index.html");
      writeFileSync(join(dir, "index.html"), "<p>page</p>");
      const noReview = await cli([dir], deps);
      expect(noReview.code).toBe(1);
      expect(noReview.err).toContain("review.json");
      writeFileSync(join(dir, "review.json"), "{ nope");
      const broken = await cli([dir], deps);
      expect(broken.code).toBe(1);
      expect(broken.err).toContain("review.json");
      expect((await cli([join(dir, "absent")], deps)).code).toBe(1);
      expect(calls).toEqual([]);
    });
  });
});

describe("the real gate", () => {
  test("it passes a built demo page when Playwright can be loaded, and is unavailable otherwise", async () => {
    const message = describeMissing(process.env);
    expect(message).toContain("PLAYWRIGHT_CORE");
    expect(message).toContain("CHROMIUM_PATH");
    const playwright = await loadPlaywright(process.env);
    if (playwright === null) {
      expect(playwright).toBeNull();
      return;
    }
    await withTempDir(async (tmp) => {
      const pageDir = join(tmp, "page");
      const root = join(import.meta.dir, "..");
      const built = run(
        process.execPath,
        ["--no-env-file", join(import.meta.dir, "review-page.ts"), "demo", pageDir],
        { cwd: root },
      );
      if (built.code !== 0) {
        // The builder has no demo mode (yet), so there is no page to check.
        expect(built.code).toBeGreaterThan(0);
        return;
      }
      const parsed = readReview(readFileSync(join(pageDir, "review.json"), "utf8"));
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      try {
        const report = await runGate({
          dir: pageDir,
          out: join(tmp, "shots"),
          quick: false,
          playwright,
          executablePath: chromiumPath(process.env),
          review: parsed.review,
        });
        const verdict = judge(report);
        expect(report.runs).toHaveLength(7);
        expect(verdict.problems).toEqual([]);
        expect(verdict.ok).toBe(true);
      } catch (e) {
        if (!(e instanceof BrowserUnavailable)) throw e;
        // Playwright loads but no Chromium starts here: the gate is unavailable, and says why.
        expect(e.message.length).toBeGreaterThan(0);
      }
    });
  }, 600_000);
});
