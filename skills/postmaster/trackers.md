# Tracker adapters

The runbooks make four demands of a tracker and no more: read a ticket, set its state, add a
dated comment, and create a ticket. This file says what each means for each tracker kind the
config allows (`config.example.toml`, `[tracker]`). Every write is also logged through
`scripts/log-action.sh` as `ticket-state` or `ticket-comment`.

The ticket shape is the same everywhere, three headings in this order, so opening one costs no
orientation:

```
## Problem / feature
One or two sentences. What is wrong, or what is wanted, and why it matters.

## Acceptance criteria
Numbered. Each one answerable yes or no. What "done" looks like.

## Notes
Everything else: context, links, decisions already taken, constraints, what is out of scope.
A ticket that changes something a person uses also carries a `## User journey`: where they
begin, what they tap or type, what they expect.
```

## files

Markdown tickets in the target repo, one file per ticket, on a dedicated branch named
`tickets` that is rooted at its own empty commit and checked out at
`<repo>/.worktrees/tickets`. Code branches never carry ticket files, so a ticket has exactly
one copy and one state whatever branch or worktree the reader is in. Ids are `<PREFIX>-<n>`
with the prefix chosen at setup. Nothing to install, no auth, and the tickets travel with the
repo. Every read and write goes through `scripts/ticket.sh`, which reads from the branch
through git rather than from any checkout, and serialises writes with a lock:

```sh
scripts/ticket.sh <repo> init <prefix>                # once per repo; idempotent
scripts/ticket.sh <repo> create "<title>" <body-file> # prints the new id
scripts/ticket.sh <repo> read <id>
scripts/ticket.sh <repo> state <id> in-progress coachman
scripts/ticket.sh <repo> comment <id> coachman "<text>"
scripts/ticket.sh <repo> list [state]
```

```
---
id: PM-12
title: <one line>
state: todo | in-progress | blocked | done | cancelled
created: YYYY-MM-DD
---

## Problem / feature
…

## Acceptance criteria
1. …

## Notes
…

## Log
- YYYY-MM-DD HH:MM <actor>: <comment>
```

- **Read:** `read`, which prints the branch's copy; never open a file in a code worktree
  expecting current state, since none is there.
- **Create:** `create` with a body file carrying the three headings; the script adds the
  front matter, the `## Log`, and the commit `PM-12: <title>`.
- **Set state:** `state`, one commit per change, message `PM-12: <new state>`. A coachman
  sets its own ticket's state directly; the lock makes concurrent runs safe.
- **Comment:** `comment`, one line under `## Log`, dated to the minute, actor first
  (`postmaster`, `coachman`, or the operator's word for themselves). The ready-to-merge
  comment is one such line pointing at `<dispatch>/card.md`.
- **The branch is pushed like any other** where the repo has a remote, or kept local. It
  never merges into a code branch.

## github

GitHub Issues through the `gh` CLI, authenticated (`scripts/probe-trackers.sh` says whether it
is). The ticket id is the issue number; the tracker prefix discovery reads from commit messages
is `#`.

- **Read:** `gh issue view <n> --json title,body,state,labels,comments`.
- **Create:** `gh issue create --title "<title>" --body-file <file>` with the three headings in
  the body.
- **Set state:** issues have open and closed only, so the flow's states are labels:
  `gh issue edit <n> --add-label in-progress --remove-label todo`; `done` is
  `gh issue close <n>`; `cancelled` is `gh issue close <n> --reason "not planned"`;
  `blocked` is a label.
- **Comment:** `gh issue comment <n> --body-file <file>`.

## other

A tracker the agent reaches through its own tooling, an MCP server or a CLI. The config names
it, and the setup session records how each of the four demands is met in
`~/.postmaster/trackers/<name>.md`, outside this repo and in the same shape as the two sections
above, so the operator's instance never enters the flow. Until that file exists the tracker is
not configured, however reachable it is.
