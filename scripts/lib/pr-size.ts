// What a reviewer has to read in a pull request: the changed lines of a change, counted from the
// report of `git diff --numstat -z -M`. Pure: scripts/pr-size.ts reads git and the project's
// settings and passes them in.

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
