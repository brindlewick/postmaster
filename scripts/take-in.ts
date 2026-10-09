// Take in the workhorses' work: admit each lane's branch at the commit its
// checks ran on, once no workhorse is running or waiting. The coachman runs
// this after the walls pause and before stage synthesis, and gives
// synthesis-shares the commits it took.
//
//   run take-in <dispatch> [--skip <lane> ...]
//
// A lane is still running while a launch is registered for its worktree or
// its done marker is missing, and still waiting while one of its walls has
// no ruling or its manifest outcome is blocked. A skipped lane skips the
// commit check and the admission, never quiescence: a lane still working is
// stopped first, then skipped. A branch at any commit other than the one its
// checks recorded stops the run; a branch still at BASE is taken as
// contributing nothing. Checks the coachman ran on a scratch read
// on=detached and match by commit. Only identity is checked here, never a
// check's verdict, which stays on the checkpoint card.
//
//   exit 0  every taken lane admitted; stdout one <lane>=<commit> per lane,
//           and one take-in line per lane in the run's action log
//   exit 1  usage, or input that is not what it says
//   exit 2  a workhorse is still running or waiting; each is named with its
//           reason, and nothing is taken in
//   exit 3  a taken branch is off its checked commit; the lane is named with
//           both commits, and nothing is taken in
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { liveLaunchNames } from "./host.ts";
import { tryJsonFile } from "./lib/data.ts";
import { scriptsDir } from "./lib/paths.ts";
import { die, run } from "./lib/proc.ts";
import { DETAIL_RE } from "./verify.ts";
import { lostWalls, readWalls } from "./walls.ts";

const HERE = scriptsDir(import.meta);
const USAGE = "usage: run take-in <dispatch> [--skip <lane> ...]";

interface Workhorse {
  name: string;
  branch: string;
  worktree: string;
  outcome: string;
  skipped: boolean;
}

/** A verify line's claim: the branch and id the checks ran on, in log order. */
interface CheckClaim {
  branch: string;
  sha: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function usage(): never {
  die(`take-in: ${USAGE}`, 1);
}

/** Two commit ids name the same commit when one extends the other. */
function sameCommit(a: string, b: string): boolean {
  if (a === b) return true;
  const long = a.length >= b.length ? a : b;
  const short = a.length >= b.length ? b : a;
  return short.length >= 7 && long.startsWith(short);
}

/** Resolve a revision to its commit, or null when git knows no such commit. */
function gitCommit(repo: string, rev: string): string | null {
  const r = run("git", ["-C", repo, "rev-parse", "--verify", "--quiet", `${rev}^{commit}`]);
  return r.code === 0 ? r.out.trim() : null;
}

function readManifest(dispatch: string): {
  base: string;
  lanes: Array<{ name: string; outcome: string }>;
} {
  const p = join(dispatch, "manifest.json");
  if (!existsSync(p)) die(`take-in: no manifest at ${p}`, 1);
  const m = tryJsonFile<unknown>(p);
  if (!isRecord(m)) die(`take-in: ${p} does not parse`, 1);
  if (typeof m["base"] !== "string" || m["base"] === "") {
    die(`take-in: ${p} names no base commit`, 1);
  }
  if (!isRecord(m["lanes"])) die(`take-in: ${p} names no workhorse lanes`, 1);
  const lanes = Object.entries(m["lanes"]).map(([name, e]) => ({
    name,
    outcome: isRecord(e) && typeof e["outcome"] === "string" ? e["outcome"] : "",
  }));
  if (lanes.length === 0) die(`take-in: ${p} names no workhorse lanes`, 1);
  return { base: m["base"] as string, lanes };
}

function readRepo(dispatch: string): string {
  const p = join(dispatch, "checks.json");
  const c = tryJsonFile<unknown>(p);
  if (!isRecord(c) || typeof c["repo"] !== "string" || c["repo"] === "") {
    die(`take-in: no repo recorded at ${p}`, 1);
  }
  const repo = c["repo"] as string;
  if (!existsSync(repo)) die(`take-in: the recorded repo is not a directory: ${repo}`, 1);
  return repo;
}

/** Every verify line's claim, oldest first; a broken line stops the read. */
function checkClaims(dispatch: string): CheckClaim[] {
  const p = join(dispatch, "actions.jsonl");
  let text: string;
  try {
    text = readFileSync(p, "utf8");
  } catch {
    return [];
  }
  const out: CheckClaim[] = [];
  const lines = text.split("\n");
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n]!;
    if (line.trim() === "") continue;
    let e: unknown;
    try {
      e = JSON.parse(line);
    } catch {
      die(`take-in: line ${n + 1} of ${p} does not parse`, 1);
    }
    if (isRecord(e) && e["action"] === "verify") {
      const m = DETAIL_RE.exec(String(e["detail"] ?? ""));
      if (m) out.push({ branch: m[1]!, sha: m[2]! });
    }
  }
  return out;
}

/** Why a lane is still running or waiting, one entry per reason. */
function restless(
  dispatch: string,
  lane: Workhorse,
  walls: ReturnType<typeof readWalls>,
  lost: ReturnType<typeof lostWalls>,
): string[] {
  const out: string[] = [];
  const live = liveLaunchNames(lane.worktree);
  if (live.length > 0) {
    out.push(
      `${lane.name}: still running: launch ${live.map((n) => `"${n}"`).join(", ")} registered`,
    );
  }
  if (!existsSync(join(dispatch, "logs", `${lane.name}.done`))) {
    out.push(`${lane.name}: still running: logs/${lane.name}.done is missing`);
  }
  for (const w of walls) {
    if (w.lane === lane.name && !w.ruled) {
      out.push(`${lane.name}: waiting on a ruling: "${w.message}"`);
    }
  }
  for (const l of lost) {
    if (l.lane === lane.name) {
      out.push(`${lane.name}: waiting on a ruling: wall detected but not recorded`);
    }
  }
  if (lane.outcome === "blocked") {
    out.push(`${lane.name}: waiting on an answer: outcome blocked`);
  }
  return out;
}

function main(argv: string[]): number {
  const skips: string[] = [];
  const pos: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--skip") {
      const lane = argv[i + 1];
      if (lane === undefined || lane === "") usage();
      skips.push(lane);
      i++;
    } else if (argv[i]!.startsWith("-")) {
      usage();
    } else {
      pos.push(argv[i]!);
    }
  }
  if (pos.length !== 1) usage();
  const dispatch = pos[0]!;
  const runName = basename(dispatch);
  const { base, lanes } = readManifest(dispatch);
  const repo = readRepo(dispatch);
  const skipSet = new Set(skips);
  for (const s of skipSet) {
    if (!lanes.some((l) => l.name === s)) {
      die(`take-in: --skip ${s}: not a workhorse lane of ${runName}`, 1);
    }
  }
  const horses: Workhorse[] = lanes.map((l) => ({
    name: l.name,
    branch: `wb/${runName}-${l.name}`,
    worktree: join(repo, ".worktrees", `${runName}-${l.name}`),
    outcome: l.outcome,
    skipped: skipSet.has(l.name),
  }));
  if (horses.every((h) => h.skipped)) {
    die("take-in: --skip leaves no workhorse to take in", 1);
  }

  const walls = readWalls(dispatch);
  const lost = lostWalls(dispatch);
  const known = new Set(horses.map((h) => h.name));
  const waiting: string[] = [];
  for (const h of horses) {
    waiting.push(...restless(dispatch, h, walls, lost));
  }
  // A wall outside the workhorses still waits on its ruling; the pause that
  // should have held it was skipped, so this step holds instead.
  for (const w of walls) {
    if (!known.has(w.lane) && !w.ruled) {
      waiting.push(`${w.lane}: waiting on a ruling: "${w.message}"`);
    }
  }
  for (const l of lost) {
    if (!known.has(l.lane)) {
      waiting.push(`${l.lane}: waiting on a ruling: wall detected but not recorded`);
    }
  }
  if (waiting.length > 0) {
    die(waiting.map((w) => `take-in: ${w}`).join("\n"), 2);
  }

  const claims = checkClaims(dispatch);
  const taken: Array<{ lane: string; branch: string; head: string; nothing: boolean }> = [];
  const moved: string[] = [];
  for (const h of horses) {
    if (h.skipped) continue;
    const head = gitCommit(repo, h.branch);
    if (head === null) die(`take-in: ${h.name}: no branch ${h.branch} in ${repo}`, 1);
    if (sameCommit(head, base)) {
      taken.push({ lane: h.name, branch: h.branch, head, nothing: true });
      continue;
    }
    const own = claims.filter((c) => c.branch === h.branch);
    const match = [...own, ...claims.filter((c) => c.branch === "detached")].some(
      (c) =>
        (c.sha.length >= 7 && head.startsWith(c.sha)) ||
        sameCommit(gitCommit(repo, c.sha) ?? "", head),
    );
    if (match) {
      taken.push({ lane: h.name, branch: h.branch, head, nothing: false });
    } else if (own.length > 0) {
      const last = own[own.length - 1]!.sha;
      const checked = gitCommit(repo, last) ?? `${last} (unknown to git)`;
      moved.push(
        `take-in: ${h.name}: branch ${h.branch} is at ${head} but its checks ran on ${checked}`,
      );
    } else {
      moved.push(
        `take-in: ${h.name}: branch ${h.branch} at ${head} has commits but no verify line`,
      );
    }
  }
  if (moved.length > 0) {
    die(moved.join("\n"), 3);
  }

  for (const t of taken) {
    const detail = `on=${t.branch}@${t.head}${t.nothing ? " contributing=nothing" : ""}`;
    const r = run(join(HERE, "run"), [
      "log-action",
      dispatch,
      "coachman",
      "take-in",
      t.lane,
      detail,
    ]);
    if (r.code !== 0) {
      die(`take-in: could not log the take-in of ${t.lane}: ${(r.err || r.out).trim()}`, 1);
    }
  }
  console.log(taken.map((t) => `${t.lane}=${t.head}`).join("\n"));
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
