## Report: Round 3 bug-lens review, PR #39 at 86dcdfb

**Method note:** Worked in the detached worktree at `86dcdfb` (verified via `git log -1`). Ran `scripts/launch.sh --self-test` and `scripts/runs-status.sh --self-test` unmodified (both pass, all controls). To test control *adequacy*, copied the two scripts into a `mktemp -d` scratch, reverted each fix under test with `sed`/Python, and re-ran `--self-test` to confirm the right control fails for the right reason (never edited the reviewed worktree). To test the `coachman.md` shell snippets (which have no `--self-test` of their own), built an isolated git repo + worktrees in a separate `mktemp -d` rig and ran the literal snippets against it with placeholders substituted. All execution claims below were actually run, not inferred.

### Part 1: Closure of round 2's findings

1. **closed** — env file validated/path-normalized at `launch.sh:215-218` but only sourced at `launch.sh:304-305`, right before `exec "${cmd[@]}"` (line 306), after `cmd` is fully built. Verified by execution: self-test passes; reverting to eager sourcing (right after the existence check) breaks exactly `"a lane's env file reaches the harness's environment"` and `"an env file cannot put the coachman on another model"` (both start failing with exit 1, `HARNESS` clobbered to the env file's bogus value).
2. **closed** — `coachman.md:448-454` checks every scratch's HEAD against `SNAP` and `exit 1`s with "nothing launched" before any launch. Verified by execution: built a real off-snapshot scratch (via `checkout --detach`, no deletion) and confirmed the check aborts with `SCRATCH NOT AT <sha>: ...; nothing launched`, exit 1, and zero launches (no `launched.log`, no `.done` markers).
3. **closed** for the stated problem — `launch.sh:139-150` routes all argument errors through `die`; `launch.sh:228` refuses `resume` with an empty thread id; `postmaster.md:171-174` sends a threadless leg to the user instead of resuming it. Verified by execution (self-test: "an argument launch.sh does not know is refused", "a resume with no thread id is refused, and nothing runs"). **However**, the new recovery path this fix adds ("launched again (Stage C step 3)") opens a fresh gap — see **Finding A** below.
4. **closed** — `launch.sh:173-178`, `base()` strips a trailing `[...]` suffix before comparing to lane models. Verified by execution: reverting `base()` to identity breaks exactly `"a leg entry on a lane's model with a bracketed suffix is refused"`.
5. **closed** — `coachman.md:455` clears all of the round's `.done` markers with one glob before any launch, replacing the old per-lane `rm -f` that ran inside the loop. Consistent with `wait-for-markers.sh`'s plain `find | wc -l` counting (reviewed, not modified), which would otherwise over-count a stale file.
6. **closed** — `STDIN_FILE=""` added to the initializer at `launch.sh:142`. Verified by execution: removing that initializer breaks `"a STDIN_FILE from the environment is not used"` (an inherited `STDIN_FILE` now leaks into a `claude`-harness `form`'s printed output) plus several `launch`/`resume` controls (nounset error under `set -u`) — same root cause, right failure.
7. **closed** — `bare` fixture (`coachman` with a harness but no model) is refused with `"coachman has no model in the config"`. Verified by execution.
8. **closed** — `runs-status.sh:49` globs `.waiting-on-user`; line 61 gives it priority over RULE/GATE/DISPATCH/REMOUNT (checked right after the terminal-stage check). Verified by execution: self-test passes; removing that `elif` breaks exactly `"a run waiting on the user is USER..."` (falls to REMOUNT) and `"a ship card put to the user waits on the user, not the gate"` (falls to GATE).
9. **closed** — `coachman.md:543`: "a round past the cap runs only when the ruling says so." Verified by reading; this is a judgment-call instruction, not mechanically testable.
10. **closed** — `coachman.md:691-694`: on `stage.sh` exit 3, log a `note` quoting the refusal and exit. Cross-checked against `stage.sh`'s actual exit-3 conditions (`stage.sh:30`, `:43-44`): both correspond to a terminal stage already set by the postmaster, matching the note's diagnosis, since the coachman's own runbook never requests a terminal stage itself.
11. **closed** — `"team.coachman on a lane's model is refused"` and `"the fallback on a lane's model is refused"` both present and pass.
12. **closed** — `"a parse error names the file and where it breaks"` checks for `"launch: cannot read $tmp/dup.toml: "`, which only the Python `except` branch (`launch.sh:167-168`) produces; the shell fallback (`launch.sh:210`) says "cannot read the config at" instead, so the two can't be confused. Verified by execution.
13. **closed** — `postmaster.md:84-88` adds `scripts/launch.sh form <lane>` for every lane in `team.workhorses` and `team.reviewers`; confirmed these are the actual `config.example.toml` keys (`workhorses = [...]`, `reviewers = [...]`).
14. **closed** — `apply` action doc now reads "target its commit, detail the findings it fixes" (`coachman.md`, log-action catalog).
15. **closed** — `wiki/concepts/review-loop.md` heading now "Each round's fixes are re-reviewed by both gating lenses."
16. **closed** — `postmaster.md:121`: "From leg 2 on, verify the hand-off before dispatching on it."
17. **closed** — `postmaster.md:230-231`: `.card-ready` removal stated before either word (grant/withhold) is delivered.
18. **closed** — Verified by execution: a leftover *unmodified* scratch is silently removed and recut; a leftover scratch with a modified tracked file prints `LEFT BEHIND AND MODIFIED, <path>: file.txt` (exact file named) before removal/recut; `git worktree prune` runs once before the loop (`coachman.md:418`).
19. **closed** — Verified by execution: `[team.coachman_legs.synthesis] = {}` (a Python-falsy empty table that previously fell through to `team.coachman` via `{} or team.get(...)`) is now refused with "needs a harness and a model" (`launch.sh:192-193`).
20. **closed** — `unset HARNESS MODEL EFFORT ENV_FILE` removed; `eval "$spec"` (`launch.sh:211`) always assigns all four, since the Python side always prints all four keys with `.get(k, "")` defaults (`launch.sh:207-208`), regardless of any pre-existing environment value. Verified by reading; sound reasoning for why no test is needed.
21. **closed** — `<dispatch>/leg-<n>-resume-<time>.txt` with `<time>` from `date -u +%Y%m%dT%H%M%SZ` (`postmaster.md:140`). Minor note, not raised as a separate finding: two resumes of the same leg within the same UTC second would collide on the filename; low likelihood given each resume is a supervised, human/postmaster-paced action.
22. **not closed** — see **Finding B**. The fix rewords the instruction ("read the new thread id from the events the takeover appended," `postmaster.md:195`) but gives no mechanism to isolate the appended portion of the shared events file, and `harnesses.md` — the sole authority the rest of the flow points to for "where each harness prints it" — is unrevised and explicitly keys off **the first event of the stream** for two of the harnesses that can run a coachman.

**Not changed** (both confirmed accurate, no dispute): `stage.sh`'s actor-trust limitation is now documented, not fixed (`stage.sh:15-16`); wiki/index.md reordered to match the ticket-shape page's actual creation order rather than editing the historical log line.

**Deferred (#45-49) and round 1's standing items:** none of these are touched by `86dcdfb`'s diff; correctly left as open/deferred.

---

### Part 2: New findings

**Finding A — P1 — relaunching a never-started leg leaves a stale `.leg-<n>-exited` marker, causing an immediate false REMOUNT against the live retry**
`skills/postmaster/postmaster.md:126-136` (Stage C step 3) vs. `:139-149` (Stage C step 5)

```
126	3. **Launch,** in the background, stream to the leg's events file, marker on exit:
127	
128	   ```sh
129	   ( scripts/launch.sh launch coachman <repo>/.worktrees/<TICKET> <dispatch>/leg-<n>-prompt.txt --leg <leg-name> \
130	       > <dispatch>/logs/coachman-leg-<n>-events.jsonl 2> <dispatch>/logs/coachman-leg-<n>.err;
131	     touch <dispatch>/.leg-<n>-exited ) &
```
versus step 5's wrapper, which the fix for #22 and the wall-takeover path both reuse:
```
144	   ```sh
145	   rm -f <dispatch>/.leg-<n>-exited
```

Round 3's fix for finding #3 added a brand-new recovery path at `postmaster.md:174`: *"none in `coachman.legs.<n>`, never started: its `.err` goes to the user (Stage E step 3), and on their answer the leg is launched again (Stage C step 3)."* Step 3's code block is written for a leg number that has never been touched (a fresh dispatch directory never has `.leg-<n>-exited` yet), so it contains no `rm -f` — unlike step 5, which explicitly clears the marker first. Reusing step 3 verbatim for this new recovery case leaves the marker from the first, failed attempt in place while the second, successful attempt is actively running.

Confidence: high. Verified by execution against the real `runs-status.sh`, and by reading — grepped both runbooks; the only `rm -f <dispatch>/.leg-<n>-exited` in the entire flow is `postmaster.md:145`.

Steps to reproduce:
1. Cause a leg's first launch to fail without ever emitting a thread id (e.g. a misconfigured `team.coachman_legs.<leg>` so `launch.sh` dies on `--leg`/model checks). The step-3 wrapper still runs `touch <dispatch>/.leg-<n>-exited` on exit regardless of the launch's own exit code.
2. Poll: `runs-status.sh` reports REMOUNT (no `.leg-<n>-done`, `.leg-<n>-exited` present, no thread id anywhere) → per `postmaster.md:171-174` this goes to the user and `.waiting-on-user` is touched.
3. User answers; postmaster removes `.waiting-on-user` and relaunches per `postmaster.md:174`, i.e. re-runs the block at lines 128-132 verbatim — no marker clear.
4. The relaunch succeeds this time and records a real thread id; the leg is now genuinely running.
5. I reproduced the resulting state directly against the unmodified `scripts/runs-status.sh`: a run directory with `manifest.json` `{"stage":"review","leg":2,"coachman":{"legs":{"2":{"thread_id":"NEWTHREAD-789"}}}}`, only `.leg-2-exited` present (no `.leg-2-done`), and a freshly-touched events file — `runs-status.sh` prints `NEXT=REMOUNT`, not `WAIT`, even though the leg just started:
   ```
   RUN     STAGE   LEG  MARKERS         IDLE  NEXT
   REV-1   review  2    .leg-2-exited     0m  REMOUNT
   ```
6. Per `postmaster.md:171-179`, since a thread id now exists and there's no wall in `.err`, this falls to "Anything else is a spent thread: remount it by resuming the leg... with 'Continue leg `<n>`...'" — a second, spurious `scripts/launch.sh resume` fires concurrently with the still-running relaunch, both appending to the same `coachman-leg-<n>-events.jsonl`.

---

**Finding B — P1 — a takeover's thread id, per `harnesses.md`'s own recipe, is read off the wrong (pre-takeover) thread for two harnesses**
`skills/postmaster/postmaster.md:188-196` vs. `skills/postmaster/harnesses.md:126`, `:154`

```
193	the leg." Launch it through the wrapper of Stage C step 5, with `scripts/launch.sh launch
194	coachman_fallback <repo>/.worktrees/<TICKET> <dispatch>/leg-<n>-takeover.txt` in place of the
195	resume. Read the new thread id from the events the takeover appended, and record it as
196	`coachman.legs.<n>.thread_id`, with `coachman_fallback` as its `name`.
```
```
harnesses.md:126:- Thread id: `session_id` on the first event of the stream.
harnesses.md:154:- Thread id: `id` in the first `session` record of the JSON stream.
```

The takeover is explicitly launched "through the wrapper of Stage C step 5," which appends (`>>`, `postmaster.md:147`) to the *same* `<dispatch>/logs/coachman-leg-<n>-events.jsonl` the original (now-dead or walled) thread already wrote to. So after a takeover, that file holds two threads' events back to back. The fix's instruction — "read the new thread id from the events the takeover appended" — names the right problem but gives no mechanism to find the boundary (no recorded line count/offset, no "read from the tail" instruction). Every other reference to thread-id extraction in this flow explicitly defers to `harnesses.md` ("Record the thread id from the stream (`harnesses.md`)," `postmaster.md:134`), and `harnesses.md` itself is untouched by this PR: for `claude` it says "session_id **on the first event of the stream**," and for `pi`, "id in the **first** session record." Applied literally to the merged file, both recipes return the *original* thread's id, not the fallback's.

Confidence: medium-high — this depends on how literally the instruction is followed; a reader might notice recency and deviate from the documented recipe, but nothing in either file tells them to. Given the review's own framing (read the runbooks as an agent would follow them literally), and that `harnesses.md` is the flow's sole, explicitly-designated authority for exactly this fact, I think this is a real gap, not a stretch. Verified by reading only — this isn't independently scriptable/testable as it stands, which is itself part of the finding.

Steps to reproduce (traced through the text, not executed — there's no harness stub for stream-format thread-id extraction to run against):
1. Configure `team.coachman_fallback` on `claude` or `pi`.
2. Leg `n` launches normally; its stream's first event carries thread id `AAA`.
3. The leg hits a quota/provider wall; postmaster takes over per `postmaster.md:188-196`, appending the fallback's own stream (first event carrying `BBB`) onto the same file.
4. Following `harnesses.md:126` (or `:154`) against the now-merged file yields `AAA`, and `coachman.legs.<n>.thread_id` is recorded as `AAA`.
5. Any later delivery to this leg — a ruling (`postmaster.md:215-217`, Stage C step 5) or the merge word (`postmaster.md:230`) — calls `scripts/launch.sh resume coachman_fallback ... AAA ...`, targeting the superseded original thread instead of the live fallback conversation `BBB`.

---

**Finding C — P3 (low confidence) — the CUT step's leftover-scratch check assumes existence implies a valid, registered worktree**
`skills/postmaster/coachman.md:422-426`

```
422	       # A scratch an interrupted round left behind is checked like any other, then removed.
423	       if [ -e "$DEST" ]; then
424	         git -C "$DEST" diff --name-only | sed "s|^|LEFT BEHIND AND MODIFIED, $DEST: |"
425	         git -C <repo> worktree remove --force "$DEST"
426	       fi
```
This correctly handles the documented case (finding #18: a fully-cut scratch left behind by an interrupted round). If `$DEST` instead exists as a non-worktree directory or a partially-registered one — e.g. `cut-scratch.sh`'s own `git worktree add` (`cut-scratch.sh:22`) died mid-way on a prior attempt rather than failing cleanly — `git -C "$DEST" diff` and `git worktree remove --force "$DEST"` would themselves error, which the surrounding prose doesn't anticipate. I did not find a concrete path that produces this state (git's own `worktree add` is reasonably atomic in the failure modes I could construct), so confidence is low; flagging for completeness given the bug lens's "does a check pass vacuously when something is missing" framing. Verified by reading only.

---

### Summary
Not CLEAN. Two P1 findings (A, B), both newly opened by round 3's own fixes (for #3 and #22 respectively), plus one low-confidence P3 (C). Finding #22 should be reclassified **not closed**; all other 21 fixed findings check out as closed, with 16 of them confirmed by actually running the self-tests (including deliberately breaking each fix to confirm its control fails for the right reason) or by reproducing the exact file/marker states the runbooks would leave behind.
