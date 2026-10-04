// Controls for ticket #202. Each control gets a fresh run layout: a main checkout,
// the run's synthesis and lane worktrees, review scratches, records and a private HOME.
import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./lib/proc.ts";
import { toolRoot } from "./lib/paths.ts";
import { harnessData } from "./launch.ts";

const TOOL = toolRoot(import.meta);
const SCRIPT = join(import.meta.dir, "reach.ts");
const CHECK_TARGET = join(import.meta.dir, "check-target.ts");
const LANDING = join(import.meta.dir, "landing.sh");
const LOG_ACTION = join(import.meta.dir, "log-action.sh");
const VERIFY = join(import.meta.dir, "verify.sh");
const RUNS_STATUS = join(import.meta.dir, "runs-status.sh");
const CREATED: string[] = [];

interface Layout {
  root: string;
  repo: string;
  dispatch: string;
  home: string;
  bare: string;
  base: string;
  synth: string;
  codex: string;
  mimo: string;
  reviewers: { codex: string; mimo: string };
}

afterEach(() => {
  for (const path of CREATED.splice(0)) rmSync(path, { recursive: true, force: true });
});

function command(cmd: string, args: string[], cwd?: string): string {
  const result = run(cmd, args, cwd ? { cwd } : {});
  if (result.code !== 0)
    throw new Error(`${cmd} ${args.join(" ")} failed (${result.code}): ${result.err}${result.out}`);
  return result.out.trim();
}

function git(repo: string, ...args: string[]): string {
  return command("git", ["-C", repo, ...args]);
}

function makeLayout(): Layout {
  const root = mkdtempSync(join(tmpdir(), "postmaster-reach-"));
  CREATED.push(root);
  const repo = join(root, "repo");
  const bare = join(root, "origin.git");
  const home = join(root, "home");
  mkdirSync(home, { recursive: true });
  command("git", ["init", "-q", "-b", "main", repo]);
  git(repo, "config", "user.name", "Reach Test");
  git(repo, "config", "user.email", "reach@example.test");
  git(repo, "config", "commit.gpgsign", "false");
  mkdirSync(join(repo, ".git", "info"), { recursive: true });
  writeFileSync(join(repo, ".git", "info", "exclude"), ".postmaster/\n.worktrees/\n");
  writeFileSync(join(repo, "README.md"), "reach fixture\n");
  git(repo, "add", "README.md");
  git(repo, "commit", "-qm", "Base");
  const base = git(repo, "rev-parse", "HEAD");
  command("git", ["init", "--bare", "-q", bare]);
  git(repo, "remote", "add", "origin", bare);
  git(repo, "push", "-q", "origin", "main:main");
  const tree = git(repo, "rev-parse", `${base}^{tree}`);
  const future = command("git", [
    "-C",
    repo,
    "commit-tree",
    tree,
    "-p",
    base,
    "-m",
    "Remote moves",
  ]);
  git(repo, "update-ref", "refs/heads/remote-tip", future);
  git(repo, "push", "-q", "origin", "refs/heads/remote-tip:refs/heads/main");
  git(repo, "update-ref", "refs/remotes/origin/main", base);
  git(repo, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");

  const worktrees = join(repo, ".worktrees");
  mkdirSync(worktrees, { recursive: true });
  const ticket = "T";
  const synth = join(worktrees, ticket);
  const codex = join(worktrees, `${ticket}-codex`);
  const mimo = join(worktrees, `${ticket}-mimo`);
  const reviewers = {
    codex: join(worktrees, `${ticket}-rev-bug-codex`),
    mimo: join(worktrees, `${ticket}-rev-bug-mimo`),
  };
  git(repo, "worktree", "add", "-q", "-b", ticket, synth, "main");
  git(repo, "worktree", "add", "-q", "-b", "wb/T-codex", codex, "main");
  git(repo, "worktree", "add", "-q", "-b", "wb/T-mimo", mimo, "main");
  git(repo, "worktree", "add", "-q", "--detach", reviewers.codex, "T");
  git(repo, "worktree", "add", "-q", "--detach", reviewers.mimo, "T");

  const dispatch = join(repo, ".postmaster", "runs", ticket);
  mkdirSync(join(dispatch, "logs"), { recursive: true });
  writeFileSync(
    join(dispatch, "run.json"),
    `${JSON.stringify(
      {
        target: { branch: "main", head: base },
        postmaster: { checkout: TOOL, commit: "fixture" },
        config: {
          lanes: {
            codex: { harness: "codex" },
            claude: { harness: "claude" },
            muse: { harness: "muse" },
            mimo: { harness: "mimo" },
            pi: { harness: "pi" },
            grok: { harness: "grok" },
          },
          team: { workhorses: ["codex", "mimo"] },
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(dispatch, "manifest.json"),
    JSON.stringify({ lanes: { codex: {}, mimo: {} }, leg: 2 }) + "\n",
  );
  writeFileSync(
    join(dispatch, "brief.md"),
    `# Waybill: T\nturnpikes: bug\n\n## Ticket\n\nA reach check.\n\n## Project profile\nrepo: ${repo} default branch: main BASE: ${base}\n`,
  );
  writeFileSync(
    join(dispatch, "logs", "review-r1.json"),
    JSON.stringify({
      reviewers: [
        ["bug", "codex"],
        ["bug", "mimo"],
      ],
    }) + "\n",
  );
  const layout = { root, repo, dispatch, home, bare, base, synth, codex, mimo, reviewers };
  cleanEvents(layout);
  return layout;
}

function codex(commandText: string, output = "", exit = 0): Record<string, unknown> {
  return {
    type: "item.completed",
    item: {
      type: "command_execution",
      command: `/bin/bash -lc '${commandText}'`,
      aggregated_output: output,
      exit_code: exit,
    },
  };
}

function codexFile(path: string): Record<string, unknown> {
  return {
    type: "item.completed",
    item: { type: "file_change", changes: [{ path, kind: "add" }] },
  };
}

function claude(
  name: string,
  input: Record<string, unknown>,
  output = "",
  isError = false,
): Record<string, unknown>[] {
  const id = `tool-${Math.random().toString(16).slice(2)}`;
  return [
    { type: "assistant", message: { content: [{ type: "tool_use", id, name, input }] } },
    {
      type: "user",
      message: {
        content: [{ type: "tool_result", tool_use_id: id, content: output, is_error: isError }],
      },
    },
  ];
}

function mimo(
  name: string,
  input: Record<string, unknown>,
  output = "",
  exit = 0,
): Record<string, unknown> {
  return {
    type: "tool_use",
    sessionID: "s1",
    part: {
      type: "tool",
      tool: name,
      state: { status: exit === 0 ? "completed" : "error", input, output, metadata: { exit } },
    },
  };
}

function pi(
  name: string,
  args: Record<string, unknown>,
  output = "",
  isError = false,
): Record<string, unknown>[] {
  const id = `call-${Math.random().toString(16).slice(2)}`;
  return [
    { type: "tool_execution_start", toolCallId: id, toolName: name, args },
    { type: "tool_execution_end", toolCallId: id, toolName: name, result: output, isError },
  ];
}

function muse(
  name: string,
  facts: Record<string, unknown>,
  text = "",
  outcome = "success",
): Record<string, unknown> {
  return {
    payload_type: "tool.result",
    payload: { correlation_facts: { tool_name: name, outcome }, edit_facts: facts, text },
  };
}

function writeEvents(path: string, events: unknown[]): void {
  writeFileSync(path, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
}

function writeWorkhorse(layout: Layout, lane: "codex" | "mimo", events: unknown[]): string {
  const path = join(layout.dispatch, "logs", `${lane}-events.jsonl`);
  writeEvents(path, events);
  return path;
}

function writeReviewer(
  layout: Layout,
  lane: "codex" | "mimo",
  events: unknown[],
  round = 1,
): string {
  const path = join(layout.dispatch, "logs", `review-r${round}-bug-${lane}.jsonl`);
  writeEvents(path, events);
  return path;
}

function cleanEvents(layout: Layout): void {
  writeWorkhorse(layout, "codex", [codex(`touch ${layout.codex}/in.txt`)]);
  writeWorkhorse(layout, "mimo", [mimo("write_file", { path: join(layout.mimo, "in.txt") })]);
  writeReviewer(layout, "codex", [codex(`touch ${layout.reviewers.codex}/probe.txt`)]);
  writeReviewer(layout, "mimo", [
    mimo("write_file", { path: join(layout.reviewers.mimo, "probe.txt") }),
  ]);
}

function call(layout: Layout, args: string[]): { code: number; out: string } {
  const result = run("bun", ["--no-env-file", "--config=/dev/null", SCRIPT, ...args], {
    env: { HOME: layout.home },
  });
  return { code: result.code, out: `${result.out}${result.err}` };
}

function check(layout: Layout, point: string): { code: number; out: string } {
  return call(layout, ["check", layout.dispatch, point]);
}

function before(layout: Layout, round = 1): { code: number; out: string } {
  return call(layout, ["before", layout.dispatch, String(round)]);
}

function stream(
  layout: Layout,
  lane: string,
  eventPath: string,
  ownFolder: string,
): { code: number; out: string } {
  return call(layout, ["stream", layout.dispatch, lane, eventPath, ownFolder]);
}

function actionLines(layout: Layout): Array<Record<string, unknown>> {
  const path = join(layout.dispatch, "actions.jsonl");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function reachEvents(
  layout: Layout,
): Array<{ action: Record<string, unknown>; detail: Record<string, unknown> }> {
  return actionLines(layout)
    .filter((action) => action.action === "reach")
    .map((action) => ({
      action,
      detail: JSON.parse(String(action.detail)) as Record<string, unknown>,
    }));
}

function addCommit(
  repo: string,
  folder: string,
  file: string,
  content = "review change\n",
): string {
  writeFileSync(join(folder, file), content);
  git(repo, "-C", folder, "add", file);
  git(repo, "-C", folder, "commit", "-qm", "Review change");
  return git(repo, "-C", folder, "rev-parse", "HEAD");
}

function writeAction(
  layout: Layout,
  actor: string,
  action: string,
  target: string,
  detail: string,
): void {
  const result = run("bash", [LOG_ACTION, layout.dispatch, actor, action, target, detail]);
  if (result.code !== 0) throw new Error(`log action failed: ${result.err}`);
}

describe("C1-C2: point checks and audit records", () => {
  test("C1 clean workhorse, review and card points pass", () => {
    const layout = makeLayout();
    expect(check(layout, "workhorses").code).toBe(0);
    expect(before(layout).code).toBe(0);
    expect(check(layout, "r1").code).toBe(0);
    expect(check(layout, "card").code).toBe(0);
  });

  test("C2 each point is logged, including clean points and findings", () => {
    const layout = makeLayout();
    writeWorkhorse(layout, "codex", [codexFile(join(layout.repo, "out.txt"))]);
    check(layout, "workhorses");
    before(layout);
    check(layout, "r1");
    check(layout, "card");
    const events = reachEvents(layout);
    expect(
      events.filter(({ detail }) => detail.kind === "point").map(({ detail }) => detail.point),
    ).toEqual(["workhorses", "r1", "card"]);
    expect(
      events.some(
        ({ detail }) => detail.kind === "finding" && detail.path === join(layout.repo, "out.txt"),
      ),
    ).toBe(true);
  });
});

describe("C3-C4: main checkout reach", () => {
  test("C3 every changed and new path is listed, with nested files expanded, without fetching", () => {
    const layout = makeLayout();
    for (let i = 0; i < 24; i++) writeFileSync(join(layout.repo, `untracked-${i}.txt`), "new\n");
    mkdirSync(join(layout.repo, "probe"));
    writeFileSync(join(layout.repo, "probe", "a.txt"), "new\n");
    writeFileSync(join(layout.repo, "README.md"), "tracked change\n");
    const remoteBefore = git(layout.repo, "rev-parse", "refs/remotes/origin/main");
    before(layout);
    const workhorses = check(layout, "workhorses");
    const round = check(layout, "r1");
    const card = check(layout, "card");
    for (const result of [workhorses, round, card]) {
      expect(result.code).toBe(2);
      expect(result.out).toContain("probe/a.txt");
      for (let i = 0; i < 24; i++) expect(result.out).toContain(`untracked-${i}.txt`);
      expect(result.out).toContain("README.md");
      expect(result.out).not.toContain("?? probe/");
    }
    expect(git(layout.repo, "rev-parse", "refs/remotes/origin/main")).toBe(remoteBefore);
  });

  test("C4a a branch other than the default is reported", () => {
    const layout = makeLayout();
    git(layout.repo, "checkout", "-qb", "x");
    const result = run("bun", [
      "--no-env-file",
      "--config=/dev/null",
      CHECK_TARGET,
      "reach",
      layout.repo,
      "main",
    ]);
    expect(result.code).toBe(2);
    expect(result.out).toContain("off-default x (default is main)");
  });

  test("C4b the default branch can move forward while clean", () => {
    const layout = makeLayout();
    writeFileSync(join(layout.repo, "advanced.txt"), "forward\n");
    git(layout.repo, "add", "advanced.txt");
    git(layout.repo, "commit", "-qm", "Advance default branch");
    const result = check(layout, "workhorses");
    expect(result.code).toBe(0);
    expect(result.out).toContain("workhorses: clean");
  });
});

describe("C5-C7: stream readers and access classification", () => {
  const cases = ["codex", "claude", "muse", "mimo", "pi"] as const;
  for (const harness of cases) {
    test(`C5 ${harness} stream finds outside paths and keeps the strongest access`, () => {
      const layout = makeLayout();
      const other = join(layout.repo, ".worktrees", "T-mimo", "a.ts");
      const homeFile = join(layout.home, "n.txt");
      writeFileSync(homeFile, "home read\n");
      mkdirSync(join(layout.repo, ".worktrees", "T-mimo"), { recursive: true });
      writeFileSync(other, "other lane\n");
      const shell = `cat ${homeFile}; cat ${other}; cat ${other}; echo x > ${other}; git -C ${layout.synth} log -1; git -C ${layout.synth} config --get core.bare; echo tmp > /tmp/x; cat /tmp/x >/dev/null; bun test; touch ${join(layout.codex, "in.txt")}`;
      let events: unknown[];
      if (harness === "codex") {
        events = [
          codexFile(join(layout.repo, "out.txt")),
          codexFile(other),
          codex(shell),
          codexFile(join(layout.codex, "in.txt")),
        ];
      } else if (harness === "claude") {
        events = [
          ...claude("Write", { file_path: join(layout.repo, "out.txt"), content: "out" }),
          ...claude("Read", { file_path: other }),
          ...claude("Edit", { file_path: other, old_string: "x", new_string: "y" }),
          ...claude("Bash", { command: shell }),
          ...claude("Write", { file_path: join(layout.codex, "in.txt"), content: "in" }),
        ];
      } else if (harness === "muse") {
        events = [
          muse("write_file", { path: join(layout.repo, "out.txt") }),
          muse("read_file", { path: other }),
          muse("edit_file", { path: other }),
          muse("bash", { command: shell }),
          muse("write_file", { path: join(layout.codex, "in.txt") }),
        ];
      } else if (harness === "mimo") {
        events = [
          mimo("write_file", { path: join(layout.repo, "out.txt") }),
          mimo("read_file", { path: other }),
          mimo("edit_file", { path: other }),
          mimo("bash", { command: shell }),
          mimo("write_file", { path: join(layout.codex, "in.txt") }),
        ];
      } else {
        events = [
          ...pi("write", { path: join(layout.repo, "out.txt") }),
          ...pi("read", { path: other }),
          ...pi("edit", { path: other }),
          ...pi("bash", { command: shell }),
          ...pi("write", { path: join(layout.codex, "in.txt") }),
        ];
      }
      const eventsPath = join(layout.dispatch, "logs", `${harness}-direct.jsonl`);
      writeEvents(eventsPath, events);
      const result = stream(layout, harness, eventsPath, layout.codex);
      expect(result.code).toBe(2);
      expect(result.out).toContain(`finding write ${join(layout.repo, "out.txt")} (main checkout)`);
      expect(result.out).toContain(`finding write ${other} (another worktree)`);
      expect(result.out).toContain(`note read ${homeFile} (elsewhere)`);
      expect(result.out).toContain(`note read ${layout.synth} (synthesis worktree)`);
      expect(
        result.out.match(new RegExp(other.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "gu"))?.length,
      ).toBe(1);
      expect(result.out).toContain(`expected write ${join(layout.codex, "in.txt")}`);
      expect(result.out).not.toContain("/tmp/x");
    });
  }

  test("C5 a Claude Code forked task file supplies tool calls absent from the lane stream", () => {
    const layout = makeLayout();
    const path = join(layout.repo, "forked.txt");
    writeEvents(join(layout.dispatch, "logs", "review-r1-bug-codex.jsonl"), [
      {
        type: "system",
        subtype: "task_notification",
        output_file: join(layout.home, "task.jsonl"),
      },
    ]);
    writeEvents(
      join(layout.dispatch, "logs", "review-r1-bug-codex-claude-task-01-task.jsonl"),
      claude("Write", { file_path: path }),
    );
    const runJson = JSON.parse(readFileSync(join(layout.dispatch, "run.json"), "utf8"));
    runJson.config.lanes.codex.harness = "claude";
    writeFileSync(join(layout.dispatch, "run.json"), JSON.stringify(runJson));
    const result = stream(
      layout,
      "codex",
      join(layout.dispatch, "logs", "review-r1-bug-codex.jsonl"),
      layout.reviewers.codex,
    );
    expect(result.code).toBe(2);
    expect(result.out).toContain(`finding write ${path} (main checkout)`);
  });

  test("C5 unsupported, unreadable and empty records are not checked", () => {
    const layout = makeLayout();
    const grok = join(layout.dispatch, "logs", "grok.jsonl");
    writeEvents(grok, [codex("touch /tmp/x")]);
    expect(stream(layout, "grok", grok, layout.codex).code).toBe(3);
    const unreadable = join(layout.dispatch, "logs", "unreadable.jsonl");
    writeFileSync(unreadable, "not json\n");
    expect(stream(layout, "codex", unreadable, layout.codex).code).toBe(3);
    const empty = join(layout.dispatch, "logs", "empty.jsonl");
    writeEvents(empty, [{ type: "turn.completed" }]);
    expect(stream(layout, "codex", empty, layout.codex).out).toContain("not checked");
  });

  test("C6 only this run's refs and the synthesis worktree are compared", () => {
    const layout = makeLayout();
    expect(before(layout).code).toBe(0);
    const commit = addCommit(layout.repo, layout.reviewers.mimo, "scratch-only.txt");
    expect(commit).not.toBe(layout.base);
    const untouched = check(layout, "r1");
    expect(untouched.code).toBe(0);
    expect(untouched.out).not.toContain("scratch-only");
  });

  test("C6 a synthesis merge reports both the run ref and synthesis head with full hashes", () => {
    const layout = makeLayout();
    expect(before(layout).code).toBe(0);
    const commit = addCommit(layout.repo, layout.reviewers.mimo, "reviewed.txt");
    git(layout.repo, "-C", layout.synth, "merge", "--ff-only", commit);
    const actual = `git -C ${layout.synth} status --short && git -C ${layout.synth} merge --ff-only ${commit} && git -C ${layout.synth} log --oneline -3`;
    writeReviewer(layout, "mimo", [mimo("bash", { command: actual })]);
    const result = check(layout, "r1");
    expect(result.code).toBe(2);
    expect(result.out).toContain(`refs/heads/T`);
    expect(result.out).toContain(layout.base);
    expect(result.out).toContain(commit);
    expect(result.out).toContain(layout.synth);
    expect(
      actionLines(layout).some(
        (line) =>
          line.action === "degrade" && line.target === "mimo" && line.detail === "bug r1: reach",
      ),
    ).toBe(true);
    expect(
      actionLines(layout).some((line) => line.action === "degrade" && line.target === "codex"),
    ).toBe(false);
  });

  test("C6 unrelated branch, tags, remote refs and a forward main commit are ignored", () => {
    const layout = makeLayout();
    expect(before(layout).code).toBe(0);
    const scratchCommit = addCommit(layout.repo, layout.reviewers.mimo, "round-file.txt");
    git(layout.repo, "tag", "round-tag", scratchCommit);
    git(layout.repo, "update-ref", "refs/remotes/origin/main", scratchCommit);
    git(layout.repo, "checkout", "main");
    writeFileSync(join(layout.repo, "main-forward.txt"), "forward\n");
    git(layout.repo, "add", "main-forward.txt");
    git(layout.repo, "commit", "-qm", "Move main forward");
    const result = check(layout, "r1");
    expect(result.code).toBe(0);
    expect(result.out).not.toContain("round-tag");
    expect(result.out).not.toContain("main-forward");
  });

  test("C7 refused attempts and reads are notes, while failed writes remain findings", () => {
    const layout = makeLayout();
    const denied = join(layout.home, ".codex", "settings.toml");
    const streamPath = join(layout.dispatch, "logs", "refusal.jsonl");
    writeEvents(streamPath, [...claude("Read", { file_path: denied }, "Permission denied", true)]);
    const read = stream(layout, "claude", streamPath, layout.codex);
    expect(read.code).toBe(3);
    expect(read.out).toContain("refused");

    const ordinaryFailure = join(layout.dispatch, "logs", "ordinary-read-error.jsonl");
    const ordinaryFile = join(layout.home, "ordinary.txt");
    writeFileSync(ordinaryFile, "present\n");
    writeEvents(ordinaryFailure, claude("Read", { file_path: ordinaryFile }, "tool failed", true));
    const ordinary = stream(layout, "claude", ordinaryFailure, layout.codex);
    expect(ordinary.code).toBe(3);
    expect(ordinary.out).toContain("note read");
    expect(ordinary.out).not.toContain("refused");

    const mimoPath = join(layout.dispatch, "logs", "mimo-refusal.jsonl");
    writeEvents(mimoPath, [
      mimo("bash", { command: `echo x > ${join(layout.repo, "o.txt")}` }, "Permission denied", 1),
    ]);
    expect(stream(layout, "mimo", mimoPath, layout.mimo).code).toBe(3);

    const failedWrite = join(layout.dispatch, "logs", "failed-write.jsonl");
    writeEvents(failedWrite, [codex(`echo x > ${join(layout.repo, "p.txt")}; false`, "", 1)]);
    expect(stream(layout, "codex", failedWrite, layout.codex).code).toBe(2);

    const unknown = join(layout.dispatch, "logs", "unknown-command.jsonl");
    writeEvents(unknown, [codex(`some-tool ${join(layout.repo, "q.txt")}`)]);
    const unknownResult = stream(layout, "codex", unknown, layout.codex);
    expect(unknownResult.code).toBe(3);
    expect(unknownResult.out).toContain("note read");

    const museRead = join(layout.dispatch, "logs", "muse-read.jsonl");
    const readTarget = join(layout.repo, "README.md");
    writeEvents(museRead, [
      muse("read_file", {}, `Read text file \`${readTarget}\`\nreach fixture\n`),
    ]);
    const museResult = stream(layout, "muse", museRead, layout.mimo);
    expect(museResult.code).toBe(3);
    expect(museResult.out).toContain(`note read ${readTarget} (main checkout)`);

    const gitDirRead = join(layout.dispatch, "logs", "git-dir-read.jsonl");
    writeEvents(gitDirRead, [codex(`GIT_DIR=${join(layout.repo, ".git")} git log -1`)]);
    const gitDirResult = stream(layout, "codex", gitDirRead, layout.codex);
    expect(gitDirResult.code).toBe(3);
    expect(gitDirResult.out).toContain(`note read ${layout.repo} (main checkout)`);

    const savedHome = process.env.HOME;
    const savedData = process.env.POSTMASTER_HARNESS_DATA;
    process.env.HOME = layout.home;
    delete process.env.POSTMASTER_HARNESS_DATA;
    try {
      const dataDir = harnessData("mimo", "launch", layout.mimo, "mimo", "", layout.dispatch);
      const dataFile = join(dataDir, "session.json");
      const dataWrite = join(layout.dispatch, "logs", "mimo-data.jsonl");
      writeEvents(dataWrite, [mimo("write_file", { path: dataFile })]);
      expect(stream(layout, "mimo", dataWrite, layout.mimo).code).toBe(0);
    } finally {
      if (savedHome === undefined) delete process.env.HOME;
      else process.env.HOME = savedHome;
      if (savedData === undefined) delete process.env.POSTMASTER_HARNESS_DATA;
      else process.env.POSTMASTER_HARNESS_DATA = savedData;
    }

    const outsideHome = join(layout.home, "other.txt");
    const outsideWrite = join(layout.dispatch, "logs", "outside-home.jsonl");
    writeEvents(outsideWrite, [mimo("write_file", { path: outsideHome })]);
    expect(stream(layout, "mimo", outsideWrite, layout.mimo).code).toBe(2);
  });
});

describe("C8-C9: escalation boundary", () => {
  test("C8a a recorded workhorse write reaches the main checkout", () => {
    const layout = makeLayout();
    writeWorkhorse(layout, "codex", [codexFile(join(layout.repo, "out.txt"))]);
    const result = check(layout, "workhorses");
    expect(result.code).toBe(2);
    expect(result.out).toContain("out.txt");
    expect(readFileSync(join(TOOL, "skills/postmaster/coachman.md"), "utf8")).toContain(
      "before setting `synthesis` or staging any synthesis",
    );
  });

  test("C8b an unrecorded main checkout path is a finding, while a read is only a note", () => {
    const layout = makeLayout();
    writeFileSync(join(layout.repo, "unrecorded.txt"), "new\n");
    expect(check(layout, "workhorses").code).toBe(2);
    const readOnly = makeLayout();
    writeWorkhorse(readOnly, "codex", [codex(`cat ${join(readOnly.repo, "README.md")}`)]);
    expect(check(readOnly, "workhorses").code).toBe(3);
  });

  test("C9 an escalation marker is RULE, and no synthesis stage follows before the ruling", () => {
    const layout = makeLayout();
    writeFileSync(join(layout.dispatch, ".escalation-ready"), "");
    const result = run("bash", [RUNS_STATUS, join(layout.repo, ".postmaster", "runs")]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("RULE");
    const coachman = readFileSync(join(TOOL, "skills/postmaster/coachman.md"), "utf8");
    const workhorseCheck = coachman.indexOf("reach.ts check <dispatch> workhorses");
    const synthesisStage = coachman.indexOf("stage.sh <dispatch> synthesis", workhorseCheck);
    expect(workhorseCheck).toBeGreaterThanOrEqual(0);
    expect(synthesisStage).toBeGreaterThan(workhorseCheck);
    expect(coachman.slice(workhorseCheck, synthesisStage)).toContain("touch `.escalation-ready`");
  });

  test("C9b a reviewer reach waits before fixes or another review launch", () => {
    const layout = makeLayout();
    before(layout);
    writeReviewer(layout, "mimo", [mimo("write_file", { path: join(layout.home, "outside.txt") })]);
    const round = check(layout, "r1");
    expect(round.code).toBe(2);
    expect(round.out).toContain("r1: finding");
    expect(round.out).toContain(`escalate: mimo ${join(layout.home, "outside.txt")}`);
    writeFileSync(join(layout.dispatch, ".escalation-ready"), "");
    const result = run("bash", [RUNS_STATUS, join(layout.repo, ".postmaster", "runs")]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("RULE");
    expect(
      actionLines(layout).some(
        (line) => line.action === "apply" || line.action === "review-launch",
      ),
    ).toBe(false);
    const coachman = readFileSync(join(TOOL, "skills/postmaster/coachman.md"), "utf8");
    const roundCheck = coachman.indexOf("reach.ts check <dispatch> r<round>");
    const userFinding = coachman.indexOf("escalate:", roundCheck);
    expect(roundCheck).toBeGreaterThanOrEqual(0);
    expect(userFinding).toBeGreaterThanOrEqual(0);
    expect(coachman.slice(userFinding)).toContain("exit before applying a fix or");
    expect(coachman.slice(userFinding)).toContain("launching another review round");
  });
});

describe("C10-C12: review rounds, verdicts and restore", () => {
  test("C10b a reviewer moving a run ref from its scratch voids only its own verdict", () => {
    const layout = makeLayout();
    before(layout);
    const next = addCommit(layout.repo, layout.reviewers.mimo, "new-ref.txt");
    writeReviewer(layout, "mimo", [
      mimo("bash", { command: `git update-ref refs/heads/T ${next}` }),
    ]);
    git(layout.repo, "update-ref", "refs/heads/T", next);
    const result = check(layout, "r1");
    expect(result.code).toBe(2);
    expect(
      actionLines(layout)
        .filter((line) => line.action === "degrade")
        .map((line) => line.target),
    ).toEqual(["mimo"]);
    const restore = call(layout, ["restore", layout.dispatch, "r1"]);
    expect(restore.code).toBe(0);
    expect(git(layout.repo, "rev-parse", "refs/heads/T")).toBe(layout.base);
  });

  test("C10c an unexplained tracked round change voids every reviewer", () => {
    const layout = makeLayout();
    before(layout);
    const commit = addCommit(layout.repo, layout.reviewers.mimo, "unexplained.txt");
    git(layout.repo, "-C", layout.synth, "merge", "--ff-only", commit);
    const result = check(layout, "r1");
    expect(result.code).toBe(3);
    expect(
      actionLines(layout)
        .filter((line) => line.action === "degrade")
        .map((line) => line.target)
        .sort(),
    ).toEqual(["codex", "mimo"]);
  });

  test("C11 restore saves the undone change and moves new synthesis files into the run", () => {
    const layout = makeLayout();
    before(layout);
    const commit = addCommit(layout.repo, layout.reviewers.mimo, "reviewed.txt");
    git(layout.repo, "-C", layout.synth, "merge", "--ff-only", commit);
    writeReviewer(layout, "mimo", [
      mimo("bash", { command: `git -C ${layout.synth} merge --ff-only ${commit}` }),
    ]);
    const round = check(layout, "r1");
    expect(round.code).toBe(2);
    expect(round.out).toContain("r1: finding");
    writeFileSync(join(layout.synth, "u.txt"), "preserve me\n");
    const symlinkTarget = join(layout.home, "outside-target.txt");
    symlinkSync(symlinkTarget, join(layout.synth, "outside-link"));
    expect(call(layout, ["restore", layout.dispatch, "r1"]).code).toBe(0);
    expect(git(layout.repo, "rev-parse", "refs/heads/T")).toBe(layout.base);
    expect(git(layout.repo, "-C", layout.synth, "rev-parse", "HEAD")).toBe(layout.base);
    expect(readFileSync(join(layout.dispatch, "reach", "r1", "u.txt"), "utf8")).toBe(
      "preserve me\n",
    );
    expect(readlinkSync(join(layout.dispatch, "reach", "r1", "outside-link"))).toBe(symlinkTarget);
    expect(existsSync(join(layout.dispatch, "reach", "r1", "branches", "refs_heads_T.patch"))).toBe(
      true,
    );
    writeFileSync(
      join(layout.dispatch, "checks.json"),
      JSON.stringify({
        checks: [{ name: "gate", source: "default:gate", command: "true", shows: "gate" }],
      }),
    );
    const verified = run("bash", [VERIFY, "run", layout.synth, layout.dispatch]);
    expect(verified.code).toBe(0);
  });

  test("C12 a reviewer reach is marked for the user outside this run, and not inside it", () => {
    const external = makeLayout();
    before(external);
    const outside = join(external.repo, "x.txt");
    writeReviewer(external, "mimo", [mimo("bash", { command: `touch ${outside}` })]);
    writeFileSync(outside, "written\n");
    expect(check(external, "r1").code).toBe(2);
    const externalFinding = reachEvents(external).find(
      ({ detail }) => detail.kind === "finding" && detail.path === outside,
    );
    expect(externalFinding?.detail.user).toBe(true);
    expect(
      actionLines(external).some((line) => line.action === "degrade" && line.target === "mimo"),
    ).toBe(true);

    const internal = makeLayout();
    before(internal);
    const insideRun = join(internal.codex, "created.txt");
    writeReviewer(internal, "mimo", [mimo("bash", { command: `touch ${insideRun}` })]);
    expect(check(internal, "r1").code).toBe(2);
    const internalFinding = reachEvents(internal).find(
      ({ detail }) => detail.kind === "finding" && detail.path === insideRun,
    );
    expect(internalFinding?.detail.user).toBe(false);
  });
});

describe("C13-C15: card, contract and balanced controls", () => {
  test("C13 reads and unexplained untracked files are notes and do not degrade reviewers", () => {
    const layout = makeLayout();
    before(layout);
    writeReviewer(layout, "mimo", [
      mimo("bash", { command: `cat ${join(layout.repo, "README.md")}` }),
    ]);
    writeFileSync(join(layout.synth, "untracked-synthesis.txt"), "new\n");
    writeFileSync(join(layout.repo, "untracked-main.txt"), "new\n");
    const round = check(layout, "r1");
    expect(round.code).toBe(2);
    expect(round.out).toContain("r1: note");
    expect(round.out).toContain("README.md");
    expect(round.out).toContain("untracked-synthesis.txt");
    expect(actionLines(layout).some((line) => line.action === "degrade")).toBe(false);
    const card = check(layout, "card");
    expect(card.out).toContain("card: note");
    expect(card.out).toContain("untracked-main.txt");
    expect(card.out).not.toContain("README.md");
    expect(card.out).not.toContain("untracked-synthesis.txt");
    expect(actionLines(layout).some((line) => line.action === "degrade")).toBe(false);
  });

  test("C14 card renders logged reaches without exposing absolute paths, and missing points say not checked", () => {
    const layout = makeLayout();
    const codexOut = join(layout.repo, "out.txt");
    const homeOut = join(layout.home, "other", "x");
    const privateTarget = join(layout.home, "private-target.txt");
    symlinkSync(privateTarget, join(layout.repo, "project-link"));
    mkdirSync(join(layout.home, "other"), { recursive: true });
    writeWorkhorse(layout, "codex", [codexFile(codexOut), codexFile(homeOut)]);
    expect(check(layout, "workhorses").code).toBe(2);
    before(layout);
    const commit = addCommit(layout.repo, layout.reviewers.mimo, "reviewed.txt");
    git(layout.repo, "-C", layout.synth, "merge", "--ff-only", commit);
    writeReviewer(layout, "mimo", [
      mimo("bash", { command: `git -C ${layout.synth} merge --ff-only ${commit}` }),
    ]);
    check(layout, "r1");
    check(layout, "card");

    writeFileSync(
      join(layout.dispatch, "checks.json"),
      JSON.stringify({
        checks: [{ name: "gate", source: "default:gate", command: "true", shows: "gate" }],
      }),
    );
    const sha = git(layout.synth, "rev-parse", "HEAD").slice(0, 12);
    writeAction(layout, "coachman", "verify", "gate", `on=${sha}@${sha} result=pass exit=0 secs=1`);
    const checkpoint = join(layout.dispatch, "checkpoint.md");
    writeFileSync(checkpoint, "## Findings (bug)\n\nnone\n");
    const card = run("bash", [LANDING, "card-block", layout.dispatch, layout.synth, checkpoint]);
    expect(card.code).toBe(0);
    expect(card.out).toContain("## Reach");
    expect(card.out).toContain("out.txt");
    expect(card.out).toContain("outside the project");
    expect(card.out).toContain("synthesis worktree");
    expect(card.out).toContain("project-link");
    expect(card.out).not.toContain("private-target.txt");
    expect(card.out).toContain("voided verdict: bug reviewer mimo");
    expect(card.out).not.toContain(layout.home);
    expect(card.out).not.toContain(layout.repo);

    const noCard = makeLayout();
    check(noCard, "workhorses");
    before(noCard);
    check(noCard, "r1");
    const kept = readFileSync(join(noCard.dispatch, "actions.jsonl"), "utf8")
      .split("\n")
      .filter((line) => {
        if (!line) return false;
        return JSON.parse(line).target !== "card";
      });
    writeFileSync(join(noCard.dispatch, "actions.jsonl"), `${kept.join("\n")}\n`);
    writeFileSync(
      join(noCard.dispatch, "checks.json"),
      JSON.stringify({
        checks: [{ name: "gate", source: "default:gate", command: "true", shows: "gate" }],
      }),
    );
    writeAction(
      noCard,
      "coachman",
      "verify",
      "gate",
      `on=${git(noCard.synth, "rev-parse", "HEAD").slice(0, 12)}@${git(noCard.synth, "rev-parse", "HEAD").slice(0, 12)} result=pass exit=0 secs=1`,
    );
    writeFileSync(checkpoint, "## Findings (bug)\n\nnone\n");
    const missing = run("bash", [LANDING, "card-block", noCard.dispatch, noCard.synth, checkpoint]);
    expect(missing.code).toBe(0);
    expect(missing.out).toContain("- card: not checked");
  });

  test("C15 check-target reach uses the same command for a clean negative control", () => {
    const layout = makeLayout();
    const clean = run("bun", [
      "--no-env-file",
      "--config=/dev/null",
      CHECK_TARGET,
      "reach",
      layout.repo,
      "main",
    ]);
    expect(clean.code).toBe(0);
    expect(clean.out).toContain("clean");
    writeFileSync(join(layout.repo, "dirty.txt"), "dirty\n");
    const dirty = run("bun", [
      "--no-env-file",
      "--config=/dev/null",
      CHECK_TARGET,
      "reach",
      layout.repo,
      "main",
    ]);
    expect(dirty.code).toBe(2);
    expect(dirty.out).toContain("changed dirty.txt");
  });
});

describe("R1: review round 1 fixes", () => {
  test("R1 a write after a newline is a finding, and a multiline read stays a note", () => {
    const layout = makeLayout();
    const target = join(layout.home, "target.txt");
    const multi = join(layout.dispatch, "logs", "multiline.jsonl");
    writeEvents(multi, [codex(`echo hi\nrm ${target}`)]);
    const result = stream(layout, "codex", multi, layout.codex);
    expect(result.code).toBe(2);
    expect(result.out).toContain(`finding write ${target} (elsewhere)`);

    const readOnly = join(layout.dispatch, "logs", "multiline-read.jsonl");
    writeEvents(readOnly, [codex(`echo hi\ncat ${join(layout.home, "n.txt")}`)]);
    const read = stream(layout, "codex", readOnly, layout.codex);
    expect(read.code).toBe(3);
    expect(read.out).toContain("note read");
  });

  test("R1 |& separates commands like a pipe, and a plain pipe still splits", () => {
    const layout = makeLayout();
    const piped = join(layout.home, "piped.txt");
    const errPipe = join(layout.dispatch, "logs", "pipeamp.jsonl");
    writeEvents(errPipe, [codex(`echo hi |& tee ${piped}`)]);
    const result = stream(layout, "codex", errPipe, layout.codex);
    expect(result.code).toBe(2);
    expect(result.out).toContain(`finding write ${piped} (elsewhere)`);

    const plain = join(layout.dispatch, "logs", "plain-pipe.jsonl");
    writeEvents(plain, [codex(`echo hi | cat ${join(layout.home, "n.txt")}`)]);
    const split = stream(layout, "codex", plain, layout.codex);
    expect(split.code).toBe(3);
    expect(split.out).toContain("note read");
  });

  test("R1 quoted redirect text is not a write, while a real redirect is", () => {
    const layout = makeLayout();
    const quoted = join(layout.dispatch, "logs", "quoted.jsonl");
    writeEvents(quoted, [codex(`echo "> ${join(layout.repo, "README.md")}"`)]);
    const result = stream(layout, "codex", quoted, layout.codex);
    expect(result.code).toBe(0);
    expect(result.out).toContain("clean");

    const singleQuoted = join(layout.dispatch, "logs", "quoted-semi.jsonl");
    writeEvents(singleQuoted, [codex(`echo 'a;b'`)]);
    expect(stream(layout, "codex", singleQuoted, layout.codex).code).toBe(0);

    const real = join(layout.dispatch, "logs", "real-redirect.jsonl");
    writeEvents(real, [codex(`echo x > ${join(layout.repo, "r.txt")}`)]);
    const finding = stream(layout, "codex", real, layout.codex);
    expect(finding.code).toBe(2);
    expect(finding.out).toContain("finding write");
  });

  test("R1 bare cd and cd $HOME move the workdir, and an unknown variable fails closed", () => {
    const layout = makeLayout();
    const bare = join(layout.dispatch, "logs", "bare-cd.jsonl");
    writeEvents(bare, [codex(`cd && echo x > leaked.txt`)]);
    const bareResult = stream(layout, "codex", bare, layout.codex);
    expect(bareResult.code).toBe(2);
    expect(bareResult.out).toContain(`finding write ${join(layout.home, "leaked.txt")}`);

    const home = join(layout.dispatch, "logs", "cd-home.jsonl");
    writeEvents(home, [codex(`cd $HOME && echo x > leaked3.txt`)]);
    const homeResult = stream(layout, "codex", home, layout.codex);
    expect(homeResult.code).toBe(2);
    expect(homeResult.out).toContain(`finding write ${join(layout.home, "leaked3.txt")}`);

    const tilde = join(layout.dispatch, "logs", "cd-tilde.jsonl");
    writeEvents(tilde, [codex(`cd ~ && echo x > leaked2.txt`)]);
    expect(stream(layout, "codex", tilde, layout.codex).code).toBe(2);

    const unknown = join(layout.dispatch, "logs", "cd-unknown.jsonl");
    writeEvents(unknown, [codex(`cd $NOPE_VAR_X && echo x > rel.txt`)]);
    const closed = stream(layout, "codex", unknown, layout.codex);
    expect(closed.code).toBe(0);
    expect(closed.out).toContain("expected write");
  });

  test("R1 a path inside a substitution counts for an outer write command", () => {
    const layout = makeLayout();
    const target = join(layout.home, "del.txt");
    const subst = join(layout.dispatch, "logs", "subst.jsonl");
    writeEvents(subst, [codex(`rm -rf $(echo ${target})`)]);
    const result = stream(layout, "codex", subst, layout.codex);
    expect(result.code).toBe(2);
    expect(result.out).toContain(`finding write ${target} (elsewhere)`);

    const plain = join(layout.dispatch, "logs", "subst-plain.jsonl");
    writeEvents(plain, [codex(`echo $(echo hi)`)]);
    expect(stream(layout, "codex", plain, layout.codex).code).toBe(0);
  });

  test("R1 a refusal demotes only the path it names, and two bare writes fail closed", () => {
    const layout = makeLayout();
    const evil = join(layout.home, "evil.txt");
    const locked = join(layout.home, "locked.txt");
    const mixed = join(layout.dispatch, "logs", "mixed-refusal.jsonl");
    writeEvents(mixed, [
      codex(`echo pwned > ${evil}; cat ${locked}`, `cat: ${locked}: Permission denied`, 1),
    ]);
    const result = stream(layout, "codex", mixed, layout.codex);
    expect(result.code).toBe(2);
    expect(result.out).toContain(`finding write ${evil} (elsewhere)`);
    expect(result.out).toContain(`note refused ${locked} (elsewhere)`);

    const single = join(layout.dispatch, "logs", "single-refusal.jsonl");
    writeEvents(single, [codex(`cat ${locked}`, "Permission denied", 1)]);
    const named = stream(layout, "codex", single, layout.codex);
    expect(named.code).toBe(3);
    expect(named.out).toContain("note refused");

    const bare = join(layout.dispatch, "logs", "bare-multi-refusal.jsonl");
    const first = join(layout.home, "first.txt");
    const second = join(layout.home, "second.txt");
    writeEvents(bare, [codex(`echo x > ${first}; echo y > ${second}`, "Permission denied", 1)]);
    const closed = stream(layout, "codex", bare, layout.codex);
    expect(closed.code).toBe(2);
    expect(closed.out).toContain(`finding write ${first} (elsewhere)`);
    expect(closed.out).toContain(`finding write ${second} (elsewhere)`);

    const exemptSibling = join(layout.dispatch, "logs", "exempt-sibling-refusal.jsonl");
    writeEvents(exemptSibling, [
      codex(`echo pwned > ${evil}; cat /etc/shadow`, "cat: /etc/shadow: Permission denied", 1),
    ]);
    const sibling = stream(layout, "codex", exemptSibling, layout.codex);
    expect(sibling.code).toBe(2);
    expect(sibling.out).toContain(`finding write ${evil} (elsewhere)`);
  });

  test("R1 a denied read inside the folder stays expected, outside it is refused", () => {
    const layout = makeLayout();
    writeFileSync(join(layout.codex, "in.txt"), "x\n");
    const inside = join(layout.dispatch, "logs", "inside-denied.jsonl");
    writeEvents(inside, [codex(`cat ${join(layout.codex, "in.txt")}`, "permission denied", 1)]);
    const clean = stream(layout, "codex", inside, layout.codex);
    expect(clean.code).toBe(0);
    expect(clean.out).toContain("expected");

    const outside = join(layout.dispatch, "logs", "outside-denied.jsonl");
    writeEvents(outside, [codex(`cat ${join(layout.home, "o.txt")}`, "permission denied", 1)]);
    const refused = stream(layout, "codex", outside, layout.codex);
    expect(refused.code).toBe(3);
    expect(refused.out).toContain("note refused");
  });

  test("R1 git -c values are skipped, in both directions", () => {
    const layout = makeLayout();
    const hidden = join(layout.dispatch, "logs", "git-c-hidden.jsonl");
    writeEvents(hidden, [codex(`git -c x=y -C ${layout.repo} commit`)]);
    const write = stream(layout, "codex", hidden, layout.codex);
    expect(write.code).toBe(2);
    expect(write.out).toContain(`finding write ${layout.repo} (main checkout)`);

    const misjudged = join(layout.dispatch, "logs", "git-c-read.jsonl");
    writeEvents(misjudged, [codex(`git -C ${layout.repo} -c core.pager=cat log`)]);
    const read = stream(layout, "codex", misjudged, layout.codex);
    expect(read.code).toBe(3);
    expect(read.out).toContain("note read");
    expect(read.out).not.toContain("finding");

    const own = join(layout.dispatch, "logs", "git-c-own.jsonl");
    writeEvents(own, [codex(`git -c x=y status`)]);
    expect(stream(layout, "codex", own, layout.codex).code).toBe(0);
  });

  test("R1 creating a branch or tag is a ref write, and listing stays a read", () => {
    const layout = makeLayout();
    const branch = join(layout.dispatch, "logs", "git-branch.jsonl");
    writeEvents(branch, [codex(`git branch sneaky`)]);
    const created = stream(layout, "codex", branch, layout.codex);
    expect(created.code).toBe(2);
    expect(created.out).toContain("finding write refs/heads/sneaky");

    const tag = join(layout.dispatch, "logs", "git-tag.jsonl");
    writeEvents(tag, [codex(`git tag v9`)]);
    const tagged = stream(layout, "codex", tag, layout.codex);
    expect(tagged.code).toBe(2);
    expect(tagged.out).toContain("finding write refs/tags/v9");

    const forced = join(layout.dispatch, "logs", "git-branch-f.jsonl");
    writeEvents(forced, [codex(`git branch -f moved main`)]);
    const moved = stream(layout, "codex", forced, layout.codex);
    expect(moved.code).toBe(2);
    expect(moved.out).toContain("finding write refs/heads/moved");

    const deleted = join(layout.dispatch, "logs", "git-tag-d.jsonl");
    writeEvents(deleted, [codex(`git tag -d v1`)]);
    const gone = stream(layout, "codex", deleted, layout.codex);
    expect(gone.code).toBe(2);
    expect(gone.out).toContain("finding write refs/tags/v1");

    const bare = join(layout.dispatch, "logs", "git-branch-bare.jsonl");
    writeEvents(bare, [codex(`git branch`)]);
    expect(stream(layout, "codex", bare, layout.codex).code).toBe(0);

    const list = join(layout.dispatch, "logs", "git-branch-list.jsonl");
    writeEvents(list, [codex(`git branch -a`)]);
    expect(stream(layout, "codex", list, layout.codex).code).toBe(0);
  });

  test("R1 git path operands and redirects are judged, and a push is clean", () => {
    const layout = makeLayout();
    const wt = join(layout.dispatch, "logs", "git-worktree.jsonl");
    writeEvents(wt, [codex(`git worktree add ${join(layout.home, "wt-evil")}`)]);
    const added = stream(layout, "codex", wt, layout.codex);
    expect(added.code).toBe(2);
    expect(added.out).toContain(`finding write ${join(layout.home, "wt-evil")} (elsewhere)`);

    const branched = join(layout.dispatch, "logs", "git-worktree-b.jsonl");
    writeEvents(branched, [codex(`git worktree add -b nbr ${join(layout.home, "w")}`)]);
    const made = stream(layout, "codex", branched, layout.codex);
    expect(made.code).toBe(2);
    expect(made.out).toContain("finding write refs/heads/nbr");

    const clone = join(layout.dispatch, "logs", "git-clone.jsonl");
    writeEvents(clone, [codex(`git clone . ${join(layout.home, "clone-evil")}`)]);
    const cloned = stream(layout, "codex", clone, layout.codex);
    expect(cloned.code).toBe(2);
    expect(cloned.out).toContain(`finding write ${join(layout.home, "clone-evil")} (elsewhere)`);

    const redirect = join(layout.dispatch, "logs", "git-redirect.jsonl");
    writeEvents(redirect, [codex(`git show HEAD:README.md > ${join(layout.home, "g.txt")}`)]);
    const shown = stream(layout, "codex", redirect, layout.codex);
    expect(shown.code).toBe(2);
    expect(shown.out).toContain(`finding write ${join(layout.home, "g.txt")} (elsewhere)`);

    const push = join(layout.dispatch, "logs", "git-push.jsonl");
    writeEvents(push, [codex(`git push origin x:y`)]);
    expect(stream(layout, "codex", push, layout.codex).code).toBe(0);
  });

  test("R1 a ref named by a git read is not a finding, and update-ref still is", () => {
    const layout = makeLayout();
    const logged = join(layout.dispatch, "logs", "git-log-ref.jsonl");
    writeEvents(logged, [codex(`git log refs/heads/main`)]);
    const read = stream(layout, "codex", logged, layout.codex);
    expect(read.code).toBe(0);
    expect(read.out).toContain("clean");

    const moved = join(layout.dispatch, "logs", "git-update-ref.jsonl");
    writeEvents(moved, [codex(`git update-ref refs/heads/side ${layout.base}`)]);
    const written = stream(layout, "codex", moved, layout.codex);
    expect(written.code).toBe(2);
    expect(written.out).toContain("finding write refs/heads/side");
  });

  test("R1 reads outside the home and project are routine, writes are not", () => {
    const layout = makeLayout();
    const readPath = join(layout.dispatch, "logs", "outside-read.jsonl");
    writeEvents(readPath, [codex(`cat /var/tmp/r1-outside.txt`)]);
    const read = stream(layout, "codex", readPath, layout.codex);
    expect(read.code).toBe(0);
    expect(read.out).toContain("clean");

    const writePath = join(layout.dispatch, "logs", "outside-write.jsonl");
    writeEvents(writePath, [codex(`echo x > /var/tmp/r1-outside.txt`)]);
    const written = stream(layout, "codex", writePath, layout.codex);
    expect(written.code).toBe(2);
    expect(written.out).toContain("finding write /var/tmp/r1-outside.txt (elsewhere)");
  });

  test("R1 tool-checkout and lane-brief reads are routine, other dispatch reads are not", () => {
    const layout = makeLayout();
    const tool = join(layout.home, "tool");
    mkdirSync(join(tool, "scripts"), { recursive: true });
    writeFileSync(join(tool, "scripts", "x.ts"), "x\n");
    const runJson = JSON.parse(readFileSync(join(layout.dispatch, "run.json"), "utf8"));
    runJson.postmaster.checkout = tool;
    writeFileSync(join(layout.dispatch, "run.json"), JSON.stringify(runJson));
    const toolPath = join(layout.dispatch, "logs", "tool-read.jsonl");
    writeEvents(toolPath, [codex(`cat ${join(tool, "scripts", "x.ts")}`)]);
    const toolRead = stream(layout, "codex", toolPath, layout.codex);
    expect(toolRead.code).toBe(0);
    expect(toolRead.out).toContain("clean");

    const briefPath = join(layout.dispatch, "logs", "brief-read.jsonl");
    writeEvents(briefPath, [codex(`cat ${join(layout.dispatch, "brief.md")}`)]);
    const briefRead = stream(layout, "codex", briefPath, layout.codex);
    expect(briefRead.code).toBe(0);
    expect(briefRead.out).toContain("clean");

    const otherPath = join(layout.dispatch, "logs", "dispatch-read.jsonl");
    writeEvents(otherPath, [codex(`cat ${join(layout.dispatch, "run.json")}`)]);
    const other = stream(layout, "codex", otherPath, layout.codex);
    expect(other.code).toBe(3);
    expect(other.out).toContain("note read");
  });

  test("R1 a hyphenated lane restores its own worktree", () => {
    const layout = makeLayout();
    const lane = "my-lane";
    const wt = join(layout.repo, ".worktrees", `T-${lane}`);
    git(layout.repo, "worktree", "add", "-q", "-b", `wb/T-${lane}`, wt, "main");
    const runJson = JSON.parse(readFileSync(join(layout.dispatch, "run.json"), "utf8"));
    runJson.config.lanes[lane] = { harness: "codex" };
    writeFileSync(join(layout.dispatch, "run.json"), JSON.stringify(runJson));
    const manifest = JSON.parse(readFileSync(join(layout.dispatch, "manifest.json"), "utf8"));
    manifest.lanes[lane] = {};
    writeFileSync(join(layout.dispatch, "manifest.json"), JSON.stringify(manifest));
    before(layout);
    addCommit(layout.repo, wt, "lane-work.txt");
    expect(call(layout, ["restore", layout.dispatch, "r1"]).code).toBe(0);
    expect(git(layout.repo, "rev-parse", `refs/heads/wb/T-${lane}`)).toBe(layout.base);
    expect(git(layout.repo, "-C", wt, "status", "--porcelain")).toBe("");
  });

  test("R1 an ownerless tracked change voids every reviewer, and a merge voids only its lane", () => {
    const layout = makeLayout();
    writeReviewer(layout, "codex", [codex(`git -C ${layout.synth} gc`)]);
    before(layout);
    writeFileSync(join(layout.synth, "README.md"), "changed by nobody's record\n");
    const result = check(layout, "r1");
    expect(
      actionLines(layout)
        .filter((line) => line.action === "degrade")
        .map((line) => line.target)
        .sort(),
    ).toEqual(["codex", "mimo"]);
    expect(result.out).toContain("unexplained");

    const owned = makeLayout();
    before(owned);
    const commit = addCommit(owned.repo, owned.reviewers.mimo, "reviewed.txt");
    git(owned.repo, "-C", owned.synth, "merge", "--ff-only", commit);
    writeReviewer(owned, "mimo", [
      mimo("bash", { command: `git -C ${owned.synth} merge --ff-only ${commit}` }),
    ]);
    check(owned, "r1");
    expect(
      actionLines(owned)
        .filter((line) => line.action === "degrade")
        .map((line) => line.target),
    ).toEqual(["mimo"]);
  });

  test("R1 a round-change finding names the synthesis worktree, never inside", () => {
    const layout = makeLayout();
    before(layout);
    const commit = addCommit(layout.repo, layout.reviewers.mimo, "reviewed.txt");
    git(layout.repo, "-C", layout.synth, "merge", "--ff-only", commit);
    writeReviewer(layout, "mimo", [
      mimo("bash", { command: `git -C ${layout.synth} merge --ff-only ${commit}` }),
    ]);
    // The coachman runs the check from the synthesis worktree; the label must
    // not depend on the working directory.
    const cwd = process.cwd();
    process.chdir(layout.synth);
    try {
      const result = check(layout, "r1");
      expect(result.out).toContain("(synthesis worktree)");
      expect(result.out).not.toContain("(inside)");
    } finally {
      process.chdir(cwd);
    }
  });

  test("R1 restore leaves uncommitted work on unmoved branches alone", () => {
    const layout = makeLayout();
    before(layout);
    writeFileSync(join(layout.codex, "precious.txt"), "uncommitted work\n");
    git(layout.repo, "-C", layout.codex, "add", "precious.txt");
    writeFileSync(join(layout.codex, "README.md"), "uncommitted edit\n");
    expect(call(layout, ["restore", layout.dispatch, "r1"]).code).toBe(0);
    expect(readFileSync(join(layout.codex, "precious.txt"), "utf8")).toBe("uncommitted work\n");
    expect(readFileSync(join(layout.codex, "README.md"), "utf8")).toBe("uncommitted edit\n");
    const status = git(layout.repo, "-C", layout.codex, "status", "--porcelain");
    expect(status).toContain("precious.txt");
    expect(status).toContain("README.md");
  });

  test("R1 restore of a moved branch saves its uncommitted edit, and a clean move saves none", () => {
    const layout = makeLayout();
    before(layout);
    addCommit(layout.repo, layout.codex, "lane-work.txt");
    writeFileSync(join(layout.codex, "README.md"), "uncommitted edit\n");
    expect(call(layout, ["restore", layout.dispatch, "r1"]).code).toBe(0);
    expect(git(layout.repo, "rev-parse", "refs/heads/wb/T-codex")).toBe(layout.base);
    const saved = join(
      layout.dispatch,
      "reach",
      "r1",
      "branches",
      "refs_heads_wb_T-codex.worktree.patch",
    );
    expect(readFileSync(saved, "utf8")).toContain("uncommitted edit");

    const clean = makeLayout();
    before(clean);
    addCommit(clean.repo, clean.codex, "lane-work.txt");
    expect(call(clean, ["restore", clean.dispatch, "r1"]).code).toBe(0);
    expect(
      existsSync(
        join(clean.dispatch, "reach", "r1", "branches", "refs_heads_wb_T-codex.worktree.patch"),
      ),
    ).toBe(false);
  });

  test("R1 restore faults when the synthesis worktree cannot be verified", () => {
    const layout = makeLayout();
    before(layout);
    addCommit(layout.repo, layout.synth, "synth-work.txt");
    const ticket = git(layout.repo, "rev-parse", "refs/heads/T");
    expect(ticket).not.toBe(layout.base);
    rmSync(join(layout.synth, ".git"), { force: true });
    expect(call(layout, ["restore", layout.dispatch, "r1"]).code).toBe(1);
    expect(git(layout.repo, "rev-parse", "refs/heads/main")).toBe(layout.base);

    // A detached or switched worktree no longer faults: the ruled round
    // reattaches the recorded branch instead (see the R4 reattach test).
    const replaced = makeLayout();
    before(replaced);
    rmSync(join(replaced.synth, ".git"), { force: true });
    writeFileSync(join(replaced.synth, ".git"), "not a repository\n");
    expect(call(replaced, ["restore", replaced.dispatch, "r1"]).code).toBe(1);
  });

  test("R1 a second restore keeps the first saved copy", () => {
    const layout = makeLayout();
    before(layout);
    const commit = addCommit(layout.repo, layout.reviewers.mimo, "reviewed.txt");
    git(layout.repo, "-C", layout.synth, "merge", "--ff-only", commit);
    expect(call(layout, ["restore", layout.dispatch, "r1"]).code).toBe(0);
    const patch = join(layout.dispatch, "reach", "r1", "synthesis.patch");
    expect(readFileSync(patch, "utf8").length).toBeGreaterThan(0);
    expect(call(layout, ["restore", layout.dispatch, "r1"]).code).toBe(0);
    expect(readFileSync(patch, "utf8").length).toBeGreaterThan(0);
    expect(existsSync(join(layout.dispatch, "reach", "r1-2", "synthesis.patch"))).toBe(true);
  });

  test("R1 repo and tool come from their own brief sections, or the whole brief", () => {
    const layout = makeLayout();
    writeFileSync(
      join(layout.dispatch, "brief.md"),
      `# Waybill: T\nturnpikes: bug\n\n## Ticket\n\nA ticket quoting the template:\nrepo: /nowhere/at/all\ntool: /evil/tool\n\n## Project profile\nrepo: ${layout.repo} default branch: main BASE: ${layout.base}\n\n## Dispatch\ntool: ${TOOL}\n`,
    );
    expect(check(layout, "workhorses").code).toBe(0);

    const toolRead = join(layout.dispatch, "logs", "tool-read.jsonl");
    writeEvents(toolRead, [codex(`cat ${join(TOOL, "scripts", "launch.ts")}`)]);
    expect(stream(layout, "codex", toolRead, layout.codex).code).toBe(0);

    const old = makeLayout();
    writeFileSync(join(old.dispatch, "brief.md"), `repo: ${old.repo}\n`);
    expect(check(old, "workhorses").code).toBe(0);
  });

  test("R1 the card escapes hostile filenames", () => {
    const layout = makeLayout();
    check(layout, "workhorses");
    before(layout);
    check(layout, "r1");
    writeFileSync(join(layout.repo, "weird<!--x.txt"), "x\n");
    writeFileSync(join(layout.repo, "back`tick.txt"), "x\n");
    writeFileSync(join(layout.repo, "new\nline.txt"), "x\n");
    check(layout, "card");
    writeFileSync(
      join(layout.dispatch, "checks.json"),
      JSON.stringify({
        checks: [{ name: "gate", source: "default:gate", command: "true", shows: "gate" }],
      }),
    );
    const sha = git(layout.synth, "rev-parse", "HEAD").slice(0, 12);
    writeAction(layout, "coachman", "verify", "gate", `on=${sha}@${sha} result=pass exit=0 secs=1`);
    const checkpoint = join(layout.dispatch, "checkpoint.md");
    writeFileSync(checkpoint, "## Findings (bug)\n\nnone\n");
    const card = run("bash", [LANDING, "card-block", layout.dispatch, layout.synth, checkpoint]);
    expect(card.code).toBe(0);
    expect(card.out).toContain("weird&lt;!--x.txt");
    expect(card.out).toContain("back'tick.txt");
    expect(card.out).toContain("new\\nline.txt");
    expect(card.out).not.toContain("<!--");
    expect(card.out).not.toContain("`tick");
  });

  test("R2 quoted substitutions expand, single-quoted ones do not", () => {
    const layout = makeLayout();
    const target = join(layout.home, "outside2.txt");
    const quoted = join(layout.dispatch, "logs", "quoted-subst.jsonl");
    writeEvents(quoted, [codex(`echo "$(touch ${target})"`)]);
    const result = stream(layout, "codex", quoted, layout.codex);
    expect(result.code).toBe(2);
    expect(result.out).toContain(`finding write ${target} (elsewhere)`);

    // Single quotes cannot survive the codex -lc wrapper, so this half speaks mimo.
    const singleLayout = makeLayout();
    const singleTarget = join(singleLayout.home, "outside2.txt");
    const single = join(singleLayout.dispatch, "logs", "single-subst.jsonl");
    writeEvents(single, [mimo("bash", { command: `echo '$(touch ${singleTarget})'` })]);
    expect(stream(singleLayout, "mimo", single, singleLayout.mimo).code).toBe(0);

    const plain = join(layout.dispatch, "logs", "quoted-plain.jsonl");
    writeEvents(plain, [codex(`echo "$(echo hi)"`)]);
    expect(stream(layout, "codex", plain, layout.codex).code).toBe(0);
  });

  test("R2 append-both redirects are writes, and 1> already is", () => {
    const layout = makeLayout();
    for (const [name, op] of [
      ["err-append", "&>>"],
      ["fd-append", "2>>"],
      ["noclobber", ">|"],
    ]) {
      const target = join(layout.home, `${name}.txt`);
      const path = join(layout.dispatch, "logs", `${name}.jsonl`);
      writeEvents(path, [codex(`echo x ${op}${target}`)]);
      const result = stream(layout, "codex", path, layout.codex);
      expect(result.code).toBe(2);
      expect(result.out).toContain(`finding write ${target} (elsewhere)`);
    }

    const one = join(layout.dispatch, "logs", "fd-one.jsonl");
    writeEvents(one, [codex(`echo x 1>${join(layout.home, "o1.txt")}`)]);
    expect(stream(layout, "codex", one, layout.codex).code).toBe(2);
  });

  test("R2 git reads and restores ignore inherited directory overrides", () => {
    const layout = makeLayout();
    const other = join(layout.root, "other");
    git(layout.repo, "init", "--bare", "-q", `${other}.git`);
    mkdirSync(other, { recursive: true });
    const polluted = { HOME: layout.home, GIT_DIR: `${other}.git`, GIT_WORK_TREE: other };
    writeReviewer(layout, "codex", [codex(`touch ${layout.reviewers.codex}/probe.txt`)]);
    writeReviewer(layout, "mimo", [mimo("bash", { command: "true" })]);
    const runPolluted = (args: string[]): { code: number; out: string } => {
      const result = run("bun", ["--no-env-file", "--config=/dev/null", SCRIPT, ...args], {
        env: polluted,
      });
      return { code: result.code, out: `${result.out}${result.err}` };
    };
    expect(runPolluted(["before", layout.dispatch, "1"]).code).toBe(0);
    expect(runPolluted(["check", layout.dispatch, "r1"]).code).toBe(0);

    const moved = makeLayout();
    const another = join(moved.root, "other");
    git(moved.repo, "init", "--bare", "-q", `${another}.git`);
    mkdirSync(another, { recursive: true });
    before(moved);
    addCommit(moved.repo, moved.synth, "synth-work.txt");
    const restorePolluted = run(
      "bun",
      ["--no-env-file", "--config=/dev/null", SCRIPT, "restore", moved.dispatch, "r1"],
      { env: { HOME: moved.home, GIT_DIR: `${another}.git`, GIT_WORK_TREE: another } },
    );
    expect(restorePolluted.code).toBe(0);
    expect(git(moved.repo, "rev-parse", "refs/heads/T")).toBe(moved.base);
  });

  test("R2 check-target reach ignores inherited directory overrides", () => {
    const layout = makeLayout();
    const other = join(layout.root, "other");
    git(layout.repo, "init", "--bare", "-q", `${other}.git`);
    mkdirSync(other, { recursive: true });
    const polluted = run(
      "bun",
      ["--no-env-file", "--config=/dev/null", CHECK_TARGET, "reach", layout.repo, "main"],
      {
        env: { GIT_DIR: `${other}.git`, GIT_WORK_TREE: other },
      },
    );
    expect(polluted.code).toBe(0);
    expect(polluted.out).toContain(`root ${layout.repo}`);
  });

  test("R2 a rider owns only what its move produced, and a lone merge still voids one", () => {
    const layout = makeLayout();
    before(layout);
    const commit = addCommit(layout.repo, layout.reviewers.mimo, "reviewed.txt");
    git(layout.repo, "-C", layout.synth, "merge", "--ff-only", commit);
    writeReviewer(layout, "mimo", [
      mimo("bash", { command: `git -C ${layout.synth} merge --ff-only ${commit}` }),
    ]);
    writeFileSync(join(layout.synth, "README.md"), "edited by nobody's record\n");
    check(layout, "r1");
    expect(
      actionLines(layout)
        .filter((line) => line.action === "degrade")
        .map((line) => line.target)
        .sort(),
    ).toEqual(["codex", "mimo"]);

    const lone = makeLayout();
    before(lone);
    const single = addCommit(lone.repo, lone.reviewers.mimo, "reviewed.txt");
    git(lone.repo, "-C", lone.synth, "merge", "--ff-only", single);
    writeReviewer(lone, "mimo", [
      mimo("bash", { command: `git -C ${lone.synth} merge --ff-only ${single}` }),
    ]);
    check(lone, "r1");
    expect(
      actionLines(lone)
        .filter((line) => line.action === "degrade")
        .map((line) => line.target),
    ).toEqual(["mimo"]);
  });

  test("R2 an untracked file beside a merge is a note, and a moved side branch claims no files", () => {
    const layout = makeLayout();
    before(layout);
    const commit = addCommit(layout.repo, layout.reviewers.mimo, "reviewed.txt");
    git(layout.repo, "-C", layout.synth, "merge", "--ff-only", commit);
    writeReviewer(layout, "mimo", [
      mimo("bash", { command: `git -C ${layout.synth} merge --ff-only ${commit}` }),
    ]);
    writeFileSync(join(layout.synth, "u.txt"), "new\n");
    const result = check(layout, "r1");
    const stray = result.out.split("\n").filter((line) => line.includes("u.txt"));
    expect(stray.length).toBeGreaterThan(0);
    expect(stray.every((line) => line.startsWith("note"))).toBe(true);

    const side = makeLayout();
    before(side);
    const next = addCommit(side.repo, side.reviewers.mimo, "reviewed.txt");
    git(side.repo, "update-ref", "refs/heads/wb/T-codex", next);
    writeReviewer(side, "mimo", [
      mimo("bash", { command: `git update-ref refs/heads/wb/T-codex` }),
    ]);
    writeFileSync(join(side.synth, "README.md"), "edited by nobody's record\n");
    check(side, "r1");
    expect(
      actionLines(side)
        .filter((line) => line.action === "degrade")
        .map((line) => line.target)
        .sort(),
    ).toEqual(["codex", "mimo"]);
  });

  test("R2 the card escapes the reason as well as the path", () => {
    const layout = makeLayout();
    writeFileSync(join(layout.synth, "weird<!--x.txt"), "v1\n");
    git(layout.repo, "-C", layout.synth, "add", ".");
    git(layout.repo, "-C", layout.synth, "commit", "-qm", "hostile");
    before(layout);
    writeReviewer(layout, "codex", [codex(`touch ${layout.reviewers.codex}/probe.txt`)]);
    writeFileSync(join(layout.synth, "weird<!--x.txt"), "v2 ownerless\n");
    check(layout, "r1");
    check(layout, "card");
    writeFileSync(
      join(layout.dispatch, "checks.json"),
      JSON.stringify({
        checks: [{ name: "gate", source: "default:gate", command: "true", shows: "gate" }],
      }),
    );
    const sha = git(layout.synth, "rev-parse", "HEAD").slice(0, 12);
    writeAction(layout, "coachman", "verify", "gate", `on=${sha}@${sha} result=pass exit=0 secs=1`);
    const checkpoint = join(layout.dispatch, "checkpoint.md");
    writeFileSync(checkpoint, "## Findings (bug)\n\nnone\n");
    const card = run("bash", [LANDING, "card-block", layout.dispatch, layout.synth, checkpoint]);
    expect(card.code).toBe(0);
    expect(card.out).toContain("unexplained");
    expect(card.out).toContain("weird&lt;!--x.txt");
    expect(card.out).not.toContain("<!--");
  });

  test("R1 the card reads project paths relative through a symlinked dispatch", () => {
    const layout = makeLayout();
    writeWorkhorse(layout, "codex", [
      codexFile(join(layout.repo, "out.txt")),
      codexFile(join(layout.home, "other", "x")),
    ]);
    mkdirSync(join(layout.home, "other"), { recursive: true });
    check(layout, "workhorses");
    check(layout, "card");
    writeFileSync(
      join(layout.dispatch, "checks.json"),
      JSON.stringify({
        checks: [{ name: "gate", source: "default:gate", command: "true", shows: "gate" }],
      }),
    );
    const sha = git(layout.synth, "rev-parse", "HEAD").slice(0, 12);
    writeAction(layout, "coachman", "verify", "gate", `on=${sha}@${sha} result=pass exit=0 secs=1`);
    const checkpoint = join(layout.dispatch, "checkpoint.md");
    writeFileSync(checkpoint, "## Findings (bug)\n\nnone\n");
    const link = join(tmpdir(), `reach-link-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    symlinkSync(layout.root, link);
    CREATED.push(link);
    const viaLink = join(link, "repo", ".postmaster", "runs", "T");
    const card = run("bash", [LANDING, "card-block", viaLink, layout.synth, checkpoint]);
    expect(card.code).toBe(0);
    expect(card.out).toContain("`out.txt`");
    expect(card.out).toContain("outside the project");
  });
});

describe("R4: ruled round fixes", () => {
  test("R4 descriptor redirections are descriptor operations, and 2>file is a write", () => {
    const layout = makeLayout();
    for (const [name, cmd] of [
      ["dup-out", `cd ${layout.repo} && echo hi 2>&1`],
      ["dup-both", `cd ${layout.repo} && echo hi >&2`],
      ["dup-close", `cd ${layout.home} && echo hi 2>&-`],
      ["dup-in", `cd ${layout.repo} && cat <&0`],
    ]) {
      const path = join(layout.dispatch, "logs", `${name}.jsonl`);
      writeEvents(path, [codex(cmd)]);
      const result = stream(layout, "codex", path, layout.codex);
      expect(result.code).toBe(0);
      expect(result.out).toContain("clean");
    }

    const file = join(layout.dispatch, "logs", "fd-file.jsonl");
    writeEvents(file, [codex(`cd ${layout.repo} && echo hi 2>${join(layout.repo, "real.txt")}`)]);
    const written = stream(layout, "codex", file, layout.codex);
    expect(written.code).toBe(2);
    expect(written.out).toContain("finding write");
  });

  test("R4 restore reattaches the recorded branch, keeping an earlier commit", () => {
    const layout = makeLayout();
    const kept = addCommit(layout.repo, layout.synth, "kept.txt");
    before(layout);
    git(layout.repo, "-C", layout.synth, "checkout", "-q", "--detach", "HEAD");
    expect(call(layout, ["restore", layout.dispatch, "r1"]).code).toBe(0);
    expect(git(layout.repo, "rev-parse", "refs/heads/T")).toBe(kept);
    expect(git(layout.repo, "-C", layout.synth, "symbolic-ref", "--short", "HEAD")).toBe("T");
    expect(readFileSync(join(layout.synth, "kept.txt"), "utf8")).toBe("review change\n");

    const moved = makeLayout();
    before(moved);
    addCommit(moved.repo, moved.synth, "round-work.txt");
    git(moved.repo, "-C", moved.synth, "checkout", "-q", "--detach", "HEAD");
    expect(call(moved, ["restore", moved.dispatch, "r1"]).code).toBe(0);
    expect(git(moved.repo, "rev-parse", "refs/heads/T")).toBe(moved.base);
    expect(git(moved.repo, "-C", moved.synth, "symbolic-ref", "--short", "HEAD")).toBe("T");
    expect(git(moved.repo, "-C", moved.synth, "status", "--porcelain")).toBe("");
  });

  test("R4 an unreadable task transcript leaves the lane not checked", () => {
    const layout = makeLayout();
    const runJson = JSON.parse(readFileSync(join(layout.dispatch, "run.json"), "utf8"));
    runJson.config.lanes.opus = { harness: "claude" };
    writeFileSync(join(layout.dispatch, "run.json"), JSON.stringify(runJson));
    const own = join(layout.repo, ".worktrees", "T-opus");
    git(layout.repo, "worktree", "add", "-q", "-b", "wb/T-opus", own, "main");
    const streamPath = join(layout.dispatch, "logs", "opus-events.jsonl");
    writeEvents(streamPath, [
      {
        type: "assistant",
        message: {
          content: [{ type: "tool_use", id: "aaa", name: "Task", input: { prompt: "y" } }],
        },
      },
      {
        type: "user",
        message: { content: [{ type: "tool_result", tool_use_id: "aaa", content: "done" }] },
      },
    ]);
    writeFileSync(join(layout.dispatch, "logs", "opus-claude-task-aaa.jsonl"), "{not valid json\n");
    const broken = stream(layout, "opus", streamPath, own);
    expect(broken.code).toBe(3);
    expect(broken.out).toContain("not checked");

    const fixed = makeLayout();
    const fixedJson = JSON.parse(readFileSync(join(fixed.dispatch, "run.json"), "utf8"));
    fixedJson.config.lanes.opus = { harness: "claude" };
    writeFileSync(join(fixed.dispatch, "run.json"), JSON.stringify(fixedJson));
    const fixedOwn = join(fixed.repo, ".worktrees", "T-opus");
    git(fixed.repo, "worktree", "add", "-q", "-b", "wb/T-opus", fixedOwn, "main");
    const fixedStream = join(fixed.dispatch, "logs", "opus-events.jsonl");
    writeEvents(fixedStream, [
      {
        type: "assistant",
        message: {
          content: [{ type: "tool_use", id: "aaa", name: "Task", input: { prompt: "y" } }],
        },
      },
      {
        type: "user",
        message: { content: [{ type: "tool_result", tool_use_id: "aaa", content: "done" }] },
      },
    ]);
    writeEvents(
      join(fixed.dispatch, "logs", "opus-claude-task-aaa.jsonl"),
      claude("Write", { file_path: join(fixed.repo, "forked.txt") }),
    );
    const read = stream(fixed, "opus", fixedStream, fixedOwn);
    expect(read.code).toBe(2);
    expect(read.out).toContain("finding write");
  });
});
