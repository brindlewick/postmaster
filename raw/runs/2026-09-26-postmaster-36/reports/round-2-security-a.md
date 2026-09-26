I have everything I need; no further tool calls. Here is the report.

# Review round 2, security lens: PR #39 at `ad786ec`

Scratch: `[repo]/.worktrees/parallel-review-rev-security-[a]`, detached at `ad786ec`, left unmodified. Probes ran in `mktemp -d` directories. Both `scripts/launch.sh --self-test` and `scripts/stage.sh --self-test` pass at `ad786ec` (executed). One probe of mine was refused by the guard hook for containing a recursive delete; I rewrote it with a rename and did not route around the hook.

## Part 1: closure

1. **closed.** `scripts/launch.sh:148-162`: `[team.coachman_legs]` is read and checked only under `if name == "coachman":`. Executed: self-test control "a lane launches on a config the coachman refuses" passes.
2. **closed for the refusals `launch.sh` prints itself.** `skills/postmaster/postmaster.md:84-87` runs `form coachman --leg <leg>` per leg and `form coachman_fallback` before dispatch; `:169-171` sends a `launch:` line in `.err` to the user (Stage E step 3). Executed: each refusing fixture exits 1 with a `launch:` line on stderr. Three launch failures carry no such line; see finding 3.
3. **closed.** `skills/postmaster/coachman.md:581-582` (the ship card "also lists every bug or security finding left open, with its lens and disposition"); `:122` routes them there from the hand-off. By reading.
4. **closed.** `coachman.md:493-495`: "A finding is gating or advisory by what it is, not by the lens that reported it". By reading.
5. **closed.** `coachman.md:527-530`: a ruling asking for a change gets another round, counted toward the cap. By reading.
6. **closed.** `scripts/stage.sh:42-43` and `:65` return 3 when a non-postmaster leaves `done`/`abandoned`. Executed: self-test "the coachman cannot move a run out of abandoned" passes. Residual: finding 4.
7. **closed.** `postmaster.md:189-192` (takeover through Stage C step 5's wrapper, `>>` on the stream and `2>` on `.err` at `:146`); `:172-173` (a wall on the fallback goes to the user). By reading. One residual, bug-adjacent: the appended stream now carries two session ids and `harnesses.md:126` says the id is on the first event, so "record the new thread id" at `:191` depends on the postmaster reading past the append point.
8. **closed.** `postmaster.md:120-124`: resume leg `n-1` via step 5 with `n-1`, the "Complete the hand-off and end the leg" prompt, wait for its done marker. By reading.
9. **closed.** `wiki/concepts/review-loop.md:14-15` ("unless the loop stops at its round cap"), `:50-52` ("The cap ends all review"); `wiki/index.md:42-44`. By reading.
10. **closed.** `launch.sh:126` (`unset HARNESS MODEL EFFORT ENV_FILE`), `:132-135` (`table`), `:136-139` (`cannot read`), `:143-147` (`not_a_lane`). Executed: self-test controls `onlane`, `notable`, `dup` (with `HARNESS`/`MODEL` in the environment) all refused. Residuals: findings 1, 5, 8.
11. **closed.** `coachman.md:402-409` writes the prompt once per round with a quoted heredoc; `:446` quotes `"$L"` and `"$DEST"`. By reading. (`$LENS`/`$L` at `:445,447-448` stay unquoted; they are the config's own TOML keys, so not a finding.)
12. **closed.** `coachman.md:445` clears each marker before its launch; `:438` "An interrupted round is re-run whole". By reading. Residual: finding 6.
13. **closed.** `coachman.md:512-513`. By reading.
14. **closed.** `coachman.md:57-59` (`finding` targets file:line, `apply` names the findings); `review-loop.md:66-67`. By reading.
15. **closed.** `launch.sh:83` (a real `launch` with `--leg synthesis` against the stub) and `stage.sh:120-122` (the postmaster abandons a run). Executed in the self-tests.
16. **closed, with a residual.** `coachman.md:424-426` chains `cut-scratch.sh && build || echo "SCRATCH BROKEN..."`. Executed: `cut-scratch.sh` exits 1 when `$DEST` is already a registered worktree (stale scratch in place, or registered with its directory moved away), so the assert trips. But the trip changes nothing downstream: finding 2.
17. **closed.** `postmaster.md:210` ("remove `.escalation-ready`, then resume"), `:231` ("Remove `.card-ready` before you deliver either word"). By reading.
18. **closed.** `postmaster.md:139` and `:145`: `<dispatch>/leg-<n>-resume-<k>.txt`. By reading.
19. **closed.** `launch.sh:121-122`. Executed: both "no --leg" self-test controls refused.
20. **closed.** `postmaster.md:140,144`: `rm -f <dispatch>/.leg-<n>-exited` before the resume. By reading.
21. **closed.** `coachman.md:594` (ship leg sets `shipped`), `:602-603` (leave it there; the postmaster sets `done`); `postmaster.md:244`; `stage.sh:29` refuses `done` from a coachman. Executed in the self-test.

## Part 2: findings, most severe first

### 1. P2. The env file is sourced into the script's own namespace after every check, so it can put a coachman on a lane's model, change the harness, or feed stdin, and the new refusal never fires

`scripts/launch.sh:181-185`, run after `not_a_lane`, `command -v` and the model check, and before the form is built at `:187-247`:

```sh
if [ -n "${ENV_FILE:-}" ]; then
  f=${ENV_FILE/#\~/$HOME}
  [ -f "$f" ] || die "env_file for $NAME not found: $f"
  set -a; . "$f"; set +a
fi
```

Verified by execution. With `coachman = { harness = "claude", model = "coach-model", env_file = ... }` and one lane on `lane-model`, an env file holding `MODEL=lane-model` gives:

- `form coachman --leg review` → exit 0, `--model lane-model`. So Stage B step 2's pre-flight (`postmaster.md:84-87`) passes.
- `launch coachman ...` → the stub harness received `--model lane-model`.
- `HARNESS=codex` / `CMD=resume` in the env file changed the harness branch and the command parsed (`CMD` is reassigned before `:188-195` reads `args`).
- `STDIN_FILE=/etc/hostname` in the env file → the claude form ends in `< /etc/hostname`.

The header at `:16-17` says "HARNESS, MODEL, EFFORT and ENV_FILE come from the config alone, never from the environment", and `run-meta.sh:11-12` records the config but never reads the env file, so `run.json` says `coach-model` while the coachman ran on `lane-model`. Confidence high.

Exploit path: whoever writes `~/.postmaster/lanes/<x>.env`: the user by accident (proxy `.env` examples commonly carry a `MODEL=` line; `harnesses.md:120-125` tells them to put the endpoint's documented variables there), or any lane or coachman process, which runs with permission bypass on the same account. They get a coachman on a lane's model or another harness, with the run's record saying otherwise, and the pre-flight check green. Fix shape: source the env file only into the harness's environment (just before `exec`, after `cmd` is built), or mark the script's own variables `readonly` before sourcing so a redefinition fails loudly.

### 2. P2. A stale scratch is caught by an echo and then launched into anyway, so a reviewer reviews the previous snapshot and the round looks complete

`coachman.md:424-426` (the cut block):

```sh
scripts/cut-scratch.sh <repo> <synthesis-wt> "$DEST" "$SNAP" \
  && ( cd "$DEST" && <project build command> >/dev/null 2>&1 ) \
  || echo "SCRATCH BROKEN: $DEST is not cut at $SNAP or does not build; fix before launching $L under $LENS"
```

and the launch block at `:440-453`, a separate command that launches into every `$DEST` with no condition. `scripts/cut-scratch.sh:23-24` swallows git's reason:

```sh
git -C "$REPO" worktree add --detach "$DEST" "$SNAP" >/dev/null 2>&1 \
  || { echo "cut-scratch: git could not create $DEST at $SNAP" >&2; exit 1; }
```

Verified by execution: a scratch cut at commit A, then `cut-scratch.sh` again at commit B into the same `$DEST` → exit 1, message names B, the scratch's HEAD is still A; git's own text (`already exists`) is hidden. The same when the scratch is registered but its directory has been moved away. Confidence high on the mechanism; the consequence needs the coachman to skip the echo, which nothing prevents.

Exploit path: a round whose scratches were not removed (the leg interrupted between harvest and `git worktree remove --force` at `:485-486`, then remounted), or a directory left behind by hand. The next round's reviewers open the old snapshot; a CLEAN, or a "not closed" on every fix, is recorded against the new one. Fix shape: the launch loop refuses a `$DEST` whose `git rev-parse HEAD` is not `$SNAP` (one line, mechanical), and `cut-scratch.sh` prints git's message.

### 3. P2 (shared with the bug lens). Three launch-time failures carry no `launch:` line, so REMOUNT resumes them, and a resume with no thread id fails the same way every poll

`postmaster.md:169-175`:

> A `launch:` line in the `.err` is a refusal, and the leg never started: it goes to the user ... Anything else is a spent thread: remount it by resuming the leg (Stage C) ...

Only `die()` at `launch.sh:120` prints that prefix. Verified by execution, stderr as printed:

- empty thread id, `resume coachman <wt> "" <prompt> --leg review` → `launch.sh: line 191: args[1]: resume needs <thread-id>`, exit 1 (from `${args[1]:?...}` at `:191`);
- harness on PATH whose interpreter is missing → `launch.sh: line 268: .../claude: cannot execute: required file not found`, exit 127 (`exec` at `:268`);
- harness exiting at once with its own error (an old CLI rejecting `--effort`) → `error: unknown option --effort`, exit 2.

None is a wall to quote, none is a `launch:` line, so each is "a spent thread". A launch that produced no stream leaves `coachman.legs.<n>.thread_id` empty, the resume is the first case above, the marker lands again, and REMOUNT repeats at every poll with nothing going to the user. The "anything else → resume" rule is on main (`origin/main` `postmaster.md:150-153`); what the fix added is the detector, and these shapes fall through it. Confidence high on the behaviours; medium on how often a run meets them (a harness upgrade or a broken install does).

Exploit path: the harness install or PATH, or an empty `thread_id` in the manifest. They get a run that has stopped while the poll keeps reporting REMOUNT. Fix shape: `launch.sh`'s own argument checks through `die` so they carry the prefix, and REMOUNT treating "no thread id recorded for this leg" as never-started (a mechanical condition, not text) and sending it to the user.

### 4. P3. The terminal-stage guard trusts a self-declared actor, so any caller can make a live run vanish from the poll

`scripts/stage.sh:93` `set_stage "$1" "$2" "${3:-coachman}"`, `:29` `done|abandoned) [ "$actor" = postmaster ] || ... return 3`, `:42-43` the same on leaving one. `scripts/runs-status.sh:55` `if stage in ("done", "abandoned"): nxt = "-"`.

Verified by execution: from a run at `review`, `stage.sh <d> done postmaster` → exit 0, the log line reads `"actor":"postmaster"`, `runs-status.sh` shows `done ... -`, and `stage.sh <d> review postmaster` moves it back. `log-action.sh:22` accepts any actor string too, so the ledger's actor column is a claim everywhere.

Exploit path: a coachman or lane process (same account, permission bypass) naming itself `postmaster`. It gets a run dropped from supervision, timings appended, and a record that cannot tell the call from the real one. In the same-user model nothing here is enforceable, so this is a guard against a coachman that follows the runbook, not a hostile one; the disposition may be to record that limit rather than fix it.

### 5. P3. The lane-model refusal is string equality, so the `[1m]` suffix the same repo documents as the same model slips past it

`launch.sh:144-147`:

```python
lane_models = {str(v.get("model")) for v in lanes.values() if isinstance(v, dict)}
def not_a_lane(spec, what):
    if isinstance(spec, dict) and str(spec.get("model")) in lane_models:
```

`config.example.toml:16-17` and `harnesses.md:123-125` say `[1m]` is a context-window hint on the same id. Verified by execution: lane `same-model[1m]`, coachman `same-model` → `form coachman --leg review` exit 0. Exploit path: the config author; they get a coachman on a lane's model with no refusal. Fix shape: compare with a trailing `[...]` stripped.

### 6. P3. The round's wait counts any marker of the round, so a stale marker of a lane not relaunched ends the wait early

`coachman.md:445` clears only the marker of each lane launched; `:452` waits on `'review-r<round>-*.done'` for `$N`; `wait-for-markers.sh:34` `while [ "$(count "$GLOB")" -lt "$COUNT" ]`. Verified by execution: with two stale `review-r2-*.done` files present and `N=2`, the wait returned `all 2 markers present` at once. The intended cover is `:438` "re-run whole"; the script does not enforce it. Exploit path: a re-run of an interrupted round with a smaller lane or lens set; the coachman harvests reviewers that have not finished. Fix shape: `rm -f <dispatch>/logs/review-r<round>-*.done` once before the launch loop.

### 7. P3. `STDIN_FILE` is never initialised, so a value in the caller's environment is fed to every non-pi harness's stdin

`launch.sh:111` initialises `LEG=""; LAST=""; args=()` but not `STDIN_FILE`; `:243` sets it only for pi; `:267` `[ -n "${STDIN_FILE:-}" ] && exec "${cmd[@]}" < "$STDIN_FILE"`. Verified by execution: `STDIN_FILE=/etc/hostname launch.sh form one` (a claude lane) prints the form ending `< /etc/hostname`, and a `launch` against a stub showed the stub reading that file's contents on stdin. `claude -p` reads piped stdin as input. Exploit path: whoever sets the coachman's or postmaster's environment (or the env file, finding 1); they get file content injected into a lane's input. Fix: `STDIN_FILE=""` beside `LEG=""`.

### 8. P3. A model-less coachman is refused with a traceback and the wrong message when a lane also lacks a model

`launch.sh:147` `spec["model"]` inside the message, after `str(spec.get("model"))` matched `'None'` from a model-less lane. Verified by execution: Python `KeyError: 'model'` on stderr, then `launch: cannot read the config at ...` instead of "has no model". Still a refusal, so no bypass; a wrong message from a new guard. Fix: `spec.get("model")` in the message.

## Checked and clean

- **Merge resolution `ad786ec`:** Stage B is renumbered 1-7 consistently; no file cites a Stage B step number; step 4's ownership sentence matches `coachman.md:25`; step 7 says stage 3; `wiki/log.md` keeps both entries, newest first. No security content.
- **Public record:** nothing in the PR adds a path, secret or target detail to a ticket comment, the wiki or `raw/`. `review-loop.md` carries only the issue link; `finding`/`apply` detail goes to `actions.jsonl`/`ledger.jsonl` under `~/.postmaster`; `run.json` names env files and never reads them (`run-meta.sh` self-test). The tracker comment's contents (`coachman.md:575-578`) are unchanged by the PR.
- **Quoting and eval:** every config value is `shlex.quote`d before `eval "$spec"` (`launch.sh:173-177`), and a Python crash cannot leak a partial spec (`&& [ -n "$spec" ] || die`). The reviewer prompt heredoc is quoted.
- **Word rule:** no "operator" or "human" in the PR diff.
- Not re-reported: the deferred (#45-#49), not-changed and refuted items in the brief; my finding 1 is distinct from #46 (live config versus `run.json`), being about the env file overriding the config after its checks.
