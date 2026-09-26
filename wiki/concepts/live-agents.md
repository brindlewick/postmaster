---
title: Live agents against markers and resumes
type: concept
standing: claimed
sources: [trials/herdr-agent-lifecycle]
updated: 2026-09-26
---

# Live agents against markers and resumes

**Claim.** Lanes and coachman legs that run as live interactive agents in Herdr panes give
earlier and more reliable completion detection than markers, and a lower-latency ruling channel
than a resume. The price is a process held by every idle agent, where an idle native session is
a file. The claim is [issue #16](https://github.com/brindlewick/postmaster/issues/16)'s.

**Standing: claimed.** No run has been recorded at either level. A trial of the mechanisms
bears on it and is summarised below. It cannot settle the claim: it used a stand-in model,
single turns and agents started by hand, and reliability only shows across runs.

## The two levels

**Control: the current arrangement.** A lane or a leg is launched headless, writes its event
stream and exits, and its wrapper touches a marker. The coachman waits for lanes with
`scripts/wait-for-markers.sh`, which looks every 20 s. The postmaster sees a leg's markers when
it next polls, every `postmaster.poll_seconds` (120 by default). A ruling resumes the thread.
Once issue #10 lands these launches run in Herdr panes, so both levels are watched the same way
and differ only in the contract.

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
2. **Ruling delay**: from a ruling being issued to the lane acting on it. Issued is the
   postmaster's `resume` line, or its live equivalent. Acting is the first assistant message
   after the ruling in the session record.
3. **Spent and remounts**: lost launches per launch, from the ledger. A launch is lost when
   it ended spent, or its leg or lane had to be remounted or dispatched again. At the live
   level also every false completion, meaning a settled state reported for an agent that had
   died, and whether anything acted on it.
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

**The live signal can mislead.** A lane killed mid-turn was reported `done` to its waiter, a
wait issued after a prompt returned the previous turn's state, and two turns that had finished
were reported stalled [@trials/herdr-agent-lifecycle/kill-mid-turn.txt]
[@trials/herdr-agent-lifecycle/stale-wait.txt]
[@trials/herdr-agent-lifecycle/false-stall.txt]. Each has a remedy, and the remedies are the
same kind of check markers already need: whether the lane is still there, and what it left on
disk. Whether the live level loses fewer lanes is open. It shows only in how often each level
loses one over real runs, which is the third measure.

**Delivery was faster by 0.6 to 2.8 s per instruction** between matching variants, and by 0.8
to 1.6 s at their medians [@trials/herdr-agent-lifecycle/timings]. A ruling already waits for
the postmaster's next poll before anyone reads the escalation, 120 s by default.

At the trial's figures, the six idle agents of the issue's example, two concurrent runs of a
coachman and two lanes, would hold about 0.6 to 0.9 GiB with small sessions, and more with the
sessions of real lanes, since an agent's memory grew with its session
[@trials/herdr-agent-lifecycle/idle-cost.txt].

## The measurement

**Ticket**: the tightly constrained ticket of the fixture app in issue #37. The fixture is
built to be dispatched again and again: each run gets a fresh repository from the same commit,
its merge lands in that throwaway copy, and `fixture.sh score` checks every stage, marker and
hand-off from the run's own records, at either level. The constrained ticket is the choice so
that runs are alike in length and counts per launch compare.

**Runs**: three at each level, as three pairs of one control run and one live run, back to
back, alternating which goes first. Three records at a level are the fewest the schema accepts
for `supported`. One pair can already refute the claim, so the first pair is read before the
other two are dispatched.

**Held the same**: the lanes and coachman the machine's config names. Consult mode, with the
postmaster as merge authority, so every checkpoint card and the ship card are rulings the
postmaster gives: five a run, and no run waits on a person. At the live level the pi lane runs
with Herdr's pi integration loaded, since pi's screen rules never report `blocked`
[@trials/herdr-agent-lifecycle/integrations.txt].

**Before the first run**: issue #10 landed and used for a few runs, as #16 requires; the
machine set up; #37's fixture built; the live level built as an opt-in that leaves the default
contract alone, landed while the fleet is idle. Then four pieces of instrumentation, each a
script with its controls: the wait's return logged as it happens at both levels; each lane's
final-message time read from its harness session record at teardown; an idle sampler writing
every agent's state, process count and memory to the dispatch directory; and `run.json`
recording the Herdr version, the detection manifest versions and which integrations are
installed.

**Cost**: six fixture runs, each costing what #37's first scored run records, which is not
known yet. The live level holds a process per idle agent, about 100 to 160 MiB each on the
trial's figures [@trials/herdr-agent-lifecycle/idle-cost.txt]. The largest cost is building the
opt-in live level before any of it can run.

## Decision rule

Fixed before the first run. The thresholds are the user's to set, and they change only before
the first run.

1. **Reliability first.** If the live level loses more launches per launch than the control,
   or anything in a live run acts on a false completion, the contract does not change,
   whatever the other measures show.
2. **Completion detection** moves to live agents only if rule 1 holds and the live level is
   also better in a way a poll change could not give: fewer lost launches per launch, or a
   median intrinsic delay at least 10 s shorter. The intrinsic delay runs from a lane's final
   message to its settled state at the live level, and to its marker at the control. The
   control's poll is reported beside it and does not count.
3. **The ruling channel** moves only if rule 1 holds, fewer rulings failed at the live level
   than at the control (a ruling fails when it never reaches the coachman or has to be sent
   again), and a prompt from any pane but the postmaster's can no longer pass as a ruling.
   Seconds saved in delivery do not count on their own.
4. **Idle cost**: whatever moves keeps the idle agents of one run under 1 GiB of proportional
   memory at its peak.

## What follows for the coachman contract

**If nothing moves**, the contract stays as it is. The poll finding stands on its own and
needs no contract change: `wait-for-markers.sh` can look more often or wait on a file-system
event, and the postmaster's poll stays the trade between tokens and delay that
`postmaster.poll_seconds` already exposes. The README's case for native sessions then rests on
measured numbers.

**If completion detection moves**, the coachman's wait in stage 1 and in every review round
becomes one `agent prompt --wait` per lane. Every settled state is checked for a release and
for the lane's final act on disk before it counts, and the check is logged, so false
completions are counted. Markers stay as the durable record that the postmaster,
`runs-status.sh` and `fixture.sh score` read. Each lane's harness runs with the Herdr
integration that reports its state, where there is one, and its worktree is trusted before the
agent starts. The thread id comes from Herdr's session report instead of an event stream, and a
lane's record becomes its exported harness session, as issue #20 proposes. A resume remains the
way to remount a lane that died.

**If the ruling channel moves**, the postmaster delivers rulings and the merge word with
`agent prompt` to the live coachman. The runbook's rule that a ruling never passes through a
composer gives way to whatever makes a forged prompt fail as a ruling. Herdr accepts a prompt
from any pane of its session [@trials/herdr-agent-lifecycle/method.md].

Any of these changes the coachman contract, so it lands only while the fleet is idle.

## What would change this page

The six runs, ingested as the schema describes, set its standing. A Herdr release that changes
the facts on [the Herdr page](herdr-agent-states.md) changes the summary above, and may change
how the live level is built.
