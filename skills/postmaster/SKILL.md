---
name: postmaster
description: 'Start work with postmaster on this machine, from the postmaster tool repo. It is the front door and establishes its own preconditions: if the machine has no ~/.postmaster/config.toml it conducts setup first rather than failing later, and if a session already chose a target it picks up from there instead of asking again. Then it lists the git projects by recency, asks which to dispatch against, verifies that target is a git repository and refuses if it is not, handles an uncommitted tree by offering to commit or stash rather than stopping, discovers the gate command, docs and tracker instead of demanding config, confirms a launch card, and spawns a POSTMASTER session which decomposes a stream into tickets and dispatches one coachman per ticket. A coachman drives one leg of one ticket and its runbook is coachman.md beside this file. The postmaster runs no model lanes and edits no source. Reached by typing /postmaster, or by AGENTS.md sending a session here.'
---

# /postmaster: start work with postmaster

You get the machine ready if it is not, choose a target, confirm a launch card, spawn a
postmaster session, hand over, report where to watch it, and stop. **You do not run the
stream yourself**; the session you spawn does that, from `postmaster.md` beside this file.

That session dispatches one **coachman** per ticket, one leg at a time. A coachman drives
exactly one leg of one load and hands off to the next leg in writing; its runbook is
`coachman.md`. Harness-specific invocations are in `harnesses.md`, tracker mechanics in
`trackers.md`, and the machine's choices — which harnesses, which lanes, which tracker — in
`~/.postmaster/config.toml`, whose shape is `config.example.toml` at the repo root. There is
no separate per-ticket skill: dispatching a coachman is something the postmaster does, not
something a person invokes.

## First: establish the preconditions yourself

You are reached two ways, and they arrive in different states. A session opened in this repo
comes through `AGENTS.md`, which may already have set the machine up and chosen a target.
Someone typing `/postmaster` arrives cold. **Assume neither. Check.**

```sh
cat ~/.postmaster/config.toml 2>/dev/null || echo "NOT SET UP"
```

**No config: stop and set the machine up first**, in conversation, per the setup section of
`AGENTS.md` in this repo. Do not continue to target selection: every later step reads the
config for the team, the tracker and the merge word, and without it the launch card cannot
be filled. Come back here when it is written.

**Config present, and this session has already chosen and verified a target:** skip to
"Work out what the project needs" and do not ask again.

**Config present, no target yet:** carry on below.

Say which of these you found, in one line, before doing anything else. A session that cannot
tell whether it is setting up or dispatching is one nobody can follow.

## Choose the target project

**You are running in the postmaster tool's own repo. The cwd is NOT the target.** Ask the
user which project to dispatch against, and do the finding for them:

```sh
scripts/find-projects.sh [root ...]   # most recently worked first; ~/Code unless roots are given
```

**Sort by last commit and show about twelve.** Recency is the best available proxy for
intent, and it does the filtering that rules cannot: dormant repos and scratch work fall
off the list without needing to be named. Offer the full list on request.

**Exclude third-party clones** (`external/` or wherever they live). Nobody dispatches work
into a vendored copy of someone else's project.

**Do NOT filter to projects with a remote.** Plenty of real work is local-only, and
filtering on a remote silently hides it. Show the remote status as information instead: it
decides whether push and PR steps apply, and a local-only project is normal, not broken.

Adjust the search roots to the machine. `~/Code` is one convention, not a rule.

## Precondition: verify the chosen target, and fail if it does not hold

**The chosen project must be a git repository.**

```sh
scripts/check-target.sh "$TARGET"   # 0 usable · 1 not a repo · 2 dirty, ask first
```

**Read its exit code and stop on 1.** Do not offer to `git init`, do not walk up looking for
a repo, and do not proceed in a directory that merely contains one. A postmaster with no
repository has nothing to dispatch against, and every later stage (worktrees, gates,
merges) fails in a more confusing way further in.

## A dirty tree is a question, not a failure

Exit 2 from the check means uncommitted work. Coachmen branch from committed HEAD, so
uncommitted work is silently excluded from every run and the user does not find out
until something ships without it. Say what is uncommitted and offer, in this order:

1. **Commit it**: finished work that belongs in the base.
2. **Stash it**: unrelated to this stream. The stash is a shared stack, so name what you
   pushed and where it can be found again.
3. **Commit it to a base branch and dispatch from there**: when the uncommitted work IS
   the starting point.
4. **Hand back**: when none of those is obviously right.

Never choose silently, and never `git checkout`, reset or discard anything.

## Work out what the project needs: discover, do not demand

The flow is general and carries no assumptions about build tools, docs layout or trackers.
**Discover them; only ask when discovery genuinely fails.** A general tool that needs a
config file before it runs on a plain git repo is a tool nobody adopts.

```sh
scripts/discover-project.sh "$TARGET"   # gate=… docs=… tracker_prefix=… ambient_context=…
```

A github tracker needs the target's board: `scripts/github.sh "$TARGET" board` names it, and
exit 3 means there is none yet, so propose `board init` to the user and hand them the URL
it prints. A plane tracker needs the target's project identifier: the discovered
`tracker_prefix` when the target has shipped a ticket, otherwise `scripts/plane.sh projects`
lists the candidates and the user picks. Report what you found on the launch card, and
ask only about what you could not determine.
**If the project has no `AGENTS.md` or equivalent, say so.** Lanes that read no ambient
context start blind, and that has silently handicapped a lane before. Ask the user for
the project's risk surfaces (what it binds, allowlists, spawns and serves) where the docs do
not say; the security lens reviews against them.

## Stage 0: scope, confirm, spawn

1. **Scope the stream.** From the user's words plus a read-only pass over the named
   sources, write one paragraph: what the stream is, its likely first few tickets, and
   which parts of the project they touch. Do not deep-dive; the postmaster does that.
2. **Work with no ticket gets one created first**, in the project's own tracker
   (`trackers.md`).
3. **Launch card**: one self-contained confirmation covering the postmaster's harness,
   model and effort (`team.postmaster` in the config), the team the config names, who says
   the merge word (`ship.merge_authority`), and the project facts above. Launch
   nothing before the user picks.
4. **Create the run root** `~/.postmaster/runs/<project>/` (the repo's basename) and log the
   launch there: `scripts/log-action.sh` needs a run directory, so the postmaster's own
   actions go under `~/.postmaster/runs/<project>/postmaster/`.
5. **Spawn.** A new session of the postmaster's harness (`team.postmaster` in the config),
   rooted in the target repo, in its own tmux session named `postmaster-<project>`, briefed
   with: "You are the postmaster for <project>. Read `<tool>/skills/postmaster/postmaster.md`
   first", then the stream paragraph, the project profile, `<tool>` and the config path. An
   interactive harness gets the brief as its first prompt; a headless one gets it through
   `scripts/launch.sh launch postmaster <repo> <brief-file>`, run inside the tmux session so
   the user can attach.
6. **Report** the session name, the run root, and the brief. Then stop.

## The waybill

The postmaster writes one per ticket at `~/.postmaster/runs/<project>/<TICKET>/brief.md`.
It is the only thing that travels between the postmaster and a coachman, so it carries
everything the coachman needs and nothing it must go and find:

```
# Waybill: <TICKET>

## Ticket
<the ticket verbatim: problem, acceptance criteria, notes, User journey if it has one>

## Project profile
repo: <abs path>          default branch: <name>       BASE: <sha>
gate: <the real command>  build: <the real command>    browser suite: <command or none>
docs to read first: <files, in order>
tracker: <kind, and how a ticket is read and written>
risk surfaces: <what the project binds, allowlists, spawns, serves; from its docs or the user>

## Team
workhorses: <lane>=<harness>/<model>/<effort>, <lane>=…
reviewers: <lane>, <lane>
coachman: <harness>/<model>/<effort>      (never a lane's model)
CHECKPOINT_MODE and MERGE_AUTHORITY come from ship.checkpoint_mode and ship.merge_authority, overridden only where the user says so for this run

## Dispatch
dispatch: <abs path of this directory>
synthesis worktree: <abs path; cut by the postmaster at BASE, the coachman's cwd for every leg>
tool: <abs path of the postmaster repo; every scripts/ path in the runbooks is relative to it>
postmaster ruling channel: resume the coachman's thread (harnesses.md) with the ruling as the prompt
```

## Hard rules

- Bootstrap never runs the stream. Spawn and stop. The postmaster's job is `postmaster.md`.
- The postmaster runs no model lanes and edits no source. Its tokens buy judgment:
  decomposition, dispatch, supervision, escalation, merge grants, and talking to the
  user.
- All work in worktrees; the project's default branch stays clean.
- Verify claims against code before trusting them, above all before granting a merge.
- Every action on a project is logged as it happens, through `scripts/log-action.sh`, by
  the postmaster and by every coachman. The narrative is for reading; the log is for
  learning.
- Prefer a script to a hand-rolled step. Anything deterministic (drift checks, collision
  surfaces, gate runs, completion detection) belongs in a script, not in prose that a
  model re-derives every run.
