## Report: Round 4 bug-lens review, PR #39 at `b4b1199`

Scratch used: `[repo]/.worktrees/parallel-review-rev-bug-[b]` (read-only; all mutation testing was done in a separate `mktemp -d` copy, never in that worktree or any other repo worktree). Both `scripts/launch.sh --self-test` and `scripts/stage.sh --self-test` pass at `b4b1199`, and I verified the meaningful new controls in each by mutation (reverting the underlying fix in a scratch copy and confirming the control fails for the stated reason, not vacuously).

### Part 1: Closure of round 3's findings

1. **closed** — Stage C step 3's wrapper now runs `rm -f <dispatch>/.leg-<n>-exited` before backgrounding (`postmaster.md:130`), structurally identical to step 5's existing clear (`postmaster.md:147`). Verified by reading; no race is possible since the `touch` only happens inside the backgrounded subshell after that attempt's own exit.
2. **closed** — REMOUNT gained a `.err`-opens-with-`launch:` branch (`postmaster.md:174-177`) that routes to the user and does nothing automatically, so a refused resume is no longer misclassified as "spent thread" and auto-resumed. Verified by reading and by executing `runs-status.sh` against constructed marker states. (See Finding 1: the fix stops the old infinite auto-resume loop but leaves a new gap of its own.)
3. **closed** — a relative `env_file` is resolved against the config's directory (`launch.sh:232`) before the later `cd "$CWD"` (`launch.sh:320`), so the source at `launch.sh:324` always uses an absolute path. Verified by execution: self-test control `a relative env file is read from the config's directory, never the worktree` passes at `b4b1199`; reverting just that resolution line makes it fail with `env_file for coachman not found or not readable: rel.env` (mutation-tested).
4. **closed** — both scratch-integrity checks in `coachman.md` (the "left behind" check and the post-harvest check) now use `git diff --name-only <SNAP>` instead of bare `git diff --name-only`. Verified by execution against a throwaway git repo: the bare form misses both a staged and a committed change relative to `SNAP`; the `<SNAP>`-qualified form catches both.
5. **closed** — `base()`'s regex is now `(\[[^\]]*\])+$` (`launch.sh:189`), stripping stacked suffixes. Verified by execution: self-test control `a leg entry on a lane's model with stacked suffixes is refused` passes at `b4b1199`; reverting to the single-bracket regex makes it fail (exit 0, wrongly allowed) (mutation-tested).
6. **closed** — `stage.sh` now returns 4 for a non-postmaster actor setting a terminal stage (`stage.sh:31`) and reserves 3 for "the run is already done/abandoned" (`stage.sh:67`, unchanged). Verified by execution: reverting the split makes the `done from the coachman is refused` / `abandoned from the coachman is refused` self-test controls fail with the wrong exit code (mutation-tested). `coachman.md:695-697`'s Hard Rules text already described only the surviving exit-3 case, so it needed no update.
7. **closed** — the header (`launch.sh:16-23`) now says the env file is shell, sourced last once the command/directory/stdin are fixed, and the user's to write. Verified by reading against the actual code order (cmd array built → `cd` → stdin redirect → source `ENV_FILE` → `exec`), which matches exactly.
8. **closed** — Stage E step 3 (`postmaster.md:215-219`) writes the question into the run's `.waiting-on-user` and adds the run+question to the aggregate `<runs>/postmaster/ESCALATION.md`; Stage F step 2 (`postmaster.md:240-242`) does the same; Stage D's USER bullet (`postmaster.md:167-169`) says to repeat the question only if not already asked this session. Verified by reading.
9. **closed** — `prompt_text()` (`launch.sh:236-239`) refuses a missing, unreadable, or empty prompt file, called from both `launch` and `resume`. Verified by execution: both new self-test controls pass at `b4b1199`; reverting to the old bare `[ -f "$PROMPT" ]` check makes both fail (exit 0, harness launched on an empty/unreadable prompt) (mutation-tested).
10. **closed** — the takeover now moves the walled coachman's stream to `coachman-leg-<n>-walled-events.jsonl` (`postmaster.md:197`) and launches through Stage C step 3's wrapper (truncating redirect), so the fallback's `events.jsonl` holds only its own thread. Verified by reading against `harnesses.md`'s thread-id extraction methods (claude: "session_id **on the first event**"; pi: "id in the **first** session record") — both are literal first-event reads that the old shared-stream design (appended via step 5's `>>`) would have gotten wrong.

Deferred item (interrupted-round retry, #48) and the dismissed/standing items were not touched by `b4b1199` beyond the SNAP wording already covered in #4; I did not re-report them.

### Part 2: Findings

**Finding 1 — P1 — REMOUNT's `launch:`-refusal branch has no prescribed action once the user answers**
File: `skills/postmaster/postmaster.md:174-183`
Confidence: high. Verified by reading (the runbook text) and by execution (marker mechanics via `scripts/runs-status.sh`).

Code:
```
- **REMOUNT:** the leg's process exited (`.leg-<n>-exited`) with no hand-off, escalation or
  card. Read the leg's `.err` file and the stream tail. A `.err` that opens with a `launch:`
  line is a refusal from `scripts/launch.sh`: it goes to the user (Stage E step 3), and nothing
  is launched or resumed until they answer. A leg with no thread id, none in its stream and none
  in `coachman.legs.<n>`, never started: its `.err` goes to the user too, and on their answer
  the leg is launched again (Stage C step 3). A quota or provider wall, quoted, means the
  coachman is lame for this leg: log `degrade` and take the leg over on the fallback (below),
  unless it already runs on the fallback, when the wall goes to the user. Anything else is a
  spent thread: remount it by resuming the leg (Stage C step 5) with "Continue leg <n>; ...
```

The sibling "never started" branch explicitly says what to do once the user answers ("the leg is launched again (Stage C step 3)"). The new `launch:`-refusal branch — the one this round added specifically to fix finding #2 — says only that nothing happens "until they answer," and then says nothing about what happens when they do. This isn't covered by falling through to Stage E step 4 ("Deliver the ruling... resume the current leg"), because that step's precondition is `.escalation-ready`, which is never set here (REMOUNT is defined as "no hand-off, escalation, or card"). It also can't reuse the neighboring branch's "launched again (Stage C step 3)," because — per finding #2's own description — this branch exists precisely to catch a **refused resume**, i.e. a leg that already has a thread id, where "no thread id... never started" does not apply.

Reproduction (steps that reproduce it): I reproduced the marker-state mechanics directly with the real tool:
```
mkdir -p RUN-1/logs
printf '{"stage": "review", "leg": 2}\n' > RUN-1/manifest.json
printf 'launch: env_file for coachman not found or not readable: /nope/rel.env\n' > RUN-1/logs/coachman-leg-2.err
: > RUN-1/.leg-2-exited
scripts/runs-status.sh <root>          # NEXT = REMOUNT
: > RUN-1/.waiting-on-user             # postmaster's action per line 176
scripts/runs-status.sh <root>          # NEXT = USER
rm -f RUN-1/.waiting-on-user           # Stage E step 3's cleanup, "on the user's answer"
scripts/runs-status.sh <root>          # NEXT = REMOUNT again — .err is untouched, still opens with launch:
```
This shows the run mechanically returns to the exact REMOUNT state it started from, with the same `.err`, once the escalation marker is cleared — nothing in the runbook advances it past that point. At best this is an indefinite re-ask loop; at worst, an agent resolving the ambiguity by analogy to the neighboring branch could call Stage C step 3 (fresh launch, truncating `>` redirect) on what was actually a refused **resume**, silently discarding that thread's `coachman-leg-<n>-events.jsonl` history and abandoning a possibly-live, resumable thread with no instruction to reconcile `coachman.legs.<n>.thread_id`.

Secondary, lower-confidence note, same defect class: the neighboring "wall while already on the fallback" clause (`postmaster.md:180-181`, "...when the wall goes to the user.") has the identical gap and, in this round, also lost the explicit "(Stage E step 3)" citation the other two branches keep (compare `git diff 86dcdfb b4b1199` on this hunk). This exact gap already existed at `86dcdfb` (round 3's starting snapshot), so I'm not counting it as newly introduced by `b4b1199` — flagging it only because it sits in the same sentence the fix touched and shares the exact root cause as Finding 1.

**Finding 2 — P3 — `launch.sh`'s exit-1 documentation wasn't updated for this round's new refusal reasons**
File: `scripts/launch.sh:26-29`
Confidence: high. Verified by reading.

Code:
```
#   exit 1  usage, config missing or unreadable, unknown name, a leg that is not synthesis,
#           review or ship, the coachman launched or resumed with no --leg, a coachman or
#           fallback on a lane's model, harness not on PATH, env_file missing, or a form this
#           script does not have (muse; agy resume)
```
The env_file refusal at `launch.sh:233` now fires on "not found **or not readable**," but the header still says only "env_file missing." The header also never mentions the new `prompt_text()` refusal ("prompt file missing, unreadable or empty," `launch.sh:237`) at all, even though that's a brand-new exit-1 reason this round added. Minor — it doesn't change behavior — but it's directly adjacent to the lines this round's fix touched, and finding #7 was specifically about this header being accurate.

Reproduction: `sed -n '26,29p;233p;236,238p' scripts/launch.sh` and compare; or run `./scripts/launch.sh launch coachman "$wt" /path/to/empty-file --leg review` against any config and observe the exit-1 message doesn't match any phrase in the header's exit-1 legend.

No other new holes found in the diff's remaining surface (env_file `~`-expansion, `base()` regex anchoring/ReDoS, `stage.sh`'s exit-4 code path, the takeover's stream-move interacting with `.err` truncation, and the interrupted-round retry's SNAP reuse were all checked and hold up).
