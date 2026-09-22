---
title: postmaster wiki
---

# postmaster wiki

Research notes on what happens when several models implement the same ticket at once. The
wiki lives in the `wiki/` folder of the postmaster repository, is edited by the people and
agents who run the tool, and is published with GitHub Pages.

The question it exists to answer: **does combining models produce better software than one
good model, and if so, through which mechanisms?** Everything here is one of two things: a
hypothesis with its current standing, or evidence from a recorded run. A claim with no run
behind it is marked as such.

## Pages

- [How the wiki is kept](schema.md): page kinds, what each must contain, who writes here
- [Combining models](combining-models.md): the hypotheses and what would settle each
- [Run records](runs/index.md): one page per run, distilled from its ledger
- [Log](log.md): dated additions and changes

## Where the evidence comes from

Every postmaster run writes a ledger (one JSON line per action, through
`scripts/log-action.sh`) and a narrative: `run-log.md`, the review notes of each round, and
the ship card. A run record here is a distillation of those, with the numbers, the lanes
involved and a pointer back to the ledger. Nothing goes in the wiki that a ledger cannot
back.
