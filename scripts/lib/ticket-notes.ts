// The run's ticket notes: what the coachman and the workhorses get from the
// ticket. team.ticket_notes is "given" (the default) or "held-back"; a config
// without the key reads as given, so a run works as it does today. Every step
// reads the value from the run's record, never from the live config.
import { join } from "node:path";
import { tryJsonFile } from "./data.ts";

export const TICKET_NOTES_VALUES = ["given", "held-back"] as const;
export type TicketNotes = (typeof TICKET_NOTES_VALUES)[number];

/** The configured value: "given" when the key is absent; anything else is refused. */
export function resolveTicketNotes(
  config: Record<string, unknown>,
): { value: TicketNotes } | { error: string } {
  const team = config.team;
  const configured =
    typeof team === "object" && team !== null && !Array.isArray(team)
      ? (team as Record<string, unknown>).ticket_notes
      : undefined;
  const value = configured === undefined ? "given" : configured;
  if (typeof value !== "string" || !(TICKET_NOTES_VALUES as readonly string[]).includes(value)) {
    return { error: `team.ticket_notes must be given or held-back, not ${String(configured)}` };
  }
  return { value: value as TicketNotes };
}

/**
 * The run's ticket notes from run.json: "held-back" only when the record says
 * so; a record with no value is a given run, and any other shape reads as
 * given here (run-meta refuses a record it cannot write).
 */
export function ticketNotes(dispatch: string): TicketNotes {
  const meta = tryJsonFile<Record<string, unknown>>(join(dispatch, "run.json"));
  const config = meta?.config as Record<string, unknown> | undefined;
  const team = config?.team as Record<string, unknown> | undefined;
  return team?.ticket_notes === "held-back" ? "held-back" : "given";
}
