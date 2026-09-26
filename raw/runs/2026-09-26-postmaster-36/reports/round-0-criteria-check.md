I reviewed HEAD b17699b against #36. All ten acceptance criteria are met. The findings are minor, and none blocks the merge.

**Acceptance criteria**
1. Met. `scripts/stage.sh:20` lists `review` and none of the three old stages. Controls at `:111-113` and `:121-125` cover each old name, and each can fail.
2. Met. `coachman.md:98` plus the legs table at `:104-106`, `postmaster.md:83`, `AGENTS.md:120,129-131` and `README.md:18`.
3. Met. `launch.sh:105-119` refuses the old keys with "style, bug and security are one leg now, review; set review instead". It also refuses unknown keys and a bad `--leg`. The new self-test has 13 controls.
4. Met. `coachman.md:399-434`: one scratch per lens per lane, all cut at the same `$SNAP`. The block launches everything and ends in the wait. Markers are `review-r<round>-<lens>-<lane>.done`.
5. Met at `:472-483`: dedup across lenses, verify, bug and security fixes first, then style changes in round 1, then the gate.
6. Met at `:484-491`.
7. Met at `:489-499` ("Cap 5 rounds for the whole loop", "whichever lens found it"). The `finding` detail at `:57` names every lens and every lane.
8. Met at `:500-506`: one `checkpoint-review.md`, which is the ship approval in consult mode.
9. Met. The wiki page's standing is `claimed`, `coachman.md:369` links to it, and the old "Sequential, so…" reason is gone. No new reason was added.
10. Holds now: this machine has no `~/.postmaster/runs` and no config, and the change has no migration code. Merging while the fleet is idle is up to the user.

**Definite defects (minor)**
1. `coachman.md:58`: the `degrade` action does not say its detail names the lens and the round, unlike `review-launch`. With two log lines for the same lane in one round, the lenses can't be told apart. `postmaster.md` Stage F checks the card's DEGRADED lanes against those lines. Fix: "…the detail naming the lens, the round and the cause".
2. `coachman.md:120` (a line this diff edited) still says "(the next leg restates these to its reviewers)". The review leg's hand-off goes to ship, which has no reviewers. Line `:126` is still per lane, not per lane per lens. Fix: say the ship leg carries deferred style findings to the Style residue, and list REVIEWED/DEGRADED per lane per lens.
3. `wiki/concepts/review-loop.md:13` ("That takes fewer rounds") and `wiki/index.md:42` ("in fewer rounds") make an uncited claim without marking it unverified. The page's own line 31 marks the same estimate "(unverified)". Mark these too, or write "should take".

**Judgement calls**
4. `review-loop.md:42-44`: "the leg is split at a round boundary" reads as a current rule, but no runbook carries it. I'd write "would be split".
5. `coachman.md:436`: "Record every reviewer's thread id, with its lens" doesn't say where. The manifest holds one id per lane, and each lane now has several ids per round. I'd put the thread id in the `review-harvest` detail.
6. The wiki page's costs list memory only. Running one lane three times at once also hits that account's usage limits sooner. The DEGRADED rules already handle the effect, but the cost is worth one line.
7. `launch.sh` finds a stale config only at launch. With an interactive postmaster, that is after Stage B has already cut the worktree and moved the ticket to in-progress. A `scripts/launch.sh form coachman --leg synthesis` check at the start of Stage B would catch it before either.

**Other notes**
- Merging this with PR #35 conflicts only in `wiki/log.md`: both add the newest entry at the top, so keep both. The other shared files merge cleanly.
- Uncommitted edits to `coachman.md` appeared in the worktree while I was reviewing, and I left them alone. They add a per-lens "Launch step: from its brief" and replace the launch command in the block with `( <the launch step of $LENS, for $L in $DEST> \`. #36 didn't ask for this. Every lens's step is identical, and the block can no longer be run as written. The other hunk in those edits, naming the three legs inline at `:98`, is fine.
- Stale references: none left for five legs, leg 4 or 5, `handoff-4`/`handoff-5`, `.leg-5-done`, the three old review stages, per-pass cards or old stages 5 and 6. The only hits are `stage.sh`'s negative controls and the wiki page describing the old design.
- Outside #36: `postmaster.md:127` remounts with `launch.sh resume coachman` and no `--leg`, so a leg with a `[team.coachman_legs]` override resumes on `team.coachman`'s harness. `docs/poster.jpg` still shows review gates in sequence and "You (operator)".

**Tests**
- Every self-test passes: `stage.sh` 11 controls, `run-times.sh` 9, `run-meta.sh` 10, `run-log.sh` 7, `wiki-lint.sh` 16, `launch.sh` 13.
- `bash -n` is clean on all 19 scripts, and `scripts/wiki-lint.sh` exits 0 with no faults.
- I ran the round-1 launch-and-wait block with a stub launcher: 6 markers arrived and the wait exited 0. So the block works once the placeholders are filled.
