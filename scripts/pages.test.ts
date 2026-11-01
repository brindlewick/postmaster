// Tests beside scripts/pages.ts: the command a session runs to publish a page, read the comments on
// it and close them. Every test runs the script as a process over a throwaway project whose
// .postmaster/settings.toml names a stand-in host: a small script made here that records the
// arguments it was given and prints what the test says. No real host is ever named or reached.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "./pages.ts";
import { type RunResult, run } from "./lib/proc.ts";

const SCRIPT = join(import.meta.dir, "pages.ts");

let tmp = "";
let standIn = "";
let calls = "";
let behavior = "";
let noConfig = "";
let decoys = "";
let decoyLog = "";

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "pages-test-"));
  standIn = join(tmp, "stand-in.js");
  calls = join(tmp, "calls.jsonl");
  behavior = join(tmp, "behavior.json");
  noConfig = join(tmp, "no-config.toml");
  writeFileSync(
    standIn,
    [
      'const fs = require("node:fs");',
      `const here = ${JSON.stringify(tmp)};`,
      "const args = process.argv.slice(2);",
      'fs.appendFileSync(here + "/calls.jsonl", JSON.stringify(args) + "\\n");',
      'const all = JSON.parse(fs.readFileSync(here + "/behavior.json", "utf8"));',
      "const b = all[args[0]] || {};",
      "if (b.byId && b.byId[args[1]]) Object.assign(b, b.byId[args[1]]);",
      'if (b.stderr) process.stderr.write(b.stderr + "\\n");',
      "if (b.stdout !== undefined) process.stdout.write(b.stdout);",
      "process.exit(b.exit || 0);",
      "",
    ].join("\n"),
  );
  // Programs a tool might reach for if it fell back to some host of its own: each records a call.
  decoys = join(tmp, "decoys");
  decoyLog = join(tmp, "decoy-calls.txt");
  mkdirSync(decoys);
  for (const name of ["host-cli", "other-host"]) {
    const path = join(decoys, name);
    writeFileSync(
      path,
      `#!/bin/sh\necho "${name} $*" >> "${decoyLog}"\necho "Title: Decoy"\necho "https://decoy.example/p"\n`,
    );
    chmodSync(path, 0o755);
  }
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const given = (b: Record<string, unknown>): void => {
  writeFileSync(behavior, JSON.stringify(b));
  rmSync(calls, { force: true });
  rmSync(decoyLog, { force: true });
};

const recorded = (): string[][] =>
  existsSync(calls)
    ? readFileSync(calls, "utf8")
        .split("\n")
        .filter((l) => l !== "")
        .map((l) => JSON.parse(l) as string[])
    : [];

const decoyCalls = (): string => (existsSync(decoyLog) ? readFileSync(decoyLog, "utf8") : "");

const via = (verb: string, rest: string): string =>
  `${process.execPath} ${standIn} ${verb} ${rest}`;

/** A [pages] block that runs the stand-in; the keys named in `without` are left out. */
function pagesBlock(extra = "", without: readonly string[] = []): string {
  const keys: Record<string, string> = {
    publish: via("publish", "{file} --slug {slug}"),
    comments: via("comments", "{slug} --all --json"),
    close: via("close", "{id}"),
  };
  const lines = Object.entries(keys)
    .filter(([key]) => !without.includes(key))
    .map(([key, value]) => `${key} = ${JSON.stringify(value)}`);
  return `[pages]\n${lines.join("\n")}\n${extra}`;
}

let counter = 0;
/** A project folder whose settings hold `settings`; null leaves it with none. */
function project(settings: string | null): string {
  counter += 1;
  const dir = join(tmp, `project-${counter}`);
  mkdirSync(join(dir, ".postmaster"), { recursive: true });
  if (settings !== null) writeFileSync(join(dir, ".postmaster", "settings.toml"), settings);
  return dir;
}

function pages(
  args: string[],
  cwd: string,
  env: Record<string, string | undefined> = {},
): RunResult {
  return run(process.execPath, [SCRIPT, ...args], {
    cwd,
    env: { POSTMASTER_CONFIG: noConfig, ...env },
  });
}

/** A page file in the project, to publish. */
function pageFile(dir: string, name = "index.html"): string {
  const path = join(dir, name);
  writeFileSync(path, "<title>A page</title><p>hello</p>\n");
  return path;
}

const PUBLISHED = {
  publish: { stdout: "Title: The review of the cart\nhttps://host.example/p/review-x\n" },
};

describe("parseArgs", () => {
  test("each command takes its own words, flags in any place", () => {
    expect(parseArgs(["publish", "p.html", "--slug", "s", "--marks"])).toEqual({
      ok: true,
      value: { command: "publish", file: "p.html", slug: "s", marks: true, project: null },
    });
    expect(parseArgs(["publish", "--project", "/r", "--slug", "s", "p.html"])).toEqual({
      ok: true,
      value: { command: "publish", file: "p.html", slug: "s", marks: false, project: "/r" },
    });
    expect(parseArgs(["comments", "s", "--all", "--json"])).toEqual({
      ok: true,
      value: { command: "comments", slug: "s", all: true, json: true, project: null },
    });
    expect(parseArgs(["close", "1", "2"])).toEqual({
      ok: true,
      value: { command: "close", ids: ["1", "2"], project: null },
    });
    expect(parseArgs(["slug", "review", "My Repo", "12"])).toEqual({
      ok: true,
      value: { command: "slug", parts: ["review", "My Repo", "12"] },
    });
    expect(parseArgs(["status"])).toEqual({
      ok: true,
      value: { command: "status", project: null },
    });
  });

  for (const [what, argv] of [
    ["no command", []],
    ["an unknown command", ["frobnicate"]],
    ["publish with no file", ["publish", "--slug", "s"]],
    ["publish with no slug", ["publish", "p.html"]],
    ["publish with two files", ["publish", "a.html", "b.html", "--slug", "s"]],
    ["a flag with no value", ["publish", "p.html", "--slug"]],
    ["an unknown flag", ["publish", "p.html", "--slug", "s", "--force"]],
    ["comments with no slug", ["comments"]],
    ["comments with two slugs", ["comments", "a", "b"]],
    ["close with no id", ["close"]],
    ["slug with no part", ["slug"]],
    ["status with a word", ["status", "now"]],
  ] as const) {
    test(`${what} is a usage error`, () => {
      const r = parseArgs([...argv]);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("usage: run pages");
    });
  }
});

describe("pages publish", () => {
  test("hands the file and the slug to the host's publish command and names the page by its exact title and link", () => {
    given(PUBLISHED);
    const dir = project(pagesBlock());
    const file = pageFile(dir);
    const r = pages(["publish", file, "--slug", "review-x-1"], dir);
    expect(r.code).toBe(0);
    expect(r.out).toBe("Title: The review of the cart\nhttps://host.example/p/review-x\n");
    expect(recorded()).toEqual([["publish", file, "--slug", "review-x-1"]]);
  });

  test("a relative file is made absolute before the host sees it", () => {
    given(PUBLISHED);
    const dir = project(pagesBlock());
    pageFile(dir, "page.html");
    const r = pages(["publish", "page.html", "--slug", "s"], dir);
    expect(r.code).toBe(0);
    const seen = recorded()[0]?.[1] ?? "";
    expect(seen.startsWith("/")).toBe(true);
    expect(seen.endsWith("/page.html")).toBe(true);
  });

  test("a file named with spaces, quotes, a semicolon, a command substitution or a line break reaches the host as one argument", () => {
    given(PUBLISHED);
    const dir = project(pagesBlock());
    const marker = join(dir, "pwned");
    const names = [
      "two words.html",
      `it's "quoted".html`,
      "semi; touch pwned #.html",
      "sub $(touch pwned).html",
      "tick `touch pwned`.html",
      "line\nbreak.html",
    ];
    const wanted: string[][] = [];
    for (const name of names) {
      const file = pageFile(dir, name);
      expect(pages(["publish", file, "--slug", "s"], dir).code).toBe(0);
      wanted.push(["publish", file, "--slug", "s"]);
    }
    expect(recorded()).toEqual(wanted);
    expect(existsSync(marker)).toBe(false);
  });

  test("a host that exits non-zero has failed, whatever it printed, and its words are shown", () => {
    given({
      publish: {
        exit: 3,
        stdout: "Title: Looks fine\nhttps://host.example/p\n",
        stderr: "quota exceeded",
      },
    });
    const dir = project(pagesBlock());
    const r = pages(["publish", pageFile(dir), "--slug", "s"], dir);
    expect(r.code).toBe(1);
    expect(r.err).toContain("quota exceeded");
    expect(r.err).toContain("exit 3");
    expect(r.out).toBe("");
  });

  test("a host that exits 0 but prints no title and link has not published, and the tool says what it wanted", () => {
    given({ publish: { stdout: "done\n" } });
    const dir = project(pagesBlock());
    const r = pages(["publish", pageFile(dir), "--slug", "s"], dir);
    expect(r.code).toBe(1);
    expect(r.err).toContain("Title:");
    expect(r.err).toContain("next line");
    expect(r.out).toBe("");
  });

  test("with no publish command set, nothing runs and the error names the key and the page's place", () => {
    given(PUBLISHED);
    for (const settings of [
      null,
      "",
      pagesBlock("", ["publish"]),
      '[pages]\nbridge = "page-bridge-v1"\n',
    ]) {
      const dir = project(settings);
      const file = pageFile(dir);
      const r = pages(["publish", file, "--slug", "s"], dir);
      expect(r.code).toBe(2);
      expect(r.out).toBe("");
      expect(r.err).toContain("no publish command is set");
      expect(r.err).toContain("publish");
      expect(r.err).toContain("[pages]");
      expect(r.err).toContain(file);
      expect(r.err).toContain("docs/pages-contract.md");
    }
    expect(recorded()).toEqual([]);
  });

  test("the tool falls back to no other host: with nothing set, no program of any name is run", () => {
    given(PUBLISHED);
    const dir = project(null);
    const env = { PATH: `${decoys}:${process.env.PATH ?? ""}` };
    // Positive control: a decoy on this path does record a call when something runs it.
    run("host-cli", ["probe"], { env });
    run("other-host", ["probe"], { env });
    expect(decoyCalls()).toBe("host-cli probe\nother-host probe\n");
    given(PUBLISHED);
    const file = pageFile(dir);
    expect(pages(["publish", file, "--slug", "s"], dir, env).code).toBe(2);
    expect(pages(["comments", "s"], dir, env).code).toBe(0);
    expect(pages(["close", "41"], dir, env).code).toBe(0);
    expect(pages(["status"], dir, env).code).toBe(2);
    expect(decoyCalls()).toBe("");
    expect(recorded()).toEqual([]);
  });

  test("with only the other commands set, a decoy host on the path is still not run", () => {
    given(PUBLISHED);
    const dir = project(pagesBlock("", ["publish"]));
    const env = { PATH: `${decoys}:${process.env.PATH ?? ""}` };
    expect(pages(["publish", pageFile(dir), "--slug", "s"], dir, env).code).toBe(2);
    expect(decoyCalls()).toBe("");
  });

  test("a block that does not read stops with the key named, before anything runs", () => {
    given(PUBLISHED);
    const dir = project('[pages]\npublish = "host-cli publish {file} --slug {slug} --as {user}"\n');
    const r = pages(["publish", pageFile(dir), "--slug", "s"], dir);
    expect(r.code).toBe(1);
    expect(r.err).toContain("pages.publish");
    expect(r.err).toContain("{user}");
    const dir2 = project(`${pagesBlock()}bridge = "page-bridge-v9"\n`);
    const r2 = pages(["publish", pageFile(dir2), "--slug", "s"], dir2);
    expect(r2.code).toBe(1);
    expect(r2.err).toContain("pages.bridge");
    expect(recorded()).toEqual([]);
  });

  test("a slug a host might take for an option, or any host might refuse, is refused before anything runs", () => {
    given(PUBLISHED);
    const dir = project(pagesBlock());
    const file = pageFile(dir);
    for (const slug of ["--force", "-x", "Has Caps", "a_b", "a/b", "", "a".repeat(65)]) {
      const r = pages(["publish", file, "--slug", slug], dir);
      expect(r.code).toBe(1);
      expect(r.err).toContain("slug");
    }
    expect(recorded()).toEqual([]);
  });

  test("a file that is not there, or is a folder, is refused before anything runs", () => {
    given(PUBLISHED);
    const dir = project(pagesBlock());
    expect(pages(["publish", join(dir, "missing.html"), "--slug", "s"], dir).code).toBe(1);
    expect(pages(["publish", dir, "--slug", "s"], dir).code).toBe(1);
    expect(recorded()).toEqual([]);
  });

  test("ticks are promised only when state is set, and only for a page that has them", () => {
    given(PUBLISHED);
    const withState = project(pagesBlock('bridge = "page-bridge-v1"\nstate = true\n'));
    const noState = project(pagesBlock('bridge = "page-bridge-v1"\n'));
    const none = project(pagesBlock());
    const kept = pages(["publish", pageFile(withState), "--slug", "s", "--marks"], withState);
    expect(kept.out).toContain("kept between visits");
    for (const dir of [noState, none]) {
      const r = pages(["publish", pageFile(dir), "--slug", "s", "--marks"], dir);
      expect(r.code).toBe(0);
      expect(r.out).not.toContain("kept between visits");
      expect(r.out).toContain("pages.state");
    }
    const plain = pages(["publish", pageFile(withState), "--slug", "s"], withState);
    expect(plain.out).toBe("Title: The review of the cart\nhttps://host.example/p/review-x\n");
  });

  test("the machine config's [pages] is used when the project sets none, and the project's keys win", () => {
    given(PUBLISHED);
    const machine = join(tmp, "machine-pages.toml");
    writeFileSync(machine, pagesBlock());
    const dir = project(null);
    const r = pages(["publish", pageFile(dir), "--slug", "s"], dir, { POSTMASTER_CONFIG: machine });
    expect(r.code).toBe(0);
    expect(recorded()).toHaveLength(1);
    given(PUBLISHED);
    const own = project(
      `[pages]\npublish = ${JSON.stringify(via("own-publish", "{file} --slug {slug}"))}\n`,
    );
    expect(
      pages(["publish", pageFile(own), "--slug", "s"], own, { POSTMASTER_CONFIG: machine }).code,
    ).toBe(1);
    expect(recorded()[0]?.[0]).toBe("own-publish");
  });

  test("--project names the project whose settings are read, wherever the command runs", () => {
    given(PUBLISHED);
    const dir = project(pagesBlock());
    const elsewhere = project(null);
    const file = pageFile(elsewhere);
    const r = pages(["publish", file, "--slug", "s", "--project", dir], elsewhere);
    expect(r.code).toBe(0);
    expect(recorded()).toEqual([["publish", file, "--slug", "s"]]);
  });
});

describe("pages comments", () => {
  const COMMENTS = [
    {
      id: 41,
      status: "open",
      author: "reviewer",
      body: "Why is this retried?",
      createdAt: "2026-10-31T09:12:00Z",
      version: 3,
      reaction: "thumbs",
      anchor: { kind: "line", file: "src/retry.ts", side: "new", from: 18, to: 22, sha: "abc" },
    },
    {
      id: 42,
      status: "closed",
      author: "",
      body: "Typo.",
      createdAt: "2026-10-31T09:15:40Z",
      version: 3,
      anchor: { kind: "text", quote: "recieve", prefix: "will ", suffix: " the reply" },
    },
    {
      id: "c-7",
      status: "open",
      author: "reviewer",
      body: "A comment on a place this tool has no word for.",
      createdAt: "2026-10-31T10:00:00Z",
      version: 4,
      anchor: { kind: "region", x: 1, y: 2 },
    },
  ];

  test("lists the open comments with where each points, and asks the host for the slug's comments", () => {
    given({ comments: { stdout: JSON.stringify(COMMENTS) } });
    const dir = project(pagesBlock());
    const r = pages(["comments", "review-x"], dir);
    expect(r.code).toBe(0);
    expect(recorded()).toEqual([["comments", "review-x", "--all", "--json"]]);
    expect(r.out).toContain("2 open comments on review-x");
    expect(r.out).toContain("41 open, reviewer, 2026-10-31T09:12:00Z, version 3");
    expect(r.out).toContain("on src/retry.ts, new side, lines 18 to 22");
    expect(r.out).toContain("Why is this retried?");
    expect(r.out).toContain("c-7 open");
    expect(r.out).toContain("not anchored to a place on the page");
    expect(r.out).not.toContain("Typo.");
  });

  test("--all lists the closed ones too", () => {
    given({ comments: { stdout: JSON.stringify(COMMENTS) } });
    const dir = project(pagesBlock());
    const r = pages(["comments", "review-x", "--all"], dir);
    expect(r.out).toContain("3 comments on review-x");
    expect(r.out).toContain("42 closed");
    expect(r.out).toContain('on the text "recieve"');
  });

  test("--json prints the comments in one shape, without the fields the tool does not know, a place it has no word for as none", () => {
    given({ comments: { stdout: JSON.stringify(COMMENTS) } });
    const dir = project(pagesBlock());
    const r = pages(["comments", "review-x", "--all", "--json"], dir);
    expect(r.code).toBe(0);
    const list = JSON.parse(r.out) as Record<string, unknown>[];
    expect(list.map((c) => c.id)).toEqual([41, 42, "c-7"]);
    expect(Object.keys(list[0] ?? {})).not.toContain("reaction");
    expect(list[0]?.anchor).toEqual({
      kind: "line",
      file: "src/retry.ts",
      side: "new",
      from: 18,
      to: 22,
    });
    expect(list[2]?.anchor).toBeNull();
    const open = JSON.parse(pages(["comments", "review-x", "--json"], dir).out) as {
      id: unknown;
    }[];
    expect(open.map((c) => c.id)).toEqual([41, "c-7"]);
  });

  test("an empty array is no comments, and says so", () => {
    given({ comments: { stdout: "[]\n" } });
    const dir = project(pagesBlock());
    const r = pages(["comments", "review-x"], dir);
    expect(r.code).toBe(0);
    expect(r.out).toBe("No open comments on review-x.\n");
    expect(pages(["comments", "review-x", "--all"], dir).out).toBe("No comments on review-x.\n");
    expect(JSON.parse(pages(["comments", "review-x", "--json"], dir).out)).toEqual([]);
  });

  test("a host that fails, or prints something that is not one array, is an error with its words shown", () => {
    const dir = project(pagesBlock());
    given({ comments: { exit: 4, stdout: "[]", stderr: "no such page" } });
    const failed = pages(["comments", "review-x"], dir);
    expect(failed.code).toBe(1);
    expect(failed.err).toContain("no such page");
    expect(failed.out).toBe("");
    given({ comments: { stdout: "no comments yet\n" } });
    const text = pages(["comments", "review-x"], dir);
    expect(text.code).toBe(1);
    expect(text.err).toContain("one JSON array");
  });

  test("an element with no usable id is left out and counted aloud", () => {
    given({ comments: { stdout: JSON.stringify([COMMENTS[0], { body: "no id" }, 7]) } });
    const dir = project(pagesBlock());
    const r = pages(["comments", "review-x"], dir);
    expect(r.code).toBe(0);
    expect(r.out).toContain("1 open comment on review-x");
    expect(r.err).toContain("2 elements");
  });

  test("with no comments command, the tool says it cannot read comments for this host and goes on", () => {
    given({ comments: { stdout: JSON.stringify(COMMENTS) } });
    const dir = project(pagesBlock("", ["comments"]));
    const r = pages(["comments", "review-x"], dir);
    expect(r.code).toBe(0);
    expect(r.out).toContain("cannot read comments for this host");
    expect(r.out).toContain("comments");
    const json = pages(["comments", "review-x", "--json"], dir);
    expect(json.code).toBe(0);
    expect(JSON.parse(json.out)).toEqual([]);
    expect(json.err).toContain("cannot read comments for this host");
    expect(recorded()).toEqual([]);
  });

  test("a slug that is not a slug is refused before anything runs", () => {
    given({ comments: { stdout: "[]" } });
    const dir = project(pagesBlock());
    for (const slug of ["--all", "-x", "A b", ""]) {
      const r = pages(["comments", slug], dir);
      expect(r.code).toBe(1);
      expect(r.err).toContain("slug");
    }
    expect(recorded()).toEqual([]);
  });

  test("terminal control characters in a comment are not printed", () => {
    given({
      comments: {
        stdout: JSON.stringify([{ ...COMMENTS[0], body: "red \u001b[31mtext\u0007" }]),
      },
    });
    const dir = project(pagesBlock());
    const r = pages(["comments", "review-x"], dir);
    expect(r.out).not.toContain("\u001b");
    expect(r.out).not.toContain("\u0007");
  });
});

describe("pages close", () => {
  test("hands each id to the host's close command, as one argument, and says it is closed", () => {
    given({ close: {} });
    const dir = project(pagesBlock());
    const r = pages(["close", "41", "c-7"], dir);
    expect(r.code).toBe(0);
    expect(r.out).toBe("closed 41\nclosed c-7\n");
    expect(recorded()).toEqual([
      ["close", "41"],
      ["close", "c-7"],
    ]);
  });

  test("an id the host does not know fails, with the host's words; the ones after it are still tried", () => {
    given({ close: { byId: { nope: { exit: 1, stderr: "no comment nope" } } } });
    const dir = project(pagesBlock());
    const r = pages(["close", "41", "nope", "42"], dir);
    expect(r.code).toBe(1);
    expect(r.out).toBe("closed 41\nclosed 42\n");
    expect(r.err).toContain("nope");
    expect(r.err).toContain("no comment nope");
    expect(recorded().map((c) => c[1])).toEqual(["41", "nope", "42"]);
  });

  test("an id with spaces, quotes or a command substitution is one argument", () => {
    given({ close: {} });
    const dir = project(pagesBlock());
    const marker = join(dir, "pwned");
    const ids = ["a b", `x'y"z`, `$(touch ${marker})`, `\`touch ${marker}\``, "p;q"];
    for (const id of ids) expect(pages(["close", id], dir).code).toBe(0);
    expect(recorded()).toEqual(ids.map((id) => ["close", id]));
    expect(existsSync(marker)).toBe(false);
  });

  test("an id that would read as an option, or holds a control character, is refused before anything runs", () => {
    given({ close: {} });
    const dir = project(pagesBlock());
    for (const id of ["--all", "-1"]) {
      const r = pages(["close", id], dir);
      expect(r.code).toBe(1);
      expect(r.err).toContain("usage: run pages");
    }
    for (const id of ["a\u0001b", "a\nb", ""]) {
      const r = pages(["close", id], dir);
      expect(r.code).toBe(1);
      expect(r.err).toContain("is not an id");
    }
    expect(recorded()).toEqual([]);
  });

  test("with no close command, the comments are left open and the tool says so", () => {
    given({ close: {} });
    const dir = project(pagesBlock("", ["close"]));
    const r = pages(["close", "41"], dir);
    expect(r.code).toBe(0);
    expect(r.out).toContain("no close command");
    expect(r.out).toContain("open");
    expect(recorded()).toEqual([]);
  });
});

describe("pages slug and status", () => {
  test("slug makes a name any host can take from words", () => {
    const dir = project(null);
    const r = pages(["slug", "review", "My_Repo.v2", "#12"], dir);
    expect(r.code).toBe(0);
    expect(r.out).toBe("review-my-repo-v2-12\n");
    const none = pages(["slug", "!!", "--"], dir);
    expect(none.code).toBe(1);
    expect(none.err).toContain("slug");
  });

  test("status says which commands are set, and exits 2 when there is nothing to publish with", () => {
    const dir = project(pagesBlock('bridge = "page-bridge-v1"\nstate = true\n', ["close"]));
    const r = pages(["status"], dir);
    expect(r.code).toBe(0);
    expect(r.out).toBe(
      "publish: set\ncomments: set\nclose: not set\nbridge: page-bridge-v1\nstate: true\n",
    );
    const bare = pages(["status"], project(null));
    expect(bare.code).toBe(2);
    expect(bare.out).toContain("publish: not set");
    expect(bare.out).toContain("no publish command is set");
    const broken = pages(["status"], project('[pages]\nbridge = "page-bridge-v9"\n'));
    expect(broken.code).toBe(1);
    expect(broken.err).toContain("pages.bridge");
  });

  test("status prints no command line, so nothing a person put in one is shown", () => {
    const dir = project(pagesBlock());
    const r = pages(["status"], dir);
    expect(r.out).not.toContain(standIn);
    expect(r.out).not.toContain("{file}");
  });
});

describe("pages, as a command", () => {
  test("usage errors exit 1 and show the usage", () => {
    const dir = project(null);
    for (const args of [[], ["frobnicate"], ["publish"], ["comments"], ["close"]]) {
      const r = pages(args, dir);
      expect(r.code).toBe(1);
      expect(r.err).toContain("usage: run pages");
    }
  });

  test("scripts/run reaches it by name", () => {
    const dir = project(null);
    const r = run(join(import.meta.dir, "run"), ["pages", "slug", "a", "b"], {
      cwd: dir,
      env: { POSTMASTER_CONFIG: noConfig },
    });
    expect(r.out).toBe("a-b\n");
  });
});
