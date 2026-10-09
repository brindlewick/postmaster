// Reads the harness_versions map that run.json holds for every run of a project and prints one row
// per run: the run's folder name, the time it was written, and the version each harness printed.
// Read only.
//
//   bun --no-env-file versions-by-run.ts <runs-folder>
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: versions-by-run.ts <runs-folder>");
  process.exit(1);
}
console.log("run\twritten\tclaude\tmuse\tcodex\tmimo");
for (const run of readdirSync(root).sort()) {
  let data: { written?: string; harness_versions?: Record<string, string> };
  try {
    data = JSON.parse(readFileSync(join(root, run, "run.json"), "utf8"));
  } catch {
    continue;
  }
  const hv = data.harness_versions ?? {};
  console.log([run, data.written ?? "", hv.claude ?? "", hv.muse ?? "", hv.codex ?? "", hv.mimo ?? ""].join("\t"));
}
