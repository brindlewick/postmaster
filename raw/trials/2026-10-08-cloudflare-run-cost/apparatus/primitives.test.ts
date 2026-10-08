import { describe, expect, test } from "bun:test";
import { PRIMITIVES, scan, table } from "./primitives.ts";

const files = {
  "scripts/a.ts": 'Bun.spawn(["git"]); process.kill(-pid, "SIGTERM"); writeFileSync("x.done", "")',
  "scripts/b.ts": 'execSync("systemd-run --user --scope -p MemoryMax=8G x"); readFileSync("/proc/self/stat")',
  "scripts/c.ts": "export const add = (a: number, b: number) => a + b;",
  "scripts/e.ts": 'import { run } from "./lib/proc.ts"; run(["ls"]);',
};

describe("scan", () => {
  const hits = scan(files);

  test("positive control: each made-up use is found in the file that has it", () => {
    expect(hits.spawn).toEqual(["scripts/a.ts", "scripts/b.ts"]);
    expect(hits.signal).toEqual(["scripts/a.ts"]);
    expect(hits.marker).toEqual(["scripts/a.ts"]);
    expect(hits.cgroup).toEqual(["scripts/b.ts"]);
    expect(hits.proc).toEqual(["scripts/b.ts"]);
    expect(hits.helpers).toEqual(["scripts/e.ts"]);
  });

  test("negative control: a pure file matches nothing, and a primitive nobody uses reads zero", () => {
    for (const p of PRIMITIVES) expect(hits[p.id]).not.toContain("scripts/c.ts");
    expect(hits.sandbox).toEqual([]);
    expect(hits.host).toEqual([]);
    expect(hits.symlink).toEqual([]);
  });

  test("a file is counted once per primitive however often it uses it", () => {
    const twice = scan({ "scripts/d.ts": "Bun.spawn(a); Bun.spawn(b); spawnSync(c)" });
    expect(twice.spawn).toEqual(["scripts/d.ts"]);
  });
});

describe("table", () => {
  test("lists every primitive with its count out of the total", () => {
    const text = table(scan(files), 4);
    expect(text).toContain("| starts child processes | 2 | 4 |");
    expect(text).toContain("| wraps a harness in bwrap or sandbox-exec | 0 | 4 |");
  });
});
