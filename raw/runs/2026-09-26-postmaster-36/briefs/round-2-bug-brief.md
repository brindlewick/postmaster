# Review round 2, bug lens: pull request #39 at ad786ec

You are a reviewer in round 2 of a review loop on pull request #39 of the postmaster repository
(https://github.com/brindlewick/postmaster/pull/39, "Run the style, bug and security reviews as one
loop", closing issue #36). Round 1 reviewed the branch at `fb7d5d6`, and its findings were acted on.
Round 2 runs the bug and security lenses only, on the fixed code. You are the bug lens (gating).

## Your lens: bug

Correctness and logic of the fixes and of everything they touch. Absence against relative checks:
does any check pass vacuously when a row, file, marker or entry is missing? The runbooks as a
coachman or postmaster would follow them literally: does each step produce the state the next one
expects, and do the step numbers, marker names, file names and placeholders agree across
`postmaster.md`, `coachman.md` and the scripts? Test adequacy: does each new self-test control fail
for its own reason when the check it guards is removed?

The extra field for each finding: the steps that reproduce it.

## Where you work

Your scratch is the path your prompt names: a disposable git worktree detached at the snapshot
`ad786ec`. You may run anything there, including every script's `--self-test`, simulations and
stub harnesses. The one thing you must not do is modify the code under review: no edits, no
commits, no pushes, and nothing written in any other worktree under
`[repo]/.worktrees/`. Put any files you need in a directory from `mktemp -d`.
Do not create, edit or comment on any GitHub issue or pull request. Run things to check your own
claims, and say for each finding whether you verified it by execution or by reading. A test that
passes is not evidence until you have seen it fail for the right reason.

## What to review

1. The fixes made after round 1, in commit `33feb83`: `git diff fb7d5d6 33feb83`. It touches
   `scripts/launch.sh`, `scripts/stage.sh`, `skills/postmaster/coachman.md`,
   `skills/postmaster/postmaster.md`, `wiki/concepts/review-loop.md` and `wiki/index.md`.
2. The conflict resolution in the merge commit `ad786ec`, which merged main (PR #35, reviewed on
   its own) into this branch: `git show --cc ad786ec`. Review only the resolution: Stage B of
   `postmaster.md` and the top of `wiki/log.md`.
3. For each round-1 finding listed as fixed below, whether it is closed at `ad786ec`.
4. New holes the fixes opened, anywhere they reach. The whole pull request is
   `git diff origin/main...ad786ec` when you need its context.

The project's rules are in `AGENTS.md`: runbooks say only what an agent must do and carry no
reasoning; deterministic work belongs in scripts with positive and negative controls; nothing
harness-specific outside `harnesses.md` and `launch.sh`; a process is never selected by text that
could appear in a prompt. The project says "user", never "operator" or "human".

## Round 1's findings and what became of them

Reviewers argue the coachman out of wrong calls. Closure-check every fixed finding. Do not
re-report a deferred, unchanged or refuted one as new; if you think its disposition is wrong,
say so and why.

Fixed in `33feb83`:

1. `launch.sh` refused every lane launch when `[team.coachman_legs]` held a bad key. Now only a
   coachman launch reads and checks that table.
2. "That refusal goes to the user" had no mechanism. Now Stage B step 2 of `postmaster.md` checks
   the config (`launch.sh form` for each leg and for the fallback) before anything is dispatched,
   and REMOUNT sends a `launch:` refusal to the user.
3. Open bug and security findings reached no section of the ship card. Now the ship card lists
   them and the hand-off routes them there.
4. A correctness defect reported under style and deferred in round 1 was never seen by a gating
   reviewer. Now a finding is gating or advisory by what it is, whichever lens reported it.
5. In consult mode, the changes a ruling asked for shipped unreviewed. Now such a ruling gets
   another round, counted toward the cap.
6. A live coachman could move a run out of `abandoned`. Now only the postmaster sets or leaves a
   terminal stage (`stage.sh` exit 3).
7. A fallback takeover truncated the leg's stream, a walled fallback was relaunched on itself,
   and an appended `.err` kept old wall text. Now the takeover goes through Stage C step 5's
   wrapper, which appends the events, a wall on the fallback goes to the user, and `.err` holds
   only the latest process's errors.
8. Stage C step 2 resumed the previous leg with the wrong `n` and did not tell it to end the leg.
   Now it resumes leg `n-1` with `n-1` in place of `n`, prompts it to complete the hand-off and
   end the leg, and waits for its done marker.
9. The wiki page claimed every fix is re-reviewed, even at the cap. Now it says the cap ends
   review.
10. `launch.sh` accepted a per-leg coachman on a lane's model, crashed on a non-table entry or a
    duplicate key, and on that crash ran on `HARNESS` and `MODEL` from the environment. Now each is
    refused, and `HARNESS`, `MODEL`, `EFFORT` and `ENV_FILE` come from the config alone.
11. The per-round prompt file was written inside each lane's backgrounded subshell, a race, and
    backticks in the prompt could run as command substitution. Now it is written once per round
    before any reviewer starts, with a quoted heredoc, and `$L` and `$DEST` are quoted.
12. The round's wait counted forked processes against markers nothing cleared. Now each
    reviewer's marker is cleared before its launch, and an interrupted round is re-run whole.
13. A style lane walled in round 1 could not be restored. Now style does not run again, and the
    card says how many lanes it rested on.
14. The wiki's coverage measure could not be computed from the log. Now `finding` names its
    file:line and `apply` names the findings it fixes.
15. The new refusals had no positive controls. Now a coachman launch with `--leg` runs on its
    entry, and the postmaster can abandon a run.
16. A scratch left at an old snapshot passed the build check. Now a scratch not cut at the
    snapshot is caught.
17. Ready markers were removed after the resume that answers them. Now they are removed before.
18. The resume prompt file had no location. Now it is `<dispatch>/leg-<n>-resume-<k>.txt`.

Fixed in `fb7d5d6`, before round 1 finished:

19. A leg resumed without `--leg` ran on `team.coachman`. Now there is one resume form, with
    `--leg`, and `launch.sh` refuses a coachman launch or resume without it.
20. A resumed leg kept its exited marker, so the poll read it as spent. Now the marker is cleared
    first.
21. Stage G never started, because the ship leg set `done` first. Now the ship leg stops at
    `shipped` and only the postmaster sets `done`.

Deferred, each to its own ticket:

- #45: codex's resume form passes no model, effort or `--json`; fixing it needs a codex trial.
- #46: a resume reads the live config rather than `run.json`, and the resolved spec is never
  recorded.
- #47: `cut-scratch.sh` copies dependencies in full on Linux, and exits 0 on a partial copy.
- #48: there is no step for `WAIT-TIMEOUT`, and the 2400 s limit was not raised for round 1.
- #49: the README poster shows sequential review gates.

Not changed:

- Reviewer thread ids are recorded at harvest, not at dispatch: the launch and the wait are one
  command, and the ids come from the streams.
- "A round that applied any change is never the last" has no mechanical check yet.
- Each lens brief repeats the shared content, and up to three reviews per lane may run the full
  suite: a design cost, recorded on the wiki page.
- The retired-key check overlaps the unknown-key check, to give the message criterion 3 asks for,
  and the leg list is written in several places.
- `--leg=value` is not parsed; a coachman launch or resume without a parsed `--leg` is refused.
- A fallback that takes over mid-loop may not see earlier rounds' style deferrals.
- Some `stage.sh` controls overlap, and `launch.sh` starts python3 more than once.

Refuted in round 1:

- `SKILL.md`'s "ruling channel" line is information only.
- "Every lens still open" is not ambiguous.
- The wiki page's overlap with `coachman.md` is the premises of its cost analysis.
- The README and `harnesses.md` are not stale for `fb7d5d6`.

Not a finding, by the user's request: each lens has one entry in `coachman.md` holding how its
reviewers are launched ("Launch: from its brief."), so #38 can change the bug lens's launch in
one place. The three entries are identical today.

## Your report

Your final message is your report, in two parts.

1. Closure: one line per fixed finding above, numbered as above, `closed` or `not closed`, with
   the evidence.
2. Findings, most severe first. For each: severity P1 (breaks a run or its record), P2 (wrong
   under conditions a run can meet) or P3 (minor); file:line at `ad786ec`; the code quoted as
   evidence; your confidence; verified by execution or by reading; and the lens's extra field.
   If you find nothing, say CLEAN and what you checked.
