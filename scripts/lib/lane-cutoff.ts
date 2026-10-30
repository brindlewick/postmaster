// A lane cut off with its helpers still running (#607). Headless Claude Code ends a lane's
// background helpers a fixed time after the lane's last turn and drops what they were doing, so
// a lane that starts helpers and then ends its turn exits 0 with a short status line where its
// review should be. The launch reads its own stream as it ends and leaves a marker beside it;
// the round and the surveyor read the marker, so a cut-off lane is never counted as reviewed.
//
// What counts as cut off, for a Claude stream: a result record whose
// `subagent_stats.killed.system` is above 0 (the harness stopped helpers), or a
// `task_notification` that reports a stopped (killed or cancelled) helper, a task the stream
// started as `local_agent`. A stopped background shell is not a helper, a helper that failed is
// not a stopped one, and a short final message alone is no signal. On the recorded lane streams
// these two signals flag every lane the harness cut off and no other.
//
// Every other harness is not read: no stream recorded here shows what its cut-off end looks
// like, and a reading nobody has seen would be a guess presented as a check.
//
// The marker is `<stream without .jsonl>.cutoff`, the way the stream's `.done` and `.err` sit
// beside it. A launch writes it for a cut-off lane and removes the one an earlier launch left
// for a whole lane, so it always describes the latest launch of the stream.
//
// Pure reading, effects at the edge: readCutoff takes the stream's text and returns the reading;
// recordCutoff, readCutoffMarker and cutoffMarkerPath are the only functions that touch a file.
import { readFileSync, rmSync, writeFileSync } from "node:fs";

/** What a round and a surveyor say of a lane carrying the marker. */
export const CUTOFF_CAUSE = "cut off with helpers still running";

export type CutoffReading =
  | { readonly state: "cut-off"; readonly stopped: number }
  | { readonly state: "whole" }
  | { readonly state: "not-read" };

const NOT_READ: CutoffReading = { state: "not-read" };
const WHOLE: CutoffReading = { state: "whole" };

/** The notice statuses that mean the harness or a stop took a task before it reported. */
const STOPPED = new Set(["stopped", "killed", "cancelled", "canceled"]);

type Rec = Readonly<Record<string, unknown>>;

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/** The stream's records, in order. A line that is not a JSON object is not a record: file output
 * and a partial line reach the stream beside the harness's own events. */
const records = (tail: string): readonly Rec[] =>
  tail.split("\n").flatMap((raw): Rec[] => {
    if (raw.trim() === "") return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return isRec(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  });

/** The most helpers any result record counts as stopped by the harness itself. */
const systemKills = (recs: readonly Rec[]): number =>
  recs
    .filter((r) => r.type === "result")
    .map((r) => {
      const stats = r.subagent_stats;
      const killed = isRec(stats) ? stats.killed : undefined;
      const system = isRec(killed) ? killed.system : undefined;
      return typeof system === "number" && Number.isFinite(system) ? system : 0;
    })
    .reduce((most, count) => Math.max(most, count), 0);

const systemRecord = (r: Rec, subtype: string): boolean =>
  r.type === "system" && r.subtype === subtype && typeof r.task_id === "string";

/** How many helpers (tasks the stream started as `local_agent`) a notice reports stopped. */
const stoppedHelpers = (recs: readonly Rec[]): number => {
  const helpers = new Set(
    recs
      .filter((r) => systemRecord(r, "task_started") && r.task_type === "local_agent")
      .map((r) => r.task_id),
  );
  const stopped = new Set(
    recs
      .filter(
        (r) =>
          systemRecord(r, "task_notification") &&
          typeof r.status === "string" &&
          STOPPED.has(r.status) &&
          helpers.has(r.task_id),
      )
      .map((r) => r.task_id),
  );
  return stopped.size;
};

/** What a launch's stream, from the point it began, says about its helpers. */
export function readCutoff(harness: string, tail: string): CutoffReading {
  if (harness !== "claude") return NOT_READ;
  const recs = records(tail);
  const stopped = Math.max(systemKills(recs), stoppedHelpers(recs));
  return stopped > 0 ? { state: "cut-off", stopped } : WHOLE;
}

/** The marker beside a stream: `.cutoff` in place of `.jsonl`, else appended. */
export function cutoffMarkerPath(stream: string): string {
  return stream.endsWith(".jsonl")
    ? `${stream.slice(0, -".jsonl".length)}.cutoff`
    : `${stream}.cutoff`;
}

const note = (stopped: number): string =>
  `${stopped} ${stopped === 1 ? "helper stopped before it reported" : "helpers stopped before they reported"}\n`;

/**
 * Read a launch's stream tail and leave the marker its reading calls for: written for a cut-off
 * lane, removed for a whole one, untouched for a harness that is not read. A marker that cannot
 * be written throws, because a lane that was cut off and reads as whole is the fault this
 * exists to prevent; the caller decides how to fail closed.
 */
export function recordCutoff(o: {
  readonly stream: string;
  readonly harness: string;
  readonly tail: string;
}): CutoffReading {
  const reading = readCutoff(o.harness, o.tail);
  const marker = cutoffMarkerPath(o.stream);
  if (reading.state === "cut-off") writeFileSync(marker, note(reading.stopped));
  else if (reading.state === "whole") rmSync(marker, { force: true });
  return reading;
}

/** The marker's first line, the generic cause when it is empty, or null when the lane has none. */
export function readCutoffMarker(marker: string): string | null {
  let text: string;
  try {
    text = readFileSync(marker, "utf8");
  } catch {
    return null;
  }
  const first = text.split("\n")[0]?.trim() ?? "";
  return first === "" ? CUTOFF_CAUSE : first;
}
