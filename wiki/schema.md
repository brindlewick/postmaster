---
title: How the wiki is kept
---

# How the wiki is kept

This page is the contract for every other page. An agent adding to the wiki reads it first.

## Three kinds of page

**A hypothesis page** states one claim about combining models, its standing, the evidence for
and against it by run record, and what would settle it. [Combining models](combining-models.md)
holds them all for now; a hypothesis gets its own page when the evidence outgrows a section.

**A run record** is one run of the tool on one ticket, distilled from its ledger. It lives in
`runs/`, named `YYYY-MM-DD-<target>-<ticket>.md`, and follows [the template](runs/template.md).
It carries numbers, not impressions: which lanes ran, what the synthesis took from each, which
review findings each lane made and which were corroborated, what the gate said, what the run
cost. Every number points back to the ledger line or file it came from.

**A concept page** defines a term the other pages lean on (lane, synthesis, corroboration,
blinkers) when the [vocabulary in AGENTS.md](https://github.com/brindlewick/postmaster/blob/main/AGENTS.md) is not enough.

## Standing of a claim

Every hypothesis carries one of these words, and the log records when it changes:

- **claimed**: stated somewhere (the README, a run's narrative) with no run record here yet
- **supported**: consistent with every run record that bears on it, and there are at least
  three
- **mixed**: run records on both sides; the page says what separates them
- **refuted**: contradicted by run records that a defender of the claim would accept
- **settled**: supported, and the measurement that would refute it has been tried

## Who writes here, and when

A run does not write to the wiki while it runs. A session with the operator distils runs into
the wiki afterwards, from the ledger, so that a claim never rests on a narrative alone. An
agent that adds a run record also updates the standing of every hypothesis the record bears
on, and adds one line to [the log](log.md).

## Writing

Plain, short sentences. A number with the control that could have come out otherwise. A run
record names the target by its repository name and nothing else: no paths, hosts, or people.
Links between pages are ordinary relative markdown links, so they work in the repository and
on the published site alike.

## Publishing

GitHub Pages builds this folder with Jekyll on every push to `main` that touches it
(`.github/workflows/pages.yml`). The repository's Pages setting must be "GitHub Actions",
set once by the operator.
