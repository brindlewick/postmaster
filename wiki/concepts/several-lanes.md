---
title: A second reviewer earns its keep, and a second workhorse has not been shown to
type: concept
standing: claimed
sources: [trials/2026-10-03-lane-audit, trials/2026-09-29-synthesis-audit]
updated: 2026-10-03
---

# A second reviewer earns its keep, and a second workhorse has not been shown to

**Claim.** Several lanes cost tokens, time and incidents. Over three days of runs, one reviewer lane
alone found about half of the severe defects the coachman verified, and two found over nine tenths.
So a second reviewer earns its keep. A second workhorse supplied a fix or a missing part in most of
this repository's runs, by the coachman's own cards. Where a test measured the difference, one lane
alone passed in five of the six runs that had blind tests and in all 22 fixture runs that could be
scored. The largest costs are elsewhere: the coachman's tokens, the review stage's hours, and one
security review's money.

**Standing: claimed.** Like [the earlier audit](combining-models.md), this reads the runs' own
records and promotes no run, so by [the schema](../schema.md) it moves no standing. A reader who
took the records as runs would call the reviewers' case the better supported. It rests on the
coachman's record of who named each verified finding, and the workhorses' case rests on a reading
of the coachman's cards. [@trials/2026-10-03-lane-audit/method.md]

The audit is [#257, Research: audit the last three days of runs, to see whether several lanes still
earn their keep](https://github.com/brindlewick/postmaster/issues/257). Its definitions, its limits
and the controls for each count are in the trial's method and controls
[@trials/2026-10-03-lane-audit/method.md] [@trials/2026-10-03-lane-audit/results/controls.md].
Every figure quoted below is in one list [@trials/2026-10-03-lane-audit/results/numbers.md].

## The answer

**Reviewers: yes.** The coachman verified 264 severe findings, P1 or P2, in this repository's 18
runs that reached synthesis. A codex lane named 138 of them and mimo 154, and the two named the same
finding only 51 times. Between them they found 241, and with opus's security review 259. A review
by one lane alone would have missed 42% to 48% of what the coachman verified. A round lasts a median
25 minutes, and its last reviewer finishes a median 11 minutes after its first. All reviewers
together wrote a median quarter of a run's output tokens.

**Second workhorse: not shown, and cheap.** In 12 of the 18 real runs the second-ranked lane's part
was a defect fix or a part the first lane lacked, by the coachman's cards. In 4 it was small items
and in 2 nothing. Of the 6 runs with blind tests, one lane alone passed in 5, counting [#201](https://github.com/brindlewick/postmaster/issues/201) against
the oracle as the coachman corrected it. In [#57](https://github.com/brindlewick/postmaster/issues/57) neither lane passed, and the coachman adjudicated
the synthesis at 20 of 20 after a raw 13. On the fixture ticket every lane branch that could be
scored passed every hidden test alone, 44 of 44. No run was made with one workhorse, so the records
cannot say whether the fixes would have shipped anyway. The second workhorse costs a median 18
minutes of waiting and a gate run on its branch. It hedged one wall: when astra hit a usage limit
in [#200, Run every lane in its own process space, so it cannot kill processes it did not start](https://github.com/brindlewick/postmaster/issues/200), the run went on with mimo's work.

**What costs most is neither.** The coachman writes a median 58% of a run's output tokens and reads
far more. The review stage takes a median 8 hours 47 minutes, against 1 hour 35 minutes for the
workhorses and 31 minutes for the synthesis. The reviewers themselves run 1 hour 30 minutes of that
review stage. The one money figure the records hold is opus's: $644.17 over 71 security launches in
this repository's runs, for 29 of the 264 severe findings, 18 of them named by opus alone. On the
fixture ticket opus named none.

## What was covered

Every run with an action from 2026-09-30 15:40 to 2026-10-03 15:40 UTC, 72 hours, real and fixture
runs apart. A run is read whole if one action falls in the window.

| Runs | With activity in the window | Set aside | Reached synthesis | of them, synthesis in the window | Finished | Not finished |
| --- | --- | --- | --- | --- | --- | --- |
| this repository's tickets | 31 | 6 | 18 | 8 | 23 | 8 |
| fixture runs | 25 | 0 | 24 | 21 | 25 | 0 |

Real runs had luna on codex in 24 runs, sol in 6 and astra in 1, always with mimo. opus reviewed
security. Fixture runs ran at the lowest effort of each harness.
[@trials/2026-10-03-lane-audit/results/inventory.md]

**Changes from the earlier audit's definitions.** The earlier audit counted six-word runs in git
with its own script. The run's own SHARES line now does it, by the same method, and only for runs
after [#158, Measure each lane's share of the shipped synthesis from git, beside the coachman's own
account](https://github.com/brindlewick/postmaster/issues/158). The second lane's part is now A, B
or C, which replaces core, small and trivial. A lane's time is its process's exit, not the
coachman's harvest line. Hidden tests per lane, review findings, tokens and incidents are new.
[@trials/2026-10-03-lane-audit/method.md]

## The second workhorse

### In this repository's runs

**How to read "ranked".** The base is the code as it stood when the run began. Each workhorse
changes its own copy of it, and neither sees the other's. The coachman does not take one lane's
finished copy and top it up from the other. It starts a fresh copy of the base and adds the answer
one part at a time, each part from whichever lane did it better or written by the coachman itself,
with a reason recorded for each. It writes the ranking last, on the SYNTHESIS line, lead lane first
([the runbook](https://github.com/brindlewick/postmaster/blob/40d50ce/skills/postmaster/coachman.md)).
Nothing in the config picks a lead lane. The runbook says "primary" only orders the launches. So
the lead lane is on record for every run, but it is the coachman's own label, given after the fact,
and it is not blind: the coachman knows which lane is which. Three things follow.

- The label does not say whose code ships. In the five real runs with code shares, the lane ranked
  first wrote 13% to 91% of the code and the second 0% to 25%. In the earlier audit's runs the
  second-ranked lane wrote most of the synthesis in [#109, Rewrite the scripts in TypeScript, run by Bun](https://github.com/brindlewick/postmaster/issues/109) (73%) and [#114, A run uses the postmaster version it was dispatched from, so changes can merge with runs in flight](https://github.com/brindlewick/postmaster/issues/114) (65%), and most of the code
  in [#38, Run the bug review through each harness's own code-review skill](https://github.com/brindlewick/postmaster/issues/38) (77%) [@trials/2026-09-29-synthesis-audit/share.md].
- It varies by ticket and is not tied to test results. A codex lane was ranked first in 13 of the
  18 real runs and mimo in 5. On the fixture ticket mimo was first in 19 of 24 runs, where every
  lane passed every hidden test, so there the ranking cannot follow what the tests measure
  [@trials/2026-10-03-lane-audit/results/numbers.md].
- The line has to name something taken from each lane, so it always reads as if both helped. This
  page does not use it to judge the second lane. It uses the defects the cards name, the code
  shares and the tests.

The second lane's part, read from each synthesis card against a rubric fixed first. **A**: a defect
fix or a part the first lane lacked, shown by a probe or a failing criterion. **B**: real but
optional items. **C**: nothing, the same items, or no code. A second reader, blind to the first,
read the cards against the same rubric. The two readers gave the same class on 12 of the 14 runs and the same view of the first lane's
defect on all 14. They differ on [#98](https://github.com/brindlewick/postmaster/issues/98) (B against A) and [#160](https://github.com/brindlewick/postmaster/issues/160) (A against B), and each class has the
same total on both readers' counts, A 9, B 3 and C 2.
[@trials/2026-10-03-lane-audit/results/judgements.json]

| Run | Ticket | Ranked | Blind tests | Second lane's part | Its own share of the code | Slower lane's extra wait, min |
| --- | --- | --- | --- | --- | --- | --- |
| [#57](https://github.com/brindlewick/postmaster/issues/57) | A leg's launch, resume and takeover are run by a script that records how each ended | luna, mimo | mimo:17/20,luna:12/20 | A | – | 5 (luna) |
| [#75](https://github.com/brindlewick/postmaster/issues/75) | Dispatch refuses a run directory or branch that already exists | mimo, luna | none | A | – | 3 (luna) |
| [#98](https://github.com/brindlewick/postmaster/issues/98) | A fixture run's postmaster runs headless, so it never stops at a trust prompt | luna, mimo | luna:12/12,mimo:12/12 | B | – | 22 (luna) |
| [#109](https://github.com/brindlewick/postmaster/issues/109) | Rewrite the scripts in TypeScript, run by Bun | luna, mimo | luna:fail,mimo:fail | A, earlier audit | – | 145 (luna) |
| [#110](https://github.com/brindlewick/postmaster/issues/110) | A project's gate never sees the run's own working copies | mimo, luna | none | A | – | 1 (luna) |
| [#122](https://github.com/brindlewick/postmaster/issues/122) | The watcher takes the mechanical steps itself, and wakes the postmaster only for decisions | luna, mimo | luna:pass,mimo:pass | A, earlier audit | – | 48 (mimo) |
| [#124](https://github.com/brindlewick/postmaster/issues/124) | The review leg ends with the run ready for the user's merge, with no separate ship leg | luna, mimo | luna:fail,mimo:fail | A, earlier audit | – | 15 (mimo) |
| [#135](https://github.com/brindlewick/postmaster/issues/135) | A gate check refuses any change that carries personal data or a secret | luna, mimo | luna:fail,mimo:fail | B, earlier audit | – | 34 (luna) |
| [#158](https://github.com/brindlewick/postmaster/issues/158) | Measure each lane's share of the shipped synthesis from git, beside the coachman's own account | luna, mimo | luna:4/4,mimo:4/4 | B | 0.5% | 14 (luna) |
| [#159](https://github.com/brindlewick/postmaster/issues/159) | A fixture run scores each lane's own branch against the hidden tests | mimo, luna | none | A | – | 3 (luna) |
| [#160](https://github.com/brindlewick/postmaster/issues/160) | Record each launch's tokens and cost where its harness reports them | luna, mimo | none | A | – | 27 (luna) |
| [#163](https://github.com/brindlewick/postmaster/issues/163) | The coachman contract is defined in one place, and a script decides whether a change touches it | luna, mimo | none | A | – | 31 (mimo) |
| [#165](https://github.com/brindlewick/postmaster/issues/165) | A finished launch's tab closes, and teardown closes every space a run opened | luna, mimo | none | C | – | – |
| [#170](https://github.com/brindlewick/postmaster/issues/170) | The coachman writes one spec that every workhorse implements, and the user reviews it once | mimo, luna | none | A | – | 26 (luna) |
| [#179](https://github.com/brindlewick/postmaster/issues/179) | A workhorse shows every acceptance criterion working, and keeps at it until it can | luna, mimo | none | A | 25% | 11 (mimo) |
| [#182](https://github.com/brindlewick/postmaster/issues/182) | A fixture run runs every agent at its harness's lowest effort | sol, mimo | sol:pass,mimo:pass | A | 14.6% | 55 (mimo) |
| [#200](https://github.com/brindlewick/postmaster/issues/200) | Run every lane in its own process space, so it cannot kill processes it did not start | mimo, astra | mimo:pass,astra:fail | C | 0% | – |
| [#201](https://github.com/brindlewick/postmaster/issues/201) | Setup and the probe say whether lane confinement can run on this machine, and what finishes it | sol, mimo | sol:fail,mimo:fail | B | 4.8% | 7 (mimo) |

- Across the 14 runs judged here: A in 9, B in 3, C in 2. The card names a defect in the first
  lane's version in 10 of the 14. The four runs also in the earlier audit read A, A, A and B, so 12
  of the 18 are A [@trials/2026-10-03-lane-audit/results/numbers.md].
- A fix is not proof of need. The review rounds that follow also find defects in a synthesis, and
  nothing here says they would have missed what the second lane fixed.
- The 8 tickets with no blind tests, because the design question was the interface, are A in 7.
  The 6 with blind tests are A in 2. The records do not explain the difference, and it comes from
  14 runs.
- Six of the 14 runs had blind tests. A lane alone passed them in [#98](https://github.com/brindlewick/postmaster/issues/98), [#158](https://github.com/brindlewick/postmaster/issues/158) and [#182](https://github.com/brindlewick/postmaster/issues/182), in [#200](https://github.com/brindlewick/postmaster/issues/200) with
  one wording miss, and in [#201](https://github.com/brindlewick/postmaster/issues/201) after the coachman corrected the oracle's own faults. [#182](https://github.com/brindlewick/postmaster/issues/182) also
  needed two corrections to its oracle before both lanes passed. Neither lane passed in [#57](https://github.com/brindlewick/postmaster/issues/57). The
  card calls the misses on both sides substantive, and the synthesis took parts of both.
- A *fail* in the blind-tests column is the SYNTHESIS line's own word. In [#201](https://github.com/brindlewick/postmaster/issues/201) the card traced
  every failure to the oracle. In [#109](https://github.com/brindlewick/postmaster/issues/109), [#124](https://github.com/brindlewick/postmaster/issues/124) and [#135](https://github.com/brindlewick/postmaster/issues/135) the earlier audit read the misses as the
  oracle's false positives.
- The second lane's own share of the synthesis's code was 0.5%, 25%, 14.6%, 0% and 4.8% in the five
  real runs that have shares. Where a lane wrote nothing, as astra in [#200](https://github.com/brindlewick/postmaster/issues/200), its share reads 0%, the
  negative control.
- Both lanes stalled in [#165](https://github.com/brindlewick/postmaster/issues/165) and the synthesis rests on one lane's uncommitted work. The second
  lane gave a cross-check and no code.

### On the fixture ticket

Fixture runs score each lane's own branch against hidden tests the lanes never saw. This audit ran
that for every run in the window, which the earlier audit could not
[@trials/2026-10-03-lane-audit/results/workhorses-fixture.md].

- Of 22 runs whose lane branches could be scored, both lanes passed every hidden test in all 22:
  44 of 44 lane branches. The merged result passed in 23 of 23 runs that merged. Two runs could not
  be scored, because fixture-29's lane branches point at the base and fixture-37's are gone.
- The suite is not trivially passed. Through the same command it passes the ticket's reference
  patch, 20 of 20, and passes 7 of 20 on the app before the ticket
  [@trials/2026-10-03-lane-audit/results/hidden-controls.txt].
- The second-ranked lane wrote 1.5% of the synthesis's code at the median, 15.9% at the 90th
  percentile. It was 2% or less in 14 of 24 runs and 10% or more in 6.
- mimo ranked first in 19 of 24 runs. Every lane passed every test, so on this ticket the rank
  cannot follow what the hidden tests measure.
- The ticket is one small ticket at the lowest effort. It cannot show what a second workhorse adds
  on a hard one.

### What it cost

|  | this repository's runs (18 runs) | fixture runs (24 runs) |
| --- | --- | --- |
| planning, with the wait for the spec's review | 3h 51m | 29m |
| workhorses running | 1h 35m | 13m |
| synthesis | 31m | 2m |
| review | 8h 47m | 53m |
| of which the reviewers running, each round from launch to last exit | 1h 30m | 38m |
| slower workhorse's extra wait, median (90th percentile) | 18 min (55) | 6 min (11) |
| one review round, launch to last reviewer, median (90th percentile) | 25 min (56) | 15 min (28) |
| gap between the first and last reviewer of a round, median (90th percentile) | 11 min (33) | 16 min (23) |
| review rounds per run, median (most) | 3.5 (20) | 2 (4) |

- The slower workhorse made the run wait a median 18 minutes, 55 at the 90th percentile, over 16
  real runs, and a median 6 minutes over 18 fixture runs. Lanes restarted after a kill lengthen the
  longest waits.
- Of the review stage's median 8 hours 47 minutes, the reviewers themselves run 1 hour 30 minutes,
  25% of the stage at the median. The rest is the coachman's triage, fixes and gate runs, and a wait
  for the user's ruling at each round past the third. 9 of the 18 runs went past three rounds
  [@trials/2026-10-03-lane-audit/results/numbers.md].
- The coachman ran the gate on lane branches 36 times, 6.5 hours, in the real runs, and on the
  synthesis 260 times, 43.5 hours. The lane branches' share is about 22 minutes a run for the two
  lanes, so about 11 for the second.
- Two runs were set aside after each lane had written its own spec: [#182](https://github.com/brindlewick/postmaster/issues/182), which had to wait for the
  TypeScript port, and [#200](https://github.com/brindlewick/postmaster/issues/200), whose scope the user changed. Their spec rounds had used 1.0M and 2.4M
  workhorse input tokens and 11M and 7.7M coachman input tokens by then. The coachman now writes
  one spec for every lane
  ([#170, The coachman writes one spec that every workhorse implements, and the user reviews it
  once](https://github.com/brindlewick/postmaster/issues/170))
  [@trials/2026-10-03-lane-audit/results/numbers.md].
- Workhorse output tokens: the second-ranked lane wrote a median 38k against the first's 111k in
  the real runs, and 7k against 11k on the fixture ticket
  [@trials/2026-10-03-lane-audit/results/numbers.md].

## The reviewers

Each review round runs the style and bug lenses on both workhorse lanes and the security lens on
opus. The coachman verifies each finding and logs it with the lanes it came from. A *severe*
finding is a verified P1 or P2 the coachman did not dismiss. Who named a finding is the coachman's
record, read by a script and checked by hand on 45 lines, all of which match
[@trials/2026-10-03-lane-audit/results/controls.md].

- Of 264 severe findings in the real runs, 59 were named by two or more lanes. One lane alone named
  the rest: a codex lane 83, mimo 99, opus 18 and the coachman 5. The 5 the coachman made itself
  while checking count as lost by every smaller reviewer set.
- What a smaller set would have found, as a share of what the coachman verified:

| Reviewers | this repository's runs | of which, synthesis in the window | fixture runs |
| --- | --- | --- | --- |
| one codex lane | 138 of 264, 52% | 23 of 41, 56% | 27 of 34, 79% |
| mimo only | 154 of 264, 58% | 24 of 41, 59% | 23 of 34, 68% |
| opus only | 29 of 264, 11% | 3 of 41, 7% | 0 of 34, 0% |
| codex lane and mimo | 241 of 264, 91% | 39 of 41, 95% | 34 of 34, 100% |
| codex lane and opus | 160 of 264, 61% | 25 of 41, 61% | 27 of 34, 79% |
| mimo and opus | 176 of 264, 67% | 27 of 41, 66% | 23 of 34, 68% |
| all three, as run | 259 of 264, 98% | 41 of 41, 100% | 34 of 34, 100% |

- The two workhorse lanes' reviews overlap on 51 findings of the 241 they found. By capture-recapture,
  an overlap that small points to many findings still unfound. Chapman's estimate for two such
  reviewers is 413. With two reviewers the method is ambiguous and tends to read low
  ([source](../sources/petersson-2004-capture-recapture.md)), so this is a reason to expect a
  third reviewer to add more, not a count. It fits
  [the review-convergence page](review-convergence.md): model reviewers do not run out of findings.
- Where the coachman listed every finding it judged, 13 of the 78 P1 and P2 entries in the four real
  runs whose cards list them ([#135](https://github.com/brindlewick/postmaster/issues/135), [#182](https://github.com/brindlewick/postmaster/issues/182), [#200](https://github.com/brindlewick/postmaster/issues/200), [#201](https://github.com/brindlewick/postmaster/issues/201)) were dismissed rather than fixed, and 4 of
  37 on the fixture ticket. The same defect can be listed under two lenses. The dismissals carry
  no lane, so false alarms cannot be counted by lane. The reasons are mostly that the report was no
  defect, was out of scope, or was by design
  [@trials/2026-10-03-lane-audit/results/numbers.md].
- opus found 18 of the severe findings alone in the real runs and none on the fixture ticket. Its
  security review is the dearest line in the records: $644.17 over 71 launches, about $9 a launch,
  $22 for each finding it named and $36 for each it alone found.
- mimo alone would have found 58% and a codex lane alone 52%. The recorded tokens put a codex lane's
  reviews at 119 launches, 240M in and 2.9M out, and mimo's at 118 launches, 17M in and 1.0M out.
  mimo's plan reports a zero price.
- A round lasts a median 25 minutes, 56 at the 90th percentile, and the first and last reviewer
  finish a median 11 minutes apart, 33 at the 90th.
- 9 of 298 reviewer launches in these real runs were harvested as degraded: three luna reviews (a
  revoked login, and two findings files that did not parse), four mimo (no verdict after handing the
  work to a helper, a change to the code under review, a memory-cap kill, and a verdict withheld by
  the provider's content filter), one astra (a turn that failed) and one opus (a 529 overload). The
  incidents below say more. In [#200](https://github.com/brindlewick/postmaster/issues/200)'s third round the mimo reviewer committed a change and merged it
  into the synthesis worktree, and the coachman voided its verdict and recovered the branch.

## What the lanes cost in tokens

Read from each launch's own events stream, and each coachman thread's session record, with the
tool's own reader. They agree with the usage files in 312 of 315 launch groups. The coachman's usage
file undercounts a leg resumed after it was written, as in [#200](https://github.com/brindlewick/postmaster/issues/200)'s review leg, 36.2M recorded against
58.3M in its session. Claude Code's input figure leaves out cache reads, so it reads as nearly
nothing. Only Claude Code's price is recorded, so no total in money can be given.
[@trials/2026-10-03-lane-audit/results/tokens.md]

| Role and lane | this repository's runs | fixture runs |
| --- | --- | --- |
| coachman | 39 launches, 1478M in, 5253k out | 47 launches, 356M in, 1431k out |
| reviewer codex | 119 launches, 240M in, 2934k out | 76 launches, 3.0M in, 25k out |
| reviewer mimo | 118 launches, 17M in, 1019k out, $0.00 reported | 75 launches, 6.6M in, 346k out, $0.00 reported |
| reviewer opus | 71 launches, 0.0M in, 3096k out, $644.17 reported | 52 launches, 0.0M in, 50k out, $17.06 reported |
| workhorse codex | 18 launches, 438M in, 2583k out | 24 launches, 17M in, 148k out |
| workhorse mimo | 18 launches, 7.8M in, 1213k out, $0.00 reported | 24 launches, 2.1M in, 302k out, $0.00 reported |

| Role, median per run | this repository's runs (18 runs) | fixture runs (24 runs) |
| --- | --- | --- |
| workhorse | 21M in, 151k out | 0.8M in, 20k out |
| reviewer | 1.5M in, 158k out | 0.4M in, 18k out |
| coachman | 85M in, 286k out | 15M in, 59k out |

## Incidents

The 15 entries below were found by searching every action in the window for walls, kills,
overloads, duplicates and degraded lanes, reading each hit, and keeping what the words show. Each
cites an action that exists, and a clean run reads none
[@trials/2026-10-03-lane-audit/results/incidents.md].

|  | Kind | When (UTC) | What happened | Runs |
| --- | --- | --- | --- | --- |
| I1 | kill | 2026-10-01T02:39Z | A review lane's script signalled every process of the user session (the cause ticket [#200](https://github.com/brindlewick/postmaster/issues/200) gives). Every agent in eight runs stopped, and each leg was remounted about two and a half hours later. | [#57](https://github.com/brindlewick/postmaster/issues/57), [#98](https://github.com/brindlewick/postmaster/issues/98), [#109](https://github.com/brindlewick/postmaster/issues/109), [#135](https://github.com/brindlewick/postmaster/issues/135), [#170](https://github.com/brindlewick/postmaster/issues/170), [#179](https://github.com/brindlewick/postmaster/issues/179), fixture-17, fixture-18 |
| I2 | kill | 2026-10-01T05:30Z to 06:30Z | The machine reset again after the remount. Reviewers in the round under way died mid-review in three runs: four of five in [#98](https://github.com/brindlewick/postmaster/issues/98), all three in [#170](https://github.com/brindlewick/postmaster/issues/170), the mimo reviewers in fixture-17. Each round was relaunched or run again whole. | [#98](https://github.com/brindlewick/postmaster/issues/98), [#170](https://github.com/brindlewick/postmaster/issues/170), fixture-17 |
| I3 | kill | 2026-10-01T13:58Z | The mimo bug reviewer of [#135](https://github.com/brindlewick/postmaster/issues/135)'s round 5 was killed by its 8G memory cap before it gave a verdict, and the round went on without it. | [#135](https://github.com/brindlewick/postmaster/issues/135) |
| I4 | session-lost | 2026-10-01T22:58Z | The first coachman of [#135](https://github.com/brindlewick/postmaster/issues/135)'s review leg could not be resumed: its 41 MB session could not be replayed. The leg went to the fallback coachman on a fresh stream. | [#135](https://github.com/brindlewick/postmaster/issues/135) |
| I5 | degraded | 2026-09-30T03:57Z, logged 2026-10-02T02:44Z | The opus security reviewer of [#135](https://github.com/brindlewick/postmaster/issues/135)'s round 3 was killed by the 600-second sub-agent ceiling before its verdict. The record was written late, at the card's check; the event itself falls before the window. | [#135](https://github.com/brindlewick/postmaster/issues/135) |
| I6 | wall | 2026-10-03T00:40Z, reset 02:29Z | The astra lane reached its codex usage limit. It left [#200](https://github.com/brindlewick/postmaster/issues/200)'s workhorse branch with a spec and a blocked report and no implementation, and it failed two of fixture-37's review rounds. | [#200](https://github.com/brindlewick/postmaster/issues/200), fixture-37 |
| I7 | wall | 2026-10-03T08:43Z, reset 11:14Z | The sol lane reached its codex usage limit during [#218, Every script runs as its TypeScript file, with no .sh wrapper left](https://github.com/brindlewick/postmaster/issues/218)'s workhorse stage and left no summary. It was resumed on its own thread at 14:12Z. | [#218](https://github.com/brindlewick/postmaster/issues/218) |
| I8 | overload | 2026-09-30T17:09Z | The opus security review of [#57](https://github.com/brindlewick/postmaster/issues/57)'s round 5 got a 529 overloaded response and did nothing. The second attempt reviewed. | [#57](https://github.com/brindlewick/postmaster/issues/57) |
| I9 | duplicate-launch | 2026-10-03T08:43Z | [#218](https://github.com/brindlewick/postmaster/issues/218)'s mimo lane was launched twice. The coachman ended the duplicate and one lane carried on. | [#218](https://github.com/brindlewick/postmaster/issues/218) |
| I10 | kill | 2026-10-03T12:03Z | The host's 8G memory cap killed [#218](https://github.com/brindlewick/postmaster/issues/218)'s coachman and its mimo lane. The run waited for the user's word, which came at about 14:00Z with the cap raised to 16G, and both resumed with nothing discarded. | [#218](https://github.com/brindlewick/postmaster/issues/218) |
| I11 | degraded | 2026-10-03T03:06Z and 05:42Z | In [#200](https://github.com/brindlewick/postmaster/issues/200)'s review, the mimo bug reviewer ended round 1 with no verdict after handing its work to a background helper. In round 3 it changed the code under review and merged into the synthesis worktree, so its verdict was void, and the astra reviewer's turn failed with no verdict. | [#200](https://github.com/brindlewick/postmaster/issues/200) |
| I12 | degraded | 2026-09-30T18:10Z and 22:39Z | A luna bug review's findings file did not parse as JSON, in [#158](https://github.com/brindlewick/postmaster/issues/158)'s round 2 and [#110](https://github.com/brindlewick/postmaster/issues/110)'s round 5, and the lane's round was counted degraded. | [#158](https://github.com/brindlewick/postmaster/issues/158), [#110](https://github.com/brindlewick/postmaster/issues/110) |
| I13 | degraded | 2026-10-01T09:50Z and 12:36Z | In two fixture runs a reviewer's round was counted degraded: the opus security review made no tool call and its CLEAN was not counted, and a mimo bug report did not normalize and was read by hand. | fixture-19, fixture-23 |
| I14 | auth | 2026-09-30T14:04Z, before the window opened | The codex login was revoked (a 401, token revoked) during [#110](https://github.com/brindlewick/postmaster/issues/110)'s round 2, so luna's bug review never ran. It falls before the window, in a run that reaches into it. | [#110](https://github.com/brindlewick/postmaster/issues/110) |
| I15 | degraded | 2026-09-30T00:59Z, before the window opened | The mimo bug review of [#124](https://github.com/brindlewick/postmaster/issues/124)'s round 19 gave no verdict, because its final message was withheld by the provider's content filter. luna closed the round alone. It falls before the window, in a run that reaches into it. | [#124](https://github.com/brindlewick/postmaster/issues/124) |

Which of these do several lanes cause? The session kill was one review lane's script, the fault
[#200, Run every lane in its own process space, so it cannot kill processes it did not
start](https://github.com/brindlewick/postmaster/issues/200) closes. A wall hits every codex lane at
once, since they share one limit. A second provider's lane hedges it and a second codex lane does
not. In [#218](https://github.com/brindlewick/postmaster/issues/218), sol's wall at 08:43Z left no summary, and the lane resumed at 14:12Z. Two kills were
the host's memory cap, and the resets, the revoked login and the session loss are not about lanes
at all.

## What the records cannot say

- Whether a one-workhorse run would have shipped worse. No run was made that way.
- Whether the reviewers would have caught what the second workhorse fixed.
- How many severe defects no lane found. The recall figures judge a smaller set only against what
  the larger set made.
- Whether a finding two lanes named holds up better than a lone one. Every finding logged was
  verified, and the dismissed ones carry no lane.
- What the codex lanes and the coachman cost in money. They report none.
- Whether any of this holds for a hard ticket. The only ticket with hidden tests is small.
- Whether the A, B and C classes would hold for a reader who did not read the coachman's account.
  The cards are the only record of what each lane got wrong.

## What would change the answer

- **A single-workhorse baseline** on tickets with blind tests, scored the same way. If one lane
  alone passes as often as the pair, the second workhorse stops earning its keep. If it fails where
  the pair passes, it does.
- **A hard fixture ticket**, one a single lane at full effort fails. If the second lane rescues it,
  the fixtures stop being a ceiling.
- **Findings recorded one by one** with lane, severity, verdict and how each was verified. If
  findings that one lane alone named are dismissed or reopened more often than shared ones, the lone
  findings are worth less than counted here.
- **Planted bugs**, as [#104, Research: test each leg on its own, starting with planted bugs for the
  review leg](https://github.com/brindlewick/postmaster/issues/104) proposes. They would show how
  many defects every reviewer misses, which this audit cannot.
- **A price for the codex lanes and the coachman**, from the plan. Then the cost of a second
  workhorse and of each extra reviewer can be set against what each added.
- **Defects that reach main** after review, traced to a finding no lane made.

## Options and what each costs

- **Keep both workhorses and all reviewers.** Costs what the tables show. The reviewers' share is the
  one with evidence.
- **One workhorse, all reviewers.** Saves the second lane's tokens, a median 18 minutes of waiting
  and about 11 minutes of gate time a run. Loses the hedge against a wall, and the fixes in the 12 A
  runs unless the reviewers catch them, which the records cannot say.
- **Two workhorses only for tickets that change the coachman contract.** By the contract's file list
  this keeps two workhorses almost everywhere: 17 of the 18 runs changed at least one listed file.
  The checker itself decides by part of a file, and was in use for three runs. It said yes for [#182](https://github.com/brindlewick/postmaster/issues/182)
  and [#200](https://github.com/brindlewick/postmaster/issues/200) and no for [#201](https://github.com/brindlewick/postmaster/issues/201). The rule would save little.
- **Two workhorses only for tickets with no blind tests.** That is where the A fixes are: 7 of the 8
  such tickets, against 2 of the 6 with blind tests, in 14 runs.
- **One reviewer per lens.** mimo alone would have found 58% of the severe findings, in 17M input
  tokens against a codex lane's 240M, and the pair found 91%. This gives up the findings a second
  lane would have made. [#137, Research: does a fix one review lane found need every lane to review
  again?](https://github.com/brindlewick/postmaster/issues/137) asks a related question about
  rounds after the first.
- **Drop opus's security review, or run it only where a change touches a risk surface.** Saves most
  of the recorded money. Gives up the 18 severe findings opus alone named, 7%, and whatever a
  security lens finds that a bug lens does not, which the records do not separate. [#90, Explore
  OpenAI's Codex Security CLI as another security reviewer](https://github.com/brindlewick/postmaster/issues/90)
  is open.

## Candidate tickets, ranked

None is filed. Three open tickets already cover work this audit points to:
[#255, Bug reviewers are told to change nothing](https://github.com/brindlewick/postmaster/issues/255)
for the reviewer that changed the code under review in [#200](https://github.com/brindlewick/postmaster/issues/200),
[#221, Run every lane with only the files, hosts and sockets it needs, on Linux and macOS](https://github.com/brindlewick/postmaster/issues/221) for what a lane may write, and [#104](https://github.com/brindlewick/postmaster/issues/104) for planted bugs.

1. Run a single-workhorse baseline: for the next tickets that have blind tests, score a run with one
   workhorse and a run with two against the same tests, to settle whether a second workhorse changes
   a result.
2. Have the coachman write each review finding to a record as it triages, with its lane, lens,
   severity, verdict and how it was verified, so that who found what and what was dismissed are
   counted from data and not read from prose.
3. Write blind tests for every ticket whose criteria can be checked at an interface, as the
   coachman did for 6 of the 14 runs judged here, so that each lane is measured alone.
4. Decide whether opus's security review runs every round or only on a change that touches a risk
   surface, since it is the largest recorded cost and named no finding on the fixture ticket.
5. Have a coachman leg's usage record read the leg's session record, so that a resumed leg, or one
   that exited without a record, still has its tokens counted.
6. Add a hard fixture ticket, one a single lane at full effort fails, so that the fixtures can show a
   second workhorse's worth.

## Evidence

One trial over the runs' records, with its method, its controls and every derived table:
[@trials/2026-10-03-lane-audit/method.md]. The earlier audit's data are
[@trials/2026-09-29-synthesis-audit/results.md]. See also [Combining models](combining-models.md),
[The review loop](review-loop.md) and [fixture runs](fixture-runs.md).
