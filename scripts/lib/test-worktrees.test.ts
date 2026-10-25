import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { run } from "./proc.ts";
import { removeStrayWorktrees, strayWorktrees } from "./test-worktrees.ts";

const ROOT = resolve(import.meta.dir, "../..");

// A parallel worker marks its environment; a test run started from inside one must not inherit it.
const CLEAN_ENV = { BUN_TEST_WORKER_ID: undefined };

const entry = (path: string, ...notes: string[]): string =>
  [`worktree ${path}`, "HEAD 0000000000000000000000000000000000000000", "detached", ...notes].join(
    "\n",
  );
const listing = (...entries: string[]): string => `${entries.join("\n\n")}\n`;

const TEMP = "/scratch/tmp";
const MAIN = entry("/work/tool");
const nothingExists = (): boolean => false;
const everythingExists = (): boolean => true;

describe("which registered checkouts are strays", () => {
  test("a checkout under the temporary folder whose folder is gone is one", () => {
    const gone = `${TEMP}/postmaster-aB3dEf/pins/0123abc`;
    expect(strayWorktrees(listing(MAIN, entry(gone)), TEMP, nothingExists)).toEqual([gone]);
  });

  test("control: the same checkout with its folder still there is not", () => {
    const live = `${TEMP}/postmaster-aB3dEf/pins/0123abc`;
    expect(strayWorktrees(listing(MAIN, entry(live)), TEMP, everythingExists)).toEqual([]);
  });

  test("a vanished checkout outside the temporary folder is left to its owner", () => {
    const elsewhere = "/work/tool/.worktrees/old-branch";
    expect(strayWorktrees(listing(MAIN, entry(elsewhere)), TEMP, nothingExists)).toEqual([]);
  });

  test("a folder that only starts with the temporary folder's name is outside it", () => {
    const sibling = `${TEMP}-other/postmaster-aB3dEf/pins/0123abc`;
    expect(strayWorktrees(listing(MAIN, entry(sibling)), TEMP, nothingExists)).toEqual([]);
  });

  test("a locked checkout is left alone", () => {
    const locked = `${TEMP}/postmaster-aB3dEf/pins/0123abc`;
    expect(
      strayWorktrees(listing(MAIN, entry(locked, "locked kept for a drive")), TEMP, nothingExists),
    ).toEqual([]);
  });

  test("the repository's own checkout is never one, whatever its folder", () => {
    const own = entry(`${TEMP}/the-repository`);
    expect(strayWorktrees(listing(own), TEMP, nothingExists)).toEqual([]);
  });

  test("a listing with nothing in it has no strays", () => {
    expect(strayWorktrees("", TEMP, nothingExists)).toEqual([]);
  });
});

const git = (repo: string, ...args: string[]) => run("git", ["-C", repo, ...args]);
const registered = (repo: string): string => git(repo, "worktree", "list", "--porcelain").out;

/** A repository of its own in a temporary folder, so nothing else's cleanup can touch it. */
function throwawayRepo(): string {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "test-worktrees-")));
  const repo = join(base, "repo");
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  git(
    repo,
    "-c",
    "user.name=test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "first",
  );
  return repo;
}

describe("removing the strays of a repository", () => {
  test("a deleted checkout loses its registration and a live one keeps its own", () => {
    const repo = throwawayRepo();
    const base = dirname(repo);
    try {
      const live = join(base, "pins", "live");
      const dead = join(base, "pins", "dead");
      expect(git(repo, "worktree", "add", "-q", "--detach", live, "HEAD").code).toBe(0);
      expect(git(repo, "worktree", "add", "-q", "--detach", dead, "HEAD").code).toBe(0);
      rmSync(dead, { recursive: true, force: true });
      // Positive control: the stray is listed before the removal, through the same command.
      expect(registered(repo)).toContain(`worktree ${dead}`);
      expect(removeStrayWorktrees(repo)).toEqual([dead]);
      expect(registered(repo)).not.toContain(`worktree ${dead}`);
      // Negative control: the live checkout is still registered, and its folder is still there.
      expect(registered(repo)).toContain(`worktree ${live}`);
      expect(git(live, "rev-parse", "--verify", "HEAD").code).toBe(0);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  test("a second removal finds nothing", () => {
    const repo = throwawayRepo();
    const base = dirname(repo);
    try {
      const dead = join(base, "pins", "dead");
      expect(git(repo, "worktree", "add", "-q", "--detach", dead, "HEAD").code).toBe(0);
      rmSync(dead, { recursive: true, force: true });
      expect(removeStrayWorktrees(repo)).toEqual([dead]);
      expect(removeStrayWorktrees(repo)).toEqual([]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  test("a folder that is not a repository has nothing to remove and does not fail", () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), "test-worktrees-")));
    try {
      expect(removeStrayWorktrees(base)).toEqual([]);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

// A test file that pins the tool in a temporary folder and deletes the folder, as the suite's own
// tests do. The probe checks that the checkout was registered while its folder was there, so a
// probe that never made one cannot pass for a run that left none behind.
const LEAVING = (mark: string, ending: string): string => `import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("makes a checkout of the tool in a temporary folder and deletes the folder", () => {
  const dir = mkdtempSync(join(tmpdir(), ${JSON.stringify(`test-worktrees-${mark}-`)}));
  const pin = join(dir, "pin");
  const git = (...args: string[]) =>
    spawnSync("git", ["-C", ${JSON.stringify(ROOT)}, ...args], { encoding: "utf8" });
  expect(git("worktree", "add", "-q", "--detach", pin, "HEAD").status).toBe(0);
  expect(git("worktree", "list", "--porcelain").stdout.includes(${JSON.stringify(`test-worktrees-${mark}-`)})).toBe(true);
  rmSync(dir, { recursive: true, force: true });
  ${ending}
});
`;

const mark = (): string => crypto.randomUUID().slice(0, 8);

function probeFile(source: string): { dir: string; file: string } {
  const dir = mkdtempSync(join(tmpdir(), "test-worktrees-probe-"));
  const file = join(dir, "probe.test.ts");
  writeFileSync(file, source);
  return { dir, file };
}

const toolEntries = (m: string): string[] =>
  registered(ROOT)
    .split("\n")
    .filter((line) => line.startsWith("worktree ") && line.includes(`test-worktrees-${m}-`))
    .map((line) => line.slice("worktree ".length));

/** The probe's own registrations, removed by hand so a failing run leaves the tool's list as it was. */
const removeEntries = (m: string): void => {
  for (const path of toolEntries(m)) git(ROOT, "worktree", "remove", path);
};

describe("the test preload removes what a test run leaves in the tool's git folder", () => {
  // These start a nested test run, so they state a limit: a serial run keeps Bun's 5 s default for every file after the first.
  test("a test file that deletes a checkout of the tool without removing it leaves nothing when it ends", () => {
    const m = mark();
    const probe = probeFile(LEAVING(m, ""));
    try {
      const result = run("bun", ["test", probe.file], { cwd: ROOT, env: CLEAN_ENV });
      expect(result.err + result.out).toContain("1 pass");
      expect(result.code).toBe(0);
      expect(toolEntries(m)).toEqual([]);
    } finally {
      rmSync(probe.dir, { recursive: true, force: true });
      removeEntries(m);
    }
  }, 30_000);

  test("also when the test fails", () => {
    const m = mark();
    const probe = probeFile(LEAVING(m, 'throw new Error("a failing test");'));
    try {
      const result = run("bun", ["test", probe.file], { cwd: ROOT, env: CLEAN_ENV });
      expect(result.err + result.out).toContain("1 fail");
      expect(result.code).not.toBe(0);
      expect(toolEntries(m)).toEqual([]);
    } finally {
      rmSync(probe.dir, { recursive: true, force: true });
      removeEntries(m);
    }
  }, 30_000);

  test("a registration an earlier run left is gone when the next run starts", () => {
    const m = mark();
    const dir = mkdtempSync(join(tmpdir(), `test-worktrees-${m}-`));
    let probe: { dir: string; file: string } | undefined;
    try {
      expect(git(ROOT, "worktree", "add", "-q", "--detach", join(dir, "pin"), "HEAD").code).toBe(0);
      rmSync(dir, { recursive: true, force: true });
      // The probe looks at the tool's list in its own test, after the run has started and before
      // any file has ended, so only the start of the run can have removed the entry.
      const source = `import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
test("the earlier run's registration is not listed", () => {
  const listed = spawnSync("git", ["-C", ${JSON.stringify(ROOT)}, "worktree", "list", "--porcelain"], {
    encoding: "utf8",
  }).stdout;
  expect(listed.includes(${JSON.stringify(`test-worktrees-${m}-`)})).toBe(false);
});
`;
      probe = probeFile(source);
      const result = run("bun", ["test", probe.file], { cwd: ROOT, env: CLEAN_ENV });
      expect(result.err + result.out).toContain("1 pass");
      expect(result.code).toBe(0);
      expect(toolEntries(m)).toEqual([]);
    } finally {
      if (probe !== undefined) rmSync(probe.dir, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
      removeEntries(m);
    }
  }, 30_000);
});
