No further tool calls are needed; everything below is from the reads and runs above.

# Review round 3, security lens: PR #39 at `86dcdfb`

Scratch: `[repo]/.worktrees/parallel-review-rev-security-[a]`, detached at `86dcdfb`, clean. All five self-tests (`launch.sh`, `runs-status.sh`, `stage.sh`, `run-meta.sh`, `run-log.sh`) pass at the snapshot. Nothing under review was modified; probes ran on copies under `mktemp -d`.

## 1. Closure of round 2's fixed findings

1. **closed.** `scripts/launch.sh:301-306`: `cd`, then `exec < "$STDIN_FILE"`, then `set -a; . "$ENV_FILE"; set +a`, then `exec "${cmd[@]}"` on an already-built array. Controls at :104 and :122. Verified by execution: reverting the order on a copy (M1) fails both controls. See P3-1 for what sourcing still allows.
2. **closed.** `skills/postmaster/coachman.md:448-454` checks every scratch's `rev-parse HEAD` against `SNAP` and `exit 1`s before any `rm` or launch. By reading.
3. **closed.** `launch.sh:139-152` defines `die` first and routes `$#`, `--leg`, `--last`, arg counts (:221-226) and the empty thread id (:228) through it; controls :126-127; M6 fails the right control. `postmaster.md:171-176` sends a leg with no thread id to the user. But the rewrite dropped the `launch:` clause and opened P2-1.
4. **closed.** `launch.sh:173-178` `base()` strips `\[[^\]]*\]$` on both sides; control :117; M2 fails it. By execution.
5. **closed.** `coachman.md:455` `rm -f <dispatch>/logs/review-r<round>-*.done` once, before the launch loop at :457-465; the per-lane `rm` is gone. By reading. See P2-3 for the case it does not cover.
6. **closed.** `launch.sh:142` `STDIN_FILE=""`; control :124; M3 fails it (and, without the init, `set -u` kills every non-pi launch at :303). By execution.
7. **closed.** `launch.sh:212-213` refuse by name; control :121; M5 fails it. By execution.
8. **closed.** `postmaster.md:165, 211-214, 236-237`; `runs-status.sh:49, 61`; controls :131, :136-137. By execution. See P3-2.
9. **closed.** `coachman.md:542-545` "a round past the cap runs only when the ruling says so". By reading.
10. **closed.** `coachman.md:691-694`. By reading. See P3-3 for the two cases it conflates.
11. **closed.** `launch.sh:118-119` (fixtures :63-64) refuse `team.coachman` and the fallback on a lane's model. By execution.
12. **closed.** `launch.sh:116` expects `launch: cannot read <file>: ` (the Python catch); the shell fallback at :210 reads `cannot read the config at`. By execution.
13. **closed.** `postmaster.md:84-88` runs `form <lane>` for every workhorse and reviewer. By reading.
14. **closed.** `coachman.md:59` "`apply` per fix (target its commit...)". By reading.
15. **closed.** `wiki/concepts/review-loop.md:23`. By reading.
16. **closed.** `postmaster.md:121` "From leg 2 on". By reading.
17. **closed.** `postmaster.md:230-231`: `.card-ready` removed before any word is delivered. By reading.
18. **closed** as stated. `coachman.md:418-427` prunes, checks and removes a left-behind scratch. By reading. It opened P2-3.
19. **closed.** `launch.sh:190-194`; control :120; M4 fails it. By execution.
20. **closed.** `launch.sh:207-208` always prints all four assignments, so the `eval` overwrites any outer value. By execution: `ENV_FILE=<file> HARNESS=pi MODEL=env-model EFFORT=x launch one` ran the stub on `lane-model` with the probe variable unset.
21. **closed.** `postmaster.md:139-141, 146`. By reading.
22. **closed.** `postmaster.md:193-196`. By reading. When the takeover itself is refused nothing is appended and no new id exists; P2-1 then applies.

## 2. Findings, most severe first

### P2-1. A resume that `launch.sh` refuses is resumed at every poll, forever (new in `86dcdfb`)

`skills/postmaster/postmaster.md:171-179`:

> A leg with no thread id, none in its stream and none in `coachman.legs.<n>`, never started: its `.err` goes to the user ... A quota or provider wall, quoted, means ... relaunch the leg on the fallback ... Anything else is a spent thread: remount it by resuming the leg (Stage C) ...

At `ad786ec:168-171` the rule had "A `launch:` line in the `.err` is a refusal ... it goes to the user ... and nothing is relaunched." `86dcdfb` removed that clause. A leg that already has a thread id whose *resume* is refused (`launch: env_file for coachman not found`, `launch: harness 'claude' is not on PATH`, a config that stops parsing, a leg entry that no longer passes) is neither "no thread id" nor a wall, so it is "anything else": the postmaster resumes it, `launch.sh` refuses again in under a second, the wrapper touches `.leg-<n>-exited`, the next poll says REMOUNT, and so on every `poll_seconds`, each cycle a `resume` ledger line and a `leg-<n>-resume-<time>.txt`. It never reaches the user, and the run reads as alive (idle 0 m, files moving). The takeover path has the same shape when `launch coachman_fallback` is refused.

Verified by execution (preconditions): with a fixture config, `form coachman --leg review` exits 0; after removing the env file, `resume coachman <wt> T-1 <prompt> --leg review` prints `launch: env_file for coachman not found: ...` and exits 1; the same with the harness off PATH; a dispatch dir with `coachman.legs.2.thread_id` set and `.leg-2-exited` present reads `REMOUNT`. The loop itself is the runbook's prose, by reading. Confidence: high.

Exploit path: whoever can make `launch.sh` refuse at resume time controls it. That is the user editing `~/.postmaster/config.toml` or rotating a lane's env file mid-run, a harness update leaving PATH, or any lane, since lanes run as the user with every permission bypass and the config path is in `run.json`. What they get: the leg is never remounted and never escalated, and the postmaster burns its poll on it indefinitely. Deferred #46 (a resume reads the live config) is the trigger; this finding is the rule's shape once refused, and is separate. The bug lens is likely to see this too.

### P2-2. The relaunch after a never-started leg leaves a stale `.leg-<n>-exited`, and REMOUNT then resumes a live leg (new path)

`postmaster.md:174`: "on their answer the leg is launched again (Stage C step 3)". Step 3 (:126-132) is:

```sh
( scripts/launch.sh launch coachman ... > <dispatch>/logs/coachman-leg-<n>-events.jsonl 2> ...;
  touch <dispatch>/.leg-<n>-exited ) &
```

Only step 5's resume wrapper clears the marker (:145 `rm -f <dispatch>/.leg-<n>-exited`). After a REMOUNT went to the user and the leg is relaunched through step 3, the first wrapper's marker is still there. `runs-status.sh:65` reads the marker, not the process, so the next poll says REMOUNT while the leg is live; the stream now holds a thread id, no wall is quoted, so :177-179 resumes the live thread. Two coachman processes then hold one thread and one synthesis worktree, and whichever exits first lies about the other through the same marker.

Verified by execution for the poll: a run with `.leg-2-exited`, fresh files (idle 0 m) and a thread id reads `REMOUNT`; the poll cannot distinguish "exited" from "a process is writing". The relaunch path is by reading. Confidence: high that the runbook produces a second process; medium on what each harness does when two processes resume one session.

Exploit path: a stale marker from this path, or a forged `.leg-<n>-exited` from any process with write access to `<dispatch>`, makes the postmaster start a second coachman on a live leg. What they get: two writers to one worktree and one events stream; the record for the leg is no longer one thread's.

### P2-3. Re-running an interrupted round over a still-running lane ends the wait early and merges two attempts into one stream (opened by the #18 fix)

`coachman.md:423-427` now removes a left-behind scratch with `git worktree remove --force` and re-cuts it, :455 clears the round's markers once, :460-462 launches each wrapper with `>` on the same `review-r<round>-<lens>-<lane>.jsonl`, and :466 waits for `N` markers. Nothing checks whether the first attempt's wrappers are still alive (`grep -i 'pid\|pgrep\|kill -0\|alive'` finds no step; :663-664 says nothing is killed in a standard run). Before this fix the re-run failed at `worktree add` on every scratch, which by accident prevented this.

Verified by execution, with the real `scripts/wait-for-markers.sh`: an "old" wrapper writing for 4 s, a re-run at t=1 that clears markers and launches a "new" wrapper for 25 s with N=1. The wait returned at 20 s with the new lane still running (`kill -0` true); the old lane's marker ended it. The file the coachman would harvest read `NEW-1 / OLD-2 / OLD-3`, two of three lines from the superseded attempt; after both exited it read `NEW-1 / NEW-2 / OLD-3`. Confidence: high.

Exploit path: no attacker is needed. The trigger is the deferred #48: a claude coachman's background command is reaped at about 29 minutes and the wait is 2400 s, so round 1 with every lane under every lens will be interrupted on ordinary tickets. What the run gets: a round that reports complete with a lane still reviewing, a lane's stream that carries another process's lines, the old scratch force-removed under a live lane, and any write that lane makes by absolute path landing in the new scratch and charged to the new lane by the post-round `git diff --name-only` check. That is a review that looks complete and is not. #48 is deferred and unchanged; this finding is what the re-run procedure introduced in `86dcdfb` does when the interruption comes, and needs a step (kill or wait out the first attempt's wrappers, by pid or working directory, before re-cutting).

### P3-1. The env file is still executed as shell, so it can replace the command, the directory and the binary; the header claims more than the mechanism gives

`launch.sh:16-18`: "a lane's env file is loaded last, into the harness's environment only, once the command is built." `launch.sh:305`: `if [ -n "${ENV_FILE:-}" ]; then set -a; . "$ENV_FILE"; set +a; fi`, followed by `exec "${cmd[@]}"`.

Verified by execution against a stub harness: an env file holding `cmd=(/bin/echo HIJACKED-BY-ENV-FILE)` ran `echo` and no harness, exit 0; `cd /` ran the harness with `pwd=/` instead of the worktree; `PATH=<dir>:$PATH` ran a different `claude` than `command -v` had checked at :214. The round-2 vectors (MODEL, HARNESS, STDIN_FILE, the prompt, cwd as variables) are closed. Confidence: high.

Exploit path: whoever writes `~/.postmaster/lanes/<lane>.env`. Normally the user; also anything running as the user, a lane included. What they get: arbitrary shell in every later launch of that lane, and a reviewer placed in the synthesis worktree rather than its scratch, which is the one containment the flow has. This is the same principal that owns the config and the scripts, hence P3, but the header should say "sourced as shell" or the script should read `KEY=VALUE` lines (or source in a subshell and pass only the resulting environment to `exec`).

### P3-2. `.waiting-on-user` has no provenance, masks every other state, and is never surfaced as stale

`runs-status.sh:61` `elif ".waiting-on-user" in markers: nxt = "USER"` comes before RULE, GATE, DISPATCH, REMOUNT and INSPECT (:67). `postmaster.md:165`: "Nothing to do until they answer." The marker is named nowhere in `coachman.md`, `SKILL.md` or `harnesses.md`. In the Stage F path (:235-237) nothing on disk says what the run waits on; in Stage E (:209-214) the question goes to `<runs>/postmaster/ESCALATION.md`, one file for every run, so a second run's question overwrites the first's.

Verified by execution: a run with `.leg-2-exited` and `.waiting-on-user` whose files were last touched two hours ago reads `USER`, not `INSPECT` or `REMOUNT`. Confidence: high.

Exploit path: any process with write access to `<dispatch>` (the coachman by design, any lane, since a reviewer's prompt names the dispatch path) touches one empty file. What they get: the postmaster stops acting on that run indefinitely, and a postmaster restarted from the disk cannot tell a genuine wait from a stale or forged one, since the question is not recorded per run. A per-run question file (or a ledger line the poll checks for) and an idle threshold on USER would close it.

### P3-3. The coachman reads every `stage.sh` exit 3 as the postmaster's closure, and a hand-edited manifest makes a run vanish looking closed

`coachman.md:691-694`: "When it refuses with exit 3, the postmaster has closed or abandoned the run: log a `note` quoting the refusal, change nothing more, and exit." `stage.sh:30` exits 3 with "only the postmaster sets done" when the coachman itself asks for a terminal stage; :43-44/:66 exit 3 with "the run is done; only the postmaster moves it on" when the manifest already says so.

Verified by execution: case (a) the coachman calling `stage.sh <d> done` gets exit 3 and the first message, nothing logged; case (c) writing `"stage": "done"` into `manifest.json` by hand, then any coachman stage change, gets exit 3 and the second message, and `runs-status.sh` reports `-` for the run. Confidence: high.

Exploit path: any process with write access to `<dispatch>/manifest.json` sets the field. What they get: the postmaster never acts on the run again (`-`), the coachman exits on its next stage change with no hand-off and no escalation, and `stage.sh <d> done postmaster` later says "already done". The "not changed" disposition (the actor is the caller's word) covers who calls; this is the manifest field and the new instruction to stop on it. The rule could key on the second message, and case (a) is the coachman's own mistake, not a closure.

### P3-4. An unreadable or empty prompt file launches a non-pi harness with an empty prompt, exit 0

`launch.sh:225` and `:229`: `[ -f "$PROMPT" ] || die "no such prompt file: $PROMPT"; PTEXT=$(cat "$PROMPT")`, with `cat`'s exit unchecked (no `set -e`).

Verified by execution: a claude lane with a `chmod 000` prompt file printed `cat: ... Permission denied` and then ran the stub with `-p ""`, exit 0; an empty file did the same. The pi branch is caught, since `exec < "$STDIN_FILE" || die` at :303 does run (bash continues after a failed `exec` redirection outside POSIX mode; also verified). Confidence: high. The line predates the PR; the `launch)` case around it was rewritten in `86dcdfb`.

Exploit path: a prompt file the postmaster or coachman wrote badly. What the run gets: a leg or lane that starts, mints a thread id, and never read its brief; REMOUNT then treats it as a spent thread and resumes a coachman with "Continue leg <n>" that has no idea what leg it is.

## Checked and clean

- Outer `HARNESS`, `MODEL`, `EFFORT`, `ENV_FILE` and `STDIN_FILE` are ignored (execution). `eval "$spec"` consumes only `shlex.quote`d output, including `die` messages that carry the config path.
- The round-3 diff adds nothing that reaches a public record: no ticket, wiki-publishing or `raw/` change; the ticket comment's review link, paths and thread ids (`coachman.md` stage 3) are unchanged from `main`, only renumbered.
- The marker glob `review-r1-*.done` cannot match round 10's markers; `.*-ready` cannot match `.waiting-on-user`.
- The bracket-suffix rule does not equate one model under two harness id forms (a `provider/model` id under pi against the bare id under claude). That is a limit of comparing ids per harness, not new, and not a finding.

Mutation copies and probe fixtures are in `[tmp]`, `[tmp]`, `[tmp]`, `[tmp]`, `[tmp]`, `[tmp]`; the guard hook refused their removal, so they are left for the user.
