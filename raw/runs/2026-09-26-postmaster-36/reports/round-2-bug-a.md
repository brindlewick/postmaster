## Review round 2, bug lens, PR #39 at `ad786ec`

Scratch: `[repo]/.worktrees/parallel-review-rev-bug-[a]` (detached at `ad786ec`, unmodified). Everything I ran used copies under `mktemp -d`. File:line references below are at `ad786ec`.

### Part 1: closure

1. closed. `scripts/launch.sh:148-162`: every `[team.coachman_legs]` check is under `if name == "coachman":`. Control "a lane launches on a config the coachman refuses" passes. Execution.
2. closed. `postmaster.md:84-87` runs `form coachman --leg` for all three legs and `form coachman_fallback` before dispatch; `postmaster.md:169-171` sends a `launch:` line to the user. Refusals verified by execution against a fixture; the runbook wiring by reading. Residue in findings 1 and 7.
3. closed. `coachman.md:121-122` routes deferred findings to the card; `coachman.md:581-583` lists open bug and security findings. Reading.
4. closed. `coachman.md:493-495`. Reading.
5. closed. `coachman.md:527-530`. Reading. Boundary residue in finding 3.
6. closed. `stage.sh:42-43,65`. Control "the coachman cannot move a run out of abandoned" passes, and fails (exit 0) when lines 42-43 are removed. Execution.
7. closed. Takeover goes through the step 5 wrapper (`postmaster.md:189-192`, wrapper `:144-147`). Stub simulation: stream holds launch, resume and takeover lines in order; `.err` holds only the last process's line. Fallback wall to the user at `:172-173`. Execution for the wrapper, reading for the wall.
8. closed. `postmaster.md:120-124`. Reading; the poll path after the re-touched done marker verified with `runs-status.sh`.
9. closed. `review-loop.md:14-15` and `:50-52`. Reading. Residue in finding 9.
10. closed. `launch.sh:126,136-139,144-147,159-160,176`. Controls pass; removing the per-leg lane-model check fails only its control, removing the per-leg table check fails only its control, and the pre-fix shape (no try/except, no outer die, no unset) fails the "cannot read … environment unused" control. Execution.
11. closed. `coachman.md:402-412` writes the prompt once per round with a quoted heredoc before any launch; `:412` quotes `"$L"` and `"$DEST"`. Reading.
12. closed. `coachman.md:445` clears each marker before its launch; `:438` re-runs an interrupted round whole. Reading.
13. closed. `coachman.md:512-513`. Reading.
14. closed. `coachman.md:57-59`, `review-loop.md:66-67`. Reading. Residue in finding 8.
15. closed. `launch.sh:83` and `stage.sh:120-122` are positive controls; making `--leg` ignored fails five controls, refusing terminal stages for everyone fails the abandon control. Execution. Residue in finding 5.
16. closed. `coachman.md:424-426`. Execution: a second `cut-scratch.sh` into a path still holding the old scratch exits 1 and the chain prints `SCRATCH BROKEN`.
17. closed. `postmaster.md:210` and `:231`. Reading.
18. closed. `postmaster.md:139,145`. Reading.
19. closed. `launch.sh:121-122`; both no-`--leg` controls pass. Execution.
20. closed. `postmaster.md:144`. Reading; wrapper simulated.
21. closed. `coachman.md:594,601-603`, `stage.sh:29`, `postmaster.md:244`. Execution: poll shows `DISPATCH` at `shipped` with `.leg-3-done`, and `-` after `stage.sh done postmaster`.

Merge resolution: correct. Stage B keeps #35's ticket check as step 1, the config check joins step 2, steps 3-7 renumbered consistently; step 4 keeps the PR's ownership sentence; `:108` "stage 3" matches `coachman.md:239`; the only step reference into that region (`:80`, "Stage A, step 3") is unaffected. `wiki/log.md` has both entries, newest first; `wiki-lint.sh` exits 0. All three self-tests pass; marker names agree across `postmaster.md`, `coachman.md` and `runs-status.sh`; stage names agree with `stage.sh --list`; the only `review-style|bug|security` strings left are `stage.sh`'s negative controls.

### Part 2: findings

**1. P2. REMOUNT has no branch for a leg that exited before it had a thread id.** `postmaster.md:173-175`: "Anything else is a spent thread: remount it by resuming the leg (Stage C)"; `:150`: "`<name>` and `<thread-id>` are the leg's `coachman.legs.<n>.name` and `.thread_id`." A harness that exits before its first stream event (a model id the provider rejects; `form` cannot catch that, and `config.example.toml:5-7` says to confirm ids by a trial launch) leaves no thread id, no `launch:` line and no quota text. A resume cannot be formed: `launch.sh:191` `${args[1]:?resume needs <thread-id>}` fires on an empty id and prints `launch.sh: line 191: …`, not a `launch:` line (execution), so the refusal branch does not catch it either; `.leg-<n>-exited` lands again and the poll says REMOUNT again. The "anything else" text predates the PR (`origin/main:147-150`), but the PR rewrote REMOUNT into three branches and this case has none. Confidence medium-high; mechanics by execution, the harness behaviour on a bad id by reading. Repro: `coachman_legs.review = { harness = "claude", model = "no-such-model" }`; Stage B passes; dispatch leg 2; the events file is empty; manifest has no `coachman.legs.2.thread_id`; `.err` has only the provider's error.

**2. P2. "Waiting on the user" has no state the poll reads, so three paths re-fire every cycle.** `postmaster.md:162` "Act on the `NEXT` column, run by run"; `:169-171` refusal to the user; `:172-173` fallback wall to the user; `:228-231` user authority: "in front of the user and wait" and "Remove `.card-ready` before you deliver either word", where the word may be hours away. Execution: `runs-status.sh` reports `REMOUNT` for a run whose refusal went up even with `<runs>/postmaster/ESCALATION.md` present, and `GATE` while `.card-ready` stays. A literal postmaster re-enters Stage F each poll and re-runs the gate command (`:218-219`), or re-tells the user. The GATE case predates the PR (`origin/main:207`); the two REMOUNT paths are new in `33feb83`. Under the default `merge_authority = "user"` (`config.example.toml:70`) every run meets it. Confidence medium: if instead the postmaster stops polling while it waits, the other run under `max_runs` goes unsupervised. Repro: `.card-ready` + `.leg-3-exited`, poll twice.

**3. P3. Consult-mode ruling at the cap contradicts the cap.** `coachman.md:510-511`: "Cap 5 rounds for the whole loop … then STOP and escalate"; `:528-529`: "A ruling that asks for a change is applied and followed by another round, counted toward the cap". After a round-5 card, "another round" is round 6. Nothing says which wins: the cap is exceeded, or the ruling's change ships unreviewed, which is finding 5 reopened at the boundary. Reading. Repro: consult mode, five rounds, the ruling on the card asks for a change.

**4. P3. A coachman that gets `stage.sh` exit 3 has no instruction.** `stage.sh:20,42-43,65` return 3 with "only the postmaster moves it on"; `coachman.md` has no text for a refused stage (grep for exit 3, refuse, abandoned: nothing). After the postmaster abandons a run and removes its worktrees (`postmaster.md:248-251`) while a leg is live, that leg's next stage call returns 3 and the coachman carries on by its own judgement. Execution: `stage.sh <d> shipped coachman` on an abandoned run exits 3. Repro: as stated.

**5. P3. Two refusals Stage B relies on have no control.** `launch.sh:161` `not_a_lane(team.get("coachman"), "team.coachman")` and `:165` `not_a_lane(spec, "team.coachman_fallback")`. Every fixture (`:41-48`) puts the coachman on `coach-model` and the fallback on `fallback-model`. Removing either line leaves all 22 controls passing (execution, mutations C and D); the mechanism itself works (execution against `onlane`/`fbonly` fixtures). Design rule 5. Repro: delete line 165, run `--self-test`.

**6. P3. The "cannot read" control cannot tell the python catch from the outer die.** `launch.sh:136-139` vs `:176` `|| die "cannot read the config at $CONFIG"`. With the try/except removed, all controls pass because the outer die prints the same words; only the pre-fix shape fails it (execution, B1 vs B2). The control covers its label; the TOML error position in the message has no control. Repro: remove lines 136-139, run `--self-test`.

**7. P3. Stage B's pre-flight covers the coachman roles, not the lanes.** `postmaster.md:84-87`. `launch.sh:180-183` refuses a lane whose harness is off PATH or whose `env_file` is missing; that surfaces in leg 1 as a lane that "died mid-flight" (`coachman.md:267-270`), after the worktree is cut and the ticket moved to in-progress. `form <lane>` for each of `team.workhorses` and `team.reviewers` is the same cheap check. Reading. Repro: a lane with `env_file` pointing at a missing file; Stage B passes; leg 1 writes `launch: env_file for <lane> not found` to `logs/<lane>.err`.

**8. P3. `apply` has no specified target, so the wiki's coverage measure is approximate.** `coachman.md:59` "`apply` per fix (detail the findings it fixes)"; `review-loop.md:64-67` needs to know whether a later finding sits in code a fix changed, and the log records only the site each finding was found at. The fix's commit sha as the target would make it exact. Reading.

**9. P3. Wiki residue from round-1 finding 9.** `review-loop.md:23` bullet heading "**Every fix is re-reviewed by both gating lenses.**" is still unqualified while `:14-15` and `:50-52` say the cap ends review. Reading.

**10. P3. Stage C step 2 has no branch for leg 1.** `postmaster.md:120-121`: "`scripts/handoff-check.sh <dispatch>/handoff-<n-1>.md` exits 0. If it exits 2 …". For leg 1 there is no `handoff-0.md`, the script exits 1 (`handoff-check.sh:13`), and the step gives no exit-1 branch; step 1 says to omit the hand-off for leg 1, step 2 does not. Predates the PR (`origin/main:116`), rewritten by it. Reading.

Note, not a finding: #48 (deferred) covers the wait timeout. Related and unverified here: a coachman on the claude harness runs `wait-for-markers.sh … 2400` as a foreground tool call, and that harness caps a foreground command well under 40 minutes; if so, the "launch and wait in one command" rule at `coachman.md:469-475` cannot hold on that harness and `harnesses.md` does not record it. Worth a trial run under #48.
