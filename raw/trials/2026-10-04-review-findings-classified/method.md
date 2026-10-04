---
kind: trial
subject: what would have caught the serious review findings of four runs before a reviewer did: a pure core, a stated property or a small model, or neither
date: 2026-10-04
---

# Method

**Question.** [Issue #300](https://github.com/brindlewick/postmaster/issues/300), criterion 3.
Postmaster's reviews keep finding case-by-case holes. For each serious finding in four runs, would
a pure core have made it checkable, would a stated property or a small model have caught it, or
neither, and how sure is that reading?

**Order of work, so the controls mean something.** The rubric ([rubric.md](rubric.md)), the six
control findings with the labels expected for them ([anchors.tsv](anchors.tsv)) and the seed of the
sample were committed before any other finding was classified. The commit that holds them is the
first commit of this folder.

## The runs and the date they were read

Runs #202, #216, #252 and #268, read on 2026-10-04 between 23:04 and about 23:30 UTC, from each run's
action log (`actions.jsonl`, one JSON line per action) and its review checkpoint and escalation
cards. Run records are not committed anywhere, so what the count needs of them is committed here:

- [data/finding-lines-202.jsonl](data/finding-lines-202.jsonl), `-216`, `-252` and `-268`: every
  `finding` line of the run's log, copied unchanged.
- [data/findings.tsv](data/findings.tsv): one row per serious finding, 84 rows, with the id the run's
  checkpoint card gives it, its round, severity, location and the snapshot commit the round reviewed.

**Runs #252 and #268 were still in review when they were read.** Both had finished round 3 and
started round 4. Nothing of round 4 is counted for them. Run #216 had its round-4 findings (it ran a
fourth round on the user's word) and run #202 had finished all nine rounds. Counts for #252 and #268
are therefore of the findings that existed at 23:04 UTC.

The code each finding is in is on the run's branch in the repository, read with `git show
<snapshot>:<file>`. The snapshot is the commit the round reviewed: the head after the previous
round's fixes. Snapshots are in `data/findings.tsv`.

## What a serious finding is, and how it was counted

A **serious finding** is a `finding` line of class `gating` and severity `P1` or `P2`. The coachman
writes such a line only for a finding it verified and did not dismiss, so dismissed findings are not
in the count. Style-class findings and P3 findings are not serious. A style-lens report that the
coachman fixed as a gating defect carries class `gating` and is counted (one, 202/style-1).

The count for one run's log is this command, with `<log>` its finding lines:

    grep -cE '"detail": ?"gating P[12] ' <log>

The pattern allows a space after the colon because one `finding` line in run #202's log was written
with spaces (`"action": "finding"`) where all others have none. Counting `finding` lines with the
strict pattern read 57 where the reader that parses each line as JSON read 58. The spacing-tolerant
pattern reads 58, and the extra line is a style line, so the serious count is unaffected.

| log | `finding` lines | serious |
|---|---|---|
| #202 | 58 | 31 |
| #216 | 30 | 17 |
| #252 | 37 | 14 |
| #268 | 40 | 19 |

**Controls for the count, through the same command.** The positive control is run #202's finding
lines, which read 31. The negative control is run #265's finding lines
([data/control-negative-finding-lines-265.jsonl](data/control-negative-finding-lines-265.jsonl)):
11 `finding` lines, all style P3, which read 0. A command that counted every `finding` line would read
11 on it.

**Three serious findings are not in the logs.** Run #202's rounds 8 and 9 logged no `finding`
lines. Their three P2 findings (bug-53, bug-57, bug-58) are taken from the run's escalation
lines and its checkpoint card, which name them, and are marked `escalation and checkpoint` in the
table. That makes 31 + 3 = 34 for #202 and 84 in all.

**Alignment.** The ids and descriptions on the checkpoint cards were typed against the log lines in
order, and the table-building script refused any pair whose round or severity disagreed (it did
not disagree).

## The reading

Each finding is read against [rubric.md](rubric.md): two yes or no questions, whether a stated
property or a small model would have caught it (Q-PROP) and whether a pure core would have made it
checkable (Q-CORE), giving four labels, `prop`, `core`, `both` and `neither`. Each answer carries its
one-line reason, the property sentence or the function that would be extracted, and how sure the
reader is (`clear` or `arguable`).

The brief's three groups map as follows: "a pure core would have made it checkable" is `core` and
`both`; "a stated property or a small model would have caught it" is `prop` and `both`; "neither"
is `neither`. `both` is counted in each of the first two and is also shown alone.

## The controls

1. **Anchors.** Six findings chosen before the rest were read, two for which the answer is obviously
   `prop`, two obviously `both` and two obviously `neither` ([anchors.tsv](anchors.tsv)), each with its
   reason. They are classified first. They are the positive and the negative control for the label:
   the reading must produce each of the three groups, and it must produce `neither` for prose with
   nothing to run.
2. **A second reader.** A helper that had not seen the first classification read a random sample
   of 20 of the other 78 findings, plus the six anchors without being told which they were, against
   the same rubric and the same code. The sample is drawn with `random.Random(300).sample` from the
   78 other keys sorted as strings. Agreement is reported as the share of identical labels, the
   share on each question separately, and Cohen's kappa on the four labels.
3. **Both readers are language models and both know the defect**, so neither is free of hindsight.
   The rubric makes the reader write the property without mentioning the defect, and that sentence is
   what a person can check.
