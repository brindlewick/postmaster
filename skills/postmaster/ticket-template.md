# The ticket shape: one document that is both the ticket and the spec

A ticket reaches a run in this shape. It is brought to it in a ticket session
([ticket-session.md](ticket-session.md)) with the user, before it is dispatched, and from then on
it is both the ticket and the run's spec: the user reviews it once, the coachman writes no separate
spec, and the workhorses implement from it. The request it replaces may be replaced in full.

Keep the headings and their order. `<tool>/scripts/ticket-check.sh` has always required
`## Problem / feature`, `## Acceptance criteria`, `## Direction` and `## Turnpikes`; a ticket
session also requires the rest, and will not call a ticket ready without them. Aim for 8 KB or
less. A part that needs no decision from the user is a sentence, or left out.

```markdown
## Problem / feature

<What is wrong or missing, for whom, in plain words, and what done looks like. The reader can
judge the ticket from this section alone. No design here.>

## Acceptance criteria

1. <One observable behaviour.> **Check:** <the command and input, or the steps through the user
   surface> → <the expected output and exit status>. **At the base:** <what the check shows today.>

## Decisions

- **D1 (Opus | given by the user | agreed in the ticket session)** <the decision>. Why: <reason>.
  Rejected: <the alternative, and why not>.

## Direction

<The constraints that bind the work, in a few lines: language and runtime, Linux and macOS, whether
a coachman-contract change needs a fixture run, files not to touch. "None: any approach that meets
the criteria" when there are none.>

## Verified at <base sha>

- <A premise the ticket relies on, and how it was checked at the base.>

## Out of scope

- <What this ticket does not do.>

## Turnpikes

default

## Notes

<Optional: evidence and links. Not for design.>
```

## What each part is for

- **Acceptance criteria with their checks** are the contract. The lanes organise their work and
  their evidence around them, and the lane summary check requires one piece of evidence per
  criterion. A check shows the criterion working the way it will really be used. **At the base**
  exposes a check that passes before any work is done, or that would also pass for a workaround.
- **Decisions** are the choices the ticket makes so that the run need not ask. The user reviews
  each one the writer made; a decision they gave themselves is marked as theirs.
- **Verified at** is the base commit the ticket was checked against. Every file, function, flag,
  line range and number the ticket relies on exists there and says what the ticket says, and each
  check was run there and gave its **At the base** result. A ticket that waits is checked again at
  its dispatch commit before it runs.
- **Out of scope** keeps the lanes from drifting.

## What the ticket leaves out

The workhorses decide which files to change and in what order, the task breakdown, the names inside
the files, and how to test beyond the criteria's checks. The ticket lists none of them: a
structure section and a task list were not used by the lanes, and the places where they were wrong
cost more than the places where they helped. A ticket names a file only where the file is part of
the contract, such as a script's public name.
