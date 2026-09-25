# Tracker adapters

The runbooks make four demands of a tracker and no more: read a ticket, set its state, add a
dated comment, and create a ticket. This file says what each means for each tracker kind the
config allows (`config.example.toml`, `[tracker]`). Every write is also logged through
`scripts/log-action.sh` as `ticket-state` or `ticket-comment`.

**GitHub Issues is the default**, on a GitHub Projects board so the tickets are a kanban the
user can look at. Plane is the other named kind. Anything else is `other`. Tickets never
live on a branch of the target repo: a ticket is state, and state does not belong in a commit.

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

The flow's states are `todo`, `in-progress`, `blocked`, `done` and `cancelled`, and each
adapter maps them onto what its tracker has. Every adapter script prints a ticket the same
way (`id`, `title`, `state`, `labels`, `created`, the body, then a `## Log` of comments), so
a runbook reads a ticket without knowing which tracker it came from.

## github

GitHub Issues through the `gh` CLI, on a GitHub Projects board linked to the target repo.
The board is the kanban: its Status column, which every new board has as Todo, In Progress
and Done, carries the state, and an issue's card sits in the column its state says. GitHub
has no blocked column by default, so `blocked` is a label on the card, added without moving
it and removed by the next state change. `done` closes the issue; `cancelled` closes it as
not planned. The ticket id is the issue number, and the prefix discovery reads from commit
messages is `#`.

Everything goes through `scripts/github.sh`, which reads the GitHub repository from the
target's origin remote and needs nothing configured. `gh` must be logged in with the
`project` scope (`gh auth login`, then `gh auth refresh -s project`); the user does both,
never an agent, and `scripts/probe-trackers.sh` says whether they have.

```sh
scripts/github.sh <repo> board                        # the linked board and its URL; exit 3 if none
scripts/github.sh <repo> board init                   # create a board named after the repo and link it
scripts/github.sh <repo> create "<title>" <body-file> # prints the new issue number
scripts/github.sh <repo> read <n>
scripts/github.sh <repo> state <n> in-progress
scripts/github.sh <repo> comment <n> coachman "<text>"
scripts/github.sh <repo> list [state]
```

- **Board:** one per target repo, found through the repo's project links. A repo with no
  board is exit 3 from every command; `board init` creates one, named after the repo, and
  links it. Propose that to the user before running it, and give them the URL after: a
  board made from the CLI opens in table layout, and the switch to the board layout is one
  click on the page.
- **Read:** `read`, which prints the issue with its state worked out from the issue and
  the board together.
- **Create:** `create` with a body file carrying the three headings; the issue is added to
  the board in Todo.
- **Set state:** `state`. `todo` and `in-progress` move the card and reopen a closed issue;
  `blocked` adds the label; `done` closes the issue and moves the card to Done; `cancelled`
  closes it as not planned.
- **Comment:** `comment`, dated to the minute, actor first (`postmaster`, `coachman`, or the
  user's word for themselves). The ready-to-merge comment is one such line pointing at
  `<dispatch>/card.md`.

## plane

Plane work items through Plane's REST API, cloud or self-hosted. A Plane project is a kanban
already, so its states are the columns: `todo` is the first state in the unstarted group,
`in-progress` is started, `done` is completed, `cancelled` is cancelled. Plane has no blocked
group either, so `blocked` is a label named `blocked`, as on GitHub. One Plane project per
target repo, matched by the project identifier that prefixes every work item id (`PM-12`),
which is the prefix discovery reads from commit messages; a target that has shipped one
ticket needs nothing configured, and one that has not is a question for the user.

Everything goes through `scripts/plane.sh`. The instance and workspace are in the config:

```toml
[tracker]
kind = "plane"
url = "https://api.plane.so"     # cloud; a self-hosted instance is its own origin
workspace = "<slug>"             # the segment after the host in the workspace's web URL
```

The API key is `PLANE_API_KEY` in `~/.postmaster/plane.env` (or the file `[tracker]
env_file` names), one line, made in Plane under profile settings, API tokens. The user
writes that file; the key never passes through a conversation, the config or this repo.
`scripts/plane.sh projects` proves the three of them agree by listing the workspace's
projects, and `scripts/probe-trackers.sh` runs it.

```sh
scripts/plane.sh projects                             # identifier, id and name of every project
scripts/plane.sh create <IDENT> "<title>" <body-file> # prints the new id, IDENT-n
scripts/plane.sh read PM-12
scripts/plane.sh state PM-12 in-progress
scripts/plane.sh comment PM-12 coachman "<text>"
scripts/plane.sh list PM [state]
```

- **Read:** `read`; the body Plane stores as HTML comes back as the three headings in
  markdown.
- **Create:** `create` with a markdown body file; the script renders it to the HTML Plane
  stores and puts the item in the todo state.
- **Set state:** `state`, one API call per change; `blocked` is the label.
- **Comment:** `comment`, the same dated line as on GitHub.

## other

A tracker the agent reaches through its own tooling, an MCP server or a CLI. The config names
it, and the setup session records how each of the four demands is met in
`~/.postmaster/trackers/<name>.md`, outside this repo and in the same shape as the two sections
above, so the user's instance never enters the flow. Until that file exists the tracker is
not configured, however reachable it is.
