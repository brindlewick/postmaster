// Oracle helpers for #607: a lane's helpers get time to report, and a lane the harness cut off
// with helpers still running is never counted as reviewed. The tests spawn scripts/run as
// subprocesses with stand-in harnesses first on PATH; nothing here imports the change.
// The canned Claude streams are invented: a fruit shop's review, with the shapes a headless
// Claude Code stream-json run has (a started helper, its notice, and a result that counts them).
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { beside, toolRoot } from "./lib/paths.ts";
import type { Layout } from "./walls-oracle.ts";
import { setStub } from "./walls-oracle.ts";

export const ROOT = toolRoot(import.meta);
export const RUN = beside(import.meta, "run");

/** The harness's wait for background tasks after a headless run's last turn, in milliseconds. */
export const WAIT_VAR = "CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS";

/** What a round, a log and a surveyor say of a lane the harness cut off. */
export const CUTOFF_CAUSE = "cut off with helpers still running";

// --- canned Claude streams -----------------------------------------------------------

export function claudeInit(session: string): string {
  return JSON.stringify({ type: "system", subtype: "init", session_id: session, model: "stub" });
}

export function helperStarted(id: string, type = "local_agent"): string {
  return JSON.stringify({
    type: "system",
    subtype: "task_started",
    task_id: id,
    task_type: type,
    is_backgrounded: true,
    description: "weigh the apples",
  });
}

export function helperNotice(id: string, status: "completed" | "stopped" | "failed"): string {
  return JSON.stringify({
    type: "system",
    subtype: "task_notification",
    task_id: id,
    status,
    summary: "weighed",
  });
}

export function claudeResult(o: {
  text: string;
  spawned?: number;
  completed?: number;
  stoppedBySystem?: number;
}): string {
  return JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    result: o.text,
    subagent_stats: {
      spawned: o.spawned ?? 0,
      completed: o.completed ?? 0,
      failed: 0,
      killed: { parent: 0, user: 0, system: o.stoppedBySystem ?? 0 },
    },
  });
}

/** A lane that started a background helper, ended its turn on a status line, and had the helper
 * stopped by the harness: the stream a cut-off reviewer leaves. */
export function cutOffEvents(session: string): string[] {
  return [
    claudeInit(session),
    helperStarted("h1"),
    helperNotice("h1", "stopped"),
    claudeResult({ text: "Review under way.", spawned: 1, stoppedBySystem: 1 }),
  ];
}

/** The same lane when its helper reported before the lane ended: a whole review. */
export function finishedEvents(session: string): string[] {
  return [
    claudeInit(session),
    helperStarted("h1"),
    helperNotice("h1", "completed"),
    claudeResult({ text: "No findings.", spawned: 1, completed: 1 }),
  ];
}

/** A lane that started no helper and ends on a short status line: not a cut-off, whatever it says. */
export function statusOnlyEvents(session: string): string[] {
  return [claudeInit(session), claudeResult({ text: "Done." })];
}

// --- stand-in layout -----------------------------------------------------------------

/** The stub claude's setup hook: record the wait variable the harness was handed, or `unset`. */
export function recordWaitSeen(lay: Layout): { setup: string; path: string } {
  const path = join(lay.stubDir, "wait-seen");
  return { setup: `printf '%s\\n' "\${${WAIT_VAR}-unset}" >> "${path}"`, path };
}

/** Stand-in events for the claude harness, with the setup hook that records the wait it was handed. */
export function claudeStub(lay: Layout, events: string[], exit = 0): string {
  const seen = recordWaitSeen(lay);
  setStub(lay, "claude", events, exit, seen.setup);
  return seen.path;
}

export function waitsSeen(path: string): string[] {
  return existsSync(path)
    ? readFileSync(path, "utf8")
        .split("\n")
        .filter((l) => l !== "")
    : [];
}

/** Add claude lanes to the run's recorded config, beside the ones the layout holds. */
export function addClaudeLanes(dispatch: string, names: string[]): void {
  const path = join(dispatch, "run.json");
  const data = JSON.parse(readFileSync(path, "utf8")) as {
    config: { lanes: Record<string, unknown> };
  };
  for (const name of names) {
    data.config.lanes[name] = { harness: "claude", model: `${name}-model`, effort: "high" };
  }
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

/** Give the run's review rounds a time limit of this many seconds. */
export function setRoundLimit(dispatch: string, seconds: number): void {
  const path = join(dispatch, "run.json");
  const data = JSON.parse(readFileSync(path, "utf8")) as {
    config: { review?: Record<string, unknown> };
  };
  data.config.review = { ...data.config.review, round_timeout_seconds: seconds };
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

/** One lane launch run directly, not through the host, so its exit code and error output are
 * seen: the harness's stream goes to `stream`, and the role and stream reach the launch as the
 * host hands them. */
export function launchDirect(
  lay: Layout,
  o: { lane: string; role: "lane" | "reviewer"; cwd: string; stream: string },
): { code: number; err: string } {
  const prompt = join(lay.tmp, "direct-prompt.txt");
  writeFileSync(prompt, "Review the fruit counter.\n");
  const out = openSync(o.stream, "w");
  try {
    const r = spawnSync(RUN, ["launch", "launch", o.lane, o.cwd, prompt, "--run", lay.dispatch], {
      encoding: "utf8",
      env: { ...lay.env, POSTMASTER_EVENT_STREAM: o.stream, POSTMASTER_LAUNCH_ROLE: o.role },
      stdio: ["ignore", out, "pipe"],
      cwd: lay.tmp,
    });
    return { code: r.status ?? -1, err: r.stderr ?? "" };
  } finally {
    closeSync(out);
  }
}

/** The logs folder of a dispatch. */
export function logsOf(dispatch: string): string {
  return join(dispatch, "logs");
}

/** A round's stream, marker and cut-off marker names for one reviewer, as the review round names them. */
export function reviewerFiles(
  round: number,
  lens: string,
  lane: string,
): { stream: string; done: string; cutoff: string } {
  const stem = `review-r${round}-${lens}-${lane}`;
  return { stream: `${stem}.jsonl`, done: `${stem}.done`, cutoff: `${stem}.cutoff` };
}

// --- a team file and stand-in binaries for the printed forms ---------------------------

/** A team file with a Claude lane, a Codex lane and every role on Claude. */
export const TEAM_TOML = `[lanes.fruit]
harness = "claude"
model = "fruit-model"
effort = "high"

[lanes.pear]
harness = "codex"
model = "pear-model"

[team]
coachman = { harness = "claude", model = "coach-model" }
coachman_fallback = { harness = "claude", model = "spare-model" }
clerk = { harness = "claude", model = "clerk-model" }
postmaster = { harness = "claude", model = "pm-model" }

[team.coachman_legs]
synthesis = { harness = "claude", model = "synthesis-model" }
review = { harness = "claude", model = "review-model" }
ship = { harness = "claude", model = "ship-model" }
`;

/** Stand-in claude and codex binaries that do nothing, so the forms' on-PATH check passes. */
export function writeInertBins(bin: string): void {
  mkdirSync(bin, { recursive: true });
  for (const h of ["claude", "codex"]) {
    const p = join(bin, h);
    writeFileSync(p, "#!/bin/sh\nexit 0\n");
    chmodSync(p, 0o755);
  }
}
