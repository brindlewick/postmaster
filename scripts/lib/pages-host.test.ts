// Tests beside scripts/lib/pages-host.ts: the [pages] settings are read as docs/pages-contract.md says,
// a template is split before its values go in, and the commands run as argument lists with a
// stand-in host: a small script made here that records what it was given and prints what a test says.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  commandFor,
  describeFailure,
  execute,
  expandTemplate,
  isSlug,
  NO_PAGES,
  type PagesSettings,
  parsePages,
  slugOf,
  splitTemplate,
} from "./pages-host.ts";

/** The block the contract shows, as a settings file would hold it. */
const CONTRACT = {
  publish: "host-cli publish {file} --slug {slug}",
  comments: "host-cli comments {slug} --all --json",
  close: "host-cli close {id}",
  bridge: "page-bridge-v1",
  state: true,
};

const settings = (over: Partial<PagesSettings> = {}): PagesSettings => ({
  publish: "host-cli publish {file} --slug {slug}",
  comments: "host-cli comments {slug} --all --json",
  close: "host-cli close {id}",
  bridge: null,
  state: false,
  ...over,
});

const parsedOk = (raw: unknown): PagesSettings => {
  const r = parsePages(raw);
  if (!r.ok) throw new Error(`expected a block that reads, got: ${r.error}`);
  return r.value;
};

const parsedError = (raw: unknown): string => {
  const r = parsePages(raw);
  if (r.ok) throw new Error("expected a refusal");
  return r.error;
};

/** One test per row, named for its row (bun's test.each is not declared in types/bun.d.ts). */
function cases<T>(rows: readonly T[], name: (row: T) => string, body: (row: T) => void): void {
  for (const row of rows) test(name(row), () => body(row));
}

describe("parsePages: what the settings may hold", () => {
  test("no [pages] table reads as nothing set", () => {
    expect(parsedOk(undefined)).toEqual(NO_PAGES);
    expect(parsedOk({})).toEqual(NO_PAGES);
  });

  test("the block the contract shows reads as written", () => {
    expect(parsedOk(CONTRACT)).toEqual({
      publish: "host-cli publish {file} --slug {slug}",
      comments: "host-cli comments {slug} --all --json",
      close: "host-cli close {id}",
      bridge: "page-bridge-v1",
      state: true,
    });
  });

  test("only the keys it names are optional: each of the three commands may be left out", () => {
    expect(parsedOk({ publish: CONTRACT.publish })).toEqual({
      ...NO_PAGES,
      publish: CONTRACT.publish,
    });
    expect(parsedOk({ comments: CONTRACT.comments }).publish).toBeNull();
    expect(parsedOk({ close: CONTRACT.close }).comments).toBeNull();
  });

  test("a table that is not a table, and a key the contract does not have, name themselves", () => {
    expect(parsedError("host-cli publish")).toMatch(/^pages must be a table/u);
    expect(parsedError([1])).toMatch(/^pages must be a table/u);
    const e = parsedError({ ...CONTRACT, retries: 3 });
    expect(e).toContain("pages.retries");
    expect(e).toContain("publish, comments, close, bridge, state");
  });

  cases(
    [
      ["publish", "host-cli publish {file} --slug {slug} --as {user}", "{user}"],
      ["publish", "host-cli publish {path} --slug {slug}", "{path}"],
      ["comments", "host-cli comments {slug} --since {date}", "{date}"],
      ["comments", "host-cli comments {file}", "{file}"],
      ["close", "host-cli close {slug} {id}", "{slug}"],
      ["close", "host-cli close {} {id}", "{}"],
      ["publish", "host-cli publish {FILE} --slug {slug}", "{FILE}"],
    ],
    ([key, template]) => `an unknown placeholder stops with the key named: ${key}, ${template}`,
    ([key, template, name]) => {
      const e = parsedError({ ...CONTRACT, [key as string]: template });
      expect(e).toContain(`pages.${key}`);
      expect(e).toContain(name as string);
    },
  );

  cases(
    [
      ["publish", "host-cli publish {file}", "{slug}"],
      ["publish", "host-cli publish --slug {slug}", "{file}"],
      ["comments", "host-cli comments --json", "{slug}"],
      ["close", "host-cli close", "{id}"],
    ],
    ([key, template]) =>
      `a command that cannot say which page or comment it is for is refused: ${key}, ${template}`,
    ([key, template, missing]) => {
      const e = parsedError({ ...CONTRACT, [key as string]: template });
      expect(e).toContain(`pages.${key}`);
      expect(e).toContain(missing as string);
    },
  );

  test("a brace that is not a whole placeholder is refused rather than passed on", () => {
    expect(parsedError({ publish: "host-cli publish {file --slug {slug}" })).toContain(
      "pages.publish",
    );
    expect(parsedError({ publish: "host-cli publish file} --slug {slug}" })).toContain(
      "pages.publish",
    );
    expect(parsedError({ publish: "host-cli publish { file } --slug {slug}" })).toContain(
      "pages.publish",
    );
  });

  test("the first word is the program: fixed text, never a placeholder", () => {
    expect(parsedError({ publish: "{file} --slug {slug}" })).toContain("pages.publish");
    expect(parsedError({ publish: "host-{slug} publish {file}" })).toContain("pages.publish");
  });

  test("a template is text on a command line: not blank, not a number, no control characters", () => {
    expect(parsedError({ publish: "" })).toContain("pages.publish");
    expect(parsedError({ publish: "   " })).toContain("pages.publish");
    expect(parsedError({ publish: 7 })).toContain("pages.publish");
    expect(parsedError({ publish: ["host-cli", "{file}", "{slug}"] })).toContain("pages.publish");
    expect(parsedError({ publish: "host-cli publish {file} {slug}\u0000" })).toContain(
      "pages.publish",
    );
    expect(parsedError({ publish: "host-cli publish {file} {slug}\u001b[31m" })).toContain(
      "pages.publish",
    );
  });

  test("a template may run over lines, since a line break is whitespace", () => {
    const r = parsedOk({ publish: "host-cli publish\n  {file}\n  --slug {slug}" });
    expect(expandTemplate(r.publish ?? "", { file: "/p.html", slug: "s" })).toEqual([
      "host-cli",
      "publish",
      "/p.html",
      "--slug",
      "s",
    ]);
  });

  test("a bridge that names a version nobody defined stops with the key named", () => {
    const e = parsedError({ ...CONTRACT, bridge: "page-bridge-v2" });
    expect(e).toContain("pages.bridge");
    expect(e).toContain("page-bridge-v2");
    expect(e).toContain("page-bridge-v1");
    expect(parsedError({ ...CONTRACT, bridge: 1 })).toContain("pages.bridge");
    expect(parsedError({ ...CONTRACT, bridge: "" })).toContain("pages.bridge");
  });

  test("state is true or false, and only a bridge can offer it", () => {
    expect(parsedError({ ...CONTRACT, state: "yes" })).toContain("pages.state");
    expect(parsedError({ ...CONTRACT, state: 1 })).toContain("pages.state");
    const e = parsedError({ publish: CONTRACT.publish, state: true });
    expect(e).toContain("pages.state");
    expect(e).toContain("pages.bridge");
    expect(parsedOk({ publish: CONTRACT.publish, state: false }).state).toBe(false);
    expect(parsedOk({ ...CONTRACT, state: false }).state).toBe(false);
    expect(parsedOk({ ...CONTRACT, state: undefined }).state).toBe(false);
  });

  test("a bridge may be set without state: the viewer answers, but keeps nothing", () => {
    const r = parsedOk({ publish: CONTRACT.publish, bridge: "page-bridge-v1" });
    expect(r.bridge).toBe("page-bridge-v1");
    expect(r.state).toBe(false);
  });
});

describe("splitTemplate and expandTemplate: split first, then put the values in", () => {
  test("any run of whitespace between words is one split", () => {
    expect(splitTemplate("  a \t b\n\n c  ")).toEqual(["a", "b", "c"]);
  });

  const values = { file: "/work/page.html", slug: "review-x-1", id: "41" };

  test("each placeholder becomes the value, in the word it stands in", () => {
    expect(expandTemplate("host-cli publish {file} --slug {slug}", values)).toEqual([
      "host-cli",
      "publish",
      "/work/page.html",
      "--slug",
      "review-x-1",
    ]);
    expect(expandTemplate("host-cli publish --file={file} --slug={slug}", values)).toEqual([
      "host-cli",
      "publish",
      "--file=/work/page.html",
      "--slug=review-x-1",
    ]);
    expect(expandTemplate("host-cli close {id} {id}", values)).toEqual([
      "host-cli",
      "close",
      "41",
      "41",
    ]);
  });

  cases(
    [
      ["spaces", "a path with spaces/page.html"],
      ["a double quote", 'say "hi".html'],
      ["a single quote", "it's.html"],
      ["a semicolon", "a;b.html"],
      ["a command substitution", "$(touch pwned).html"],
      ["backticks", "`touch pwned`.html"],
      ["a pipe and a redirect", "a|b>c.html"],
      ["a glob", "*.html"],
      ["a line break", "line one\nline two.html"],
      ["a dash first", "-rf"],
      ["a dollar sign and a group", "$& $1 $$ $`"],
      ["a placeholder-looking text", "{slug}"],
      ["a tab", "a\tb.html"],
    ],
    ([what]) => `a value holding ${what} stays one argument, as written`,
    ([, value]) => {
      const argv = expandTemplate("host-cli publish {file} --slug {slug}", {
        file: value as string,
        slug: "s",
      });
      expect(argv).toEqual(["host-cli", "publish", value, "--slug", "s"]);
    },
  );

  test("a value is put in once: what it holds is not read as a placeholder", () => {
    const argv = expandTemplate("host-cli publish {file} --slug {slug}", {
      file: "{slug}",
      slug: "{file}",
    });
    expect(argv).toEqual(["host-cli", "publish", "{slug}", "--slug", "{file}"]);
  });
});

describe("commandFor: the argument list a setting makes, or none", () => {
  test("a command that is set is expanded; one that is not set is none", () => {
    expect(commandFor(settings(), "publish", { file: "/p.html", slug: "s" })).toEqual([
      "host-cli",
      "publish",
      "/p.html",
      "--slug",
      "s",
    ]);
    expect(
      commandFor(settings({ publish: null }), "publish", { file: "/p.html", slug: "s" }),
    ).toBeNull();
    expect(commandFor(NO_PAGES, "comments", { slug: "s" })).toBeNull();
    expect(commandFor(settings({ close: null }), "close", { id: "1" })).toBeNull();
  });
});

describe("slugOf and isSlug: a name any host can take", () => {
  test("parts join into lowercase letters, digits and single hyphens", () => {
    expect(slugOf(["review", "My_Repo.v2", "#12"])).toBe("review-my-repo-v2-12");
    expect(slugOf(["--x--"])).toBe("x");
    expect(slugOf(["code", "a b", "", "c"])).toBe("code-a-b-c");
  });

  test("at most 64 characters, and never a hyphen at the end", () => {
    const long = slugOf(["code", "a".repeat(80)]);
    expect(long.length).toBe(64);
    expect(isSlug(long)).toBe(true);
    expect(slugOf(["a".repeat(63), "b", "c"])).toBe("a".repeat(63));
  });

  test("nothing to make a name from gives no slug", () => {
    expect(slugOf([])).toBe("");
    expect(slugOf(["", "---", "!!"])).toBe("");
  });

  cases(
    [
      ["review-my-repo-12", true],
      ["a", true],
      ["a".repeat(64), true],
      ["a".repeat(65), false],
      ["", false],
      ["-a", false],
      ["a-", false],
      ["a--b", false],
      ["A-b", false],
      ["a_b", false],
      ["a b", false],
      ["a/b", false],
      ["--force", false],
    ] as const,
    ([value, expected]) => `isSlug(${JSON.stringify(value.slice(0, 20))}) is ${expected}`,
    ([value, expected]) => {
      expect(isSlug(value)).toBe(expected);
    },
  );
});

describe("describeFailure: what the person is shown when a command fails", () => {
  const result = (
    over: Partial<{ code: number; out: string; err: string; timedOut: boolean }>,
  ) => ({
    code: 1,
    out: "",
    err: "",
    timedOut: false,
    ...over,
  });

  test("the host's line is shown with the exit code, whatever stdout holds", () => {
    const text = describeFailure(
      "publish",
      result({ code: 3, out: "Title: X\nhttps://host.example/p\n", err: "quota exceeded\n" }),
      300,
    );
    expect(text).toContain("publish");
    expect(text).toContain("exit 3");
    expect(text).toContain("quota exceeded");
    expect(text).not.toContain("https://host.example/p");
  });

  test("a command with nothing on stderr says so", () => {
    expect(describeFailure("close", result({ code: 2 }), 60)).toContain("wrote nothing on stderr");
  });

  test("a command that is not there says which one", () => {
    const text = describeFailure(
      "publish",
      result({ code: 127, err: "host-cli: command not found\n" }),
      300,
    );
    expect(text).toContain("host-cli: command not found");
  });

  test("a command that ran out of time says how long it was given", () => {
    const text = describeFailure("publish", result({ code: 128, timedOut: true }), 300);
    expect(text).toContain("300 seconds");
  });

  test("a long stderr is cut, and terminal control characters are dropped", () => {
    const text = describeFailure(
      "publish",
      result({ err: `\u001b[2Jbad\n${"x".repeat(5000)}` }),
      300,
    );
    expect(text.length).toBeLessThan(2500);
    expect(text).not.toContain("\u001b");
    expect(text).toContain("bad");
  });
});

describe("execute: the commands run as argument lists with a stand-in host", () => {
  const dir = mkdtempSync(join(tmpdir(), "pages-host-"));
  const standIn = join(dir, "stand-in.js");
  const calls = join(dir, "calls.jsonl");
  const behavior = join(dir, "behavior.json");

  beforeAll(() => {
    writeFileSync(
      standIn,
      [
        'const fs = require("node:fs");',
        `const here = ${JSON.stringify(dir)};`,
        "const args = process.argv.slice(2);",
        'fs.appendFileSync(here + "/calls.jsonl", JSON.stringify(args) + "\\n");',
        'const all = JSON.parse(fs.readFileSync(here + "/behavior.json", "utf8"));',
        "const b = all[args[0]] || {};",
        'if (b.stderr) process.stderr.write(b.stderr + "\\n");',
        "if (b.stdout !== undefined) process.stdout.write(b.stdout);",
        "process.exit(b.exit || 0);",
        "",
      ].join("\n"),
    );
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const given = (b: Record<string, unknown>): void => {
    writeFileSync(behavior, JSON.stringify(b));
    rmSync(calls, { force: true });
  };
  const recorded = (): string[][] =>
    existsSync(calls)
      ? readFileSync(calls, "utf8")
          .split("\n")
          .filter((l) => l !== "")
          .map((l) => JSON.parse(l) as string[])
      : [];
  const template = (verb: string, rest: string): string =>
    `${process.execPath} ${standIn} ${verb} ${rest}`;

  test("the host is given each value as one argument, whatever it holds, and no shell reads it", () => {
    given({ publish: { stdout: "Title: X\nhttps://host.example/p\n" } });
    const marker = join(dir, "pwned");
    const nasty = [
      `a b; touch ${marker}`,
      `$(touch ${marker}).html`,
      `\`touch ${marker}\``,
      `x' && touch ${marker} && echo '`,
      `x" || touch ${marker} #`,
      "line one\nline two",
      `> ${marker}`,
      `* ? [a-z] ~ $HOME ${"${HOME}"}`,
    ];
    for (const value of nasty) {
      const argv = commandFor(
        settings({ publish: template("publish", "{file} --slug {slug}") }),
        "publish",
        {
          file: value,
          slug: "s",
        },
      );
      if (argv === null) throw new Error("expected a command");
      const r = execute(argv, { timeoutMs: 20_000 });
      expect(r.code).toBe(0);
    }
    expect(recorded()).toEqual(nasty.map((value) => ["publish", value, "--slug", "s"]));
    expect(existsSync(marker)).toBe(false);
  });

  test("a non-zero exit is a failure whatever stdout holds, and stderr comes back", () => {
    given({
      publish: { exit: 3, stdout: "Title: X\nhttps://host.example/p\n", stderr: "no room" },
    });
    const r = execute([process.execPath, standIn, "publish", "/p.html", "--slug", "s"], {
      timeoutMs: 20_000,
    });
    expect(r.code).toBe(3);
    expect(r.out).toContain("Title: X");
    expect(r.err).toContain("no room");
    expect(r.timedOut).toBe(false);
  });

  test("a command that does not exist is reported as not found, not thrown", () => {
    const r = execute(["pages-host-no-such-command", "publish"], { timeoutMs: 20_000 });
    expect(r.code).toBe(127);
    expect(r.err).toContain("not found");
  });

  test("a command that runs past its time is stopped", () => {
    writeFileSync(join(dir, "slow.js"), "setTimeout(() => {}, 30000);\n");
    const started = Date.now();
    const r = execute([process.execPath, join(dir, "slow.js")], { timeoutMs: 400 });
    expect(r.timedOut).toBe(true);
    expect(r.code).not.toBe(0);
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  test("the host is run where it is told, and gets no input to wait for", () => {
    writeFileSync(
      join(dir, "where.js"),
      'process.stdout.write(process.cwd() + "\\n" + (require("node:fs").readFileSync(0, "utf8") === "" ? "empty stdin" : "stdin had text"));\n',
    );
    const r = execute([process.execPath, join(dir, "where.js")], { timeoutMs: 20_000, cwd: dir });
    expect(statSync(r.out.split("\n")[0] ?? "").isDirectory()).toBe(true);
    expect(r.out).toContain("empty stdin");
  });
});
