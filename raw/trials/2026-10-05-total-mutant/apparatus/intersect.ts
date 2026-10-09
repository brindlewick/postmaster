// For each script run under both mutants: the tests that pass on the base, pass under mutant A
// (every export does nothing; run as a program it exits 0) and pass under mutant B (every export
// throws; run as a program it exits 70). A test that survives both observes nothing the target does.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dirA = process.argv[2];
const dirB = process.argv[3];
if (!dirA || !dirB) {
  console.error("usage: intersect.ts <outA> <outB>");
  process.exit(1);
}
const lines = (f: string) => (existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean) : []);
let totalBase = 0;
let totalA = 0;
let totalBoth = 0;
const names = readdirSync(dirB)
  .filter((f) => f.endsWith(".survivorsB.txt"))
  .map((f) => f.replace(".survivorsB.txt", ""))
  .sort();
for (const n of names) {
  const a = lines(join(dirA, existsSync(join(dirA, `${n}.survivorsA.txt`)) ? `${n}.survivorsA.txt` : `${n}.survivors.txt`));
  const b = new Set(lines(join(dirB, `${n}.survivorsB.txt`)));
  const both = a.filter((x) => b.has(x));
  const base = (readFileSync(join(dirB, `${n}.base.xml`), "utf8").match(/<testcase\b/g) ?? []).length;
  totalBase += base;
  totalA += a.length;
  totalBoth += both.length;
  console.log(`${n}\tbase ${base}\tsurvive A ${a.length}\tsurvive B ${b.size}\tsurvive both ${both.length}`);
  for (const t of both) console.log(`     both: ${t}`);
}
console.log(`TOTAL (scripts that had an A survivor)\tbase ${totalBase}\tA ${totalA}\tboth ${totalBoth}`);
