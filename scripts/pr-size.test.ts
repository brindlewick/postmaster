// Tests beside scripts/pr-size.ts. The project is invented: a shop with a web app and a core
// package. Every count has a positive control, a change that reads non-zero, and a negative one,
// the same command on a change that reads zero or on a project with no budget.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const SELF = join(import.meta.dir, "run");
const DRAFTS = '[ship]\ndraft_pull_requests = "on"\n';
// Distinct text per file, so git never reads one file as the rename of another.
const lines = (n: number, tag = "line"): string =>
  Array.from({ length: n }, (_, i) => `${tag} ${i}\n`).join("");

let tmp = "";
let seq = 0;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "pr-size-"));
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function git(repo: string, ...args: string[]): string {
  const id = ["-c", "user.name=t", "-c", "user.email=t@t"];
  const r = spawnSync("git", ["-C", repo, ...id, ...args], { encoding: "utf8" });
  return String(r.stdout ?? "").trim();
}

function put(repo: string, rel: string, text: string): void {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), text);
}

/** A repository whose base commit holds `before` and whose head commit adds `after` and removes
 * `removed`. The settings file stays uncommitted, as the person's file is. */
function made(opts: {
  settings?: string;
  before?: Record<string, string>;
  after?: Record<string, string>;
  removed?: string[];
}): string[] {
  const repo = join(tmp, `shop${seq++}`);
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  for (const [rel, text] of Object.entries({ "README.md": "shop\n", ...opts.before })) {
    put(repo, rel, text);
  }
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "base");
  const base = git(repo, "rev-parse", "HEAD");
  for (const [rel, text] of Object.entries(opts.after ?? {})) put(repo, rel, text);
  for (const rel of opts.removed ?? []) git(repo, "rm", "-q", rel);
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", "head", "--allow-empty");
  if (opts.settings !== undefined) put(repo, ".postmaster/settings.toml", opts.settings);
  return [base, git(repo, "rev-parse", "HEAD"), "--repo", repo];
}

type Got = { code: number; out: string[]; err: string };

/** The command exits 1 and says why. */
function refuses(got: Got, text: string): void {
  expect(got.code).toBe(1);
  expect(got.err).toContain(text);
}

function cli(...args: string[]): Got {
  const r = spawnSync(SELF, ["pr-size", ...args], {
    encoding: "utf8",
    timeout: 60000,
    env: { ...process.env, POSTMASTER_CONFIG: join(tmp, "no-config.toml") },
  });
  const out = String(r.stdout ?? "").split("\n");
  return { code: r.status ?? 1, out: out.filter((l) => l !== ""), err: String(r.stderr ?? "") };
}

describe("a project whose runs open draft pull requests", () => {
  test("prints the count, the files and where the change stands, and exits 2 only over the cap", () => {
    const cases: Array<[number, string, number]> = [
      [150, "within the aim", 0],
      [250, "over the aim, within the cap", 0],
      [450, "over the cap by 50", 2],
    ];
    for (const [n, standing, code] of cases) {
      const got = cli(...made({ settings: DRAFTS, after: { "apps/web/src/cart.ts": lines(n) } }));
      expect(got.out).toEqual([
        `Size: ${n} changed lines (aim 200, cap 400)`,
        "files: 1",
        standing,
      ]);
      expect(got.code).toBe(code);
    }
  });

  test("the project's own aim and cap are the budget", () => {
    const settings = `${DRAFTS}[project]\npr_size_aim = 10\npr_size_cap = 20\n`;
    const got = cli(...made({ settings, after: { "apps/web/src/cart.ts": lines(25) } }));
    expect(got.out[0]).toBe("Size: 25 changed lines (aim 10, cap 20)");
    expect(got.code).toBe(2);
  });

  test("counts tests and a deleted file as one line; leaves out generated files, lock files, catalogs and binaries", () => {
    const args = made({
      settings: `${DRAFTS}[project]\ngenerated_files = ["docs/api/**"]\n`,
      before: {
        "packages/core/src/legacy.ts": lines(300, "legacy"),
        "apps/web/src/old.ts": lines(40, "moved"),
      },
      after: {
        "apps/web/src/cart.ts": lines(30, "cart"),
        "apps/web/src/cart.test.ts": lines(20, "test"),
        "apps/web/src/new.ts": `${lines(40, "moved")}one more\n`,
        "pnpm-lock.yaml": lines(900, "lock"),
        "locales/fr.po": lines(300, "catalog"),
        "docs/api/index.html": lines(500, "api"),
        "logo.png": "\0png",
      },
      removed: ["packages/core/src/legacy.ts", "apps/web/src/old.ts"],
    });
    // 30 + 20 for the code and its test, 1 for the deleted file, 1 for the renamed file's new line
    expect(cli(...args).out.slice(0, 2)).toEqual([
      "Size: 52 changed lines (aim 200, cap 400)",
      "files: 4",
    ]);
  });

  test("a change with nothing in it reads zero", () => {
    const [base, , ...repo] = made({ settings: DRAFTS });
    expect(cli(base, base, ...repo).out.slice(0, 2)).toEqual([
      "Size: 0 changed lines (aim 200, cap 400)",
      "files: 0",
    ]);
  });

  test("a revision git cannot read, and an aim above the cap, exit 1", () => {
    const [, head, ...repo] = made({ settings: DRAFTS });
    refuses(cli("nope", head, ...repo), "git cannot read nope...");
    const bad = made({ settings: `${DRAFTS}[project]\npr_size_aim = 500\n` });
    refuses(cli(...bad), "pr_size_aim (500) is above pr_size_cap (400)");
  });
});

describe("a project with no budget", () => {
  const big = { "apps/web/src/cart.ts": lines(5000) };

  test("prints nothing and exits 0, however large the change: no drafts and no cap, an aim alone, or the cap turned off", () => {
    const off = `${DRAFTS}[project]\npr_size_cap = "off"\n`;
    const aim = "[project]\npr_size_aim = 100\n";
    for (const settings of [undefined, aim, off]) {
      expect(cli(...made({ settings, after: big }))).toEqual({ code: 0, out: [], err: "" });
    }
  });
});

describe("a project that names a cap", () => {
  const CAP = "[project]\npr_size_cap = 300\n";
  const change = (n: number) => ({ "apps/web/src/cart.ts": lines(n) });

  test("has the budget without drafts: the count, and exit 2 only over its cap", () => {
    const over = cli(...made({ settings: CAP, after: change(450) }));
    expect(over.out).toEqual([
      "Size: 450 changed lines (aim 200, cap 300)",
      "files: 1",
      "over the cap by 150",
    ]);
    expect(over.code).toBe(2);
    const within = cli(...made({ settings: CAP, after: change(250) }));
    expect(within.out[0]).toBe("Size: 250 changed lines (aim 200, cap 300)");
    expect(within.code).toBe(0);
  });

  test("outranks draft_pull_requests = off, and --limits states the cap", () => {
    const args = made({
      settings: `[ship]\ndraft_pull_requests = "off"\n${CAP}`,
      after: change(450),
    });
    expect(cli(...args).code).toBe(2);
    expect(cli("--limits", "--repo", args[3] as string).out).toEqual([
      "size: aim 200, cap 300 changed lines per pull request; the cap is a hard limit",
    ]);
  });
});

describe("a draft_pull_requests value that is neither on nor off", () => {
  const big = { "apps/web/src/cart.ts": lines(450) };

  test("exits 1 and names the setting, for the count and for --limits, with no count printed", () => {
    const message = 'pr-size: ship.draft_pull_requests must be "on" or "off", not true';
    const count = made({ settings: "[ship]\ndraft_pull_requests = true\n", after: big });
    const limits = ["--limits", "--repo", count[3] as string];
    for (const args of [count, limits]) {
      const got = cli(...args);
      refuses(got, message);
      expect(got.err).toBe(`${message}\n`);
      expect(got.out).toEqual([]);
    }
  });

  test("reads off as before: no budget, no output, exit 0", () => {
    const settings = '[ship]\ndraft_pull_requests = "off"\n';
    expect(cli(...made({ settings, after: big }))).toEqual({ code: 0, out: [], err: "" });
  });
});

describe("the waybill's line", () => {
  test("states the aim and the hard cap, and is empty where the project has no budget", () => {
    const [, , , on] = made({ settings: DRAFTS });
    expect(cli("--limits", "--repo", on as string).out).toEqual([
      "size: aim 200, cap 400 changed lines per pull request; the cap is a hard limit",
    ]);
    const [, , , off] = made({});
    expect(cli("--limits", "--repo", off as string)).toEqual({ code: 0, out: [], err: "" });
  });
});

describe("the arguments", () => {
  test("two revisions are needed, or --limits alone; any other flag is refused", () => {
    const wrong = [
      [],
      ["main"],
      ["a", "b", "c"],
      ["--limits", "a"],
      ["--nope"],
      ["a", "b", "--repo"],
    ];
    for (const args of wrong) refuses(cli(...args), "usage: run pr-size");
  });
});

describe("the size rule in the runbooks", () => {
  const RUNBOOKS = join(import.meta.dir, "..", "skills", "postmaster");
  const coachman = readFileSync(join(RUNBOOKS, "coachman.md"), "utf8");
  const postmaster = readFileSync(join(RUNBOOKS, "postmaster.md"), "utf8");
  // ASCII: the runbooks are ASCII text, so \s matches the whitespace they hold.
  const flat = (text: string): string => text.replace(/\s+/gu, " ");
  /** The text from one opening to the next, or nothing where either is missing. */
  const between = (text: string, from: string, to: string): string => {
    const start = text.indexOf(from);
    const end = text.indexOf(to, start + from.length);
    return start === -1 || end === -1 ? "" : text.slice(start, end);
  };
  /** The helper briefs of a runbook by name, each with its whole fenced block. */
  const briefs = (text: string): Map<string, string> =>
    new Map(
      // ASCII: the runbook is ASCII text, so \s matches the whitespace it holds.
      [...text.matchAll(/```helper\nHelper brief `([^`]+)`[\s\S]*?\n```/gu)].map(
        (brief) => [brief[1] ?? "", brief[0]] as const,
      ),
    );
  const splitRequest = flat(
    between(
      coachman,
      "- **Count the synthesis's size before the checkpoint 1 card",
      "- **Checkpoint 1 card, then the hand-off**",
    ),
  );
  const stepEight = flat(
    between(postmaster, "8. **A split request goes to the user", "## Stage F"),
  );

  test("the coachman's split request and Stage E step 8 name the same next step: the clerk plans the pieces", () => {
    expect(splitRequest).not.toBe("");
    expect(stepEight).not.toBe("");
    for (const text of [splitRequest, stepEight]) {
      expect(text).toContain("the clerk plans the pieces");
    }
    // Negative control: the closing line before this change sent the thread on once a piece fit.
    expect(splitRequest).not.toContain("resumes this thread only when its own count is within");
  });

  test("Stage F names one helper that counts at landing, f-size, and f-verify leaves the size to it", () => {
    const named = briefs(postmaster);
    // A count is a pr-size call on two refs; the waybill's own `--limits` line counts nothing.
    const counters = [...named]
      .filter(([, text]) => /scripts\/run pr-size(?! --limits)/u.test(text))
      .map(([name]) => name);
    expect(counters).toEqual(["f-size"]);
    expect(named.get("f-verify")).toContain("Leave the size to the `f-size` brief");
    // The fresh count at a split request asks the same brief.
    expect(stepEight).toContain("Brief `f-size`");
  });

  test("under a split each piece carries its own tests and the full acceptance set lands with the last piece", () => {
    expect(splitRequest).toContain(
      "Under a split each piece carries its own tests, and the full acceptance set lands with the last piece.",
    );
    const rule = flat(
      between(coachman, "## Acceptance tests, in every run", "## The run's verifier copy"),
    );
    expect(rule).toContain("each piece carries its own tests");
  });
});
