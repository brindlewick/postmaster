// Acceptance tests for #342: every reviewer works in its own copy of the repository.
// The runbook is the artifact under test: its review cut and pre-launch check must
// pass --clone for every lens, and its prose must call the reviewer folders clones.
// The C1 folder checks cut those folders on a scratch repository in the runbook's
// cut shape and remove them with review-round teardown. Order-dependent, as in
// cut-scratch.test.ts: cut, then properties, then teardown.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = join(import.meta.dir, "run");
const coachmanPath = join(import.meta.dir, "..", "skills", "postmaster", "coachman.md");
const harnessesPath = join(import.meta.dir, "..", "skills", "postmaster", "harnesses.md");
const hostsPath = join(import.meta.dir, "..", "skills", "postmaster", "hosts.md");

interface Run {
  code: number;
  out: string;
  err: string;
}

function cliRun(...args: string[]): Run {
  const r = spawnSync(cli, args, { encoding: "utf8" });
  return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

function git(...args: string[]): Run {
  const r = spawnSync("git", args, { encoding: "utf8" });
  return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

function need(r: Run, what: string): void {
  if (r.code !== 0) throw new Error(`${what} failed: ${r.out}${r.err}`);
}

function squash(s: string): string {
  return s.replace(/\s+/gu, " ");
}

describe("the runbook prescribes a clone under every lens", () => {
  test("the review cut passes --clone for every lens, not only security", () => {
    const coach = readFileSync(coachmanPath, "utf8");
    expect(coach).not.toContain('[ "$LENS" = security ] && CLONE=');
    expect(coach).toContain('cut-scratch <repo> <synthesis-wt> "$DEST" "$SNAP" --clone <BASE>');
    expect(coach).toContain("Every lens reviews from clones");
  });

  test("the pre-launch check requires a clone under every lens", () => {
    const coach = readFileSync(coachmanPath, "utf8");
    expect(coach).toContain(
      'cut-scratch --check <repo>/.worktrees/<TICKET>-rev-$LENS-$L "$SNAP" --clone <BASE>',
    );
    expect(squash(coach)).toContain("and a clone whose `origin/HEAD` leads back to BASE");
    expect(squash(coach)).not.toContain("under the security lens a clone whose");
  });

  test("the paths table and the brief wording call reviewer folders clones", () => {
    const coach = readFileSync(coachmanPath, "utf8");
    expect(coach).toContain("a clone of the repository under every lens");
    expect(coach).not.toContain("a worktree under the others");
    expect(coach).toContain("its own disposable copy of the repository");
    expect(coach).not.toContain("its own disposable worktree");
  });

  test("the bug lens text calls a review scratch a clone", () => {
    const harnesses = readFileSync(harnessesPath, "utf8");
    expect(harnesses).toContain("which is a clone detached at the snapshot");
    expect(harnesses).not.toContain("which is a worktree detached at the snapshot");
  });

  test("the host placement text covers reviewer scratches, not reviewer worktrees", () => {
    const hosts = readFileSync(hostsPath, "utf8");
    expect(hosts).toContain(
      "That includes reviewer scratches: a clone is never opened as a separate",
    );
    expect(hosts).not.toContain("reviewer worktrees and security-review clones");
  });
});

describe("C1: reviewer folders cut as clones", () => {
  const lenses = ["style", "bug", "security"];
  const lane = "lane";
  let tmp = "";
  let repo = "";
  let synth = "";
  let dispatch = "";
  let base = "";
  let snap = "";
  let savedEnv: Record<string, string | undefined> = {};

  function dest(lens: string): string {
    return join(repo, ".worktrees", `T-rev-${lens}-${lane}`);
  }

  beforeAll(() => {
    savedEnv = {
      GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME,
      GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL,
      GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME,
      GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL,
      PATH: process.env.PATH,
      POSTMASTER_HOST: process.env.POSTMASTER_HOST,
      POSTMASTER_HOST_STATE: process.env.POSTMASTER_HOST_STATE,
      POSTMASTER_HOST_STOP_WAIT: process.env.POSTMASTER_HOST_STOP_WAIT,
      POSTMASTER_HOST_CLOSE_WAIT: process.env.POSTMASTER_HOST_CLOSE_WAIT,
    };
    process.env.GIT_AUTHOR_NAME = "t";
    process.env.GIT_AUTHOR_EMAIL = "t@t";
    process.env.GIT_COMMITTER_NAME = "t";
    process.env.GIT_COMMITTER_EMAIL = "t@t";
    const tmpRaw = mkdtempSync(join(tmpdir(), "reviewer-copy-"));
    let phys = "";
    try {
      phys = realpathSync(tmpRaw);
    } catch {
      phys = "";
    }
    tmp = phys || tmpRaw;
    repo = join(tmp, "repo");
    need(git("init", "-q", "-b", "main", repo), "init");
    writeFileSync(join(repo, "a.txt"), "base\n");
    need(git("-C", repo, "add", "a.txt"), "add base");
    need(git("-C", repo, "commit", "-qm", "base"), "base commit");
    base = git("-C", repo, "rev-parse", "HEAD").out.trim();
    need(git("-C", repo, "worktree", "add", "-q", "-b", "T", ".worktrees/T"), "synthesis worktree");
    synth = join(repo, ".worktrees", "T");
    const branch = git("-C", synth, "rev-parse", "--abbrev-ref", "HEAD").out.trim();
    if (branch !== "T") throw new Error(`synthesis worktree is on ${branch}, not T`);
    writeFileSync(join(synth, "b.txt"), "change\n");
    need(git("-C", synth, "add", "b.txt"), "add change");
    need(git("-C", synth, "commit", "-qm", "change"), "change commit");
    snap = git("-C", synth, "rev-parse", "HEAD").out.trim();
    dispatch = join(tmp, "T");
    mkdirSync(join(dispatch, "logs"), { recursive: true });
    mkdirSync(join(tmp, "bin"), { recursive: true });
    mkdirSync(join(tmp, "host"), { recursive: true });
    for (const h of ["herdr", "tmux"]) {
      writeFileSync(join(tmp, "bin", h), "#!/bin/sh\nexit 1\n");
      chmodSync(join(tmp, "bin", h), 0o755);
    }
    process.env.PATH = `${join(tmp, "bin")}:${process.env.PATH}`;
    process.env.POSTMASTER_HOST = "none";
    process.env.POSTMASTER_HOST_STATE = join(tmp, "host");
    process.env.POSTMASTER_HOST_STOP_WAIT = "2";
    process.env.POSTMASTER_HOST_CLOSE_WAIT = "1";
  });

  afterAll(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmSync(tmp, { recursive: true, force: true });
  });

  test("the runbook's cut makes a clone for a style, a bug and a security reviewer", () => {
    for (const lens of lenses) {
      const r = cliRun("cut-scratch", repo, synth, dest(lens), snap, "--clone", base);
      if (r.code !== 0) throw new Error(`${lens} cut failed: ${r.out}${r.err}`);
      expect(r.code).toBe(0);
    }
  }, 30000);

  test("each folder is a repository of its own at the snapshot, detached", () => {
    for (const lens of lenses) {
      const f = dest(lens);
      const gitDir = git("-C", f, "rev-parse", "--absolute-git-dir").out.trim();
      const commonDir = git(
        "-C",
        f,
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
      ).out.trim();
      expect(gitDir).not.toBe("");
      expect(gitDir).toBe(commonDir);
      const alt =
        readFileSync(join(gitDir, "objects/info/alternates"), "utf8").split("\n")[0]?.trim() ?? "";
      expect(realpathSync(alt)).toBe(join(repo, ".git/objects"));
      expect(git("-C", f, "config", "remote.origin.url").out.trim()).toBe(repo);
      expect(git("-C", f, "rev-parse", "HEAD").out.trim()).toBe(snap);
      expect(git("-C", f, "symbolic-ref", "-q", "HEAD").code).not.toBe(0);
      expect(cliRun("cut-scratch", "--kind", f).out.trim()).toBe(`clone ${repo}`);
    }
  }, 15000);

  test("negative control: without --clone the same cut is a worktree", () => {
    const plain = join(tmp, "wt-control");
    const r = cliRun("cut-scratch", repo, synth, plain, snap);
    if (r.code !== 0) throw new Error(`control cut failed: ${r.out}${r.err}`);
    expect(cliRun("cut-scratch", "--kind", plain).out.trim()).toBe(`worktree ${repo}`);
    const rm = cliRun("cut-scratch", "--remove", repo, plain);
    expect(rm.code).toBe(0);
    expect(existsSync(plain)).toBe(false);
  }, 15000);

  test("review-round teardown removes each reviewer folder", () => {
    const pairs = lenses.map((lens) => `${lens}:${lane}`);
    const r = cliRun("review-round", "teardown", dispatch, "1", repo, ...pairs);
    if (r.code !== 0) throw new Error(`teardown failed: ${r.out}${r.err}`);
    expect(r.code).toBe(0);
    expect(readFileSync(join(dispatch, "run-log.md"), "utf8")).toContain(
      "round 1: removed 3 of 3 scratches",
    );
    for (const lens of lenses) expect(existsSync(dest(lens))).toBe(false);
  }, 30000);
});
