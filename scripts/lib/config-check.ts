// Validity checks shared by setup, front-door and check-setup: the rules
// setup applies when it writes a config, and the route's needs. setup.ts
// dies on the first problem, check-setup.ts prints them all, and front-door
// prefixes the postmaster one; the messages stay byte-identical in setup and
// front-door, which is why the rules live here once (design rule 7).
//
// The checks are conditional on the values setup writes: a role the merged
// settings do not name is not judged, except team.postmaster, which the route
// needs, and the lanes, which the count needs.
import { run } from "./proc.ts";

const isTable = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Whether a named harness is on PATH. Spawns; the edge, not the core. */
export function isInstalled(tool: string): boolean {
  // command -v is a shell builtin: setup ran it in the shell, so this must too.
  return run("bash", ["-c", 'command -v "$1" >/dev/null 2>&1', "_", tool]).code === 0;
}

/** setup's harness rule, as it reads when it writes a config. */
export function harnessProblem(harness: string): string | null {
  if (!isInstalled(harness)) {
    return `setup: harness '${harness}' is not on PATH; install it or choose another`;
  }
  return null;
}

/** setup's lane-count rule. */
export function laneCountProblem(lanes: string[]): string | null {
  if (lanes.length < 2) return "setup: at least two lanes are needed";
  return null;
}

/** setup's reviewer-membership rule. lanesText is how the lanes read in the
 * message: setup passes its raw answer, so its message never changes. */
export function reviewerProblem(
  name: string,
  lanes: string[],
  lanesText: string,
  lens = "",
): string | null {
  if (!lanes.includes(name)) {
    const who = lens === "" ? "reviewer" : `${lens} reviewer`;
    return `setup: ${who} '${name}' is not one of the lanes (${lanesText})`;
  }
  return null;
}

/** setup's coachman-model rule. subject is "the coachman" or "the fallback
 * coachman", as the message reads it. */
export function coachmanModelProblem(
  model: string,
  laneModels: string[],
  subject: string,
): string | null {
  if (laneModels.includes(model)) {
    return `setup: ${subject} cannot run on a lane's model (${model})`;
  }
  return null;
}

/** front-door's postmaster rule, without its prefix: the spec is a table
 * naming a harness and a model, both non-blank strings without control
 * characters. At most one problem: the first the route would refuse. */
export function postmasterProblems(spec: unknown, source: string): string[] {
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
    return [`${source} has no team.postmaster with a harness and a model`];
  }
  const s = spec as Record<string, unknown>;
  const harness = s.harness;
  const model = s.model;
  if (!harness || !model) {
    return [`${source} has no team.postmaster with a harness and a model`];
  }
  if (typeof harness !== "string" || typeof model !== "string") {
    return [`${source} team.postmaster harness and model must be strings`];
  }
  if (!harness.trim() || !model.trim()) {
    return [`${source} team.postmaster harness and model must not be blank`];
  }
  if (
    [...(harness + model)].some((c) => {
      const o = c.codePointAt(0) ?? 0;
      return o < 0x20 || o === 0x7f;
    })
  ) {
    return [`${source} team.postmaster harness and model must not contain control characters`];
  }
  return [];
}

export interface LaneEntryResult {
  problems: string[];
  /** The lane's model where it names a usable one, for the coachman rule. */
  model: string | null;
}

/** One lane entry of merged settings: names a harness on PATH and a model. */
export function checkLaneEntry(name: string, entry: unknown): LaneEntryResult {
  if (!isTable(entry)) {
    return {
      problems: [`setup: lane '${name}' names no harness`, `setup: lane '${name}' names no model`],
      model: null,
    };
  }
  const problems: string[] = [];
  const harness = entry.harness;
  if (typeof harness !== "string") {
    problems.push(`setup: lane '${name}' names no harness`);
  } else {
    const p = harnessProblem(harness);
    if (p !== null) problems.push(p);
  }
  let model: string | null = null;
  const m = entry.model;
  if (typeof m !== "string" || m.trim() === "") {
    problems.push(`setup: lane '${name}' names no model`);
  } else {
    model = m;
  }
  return { problems, model };
}

/** The harness a team role names, where it names one. */
export function roleHarness(spec: unknown): string | null {
  if (!isTable(spec)) return null;
  return typeof spec.harness === "string" ? spec.harness : null;
}

/** The model a team role names, where it names a usable one. */
export function roleModel(spec: unknown): string | null {
  if (!isTable(spec)) return null;
  const m = spec.model;
  return typeof m === "string" && m.trim() !== "" ? m : null;
}

/** setup's reviewer-membership rule over merged settings: team.reviewers and
 * every team.lens_reviewers list name lanes. Values that are not lists are
 * shapes setup never writes, and are not judged. */
export function reviewersProblems(team: unknown, laneNames: string[]): string[] {
  if (!isTable(team)) return [];
  const problems: string[] = [];
  const text = laneNames.join(", ");
  const reviewers = team.reviewers;
  if (Array.isArray(reviewers)) {
    for (const name of reviewers) {
      if (typeof name !== "string") continue;
      const p = reviewerProblem(name, laneNames, text);
      if (p !== null) problems.push(p);
    }
  }
  const lenses = team.lens_reviewers;
  if (isTable(lenses)) {
    for (const lens of Object.keys(lenses).sort()) {
      const names = lenses[lens];
      if (!Array.isArray(names)) continue;
      for (const name of names) {
        if (typeof name !== "string") continue;
        const p = reviewerProblem(name, laneNames, text, lens);
        if (p !== null) problems.push(p);
      }
    }
  }
  return problems;
}
