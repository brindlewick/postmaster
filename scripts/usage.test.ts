// Paired controls for usage.ts: for every harness the adapter knows, one made-up stream that
// reports usage and one that does not, read through the identical command. The with-usage
// stream must yield the figures it carries; the no-usage stream must yield no figure and must
// never yield zero. Fixtures hold made-up values only, in each harness's exact event shape.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "fixtures", "usage");
const script = join(here, "run");

const run = (...args: string[]): { status: number | null; stdout: string; stderr: string } => {
  const result = spawnSync(script, ["usage", ...args], { encoding: "utf8", timeout: 15_000 });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

const readJson = (events: string, harness: string, session?: string): Record<string, unknown> => {
  const result = run("read", events, harness, ...(session ? [session] : []));
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as Record<string, unknown>;
};

const sessionFixture = (harness: string, kind: "with-usage" | "no-usage"): string | undefined => {
  if (harness !== "muse") return undefined;
  return join(fixtures, `muse-${kind}.session.json`);
};

const harnesses = ["codex", "grok", "agy", "claude", "pi", "muse", "mimo"];

const expected: Record<string, Record<string, number>> = {
  // Codex turns report cumulative session usage: the last turn wins. A reader that summed
  // turns would report 13990 in and 850 out here.
  codex: { input_tokens: 9870, output_tokens: 540 },
  grok: { input_tokens: 40, output_tokens: 6, cost_usd: 0.003 },
  // Antigravity results are cumulative session usage: the last result wins. A reader that
  // summed results would report 170 in and 19 out here.
  agy: { input_tokens: 120, output_tokens: 14 },
  // Claude's result is the run's own report and is taken whole; the assistant messages alone
  // would sum to 1100 in and 500 out.
  claude: { input_tokens: 1234, output_tokens: 567, cost_usd: 1.25 },
  pi: { input_tokens: 50, output_tokens: 7, cost_usd: 0.012 },
  // The session carries both model_completed and goal_usage_attribution for the same call,
  // plus an unreported attribution decoy: the total is counted once.
  muse: { input_tokens: 900, output_tokens: 110 },
  mimo: { input_tokens: 1000, output_tokens: 200, cost_usd: 0.25 },
};

describe("a stream that reports usage reads its figures", () => {
  for (const harness of harnesses) {
    test(harness, () => {
      const got = readJson(
        join(fixtures, `${harness}-with-usage.jsonl`),
        harness,
        sessionFixture(harness, "with-usage"),
      );
      expect(got).toEqual(expected[harness]);
      for (const [key, value] of Object.entries(expected[harness] as Record<string, number>)) {
        if (key.endsWith("tokens")) expect(value).toBeGreaterThan(0);
      }
    });
  }
});

describe("a stream that does not report usage records nothing, never zero", () => {
  for (const harness of harnesses) {
    test(harness, () => {
      const got = readJson(
        join(fixtures, `${harness}-no-usage.jsonl`),
        harness,
        sessionFixture(harness, "no-usage"),
      );
      expect(got).toEqual({});
      expect(got.input_tokens).toBeUndefined();
      expect(got.output_tokens).toBeUndefined();
      expect(got.cost_usd).toBeUndefined();
    });
  }
});

describe("reading rules", () => {
  test("a claude stream that ends without a result is summed from its assistant messages", () => {
    const tmp = mkdtempSync(join(tmpdir(), "usage-"));
    try {
      const events = join(tmp, "claude-cut.jsonl");
      writeFileSync(
        events,
        [
          JSON.stringify({
            message: { role: "assistant", usage: { input_tokens: 60, output_tokens: 8 } },
            type: "assistant",
          }),
          JSON.stringify({
            message: { role: "assistant", usage: { input_tokens: 40, output_tokens: 2 } },
            type: "assistant",
          }),
          "",
        ].join("\n"),
      );
      expect(readJson(events, "claude")).toEqual({ input_tokens: 100, output_tokens: 10 });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("a launch with a reported zero cost keeps that zero", () => {
    const tmp = mkdtempSync(join(tmpdir(), "usage-"));
    try {
      const events = join(tmp, "mimo-free.jsonl");
      writeFileSync(
        events,
        [
          JSON.stringify({
            part: { cost: 0, tokens: { input: 30, output: 4 } },
            sessionID: "ses" + "_ma" + "deu" + "p_9",
            type: "step_finish",
          }),
          "",
        ].join("\n"),
      );
      expect(readJson(events, "mimo")).toEqual({ input_tokens: 30, output_tokens: 4, cost_usd: 0 });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("a resumed claude stream sums result usage and takes cost from the last result", () => {
    const tmp = mkdtempSync(join(tmpdir(), "usage-"));
    try {
      const events = join(tmp, "claude-resumed.jsonl");
      writeFileSync(
        events,
        [
          JSON.stringify({
            type: "result",
            usage: { input_tokens: 60, output_tokens: 8 },
            total_cost_usd: 0.1,
          }),
          JSON.stringify({
            type: "result",
            usage: { input_tokens: 40, output_tokens: 2 },
            total_cost_usd: 0.16,
          }),
          "",
        ].join("\n"),
      );
      // Result usage is per-invocation (summed); total_cost_usd is cumulative (last wins).
      expect(readJson(events, "claude")).toEqual({
        input_tokens: 100,
        output_tokens: 10,
        cost_usd: 0.16,
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("a codex stream takes the last terminal that carries figures", () => {
    const tmp = mkdtempSync(join(tmpdir(), "usage-"));
    try {
      const events = join(tmp, "codex-interrupted.jsonl");
      writeFileSync(
        events,
        [
          JSON.stringify({
            type: "turn.completed",
            usage: { input_tokens: 100, output_tokens: 10 },
          }),
          JSON.stringify({ type: "turn.interrupted" }),
          "",
        ].join("\n"),
      );
      expect(readJson(events, "codex")).toEqual({ input_tokens: 100, output_tokens: 10 });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("grok and agy readers skip a terminal without figures", () => {
    const tmp = mkdtempSync(join(tmpdir(), "usage-"));
    try {
      const grokEvents = join(tmp, "grok-empty-end.jsonl");
      writeFileSync(
        grokEvents,
        [
          JSON.stringify({
            type: "end",
            usage: { input_tokens: 40, output_tokens: 6 },
            total_cost_usd: 0.003,
          }),
          JSON.stringify({ type: "end" }),
          "",
        ].join("\n"),
      );
      expect(readJson(grokEvents, "grok")).toEqual({
        input_tokens: 40,
        output_tokens: 6,
        cost_usd: 0.003,
      });
      const agyEvents = join(tmp, "agy-empty-result.jsonl");
      writeFileSync(
        agyEvents,
        [
          JSON.stringify({
            event: "result",
            result: { usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 14 } },
          }),
          JSON.stringify({ event: "result", result: {} }),
          "",
        ].join("\n"),
      );
      expect(readJson(agyEvents, "agy")).toEqual({ input_tokens: 120, output_tokens: 14 });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  // The record types and the end record's fields are the ones grok 1.0.70 printed with
  // --output-format streaming-json; the values are made up. That end record carries no cost.
  test("a grok streaming-json stream is read from its end record, not from the usage records before it", () => {
    const tmp = mkdtempSync(join(tmpdir(), "usage-"));
    try {
      const events = join(tmp, "grok-streaming-json.jsonl");
      writeFileSync(
        events,
        [
          JSON.stringify({
            type: "available_commands",
            commands: ["compact"],
            tools: ["read_file"],
          }),
          JSON.stringify({ type: "text", data: "working" }),
          JSON.stringify({
            type: "usage",
            usage: { input_tokens: 30, output_tokens: 4 },
            signature: "made-up",
          }),
          JSON.stringify({
            type: "usage",
            usage: { input_tokens: 11, output_tokens: 3 },
            signature: "made-up",
          }),
          JSON.stringify({
            type: "end",
            stopReason: "end_turn",
            sessionId: "made-up-session",
            usage: {
              input_tokens: 40,
              cache_read_input_tokens: 5,
              output_tokens: 6,
              reasoning_tokens: 1,
              total_tokens: 51,
            },
            num_turns: 2,
            usage_is_incomplete: true,
            modelUsage: { "made-up-model": { inputTokens: 40, outputTokens: 6, modelCalls: 2 } },
          }),
          "",
        ].join("\n"),
      );
      expect(readJson(events, "grok")).toEqual({ input_tokens: 40, output_tokens: 6 });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("record and sum", () => {
  test("record writes the launch's figures, per role and lane", () => {
    const tmp = mkdtempSync(join(tmpdir(), "usage-"));
    try {
      mkdirSync(join(tmp, "logs"), { recursive: true });
      copyFileSync(
        join(fixtures, "claude-with-usage.jsonl"),
        join(tmp, "logs", "luna-events.jsonl"),
      );
      const result = run(
        "record",
        join(tmp, "logs", "luna-events.jsonl"),
        "claude",
        "luna",
        tmp,
        "--role",
        "workhorse",
        "--lane",
        "luna",
      );
      expect(result.status).toBe(0);
      const record = JSON.parse(readFileSync(join(tmp, "logs", "luna-events-usage.json"), "utf8"));
      expect(record.input_tokens).toBe(1234);
      expect(record.output_tokens).toBe(567);
      expect(record.cost_usd).toBe(1.25);
      expect(record.role).toBe("workhorse");
      expect(record.lane).toBe("luna");
      expect(record.harness).toBe("claude");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("record omits a figure the harness did not report", () => {
    const tmp = mkdtempSync(join(tmpdir(), "usage-"));
    try {
      mkdirSync(join(tmp, "logs"), { recursive: true });
      copyFileSync(join(fixtures, "agy-no-usage.jsonl"), join(tmp, "logs", "other-events.jsonl"));
      const result = run(
        "record",
        join(tmp, "logs", "other-events.jsonl"),
        "agy",
        "other",
        tmp,
        "--role",
        "workhorse",
        "--lane",
        "other",
      );
      expect(result.status).toBe(0);
      const record = JSON.parse(readFileSync(join(tmp, "logs", "other-events-usage.json"), "utf8"));
      expect(record.input_tokens).toBeUndefined();
      expect(record.output_tokens).toBeUndefined();
      expect(record.cost_usd).toBeUndefined();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("re-reading a grown stream replaces its record with the whole-stream reading", () => {
    const tmp = mkdtempSync(join(tmpdir(), "usage-"));
    try {
      mkdirSync(join(tmp, "logs"), { recursive: true });
      const events = join(tmp, "logs", "luna-events.jsonl");
      copyFileSync(join(fixtures, "mimo-with-usage.jsonl"), events);
      const record = (...extra: string[]) =>
        run(
          "record",
          events,
          "mimo",
          "luna",
          tmp,
          "--role",
          "workhorse",
          "--lane",
          "luna",
          ...extra,
        );
      expect(record().status).toBe(0);
      writeFileSync(
        events,
        readFileSync(events, "utf8") +
          JSON.stringify({
            part: { cost: 0.05, tokens: { input: 100, output: 10 } },
            sessionID: "ses" + "_ma" + "deu" + "p_1",
            type: "step_finish",
          }) +
          "\n",
      );
      expect(record().status).toBe(0);
      const saved = JSON.parse(readFileSync(join(tmp, "logs", "luna-events-usage.json"), "utf8"));
      expect(saved.input_tokens).toBe(1100);
      expect(saved.output_tokens).toBe(210);
      expect(saved.cost_usd).toBeCloseTo(0.3, 10);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("record reads muse usage from the launch's own session export", () => {
    const tmp = mkdtempSync(join(tmpdir(), "usage-"));
    try {
      mkdirSync(join(tmp, "logs"), { recursive: true });
      mkdirSync(join(tmp, "sessions", "coachman"), { recursive: true });
      copyFileSync(
        join(fixtures, "muse-with-usage.jsonl"),
        join(tmp, "logs", "coachman-events.jsonl"),
      );
      copyFileSync(
        join(fixtures, "muse-with-usage.session.json"),
        join(tmp, "sessions", "coachman", "madeup-session-a.json"),
      );
      const result = run(
        "record",
        join(tmp, "logs", "coachman-events.jsonl"),
        "muse",
        "coachman",
        tmp,
        "--role",
        "coachman",
        "--lane",
        "synthesis",
      );
      expect(result.status).toBe(0);
      const record = JSON.parse(
        readFileSync(join(tmp, "logs", "coachman-events-usage.json"), "utf8"),
      );
      expect(record.input_tokens).toBe(900);
      expect(record.output_tokens).toBe(110);
      expect(record.read_error).toBeUndefined();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("record without the muse session export saves an unreadable record, never zeros", () => {
    const tmp = mkdtempSync(join(tmpdir(), "usage-"));
    try {
      mkdirSync(join(tmp, "logs"), { recursive: true });
      copyFileSync(
        join(fixtures, "muse-with-usage.jsonl"),
        join(tmp, "logs", "coachman-events.jsonl"),
      );
      const result = run(
        "record",
        join(tmp, "logs", "coachman-events.jsonl"),
        "muse",
        "coachman",
        tmp,
        "--role",
        "coachman",
        "--lane",
        "synthesis",
      );
      // Exit 0: the record IS saved; a nonzero exit would tell the launch site it was not recorded.
      expect(result.status).toBe(0);
      expect(result.stderr).toContain("usage record saved without figures");
      const record = JSON.parse(
        readFileSync(join(tmp, "logs", "coachman-events-usage.json"), "utf8"),
      );
      expect(record.read_error).toBe("session-record-unavailable");
      expect(record.input_tokens).toBeUndefined();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("sum reports per role and lane, names a harness that reports nothing, never writes a missing figure as zero", () => {
    const tmp = mkdtempSync(join(tmpdir(), "usage-"));
    try {
      mkdirSync(join(tmp, "logs"), { recursive: true });
      copyFileSync(
        join(fixtures, "claude-with-usage.jsonl"),
        join(tmp, "logs", "luna-events.jsonl"),
      );
      copyFileSync(join(fixtures, "agy-no-usage.jsonl"), join(tmp, "logs", "other-events.jsonl"));
      for (const [events, harness, name, role, lane] of [
        ["luna-events.jsonl", "claude", "luna", "workhorse", "luna"],
        ["other-events.jsonl", "agy", "other", "workhorse", "other"],
      ]) {
        expect(
          run(
            "record",
            join(tmp, "logs", events),
            harness,
            name,
            tmp,
            "--role",
            role,
            "--lane",
            lane,
          ).status,
        ).toBe(0);
      }
      writeFileSync(join(tmp, "logs", "broken-usage.json"), "{not json");
      const result = run("sum", tmp);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("cost: workhorse luna (claude): 1234 in, 567 out, $1.25");
      expect(result.stdout).toContain(
        "cost: workhorse other (agy): not reported in, not reported out, cost not reported",
      );
      expect(result.stdout).toContain("cost: harness agy reports nothing");
      expect(result.stdout).toContain("cost: broken-usage.json could not be read");
      expect(result.stdout).toContain(
        "cost: workhorse other (agy): no usage recorded for logs/other-events.jsonl",
      );
      // Control: the lane whose stream reports is not named as empty.
      expect(result.stdout).not.toContain("workhorse luna (claude): no usage recorded");
      expect(result.stdout).not.toMatch(/0 in/u);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("sum marks partial launch coverage per figure", () => {
    const tmp = mkdtempSync(join(tmpdir(), "usage-"));
    try {
      mkdirSync(join(tmp, "logs"), { recursive: true });
      copyFileSync(join(fixtures, "mimo-with-usage.jsonl"), join(tmp, "logs", "a-events.jsonl"));
      copyFileSync(join(fixtures, "mimo-no-usage.jsonl"), join(tmp, "logs", "b-events.jsonl"));
      for (const events of ["a-events.jsonl", "b-events.jsonl"]) {
        expect(
          run(
            "record",
            join(tmp, "logs", events),
            "mimo",
            "luna",
            tmp,
            "--role",
            "workhorse",
            "--lane",
            "luna",
          ).status,
        ).toBe(0);
      }
      const result = run("sum", tmp);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("1000 (1 of 2 launches) in");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("sum prints a reported cost as a decimal, never scientific and never $0", () => {
    const tmp = mkdtempSync(join(tmpdir(), "usage-"));
    try {
      mkdirSync(join(tmp, "logs"), { recursive: true });
      for (const [name, cost] of [
        ["tiny", 1e-7],
        ["tinier", 4.9e-10],
        ["plain", 0.003],
      ] as const) {
        const events = join(tmp, "logs", `${name}-events.jsonl`);
        writeFileSync(
          events,
          JSON.stringify({
            type: "end",
            usage: { input_tokens: 10, output_tokens: 2 },
            total_cost_usd: cost,
          }) + "\n",
        );
        expect(
          run("record", events, "grok", name, tmp, "--role", "workhorse", "--lane", name).status,
        ).toBe(0);
      }
      const result = run("sum", tmp);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("$0.0000001");
      expect(result.stdout).toContain("$0.0000000005");
      expect(result.stdout).toContain("$0.003");
      // ASCII: summed figures print as machine ASCII; \d never meets Unicode.
      expect(result.stdout).not.toMatch(/\$[\d.]+e/u);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("sum without a logs directory names the logs directory", () => {
    const tmp = mkdtempSync(join(tmpdir(), "usage-"));
    try {
      const result = run("sum", tmp);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`no such logs directory: ${join(tmp, "logs")}`);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// A Claude session in the CLI's stream-json shape, made up. A result's `usage` is the turns of the
// invocation's own thread; its `modelUsage` is the whole session by model, with the helpers the
// session started, and is cumulative like `total_cost_usd`. A review that answers from helpers and
// waits for them has no turns of its own, so its `usage` reads zero.
const lines = (...rows: unknown[]): string => `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`;

const helperRows = [
  {
    type: "system",
    subtype: "task_started",
    task_id: "made-up-task",
    description: "Made-up finder",
    is_backgrounded: true,
    spawn_depth: 1,
    task_type: "local_agent",
  },
  {
    type: "system",
    subtype: "task_notification",
    task_id: "made-up-task",
    status: "completed",
    usage: { total_tokens: 195000, tool_uses: 27, duration_ms: 386000 },
  },
];

const sessionModel = (inputTokens: number, outputTokens: number, costUSD: number) => ({
  inputTokens,
  outputTokens,
  cacheReadInputTokens: 125000,
  cacheCreationInputTokens: 6600,
  costUSD,
  contextWindow: 200000,
});

const claudeResult = (
  usage: { input_tokens: number; output_tokens: number },
  models: Record<string, unknown> | undefined,
  cost: number,
) => ({
  type: "result",
  subtype: "success",
  is_error: false,
  total_cost_usd: cost,
  usage: { ...usage, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  ...(models === undefined ? {} : { modelUsage: models }),
});

const inTmp = (body: (tmp: string) => void): void => {
  const tmp = mkdtempSync(join(tmpdir(), "usage-"));
  try {
    mkdirSync(join(tmp, "logs"), { recursive: true });
    body(tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};

const reviewerStream = (inputTokens: number, outputTokens: number, cost: number): string =>
  lines(
    { type: "system", subtype: "init", model: "made-up-model" },
    ...helperRows,
    claudeResult(
      { input_tokens: 0, output_tokens: 0 },
      { "made-up-model": sessionModel(inputTokens, outputTokens, cost) },
      cost,
    ),
  );

const recordLaunch = (
  tmp: string,
  events: string,
  harness: string,
  lane: string,
  role = "reviewer",
): void => {
  const result = run(
    "record",
    join(tmp, "logs", events),
    harness,
    lane,
    tmp,
    "--role",
    role,
    "--lane",
    lane,
  );
  expect(result.status).toBe(0);
};

describe("a claude reviewer that starts helpers", () => {
  test("a result whose own turns read zero yields the session's tokens", () => {
    inTmp((tmp) => {
      const events = join(tmp, "logs", "review-r1-bug-haiku.jsonl");
      writeFileSync(events, reviewerStream(1832, 2400000, 2.5));
      expect(readJson(events, "claude")).toEqual({
        input_tokens: 1832,
        output_tokens: 2400000,
        cost_usd: 2.5,
      });
    });
  });

  test("record saves those tokens, never zero", () => {
    inTmp((tmp) => {
      writeFileSync(
        join(tmp, "logs", "review-r1-bug-haiku.jsonl"),
        reviewerStream(1832, 2400000, 2.5),
      );
      recordLaunch(tmp, "review-r1-bug-haiku.jsonl", "claude", "haiku");
      const saved = JSON.parse(
        readFileSync(join(tmp, "logs", "review-r1-bug-haiku-usage.json"), "utf8"),
      );
      expect(saved.input_tokens).toBe(1832);
      expect(saved.output_tokens).toBe(2400000);
      expect(saved.cost_usd).toBe(2.5);
    });
  });

  test("the tokens of a helper the session started are in the figures, not only its own turns", () => {
    inTmp((tmp) => {
      const events = join(tmp, "style-helper.jsonl");
      writeFileSync(
        events,
        lines(
          { type: "system", subtype: "init", model: "made-up-model" },
          ...helperRows,
          claudeResult(
            { input_tokens: 40, output_tokens: 900 },
            { "made-up-model": sessionModel(52, 144003, 0.5) },
            0.5,
          ),
        ),
      );
      // The own turns alone would read 40 in and 900 out.
      expect(readJson(events, "claude")).toEqual({
        input_tokens: 52,
        output_tokens: 144003,
        cost_usd: 0.5,
      });
    });
  });

  test("control: a session with no helper reads the same from either report", () => {
    inTmp((tmp) => {
      const events = join(tmp, "no-helper.jsonl");
      writeFileSync(
        events,
        lines(
          { type: "system", subtype: "init", model: "made-up-model" },
          claudeResult(
            { input_tokens: 34, output_tokens: 98826 },
            { "made-up-model": sessionModel(34, 98826, 0.45) },
            0.45,
          ),
        ),
      );
      expect(readJson(events, "claude")).toEqual({
        input_tokens: 34,
        output_tokens: 98826,
        cost_usd: 0.45,
      });
    });
  });

  test("a session on two models adds them up", () => {
    inTmp((tmp) => {
      const events = join(tmp, "two-models.jsonl");
      writeFileSync(
        events,
        lines(
          claudeResult(
            { input_tokens: 0, output_tokens: 0 },
            {
              "made-up-model": sessionModel(100, 5000, 0.75),
              "made-up-helper-model": sessionModel(20, 7000, 0.25),
            },
            1,
          ),
        ),
      );
      expect(readJson(events, "claude")).toEqual({
        input_tokens: 120,
        output_tokens: 12000,
        cost_usd: 1,
      });
    });
  });

  test("a figure never reads less than the results' own turns summed", () => {
    inTmp((tmp) => {
      const events = join(tmp, "smaller-session.jsonl");
      writeFileSync(
        events,
        lines(
          claudeResult(
            { input_tokens: 60, output_tokens: 8 },
            { "made-up-model": sessionModel(60, 8, 0.1) },
            0.1,
          ),
          claudeResult(
            { input_tokens: 40, output_tokens: 2 },
            { "made-up-model": sessionModel(40, 2, 0.16) },
            0.16,
          ),
        ),
      );
      // A session report smaller than the turns summed leaves the larger reading standing.
      expect(readJson(events, "claude")).toEqual({
        input_tokens: 100,
        output_tokens: 10,
        cost_usd: 0.16,
      });
    });
  });
});

describe("a report of zero tokens is no report", () => {
  const zeroUsage = {
    input_tokens: 0,
    cached_input_tokens: 0,
    cache_write_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
  };

  test("a codex stream whose only terminal reads zero yields no figure", () => {
    inTmp((tmp) => {
      const events = join(tmp, "codex-zero.jsonl");
      writeFileSync(
        events,
        lines({ type: "turn.started" }, { type: "turn.completed", usage: zeroUsage }),
      );
      expect(readJson(events, "codex")).toEqual({});
    });
  });

  test("a codex terminal that reads zero does not replace the total before it", () => {
    inTmp((tmp) => {
      const events = join(tmp, "codex-later-zero.jsonl");
      writeFileSync(
        events,
        lines(
          { type: "turn.completed", usage: { input_tokens: 100, output_tokens: 10 } },
          { type: "turn.completed", usage: zeroUsage },
        ),
      );
      expect(readJson(events, "codex")).toEqual({ input_tokens: 100, output_tokens: 10 });
    });
  });

  test("a claude result that reads zero with no session report keeps its cost and no tokens", () => {
    inTmp((tmp) => {
      const events = join(tmp, "claude-zero.jsonl");
      writeFileSync(
        events,
        lines(claudeResult({ input_tokens: 0, output_tokens: 0 }, undefined, 0.4)),
      );
      expect(readJson(events, "claude")).toEqual({ cost_usd: 0.4 });
    });
  });

  test("a stream with only one side at zero is a report", () => {
    inTmp((tmp) => {
      const events = join(tmp, "codex-one-side.jsonl");
      writeFileSync(
        events,
        lines({ type: "turn.completed", usage: { input_tokens: 0, output_tokens: 7 } }),
      );
      expect(readJson(events, "codex")).toEqual({ input_tokens: 0, output_tokens: 7 });
    });
  });
});

describe("sum names the launches that hold no usage", () => {
  const codexZero = lines({
    type: "turn.completed",
    usage: {
      input_tokens: 0,
      cached_input_tokens: 0,
      cache_write_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
    },
  });

  test("a bug lens of two lanes over two rounds: the claude tokens count and the codex records are named", () => {
    inTmp((tmp) => {
      writeFileSync(
        join(tmp, "logs", "review-r1-bug-haiku.jsonl"),
        reviewerStream(1832, 2400000, 2.5),
      );
      writeFileSync(
        join(tmp, "logs", "review-r2-bug-haiku.jsonl"),
        reviewerStream(916, 1200000, 1.25),
      );
      writeFileSync(join(tmp, "logs", "review-r1-bug-luna.jsonl"), codexZero);
      writeFileSync(join(tmp, "logs", "review-r2-bug-luna.jsonl"), codexZero);
      for (const round of ["r1", "r2"]) {
        recordLaunch(tmp, `review-${round}-bug-haiku.jsonl`, "claude", "haiku");
        recordLaunch(tmp, `review-${round}-bug-luna.jsonl`, "codex", "luna");
      }
      const result = run("sum", tmp);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("cost: reviewer haiku (claude): 2748 in, 3600000 out, $3.75");
      expect(result.stdout).toContain(
        "cost: reviewer luna (codex): not reported in, not reported out, cost not reported",
      );
      expect(result.stdout).toContain(
        "cost: reviewer luna (codex): no usage recorded for logs/review-r1-bug-luna.jsonl",
      );
      expect(result.stdout).toContain(
        "cost: reviewer luna (codex): no usage recorded for logs/review-r2-bug-luna.jsonl",
      );
      // Control: the lane that reported is not named as empty, and no total reads zero.
      expect(result.stdout).not.toContain("reviewer haiku (claude): no usage recorded");
      expect(result.stdout).not.toContain(": 0 in,");
    });
  });

  test("a lane with one empty launch among reported ones shows a floor, and names the empty one", () => {
    inTmp((tmp) => {
      copyFileSync(
        join(fixtures, "codex-with-usage.jsonl"),
        join(tmp, "logs", "review-r1-style-luna.jsonl"),
      );
      writeFileSync(join(tmp, "logs", "review-r1-bug-luna.jsonl"), codexZero);
      recordLaunch(tmp, "review-r1-style-luna.jsonl", "codex", "luna");
      recordLaunch(tmp, "review-r1-bug-luna.jsonl", "codex", "luna");
      const result = run("sum", tmp);
      expect(result.stdout).toContain("9870 (1 of 2 launches) in, 540 (1 of 2 launches) out");
      expect(result.stdout).toContain(
        "cost: reviewer luna (codex): no usage recorded for logs/review-r1-bug-luna.jsonl",
      );
      expect(result.stdout).not.toContain("no usage recorded for logs/review-r1-style-luna.jsonl");
    });
  });

  test("control: launches that all report print no such line", () => {
    inTmp((tmp) => {
      writeFileSync(
        join(tmp, "logs", "review-r1-bug-haiku.jsonl"),
        reviewerStream(1832, 2400000, 2.5),
      );
      copyFileSync(
        join(fixtures, "codex-with-usage.jsonl"),
        join(tmp, "logs", "review-r1-style-luna.jsonl"),
      );
      recordLaunch(tmp, "review-r1-bug-haiku.jsonl", "claude", "haiku");
      recordLaunch(tmp, "review-r1-style-luna.jsonl", "codex", "luna");
      const result = run("sum", tmp);
      expect(result.status).toBe(0);
      expect(result.stdout).not.toContain("no usage recorded");
    });
  });

  test("a record written before zero meant nothing, with zero tokens and no cost, reads as empty", () => {
    inTmp((tmp) => {
      writeFileSync(
        join(tmp, "logs", "review-r1-bug-luna-usage.json"),
        `${JSON.stringify({
          schema_version: 1,
          name: "luna",
          harness: "codex",
          role: "reviewer",
          lane: "luna",
          stream: "logs/review-r1-bug-luna.jsonl",
          input_tokens: 0,
          output_tokens: 0,
        })}\n`,
      );
      const result = run("sum", tmp);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain(
        "cost: reviewer luna (codex): no usage recorded for logs/review-r1-bug-luna.jsonl",
      );
      expect(result.stdout).not.toContain(": 0 in,");
    });
  });

  test("an old record with zero tokens and a cost counts the cost and marks the tokens partial", () => {
    inTmp((tmp) => {
      const old = (round: string, tokens: number, cost: number) =>
        writeFileSync(
          join(tmp, "logs", `review-${round}-bug-haiku-usage.json`),
          `${JSON.stringify({
            schema_version: 1,
            name: "haiku",
            harness: "claude",
            role: "reviewer",
            lane: "haiku",
            stream: `logs/review-${round}-bug-haiku.jsonl`,
            input_tokens: tokens,
            output_tokens: tokens,
            cost_usd: cost,
          })}\n`,
        );
      old("r1", 0, 2.5);
      old("r2", 30, 0.25);
      const result = run("sum", tmp);
      expect(result.stdout).toContain(
        "cost: reviewer haiku (claude): 30 (1 of 2 launches) in, 30 (1 of 2 launches) out, $2.75",
      );
      // The zero launch holds a cost, so it is not an empty record.
      expect(result.stdout).not.toContain("no usage recorded");
    });
  });
});
