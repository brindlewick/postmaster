# How often a lane's evidence is `not shown`, and whether the check bounds it

Two questions, each answered by the files named. The conclusions are in
[pstack](../../../wiki/sources/pstack.md), not here.

## Part 1: the count

**What was counted.** The `## Evidence` section of `WORKHORSE-SUMMARY.md` at the tip of each lane
branch `wb/*`, in two kinds of repository:

- this repository, postmaster: the lane branches of the runs dispatched against it, as the main
  checkout holds them;
- the fixture repositories: every directory in the folder that `scripts/run fixture new` writes its
  copies to, 48 of them, those with no lane branches counting nothing.

Nothing else was opened. The reads are `git for-each-ref refs/heads/wb/*` and
`git show <branch>:WORKHORSE-SUMMARY.md`. No run record, marker or worktree was read or changed, and
the runs of other projects were not looked at.

**How an entry is read.** `apparatus/count_not_shown.py` takes the numbered entries under the heading,
joins an entry's continuation lines, and calls an entry `not shown` when its text, with backticks,
asterisks and underscores removed and lowered, starts with `not shown`. It calls an entry `shown` when
the text names a path under `.postmaster/verify/`, and `other` otherwise. A branch with no summary, or a
summary with no Evidence section, counts no entries.

**Controls.** They run when the script loads. A made-up summary of two shown entries and one `not shown`
must count 2 and 1, and a text with no Evidence section must read as having none. `other` is a count of
its own, and it read 0 everywhere, so every real entry fell into one of the first two kinds.

**What the count covers.** The branches that existed in the clone when it was read, 2026-10-04 at about
09:15 UTC. A lane branch of a run still going is read as it stood. A branch already deleted is not
counted. Of the 88 lane branches of this repository, 78 hold a summary and 21 hold an Evidence section.

`apparatus/per_summary.py` lists the summaries that hold a `not shown` entry, with their sizes, using the
first script's parser and classifier. The outputs are `counts.out`, `per-summary.out` and `reasons.out`.
`reasons.out` is each `not shown` entry's reason, as written, with the lane branch it came from.

## Part 2: the check

`apparatus/summary-evidence-controls.sh` makes four summaries for one ticket, the fixture ticket
`remove`, which numbers eight acceptance criteria, and runs `scripts/run summary-evidence` on each, at
postmaster commit `5c58c83` (the branch adds only wiki and raw files to it):

| summary | what it holds |
|---|---|
| `all-not-shown` | all eight entries `not shown: <reason>` |
| `one-missing` | seven entries, the eighth left out |
| `cites-a-missing-file` | the first entry names a file under `.postmaster/verify/` that does not exist, the other seven `not shown` |
| `one-shown` | the first entry names a file that exists, the other seven `not shown` |

`one-missing` and `cites-a-missing-file` are controls: they show that the check can fail on a summary
that has the right number of entries. The output is `summary-evidence-controls.out`.
