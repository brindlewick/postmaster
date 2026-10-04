---
kind: trial
subject: what several lanes added to, and cost in, three days of runs, from the runs' own records
date: 2026-10-03
---

# Method

**Question.** [Issue #257](https://github.com/brindlewick/postmaster/issues/257): is the multi-lane
setup still earning its keep? Several workhorses implement each ticket, the coachman composes one
synthesis, and several reviewers read it. [The earlier audit](../2026-09-29-synthesis-audit/method.md)
asked whether the coachman takes work from both workhorses. This one sets what the extra lanes
add against what they cost in tokens, time and incidents, over the runs since: new lanes (sol and
astra), process confinement, tickets that carry their own spec, usage walls and memory-cap kills.

**Window and runs.** Every run with at least one action from 2026-09-30T15:40:00Z to
2026-10-03T15:40:00Z inclusive, by the action logs' times: the 72 hours before the audit began. A
run covered by one action in the window is read whole, and a count says when it reaches outside.
That is 31 run folders for this repository's tickets, of which 6 were set aside and dispatched
again under a changed flow and 8 had not finished, and 25 fixture runs. Real runs and fixture
runs are kept apart in every table. 22 folders had no action in the window and are left out; #92,
#102, #85 and six earlier fixtures are among them. Two real runs, #75 and #160, touch the window
only in their last minutes; both are counted, as the rule says. Four runs, #109, #122, #124 and
#135, reached synthesis before the earlier audit's cut-off and are in it; here their review legs,
cost, time and incidents are read, and their synthesis rows carry the earlier audit's reading.

**The teams,** per each run's `run.json`. Real runs: two workhorses, `luna` on codex with
`gpt-6-luna` in 24 runs, `sol` with `gpt-6-sol` in 6, `astra` with `gpt-6-astra` in #200, each at
effort max, and `mimo` on MiMo Code with `xiaomi-token-plan-sgp/mimo-v2.6-pro` at effort high. The
same two lanes review the style and bug lenses, and `opus` on Claude Code with `claude-opus-5-5` at effort max
reviews security alone. The coachman is on Muse Code with `muse-spark-1.3-contributor`. Fixture
runs use the lowest effort each harness has. The lane name `sol` in #218 and one set-aside run
names whichever codex model the config gave that lane at the time. Most runs dispatched before
2026-10-01 have three coachman legs and later ones two, since #124 ended the separate ship leg.

**Records read,** in each run's dispatch folder, never written:

- `actions.jsonl`: every action with its time, and from it the stages, harvests, gate runs,
  review launches, findings, degrades and notes.
- `run-log.md`: the SYNTHESIS line, which ranks the lanes, names what was taken from each and
  gives each lane's result on the blind tests, and the SHARES line, where the run has one.
- `checkpoint-1.md`, the synthesis card, for the 14 runs judged here.
- `manifest.json`, `run.json`, `shares.json`.
- `checkpoint-review.md`, for the finding list the newest runs write.
- `logs/`: each lane's `*.done` marker, whose time is when its process last exited; each lane's
  and reviewer's events stream; each launch's usage file.
- `sessions/coachman/`: each coachman thread's session record.
- For fixture runs, the lane branches `wb/1-<lane>` and `main` of the fixture repository, which a
  run keeps.

**Definitions.** Each is the earlier audit's unless it says it changed.

- *Ranked*, *took*, *rejected*, *blind tests*: the fields of the SYNTHESIS line, as before. The
  coachman writes the ranking last, after it has built the synthesis part by part on a fresh copy of
  the base, the code as it stood when the run began, and it knows which lane is which. Nothing in the config sets a lead lane. *The second lane* in
  every table is the lane ranked second.
- *The second lane's part*: read from the card, against a rubric fixed before any run was
  classified. **A**: the second-ranked lane supplied something the card says the first lane's
  version got wrong or lacked, shown by a probe or a failing criterion, a defect fix or a part of
  the feature. **B**: real but optional items, such as wording, a test, a guard or a structure.
  **C**: nothing usable, the same items, or no code. This replaces the earlier *core*, *small* and
  *trivial*: A covers core and fix, B small real items, C trivial and nothing. *First lane's
  defect*: whether the card names a defect in, or a departure from the approved spec by, the first
  lane's version that the second's lacked, as the earlier *covered*.
- *Gate on a lane's branch*: the result of the last `gate` run the coachman logged on
  `wb/<ticket>-<lane>`.
- *One lane alone sufficed*: some lane's own branch passed the gate, and the blind tests where the
  ticket had them, as logged. A logged failure may be a load flake or the oracle's own fault, and
  the notes under the table say where.
- *Share of the synthesis*: the run's SHARES line, which `scripts/synthesis-shares.ts` writes by
  the earlier audit's method, runs of six words in the added code. **Changed**: the line gives a
  lane-only, shared and neither count per kind, not first only and second only, and folds tests
  into code. Only runs after #158 have one, five real runs and the fixture runs. The earlier real
  runs were not counted again.
- *Hidden tests* (**new**): each fixture lane's branch, and the merged result, run through the
  fixture ticket's hidden suite as `scripts/fixture.ts` runs it: `bun test` in the ticket's
  `hidden/` folder with `FIXTURE_APP` naming the tree. A branch that points at the run's base
  holds no work and is not scored.
- *A lane's time* (**changed**): from the start of its implementation to the exit of its process,
  from its `.done` marker. The coachman's harvest line is not that time: it is written when the
  coachman has read the work, and in #200 it came 39 minutes after mimo's exit. *Extra wait*: the
  later lane's time less the earlier's, where both finished.
- *A severe finding*: a `finding` line of class gating and severity P1 or P2 that the coachman
  verified and did not dismiss. *Who named it*: the lanes the line names as sources, read by
  `parse.ts`. A finding is *alone* when one lane is named, *shared* when two or more are.
- *What a smaller reviewer set would have found* (**new**): of the severe findings in runs where
  at least one of those lanes reviewed, the share that any of them is named on.
- *Tokens* (**new**): each launch's figures from its own events stream, and each coachman
  thread's from its session record, read with the tool's own reader (`readHarnessUsage` in
  `scripts/usage.ts`), not by code written here. They are checked against the usage files wherever
  both exist. Money is what the harness reported, which is Claude Code's price and MiMo's zero.
  Codex and Muse Code report none.

**Counts and controls.** Every count has a positive and a negative control through the same code,
or is checked against a second program's figure: [results/controls.md](results/controls.md). It
holds 15 controls, and `controls.test.ts` shows a control failing when its positive case reads zero,
when a run that belongs outside the window is inside it, and when a cited incident has no action behind
it. They show the
code applies a rule the same way on a run where it must read non-zero and one where it must read
zero. They cannot show that the rule is the right one. Who named a finding was read by hand on a
sample of 45 lines drawn with a fixed generator, and all 45 match. The scripts in
[apparatus/](apparatus/) have tests beside them, 152 in all, and the hidden-test run has its own
controls: the suite passes the fixture ticket's reference patch and fails the app before it.

**Judgements, and who made them.** The second lane's part was classed by one reader from the
cards, and again by a second reader given the rubric and the cards only, blind to the first
reader's classes. The two agree on 12 of 14 classes and on 14 of 14 for the first lane's defect. They differ on #98, where the first reader says B and the second A because it counts mimo's spec-exact wording as a fix, and on #160, A and B. The table shows the first reader's classes; on either reader's, A is 9 runs, B 3 and C 2. Both read the coachman's own account, so neither is an independent
measure of what the lanes did. The independent measures are the gate, the blind and hidden tests,
the shares, the review findings and the tokens.

**Versions.** The tool at commit 40d50ce, Bun 1.4.2, git 2.43.0, TypeScript 7.0.2, oxlint 1.86.0,
Biome 2.5.14. The records were read between 16:05Z and 16:40Z on 2026-10-03; runs still going
were read as they stood. The scripts import only Bun and Node built-ins and the tool's own
`scripts/usage.ts`.

**To repeat.** The run folders stay on the machine that made them and are not promoted: only the
derived data here is. From a checkout of this repository, with the run folders, the fixture
repositories and the tool at 40d50ce:

```
bun apparatus/extract.ts --project <repo> --legacy <dir> --fixtures <dir> --tool <repo> \
    --since 2026-09-30T15:40:00Z --until 2026-10-03T15:40:00Z --out results/runs.json
bun apparatus/hidden.ts --tool <repo> --fixtures <dir> --out results/hidden-tests.json
bun apparatus/controls.ts ...the same roots... --results results
bun apparatus/render.ts
bun test apparatus/
```

A reader without the records runs `render.ts` alone and gets every table from the committed data.
`extract.ts` and `controls.ts` refuse to write anything that names a path, a thread or a session.

**Limits.**

- No run shipped one lane alone, so nothing here says whether a one-workhorse run would have
  shipped worse. The counterfactual is answered only where the records measured it: blind tests
  for 6 of the 14 runs judged, and hidden tests for the fixture runs. Eight of the 14 tickets
  had no blind tests, because the design question was the interface.
- The fixture ticket is one small ticket, run at the lowest effort, and every lane passes it. It
  cannot show what a second workhorse adds on a hard one.
- The ranking is the coachman's, given after the fact and not blind. It does not say whose code
  shipped, and on the fixture ticket it cannot follow the hidden tests, which every lane passed.
  *The second lane's part* is therefore the part of the lane the coachman ranked second.
- *Verified* is the coachman's word, mostly by execution, and *severe* is its scale. A lane's
  finding the coachman dismissed is not counted, and only the newest runs list dismissals.
- Who named a finding is the coachman's record. A line that names lenses and no lane reads as none:
  1 of 301 severe lines. Counting lines counts reports, not defects, and a later round reviews
  the fixes an earlier one led to.
- A smaller reviewer set is judged by the findings the bigger set made, so it can only lose. It
  cannot show a finding no lane made.
- Tokens are not comparable across harnesses: Claude Code's input figure leaves out cache reads
  (14 to 62 per launch), and the coachman's input is a context read again every turn. Money is known
  for one lane and one flat plan, so no total cost in money can be given.
- A run's usage file is written when a launch exits, so a coachman leg resumed afterwards holds
  more in its session than in its file. The session figure is used. Three launch groups differ
  between a usage file and a stream (listed in the controls), where a lane was launched again or a
  file holds no figures.
- Stage times include waits for the user, as the planning stage's wait for a spec's review. The gate
  times are the coachman's runs on a branch, not the lanes' own.
- The runs used different versions of the flow, pinned per run: two legs or three, one spec or
  one per lane, reviewers as the config named them at the time.
- Seven runs were still going when the records were read: #202, #216, #217, #218, #227, #237 and
  #251. They count for incidents and cost only; none is in a synthesis table. An eighth, #135,
  was waiting for its merge.
- Fixture-29's lane branches point at the base, and fixture-37's are gone, so neither's lanes are
  scored.
