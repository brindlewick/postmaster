import { describe, expect, test } from "bun:test";
import {
  incidentCandidates,
  inWindow,
  parseActions,
  parseCostLines,
  parseFinding,
  parseOracle,
  parseReviewHarvest,
  parseReviewRef,
  parseReviewReport,
  parseShares,
  parseSynthesis,
  parseUsageName,
  parseVerify,
  secondsBetween,
  splitByLane,
  stageSpans,
} from "./parse.ts";

const action = (ts: string, actor: string, name: string, target = "", detail = "") =>
  JSON.stringify({ ts, project: "p", run: "r", actor, action: name, target, detail });

describe("parseActions", () => {
  test("reads each action and counts a line that is not one", () => {
    const source = [
      action("2026-10-03T00:00:00Z", "coachman", "note", "x", "y"),
      "",
      "not json",
      JSON.stringify({ ts: "2026-10-03T00:00:01Z" }),
      JSON.stringify(["array"]),
    ].join("\n");
    const { actions, bad } = parseActions(source);
    expect(actions.length).toBe(1);
    expect(bad).toBe(3);
    expect(actions[0]?.detail).toBe("y");
  });

  test("a clean file has no bad line", () => {
    expect(parseActions(`${action("2026-10-03T00:00:00Z", "a", "b")}\n`).bad).toBe(0);
  });
});

describe("time", () => {
  test("seconds between two timestamps", () => {
    expect(secondsBetween("2026-10-03T00:00:00Z", "2026-10-03T01:02:03Z")).toBe(3723);
  });

  test("the window is inclusive at both ends and excludes outside", () => {
    const since = "2026-09-30T15:40:00Z";
    const until = "2026-10-03T15:40:00Z";
    expect(inWindow("2026-09-30T15:40:00Z", since, until)).toBe(true);
    expect(inWindow("2026-10-03T15:40:00Z", since, until)).toBe(true);
    expect(inWindow("2026-09-30T15:39:59Z", since, until)).toBe(false);
    expect(inWindow("2026-10-03T15:40:01Z", since, until)).toBe(false);
  });
});

describe("stageSpans", () => {
  const rows = parseActions(
    [
      action("2026-10-03T00:00:00Z", "postmaster", "dispatch", "#1", "leg 1"),
      action("2026-10-03T00:01:00Z", "coachman", "stage", "bootstrapped"),
      action("2026-10-03T00:11:00Z", "coachman", "stage", "planning"),
      action("2026-10-03T01:11:00Z", "postmaster", "stage", "done"),
    ].join("\n"),
  ).actions;

  test("a stage ends at the next, dispatched starts at the dispatch, the last has no span", () => {
    expect(stageSpans(rows)).toEqual([
      { stage: "dispatched", at: "2026-10-03T00:00:00Z", seconds: 60 },
      { stage: "bootstrapped", at: "2026-10-03T00:01:00Z", seconds: 600 },
      { stage: "planning", at: "2026-10-03T00:11:00Z", seconds: 3600 },
      { stage: "done", at: "2026-10-03T01:11:00Z", seconds: null },
    ]);
  });

  test("a log with no stage line has no spans", () => {
    expect(stageSpans(rows.filter((r) => r.action !== "stage"))).toEqual([]);
  });
});

const LINE_200 =
  "SYNTHESIS: ranked=mimo,astra took=mimo:confinement table+wrap, launch wiring, battery;astra:nothing (walled with no implementation) rejected=mimo:degrade verb for fallback, start-checked form basis=single producing lane judged line by line oracle=mimo:pass,astra:fail";

describe("parseSynthesis", () => {
  test("reads the ranking, takes, rejections, basis and oracle", () => {
    const s = parseSynthesis(`- 02:05:08Z ${LINE_200}\n`);
    expect(s?.ranked).toEqual(["mimo", "astra"]);
    expect(s?.took.mimo).toBe("confinement table+wrap, launch wiring, battery");
    expect(s?.took.astra).toBe("nothing (walled with no implementation)");
    expect(s?.rejected.mimo).toBe("degrade verb for fallback, start-checked form");
    expect(s?.basis).toBe("single producing lane judged line by line");
    expect(s?.oracle?.mimo?.passed).toBe(true);
    expect(s?.oracle?.astra?.passed).toBe(false);
  });

  test("a rejected field may name both lanes", () => {
    const s = parseSynthesis(
      "SYNTHESIS: ranked=luna,mimo took=luna:a;mimo:b rejected=mimo:x;luna:y z basis=probes oracle=none",
    );
    expect(s?.rejected).toEqual({ mimo: "x", luna: "y z" });
    expect(s?.oracle).toBeNull();
  });

  test("text with no SYNTHESIS line reads as none", () => {
    expect(parseSynthesis("- 02:05:08Z SHARES: code runs=1")).toBeNull();
  });

  test("the first line wins when a later leg restates it", () => {
    const s = parseSynthesis(
      `${LINE_200}\nSYNTHESIS: ranked=astra,mimo took=astra:x basis=y oracle=none`,
    );
    expect(s?.ranked).toEqual(["mimo", "astra"]);
  });
});

describe("splitByLane", () => {
  test("splits on a lane name followed by a colon, not on a colon inside the text", () => {
    expect(splitByLane("luna:host.sh-leg: x;mimo:y", ["luna", "mimo"])).toEqual({
      luna: "host.sh-leg: x",
      mimo: "y",
    });
  });
});

describe("parseOracle", () => {
  test("pass, fail and counts, with a trailing journey note and parenthetical dropped", () => {
    expect(parseOracle("luna:12/12,mimo:11/14 (restated from checkpoint-1.md) | none")).toEqual({
      luna: { raw: "12/12", passed: true, counts: [12, 12] },
      mimo: { raw: "11/14", passed: false, counts: [11, 14] },
    });
  });

  test("none, with or without a reason, is no oracle", () => {
    expect(parseOracle("none")).toBeNull();
    expect(parseOracle("none: design question IS the interface")).toBeNull();
    expect(parseOracle("")).toBeNull();
  });
});

describe("parseShares", () => {
  const line =
    "SHARES: code runs=4236 lane:astra=0/4236 lane:mimo=2707/4236 shared=0/4236 neither=1529/4236 | docs runs=203 lane:astra=0/203 lane:mimo=183/203 shared=0/203 neither=20/203";

  test("reads each kind's counts", () => {
    expect(parseShares(line)).toEqual({
      code: { runs: 4236, lanes: { astra: 0, mimo: 2707 }, shared: 0, neither: 1529 },
      docs: { runs: 203, lanes: { astra: 0, mimo: 183 }, shared: 0, neither: 20 },
    });
  });

  test("a line with no SHARES reads as none", () => {
    expect(parseShares("SYNTHESIS: ranked=a,b")).toBeNull();
  });
});

describe("parseFinding", () => {
  test("joined lens-lane pairs, as the newest runs write them", () => {
    const f = parseFinding(
      "gating P2 r1 bug-astra,style-astra,security-opus:host /proc covers the namespaced one:verified by execution",
    );
    expect(f.class).toBe("gating");
    expect(f.severity).toBe("P2");
    expect(f.round).toBe(1);
    expect(f.lanes).toEqual(["astra", "opus"]);
    expect(f.lenses).toEqual(["bug", "style", "security"]);
    expect(f.pairs).toEqual([
      ["bug", "astra"],
      ["style", "astra"],
      ["security", "opus"],
    ]);
  });

  test("a finding one reviewer made reads as one lane", () => {
    const f = parseFinding(
      "gating P2 r1 security-opus:kill 0 reaches the launcher group:verified by execution",
    );
    expect(f.lanes).toEqual(["opus"]);
  });

  test("slash pairs", () => {
    const f = parseFinding(
      "gating P2 r1 style/luna style/mimo bug/mimo: AC5 probe greps whole host.sh; verified by execution",
    );
    expect(f.lanes).toEqual(["luna", "mimo"]);
    expect(f.pairs).toEqual([
      ["style", "luna"],
      ["style", "mimo"],
      ["bug", "mimo"],
    ]);
  });

  test("a lens followed by several lanes, repeated for the next lens", () => {
    const f = parseFinding("gating P2 r1 bug sol mimo style sol mimo, verified by execution");
    expect(f.lanes).toEqual(["sol", "mimo"]);
    expect(f.pairs).toEqual([
      ["bug", "sol"],
      ["bug", "mimo"],
      ["style", "sol"],
      ["style", "mimo"],
    ]);
  });

  test("lenses listed before lanes are not paired, but the lanes are still read", () => {
    const f = parseFinding(
      "gating P2 r1 bug style luna mimo mimo, verified by reading: step-8 falls back",
    );
    expect(f.lanes).toEqual(["luna", "mimo"]);
    expect(f.lenses).toEqual(["bug", "style"]);
    expect(f.pairs).toBeNull();
  });

  test("words in the summary are not sources: reading stops at the first other word", () => {
    const f = parseFinding(
      "gating P2 r1 bug mimo, verified by execution: a style P1 finding keeps the loop going for luna",
    );
    expect(f.lanes).toEqual(["mimo"]);
    expect(f.lenses).toEqual(["bug"]);
  });

  test("a colon after the sources ends them even when the summary starts with a lane's name", () => {
    const f = parseFinding(
      "gating P3 r4 bug-sol:relative PATH plus planted mechanism binary hijacks the spawn",
    );
    expect(f.lanes).toEqual(["sol"]);
  });

  test("a colon joins a lens to its lane, and ends the sources only after a lane", () => {
    const f = parseFinding(
      "gating P2 r2 bug:sol,bug:mimo verified by execution; round-1 bound made files unloadable",
    );
    expect(f.lanes).toEqual(["sol", "mimo"]);
    expect(f.pairs).toEqual([
      ["bug", "sol"],
      ["bug", "mimo"],
    ]);
    expect(
      parseFinding("gating P1 r1 bug:luna verified by reading: spec-session handle reuses spec")
        .lanes,
    ).toEqual(["luna"]);
  });

  test("sources written at the end of the line are read when the head names none", () => {
    expect(parseFinding("gating P1 r10: bun run check exits 1 at HEAD; luna mimo").lanes).toEqual([
      "luna",
      "mimo",
    ]);
    expect(parseFinding("gating P2 r10: Nd match skew U+10D40; luna").lanes).toEqual(["luna"]);
  });

  test("a line whose text names no lane stays unattributed", () => {
    expect(parseFinding("gating P2 r1 bug+style lenses, verified by execution").lanes).toEqual([]);
  });

  test("the coachman's own finding names it after a note of the card, before the colon", () => {
    const f = parseFinding(
      "gating P1 card-withheld coachman: withPinLock waits 120s on the bash flow's empty lock",
    );
    expect(f.lanes).toEqual(["coachman"]);
  });

  test("the coachman may be the source", () => {
    const f = parseFinding(
      "gating r5 coachman execution: round-5 P2 fixes ANSI strip, merge names",
    );
    expect(f.lanes).toEqual(["coachman"]);
    expect(f.round).toBe(5);
  });

  test("style class and DISMISSED are read", () => {
    const f = parseFinding("style P3 r1 style/mimo: header enumerates every stripped name");
    expect(f.class).toBe("style");
    expect(f.dismissed).toBe(false);
    expect(
      parseFinding("gating P2 round1 style/mimo bug/mimo execution DISMISSED: x").dismissed,
    ).toBe(true);
  });

  test("how a finding was verified, in either wording", () => {
    expect(parseFinding("gating P2 r1 bug-astra:summary:verified by execution").verified).toBe(
      "execution",
    );
    expect(parseFinding("gating P3 r1 bug mimo execution: nested numbered line").verified).toBe(
      "execution",
    );
    expect(parseFinding("gating P3 r1 style mimo, verified by reading: a header").verified).toBe(
      "reading",
    );
    expect(
      parseFinding(
        "gating P3 r1 bug luna mimo, security opus concurring by reading; verified by execution",
      ).verified,
    ).toBe("execution");
    expect(parseFinding("gating P2 r1 bug sol, style sol, verified by execution").verified).toBe(
      "execution",
    );
    expect(parseFinding("gating P2 r1 bug mimo: text with neither").verified).toBeNull();
  });

  test("a line with no source names none", () => {
    const f = parseFinding("gating P2 r1, verified by execution");
    expect(f.lanes).toEqual([]);
    expect(f.pairs).toBeNull();
  });
});

describe("parseVerify", () => {
  test("reads the ref, commit, result, exit and seconds", () => {
    expect(parseVerify("gate", "on=wb/200-mimo@d835e95feaaa result=pass exit=0 secs=850")).toEqual({
      name: "gate",
      ref: "wb/200-mimo",
      sha: "d835e95feaaa",
      result: "pass",
      exit: 0,
      seconds: 850,
    });
  });

  test("a failing result and a line that is not a verify", () => {
    expect(parseVerify("gate", "on=200@abc123 result=fail exit=1 secs=3")?.result).toBe("fail");
    expect(parseVerify("gate", "review round 1, verify.sh exit 0")).toBeNull();
  });
});

describe("review lines", () => {
  test("lens and round from either wording", () => {
    expect(parseReviewRef("style round 1 thread x")).toEqual({ lens: "style", round: 1 });
    expect(parseReviewRef("bug r5 thread x")).toEqual({ lens: "bug", round: 5 });
    expect(parseReviewRef("security round 3, thread x")).toEqual({ lens: "security", round: 3 });
    expect(parseReviewRef("pre-round gate")).toEqual({ lens: null, round: null });
  });

  test("the round in the shapes the older runs wrote it", () => {
    expect(parseReviewRef("lens=bug round=8")).toEqual({ lens: "bug", round: 8 });
    expect(parseReviewRef("lens=bug round=11 attempt=2")).toEqual({ lens: "bug", round: 11 });
    expect(
      parseReviewRef("review round 12: bug luna+mimo via review form, security opus via skill"),
    ).toEqual({ lens: "bug", round: 12 });
    expect(parseReviewRef('{"lens":"bug","round":5,"thread":"x","findings":"1 P2"}')).toEqual({
      lens: "bug",
      round: 5,
    });
    expect(parseReviewRef("r2 security tid f34e4775")).toEqual({ lens: "security", round: 2 });
    expect(parseReviewRef("sol round 1")).toEqual({ lens: null, round: 1 });
    expect(parseReviewRef("round 10: P2x5 P3x2, all reproduced")).toEqual({
      lens: null,
      round: 10,
    });
  });

  test("a line that names no round reads as none, with the lens it names", () => {
    expect(parseReviewRef("bug luna+mimo: P1x2 P2x7 after adjudication")).toEqual({
      lens: "bug",
      round: null,
    });
    expect(parseReviewRef("")).toEqual({ lens: null, round: null });
  });

  test("a harvest: verdict and the findings it counts", () => {
    expect(parseReviewHarvest("bug round 1 thread x DEGRADED no verdict")).toEqual({
      lens: "bug",
      round: 1,
      verdict: "degraded",
      raw: null,
    });
    expect(parseReviewHarvest("style round 1, thread x, REVIEWED, 6 findings").raw).toBe(6);
    expect(parseReviewHarvest("bug r5 thread x REVIEWED 1P2+1P3").raw).toBe(2);
    expect(parseReviewHarvest("security round 1, thread x, REVIEWED, CLEAN with 1 note").raw).toBe(
      0,
    );
    expect(parseReviewHarvest("bug round 4 thread x REVIEWED")).toEqual({
      lens: "bug",
      round: 4,
      verdict: "reviewed",
      raw: null,
    });
  });
});

describe("parseUsageName", () => {
  test("a reviewer's file names its lens and round, a workhorse's and a coachman's do not", () => {
    expect(parseUsageName("review-r2-bug-astra-usage.json")).toEqual({
      role: "reviewer",
      lens: "bug",
      round: 2,
    });
    expect(parseUsageName("review-r1-security-opus-usage.json")?.lens).toBe("security");
    expect(parseUsageName("mimo-events-usage.json")?.role).toBe("workhorse");
    expect(parseUsageName("coachman-leg-2-events-usage.json")?.role).toBe("coachman");
    expect(parseUsageName("review-r1.json")).toBeNull();
  });
});

describe("parseCostLines", () => {
  const out = [
    "cost: coachman review (muse): 36223586 in, 129964 out, cost not reported",
    "cost: reviewer astra (codex): 1150881 (3 of 4 launches) in, 10993 (3 of 4 launches) out, cost not reported",
    "cost: reviewer opus (claude): 62 in, 102299 out, $16.0902386",
    "cost: harness codex reports nothing",
  ].join("\n");

  test("reads each role and lane, with money only where it is reported", () => {
    const cost = parseCostLines(out);
    expect(cost.length).toBe(3);
    expect(
      cost.map((c) => [c.role, c.lane, c.inputTokens, c.outputTokens, c.costUsd, c.coverage]),
    ).toEqual([
      ["coachman", "review", 36223586, 129964, null, null],
      ["reviewer", "astra", 1150881, 10993, null, "3 of 4 launches"],
      ["reviewer", "opus", 62, 102299, 16.0902386, null],
    ]);
  });

  test("no cost line reads as none", () => {
    expect(parseCostLines("cost: no launch usage records")).toEqual([]);
  });
});

describe("incidentCandidates", () => {
  const kinds = (action: string, detail: string) =>
    incidentCandidates({ action, target: "", detail });

  test("a wall, a revoked login, an overload, a kill and a duplicate launch", () => {
    expect(kinds("harvest", "walled mid-run: usage limit, reset 2:29 AM")).toEqual(["wall"]);
    expect(kinds("degrade", "codex oauth token_revoked, 401 'Your session has ended'")).toEqual([
      "auth",
      "degraded",
    ]);
    expect(kinds("degrade", "claude API 529 overloaded, no review performed")).toContain(
      "overload",
    );
    expect(kinds("note", "coachman killed by the host's memory cap")).toEqual(["kill"]);
    expect(kinds("note", "restart after the 12:03Z memory-cap kill")).toEqual(["kill"]);
    expect(kinds("note", "bug round 5: OOM-killed (MemoryMax=8G) before its verdict")).toEqual([
      "kill",
    ]);
    expect(kinds("note", "duplicate launch terminated; single lane continues")).toEqual([
      "duplicate-launch",
    ]);
  });

  test("a note that only mentions raising the memory cap is no candidate", () => {
    expect(kinds("note", "coachman memory cap raised to 16G in run.json and live")).toEqual([]);
  });

  test("an ordinary action is no candidate, and a degrade always is", () => {
    expect(kinds("verify", "on=200@abc result=pass exit=0 secs=850")).toEqual([]);
    expect(kinds("degrade", "exited with no verdict")).toEqual(["degraded"]);
  });
});

describe("parseReviewReport", () => {
  const card = [
    "# Checkpoint review: #200",
    "- [P2] bug-1: closed round 1",
    "- [P3] bug-2: open",
    "- [P2] bug-10: dismissed: darwin-only, unverifiable on Linux",
    "- [P3] style-2: closed round 1",
    "- [P2] security-1: closed round 1",
    "prose that mentions [P2] bug-3: closed round 1 is not a list line",
  ].join("\n");

  test("reads each judged finding's severity, lens and status", () => {
    expect(parseReviewReport(card)).toEqual([
      { severity: "P2", lens: "bug", status: "closed" },
      { severity: "P3", lens: "bug", status: "open" },
      { severity: "P2", lens: "bug", status: "dismissed" },
      { severity: "P3", lens: "style", status: "closed" },
      { severity: "P2", lens: "security", status: "closed" },
    ]);
  });

  test("an older card with no list reads as none", () => {
    expect(parseReviewReport("## Bug lens\n\nRound 1, four verified.\n")).toEqual([]);
  });
});
