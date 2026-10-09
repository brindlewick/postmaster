import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseActions } from "./parse.ts";
import {
  discover,
  doneTime,
  findSynthesis,
  gateLane,
  laneTimes,
  privacyFaults,
  readCoachman,
  readReviewDone,
  readRun,
  readStreams,
  readTeam,
  readUsage,
  safeLane,
  scrub,
  type UsageReader,
} from "./records.ts";

const scratch = mkdtempSync(join(tmpdir(), "lane-audit-records-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

let counter = 0;
const folder = (): string => {
  counter += 1;
  const dir = join(scratch, `d${counter}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

const put = (dir: string, name: string, text: string): void => {
  mkdirSync(join(dir, name, ".."), { recursive: true });
  writeFileSync(join(dir, name), text);
};

const action = (ts: string, actor: string, name: string, target = "", detail = ""): string =>
  JSON.stringify({ ts, project: "p", run: "r", actor, action: name, target, detail });

describe("scrub", () => {
  test("takes out paths, ids, host spaces and long hashes", () => {
    const text =
      "see /home/someone/project/x.ts and ~/.cfg, thread 11111111-2222-4333-8444-555555555555, ses_AbCdEfGhIjKlMnOpQrStUvWx, host=h space=wZZ tab=wZZ:t1, " +
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const out = scrub(text);
    expect(privacyFaults(out)).toEqual([]);
    expect(out).toContain("<path>");
    expect(out).toContain("<id>");
    expect(out).toContain("<hash>");
    expect(out).toContain("space=<x>");
  });

  test("caps the length with an ellipsis and leaves short clean text alone", () => {
    expect(scrub("x".repeat(300), 50).length).toBe(50);
    expect(scrub("a  b\tc")).toBe("a b c");
  });
});

describe("privacyFaults", () => {
  test("names each kind of fault found, and nothing in clean text", () => {
    expect(privacyFaults("/home/someone/x")).toEqual(["a home or system path"]);
    expect(privacyFaults("at 11111111-2222-4333-8444-555555555555")).toEqual([
      "a thread or session id",
    ]);
    expect(privacyFaults("name.tail1234.ts.net")).toEqual(["a tailnet name"]);
    expect(privacyFaults("space=wZZ")).toEqual(["a host space"]);
    expect(
      privacyFaults("scripts/launch.ts:228 and wb/200-mimo, github.com/brindlewick/postmaster"),
    ).toEqual([]);
  });
});

describe("safeLane", () => {
  test("a plain name stays, text is scrubbed", () => {
    expect(safeLane("mimo")).toBe("mimo");
    expect(safeLane("round 7 bug:mimo session ses_ZyXwVuTsRqPoNmLkJiHgFeDc: 2 P2")).toContain(
      "<id>",
    );
  });
});

describe("discover", () => {
  test("finds project, legacy and fixture runs with an action log, and nothing else", () => {
    const root = folder();
    put(root, "proj/.postmaster/runs/200/actions.jsonl", "");
    put(root, "proj/.postmaster/runs/200-parked-20261002/actions.jsonl", "");
    put(root, "proj/.postmaster/runs/postmaster/actions.jsonl", "");
    put(root, "proj/.postmaster/runs/ledger.jsonl", "");
    put(root, "proj/.postmaster/runs/57/notes.txt", "no log");
    put(root, "legacy/109/actions.jsonl", "");
    put(root, "fx/todo-fixture-39/.postmaster/runs/1/actions.jsonl", "");
    put(root, "fx/todo-fixture-40/.postmaster/runs/postmaster/actions.jsonl", "");
    put(root, "fx/bare-name/.postmaster/runs/1/actions.jsonl", "");
    const found = discover({
      project: join(root, "proj"),
      legacy: join(root, "legacy"),
      fixtures: join(root, "fx"),
    }).map((s) => `${s.id} ${s.kind} ${s.layout} ${s.ticket}`);
    expect(found).toEqual([
      "200 real project 200",
      "200-parked-20261002 real project 200",
      "109 real legacy 109",
      "fixture-39 fixture fixture remove",
    ]);
  });

  test("a root that does not exist finds nothing", () => {
    expect(discover({ project: join(scratch, "nowhere") })).toEqual([]);
  });
});

describe("readTeam", () => {
  test("the lanes, their models, the lens reviewers and the contract", () => {
    const dir = folder();
    put(
      dir,
      "run.json",
      JSON.stringify({
        coachman_contract: 2,
        config: {
          lanes: {
            sol: { harness: "codex", model: "gpt-6-sol", effort: "max" },
            mimo: { harness: "mimo", model: "m", effort: "high" },
          },
          team: {
            workhorses: ["sol", "mimo"],
            reviewers: ["sol", "mimo"],
            lens_reviewers: { security: ["opus"] },
            coachman: { harness: "muse", model: "c", effort: "max" },
          },
        },
      }),
    );
    const team = readTeam(dir);
    expect(team?.workhorses).toEqual(["sol", "mimo"]);
    expect(team?.lensReviewers).toEqual({ security: ["opus"] });
    expect(team?.lanes.sol).toEqual({ harness: "codex", model: "gpt-6-sol", effort: "max" });
    expect(team?.coachman?.harness).toBe("muse");
    expect(team?.contract).toBe(2);
  });

  test("no run.json, or one without a config, gives no team", () => {
    expect(readTeam(folder())).toBeNull();
    const dir = folder();
    put(dir, "run.json", "{}");
    expect(readTeam(dir)).toBeNull();
  });
});

describe("laneTimes", () => {
  const actions = parseActions(
    [
      action("2026-10-03T08:17:53Z", "coachman", "dispatch", "sol", "thread"),
      action("2026-10-03T08:17:53Z", "coachman", "dispatch", "mimo", "thread"),
      action("2026-10-03T08:23:11Z", "coachman", "resume", "sol", "after a block"),
      action("2026-10-03T08:29:43Z", "coachman", "harvest", "sol", "summary present"),
      action("2026-10-03T08:29:43Z", "coachman", "harvest", "mimo", "summary present"),
    ].join("\n"),
  ).actions;

  test("a run with no spec round starts a lane at its first launch and ends at its exit marker", () => {
    const rows = laneTimes(actions, ["sol", "mimo"], { sol: "harvested" }, (lane) =>
      lane === "sol" ? "2026-10-03T08:21:12Z" : null,
    );
    expect([
      rows[0]?.lane,
      rows[0]?.specRound,
      rows[0]?.implementSeconds,
      rows[0]?.resumes,
    ]).toEqual(["sol", false, 199, 1]);
    expect(rows[1]?.implementSeconds).toBe(710);
  });

  test("a lane that wrote its own spec first starts at its first resume after the spec", () => {
    const spec = parseActions(
      [
        action("2026-09-30T10:12:35Z", "coachman", "dispatch", "luna"),
        action(
          "2026-09-30T10:35:11Z",
          "coachman",
          "harvest",
          "luna",
          "planned: spec abc, tree clean, no code",
        ),
        action(
          "2026-09-30T10:49:11Z",
          "coachman",
          "resume",
          "luna",
          "implement from approved shared spec",
        ),
        action("2026-09-30T11:33:53Z", "coachman", "harvest", "luna", "summary present"),
      ].join("\n"),
    ).actions;
    const row = laneTimes(spec, ["luna"], {})[0];
    expect(row?.specRound).toBe(true);
    expect(row?.implementFrom).toBe("2026-09-30T10:49:11Z");
    expect(row?.implementSeconds).toBe(2682);
  });

  test("a lane never launched has no times", () => {
    const row = laneTimes([], ["astra"], {})[0];
    expect([row?.firstLaunch, row?.implementSeconds]).toEqual([null, null]);
  });
});

describe("doneTime and readReviewDone", () => {
  test("a marker's mtime is the exit time, and none is none", () => {
    const dir = folder();
    put(dir, "logs/mimo.done", "");
    put(dir, "logs/review-r2-bug-astra.done", "");
    put(dir, "logs/review-r2-security-opus.done", "");
    put(dir, "logs/verify-mimo.done", "");
    const t = new Date("2026-10-03T01:26:50Z");
    for (const f of ["mimo.done", "review-r2-bug-astra.done", "review-r2-security-opus.done"]) {
      utimesSync(join(dir, "logs", f), t, t);
    }
    expect(doneTime(dir, "mimo")).toBe("2026-10-03T01:26:50Z");
    expect(doneTime(dir, "luna")).toBeNull();
    expect(readReviewDone(dir)).toEqual([
      { round: 2, lens: "bug", lane: "astra", done: "2026-10-03T01:26:50Z" },
      { round: 2, lens: "security", lane: "opus", done: "2026-10-03T01:26:50Z" },
    ]);
  });
});

describe("gateLane", () => {
  test("a lane branch names its lane, the synthesis and a scratch name name none", () => {
    expect(gateLane("wb/200-mimo", ["astra", "mimo"])).toBe("mimo");
    expect(gateLane("200", ["astra", "mimo"])).toBeNull();
    expect(gateLane("wb/200-nobody", ["astra", "mimo"])).toBeNull();
  });
});

describe("findSynthesis", () => {
  const lanes = ["sol", "mimo"];
  const buggy =
    "SYNTHESIS: ranked=sol,mimo took=sol:a; MIMO: rejected=sol:x basis=b oracle=sol:pass,mimo:pass";
  const fixed =
    "SYNTHESIS typo fix: ranked=sol,mimo took=sol:a;mimo:b rejected=sol:x basis=b oracle=sol:pass,mimo:pass";

  test("the most complete reading wins over an earlier line with a typo", () => {
    const actions = parseActions(
      [
        action(
          "2026-10-01T11:53:58Z",
          "coachman",
          "synthesize",
          "ranked=sol,mimo took=sol:a; MIMO:",
          "",
        ),
        action("2026-10-01T11:54:06Z", "coachman", "note", "synthesis", fixed),
      ].join("\n"),
    ).actions;
    const { synthesis, at } = findSynthesis(`- 11:53Z ${buggy}\n`, actions, lanes);
    expect(Object.keys(synthesis?.took ?? {})).toEqual(["sol", "mimo"]);
    expect(at).toBe("2026-10-01T11:53:58Z");
  });

  test("the run log's line is read when no action carries one, and none is none", () => {
    expect(findSynthesis(`${fixed}\n`, [], lanes).synthesis?.ranked).toEqual(["sol", "mimo"]);
    expect(findSynthesis("nothing", [], lanes)).toEqual({ synthesis: null, at: null });
  });
});

describe("readUsage", () => {
  test("one row per usage file, with role, lens and round from the file name", () => {
    const dir = folder();
    put(
      dir,
      "logs/astra-events-usage.json",
      JSON.stringify({ lane: "astra", harness: "codex", input_tokens: 5, output_tokens: 2 }),
    );
    put(
      dir,
      "logs/review-r1-security-opus-usage.json",
      JSON.stringify({
        lane: "opus",
        harness: "claude",
        input_tokens: 14,
        output_tokens: 3,
        cost_usd: 1.5,
      }),
    );
    put(dir, "logs/review-r1.json", "{}");
    const rows = readUsage(dir);
    expect(rows.map((r) => [r.role, r.lane, r.lens, r.round, r.inputTokens, r.costUsd])).toEqual([
      ["workhorse", "astra", null, null, 5, null],
      ["reviewer", "opus", "security", 1, 14, 1.5],
    ]);
  });

  test("a run with no logs has no rows", () => {
    expect(readUsage(folder())).toEqual([]);
  });
});

describe("readers of streams and sessions", () => {
  const reader: UsageReader = (harness, events, session) =>
    harness === "muse"
      ? { input_tokens: session === "SESSION" ? 100 : 1, output_tokens: 7 }
      : {
          input_tokens: events.length,
          output_tokens: 1,
          ...(harness === "claude" ? { cost_usd: 2.5 } : {}),
        };

  test("every workhorse and reviewer stream is read for its lane's harness", () => {
    const dir = folder();
    put(dir, "logs/mimo-events.jsonl", "abcd");
    put(dir, "logs/review-r1-bug-mimo.jsonl", "ab");
    put(dir, "logs/review-r1-security-opus.jsonl", "abc");
    put(dir, "logs/review-r2-security-opus-retry.jsonl", "abcde");
    put(dir, "logs/coachman-leg-1-events.jsonl", "skipped");
    put(dir, "logs/review-r1-bug-nobody.jsonl", "unknown lane is skipped");
    const lanes = {
      mimo: { harness: "mimo", model: "m", effort: null },
      opus: { harness: "claude", model: "o", effort: null },
    };
    const rows = readStreams(dir, lanes, reader);
    expect(rows.map((r) => [r.role, r.lane, r.lens, r.round, r.inputTokens, r.costUsd])).toEqual([
      ["workhorse", "mimo", null, null, 4, null],
      ["reviewer", "mimo", "bug", 1, 2, null],
      ["reviewer", "opus", "security", 1, 3, 2.5],
      ["reviewer", "opus", "security", 2, 5, 2.5],
    ]);
  });

  test("with no reader nothing is read", () => {
    expect(readStreams(folder(), {}, null)).toEqual([]);
    expect(readCoachman(folder(), null)).toEqual([]);
  });

  test("a coachman thread is read from its session record and matched to its leg", () => {
    const dir = folder();
    put(dir, "sessions/coachman/t1.json", "SESSION");
    put(dir, "sessions/coachman/t2.json", "OTHER");
    put(dir, "manifest.json", JSON.stringify({ coachman: { legs: { "1": { thread_id: "t1" } } } }));
    expect(readCoachman(dir, reader)).toEqual([
      { leg: 1, inputTokens: 100, outputTokens: 7 },
      { leg: null, inputTokens: 1, outputTokens: 7 },
    ]);
  });
});

describe("readRun", () => {
  test("one run's row from its files", () => {
    const dir = folder();
    put(
      dir,
      "actions.jsonl",
      `${[
        action("2026-10-02T23:27:50Z", "postmaster", "dispatch", "#200", "leg 1"),
        action("2026-10-02T23:28:30Z", "coachman", "stage", "bootstrapped", "from dispatched"),
        action("2026-10-02T23:52:11Z", "coachman", "dispatch", "mimo", "thread"),
        action(
          "2026-10-03T02:05:08Z",
          "coachman",
          "verify",
          "gate",
          "on=wb/200-mimo@abc123 result=pass exit=0 secs=850",
        ),
        action("2026-10-03T02:38:31Z", "coachman", "review-launch", "mimo", "bug round 1"),
        action(
          "2026-10-03T03:06:12Z",
          "coachman",
          "degrade",
          "mimo",
          "bug round 1: exited with no verdict",
        ),
        action(
          "2026-10-03T03:11:12Z",
          "coachman",
          "finding",
          "scripts/a.ts:5",
          "gating P2 r1 bug-mimo:x:verified by execution",
        ),
        action(
          "2026-10-03T03:12:00Z",
          "coachman",
          "finding",
          "a sentence about it",
          "style P3 r1 style-mimo:y:verified by reading",
        ),
      ].join("\n")}\n`,
    );
    put(
      dir,
      "run-log.md",
      "- 02:05Z SYNTHESIS: ranked=mimo,astra took=mimo:a;astra:nothing rejected=mimo:b basis=c oracle=mimo:pass,astra:fail\n- 02:05Z SHARES: code runs=10 lane:astra=0/10 lane:mimo=6/10 shared=0/10 neither=4/10\n",
    );
    put(
      dir,
      "manifest.json",
      JSON.stringify({ stage: "done", leg: 2, lanes: { mimo: { outcome: "harvested" } } }),
    );
    put(
      dir,
      "run.json",
      JSON.stringify({
        config: {
          team: { workhorses: ["mimo"] },
          lanes: { mimo: { harness: "mimo", model: "m" } },
        },
      }),
    );
    const r = readRun(
      { id: "200", kind: "real", layout: "project", ticket: "200", dir },
      { since: "2026-10-03T00:00:00Z", until: "2026-10-03T15:00:00Z" },
    );
    expect(r.actions).toBe(8);
    expect(r.actionsInWindow).toBe(5);
    expect(r.stage).toBe("done");
    expect(r.synthesis?.ranked).toEqual(["mimo", "astra"]);
    expect(r.shares?.code?.lanes.mimo).toBe(6);
    expect(r.gates.map((g) => [g.lane, g.result])).toEqual([["mimo", "pass"]]);
    expect(r.reviewLaunches).toEqual([
      { ts: "2026-10-03T02:38:31Z", lane: "mimo", lens: "bug", round: 1 },
    ]);
    expect(r.degrades.length).toBe(1);
    expect(r.findings.map((f) => [f.target, f.class, f.lanes])).toEqual([
      ["scripts/a.ts:5", "gating", ["mimo"]],
      [null, "style", ["mimo"]],
    ]);
    expect(r.incidents.length).toBe(1);
    expect(r.parked).toBe(false);
    expect(r.stages.map((s) => s.stage)).toEqual(["dispatched", "bootstrapped"]);
  });

  test("a run with no files reads empty, not as a failure", () => {
    const r = readRun(
      { id: "9-parked-1", kind: "real", layout: "project", ticket: "9", dir: folder() },
      { since: "2026-10-03T00:00:00Z", until: "2026-10-03T15:00:00Z" },
    );
    expect(r.actions).toBe(0);
    expect(r.parked).toBe(true);
    expect(r.synthesis).toBeNull();
    expect(r.team).toBeNull();
  });
});
