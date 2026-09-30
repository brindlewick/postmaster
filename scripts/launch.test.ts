// Tests beside scripts/launch.ts, moved from its --self-test on #109: 150 controls.
// The sequence runs once in beforeAll with recording check/ok/fail; one test per recorded label.
// Its local ok/fail forwarders are dropped, so helpers record through the shims directly.
// The python3 branches use the top-level cond; their in-sequence skip logs are replaced by it.
// self/here resolve beside this file; the launcher env deletions are restored in afterAll.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  accessSync,
  chmodSync,
  closeSync,
  existsSync,
  constants as fsConstants,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { harnessData, makeHeldDir } from "./launch.ts";
import { toolRoot } from "./lib/paths.ts";
import { run, withTempDir } from "./lib/proc.ts";
import { BOUND_R, DOT_ALL, PY_M_START, PY_S_CLASS, pySplitLines, pyWords } from "./lib/text.ts";

const self = join(import.meta.dir, "launch.sh");
const here = import.meta.dir;

const skipPython = run("sh", ["-c", "command -v python3"]).code !== 0;
if (skipPython) {
  console.log(
    "skip parity: and handed-environment comparisons (16) and the resume PWD/OLDPWD/SHLVL match: python3 not on PATH",
  );
}

interface ControlRecord {
  label: string;
  ok: boolean;
  detail: string;
}

const records: ControlRecord[] = [];

const check = (label: string, cond: boolean, detail?: string): void => {
  records.push({ label, ok: cond, detail: detail ?? "" });
};

const ok = (label: string): void => {
  records.push({ label, ok: true, detail: "" });
};

const fail = (label: string, detail?: string): void => {
  records.push({ label, ok: false, detail: detail ?? "" });
};

const assertControl = (label: string): void => {
  const r = records.find((x) => x.label === label);
  expect(r).toBeDefined();
  if (r !== undefined && !r.ok) throw new Error(r.detail === "" ? r.label : r.detail);
  expect(r?.ok).toBe(true);
};

const savedEnv: Record<string, string | undefined> = {
  POSTMASTER_LAUNCH_NAME: process.env.POSTMASTER_LAUNCH_NAME,
  POSTMASTER_LAUNCH_ROLE: process.env.POSTMASTER_LAUNCH_ROLE,
};

// bun:test's types omit the hook timeout, though the runtime honors it.

beforeAll(() => {
  withTempDir((tmp) => {
    delete process.env.POSTMASTER_LAUNCH_NAME;
    delete process.env.POSTMASTER_LAUNCH_ROLE;
    let out = "";
    let err = "";
    let rc = 0;
    let envx: Record<string, string> = {};

    // Stub harnesses first on PATH.
    mkdirSync(join(tmp, "bin"), { recursive: true });
    mkdirSync(join(tmp, "wt"), { recursive: true });
    for (const h of ["claude", "pi", "codex"]) {
      writeFileSync(join(tmp, "bin", h), '#!/bin/sh\necho "$@ probe=${PROBE:-}"\n');
      chmodSync(join(tmp, "bin", h), 0o755);
    }
    writeFileSync(
      join(tmp, "bin/mimo"),
      `#!/bin/sh\n[ "$1" = export ] && { [ -e "$XDG_DATA_HOME/$2" ] && exit 0; echo "Session not found: $2" >&2; exit 1; }\nprintf "%s probe=%s stdin=%s import-off=%s data=%s\\n" "$*" "\${PROBE:-}" "$(cat)" "\${MIMOCODE_DISABLE_CLAUDE_IMPORT:-}" "\${XDG_DATA_HOME:-}"\n`,
    );
    chmodSync(join(tmp, "bin/mimo"), 0o755);
    writeFileSync(
      join(tmp, "bin/muse"),
      `#!/bin/sh\n[ "$1" = export ] && { [ -e "$XDG_DATA_HOME/$3" ] && : > "$5" && exit 0; echo "no retained session log found for session $3" >&2; exit 1; }\nprintf "%s probe=%s stdin=%s data=%s\\n" "$*" "\${PROBE:-}" "$(cat)" "\${XDG_DATA_HOME:-}"\n`,
    );
    chmodSync(join(tmp, "bin/muse"), 0o755);
    writeFileSync(join(tmp, "prompt.txt"), "Continue.\n");

    const fixture = (name: string, ...keys: string[]): void => {
      let body = `[lanes.one]\nharness = "claude"\nmodel = "lane-model"\n\n[team]\n`;
      body += `coachman = { harness = "claude", model = "coach-model" }\n`;
      body += `coachman_fallback = { harness = "claude", model = "fallback-model" }\n\n[team.coachman_legs]\n`;
      for (const k of keys) body += `${k} = { harness = "claude", model = "${k}-model" }\n`;
      writeFileSync(join(tmp, `${name}.toml`), body);
    };
    const rawfix = (name: string, teamBody: string): void => {
      fixture(name);
      writeFileSync(join(tmp, `${name}.toml`), teamBody, { flag: "a" });
    };

    // Codex forms
    writeFileSync(join(tmp, "bin/codex"), '#!/bin/sh\nprintf "%s\\n" "$PWD" "$@"\n');
    chmodSync(join(tmp, "bin/codex"), 0o755);
    const codexfix = (name: string, laneKeys: string): void => {
      let body = `[lanes.one]\nharness = "codex"\n${laneKeys}\n\n[team]\n`;
      body += `coachman = { harness = "codex", model = "coach-model" }\n\n[team.coachman_legs]\n`;
      body += `review = { harness = "codex", model = "review-model", effort = "medium" }\n`;
      writeFileSync(join(tmp, `${name}.toml`), body);
    };
    codexfix("codex", 'model = "lane-model"\neffort = "high"');
    codexfix("codex-noeffort", 'model = "lane-model"');
    codexfix("codex-nomodel", 'effort = "high"');
    codexfix("review-codex", 'model = "lane-model"\neffort = "low"');
    writeFileSync(join(tmp, "ruling.txt"), "- Keep going, then stop.\n");
    writeFileSync(join(tmp, "brief.txt"), "Keep going, then stop.\n");
    run("git", ["init", "-q", "-b", "main", join(tmp, "cx")]);
    run("git", [
      "-C",
      join(tmp, "cx"),
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@example.invalid",
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "init",
    ]);
    run("git", [
      "-C",
      join(tmp, "cx"),
      "worktree",
      "add",
      "-q",
      "--detach",
      join(tmp, "cx-detached"),
    ]);

    const lines = (...args: string[]): string => args.join("\n");
    // bash's $(...) strips trailing newlines; comparisons are made on that form.
    const bashOut = (s: string): string => s.replace(/\n+$/u, "");

    const doRun = (...args: string[]): void => {
      const f = args[0] ?? "";
      const rest = args.slice(1);
      const env: Record<string, string | undefined> = {
        ...process.env,
        ...envx,
        POSTMASTER_CONFIG: join(tmp, `${f}.toml`),
        PATH: `${join(tmp, "bin")}:${process.env.PATH ?? ""}`,
      };
      const r = spawnSync(self, rest, { encoding: "utf8", env });
      out = r.stdout ?? "";
      err = r.stderr ?? "";
      rc = r.status ?? 1;
    };

    const runsAs = (label: string, f: string, want: string, ...args: string[]): void => {
      doRun(f, ...args);
      if (rc === 0 && bashOut(out) === bashOut(want)) ok(label);
      else fail(label);
    };
    const runsOn = (label: string, f: string, m: string, ...args: string[]): void => {
      doRun(f, ...args);
      if (rc === 0 && out.includes(`--model ${m} `)) ok(label);
      else fail(label);
    };
    const refused = (label: string, f: string, want: string, ...args: string[]): void => {
      doRun(f, ...args);
      if (rc === 1 && out === "" && err.includes(want)) ok(label);
      else fail(label);
    };
    const carries = (label: string, f: string, want: string, ...args: string[]): void => {
      doRun(f, ...args);
      if (rc === 0 && out.includes(want)) ok(label);
      else fail(label);
    };
    const lacks = (label: string, f: string, bad: string, ...args: string[]): void => {
      doRun(f, ...args);
      if (rc === 0 && !out.includes(bad)) ok(label);
      else fail(label);
    };
    const printed = (label: string, ...texts: string[]): void => {
      for (const t of texts) {
        if (!out.includes(t)) {
          fail(label);
          return;
        }
      }
      if (rc === 0) ok(label);
      else fail(label);
    };

    const runDir = (runName: string): string => join(tmp, "repo", ".postmaster", "runs", runName);
    const record = (runName: string, f: string): void => {
      mkdirSync(runDir(runName), { recursive: true });
      const r = spawnSync(join(here, "run-meta.sh"), [runDir(runName), join(tmp, "repo")], {
        encoding: "utf8",
        env: {
          ...process.env,
          POSTMASTER_CONFIG: join(tmp, `${f}.toml`),
          POSTMASTER_TOOL_PINS: join(tmp, "tools"),
          PATH: `${join(tmp, "bin")}:${process.env.PATH ?? ""}`,
        },
      });
      if (r.status !== 0) {
        fail(`run-meta.sh records ${f} as run ${runName}`);
      }
    };

    const CONT_RE = new RegExp(`\\\\\\n[${PY_S_CLASS}]*`, "gu");
    const FENCE_SPLIT_RE = new RegExp(
      `(${PY_M_START}[ \t]*\`\`\`${DOT_ALL}*?${PY_M_START}[ \t]*\`\`\`)`,
      "u",
    );
    // calls(): scan runbooks for launch/resume invocations.
    const calls = (...paths: string[]): { code: number; out: string } => {
      const results: string[] = [];
      const CALL = new RegExp(
        `scripts/launch\\.sh[${PY_S_CLASS}]+(?:launch|resume)${BOUND_R}`,
        "gu",
      );
      for (const path of paths) {
        const text = readFileSync(path, "utf8");
        // Split into fenced blocks and prose.
        const parts = text.split(FENCE_SPLIT_RE);
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i] ?? "";
          if (i % 2) {
            // fenced block
            const joined = part.replace(CONT_RE, " ");
            for (const line of pySplitLines(joined)) {
              let m: RegExpExecArray | null;
              CALL.lastIndex = 0;
              while ((m = CALL.exec(line)) !== null) {
                const c = line.slice(m.index);
                results.push(
                  `${c.includes("--run <dispatch>") ? "run" : "unrun"} ${path}: ${pyWords(c).join(" ")}`,
                );
              }
            }
          } else {
            // prose: inline code spans
            for (const span of part.match(/`([^`]+)`/gu) ?? []) {
              const inner = span.slice(1, -1);
              let m: RegExpExecArray | null;
              CALL.lastIndex = 0;
              while ((m = CALL.exec(inner)) !== null) {
                const c = inner.slice(m.index);
                results.push(
                  `${c.includes("--run <dispatch>") ? "run" : "unrun"} ${path}: ${pyWords(c).join(" ")}`,
                );
              }
            }
          }
        }
      }
      return { code: 0, out: results.join("\n") + (results.length ? "\n" : "") };
    };

    // Fixture configs
    fixture("legs", "synthesis", "review", "ship");
    fixture("none");
    for (const k of ["style", "bug", "security"]) fixture(`old-${k}`, "review", k);
    fixture("typo", "revue");
    rawfix("onlane", 'review = { harness = "claude", model = "lane-model" }\n');
    rawfix("notable", 'review = "claude"\n');
    rawfix(
      "dup",
      'review = { harness = "claude", model = "a" }\nreview = { harness = "claude", model = "b" }\n',
    );
    rawfix("suffix", 'review = { harness = "claude", model = "lane-model[1m]" }\n');
    rawfix("suffixes", 'review = { harness = "claude", model = "lane-model[1m][2m]" }\n');
    mkdirSync(join(tmp, "elsewhere"), { recursive: true });
    writeFileSync(join(tmp, "rel.env"), "PROBE=config-dir\n");
    writeFileSync(join(tmp, "wt/rel.env"), "PROBE=worktree\n");
    writeFileSync(join(tmp, "empty.txt"), "");
    writeFileSync(join(tmp, "unreadable.txt"), "x\n");
    try {
      chmodSync(join(tmp, "unreadable.txt"), 0o000);
    } catch {
      /* ignore */
    }
    rawfix("emptyleg", "synthesis = {}\n");
    const head = '[lanes.one]\nharness = "claude"\nmodel = "lane-model"\n\n[team]\n';
    writeFileSync(
      join(tmp, "coachlane.toml"),
      `${head}coachman = { harness = "claude", model = "lane-model" }\n`,
    );
    writeFileSync(
      join(tmp, "fblane.toml"),
      head +
        'coachman = { harness = "claude", model = "coach-model" }\ncoachman_fallback = { harness = "claude", model = "lane-model" }\n',
    );
    writeFileSync(
      join(tmp, "bare.toml"),
      '[lanes.one]\nharness = "claude"\n\n[team]\ncoachman = { harness = "claude" }\n',
    );
    writeFileSync(join(tmp, "over.env"), "MODEL=lane-model\nHARNESS=nope\nPROBE=reached\n");
    writeFileSync(
      join(tmp, "envfile.toml"),
      head +
        `coachman = { harness = "claude", model = "coach-model", env_file = "${join(tmp, "over.env")}" }\n`,
    );
    writeFileSync(
      join(tmp, "relenv.toml"),
      `${head}coachman = { harness = "claude", model = "coach-model", env_file = "rel.env" }\n`,
    );
    rawfix("edited", 'review = { harness = "claude", model = "edited-model" }\n');
    writeFileSync(join(tmp, "then.env"), "PROBE=then\n");
    writeFileSync(join(tmp, "now.env"), "PROBE=now\n");
    writeFileSync(
      join(tmp, "then.toml"),
      `[lanes.one]\nharness = "claude"\nmodel = "then-model"\neffort = "high"\nenv_file = "${join(tmp, "then.env")}"\n`,
    );
    writeFileSync(
      join(tmp, "now.toml"),
      `[lanes.one]\nharness = "pi"\nmodel = "now-model"\neffort = "low"\nenv_file = "${join(tmp, "now.env")}"\n`,
    );

    // The runbook fixture
    writeFileSync(
      join(tmp, "runbook.md"),
      [
        "Fenced, with no --run:",
        "",
        "```sh",
        "( scripts/launch.sh launch a <wt> <prompt-file> \\",
        "    > <dispatch>/logs/a-events.jsonl ) &",
        "```",
        "",
        "Fenced and indented, with it:",
        "",
        "   ```sh",
        "   ( scripts/launch.sh launch b <wt> <prompt-file> \\",
        "       --run <dispatch> > <dispatch>/logs/b-events.jsonl ) &",
        "   ```",
        "",
        "Inline, with no --run: `scripts/launch.sh resume c <wt> <thread-id> <prompt-file>`. Inline and",
        "across a line break, with it: `<tool>/scripts/launch.sh resume d <wt> <thread-id>",
        "<prompt-file> --run <dispatch>`.",
      ].join("\n"),
    );
    {
      // Unicode primitives, BASE launch.sh python: every expectation python3-verified.
      writeFileSync(join(tmp, "uni.md"), "```sh\nscripts/launch.sh\x1flaunch u1 <wt> <p>\n```\n");
      const u1 = calls(join(tmp, "uni.md"));
      check("calls finds an invocation spaced with U+001F", u1.out.includes("u1"), u1.out);
      writeFileSync(join(tmp, "uni2.md"), "```sh\nscripts/launch.sh\rlaunch u2 <wt> <p>\n```\n");
      const u2 = calls(join(tmp, "uni2.md"));
      check("calls misses an invocation broken by CR (splitlines)", !u2.out.includes("u2"), u2.out);
      const contGot = "a\\\n\x1fb".replace(CONT_RE, " ");
      check("continuations join across U+001F", contGot === "a b", JSON.stringify(contGot));
      const fenceGot = "a\r```sh\nscripts/launch.sh launch x\n```\nb".split(FENCE_SPLIT_RE);
      check("fences do not open after CR", fenceGot.length === 1, String(fenceGot.length));
    }
    run("git", ["init", "-q", join(tmp, "repo")]);
    record("run", "legs");
    record("run-then", "then");
    record("run-old-bug", "old-bug");
    record("run-onlane", "onlane");

    // A run launch exports its durable session beside the harness event stream. The harness's
    // stdout is redirected into the stream file for real, as the caller does, so the export
    // inside the launch reads what the harness wrote.
    const streamRun = (
      fixture: string,
      dispatch: string,
      streamFile: string,
      args: string[],
      role = "lane",
    ): { rc: number; err: string } => {
      mkdirSync(dirname(streamFile), { recursive: true });
      const fd = openSync(streamFile, "w");
      const r = spawnSync(self, args, {
        encoding: "utf8",
        stdio: ["inherit", fd, "pipe"],
        env: {
          ...process.env,
          POSTMASTER_LAUNCH_ROLE: role,
          POSTMASTER_EVENT_STREAM: streamFile,
          POSTMASTER_CONFIG: join(tmp, `${fixture}.toml`),
          PATH: `${join(tmp, "bin")}:${process.env.PATH ?? ""}`,
        },
      });
      closeSync(fd);
      return { rc: r.status ?? 1, err: String(r.stderr ?? "") };
    };
    const usageRecord = (dispatch: string, streamFile: string): Record<string, unknown> => {
      const stem = basename(streamFile).endsWith(".jsonl")
        ? basename(streamFile).slice(0, -".jsonl".length)
        : basename(streamFile);
      return JSON.parse(
        readFileSync(join(dispatch, "logs", `${stem}-usage.json`), "utf8"),
      ) as Record<string, unknown>;
    };
    const agyStub = (body: string): void => {
      writeFileSync(join(tmp, "bin/agy"), body, "utf8");
      chmodSync(join(tmp, "bin/agy"), 0o755);
    };
    writeFileSync(join(tmp, "agy-run.toml"), '[lanes.g]\nharness = "agy"\nmodel = "agy-model"\n');
    agyStub('#!/bin/sh\nprintf \'{"conversationId":"thread-agy"}\\n\'\n');
    record("run-agy", "agy-run");
    {
      const dispatch = runDir("run-agy");
      const events = join(dispatch, "logs", "g-events.jsonl");
      const r = streamRun("agy-run", dispatch, events, [
        "launch",
        "g",
        join(tmp, "wt"),
        join(tmp, "prompt.txt"),
        "--run",
        dispatch,
      ]);
      const kept = join(dispatch, "sessions", "g", "thread-agy.events.jsonl");
      let same = false;
      try {
        same = readFileSync(events, "utf8") === readFileSync(kept, "utf8");
      } catch {
        same = false;
      }
      if (
        r.rc === 0 &&
        readFileSync(events, "utf8") === '{"conversationId":"thread-agy"}\n' &&
        same
      )
        ok("a run launch exports its durable session beside the harness event stream");
      else fail("a run launch exports its durable session beside the harness event stream");
      try {
        const rec = usageRecord(dispatch, events);
        if (
          rec.role === "workhorse" &&
          rec.lane === "g" &&
          rec.harness === "agy" &&
          !("input_tokens" in rec) &&
          !("output_tokens" in rec) &&
          !("cost_usd" in rec)
        )
          ok("a run launch records its explicit role and lane without inventing figures");
        else fail("a run launch records its explicit role and lane without inventing figures");
      } catch {
        fail("a run launch records its explicit role and lane without inventing figures");
      }
    }
    {
      writeFileSync(
        join(tmp, "agy-roles.toml"),
        '[lanes.g]\nharness = "agy"\nmodel = "agy-model"\n\n[team]\ncoachman = { harness = "agy", model = "coach-model" }\ncoachman_fallback = { harness = "agy", model = "fallback-model" }\n',
      );
      record("run-agy-roles", "agy-roles");
      const dispatch = runDir("run-agy-roles");
      const checkRole = (
        label: string,
        streamFile: string,
        args: string[],
        role: string,
        wantRole: string,
        wantLane: string,
      ): void => {
        const r = streamRun("agy-roles", dispatch, streamFile, args, role);
        let good = r.rc === 0;
        try {
          const rec = usageRecord(dispatch, streamFile);
          good = good && rec.role === wantRole && rec.lane === wantLane;
        } catch {
          good = false;
        }
        if (good) ok(label);
        else fail(label);
      };
      checkRole(
        "a reviewer launch records its reviewer lane",
        join(dispatch, "logs", "reviewer-events.jsonl"),
        ["launch", "g", join(tmp, "wt"), join(tmp, "prompt.txt"), "--run", dispatch],
        "reviewer",
        "reviewer",
        "g",
      );
      checkRole(
        "a coachman launch records its leg",
        join(dispatch, "logs", "coachman-events.jsonl"),
        [
          "launch",
          "coachman",
          join(tmp, "wt"),
          join(tmp, "prompt.txt"),
          "--leg",
          "synthesis",
          "--run",
          dispatch,
        ],
        "coachman",
        "coachman",
        "synthesis",
      );
      checkRole(
        "a fallback coachman launch records its leg",
        join(dispatch, "logs", "fallback-events.jsonl"),
        [
          "launch",
          "coachman_fallback",
          join(tmp, "wt"),
          join(tmp, "prompt.txt"),
          "--leg",
          "ship",
          "--run",
          dispatch,
        ],
        "coachman",
        "coachman",
        "ship",
      );
    }
    {
      const dispatch = runDir("run-agy");
      const sessionsBefore = readdirSync(join(dispatch, "sessions", "g")).length;
      agyStub("#!/bin/sh\nexit 0\n");
      const events = join(dispatch, "logs", "g-empty.jsonl");
      const r = streamRun("agy-run", dispatch, events, [
        "launch",
        "g",
        join(tmp, "wt"),
        join(tmp, "prompt.txt"),
        "--run",
        dispatch,
      ]);
      if (
        r.rc === 0 &&
        readFileSync(events, "utf8") === "" &&
        r.err.includes("its session was not exported") &&
        readdirSync(join(dispatch, "sessions", "g")).length === sessionsBefore
      )
        ok("an empty event stream is a loud missed export, not a silent skip");
      else fail("an empty event stream is a loud missed export, not a silent skip");
    }
    {
      const dispatch = runDir("run-agy");
      agyStub("#!/bin/sh\nprintf '{\"nope\":1}\\n'\nexit 0\n");
      const events = join(dispatch, "logs", "g-events.jsonl");
      const r = streamRun("agy-run", dispatch, events, [
        "launch",
        "g",
        join(tmp, "wt"),
        join(tmp, "prompt.txt"),
        "--run",
        dispatch,
      ]);
      if (r.rc === 0 && r.err.includes("its session was not exported"))
        ok("a failed export still exits with the harness's status");
      else fail("a failed export still exits with the harness's status");
    }
    {
      const dispatch = runDir("run-agy");
      agyStub('#!/bin/sh\nprintf \'{"conversationId":"thread-rc"}\\n\'\nexit 3\n');
      const events = join(dispatch, "logs", "g-rc.jsonl");
      const r = streamRun("agy-run", dispatch, events, [
        "launch",
        "g",
        join(tmp, "wt"),
        join(tmp, "prompt.txt"),
        "--run",
        dispatch,
      ]);
      const kept = join(dispatch, "sessions", "g", "thread-rc.events.jsonl");
      let same = false;
      try {
        same = readFileSync(events, "utf8") === readFileSync(kept, "utf8");
      } catch {
        same = false;
      }
      if (r.rc === 3 && same) ok("a harness failure keeps its exit when the export succeeds");
      else fail("a harness failure keeps its exit when the export succeeds");
    }
    {
      writeFileSync(
        join(tmp, "agy-env.toml"),
        `[lanes.g]\nharness = "agy"\nmodel = "agy-model"\nenv_file = "${join(tmp, "poison.env")}"\n`,
      );
      record("run-agy-env", "agy-env");
      const dispatch = runDir("run-agy-env");
      mkdirSync(join(dispatch, "logs"), { recursive: true });
      writeFileSync(join(dispatch, "logs", "g-decoy.jsonl"), '{"conversationId":"thread-decoy"}\n');
      writeFileSync(
        join(tmp, "poison.env"),
        `POSTMASTER_EVENT_STREAM="${join(dispatch, "logs", "g-decoy.jsonl")}"\nPOSTMASTER_LAUNCH_ROLE=reviewer\n`,
      );
      agyStub('#!/bin/sh\nprintf \'{"conversationId":"thread-real"}\\n\'\nexit 0\n');
      const events = join(dispatch, "logs", "g-real.jsonl");
      const r = streamRun("agy-env", dispatch, events, [
        "launch",
        "g",
        join(tmp, "wt"),
        join(tmp, "prompt.txt"),
        "--run",
        dispatch,
      ]);
      const kept = join(dispatch, "sessions", "g", "thread-real.events.jsonl");
      const decoy = join(dispatch, "sessions", "g", "thread-decoy.events.jsonl");
      let same = false;
      try {
        same = readFileSync(events, "utf8") === readFileSync(kept, "utf8");
      } catch {
        same = false;
      }
      if (r.rc === 0 && same && !existsSync(decoy))
        ok("a lane env file cannot redirect the session export");
      else fail("a lane env file cannot redirect the session export");
      try {
        if (usageRecord(dispatch, events).role === "workhorse")
          ok("a lane env file cannot change the recorded role");
        else fail("a lane env file cannot change the recorded role");
      } catch {
        fail("a lane env file cannot change the recorded role");
      }
    }
    mkdirSync(join(tmp, "no-record"), { recursive: true });
    mkdirSync(join(tmp, "garbled"), { recursive: true });
    mkdirSync(join(tmp, "unrecorded"), { recursive: true });
    writeFileSync(join(tmp, "garbled/run.json"), '{"config": \n');
    writeFileSync(join(tmp, "unrecorded/run.json"), '{"run": "T-1"}\n');

    const CODEX_BYPASS = "--dangerously-bypass-approvals-and-sandbox";
    const CODEX_HIGH = 'model_reasoning_effort="high"';

    console.log("positive controls");
    for (const k of ["synthesis", "review", "ship"]) {
      runsOn(
        `--leg ${k} runs on its own [team.coachman_legs] entry`,
        "legs",
        `${k}-model`,
        "form",
        "coachman",
        "--leg",
        k,
      );
    }
    runsOn(
      "a leg with no entry runs on team.coachman",
      "none",
      "coach-model",
      "form",
      "coachman",
      "--leg",
      "review",
    );
    runsOn("a lane runs on its own model", "legs", "lane-model", "form", "one");
    runsOn(
      "a lane launches on a config the coachman refuses",
      "old-bug",
      "lane-model",
      "form",
      "one",
    );
    runsOn(
      "a launch with --leg synthesis runs on the synthesis entry",
      "legs",
      "synthesis-model",
      "launch",
      "coachman",
      join(tmp, "wt"),
      join(tmp, "prompt.txt"),
      "--leg",
      "synthesis",
    );
    runsOn(
      "a resume with --leg review runs on the review entry",
      "legs",
      "review-model",
      "resume",
      "coachman",
      join(tmp, "wt"),
      "T-1",
      join(tmp, "prompt.txt"),
      "--leg",
      "review",
    );
    runsAs(
      "a codex resume runs in its worktree on its lane's model and effort, streams JSON, writes -o, and passes a prompt that starts with -",
      "codex",
      lines(
        join(tmp, "wt"),
        "exec",
        "resume",
        "T-1",
        "--json",
        "-o",
        join(tmp, "last.md"),
        "-m",
        "lane-model",
        `-c`,
        CODEX_HIGH,
        CODEX_BYPASS,
        "--",
        "- Keep going, then stop.",
      ),
      "resume",
      "one",
      join(tmp, "wt"),
      "T-1",
      join(tmp, "ruling.txt"),
      "--last",
      join(tmp, "last.md"),
    );
    runsAs(
      "a codex coachman resumes with --leg review on the review entry's model and effort",
      "codex",
      lines(
        join(tmp, "wt"),
        "exec",
        "resume",
        "T-1",
        "--json",
        "-m",
        "review-model",
        "-c",
        'model_reasoning_effort="medium"',
        CODEX_BYPASS,
        "--",
        "- Keep going, then stop.",
      ),
      "resume",
      "coachman",
      join(tmp, "wt"),
      "T-1",
      join(tmp, "ruling.txt"),
      "--leg",
      "review",
    );
    envx = { HOME: join(tmp, "home") };
    runsAs(
      "a codex launch on a branch runs with -C and --json, and no --skip-git-repo-check",
      "codex",
      lines(
        join(tmp, "cx"),
        "exec",
        "-C",
        join(tmp, "cx"),
        "--json",
        "-m",
        "lane-model",
        `-c`,
        CODEX_HIGH,
        CODEX_BYPASS,
        "Keep going, then stop.",
      ),
      "launch",
      "one",
      join(tmp, "cx"),
      join(tmp, "brief.txt"),
    );
    runsAs(
      "a codex launch in a detached worktree adds --skip-git-repo-check",
      "codex",
      lines(
        join(tmp, "cx-detached"),
        "exec",
        "-C",
        join(tmp, "cx-detached"),
        "--json",
        "-m",
        "lane-model",
        `-c`,
        CODEX_HIGH,
        CODEX_BYPASS,
        "--skip-git-repo-check",
        "Keep going, then stop.",
      ),
      "launch",
      "one",
      join(tmp, "cx-detached"),
      join(tmp, "brief.txt"),
    );
    envx = {};
    runsAs(
      "form shows the codex launch and resume",
      "codex",
      lines(
        `launch: cd <cwd> && codex exec -C <cwd> --json -m lane-model -c model_reasoning_effort=\\"high\\" ${CODEX_BYPASS} $(cat <prompt-file>) `,
        `resume: cd <cwd> && codex exec resume <thread-id> --json -m lane-model -c model_reasoning_effort=\\"high\\" ${CODEX_BYPASS} -- $(cat <prompt-file>) `,
      ),
      "form",
      "one",
    );
    runsOn(
      "the fallback resumes on its own model, with no --leg",
      "legs",
      "fallback-model",
      "resume",
      "coachman_fallback",
      join(tmp, "wt"),
      "T-1",
      join(tmp, "prompt.txt"),
    );
    runsOn("form with no --leg shows team.coachman", "legs", "coach-model", "form", "coachman");
    carries(
      "a lane's env file reaches the harness's environment",
      "envfile",
      "probe=reached",
      "launch",
      "coachman",
      join(tmp, "wt"),
      join(tmp, "prompt.txt"),
      "--leg",
      "review",
    );
    runsOn(
      "inside a run, a resume runs on the model the run recorded, not the live config's",
      "edited",
      "review-model",
      "resume",
      "coachman",
      join(tmp, "wt"),
      "T-1",
      join(tmp, "prompt.txt"),
      "--leg",
      "review",
      "--run",
      runDir("run"),
    );
    runsOn(
      "outside a run, the same resume runs on the live config's model",
      "edited",
      "edited-model",
      "resume",
      "coachman",
      join(tmp, "wt"),
      "T-1",
      join(tmp, "prompt.txt"),
      "--leg",
      "review",
    );
    doRun(
      "now",
      "resume",
      "one",
      join(tmp, "wt"),
      "T-1",
      join(tmp, "prompt.txt"),
      "--run",
      runDir("run-then"),
    );
    printed(
      "inside a run, a lane resumes on the harness, model, effort and env file the run recorded",
      "--resume T-1 ",
      "--model then-model ",
      "--effort high ",
      "probe=then",
    );
    doRun("now", "resume", "one", join(tmp, "wt"), "T-1", join(tmp, "prompt.txt"));
    printed(
      "outside a run, the same resume takes all four from the live config",
      "--mode json ",
      "--session T-1 ",
      "--model now-model ",
      "--thinking low ",
      "probe=now",
    );
    runsOn(
      "inside a run the live config is not read: with none at all, a launch runs on the recorded model",
      "nowhere",
      "synthesis-model",
      "launch",
      "coachman",
      join(tmp, "wt"),
      join(tmp, "prompt.txt"),
      "--leg",
      "synthesis",
      "--run",
      runDir("run"),
    );
    {
      const c = calls(join(tmp, "runbook.md"));
      out = c.out;
      rc = c.code;
      err = "";
      const got = `${out
        .replace(/\n+$/u, "")
        .split("\n")
        .map((l) => l.replace(/^([a-z]+) .*launch\.sh (launch|resume) ([a-z]) .*/u, "$1 $3"))
        .join(",")},`;
      if (got === "unrun a,run b,unrun c,run d,") {
        ok("a runbook launch or resume with no --run is found, fenced or inline");
      } else {
        fail("a runbook launch or resume with no --run is found, fenced or inline", got);
      }
    }

    // A child dead by a signal reports 128 plus its number through run(),
    // as a shell reports it; our own timeout kill still reads 128.
    {
      const term = run("bash", ["-c", "kill -TERM $$"]);
      check("a SIGTERM child reports 143", term.code === 143, `got ${term.code}`);
      const kil = run("bash", ["-c", "kill -KILL $$"]);
      check("a SIGKILL child reports 137", kil.code === 137, `got ${kil.code}`);
      const intr = run("bash", ["-c", "kill -INT $$"]);
      check("a SIGINT child reports 130", intr.code === 130, `got ${intr.code}`);
      const three = run("bash", ["-c", "exit 3"]);
      check("a plain exit still reports its code", three.code === 3, `got ${three.code}`);
      const slow = run("bash", ["-c", "sleep 5"], { timeout: 200 });
      check("a timeout still reads 128", slow.code === 128, `got ${slow.code}`);
    }

    // A harness dead by a signal dies as one, as under BASE's exec: the
    // launch process itself is killed by the signal, not exited.
    {
      const claude = join(tmp, "bin", "claude");
      const saved = readFileSync(claude, "utf8");
      writeFileSync(claude, "#!/bin/sh\nkill -TERM $$\n");
      const r = spawnSync(self, ["launch", "one", join(tmp, "wt"), join(tmp, "prompt.txt")], {
        encoding: "utf8",
        env: {
          ...process.env,
          POSTMASTER_CONFIG: join(tmp, "legs.toml"),
          PATH: `${join(tmp, "bin")}:${process.env.PATH ?? ""}`,
        },
      });
      writeFileSync(claude, saved);
      check(
        "a SIGTERM harness kills the launch by SIGTERM",
        r.signal === "SIGTERM",
        `signal ${r.signal}, status ${r.status}`,
      );
    }

    console.log("negative controls");
    for (const k of ["style", "bug", "security"]) {
      refused(
        `a config naming ${k} is refused, and the message names review`,
        `old-${k}`,
        "one leg now, review",
        "form",
        "coachman",
        "--leg",
        "review",
      );
    }
    refused(
      "a key that is no leg is refused",
      "typo",
      "no such leg: revue",
      "form",
      "coachman",
      "--leg",
      "review",
    );
    refused(
      "a leg entry on a lane's model is refused",
      "onlane",
      "a lane's model",
      "form",
      "coachman",
      "--leg",
      "synthesis",
    );
    refused(
      "a leg entry that is not a table is refused",
      "notable",
      "is not a table",
      "form",
      "coachman",
      "--leg",
      "synthesis",
    );
    envx = { HARNESS: "claude", MODEL: "env-model" };
    refused(
      "a config that does not parse is refused, and the environment's HARNESS and MODEL go unused",
      "dup",
      "cannot read",
      "launch",
      "one",
      join(tmp, "wt"),
      join(tmp, "prompt.txt"),
    );
    envx = {};
    refused(
      "a parse error names the file and where it breaks",
      "dup",
      `launch: cannot read ${join(tmp, "dup.toml")}: `,
      "form",
      "coachman",
      "--leg",
      "review",
    );
    refused(
      "a leg entry on a lane's model with a bracketed suffix is refused",
      "suffix",
      "a lane's model",
      "form",
      "coachman",
      "--leg",
      "synthesis",
    );
    refused(
      "team.coachman on a lane's model is refused",
      "coachlane",
      "a lane's model",
      "form",
      "coachman",
      "--leg",
      "synthesis",
    );
    refused(
      "the fallback on a lane's model is refused",
      "fblane",
      "a lane's model",
      "form",
      "coachman_fallback",
    );
    refused(
      "a leg entry with no harness or model is refused",
      "emptyleg",
      "needs a harness and a model",
      "form",
      "coachman",
      "--leg",
      "synthesis",
    );
    refused(
      "a coachman with no model is refused by name",
      "bare",
      "coachman has no model",
      "form",
      "coachman",
      "--leg",
      "review",
    );
    runsOn(
      "an env file cannot put the coachman on another model",
      "envfile",
      "coach-model",
      "launch",
      "coachman",
      join(tmp, "wt"),
      join(tmp, "prompt.txt"),
      "--leg",
      "review",
    );
    envx = { STDIN_FILE: join(tmp, "prompt.txt") };
    lacks("a STDIN_FILE from the environment is not used", "legs", "< ", "form", "one");
    refused(
      "a leg entry on a lane's model with stacked suffixes is refused",
      "suffixes",
      "a lane's model",
      "form",
      "coachman",
      "--leg",
      "synthesis",
    );
    envx = {};
    {
      const origCwd = process.cwd();
      process.chdir(join(tmp, "elsewhere"));
      carries(
        "a relative env file is read from the config's directory, never the worktree",
        "relenv",
        "probe=config-dir",
        "launch",
        "coachman",
        join(tmp, "wt"),
        join(tmp, "prompt.txt"),
        "--leg",
        "review",
      );
      process.chdir(origCwd);
    }
    writeFileSync(join(tmp, "shell.env"), 'FIRST=one\nexport PROBE="v-$FIRST/x" # trailing\n');
    writeFileSync(
      join(tmp, "shellenv.toml"),
      `${head}coachman = { harness = "claude", model = "coach-model", env_file = "${join(tmp, "shell.env")}" }\n`,
    );
    carries(
      "an env file is shell: export, quotes, comments and expansion reach the harness",
      "shellenv",
      "probe=v-one/x",
      "launch",
      "coachman",
      join(tmp, "wt"),
      join(tmp, "prompt.txt"),
      "--leg",
      "review",
    );
    // An env file launch hands the launcher's level — one above the
    // inherited SHLVL, as a fresh bash reports — unless the file sets it.
    {
      const claude = join(tmp, "bin", "claude");
      const saved = readFileSync(claude, "utf8");
      writeFileSync(claude, '#!/bin/sh\nprintf "%s\\n" "shlvl=${SHLVL-<unset>}"\n');
      envx = { SHLVL: "7" };
      carries(
        "an env file launch hands the launcher's level",
        "shellenv",
        "shlvl=8",
        "launch",
        "coachman",
        join(tmp, "wt"),
        join(tmp, "prompt.txt"),
        "--leg",
        "review",
      );
      writeFileSync(join(tmp, "shlvl.env"), "SHLVL=9\n");
      writeFileSync(
        join(tmp, "shlvlset.toml"),
        `${head}coachman = { harness = "claude", model = "coach-model", env_file = "${join(tmp, "shlvl.env")}" }\n`,
      );
      // A file that sets SHLVL=9 hands the harness 9 verbatim — one above the
      // launcher's 8, where a naive bump-then-compare would collide — as main's
      // child spawn does.
      carries(
        "an env file that sets SHLVL hands it on verbatim, as main does",
        "shlvlset",
        "shlvl=9",
        "launch",
        "coachman",
        join(tmp, "wt"),
        join(tmp, "prompt.txt"),
        "--leg",
        "review",
      );
      envx = {};
      writeFileSync(claude, saved);
    }
    // A file that exits aborts the launch with its status, without launching.
    writeFileSync(join(tmp, "dumpexit.env"), "FOO=fromfile\nexit 3\n");
    writeFileSync(
      join(tmp, "dumpexit.toml"),
      `${head}coachman = { harness = "claude", model = "coach-model", env_file = "${join(tmp, "dumpexit.env")}" }\n`,
    );
    doRun(
      "dumpexit",
      "launch",
      "coachman",
      join(tmp, "wt"),
      join(tmp, "prompt.txt"),
      "--leg",
      "review",
    );
    check(
      "an env file that exits aborts the launch with its status",
      rc === 3 && out === "",
      `rc ${rc} out ${JSON.stringify(out)}`,
    );
    writeFileSync(join(tmp, "dumpsete.env"), "FOO=fromfile\nset -e\nfalse\n");
    writeFileSync(
      join(tmp, "dumpsete.toml"),
      `${head}coachman = { harness = "claude", model = "coach-model", env_file = "${join(tmp, "dumpsete.env")}" }\n`,
    );
    doRun(
      "dumpsete",
      "launch",
      "coachman",
      join(tmp, "wt"),
      join(tmp, "prompt.txt"),
      "--leg",
      "review",
    );
    check(
      "an env file that fails under set -e aborts with its status",
      rc === 1 && out === "",
      `rc ${rc} out ${JSON.stringify(out)}`,
    );
    writeFileSync(join(tmp, "dumpexec.env"), "exec /bin/false\n");
    writeFileSync(
      join(tmp, "dumpexec.toml"),
      `${head}coachman = { harness = "claude", model = "coach-model", env_file = "${join(tmp, "dumpexec.env")}" }\n`,
    );
    doRun(
      "dumpexec",
      "launch",
      "coachman",
      join(tmp, "wt"),
      join(tmp, "prompt.txt"),
      "--leg",
      "review",
    );
    check(
      "an env file that execs never launches",
      rc === 1 && out === "",
      `rc ${rc} out ${JSON.stringify(out)}`,
    );
    // Env-file parity: the port and BASE run the same file, and the harness's
    // received environment, the exit status and both launch streams agree.
    // BASE is the newest scripts/launch.sh in history that is a real script
    // rather than the port's one-line wrapper; it must still carry the
    // source-and-exec tail, or the extraction failed loudly and every parity
    // control with it.
    let baseLaunch = "";
    let hasPy3 = false;
    {
      const log = run("git", [
        "-C",
        toolRoot(import.meta),
        "log",
        "--format=%H",
        "--",
        "scripts/launch.sh",
      ]);
      for (const c of log.out
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)) {
        const show = run("git", ["-C", toolRoot(import.meta), "show", `${c}:scripts/launch.sh`]);
        if (
          show.code === 0 &&
          show.out.split("\n").length > 10 &&
          show.out.includes('exec "${cmd[@]}"')
        ) {
          baseLaunch = join(tmp, "base-launch.sh");
          writeFileSync(baseLaunch, show.out);
          chmodSync(baseLaunch, 0o755);
          break;
        }
      }
      hasPy3 = !skipPython;
      check(
        "BASE launch.sh extracts with its source-and-exec tail",
        baseLaunch !== "",
        `base=${baseLaunch || "none"}`,
      );
    }
    if (baseLaunch !== "" && hasPy3) {
      const claude = join(tmp, "bin", "claude");
      const savedClaude = readFileSync(claude, "utf8");
      // The stub reports the handed environment to a file, never stdout: a
      // NUL byte the file prints would glue onto the dump there. Stdout stays
      // pure file output, as BASE leaves it.
      const handedPath = join(tmp, "parity-handed.out");
      writeFileSync(
        claude,
        `#!/bin/sh\necho STUB-RAN >&2\nenv -0 | LC_ALL=C sort -z > "${handedPath}"\n`,
      );
      const savedEnvx = envx;
      envx = { HOME: join(tmp, "home") };
      // `_` is each launcher's own last command and always differs; a shell's
      // `file: line N:` prefix names its own $0. Both normalize away. So does
      // the exec/fork split: BASE execs the harness, which fails `$PWD/<cmd>:`,
      // while the merged main fork-spawns it, which fails `<cmd>:` — the port
      // follows main.
      const normStreams = (s: string): string =>
        s
          .split("\n")
          .map((l) =>
            l.replace(/^[^:]*: line [0-9]+: /u, "").replace(/^\/[^:]+?([^/]+): /u, "$1: "),
          )
          .join("\n");
      const handedEnv = (): string[] => {
        let raw: string;
        try {
          raw = readFileSync(handedPath, "utf8");
        } catch {
          return [];
        }
        // SHLVL is compared nowhere here: BASE execs the harness (its level)
        // while the merged main fork-spawns it (one above), so the two oracles
        // differ by construction. SHLVL follows main, pinned by the resume
        // control against main's launcher.
        return raw
          .split("\0")
          .filter((e) => e.includes("=") && !e.startsWith("_=") && !e.startsWith("SHLVL="))
          .sort();
      };
      const parity = (
        label: string,
        fileBody: string,
        signature: (rc: number, out: string, err: string, handed: string[]) => boolean,
        sigDetail: string,
      ): void => {
        writeFileSync(join(tmp, "parity.env"), fileBody);
        writeFileSync(
          join(tmp, "parity.toml"),
          `${head}coachman = { harness = "claude", model = "coach-model", env_file = "${join(tmp, "parity.env")}" }\n`,
        );
        rmSync(handedPath, { force: true });
        doRun(
          "parity",
          "launch",
          "coachman",
          join(tmp, "wt"),
          join(tmp, "prompt.txt"),
          "--leg",
          "review",
        );
        const pRc = rc;
        const pOut = out;
        const pErr = err;
        const pHanded = handedEnv();
        rmSync(handedPath, { force: true });
        const b = spawnSync(
          "bash",
          [
            baseLaunch,
            "launch",
            "coachman",
            join(tmp, "wt"),
            join(tmp, "prompt.txt"),
            "--leg",
            "review",
          ],
          {
            encoding: "utf8",
            env: {
              ...process.env,
              ...envx,
              POSTMASTER_CONFIG: join(tmp, "parity.toml"),
              PATH: `${join(tmp, "bin")}:${process.env.PATH ?? ""}`,
            },
          },
        );
        const bRc = b.status ?? 1;
        const bOut = String(b.stdout ?? "");
        const bErr = String(b.stderr ?? "");
        const bHanded = handedEnv();
        const agree =
          pRc === bRc &&
          normStreams(pErr) === normStreams(bErr) &&
          JSON.stringify(pHanded) === JSON.stringify(bHanded) &&
          normStreams(pOut) === normStreams(bOut);
        const sig = signature(pRc, pOut, pErr, pHanded) && signature(bRc, bOut, bErr, bHanded);
        const detail = agree
          ? `shape missing on ${sig ? "neither" : "a"} side: ${sigDetail}`
          : `port rc=${pRc} base rc=${bRc}; port handed ${pHanded.length}, base ${bHanded.length}; ` +
            `first port-only: ${JSON.stringify(pHanded.filter((e) => !bHanded.includes(e)).slice(0, 3))} ` +
            `first base-only: ${JSON.stringify(bHanded.filter((e) => !pHanded.includes(e)).slice(0, 3))}`;
        check(`parity: ${label}`, agree && sig, detail);
      };
      const ran = (_rc: number, _out: string, err: string, _h: string[]): boolean =>
        err.includes("STUB-RAN");
      const notRan = (_rc: number, _out: string, err: string, _h: string[]): boolean =>
        !err.includes("STUB-RAN");
      parity(
        "an echo in the file reaches stdout and the full env reaches the harness",
        'echo "FOO=fromecho"\nexport FOO=fromexport\n',
        (rc, out, err, handed) =>
          ran(rc, out, err, handed) &&
          out.includes("FOO=fromecho") &&
          handed.includes("FOO=fromexport") &&
          handed.some((e) => e.startsWith("SHELL=")),
        "FOO=fromecho on stdout, FOO=fromexport + SHELL handed on",
      );
      parity(
        "a printed NUL byte is file output, never a handed variable",
        "printf 'EVIL=injected\\0'\nexport GOOD=yes\n",
        (rc, out, err, handed) =>
          ran(rc, out, err, handed) &&
          out.includes("EVIL=injected") &&
          handed.includes("GOOD=yes") &&
          !handed.some((e) => e.startsWith("EVIL=")),
        "EVIL=injected printed, GOOD=yes handed, no EVIL handed",
      );
      parity(
        "exit 0 in the file exits 0 without launching",
        "export FOO=bar\nexit 0\n",
        (rc, out, err, handed) =>
          rc === 0 &&
          out === "" &&
          err === "" &&
          handed.length === 0 &&
          notRan(rc, out, err, handed),
        "rc 0, silent streams, harness never ran",
      );
      parity(
        "exec /bin/true in the file exits 0 without launching",
        "export FOO=bar\nexec /bin/true\n",
        (rc, out, err, handed) =>
          rc === 0 &&
          out === "" &&
          err === "" &&
          handed.length === 0 &&
          notRan(rc, out, err, handed),
        "rc 0, silent streams, harness never ran",
      );
      parity(
        "file output on stderr reaches the launch's stderr",
        "echo to-stderr >&2\nexport GOOD=yes\n",
        (rc, out, err, handed) =>
          ran(rc, out, err, handed) && err.includes("to-stderr") && handed.includes("GOOD=yes"),
        "to-stderr on stderr, GOOD=yes handed",
      );
      parity(
        "a file that unsets everything hands on the emptied environment",
        'export PARITY_SENTINEL=gone\nfor v in $(compgen -e); do unset "$v"; done\n',
        (rc, out, err, handed) =>
          rc === 127 &&
          notRan(rc, out, err, handed) &&
          normStreams(err).includes("No such file or directory"),
        "rc 127 naming the unfindable harness, harness never ran",
      );
      {
        const lines = ["export PARITY_BIG=yes"];
        for (let i = 0; i < 6000; i++)
          lines.push(`export PAD${String(i).padStart(4, "0")}=${"x".repeat(200)}`);
        parity(
          "a roughly 1.2 MB environment launches whole",
          `${lines.join("\n")}\n`,
          (rc, out, err, handed) =>
            rc === 0 &&
            ran(rc, out, err, handed) &&
            handed.includes("PARITY_BIG=yes") &&
            handed.includes(`PAD5999=${"x".repeat(200)}`),
          "rc 0 with the first and last variables handed on",
        );
      }
      parity(
        "a file that unsets PATH applies instead of ignored",
        "unset PATH\nFOO=afterunset\n",
        (rc, out, err, handed) =>
          rc === 127 &&
          notRan(rc, out, err, handed) &&
          normStreams(err).includes("No such file or directory"),
        "rc 127 naming the unfindable harness",
      );
      parity(
        "a file that empties PATH applies instead of ignored",
        "export PATH=\nFOO=emptyok\n",
        (rc, out, err, handed) =>
          rc === 127 &&
          notRan(rc, out, err, handed) &&
          normStreams(err).includes("No such file or directory"),
        "rc 127 naming the unfindable harness",
      );
      writeFileSync(claude, savedClaude);
      envx = savedEnvx;
      // The handed-on environment is observed through the harness, not the
      // exit: one predicate over the stub's report, shared by a positive case
      // that exports a variable and a negative that unsets everything but PATH.
      const claude2 = join(tmp, "bin", "claude");
      const saved2 = readFileSync(claude2, "utf8");
      writeFileSync(claude2, "#!/bin/sh\nenv -0 | LC_ALL=C sort -z\n");
      const handed = (key: string, val: string): boolean =>
        out.split("\0").includes(`${key}=${val}`);
      writeFileSync(join(tmp, "handedpos.env"), "export HANDED_OK=yes\n");
      writeFileSync(
        join(tmp, "handedpos.toml"),
        `${head}coachman = { harness = "claude", model = "coach-model", env_file = "${join(tmp, "handedpos.env")}" }\n`,
      );
      doRun(
        "handedpos",
        "launch",
        "coachman",
        join(tmp, "wt"),
        join(tmp, "prompt.txt"),
        "--leg",
        "review",
      );
      check(
        "a file that exports a variable hands it to the harness",
        rc === 0 && handed("HANDED_OK", "yes"),
        `rc ${rc} handed=${handed("HANDED_OK", "yes")}`,
      );
      writeFileSync(
        join(tmp, "handedneg.env"),
        'export HANDED_OK=gone\nfor v in $(compgen -e); do [ "$v" = PATH ] || unset "$v"; done\n',
      );
      writeFileSync(
        join(tmp, "handedneg.toml"),
        `${head}coachman = { harness = "claude", model = "coach-model", env_file = "${join(tmp, "handedneg.env")}" }\n`,
      );
      doRun(
        "handedneg",
        "launch",
        "coachman",
        join(tmp, "wt"),
        join(tmp, "prompt.txt"),
        "--leg",
        "review",
      );
      check(
        "a file that unsets everything but PATH hands the harness no trace of it",
        rc === 0 &&
          !handed("HANDED_OK", "gone") &&
          !out.split("\0").some((e) => e.startsWith("HANDED_OK=")),
        `rc ${rc} handed-gone=${handed("HANDED_OK", "gone")}`,
      );
      writeFileSync(claude2, saved2);
      // A harness name holding $(...) is a literal name, never executed: the
      // lookup takes it as argv, as BASE's `command -v` does.
      {
        const marker = join(tmp, "harness-marker");
        writeFileSync(
          join(tmp, "metaharness.toml"),
          `${head}[lanes.meta]\nharness = "zz-nonexistent-$(touch ${marker})"\nmodel = "m"\n`,
        );
        doRun("metaharness", "launch", "meta", join(tmp, "wt"), join(tmp, "prompt.txt"));
        const pRc = rc;
        const pErr = err;
        const pOut = out;
        const pMarked = existsSync(marker);
        rmSync(marker, { force: true });
        const b = spawnSync(
          "bash",
          [baseLaunch, "launch", "meta", join(tmp, "wt"), join(tmp, "prompt.txt")],
          {
            encoding: "utf8",
            env: {
              ...process.env,
              ...envx,
              POSTMASTER_CONFIG: join(tmp, "metaharness.toml"),
              PATH: `${join(tmp, "bin")}:${process.env.PATH ?? ""}`,
            },
          },
        );
        const bRc = b.status ?? 1;
        const bErr = String(b.stderr ?? "");
        check(
          "a harness name holding $(...) is refused as not on PATH on both sides, and runs nothing",
          pRc === 1 &&
            bRc === 1 &&
            pOut === "" &&
            pErr.includes("is not on PATH") &&
            bErr.includes("is not on PATH") &&
            !pMarked &&
            !existsSync(marker),
          `port rc=${pRc} base rc=${bRc} port-marked=${pMarked} base-marked=${existsSync(marker)}`,
        );
      }
      // Without an env file no bash stands between the launcher and the
      // harness, so a shell stub would rewrite PWD before reporting it. A
      // native stub dumps the handed environment; port and BASE agree on all
      // of it, including PWD naming the worktree.
      {
        const codex = join(tmp, "bin", "codex");
        const savedCodex = readFileSync(codex, "utf8");
        writeFileSync(
          codex,
          `#!/usr/bin/env bun\nimport { writeFileSync } from "node:fs";\nconst e = Object.entries(process.env).sort(([a], [b]) => (a < b ? -1 : 1));\nwriteFileSync("${handedPath}", e.map(([k, v]) => k + "=" + v).join("\\0"));\nconsole.log("NATIVE-RAN");\n`,
        );
        writeFileSync(
          join(tmp, "bytes.toml"),
          `${head}[lanes.cx]\nharness = "codex"\nmodel = "m"\n\n[lanes.px]\nharness = "pi"\nmodel = "m"\n`,
        );
        const savedEnvx2 = envx;
        envx = { HOME: join(tmp, "home") };
        const nofileEnv = {
          ...process.env,
          ...envx,
          POSTMASTER_CONFIG: join(tmp, "bytes.toml"),
          PATH: `${join(tmp, "bin")}:${process.env.PATH ?? ""}`,
        };
        rmSync(handedPath, { force: true });
        doRun("bytes", "launch", "cx", join(tmp, "wt"), join(tmp, "prompt.txt"));
        const nPRc = rc;
        const nPOut = out;
        const nPErr = err;
        const nPHanded = handedEnv();
        rmSync(handedPath, { force: true });
        const nb = spawnSync(
          "bash",
          [baseLaunch, "launch", "cx", join(tmp, "wt"), join(tmp, "prompt.txt")],
          {
            encoding: "utf8",
            env: nofileEnv,
          },
        );
        const nBRc = nb.status ?? 1;
        const nBOut = String(nb.stdout ?? "");
        const nBErr = String(nb.stderr ?? "");
        const nBHanded = handedEnv();
        const pwdWant = `PWD=${join(tmp, "wt")}`;
        check(
          "parity: without an env file the harness's full environment matches BASE, PWD naming the worktree",
          nPRc === 0 &&
            nBRc === 0 &&
            nPOut.includes("NATIVE-RAN") &&
            nBOut.includes("NATIVE-RAN") &&
            nPErr === "" &&
            nBErr === "" &&
            JSON.stringify(nPHanded) === JSON.stringify(nBHanded) &&
            nPHanded.includes(pwdWant) &&
            nBHanded.includes(pwdWant),
          `port rc=${nPRc} base rc=${nBRc} port ${nPHanded.length} base ${nBHanded.length}`,
        );
        // Stdin reaches the harness byte for byte, NUL included: no UTF-8 decode.
        const pi = join(tmp, "bin", "pi");
        const savedPi = readFileSync(pi, "utf8");
        writeFileSync(
          pi,
          '#!/usr/bin/env bun\nconst chunks = [];\nfor await (const c of process.stdin) chunks.push(c);\nconsole.log("stdin-hex=" + Buffer.concat(chunks).toString("hex"));\n',
        );
        const stdinBytes = Buffer.concat([
          Buffer.from("Hello ", "utf8"),
          Buffer.from(new Uint8Array([0xff, 0xfe, 0x00])),
          Buffer.from(" world\n", "utf8"),
        ]);
        writeFileSync(join(tmp, "prompt-bytes.bin"), stdinBytes);
        const stdinWant = `stdin-hex=${stdinBytes.toString("hex")}`;
        doRun("bytes", "launch", "px", join(tmp, "wt"), join(tmp, "prompt-bytes.bin"));
        const sPRc = rc;
        const sPOut = out;
        const sb = spawnSync(
          "bash",
          [baseLaunch, "launch", "px", join(tmp, "wt"), join(tmp, "prompt-bytes.bin")],
          { encoding: "utf8", env: nofileEnv },
        );
        const sBRc = sb.status ?? 1;
        const sBOut = String(sb.stdout ?? "");
        check(
          "parity: a prompt holding \\xff\\xfe and NUL reaches stdin byte for byte on both sides",
          sPRc === 0 &&
            sBRc === 0 &&
            sPOut.includes(stdinWant) &&
            sBOut.includes(stdinWant) &&
            sPOut === sBOut,
          `port rc=${sPRc} base rc=${sBRc}\nport ${sPOut}\nbase ${sBOut}`,
        );
        writeFileSync(pi, savedPi);
        // A prompt travelling as argv reaches it byte for byte: /proc/self/cmdline
        // is the witness, since the runtimes decode argv as UTF-8 themselves.
        writeFileSync(
          codex,
          '#!/usr/bin/env bun\nimport { readFileSync } from "node:fs";\nconsole.log("cmdline-hex=" + readFileSync("/proc/self/cmdline").toString("hex"));\n',
        );
        const argvBytes = Buffer.concat([
          Buffer.from("Hello ", "utf8"),
          Buffer.from(new Uint8Array([0xff, 0xfe])),
          Buffer.from(" world\n\n", "utf8"),
        ]);
        writeFileSync(join(tmp, "prompt-argv.bin"), argvBytes);
        doRun("bytes", "launch", "cx", join(tmp, "wt"), join(tmp, "prompt-argv.bin"));
        const aPRc = rc;
        const aPOut = out;
        const ab = spawnSync(
          "bash",
          [baseLaunch, "launch", "cx", join(tmp, "wt"), join(tmp, "prompt-argv.bin")],
          { encoding: "utf8", env: nofileEnv },
        );
        const aBRc = ab.status ?? 1;
        const aBOut = String(ab.stdout ?? "");
        const strippedTail = `${Buffer.from("Hello ", "utf8").toString("hex")}fffe${Buffer.from(" world", "utf8").toString("hex")}00`;
        check(
          "parity: a prompt holding \\xff\\xfe reaches argv byte for byte, trailing newlines stripped, on both sides",
          aPRc === 0 &&
            aBRc === 0 &&
            aPOut === aBOut &&
            aPOut.includes("fffe") &&
            aPOut.trimEnd().endsWith(strippedTail),
          `port rc=${aPRc} base rc=${aBRc}\nport ${aPOut}\nbase ${aBOut}`,
        );
        // The combined shell sources the file and splices the prompt: the file
        // applies, the bytes survive, and a `cat` the file defines does not
        // hijack the read, which runs before the source, as BASE orders it.
        writeFileSync(
          codex,
          '#!/usr/bin/env bun\nimport { readFileSync } from "node:fs";\nconsole.log("cmdline-hex=" + readFileSync("/proc/self/cmdline").toString("hex"));\nconsole.log("FOO=" + (process.env.FOO ?? "unset"));\n',
        );
        writeFileSync(
          join(tmp, "catguard.env"),
          "export FOO=fromfile\ncat() { echo HIJACKED; }\nexport -f cat\n",
        );
        writeFileSync(
          join(tmp, "bytesenv.toml"),
          `${head}[lanes.cx]\nharness = "codex"\nmodel = "m"\nenv_file = "${join(tmp, "catguard.env")}"\n`,
        );
        const combinedEnv = { ...nofileEnv, POSTMASTER_CONFIG: join(tmp, "bytesenv.toml") };
        doRun("bytesenv", "launch", "cx", join(tmp, "wt"), join(tmp, "prompt-argv.bin"));
        const cPRc = rc;
        const cPOut = out;
        const cPErr = err;
        const cb = spawnSync(
          "bash",
          [baseLaunch, "launch", "cx", join(tmp, "wt"), join(tmp, "prompt-argv.bin")],
          { encoding: "utf8", env: combinedEnv },
        );
        const cBRc = cb.status ?? 1;
        const cBOut = String(cb.stdout ?? "");
        const cBErr = String(cb.stderr ?? "");
        const promptHex = (s: string): string =>
          s.split("\n").find((l) => l.startsWith("cmdline-hex=")) ?? "";
        check(
          "parity: with an env file the prompt still reaches argv byte for byte and the file applies",
          cPRc === 0 &&
            cBRc === 0 &&
            promptHex(cPOut) === promptHex(cBOut) &&
            promptHex(cPOut).includes("fffe") &&
            cPOut.includes("FOO=fromfile") &&
            cBOut.includes("FOO=fromfile") &&
            !(cPOut + cPErr + cBOut + cBErr).includes("HIJACKED"),
          `port rc=${cPRc} base rc=${cBRc}\nport ${cPOut}\nbase ${cBOut}`,
        );
        writeFileSync(codex, savedCodex);
        envx = savedEnvx2;
      }
    }
    record("run-relenv", "relenv");
    doRun(
      "relenv",
      "launch",
      "coachman",
      join(tmp, "wt"),
      join(tmp, "prompt.txt"),
      "--leg",
      "review",
      "--run",
      runDir("run-relenv"),
    );
    if (rc === 0 && out.includes("probe=config-dir"))
      ok("a relative env file under --run is read from the live config's directory");
    else fail("a relative env file under --run is read from the live config's directory");
    writeFileSync(join(tmp, "trail.txt"), "do the thing\n\n\n");
    carries(
      "a prompt keeps its text without its trailing newlines, as under $()",
      "legs",
      "-p do the thing --model",
      "launch",
      "one",
      join(tmp, "wt"),
      join(tmp, "trail.txt"),
    );
    refused(
      "an empty prompt file is refused, and nothing runs",
      "legs",
      "prompt file missing, unreadable or empty",
      "launch",
      "one",
      join(tmp, "wt"),
      join(tmp, "empty.txt"),
    );
    {
      let canReadUnreadable = false;
      try {
        accessSync(join(tmp, "unreadable.txt"), fsConstants.R_OK);
        canReadUnreadable = true;
      } catch {
        canReadUnreadable = false;
      }
      if (canReadUnreadable) {
        ok("an unreadable prompt file is refused (skipped: this user reads every file)");
      } else {
        refused(
          "an unreadable prompt file is refused, and nothing runs",
          "legs",
          "prompt file missing, unreadable or empty",
          "launch",
          "one",
          join(tmp, "wt"),
          join(tmp, "unreadable.txt"),
        );
      }
    }
    refused(
      "a resume with no thread id is refused, and nothing runs",
      "legs",
      "launch: resume needs a thread id",
      "resume",
      "one",
      join(tmp, "wt"),
      "",
      join(tmp, "prompt.txt"),
    );
    refused(
      "an argument launch.sh does not know is refused",
      "legs",
      "launch needs <cwd> <prompt-file>",
      "launch",
      "one",
      join(tmp, "wt"),
      join(tmp, "prompt.txt"),
      "--leg=review",
    );
    for (const k of ["style", "bug", "security"]) {
      refused(
        `--leg ${k} is refused`,
        "legs",
        `no such leg: --leg ${k}`,
        "form",
        "coachman",
        "--leg",
        k,
      );
    }
    refused(
      "a codex lane with no model is refused, and nothing resumes on codex's default",
      "codex-nomodel",
      "has no model",
      "resume",
      "one",
      join(tmp, "wt"),
      "T-1",
      join(tmp, "prompt.txt"),
    );
    runsAs(
      "a codex resume with no effort and no --last passes neither -c nor -o",
      "codex-noeffort",
      lines(
        join(tmp, "wt"),
        "exec",
        "resume",
        "T-1",
        "--json",
        "-m",
        "lane-model",
        CODEX_BYPASS,
        "--",
        "- Keep going, then stop.",
      ),
      "resume",
      "one",
      join(tmp, "wt"),
      "T-1",
      join(tmp, "ruling.txt"),
    );
    refused(
      "resuming the coachman with no --leg is refused, and nothing runs",
      "legs",
      "coachman needs --leg",
      "resume",
      "coachman",
      join(tmp, "wt"),
      "T-1",
      join(tmp, "prompt.txt"),
    );
    refused(
      "launching the coachman with no --leg is refused, and nothing runs",
      "legs",
      "coachman needs --leg",
      "launch",
      "coachman",
      join(tmp, "wt"),
      join(tmp, "prompt.txt"),
    );
    refused(
      "inside a run with no run.json, a resume is refused though the live config would serve, and nothing runs",
      "legs",
      `no run.json in ${join(tmp, "no-record")}`,
      "resume",
      "coachman",
      join(tmp, "wt"),
      "T-1",
      join(tmp, "prompt.txt"),
      "--leg",
      "review",
      "--run",
      join(tmp, "no-record"),
    );
    refused(
      "inside a run whose run.json does not parse, a launch is refused, and nothing runs",
      "legs",
      `cannot read ${join(tmp, "garbled/run.json")}`,
      "launch",
      "one",
      join(tmp, "wt"),
      join(tmp, "prompt.txt"),
      "--run",
      join(tmp, "garbled"),
    );
    refused(
      "a run.json that records no config is refused",
      "legs",
      "it records no config",
      "launch",
      "one",
      join(tmp, "wt"),
      join(tmp, "prompt.txt"),
      "--run",
      join(tmp, "unrecorded"),
    );
    refused(
      "an empty --run is refused, never read as outside a run",
      "legs",
      "--run needs a dispatch directory",
      "resume",
      "coachman",
      join(tmp, "wt"),
      "T-1",
      join(tmp, "prompt.txt"),
      "--leg",
      "review",
      "--run",
      "",
    );
    refused(
      "a recorded config naming bug is refused, though the live config passes",
      "legs",
      "one leg now, review",
      "resume",
      "coachman",
      join(tmp, "wt"),
      "T-1",
      join(tmp, "prompt.txt"),
      "--leg",
      "review",
      "--run",
      runDir("run-old-bug"),
    );
    refused(
      "a recorded leg on a lane's model is refused, though the live config passes",
      "legs",
      "a lane's model",
      "resume",
      "coachman",
      join(tmp, "wt"),
      "T-1",
      join(tmp, "prompt.txt"),
      "--leg",
      "synthesis",
      "--run",
      runDir("run-onlane"),
    );
    {
      const c = calls(
        join(here, "../skills/postmaster/coachman.md"),
        join(here, "../skills/postmaster/postmaster.md"),
      );
      const gotLines = c.out
        .trim()
        .split("\n")
        .filter((l) => l !== "");
      const unrun = gotLines.filter((l) => l.startsWith("unrun "));
      const hasCoachman = gotLines.some(
        (l) => l.startsWith("run ") && l.includes("/coachman.md: "),
      );
      const hasPostmaster = gotLines.some(
        (l) => l.startsWith("run ") && l.includes("/postmaster.md: "),
      );
      if (c.code === 0 && unrun.length === 0 && hasCoachman && hasPostmaster) {
        ok("no launch or resume in coachman.md or postmaster.md lacks --run <dispatch>");
      } else {
        fail("no launch or resume in coachman.md or postmaster.md lacks --run <dispatch>");
      }
    }

    console.log("muse");
    writeFileSync(
      join(tmp, "muse.toml"),
      `[lanes.m]\nharness = "muse"\nmodel = "muse-model"\neffort = "max"\nenv_file = "${join(tmp, "over.env")}"\n\n[lanes.n]\nharness = "muse"\nmodel = "muse-model"\n\n[team]\ncoachman = { harness = "muse", model = "coach-muse" }\ncoachman_fallback = { harness = "claude", model = "fallback-model" }\n`,
    );
    writeFileSync(
      join(tmp, "muse-bare.toml"),
      '[lanes.m]\nharness = "muse"\nmodel = "muse-model"\n',
    );
    mkdirSync(join(tmp, "wt/sub"), { recursive: true });
    writeFileSync(join(tmp, "wt/sub/p.txt"), "Continue.\n");
    const hd = join(tmp, "harness-data");

    const mrun = (...args: string[]): void => {
      const f = args[0] ?? "";
      const rest = args.slice(1);
      const env: Record<string, string | undefined> = {
        ...process.env,
        ...envx,
        POSTMASTER_HARNESS_DATA: hd,
        POSTMASTER_CONFIG: join(tmp, `${f}.toml`),
        PATH: `${join(tmp, "bin")}:${process.env.PATH ?? ""}`,
      };
      const r = spawnSync(self, rest, { encoding: "utf8", env, input: "leak\n" });
      out = r.stdout ?? "";
      err = r.stderr ?? "";
      rc = r.status ?? 1;
    };
    const dataOf = (): string => {
      const m = out.match(/.* data=(.*)/u);
      return m?.[1]?.trim() ?? "";
    };
    const mrefused = (label: string, f: string, want: string, ...args: string[]): void => {
      mrun(f, ...args);
      if (rc === 1 && out === "" && err.includes(want)) ok(label);
      else fail(label);
    };

    mrun("muse", "launch", "m", join(tmp, "wt"), join(tmp, "prompt.txt"));
    let a = dataOf();
    {
      const want = `exec --json --prompt-file ${join(tmp, "prompt.txt")} --model muse-model --reasoning-effort max --yolo probe=reached stdin= data=${a}`;
      if (
        rc === 0 &&
        bashOut(out) === want &&
        a.startsWith(`${hd}/muse/`) &&
        (() => {
          try {
            return statSync(a).isDirectory();
          } catch {
            return false;
          }
        })()
      ) {
        ok(
          "a muse launch: JSON events, the prompt file, model, effort, bypass form and env file, nothing on stdin, and its own data directory",
        );
      } else {
        fail(
          "a muse launch: JSON events, the prompt file, model, effort, bypass form and env file, nothing on stdin, and its own data directory",
        );
      }
    }
    writeFileSync(join(a, "01a0-sess"), "");
    mrun("muse", "resume", "m", join(tmp, "wt"), "01a0-sess", join(tmp, "prompt.txt"));
    const b = dataOf();
    {
      const wantPrefix = `exec --json --prompt-file ${join(tmp, "prompt.txt")} --session-id 01a0-sess --model muse-model --reasoning-effort max --yolo `;
      if (rc === 0 && out.startsWith(wantPrefix) && b === a) {
        ok(
          "a muse resume names the session, keeps the model and effort, and finds the launch's data directory",
        );
      } else {
        fail(
          "a muse resume names the session, keeps the model and effort, and finds the launch's data directory",
        );
      }
    }
    mrun("muse", "launch", "n", join(tmp, "wt"), join(tmp, "prompt.txt"));
    const c = dataOf();
    mrun(
      "muse",
      "launch",
      "coachman",
      join(tmp, "wt"),
      join(tmp, "prompt.txt"),
      "--leg",
      "synthesis",
    );
    const d = dataOf();
    mrun("muse", "launch", "coachman", join(tmp, "wt"), join(tmp, "prompt.txt"), "--leg", "review");
    const e = dataOf();
    mrun("muse", "launch", "m", join(tmp, "elsewhere"), join(tmp, "prompt.txt"));
    const f = dataOf();
    {
      const uniq = new Set([a, c, d, e, f]);
      if (c && d && e && f && uniq.size === 5) {
        ok(
          "another lane, each coachman leg, and the same lane elsewhere each get a data directory of their own",
        );
      } else {
        fail(
          "another lane, each coachman leg, and the same lane elsewhere each get a data directory of their own",
        );
      }
    }
    {
      const origCwd = process.cwd();
      process.chdir(join(tmp, "wt"));
      const env: Record<string, string | undefined> = {
        ...process.env,
        POSTMASTER_HARNESS_DATA: hd,
        POSTMASTER_CONFIG: join(tmp, "muse-bare.toml"),
        PATH: `${join(tmp, "bin")}:${process.env.PATH ?? ""}`,
      };
      const r = spawnSync(self, ["launch", "m", join(tmp, "elsewhere"), "sub/p.txt"], {
        encoding: "utf8",
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      out = r.stdout ?? "";
      err = r.stderr ?? "";
      rc = r.status ?? 1;
      process.chdir(origCwd);
      const wantPrefix = `exec --json --prompt-file ${join(tmp, "wt/sub/p.txt")} --model muse-model --yolo `;
      if (rc === 0 && out.startsWith(wantPrefix)) {
        ok(
          "a relative prompt file is made absolute before the cd, and no effort means no effort flag",
        );
      } else {
        fail(
          "a relative prompt file is made absolute before the cd, and no effort means no effort flag",
        );
      }
    }
    carries(
      "the muse form shows its data directory, the bypass form and an empty stdin",
      "muse",
      `env XDG_DATA_HOME=<harness-data>/muse/<key> muse exec --json --prompt-file <prompt-file> --model muse-model --reasoning-effort max --yolo < /dev/null`,
      "form",
      "m",
    );
    mrefused(
      "a muse resume of a thread its data directory does not hold is refused, and nothing runs",
      "muse",
      "no muse thread 01a0-none in this launch's data directory",
      "resume",
      "m",
      join(tmp, "wt"),
      "01a0-none",
      join(tmp, "prompt.txt"),
    );
    mrefused(
      "a muse resume from another directory is refused: the thread is in its launch's data directory",
      "muse",
      "no muse thread 01a0-sess in this launch's data directory",
      "resume",
      "m",
      join(tmp, "elsewhere"),
      "01a0-sess",
      join(tmp, "prompt.txt"),
    );
    // The export check sources the env file with CWD as its working directory,
    // as the real launch does: a failing export reports where the file ran.
    {
      const muse = join(tmp, "bin", "muse");
      const savedMuse = readFileSync(muse, "utf8");
      writeFileSync(
        muse,
        '#!/bin/sh\n[ "$1" = export ] && { echo "nogood pwd=$PWD probe=${PROBE:-}" >&2; exit 1; }\n',
      );
      writeFileSync(join(tmp, "cwd.env"), 'PROBE="$(pwd)/probe"\n');
      writeFileSync(
        join(tmp, "musecwd.toml"),
        `[lanes.m]\nharness = "muse"\nmodel = "muse-model"\neffort = "max"\nenv_file = "${join(tmp, "cwd.env")}"\n`,
      );
      mrun("musecwd", "resume", "m", join(tmp, "wt"), "01a0-x", join(tmp, "prompt.txt"));
      if (
        rc === 1 &&
        err.includes(`nogood pwd=${join(tmp, "wt")} probe=${join(tmp, "wt")}/probe`)
      ) {
        ok(
          "a resume's export check sources the env file in the worktree, not the caller's directory",
        );
      } else {
        fail(
          "a resume's export check sources the env file in the worktree, not the caller's directory",
        );
      }
      writeFileSync(muse, savedMuse);
    }
    // The export check's held directory is private and never reused, as
    // `mktemp -d` makes one.
    {
      const h1 = makeHeldDir();
      const h2 = makeHeldDir();
      const m1 = statSync(h1).mode & 0o777;
      const m2 = statSync(h2).mode & 0o777;
      check(
        "a resume's held directory is mode 0700 and never reused",
        m1 === 0o700 &&
          m2 === 0o700 &&
          h1 !== h2 &&
          h1.startsWith(join(process.env.TMPDIR ?? "/tmp", "launch-held-")),
        `h1=${h1} ${m1.toString(8)} h2=${h2} ${m2.toString(8)}`,
      );
      rmSync(h1, { recursive: true, force: true });
      rmSync(h2, { recursive: true, force: true });
    }
    writeFileSync(join(d, "01a0-coach"), "");
    mrun(
      "muse",
      "resume",
      "coachman",
      join(tmp, "wt"),
      "01a0-coach",
      join(tmp, "prompt.txt"),
      "--leg",
      "synthesis",
    );
    if (rc === 0 && dataOf() === d) {
      ok("a muse coachman resumes its thread on the leg it was launched on");
    } else {
      fail("a muse coachman resumes its thread on the leg it was launched on");
    }
    mrefused(
      "a muse coachman resumed on another leg is refused, and nothing runs",
      "muse",
      "no muse thread 01a0-coach in this launch's data directory",
      "resume",
      "coachman",
      join(tmp, "wt"),
      "01a0-coach",
      join(tmp, "prompt.txt"),
      "--leg",
      "review",
    );

    console.log("mimo");
    writeFileSync(
      join(tmp, "mimo.toml"),
      `[lanes.x]\nharness = "mimo"\nmodel = "prov/mimo-model"\neffort = "high"\nenv_file = "${join(tmp, "over.env")}"\n\n[lanes.y]\nharness = "mimo"\nmodel = "prov/mimo-model"\n`,
    );
    writeFileSync(
      join(tmp, "mimo-bare.toml"),
      '[lanes.x]\nharness = "mimo"\nmodel = "prov/mimo-model"\n',
    );

    mrun("mimo", "launch", "x", join(tmp, "wt"), join(tmp, "prompt.txt"));
    a = dataOf();
    {
      const want = `run --format json -m prov/mimo-model --variant high --dangerously-skip-permissions probe=reached stdin=Continue. import-off=1 data=${a}`;
      if (
        rc === 0 &&
        bashOut(out) === want &&
        a.startsWith(`${hd}/mimo/`) &&
        (() => {
          try {
            return statSync(a).isDirectory();
          } catch {
            return false;
          }
        })()
      ) {
        ok(
          "a mimo launch: JSON events, model, variant, bypass form, env file, the prompt on stdin, its own data directory, and no history import",
        );
      } else {
        fail(
          "a mimo launch: JSON events, model, variant, bypass form, env file, the prompt on stdin, its own data directory, and no history import",
        );
      }
    }
    writeFileSync(join(a, "ses_01a0"), "");
    mrun("mimo", "resume", "x", join(tmp, "wt"), "ses_01a0", join(tmp, "prompt.txt"));
    const mb = dataOf();
    {
      const wantPrefix = `run --format json -m prov/mimo-model -s ses_01a0 --variant high --dangerously-skip-permissions probe=reached stdin=Continue. `;
      if (rc === 0 && out.startsWith(wantPrefix) && mb === a) {
        ok(
          "a mimo resume names the session, keeps the model and the variant, and finds the launch's data directory",
        );
      } else {
        fail(
          "a mimo resume names the session, keeps the model and the variant, and finds the launch's data directory",
        );
      }
    }
    mrun("mimo", "launch", "y", join(tmp, "wt"), join(tmp, "prompt.txt"));
    const mc = dataOf();
    if (mc && mc !== a) {
      ok("another mimo lane in the same directory gets a data directory of its own");
    } else {
      fail("another mimo lane in the same directory gets a data directory of its own");
    }
    {
      const origCwd = process.cwd();
      process.chdir(join(tmp, "wt"));
      const env: Record<string, string | undefined> = {
        ...process.env,
        POSTMASTER_HARNESS_DATA: hd,
        POSTMASTER_LAUNCH_NAME: "#7, a run",
        POSTMASTER_CONFIG: join(tmp, "mimo-bare.toml"),
        PATH: `${join(tmp, "bin")}:${process.env.PATH ?? ""}`,
      };
      const r = spawnSync(self, ["launch", "x", join(tmp, "elsewhere"), "sub/p.txt"], {
        encoding: "utf8",
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      out = r.stdout ?? "";
      err = r.stderr ?? "";
      rc = r.status ?? 1;
      process.chdir(origCwd);
      const wantPrefix = `run --format json -m prov/mimo-model --title #7, a run --dangerously-skip-permissions probe= stdin=Continue. `;
      if (rc === 0 && out.startsWith(wantPrefix)) {
        ok(
          "a relative prompt file is read after the cd, no effort means no variant, and a launch is titled after its run",
        );
      } else {
        fail(
          "a relative prompt file is read after the cd, no effort means no variant, and a launch is titled after its run",
        );
      }
    }
    carries(
      "the mimo form shows its data directory, the import switch and the prompt file on stdin",
      "mimo",
      `env XDG_DATA_HOME=<harness-data>/mimo/<key> MIMOCODE_DISABLE_CLAUDE_IMPORT=1 mimo run --format json -m prov/mimo-model --variant high --dangerously-skip-permissions < <prompt-file>`,
      "form",
      "x",
    );
    doRun("mimo", "skill", "x", "security-review");
    if (rc === 3 && out === "") {
      ok("a mimo lane has no security review skill: exit 3");
    } else {
      fail("a mimo lane has no security review skill: exit 3");
    }
    mrefused(
      "a mimo resume of a thread its data directory does not hold is refused, and nothing runs",
      "mimo",
      "no mimo thread ses_none in this launch's data directory",
      "resume",
      "x",
      join(tmp, "wt"),
      "ses_none",
      join(tmp, "prompt.txt"),
    );
    mrefused(
      "a mimo resume from another directory is refused: the thread is in its launch's data directory",
      "mimo",
      "no mimo thread ses_01a0 in this launch's data directory",
      "resume",
      "x",
      join(tmp, "elsewhere"),
      "ses_01a0",
      join(tmp, "prompt.txt"),
    );

    console.log("the coachman on muse, a workhorse on mimo: both forms, each with its bypass flag");
    writeFileSync(
      join(tmp, "team.toml"),
      '[lanes.w]\nharness = "mimo"\nmodel = "prov/mimo-model"\neffort = "low"\n\n[lanes.v]\nharness = "claude"\nmodel = "lane-model"\n\n[team]\nworkhorses = ["w", "v"]\ncoachman = { harness = "muse", model = "coach-muse", effort = "max" }\n',
    );
    // Create modified copies of this script with bypass flags removed.
    const selfSrc = readFileSync(join(import.meta.dir, "launch.ts"), "utf8");
    const nobypassSrc = selfSrc
      .replaceAll('cmd.push("--yolo"); /*BYPASS*/', "/*BYPASS*/")
      .replaceAll('cmd.push("--dangerously-skip-permissions"); /*BYPASS*/', "/*BYPASS*/");
    writeFileSync(join(tmp, "nobypass.ts"), nobypassSrc);
    writeFileSync(
      join(tmp, "nobypass.sh"),
      `#!/usr/bin/env bash\nexec bun "${join(tmp, "nobypass.ts")}" "$@"\n`,
    );
    chmodSync(join(tmp, "nobypass.sh"), 0o755);
    const launchonlySrc = selfSrc
      .replaceAll('cmd.push("--yolo"); /*BYPASS*/', 'if (!isResume) cmd.push("--yolo"); /*BYPASS*/')
      .replaceAll(
        'cmd.push("--dangerously-skip-permissions"); /*BYPASS*/',
        'if (!isResume) cmd.push("--dangerously-skip-permissions"); /*BYPASS*/',
      );
    writeFileSync(join(tmp, "launchonly.ts"), launchonlySrc);
    writeFileSync(
      join(tmp, "launchonly.sh"),
      `#!/usr/bin/env bash\nexec bun "${join(tmp, "launchonly.ts")}" "$@"\n`,
    );
    chmodSync(join(tmp, "launchonly.sh"), 0o755);
    // The copies import ./lib/* like the original; without it they die on module
    // load and the negative controls below pass for the wrong reason.
    symlinkSync(join(here, "lib"), join(tmp, "lib"));

    const bypassed = (script: string, flag: string, ...formArgs: string[]): boolean => {
      const r = spawnSync(script, ["form", ...formArgs], {
        encoding: "utf8",
        env: {
          ...process.env,
          POSTMASTER_CONFIG: join(tmp, "team.toml"),
          PATH: `${join(tmp, "bin")}:${process.env.PATH ?? ""}`,
        },
      });
      out = r.stdout ?? "";
      rc = r.status ?? 1;
      let n = 0;
      for (const l of out.split("\n")) {
        if (l.startsWith("launch:") || l.startsWith("resume:")) {
          if (l.includes(` ${flag} `)) n += 1;
        }
      }
      return rc === 0 && n === 2;
    };

    for (const f of ["coachman --yolo --leg review", "w --dangerously-skip-permissions"]) {
      const parts = f.split(" ");
      const name = parts[0] ?? "";
      const flag = parts[1] ?? "";
      const rest = parts.slice(2);
      if (bypassed(self, flag, name, ...rest))
        ok(`${name}: the launch and resume forms both carry ${flag}`);
      else fail(`${name}: the launch and resume forms both carry ${flag}`);
      for (const line of out.split("\n")) {
        if (line) console.log(`         ${line}`);
      }
      // A copy that crashes fails bypassed() for the wrong reason; each copy must
      // run cleanly and fail the flag check on its missing flag.
      const noFlag = bypassed(join(tmp, "nobypass.sh"), flag, name, ...rest);
      const noFlagRc = rc;
      if (!noFlag && noFlagRc === 0) ok(`${name}: a form without ${flag} fails this check`);
      else fail(`${name}: a form without ${flag} fails this check`);
      const launchOnly = bypassed(join(tmp, "launchonly.sh"), flag, name, ...rest);
      const launchOnlyRc = rc;
      if (!launchOnly && launchOnlyRc === 0)
        ok(`${name}: a resume form without ${flag} fails this check`);
      else fail(`${name}: a resume form without ${flag} fails this check`);
    }
    doRun("legs", "form", "one");
    printed(
      "a claude lane's form shows a resume form too",
      "launch: cd <cwd> && claude -p ",
      "resume: cd <cwd> && claude -p --resume <thread-id> ",
    );
    writeFileSync(join(tmp, "agy.toml"), '[lanes.g]\nharness = "agy"\nmodel = "agy-model"\n');
    writeFileSync(join(tmp, "bin/agy"), "#!/bin/sh\n");
    chmodSync(join(tmp, "bin/agy"), 0o755);
    doRun("agy", "form", "g");
    printed(
      "an agy lane's form says it has no resume form, and still exits 0",
      "launch: cd <cwd> && agy -p ",
      "resume: none: agy resume form is not recorded",
    );

    console.log("skills");
    writeFileSync(
      join(tmp, "skills.toml"),
      '[lanes.one]\nharness = "claude"\nmodel = "lane-model"\n\n[lanes.two]\nharness = "codex"\nmodel = "other-model"\n\n[lanes.three]\nharness = "muse"\nmodel = "muse-model"\n',
    );
    doRun("skills", "skill", "one", "security-review");
    if (rc === 0 && out.trim() === "/security-review")
      ok("a claude lane's security review skill is /security-review");
    else fail("a claude lane's security review skill is /security-review");
    doRun("skills", "skill", "two", "security-review");
    if (rc === 3 && out === "" && err.includes("no security review skill")) {
      ok("a harness with no security review skill is exit 3, never a prompt");
    } else {
      fail("a harness with no security review skill is exit 3, never a prompt");
    }
    refused(
      "a skill that is not recorded is refused",
      "skills",
      "no such skill: code-review",
      "skill",
      "one",
      "code-review",
    );
    doRun("skills", "skill", "three", "security-review");
    if (rc === 3 && out === "") ok("a muse lane has no security review skill: exit 3");
    else fail("a muse lane has no security review skill: exit 3");

    console.log("bug review forms");
    const base = run("git", ["-C", join(tmp, "cx"), "rev-parse", "HEAD"]).out.trim();
    writeFileSync(
      join(tmp, "review-claude.toml"),
      '[lanes.one]\nharness = "claude"\nmodel = "claude-model"\neffort = "low"\n\n[team]\ncoachman = { harness = "claude", model = "coach-model" }\n',
    );
    writeFileSync(
      join(tmp, "review-mimo.toml"),
      '[lanes.one]\nharness = "mimo"\nmodel = "prov/mimo-model"\neffort = "low"\n\n[team]\ncoachman = { harness = "mimo", model = "coach-model" }\n',
    );
    writeFileSync(
      join(tmp, "review-pi.toml"),
      '[lanes.one]\nharness = "pi"\nmodel = "pi-model"\n\n[team]\ncoachman = { harness = "pi", model = "coach-model" }\n',
    );
    runsAs(
      "claude review names the range and runs /code-review at max",
      "review-claude",
      `-p /code-review max ${base}...HEAD --model claude-model --effort max --output-format stream-json --verbose --dangerously-skip-permissions probe=`,
      "review",
      "one",
      join(tmp, "cx-detached"),
      base,
    );
    runsAs(
      "codex review uses --base, --last, max effort and the lane model",
      "review-codex",
      lines(
        join(tmp, "cx-detached"),
        "exec",
        "review",
        "--base",
        base,
        "--json",
        "-o",
        join(tmp, "review-last.md"),
        "-m",
        "lane-model",
        "-c",
        'model_reasoning_effort="max"',
        CODEX_BYPASS,
        "--skip-git-repo-check",
      ),
      "review",
      "one",
      join(tmp, "cx-detached"),
      base,
      "--last",
      join(tmp, "review-last.md"),
    );
    writeFileSync(join(tmp, "review-last.md"), "stale from an earlier attempt\n");
    doRun(
      "review-codex",
      "review",
      "one",
      join(tmp, "cx-detached"),
      base,
      "--last",
      join(tmp, "review-last.md"),
    );
    if (rc === 0 && !existsSync(join(tmp, "review-last.md"))) {
      ok("a review launch removes a stale --last file before the harness runs");
    } else {
      fail("a review launch removes a stale --last file before the harness runs");
    }
    record("review-run", "review-codex");
    runsAs(
      "codex review in a run uses the recorded config and the same top level",
      "review-codex",
      lines(
        join(tmp, "cx-detached"),
        "exec",
        "review",
        "--base",
        base,
        "--json",
        "-m",
        "lane-model",
        "-c",
        'model_reasoning_effort="max"',
        CODEX_BYPASS,
        "--skip-git-repo-check",
      ),
      "review",
      "one",
      join(tmp, "cx-detached"),
      base,
      "--run",
      runDir("review-run"),
    );
    mrun("review-mimo", "review", "one", join(tmp, "cx-detached"), base);
    if (
      rc === 0 &&
      out.includes("--command review") &&
      out.includes("--variant high") &&
      out.includes(`stdin=${base}...HEAD`)
    ) {
      ok("mimo review uses --command review, the prompt file range and high variant");
    } else {
      fail("mimo review uses --command review, the prompt file range and high variant");
    }
    const noPromptLeft = (): boolean =>
      !readdirSync(join(tmp, "cx-detached")).some((f) => f.startsWith(".postmaster-review-"));
    if (noPromptLeft()) ok("mimo's temporary range prompt is removed after launch");
    else fail("mimo's temporary range prompt is removed after launch");
    {
      const relPwd = process.cwd();
      process.chdir(tmp);
      mrun("review-mimo", "review", "one", "cx-detached", base);
      process.chdir(relPwd);
      const ran = out.includes("--command review");
      if (rc === 0 && ran && noPromptLeft()) {
        ok("mimo's temporary range prompt is removed after a relative-cwd launch");
      } else {
        fail("mimo's temporary range prompt is removed after a relative-cwd launch");
      }
    }
    doRun("review-pi", "review", "one", join(tmp, "cx-detached"), base);
    if (rc === 3 && out === "" && err.includes("has no bug code-review form")) {
      ok("pi has no bug review form: exit 3");
    } else {
      fail("pi has no bug review form: exit 3");
    }
    writeFileSync(
      join(tmp, "review-unsupported.toml"),
      '[lanes.one]\nharness = "not-installed"\nmodel = "model"\n',
    );
    doRun("review-unsupported", "review", "one", join(tmp, "cx-detached"), base);
    if (rc === 3 && out === "" && err.includes("has no bug code-review form")) {
      ok("a harness without a review form exits 3 even when its CLI is absent");
    } else {
      fail("a harness without a review form exits 3 even when its CLI is absent");
    }
    run("git", ["-C", join(tmp, "cx"), "worktree", "add", "-q", "--detach", join(tmp, "cx-dirty")]);
    writeFileSync(join(tmp, "cx-dirty", "tracked.txt"), "v1\n");
    run("git", [
      "-C",
      join(tmp, "cx-dirty"),
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@example.invalid",
      "add",
      "tracked.txt",
    ]);
    run("git", [
      "-C",
      join(tmp, "cx-dirty"),
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@example.invalid",
      "commit",
      "-q",
      "-m",
      "tracked",
    ]);
    const dirtyBase = run("git", ["-C", join(tmp, "cx-dirty"), "rev-parse", "HEAD"]).out.trim();
    writeFileSync(join(tmp, "cx-dirty", "tracked.txt"), "v2\n");
    doRun("review-codex", "review", "one", join(tmp, "cx-dirty"), dirtyBase);
    if (rc === 1 && out === "" && err.includes("would widen the review past")) {
      ok("a review on a dirty scratch is refused before the harness runs");
    } else {
      fail("a review on a dirty scratch is refused before the harness runs");
    }
    run("git", ["-C", join(tmp, "cx-dirty"), "checkout", "-q", "--", "tracked.txt"]);
    writeFileSync(join(tmp, "cx-dirty", "untracked.txt"), "untracked\n");
    doRun("review-codex", "review", "one", join(tmp, "cx-dirty"), dirtyBase);
    if (rc === 0 && out.includes(dirtyBase)) ok("untracked scratch files do not block a review");
    else fail("untracked scratch files do not block a review");

    // The harness-data key is BASE's cksum over run, physical directory, name and
    // leg. BASE's formula through the shell is the independent side of the control.
    const baseKey = (cwd: string, runDir: string, name: string, leg: string): string =>
      run("bash", [
        "-c",
        'phys=$(CDPATH= cd -P -- "$1" && pwd -P); printf "%s|%s|%s|%s" "$2" "$phys" "$3" "$4" | cksum | tr " " "-"',
        "_",
        cwd,
        runDir,
        name,
        leg,
      ]).out.trim();
    const portKey = (cwd: string, runDir: string, name: string, leg: string): string =>
      harnessData("muse", "launch", cwd, name, leg, runDir).split("/").pop() ?? "";
    mkdirSync(join(tmp, "keydir"), { recursive: true });
    symlinkSync(join(tmp, "keydir"), join(tmp, "keylink"));
    const keyCases: Array<[string, string, string, string]> = [
      [join(tmp, "keydir"), "109", "one", "synthesis"],
      [join(tmp, "keylink"), "109", "one", "synthesis"],
      [join(tmp, "keydir"), "R U N", "na me", "re view"],
    ];
    if (
      run("bash", ["-c", `printf '%s' 'RUN|/phys/dir|NAME|LEG' | cksum`]).out.trim() ===
      "1157329517 22"
    )
      ok("cksum still answers the golden vector");
    else fail("cksum still answers the golden vector");
    let keysMatch =
      portKey(join(tmp, "nope"), "RUN", "NAME", "LEG") ===
      baseKey(join(tmp, "nope"), "RUN", "NAME", "LEG");
    for (const [cwd, runDir, name, leg] of keyCases) {
      if (portKey(cwd, runDir, name, leg) !== baseKey(cwd, runDir, name, leg)) keysMatch = false;
    }
    if (keysMatch) ok("the harness-data key is BASE's cksum over run, physical dir, name and leg");
    else fail("the harness-data key is BASE's cksum over run, physical dir, name and leg");
    if (
      portKey(join(tmp, "keylink"), "109", "one", "synthesis") ===
      portKey(join(tmp, "keydir"), "109", "one", "synthesis")
    )
      ok("a symlinked cwd keys its physical directory");
    else fail("a symlinked cwd keys its physical directory");

    // BASE's `[ -d ]`: a file is no working directory, and nothing is mutated
    // for one — the codex trust write below the guard never runs.
    writeFileSync(join(tmp, "afile"), "not a dir\n");
    envx = { HOME: join(tmp, "fakehome") };
    refused(
      "a file as cwd is no directory",
      "codex",
      "no such directory",
      "launch",
      "one",
      join(tmp, "afile"),
      join(tmp, "prompt.txt"),
    );
    if (!existsSync(join(tmp, "fakehome", ".codex", "config.toml")))
      ok("a file as cwd mutates nothing, no trust entry");
    else fail("a file as cwd mutates nothing, no trust entry");
    envx = {};

    // The resume export check cds logically from $PWD, before main resolves
    // the launch directory to its physical path; the resumed harness cds after,
    // so the check sees PWD naming CWD through the symlink and the harness sees
    // it resolved, with OLDPWD the directory the launch came from in both. The
    // check's SHLVL is one above the caller's — a fork, not an exec — and a file
    // that sets SHLVL lands verbatim in the check. Each scenario below runs the
    // merged main's launcher and this one from behind a symlink with a relative
    // cwd and the same environment, and compares both paths against main's own
    // recorded values, never against each other.
    if (!skipPython) {
      const f1 = join(tmp, "f1");
      const f1bin = join(f1, "bin");
      const realStart = join(f1, "real", "start");
      const physSub = join(realStart, "sub");
      mkdirSync(physSub, { recursive: true });
      mkdirSync(f1bin, { recursive: true });
      const startlink = join(f1, "startlink");
      try {
        symlinkSync(realStart, startlink);
      } catch {
        /* exists */
      }
      // Main's launcher at the merged main (e902378); it sources nothing, so
      // the one file is the whole launcher.
      const baseLaunch = join(f1, "base-launch.sh");
      const shown = spawnSync(
        "git",
        ["-C", dirname(here), "show", "e902378fd4a4b39aa41870da2c771b6963525517:scripts/launch.sh"],
        { encoding: "utf8" },
      );
      if (shown.status !== 0) {
        fail(
          "a resume's check and harness match main's PWD, OLDPWD and SHLVL",
          `git show main launch.sh: ${shown.stderr ?? ""}`,
        );
      } else {
        writeFileSync(baseLaunch, shown.stdout ?? "");
        const recOf = (h: string): string => join(f1, `${h}.rec`);
        const stubOf = (h: string, threadArg: string): string =>
          `#!/bin/sh\nprintf '%s\\n' "$PWD|$OLDPWD|\${SHLVL:-unset}" >> "${recOf(h)}"\n[ "$1" = export ] && { [ -e "$XDG_DATA_HOME/${threadArg}" ] && exit 0; echo "Session not found" >&2; exit 1; }\nprintf '%s\\n' "resumed $*"\n`;
        writeFileSync(join(f1bin, "mimo"), stubOf("mimo", "$2"));
        writeFileSync(join(f1bin, "muse"), stubOf("muse", "$3"));
        chmodSync(join(f1bin, "mimo"), 0o755);
        chmodSync(join(f1bin, "muse"), 0o755);
        writeFileSync(join(f1, "benign.env"), "export FROM_ENV_FILE=1\n");
        writeFileSync(join(f1, "shlvl.env"), "export SHLVL=7\n");
        const cfgs: Record<string, string> = {
          plain: '[lanes.x]\nharness = "mimo"\nmodel = "m"\n',
          senv: `[lanes.x]\nharness = "mimo"\nmodel = "m"\nenv_file = "${join(f1, "benign.env")}"\n`,
          senv7: `[lanes.x]\nharness = "mimo"\nmodel = "m"\nenv_file = "${join(f1, "shlvl.env")}"\n`,
          muse: '[lanes.x]\nharness = "muse"\nmodel = "m"\n',
        };
        for (const [n, body] of Object.entries(cfgs)) writeFileSync(join(f1, `${n}.toml`), body);
        // The thread where BASE's own key formula puts it: RUN, the physical
        // cwd, NAME and LEG through cksum exactly as harness_data does.
        const keyed = spawnSync(
          "bash",
          [
            "-c",
            'printf "%s|%s|%s|%s" "$1" "$2" "$3" "$4" | cksum | tr " " "-"',
            "_",
            "",
            physSub,
            "x",
            "",
          ],
          { encoding: "utf8" },
        );
        const key = (keyed.stdout ?? "").trim();
        for (const h of ["mimo", "muse"]) {
          const tdir = join(hd, h, key);
          mkdirSync(tdir, { recursive: true });
          writeFileSync(join(tdir, "ses_x"), "");
        }
        const mismatches: string[] = [];
        const scenario = (label: string, harness: string, cfg: string, unsetPwd: boolean): void => {
          const env: Record<string, string | undefined> = {
            ...process.env,
            PWD: startlink,
            OLDPWD: "/before",
            SHLVL: "40",
            POSTMASTER_HARNESS_DATA: hd,
            POSTMASTER_CONFIG: join(f1, `${cfg}.toml`),
            PATH: `${f1bin}:${process.env.PATH ?? ""}`,
          };
          if (unsetPwd) delete env.PWD;
          const args = ["resume", "x", "sub", "ses_x", join(tmp, "prompt.txt")];
          const sides: Record<string, string[]> = {};
          const codes: Record<string, number> = {};
          for (const [side, bin, argv] of [
            ["base", "bash", [baseLaunch, ...args]],
            ["port", self, args],
          ] as Array<[string, string, string[]]>) {
            rmSync(recOf(harness), { force: true });
            const r = spawnSync(bin, argv, { cwd: startlink, encoding: "utf8", env });
            codes[side] = r.status ?? -1;
            sides[side] = existsSync(recOf(harness))
              ? readFileSync(recOf(harness), "utf8").trim().split("\n")
              : [`<no record: exit ${r.status ?? -1} ${(r.stderr ?? "").slice(0, 200)}>`];
          }
          const b = sides.base ?? [];
          const p = sides.port ?? [];
          if (
            codes.base !== 0 ||
            codes.port !== 0 ||
            b.length !== 2 ||
            p.length !== 2 ||
            b[0] !== p[0] ||
            b[1] !== p[1]
          ) {
            mismatches.push(
              `${label}: base exit ${codes.base ?? -1} [${b.join(" / ")}] vs port exit ${codes.port ?? -1} [${p.join(" / ")}]`,
            );
          }
        };
        scenario("mimo-plain", "mimo", "plain", false);
        scenario("mimo-sourced", "mimo", "senv", false);
        scenario("mimo-sourced-shlvl", "mimo", "senv7", false);
        scenario("mimo-no-pwd", "mimo", "plain", true);
        scenario("muse-plain", "muse", "muse", false);
        if (mismatches.length === 0)
          ok("a resume's check and harness match main's PWD, OLDPWD and SHLVL");
        else
          fail(
            "a resume's check and harness match main's PWD, OLDPWD and SHLVL",
            mismatches.join("\n"),
          );
      }
    }
  });
}, 300000);

afterAll(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("preamble", () => {
  test("calls finds an invocation spaced with U+001F", () => {
    assertControl("calls finds an invocation spaced with U+001F");
  });
  test("calls misses an invocation broken by CR (splitlines)", () => {
    assertControl("calls misses an invocation broken by CR (splitlines)");
  });
  test("continuations join across U+001F", () => {
    assertControl("continuations join across U+001F");
  });
  test("fences do not open after CR", () => {
    assertControl("fences do not open after CR");
  });
  test("a run launch exports its durable session beside the harness event stream", () => {
    assertControl("a run launch exports its durable session beside the harness event stream");
  });
  test("a run launch records its explicit role and lane without inventing figures", () => {
    assertControl("a run launch records its explicit role and lane without inventing figures");
  });
  test("a reviewer launch records its reviewer lane", () => {
    assertControl("a reviewer launch records its reviewer lane");
  });
  test("a coachman launch records its leg", () => {
    assertControl("a coachman launch records its leg");
  });
  test("a fallback coachman launch records its leg", () => {
    assertControl("a fallback coachman launch records its leg");
  });
  test("an empty event stream is a loud missed export, not a silent skip", () => {
    assertControl("an empty event stream is a loud missed export, not a silent skip");
  });
  test("a failed export still exits with the harness's status", () => {
    assertControl("a failed export still exits with the harness's status");
  });
  test("a harness failure keeps its exit when the export succeeds", () => {
    assertControl("a harness failure keeps its exit when the export succeeds");
  });
  test("a lane env file cannot redirect the session export", () => {
    assertControl("a lane env file cannot redirect the session export");
  });
  test("a lane env file cannot change the recorded role", () => {
    assertControl("a lane env file cannot change the recorded role");
  });
});

describe("positive controls", () => {
  test("--leg synthesis runs on its own [team.coachman_legs] entry", () => {
    assertControl("--leg synthesis runs on its own [team.coachman_legs] entry");
  });
  test("--leg review runs on its own [team.coachman_legs] entry", () => {
    assertControl("--leg review runs on its own [team.coachman_legs] entry");
  });
  test("--leg ship runs on its own [team.coachman_legs] entry", () => {
    assertControl("--leg ship runs on its own [team.coachman_legs] entry");
  });
  test("a leg with no entry runs on team.coachman", () => {
    assertControl("a leg with no entry runs on team.coachman");
  });
  test("a lane runs on its own model", () => {
    assertControl("a lane runs on its own model");
  });
  test("a lane launches on a config the coachman refuses", () => {
    assertControl("a lane launches on a config the coachman refuses");
  });
  test("a launch with --leg synthesis runs on the synthesis entry", () => {
    assertControl("a launch with --leg synthesis runs on the synthesis entry");
  });
  test("a resume with --leg review runs on the review entry", () => {
    assertControl("a resume with --leg review runs on the review entry");
  });
  test("a codex resume runs in its worktree on its lane's model and effort, streams JSON, writes -o, and passes a prompt that starts with -", () => {
    assertControl(
      "a codex resume runs in its worktree on its lane's model and effort, streams JSON, writes -o, and passes a prompt that starts with -",
    );
  });
  test("a codex coachman resumes with --leg review on the review entry's model and effort", () => {
    assertControl(
      "a codex coachman resumes with --leg review on the review entry's model and effort",
    );
  });
  test("a codex launch on a branch runs with -C and --json, and no --skip-git-repo-check", () => {
    assertControl(
      "a codex launch on a branch runs with -C and --json, and no --skip-git-repo-check",
    );
  });
  test("a codex launch in a detached worktree adds --skip-git-repo-check", () => {
    assertControl("a codex launch in a detached worktree adds --skip-git-repo-check");
  });
  test("form shows the codex launch and resume", () => {
    assertControl("form shows the codex launch and resume");
  });
  test("the fallback resumes on its own model, with no --leg", () => {
    assertControl("the fallback resumes on its own model, with no --leg");
  });
  test("form with no --leg shows team.coachman", () => {
    assertControl("form with no --leg shows team.coachman");
  });
  test("a lane's env file reaches the harness's environment", () => {
    assertControl("a lane's env file reaches the harness's environment");
  });
  test("inside a run, a resume runs on the model the run recorded, not the live config's", () => {
    assertControl(
      "inside a run, a resume runs on the model the run recorded, not the live config's",
    );
  });
  test("outside a run, the same resume runs on the live config's model", () => {
    assertControl("outside a run, the same resume runs on the live config's model");
  });
  test("inside a run, a lane resumes on the harness, model, effort and env file the run recorded", () => {
    assertControl(
      "inside a run, a lane resumes on the harness, model, effort and env file the run recorded",
    );
  });
  test("outside a run, the same resume takes all four from the live config", () => {
    assertControl("outside a run, the same resume takes all four from the live config");
  });
  test("inside a run the live config is not read: with none at all, a launch runs on the recorded model", () => {
    assertControl(
      "inside a run the live config is not read: with none at all, a launch runs on the recorded model",
    );
  });
  test("a runbook launch or resume with no --run is found, fenced or inline", () => {
    assertControl("a runbook launch or resume with no --run is found, fenced or inline");
  });
  test("a SIGTERM child reports 143", () => {
    assertControl("a SIGTERM child reports 143");
  });
  test("a SIGKILL child reports 137", () => {
    assertControl("a SIGKILL child reports 137");
  });
  test("a SIGINT child reports 130", () => {
    assertControl("a SIGINT child reports 130");
  });
  test("a plain exit still reports its code", () => {
    assertControl("a plain exit still reports its code");
  });
  test("a timeout still reads 128", () => {
    assertControl("a timeout still reads 128");
  });
  test("a SIGTERM harness kills the launch by SIGTERM", () => {
    assertControl("a SIGTERM harness kills the launch by SIGTERM");
  });
});

describe("negative controls", () => {
  test("a config naming style is refused, and the message names review", () => {
    assertControl("a config naming style is refused, and the message names review");
  });
  test("a config naming bug is refused, and the message names review", () => {
    assertControl("a config naming bug is refused, and the message names review");
  });
  test("a config naming security is refused, and the message names review", () => {
    assertControl("a config naming security is refused, and the message names review");
  });
  test("a key that is no leg is refused", () => {
    assertControl("a key that is no leg is refused");
  });
  test("a leg entry on a lane's model is refused", () => {
    assertControl("a leg entry on a lane's model is refused");
  });
  test("a leg entry that is not a table is refused", () => {
    assertControl("a leg entry that is not a table is refused");
  });
  test("a config that does not parse is refused, and the environment's HARNESS and MODEL go unused", () => {
    assertControl(
      "a config that does not parse is refused, and the environment's HARNESS and MODEL go unused",
    );
  });
  test("a parse error names the file and where it breaks", () => {
    assertControl("a parse error names the file and where it breaks");
  });
  test("a leg entry on a lane's model with a bracketed suffix is refused", () => {
    assertControl("a leg entry on a lane's model with a bracketed suffix is refused");
  });
  test("team.coachman on a lane's model is refused", () => {
    assertControl("team.coachman on a lane's model is refused");
  });
  test("the fallback on a lane's model is refused", () => {
    assertControl("the fallback on a lane's model is refused");
  });
  test("a leg entry with no harness or model is refused", () => {
    assertControl("a leg entry with no harness or model is refused");
  });
  test("a coachman with no model is refused by name", () => {
    assertControl("a coachman with no model is refused by name");
  });
  test("an env file cannot put the coachman on another model", () => {
    assertControl("an env file cannot put the coachman on another model");
  });
  test("a STDIN_FILE from the environment is not used", () => {
    assertControl("a STDIN_FILE from the environment is not used");
  });
  test("a leg entry on a lane's model with stacked suffixes is refused", () => {
    assertControl("a leg entry on a lane's model with stacked suffixes is refused");
  });
  test("a relative env file is read from the config's directory, never the worktree", () => {
    assertControl("a relative env file is read from the config's directory, never the worktree");
  });
  test("an env file is shell: export, quotes, comments and expansion reach the harness", () => {
    assertControl("an env file is shell: export, quotes, comments and expansion reach the harness");
  });
  test("an env file launch hands the launcher's level", () => {
    assertControl("an env file launch hands the launcher's level");
  });
  test("an env file that sets SHLVL hands it on verbatim, as main does", () => {
    assertControl("an env file that sets SHLVL hands it on verbatim, as main does");
  });
  test("an env file that exits aborts the launch with its status", () => {
    assertControl("an env file that exits aborts the launch with its status");
  });
  test("an env file that fails under set -e aborts with its status", () => {
    assertControl("an env file that fails under set -e aborts with its status");
  });
  test("an env file that execs never launches", () => {
    assertControl("an env file that execs never launches");
  });
  test("BASE launch.sh extracts with its source-and-exec tail", () => {
    assertControl("BASE launch.sh extracts with its source-and-exec tail");
  });
  test.skipIf(skipPython)(
    "parity: an echo in the file reaches stdout and the full env reaches the harness",
    () => {
      assertControl(
        "parity: an echo in the file reaches stdout and the full env reaches the harness",
      );
    },
  );
  test.skipIf(skipPython)(
    "parity: a printed NUL byte is file output, never a handed variable",
    () => {
      assertControl("parity: a printed NUL byte is file output, never a handed variable");
    },
  );
  test.skipIf(skipPython)("parity: exit 0 in the file exits 0 without launching", () => {
    assertControl("parity: exit 0 in the file exits 0 without launching");
  });
  test.skipIf(skipPython)("parity: exec /bin/true in the file exits 0 without launching", () => {
    assertControl("parity: exec /bin/true in the file exits 0 without launching");
  });
  test.skipIf(skipPython)("parity: file output on stderr reaches the launch's stderr", () => {
    assertControl("parity: file output on stderr reaches the launch's stderr");
  });
  test.skipIf(skipPython)(
    "parity: a file that unsets everything hands on the emptied environment",
    () => {
      assertControl("parity: a file that unsets everything hands on the emptied environment");
    },
  );
  test.skipIf(skipPython)("parity: a roughly 1.2 MB environment launches whole", () => {
    assertControl("parity: a roughly 1.2 MB environment launches whole");
  });
  test.skipIf(skipPython)("parity: a file that unsets PATH applies instead of ignored", () => {
    assertControl("parity: a file that unsets PATH applies instead of ignored");
  });
  test.skipIf(skipPython)("parity: a file that empties PATH applies instead of ignored", () => {
    assertControl("parity: a file that empties PATH applies instead of ignored");
  });
  test.skipIf(skipPython)("a file that exports a variable hands it to the harness", () => {
    assertControl("a file that exports a variable hands it to the harness");
  });
  test.skipIf(skipPython)(
    "a file that unsets everything but PATH hands the harness no trace of it",
    () => {
      assertControl("a file that unsets everything but PATH hands the harness no trace of it");
    },
  );
  test.skipIf(skipPython)(
    "a harness name holding $(...) is refused as not on PATH on both sides, and runs nothing",
    () => {
      assertControl(
        "a harness name holding $(...) is refused as not on PATH on both sides, and runs nothing",
      );
    },
  );
  test.skipIf(skipPython)(
    "parity: without an env file the harness's full environment matches BASE, PWD naming the worktree",
    () => {
      assertControl(
        "parity: without an env file the harness's full environment matches BASE, PWD naming the worktree",
      );
    },
  );
  test.skipIf(skipPython)(
    "parity: a prompt holding \\xff\\xfe and NUL reaches stdin byte for byte on both sides",
    () => {
      assertControl(
        "parity: a prompt holding \\xff\\xfe and NUL reaches stdin byte for byte on both sides",
      );
    },
  );
  test.skipIf(skipPython)(
    "parity: a prompt holding \\xff\\xfe reaches argv byte for byte, trailing newlines stripped, on both sides",
    () => {
      assertControl(
        "parity: a prompt holding \\xff\\xfe reaches argv byte for byte, trailing newlines stripped, on both sides",
      );
    },
  );
  test.skipIf(skipPython)(
    "parity: with an env file the prompt still reaches argv byte for byte and the file applies",
    () => {
      assertControl(
        "parity: with an env file the prompt still reaches argv byte for byte and the file applies",
      );
    },
  );
  test("a relative env file under --run is read from the live config's directory", () => {
    assertControl("a relative env file under --run is read from the live config's directory");
  });
  test("a prompt keeps its text without its trailing newlines, as under $()", () => {
    assertControl("a prompt keeps its text without its trailing newlines, as under $()");
  });
  test("an empty prompt file is refused, and nothing runs", () => {
    assertControl("an empty prompt file is refused, and nothing runs");
  });
  test("an unreadable prompt file is refused, and nothing runs", () => {
    assertControl("an unreadable prompt file is refused, and nothing runs");
  });
  test("a resume with no thread id is refused, and nothing runs", () => {
    assertControl("a resume with no thread id is refused, and nothing runs");
  });
  test("an argument launch.sh does not know is refused", () => {
    assertControl("an argument launch.sh does not know is refused");
  });
  test("--leg style is refused", () => {
    assertControl("--leg style is refused");
  });
  test("--leg bug is refused", () => {
    assertControl("--leg bug is refused");
  });
  test("--leg security is refused", () => {
    assertControl("--leg security is refused");
  });
  test("a codex lane with no model is refused, and nothing resumes on codex's default", () => {
    assertControl("a codex lane with no model is refused, and nothing resumes on codex's default");
  });
  test("a codex resume with no effort and no --last passes neither -c nor -o", () => {
    assertControl("a codex resume with no effort and no --last passes neither -c nor -o");
  });
  test("resuming the coachman with no --leg is refused, and nothing runs", () => {
    assertControl("resuming the coachman with no --leg is refused, and nothing runs");
  });
  test("launching the coachman with no --leg is refused, and nothing runs", () => {
    assertControl("launching the coachman with no --leg is refused, and nothing runs");
  });
  test("inside a run with no run.json, a resume is refused though the live config would serve, and nothing runs", () => {
    assertControl(
      "inside a run with no run.json, a resume is refused though the live config would serve, and nothing runs",
    );
  });
  test("inside a run whose run.json does not parse, a launch is refused, and nothing runs", () => {
    assertControl(
      "inside a run whose run.json does not parse, a launch is refused, and nothing runs",
    );
  });
  test("a run.json that records no config is refused", () => {
    assertControl("a run.json that records no config is refused");
  });
  test("an empty --run is refused, never read as outside a run", () => {
    assertControl("an empty --run is refused, never read as outside a run");
  });
  test("a recorded config naming bug is refused, though the live config passes", () => {
    assertControl("a recorded config naming bug is refused, though the live config passes");
  });
  test("a recorded leg on a lane's model is refused, though the live config passes", () => {
    assertControl("a recorded leg on a lane's model is refused, though the live config passes");
  });
  test("no launch or resume in coachman.md or postmaster.md lacks --run <dispatch>", () => {
    assertControl("no launch or resume in coachman.md or postmaster.md lacks --run <dispatch>");
  });
});

describe("muse", () => {
  test("a muse launch: JSON events, the prompt file, model, effort, bypass form and env file, nothing on stdin, and its own data directory", () => {
    assertControl(
      "a muse launch: JSON events, the prompt file, model, effort, bypass form and env file, nothing on stdin, and its own data directory",
    );
  });
  test("a muse resume names the session, keeps the model and effort, and finds the launch's data directory", () => {
    assertControl(
      "a muse resume names the session, keeps the model and effort, and finds the launch's data directory",
    );
  });
  test("another lane, each coachman leg, and the same lane elsewhere each get a data directory of their own", () => {
    assertControl(
      "another lane, each coachman leg, and the same lane elsewhere each get a data directory of their own",
    );
  });
  test("a relative prompt file is made absolute before the cd, and no effort means no effort flag", () => {
    assertControl(
      "a relative prompt file is made absolute before the cd, and no effort means no effort flag",
    );
  });
  test("the muse form shows its data directory, the bypass form and an empty stdin", () => {
    assertControl("the muse form shows its data directory, the bypass form and an empty stdin");
  });
  test("a muse resume of a thread its data directory does not hold is refused, and nothing runs", () => {
    assertControl(
      "a muse resume of a thread its data directory does not hold is refused, and nothing runs",
    );
  });
  test("a muse resume from another directory is refused: the thread is in its launch's data directory", () => {
    assertControl(
      "a muse resume from another directory is refused: the thread is in its launch's data directory",
    );
  });
  test("a resume's export check sources the env file in the worktree, not the caller's directory", () => {
    assertControl(
      "a resume's export check sources the env file in the worktree, not the caller's directory",
    );
  });
  test("a resume's held directory is mode 0700 and never reused", () => {
    assertControl("a resume's held directory is mode 0700 and never reused");
  });
  test("a muse coachman resumes its thread on the leg it was launched on", () => {
    assertControl("a muse coachman resumes its thread on the leg it was launched on");
  });
  test("a muse coachman resumed on another leg is refused, and nothing runs", () => {
    assertControl("a muse coachman resumed on another leg is refused, and nothing runs");
  });
});

describe("mimo", () => {
  test("a mimo launch: JSON events, model, variant, bypass form, env file, the prompt on stdin, its own data directory, and no history import", () => {
    assertControl(
      "a mimo launch: JSON events, model, variant, bypass form, env file, the prompt on stdin, its own data directory, and no history import",
    );
  });
  test("a mimo resume names the session, keeps the model and the variant, and finds the launch's data directory", () => {
    assertControl(
      "a mimo resume names the session, keeps the model and the variant, and finds the launch's data directory",
    );
  });
  test("another mimo lane in the same directory gets a data directory of its own", () => {
    assertControl("another mimo lane in the same directory gets a data directory of its own");
  });
  test("a relative prompt file is read after the cd, no effort means no variant, and a launch is titled after its run", () => {
    assertControl(
      "a relative prompt file is read after the cd, no effort means no variant, and a launch is titled after its run",
    );
  });
  test("the mimo form shows its data directory, the import switch and the prompt file on stdin", () => {
    assertControl(
      "the mimo form shows its data directory, the import switch and the prompt file on stdin",
    );
  });
  test("a mimo lane has no security review skill: exit 3", () => {
    assertControl("a mimo lane has no security review skill: exit 3");
  });
  test("a mimo resume of a thread its data directory does not hold is refused, and nothing runs", () => {
    assertControl(
      "a mimo resume of a thread its data directory does not hold is refused, and nothing runs",
    );
  });
  test("a mimo resume from another directory is refused: the thread is in its launch's data directory", () => {
    assertControl(
      "a mimo resume from another directory is refused: the thread is in its launch's data directory",
    );
  });
});

describe("the coachman on muse, a workhorse on mimo: both forms, each with its bypass flag", () => {
  test("coachman: the launch and resume forms both carry --yolo", () => {
    assertControl("coachman: the launch and resume forms both carry --yolo");
  });
  test("coachman: a form without --yolo fails this check", () => {
    assertControl("coachman: a form without --yolo fails this check");
  });
  test("coachman: a resume form without --yolo fails this check", () => {
    assertControl("coachman: a resume form without --yolo fails this check");
  });
  test("w: the launch and resume forms both carry --dangerously-skip-permissions", () => {
    assertControl("w: the launch and resume forms both carry --dangerously-skip-permissions");
  });
  test("w: a form without --dangerously-skip-permissions fails this check", () => {
    assertControl("w: a form without --dangerously-skip-permissions fails this check");
  });
  test("w: a resume form without --dangerously-skip-permissions fails this check", () => {
    assertControl("w: a resume form without --dangerously-skip-permissions fails this check");
  });
  test("a claude lane's form shows a resume form too", () => {
    assertControl("a claude lane's form shows a resume form too");
  });
  test("an agy lane's form says it has no resume form, and still exits 0", () => {
    assertControl("an agy lane's form says it has no resume form, and still exits 0");
  });
});

describe("skills", () => {
  test("a claude lane's security review skill is /security-review", () => {
    assertControl("a claude lane's security review skill is /security-review");
  });
  test("a harness with no security review skill is exit 3, never a prompt", () => {
    assertControl("a harness with no security review skill is exit 3, never a prompt");
  });
  test("a skill that is not recorded is refused", () => {
    assertControl("a skill that is not recorded is refused");
  });
  test("a muse lane has no security review skill: exit 3", () => {
    assertControl("a muse lane has no security review skill: exit 3");
  });
});

describe("bug review forms", () => {
  test("claude review names the range and runs /code-review at max", () => {
    assertControl("claude review names the range and runs /code-review at max");
  });
  test("codex review uses --base, --last, max effort and the lane model", () => {
    assertControl("codex review uses --base, --last, max effort and the lane model");
  });
  test("a review launch removes a stale --last file before the harness runs", () => {
    assertControl("a review launch removes a stale --last file before the harness runs");
  });
  test("codex review in a run uses the recorded config and the same top level", () => {
    assertControl("codex review in a run uses the recorded config and the same top level");
  });
  test("mimo review uses --command review, the prompt file range and high variant", () => {
    assertControl("mimo review uses --command review, the prompt file range and high variant");
  });
  test("mimo's temporary range prompt is removed after launch", () => {
    assertControl("mimo's temporary range prompt is removed after launch");
  });
  test("mimo's temporary range prompt is removed after a relative-cwd launch", () => {
    assertControl("mimo's temporary range prompt is removed after a relative-cwd launch");
  });
  test("pi has no bug review form: exit 3", () => {
    assertControl("pi has no bug review form: exit 3");
  });
  test("a harness without a review form exits 3 even when its CLI is absent", () => {
    assertControl("a harness without a review form exits 3 even when its CLI is absent");
  });
  test("a review on a dirty scratch is refused before the harness runs", () => {
    assertControl("a review on a dirty scratch is refused before the harness runs");
  });
  test("untracked scratch files do not block a review", () => {
    assertControl("untracked scratch files do not block a review");
  });
  test("cksum still answers the golden vector", () => {
    assertControl("cksum still answers the golden vector");
  });
  test("the harness-data key is BASE's cksum over run, physical dir, name and leg", () => {
    assertControl("the harness-data key is BASE's cksum over run, physical dir, name and leg");
  });
  test("a symlinked cwd keys its physical directory", () => {
    assertControl("a symlinked cwd keys its physical directory");
  });
  test("a file as cwd is no directory", () => {
    assertControl("a file as cwd is no directory");
  });
  test("a file as cwd mutates nothing, no trust entry", () => {
    assertControl("a file as cwd mutates nothing, no trust entry");
  });
  test.skipIf(skipPython)("a resume's check and harness match main's PWD, OLDPWD and SHLVL", () => {
    assertControl("a resume's check and harness match main's PWD, OLDPWD and SHLVL");
  });
});
