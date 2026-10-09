// Tests beside scripts/setup-next.ts: where setup stands and what comes next.
import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { run, withTempDir } from "./lib/proc.ts";

const SELF = join(import.meta.dir, "run");

function setupNext(repo: string, configPath: string): { code: number; out: string } {
  const r = run(SELF, ["setup-next", repo], {
    env: { ...(process.env as Record<string, string>), POSTMASTER_CONFIG: configPath },
  });
  return { code: r.code, out: r.out + r.err };
}

describe("setup-next", () => {
  test("a global config the strict parse refuses routes to the global step", () => {
    withTempDir((dir) => {
      const repo = join(dir, "proj");
      mkdirSync(repo, { recursive: true });
      run("git", ["init", "-q", repo]);
      const config = join(dir, "config.toml");
      writeFileSync(config, `\uFEFFprojects_roots = ["~/Code"]\n`, "utf8");
      const r = setupNext(repo, config);
      expect(r.code).toBe(0);
      expect(r.out).toContain("next=global");
    });
  });

  test("a global config that is not TOML routes to the global step", () => {
    withTempDir((dir) => {
      const repo = join(dir, "proj");
      mkdirSync(repo, { recursive: true });
      run("git", ["init", "-q", repo]);
      const config = join(dir, "config.toml");
      writeFileSync(config, "{{{\n", "utf8");
      const r = setupNext(repo, config);
      expect(r.code).toBe(0);
      expect(r.out).toContain("next=global");
    });
  });
});
