import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  firstLine,
  lastLine,
  logVerdict,
  parseArgs,
  parseMakeOutput,
  runJsonDoc,
  timeoutForHost,
} from "./setup-verifiers.ts";

describe("parseArgs", () => {
  test("a repo, surfaces and a run parse, kinds ordered", () => {
    expect(parseArgs(["/r", "web", "cli-examples", "--run", "/d"])).toEqual({
      ok: true,
      req: { repo: "/r", names: ["web", "cli-examples"], kinds: ["cli", "web"], dispatch: "/d" },
    });
  });

  test("names of one surface parse to its kind", () => {
    const parsed = parseArgs(["/r", "browser-suite", "web-journey", "--run", "/d"]);
    expect(parsed).toEqual({
      ok: true,
      req: {
        repo: "/r",
        names: ["browser-suite", "web-journey"],
        kinds: ["web"],
        dispatch: "/d",
      },
    });
  });

  test("a missing repo, surface or run fails", () => {
    expect(parseArgs([])).toEqual({
      ok: false,
      error: "setup-verifiers takes a repo and a surface",
    });
    expect(parseArgs(["/r", "--run", "/d"])).toEqual({
      ok: false,
      error: "setup-verifiers takes a repo and a surface",
    });
    expect(parseArgs(["/r", "cli"])).toEqual({
      ok: false,
      error: "setup-verifiers needs --run <dispatch>",
    });
    expect(parseArgs(["/r", "cli", "--run"])).toEqual({
      ok: false,
      error: "setup-verifiers needs --run <dispatch>",
    });
  });

  test("an unknown surface names itself, an unknown flag fails", () => {
    expect(parseArgs(["/r", "cli", "telegraph", "--run", "/d"])).toEqual({
      ok: false,
      error: "unknown surface: telegraph",
    });
    expect(parseArgs(["/r", "__proto__", "--run", "/d"]).ok).toBe(false);
    expect(parseArgs(["/r", "cli", "--run", "/d", "--fresh"]).ok).toBe(false);
  });

  test("a comma-joined surfaces value splits, a bad segment names itself", () => {
    expect(parseArgs(["/r", "cli,web", "--run", "/d"])).toEqual({
      ok: true,
      req: { repo: "/r", names: ["cli", "web"], kinds: ["cli", "web"], dispatch: "/d" },
    });
    expect(parseArgs(["/r", "cli", "web,library", "--run", "/d"])).toEqual({
      ok: true,
      req: {
        repo: "/r",
        names: ["cli", "web", "library"],
        kinds: ["cli", "web", "library"],
        dispatch: "/d",
      },
    });
    expect(parseArgs(["/r", "cli,bogus", "--run", "/d"])).toEqual({
      ok: false,
      error: "unknown surface: bogus",
    });
    expect(parseArgs(["/r", "cli,", "--run", "/d"])).toEqual({
      ok: false,
      error: "unknown surface: ",
    });
  });
});

describe("timeoutForHost", () => {
  test("no host waits an hour a kind, a host waits without a limit", () => {
    expect(timeoutForHost("none", 1)).toBe(3600);
    expect(timeoutForHost("none", 2)).toBe(7200);
    expect(timeoutForHost("herdr", 2)).toBe(0);
    expect(timeoutForHost("tmux", 1)).toBe(0);
  });

  test("an undetected host waits bounded, never without a limit", () => {
    expect(timeoutForHost("", 2)).toBe(7200);
  });
});

describe("parseMakeOutput", () => {
  test("the branch and hand-over lines parse", () => {
    expect(
      parseMakeOutput(
        "branch verify-cli\nbase main\nworktree /x\nrole coachman\nhandle h\nprompt /p\nhandover /x/HANDOVER.md\n",
      ),
    ).toEqual({ branch: "verify-cli", handover: "/x/HANDOVER.md" });
  });

  test("a hand-over path with spaces parses whole", () => {
    expect(parseMakeOutput("branch verify-cli\nhandover /my dir/HANDOVER.md\n")).toEqual({
      branch: "verify-cli",
      handover: "/my dir/HANDOVER.md",
    });
  });

  test("a missing line reads as no session", () => {
    expect(parseMakeOutput("branch verify-cli\n")).toBe(null);
    expect(parseMakeOutput("handover /x/HANDOVER.md\n")).toBe(null);
    expect(parseMakeOutput("")).toBe(null);
  });
});

describe("lastLine", () => {
  test("the last non-empty line, or nothing", () => {
    expect(lastLine("a\nb\n")).toBe("b");
    expect(lastLine("a\n\n")).toBe("a");
    expect(lastLine("\n")).toBe("");
  });
});

describe("firstLine", () => {
  test("the first non-empty line, or nothing", () => {
    expect(firstLine("a\nb\n")).toBe("a");
    expect(firstLine("\na\n")).toBe("a");
    expect(firstLine("\n")).toBe("");
  });
});

describe("runJsonDoc", () => {
  test("the record carries the target and the config", () => {
    const doc = runJsonDoc("/r", { team: {} });
    expect(doc.kind).toBe("setup-verifiers");
    expect(doc.target).toBe("/r");
    expect(doc.config).toEqual({ team: {} });
    expect(typeof doc.written).toBe("string");
  });
});

describe("logVerdict", () => {
  test("a writable dispatch logs the note", () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "setup-verdict-")));
    try {
      expect(logVerdict(dir, "landed verify-cli")).toBe(true);
      expect(readFileSync(join(dir, "actions.jsonl"), "utf8")).toContain("landed verify-cli");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an unwritable dispatch fails", () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "setup-verdict-")));
    try {
      const file = join(dir, "file");
      writeFileSync(file, "not a dispatch");
      expect(logVerdict(file, "landed verify-cli")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
