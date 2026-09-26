Reviewed round 2 (security lens) of PR #39 at `ad786ec` from the detached scratch at `[repo]/.worktrees/parallel-review-rev-security-[b]`. No files under review were modified. Full report below.

## Part 1: Closure of round-1 findings

1. **closed** — verified by execution (self-test) and reading: `scripts/launch.sh:148-165` nests the `[team.coachman_legs]` merged/unknown checks under `if name == "coachman":`; a lane launch on a config with a bad `coachman_legs` key now succeeds (`old-bug` fixture, "a lane launches on a config the coachman refuses").
2. **closed** — verified by execution: `postmaster.md:82-87` (Stage B step 2) requires `launch.sh form coachman --leg <leg>` ×3 and `form coachman_fallback` before dispatch. I built an independent fixture outside the self-test and confirmed all four exit 0 on a good config and exit 1 with a clear message when the `ship` leg is set to a lane's model. REMOUNT (`postmaster.md:168-170`) routes a `launch:` line to the user. (See Finding B for a related, lower-severity caveat on this mechanism.)
3. **closed** — reading: `coachman.md:122` routes non-style deferred findings to "open findings"; `coachman.md:580-582` — the ship card "lists every bug or security finding left open."
4. **closed** — reading: `coachman.md:493-495`, "A finding is gating or advisory by what it is, not by the lens that reported it."
5. **closed** — reading: `coachman.md` review-checkpoint step 6, "A ruling that asks for a change is applied and followed by another round, counted toward the cap."
6. **closed** — verified by execution (`scripts/stage.sh --self-test`, all pass, including "the coachman cannot move a run out of abandoned"): `stage.sh:42-43`.
7. **closed** — reading: the takeover instruction reuses "the wrapper of Stage C step 5" (append events with `>>`, truncate `.err` with `2>`, confirmed at `postmaster.md:144-147`), and "unless the leg already runs on the fallback, when the wall goes to the user" (`postmaster.md:171-172`).
8. **closed** — reading: `postmaster.md:120-124` resumes leg `n-1` with `n-1` substituted throughout, prompts it to "Complete the hand-off and end the leg," and waits for its done marker.
9. **closed** — reading: `wiki/concepts/review-loop.md`, "The cap ends all review... ships its last round's fixes unreviewed."
10. **closed** — verified by execution: self-test's `onlane`/`notable`/`dup` fixtures pass; independently reproduced the lane-model refusal end to end; confirmed `HARNESS`/`MODEL`/`EFFORT`/`ENV_FILE` are `unset` (`launch.sh:126`) before the config is read, so a parse failure can't fall back to environment values (tested with `HARNESS=claude MODEL=env-model` preset against the `dup` duplicate-key fixture: still refused, "cannot read").
11. **closed** — reading: prompt file now written once per round per lens, before any reviewer starts, via a quoted heredoc (`<<'EOF'`, `coachman.md` "A launch from a brief"), with `"$L"`/`"$DEST"` quoted in the launch step.
12. **closed** — verified by execution: reproduced stale `.done` markers from a prior round attempt, applied the fixed `rm -f` + relaunch sequence, and confirmed `wait-for-markers.sh` blocked for the fresh markers rather than returning instantly on the stale ones.
13. **closed** — reading: "Style does not run again... a style lane DEGRADED in round 1 stays DEGRADED, and the card says how many lanes the style lens rested on."
14. **closed** (as a log-schema change) — reading: `coachman.md:57-59`, `finding` now targets file:line, `apply` details the findings it fixes.
15. **closed** — verified by execution: `launch.sh --self-test`'s new positive controls and `stage.sh --self-test`'s "the postmaster abandons a run" control both pass.
16. **closed** — verified by execution: reproduced a stale scratch left at an old commit and re-cut at a new one via the actual `cut-scratch.sh` and the exact `&&`/`||` chain at `coachman.md:424-426`; confirmed it reports "SCRATCH BROKEN" instead of silently building the stale tree.
17. **not fully closed** — see Finding A. The escalation marker (`postmaster.md:210`, Stage E step 4) is fixed correctly: removal and resume are collapsed into one ordered step. The ship-card marker (`postmaster.md:225` vs `231`, Stage F steps 2-3) only had a word changed ("when" → "before"); the steps themselves are still numbered resume-then-remove, which is the original bug's shape.
18. **closed** — reading: `postmaster.md:139`, `<dispatch>/leg-<n>-resume-<k>.txt`.
19. **closed**, unaffected by this round — `launch.sh:121-122` unchanged (confirmed byte-identical across `fb7d5d6`→`33feb83`→`ad786ec` for the whole file); self-test negative controls pass.
20. **closed**, unaffected — `postmaster.md:143`, `rm -f <dispatch>/.leg-<n>-exited` precedes the resume; region untouched by this round.
21. **closed**, unaffected — ship leg sets `shipped` only (`coachman.md:594` area), postmaster Stage G sets `done` (`postmaster.md:244`); region untouched by this round.

Merge resolution (`ad786ec`, Stage B of `postmaster.md` and the top of `wiki/log.md`): no new issue found. The renumbered "stage 3" cross-reference at `postmaster.md:108` correctly reflects the reduction from 5 legs to 3 (it read "stage 5" at the round-1 baseline, main's ticket-shape PR hadn't touched it). `wiki/log.md`'s "newest first" ordering is chronologically correct — the review-loop entry's source commit (`2026-09-25T23:46:10Z`) is later than the ticket-shape entry's (`2026-09-25T07:51:51Z`), confirmed against `git log`.

## Part 2: Findings

**Finding A — P2.** Ship-card ready-marker removal is still sequenced after delivery, not before, despite finding #17's fix wording.

`skills/postmaster/postmaster.md:225,231`:
```
2. **Grant or withhold.** ... deliver "MERGE GRANTED" by resuming leg 3 (Stage C, step 5) ...
   Any check fails: deliver the failure as a ruling by the same resume ...; the leg addresses
   it and raises the card again. ...
3. **Remove `.card-ready` before you deliver either word,** so the poll does not report the
   same card again; the coachman touches it afresh when the card changes.
```
and `skills/postmaster/coachman.md:588-592` (ship leg, Stage 3 step 5): "On a withheld grant, address the reasons, update the card, touch `.card-ready` again, and exit again."

Exploit path: not an external attacker — the "input" is the postmaster's own execution order over its numbered runbook. Reading steps 2 then 3 in written order resumes leg 3 (backgrounded) with a withheld ruling *before* removing the pre-existing `.card-ready`. If leg 3's fix is fast relative to the postmaster's own (near-instant) step 3 — e.g. the withheld reason is a card-text or missing-branch fix needing no rebuild — the sequence can interleave as: leg 3 fixes the issue, updates `card.md`, touches a fresh `.card-ready`, and *then* the postmaster's step 3 fires and deletes it. The freshly corrected card becomes invisible to Stage D's `GATE` poll; the run reads as `WAIT` although a completed ship card sits on disk, unmerged and unnoticed. This is the same class of hazard the fix for #17 was meant to close; the escalation-marker instance (`postmaster.md:210`) closes it correctly by collapsing "remove" and "resume" into one step, and the ship-card instance should have gotten the same treatment.

Confidence: medium (the bad ordering needs a fast leg turnaround, which is plausible for cheap withhold reasons but not guaranteed). Verified by: reading only.

**Finding B — P3.** REMOUNT's new refusal detection is a substring match on process stderr, the pattern the project's own design rules single out as fragile for this kind of decision.

`skills/postmaster/postmaster.md:168-170`:
```
- **REMOUNT:** the leg's process exited (`.leg-<n>-exited`) with no hand-off, escalation or
  card. Read the leg's `.err` file and the stream tail. A `launch:` line in the `.err` is a
  refusal, and the leg never started: it goes to the user (Stage E, step 3), and nothing is
  relaunched.
```
Exploit path: `.err` captures the harness process's own stderr (`postmaster.md:145-146`, `2> <dispatch>/logs/coachman-leg-<n>.err`), which is not purely under the postmaster's control. If a harness's own diagnostic output, or output from a tool the coachman itself ran, happens to produce a line starting with `launch:`, a genuinely spent/crashed thread gets classified as "never started" and is sent to the user with nothing relaunched — the manifest still shows the leg mid-flight, so the run looks merely blocked on a question rather than dead. This is a narrower instance of the project's own design rule 4 ("Never select a process by matching text that could appear in a prompt; match on pid or working directory") — here a refusal is selected by matching text that could appear in a stream, rather than by a property `launch.sh` records mechanically (e.g. a distinct exit code).

Confidence: low-to-medium (the postmaster is an LLM reading holistically, not a naive grep, which mitigates it; but the instruction as written names only the substring test with no other guard, and it is new in this round). Verified by: reading only.

**Finding C — P3, informational.** The new marker-clearing line built by this round's fix leaves `$LENS`/`$L` unquoted in a path passed to `rm -f`, immediately beside a sibling line this same commit quoted.

`skills/postmaster/coachman.md:445`: `rm -f <dispatch>/logs/review-r<round>-$LENS-$L.done`

Exploit path: `$LENS` (style/bug/security) and `$L` (a `[lanes.*]` name from local config) are not attacker/remote-controlled in normal operation, so this is not currently exploitable. It's flagged only because it is brand-new code from this round's fix (#12), sits next to the launch-step line that the *same* commit deliberately quoted (`"$L"`, `"$DEST"`, fix #11), and a lane name with a shell glob character or space would make `rm -f` word-split/glob-expand the resulting path. Confidence: low as a real vulnerability, high as a literal reading. Verified by: reading only.

No other new gating-severity issues were found in `git diff fb7d5d6 33feb83` or in the merge resolution. Specifically checked and clean, verified by execution beyond the shipped self-tests: the rewritten config-reading `eval`/quoting path in `launch.sh` (each field individually `shlex.quote`d, `HARNESS`/`MODEL`/`EFFORT`/`ENV_FILE` explicitly unset before use), the `not_a_lane`/table-type guards, the `stage.sh` terminal-stage guard, the `cut-scratch.sh` stale-snapshot guard, and the Stage B config pre-flight.
