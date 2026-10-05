// Counts the test files that start a process: a file with a spawn call (spawnSync, spawn, execSync, Bun.spawn), or a file that
// imports the project's process helper and calls run( . Read only.
//
//   bun --no-env-file count-spawning-tests.ts <repo-root>
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: count-spawning-tests.ts <repo-root>");
  process.exit(1);
}
const files = [join(root, "scripts"), join(root, "scripts", "lib")]
  .flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".test.ts")).map((f) => join(d, f)))
  .sort();
let spawnCall = 0;
let helperRun = 0;
let nonsense = 0;
for (const f of files) {
  const s = readFileSync(f, "utf8");
  const hasSpawn = /spawnSync\(|\bspawn\(|execSync\(|Bun\.spawn/.test(s);
  const importsHelper = /from "\.\/lib\/proc|from "\.\/proc|from "\.\/lib\/processes|from "\.\/processes/.test(s);
  const callsRun = /(?<![\w.])run\(/.test(s);
  if (hasSpawn) spawnCall++;
  else if (importsHelper && callsRun) helperRun++;
  if (s.includes("zzqxv309nonsense")) nonsense++;
}
console.log(`test files: ${files.length}`);
console.log(`with a spawn call: ${spawnCall}`);
console.log(`importing the process helper and calling run(, with no spawn call: ${helperRun}`);
console.log(`start a process, together: ${spawnCall + helperRun}`);
console.log(`positive control, spawnSync( calls in scripts/summary-evidence.test.ts: ${(readFileSync(join(root, "scripts", "summary-evidence.test.ts"), "utf8").match(/spawnSync\(/g) ?? []).length}`);
console.log(`negative control, files holding a string no test holds: ${nonsense}`);
