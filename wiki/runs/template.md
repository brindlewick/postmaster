---
title: Run record template
---

# Run record: YYYY-MM-DD, `<target>`, `<ticket>`

Copy this page to `runs/YYYY-MM-DD-<target>-<ticket>.md` and fill every section from the
run's ledger. Name the target by its repository name only. Where a number comes from the
ledger, say which line or file.

## The run

- Target: `<repository name>`
- Ticket: `<id>`, one line on what it asked for
- Lanes: `<name>` (`<harness>`, `<model>`), one per line; which were arms, which reviewers
- Coachman: `<harness>`, `<model>`
- Outcome: shipped, abandoned or still open, and the date

## What the synthesis took (bears on H1)

One line per lane: what of its work reached the synthesis, from the coachman's synthesis
note. Then one line: did any lane's work reach it whole?

## Review findings (bears on H2)

| finding | made by | also made independently by | held up |
|---|---|---|---|
| … | lane | lane, or none | yes, no, dismissed |

Counts: findings, corroborated findings, corroborated that held up, uncorroborated that held up.

## Disagreements recorded (bears on H3)

Each fork the coachman recorded as a proposed rule, and whether the project adopted it.

## Gate

The gate command, its exit on the synthesis before review and after the last round.

## Cost

Tokens per lane and for the coachman where the harness reports them; wall-clock from first
launch to ship card.

## Source

The ledger path and the run directory, as recorded at the time.
