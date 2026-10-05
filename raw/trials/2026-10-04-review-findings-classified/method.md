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

The ticket's three groups (criterion 3) map as follows: "a pure core would have made it checkable" is `core` and
`both`; "a stated property or a small model would have caught it" is `prop` and `both`; "neither"
is `neither`. `both` is counted in each of the first two and is also shown alone.

## Changes made after the first commit

Two, both before the second reader began, and both visible in the history of this folder.

1. **The description column of `data/findings.tsv` was corrected** for runs #216, #252 and #268.
   The first version cut each log line at the wrong comma, so those descriptions read "gating P2 r2
   bug luna". The full log line was already in the `log_detail` column and the table is rebuilt from it.
2. **A cost field was added to the rubric.** The first reading showed that "a property would have
   caught it" was true of nearly every finding and said nothing about what the check costs. A `prop`
   label now also says `cheap` (the check runs in process on data) or `heavy` (its oracle or inputs
   need git, a shell or a real tool). The six anchors and the labels expected for them are unchanged.

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

## Results

All counts are in [results/numbers.md](results/numbers.md), made by `python3 apparatus/tally.py
data/findings.tsv first-reading.tsv second-reader.tsv anchors.tsv` from this folder. The first reading
is [first-reading.tsv](first-reading.tsv): one row per finding with its label, cost, confidence, the
property or the function to extract, and the reason. The second reader's rows are
[second-reader.tsv](second-reader.tsv), with the items it was given in
[second-reader-items.tsv](second-reader-items.tsv) and its brief in
[second-reader-brief.md](second-reader-brief.md).

- **The first reading, of all 84:** a cheap property 37, a heavy property 18, a property and a pure core
  (`both`) 24, a pure core alone 0, neither 5. A property or model would have caught 79 (94%); a pure
  core would have made the check possible in 24 (29%), and in all 24 a property was stated too.
- **The second reader, on 26 findings (20 drawn at random, 6 anchors):** the same four-way label on
  21 (81%, kappa 0.61); on the 20 drawn at random on 16 (80%, kappa 0.50, Wilson 95% interval 58% to
  92%). The same answer to the property question on 25 of 26 (on 19 of the 20, interval 76% to 99%),
  and to the pure-core question on 22 of 26. Where both said a property alone, they agreed on cheap or
  heavy for 8 of 15, and on `clear` or `arguable` for 14 of 26 findings. The second reader marked a
  different structure as removing the defect for 9 findings, the first for 3; they agree on 16 of 26.
- **The anchors:** the second reader gave the expected label on 5 of the 6. It read `252/bug-22`,
  git calls that honour an inherited `GIT_DIR`, as `prop`, heavy, where `both` was expected, saying a
  shared git runner would have made the defect impossible.
- **Controls for the statistic:** a classification against itself reads 100% and kappa 1.00; against a
  seeded shuffle of itself, 40 of 84 and kappa -0.08.

## How sure

- **Firm:** what the findings were, which code each sat in, and that two readers reading separately
  agree on whether a stated property could have caught a finding (25 of 26).
- **Soft:** the split between a cheap and a heavy check (agreement 8 of 15), the `clear` and `arguable`
  marks (14 of 26), and the by-construction field (16 of 26). They are reported in the page as a
  range, not as findings.
- **Not measured:** whether an author, working from the ticket and not from the review, would have
  written the property and its generator. Both readers know every defect and both are language models.
  The count says a check could have caught a finding, not that it would have been written. The
  [proposed trials](../../../wiki/concepts/functional-core-and-verification.md) include one that
  measures it.
- **Few runs, clustered findings:** four runs, two of them in review; 18 of the 84 sit in one family,
  the shell-command classifier of #202.

## Deviations

- The second reader reported that it opened code at a later snapshot than the one an item names on
  three occasions, in the course of items 10, 16 and 23 (their own snapshots are later than those of
  items 1, 9, 18, 24 and 25, which it had written or was about to write). It reports that it built
  its answers for those items from the code at their own snapshots. No answer is known to have
  changed, and the agreement is reported as it came out.
- The second reader saw other files' names in directory listings and reports that it opened none of
  them.

## Other things read for the page

- **The runs' cards.** [data/cards/](data/cards/) holds, copied unchanged on 2026-10-05 at 00:10 UTC, the
  review checkpoint card of each run, and the escalation card of #216, #252 and #268. The page cites them
  for what the runs said about their own rounds. #252 and #268 were still in review, and a card written
  after that time is not in this folder. Run logs were not copied: they carry thread identifiers.
- **Kinds.** [results/kinds.md](results/kinds.md) groups the findings by the shape of the missing check, from the
  first reader's family tags (`python3 apparatus/kinds.py first-reading.tsv`). The grouping was made
  after the labels, and the script refuses a family it has no kind for.
- **The tests the runs added.** The test files a run's branch added are
  `git diff --name-only --diff-filter=A main...<branch> -- 'scripts/*.test.ts' 'scripts/lib/*.test.ts'`.
  Cases are the lines of each that open with `test(` or `it(` (with `.skipIf` or `.each`), counted by
  `git show <branch>:<file> | grep -cE '^\s*(test|it)(\.skipIf\([^)]*\))?(\.each\([^)]*\))?\('`, and a
  generator is any line matching `Math.random`, `seeded`, `fast-check`, `forAll` or `fuzz`, counted
  with `grep -ciE`. Read on 2026-10-05: #202 added 2 files with 52 cases, #216 8 files with 52, #252 one
  with 30 and #268 one with 54. The only match is three `Math.random` calls in #202's `reach.test.ts`,
  which make unique names and not inputs. The control through the same command is `scripts/log-action.test.ts`
  on `origin/main`, which matches (its decoder test is described as seeded cases against `iconv -c`). A
  `test(` that does not open its line is not counted, so the case counts are a floor.

## Round 4 of #252, logged after the count

Run #252's fourth review round was logged at 2026-10-04 23:13 UTC, after the 84 findings were counted.
Its nine `finding` lines, read on 2026-10-05 at 00:26 UTC and copied unchanged to
[data/finding-lines-252-round4.jsonl](data/finding-lines-252-round4.jsonl), are one style finding and eight gating
P3 findings: none is serious, so the same command that reads 14 serious lines on the first 37 reads 0 on
these (`grep -cE '"detail": ?"gating P[12] '`). They are not in the 84, and #268's round 4 had not been
logged when they were read.

## Round 4 of #268, logged after the first reading was committed

Run #268's fourth review round was logged on 2026-10-05 at 00:30 UTC, after the rubric, the anchors and the
first reading were committed. Its seven `finding` lines are in
[data/finding-lines-268-round4.jsonl](data/finding-lines-268-round4.jsonl) and the run's escalation card, which
now supersedes the round-3 one, in [data/cards/268-ESCALATION-round4.md](data/cards/268-ESCALATION-round4.md). Four
are serious: two P1 and two P2. They are not in the 84. The first reader labelled them against the same rubric,
alone and without a second reader, in [held-out.tsv](held-out.tsv): all four are `prop`, three cheap and one
heavy. Two are further cases of the lexing family that had already produced the round-2 findings,
one is identical directives sharing an approval identity and one is five settings file names the check did not
list. None is the identity-coverage class that the round-3 escalation proposed to close with a conservative window.

## Checks after the page was built

An independent fact-checker, who had not seen the first reading's work, read the page's account of this trial against
this folder on 2026-10-05. It recomputed the counts with the scripts and by hand and found them right: the tables of
`results/numbers.md` and `results/kinds.md` reproduce, the appendix rows equal `data/findings.tsv` and
`first-reading.tsv`, and the serious counts, the per-round counts, the second reader's figures and the test-case counts
reproduce. It found statements in the page's first draft that said more than the data does, and they were corrected on
the page, not here.

It also read eight findings drawn at random (seed 7) at their snapshots, and judged six labels reasonable, one with an
over-confident mark and one whose cost label the code does not bear. The first, 202/bug-14, is marked `clear` where its
sibling anchor 252/bug-22, the same law, was read the other way by the second reader. The second, 216/sec-4, and its twin
216/bug-4, are labelled cheap, but the code is a script driven from outside, so the check is cheap only once a function of
text is extracted. The first reading's labels were not changed after this. The first reading did not record, for each
finding, whether its code was opened or only its card description read.
