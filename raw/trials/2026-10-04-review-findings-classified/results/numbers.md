# Numbers

Produced by `python3 apparatus/tally.py data/findings.tsv first-reading.tsv second-reader.tsv anchors.tsv` from this folder. Nothing here is typed by hand.

## Counts of the first reading

| run | serious findings | prop, cheap | prop, heavy | both | core | neither |
|---|---|---|---|---|---|---|
| #202 | 34 | 16 | 5 | 10 | 0 | 3 |
| #216 | 17 | 9 | 3 | 5 | 0 | 0 |
| #252 | 14 | 1 | 4 | 9 | 0 | 0 |
| #268 | 19 | 11 | 6 | 0 | 0 | 2 |
| all | 84 | 37 | 18 | 24 | 0 | 5 |

Marked clear: 47 of 84; arguable: 37.

| label | clear | arguable |
|---|---|---|
| prop, cheap | 23 | 14 |
| prop, heavy | 6 | 12 |
| both | 16 | 8 |
| core | 0 | 0 |
| neither | 2 | 3 |

Findings in a class a different structure would have removed (by construction): 11: 216/bug-2, 216/bug-10, 216/bug-16, 216/bug-17, 252/bug-16, 252/bug-18, 252/bug-23, 268/bug-1, 268/security-5, 268/bug-13, 268/security-12

## Serious findings by round

| run | r1 | r2 | r3 | r4 | r5 | r6 | r7 | r8 | r9 |
|---|---|---|---|---|---|---|---|---|---|
| #202 | 12 | 4 | 3 | 2 | 4 | 1 | 5 | 1 | 2 |
| #216 | 5 | 1 | 4 | 7 | 0 | 0 | 0 | 0 | 0 |
| #252 | 5 | 5 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |
| #268 | 4 | 11 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |

## Families

| family | n | runs | rounds | labels |
|---|---|---|---|---|
| classifier-syntax | 10 | #202 | r1, r2, r3, r4, r5, r7 | prop-cheap 10 |
| scanner-vs-tool | 9 | #268 | r1, r2, r3 | prop-cheap 3, prop-heavy 6 |
| classifier-semantics | 6 | #202 | r1, r5, r7 | both 1, prop-cheap 1, prop-heavy 4 |
| scanner-lexing | 6 | #268 | r2, r3 | prop-cheap 6 |
| restore | 5 | #202 | r1, r3, r7, r9 | both 5 |
| card-escaping | 4 | #202 | r1, r2, r5, r8 | prop-cheap 4 |
| environment | 4 | #202, #216, #252 | r1, r2, r3 | both 4 |
| dry-run-parity | 3 | #252 | r2, r3 | both 3 |
| integrity | 3 | #216 | r1, r3, r4 | prop-cheap 3 |
| protocol-prose | 3 | #202, #268 | r1, r5 | neither 3 |
| agreement | 2 | #216, #268 | r2, r4 | both 1, prop-cheap 1 |
| attribution | 2 | #202 | r2, r9 | both 2 |
| classifier-inference | 2 | #202 | r1, r6 | neither 2 |
| encoding-edge | 2 | #252 | r1, r3 | prop-heavy 2 |
| forgotten-effect | 2 | #216 | r4 | both 2 |
| limit | 2 | #216 | r3 | prop-cheap 2 |
| read-error | 2 | #202, #252 | r1, r3 | both 2 |
| state-catalogue | 2 | #252 | r2 | prop-heavy 2 |
| adapter-contract | 1 | #252 | r3 | both 1 |
| card-content | 1 | #216 | r1 | prop-cheap 1 |
| exit-status | 1 | #252 | r1 | both 1 |
| filesystem-edge | 1 | #216 | r1 | prop-cheap 1 |
| hidden-state | 1 | #216 | r4 | prop-cheap 1 |
| idempotence | 1 | #252 | r1 | both 1 |
| interface-fact | 1 | #216 | r4 | prop-heavy 1 |
| location | 1 | #202 | r7 | prop-heavy 1 |
| output | 1 | #216 | r4 | prop-heavy 1 |
| pid-reuse | 1 | #252 | r1 | both 1 |
| policy | 1 | #202 | r1 | prop-cheap 1 |
| pure-already | 1 | #252 | r2 | prop-cheap 1 |
| scanner-agreement | 1 | #216 | r2 | prop-heavy 1 |
| scanner-soundness | 1 | #216 | r1 | prop-cheap 1 |
| validation | 1 | #268 | r3 | prop-cheap 1 |

## Second reader

Items answered: 26 of 26.

- random sample: n=20; same four-way label 16 (80%), kappa 0.50; same Q-PROP answer 19; same Q-CORE answer 17; same three-way group 16 (kappa 0.50)
  - where both said prop alone: same cost 6 of 13
  - Q-PROP yes: first reader 18 of 20, second reader 19 of 20; Q-CORE yes: first 3, second 4
  - second reader's labels: {'prop': 15, 'both': 4, 'neither': 1}; first reader's on the same items: {'prop': 15, 'both': 3, 'neither': 2}
- anchors: n=6; same four-way label 5 (83%), kappa 0.75; same Q-PROP answer 6; same Q-CORE answer 5; same three-way group 5 (kappa 0.75)
- all items: n=26; same four-way label 21 (81%), kappa 0.61; same Q-PROP answer 25; same Q-CORE answer 22; same three-way group 21 (kappa 0.61)
  - where both said prop alone: same cost 8 of 15
  - Q-PROP yes: first reader 22 of 26, second reader 23 of 26; Q-CORE yes: first 5, second 5
  - second reader's labels: {'prop': 18, 'both': 5, 'neither': 3}; first reader's on the same items: {'prop': 17, 'both': 5, 'neither': 4}
- Same Q-PROP answer on the random sample: 19 of 20 (Wilson 95% interval 76% to 99%).
- Same four-way label on the random sample: 16 of 20 (Wilson 95% interval 58% to 92%).
- Same by-construction answer over all 26 items: 16. First reader yes on 3, second reader yes on 9; a reader who counts a move from prose to script as a different structure says yes to more.
- Same confidence mark over all items: 14 of 26.

### The six anchors

| anchor | expected | first reading | second reader | second matches expected |
|---|---|---|---|---|
| 252/bug-17 | prop | prop | prop | yes |
| 252/bug-4 | both | both | both | yes |
| 268/bug-5 | neither | neither | neither | yes |
| 252/bug-22 | both | both | prop | no |
| 268/bug-6 | neither | neither | neither | yes |
| 202/bug-2 | prop | prop | prop | yes |

### Where the readers differ (random sample)

| finding | first | second | confidence (first/second) |
|---|---|---|---|
| 216/bug-17 | both | prop, cheap | arguable/arguable |
| 202/bug-1 | neither | prop, cheap | arguable/arguable |
| 216/sec-2 | prop, heavy | both | clear/arguable |
| 252/bug-24 | prop, heavy | both | clear/arguable |

## Controls for the statistic

- A classification against itself: 84 of 84 the same, kappa 1.00 (must be 100% and 1.00).
- The same classification against a seeded shuffle of itself: 40 of 84 the same, kappa -0.08 (must be near chance and near 0).
