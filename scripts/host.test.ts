// Tests beside scripts/host.ts, moved from its --self-test on #109: 231 controls.
// host.ts's suite lives in ./host-self-test.ts's runControls (shared sequential fixture);
// this file drives it once in beforeAll, splits its printed lines on the section headers,
// and asserts each section's control count with no FAIL. No fixture state is restructured.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { runControls } from "./host-self-test.ts";

const SECTIONS: Array<{ name: string; count: number }> = [
  { name: "preamble", count: 6 },
  { name: "detect", count: 5 },
  { name: "launch labels and run identity", count: 31 },
  { name: "name: from the waybill, so no title is typed into a shell", count: 5 },
  { name: "run, no host: headless launch", count: 16 },
  { name: "a run launch without a named run space is refused", count: 1 },
  { name: "stop: owned process trees and refusal controls", count: 5 },
  { name: "stop: registry identity and process membership", count: 16 },
  { name: "run, Herdr (stub): pane placement and environment handover", count: 13 },
  { name: "stop and close, Herdr (stub)", count: 6 },
  { name: "a reviewer's scratch clone, Herdr (stub)", count: 5 },
  { name: "run, stop and close, tmux (stub)", count: 8 },
  { name: "completion cleanup controls, Herdr (stub)", count: 3 },
  { name: "finished review round cleanup, Herdr (stub)", count: 1 },
  { name: "run-wide teardown, Herdr (stub)", count: 2 },
  { name: "user split survives completion, Herdr (stub)", count: 1 },
  { name: "completion cleanup controls, tmux (stub)", count: 3 },
  { name: "finished review round cleanup, tmux (stub)", count: 1 },
  { name: "run-wide teardown, tmux (stub)", count: 1 },
  { name: "user split survives completion, tmux (stub)", count: 1 },
  { name: "review round 1 fixes, tmux (stub)", count: 10 },
  { name: "review round 1 fixes, Herdr (stub)", count: 6 },
  { name: "review round 2 fixes, tmux (stub)", count: 1 },
  { name: "review round 4 fixes, Herdr (stub)", count: 16 },
  { name: "review round 4 fixes, tmux (stub)", count: 11 },
  { name: "interactive sessions", count: 15 },
  { name: "run role: the explicit host role", count: 1 },
  {
    name: "run environment identity, Claude session and lane env file: Herdr, tmux and no host",
    count: 42,
  },
];

const HEADERS = new Set(SECTIONS.map((s) => s.name).filter((n) => n !== "preamble"));

let failures = -1;
const lines: string[] = [];
const origLog = console.log;

// bun:test's types omit the hook timeout, though the runtime honors it.

beforeAll(async () => {
  console.log = (...args: unknown[]) => {
    lines.push(args.map((a) => String(a)).join(" "));
  };
  try {
    failures = await runControls();
  } finally {
    console.log = origLog;
  }
}, 600000);

afterAll(() => {
  console.log = origLog;
});

const sectionLines = (name: string): string[] => {
  const out: string[] = [];
  let current = "preamble";
  for (const line of lines) {
    if (HEADERS.has(line)) {
      current = line;
      continue;
    }
    if (current === name) out.push(line);
  }
  return out;
};

const assertSection = (name: string, count: number): void => {
  expect(failures).toBeGreaterThanOrEqual(0);
  const part = sectionLines(name);
  const oks = part.filter((l) => l.startsWith("  ok   "));
  const bad = part.filter((l) => l.startsWith("  FAIL "));
  expect(`${name}: ${oks.length} ok of ${count}`).toBe(`${name}: ${count} ok of ${count}`);
  expect(bad).toEqual([]);
};

describe("host self-test sections", () => {
  for (const { name, count } of SECTIONS) {
    test(name, () => {
      assertSection(name, count);
    });
  }
  test("self-test reports zero failures", () => {
    expect(failures).toBe(0);
  });
});
