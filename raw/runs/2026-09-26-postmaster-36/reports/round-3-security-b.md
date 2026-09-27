# Round 3, security lens — pull request #39 at `86dcdfb`

## Part 1: Closure

1. **closed** — `ENV_FILE` sourcing moved to `scripts/launch.sh:305`, after `cmd` is built and after `cd`/stdin are set (:301, :303). Self-test `an env file cannot put the coachman on another model` and `a lane's env file reaches the harness's environment` pass — verified by execution. (The relocation opens a distinct new issue: Finding 1 below.)
2. **closed** — new pre-check loop in `coachman.md` Stage 2 step 2 compares `git rev-parse HEAD` in every scratch against `$SNAP` and exits 1 with "nothing launched" before any lane starts. Verified by reading.
3. **closed** — `launch.sh`'s argument parsing now goes through `die()` (e.g. `[ $# -ge 2 ] || die "usage: ..."`, `[ -n "$THREAD" ] || die "resume needs a thread id..."`); self-tests `a resume with no thread id is refused, and nothing runs` and `an argument launch.sh does not know is refused` pass — verified by execution. REMOUNT's "no thread id anywhere → user" text is in `postmaster.md`'s REMOUNT bullet — verified by reading.
4. **closed** for the case round 2 reported (single suffix): self-test `a leg entry on a lane's model with a bracketed suffix is refused` passes — verified by execution. Incomplete: see Finding 2.
5. **closed** — `coachman.md` Stage 2 launch block now does `rm -f <dispatch>/logs/review-r<round>-*.done` once before the per-lane loop, replacing the old per-lane unquoted `rm -f`. Verified by reading the diff.
6. **closed** — `STDIN_FILE=""` initialised at `scripts/launch.sh:142`; self-test `a STDIN_FILE from the environment is not used` passes — verified by execution.
7. **closed** — `not_a_lane` now short-circuits on `spec.get("model")` before indexing `spec["model"]`, and `lane_models` excludes model-less lanes (`scripts/launch.sh:175-177`); self-test `a coachman with no model is refused by name` passes — verified by execution (confirmed by reading `ad786ec` that the old code's unguarded `spec["model"]` is what raised `KeyError`).
8. **closed** — `.waiting-on-user` ranks ahead of RULE/GATE/DISPATCH/REMOUNT in `runs-status.sh:58-65`; `postmaster.md` touches/clears it at Stage E step 3 and Stage F step 2. Self-tests `a run waiting on the user is USER, whatever else it holds` and `a ship card put to the user waits on the user, not the gate` pass — verified by execution for the script; the touch/clear steps are prose — verified by reading. Residual gap noted as Finding 3.
9. **closed** — `coachman.md` Stage 2 now reads "a round past the cap runs only when the ruling says so." Verified by reading.
10. **closed** — `coachman.md` hard rules: "When it refuses with exit 3 ... log a `note` quoting the refusal, change nothing more, and exit." Verified by reading.
11. **closed** — self-test fixtures `coachlane`/`fblane`: `team.coachman on a lane's model is refused` and `the fallback on a lane's model is refused` pass — verified by execution. Same completeness caveat as #4 (shared code path, Finding 2).
12. **closed** — self-test `a parse error names the file and where it breaks` checks the specific `"launch: cannot read $tmp/dup.toml: "` text, distinguishing the Python catch from the shell's generic fallback — verified by execution.
13. **closed** — `postmaster.md` Stage B step 2 now also runs `scripts/launch.sh form <lane>` for every lane in `team.workhorses` and `team.reviewers`. Verified by reading.
14. **closed** — `coachman.md` action list: "`apply` per fix (target its commit, detail the findings it fixes)." Verified by reading.
15. **closed** — `wiki/concepts/review-loop.md` heading now reads "Each round's fixes are re-reviewed by both gating lenses." Verified by reading.
16. **closed** — `postmaster.md` Stage C step 2 now reads "From leg 2 on, verify the hand-off before dispatching on it." Verified by reading.
17. **closed** — `postmaster.md` Stage F step 2 states `.card-ready` is removed before any word is delivered, as the lead sentence ahead of all three branches (postmaster-granted, postmaster-withheld, user). Verified by reading.
18. **closed** — `coachman.md` Stage 2 step 1 now runs `git -C <repo> worktree prune`, then per scratch: if it exists, diffs it, logs "LEFT BEHIND AND MODIFIED", and force-removes it before `cut-scratch.sh` re-cuts. Verified by reading.
19. **closed** — `scripts/launch.sh:192-193`, `if not v.get("harness") or not v.get("model"): die(...)` for every `[team.coachman_legs]` entry; self-test `a leg entry with no harness or model is refused` (emptyleg fixture) passes — verified by execution.
20. **closed** — `unset HARNESS MODEL EFFORT ENV_FILE` removed; confirmed by reading that the Python side unconditionally prints all four `KEY=value` lines on every success path (`scripts/launch.sh:207-208`), and the only path that skips them (`die()`) already exits before those variables are checked, so the `unset` was dead code with no control ever exercising it.
21. **closed** — `postmaster.md`: resume prompts now named `leg-<n>-resume-<time>.txt`, `<time>` from `date -u +%Y%m%dT%H%M%SZ`. Verified by reading.
22. **closed** — `postmaster.md` takeover paragraph: "Read the new thread id from the events the takeover appended..." Verified by reading.

No disagreement with the "not changed" or "deferred" dispositions; not re-reported.

## Part 2: Findings

### Finding 1 — P1: `env_file`'s existence check and its sourcing resolve a relative path against two different directories

`scripts/launch.sh:215-218` (check) vs. `:301` and `:305` (use):
```
215:if [ -n "${ENV_FILE:-}" ]; then
216:  ENV_FILE=${ENV_FILE/#\~/$HOME}
217:  [ -f "$ENV_FILE" ] || die "env_file for $NAME not found: $ENV_FILE"
218:fi
...
301:cd "$CWD" || die "cannot enter $CWD"
...
305:if [ -n "${ENV_FILE:-}" ]; then set -a; . "$ENV_FILE"; set +a; fi
```
The existence check runs before `cd "$CWD"`, so a relative `env_file` is validated against the *invoking* process's directory. The actual sourcing (the round-3 fix's relocation, for finding #1) now runs after `cd "$CWD"`, so a relative `env_file` is *read* from the launch target's directory instead. Confidence: high. Verified by execution — reproduced end to end with a stub harness:
```
config: env_file = "sneaky.env"
invoke_dir/sneaky.env:  PROBE=legit-from-invoke-dir
wt/sneaky.env:          PROBE=PWNED-from-lane-worktree
$ (cd invoke_dir && ... launch.sh launch coachman "$wt" prompt.txt --leg review)
ARGS: ... PROBE=PWNED-from-lane-worktree
```
The check passed against `invoke_dir`'s (legitimate) file; the harness's environment was populated from `$wt`'s (hostile) file instead.

Exploit path: the `env_file` *value* is only ever written by `scripts/setup.sh` into `~/.postmaster/config.toml` (confirmed: no other script in `scripts/` writes that file), interactively, by the operator — so it isn't ticket-reachable directly. But `setup.sh`'s prompt for a lane's `env_file` ("env file for an alternate backend (blank if none)") gives no example and defaults to blank, unlike the tracker's `plane.env_file` prompt, which shows the `~/...`-anchored default — a relative value is a plausible operator slip, not a contrived one. Once one role's `env_file` is relative, whoever can place a same-named file in that role's launch `$CWD` controls what gets sourced: for a workhorse or reviewer lane, `$CWD` is its own worktree, checked out from the ticket's branch — content the ticket, an earlier leg, or the lane itself can write. Because `. "$ENV_FILE"` executes the file as shell, not just `KEY=value` pairs, the payoff is arbitrary shell execution in the coachman/postmaster's own process, at the privilege of whoever runs `launch.sh` — a lane escaping its blinkers, not merely an overridden environment variable.

### Finding 2 — P2: the lane-model guard strips only one bracket suffix

`scripts/launch.sh:173-178`:
```
173:def base(model):  # a model id without its bracketed suffix: same[1m] is same
174:    return re.sub(r"\[[^\]]*\]$", "", str(model))
175:lane_models = {base(v["model"]) for v in lanes.values() if isinstance(v, dict) and v.get("model")}
...
177:    if isinstance(spec, dict) and spec.get("model") and base(spec["model"]) in lane_models:
178:        die("%s in %s runs on %s, a lane's model, and a coachman never does" % (what, path, spec["model"]))
```
Confidence: high. Verified by execution: with `[lanes.one]` model `"lane-model"` and `team.coachman` model `"lane-model[1m]"`, `form` is refused ("a lane's model") — matches round 2's fix. With `team.coachman` model `"lane-model[1m][2m]"` instead, `form coachman --leg review` exits 0 and prints a command running `--model lane-model[1m][2m]` — same base model as the lane, un-refused.

Exploit path: `not_a_lane` is the one guard shared by `team.coachman`, every `[team.coachman_legs]` entry, and `team.coachman_fallback` (round 2 findings #4 and #11), so the gap reaches all three. It requires authorship of `~/.postmaster/config.toml`, not ticket content, so it isn't attacker-reachable — it's a gap in a safety invariant the project relies on (a coachman must never be, in effect, one of the models it judges and gates merges for), defeatable by anyone who can edit the local config, or by a future automated writer that appends a second annotation to a model id that already carries one.

### Finding 3 — P3: `.waiting-on-user` outranks every staleness check, with no recovery signal if the hand-off to the user is lost

`scripts/runs-status.sh:59-65`:
```
59:    if stage in ("done", "abandoned"): nxt = "-"
60:    elif ".waiting-on-user" in markers: nxt = "USER"
61:    elif ".escalation-ready" in markers: nxt = "RULE"
...
65:    elif idle_min >= 30: nxt = "INSPECT"
```
Confidence: medium. Verified by reading — the self-test only checks the marker's precedence (`run user review 2 .waiting-on-user .leg-2-exited` → `USER`), never its precedence against staleness (no test ages a USER run past 30 minutes). Exploit path: not attacker-triggered. "Touch `.waiting-on-user`" and "tell the user in the session" are two separate, non-atomic prose steps (`postmaster.md` Stage E step 3, Stage F step 2); a crash or dropped session between them leaves a run reporting USER indefinitely, and — unlike plain WAIT, which INSPECT surfaces after 30 idle minutes — nothing ever flags it as stale to the operator polling `runs-status.sh`. A monitoring gap, not code execution or data exposure.

---

Verification notes: all execution-based checks were run against the `86dcdfb`-detached scratch at `[repo]/.worktrees/parallel-review-rev-security-[b]` (`launch.sh --self-test`, plus two hand-built fixtures in separate `mktemp -d` directories, per the brief). No file under review was modified, committed, or pushed.
