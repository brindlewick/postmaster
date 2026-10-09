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
  acceptLine,
  branchHasPath,
  type CheapFacts,
  type ChecksOutcome,
  type ClassifiedEntry,
  classifyEntries,
  commitsPastBase,
  committedFeaturePages,
  decideCheap,
  decideChecks,
  defaultBase,
  defaultLanding,
  failureOutcome,
  handoverFresh,
  isSurface,
  landTarget,
  lastLine,
  mergeAuthorityOf,
  normalizeFolder,
  outsidePaths,
  parseArgs,
  parseHandover,
  parseVerifyResults,
  pickBranch,
  pickWorktree,
  pruneWorktrees,
  refuseLine,
  remoteFromSymbolicRef,
  removeProvisioning,
  renderPrompt,
  repoTop,
  roleHarness,
  scrubGitEnv,
  surfaceProse,
  timeoutMs,
  unrunProject,
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
      req: { cmd: "prompt", repo: "/r", surface: "cli" },
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
      error: "unknown surface: telegraph (cli, web or library)",
    });
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
      req: { cmd: "make", repo: "/r", surface: "web", dispatch: "/d", timeout: 3600 },
    });
    expect(parseArgs(["make", "/r", "web", "--run", "/d", "--timeout", "60"])).toEqual({
      ok: true,
      req: { cmd: "make", repo: "/r", surface: "web", dispatch: "/d", timeout: 60 },
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

describe("landTarget", () => {
  const pointOriginHead = (repo: string, branch: string): void => {
    const sha = gitOrThrow(repo, "rev-parse", "HEAD").trim();
    gitOrThrow(repo, "update-ref", `refs/remotes/origin/${branch}`, sha);
    gitOrThrow(repo, "symbolic-ref", "refs/remotes/origin/HEAD", `refs/remotes/origin/${branch}`);
  };

  test("origin's head wins over a stale local main", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "README.md", "# app\n");
      commitAll(repo, "first");
      gitOrThrow(repo, "branch", "master");
      pointOriginHead(repo, "master");
      expect(landTarget(repo)).toBe("master");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a trunk default lands onto trunk", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "README.md", "# app\n");
      commitAll(repo, "first");
      gitOrThrow(repo, "branch", "-m", "main", "trunk");
      pointOriginHead(repo, "trunk");
      expect(landTarget(repo)).toBe("trunk");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("without an origin, main wins over master", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "README.md", "# app\n");
      commitAll(repo, "first");
      gitOrThrow(repo, "branch", "master");
      expect(landTarget(repo)).toBe("main");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a default that is not checked out lands nowhere", () => {
    const dir = tempDir();
    try {
      const repo = join(dir, "app");
      initRepo(repo);
      writeRepoFile(repo, "README.md", "# app\n");
      commitAll(repo, "first");
      pointOriginHead(repo, "other");
      expect(landTarget(repo)).toBe(null);
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

describe("check and land args", () => {
  test("check takes a repo, a branch, a run and a hand-over", () => {
    expect(parseArgs(["check", "/r", "verify-x", "--run", "/d", "--handover", "/h"])).toEqual({
      ok: true,
      req: {
        cmd: "check",
        repo: "/r",
        branch: "verify-x",
        dispatch: "/d",
        handover: "/h",
        folder: null,
        timeout: 3600,
      },
    });
  });

  test("land takes the same plus an optional route", () => {
    expect(
      parseArgs([
        "land",
        "/r",
        "verify-x",
        "--run",
        "/d",
        "--handover",
        "/h",
        "--folder",
        "custom/",
        "--timeout",
        "60",
        "--landing",
        "local",
      ]),
    ).toEqual({
      ok: true,
      req: {
        cmd: "land",
        repo: "/r",
        branch: "verify-x",
        dispatch: "/d",
        handover: "/h",
        folder: "custom",
        timeout: 60,
        landing: "local",
      },
    });
    const bare = parseArgs(["land", "/r", "verify-x", "--run", "/d", "--handover", "/h"]);
    expect(bare).toEqual({
      ok: true,
      req: {
        cmd: "land",
        repo: "/r",
        branch: "verify-x",
        dispatch: "/d",
        handover: "/h",
        folder: null,
        timeout: 3600,
        landing: null,
      },
    });
  });

  test("a missing branch, run, hand-over or folder value fails", () => {
    expect(parseArgs(["check", "/r"])).toEqual({
      ok: false,
      error: "check takes a repo and a branch",
    });
    expect(parseArgs(["check", "/r", "b", "--handover", "/h"])).toEqual({
      ok: false,
      error: "check needs --run <dispatch>",
    });
    expect(parseArgs(["land", "/r", "b", "--run", "/d"])).toEqual({
      ok: false,
      error: "land needs --handover <file>",
    });
    expect(parseArgs(["check", "/r", "b", "--run", "/d", "--handover", "/h", "--folder"])).toEqual({
      ok: false,
      error: "check needs --folder <dir>",
    });
  });

  test("a bad folder, route, timeout or flag fails", () => {
    expect(
      parseArgs(["check", "/r", "b", "--run", "/d", "--handover", "/h", "--folder", "/abs"]).ok,
    ).toBe(false);
    expect(
      parseArgs(["land", "/r", "b", "--run", "/d", "--handover", "/h", "--landing", "sideways"]),
    ).toEqual({ ok: false, error: "bad landing: sideways (local or pull-request)" });
    expect(
      parseArgs(["check", "/r", "b", "--run", "/d", "--handover", "/h", "--landing", "local"]),
    ).toEqual({ ok: false, error: "unknown flag for check: --landing" });
    expect(
      parseArgs(["land", "/r", "b", "--run", "/d", "--handover", "/h", "--timeout", "soon"]).ok,
    ).toBe(false);
    expect(parseArgs(["check", "/r", "b", "--run", "/d", "--handover", "/h", "--fresh"]).ok).toBe(
      false,
    );
  });
});

describe("normalizeFolder", () => {
  test("strips a leading ./ and trailing slashes", () => {
    expect(normalizeFolder("verify-app/")).toEqual({ ok: true, folder: "verify-app" });
    expect(normalizeFolder("./verify-app")).toEqual({ ok: true, folder: "verify-app" });
    expect(normalizeFolder("./a/b//")).toEqual({ ok: true, folder: "a/b" });
    expect(normalizeFolder("a/b")).toEqual({ ok: true, folder: "a/b" });
  });

  test("an empty, absolute or escaping folder fails", () => {
    expect(normalizeFolder("").ok).toBe(false);
    expect(normalizeFolder(".").ok).toBe(false);
    expect(normalizeFolder("/tmp/x").ok).toBe(false);
    expect(normalizeFolder("a/../b").ok).toBe(false);
    expect(normalizeFolder("..").ok).toBe(false);
  });
});

describe("parseHandover", () => {
  test("one section with its folder and proof", () => {
    expect(
      parseHandover("# Handover\n\n## Verifier: cli\nFolder: verify-app\nProof: /tmp/p.log\n"),
    ).toEqual({
      ok: true,
      entries: [{ name: "cli", folder: "verify-app", proof: "/tmp/p.log" }],
    });
  });

  test("several sections keep their order and prose is ignored", () => {
    const parsed = parseHandover(
      [
        "# Handover",
        "",
        "Proved below.",
        "## Verifier: cli",
        "Folder: verify-app/cli",
        "Proof: none - the drive never finished",
        "",
        "What was left undone: the cli drive.",
        "## Verifier: web",
        "Folder: verify-app/web/",
        "Drive: second",
        "Proof: /tmp/w.log",
        "",
      ].join("\n"),
    );
    expect(parsed).toEqual({
      ok: true,
      entries: [
        { name: "cli", folder: "verify-app/cli", proof: "none - the drive never finished" },
        { name: "web", folder: "verify-app/web", proof: "/tmp/w.log" },
      ],
    });
  });

  test("the first Folder: and Proof: line wins, and no section means no entries", () => {
    const parsed = parseHandover(
      "## Verifier: cli\nFolder: a\nFolder: b\nProof: /tmp/1\nProof: /tmp/2\n",
    );
    expect(parsed).toEqual({
      ok: true,
      entries: [{ name: "cli", folder: "a", proof: "/tmp/1" }],
    });
    expect(parseHandover("# Handover\n\nNothing was proved.\n")).toEqual({ ok: true, entries: [] });
  });

  test("a missing Proof: line names no proof file", () => {
    expect(parseHandover("## Verifier: cli\nFolder: verify-app\n")).toEqual({
      ok: true,
      entries: [{ name: "cli", folder: "verify-app", proof: null }],
    });
  });

  test("a missing or escaping folder, a missing or doubled name fails", () => {
    expect(parseHandover("## Verifier: cli\nProof: /tmp/p\n")).toEqual({
      ok: false,
      error: "the hand-over names no folder for cli",
    });
    expect(parseHandover("## Verifier: cli\nFolder: /tmp/x\nProof: /tmp/p\n")).toEqual({
      ok: false,
      error: "the hand-over folder for cli is not inside the repo: /tmp/x",
    });
    expect(parseHandover("## Verifier:\nFolder: a\n")).toEqual({
      ok: false,
      error: "the hand-over has a verifier with no name",
    });
    expect(parseHandover("## Verifier: cli\nFolder: a\n## Verifier: cli\nFolder: b\n")).toEqual({
      ok: false,
      error: "the hand-over names cli twice",
    });
  });
});

describe("classifyEntries", () => {
  const entries = [
    { name: "kept", folder: "v/kept", proof: "/tmp/kept.log" },
    { name: "gone", folder: "v/gone", proof: "/tmp/gone.log" },
    { name: "none", folder: "v/none", proof: "none - no drive" },
    { name: "blank", folder: "v/blank", proof: null },
  ];
  const isFile = (p: string): boolean => p === "/tmp/kept.log";

  test("proven means the proof names an existing absolute file", () => {
    const out = classifyEntries(entries, isFile);
    expect(out.filter((e) => e.proven).map((e) => e.name)).toEqual(["kept"]);
    expect(out.find((e) => e.name === "gone")?.failReason).toBe("proof /tmp/gone.log missing");
    expect(out.find((e) => e.name === "none")?.failReason).toBe("no proof file");
    expect(out.find((e) => e.name === "blank")?.failReason).toBe("no proof file");
  });

  test("a relative proof is no proof file", () => {
    const out = classifyEntries([{ name: "r", folder: "v/r", proof: "proof.log" }], () => true);
    expect(out[0]?.proven).toBe(false);
    expect(out[0]?.failReason).toBe("no proof file");
  });
});

describe("outsidePaths", () => {
  test("only paths under the folder pass", () => {
    expect(outsidePaths(["verify-app/a.md", "verify-app/x/b.ts"], "verify-app")).toEqual([]);
    expect(outsidePaths(["biome.json", "verify-app/a.md", "src/x.ts"], "verify-app")).toEqual([
      "biome.json",
      "src/x.ts",
    ]);
    expect(outsidePaths(["verify-app"], "verify-app")).toEqual(["verify-app"]);
    expect(outsidePaths(["verify-app2/a.md"], "verify-app")).toEqual(["verify-app2/a.md"]);
  });
});

describe("parseVerifyResults", () => {
  test("the gate, the failures and every result in order", () => {
    const summary = parseVerifyResults(
      [
        "gate: pass, exit 0, 1s: npm run check",
        "examples: not run, exit 3, 0s: /tool/scripts/run verify-examples",
        "  the ticket has no User journey",
        "cli: pass, exit 0, 0s: bun src/cli.ts",
      ].join("\n"),
    );
    expect(summary.gate).toBe("pass");
    expect(summary.failed).toEqual([]);
    expect(summary.notRun).toEqual(["examples"]);
    expect(summary.results).toEqual([
      { name: "gate", result: "pass" },
      { name: "examples", result: "not run" },
      { name: "cli", result: "pass" },
    ]);
  });

  test("failures are named and a missing gate reads as none", () => {
    const summary = parseVerifyResults(
      ["gate: fail, exit 1, 1s: npm run check", "cli: fail, exit 1, 0s: bun src/cli.ts"].join("\n"),
    );
    expect(summary.gate).toBe("fail");
    expect(summary.failed).toEqual(["gate", "cli"]);
    expect(summary.notRun).toEqual([]);
    expect(parseVerifyResults("nothing reported\n").gate).toBe(null);
  });
});

describe("unrunProject", () => {
  const kinds = { gate: "project", browser: "project", examples: "tool", journey: "tool" };

  test("a project check unrun refuses; a tool check unrun is expected", () => {
    expect(unrunProject(["browser"], kinds)).toEqual(["browser"]);
    expect(unrunProject(["examples", "journey"], kinds)).toEqual([]);
    expect(unrunProject(["examples", "browser", "journey"], kinds)).toEqual(["browser"]);
  });

  test("the gate stays out, and an unknown kind fails closed", () => {
    expect(unrunProject(["gate"], kinds)).toEqual([]);
    expect(unrunProject(["strange"], kinds)).toEqual(["strange"]);
  });
});

describe("mergeAuthorityOf and defaultLanding", () => {
  test("postmaster is named, anything else is the user", () => {
    expect(mergeAuthorityOf('{"config":{"ship":{"merge_authority":"postmaster"}}}')).toBe(
      "postmaster",
    );
    expect(mergeAuthorityOf('{"config":{"ship":{"merge_authority":"user"}}}')).toBe("user");
    expect(mergeAuthorityOf("{}")).toBe("user");
    expect(mergeAuthorityOf("not json")).toBe("user");
    expect(mergeAuthorityOf("")).toBe("user");
  });

  test("an origin remote means a pull request", () => {
    expect(defaultLanding(true)).toBe("pull-request");
    expect(defaultLanding(false)).toBe("local");
  });
});

describe("timeoutMs and lastLine", () => {
  test("seconds to milliseconds, capped past the timer's range", () => {
    expect(timeoutMs(1)).toBe(1000);
    expect(timeoutMs(3600)).toBe(3600000);
    expect(timeoutMs(999999999)).toBe(2147483647);
  });

  test("the last non-empty trimmed line, or the exit", () => {
    expect(lastLine("first\nsecond\n", 1)).toBe("second");
    expect(lastLine("  padded  \n\n", 2)).toBe("padded");
    expect(lastLine("", 3)).toBe("exit 3");
    expect(lastLine("   \n", 127)).toBe("exit 127");
  });
});

describe("decideCheap and decideChecks", () => {
  const entry = (
    name: string,
    folder: string,
    proven: boolean,
    failReason: string,
    proof: string | null = null,
  ): ClassifiedEntry => ({ name, folder, proof, proven, failReason });
  const cheap = (over: Partial<CheapFacts>): CheapFacts => ({
    branch: "verify-x",
    classified: [],
    failedPresent: [],
    provenEmpty: [],
    outside: [],
    ...over,
  });

  test("no proven verifier names each failure", () => {
    expect(
      decideCheap(
        cheap({
          classified: [
            entry("cli", "v/cli", false, "no proof file"),
            entry("web", "v/web", false, "proof /tmp/w missing", "/tmp/w"),
          ],
        }),
      ),
    ).toBe("no proven verifier (cli: no proof file; web: proof /tmp/w missing)");
    expect(decideCheap(cheap({}))).toBe("no proven verifier (the hand-over names none)");
  });

  test("a failed folder, an empty proven verifier, then outside paths", () => {
    const landed = [entry("web", "v/web", true, "", "/tmp/w")];
    expect(
      decideCheap(
        cheap({
          classified: [...landed, entry("cli", "v/cli", false, "no proof file")],
          failedPresent: [entry("cli", "v/cli", false, "no proof file")],
        }),
      ),
    ).toBe("failed verifier still on the branch: cli (v/cli)");
    expect(
      decideCheap(
        cheap({ classified: landed, provenEmpty: [entry("web", "v/web", true, "", "/tmp/w")] }),
      ),
    ).toBe("proven verifier has no files on the branch: web (v/web)");
    expect(decideCheap(cheap({ classified: landed, outside: ["biome.json", "AGENTS.md"] }))).toBe(
      "outside the verifiers' folder: biome.json, AGENTS.md",
    );
    expect(decideCheap(cheap({ classified: landed }))).toBe(null);
  });

  test("a long outside list is capped", () => {
    const landed = [entry("web", "v/web", true, "", "/tmp/w")];
    const outside = Array.from({ length: 12 }, (_, n) => `f${n}.md`);
    expect(decideCheap(cheap({ classified: landed, outside }))).toBe(
      "outside the verifiers' folder: f0.md, f1.md, f2.md, f3.md, f4.md, f5.md, f6.md, f7.md, f8.md, f9.md and 2 more",
    );
  });

  test("the timeout, the failures, then the gate", () => {
    const ran = (summary: { gate: string | null; failed: string[] }): ChecksOutcome => ({
      kind: "ran",
      summary: { ...summary, notRun: [], results: [] },
      unrunProject: [],
    });
    expect(decideChecks({ kind: "timeout", seconds: 1 })).toBe(
      "past its limit (the checks ran longer than 1s)",
    );
    expect(decideChecks({ kind: "unrunnable", error: "the checks could not run: exit 1" })).toBe(
      "the checks could not run: exit 1",
    );
    expect(decideChecks(ran({ gate: "fail", failed: ["gate", "cli"] }))).toBe(
      "checks failed (gate: fail; cli: fail)",
    );
    expect(decideChecks(ran({ gate: "not run", failed: [] }))).toBe("gate did not pass (not run)");
    expect(decideChecks(ran({ gate: null, failed: [] }))).toBe("gate did not pass (not reported)");
    expect(decideChecks(ran({ gate: "pass", failed: [] }))).toBe(null);
  });

  test("an unrun project check refuses, after the failures", () => {
    const ran = (unrunProject: string[], failed: string[] = []): ChecksOutcome => ({
      kind: "ran",
      summary: { gate: "pass", failed, notRun: unrunProject, results: [] },
      unrunProject,
    });
    expect(decideChecks(ran(["browser"]))).toBe("checks not run (browser: not run)");
    expect(decideChecks(ran(["browser", "cli"]))).toBe(
      "checks not run (browser: not run; cli: not run)",
    );
    expect(decideChecks(ran(["browser"], ["cli"]))).toBe("checks failed (cli: fail)");
    expect(decideChecks(ran([]))).toBe(null);
  });
});

describe("acceptLine and refuseLine", () => {
  test("one line naming what lands and what stays out", () => {
    expect(
      acceptLine("verify-both", [
        { name: "cli", folder: "v/cli", proof: null, proven: false, failReason: "no proof file" },
        { name: "web", folder: "v/web", proof: "/tmp/w", proven: true, failReason: "" },
      ]),
    ).toBe(
      "accept: verify-both lands 1 verifier: web (v/web, proof /tmp/w); left out: cli (no proof file)",
    );
    expect(
      acceptLine("verify-cli", [
        { name: "cli", folder: "v", proof: "/tmp/p", proven: true, failReason: "" },
      ]),
    ).toBe("accept: verify-cli lands 1 verifier: cli (v, proof /tmp/p); left out: none");
    expect(refuseLine("verify-x", "no proven verifier (none named)")).toBe(
      "refuse: verify-x lands nothing: no proven verifier (none named)",
    );
  });
});
