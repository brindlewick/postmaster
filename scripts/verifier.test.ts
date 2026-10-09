// Tests beside scripts/verifier.ts: argument parsing, prompt rendering, naming, base
// detection and the wall scan. The live session stays out; acceptance-323 covers the
// command boundary as a subprocess.
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitAll, gitOrThrow, initRepo, RUN, writeRepoFile } from "./acceptance-323.ts";
import { run } from "./lib/proc.ts";
import {
  UPKEEP_LINE,
  addedFeaturePages,
  addedPaths,
  addedUnder,
  branchFileText,
  branchHasPath,
  checkMultiVerifiers,
  commitsPastBase,
  committedFeaturePages,
  defaultBase,
  dirLines,
  failureOutcome,
  handoverFresh,
  hasUpkeepLine,
  indexNames,
  isSurface,
  joinBodies,
  orderKinds,
  outsideAdded,
  parseArgs,
  pickBranch,
  pickWorktree,
  proseList,
  pruneWorktrees,
  remoteFromSymbolicRef,
  removeProvisioning,
  renderPrompt,
  renderTemplate,
  repoTop,
  roleHarness,
  scrubGitEnv,
  surfaceKind,
  surfaceProse,
  unlistedSentence,
  verifyDirName,
  wallInStream,
} from "./verifier.ts";

function tempDir(): string {
  // Resolved: on macOS the temporary folder sits behind a link (/var to
  // /private/var) and git prints the resolved path, so an unresolved expected
  // path never matches it. host, local and reach already do this.
  return realpathSync(mkdtempSync(join(tmpdir(), "verifier-")));
}

describe("parseArgs", () => {
  test("prompt takes a repo and a surface", () => {
    expect(parseArgs(["prompt", "/r", "cli"])).toEqual({
      ok: true,
      req: { cmd: "prompt", repo: "/r", surfaces: ["cli"] },
    });
  });

  test("prompt takes several surfaces as distinct kinds in canonical order", () => {
    expect(parseArgs(["prompt", "/r", "web", "cli"])).toEqual({
      ok: true,
      req: { cmd: "prompt", repo: "/r", surfaces: ["cli", "web"] },
    });
    expect(parseArgs(["prompt", "/r", "cli", "cli-examples"])).toEqual({
      ok: true,
      req: { cmd: "prompt", repo: "/r", surfaces: ["cli"] },
    });
    expect(parseArgs(["prompt", "/r", "browser-suite", "web-journey"])).toEqual({
      ok: true,
      req: { cmd: "prompt", repo: "/r", surfaces: ["web"] },
    });
  });

  test("no command and an unknown command fail", () => {
    expect(parseArgs([])).toEqual({ ok: false, error: "no command" });
    expect(parseArgs(["upkeep"])).toEqual({ ok: false, error: "unknown command: upkeep" });
  });

  test("a missing surface and an unknown surface fail", () => {
    expect(parseArgs(["prompt", "/r"])).toEqual({
      ok: false,
      error: "prompt takes a repo and a surface",
    });
    expect(parseArgs(["prompt", "/r", "telegraph"])).toEqual({
      ok: false,
      error:
        "unknown surface: telegraph (cli, web, library, cli-examples, browser-suite, web-journey or library-tests)",
    });
    expect(parseArgs(["prompt", "/r", "cli", "telegraph"]).ok).toBe(false);
  });

  test("prototype names are unknown surfaces, not silent empty kinds", () => {
    for (const name of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(parseArgs(["prompt", "/r", name]).ok).toBe(false);
      expect(parseArgs(["prompt", "/r", "cli", name]).ok).toBe(false);
    }
  });

  test("prompt takes no flags", () => {
    expect(parseArgs(["prompt", "/r", "cli", "--run", "/d"])).toEqual({
      ok: false,
      error: "prompt takes a repo and a surface",
    });
  });

  test("make needs --run and defaults the timeout", () => {
    expect(parseArgs(["make", "/r", "web", "--run", "/d"])).toEqual({
      ok: true,
      req: { cmd: "make", repo: "/r", surfaces: ["web"], dispatch: "/d", timeout: 3600 },
    });
    expect(parseArgs(["make", "/r", "web", "--run", "/d", "--timeout", "60"])).toEqual({
      ok: true,
      req: { cmd: "make", repo: "/r", surfaces: ["web"], dispatch: "/d", timeout: 60 },
    });
    expect(parseArgs(["make", "/r", "cli-examples", "browser-suite", "--run", "/d"])).toEqual({
      ok: true,
      req: {
        cmd: "make",
        repo: "/r",
        surfaces: ["cli", "web"],
        dispatch: "/d",
        timeout: 3600,
      },
    });
  });

  test("make without --run fails", () => {
    expect(parseArgs(["make", "/r", "web"])).toEqual({
      ok: false,
      error: "make needs --run <dispatch>",
    });
  });

  test("a bad timeout and an unknown flag fail", () => {
    expect(parseArgs(["make", "/r", "web", "--run", "/d", "--timeout", "0"]).ok).toBe(false);
    expect(parseArgs(["make", "/r", "web", "--run", "/d", "--timeout", "soon"]).ok).toBe(false);
    expect(parseArgs(["make", "/r", "web", "--run", "/d", "--timeout", "1234567890"]).ok).toBe(
      false,
    );
    expect(parseArgs(["make", "/r", "web", "--run", "/d", "--fresh"]).ok).toBe(false);
    expect(parseArgs(["make", "/r", "web", "--run"]).ok).toBe(false);
  });
});

describe("surfaces", () => {
  test("the three surfaces and their prose", () => {
    expect(isSurface("cli")).toBe(true);
    expect(isSurface("web")).toBe(true);
    expect(isSurface("library")).toBe(true);
    expect(isSurface("telegraph")).toBe(false);
    expect(surfaceProse("cli")).toBe("command line");
    expect(surfaceProse("web")).toBe("web pages");
    expect(surfaceProse("library")).toBe("library interface");
    expect(() => surfaceProse("telegraph")).toThrow("unknown surface: telegraph");
  });
});

describe("renderPrompt", () => {
  test("fills every placeholder", () => {
    const out = renderPrompt("{{REPO}} {{SURFACE}} {{SURFACE_PROSE}} {{VERIFY_DIR}} {{BASE}}", {
      repo: "/r",
      surface: "cli",
      surfaceProse: "command line",
      verifyDir: "verify-app",
      base: "origin/main",
    });
    expect(out).toBe("/r cli command line verify-app origin/main");
  });

  test("dollar patterns in a value copy literally", () => {
    const out = renderPrompt("{{REPO}} {{VERIFY_DIR}}", {
      repo: "/x/app$$x",
      surface: "cli",
      surfaceProse: "command line",
      verifyDir: "verify-$&-'",
      base: "main",
    });
    expect(out).toBe("/x/app$$x verify-$&-'");
  });

  test("placeholder-shaped text in a value copies literally", () => {
    const out = renderPrompt("{{REPO}} {{BASE}}", {
      repo: "/x/{{BASE}}-app",
      surface: "cli",
      surfaceProse: "command line",
      verifyDir: "verify-app",
      base: "origin/main",
    });
    expect(out).toBe("/x/{{BASE}}-app origin/main");
    const unknown = renderPrompt("{{REPO}}", {
      repo: "/x/{{NAME}}-app",
      surface: "cli",
      surfaceProse: "command line",
      verifyDir: "verify-app",
      base: "main",
    });
    expect(unknown).toBe("/x/{{NAME}}-app");
  });

  test("a leftover placeholder throws", () => {
    expect(() =>
      renderPrompt("{{REPO}} {{NOPE}}", {
        repo: "/r",
        surface: "cli",
        surfaceProse: "command line",
        verifyDir: "verify-app",
        base: "main",
      }),
    ).toThrow("unknown placeholder in the prompt template: {{NOPE}}");
  });
});

describe("naming", () => {
  test("the verifier folder slugs the repo name", () => {
    expect(verifyDirName("/x/todo")).toBe("verify-todo");
    expect(verifyDirName("/x/Todo_App")).toBe("verify-todo-app");
    expect(verifyDirName("/x/!!!")).toBe("verify-app");
  });

  test("the branch numbers past branches taken", () => {
    expect(pickBranch(() => false, "cli")).toBe("verify-cli");
    expect(pickBranch((n) => n === "verify-cli", "cli")).toBe("verify-cli-2");
    expect(pickBranch((n) => n !== "verify-cli-3", "cli")).toBe("verify-cli-3");
  });

  test("the worktree sits beside the repo, numbered past paths taken", () => {
    expect(pickWorktree("/x/app", "cli", () => false)).toBe("/x/app-verify-cli");
    expect(pickWorktree("/x/app", "cli", (p) => p === "/x/app-verify-cli")).toBe(
      "/x/app-verify-cli-2",
    );
  });
});

describe("pruneWorktrees", () => {
  test("a hand-deleted worktree frees its path again", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "README.md", "# app\n");
      commitAll(repo, "first");
      const wt = join(dir, "app-verify-cli");
      gitOrThrow(repo, "worktree", "add", wt, "-b", "verify-cli", "main");
      rmSync(wt, { recursive: true, force: true });
      pruneWorktrees(repo);
      gitOrThrow(repo, "worktree", "add", wt, "-b", "verify-cli-2", "main");
      expect(gitOrThrow(repo, "branch", "--list", "verify-cli-2")).toContain("verify-cli-2");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("remoteFromSymbolicRef", () => {
  test("reads origin's head and refuses the rest", () => {
    expect(remoteFromSymbolicRef("refs/remotes/origin/main\n")).toBe("origin/main");
    expect(remoteFromSymbolicRef("refs/heads/main\n")).toBe(null);
    expect(remoteFromSymbolicRef("refs/remotes/\n")).toBe(null);
    expect(remoteFromSymbolicRef("")).toBe(null);
  });
});

describe("defaultBase", () => {
  test("main wins over master, master over nothing", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "README.md", "# app\n");
      commitAll(repo, "first");
      expect(defaultBase(repo)).toBe("main");
      const other = join(dir, "old");
      const r = run("git", ["init", "-q", "-b", "master", other]);
      expect(r.code).toBe(0);
      gitOrThrow(other, "config", "user.name", "brindlewick");
      gitOrThrow(other, "config", "user.email", "332054101+brindlewick@users.noreply.github.com");
      writeRepoFile(other, "README.md", "# old\n");
      commitAll(other, "first");
      expect(defaultBase(other)).toBe("master");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a clone cuts from origin's head", () => {
    const dir = tempDir();
    try {
      const src = join(dir, "src");
      initRepo(src);
      writeRepoFile(src, "README.md", "# src\n");
      commitAll(src, "first");
      const dst = join(dir, "dst");
      const r = run("git", ["clone", "-q", src, dst]);
      expect(r.code).toBe(0);
      expect(defaultBase(dst)).toBe("origin/main");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a lone branch cuts from its head, an empty repo from nothing", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "feat");
      const r = run("git", ["init", "-q", "-b", "feature", repo]);
      expect(r.code).toBe(0);
      gitOrThrow(repo, "config", "user.name", "brindlewick");
      gitOrThrow(repo, "config", "user.email", "332054101+brindlewick@users.noreply.github.com");
      writeRepoFile(repo, "README.md", "# feat\n");
      commitAll(repo, "first");
      expect(defaultBase(repo)).toBe(gitOrThrow(repo, "rev-parse", "HEAD").trim());
      const empty = join(dir, "empty");
      initRepo(empty);
      expect(defaultBase(empty)).toBe(null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("prompt needs a commit to name", () => {
  test("prompt on a repo with no commit exits 2", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "empty");
      initRepo(repo);
      const r = run(RUN, ["verifier", "prompt", repo, "cli"]);
      expect(r.code).toBe(2);
      expect(r.err).toContain("usage: run verifier");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("prompt on a path below the repo top exits 2", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "README.md", "# app\n");
      writeRepoFile(repo, "src/keep.md", "x\n");
      commitAll(repo, "first");
      const r = run(RUN, ["verifier", "prompt", join(repo, "src"), "cli"]);
      expect(r.code).toBe(2);
      expect(r.err).toContain("not the top of its repository");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an inherited GIT_DIR does not redirect the repo check", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "README.md", "# app\n");
      commitAll(repo, "first");
      const r = run(RUN, ["verifier", "prompt", dir, "cli"], {
        env: { GIT_DIR: join(repo, ".git") },
      });
      expect(r.code).toBe(2);
      expect(r.err).toContain("not a git repository");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("scrubGitEnv", () => {
  test("drops the redirectors and keeps the rest", () => {
    expect(scrubGitEnv({ GIT_DIR: "/x", GIT_WORK_TREE: "/y", PATH: "/bin", HOME: "/h" })).toEqual({
      PATH: "/bin",
      HOME: "/h",
    });
    expect(scrubGitEnv({ PATH: "/bin" })).toEqual({ PATH: "/bin" });
  });
});

describe("repoTop", () => {
  test("the top for the top and its subdir, none outside a repo", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "README.md", "# app\n");
      writeRepoFile(repo, "src/keep.md", "x\n");
      commitAll(repo, "first");
      expect(repoTop(repo)).toBe(repo);
      expect(repoTop(join(repo, "src"))).toBe(repo);
      expect(repoTop(join(dir, "nope"))).toBe(null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("branchHasPath", () => {
  test("a committed file reads present, an uncommitted one absent", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "README.md", "# app\n");
      commitAll(repo, "first");
      gitOrThrow(repo, "branch", "verify-cli");
      writeRepoFile(repo, "verify-app/README.md", "v\n");
      writeRepoFile(repo, "note.md", "hi\n");
      gitOrThrow(repo, "checkout", "-q", "verify-cli");
      gitOrThrow(repo, "add", "note.md");
      gitOrThrow(repo, "commit", "-q", "-m", "other file");
      expect(branchHasPath(repo, "verify-cli", "verify-app/README.md")).toBe(false);
      expect(branchHasPath(repo, "verify-cli", "note.md")).toBe(true);
      expect(branchHasPath(repo, "verify-cli", "missing.md")).toBe(false);
      expect(branchHasPath(repo, "nope", "note.md")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("handoverFresh", () => {
  test("written at or after the cut reads fresh, before reads stale", () => {
    expect(handoverFresh(2000, 1000)).toBe(true);
    expect(handoverFresh(1000, 1000)).toBe(true);
    expect(handoverFresh(999, 1000)).toBe(false);
  });
});

describe("failureOutcome", () => {
  test("a started session keeps its worktree and branch, named", () => {
    expect(failureOutcome(true, "/x/app-verify-cli", "verify-cli")).toEqual({
      cleanup: false,
      suffix: "; the worktree /x/app-verify-cli and branch verify-cli were left behind",
    });
  });

  test("a failure before any session cleans up", () => {
    expect(failureOutcome(false, "/x/app-verify-cli", "verify-cli")).toEqual({
      cleanup: true,
      suffix: "",
    });
  });
});

describe("removeProvisioning", () => {
  test("removes the worktree and the branch", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "README.md", "# app\n");
      commitAll(repo, "first");
      const wt = join(dir, "app-verify-cli");
      gitOrThrow(repo, "worktree", "add", wt, "-b", "verify-cli", "main");
      expect(removeProvisioning(repo, wt, "verify-cli")).toBe("");
      expect(existsSync(wt)).toBe(false);
      expect(gitOrThrow(repo, "branch", "--list", "verify-cli").trim()).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("names what it could not remove", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "README.md", "# app\n");
      commitAll(repo, "first");
      const out = removeProvisioning(repo, join(dir, "nope"), "nope");
      expect(out.startsWith("; the cleanup failed too: ")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("committedFeaturePages", () => {
  test("committed pages besides the index, uncommitted ones excluded", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "README.md", "# app\n");
      writeRepoFile(repo, "verify-app/README.md", "v\n");
      writeRepoFile(repo, "verify-app/features/README.md", "map\n");
      writeRepoFile(repo, "verify-app/features/add.md", "a\n");
      writeRepoFile(repo, "verify-app/features/list.md", "l\n");
      writeRepoFile(repo, "verify-app/features/café.md", "c\n");
      commitAll(repo, "first");
      writeRepoFile(repo, "verify-app/features/done.md", "d\n");
      const pages = committedFeaturePages(repo, "main", "verify-app");
      expect(pages?.sort()).toEqual([
        "verify-app/features/add.md",
        "verify-app/features/café.md",
        "verify-app/features/list.md",
      ]);
      expect(committedFeaturePages(repo, "nope", "verify-app")).toBe(null);
      expect(committedFeaturePages(repo, "main", "verify-other")).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("commitsPastBase", () => {
  test("none on a fresh branch, one after a commit, none for a bad base", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "README.md", "# app\n");
      commitAll(repo, "first");
      gitOrThrow(repo, "branch", "verify-cli");
      expect(commitsPastBase(repo, "main", "verify-cli")).toBe(0);
      gitOrThrow(repo, "checkout", "-q", "verify-cli");
      writeRepoFile(repo, "note.md", "hi\n");
      commitAll(repo, "second");
      expect(commitsPastBase(repo, "main", "verify-cli")).toBe(1);
      expect(commitsPastBase(repo, "nope", "verify-cli")).toBe(null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("wallInStream", () => {
  test("reads a wall ending in each recorded shape", () => {
    expect(
      wallInStream(
        '{"type":"turn.completed"}\n{"type":"turn.failed","error":{"message":"Rate limit exceeded, retry later"}}\n',
        "codex",
      ),
    ).toBe("Rate limit exceeded, retry later");
    expect(
      wallInStream(
        '{"type":"assistant"}\n{"type":"result","is_error":true,"result":"Too many requests"}\n',
        "claude",
      ),
    ).toBe("Too many requests");
    expect(
      wallInStream(
        '{"payload_type":"run.terminal.failed","payload":{"reason":"Usage limit reached"}}\n',
        "muse",
      ),
    ).toBe("Usage limit reached");
  });

  test("a clean end, a non-wall error and an unread shape read as no wall", () => {
    expect(wallInStream('{"type":"result","is_error":false,"result":"done"}\n', "claude")).toBe(
      null,
    );
    expect(
      wallInStream('{"type":"turn.failed","error":{"message":"bad gateway"}}\n', "codex"),
    ).toBe(null);
    expect(
      wallInStream('{"type":"turn.failed","error":{"message":"Rate limit exceeded"}}\n', "grok"),
    ).toBe(null);
    expect(wallInStream("", "codex")).toBe(null);
  });
});

describe("roleHarness", () => {
  const config = {
    team: {
      coachman: { harness: "muse" },
      coachman_fallback: { harness: "codex" },
    },
  };

  test("each role reads its own harness", () => {
    expect(roleHarness(config, "coachman", "synthesis")).toBe("muse");
    expect(roleHarness(config, "coachman_fallback", "synthesis")).toBe("codex");
  });

  test("a per-leg coachman wins over the shared one", () => {
    const legged = {
      team: {
        coachman: { harness: "muse" },
        coachman_legs: { synthesis: { harness: "claude" } },
      },
    };
    expect(roleHarness(legged, "coachman", "synthesis")).toBe("claude");
    expect(roleHarness(legged, "coachman", "review")).toBe("muse");
  });

  test("a missing table or harness reads as none", () => {
    expect(roleHarness({}, "coachman", "synthesis")).toBe(null);
    expect(roleHarness({ team: {} }, "coachman_fallback", "synthesis")).toBe(null);
    expect(roleHarness(null, "coachman", "synthesis")).toBe(null);
    expect(roleHarness(config, "postmaster", "synthesis")).toBe(null);
  });
});

describe("surfaceKind", () => {
  test("both vocabularies denote their kind, the rest denote none", () => {
    expect(surfaceKind("cli")).toBe("cli");
    expect(surfaceKind("web")).toBe("web");
    expect(surfaceKind("library")).toBe("library");
    expect(surfaceKind("cli-examples")).toBe("cli");
    expect(surfaceKind("browser-suite")).toBe("web");
    expect(surfaceKind("web-journey")).toBe("web");
    expect(surfaceKind("library-tests")).toBe("library");
    expect(surfaceKind("telegraph")).toBe(null);
    expect(surfaceKind("")).toBe(null);
    expect(surfaceKind("constructor")).toBe(null);
    expect(surfaceKind("toString")).toBe(null);
    expect(surfaceKind("__proto__")).toBe(null);
    expect(surfaceKind("hasOwnProperty")).toBe(null);
  });
});

describe("orderKinds", () => {
  test("dedups to canonical cli, web, library order", () => {
    expect(orderKinds(["web", "cli"])).toEqual(["cli", "web"]);
    expect(orderKinds(["library", "library", "cli"])).toEqual(["cli", "library"]);
    expect(orderKinds([])).toEqual([]);
  });
});

describe("renderTemplate", () => {
  test("fills from explicit names and refuses leftovers", () => {
    expect(renderTemplate("{{A}} and {{B}}", { A: "x", B: "y" })).toBe("x and y");
    expect(() => renderTemplate("{{A}} {{NOPE}}", { A: "x" })).toThrow(
      "unknown placeholder in the prompt template: {{NOPE}}",
    );
  });

  test("a value copies literally, never rescanned", () => {
    expect(renderTemplate("{{A}}", { A: "$& {{B}}" })).toBe("$& {{B}}");
  });
});

describe("hasUpkeepLine", () => {
  test("the line reads present exact near the top, even wrapped across lines", () => {
    expect(hasUpkeepLine(`# Title\n\nParagraph.\n\n${UPKEEP_LINE}\n\n## Launch`)).toBe(true);
    expect(hasUpkeepLine(UPKEEP_LINE.replace(/ /gu, "\n"))).toBe(true);
  });

  test("a changed case, a buried copy and a paraphrase read absent", () => {
    expect(
      hasUpkeepLine(
        "A CHANGE which adds, changes or removes a feature updates that feature's page in the same change.",
      ),
    ).toBe(false);
    expect(hasUpkeepLine(`${"filler\n".repeat(30)}${UPKEEP_LINE}`)).toBe(false);
    expect(hasUpkeepLine("Keep the pages current when features change.")).toBe(false);
    expect(hasUpkeepLine("")).toBe(false);
  });
});

describe("indexNames", () => {
  test("folder and prose together read named", () => {
    expect(indexNames("- cli (verifier/cli/): command line", "cli")).toBe(true);
    expect(indexNames("- WEB (verifier/web/): Web Pages", "web")).toBe(true);
  });

  test("a relative folder link reads named", () => {
    expect(indexNames("- [cli](cli/) verifies the command line.", "cli")).toBe(true);
    expect(indexNames("- [web](web/) verifies the web pages.", "web")).toBe(true);
  });

  test("a missing folder or prose reads unnamed", () => {
    expect(indexNames("- cli: command line", "cli")).toBe(false);
    expect(indexNames("- cli (verifier/cli/)", "cli")).toBe(false);
    expect(indexNames("- [cli](cli/)", "cli")).toBe(false);
    expect(indexNames("", "cli")).toBe(false);
  });

  test("a wrong folder with the prose elsewhere reads unnamed", () => {
    expect(indexNames("- [cli](verifier/cli-extra/): command line", "cli")).toBe(false);
    expect(
      indexNames("- [cli](verifier/cli/): command line. See web pages at https://x/web/.", "web"),
    ).toBe(false);
    expect(
      indexNames("- [cli](cli/): command line. Web pages (web/) are not covered here.", "web"),
    ).toBe(false);
  });

  test("folder and prose on different lines read unnamed", () => {
    expect(indexNames("- [cli](cli/)\n- the command line verifier", "cli")).toBe(false);
  });
});

describe("proseList", () => {
  test("joins the prose with commas", () => {
    expect(proseList(["cli", "web"])).toBe("command line, web pages");
    expect(proseList(["library"])).toBe("library interface");
  });
});

describe("dirLines", () => {
  test("one mapping line per kind", () => {
    expect(dirLines(["cli", "web"])).toBe(
      "- the command line (cli) verifier goes in verifier/cli/\n- the web pages (web) verifier goes in verifier/web/",
    );
  });
});

describe("unlistedSentence", () => {
  test("none left out leaves no sentence", () => {
    expect(unlistedSentence(["cli", "web", "library"])).toBe("");
  });

  test("one left out is named", () => {
    expect(unlistedSentence(["cli", "web"])).toBe(
      "- Make no verifier for the library interface. If you notice it while you work, leave it out.",
    );
  });

  test("two left out share the sentence", () => {
    expect(unlistedSentence(["web"])).toBe(
      "- Make no verifier for the command line and the library interface. If you notice them while you work, leave them out.",
    );
  });
});

describe("joinBodies", () => {
  test("numbers each body and separates with rules", () => {
    expect(
      joinBodies([
        { kind: "cli", text: "CLI BODY" },
        { kind: "web", text: "WEB BODY" },
      ]),
    ).toBe(
      "---\n\n**Verifier 1 of 2: command line (cli).**\n\nCLI BODY\n\n---\n\n**Verifier 2 of 2: web pages (web).**\n\nWEB BODY",
    );
  });
});

describe("branchFileText", () => {
  test("a committed file reads its text, the rest read null", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "note.md", "hi");
      commitAll(repo, "first");
      expect(branchFileText(repo, "main", "note.md")).toBe("hi");
      expect(branchFileText(repo, "main", "missing.md")).toBe(null);
      expect(branchFileText(repo, "nope", "note.md")).toBe(null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("addedPaths", () => {
  test("lists paths added past the base, null for a bad ref", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "README.md", "# app\n");
      commitAll(repo, "base");
      const base = gitOrThrow(repo, "rev-parse", "HEAD").trim();
      gitOrThrow(repo, "checkout", "-qb", "verify-cli-web");
      writeRepoFile(repo, "verifier/README.md", "index\n");
      writeRepoFile(repo, "README.md", "# app changed\n");
      commitAll(repo, "session work");
      expect(addedPaths(repo, base, "verify-cli-web")).toEqual(["verifier/README.md"]);
      expect(addedPaths(repo, base, "nope")).toBe(null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("outsideAdded", () => {
  test("flags added paths outside verifier/, besides the handover", () => {
    expect(outsideAdded(["verifier/README.md", "HANDOVER.md"])).toEqual([]);
    expect(outsideAdded(["verifier/cli/README.md", "verify-old/x.md"])).toEqual([
      "verify-old/x.md",
    ]);
    expect(outsideAdded(["verifier/cli/README.md", "verifier-cli/README.md"])).toEqual([
      "verifier-cli/README.md",
    ]);
    expect(outsideAdded(["notes.md"])).toEqual(["notes.md"]);
  });
});

describe("addedUnder", () => {
  test("keeps added paths under a directory", () => {
    expect(
      addedUnder(["verifier/web/README.md", "verifier/cli/README.md"], "verifier/web"),
    ).toEqual(["verifier/web/README.md"]);
    expect(addedUnder(["verifier/README.md"], "verifier/web")).toEqual([]);
  });
});

describe("addedFeaturePages", () => {
  test("counts added markdown pages besides the features index", () => {
    expect(
      addedFeaturePages(
        ["verifier/cli/features/README.md", "verifier/cli/features/a.md", "verifier/cli/x.txt"],
        "verifier/cli",
      ),
    ).toEqual(["verifier/cli/features/a.md"]);
  });
});

function seedMultiBranch(
  repo: string,
  baseFiles: Record<string, string>,
  branchFiles: Record<string, string>,
): { base: string; branch: string } {
  for (const [rel, text] of Object.entries(baseFiles)) writeRepoFile(repo, rel, text);
  commitAll(repo, "base");
  const base = gitOrThrow(repo, "rev-parse", "HEAD").trim();
  gitOrThrow(repo, "checkout", "-qb", "verify-cli-web");
  for (const [rel, text] of Object.entries(branchFiles)) writeRepoFile(repo, rel, text);
  commitAll(repo, "session work");
  return { base, branch: "verify-cli-web" };
}

function goodVerifiers(
  kinds: ("cli" | "web" | "library")[] = ["cli", "web"],
): Record<string, string> {
  const prose: Record<string, string> = {
    cli: "command line",
    web: "web pages",
    library: "library interface",
  };
  const files: Record<string, string> = {
    "verifier/README.md": `# Verifiers\n\n${kinds
      .map((k) => `- [${k}](${k}/) verifies the ${prose[k]}.`)
      .join("\n")}\n`,
    "HANDOVER.md": "proved both\n",
  };
  for (const kind of kinds) {
    files[`verifier/${kind}/README.md`] = `# ${kind}\n\nDrives it.\n\n${UPKEEP_LINE}\n`;
    files[`verifier/${kind}/features/README.md`] = "# features\n";
    for (const page of ["a.md", "b.md", "c.md"]) {
      files[`verifier/${kind}/features/${page}`] = "# f\n";
    }
  }
  return files;
}

function checkBranch(
  baseFiles: Record<string, string>,
  branchFiles: Record<string, string>,
  surfaces: ("cli" | "web" | "library")[],
): () => void {
  const dir = tempDir();
  const repo = join(dir, "app");
  initRepo(repo);
  const { base, branch } = seedMultiBranch(repo, baseFiles, branchFiles);
  return () => {
    try {
      checkMultiVerifiers(repo, branch, base, surfaces);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

describe("checkMultiVerifiers", () => {
  test("a branch adding two complete verifiers passes", () => {
    expect(checkBranch({ "README.md": "# app\n" }, goodVerifiers(), ["cli", "web"])).not.toThrow();
  });

  test("a missing index, README, features index or page fails", () => {
    const cases: [string, (f: Record<string, string>) => void][] = [
      ["index", (f) => delete f["verifier/README.md"]],
      ["README", (f) => delete f["verifier/cli/README.md"]],
      ["features index", (f) => delete f["verifier/cli/features/README.md"]],
      ["page", (f) => delete f["verifier/cli/features/c.md"]],
    ];
    for (const [label, drop] of cases) {
      const files = goodVerifiers();
      drop(files);
      let threw = false;
      try {
        checkBranch({ "README.md": "# app\n" }, files, ["cli", "web"])();
      } catch {
        threw = true;
      }
      if (!threw) throw new Error(`case ${label} did not throw`);
    }
  });

  test("a missing upkeep line and a wrong index entry fail", () => {
    const noUpkeep = goodVerifiers();
    noUpkeep["verifier/cli/README.md"] = "# cli\n\nDrives it.\n";
    expect(checkBranch({ "README.md": "# app\n" }, noUpkeep, ["cli", "web"])).toThrow(/upkeep/);
    const wrongIndex = goodVerifiers();
    wrongIndex["verifier/README.md"] =
      "# Verifiers\n\n- [cli](verifier/cli-extra/): command line.\n- [web](web/) verifies the web pages.\n";
    expect(checkBranch({ "README.md": "# app\n" }, wrongIndex, ["cli", "web"])).toThrow(
      /names no command line/,
    );
  });

  test("an added unlisted verifier fails, pre-existing content passes", () => {
    const stray = goodVerifiers();
    stray["verifier/library/README.md"] = "# library\n";
    expect(checkBranch({ "README.md": "# app\n" }, stray, ["cli", "web"])).toThrow(
      /unlisted library/,
    );
    expect(
      checkBranch(
        { "README.md": "# app\n", "verifier/web/README.md": "# old web\n" },
        goodVerifiers(["cli", "library"]),
        ["cli", "library"],
      ),
    ).not.toThrow();
  });

  test("files added outside verifier/ fail, wherever they land", () => {
    const top = goodVerifiers();
    top["verifier-cli/README.md"] = "# stray\n";
    expect(checkBranch({ "README.md": "# app\n" }, top, ["cli", "web"])).toThrow(
      /outside verifier/,
    );
    const nested = goodVerifiers();
    nested["verify-app/extra.md"] = "stray\n";
    expect(
      checkBranch({ "README.md": "# app\n", "verify-app/README.md": "# old\n" }, nested, [
        "cli",
        "web",
      ]),
    ).toThrow(/outside verifier/);
  });

  test("an unlistable comparison fails instead of passing", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      const { base } = seedMultiBranch(repo, { "README.md": "# app\n" }, goodVerifiers());
      expect(() => checkMultiVerifiers(repo, "nope", base, ["cli", "web"])).toThrow(
        /cannot be compared/,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
