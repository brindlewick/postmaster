// Oracle for #607, committed before the change: a reviewer may start helpers, and a lane the
// harness cut off with helpers still running is reported as not reviewed. C1 pins the printed
// forms (a Claude lane waits for its helpers, no role does); C2 what a launch hands the harness;
// C3 the marker a launch leaves beside a cut-off stream; C4 the round's wait, its degrade row and
// what review-decide makes of it; C5 the surveyor's refusal. Every case drives scripts/run as a
// subprocess with stand-in harnesses. The stand-in streams are invented (acceptance-607.ts).
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  makeSurveyLayout,
  patchRunJson,
  readActions as readSurveyActions,
  removeDir,
  scratchDir,
  setStub as setSurveyStub,
  surveyor,
  writeText,
} from "./acceptance-429.ts";
import {
  addClaudeLanes,
  claudeInit,
  claudeResult,
  claudeStub,
  CUTOFF_CAUSE,
  cutOffEvents,
  finishedEvents,
  helperNotice,
  helperStarted,
  logsOf,
  reviewerFiles,
  ROOT,
  RUN,
  statusOnlyEvents,
  TEAM_TOML,
  WAIT_VAR,
  waitsSeen,
  writeInertBins,
} from "./acceptance-607.ts";
import {
  CLAUDE_WALL_MESSAGE,
  codexDone,
  codexThread,
  launchStep,
  makeLayout,
  mkScratch,
  mkWt,
  need,
  readActions,
  setStub,
  sh,
} from "./walls-oracle.ts";
import type { Layout } from "./walls-oracle.ts";

function oracle(name: string, fn: (lay: Layout) => void, timeout = 120000): void {
  test(
    name,
    () => {
      const lay = makeLayout(ROOT);
      try {
        fn(lay);
      } finally {
        lay.cleanup();
      }
    },
    timeout,
  );
}

// --- C1: the printed forms --------------------------------------------------------------

describe("C1: the printed forms", () => {
  function form(args: string[]): { code: number; out: string; err: string } {
    const tmp = scratchDir("cutoff-forms-");
    try {
      writeInertBins(join(tmp, "bin"));
      const config = join(tmp, "team.toml");
      writeFileSync(config, TEAM_TOML);
      const env: Record<string, string | undefined> = {
        ...process.env,
        PATH: `${join(tmp, "bin")}:${process.env.PATH ?? ""}`,
        POSTMASTER_CONFIG: config,
      };
      delete env[WAIT_VAR];
      return sh(RUN, ["launch", "form", ...args], env, tmp);
    } finally {
      removeDir(tmp);
    }
  }

  test("a Claude lane's launch and resume forms carry the wait for its helpers, set to 0", () => {
    const r = form(["fruit"]);
    expect(r.code).toBe(0);
    const lines = r.out.split("\n").filter((l) => l !== "");
    expect(lines.length).toBe(2);
    const launch = `launch: cd <cwd> && env ${WAIT_VAR}=0 claude -p `;
    const resume = `resume: cd <cwd> && env ${WAIT_VAR}=0 claude -p --resume `;
    expect(lines[0]?.slice(0, launch.length)).toBe(launch);
    expect(lines[1]?.slice(0, resume.length)).toBe(resume);
  });

  test("a lane on another harness carries no such wait", () => {
    const r = form(["pear"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("codex exec");
    expect(r.out).not.toContain(WAIT_VAR);
  });

  test("a coachman leg, its fallback, the clerk and the postmaster carry none, on the same harness", () => {
    for (const args of [
      ["coachman", "--leg", "synthesis"],
      ["coachman", "--leg", "review"],
      ["coachman", "--leg", "ship"],
      ["coachman_fallback"],
      ["clerk"],
      ["postmaster"],
    ]) {
      const r = form(args);
      expect(r.code).toBe(0);
      expect(r.out).toContain("&& claude -p ");
      expect(r.out).not.toContain(WAIT_VAR);
    }
  });
});

// --- C2: what a launch hands the harness -------------------------------------------------

describe("C2: what a launch hands the harness", () => {
  oracle(
    "a reviewer launched through the host is handed the wait set to 0, over the caller's own",
    (lay) => {
      const seen = claudeStub(lay, finishedEvents("s-wait"));
      lay.env[WAIT_VAR] = "900000";
      const f = reviewerFiles(1, "security", "sec");
      launchStep(ROOT, lay, {
        lane: "sec",
        role: "reviewer",
        form: "launch",
        stream: f.stream,
        marker: f.done,
        cwd: mkWt(lay, "wt-wait"),
      });
      expect(waitsSeen(seen)).toEqual(["0"]);
    },
  );

  oracle("a workhorse lane is handed it too", (lay) => {
    const seen = claudeStub(lay, finishedEvents("s-work"));
    launchStep(ROOT, lay, {
      lane: "sec",
      role: "lane",
      form: "launch",
      stream: "sec-events.jsonl",
      marker: "sec.done",
      cwd: mkWt(lay, "wt-work"),
    });
    expect(waitsSeen(seen)).toEqual(["0"]);
  });

  oracle("a bug review, which runs the harness's review command, is handed it too", (lay) => {
    const seen = claudeStub(lay, finishedEvents("s-bug"));
    const scratch = mkScratch(lay, "rev-bug");
    const f = reviewerFiles(1, "bug", "sec");
    launchStep(ROOT, lay, {
      lane: "sec",
      role: "reviewer",
      form: "review",
      stream: f.stream,
      marker: f.done,
      cwd: scratch.wt,
      base: scratch.base,
    });
    expect(waitsSeen(seen)).toEqual(["0"]);
  });

  oracle("a coachman leg is not handed it: the caller's own value is all it sees", (lay) => {
    const seen = claudeStub(lay, finishedEvents("s-coach"));
    const config = join(lay.tmp, "team.toml");
    writeFileSync(config, TEAM_TOML);
    const prompt = join(lay.tmp, "coach-prompt.txt");
    writeFileSync(prompt, "Drive the leg.\n");
    const envWith = (extra: Record<string, string>): Record<string, string | undefined> => {
      const base: Record<string, string | undefined> = { ...lay.env, POSTMASTER_CONFIG: config };
      delete base[WAIT_VAR];
      return { ...base, ...extra };
    };
    const leg = (tag: string, env: Record<string, string | undefined>) =>
      sh(
        RUN,
        ["launch", "launch", "coachman", mkWt(lay, `wt-coach-${tag}`), prompt, "--leg", "review"],
        env,
        lay.tmp,
      );
    expect(leg("a", envWith({ [WAIT_VAR]: "900000" })).code).toBe(0);
    expect(leg("b", envWith({})).code).toBe(0);
    expect(waitsSeen(seen)).toEqual(["900000", "unset"]);
  });
});

// --- C3: the marker a launch leaves ------------------------------------------------------

describe("C3: the marker a launch leaves beside its stream", () => {
  function reviewed(lay: Layout, lens: string, lane: string, events: string[]): string {
    claudeStub(lay, events);
    const f = reviewerFiles(1, lens, lane);
    launchStep(ROOT, lay, {
      lane,
      role: "reviewer",
      form: "launch",
      stream: f.stream,
      marker: f.done,
      cwd: mkWt(lay, `wt-${lens}-${lane}`),
    });
    return join(logsOf(lay.dispatch), f.cutoff);
  }

  oracle("a stream whose helper the harness stopped leaves a marker naming the count", (lay) => {
    const marker = reviewed(lay, "security", "sec", cutOffEvents("s-cut"));
    expect(existsSync(marker)).toBe(true);
    expect(readFileSync(marker, "utf8")).toBe("1 helper stopped before it reported\n");
  });

  oracle("a stream whose helper reported leaves none", (lay) => {
    expect(existsSync(reviewed(lay, "security", "sec", finishedEvents("s-whole")))).toBe(false);
  });

  oracle("a lane that ends on a short status line with no helper leaves none", (lay) => {
    expect(existsSync(reviewed(lay, "security", "sec", statusOnlyEvents("s-status")))).toBe(false);
  });

  oracle("a stopped background shell is not a cut-off helper", (lay) => {
    const events = [
      claudeInit("s-shell"),
      helperStarted("b1", "local_bash"),
      helperNotice("b1", "stopped"),
      claudeResult({ text: "Done." }),
    ];
    expect(existsSync(reviewed(lay, "security", "sec", events))).toBe(false);
  });

  oracle("a launch on another harness is not read, whatever its stream holds", (lay) => {
    setStub(
      lay,
      "codex",
      [codexThread("t-codex"), ...cutOffEvents("s-x").slice(1), codexDone()],
      0,
    );
    const f = reviewerFiles(1, "security", "stub");
    launchStep(ROOT, lay, {
      lane: "stub",
      role: "reviewer",
      form: "launch",
      stream: f.stream,
      marker: f.done,
      cwd: mkWt(lay, "wt-codex"),
    });
    expect(existsSync(join(logsOf(lay.dispatch), f.cutoff))).toBe(false);
  });

  oracle(
    "a later whole launch of the same stream removes the marker an earlier one left",
    (lay) => {
      const marker = reviewed(lay, "security", "sec", cutOffEvents("s-first"));
      expect(existsSync(marker)).toBe(true);
      reviewed(lay, "security", "sec", finishedEvents("s-second"));
      expect(existsSync(marker)).toBe(false);
    },
  );
});

// --- C4: the round -----------------------------------------------------------------------

describe("C4: the round", () => {
  function reviewRound(lay: Layout, args: string[]): { code: number; out: string; err: string } {
    return sh(RUN, ["review-round", ...args], lay.env, lay.tmp);
  }

  function startRound(lay: Layout, pairs: string[]): void {
    need(reviewRound(lay, ["start", lay.dispatch, "1", ...pairs]), "start the round");
  }

  function launched(lay: Layout, lens: string, lane: string, events: string[]): void {
    claudeStub(lay, events);
    const f = reviewerFiles(1, lens, lane);
    launchStep(ROOT, lay, {
      lane,
      role: "reviewer",
      form: "launch",
      stream: f.stream,
      marker: f.done,
      cwd: mkWt(lay, `wt-${lens}-${lane}`),
    });
    need(
      sh(
        RUN,
        ["log-action", lay.dispatch, "coachman", "review-launch", lane, `${lens} round 1`],
        lay.env,
        lay.tmp,
      ),
      "log the launch",
    );
  }

  const degrades = (lay: Layout): Array<{ target: string; detail: string }> =>
    readActions(lay.dispatch)
      .filter((a) => a.action === "degrade")
      .map((a) => ({ target: a.target, detail: a.detail }));

  const runLog = (lay: Layout): string => readFileSync(join(lay.dispatch, "run-log.md"), "utf8");

  const decide = (lay: Layout): string =>
    sh(RUN, ["review-decide", lay.dispatch, "1", "--cause"], lay.env, lay.tmp).out.trim();

  oracle(
    "wait-next reports a cut-off reviewer finished and DEGRADED, and a whole one finished",
    (lay) => {
      addClaudeLanes(lay.dispatch, ["plum"]);
      startRound(lay, ["security:sec", "style:plum"]);
      launched(lay, "security", "sec", cutOffEvents("s-sec"));
      launched(lay, "style", "plum", finishedEvents("s-plum"));
      const w = reviewRound(lay, ["wait-next", lay.dispatch, "1", lay.repo]);
      expect(w.code).toBe(0);
      expect(w.out).toContain("FINISHED security sec");
      expect(w.out).toContain("FINISHED style plum");
      expect(w.out).toContain(`CUTOFF security sec: DEGRADED, ${CUTOFF_CAUSE}`);
      expect(w.out).not.toContain("CUTOFF style plum");
      expect(degrades(lay)).toEqual([{ target: "sec", detail: `security r1: ${CUTOFF_CAUSE}` }]);
      expect(runLog(lay)).toContain(`sec security: DEGRADED, ${CUTOFF_CAUSE}`);
      expect(runLog(lay)).not.toContain("plum style: DEGRADED");
    },
  );

  oracle("the next wait-next does not record the same reviewer twice", (lay) => {
    startRound(lay, ["security:sec"]);
    launched(lay, "security", "sec", cutOffEvents("s-once"));
    expect(reviewRound(lay, ["wait-next", lay.dispatch, "1", lay.repo]).code).toBe(0);
    const again = reviewRound(lay, ["wait-next", lay.dispatch, "1", lay.repo]);
    expect(again.code).toBe(0);
    expect(degrades(lay).length).toBe(1);
  });

  oracle("wait gives the same row for a cut-off reviewer and none for a whole one", (lay) => {
    addClaudeLanes(lay.dispatch, ["plum"]);
    startRound(lay, ["security:sec", "style:plum"]);
    launched(lay, "security", "sec", cutOffEvents("s-sec"));
    launched(lay, "style", "plum", statusOnlyEvents("s-plum"));
    const w = reviewRound(lay, ["wait", lay.dispatch, "1", lay.repo, "security:sec", "style:plum"]);
    expect(w.code).toBe(0);
    expect(w.out).toContain(`CUTOFF security sec: DEGRADED, ${CUTOFF_CAUSE}`);
    expect(degrades(lay)).toEqual([{ target: "sec", detail: `security r1: ${CUTOFF_CAUSE}` }]);
  });

  oracle("review-decide counts a cut-off security reviewer as no working reviewer", (lay) => {
    startRound(lay, ["security:sec"]);
    launched(lay, "security", "sec", cutOffEvents("s-sec"));
    expect(reviewRound(lay, ["wait-next", lay.dispatch, "1", lay.repo]).code).toBe(0);
    expect(decide(lay)).toBe("RUN no-working-reviewer");
  });

  oracle("review-decide ends the same round on a whole security reviewer (the control)", (lay) => {
    startRound(lay, ["security:sec"]);
    launched(lay, "security", "sec", finishedEvents("s-sec"));
    expect(reviewRound(lay, ["wait-next", lay.dispatch, "1", lay.repo]).code).toBe(0);
    expect(degrades(lay)).toEqual([]);
    expect(decide(lay)).toBe("STOP no-fixes");
  });

  oracle(
    "a reviewer the provider walled and the harness cut off is one DEGRADED row, the wall's",
    (lay) => {
      const walled = JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: true,
        result: CLAUDE_WALL_MESSAGE,
        api_error_status: 429,
        subagent_stats: {
          spawned: 1,
          completed: 0,
          failed: 0,
          killed: { parent: 0, user: 0, system: 1 },
        },
      });
      startRound(lay, ["security:sec"]);
      launched(lay, "security", "sec", [
        claudeInit("s-wall"),
        helperStarted("h1"),
        helperNotice("h1", "stopped"),
        walled,
      ]);
      expect(
        existsSync(join(logsOf(lay.dispatch), reviewerFiles(1, "security", "sec").cutoff)),
      ).toBe(true);
      const w = reviewRound(lay, ["wait-next", lay.dispatch, "1", lay.repo]);
      expect(w.code).toBe(0);
      expect(w.out).toContain("WALL security sec: DEGRADED, provider wall");
      expect(w.out).not.toContain("CUTOFF");
      expect(degrades(lay).length).toBe(1);
      expect(degrades(lay)[0]?.detail).toContain("provider wall");
    },
  );

  oracle("starting a round clears its cut-off markers and leaves another round's", (lay) => {
    const logs = logsOf(lay.dispatch);
    const mine = join(logs, reviewerFiles(1, "security", "sec").cutoff);
    const other = join(logs, reviewerFiles(2, "security", "sec").cutoff);
    writeFileSync(mine, "1 helper stopped before it reported\n");
    writeFileSync(other, "1 helper stopped before it reported\n");
    startRound(lay, ["security:sec"]);
    expect(existsSync(mine)).toBe(false);
    expect(existsSync(other)).toBe(true);
  });
});

// --- C5: the surveyor --------------------------------------------------------------------

describe("C5: the surveyor", () => {
  function call(events: string[], name: string) {
    const lay = makeSurveyLayout();
    try {
      patchRunJson(lay.dispatch, { config: { team: { surveyor: "opus" } } });
      setSurveyStub(lay, "claude", { events, exit: 0 });
      const question = join(lay.tmp, "question.md");
      writeText(question, "# Question\n\nWhich shelf is emptiest?\n");
      const r = surveyor(lay, [
        "call",
        lay.dispatch,
        lay.repo,
        "--name",
        name,
        "--snapshot",
        lay.sha,
        "--question",
        question,
        "--timeout",
        "600",
      ]);
      const record = join(lay.dispatch, "surveys", `${name}.md`);
      return {
        code: r.code,
        record: existsSync(record) ? readFileSync(record, "utf8") : "",
        degrades: readSurveyActions(lay.dispatch).filter((a) => a.action === "degrade"),
        harvests: readSurveyActions(lay.dispatch).filter((a) => a.action === "harvest"),
      };
    } finally {
      lay.cleanup();
    }
  }

  test("a surveyor cut off with its helper running gives no answer, whatever its last message says", () => {
    const r = call(cutOffEvents("s-survey"), "shelf");
    expect(r.code).toBe(3);
    expect(r.record).toBe(`No answer: ${CUTOFF_CAUSE}.\n`);
    expect(r.degrades.length).toBe(1);
    expect(r.degrades[0]?.detail).toBe(`survey shelf: ${CUTOFF_CAUSE}`);
    expect(r.harvests.length).toBe(0);
  }, 300000);

  test("a surveyor whose helper reported is answered as before (the control)", () => {
    const r = call(finishedEvents("s-survey"), "shelf");
    expect(r.code).toBe(0);
    expect(r.record).toBe("No findings.\n");
    expect(r.degrades.length).toBe(0);
    expect(r.harvests.length).toBe(1);
  }, 300000);
});
