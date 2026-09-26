---
title: postmaster wiki
type: schema
updated: 2026-09-26
---

# postmaster wiki

What this project has learned: how the agent CLIs it drives really behave, what the services
it depends on actually do, why the design is shaped as it is, and what happens when several
models implement one ticket. That last question is the reason the project exists.

Each page makes a claim and says how sure it is, from **claimed** (stated, with nothing behind
it yet) to **settled** (tested, including the test that could have overturned it). Each claim
cites the evidence it rests on, kept in [`raw/`](../raw/README.md) in this repository, so you
can open it and check. [How the wiki is kept](schema.md) defines the standings in full, and
[the log](log.md) lists recent changes.

## Combining models

Does implementing one ticket with several models, each unable to see the others' work,
produce better software than one good model? If so, how?

- [Combining models](concepts/combining-models.md): three hypotheses and five open questions,
  all **claimed**, since no runs have been recorded yet.

## Harnesses

How each agent CLI really behaves, as distinct from what its documentation says.

- [Prompt delivery differs by harness](concepts/prompt-delivery.md): **settled**.

## Trackers and tooling

What the services and CLIs postmaster depends on actually do.

- [Herdr and headless launches](concepts/herdr-headless-launches.md): **settled**, for claude.
  Left to itself Herdr shows a working headless claude as idle, and a launch that inherits its
  caller's pane reports into it; the view is true when each launch owns its pane and the host
  reports its state.

## Decisions

Why the design is shaped as it is.

- [The workhorse spec](concepts/workhorse-spec.md): **claimed**. Each workhorse drafts its
  own, which keeps the workhorses independent of each other and of the coachman, and makes
  each run auditable.
- [A ticket's shape is checked before it is accepted](concepts/ticket-shape.md): **claimed**.
  A title, the problem, numbered criteria each answerable yes or no, and the user's direction,
  checked by a script before any ticket is dispatched. What is missing is asked of the user.
- [The review loop](concepts/review-loop.md): **claimed**. Style, bug and security review run
  as one loop in one leg, so each round's fixes are re-reviewed by both gating lenses in the
  next. It should also take fewer rounds.

## Sources

[Recorded runs and captured reading](sources/index.md). None yet.
