// The run's mode, read the way the mode check does, for every script that must
// treat single-thread runs as having no workhorse stage.
import { join } from "node:path";
import { tryJsonFile } from "./data.ts";

/** The run's mode from run.json: `single-thread` only when the record says so; a record with
 * no mode is a synthesis run, and any other shape reads as synthesis here (the mode check is
 * what refuses a record that names no mode this flow knows). */
export function runMode(dispatch: string): string {
  const meta = tryJsonFile<Record<string, unknown>>(join(dispatch, "run.json"));
  const m = meta?.mode;
  return typeof m === "string" && m === "single-thread" ? "single-thread" : "synthesis";
}
