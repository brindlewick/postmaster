// The trial's tables as markdown, from the derived data alone (see ../method.md). Pure functions;
// `run.ts` reads the audit's data and writes these.
import { median } from "../../2026-10-03-lane-audit/apparatus/analyze.ts";
import { cost, INSTANCE_TYPES, type InstanceType, perHour } from "./cost.ts";
import { type Role, type RoleSummary, type RunTime, seconds, summarizeRole } from "./instance-time.ts";

export const hours = (s: number): string => (s / 3600).toFixed(1);
export const minutes = (s: number | null): string => (s === null ? "–" : String(Math.round(s / 60)));
export const dollars = (d: number): string => (d < 10 ? d.toFixed(2) : d.toFixed(0));

const ROLES: Array<{ role: Role; label: string }> = [
  { role: "lanes", label: "workhorse lanes" },
  { role: "reviewers", label: "reviewers" },
  { role: "gatesOnLanes", label: "gate runs on a lane's branch (inside the coachman)" },
  { role: "gatesOnSynthesis", label: "gate runs on the synthesis (inside the coachman)" },
];

const row = (cells: string[]): string => `| ${cells.join(" | ")} |`;

/** Container time by role: launches, total hours, the median run's hours, and a single launch's minutes. */
export function timeTable(times: readonly RunTime[]): string {
  const lines = [
    row(["Role", "Launches", "Total hours", "Median run, hours", "Median launch, min", "90th percentile, min", "Longest, min"]),
    row(["---", "---", "---", "---", "---", "---", "---"]),
  ];
  for (const { role, label } of ROLES) {
    const s: RoleSummary = summarizeRole(times, role);
    lines.push(
      row([
        label,
        String(s.launches),
        hours(s.totalSeconds),
        s.medianPerRun === null ? "–" : hours(s.medianPerRun),
        minutes(s.medianEach),
        minutes(s.p90Each),
        minutes(s.longestEach),
      ]),
    );
  }
  const upper = times.map((t) => t.coachmanUpper);
  lines.push(
    row([
      "coachman, upper bound (stages a leg can run in)",
      String(times.length),
      hours(upper.reduce((a, b) => a + b, 0)),
      upper.length === 0 ? "–" : hours(median(upper) as number),
      "–",
      "–",
      "–",
    ]),
  );
  return lines.join("\n");
}

/** One row per run: hours by role. */
export function perRunTable(times: readonly RunTime[]): string {
  const lines = [
    row(["Run", "Lanes, h", "Reviewers, h", "Gates on lanes, h", "Gates on synthesis, h", "Coachman upper bound, h"]),
    row(["---", "---", "---", "---", "---", "---"]),
  ];
  for (const t of times) {
    lines.push(
      row([
        t.run,
        hours(seconds(t.lanes)),
        hours(seconds(t.reviewers)),
        hours(seconds(t.gatesOnLanes)),
        hours(seconds(t.gatesOnSynthesis)),
        hours(t.coachmanUpper),
      ]),
    );
  }
  return lines.join("\n");
}

export const CPU_USES = [0, 0.25, 1] as const;

/** What one running hour costs, by instance type and by how busy its vCPUs are. */
export function rateTable(types: readonly string[]): string {
  const lines = [
    row(["Instance type", "vCPU", "Memory, GiB", "Disk, GB", ...CPU_USES.map((u) => `$ per hour, CPU ${u * 100}% busy`)]),
    row(["---", "---", "---", "---", "---", "---", "---"]),
  ];
  for (const name of types) {
    const t = INSTANCE_TYPES[name] as InstanceType;
    lines.push(
      row([name, String(t.vcpu), String(t.memoryGib), String(t.diskGb), ...CPU_USES.map((u) => perHour(t, u).toFixed(3))]),
    );
  }
  return lines.join("\n");
}

export type Scenario = { name: string; lanes: string; reviewers: string; coachman: string };

/** The coachman's seconds in a run: a floor and a ceiling (see uptime.ts and instance-time.ts). */
export type CoachmanSeconds = { floor: number; ceiling: number };

/**
 * Dollars for a median run's container time in a scenario: lanes and reviewers at the median run's
 * seconds, the coachman at the given seconds.
 */
export function scenarioCost(
  times: readonly RunTime[],
  s: Scenario,
  cpuUse: number,
  coachmanSeconds: number,
): { lanes: number; reviewers: number; coachman: number; total: number } {
  const med = (role: Role): number => summarizeRole(times, role).medianPerRun ?? 0;
  const lanes = cost(med("lanes"), INSTANCE_TYPES[s.lanes] as InstanceType, cpuUse);
  const reviewers = cost(med("reviewers"), INSTANCE_TYPES[s.reviewers] as InstanceType, cpuUse);
  const coachman = cost(coachmanSeconds, INSTANCE_TYPES[s.coachman] as InstanceType, cpuUse);
  return { lanes, reviewers, coachman, total: lanes + reviewers + coachman };
}

/** Each scenario's run total as "floor to ceiling", by how busy the vCPUs are. */
export function scenarioTable(
  times: readonly RunTime[],
  scenarios: readonly Scenario[],
  coachman: CoachmanSeconds,
): string {
  const lines = [
    row([
      "Scenario",
      "Lanes",
      "Reviewers",
      "Coachman",
      ...CPU_USES.map((u) => `Run total, $ (CPU ${u * 100}% busy)`),
    ]),
    row(["---", "---", "---", "---", "---", "---", "---"]),
  ];
  for (const s of scenarios) {
    lines.push(
      row([
        s.name,
        s.lanes,
        s.reviewers,
        s.coachman,
        ...CPU_USES.map((u) => {
          const low = scenarioCost(times, s, u, coachman.floor).total;
          const high = scenarioCost(times, s, u, coachman.ceiling).total;
          return `${dollars(low)} to ${dollars(high)}`;
        }),
      ]),
    );
  }
  return lines.join("\n");
}
