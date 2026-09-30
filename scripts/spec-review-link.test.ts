// Tests beside scripts/spec-review-link.ts, moved from its --self-test on #109: 8 controls.
// Each control writes its own run.json; the suite shares one dispatch dir in file order.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const wrapper = join(import.meta.dir, "spec-review-link.sh");

function cli(...args: string[]): { code: number; out: string; err: string } {
  const r = spawnSync("bash", [wrapper, ...args], { encoding: "utf8" });
  return { code: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

// The shell's $(...): trailing newlines stripped.
const strip = (s: string): string => s.replace(/\n+$/u, "");

let root = "";
let d = "";
let w = "";
let spec = "";
// The shell's expected path: $(cd $w && pwd -P)/WORKHORSE-SPEC.md.
const specPath = (): string => join(realpathSync(w), "WORKHORSE-SPEC.md");

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "spec-review-link-"));
  d = join(root, "project", ".postmaster", "runs", "RUN-1");
  w = join(root, "project", ".worktrees", "RUN-1-lane");
  mkdirSync(d, { recursive: true });
  mkdirSync(w, { recursive: true });
  spec = join(w, "WORKHORSE-SPEC.md");
  writeFileSync(spec, "approved plan\n");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("positive controls", () => {
  test("the recorded template gets the absolute spec path", () => {
    writeFileSync(
      join(d, "run.json"),
      '{"config":{"planning":{"review_link":"https://code.example/open?file={path}"}}}\n',
    );
    const r = cli(d, w);
    expect(r.code).toBe(0);
    expect(strip(r.out)).toBe(`https://code.example/open?file=${specPath()}`);
  }, 10000);

  test("a missing template prints the absolute spec path", () => {
    writeFileSync(join(d, "run.json"), '{"config":{}}\n');
    const r = cli(d, w);
    expect(r.code).toBe(0);
    expect(strip(r.out)).toBe(specPath());
  }, 10000);

  test("a run with no template passes config validation", () => {
    writeFileSync(join(d, "run.json"), '{"config":{}}\n');
    const r = cli("--validate", d);
    expect(r.code).toBe(0);
  }, 10000);
});

describe("negative controls", () => {
  test("a template without {path} is refused", () => {
    writeFileSync(
      join(d, "run.json"),
      '{"config":{"planning":{"review_link":"https://code.example/open"}}}\n',
    );
    const r = cli(d, w);
    expect(r.code).toBe(2);
    expect(strip(r.out)).toBe("");
    expect(r.err.includes("must contain {path}")).toBe(true);
  }, 10000);

  test("a template without {path} is refused before the run starts", () => {
    writeFileSync(
      join(d, "run.json"),
      '{"config":{"planning":{"review_link":"https://code.example/open"}}}\n',
    );
    const r = cli("--validate", d);
    expect(r.code).toBe(2);
    expect(r.err.includes("must be empty or contain {path}")).toBe(true);
  }, 10000);

  test("a malformed config object is refused", () => {
    writeFileSync(join(d, "run.json"), '{"config": [1]}\n');
    const r = cli(d, w);
    expect(r.code).toBe(1);
    expect(r.err.includes("config must be an object")).toBe(true);
  }, 10000);

  test("a missing spec is refused", () => {
    writeFileSync(join(d, "run.json"), '{"config":{}}\n');
    rmSync(spec);
    const r = cli(d, w);
    expect(r.code).toBe(1);
    expect(r.err.includes("no WORKHORSE-SPEC.md")).toBe(true);
  }, 10000);

  test("a directory as the spec is refused", () => {
    mkdirSync(spec);
    const r = cli(d, w);
    expect(r.code).toBe(1);
    expect(r.err.includes("no WORKHORSE-SPEC.md")).toBe(true);
    rmSync(spec, { recursive: true });
  }, 10000);
});
