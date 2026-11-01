// Tests beside scripts/greptile-step.ts, the Greptile step (#652). Each test runs the commands as a
// coachman does, in a scratch project whose origin is on the web, with a stand-in greptile first on
// PATH that records what it was given, through the real host, adapter and scratch cuts. Nothing
// reaches Greptile, and no test prints an environment: the stand-in says only whether it was given
// a key.
import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { actions, RUN, type ToolResult, tool } from "./acceptance-467.ts";
import {
  behave,
  calls,
  type Comment,
  commitFiles,
  type Greptiled,
  greptileMachine,
  ORIGIN,
  report,
} from "./acceptance-652.ts";
import { run, withTempDir } from "./lib/proc.ts";

const TURNPIKES = "style bug security greptile";

/** A scratch project of a run whose waybill names greptile. */
function project(root: string, opts: { timeoutSecs?: number; standIn?: boolean } = {}): Greptiled {
  return greptileMachine(root, { turnpikes: TURNPIKES, ...opts });
}

const step = (g: Greptiled): ToolResult =>
  tool(g, "greptile-step", "run", g.dispatch, g.repo, g.synthesis);
const gate = (g: Greptiled): ToolResult => tool(g, "greptile-step", "gate", g.dispatch);
const escalate = (g: Greptiled): ToolResult => tool(g, "greptile-step", "escalate", g.dispatch);
const cardLine = (g: Greptiled): ToolResult => tool(g, "greptile-step", "card-line", g.dispatch);
const decide = (g: Greptiled, round: number): ToolResult =>
  tool(g, "review-decide", g.dispatch, String(round), "--cause");
const rule = (g: Greptiled, word: string): void => {
  const r = tool(
    g,
    "log-action",
    g.dispatch,
    "coachman",
    "rule",
    "greptile",
    `${word} the user's words`,
  );
  expect(r.code).toBe(0);
};
const logged = (g: Greptiled, action: string, target: string, detail: string): void => {
  const r = tool(g, "log-action", g.dispatch, "coachman", action, target, detail);
  expect(r.code).toBe(0);
};

const firstLine = (r: ToolResult): string => r.out.split("\n")[0] ?? "";
const prefixOf = (g: Greptiled, round: number): string =>
  join(g.dispatch, "logs", `greptile-r${round}`);
const rowsOf = (g: Greptiled, action: string): Array<{ target: string; detail: string }> =>
  actions(g)
    .filter((row) => row.action === action)
    .map((row) => ({ target: row.target, detail: row.detail }));
const scratchOf = (g: Greptiled): string => join(g.repo, ".worktrees", "T-1-rev-greptile-greptile");
const escalation = (g: Greptiled): string =>
  readFileSync(join(g.dispatch, "ESCALATION.md"), "utf8");
const findingsOf = (g: Greptiled, round: number): Array<Record<string, unknown>> =>
  JSON.parse(readFileSync(`${prefixOf(g, round)}-findings.json`, "utf8")) as Array<
    Record<string, unknown>
  >;

const TWO: Comment[] = [
  {
    path: "src/a.ts",
    startLine: 3,
    severity: "P1",
    body: "Null deref on the empty list.\nIt throws.",
  },
  { path: "src/b.ts", startLine: 7, severity: "P2", body: "A stale name." },
];
const THREE: Comment[] = [
  { path: "src/a.ts", startLine: 3, severity: "P0", body: "Null deref on the empty list." },
  { path: "src/b.ts", startLine: 10, endLine: 12, severity: "P1", body: "The loop never ends." },
  { path: "src/c.ts", startLine: 7, severity: "P2", body: "A stale name." },
];
const SENSITIVE = "warning: 1 possibly sensitive file found: .env.local. Include it with --include";

/** The text of every file under a folder, for a search that must find nothing. */
function everything(dir: string): string {
  let text = "";
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    text += statSync(path).isDirectory() ? everything(path) : readFileSync(path, "utf8");
  }
  return text;
}

describe("a review that passes", () => {
  test("reviews the change since the manifest's base, once, on a branch at the head with the project's origin", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report([]) });
      const r = step(g);
      expect(r.code).toBe(0);
      expect(firstLine(r)).toBe(
        `PASSED greptile round 1: reviewed at ${g.snap.slice(0, 12)}, no finding`,
      );
      const [call, ...more] = calls(g);
      expect(more).toEqual([]);
      expect(call?.args).toBe(`review --json -b ${g.base}`);
      expect(call?.branch).toBe("greptile-review");
      expect(call?.head).toBe(g.snap);
      expect(call?.remote).toBe(ORIGIN);
      expect(call?.env).toBe("telemetry=1 update=1 install=1 key=unset");
    }, "greptile-step-pass-");
  });

  test("records its lines, leaves an empty findings file and no scratch, and ends nothing else", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report([]) });
      expect(step(g).code).toBe(0);
      const rows = actions(g)
        .filter((row) => row.target === "greptile")
        .map((row) => [row.action, row.detail]);
      expect(rows).toEqual([
        ["review-launch", "greptile round 1"],
        ["review-finish", "greptile round 1"],
        ["review-harvest", "greptile round 1 reported 0 findings"],
      ]);
      expect(findingsOf(g, 1)).toEqual([]);
      expect(existsSync(scratchOf(g))).toBe(false);
      expect(existsSync(join(g.dispatch, "ESCALATION.md"))).toBe(false);
      expect(existsSync(join(g.dispatch, ".escalation-ready"))).toBe(false);
      expect(actions(g).some((row) => row.action === "degrade" || row.action === "apply")).toBe(
        false,
      );
      expect(readFileSync(join(g.dispatch, "run-log.md"), "utf8")).toContain(
        "greptile round 1: reviewed at",
      );
    }, "greptile-step-lines-");
  });

  test("the loop's decision for its round ends it, and the gate before the card is clear", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report([]) });
      expect(step(g).code).toBe(0);
      expect(decide(g, 1).out.trim()).toBe("STOP greptile-clean");
      const gated = gate(g);
      expect(gated.code).toBe(0);
      expect(gated.out).toContain("clear: the latest Greptile step (round 1) passed");
    }, "greptile-step-clear-");
  });

  test("starts Greptile once, after a loop that ended on STOP 2, in a round of its own", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report([]) });
      // The loop's two rounds, as the coachman logged them: round 1 fixed one finding, round 2 was clean.
      logged(g, "review-launch", "luna", "bug round 1");
      logged(g, "finding", "src/x.ts:1", "gating P2 r1 bug luna reading: a defect");
      logged(g, "apply", "abc123", "src/x.ts:1");
      logged(g, "review-launch", "luna", "bug round 2");
      expect(tool(g, "review-decide", g.dispatch, "2").out).toContain("STOP 2:");
      expect(calls(g)).toEqual([]);
      const r = step(g);
      expect(firstLine(r)).toContain("PASSED greptile round 3:");
      expect(calls(g).length).toBe(1);
      expect(calls(g)[0]?.args).toBe(`review --json -b ${g.base}`);
      expect(calls(g)[0]?.head).toBe(g.snap);
      expect(decide(g, 2).out.trim()).toBe("STOP clean");
      expect(decide(g, 3).out.trim()).toBe("STOP greptile-clean");
    }, "greptile-step-after-loop-");
  });

  test("a loop round launched for real starts nothing for greptile", () => {
    withTempDir((root) => {
      const g = greptileMachine(root, { turnpikes: "style greptile", briefs: ["style"] });
      behave(g, { out: report([]) });
      const scratch = join(g.repo, ".worktrees", "T-1-rev-style-ghost");
      expect(
        tool(g, "cut-scratch", g.repo, g.synthesis, scratch, g.snap, "--clone", g.base).code,
      ).toBe(0);
      const launched = tool(g, "review-round", "launch", g.dispatch, "1", g.repo, g.synthesis);
      expect(launched.code).toBe(0);
      expect(calls(g)).toEqual([]);
      expect(rowsOf(g, "review-launch").map((row) => row.target)).toEqual(["ghost"]);
    }, "greptile-step-loop-");
  }, 300_000);

  test("passes the project's level to Greptile", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report([]) });
      mkdirSync(join(g.repo, ".postmaster"), { recursive: true });
      writeFileSync(
        join(g.repo, ".postmaster", "project.toml"),
        '[project]\ngreptile_level = "apex"\n',
      );
      expect(step(g).code).toBe(0);
      expect(calls(g)[0]?.args).toBe(`review --json -b ${g.base} --apex`);
    }, "greptile-step-level-");
  });

  test("a key in the caller's environment reaches no process the step starts, and no file", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report([]) });
      const key = "pm-check-not-a-key";
      g.env.GREPTILE_API_KEY = key;
      expect(step(g).code).toBe(0);
      expect(calls(g)[0]?.env).toContain("key=unset");
      expect(everything(g.dispatch).includes(key)).toBe(false);
    }, "greptile-step-key-");
  });
});

describe("a review that reports findings", () => {
  test("lists them with their files, lines, Greptile's severity and greptile as the source, and stops", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report(THREE) });
      const r = step(g);
      expect(r.code).toBe(2);
      expect(firstLine(r)).toContain("FAILED greptile round 1: 3 findings at");
      expect(r.out).toContain("greptile-1 [P0] src/a.ts:3: Null deref on the empty list.");
      expect(r.out).toContain("greptile-2 [P1] src/b.ts:10-12: The loop never ends.");
      expect(r.out).toContain("greptile-3 [P2] src/c.ts:7: A stale name.");
      const found = findingsOf(g, 1);
      expect(found.map((f) => [f.file, f.line, f.line_end, f.severity, f.source])).toEqual([
        ["src/a.ts", 3, 3, "P0", "greptile"],
        ["src/b.ts", 10, 12, "P1", "greptile"],
        ["src/c.ts", 7, 7, "P2", "greptile"],
      ]);
      expect(rowsOf(g, "review-harvest")).toEqual([
        { target: "greptile", detail: "greptile round 1 reported 3 findings" },
      ]);
    }, "greptile-step-found-");
  });

  test("writes an ESCALATION.md that lists each finding with a line for the coachman's assessment, and no marker yet", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report(TWO) });
      expect(step(g).code).toBe(2);
      const text = escalation(g);
      expect(text).toContain("# Escalation: review loop stopped at round 1");
      expect(text).toContain(
        "Decision: RULING 1: the Greptile review reported 2 findings in round 1; escalate with residue",
      );
      expect(text).toContain("Survey missing:");
      expect(text).toContain(
        "greptile-1: src/a.ts:3\nGreptile's severity: P1\nGreptile's words:\n> Null deref on the empty list.\n> It throws.\nCoachman's assessment: pending",
      );
      expect(text).toContain(
        "greptile-2: src/b.ts:7\nGreptile's severity: P2\nGreptile's words:\n> A stale name.\nCoachman's assessment: pending",
      );
      for (const option of ["- Fix:", "- Rule out:", "- Go on:", "- Review again:"]) {
        expect(text).toContain(option);
      }
      expect(text).toContain("## Residue");
      expect(text).toContain("## Advice");
      expect(existsSync(join(g.dispatch, ".escalation-ready"))).toBe(false);
    }, "greptile-step-escalation-");
  });

  test("applies no fix and starts no round: the log gains neither, and the gate holds the card", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report(TWO) });
      expect(step(g).code).toBe(2);
      expect(rowsOf(g, "apply")).toEqual([]);
      expect(rowsOf(g, "review-launch")).toEqual([
        { target: "greptile", detail: "greptile round 1" },
      ]);
      const gated = gate(g);
      expect(gated.code).toBe(1);
      expect(gated.out).toContain("held: the latest Greptile step (round 1) reported 2 findings");
      expect(decide(g, 1).out.trim()).toBe("RULING greptile-findings");
    }, "greptile-step-held-");
  });

  test("a report with only a P2 comment fails just as one with a P0 does", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, {
        out: report([{ path: "src/c.ts", startLine: 7, severity: "P2", body: "A stale name." }]),
      });
      expect(step(g).code).toBe(2);
      expect(gate(g).code).toBe(1);
      expect(gate(g).out).toContain("reported 1 finding;");
    }, "greptile-step-p2-");
  });

  test("escalate refuses while an assessment is pending, then readies the escalation; and the assessment clears no finding", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report(TWO) });
      expect(step(g).code).toBe(2);
      const refused = escalate(g);
      expect(refused.code).toBe(1);
      expect(refused.err).toContain("still pending for greptile-1, greptile-2");
      expect(existsSync(join(g.dispatch, ".escalation-ready"))).toBe(false);
      const path = join(g.dispatch, "ESCALATION.md");
      writeFileSync(
        path,
        escalation(g)
          .replace(
            "Coachman's assessment: pending",
            "Coachman's assessment: holds, P2: it throws on an empty list.",
          )
          .replace(
            "Coachman's assessment: pending",
            "Coachman's assessment: does not hold, P3: the name is documented.",
          ),
      );
      const done = escalate(g);
      expect(done.code).toBe(0);
      expect(existsSync(join(g.dispatch, ".escalation-ready"))).toBe(true);
      expect(rowsOf(g, "escalate")).toEqual([
        { target: "ESCALATION.md", detail: "greptile round 1: 2 findings" },
      ]);
      // An assessment that says a finding does not hold clears nothing.
      expect(gate(g).code).toBe(1);
    }, "greptile-step-assessed-");
  });

  test("the escalation reads as a rise's does: review-survey renders the question from it", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report(TWO) });
      expect(step(g).code).toBe(2);
      const path = join(g.dispatch, "ESCALATION.md");
      writeFileSync(
        path,
        escalation(g).replaceAll(
          "Coachman's assessment: pending",
          "Coachman's assessment: holds, P2: yes.",
        ),
      );
      const question = tool(g, "review-survey", "question", g.dispatch);
      expect(question.code).toBe(0);
      const text = readFileSync(join(g.dispatch, ".waiting-on-user"), "utf8");
      expect(text).toContain("Survey missing: this stop is the Greptile review");
      expect(text).toContain("## Options\n\n- Fix:");
      expect(text).toContain("## Advice");
    }, "greptile-step-question-");
  });

  test("the user's word settles it, and the card line says so", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report(TWO) });
      expect(step(g).code).toBe(2);
      expect(cardLine(g).code).toBe(1);
      rule(g, "fix");
      expect(gate(g).code).toBe(0);
      // Settled, there is nothing to escalate: a second readying would call the postmaster again.
      const again = escalate(g);
      expect(again.code).toBe(1);
      expect(again.err).toContain("has already said what happens next");
      expect(cardLine(g).out.trim()).toBe(
        `greptile: reviewed once, the last at ${g.snap.slice(0, 12)}, 2 findings that the user settled (fix); the Open findings and Not re-reviewed sections give their states.`,
      );
    }, "greptile-step-settled-");
  });

  test("a word that asks for another review does not settle it", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report(TWO) });
      expect(step(g).code).toBe(2);
      rule(g, "review-again");
      expect(gate(g).code).toBe(1);
    }, "greptile-step-again-");
  });
});

describe("a review that is missed", () => {
  const cases: Array<[string, { exit?: number; out?: string; err?: string }, string]> = [
    ["exits 1 printing Not signed in.", { exit: 1, err: "Not signed in.\n" }, "Not signed in."],
    [
      "exits 6 printing a notice",
      { exit: 6, err: "notice: this feature is not enabled for this account.\n" },
      "notice: this feature is not enabled for this account.",
    ],
    [
      "exits 0 printing text that is not a report",
      { out: "Review complete. Nothing to add.\n" },
      "greptile exited 0 but printed no readable report",
    ],
    [
      "exits 0 with a readable report and the warning that a file looks like a secret",
      { out: report([]), err: `${SENSITIVE}\n` },
      SENSITIVE,
    ],
    [
      "exits 0 with a readable report and a warning the adapter does not know",
      { out: report([]), err: "warning: 1 file could not be reviewed: src/x.ts\n" },
      "warning: 1 file could not be reviewed: src/x.ts",
    ],
  ];
  for (const [label, how, cause] of cases) {
    test(`a Greptile that ${label} stops the run at once, naming the cause, with no retry`, () => {
      withTempDir((root) => {
        const g = project(root);
        behave(g, how);
        const r = step(g);
        expect(r.code).toBe(3);
        expect(firstLine(r)).toContain(`MISSED greptile round 1: ${cause}.`);
        expect(calls(g).length).toBe(1);
        expect(rowsOf(g, "degrade")).toEqual([
          { target: "greptile", detail: `greptile r1: ${cause}` },
        ]);
        expect(rowsOf(g, "review-harvest")).toEqual([]);
        expect(rowsOf(g, "review-launch").length).toBe(1);
        expect(decide(g, 1).out.trim()).toBe("RULING greptile-missed");
        expect(gate(g).code).toBe(1);
        expect(gate(g).out).toContain(`missed: ${cause}`);
        expect(existsSync(scratchOf(g))).toBe(false);
        // The escalation is written and ready at once: nothing waits on the coachman.
        expect(escalation(g)).toContain(
          "Decision: RULING 1: the Greptile review was missed in round 1; escalate with residue",
        );
        expect(escalation(g)).toContain(cause);
        expect(existsSync(join(g.dispatch, ".escalation-ready"))).toBe(true);
        expect(rowsOf(g, "escalate").length).toBe(1);
      }, "greptile-step-missed-");
    });
  }

  test("a Greptile that is still running at the step's time limit is stopped, and the step is missed", () => {
    withTempDir((root) => {
      const g = project(root, { timeoutSecs: 5 });
      behave(g, { out: report([]), sleep: 120 });
      const started = Date.now();
      const r = step(g);
      expect(Date.now() - started).toBeLessThan(90_000);
      expect(r.code).toBe(3);
      expect(firstLine(r)).toContain("MISSED greptile round 1: timeout after 5s.");
      expect(rowsOf(g, "degrade")).toEqual([
        { target: "greptile", detail: "greptile r1: timeout after 5s" },
      ]);
      expect(decide(g, 1).out.trim()).toBe("RULING greptile-missed");
      expect(gate(g).code).toBe(1);
      expect(existsSync(scratchOf(g))).toBe(false);
    }, "greptile-step-timeout-");
  }, 300_000);

  test("a Greptile that is not on PATH is a miss that says so", () => {
    withTempDir((root) => {
      const g = project(root, { standIn: false });
      const r = step(g);
      expect(r.code).toBe(3);
      expect(firstLine(r)).toContain(
        "MISSED greptile round 1: greptile is not installed: it is not on PATH.",
      );
      expect(gate(g).code).toBe(1);
    }, "greptile-step-absent-");
  });

  test("the gate clears on the user's word to go on, and the card line says Greptile was out", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { exit: 1, err: "Not signed in.\n" });
      expect(step(g).code).toBe(3);
      expect(gate(g).code).toBe(1);
      rule(g, "go-on");
      const gated = gate(g);
      expect(gated.code).toBe(0);
      expect(gated.out).toContain("the user has said what happens next");
      expect(cardLine(g).out.trim()).toBe(
        "greptile: DEGRADED, Not signed in.; the user said to go on without a Greptile review.",
      );
    }, "greptile-step-goon-");
  });
});

describe("the changed files the project's ignore rules hold back", () => {
  test("are no miss: the step passes, the gate is clear, and the ship card's line names them", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report([]) });
      commitFiles(
        g,
        { ".gitignore": "*.log\n", "build.log": "noise\n", "src/keep.ts": "x\n" },
        "ignored",
      );
      const r = step(g);
      expect(r.code).toBe(0);
      expect(r.out).toContain(
        "Left out by the project's own ignore rules, as it chose: build.log.",
      );
      expect(rowsOf(g, "degrade")).toEqual([]);
      expect(gate(g).code).toBe(0);
      const line = cardLine(g);
      expect(line.code).toBe(0);
      expect(line.out.trim()).toMatch(
        /^greptile: reviewed once, the last at [0-9a-f]{12}, no findings\. Left out by the project's own ignore rules: build\.log\.$/u,
      );
    }, "greptile-step-ignored-");
  });

  test("and a binary file's warning is no miss either", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report([]), err: "warning: 1 binary file not included in the review\n" });
      expect(step(g).code).toBe(0);
      expect(gate(g).code).toBe(0);
    }, "greptile-step-binary-");
  });

  test("are named in the escalation of a review that reported findings", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report(TWO) });
      commitFiles(g, { ".gitignore": "*.log\n", "x.log": "noise\n" }, "ignored");
      expect(step(g).code).toBe(2);
      expect(escalation(g)).toContain(
        "Left out by the project's own ignore rules, as it chose: x.log.",
      );
    }, "greptile-step-ignored-found-");
  });
});

describe("a second review", () => {
  test("runs only on the user's word: run again reports the recorded result and starts nothing", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report([]) });
      expect(step(g).code).toBe(0);
      const again = step(g);
      expect(again.code).toBe(0);
      expect(firstLine(again)).toContain("PASSED greptile round 1:");
      expect(again.err).toContain("a second Greptile review runs only on the user's word");
      expect(calls(g).length).toBe(1);
      expect(rowsOf(g, "review-launch").length).toBe(1);
    }, "greptile-step-once-");
  });

  test("a word of try-again after a miss, or review-again after any result, starts one more in a round of its own", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { exit: 1, err: "Not signed in.\n" });
      expect(step(g).code).toBe(3);
      rule(g, "try-again");
      behave(g, { out: report(TWO) });
      const second = step(g);
      expect(second.code).toBe(2);
      expect(firstLine(second)).toContain("FAILED greptile round 2:");
      expect(calls(g).length).toBe(2);
      // The latest step is the one judged.
      expect(gate(g).out).toContain("(round 2) reported 2 findings");
      rule(g, "review-again");
      behave(g, { out: report([]) });
      expect(step(g).code).toBe(0);
      expect(calls(g).length).toBe(3);
      expect(gate(g).code).toBe(0);
      expect(cardLine(g).out).toContain("reviewed twice");
    }, "greptile-step-twice-");
  }, 300_000);

  test("a word that settles the step is not a word for another", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { exit: 1, err: "Not signed in.\n" });
      expect(step(g).code).toBe(3);
      rule(g, "go-on");
      expect(step(g).code).toBe(3);
      expect(calls(g).length).toBe(1);
    }, "greptile-step-nomore-");
  });
});

describe("a step that is cut short", () => {
  test("is picked up from what it left, never started a second time", () => {
    withTempDir((root) => {
      const g = project(root);
      behave(g, { out: report(TWO) });
      expect(step(g).code).toBe(2);
      // Cut short after the adapter ended and before the step recorded its result.
      const path = join(g.dispatch, "actions.jsonl");
      const kept = readFileSync(path, "utf8")
        .split("\n")
        .filter((line) => !line.includes("review-harvest") && !line.includes("review-finish"))
        .join("\n");
      writeFileSync(path, kept);
      rmSync(join(g.dispatch, "ESCALATION.md"), { force: true });
      const picked = step(g);
      expect(picked.code).toBe(2);
      expect(firstLine(picked)).toContain("FAILED greptile round 1: 2 findings");
      expect(calls(g).length).toBe(1);
      expect(rowsOf(g, "review-harvest").length).toBe(1);
      expect(existsSync(join(g.dispatch, "ESCALATION.md"))).toBe(true);
    }, "greptile-step-pickup-");
  });

  test("with no record of its wait is a miss, not a second review", () => {
    withTempDir((root) => {
      const g = project(root);
      logged(g, "review-launch", "greptile", "greptile round 1");
      const r = step(g);
      expect(r.code).toBe(3);
      expect(firstLine(r)).toContain("left no record of its wait");
      expect(calls(g)).toEqual([]);
      expect(decide(g, 1).out.trim()).toBe("RULING greptile-missed");
    }, "greptile-step-norecord-");
  });

  test("after the machine restarted is a miss, not a second review", () => {
    withTempDir((root) => {
      const g = project(root);
      // A boot id is read with sysctl on a Mac, which the fixture's short PATH does not hold.
      g.env.PATH = `${g.env.PATH}:/usr/sbin:/sbin`;
      logged(g, "review-launch", "greptile", "greptile round 1");
      writeFileSync(
        `${prefixOf(g, 1)}.json`,
        `${JSON.stringify({ round: 1, head: g.snap, base: g.base, boot: "another-boot", limit: 60, deadline: 0, started: "" })}\n`,
      );
      const r = step(g);
      expect(r.code).toBe(3);
      expect(firstLine(r)).toContain("the machine restarted");
      expect(calls(g)).toEqual([]);
    }, "greptile-step-reboot-");
  });
});

describe("a step with no word to run", () => {
  test("is refused for a waybill that names no greptile", () => {
    withTempDir((root) => {
      const g = greptileMachine(root, { turnpikes: "style bug security" });
      const r = step(g);
      expect(r.code).toBe(1);
      expect(r.err).toContain("the waybill names no greptile");
      expect(calls(g)).toEqual([]);
      expect(rowsOf(g, "review-launch")).toEqual([]);
    }, "greptile-step-unnamed-");
  });

  test("is refused for a tree that holds less than the run changed, with nothing logged", () => {
    withTempDir((root) => {
      const g = project(root);
      writeFileSync(join(g.synthesis, "later.txt"), "not committed\n");
      const r = step(g);
      expect(r.code).toBe(1);
      expect(r.err).toContain("has files git sees that its commit does not hold");
      expect(calls(g)).toEqual([]);
      expect(rowsOf(g, "review-launch")).toEqual([]);
    }, "greptile-step-dirty-");
  });

  test("is refused as a usage fault when its arguments are wrong", () => {
    for (const args of [
      [],
      ["run"],
      ["run", "a", "b"],
      ["frob", "a"],
      ["gate"],
      ["gate", "a", "b"],
    ]) {
      const r = run(RUN, ["greptile-step", ...args]);
      expect(r.code).toBe(1);
      expect(r.err).toContain("usage: run greptile-step");
    }
  });
});

describe("the gate before the ship card", () => {
  test("is clear for a waybill that names no greptile, whatever the log holds", () => {
    withTempDir((root) => {
      const g = greptileMachine(root, { turnpikes: "style bug security" });
      logged(g, "review-launch", "greptile", "greptile round 1");
      const gated = gate(g);
      expect(gated.code).toBe(0);
      expect(gated.out).toContain("the waybill names no Greptile review");
    }, "greptile-step-gate-unnamed-");
  });

  test("holds a waybill that names it when no step has run", () => {
    withTempDir((root) => {
      const g = project(root);
      const gated = gate(g);
      expect(gated.code).toBe(1);
      expect(gated.out).toContain("held: the waybill names greptile and no Greptile step has run");
    }, "greptile-step-gate-none-");
  });

  test("holds a card when the log shows the step launched and nothing more", () => {
    withTempDir((root) => {
      const g = project(root);
      logged(g, "review-launch", "greptile", "greptile round 1");
      expect(gate(g).out).toContain("has no result");
    }, "greptile-step-gate-launched-");
  });
});
