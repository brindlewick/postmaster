// Total mutant: replace one script with a stub whose every runtime export does nothing, run
// that script's own test file, and list the tests that still pass.
//
//   bun --no-env-file total-mutant.ts <copy-root> <out-dir> <name>...
//
// <name> is a script name without extension; scripts/<name>.ts and scripts/<name>.test.ts must
// exist under <copy-root>. The copy is a scratch copy of main; the target is restored from
// <copy-root>/../pristine after each run. Reads the junit report bun writes, so no output is parsed.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MODE = process.env.MUTANT ?? "A";
const [copyRoot, outDir, ...names] = process.argv.slice(2);
if (!copyRoot || !outDir || names.length === 0) {
  console.error("usage: total-mutant.ts <copy-root> <out-dir> <name>...");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const pristine = join(copyRoot, "..", "pristine");

type Case = { name: string; status: "pass" | "fail" | "skip" };

function parseJunit(xml: string): Case[] {
  const cases: Case[] = [];
  const re = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    const body = m[3] ?? "";
    const nameMatch = /\bname="([^"]*)"/.exec(attrs);
    const classMatch = /\bclassname="([^"]*)"/.exec(attrs);
    const name = `${classMatch ? `${decode(classMatch[1])} > ` : ""}${nameMatch ? decode(nameMatch[1]) : "?"}`;
    let status: Case["status"] = "pass";
    if (/<failure\b|<error\b/.test(body)) status = "fail";
    else if (/<skipped\b/.test(body)) status = "skip";
    cases.push({ name, status });
  }
  return cases;
}

function decode(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function runTests(label: string, name: string, testName: string = name): { cases: Case[]; code: number; ms: number } {
  const report = join(outDir, `${name}.${label}.xml`);
  const t0 = Date.now();
  const r = Bun.spawnSync(
    ["nice", "-n", "19", "bun", "--no-env-file", "test", `scripts/${testName}.test.ts`, "--reporter=junit", `--reporter-outfile=${report}`, "--timeout", "60000"],
    { cwd: copyRoot, stdout: "pipe", stderr: "pipe", env: { ...process.env, NO_COLOR: "1" }, timeout: 600000 },
  );
  const ms = Date.now() - t0;
  const xml = existsSync(report) ? readFileSync(report, "utf8") : "";
  writeFileSync(join(outDir, `${name}.${label}.stderr.txt`), r.stderr.toString().slice(-4000));
  return { cases: parseJunit(xml), code: r.exitCode ?? -1, ms };
}

function stubFor(src: string): string {
  const exports = new Bun.Transpiler({ loader: "ts" }).scan(src).exports;
  if (MODE === "B") {
    const lines = [
      "// total mutant B: every runtime export throws, and run as a program the script exits 70",
      'if (import.meta.main) { console.error("mutant B"); process.exit(70); }',
    ];
    for (const e of exports) {
      if (e === "default") lines.push('export default (): never => { throw new Error("mutant B"); };');
      else lines.push(`export const ${e} = (..._args: unknown[]): any => { throw new Error("mutant B"); };`);
    }
    return `${lines.join("\n")}\n`;
  }
  const lines = ["// total mutant A: every runtime export does nothing"];
  for (const e of exports) {
    if (e === "default") lines.push("export default () => undefined;");
    else lines.push(`export const ${e} = (..._args: unknown[]): any => undefined;`);
  }
  return `${lines.join("\n")}\n`;
}

const summary: string[] = [];
for (const name of names) {
  const target = join(copyRoot, "scripts", `${name}.ts`);
  const testName = process.env.TEST ?? name;
  const test = join(copyRoot, "scripts", `${testName}.test.ts`);
  if (!existsSync(target) || !existsSync(test)) {
    summary.push(`${name}\tSKIPPED\tmissing target or test`);
    continue;
  }
  const src = readFileSync(target, "utf8");
  const base = runTests("base", name, testName);
  const stub = stubFor(src);
  writeFileSync(target, stub);
  let mut: ReturnType<typeof runTests>;
  try {
    mut = runTests(`mutant${MODE}`, name, testName);
  } finally {
    const original = join(pristine, "scripts", `${name}.ts`);
    if (existsSync(original)) copyFileSync(original, target);
    else writeFileSync(target, src);
  }
  const basePass = new Set(base.cases.filter((c) => c.status === "pass").map((c) => c.name));
  const mutPass = mut.cases.filter((c) => c.status === "pass");
  const survivors = mutPass.filter((c) => basePass.has(c.name)).map((c) => c.name);
  const exportsN = new Bun.Transpiler({ loader: "ts" }).scan(src).exports.length;
  summary.push(
    `${name}\texports=${exportsN}\tbase: ${basePass.size} pass of ${base.cases.length} (exit ${base.code}, ${Math.round(base.ms / 1000)}s)\tmutant: ${mutPass.length} pass of ${mut.cases.length} (exit ${mut.code}, ${Math.round(mut.ms / 1000)}s)\tsurvivors=${survivors.length}`,
  );
  writeFileSync(join(outDir, `${name}.survivors${MODE}.txt`), `${survivors.join("\n")}\n`);
}
console.log(summary.join("\n"));
