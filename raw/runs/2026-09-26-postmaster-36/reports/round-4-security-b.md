## Report: Round 4 security review, PR #39 at `b4b1199`

Scratch used: `[repo]/.worktrees/parallel-review-rev-security-[b]` (detached at `b4b1199`, confirmed clean, no edits made). Reproductions were built in a separate `mktemp`-free scratch under the session's own scratchpad dir and removed afterward; nothing was written outside that.

### Part 1: Closure of round 3's findings

1. **Closed.** `skills/postmaster/postmaster.md:130` and `:147` both now do `rm -f <dispatch>/.leg-<n>-exited` before backgrounding the launch/resume, so step 3 matches step 5. Verified by reading (no script covers this prose).
2. **Closed.** `skills/postmaster/postmaster.md:174-177` restores the `launch:`-prefix check; `scripts/launch.sh:154`'s `die()` prefixes every refusal with `launch: `, and it's the only stderr producer before `exec`. Verified by reading.
3. **Closed, verified by execution.** I ran `git show 86dcdfb:scripts/launch.sh` side by side with `b4b1199`'s copy against the same relative `env_file = "rel.env"` fixture, invoked from the lane's worktree as cwd (the realistic case). Old script printed `probe=worktree` (loaded the file from the worktree); new script printed `probe=config-dir` (loaded it from the config's directory) regardless of caller cwd. Also ran `scripts/launch.sh --self-test`: 36/36 controls pass, including the new relative-env-file and unreadable-env-file cases.
4. **Closed.** Both scratch-integrity checks (`skills/postmaster/coachman.md:425` and `:498`) now use `git -C <scratch> diff --name-only "$SNAP"`/`<SNAP>`, catching staged and committed changes, not just the working tree. Verified by reading.
5. **Closed, verified by execution.** Rebuilt a `[team.coachman_legs] review = { model = "lane-model[1m][2m]" }` fixture: old `launch.sh` (regex `\[[^\]]*\]$`) let it through (`form` printed a runnable command on the lane's model); new `launch.sh` (regex `(\[[^\]]*\])+$`) refuses it with "a lane's model". `--self-test` also passes the new `suffixes` case. Minor note: the new regex still doesn't strip a *nested* form like `model[[1m]]` (it no-ops instead of stripping), but since `config.toml` is user-authored and trusted, the failure mode is over-caution, not a bypass of the guard's intent — not treated as a new hole.
6. **Closed.** `scripts/stage.sh:21-22,31,67` splits the old overloaded exit 3 into 3 (run already closed) and 4 (non-postmaster tried to set a terminal stage). I grepped every `stage.sh` reference in the repo; the only caller that interprets an exit code, `skills/postmaster/coachman.md:695-697`, already reads "exit 3 means the postmaster closed/abandoned the run" — the correct new meaning — so it needed no update. `stage.sh --self-test` passes both split cases.
7. **Closed.** `scripts/launch.sh:16-23` header now accurately says the env file is shell, sourced last (after `cmd`, `CWD` and `STDIN_FILE` are fixed), resolved against the config's directory when relative, and the user's to write. Verified by reading; matches actual code order (env sourced at line 324, one line before `exec` at 325).
8. **Closed** for the stated bug (one escalation file serving every run). `postmaster.md:167-169, 215-219, 240-242` move the question into each run's own `.waiting-on-user`; `runs-status.sh` (untouched, still correct) already keys off a per-run marker file, so no cross-run bleed. See Finding 2 below for a smaller, new point this introduces.
9. **Closed, verified by execution.** `scripts/launch.sh:236-239` (`prompt_text()`) is invoked uniformly for `launch` and `resume`. Self-test cases "an empty prompt file is refused" and "an unreadable prompt file is refused" both pass (the latter genuinely exercised — this session doesn't run as root).
10. **Closed.** `postmaster.md:197-201` moves the pre-takeover stream to `coachman-leg-<n>-walled-events.jsonl` and launches the takeover through Stage C step 3's wrapper, which truncates (`>`) a fresh `coachman-leg-<n>-events.jsonl`. This makes "first event of the stream" (harnesses.md's convention for at least `claude`) unambiguous. Verified by reading; not independently executable without a real multi-turn harness.

Deferred/dismissed/standing items were not re-litigated; I didn't find b4b1199 disturbing any of them.

### Part 2: New findings

**P2 — REMOUNT's `launch:`-refusal branch has no stated recovery step when the refused attempt was a *resume*, only when it was a first-ever launch.**
`skills/postmaster/postmaster.md:174-179`:
```
A `.err` that opens with a `launch:` line is a refusal from `scripts/launch.sh`: it goes to the
user (Stage E step 3), and nothing is launched or resumed until they answer. A leg with no
thread id, none in its stream and none in `coachman.legs.<n>`, never started: its `.err` goes to
the user too, and on their answer the leg is launched again (Stage C step 3).
```
By the time any *resume* is attempted (ruling delivery, merge-word delivery, or a REMOUNT's own "spent thread" recovery), `coachman.legs.<n>.thread_id` is already on record — so a refused resume can never satisfy the "no thread id anywhere" clause, and is stuck under the first sentence only. That sentence describes the state before the user answers, but — unlike its sibling case — never says what to do once they do. Stage E's own step 4 ("resume the current leg with the ruling as the prompt") doesn't cleanly apply either, since there's no coachman-authored `.escalation-ready` to close out. Confidence: medium-high (structural, from tracing which `coachman.legs.<n>` state is reachable at each call site). Verified by reading only — this is prose, not a script, so it isn't executable. Exploit path: not adversarial; triggered by an ordinary operational fault during a resume (the config's `env_file` becomes unreadable, the harness drops off PATH, etc., between a leg's original launch and a later resume of the same thread). Effect: the run parks in `USER` state with no runbook-mandated next action, so it can sit stalled indefinitely even after the user believes they've fixed the problem — the class of "guard turned against a run in flight so it stops" the brief asks about, and also a direct instance of what `AGENTS.md` says runbooks must not do (leave a step to the executor's own reasoning).

**P3 — `ESCALATION.md`'s new multi-run aggregation is edited by prose, not by a script, unlike every other piece of shared run state.**
`skills/postmaster/postmaster.md:215-219`:
```
write the question to the run's `.waiting-on-user`, add the run and the question to
`<runs>/postmaster/ESCALATION.md`, tell the user in the session, and wait. ... On the
user's answer, remove `.waiting-on-user` and the run's entry, and the file once it is empty.
```
Adding/removing one run's section from a file shared across every run of the project, and deleting the file only once it's empty, is exactly the kind of deterministic bookkeeping `stage.sh` and `log-action.sh` exist to take out of prose (design rule 3). Confidence: medium-low — speculative, contingent on the postmaster mis-editing the shared file when two runs escalate close together. Verified by reading. Exploit path: not adversarial; the blast radius is limited because the authoritative per-run gate is the presence of that run's own `.waiting-on-user` (confirmed unchanged and correct in `runs-status.sh`), so a mis-edit here degrades the human-facing summary, not the gate — it cannot make a run "look complete" on its own.

No P1s found. The core mechanical changes (env-file resolution, prompt validation, suffix stripping, exit-code split, exited-marker clearing, walled-stream separation) all check out under both reading and execution, and I did not find a way to make any of them silently pass a run through, or write anything unintended into a public record — none of the four changed files touch tickets, wiki, or `raw/`.
