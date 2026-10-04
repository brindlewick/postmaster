# Controls for the round-1 figures

Each count is run through the same code on a run where it must read non-zero (the positive control) and on a run where it must read zero (the negative control), or against a second program's figure.

| | Count | Positive control | Negative control |
| --- | --- | --- | --- |
| ok | a run's severe findings by round add up to its total, and the total is the review table's | 18 of 18 runs agree, 264 severe findings in all | a finding that names no round is in the total and in no round: #109 has 2 of its 68 |
| ok | round 1 counts the severe findings whose lines name round 1 and no others | #98 reads 3 and #109 reads 21 | fixture-30, whose first round was clean, reads 0; #98's round 2, which held only P3 findings, reads 0 |
| ok | round 1 read again from a run's own log with grep gives the parser's count | #98: 3 by grep, 3 by the parser; #160: 1 by grep, 1 by the parser; #182: 1 by grep, 1 by the parser | round 2, through the same command: #98: 0 by grep, 0 by the parser; #160: 0 by grep, 0 by the parser; #182: 0 by grep, 0 by the parser |
| ok | a run's rounds are the highest round any launch, harvest or finding line names | #110: launch lines name 4, a harvest names 5 (a round run on the user's ruling, with no launch line), so 5 | #200: launch, harvest and finding lines all name 4, so 4 |
| ok | review launch lines name a round, except one that has no text | 508 of 509 launch lines name a round | 1 name none (109: 1) |

- review launch lines name a round, except one that has no text: The launch line that names no round is #109's and has an empty detail. 17 harvest lines name none, in #109 (empty) and #124 (summaries of a round's findings that name the lens and no round); they add nothing a launch line or a finding does not.

## Severe findings in round 1 and round 2, read again with grep

For each of three runs, the lines of the run's own action log that begin `gating P1` or `gating P2`, name the round as `r<N>`, and are not marked DISMISSED, found with `grep -E` and counted without the parser. The parser's count for the same run and round is beside it. Each line was read on 2026-10-04.

| Run | Round | By grep | By the parser | The lines, as written |
| --- | --- | --- | --- | --- |
| 98 | 1 | 3 | 3 | gating P2 r1 bug style luna mimo mimo, verified by reading: step-8 Otherwise falls back to interactive for a …<br>gating P2 r1 style mimo, verified by execution: GIT_DIR steers the mark write to the wrong repo (probe reprod…<br>gating P2 r1 style luna, verified by reading: headless codex postmaster writes trust via launch.sh, against A… |
| 98 | 2 | 0 | 0 | none |
| 160 | 1 | 1 | 1 | gating P2 r1 bug luna, verified by execution: resumed claude lanes undercount tokens (result usage per-invoca… |
| 160 | 2 | 0 | 0 | none |
| 182 | 1 | 1 | 1 | gating P2 r1 bug sol mimo style sol mimo, verified by execution |
| 182 | 2 | 0 | 0 | none |

