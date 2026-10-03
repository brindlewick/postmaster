// Draw the audit's tables from the derived data in ../results (see ../method.md). It reads no
// run's records, so anyone with this folder can run it.
//
//   bun render.ts [--results <dir>]
//
// Reads runs.json, titles.json, judgements.json, incidents.json and hidden-tests.json, and
// writes the tables as markdown beside them. Output that names the machine is refused.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Extract } from "./extract.ts";
import type { FixtureScore } from "./hidden.ts";
import { privacyFaults, type RunRecord } from "./records.ts";
import {
  coverageTable,
  type Data,
  fixtureSummary,
  figuresList,
  fixtureWorkhorses,
  incidentTable,
  inventory,
  perRunTokens,
  realWorkhorses,
  realWorkhorsesCompact,
  recallTable,
  reviewTable,
  timeTable,
  tokensTable,
} from "./tables.ts";

const read = <T>(dir: string, name: string): T =>
  JSON.parse(readFileSync(join(dir, name), "utf8")) as T;

const order = (id: string): number => Number(/([0-9]+)/u.exec(id)?.[1] ?? 0);

/** Real runs before fixtures, each by its number, a set-aside run after the run it was set aside from. */
export function sortRuns(runs: readonly RunRecord[]): RunRecord[] {
  return [...runs].sort(
    (a, b) =>
      Number(a.kind === "fixture") - Number(b.kind === "fixture") ||
      order(a.id) - order(b.id) ||
      Number(a.parked) - Number(b.parked) ||
      a.id.localeCompare(b.id),
  );
}

export function load(dir: string): Data {
  const extract = read<Extract>(dir, "runs.json");
  return {
    runs: sortRuns(extract.runs),
    since: extract.window.since,
    titles: read(dir, "titles.json"),
    judgements: read(dir, "judgements.json"),
    incidents: read(dir, "incidents.json"),
    hidden: read<FixtureScore[]>(dir, "hidden-tests.json"),
  };
}

/** The files `render` writes, by name. */
export function render(d: Data): Record<string, string> {
  const real = d.runs.filter((r) => r.kind === "real" && !r.parked && r.synthesis);
  const fixtures = d.runs.filter((r) => r.kind === "fixture" && r.synthesis);
  const core = real.filter((r) => r.layout === "project");
  const sets = [
    { label: "this repository's runs", runs: real },
    { label: "fixture runs", runs: fixtures },
  ];
  const fs = fixtureSummary(d.hidden);
  const files: Record<string, string> = {
    "inventory.md": `# Every run with activity in the window\n\n${coverageTable(d)}\n\n${inventory(d)}\n`,
    "workhorses-real.md": `# Workhorses, this repository's runs that reached synthesis\n\n${realWorkhorses(d)}\n`,
    "workhorses-real-compact.md": `${realWorkhorsesCompact(d)}\n`,
    "workhorses-fixture.md": `# Workhorses, fixture runs, on the hidden tests\n\n${fixtureWorkhorses(d)}\n\nOf ${fs.scorable} runs whose lane branches could be scored, ${fs.bothPass} had both lanes passing every hidden test (${fs.laneRunsPass} of ${fs.laneRuns} lane branches). The merged result passed in ${fs.mergedPass} of ${fs.merged} runs that merged.\n`,
    "reviews-real.md": `# Reviews, this repository's runs\n\n${reviewTable(real)}\n\n## What a smaller set of reviewers would have found\n\n${recallTable(
      [
        { label: "this repository's runs", runs: real },
        {
          label: "of which, synthesis in the window",
          runs: core.filter((r) => (r.synthesisAt ?? "") >= d.since),
        },
        { label: "fixture runs", runs: fixtures },
      ],
    )}\n`,
    "reviews-fixture.md": `# Reviews, fixture runs\n\n${reviewTable(fixtures)}\n`,
    "tokens.md": `# Tokens by role and lane\n\n${tokensTable(sets)}\n\n${perRunTokens(sets)}\n`,
    "time.md": `# Time\n\n${timeTable(sets)}\n`,
    "incidents.md": `# Incidents\n\n${incidentTable(d.incidents)}\n`,
    "numbers.md": `# The figures the report quotes\n\nEach is computed from the tables' data by render.ts.\n\n${figuresList(d)}\n`,
  };
  return files;
}

const main = (args: string[]): void => {
  const at = args.indexOf("--results");
  const dir = resolve(
    at >= 0 ? (args[at + 1] as string) : join(dirname(import.meta.path), "..", "results"),
  );
  const files = render(load(dir));
  for (const [name, text] of Object.entries(files)) {
    const faults = privacyFaults(text);
    if (faults.length > 0)
      throw new Error(`${name} holds ${faults.join(" and ")}; nothing was written`);
  }
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  console.error(`wrote ${Object.keys(files).length} tables to ${dir}`);
};

if (import.meta.main) main(process.argv.slice(2));
