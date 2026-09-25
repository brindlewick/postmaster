---
title: Each horse drafts its own spec
type: concept
standing: claimed
sources: [articles/spec-kit-templates]
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

## The format

A horse's spec follows GitHub Spec Kit's plan and tasks templates, combined in one file
[@articles/spec-kit-templates]. Spec Kit splits the work into three documents: a spec for the
what and why, a plan for the how, and tasks for the order of work. In postmaster the ticket
already holds the first, since the user owns the what, the why and the direction, so a horse
writes only the second and third. A horse writing Spec Kit's spec would be restating
requirements that belong to the ticket.

Three things are adapted to a lane. Spec Kit's constitution check becomes a direction check,
against the ticket's direction and the target project's own rules. Its user-story tags on tasks
become acceptance-criterion tags, since tickets carry numbered criteria rather than stories, and
that lets an audit see at once whether every criterion has a task. Its `NEEDS CLARIFICATION`
markers become recorded decisions, because a horse has nobody to ask mid-run.

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
written from `skills/postmaster/arm-spec-template.md`, and the run's audit keeps a copy of each
one as first committed and as finished.
