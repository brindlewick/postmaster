// Draw the trial's tables from the lane audit's derived data (see ../method.md). It reads no run's
// records, so anyone with this repository can run it.
//
//   bun run.ts [--runs <runs.json>] [--out <results dir>]
//
// Reads the audit's runs.json and writes instance-time.json, instance-time.md and cost.md.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Extract } from "../../2026-10-03-lane-audit/apparatus/extract.ts";
import { median } from "../../2026-10-03-lane-audit/apparatus/analyze.ts";
import { covered, runTime, type RunTime, summarizeRole } from "./instance-time.ts";
import { PLAN_FEE_PER_MONTH } from "./cost.ts";
import {
  auditTotals,
  breakEven,
  dollars,
  isoSpan,
  perRunTable,
  rateTable,
  type Scenario,
  scenarioCost,
  scenarioTable,
  timeTable,
  totalsCost,
  totalsTable,
} from "./tables.ts";
import type { RunUptime } from "./uptime.ts";

const here = dirname(new URL(import.meta.url).pathname);
const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : fallback;
};

const runsFile = resolve(arg("--runs", join(here, "../../2026-10-03-lane-audit/results/runs.json")));
const outDir = resolve(arg("--out", join(here, "../results")));

const data = JSON.parse(readFileSync(runsFile, "utf8")) as Extract;
const real: RunTime[] = covered(data.runs, "real").map(runTime);
const fixture: RunTime[] = covered(data.runs, "fixture").map(runTime);

const uptimeFile = join(outDir, "coachman-uptime.json");
const uptime = (JSON.parse(readFileSync(uptimeFile, "utf8")) as { rows: RunUptime[] }).rows;
const ceilingOf = (ids: string[]): number[] =>
  real.filter((t) => ids.includes(t.run)).map((t) => t.coachmanUpper);
const measured = uptime.map((u) => u.run);
const hoursOf = (seconds: number): string => (seconds / 3600).toFixed(1);
const floor = median(uptime.map((u) => u.seconds)) as number;
// the ceiling over the same runs as the floor, so both ends describe the same group of runs
const ceilingSameRuns = median(ceilingOf(measured)) as number;
const ceilingAllRuns = median(real.map((t) => t.coachmanUpper)) as number;
const coachman = { floor, ceiling: ceilingSameRuns };
const biggest: Scenario = { name: "all standard-4", lanes: "standard-4", reviewers: "standard-4", coachman: "standard-4" };
const coachmanLine = `The coachman's process time is not recorded for every launch, so it is bracketed. The floor
is the sum, over a run's coachman threads, of the last process's uptime from each thread's session
export: the median of ${uptime.length} runs is ${hoursOf(floor)} hours. The ceiling is the seconds in the stages
a leg can run in (the wait for the user's spec review included) over the same ${uptime.length} runs: a median of
${hoursOf(ceilingSameRuns)} hours. The ${real.length - uptime.length} runs without session exports are the longest by stage seconds; over all
${real.length} runs the ceiling's median is ${hoursOf(ceilingAllRuns)} hours, which would raise the top of every cell
below (the largest cell, all standard-4 with every vCPU busy, from $${dollars(scenarioCost(real, biggest, 1, ceilingSameRuns).total)}
to $${dollars(scenarioCost(real, biggest, 1, ceilingAllRuns).total)}). The cost tables use the floor and the ceiling of the same ${uptime.length} runs.`;

const uptimeSeconds = new Map(uptime.map((u) => [u.run, u.seconds]));
const totals = auditTotals(real, uptimeSeconds);
const span = isoSpan(covered(data.runs, "real"));
const TOTAL_SIZES = ["standard-2", "standard-3", "standard-4"];
const FLAT_PRICES = [25, 50, 100, 200];
const averageAt = (size: string): number => totalsCost(totals, size, 0.25).average;
const evens = (size: string): number[] => breakEven(FLAT_PRICES, averageAt(size), PLAN_FEE_PER_MONTH);
const breakEvenRows = FLAT_PRICES.map(
  (price, i) => `| $${price} | ${(evens("standard-3")[i] as number).toFixed(0)} | ${(evens("standard-4")[i] as number).toFixed(0)} |`,
).join("\n");
const allRuns = `The ${totals.runs} runs' records run from ${span?.first.slice(0, 10) ?? "?"} to ${span?.last.slice(0, 10) ?? "?"}. Together they hold
${hoursOf(totals.lanesAndReviewers)} hours of lanes and reviewers, the coachman's floor of ${hoursOf(totals.coachmanFloor)} hours over the
${totals.coachmanFloorRuns} runs with session exports, and a coachman ceiling of ${hoursOf(totals.coachmanCeiling)} hours over all ${totals.runs}. "Low" is lanes
and reviewers plus the coachman's floor, which leaves out the coachman of the ${totals.runs - totals.coachmanFloorRuns} runs without exports; "high" is
lanes and reviewers plus every stage hour of the coachman in every run, the user's waits included. "Average run" is the
high figure divided by ${totals.runs}. List rates, with no monthly allowance taken off.`;

const SCENARIOS: Scenario[] = [
  { name: "all standard-2", lanes: "standard-2", reviewers: "standard-2", coachman: "standard-2" },
  { name: "all standard-3", lanes: "standard-3", reviewers: "standard-3", coachman: "standard-3" },
  { name: "all standard-4", lanes: "standard-4", reviewers: "standard-4", coachman: "standard-4" },
  { name: "lanes and reviewers standard-3, coachman standard-4", lanes: "standard-3", reviewers: "standard-3", coachman: "standard-4" },
];

const instanceTime = `# Container time per role

A launch is one lane, one reviewer, or one coachman leg. Each row is the time such a launch ran, from
the lane audit's derived data (\`2026-10-03-lane-audit/results/runs.json\`). [method.md](../method.md)
says what each column means and what it leaves out.

## Real runs (${real.length} that reached synthesis)

${timeTable(real)}

Lanes with no recorded time, left out above: ${real.reduce((a, t) => a + t.lanesUnmeasured, 0)}.

## Fixture runs (${fixture.length} that reached synthesis)

${timeTable(fixture)}

Lanes with no recorded time, left out above: ${fixture.reduce((a, t) => a + t.lanesUnmeasured, 0)}.

## Per run, real

${perRunTable(real)}
`;

const cost = `# What that time costs on Cloudflare Containers

Rates: [pricing.mdx at cloudflare-docs 6e1b964](https://github.com/cloudflare/cloudflare-docs/blob/6e1b96433cf016efd2c0c9057a7e27a8e112376f/src/content/docs/containers/platform/pricing.mdx),
read 2026-10-08. Memory and disk are charged for what the instance type provisions, for as long as
the instance runs; CPU for active use only. The tables bracket CPU use at none, a quarter and all
vCPUs busy, since the audit holds no CPU measurement.

## One running hour

${rateTable(["lite", "basic", "standard-1", "standard-2", "standard-3", "standard-4"])}

## The median real run's container time

Lanes and reviewers at the median run's seconds from the audit. ${coachmanLine}
The gates run inside these launches and add nothing of their own. List rates, with no monthly
allowance taken off. Each cell reads "coachman at its floor to coachman at its ceiling".

${scenarioTable(real, SCENARIOS, coachman)}

## All ${real.length} runs together

${allRuns}

${totalsTable(totals, TOTAL_SIZES)}

## Against a flat monthly price

A machine billed by the month costs the same however many runs it does. Cloudflare costs the $${PLAN_FEE_PER_MONTH} plan fee plus
the average run's cost for each run. The table gives the runs a month at which the two cost the same, for flat
prices that are only examples; a reader's own price replaces them. The average run is the high end of the table above
at a quarter of the CPU busy: $${dollars(averageAt("standard-3"))} on standard-3 and $${dollars(averageAt("standard-4"))} on standard-4. Neither side's model bill is in
it, and a machine of the right size for the work is assumed.

| Flat price a month | Runs a month, standard-3 | Runs a month, standard-4 |
| --- | --- | --- |
${breakEvenRows}

## The median fixture run

The audit holds no session uptime for fixture runs, so the coachman is bracketed by zero and the
median fixture run's stage seconds (${((median(fixture.map((t) => t.coachmanUpper)) as number) / 3600).toFixed(1)} hours).

${scenarioTable(fixture, SCENARIOS, { floor: 0, ceiling: median(fixture.map((t) => t.coachmanUpper)) as number })}
`;

mkdirSync(outDir, { recursive: true });
const summary = (times: RunTime[]) => ({
  runs: times.length,
  lanes: summarizeRole(times, "lanes"),
  reviewers: summarizeRole(times, "reviewers"),
  gatesOnLanes: summarizeRole(times, "gatesOnLanes"),
  gatesOnSynthesis: summarizeRole(times, "gatesOnSynthesis"),
  coachmanUpperTotalSeconds: times.reduce((a, t) => a + t.coachmanUpper, 0),
});
writeFileSync(
  join(outDir, "instance-time.json"),
  `${JSON.stringify({ real: summary(real), fixture: summary(fixture), perRun: real }, null, 2)}\n`,
);
writeFileSync(join(outDir, "instance-time.md"), instanceTime);
writeFileSync(join(outDir, "cost.md"), cost);
process.stdout.write(`wrote ${outDir}\n`);
