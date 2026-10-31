// Tests beside scripts/review-page-gate.ts. The pure parts (the publisher skeleton, the run matrix, the
// verdicts, the Chromium search, the report) run without a browser; the page server runs on loopback; the
// command line runs against fakes. One integration test drives the real gate when Playwright can be
// loaded, and otherwise asserts that Playwright is unavailable and says what to set.
import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { snapshotDescendants } from "./lib/processes.ts";
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
  type DiffLayoutFacts,
  type DiffRowFacts,
  diffLayoutVerdict,
  edgeVerdict,
  expandVerdict,
  failure,
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
  MAX_CODE_OFFSET,
  NUMBER_ALPHA_MAX,
  NUMBER_ALPHA_MIN,
  navVerdict,
  openAfterBackVerdict,
  openFileVerdict,
  parseArgs,
  type Playwright,
  type PwBrowser,
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
  type Verdict,
  WIDE_FROM,
  type WrapState,
  widestFile,
  wrapSkeleton,
  wrapVerdict,
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

/** The run of the full matrix with this name. */
const runNamed = (name: string): Run => {
  const found = matrix(false).find((r) => r.name === name);
  if (found === undefined) throw new Error(`no run ${name}`);
  return found;
};

describe("the run matrix", () => {
  test("the full matrix walks the single-pane widths up to 1199, the two-pane widths from 1200, then one plain run", () => {
    const runs = matrix(false);
    expect(runs.map((r) => r.name)).toEqual([
      "phone-light",
      "phone-dark",
      "w755-light",
      "w823-light",
      "w823-dark",
      "w904-light",
      "w1024-light",
      "w1199-light",
      "w1200-light",
      "desk-light",
      "desk-dark",
      "phone-plain",
    ]);
    expect(runs.map((r) => [r.width, r.height, r.scheme, r.url])).toEqual([
      [390, 844, "light", "/index.html"],
      [390, 844, "dark", "/index.html"],
      [755, 904, "light", "/index.html"],
      [823, 1000, "light", "/index.html"],
      [823, 1000, "dark", "/index.html"],
      [904, 755, "light", "/index.html"],
      [1024, 768, "light", "/index.html"],
      [1199, 800, "light", "/index.html"],
      [1200, 800, "light", "/index.html"],
      [1440, 900, "light", "/index.html"],
      [1440, 900, "dark", "/index.html"],
      [390, 844, "light", "/plain.html"],
    ]);
  });

  test("the quick matrix is 390 light and dark, the two sides of the split, and the plain run", () => {
    expect(matrix(true).map((r) => [r.name, r.width, r.scheme, r.url])).toEqual([
      ["phone-light", 390, "light", "/index.html"],
      ["phone-dark", 390, "dark", "/index.html"],
      ["w1199-light", 1199, "light", "/index.html"],
      ["w1200-light", 1200, "light", "/index.html"],
      ["phone-plain", 390, "light", "/plain.html"],
    ]);
  });

  test("a run carries exactly name, width, height, scheme and url", () => {
    for (const r of [...matrix(false), ...matrix(true)]) {
      expect(Object.keys(r).sort()).toEqual(["height", "name", "scheme", "url", "width"]);
    }
  });

  test("the page splits in two at 1200 px, so 1199 is the last single-pane width", () => {
    expect(WIDE_FROM).toBe(1200);
    const widths = matrix(false)
      .filter((r) => r.url === "/index.html")
      .map((r) => r.width);
    for (const width of [390, 755, 823, 904, 1024, WIDE_FROM - 1, WIDE_FROM, 1440]) {
      expect(widths).toContain(width);
    }
  });

  test("touch emulation is on under 1200 px except in the plain run", () => {
    expect(contextOptions(runNamed("phone-dark"))).toEqual({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
      colorScheme: "dark",
    });
    for (const name of ["w755-light", "w823-dark", "w904-light", "w1024-light", "w1199-light"]) {
      const options = contextOptions(runNamed(name));
      expect([name, options.hasTouch, options.isMobile]).toEqual([name, true, true]);
    }
    for (const name of ["w1200-light", "desk-light", "desk-dark"]) {
      const options = contextOptions(runNamed(name));
      expect([name, options.hasTouch, options.isMobile]).toEqual([name, false, false]);
    }
    expect(contextOptions(runNamed("desk-dark")).viewport).toEqual({ width: 1440, height: 900 });
    const plain = contextOptions(runNamed("phone-plain"));
    expect([plain.hasTouch, plain.isMobile, plain.colorScheme]).toEqual([false, false, "light"]);
  });

  test("screenshots: seven on every single-pane run, two on two-pane runs, one in the plain run", () => {
    const single = ["composer", "file", "find", "order", "overview", "tree", "tree-search"].sort();
    for (const name of ["phone-light", "w755-light", "w823-dark", "w904-light", "w1199-light"]) {
      expect([...screenshotSteps(runNamed(name))].sort()).toEqual(single);
    }
    for (const name of ["w1200-light", "desk-light", "desk-dark"]) {
      expect([...screenshotSteps(runNamed(name))].sort()).toEqual(["overview", "tree-with-file"]);
    }
    expect([...screenshotSteps(runNamed("phone-plain"))]).toEqual(["overview"]);
    expect(shotPath("/out", "phone-dark", "tree-search")).toBe("/out/phone-dark-tree-search.png");
  });
});

describe("the width where the page splits", () => {
  const page = join(import.meta.dir, "..", "skills", "review-pages", "page");
  const manifest = JSON.parse(readFileSync(join(page, "assets.json"), "utf8")) as {
    css: string[];
    js: string[];
  };
  // A width condition of a media query, in a stylesheet or in matchMedia("...").
  const QUERY = /\((?:min|max)-width:[ \t\r\n\f]*([0-9.]+)px\)/gu;
  const widthsIn = (files: readonly string[]): number[] =>
    files.flatMap((file) =>
      [...readFileSync(join(page, file), "utf8").matchAll(QUERY)].map((m) => Number(m[1])),
    );

  test("the stylesheets have one width query and it is WIDE_FROM", () => {
    expect(widthsIn(manifest.css)).toEqual([WIDE_FROM]);
  });

  test("the scripts have one width query and it is WIDE_FROM", () => {
    expect(widthsIn(manifest.js)).toEqual([WIDE_FROM]);
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

  test("an error or request that repeats within a run is one line with its count", () => {
    const report: GateReport = {
      runs: [
        runReport({
          errors: ["boom", "other", "boom", "boom"],
          failed: ["http://x.example/a 404", "http://x.example/a 404"],
        }),
        runReport({ name: "desk-dark", errors: ["boom"] }),
      ],
    };
    expect(judge(report).problems).toEqual([
      "phone-light: console: boom (x3)",
      "phone-light: console: other",
      "phone-light: request: http://x.example/a 404 (x2)",
      "desk-dark: console: boom",
    ]);
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

describe("failure messages", () => {
  test("a Playwright timeout keeps its first line and the reason the click did not land", () => {
    const message = [
      "locator.click: Timeout 10000ms exceeded.",
      "Call log:",
      "  - waiting for locator('#back')",
      "  -   element is visible, enabled and stable",
      '  -   <div id="find" class="find"></div> intercepts pointer events',
      "  - retrying click action",
    ].join("\n");
    expect(failure(new Error(message))).toBe(
      'locator.click: Timeout 10000ms exceeded. (<div id="find" class="find"></div> intercepts pointer events)',
    );
  });

  test("any other error is its first line, cut at 300 characters, and a string is its own text", () => {
    expect(failure(new Error("first\nsecond"))).toBe("first");
    expect(failure(new Error("x".repeat(1000))).length).toBe(300);
    expect(failure("plain text")).toBe("plain text");
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
    expect(
      widestFile([
        { i: 3, diff: diff("+abc") },
        { i: 1, diff: diff("-abc") },
      ]),
    ).toBe(1);
  });

  test("a deleted line counts as code, and a diff with only headers is no code", () => {
    expect(
      widestFile([
        { i: 0, diff: diff("+a") },
        { i: 1, diff: diff("-aaaa") },
      ]),
    ).toBe(1);
    expect(
      widestFile([
        { i: 0, diff: diff() },
        { i: 1, diff: "" },
      ]),
    ).toBeNull();
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
  clipped: [],
  hiddenShown: [],
  ...over,
});

describe("the audits of every screen", () => {
  test("clean screens give four passing checks that name the screens", () => {
    const checks = auditChecks([audit("overview"), audit("tree")], false);
    expect(checks.map((c) => c.id)).toEqual([
      "overflow",
      "tap-targets",
      "text-size",
      "clipped-controls",
    ]);
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(checks[0]?.detail).toContain("overview, tree");
    expect(checks[3]?.detail).toContain("overview, tree");
  });

  test("the plain run adds hidden-attr", () => {
    const checks = auditChecks([audit("overview")], true);
    expect(checks.map((c) => c.id)).toEqual([
      "overflow",
      "tap-targets",
      "text-size",
      "clipped-controls",
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
    expect(check?.detail).toContain('button#b0 40x44 "x"');
    expect(check?.detail).not.toContain("button#b8");
  });

  test("small text lists the element and its size", () => {
    const check = auditChecks([audit("file", { tiny: { "span.n 11px": 120 } })], false)[2];
    expect(check?.ok).toBe(false);
    expect(check?.detail).toContain("file: span.n 11px x120");
  });

  test("a control cut off by the window or a box around it fails clipped-controls, with the size of the cut", () => {
    const clipped = [{ el: "button#wrap.wrapbtn", cut: 14, text: "Wrap" }];
    const check = auditChecks([audit("overview"), audit("file", { clipped })], false)[3];
    expect(check?.ok).toBe(false);
    expect(check?.detail).toContain('file: 1 cut off: button#wrap.wrapbtn 14px "Wrap"');
    expect(check?.detail).not.toContain("overview");
  });

  test("clipped controls list the offenders a few at a time, and a control with no text is named by its element", () => {
    const clipped = Array.from({ length: 9 }, (_, i) => ({
      el: `button#c${i}`,
      cut: 3 + i,
      text: i === 0 ? "" : "x",
    }));
    const check = auditChecks([audit("tree", { clipped })], false)[3];
    expect(check?.ok).toBe(false);
    expect(check?.detail).toContain("tree: 9 cut off: button#c0 3px,");
    expect(check?.detail).toContain('button#c1 4px "x"');
    expect(check?.detail).not.toContain("button#c8");
  });

  test("a hidden element that is displayed fails hidden-attr in the plain run", () => {
    const hidden = ["div#find (flex)"];
    const check = auditChecks([audit("overview", { hiddenShown: hidden })], true)[4];
    expect(check?.ok).toBe(false);
    expect(check?.detail).toContain("overview: div#find (flex)");
    expect(auditChecks([audit("overview", { hiddenShown: hidden })], false)).toHaveLength(4);
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
    const repeated = fontsVerdict(["Red Hat Text", "Red Hat Text", "Red Hat Display"], []);
    expect(repeated.detail).toContain("loaded: Red Hat Text, Red Hat Display");
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

  test("open-after-back wants the file still on screen after a tap right after Back", () => {
    const opened = {
      screen: "file",
      tab: "tree",
      fileShown: true,
      treeShown: false,
      rows: 30,
      status: "",
      fname: "cart.ts",
    };
    expect(openAfterBackVerdict(opened, "cart.ts").ok).toBe(true);
    const closed = openAfterBackVerdict(
      { ...opened, screen: "tree", fileShown: false, treeShown: true, rows: 0, fname: null },
      "cart.ts",
    );
    expect(closed.ok).toBe(false);
    expect(closed.detail).toContain("right after Back");
    expect(closed.detail).toContain("not alone on screen");
    expect(openAfterBackVerdict({ ...opened, fname: "price.ts" }, "cart.ts").ok).toBe(false);
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
    expect(composerVerdict({ shown: true, inside: true }).ok).toBe(true);
    expect(composerVerdict({ shown: false, inside: true }).ok).toBe(false);
    const outside = composerVerdict({ shown: true, inside: false });
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

  test("wrap flips with each tap, the wrapped lines fit their box, and the page never scrolls sideways", () => {
    const off: WrapState = {
      pressed: "false",
      wrapped: false,
      boxScrolls: true,
      pageScrollWidth: 390,
      innerWidth: 390,
    };
    const on: WrapState = { ...off, pressed: "true", wrapped: true, boxScrolls: false };
    expect(wrapVerdict(off, on, off).ok).toBe(true);
    // A page that starts with the lines wrapped is as good: the taps flip it the other way first.
    expect(wrapVerdict(on, off, on).ok).toBe(true);
    // A tap that changes nothing, or a button and lines that disagree about it.
    expect(wrapVerdict(off, off, off).ok).toBe(false);
    expect(wrapVerdict(off, { ...on, wrapped: false }, off).ok).toBe(false);
    expect(wrapVerdict(off, { ...on, pressed: "false" }, off).ok).toBe(false);
    // A second tap that does not bring the first state back.
    expect(wrapVerdict(off, on, on).ok).toBe(false);
    // Lines that are wrapped and still scroll in their box.
    const still = wrapVerdict(off, { ...on, boxScrolls: true }, off);
    expect(still.ok).toBe(false);
    expect(still.detail).toContain("still scroll");
    // The page wider than the window in any of the three states.
    const wide = wrapVerdict(off, { ...on, pageScrollWidth: 520 }, off);
    expect(wide.ok).toBe(false);
    expect(wide.detail).toContain("520");
    expect(wrapVerdict({ ...off, pageScrollWidth: 391 }, on, off).ok).toBe(false);
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

describe("the diff rows", () => {
  // A row as the page should draw it: the number on a faint layer below the code, nothing in front
  // of the code, the code starting 8 px from the left edge.
  const row = (over: Partial<DiffRowFacts> = {}): DiffRowFacts => ({
    line: "20",
    parts: ["n", "c"],
    numberText: "20",
    gutter: 0,
    codeLeft: 8,
    numberZ: "0",
    codeZ: "1",
    numberEvents: "none",
    numberAlign: "center",
    numberAlpha: 0.22,
    numberX: 195,
    numberY: 300,
    rowY: 300,
    tap: "row",
    ...over,
  });
  const box = { left: 0, width: 390, scrollLeft: 0, scrolls: false };
  const facts = (rows: readonly DiffRowFacts[] = [row(), row({ line: "21", numberText: "21" })]) =>
    ({ box, rows }) satisfies DiffLayoutFacts;
  const verdict = (rows?: readonly DiffRowFacts[]) => diffLayoutVerdict(facts(rows), null, true);

  test("a number on a layer below the code, with nothing in front of the code, passes", () => {
    const v = verdict();
    expect(v.ok).toBe(true);
    expect(v.detail).toContain("2 rows");
    expect(v.detail).toContain("8px");
  });

  test("a page with no rows to look at fails, so the check cannot pass on nothing", () => {
    const v = diffLayoutVerdict(facts([]), null, true);
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("no diff rows");
  });

  test("a sign column fails and is named, so does a number element beside the first", () => {
    const sign = verdict([row({ parts: ["n", "sg", "c"] })]);
    expect(sign.ok).toBe(false);
    expect(sign.detail).toContain("sg");
    const twice = verdict([row({ parts: ["n", "n", "sg", "c"] })]);
    expect(twice.ok).toBe(false);
    expect(twice.detail).toContain("n n sg c");
    expect(verdict([row({ parts: ["c"] })]).ok).toBe(false);
    expect(verdict([row({ parts: ["c", "n"] })]).ok).toBe(false);
  });

  test("anything in front of the code fails, with how wide it is", () => {
    const v = verdict([row({ gutter: 53, codeLeft: 53 })]);
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("53px");
    expect(verdict([row({ gutter: 0.8 })]).ok).toBe(true);
  });

  test("the code starts at most 16 px from the left edge of the window", () => {
    expect(MAX_CODE_OFFSET).toBe(16);
    expect(verdict([row({ codeLeft: 16 })]).ok).toBe(true);
    const far = verdict([row({ codeLeft: 17 })]);
    expect(far.ok).toBe(false);
    expect(far.detail).toContain("17px");
    expect(far.detail).toContain("16px");
  });

  test("beside a tree pane the code is counted from the left edge of its own box", () => {
    // The box starts at 360 px and is 390 px wide, so its middle is at 555 px.
    const beside = { ...facts([row({ codeLeft: 368, numberX: 555 })]), box: { ...box, left: 360 } };
    expect(diffLayoutVerdict(beside, null, false).ok).toBe(true);
    expect(diffLayoutVerdict(beside, null, true).ok).toBe(false);
    const late = { ...beside, rows: [row({ codeLeft: 380, numberX: 555 })] };
    const v = diffLayoutVerdict(late, null, false);
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("20px");
  });

  test("the number must be below the code in stacking order", () => {
    expect(verdict([row({ numberZ: "-1", codeZ: "auto" })]).ok).toBe(true);
    expect(verdict([row({ numberZ: "auto", codeZ: "1" })]).ok).toBe(true);
    for (const [numberZ, codeZ] of [
      ["1", "auto"],
      ["1", "1"],
      ["auto", "auto"],
      ["2", "1"],
    ] as const) {
      const v = verdict([row({ numberZ, codeZ })]);
      expect([numberZ, codeZ, v.ok]).toEqual([numberZ, codeZ, false]);
      expect(v.detail).toContain("stacking order");
    }
  });

  test("the number never takes a tap", () => {
    const events = verdict([row({ numberEvents: "auto" })]);
    expect(events.ok).toBe(false);
    expect(events.detail).toContain("pointer-events");
    const landed = verdict([row({ tap: "number" })]);
    expect(landed.ok).toBe(false);
    expect(landed.detail).toContain("tap");
    expect(verdict([row({ tap: "none" })]).ok).toBe(true);
  });

  test("the number is the row's own line, centered across the box and down the row", () => {
    const wrongText = verdict([row({ numberText: "19" })]);
    expect(wrongText.ok).toBe(false);
    expect(wrongText.detail).toContain("19");
    expect(verdict([row({ numberText: null })]).ok).toBe(false);
    expect(verdict([row({ numberAlign: "right" })]).ok).toBe(false);
    expect(verdict([row({ numberX: 196.5 })]).ok).toBe(true);
    const left = verdict([row({ numberX: 40 })]);
    expect(left.ok).toBe(false);
    expect(left.detail).toContain("middle of the box");
    const high = verdict([row({ numberY: 291 })]);
    expect(high.ok).toBe(false);
    expect(high.detail).toContain("middle of its row");
  });

  test("the number is faint: seen, and never as loud as the code over it", () => {
    expect(NUMBER_ALPHA_MIN).toBeLessThan(NUMBER_ALPHA_MAX);
    expect(verdict([row({ numberAlpha: NUMBER_ALPHA_MIN })]).ok).toBe(true);
    expect(verdict([row({ numberAlpha: NUMBER_ALPHA_MAX })]).ok).toBe(true);
    const loud = verdict([row({ numberAlpha: 0.9 })]);
    expect(loud.ok).toBe(false);
    expect(loud.detail).toContain("too strong");
    const faint = verdict([row({ numberAlpha: 0.05 })]);
    expect(faint.ok).toBe(false);
    expect(faint.detail).toContain("too faint");
  });

  test("problems of many rows are one line each, counted", () => {
    const v = verdict([
      row({ parts: ["n", "sg", "c"] }),
      row({ parts: ["n", "sg", "c"] }),
      row({ parts: ["n", "sg", "c"] }),
      row(),
    ]);
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("3 of 4 rows");
  });

  test("on a box that scrolls sideways the number stays in the middle of what is shown", () => {
    const wide = { ...box, scrolls: true };
    const still = { box: { ...wide, scrollLeft: 200 }, rows: [row({ codeLeft: -192 })] };
    expect(diffLayoutVerdict({ box: wide, rows: facts().rows }, still, true).ok).toBe(true);
    const drifted = { box: { ...wide, scrollLeft: 200 }, rows: [row({ numberX: -5 })] };
    const gone = diffLayoutVerdict({ box: wide, rows: facts().rows }, drifted, true);
    expect(gone.ok).toBe(false);
    expect(gone.detail).toContain("scrolled sideways");
    const stuck = { box: { ...wide, scrollLeft: 0 }, rows: [row()] };
    const unmoved = diffLayoutVerdict({ box: wide, rows: facts().rows }, stuck, true);
    expect(unmoved.ok).toBe(false);
    expect(unmoved.detail).toContain("did not scroll");
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

/**
 * What this process still has running, once the browser has had a moment to go. The test preload looks
 * for children every 500 ms, so the wait also lets it see that none are left.
 */
async function lingering(): Promise<string[]> {
  await Bun.sleep(700);
  for (let attempt = 0; attempt < 25; attempt++) {
    const live = [...(await snapshotDescendants(process.pid)).values()].filter(
      (p) => !p.stat.startsWith("Z"),
    );
    if (live.length === 0) return [];
    await Bun.sleep(200);
  }
  const rest = await snapshotDescendants(process.pid);
  return [...rest.values()]
    .filter((p) => !p.stat.startsWith("Z"))
    .map((p) => p.command.slice(0, 120));
}

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
        expect(report.runs).toHaveLength(12);
        expect(verdict.problems).toEqual([]);
        expect(verdict.ok).toBe(true);
        // Every width below 1200 ran the single-pane checks, every width from 1200 the split check.
        const idsOf = (name: string): string[] =>
          report.runs.find((r) => r.name === name)?.checks.map((c) => c.id) ?? [];
        for (const name of ["phone-light", "w755-light", "w823-light", "w904-light"]) {
          for (const id of [
            "tree-visible",
            "open-file",
            "wrap-toggle",
            "clipped-controls",
            "diff-layout",
          ]) {
            expect(idsOf(name)).toContain(id);
          }
          expect(idsOf(name)).not.toContain("split");
        }
        for (const name of ["w1024-light", "w1199-light"]) {
          expect(idsOf(name)).toContain("tree-visible");
          expect(idsOf(name)).toContain("diff-layout");
          expect(idsOf(name)).not.toContain("split");
        }
        for (const name of ["w1200-light", "desk-light", "desk-dark"]) {
          expect(idsOf(name)).toContain("split");
          expect(idsOf(name)).toContain("diff-layout");
          expect(idsOf(name)).not.toContain("tree-visible");
        }
        // The plain run is only audited: it does not look at the rows.
        expect(idsOf("phone-plain")).not.toContain("diff-layout");
        expect(await lingering()).toEqual([]);
      } catch (e) {
        if (!(e instanceof BrowserUnavailable)) throw e;
        // Playwright loads but no Chromium starts here: the gate is unavailable, and says why.
        expect(e.message.length).toBeGreaterThan(0);
      }
    });
  }, 600_000);

  // The control for the clipped-controls audit: silent on the page as built, loud on the same page
  // made wrong, through the one command (window.__gate.audit) the gate uses.
  test("the clipped-controls audit is silent on the built page and names a Wrap button pushed out or cut off", async () => {
    const playwright = await loadPlaywright(process.env);
    if (playwright === null) {
      expect(describeMissing(process.env)).toContain("PLAYWRIGHT_CORE");
      return;
    }
    await withTempDir(async (tmp) => {
      const pageDir = join(tmp, "page");
      const built = run(
        process.execPath,
        ["--no-env-file", join(import.meta.dir, "review-page.ts"), "demo", pageDir],
        { cwd: join(import.meta.dir, "..") },
      );
      if (built.code !== 0) {
        // The builder has no demo mode (yet), so there is no page to try the audit on.
        expect(built.code).toBeGreaterThan(0);
        return;
      }
      const server = startServer(pageDir);
      let browser: PwBrowser | undefined;
      try {
        try {
          browser = await playwright.chromium.launch({
            headless: true,
            executablePath: chromiumPath(process.env),
          });
        } catch (e) {
          // Playwright loads but no Chromium starts here: the real gate's test says why.
          expect(failure(e).length).toBeGreaterThan(0);
          return;
        }
        const context = await browser.newContext(contextOptions(runNamed("w755-light")));
        await context.addInitScript(KIT);
        const page = await context.newPage();
        await page.goto(`${server.origin}/index.html`, { waitUntil: "load", timeout: 45_000 });
        const wait = (expression: string): Promise<unknown> =>
          page.waitForFunction(expression, undefined, { timeout: 30_000, polling: 50 });
        await wait('document.querySelectorAll("#tree .trow.file").length > 0');
        await page.click("#tab-tree");
        await wait("window.__gate.screens().tree");
        await page.click("#tree li.trow.file button.tgo");
        await wait("window.__gate.fileReady()");
        // The probe's style goes at the very end of the body, after the page's own style element
        // (the publisher puts the page inside the body), so that it wins a tie.
        const clipped = async (css: string): Promise<{ el: string; cut: number }[]> => {
          await page.evaluate(
            `document.getElementById("probe")?.remove(); const s = document.createElement("style"); s.id = "probe"; s.textContent = ${JSON.stringify(css)}; document.body.append(s)`,
          );
          const found = (await page.evaluate("window.__gate.audit()")) as {
            clipped: { el: string; cut: number }[];
          };
          return found.clipped;
        };
        // The page as built has nothing cut off at 755 px, with the Wrap button in view.
        expect(await clipped("")).toEqual([]);
        // The button pushed 60 px past the right edge of the window, and past the left edge.
        const pushedRight = await clipped("#wrap { position: relative; left: 60px }");
        expect(pushedRight.map((c) => c.el)).toEqual(["button#wrap.wrapbtn"]);
        expect(pushedRight[0]?.cut).toBeGreaterThanOrEqual(50);
        const pushedLeft = await clipped("#wrap { position: relative; left: -900px }");
        expect(pushedLeft.map((c) => c.el)).toEqual(["button#wrap.wrapbtn"]);
        // The button inside a head that clips what is wider than itself.
        const boxed = await clipped(
          ".file-head { overflow: hidden; width: 200px } .file-head .ftext { flex: none; width: 300px }",
        );
        expect(boxed.map((c) => c.el)).toContain("button#wrap.wrapbtn");
        // The probe taken away, the page is clean again.
        expect(await clipped("")).toEqual([]);
        await context.close();
      } finally {
        await browser?.close().catch(() => undefined);
        server.stop();
      }
      expect(await lingering()).toEqual([]);
    });
  });

  // The control for the diff-layout check: silent on the page as built, loud on the same page made
  // wrong with a style, one fault at a time, through the one command (window.__gate.diffLayout)
  // that the gate uses.
  test("the diff-layout check is silent on the built page and names each fault put into it", async () => {
    const playwright = await loadPlaywright(process.env);
    if (playwright === null) {
      expect(describeMissing(process.env)).toContain("PLAYWRIGHT_CORE");
      return;
    }
    await withTempDir(async (tmp) => {
      const pageDir = join(tmp, "page");
      const built = run(
        process.execPath,
        ["--no-env-file", join(import.meta.dir, "review-page.ts"), "demo", pageDir],
        { cwd: join(import.meta.dir, "..") },
      );
      if (built.code !== 0) {
        // The builder has no demo mode (yet), so there is no page to try the check on.
        expect(built.code).toBeGreaterThan(0);
        return;
      }
      const server = startServer(pageDir);
      let browser: PwBrowser | undefined;
      try {
        try {
          browser = await playwright.chromium.launch({
            headless: true,
            executablePath: chromiumPath(process.env),
          });
        } catch (e) {
          // Playwright loads but no Chromium starts here: the real gate's test says why.
          expect(failure(e).length).toBeGreaterThan(0);
          return;
        }
        const context = await browser.newContext(contextOptions(runNamed("phone-light")));
        await context.addInitScript(KIT);
        const page = await context.newPage();
        await page.goto(`${server.origin}/index.html`, { waitUntil: "load", timeout: 45_000 });
        const wait = (expression: string): Promise<unknown> =>
          page.waitForFunction(expression, undefined, { timeout: 30_000, polling: 50 });
        await wait('document.querySelectorAll("#tree .trow.file").length > 0');
        await page.click("#tab-tree");
        await wait("window.__gate.screens().tree");
        await page.click("#tree li.trow.file button.tgo");
        await wait("window.__gate.fileReady()");
        // The page sizes the layers behind the code from the box once the browser has laid it out.
        await wait("window.__gate.boxSized()");
        // The fault's style goes at the very end of the body, after the page's own style element, so
        // that it wins a tie. The box is measured at rest and scrolled sideways, as the gate does.
        const measure = async (css: string): Promise<Verdict> => {
          await page.evaluate(
            `document.getElementById("probe")?.remove(); const s = document.createElement("style"); s.id = "probe"; s.textContent = ${JSON.stringify(css)}; document.body.append(s)`,
          );
          const at = (await page.evaluate("window.__gate.diffLayout(0)")) as DiffLayoutFacts;
          const scrolled = at.box.scrolls
            ? ((await page.evaluate("window.__gate.diffLayout(200)")) as DiffLayoutFacts)
            : null;
          await page.evaluate("window.__gate.diffLayout(0)");
          return diffLayoutVerdict(at, scrolled, true);
        };
        const clean = await measure("");
        expect(clean.detail).toContain("pinned while the box scrolls sideways");
        expect(clean.ok).toBe(true);
        const faults: readonly (readonly [string, string])[] = [
          [".r .c { padding-left: 60px }", "from the left edge"],
          [".r .n { margin-right: 0; width: 40px }", "into its row"],
          [".r .n { z-index: 2 }", "stacking order"],
          [".r .n { pointer-events: auto }", "pointer-events"],
          [".r .n { text-align: left }", "text-align left"],
          [".r .n { color: rgba(28, 34, 48, .9) }", "too strong"],
          [".r .n { color: rgba(28, 34, 48, .05) }", "too faint"],
          [
            ".r { position: relative } .r .n { position: absolute; left: 0; top: 0; bottom: 0; margin: 0 }",
            "scrolled sideways",
          ],
        ];
        for (const [css, fragment] of faults) {
          const v = await measure(css);
          expect([css, v.ok]).toEqual([css, false]);
          expect([css, v.detail.includes(fragment)]).toEqual([css, true]);
        }
        // The faults taken away, the page is clean again.
        expect((await measure("")).ok).toBe(true);
        await context.close();
      } finally {
        await browser?.close().catch(() => undefined);
        server.stop();
      }
      expect(await lingering()).toEqual([]);
    });
  });
});
