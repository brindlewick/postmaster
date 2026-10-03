# The ticket shape: one document that is both the ticket and the spec

A ticket reaches a run in this shape. It is brought to it in a ticket session
([ticket-session.md](ticket-session.md)) with the user, before it is dispatched. From then on it is
both the ticket and the run's spec: the user reviews it once, the coachman writes no separate spec,
and the workhorses implement from it. The request it replaces may be replaced in full.

It has two parts.

- **The plain part is what the user signs off.** It is everything above `## For the agents`. It is
  written for a person who does not know the code: what is wrong, what will be true when it is
  done, and the choices made on the way. It names no file, function, flag, command, line number or
  data shape, and it links to nothing in the code. It fits on about a page.
- **The agents' part is derived from the plain part.** It is everything under `## For the agents`:
  the checks, the technical notes and the premises verified at the base. It is for the lanes and
  the coachman. The user may read it and need not. It adds no behaviour and no decision that the
  plain part does not state. When the agents' part needs one, the plain part changes first, with
  the user.

The plain part is enough when someone who has only it, and the code, can write the agents' part
without guessing anything a user would notice. The ticket session tests that with a fresh reader
([ticket-session.md](ticket-session.md)).

Keep the headings and their order. `<tool>/scripts/ticket-check.sh` requires `## Problem / feature`,
`## Acceptance criteria`, `## Direction` and `## Turnpikes`. A ticket session requires the rest.

```markdown
## Problem / feature

<What is wrong or missing, for whom, in plain words, and what done looks like. A reader can judge
the ticket from this section alone. No design here.>

## Acceptance criteria

1. <One thing that is true when the work is done, in plain words: what a person or the flow can do
   or see, not how it is built. A sentence or two.>

## Decisions

- **D1 (proposed | given by the user)** <The choice, in plain words.>
  Why: <the reason.> Instead of: <the alternative, and why not.>

## Out of scope

- <What this ticket does not do.>

## Direction

<The few constraints that bind the work, in plain words: the platforms, whether it changes the
coachman's steps and so needs a fixture run, anything that must stay as it is. "None: any approach
that meets the criteria" when there are none.>

## Turnpikes

default

## For the agents

*Everything above is what the user signed off. This part follows from it and adds nothing to it.*

### Checks

1. <Criterion 1's check: the command and input, or the steps through the user surface> →
   <the expected output and exit status>. **At the base:** <what it shows today.>

### Technical notes

- <The files, functions, flags, event shapes and line ranges the lanes need, linked at the base
  commit, and any hint on where to start. Evidence and links the plain part has no room for.>
  (C1, D1)

### Verified at <base sha>

- <A premise the ticket relies on, and how it was checked at the base.>
```

## What each part is for

- **Acceptance criteria** are the contract, in words a person can check the result against. The
  checks under the agents' heading are numbered the same, one for each criterion. The lanes
  organise their work and their evidence around them, and the lane summary check requires one piece
  of evidence per criterion. A check shows the criterion working the way it will really be used.
  **At the base** exposes a check that passes before any work is done, or that would also pass for
  a workaround.
- **Decisions** are the choices the ticket makes so that the run need not ask. The user reviews
  each one marked proposed, which are the writer's choices. A decision they gave themselves is
  marked as theirs. The mark never names a model, because the ticket is public. A decision is
  stated by what it changes for the flow or its user, not by where it is made in the code. A choice
  only the lanes care about, such as a name, a file or an order, is not a decision. Leave it to them.
- **Direction** says only what binds the work. The platforms and the fixture run belong here, in
  plain words. The technical detail behind them goes in the technical notes.
- **Technical notes** each end with the criteria and decisions they follow from, such as (C2, D1),
  where C2 is the second criterion. A note that follows from none is either a detail the lanes
  decide, and does not belong, or a decision the plain part is missing, and goes there first, with
  the user. Every decision is cited by at least one check or note.
- **Out of scope** keeps the lanes from drifting.
- **Verified at** is the base commit the ticket was checked against. Every file, function, flag,
  line range and number the technical notes rely on exists there and says what they say, and each
  check was run there and gave its **At the base** result. A ticket that waits is checked again at
  its dispatch commit before it runs.

## What the ticket leaves out

The workhorses decide which files to change and in what order, the task breakdown, the names inside
the files, and how to test beyond the criteria's checks. The ticket lists none of them. A structure
section and a task list were not used by the lanes, and the places where they were wrong cost more
than the places where they helped. A file is named only in the technical notes, as a pointer for the
lanes.
