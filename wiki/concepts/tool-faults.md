---
title: Faults a run finds in postmaster become tickets, not fixes made during the run
type: concept
standing: claimed
sources: []
updated: 2026-09-26
---

# Faults a run finds in postmaster become tickets

**Claim.** A run that meets a fault in postmaster itself records it as it happens, stops if the
fault is in a control, works around it otherwise, and never fixes postmaster. When the run
closes, each fault becomes a ticket on postmaster's own tracker, and its fix goes through the
flow like any other change. That costs less than fixing faults during runs, and loses nothing
a run needs.

**Standing: claimed.** This is a decision taken on reasoning in
[issue #44](https://github.com/brindlewick/postmaster/issues/44), before any run bears on it.

## The reasoning

- **Postmaster is shared by every live run.** A leg reads its runbook when it starts, and
  several runs may be in flight at once. A fix made during one run changes the contract under
  the others part-way through, which is the case `AGENTS.md` warns about when a run rewrites a
  file that a live run is executing.
- **A fix made during a run has no review.** Every other change goes through the workhorses,
  the review turnpikes and the gate. A fix made in passing skips all three, and lands in the
  tool that every later run depends on.
- **A model that can edit its runbook can edit away a check.** The runs are driven by models.
  One that meets a check it cannot pass has two ways past it: work around it, or change it.
  Either makes the check pass without checking. So a control, a part that decides whether
  something was checked, is never worked around: a fault in one stops the leg and goes to the
  user.
- **Anything else may be worked around.** A tracker adapter that fails, or a harness form that
  changed, is not worth stopping a run for when the run can do the same thing another way. The
  workaround is recorded with the fault, so the ticket is still written.
- **The model that met the fault knows most about it.** It records what ran, what failed, the
  error, and its own diagnosis and proposed fix when the fault happens. That is the best
  evidence the ticket will have, and nothing a leg knew outlives the leg unless it is written.

## What a fault ticket may carry

The tickets go to postmaster's own tracker, which is public, while a run's target may be a
private project. So a fault ticket carries the postmaster file, the failure and the proposed
fix, and nothing of the target: not its name, paths, code or ticket text. The full evidence
stays in the run's own records.

That is enforced by a script, not left to the model's care. The role writes the failure and
the fix in postmaster's terms, and puts anything of the target in the fields that stay in the
run's records. Before anything is published, the script keeps only postmaster's own paths and
links, and withholds the target's names, any word of the waybill that postmaster's own text
never uses, any run of four words the waybill shares, and any code that is not postmaster's
own. It checks the text again before it files. The run is named by a random id kept in its
records rather than by its directory, whose name is the target's ticket id and can carry the
key of the target's tracker.

A ticket's direction is normally the user's alone ([the ticket's shape](ticket-shape.md)). A
fault ticket's direction is the fix the role proposed. It becomes the user's when they approve
the draft, or when `postmaster_may_create` lets the postmaster file without asking.

## What would change it

Runs that recorded their faults: how often a fault recurred before its ticket was fixed;
whether a workaround ever let through something the gate should have caught; and whether
stopping on a control cost runs that a workaround would have finished safely. The `tool-fault`
lines in the ledgers count the first, and the comments on each fault ticket count how often it
was seen again.

A published ticket that turns out to carry something of a target would show that the script is
not enough, and that every draft needs the user's eye before it is filed.

## What changed because of it

`scripts/log-action.sh` gains the `tool-fault` action, with the role's diagnosis and proposed
fix as fields. `skills/postmaster/controls.md` lists the controls, and both runbooks forbid
working around one, or modifying postmaster during a run, whatever the target. Stage H of
`skills/postmaster/postmaster.md` runs `scripts/tool-faults.sh` when a run closes: it groups the
run's faults, comments on the ones postmaster's tracker already has, and drafts the new ones for
the user. The poll, `scripts/runs-status.sh`, says `FAULTS` until they are dealt with.
