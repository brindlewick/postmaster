// Tests beside scripts/runs-status.ts, moved from its --self-test on #109: 19 controls.
// Fifteen fixture runs plus the postmaster directory are planted once in beforeAll;
// status() only reads, so every test is independent.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pyWords } from "./lib/text";
import { status, walkFiles } from "./runs-status";

let tmp: string;
let root: string;

function mkRun(name: string, stage: string, leg: number, ...markers: string[]): void {
  const d = join(root, name);
  mkdirSync(join(d, "logs"), { recursive: true });
  writeFileSync(join(d, "manifest.json"), `{"stage": "${stage}", "leg": ${leg}}\n`);
  writeFileSync(join(d, "run-log.md"), "");
  for (const m of markers) writeFileSync(join(d, m), "");
}

function mkOdd(name: string, legLiteral: string, ...markers: string[]): void {
  const d = join(root, name);
  mkdirSync(join(d, "logs"), { recursive: true });
  writeFileSync(join(d, "manifest.json"), `{"stage": "review", "leg": ${legLiteral}}\n`);
  writeFileSync(join(d, "run-log.md"), "");
  for (const m of markers) writeFileSync(join(d, m), "");
}

function age(name: string): void {
  const t = Date.now() / 1000 - 3600;
  const dir = join(root, name);
  walkFiles(dir, (f) => {
    try {
      utimesSync(f, t, t);
    } catch {
      /* ignore */
    }
  });
}

function nextOf(name: string): string {
  const origLog = console.log;
  let out = "";
  console.log = (s: string) => {
    out += `${s}\n`;
  };
  try {
    status(root);
  } finally {
    console.log = origLog;
  }
  for (const line of out.split("\n")) {
    const parts = pyWords(line);
    if (parts[0] === name) return parts[parts.length - 1] ?? "";
  }
  return "";
}

function rowOf(name: string): string {
  const origLog = console.log;
  let out = "";
  console.log = (s: string) => {
    out += `${s}\n`;
  };
  try {
    status(root);
  } finally {
    console.log = origLog;
  }
  for (const line of out.split("\n")) {
    if (pyWords(line)[0] === name) return line;
  }
  return "";
}

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "runs-status-"));
  root = join(tmp, "root");
  mkRun("rule", "review", 2, ".escalation-ready");
  mkRun("gate", "shipping", 3, ".card-ready");
  mkRun("spec", "planning", 1, ".spec-review-ready", ".leg-1-exited");
  mkRun("dispatch", "review", 2, ".leg-2-done", ".leg-2-exited");
  mkRun("remount", "review", 2, ".leg-2-exited");
  mkRun("read", "review", 2, ".checkpoint-review-ready");
  mkRun("inspect", "review", 2);
  age("inspect");
  mkRun("wait", "review", 2);
  mkRun("user", "review", 2, ".waiting-on-user", ".leg-2-exited");
  mkRun("closed", "done", 3, ".leg-3-done", ".leg-3-exited");
  mkRun("earlier", "review", 2, ".leg-1-done");
  mkRun("usergate", "shipping", 3, ".card-ready", ".waiting-on-user");
  mkRun("userspec", "planning", 1, ".spec-review-ready", ".waiting-on-user");
  mkRun("userclosed", "done", 3, ".waiting-on-user");
  mkRun("stall", "review", 2);
  age("stall");
  writeFileSync(join(root, "stall", ".leg-1-done"), "");
  mkOdd("boolleg", "true", ".leg-True-done", ".leg-True-exited");
  mkOdd("nullleg", "null", ".leg-None-done", ".leg-None-exited");
  mkdirSync(join(root, "postmaster"), { recursive: true });
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("positive controls", () => {
  test("an escalation waiting is RULE", () => {
    expect(nextOf("rule")).toBe("RULE");
  }, 10000);

  test("a complete ship card is GATE", () => {
    expect(nextOf("gate")).toBe("GATE");
  }, 10000);

  test("a spec review package waiting is SPEC", () => {
    expect(nextOf("spec")).toBe("SPEC");
  }, 10000);

  test("the current leg done is DISPATCH", () => {
    expect(nextOf("dispatch")).toBe("DISPATCH");
  }, 10000);

  test("the current leg gone with nothing written is REMOUNT", () => {
    expect(nextOf("remount")).toBe("REMOUNT");
  }, 10000);

  test("a checkpoint card waiting is READ", () => {
    expect(nextOf("read")).toBe("READ");
  }, 10000);

  test("nothing changed for an hour is INSPECT", () => {
    expect(nextOf("inspect")).toBe("INSPECT");
  }, 10000);

  test("a leg at work is WAIT", () => {
    expect(nextOf("wait")).toBe("WAIT");
  }, 10000);

  test("a run waiting on the user is USER, whatever else it holds", () => {
    expect(nextOf("user")).toBe("USER");
  }, 10000);

  test("a closed run is -", () => {
    expect(nextOf("closed")).toBe("-");
  }, 10000);
});

describe("negative controls", () => {
  test("an earlier leg's done marker dispatches nothing", () => {
    expect(nextOf("earlier")).toBe("WAIT");
  }, 10000);

  test("a ship card put to the user waits on the user, not the gate", () => {
    expect(nextOf("usergate")).toBe("USER");
  }, 10000);

  test("a spec package put to the user waits on the user, not the package", () => {
    expect(nextOf("userspec")).toBe("USER");
  }, 10000);

  test("a closed run stays closed with a stale marker", () => {
    expect(nextOf("userclosed")).toBe("-");
  }, 10000);

  test("touching a marker does not hide a stall", () => {
    expect(nextOf("stall")).toBe("INSPECT");
  }, 10000);

  test("the postmaster's own directory is not a run", () => {
    expect(nextOf("postmaster")).toBe("");
  }, 10000);
});

describe("non-string legs print in Python's spelling", () => {
  test("a boolean leg matches its Python-spelled markers", () => {
    expect(nextOf("boolleg")).toBe("DISPATCH");
  }, 10000);

  test("a null leg matches its Python-spelled markers", () => {
    expect(nextOf("nullleg")).toBe("DISPATCH");
  }, 10000);

  test("a run with no markers shows a dash, not blanks", () => {
    expect(pyWords(rowOf("wait"))[3]).toBe("-");
  }, 10000);
});
