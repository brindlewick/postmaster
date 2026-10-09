// Tests beside scripts/verifier.ts: argument parsing, prompt rendering, naming, base
// detection and the wall scan. The live session stays out; acceptance-323 covers the
// command boundary as a subprocess.
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitAll, gitOrThrow, initRepo, RUN, writeRepoFile } from "./acceptance-323.ts";
import { run } from "./lib/proc.ts";
import {
  branchHasPath,
  commitsPastBase,
  committedFeaturePages,
  defaultBase,
  deliverInstructions,
  failureOutcome,
  handoverFresh,
  isSurface,
  modeBlocks,
  parseArgs,
  pickBranch,
  pickWorktree,
  pruneWorktrees,
  remoteFromSymbolicRef,
  removeProvisioning,
  renderPrompt,
  repoTop,
  roleHarness,
  scrubGitEnv,
  sendText,
  sendVerdict,
  surfaceProse,
  spawnCommand,
  verifierHandle,
  verifyDirName,
  waitForHandover,
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
      req: { cmd: "prompt", repo: "/r", surface: "cli", headless: false },
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

  test("prompt takes --headless and refuses any other flag", () => {
    expect(parseArgs(["prompt", "/r", "cli", "--headless"])).toEqual({
      ok: true,
      req: { cmd: "prompt", repo: "/r", surface: "cli", headless: true },
    });
    expect(parseArgs(["prompt", "/r", "cli", "--fresh"])).toEqual({
      ok: false,
      error: "unknown flag for prompt: --fresh",
    });
    expect(parseArgs(["prompt", "/r", "cli", "--headless", "--headless"])).toEqual({
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
    const out = renderPrompt(
      "{{REPO}} {{SURFACE}} {{SURFACE_PROSE}} {{VERIFY_DIR}} {{BASE}} {{ASK_RULE}} {{SECRETS_RULE}} {{HANDOVER_UNASKED}}",
      {
        repo: "/r",
        surface: "cli",
        surfaceProse: "command line",
        verifyDir: "verify-app",
        base: "origin/main",
        askRule: "ask",
        secretsRule: "secrets",
        handoverUnasked: "unasked",
      },
    );
    expect(out).toBe("/r cli command line verify-app origin/main ask secrets unasked");
  });

  test("dollar patterns in a value copy literally", () => {
    const out = renderPrompt("{{REPO}} {{VERIFY_DIR}}", {
      repo: "/x/app$$x",
      surface: "cli",
      surfaceProse: "command line",
      verifyDir: "verify-$&-'",
      base: "main",
      askRule: "ask",
      secretsRule: "secrets",
      handoverUnasked: "",
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
      askRule: "ask",
      secretsRule: "secrets",
      handoverUnasked: "",
    });
    expect(out).toBe("/x/{{BASE}}-app origin/main");
    const unknown = renderPrompt("{{REPO}}", {
      repo: "/x/{{NAME}}-app",
      surface: "cli",
      surfaceProse: "command line",
      verifyDir: "verify-app",
      base: "main",
      askRule: "ask",
      secretsRule: "secrets",
      handoverUnasked: "",
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
        askRule: "ask",
        secretsRule: "secrets",
        handoverUnasked: "",
      }),
    ).toThrow("unknown placeholder in the prompt template: {{NOPE}}");
  });
});

describe("modeBlocks", () => {
  test("the interactive session asks and names secret files", () => {
    const blocks = modeBlocks(false);
    expect(blocks.askRule).toContain("ask the user only what you cannot observe");
    expect(blocks.secretsRule).toContain("name of the file that holds it");
    expect(blocks.handoverUnasked).toBe("");
  });

  test("the headless session cannot ask and lists what it could not", () => {
    const blocks = modeBlocks(true);
    expect(blocks.askRule).toContain("cannot ask anyone anything");
    expect(blocks.secretsRule).toContain("Never invent a value");
    expect(blocks.handoverUnasked).toContain("Unasked questions");
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

  test("the handle names the repo and the branch, tagged by its path", () => {
    expect(verifierHandle("/x/app", "verify-cli")).toMatch(
      /^verifier-app-verify-cli-[0-9a-f]{8}$/u,
    );
    expect(verifierHandle("/x/app", "verify-cli-2")).toMatch(
      /^verifier-app-verify-cli-2-[0-9a-f]{8}$/u,
    );
  });

  test("the same directory name in different parents gets different handles", () => {
    const a = verifierHandle("/x/app", "verify-cli");
    expect(verifierHandle("/x/app", "verify-cli")).toBe(a);
    expect(verifierHandle("/y/app", "verify-cli")).not.toBe(a);
  });
});

describe("sendText", () => {
  test("points the session at its instructions file", () => {
    const text = sendText("/d/logs/verifier-verify-cli-prompt.txt");
    expect(text).toContain("/d/logs/verifier-verify-cli-prompt.txt");
    expect(text.endsWith("\n")).toBe(true);
  });
});

describe("spawnCommand", () => {
  test("starts the form in the worktree explicitly, then execs it", () => {
    expect(spawnCommand("/wt", ["muse", "--model", "probe-model"])).toEqual([
      "bash",
      "-c",
      `cd -- '/wt' && exec "$@"`,
      "_",
      "muse",
      "--model",
      "probe-model",
    ]);
  });

  test("quotes spaces and single quotes in the worktree path", () => {
    expect(spawnCommand("/o'brien/r e", ["muse"])[2]).toBe(
      "cd -- '/o'\\''brien/r e' && exec \"$@\"",
    );
  });
});

describe("sendVerdict", () => {
  test("settled and still-working both count as delivered", () => {
    expect(sendVerdict(0, "sent 10 bytes to h, and it settled")).toBe("sent");
    expect(sendVerdict(3, "sent; h did not settle within 60s")).toBe("sent");
  });

  test("no turn started retries, anything else fails", () => {
    expect(sendVerdict(3, "h got the message, but Herdr saw no turn start")).toBe("retry");
    expect(sendVerdict(1, "herdr could not prompt h")).toBe("failed");
    expect(sendVerdict(3, "no Herdr or tmux here")).toBe("failed");
  });

  test("a block after accepting keeps the prompt; a block before accepting fails", () => {
    expect(sendVerdict(3, "sent; h stopped at an approval or a question")).toBe("sent");
    expect(
      sendVerdict(3, "h is at an approval or a question; the user answers it in Herdr first"),
    ).toBe("failed");
  });
});

describe("deliverInstructions", () => {
  type Run = { code: number; out: string; err: string };
  const sent: Run = { code: 0, out: "sent 10 bytes to h, and it settled", err: "" };
  const stalled: Run = { code: 3, out: "", err: "h got the message, but Herdr saw no turn start" };
  const readOk: Run = { code: 0, out: "You are making a verifier", err: "" };

  test("a first-try send makes no other call", () => {
    const calls: string[][] = [];
    const r = deliverInstructions(
      (args) => {
        calls.push(args);
        return sent;
      },
      "h",
      "/f",
    );
    expect(r).toEqual({ delivered: true, attempts: 1, lastError: "" });
    expect(calls).toEqual([["host", "send", "h", "/f", "--wait", "60"]]);
  });

  test("a dropped prompt is read and resent", () => {
    const calls: string[][] = [];
    let sends = 0;
    const r = deliverInstructions(
      (args) => {
        calls.push(args);
        if (args[1] === "read") return readOk;
        sends++;
        return sends === 1 ? stalled : sent;
      },
      "h",
      "/f",
    );
    expect(r).toEqual({ delivered: true, attempts: 2, lastError: "" });
    expect(calls).toEqual([
      ["host", "send", "h", "/f", "--wait", "60"],
      ["host", "read", "h", "20"],
      ["host", "send", "h", "/f", "--wait", "60"],
    ]);
  });

  test("a failure that is not a drop stops at once", () => {
    const calls: string[][] = [];
    const r = deliverInstructions(
      (args) => {
        calls.push(args);
        return { code: 1, out: "", err: "herdr could not prompt h" };
      },
      "h",
      "/f",
    );
    expect(r.delivered).toBe(false);
    expect(r.attempts).toBe(1);
    expect(r.lastError).toContain("could not prompt");
    expect(calls).toHaveLength(1);
  });

  test("drops past the bound fail with the last send's error", () => {
    const calls: string[][] = [];
    const r = deliverInstructions(
      (args) => {
        calls.push(args);
        return args[1] === "read" ? readOk : stalled;
      },
      "h",
      "/f",
    );
    expect(r.delivered).toBe(false);
    expect(r.attempts).toBe(3);
    expect(r.lastError).toContain("no turn start");
    expect(calls.filter((c) => c[1] === "send")).toHaveLength(3);
    expect(calls.filter((c) => c[1] === "read")).toHaveLength(2);
  });

  test("a handle the read cannot reach fails without another send", () => {
    const calls: string[][] = [];
    const r = deliverInstructions(
      (args) => {
        calls.push(args);
        if (args[1] === "read") return { code: 1, out: "", err: "no live Herdr agent named h" };
        return stalled;
      },
      "h",
      "/f",
    );
    expect(r.delivered).toBe(false);
    expect(r.lastError).toContain("never registered");
    expect(calls.filter((c) => c[1] === "send")).toHaveLength(1);
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

describe("waitForHandover", () => {
  test("a fresh handover already there returns at once, with no sleep", () => {
    const dir = tempDir();
    try {
      const wt = join(dir, "wt");
      mkdirSync(wt, { recursive: true });
      writeFileSync(join(wt, "HANDOVER.md"), "hi\n");
      const naps: number[] = [];
      expect(
        waitForHandover(
          wt,
          0,
          60,
          (ms) => {
            naps.push(ms);
          },
          () => 1000,
        ),
      ).toBe(true);
      expect(naps).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("no handover sleeps in short naps until the timeout, then gives up", () => {
    const dir = tempDir();
    try {
      const wt = join(dir, "wt");
      mkdirSync(wt, { recursive: true });
      const naps: number[] = [];
      let now = 0;
      const ok = waitForHandover(
        wt,
        0,
        12,
        (ms) => {
          naps.push(ms);
          now += ms;
        },
        () => now,
      );
      expect(ok).toBe(false);
      expect(naps).toEqual([5000, 5000, 2000]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a stale handover never counts, however long the wait", () => {
    const dir = tempDir();
    try {
      const wt = join(dir, "wt");
      mkdirSync(wt, { recursive: true });
      writeFileSync(join(wt, "HANDOVER.md"), "old\n");
      const naps: number[] = [];
      let now = 0;
      const ok = waitForHandover(
        wt,
        999999999999999,
        6,
        (ms) => {
          naps.push(ms);
          now += ms;
        },
        () => now,
      );
      expect(ok).toBe(false);
      expect(naps).toEqual([5000, 1000]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a handover landing mid-wait ends the wait", () => {
    const dir = tempDir();
    try {
      const wt = join(dir, "wt");
      mkdirSync(wt, { recursive: true });
      const naps: number[] = [];
      let now = 0;
      const ok = waitForHandover(
        wt,
        0,
        60,
        (ms) => {
          naps.push(ms);
          now += ms;
          writeFileSync(join(wt, "HANDOVER.md"), "hi\n");
        },
        () => now,
      );
      expect(ok).toBe(true);
      expect(naps).toEqual([5000]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
