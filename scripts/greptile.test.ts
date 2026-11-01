// Tests beside scripts/greptile.ts, the adapter for Greptile (#652). The pure parts are called
// directly; the rest runs the adapter as a person or a step would, from any folder, on a scratch cut
// the way a review cuts it, with a stand-in greptile first on PATH that records its arguments, its
// checkout and whether it was given a key.
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gitOrThrow, RUN, type ToolResult, tool } from "./acceptance-467.ts";
import {
  behave,
  calls,
  type Comment,
  commitFiles,
  type Greptiled,
  greptileMachine,
  ORIGIN,
  report,
} from "./acceptance-652.ts";
import {
  errorLine,
  findingsPath,
  leftOutPath,
  outcomeOf,
  reviewArgs,
  warningsOf,
} from "./greptile.ts";
import { run, withTempDir } from "./lib/proc.ts";

/** A scratch cut as a reviewer's is: a clone detached at the snapshot, its origin the project folder. */
function detachedScratch(g: Greptiled, name = "scratch", snap = g.snap): string {
  const scratch = join(g.repo, ".worktrees", name);
  const cut = tool(g, "cut-scratch", g.repo, g.synthesis, scratch, snap, "--clone", g.base);
  expect(cut.code).toBe(0);
  return scratch;
}

/** A scratch cut as the Greptile step cuts it: a clone on a branch at the snapshot. */
function branchScratch(g: Greptiled, name = "scratch", snap = g.snap): string {
  const scratch = join(g.repo, ".worktrees", name);
  const cut = tool(g, "cut-scratch", "--cut-workhorse", g.repo, scratch, snap, "greptile-review");
  expect(cut.code).toBe(0);
  return scratch;
}

const prefixOf = (g: Greptiled): string => join(g.root, "out", "greptile-r3");

/** The adapter, run from the caller's folder with the checkout as an argument. */
function adapter(
  g: Greptiled,
  checkout: string,
  opts: { base?: string; env?: Record<string, string | undefined> } = {},
): ToolResult {
  const r = run(RUN, ["greptile", "review", g.repo, checkout, opts.base ?? g.base, prefixOf(g)], {
    cwd: g.root,
    env: { ...g.env, ...opts.env },
  });
  return { code: r.code, out: r.out, err: r.err };
}

const findings = (g: Greptiled): Array<Record<string, unknown>> =>
  JSON.parse(readFileSync(findingsPath(prefixOf(g)), "utf8")) as Array<Record<string, unknown>>;

/** The last line of a miss: the cause, as the adapter ends its stderr with it. */
const lastLine = (text: string): string => text.trimEnd().split("\n").pop() ?? "";

const THREE: Comment[] = [
  {
    path: "src/a.ts",
    startLine: 3,
    severity: "P0",
    body: "Null deref on the empty list.\nIt throws.",
  },
  { path: "src/b.ts", startLine: 10, endLine: 12, severity: "P1", body: "The loop never ends." },
  { path: "src/c.ts", startLine: 7, severity: "P2", body: "A stale name." },
];

const SENSITIVE = "warning: 1 possibly sensitive file found: .env.local. Include it with --include";

describe("the arguments", () => {
  test("a review since the base, as JSON, with no instructions", () => {
    expect(reviewArgs("abc123", "base")).toEqual(["review", "--json", "-b", "abc123"]);
  });

  test("plus and apex add the flag of that name", () => {
    expect(reviewArgs("abc123", "plus")).toEqual(["review", "--json", "-b", "abc123", "--plus"]);
    expect(reviewArgs("abc123", "apex")).toEqual(["review", "--json", "-b", "abc123", "--apex"]);
  });
});

describe("Greptile's own error line", () => {
  const none = { code: 1, out: "", err: "" };

  test("is the first line it marked error or notice, warnings passed over", () => {
    const err =
      "warning: 2 uncommitted files not included in the review\nerror: detached HEAD\n  Try: x\n";
    expect(errorLine({ ...none, err })).toBe("error: detached HEAD");
    expect(errorLine({ ...none, code: 6, err: "notice: this feature is not enabled.\n" })).toBe(
      "notice: this feature is not enabled.",
    );
  });

  test("is the first line it printed when none is marked, from stderr before stdout", () => {
    expect(errorLine({ ...none, err: "Not signed in.\n" })).toBe("Not signed in.");
    expect(errorLine({ ...none, out: "Not signed in.\n" })).toBe("Not signed in.");
  });

  test("is the exit when it printed nothing", () => {
    expect(errorLine({ ...none, code: 130 })).toBe("greptile exited 130 with no message");
  });
});

describe("the warnings that leave a file out", () => {
  const warn = (err: string) => warningsOf({ out: "", err });

  test("every warning line is one, but the one about binary files", () => {
    expect(warn(`${SENSITIVE}\n`)).toEqual([SENSITIVE]);
    expect(warn("warning: 1 file could not be reviewed: src/x.ts\n")).toEqual([
      "warning: 1 file could not be reviewed: src/x.ts",
    ]);
    expect(warn("warning: 3 uncommitted files not included in the review\n")).toEqual([
      "warning: 3 uncommitted files not included in the review",
    ]);
    expect(warn("warning: 2 binary files not included in the review\n")).toEqual([]);
    expect(warn("warning: 1 binary file not included in the review\n")).toEqual([]);
  });

  test("are read from either stream, trimmed, in the order printed", () => {
    expect(
      warningsOf({
        out: "  Warning: b\n",
        err: "warning: a\nplain text\nnote: warning: not first\n",
      }),
    ).toEqual(["warning: a", "Warning: b"]);
  });

  test("none is a plain review", () => {
    expect(warn("")).toEqual([]);
    expect(warn("Reviewing 4 files\n")).toEqual([]);
  });
});

describe("what a finished call came to", () => {
  const ok = (out: string, err = "") => ({ code: 0, out, err });

  test("a readable report is findings, in the record review-findings writes", () => {
    const outcome = outcomeOf(ok(report(THREE)), "/scratch");
    expect("findings" in outcome && outcome.findings.length).toBe(3);
  });

  test("a report with no comments is a finished review with no findings", () => {
    expect(outcomeOf(ok(report([])), "/scratch")).toEqual({ findings: [] });
  });

  test("a comment with no severity is P2, and one with no end line has none", () => {
    const bare = JSON.stringify({ comments: [{ path: "src/a.ts", startLine: 4, body: "x" }] });
    const outcome = outcomeOf(ok(bare), "/scratch");
    const [only] = "findings" in outcome ? outcome.findings : [];
    expect([only?.severity, only?.line, only?.line_end]).toEqual(["P2", 4, "not provided"]);
  });

  test("text that is no report, JSON that is no report and a bad comment all miss", () => {
    for (const out of ["Review complete.\n", "[]", '{"comments":"none"}', "null", ""]) {
      expect(outcomeOf(ok(out), "/scratch")).toEqual({
        miss: "greptile exited 0 but printed no readable report",
      });
    }
    const bad = outcomeOf(ok(report([{ path: "../out.ts", startLine: 1 }])), "/scratch");
    expect("miss" in bad && bad.miss).toContain("could not be read");
  });

  test("any other exit misses with its own error line, however many findings it printed", () => {
    expect(outcomeOf({ code: 1, out: report(THREE), err: "error: x\n" }, "/scratch")).toEqual({
      miss: "error: x",
    });
  });

  test("a warning that leaves a file out misses a review that reported findings, quoting the line", () => {
    expect(outcomeOf(ok(report(THREE), `${SENSITIVE}\n`), "/scratch")).toEqual({
      miss: SENSITIVE,
    });
    expect(
      outcomeOf(
        ok(report([]), `${SENSITIVE}\nwarning: 1 file could not be reviewed: a.ts\n`),
        "/scratch",
      ),
    ).toEqual({ miss: `${SENSITIVE}; warning: 1 file could not be reviewed: a.ts` });
  });

  test("a warning about binary files does not", () => {
    expect(
      outcomeOf(ok(report([]), "warning: 2 binary files not included in the review\n"), "/scratch"),
    ).toEqual({ findings: [] });
  });
});

describe("a review", () => {
  test("reviews the change since the base on a branch whose remote is the project's origin, from a detached clone", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      behave(g, { out: report([]) });
      const scratch = detachedScratch(g);
      const r = adapter(g, scratch);
      expect(r.code).toBe(0);
      const [call, ...more] = calls(g);
      expect(more).toEqual([]);
      expect(call?.args).toBe(`review --json -b ${g.base}`);
      expect(call?.branch).toBe("greptile-review");
      expect(call?.head).toBe(g.snap);
      expect(call?.remote).toBe(ORIGIN);
      // The scratch is still what cut-scratch cut: its origin the project folder, a clone of it.
      expect(gitOrThrow(scratch, "config", "remote.origin.url").trim()).toBe(g.repo);
      expect(tool(g, "cut-scratch", "--kind", scratch).out.trim()).toBe(`clone ${g.repo}`);
    }, "greptile-review-");
  });

  test("gives a clone that is on a branch the same remote, on that branch, and leaves its origin alone", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      behave(g, { out: report([]) });
      const scratch = branchScratch(g);
      expect(adapter(g, scratch).code).toBe(0);
      const [call] = calls(g);
      expect(call?.branch).toBe("greptile-review");
      expect(call?.head).toBe(g.snap);
      expect(call?.remote).toBe(ORIGIN);
      expect(gitOrThrow(scratch, "branch", "--show-current").trim()).toBe("greptile-review");
      expect(gitOrThrow(scratch, "config", "remote.origin.url").trim()).toBe(g.repo);
      expect(tool(g, "cut-scratch", "--kind", scratch).out.trim()).toBe(`clone ${g.repo}`);
    }, "greptile-branch-");
  });

  test("keeps the branch a checkout is on, and takes it no other", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      behave(g, { out: report([]) });
      const scratch = detachedScratch(g);
      gitOrThrow(scratch, "checkout", "-q", "-b", "mine");
      expect(adapter(g, scratch).code).toBe(0);
      expect(calls(g)[0]?.branch).toBe("mine");
      expect(calls(g)[0]?.remote).toBe(ORIGIN);
      expect(gitOrThrow(scratch, "branch", "--show-current").trim()).toBe("mine");
    }, "greptile-mine-");
  });

  test("goes through twice on the same scratch", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      behave(g, { out: report([]) });
      const scratch = detachedScratch(g);
      expect(adapter(g, scratch).code).toBe(0);
      expect(adapter(g, scratch).code).toBe(0);
      expect(calls(g).map((c) => [c.branch, c.remote])).toEqual([
        ["greptile-review", ORIGIN],
        ["greptile-review", ORIGIN],
      ]);
    }, "greptile-twice-");
  });

  test("runs with Greptile's usage reports, update check and diagram download off", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      behave(g, { out: report([]) });
      expect(adapter(g, branchScratch(g)).code).toBe(0);
      expect(calls(g)[0]?.env).toBe("telemetry=1 update=1 install=1 key=unset");
    }, "greptile-switches-");
  });

  test("hands Greptile no key, though its caller holds one", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      behave(g, { out: report([]) });
      const r = adapter(g, branchScratch(g), { env: { GREPTILE_API_KEY: "pm-check-not-a-key" } });
      expect(r.code).toBe(0);
      expect(calls(g)[0]?.env).toContain("key=unset");
    }, "greptile-nokey-");
  });

  test("passes the project's level: --plus, --apex, and no flag for base or none", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      behave(g, { out: report([]) });
      const levels: Array<[string | null, string]> = [
        [null, ""],
        ["base", ""],
        ["plus", " --plus"],
        ["apex", " --apex"],
      ];
      levels.forEach(([level, flag], i) => {
        mkdirSync(join(g.repo, ".postmaster"), { recursive: true });
        const settings = join(g.repo, ".postmaster", "project.toml");
        if (level === null) writeFileSync(settings, "[project]\n");
        else writeFileSync(settings, `[project]\ngreptile_level = "${level}"\n`);
        expect(adapter(g, detachedScratch(g, `level-${i}`)).code).toBe(0);
        expect(calls(g)[i]?.args).toBe(`review --json -b ${g.base}${flag}`);
      });
    }, "greptile-level-");
  });

  test("lists three comments as three findings with their files, lines, Greptile's severity and greptile as the source", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      behave(g, { out: report(THREE) });
      const r = adapter(g, branchScratch(g));
      expect(r.code).toBe(0);
      const found = findings(g);
      expect(found.map((f) => [f.file, f.line, f.line_end, f.severity, f.source])).toEqual([
        ["src/a.ts", 3, 3, "P0", "greptile"],
        ["src/b.ts", 10, 12, "P1", "greptile"],
        ["src/c.ts", 7, 7, "P2", "greptile"],
      ]);
      expect(found.map((f) => f.target)).toEqual(["src/a.ts:3", "src/b.ts:10", "src/c.ts:7"]);
      expect(found[0]?.summary).toBe("Null deref on the empty list.");
      expect(found[0]?.body).toBe("Null deref on the empty list.\nIt throws.");
      // Greptile's own report is passed through, for the log of whatever ran the adapter.
      expect(r.out).toBe(report(THREE));
    }, "greptile-findings-");
  });

  test("keeps a suggestion, a removed-side comment and a security flag in the record", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      behave(g, {
        out: report([
          {
            path: "src/a.ts",
            startLine: 4,
            body: "Escape it.",
            suggestion: "esc(x)",
            side: "old",
            securityIssue: true,
            category: "logic",
            verifiedEvidence: "A probe showed it.",
          },
        ]),
      });
      expect(adapter(g, branchScratch(g)).code).toBe(0);
      const [f] = findings(g);
      expect(f?.body).toContain("Suggested change:\nesc(x)");
      expect(f?.body).toContain("removed side of the diff");
      expect(f?.category).toBe("logic, security issue");
      expect(f?.evidence).toBe("A probe showed it.");
    }, "greptile-record-");
  });

  test("a report with no comments leaves an empty list, and the review counts as finished", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      behave(g, { out: report([]) });
      expect(adapter(g, branchScratch(g)).code).toBe(0);
      expect(findings(g)).toEqual([]);
      expect(existsSync(leftOutPath(prefixOf(g)))).toBe(false);
    }, "greptile-empty-");
  });

  test("a warning about binary files passes through a finished review", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      const warning = "warning: 1 binary file not included in the review\n";
      behave(g, { out: report([]), err: warning });
      const r = adapter(g, branchScratch(g));
      expect(r.code).toBe(0);
      expect(r.err).toBe(warning);
    }, "greptile-binary-");
  });
});

describe("the changed files the project's ignore rules hold back", () => {
  test("are named in a file of their own, one to a line, and are no miss", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      behave(g, { out: report([]) });
      const snap = commitFiles(
        g,
        {
          ".gitignore": "*.log\ndist/\n",
          "build.log": "noise\n",
          "dist/out.js": "x\n",
          "src/keep.ts": "y\n",
        },
        "files the ignore rules match",
      );
      const r = adapter(g, branchScratch(g, "scratch", snap));
      expect(r.code).toBe(0);
      expect(readFileSync(leftOutPath(prefixOf(g)), "utf8")).toBe("build.log\ndist/out.js\n");
      expect(findings(g)).toEqual([]);
      expect(r.err).toBe("");
    }, "greptile-leftout-");
  });

  test("are none when the change holds only files the rules leave alone", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      behave(g, { out: report([]) });
      const snap = commitFiles(g, { ".gitignore": "*.log\n", "src/keep.ts": "y\n" }, "kept");
      expect(adapter(g, detachedScratch(g, "scratch", snap)).code).toBe(0);
      expect(existsSync(leftOutPath(prefixOf(g)))).toBe(false);
    }, "greptile-noneleft-");
  });

  test("do not include a file the change deletes", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      behave(g, { out: report([]) });
      const before = commitFiles(g, { ".gitignore": "*.log\n", "gone.log": "noise\n" }, "before");
      gitOrThrow(g.synthesis, "rm", "-q", "gone.log");
      gitOrThrow(g.synthesis, "commit", "-q", "-m", "delete it");
      const snap = gitOrThrow(g.synthesis, "rev-parse", "HEAD").trim();
      expect(adapter(g, branchScratch(g, "scratch", snap), { base: before }).code).toBe(0);
      expect(existsSync(leftOutPath(prefixOf(g)))).toBe(false);
    }, "greptile-deleted-");
  });

  test("are listed whatever the report holds", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      behave(g, { out: report(THREE) });
      const snap = commitFiles(g, { ".gitignore": "*.log\n", "x.log": "noise\n" }, "ignored");
      expect(adapter(g, branchScratch(g, "scratch", snap)).code).toBe(0);
      expect(readFileSync(leftOutPath(prefixOf(g)), "utf8")).toBe("x.log\n");
      expect(findings(g).length).toBe(3);
    }, "greptile-leftfindings-");
  });
});

describe("a review that misses", () => {
  const misses: Array<[string, { exit?: number; out?: string; err?: string }, string]> = [
    ["exits 1 printing Not signed in.", { exit: 1, err: "Not signed in.\n" }, "Not signed in."],
    [
      "exits 6 printing a notice",
      { exit: 6, err: "notice: this feature is not enabled for this account.\n" },
      "notice: this feature is not enabled for this account.",
    ],
    [
      "exits 0 printing text that is not a report",
      { out: "Review complete. Nothing to add.\n" },
      "greptile exited 0 but printed no readable report",
    ],
    [
      "exits 1 after a warning",
      {
        exit: 1,
        err: "warning: 3 uncommitted files not included in the review\nerror: could not find the default branch. Pass --branch <branch>.\n",
      },
      "error: could not find the default branch. Pass --branch <branch>.",
    ],
    [
      "exits 0 with a report and a warning that a file looks like a secret",
      { out: report([]), err: `${SENSITIVE}\n` },
      SENSITIVE,
    ],
    [
      "exits 0 with a report and a warning it does not know",
      { out: report(THREE), err: "warning: 1 file could not be reviewed: src/x.ts\n" },
      "warning: 1 file could not be reviewed: src/x.ts",
    ],
  ];
  for (const [label, how, why] of misses) {
    test(`a Greptile that ${label} leaves no file, and ends its stderr with the cause`, () => {
      withTempDir((root) => {
        const g = greptileMachine(root);
        behave(g, how);
        const r = adapter(g, branchScratch(g));
        expect(r.code).toBe(1);
        expect(lastLine(r.err)).toBe(`greptile: missed: ${why}`);
        expect(existsSync(findingsPath(prefixOf(g)))).toBe(false);
        expect(existsSync(leftOutPath(prefixOf(g)))).toBe(false);
      }, "greptile-miss-");
    });
  }

  test("a Greptile that is not on PATH misses, naming that", () => {
    withTempDir((root) => {
      const g = greptileMachine(root, { standIn: false });
      const r = adapter(g, branchScratch(g));
      expect(r.code).toBe(1);
      expect(lastLine(r.err)).toBe(
        "greptile: missed: greptile is not installed: it is not on PATH",
      );
      expect(existsSync(findingsPath(prefixOf(g)))).toBe(false);
    }, "greptile-absent-");
  });

  test("a project with no origin misses before Greptile is called", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      const scratch = branchScratch(g);
      gitOrThrow(g.repo, "remote", "remove", "origin");
      const r = adapter(g, scratch);
      expect(r.code).toBe(1);
      expect(lastLine(r.err)).toContain("no origin");
      expect(calls(g)).toEqual([]);
    }, "greptile-noorigin-");
  });

  test("a checkout that is no repository misses before Greptile is called", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      mkdirSync(join(g.root, "plain"));
      const r = adapter(g, join(g.root, "plain"));
      expect(r.code).toBe(1);
      expect(lastLine(r.err)).toContain("could not be set up for Greptile");
      expect(calls(g)).toEqual([]);
    }, "greptile-plain-");
  });

  test("a project whose settings do not parse misses with the refusal", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      mkdirSync(join(g.repo, ".postmaster"), { recursive: true });
      writeFileSync(
        join(g.repo, ".postmaster", "project.toml"),
        '[project]\ngreptile_level = "max"\n',
      );
      const r = adapter(g, branchScratch(g));
      expect(r.code).toBe(1);
      expect(lastLine(r.err)).toContain("greptile_level");
      expect(calls(g)).toEqual([]);
    }, "greptile-badlevel-");
  });

  test("a base git does not know misses, saying the changed files could not be listed", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      behave(g, { out: report([]) });
      const r = adapter(g, branchScratch(g), { base: "0".repeat(40) });
      expect(r.code).toBe(1);
      expect(lastLine(r.err)).toContain("the changed files could not be listed");
      expect(existsSync(findingsPath(prefixOf(g)))).toBe(false);
    }, "greptile-badbase-");
  });

  test("an earlier review's files do not outlast the next review's start", () => {
    withTempDir((root) => {
      const g = greptileMachine(root);
      const scratch = branchScratch(g);
      const snap = commitFiles(g, { ".gitignore": "*.log\n", "x.log": "noise\n" }, "ignored");
      const second = branchScratch(g, "second", snap);
      behave(g, { out: report(THREE) });
      expect(adapter(g, second).code).toBe(0);
      expect(existsSync(findingsPath(prefixOf(g)))).toBe(true);
      expect(existsSync(leftOutPath(prefixOf(g)))).toBe(true);
      behave(g, { exit: 1, err: "Not signed in.\n" });
      expect(adapter(g, scratch).code).toBe(1);
      expect(existsSync(findingsPath(prefixOf(g)))).toBe(false);
      expect(existsSync(leftOutPath(prefixOf(g)))).toBe(false);
    }, "greptile-stale-");
  });
});

describe("usage", () => {
  test("anything but review <repo> <checkout> <base> <prefix> exits 2", () => {
    for (const args of [
      [],
      ["review"],
      ["review", "r", "c", "b"],
      ["review", "r", "c", "b", ""],
      ["review", "r", "c", "b", "f", "x"],
      ["review", "r", "c", "--upload-pack=x", "f"],
      ["audit", "r", "c", "b", "f"],
    ]) {
      const r = run(RUN, ["greptile", ...args]);
      expect(r.code).toBe(2);
      expect(r.err).toContain("usage: run greptile review");
    }
  });
});
