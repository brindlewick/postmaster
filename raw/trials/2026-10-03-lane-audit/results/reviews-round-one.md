# Severe findings by review round, this repository's runs

A severe finding is a verified gating P1 or P2 that was not dismissed, counted in the round its line names. *Rounds* is the highest round that any launch, harvest or finding line of the run names.

Severe findings in round 1: median 4, from 1 to 21. In 14 of the 18 runs the last round is the one after the last round that holds a severe finding: the clean round. In [#124](https://github.com/brindlewick/postmaster/issues/124), [#135](https://github.com/brindlewick/postmaster/issues/135), [#163](https://github.com/brindlewick/postmaster/issues/163) the last round is a round that still holds a severe finding, so the run ended without a clean round after it. In [#200](https://github.com/brindlewick/postmaster/issues/200) the last round is 2 rounds after the last severe finding.

2 severe findings name no round ([#109](https://github.com/brindlewick/postmaster/issues/109): 2); they are in the totals and in no round.

| Run | Rounds | Severe findings in round 1 | Severe findings in all | By round | Rounds after the last round with a severe finding |
| --- | --- | --- | --- | --- | --- |
| [#57](https://github.com/brindlewick/postmaster/issues/57) | 6 | 11 | 24 | 1: 11, 2: 6, 3: 2, 4: 4, 5: 1 | 1 |
| [#75](https://github.com/brindlewick/postmaster/issues/75) | 3 | 2 | 4 | 1: 2, 2: 2 | 1 |
| [#98](https://github.com/brindlewick/postmaster/issues/98) | 2 | 3 | 3 | 1: 3 | 1 |
| [#109](https://github.com/brindlewick/postmaster/issues/109) | 13 | 21 | 68 | 1: 21, 2: 4, 3: 4, 4: 6, 5: 4, 6: 8, 8: 2, 9: 8, 10: 5, 12: 4, no round: 2 | 1 |
| [#110](https://github.com/brindlewick/postmaster/issues/110) | 5 | 4 | 11 | 1: 4, 2: 3, 3: 2, 4: 2 | 1 |
| [#122](https://github.com/brindlewick/postmaster/issues/122) | 13 | 6 | 30 | 1: 6, 2: 4, 3: 2, 4: 1, 5: 3, 6: 2, 7: 3, 8: 1, 9: 3, 10: 2, 11: 2, 12: 1 | 1 |
| [#124](https://github.com/brindlewick/postmaster/issues/124) | 20 | 13 | 28 | 1: 13, 2: 5, 3: 5, 4: 3, 19: 1, 20: 1 | 0 |
| [#135](https://github.com/brindlewick/postmaster/issues/135) | 5 | 11 | 32 | 1: 11, 2: 5, 3: 15, 5: 1 | 0 |
| [#158](https://github.com/brindlewick/postmaster/issues/158) | 3 | 3 | 5 | 1: 3, 2: 2 | 1 |
| [#159](https://github.com/brindlewick/postmaster/issues/159) | 2 | 2 | 2 | 1: 2 | 1 |
| [#160](https://github.com/brindlewick/postmaster/issues/160) | 2 | 1 | 1 | 1: 1 | 1 |
| [#163](https://github.com/brindlewick/postmaster/issues/163) | 5 | 8 | 15 | 1: 8, 2: 3, 3: 1, 4: 2, 5: 1 | 0 |
| [#165](https://github.com/brindlewick/postmaster/issues/165) | 4 | 6 | 10 | 1: 6, 2: 2, 3: 2 | 1 |
| [#170](https://github.com/brindlewick/postmaster/issues/170) | 3 | 2 | 3 | 1: 2, 2: 1 | 1 |
| [#179](https://github.com/brindlewick/postmaster/issues/179) | 5 | 6 | 17 | 1: 6, 2: 5, 3: 4, 4: 2 | 1 |
| [#182](https://github.com/brindlewick/postmaster/issues/182) | 2 | 1 | 1 | 1: 1 | 1 |
| [#200](https://github.com/brindlewick/postmaster/issues/200) | 4 | 4 | 7 | 1: 4, 2: 3 | 2 |
| [#201](https://github.com/brindlewick/postmaster/issues/201) | 3 | 2 | 3 | 1: 2, 2: 1 | 1 |

## Runs grouped by severe findings in round 1

| Severe findings in round 1 | Runs | Which | Rounds each took | Median rounds |
| --- | --- | --- | --- | --- |
| 3 or fewer | 8 | [#75](https://github.com/brindlewick/postmaster/issues/75), [#98](https://github.com/brindlewick/postmaster/issues/98), [#158](https://github.com/brindlewick/postmaster/issues/158), [#159](https://github.com/brindlewick/postmaster/issues/159), [#160](https://github.com/brindlewick/postmaster/issues/160), [#170](https://github.com/brindlewick/postmaster/issues/170), [#182](https://github.com/brindlewick/postmaster/issues/182), [#201](https://github.com/brindlewick/postmaster/issues/201) | 2, 2, 2, 2, 3, 3, 3, 3 | 2.5 |
| 4 to 7 | 5 | [#110](https://github.com/brindlewick/postmaster/issues/110), [#122](https://github.com/brindlewick/postmaster/issues/122), [#165](https://github.com/brindlewick/postmaster/issues/165), [#179](https://github.com/brindlewick/postmaster/issues/179), [#200](https://github.com/brindlewick/postmaster/issues/200) | 4, 4, 5, 5, 13 | 5 |
| 8 or more | 5 | [#57](https://github.com/brindlewick/postmaster/issues/57), [#109](https://github.com/brindlewick/postmaster/issues/109), [#124](https://github.com/brindlewick/postmaster/issues/124), [#135](https://github.com/brindlewick/postmaster/issues/135), [#163](https://github.com/brindlewick/postmaster/issues/163) | 5, 5, 6, 13, 20 | 6 |
