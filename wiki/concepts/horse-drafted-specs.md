---
title: Each horse drafts its own spec
type: concept
standing: claimed
sources: []
updated: 2026-09-23
---

# Each horse drafts its own spec

**Claim.** When a ticket carries the what, the why and the high-level technical direction, the
detailed spec is better drafted by each horse for itself than by the coachman for all of them.

**Standing: claimed.** This is a decision taken on reasoning, before any run bears on it. The
comparison in [issue #9](https://github.com/brindlewick/postmaster/issues/9) is its test.

## The reasoning

- **It keeps the horses independent.** Several models are worth running because they take
  different approaches ([combining models](combining-models.md), H1). One shared spec fixes the
  approach before any horse starts, so the horses differ only in how they carry it out, and the
  synthesis has less to choose between.
- **It keeps the coachman a neutral judge.** The coachman compares the horses' work and
  composes the synthesis. A coachman that had written the spec would be judging each horse
  against its own answer, and would tend to favour whichever followed it most closely.
- **It makes the run auditable.** Each horse's spec, committed before its code, records what it
  meant to build. Read beside what it built, it shows whether the horses diverged at the design
  or only in the code, and where a horse departed from its own plan.

## What it does not do, at this stage

Nobody reviews a spec during the run, and no stage waits on one. It is an audit record. A
review step would be a separate decision with its own test: checking specs against each other,
or against what the coachman would have done, would push the horses back toward one approach.

## What would change it

The comparison in issue #9 runs the same tickets three ways: each horse drafting its own spec,
the coachman drafting one shared spec, and no spec at all. Its decision rule is fixed in
advance: this stays the default unless a shared spec produces a clearly better synthesis.

## What changed because of it

The arm contract in `skills/postmaster/coachman.md` gains `ARM-SPEC.md` as an arm's first act,
and the run's audit keeps a copy of each one.
