// Blind acceptance oracle for #202: the run layout the ticket's checks judge, with the
// runners and readers the cases need. The cases in reach-oracle.test.ts run the ticket's
// own interface (`run reach`, exit codes, the run log, `run landing card-block`,
// the change's own test files) and match only what the ticket pins. Lanes never see
// these files; at harvest they are cherry-picked onto a scratch of each lane and run.
// Covered: C1-C8, C10-C15, C17. Not covered: C9 and the C8/C12 escalation itself
// (coachman.md prose, verified by reading); C16 (a fixture run from the branch, scored
// at landing); the pinned-tool-absent card case (its mechanism is the lane's to choose).
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
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

export interface Run {
  code: number;
  out: string;
  err: string;
}

export function both(r: Run): string {
  return `${r.out}${r.err}`;
}

const GIT_ENV: Record<string, string | undefined> = {
  ...process.env,
  GIT_AUTHOR_NAME: "reach-oracle",
  GIT_AUTHOR_EMAIL: "oracle@example.invalid",
  GIT_COMMITTER_NAME: "reach-oracle",
  GIT_COMMITTER_EMAIL: "oracle@example.invalid",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
};

export function git(...args: string[]): Run {
  const r = spawnSync("git", args, { encoding: "utf8", env: GIT_ENV });
  return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

export function need(r: Run, what: string): void {
  if (r.code !== 0) throw new Error(`${what} failed with exit ${r.code}: ${both(r)}`);
}

export function reach(repoRoot: string, home: string, ...args: string[]): Run {
  const r = spawnSync(join(repoRoot, "scripts", "run"), ["reach", ...args], {
    encoding: "utf8",
    env: { ...process.env, HOME: home },
  });
  return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

export function landing(repoRoot: string, home: string, ...args: string[]): Run {
  const r = spawnSync(join(repoRoot, "scripts", "run"), ["landing", ...args], {
    encoding: "utf8",
    env: { ...process.env, HOME: home },
  });
  return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

export function codexCmd(id: string, command: string, output: string, exit: number): string {
  return JSON.stringify({
    type: "item.completed",
    item: {
      id,
      type: "command_execution",
      command: `/bin/bash -lc '${command}'`,
      aggregated_output: output,
      exit_code: exit,
      status: "completed",
    },
  });
}

export function codexFileChange(id: string, path: string): string {
  return JSON.stringify({
    type: "item.completed",
    item: { id, type: "file_change", changes: [{ path, kind: "add" }], status: "completed" },
  });
}

export function mimoBash(command: string, output: string, exit: number): string {
  return JSON.stringify({
    type: "tool_use",
    sessionID: "s1",
    part: {
      type: "tool",
      tool: "bash",
      state: {
        status: "completed",
        input: { command, description: "oracle command" },
        output,
        metadata: { exit },
      },
    },
  });
}

export interface Layout {
  tmp: string;
  home: string;
  repo: string;
  dispatch: string;
  logs: string;
  synth: string;
  codexWt: string;
  mimoWt: string;
  codexScratch: string;
  mimoScratch: string;
  cleanup: () => void;
}

const TICKET = "T";

const GATE_CHECKS =
  '{"checks": [{"name": "gate", "source": "default:gate", "command": "true", "shows": "x"}]}\n';

export function makeLayout(toolRoot: string): Layout {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "reach-oracle-")));
  const home = join(tmp, "home");
  const repo = join(tmp, "R");
  const origin = join(tmp, "origin.git");
  mkdirSync(home, { recursive: true });
  need(git("init", "--bare", "-b", "main", origin), "init origin");
  need(git("init", "-b", "main", repo), "init repo");
  need(git("-C", repo, "remote", "add", "origin", origin), "add remote");
  writeFileSync(join(repo, "README.md"), "oracle layout\n");
  need(git("-C", repo, "add", "README.md"), "add readme");
  need(git("-C", repo, "commit", "-qm", "initial"), "initial commit");
  need(git("-C", repo, "push", "-q", "origin", "main"), "push initial");
  need(
    git("-C", repo, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"),
    "set origin HEAD",
  );
  const seed = join(tmp, "seed");
  need(git("clone", "-q", origin, seed), "clone seed");
  writeFileSync(join(seed, "seed.txt"), "ahead\n");
  need(git("-C", seed, "add", "seed.txt"), "add seed file");
  need(git("-C", seed, "commit", "-qm", "origin moves ahead"), "commit seed");
  need(git("-C", seed, "push", "-q", "origin", "main"), "push seed");
  rmSync(seed, { recursive: true, force: true });
  appendFileSync(join(repo, ".git", "info", "exclude"), ".postmaster/\n.worktrees/\n");
  for (const b of [TICKET, `wb/${TICKET}-codex`, `wb/${TICKET}-mimo`]) {
    need(git("-C", repo, "branch", b), `branch ${b}`);
  }
  const wt = (name: string, branch: string): string => {
    const p = join(repo, ".worktrees", name);
    need(git("-C", repo, "worktree", "add", p, branch), `worktree ${name}`);
    return p;
  };
  const synth = wt(TICKET, TICKET);
  const codexWt = wt(`${TICKET}-codex`, `wb/${TICKET}-codex`);
  const mimoWt = wt(`${TICKET}-mimo`, `wb/${TICKET}-mimo`);
  const scratch = (name: string): string => {
    const p = join(repo, ".worktrees", name);
    need(git("-C", repo, "worktree", "add", "--detach", p, TICKET), `scratch ${name}`);
    return p;
  };
  const codexScratch = scratch(`${TICKET}-rev-bug-codex`);
  const mimoScratch = scratch(`${TICKET}-rev-bug-mimo`);
  const dispatch = join(repo, ".postmaster", "runs", TICKET);
  const logs = join(dispatch, "logs");
  mkdirSync(logs, { recursive: true });
  const lanes: Record<string, { harness: string; model: string; effort: string }> = {};
  for (const lane of ["codex", "claude", "muse", "mimo", "pi", "grok"]) {
    lanes[lane] = { harness: lane, model: "oracle-model", effort: "max" };
  }
  writeFileSync(
    join(dispatch, "run.json"),
    `${JSON.stringify(
      {
        coachman_contract: 2,
        project: "oracle",
        run: TICKET,
        target: { head: "oracle", branch: "main" },
        postmaster: { commit: "oracle", checkout: toolRoot },
        config: { lanes, team: { workhorses: ["codex", "mimo"] } },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(dispatch, "brief.md"),
    `# Waybill: ${TICKET}\nturnpikes: default\n\n## Ticket\n\nOracle ticket.\n\n` +
      `## Project profile\nrepo: ${repo}          default branch: main       BASE: oracle\n` +
      `gate: \`bun run check\`\n\n## Team\nworkhorses: codex, mimo\nreviewers: codex, mimo\n` +
      `CHECKPOINT_MODE: autonomous\nMERGE_AUTHORITY: postmaster\n\n## Dispatch\nname: ${TICKET}, oracle\n` +
      `dispatch: ${dispatch}\nsynthesis worktree: ${synth}\ntool: ${toolRoot}\n`,
  );
  writeFileSync(join(dispatch, "checks.json"), GATE_CHECKS);
  writeFileSync(join(dispatch, "actions.jsonl"), "");
  writeFileSync(
    join(dispatch, "manifest.json"),
    `${JSON.stringify({ lanes: { codex: { outcome: "harvested" }, mimo: { outcome: "harvested" } } }, null, 2)}\n`,
  );
  writeFileSync(
    join(logs, "review-r1.json"),
    `${JSON.stringify(
      {
        attempt: "oracle",
        boot: "oracle",
        limit: 7200,
        source: "oracle",
        deadline: 9999999999,
        started: "2026-01-01T00:00:00Z",
        reviewers: [
          ["bug", "codex"],
          ["bug", "mimo"],
        ],
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(codexWt, "in.txt"), "inside\n");
  writeFileSync(
    join(logs, "codex-events.jsonl"),
    `${codexFileChange("item_1", join(codexWt, "in.txt"))}\n${codexCmd("item_2", "git status --short", "", 0)}\n`,
  );
  writeFileSync(join(mimoWt, "in.txt"), "inside\n");
  writeFileSync(
    join(logs, "mimo-events.jsonl"),
    `${mimoBash("ls", "in.txt\n", 0)}\n${mimoBash("touch in.txt", "", 0)}\n`,
  );
  writeFileSync(
    join(logs, "review-r1-bug-codex.jsonl"),
    `${codexCmd("item_1", "git diff --stat", "", 0)}\n`,
  );
  writeFileSync(join(logs, "review-r1-bug-mimo.jsonl"), `${mimoBash("git diff --stat", "", 0)}\n`);
  return {
    tmp,
    home,
    repo,
    dispatch,
    logs,
    synth,
    codexWt,
    mimoWt,
    codexScratch,
    mimoScratch,
    cleanup: () => rmSync(tmp, { recursive: true, force: true }),
  };
}

export function headOf(dir: string): string {
  const r = git("-C", dir, "rev-parse", "HEAD");
  need(r, `head of ${dir}`);
  return r.out.trim();
}

export function refOf(repo: string, ref: string): string {
  const r = git("-C", repo, "rev-parse", ref);
  need(r, `read ${ref}`);
  return r.out.trim();
}

export function readActions(dispatch: string): Array<Record<string, unknown>> {
  const p = join(dispatch, "actions.jsonl");
  if (!existsSync(p)) return [];
  const lines: Array<Record<string, unknown>> = [];
  for (const l of readFileSync(p, "utf8").split("\n")) {
    if (l.trim() === "") continue;
    try {
      const v: unknown = JSON.parse(l);
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        lines.push(v as Record<string, unknown>);
      }
    } catch {
      // a half-written line is the implementation's to explain; the cases match whole lines
    }
  }
  return lines;
}

export function flat(v: unknown): string {
  return JSON.stringify(v);
}
