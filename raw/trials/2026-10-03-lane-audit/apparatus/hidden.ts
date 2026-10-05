// Score each fixture lane's branch on the fixture ticket's hidden tests, beside the merged
// result (see ../method.md). The earlier audit could not: its fixture runs' lane branches were
// never scored. A fixture run's lane branches are kept as `wb/<ticket>-<lane>`, and `main` is the
// merged result.
//
//   bun hidden.ts --tool <repo> --fixtures <dir> --out <file> [--only <n,n,...>]
//   bun hidden.ts --tool <repo> --controls
//
// The hidden suite is the repository's own, run as `scripts/fixture.ts` runs it: `bun test` in the
// ticket's `hidden/` folder with FIXTURE_APP naming the tree to test. Nothing in a fixture
// repository or a run's record is written: a branch is exported with `git archive` into a
// scratch folder that is removed afterwards.
//
// `--controls` runs the identical command on two trees whose answer is known: the fixture app
// with the ticket's reference patch applied must pass every hidden test, and the app as it was
// before the ticket must fail.
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

export type Counts = { passed: number; failed: number };

export type LaneScore =
  | ({ kind: "counts" } & Counts)
  | { kind: "missing" }
  /** the branch points at the run's base, so it holds no work to score */
  | { kind: "at-base" }
  | { kind: "failed-to-build" };

/** The last `N pass` and `N fail` lines of a `bun test` report, as `scripts/fixture.ts` reads them. */
export function parseCounts(output: string): Counts | null {
  let passed: number | null = null;
  let failed: number | null = null;
  for (const m of output.matchAll(/^[ \t]*([0-9]+) (pass|fail)[ \t]*$/gmu)) {
    if (m[2] === "pass") passed = Number(m[1]);
    else failed = Number(m[1]);
  }
  return passed === null && failed === null ? null : { passed: passed ?? 0, failed: failed ?? 0 };
}

/** Whether a lane's score is every hidden test passing. */
export const allPass = (score: LaneScore): boolean =>
  score.kind === "counts" && score.passed > 0 && score.failed === 0;

/** `12 pass, 0 fail`, `missing`, `at base` or `failed to build`. */
export const describeScore = (score: LaneScore): string =>
  score.kind === "counts"
    ? `${score.passed} pass, ${score.failed} fail`
    : score.kind === "missing"
      ? "missing"
      : score.kind === "at-base"
        ? "at base"
        : "failed to build";

const decode = (bytes: Uint8Array | undefined): string =>
  bytes ? new TextDecoder().decode(bytes) : "";

const git = (repo: string, args: string[]): { ok: boolean; out: string } => {
  const r = Bun.spawnSync(["git", "-C", repo, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    stdin: "ignore",
  });
  return { ok: r.exitCode === 0, out: decode(r.stdout) };
};

const branchExists = (repo: string, ref: string): boolean =>
  git(repo, ["rev-parse", "--verify", "-q", `refs/heads/${ref}^{commit}`]).ok;

/** Export a branch's tree into `dest` without touching the repository. */
function exportBranch(repo: string, ref: string, dest: string): boolean {
  const archive = Bun.spawnSync(
    ["git", "-C", repo, "archive", "--format=tar", `refs/heads/${ref}`],
    {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    },
  );
  if (archive.exitCode !== 0) return false;
  const untar = Bun.spawnSync(["tar", "-x", "-C", dest], {
    stdin: archive.stdout,
    stdout: "pipe",
    stderr: "pipe",
  });
  return untar.exitCode === 0;
}

/** Run the ticket's hidden suite against `app`. */
export function runHidden(tool: string, ticket: string, app: string): LaneScore {
  const hiddenDir = join(tool, "fixtures", "tickets", ticket, "hidden");
  const r = Bun.spawnSync(
    [
      "bun",
      "--no-env-file",
      `--config=${join(tool, "bunfig.toml")}`,
      "test",
      "--timeout",
      "120000",
      "./",
    ],
    {
      cwd: hiddenDir,
      env: { ...(process.env as Record<string, string>), FIXTURE_APP: app },
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    },
  );
  const counts = parseCounts(`${decode(r.stdout)}\n${decode(r.stderr)}`);
  return counts ? { kind: "counts", ...counts } : { kind: "failed-to-build" };
}

/**
 * A branch's score: exported to a scratch folder, tested, and removed. A branch that points at
 * `base` holds no work, and is not scored: the base itself fails the suite.
 */
export function scoreBranch(
  tool: string,
  repo: string,
  ref: string,
  ticket: string,
  scratch: string,
  base: string | null = null,
): LaneScore {
  if (!branchExists(repo, ref)) return { kind: "missing" };
  if (base !== null) {
    const tip = git(repo, ["rev-parse", `refs/heads/${ref}^{commit}`]);
    const root = git(repo, ["rev-parse", `${base}^{commit}`]);
    if (tip.ok && root.ok && tip.out.trim() === root.out.trim()) return { kind: "at-base" };
  }
  const dest = mkdtempSync(join(scratch, "tree-"));
  try {
    if (!exportBranch(repo, ref, dest)) return { kind: "failed-to-build" };
    return runHidden(tool, ticket, dest);
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
}

export type Controls = { reference: LaneScore; base: LaneScore };

/**
 * The same hidden suite on two trees whose answer is known: the fixture app with the ticket's
 * reference patch applied, which must pass, and the app before the ticket, which must fail.
 */
export function runControls(tool: string, ticket: string, scratch: string): Controls {
  const app = join(tool, "fixtures", "app");
  const patch = join(tool, "fixtures", "tickets", ticket, "reference.patch");
  const base = mkdtempSync(join(scratch, "base-"));
  const reference = mkdtempSync(join(scratch, "reference-"));
  try {
    cpSync(app, base, { recursive: true });
    cpSync(app, reference, { recursive: true });
    const applied = Bun.spawnSync(["git", "apply", patch], {
      cwd: reference,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });
    if (applied.exitCode !== 0) {
      throw new Error(`the reference patch did not apply: ${decode(applied.stderr)}`);
    }
    return {
      reference: runHidden(tool, ticket, reference),
      base: runHidden(tool, ticket, base),
    };
  } finally {
    rmSync(base, { recursive: true, force: true });
    rmSync(reference, { recursive: true, force: true });
  }
}

export type FixtureScore = {
  run: string;
  lanes: Record<string, LaneScore>;
  merged: LaneScore;
};

/** One fixture run's lanes and merged result, each scored against the run's base. */
export function scoreFixture(
  tool: string,
  repo: string,
  run: string,
  lanes: string[],
  ticket: string,
  scratch: string,
  base: string | null,
): FixtureScore {
  const scored: Record<string, LaneScore> = {};
  for (const lane of lanes) {
    scored[lane] = scoreBranch(tool, repo, `wb/1-${lane}`, ticket, scratch, base);
  }
  return { run, lanes: scored, merged: scoreBranch(tool, repo, "main", ticket, scratch, base) };
}

const arg = (args: string[], name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

/** The lanes a fixture run named in its manifest, in name order, and the commit it was cut at. */
export function readManifest(manifestText: string): { lanes: string[]; base: string | null } {
  try {
    const m = JSON.parse(manifestText) as { lanes?: Record<string, unknown>; base?: unknown };
    return {
      lanes: m.lanes && typeof m.lanes === "object" ? Object.keys(m.lanes).sort() : [],
      base: typeof m.base === "string" ? m.base : null,
    };
  } catch {
    return { lanes: [], base: null };
  }
}

const main = (args: string[]): void => {
  const tool = resolve(arg(args, "--tool") ?? resolve(dirname(import.meta.path), "../../../.."));
  const scratch = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "lane-audit-hidden-"));
  try {
    if (args.includes("--controls")) {
      const c = runControls(tool, "remove", scratch);
      console.log(
        JSON.stringify({ reference: describeScore(c.reference), base: describeScore(c.base) }),
      );
      process.exitCode = allPass(c.reference) && !allPass(c.base) ? 0 : 2;
      return;
    }
    const fixtures = arg(args, "--fixtures");
    const out = arg(args, "--out");
    if (!fixtures || !out)
      throw new Error("usage: hidden.ts --tool <repo> --fixtures <dir> --out <file>");
    const only = new Set((arg(args, "--only") ?? "").split(",").filter(Boolean));
    const results: FixtureScore[] = [];
    for (const name of readdirSync(fixtures).sort()) {
      const m = /^todo-fixture-([0-9]+)$/u.exec(name);
      if (!m || (only.size > 0 && !only.has(m[1] as string))) continue;
      const repo = join(fixtures, name);
      const manifest = join(repo, ".postmaster", "runs", "1", "manifest.json");
      if (!existsSync(manifest)) continue;
      const { lanes, base } = readManifest(readFileSync(manifest, "utf8"));
      results.push(scoreFixture(tool, repo, `fixture-${m[1]}`, lanes, "remove", scratch, base));
      console.error(`scored fixture-${m[1]}`);
    }
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, `${JSON.stringify(results, null, 2)}\n`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};

if (import.meta.main) main(process.argv.slice(2));
