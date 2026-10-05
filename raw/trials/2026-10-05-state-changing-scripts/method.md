# Which scripts remove or rewrite something, and which offer a dry run

One question for candidate 9 of [pstack](../../../wiki/sources/pstack.md): the first report took its baseline
from the raw text of #252, "of 53 script wrappers, 2 offer a dry run and 4 offer JSON output", counted at `ede70e2`
over the `.sh` wrappers. Those wrappers are gone. How many of today's scripts remove or rewrite something, and how many
of those offer a dry run? The conclusions are in that page, not here.

## What was read

On 2026-10-05, the 64 files `scripts/*.ts` that are not tests, at commit `a265197`. Each is a command that
`scripts/run <name>` resolves, or a test module. `scripts/lib/` holds libraries and `scripts/run` is the shell
dispatcher; neither is counted. The classification is by reading each file's header and the code its header
points to, and was fixed before the table was built.

**Definition.** A script **removes or rewrites** when a normal successful run of any of its commands, given valid
arguments, can do one of these to something that existed before the command started, other than something the same
command created (its own temporary files, folders and checkouts): remove it (delete a file, folder, link, marker, lock or
ledger line; remove a git worktree, clone, branch or ref; stop a process; close a window or pane), or rewrite it (replace the
contents of a file directly or by temporary file and rename; move a git ref; change a ticket's state, title, body or labels
in a tracker; replace a link). Not counted: creating something new, appending a line to an append-only log, writing to
standard output, `git fetch`, and running the project's own build or tests. Classes: **Y** removes or rewrites state that
running the flow again cannot re-derive; **Yw** only its own derived output; **A** adds or appends only; **T** touches only
its own temporary files; **R** reads only; **X** is a test module. A **dry run** is a documented flag or mode that makes the
command change none of the above and print what it would do; "part" when only some of its changing commands have one. A
read-only report command is not a dry run of anything.

## Controls

The pattern `--dry-run|dry[-_ ]?run`, case-insensitive, counted by `grep -c` in each file. Positive controls, known to have a
dry run: `setup.ts` 4, `link-skills.ts` 4, `aftercare.ts` 47. Negative controls, read and confirmed to remove or rewrite
state: `stage.ts` 0, `run-meta.ts` 0, `cut-scratch.ts` 0. The one stray hit, `host.ts` 1, is a comment that mentions
`aftercare.ts`'s dry run, so `host.ts` has none. Over all the non-test files the pattern names exactly four files, three of
them real. The file list was cross-checked against `ls scripts/*.ts` without the tests, with no file missing and none twice.
A second method for the classification: a search for write, remove, rename, append and kill calls in each file's own text
is non-zero for every Y and Yw script except `github` and `plane`, which change tickets through `gh` and HTTP, and the 11 files
classed A, T or R after reading were each read again and kept their class.

## What it does not show

It is one reader's classification, by reading, and not a run of any script. `host.ts` (5766 lines) and the larger read-only
scripts were read by their headers, by searching for removal, rewrite and kill calls, and by reading the cited functions,
not end to end. Which four scripts the baseline meant by "4 offer JSON output" is not recorded; the four found at that commit
are `verify`, `project-settings`, `review-findings` and `usage`. The result is a count of flags, not a measure of whether the
dry runs are right.
