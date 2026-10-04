// Builder for the blind acceptance tests in fixture-time-oracle.test.ts: six
// synthetic dispatches sharing one repo, each action log rewritten to an
// engineered timeline, each lane marker given an engineered mtime. Interface
// only: the tree under test is reached through the wrapper CLI, git and the
// filesystem, never through an import, so no refactoring can break the tests.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const ROOT = dirname(import.meta.dir);
const WRAP = join(ROOT, "scripts", "run");
const FIXAPP = join(ROOT, "fixtures", "app");
const TICKETS = join(ROOT, "fixtures", "tickets");

function runTool(args: string[]): { code: number; stdout: string; stderr: string } {
  const r = spawnSync(WRAP, args, { encoding: "utf8" });
  return { code: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function git(repo: string, args: string[]): { code: number; out: string } {
  const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function need(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`oracle setup: ${msg}`);
}

// Whole seconds; the log carries no millis, as the real logger writes none.
const T0 = Date.UTC(2026, 0, 5, 10, 0, 0);
const iso = (ms: number): string => new Date(ms).toISOString().replace(/\.\d+Z$/u, "Z");

const LANE_DUR: Record<string, number> = { one: 672, two: 216 };

interface RoundRev {
  lens: string;
  lane: string;
  dur: number;
}
const ROUNDS: RoundRev[][] = [
  [
    { lens: "bug", lane: "rslow", dur: 954 },
    { lens: "bug", lane: "rfast", dur: 156 },
    { lens: "style", lane: "rmid", dur: 600 },
  ],
  [
    { lens: "bug", lane: "rslow2", dur: 700 },
    { lens: "security", lane: "rfast2", dur: 90 },
  ],
];
const ROUND_BASE = [10, 1000];

export interface Design {
  legs: 1 | 2;
  order: string[];
  spans: number[];
  leg1After: number;
  leg2After: number;
  efforts: "match" | "break";
  card: boolean;
  stages: "walk" | "strip";
}

export const ORDER2 = [
  "dispatched",
  "bootstrapped",
  "workhorses-running",
  "synthesis",
  "checkpoint-1",
  "review",
  "shipping",
  "shipped",
];
export const ORDER1 = ORDER2.filter((s) => s !== "review");

export const DESIGNS: Record<string, Design> = {
  floor: {
    legs: 2,
    order: ORDER2,
    spans: [120, 180, 744, 300, 200, 2257, 200, 400],
    leg1After: 50,
    leg2After: 80,
    efforts: "match",
    card: true,
    stages: "walk",
  },
  short: {
    legs: 2,
    order: ORDER2,
    spans: [60, 60, 300, 120, 100, 2400, 100, 221],
    leg1After: 70,
    leg2After: 80,
    efforts: "match",
    card: true,
    stages: "walk",
  },
  longwait: {
    legs: 2,
    order: ORDER2,
    spans: [120, 180, 744, 300, 1201, 2257, 815, 400],
    leg1After: 30,
    leg2After: 30,
    efforts: "break",
    card: true,
    stages: "walk",
  },
  notiming: {
    legs: 2,
    order: ORDER2,
    spans: [120, 180, 744, 300, 200, 2257, 200, 400],
    leg1After: 50,
    leg2After: 80,
    efforts: "match",
    card: true,
    stages: "strip",
  },
  noreview: {
    legs: 1,
    order: ORDER1,
    spans: [60, 60, 300, 120, 100, 100, 221],
    leg1After: 80,
    leg2After: 0,
    efforts: "match",
    card: true,
    stages: "walk",
  },
  nocard: {
    legs: 2,
    order: ORDER2,
    spans: [120, 180, 744, 300, 200, 2257, 200, 400],
    leg1After: 50,
    leg2After: 80,
    efforts: "match",
    card: false,
    stages: "walk",
  },
};

function buildRepo(dest: string, ticket: string): string {
  const listed = spawnSync(
    "git",
    ["-C", FIXAPP, "ls-files", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  );
  need(listed.status === 0, "could not list the fixture app");
  mkdirSync(dest, { recursive: true });
  const names = (listed.stdout ?? "").split("\n").filter(Boolean);
  for (const rel of [...new Set(names)].sort()) {
    const s = join(FIXAPP, rel);
    const d = join(dest, rel);
    try {
      mkdirSync(dirname(d), { recursive: true });
      if (lstatSync(s).isSymbolicLink()) symlinkSync(readlinkSync(s), d);
      else writeFileSync(d, readFileSync(s));
    } catch {
      need(false, `could not copy the app file ${rel}`);
    }
  }
  need(git(dest, ["init", "-q", "-b", "main"]).code === 0, "could not init the repo");
  const author = git(ROOT, ["config", "user.name"]).out.trim() || "fixture";
  const email = git(ROOT, ["config", "user.email"]).out.trim() || "fixture@example.invalid";
  git(dest, ["config", "user.name", author]);
  git(dest, ["config", "user.email", email]);
  need(git(dest, ["add", "-A"]).code === 0, "could not stage the app");
  need(
    git(dest, ["-c", "commit.gpgsign=false", "commit", "-q", "-m", "Initial commit"]).code === 0,
    "could not commit the app",
  );
  const base = git(dest, ["rev-parse", "HEAD"]).out.trim();
  need(/^[0-9a-f]{40}$/u.test(base), "no base commit");
  need(git(dest, ["checkout", "-q", "-b", "7"]).code === 0, "could not cut branch 7");
  need(
    git(dest, ["apply", join(TICKETS, ticket, "reference.patch")]).code === 0,
    "the reference would not apply",
  );
  git(dest, ["add", "-A"]);
  need(
    git(dest, [
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "Implement the ticket",
    ]).code === 0,
    "could not commit the reference",
  );
  need(git(dest, ["checkout", "-q", "main"]).code === 0, "could not return to main");
  need(
    git(dest, [
      "-c",
      "commit.gpgsign=false",
      "merge",
      "-q",
      "--no-ff",
      "-m",
      "Merge branch 7",
      "7",
    ]).code === 0,
    "could not merge branch 7",
  );
  return base;
}

function walkLeg(d: string, n: number, slice: string[], sections: string[]): void {
  writeFileSync(join(d, `leg-${n}-prompt.txt`), `You are the coachman for leg ${n} of 7.\n`);
  need(
    runTool(["log-action", d, "postmaster", "dispatch", "7", `leg ${n}`]).code === 0,
    `could not log the leg ${n} dispatch`,
  );
  need(
    runTool(["log-action", d, "coachman", "handoff-accept", `leg-${n}`]).code === 0,
    `could not log the leg ${n} accept`,
  );
  for (const s of slice) {
    need(runTool(["stage", d, s]).code === 0, `could not enter stage ${s}`);
  }
  writeFileSync(
    join(d, `handoff-${n}.md`),
    sections.map((sec) => `## ${sec}\nLeg ${n}, recorded.\n\n`).join(""),
  );
  need(
    runTool(["log-action", d, "coachman", "handoff", `leg-${n}`]).code === 0,
    `could not log the leg ${n} handoff`,
  );
  writeFileSync(join(d, `.leg-${n}-done`), "");
  writeFileSync(join(d, `.leg-${n}-exited`), "");
}

function engineerTime(d: string, design: Design): void {
  const at: Record<string, number> = {};
  let cursor = T0 + 1000;
  for (let i = 0; i < design.order.length; i++) {
    at[design.order[i] ?? ""] = cursor;
    cursor += (design.spans[i] ?? 0) * 1000;
  }
  at["done"] = cursor;
  const reviewEntry = at["review"] ?? 0;
  const c1Entry = at["checkpoint-1"] ?? 0;
  const shipEntry = at["shipping"] ?? 0;
  const leg1Handoff = (design.legs === 2 ? c1Entry : shipEntry) + design.leg1After * 1000;
  const leg2Handoff = shipEntry + design.leg2After * 1000;
  const seen: Record<string, number> = {};
  const lines = readFileSync(join(d, "actions.jsonl"), "utf8").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const e = JSON.parse(line) as {
      action: string;
      actor: string;
      target: string;
      detail: string;
      ts: string;
    };
    let ts = e.ts;
    if (e.action === "premises") ts = iso(T0);
    else if (e.action === "dispatch" && e.actor === "coachman") {
      const laneAt: Record<string, number> = { one: 1, two: 2, three: 3 };
      ts = iso(T0 + (laneAt[e.target] ?? 0) * 1000);
    } else if (e.action === "dispatch" && e.actor === "postmaster") {
      ts = iso(e.detail.includes("leg 2") ? reviewEntry - 1000 : T0 + 4000);
    } else if (e.action === "handoff-accept" && e.target === "leg-1") ts = iso(T0 + 5000);
    else if (e.action === "handoff-accept" && e.target === "leg-2") ts = iso(reviewEntry);
    else if (e.action === "stage") ts = iso(at[e.target] ?? T0);
    else if (e.action === "handoff" && e.target === "leg-1") ts = iso(leg1Handoff);
    else if (e.action === "handoff" && e.target === "leg-2") ts = iso(leg2Handoff);
    else if (e.action === "review-launch") {
      const m = /^(\S+) round (\d+),/u.exec(e.detail);
      const round = Number(m?.[2] ?? 1);
      const k = seen[`r${round}`] ?? 0;
      seen[`r${round}`] = k + 1;
      ts = iso(reviewEntry + ((ROUND_BASE[round - 1] ?? 10) + 2 * k) * 1000);
    }
    e.ts = ts;
    out.push(JSON.stringify(e));
  }
  writeFileSync(join(d, "actions.jsonl"), `${out.join("\n")}\n`);
  const mark = (rel: string, mtime: number): void => {
    const p = join(d, rel);
    writeFileSync(p, "");
    const when = new Date(mtime);
    utimesSync(p, when, when);
  };
  mark("logs/one.done", T0 + 1000 + (LANE_DUR["one"] ?? 0) * 1000);
  mark("logs/two.done", T0 + 2000 + (LANE_DUR["two"] ?? 0) * 1000);
  if (design.legs === 2) {
    for (let r = 0; r < ROUNDS.length; r++) {
      const started = reviewEntry + ((ROUND_BASE[r] ?? 10) - 2) * 1000;
      writeFileSync(
        join(d, "logs", `review-r${r + 1}.json`),
        `${JSON.stringify(
          {
            limit: 7200,
            source: "review.round_timeout_seconds in run.json",
            deadline: reviewEntry / 1000 + 7200,
            started: iso(started),
            reviewers: (ROUNDS[r] ?? []).map((rev) => [rev.lens, rev.lane]),
          },
          null,
          2,
        )}\n`,
      );
      let k = 0;
      for (const rev of ROUNDS[r] ?? []) {
        const launch = reviewEntry + ((ROUND_BASE[r] ?? 10) + 2 * k) * 1000;
        mark(`logs/review-r${r + 1}-${rev.lens}-${rev.lane}.done`, launch + rev.dur * 1000);
        k++;
      }
    }
  }
}

function buildDispatch(
  repoDir: string,
  name: string,
  design: Design,
  base: string,
  ticket: string,
  sections: string[],
): string {
  const d = join(repoDir, ".postmaster", "runs", name);
  mkdirSync(join(d, "logs"), { recursive: true });
  mkdirSync(join(d, "audit"), { recursive: true });
  mkdirSync(join(d, "render"), { recursive: true });
  writeFileSync(
    join(d, "manifest.json"),
    `${JSON.stringify({ stage: "dispatched", leg: 1, base, lanes: {}, coachman: { legs: {} } })}\n`,
  );
  const text = readFileSync(join(TICKETS, ticket, "ticket.md"), "utf8");
  const body = text.split("\n").slice(1).join("\n").replace(/^\n+/u, "");
  const turnpikes = design.legs === 1 ? "turnpikes: none" : "turnpikes: style, bug, security";
  writeFileSync(
    join(d, "brief.md"),
    `# Waybill: 7\n${turnpikes}\n\n## Ticket\n\n${body}\n## Project profile\nrepo: ${repoDir}\n`,
  );
  need(runTool(["run-meta", d, repoDir]).code === 0, `could not record run.json for ${name}`);
  const config = JSON.parse(readFileSync(join(d, "run.json"), "utf8")).config as {
    lanes: Record<string, { harness: string; model: string; effort?: string }>;
    team: {
      workhorses: string[];
      coachman: { harness: string; model: string; effort?: string };
    };
  };
  const spec = (harness: string, model: string, effort?: string): string =>
    `${harness}/${model}/${effort ?? ""}`;
  const workhorses = config.team.workhorses
    .map((lane) => {
      const l = config.lanes[lane] ?? { harness: "", model: "" };
      return `${lane}=${spec(l.harness, l.model, l.effort)}`;
    })
    .join(", ");
  const coach = config.team.coachman;
  const efforts = runTool(["run-meta", "efforts", d]).stdout.trim();
  need(efforts.startsWith("efforts:"), `no efforts line for ${name}`);
  writeFileSync(
    join(d, "brief.md"),
    `${readFileSync(join(d, "brief.md"), "utf8")}\n## Team\nworkhorses: ${workhorses}\ncoachman: ${spec(coach.harness, coach.model, coach.effort)}\n${efforts}\n`,
  );
  need(
    runTool(["log-action", d, "coachman", "premises", base, `base=${base}`, "result=same"]).code ===
      0,
    `could not log premises for ${name}`,
  );
  for (const lane of config.team.workhorses) {
    need(
      runTool(["log-action", d, "coachman", "dispatch", lane, `thread-${lane}`]).code === 0,
      `could not log the ${lane} dispatch for ${name}`,
    );
  }
  const through1 = ["bootstrapped", "workhorses-running", "synthesis", "checkpoint-1"];
  if (design.legs === 1) {
    walkLeg(d, 1, [...through1, "shipping"], sections);
  } else {
    walkLeg(d, 1, through1, sections);
    walkLeg(d, 2, ["review", "shipping"], sections);
  }
  for (const s of ["shipped", "done"]) {
    need(
      runTool(["stage", d, s, "postmaster"]).code === 0,
      `could not enter stage ${s} for ${name}`,
    );
  }
  const manifest = JSON.parse(readFileSync(join(d, "manifest.json"), "utf8")) as {
    leg: number;
    coachman: { legs: Record<string, { thread_id: string }> };
  };
  manifest.leg = design.legs;
  manifest.coachman.legs = {};
  for (let n = 1; n <= design.legs; n++) {
    manifest.coachman.legs[String(n)] = { thread_id: `thread-${n}` };
  }
  writeFileSync(join(d, "manifest.json"), JSON.stringify(manifest, null, 2));
  if (design.card) {
    writeFileSync(join(d, "card.md"), "# Ship card: 7\n\nBranch 7 is merged into main.\n");
  }
  if (design.efforts === "break") {
    writeFileSync(
      join(d, "brief.md"),
      readFileSync(join(d, "brief.md"), "utf8").replace(/^efforts:.*$/mu, "efforts: one=wrong"),
    );
  }
  if (design.legs === 2) {
    for (let r = 0; r < ROUNDS.length; r++) {
      for (const rev of ROUNDS[r] ?? []) {
        const detail = `${rev.lens} round ${r + 1}, ${rev.lane} · ${rev.lens} review · m · r${r + 1}`;
        need(
          runTool(["log-action", d, "coachman", "review-launch", rev.lane, detail]).code === 0,
          `could not log the ${rev.lane} launch for ${name}`,
        );
      }
    }
  }
  engineerTime(d, design);
  if (design.stages === "strip") {
    const kept = readFileSync(join(d, "actions.jsonl"), "utf8")
      .split("\n")
      .filter((line) => {
        if (!line.trim()) return false;
        try {
          return (JSON.parse(line) as { action: string }).action !== "stage";
        } catch {
          return true;
        }
      });
    writeFileSync(join(d, "actions.jsonl"), `${kept.join("\n")}\n`);
  }
  return d;
}

export interface OracleCtx {
  scores: Record<string, { code: number; stdout: string }>;
  runtimes: Record<string, { code: number; stdout: string }>;
  restore: () => void;
}

export function buildOracle(): OracleCtx {
  const tmp = mkdtempSync(join(tmpdir(), "fixture-time-"));
  const savedEnv: Record<string, string | undefined> = {};
  for (const k of [
    "POSTMASTER_CONFIG",
    "POSTMASTER_TOOL_PINS",
    "GIT_AUTHOR_NAME",
    "GIT_AUTHOR_EMAIL",
    "GIT_COMMITTER_NAME",
    "GIT_COMMITTER_EMAIL",
    "HOME",
  ]) {
    savedEnv[k] = process.env[k];
  }
  const configPath = join(tmp, "config.toml");
  writeFileSync(
    configPath,
    '[lanes.one]\nharness = "bash"\nmodel = "m1"\n' +
      '[lanes.two]\nharness = "bash"\nmodel = "m2"\n' +
      '[lanes.three]\nharness = "bash"\nmodel = "m3"\n' +
      '[team]\nworkhorses = ["one", "two", "three"]\n' +
      'coachman = { harness = "bash", model = "judge" }\n' +
      '[tracker]\nkind = "github"\n',
  );
  process.env.POSTMASTER_CONFIG = configPath;
  process.env.POSTMASTER_TOOL_PINS = join(tmp, "tools");
  process.env.GIT_AUTHOR_NAME = "fixture";
  process.env.GIT_AUTHOR_EMAIL = "fixture@example.invalid";
  process.env.GIT_COMMITTER_NAME = "fixture";
  process.env.GIT_COMMITTER_EMAIL = "fixture@example.invalid";
  process.env.HOME = join(tmp, "home");

  const ticket =
    readdirSync(TICKETS)
      .filter((d) => existsSync(join(TICKETS, d, "ticket.md")))
      .sort()[0] ?? "";
  need(ticket !== "", "no fixture ticket found");
  const repoDir = join(tmp, "repo");
  const base = buildRepo(repoDir, ticket);

  const emptyMd = join(tmp, "empty.md");
  writeFileSync(emptyMd, "");
  const sections = runTool(["handoff-check", emptyMd])
    .stderr.split("\n")
    .filter((l) => l.startsWith("handoff-check: missing or empty section: "))
    .map((l) => l.replace("handoff-check: missing or empty section: ", ""));
  need(sections.length > 0, "could not read the hand-off sections");

  const scores: Record<string, { code: number; stdout: string }> = {};
  const runtimes: Record<string, { code: number; stdout: string }> = {};
  for (const name of Object.keys(DESIGNS)) {
    const design = DESIGNS[name];
    if (!design) throw new Error(`oracle setup: no design for ${name}`);
    const d = buildDispatch(repoDir, name, design, base, ticket, sections);
    const s = runTool(["fixture", "score", d, repoDir]);
    scores[name] = { code: s.code, stdout: s.stdout };
    const t = runTool(["run-times", d]);
    runtimes[name] = { code: t.code, stdout: t.stdout };
  }
  const restore = (): void => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmSync(tmp, { recursive: true, force: true });
  };
  return { scores, runtimes, restore };
}
