# postmaster

**This file is the canonical context for every agent working in this repo, whatever harness
it runs under.** `CLAUDE.md` imports it; codex, grok and pi read it natively; agy and muse
read no ambient file at all and must be pointed at it explicitly by whatever brief launches
them.

## Read this first: this repo is the tool, and it can be its own target

postmaster dispatches agents at git repositories. **One of those repositories may be this
one.** Using postmaster to develop postmaster is supported, and it is the most honest test
the tool has: a flow that cannot improve itself is a flow nobody should trust with a real
project.

A session opening here is usually here to **run** the tool against something else. Ask which
target the operator wants before assuming either way.

### What is different when the target IS this repo

**A run in flight does not see your edits.** A coachman loaded its runbook when it started;
changing `coachman.md` mid-run changes nothing for it. That is a safety property, not a
limitation: a broken edit cannot break a fleet that is already moving. It also means a fix
you just merged is not in effect until the next dispatch.

**The supervising session is in the same position.** Whatever is supervising loaded its
context at startup. After merging a change to the flow, restart it or accept that it is
running the previous version.

**Everything else is ordinary.** Worktrees under `.worktrees/` are gitignored, the gate runs
the same way, and merges are merges. There is no special mode.

### The one thing that genuinely bites

**Do not let a run rewrite the file that a live run is mid-way through executing and then
expect either to be coherent.** If a ticket changes the coachman contract (markers, the
waybill shape, completion detection), land it while the fleet is idle, or the next dispatch
will read a new contract while an older run is still writing to the old one.

Contract changes are the only category that needs the fleet quiet. Ordinary changes to
scripts, docs and prose do not.

## When a session opens in this repo, do this

No slash command is needed. A session starting here is almost always here to **run** the
tool. Work out where the operator is and pick up from there.

**1. Is this machine set up?**

```sh
cat ~/.postmaster/config.toml 2>/dev/null || echo "NOT SET UP"
```

If it is missing, run setup before anything else, and do not guess the answers:

```sh
scripts/probe-harnesses.sh     # which agent CLIs exist, and which read no ambient context
scripts/probe-trackers.sh      # which ticket sources are reachable
```

Then run the wizard, which asks one thing at a time and writes `~/.postmaster/config.toml`
in the shape of `config.example.toml`:

```sh
scripts/setup.sh               # add --dry-run to see the config without writing it
```

What it asks, and why none of it is guessed:

- **Which harness and model fills each role:** the horses, the reviewers, the coachman and
  its fallback, the postmaster. Do not assume: a harness on PATH can still be walled, out of
  credit, or reading no ambient context. The shape of the answer is `config.example.toml` at
  the repo root.
- **How tickets are created.** GitHub Issues on a GitHub Projects board is the default: a
  kanban the operator can open, needing only `gh` logged in with the `project` scope. Plane
  is the other named kind, needing its API origin, a workspace slug and a key the operator
  writes to `~/.postmaster/plane.env` themselves. Anything else is `other`, described once
  outside this repo (`skills/postmaster/trackers.md`).
- **Where projects live.** `~/Code` is one convention, not a rule.
- **Who says the merge word.** A person, or the postmaster itself (`ship.merge_authority`).
  A run never merges on its own authority; the config says whose authority that is.

**2. Which project are we dispatching against?**

```sh
scripts/find-projects.sh                 # most recently worked first
scripts/check-target.sh <chosen>         # 0 usable · 1 not a repo · 2 dirty, ask first
scripts/discover-project.sh <chosen>     # gate command, docs, tracker prefix
```

**The target may be this repo.** Developing postmaster with postmaster is supported; see
the section above for the two things that differ.

**3. Launch the postmaster** per `skills/postmaster/SKILL.md`, and hand over.

**Prefer the scripts to doing it by hand.** They are the deterministic half of this flow and
they carry their own controls. Reasoning your way to a project list or a git check is slower,
costs tokens, and is how the wrong answer gets produced confidently.

## What it is

A three-role flow for getting one ticket implemented well by several models at once.

| role | what it does | where it is defined |
|---|---|---|
| **postmaster** | decomposes a stream into tickets, dispatches one coachman per ticket leg by leg, supervises, answers escalations, grants merges | `skills/postmaster/postmaster.md` (spawned by `SKILL.md`) |
| **coachman** | drives one leg of one ticket; five legs, each a fresh coachman with a written hand-off between them, carry a ticket from waybill to ship card: harnessing the team, judging their work, running review rounds, clearing the gate | `skills/postmaster/coachman.md` |
| **the team** | several model lanes implementing the same ticket independently, in **blinkers**: separate worktrees, unable to see each other's work | `coachman.md`, lane table |

The postmaster runs no model lanes and edits no source. A coachman never takes a second
load. The **waybill** (`<dispatch>/brief.md`) is the only thing that travels between them.
Harness-specific invocations live in `skills/postmaster/harnesses.md`, and
`scripts/launch.sh` is their executable form: the runbooks name a form (launch, resume,
thread id), that file gives the command, the script runs it. `SKILL.md` is the bootstrap that
spawns a postmaster; `postmaster.md` is what the postmaster then does. A run is five coachman
legs, each a fresh thread, so no context outlives a leg and a leg's hand-off document is the
whole of what the next leg knows.

## Vocabulary

Coaching-era, because the shape fits: several horses pull one load, and blinkers stop each
seeing the others. Both are load-bearing properties of the architecture, and no other
metaphor expresses them.

**waybill** the brief that travels with a load · **harness** the CLI wrapping a model ·
**blinkers** worktree isolation between lanes · **lead horse / wheeler** the ranked lanes ·
**turnpike** the gate a run must clear · **remount** resuming a stalled run ·
**spent** a run whose process is gone with no marker · **lame** a lane that is present but not pulling · **fleet** the
whole system.

`orchestrator` is deliberately NOT used: this flow has a postmaster.

## Design rules for the tool itself

1. **Nothing repo-specific.** No hardcoded paths, hosts, trackers, build tools or operator
   names. The flow discovers what a project needs; it does not demand configuration.
2. **Nothing harness-specific in the flow.** Every harness has its own flags and its own
   event format. That belongs behind an adapter (`skills/postmaster/harnesses.md`), not in
   prose telling a reader not to confuse them. Trackers likewise (`skills/postmaster/trackers.md`).
3. **Deterministic work goes in `scripts/`, not in prose.** A check written as prose is
   re-derived, and mis-derived, on every run. A script gets it wrong once and is fixed.
4. **A prompt lives in argv.** Never select a process by matching text that could appear in
   a prompt; match on pid or working directory. Prefer `--prompt-file` where a harness
   offers it.
5. **Every count needs a control.** A positive control reading non-zero and a negative
   control reading zero, through the identical command.
6. **Every action on a project is logged as it happens**, one JSON line per action through
   `scripts/log-action.sh`, per run and per project. The narrative is for reading; the log
   is what a run is audited from and what the flow is improved from.
