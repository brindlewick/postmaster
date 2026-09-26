# Review round 3, bug lens: PR #39 at `86dcdfb`

All three self-tests pass at the snapshot (`launch.sh`, `runs-status.sh`, `stage.sh`), and `wiki-lint.sh` exits 0. I mutation-tested every control added in `86dcdfb` (copies in a `mktemp -d` dir, one check removed per copy): each control fails, and fails for its own reason, when the check it guards is removed. Details under Test adequacy at the end. Nothing under review was modified.

## Part 1: closure of round 2's fixed findings

1. **closed** (execution): `launch.sh:304-306` sources `ENV_FILE` after `cmd` is built, after `cd "$CWD"` and after `exec < "$STDIN_FILE"`. Controls "an env file cannot put the coachman on another model" and "a lane's env file reaches the harness's environment" pass; moving the sourcing back to line 217 makes both fail. See finding 3 for a regression this opened.
2. **closed** (reading): `coachman.md:448-454` checks every scratch's `rev-parse HEAD` against `SNAP` and `exit 1`s with "nothing launched" before the marker rm and the launch loop.
3. **closed** (execution + reading): every argument error goes through `die` (`launch.sh:139-150, 221-230`); `launch.sh` with one argument, `--leg=review`, an empty thread id and a missing resume argument all print a `launch:` line and exit 1. `postmaster.md:172-174` sends a leg with no thread id to the user. But the fix dropped the `launch:`-line rule, which opens finding 2 below.
4. **closed** (execution): `base()` at `launch.sh:173-174`; the `suffix` control fails when `base` is made the identity.
5. **closed** (reading): one `rm -f <dispatch>/logs/review-r<round>-*.done` at `coachman.md:455`, before the launch loop; the per-lane unquoted rm is gone.
6. **closed** (execution): `STDIN_FILE=""` at `launch.sh:142`; removing it makes "a STDIN_FILE from the environment is not used" fail (with five collateral `set -u` failures).
7. **closed** (execution): `bare` control passes and the message is "coachman has no model in the config" (`launch.sh:213`). Reverting both halves (`lane_models` filter and `spec.get("model") and`) brings the traceback back and the control fails. Reverting only `not_a_lane` does not fail it, because the `lane_models` filter alone already prevents the `KeyError`; that is two independent guards, not a gap.
8. **closed** (execution + reading): `runs-status.sh:49, 61` glob and rank `.waiting-on-user` above RULE; `postmaster.md:211-214, 235-237` touch and remove it. Controls `user`, `usergate`, `userclosed` pass and fail under the R1-R4 mutations. See finding 7 for what is still missing on disk.
9. **closed** (reading): `coachman.md:543-544` "a round past the cap runs only when the ruling says so".
10. **closed** (reading): `coachman.md:692-694`. See finding 5: exit 3 has two causes and the sentence names one.
11. **closed** (execution): `coachlane` and `fblane` controls; removing `launch.sh:195` or `:199` makes the matching control fail.
12. **closed** (execution): the control wants `launch: cannot read <path>: `; narrowing the except to `OSError` produces the fallback "cannot read the config at <path>" and the control fails.
13. **closed** (reading): `postmaster.md:84-88` adds `form <lane>` for every lane in `team.workhorses` and `team.reviewers`.
14. **closed** (reading): `coachman.md:59` "`apply` per fix (target its commit, ...)".
15. **closed** (reading): `wiki/concepts/review-loop.md:23`.
16. **closed** (reading): `postmaster.md:121` "From leg 2 on".
17. **closed** (reading): `postmaster.md:230-231`; Stage F is now three steps and no reference to a fourth remains anywhere (grepped).
18. **closed** (reading): `coachman.md:418, 423-426`: prune first, a present `$DEST` is diffed and removed before the cut. See finding 4 for the check's blind spot.
19. **closed** (execution): `emptyleg` control; removing `launch.sh:192-193` makes it fall through to `team.coachman` and the control fails.
20. **closed** (execution): `unset` is gone; `launch.sh:207-208` always prints all four assignments. Spot check: `HARNESS=nope MODEL=env-model EFFORT=zzz ENV_FILE=/nope/x.env launch.sh form one` on a valid config prints `--model lane-model` with no effort and no env-file refusal.
21. **closed** (reading): `postmaster.md:140-141`.
22. **closed** (reading): `postmaster.md:195-196`.

## Part 2: findings, most severe first

### 1. P1: relaunching a never-started leg leaves its stale `.leg-<n>-exited`, so the next poll remounts a running leg

`skills/postmaster/postmaster.md:172-174` (REMOUNT) and `:126-132` (Stage C step 3). Confidence high. Verified by reading (the runbook) and execution (`runs-status.sh` on the resulting marker state).

```
A leg with no thread id, none in its stream and none in `coachman.legs.<n>`, never started: its `.err` goes to the user (Stage E
step 3), and on their answer the leg is launched again (Stage C step 3).
```

Stage C step 3's wrapper is only `( scripts/launch.sh launch ... ; touch <dispatch>/.leg-<n>-exited ) &`; the `rm -f <dispatch>/.leg-<n>-exited` exists only in step 5 (`:145`). The first, refused launch already touched `.leg-<n>-exited`, and nothing in the never-started path or in step 3 removes it.

Reproduce: (1) a leg's launch is refused (any `launch:` line: missing prompt file, harness off PATH, worktree gone); the wrapper touches `.leg-2-exited`; (2) poll says REMOUNT; no thread id anywhere, so the postmaster touches `.waiting-on-user` and asks; (3) the user answers; the postmaster removes `.waiting-on-user` and relaunches via step 3; (4) `runs-status.sh` on `manifest {leg: 2}` plus the stale `.leg-2-exited` prints `REMOUNT` (executed: `T-9 review 2 .leg-2-exited 0m REMOUNT`); (5) the postmaster reads the new stream, finds a thread id, no wall, and follows "Anything else is a spent thread: remount it by resuming the leg": a second coachman is resumed onto a thread that is still running, in the same worktree, appending to the same events file. Fix: the relaunch goes through step 5's wrapper shape (rm the exited marker first), or step 3 gains the same `rm -f`.

### 2. P2: a refused resume is resumed again at every poll; the `launch:` signal was dropped from REMOUNT

`skills/postmaster/postmaster.md:171-179`. Confidence high. Verified by execution (the refusal's shape) and reading (the rule).

At `ad786ec` REMOUNT said "A `launch:` line in the `.err` is a refusal ... it goes to the user, and nothing is relaunched." At `86dcdfb` that sentence is replaced by the no-thread-id rule, so a `launch:` refusal of a *resume*, where the manifest does hold a thread id, matches no branch but the last:

```
Anything else is a spent thread: remount it
by resuming the leg (Stage C) with "Continue leg <n>; ..." as the prompt.
```

Reproduce: `launch.sh resume one <cwd> T-123 <prompt>` with a config whose `env_file` is missing prints `launch: env_file for one not found: ...`, exit 1, empty stdout (executed). The wrapper touches `.leg-<n>-exited`; poll says REMOUNT; thread id present, no wall quoted; the postmaster resumes; the same refusal; every `poll_seconds` a new `leg-<n>-resume-<time>.txt` and a `resume` log line, and the run never reaches the user. A concrete config that meets it and passes Stage B pre-flight: a coachman on `agy`. `launch.sh form coachman --leg synthesis|review|ship` all exit 0 for it, `launch` runs, and the first ruling, merge word or remount hits `launch: agy resume form is not recorded` (executed). `form` never exercises the resume branch, so pre-flight cannot catch it.

### 3. P2: an `env_file` given as a relative path passes the `-f` check, then fails to source after `cd`, and the harness launches without its backend

`scripts/launch.sh:215-218, 301, 305`. Confidence high on the mechanism; medium on how often a relative path is configured (the example and `setup.sh`'s prompt suggest `~/...`). Verified by execution, against `ad786ec`'s `launch.sh`.

```
if [ -n "${ENV_FILE:-}" ]; then
  ENV_FILE=${ENV_FILE/#\~/$HOME}
  [ -f "$ENV_FILE" ] || die "env_file for $NAME not found: $ENV_FILE"
fi
...
cd "$CWD" || die "cannot enter $CWD"
...
if [ -n "${ENV_FILE:-}" ]; then set -a; . "$ENV_FILE"; set +a; fi
exec "${cmd[@]}"
```

The check resolves against the caller's cwd, the sourcing against `$CWD`, and a failed `.` is not fatal. Reproduce: config `env_file = "sub/lane.env"`, run `launch.sh launch one <wt> <prompt>` from the directory holding `sub/`. At `86dcdfb`: `line 305: sub/lane.env: No such file or directory`, then the stub harness runs with `probe=unset`, exit 0. At `ad786ec`: `probe=reached`. So the lane runs on the default backend with a foreign model id and no key, and nothing in the record says so. The same non-fatal `.` also lets an unreadable file through (`chmod 000`: `-f` passes, "Permission denied", harness runs, exit 0; executed), which predates the fix. Resolving `ENV_FILE` to an absolute path at the check, as the pi branch does for `PROMPT` (`:233-236`), and `|| die` on the sourcing close both.

### 4. P2: the scratch integrity check reads `git diff --name-only`, which is blind to staged and committed modifications

`skills/postmaster/coachman.md:423-426` (new in `86dcdfb`) and `:495-500` (pre-existing wording, re-flowed here; also at `origin/main:452`). Confidence high. Verified by execution.

```
if [ -e "$DEST" ]; then
  git -C "$DEST" diff --name-only | sed "s|^|LEFT BEHIND AND MODIFIED, $DEST: |"
  git -C <repo> worktree remove --force "$DEST"
fi
```

Executed in a throwaway repo: after modifying a tracked file in a detached worktree, `diff --name-only` prints `f`; after `git add f` it prints nothing (`diff HEAD --name-only` still prints `f`); after `git commit` both print nothing and only `rev-parse HEAD` differs from the snapshot. The runbook names this check as the containment ("the disposable scratch plus the post-round integrity check is the containment", `:473-475`), and `worktree remove --force` then destroys the evidence. Reproduce: a reviewer lane runs a formatter or "fixes" the defect it found and stages or commits in its scratch; the harvest check prints nothing, the lane's verdict counts, and the modification is never logged. Fix: `git diff HEAD --name-only` plus `rev-parse HEAD` against the round's `SNAP` (the launch block at `:451` already has the latter), in both places.

### 5. P3: `stage.sh` exit 3 has two causes, and the new hard rule names only one

`skills/postmaster/coachman.md:692-694`; `scripts/stage.sh:30` and `:43-44, 66`. Confidence high. Verified by execution.

```
When it refuses
with exit 3, the postmaster has closed or abandoned the run: log a `note` quoting the refusal,
change nothing more, and exit.
```

Executed on a run in `review`: `stage.sh <d> done coachman` exits 3 with "only the postmaster sets done" and the run is still `review`; on a closed run, `stage.sh <d> shipping coachman` exits 3 with "the run is done; only the postmaster moves it on". A coachman that hits the first case and follows the rule literally exits a live leg with no hand-off, becomes spent, and is remounted. Distinguishing the two by message (or by exit code) in the rule closes it.

### 6. P3: `launch.sh`'s header says the env file is loaded last and, two sentences on, loaded first

`scripts/launch.sh:16-20`. Confidence high. Verified by reading.

```
# ... and a lane's env file is
# loaded last, into the harness's environment only, once the command is built. The events
# stream goes to stdout; the caller redirects and backgrounds. A lane's env_file, if set, is
# loaded first, so an alternate backend for a harness is an environment file outside this
```

The "loaded first" sentence is `ad786ec`'s and was not removed.

### 7. P3: a Stage F wait on the user leaves nothing on disk but the marker

`skills/postmaster/postmaster.md:235-237`; `scripts/runs-status.sh:34-36`. Confidence medium-high. Verified by reading.

```
`MERGE_AUTHORITY: user`: put the card, the review link and your verification in front of the
user, touch `.waiting-on-user`, and wait; when their word comes, remove `.waiting-on-user`
and deliver the word verbatim.
```

Stage E step 3 writes `<runs>/postmaster/ESCALATION.md` naming the run and the question, which is what the poll's header line reports; Stage F writes no file, so a postmaster restarted from `<runs>` ("Memory is the disk") sees USER on the run with no record of what was asked, and no `merge` line is logged until the word arrives. Related and pre-existing: two runs sent up at once share one `ESCALATION.md`, so the second overwrites the first while both carry `.waiting-on-user`. Stage D's USER entry (`:165`) also cites Stage E step 3 only.

## Test adequacy (executed, one mutation per copy of the script)

`launch.sh`: M1 no env sourcing, M2 except narrowed to `OSError`, M3 `base()` identity, M4 `team.coachman` unchecked, M5 fallback unchecked, M6 empty-leg check removed, M7 old `not_a_lane` plus old `lane_models`, M8 env sourced before the command is built, M9 `STDIN_FILE` uninitialised, M10 empty thread id accepted, M11 `-eq 2` to `-ge 2`. Each makes the control written for it fail (M8 and M9 also fail others, for the same underlying reason). `runs-status.sh`: R1-R14 removing or reordering each branch, the glob entry, the `postmaster` skip and the dotfile idle exclusion; each control fails with the wrong state named. Unmutated copies pass. The mutated copies live under `mktemp -d` paths only.

## Deferred and refuted items

Nothing above re-reports #45-#49 or round 1's standing items. Finding 2 touches the resume path but is about the runbook's routing of a refusal, not #45's codex flags or #46's config source.
