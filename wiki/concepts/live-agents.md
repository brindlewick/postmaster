---
title: Live agents against markers and resumes
type: concept
standing: claimed
sources: [trials/herdr-agent-lifecycle, trials/live-option]
updated: 2026-09-27
---

# Live agents against markers and resumes

**Claim.** Lanes and coachman legs that run as live interactive agents in Herdr panes give
earlier and more reliable completion detection than markers, and a lower-latency ruling channel
than a resume. The price is a process held by every idle agent, where an idle native session is
a file. It is the claim [issue #16](https://github.com/brindlewick/postmaster/issues/16) was
opened with.

**Standing: claimed.** No run has been recorded at either level. A trial of the mechanisms
bears on it and is summarised below. It cannot settle the claim: it used a stand-in model,
single turns and agents started by hand, and reliability only shows across runs.

## The decision

Decided on 2026-09-26, on the trial below and before any run: the default stays headless.
Lanes and coachman legs run as headless native sessions, the postmaster is the one interactive
agent, and Herdr hosts every run for observability, as issue #10 builds. Live agents become a
config option, off by default. The measurement below is what it would take to change the
default. Building the option did not wait for it: issue #67 built it, below.

## The two levels

**Control: the current arrangement.** A lane or a leg is launched headless, writes its event
stream and exits, and its wrapper touches a marker. The coachman waits for lanes with
`scripts/wait-for-markers.sh`, which looks every 20 s. The postmaster sees a leg's markers when
it next polls, every `postmaster.poll_seconds` (120 by default). A ruling resumes the thread.
Since issue #10 merged, these launches run in Herdr panes through `scripts/host.sh`, so both
levels are watched the same way and differ only in the contract.

**Live.** A lane or a leg is an interactive agent in its pane. The coachman gives a lane work
with `herdr agent prompt --wait`, which returns when Herdr sees the agent settle, and a ruling
is an `agent prompt` to the live coachman.

Everything else is held the same at both levels: the ticket and its base, the lanes and their
models, the coachman, the config.

## The four measures

Each is read from the same records at both levels.

1. **Detection delay**: from a lane's final message to the coachman knowing. The final
   message's time comes from the harness's own session record. Knowing is the moment the wait
   returned, logged as it happens. At the control the delay splits in two, and both parts are
   kept: final message to marker, which is the process exiting, and marker to wait returning,
   which is the poll.
2. **Ruling delay**: from a ruling being issued to the coachman acting on it. Issued is the
   postmaster's `resume` line, or its live equivalent. Acting is the first assistant message
   after the ruling in the leg's session record.
3. **Spent and remounts**: lost launches per launch. A launch is lost when it ended spent,
   or its lane or leg had to be remounted or dispatched again. At the live level that includes
   an agent prompted again because it settled without its final act, which the control would
   have remounted. The live level also counts every false completion, meaning a settled state
   reported for an agent that had died, and whether anything acted on it. The ledger logs a
   remount and a ruling with the same `resume` verb, so the count needs them logged apart.
4. **Idle cost**: the processes and proportional memory held by agents that have finished a
   turn and are waiting, sampled through each run, as a peak and as process-minutes.

## What a trial already shows

The mechanisms only, on one machine, against a stand-in model
[@trials/herdr-agent-lifecycle]. What Herdr documents against what it does has its own page:
[Herdr reads most agents' state from the screen](herdr-agent-states.md).

| | live | control |
|---|---|---|
| model's final reply to the wait returning | 86 to 771 ms, 18 turns | 2.3 to 17.6 s, 16 turns |
| of which the process exiting | | 37 to 352 ms for pi, 471 to 1,034 ms for claude |
| instruction issued to its request reaching the model | 325 to 674 ms | 1.06 to 3.63 s |
| an idle lane | one process, 98 to 155 MiB | a file, 7 KB to 4.5 MB |

The timings are in [@trials/herdr-agent-lifecycle/timings] and the idle figures in
[@trials/herdr-agent-lifecycle/idle-cost.txt]. Three things follow from them.

**A marker is not slow; its poll is.** From the model's final reply to the headless process
exiting took about as long as Herdr took to notice a finished live turn. Nearly all of the
control's delay was the 20 s poll, a constant in a script, which can be shortened, or replaced
by waiting on a file-system event, without touching the contract.

**The live signal can mislead.** A lane killed mid-turn, pi or claude, was reported `done` to
its waiter, a wait issued after a prompt returned the previous turn's state, and two turns that
had finished were reported stalled [@trials/herdr-agent-lifecycle/kill-mid-turn.txt]
[@trials/herdr-agent-lifecycle/stale-wait.txt] [@trials/herdr-agent-lifecycle/false-stall.txt].
Each has a remedy, and the remedies are the same kind of check markers already need: whether
the lane is still there, and what it left on disk. Whether the live level loses fewer lanes is
open. It shows only in how often each level loses one over real runs, which is the third
measure.

**Delivery was faster by 0.6 to 2.8 s per instruction** between matching variants, and by 0.8
to 1.6 s at their medians [@trials/herdr-agent-lifecycle/timings]. A ruling already waits for
the postmaster's next poll before anyone reads the escalation, 120 s by default.

At the trial's figures, the six idle agents of the README's example of native sessions, two
concurrent runs of a coachman and two lanes each, would hold about 0.6 to 0.9 GiB with small
sessions, and more with the sessions of real lanes, since an agent's memory grew with its
session [@trials/herdr-agent-lifecycle/idle-cost.txt].

## The measurement

Needed only to change the default. Whether it is worth running shows in #10's first runs. If
those almost never lose a launch, the live level cannot be more reliable than the control, and
the trial found the intrinsic delays alike, so the measurement has little left to find.

**Ticket**: the tightly constrained ticket of the fixture app in issue #37. The fixture is
built to be dispatched again and again: each run gets a fresh repository from the same commit,
its merge lands in that throwaway copy, and `fixture.sh score` checks every stage, marker and
hand-off from the run's own records, at either level. The constrained ticket is the choice so
that runs are alike in length and counts per launch compare.

**Runs**: three at each level, as three pairs of one control run and one live run, back to
back, alternating which goes first. The schema needs at least three run records before a
standing can be `supported`, and three pairs give three at each level. One pair can already
refute the claim, so the first pair is read before the other two are dispatched.

**Held the same**: the lanes and coachman the machine's config names. Consult mode, with the
postmaster as merge authority, so every checkpoint card and the ship card are rulings the
postmaster gives: three a run, at checkpoint 1, the review checkpoint and the ship card, and no
run waits on a person. At the live level the pi lane runs with Herdr's pi integration loaded.
With it, Herdr noticed a finished turn in 86 to 431 ms against 454 to 771 ms on screen rules,
and did not report a false stall on the one instant turn tried both ways; it also reports the
session the thread id comes from [@trials/herdr-agent-lifecycle/timings]
[@trials/herdr-agent-lifecycle/false-stall.txt]. Neither way reports pi `blocked`
[@trials/herdr-agent-lifecycle/integrations.txt].

**Before the first run**: issue #10, merged on 2026-09-26, used for a few runs; the machine set
up; #37's fixture built. The live option is built (below). Then the instrumentation, each piece
a script with its controls: the wait's return logged as it happens at both levels; remounts and
re-prompts logged apart from rulings; each lane's final-message time, and each leg's first
action after a ruling, read from the harness session records at teardown; an idle sampler
recording every agent's state, process count and memory where the idle clock of
`runs-status.sh` does not read, such as a dot-named file, so sampling cannot hide a stall; and
`run.json` recording the Herdr version, the detection manifest versions and which integrations
are installed. Runs from before issue #10 merged are no control: until then a ruling's resume
left the leg's `.leg-<n>-exited` in place, so the next poll of `runs-status.sh` read REMOUNT
for a leg that was working. `scripts/host.sh` now clears it on every resume.

**Cost**: six fixture runs, each costing what #37's first scored run records, which is not
known yet. The live level holds a process per idle agent, about 100 to 160 MiB each on the
trial's figures [@trials/herdr-agent-lifecycle/idle-cost.txt].

## What would change the default

Fixed before the first run. The thresholds are the user's to set, and they change only before
the first run.

1. **Reliability first.** If the live level loses more launches per launch than the control,
   or anything in a live run acts on a false completion, the default stays headless,
   whatever the other measures show.
2. **Completion detection** defaults to live agents only if rule 1 holds and the live level is
   also better in a way a poll change could not give: fewer lost launches per launch, or a
   median intrinsic delay at least 10 s shorter. The intrinsic delay runs from a lane's final
   message to its settled state at the live level, and to its marker at the control. The
   control's poll is reported beside it and does not count.
3. **Rulings** default to `agent prompt` only if rule 1 holds, fewer rulings failed at the
   live level than at the control (a ruling fails when it never reaches the coachman or has to
   be sent again), and a prompt from any pane but the postmaster's can no longer pass as a
   ruling. Seconds saved in delivery do not count on their own.
4. **Idle cost**: whatever moves keeps the idle agents of one run under 1 GiB of proportional
   memory at its peak.

## The option, as built

Issue #67 built it, behind one config key, `host.live_agents`, off by default. With it off nothing
in the flow changes: every form, launch and resume is byte for byte what it is with no key, a
control `scripts/launch.sh --self-test` runs. The poll finding stands on its own and needs no
contract change: `wait-for-markers.sh` can look more often or wait on a file-system event, and the
postmaster's poll stays the trade between tokens and delay that `postmaster.poll_seconds` already
exposes.

A run keeps the setting it was dispatched with, read from its `run.json`, so a lane started live
is never resumed headless. With it on, each lane and leg runs in its harness's interactive form
in a Herdr pane, and the option meets each need the trial named this way.

- **Completion.** One `agent prompt --wait` per turn, sent only to an agent that has settled, in
  a waiter that outlives its caller. A turn counts as finished only when one of its final-act
  files was written after the prompt went, whatever Herdr reports; the waiter also looks whether
  the agent is still there, after the release a kill brings. A reviewer's final act is its report
  file, or its final message read from the harness's own session record, for claude and pi. When
  Herdr sees no turn start, the record says whether the turn ran. The controls include a lane
  killed mid-turn, which Herdr reported done and the option records lost, for pi and for claude
  [@trials/live-option/live-test.txt].
- **Markers.** Every marker a headless run writes, at the same moments: a lane's when its turn
  ends, whatever its outcome; a leg's `.leg-<n>-exited` when its agent ends, which the waiter does
  when the leg's turn ends with its hand-off or with nothing written, and never while the leg
  waits for a ruling.
- **Liveness.** A live lane's sign of work is its harness session record, which `runs-status.sh`
  reads beside the run's own files. The record's path is refreshed until the harness has started
  it, so a long first turn is covered [@trials/live-option/live-test.txt].
- **Setup.** Refused without Herdr. A lane whose harness lacks Herdr's integration, in the config
  its environment names, is refused with the command that installs it, which is the user's to
  run, since installing one edits that harness's own config. claude's trust question is settled
  before the start by trusting the repository, since in a git worktree a trusted folder above the
  repository does not count [@trials/live-option/probes.txt].
- **Records.** The thread id is the session the integration reports: claude's id, and the id in
  the name of the file pi's names. The durable record is that session file.
- **Rulings.** The guard the trial proposed. A ruling travels as a file in the dispatch directory,
  logged with its sha256, and the prompt names only the file. The leg's check accepts only the
  latest ruling logged for that leg, unchanged since, and only once, so a prompt from any other
  pane, or a ruling's text sent as a prompt, is refused [@trials/live-option/live-test.txt]. It
  stops a prompt passing as a ruling. A process running as the user can still write the run's
  files, as it can resume a headless thread today.
- **Recovery.** A lane or leg that has gone is resumed in a fresh pane, so no screen a dead agent
  left behind is read as the next one's; one that settled without its final act is prompted
  again where it is.

The option changes the coachman contract behind its key, so it lands while the fleet is idle.
Its sixth criterion, a scored run on issue #37's fixture with the key on, waits on that fixture.

## What building it found

Five facts the trial of the same week did not cover [@trials/live-option/probes.txt]:

- **A live agent must not start on its caller's environment.** A claude started with the
  variables a claude session exports to its own tool calls ran its turn and wrote no session
  record at all, so it could not be resumed. A live agent now starts on its pane's own
  environment, with only the flow's settings and its env file added. Headless launches still take
  their caller's whole environment, which carries those variables when the caller is a claude
  session; whether a headless claude loses its record that way is not tested.
- **Herdr starts an agent only in a pane whose shell has nothing else running with it.** A shell
  reached through a process substitution was refused as busy, however long the start was tried.
- **claude's trust in a git worktree** counts the worktree and its repository, never a folder
  above the repository; in a plain folder, any folder above counts.
- **claude cuts a long working directory's record folder** at 200 characters and adds a suffix,
  so past that a record is found by its id.
- **Herdr's integration commands follow a harness's config dir** (`PI_CODING_AGENT_DIR`,
  `CLAUDE_CONFIG_DIR`, `CODEX_HOME`), so an integration can be installed into a scratch config
  and the user's own is left alone.

## What would change this page

The six runs, ingested as the schema describes, set its standing and decide whether the
default moves. A Herdr release that changes the facts on [the Herdr page](herdr-agent-states.md)
changes the summary above, and may change how the option is built.
