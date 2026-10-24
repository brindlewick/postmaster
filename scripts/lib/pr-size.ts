// What a reviewer has to read in a pull request: the changed lines of a change, counted from the
// report of `git diff --numstat -z -M`, and the budget a project sets for them. Pure: what it needs
// from git and from the project's settings is passed in.

export const DEFAULT_AIM = 200;
export const DEFAULT_CAP = 400;

export interface Budget {
  readonly aim: number;
  readonly cap: number;
}

/** The budget a project's settings give, or null when it has none. It applies where the project's
 * runs open draft pull requests for the user to review (`ship.draft_pull_requests` is "on") and
 * where the project names a number for `pr_size_cap`, which turns it on by itself, whatever the
 * switch says. An aim alone turns nothing on, since the cap is the limit, and `pr_size_cap = "off"`
 * leaves a project with no limit even where drafts are on. A key the project leaves out takes the
 * default, and an aim left out never exceeds the cap. Throws when the aim is above the cap, and
 * when `ship.draft_pull_requests` holds anything but "on" or "off": a mistaken value fails loudly
 * and never drops the limit quietly. */
export function budgetOf(ship: unknown, project: Readonly<Record<string, unknown>>): Budget | null {
  const table = typeof ship === "object" && ship !== null ? (ship as Record<string, unknown>) : {};
  const drafts = table.draft_pull_requests;
  if (drafts !== undefined && drafts !== "on" && drafts !== "off") {
    throw new Error(
      `ship.draft_pull_requests must be "on" or "off", not ${JSON.stringify(drafts)}`,
    );
  }
  const named = project.pr_size_cap;
  if (named === "off" || (drafts !== "on" && typeof named !== "number")) return null;
  const cap = typeof named === "number" ? named : DEFAULT_CAP;
  const aim =
    typeof project.pr_size_aim === "number" ? project.pr_size_aim : Math.min(DEFAULT_AIM, cap);
  if (aim > cap) throw new Error(`pr_size_aim (${aim}) is above pr_size_cap (${cap})`);
  return { aim, cap };
}

export interface Change {
  readonly path: string;
  readonly added: number;
  readonly removed: number;
}

export interface Size {
  readonly lines: number;
  readonly files: number;
}

const ROW = /^([0-9]+|-)\t([0-9]+|-)\t(.*)$/su;

/** The text files of a `git diff --numstat -z -M` report. A renamed file carries its new path. A
 * binary file, which git reports as `-`, is left out: it has no lines to read. */
export function parseNumstat(report: string): Change[] {
  const cells = report.split("\0");
  const changes: Change[] = [];
  for (let i = 0; i < cells.length; i++) {
    const row = ROW.exec(cells[i] ?? "");
    if (row === null) continue;
    const renamed = row[3] === "";
    const path = renamed ? (cells[i + 2] ?? "") : (row[3] ?? "");
    if (renamed) i += 2;
    if (row[1] !== "-") changes.push({ path, added: Number(row[1]), removed: Number(row[2]) });
  }
  return changes;
}

/** The changed lines and files of a change: lines added plus lines removed, tests included. A file
 * deleted whole counts as one line, since reading it asks little of a reviewer, and `skip` names
 * the files that count for nothing. */
export function sizeOf(
  changes: readonly Change[],
  deleted: ReadonlySet<string>,
  skip: (path: string) => boolean,
): Size {
  const counted = changes.filter((change) => !skip(change.path));
  return {
    files: counted.length,
    lines: counted.reduce(
      (sum, change) => sum + (deleted.has(change.path) ? 1 : change.added + change.removed),
      0,
    ),
  };
}
