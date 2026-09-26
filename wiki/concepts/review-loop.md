---
title: The review loop
type: concept
standing: claimed
sources: []
updated: 2026-09-26
---

# The review loop

**Claim.** Style, bug and security review work better as one loop in one leg than as three
passes in three legs. Each round runs every lens on one snapshot, until no lens finds anything
new. It should take fewer rounds, it needs one leg start-up instead of three, and every fix is
re-reviewed by every lens unless the loop stops at its round cap.

**Standing: claimed.** This is a decision taken on reasoning. No run has been recorded under
either design, so neither the time saved nor the coverage gained is measured yet. The change is
[issue #36](https://github.com/brindlewick/postmaster/issues/36).

## The reasoning

- **Every fix is re-reviewed by every lens.** When the passes ran in sequence, style, then
  bug, then security, a fix made in the security pass was re-checked only by security
  reviewers. No bug reviewer ever saw it. In the loop, every round after the first runs every
  lens on the code as fixed so far, so each sees every fix, whichever lens found the defect it
  fixes.
- **Later rounds still review the fixed code.** The sequence existed so that later passes
  reviewed final code. The loop keeps that: every round reviews the code as fixed so far.
- **Fewer rounds, and one leg start-up instead of three.** On paper, a typical run goes from
  about five review rounds (style 1, bug 2, security 2) to two or three (unverified).
- **Style blocks a ship, as bug and security do.** It was advisory, and ran in round 1 only,
  until the user decided otherwise on 2026-09-26
  ([a ticket names the turnpikes its run passes through](turnpikes.md)). It now runs every
  round, and its verified findings are fixed like any other.

## What it costs

- **Concurrency.** Every round runs every reviewer lane under every lens at once, and each may
  run the full test suite. With two reviewer lanes that is six processes where there were two. The
  levers are the run ceiling and the test runner's worker cap. A cap on reviewers per round is
  added only if runs show one is needed. Each lane also runs three reviews at once on one
  account, so it can reach a usage limit sooner. A lane that does is DEGRADED for the round, as
  any walled lane is.
- **Context.** One leg now carries all three lenses' findings. The five-round cap bounds it. If
  a leg's context still runs out, the leg would be split at a round boundary, never by lens,
  since a split by lens would bring back the gap the loop closes.
- **Colliding fixes.** Fixes from different lenses can touch the same code. One coachman sees
  them together and reconciles them before applying.
- **Style can keep the loop going.** A style finding can be verified only by reading it against
  the project's conventions, since nothing can be run to check it, so a loop can go on over a
  matter of taste. The round cap and the escalation on a repeated class of finding bound it.
- **The cap ends all review.** One five-round cap covers the whole loop, so a loop stopped at
  the cap ships its last round's fixes unreviewed. In sequence, a capped bug pass was still
  followed by the whole security pass.
- **Same-lane duplicates.** Round 1 puts one snapshot in front of every lens, so one lane can
  report the same defect under two lenses. That is one model agreeing with itself, not
  corroboration. H2 in [combining models](combining-models.md) counts corroboration by lane, and
  the record keeps every lens and every lane that reported a finding so that it can.

## What would settle it

The stage timings from `scripts/run-times.sh` measure the review stage once runs exist. From
them and from each run's action log:

- the review stage's duration and its number of rounds, per run, against the estimate above;
- how often a bug reviewer finds a defect in code that a fix for a security finding changed.
  The sequence could not find these, since no bug reviewer saw a security fix, so each one is
  coverage the loop added. The log carries what this needs: each `finding` line names its file
  and line, and each `apply` line the findings it fixes;
- whether round 1 makes the machine queue or swap, and whether a review leg runs out of context;
- how many rounds style keeps a loop going after bug and security have found nothing new, from
  the lens and round on each `finding` line.

The claim is weakened if the loop takes as many rounds as the sequence did, or if its costs
force a cap on reviewers or a split leg on ordinary tickets.

## What changed because of it

A run has three legs, `synthesis`, `review` and `ship`, where it had five.
`skills/postmaster/coachman.md` runs review as one stage, `review`, with one checkpoint card,
and `scripts/stage.sh` refuses the three review stages it replaces. `[team.coachman_legs]` in
the config takes `synthesis`, `review` and `ship`, and `scripts/launch.sh` refuses a config
that names `style`, `bug` or `security`.

Since then, the lenses are the turnpikes a ticket names, all three by default, a run whose
ticket names none has no review leg, and style blocks a ship like bug and security:
[a ticket names the turnpikes its run passes through](turnpikes.md).
