# Review round 3, bug lens: pull request #39 at 86dcdfb

You are a reviewer in round 3 of a review loop on pull request #39 of the postmaster repository
(https://github.com/brindlewick/postmaster/pull/39, "Run the style, bug and security reviews as one
loop", closing issue #36). Rounds 1 and 2 reviewed earlier snapshots, and their findings were acted on.
Round 3 runs the bug and security lenses only, on the fixed code. You are the bug lens (gating).

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
`86dcdfb`. You may run anything there, including every script's `--self-test`, simulations and
stub harnesses. The one thing you must not do is modify the code under review: no edits, no
commits, no pushes, and nothing written in any other worktree under
`[repo]/.worktrees/`. Put any files you need in a directory from `mktemp -d`.
Do not create, edit or comment on any GitHub issue or pull request. Run things to check your own
claims, and say for each finding whether you verified it by execution or by reading. A test that
passes is not evidence until you have seen it fail for the right reason.

## What to review

1. The fixes made after round 2, in commit `86dcdfb`: `git diff ad786ec 86dcdfb`. It touches
   `scripts/launch.sh`, `scripts/runs-status.sh` (which gains a self-test), `scripts/stage.sh`,
   `skills/postmaster/coachman.md`, `skills/postmaster/postmaster.md`,
   `wiki/concepts/review-loop.md` and `wiki/index.md`.
2. For each round-2 finding listed as fixed below, whether it is closed at `86dcdfb`.
3. New holes the fixes opened, anywhere they reach. The whole pull request is
   `git diff origin/main...86dcdfb` when you need its context. Round 1's fixes were confirmed
   closed in round 2; look at them again only where `86dcdfb` touches them.

The project's rules are in `AGENTS.md`: runbooks say only what an agent must do and carry no
reasoning; deterministic work belongs in scripts with positive and negative controls; nothing
harness-specific outside `harnesses.md` and `launch.sh`; a process is never selected by text that
could appear in a prompt. The project says "user", never "operator" or "human".

## Round 2's findings and what became of them

Reviewers argue the coachman out of wrong calls. Closure-check every fixed finding. Do not
re-report a deferred, unchanged or refuted one as new; if you think its disposition is wrong,
say so and why.

Fixed in `86dcdfb`:

1. A lane's env file was sourced after every check, so a line in it could change the model,
   the harness, the command or the stdin file. Now it is loaded last, into the harness's
   environment only, once the command is built and the working directory and stdin are set.
2. A scratch not at the snapshot was reported and then launched into. Now the launch checks
   every scratch against the snapshot first and launches nothing if one is off.
3. Some launch failures carried no `launch:` line, and a leg that never produced a thread id
   was resumed at every poll. Now `launch.sh`'s own argument errors go through its `die`, and
   REMOUNT treats a leg with no thread id, in its stream or the manifest, as never started and
   sends it to the user.
4. The lane-model refusal was string equality, so `model[1m]` slipped past. Now models are
   compared without a bracketed suffix.
5. A stale marker of a lane not relaunched could end the wait early, and the per-lane `rm -f`
   was unquoted. Now the round's markers are cleared once, with a glob, before the launch.
6. `STDIN_FILE` was never initialised, so a value from the environment reached a non-pi
   harness. Now it is initialised.
7. A coachman and a lane both without a model crashed with a traceback. Now it is refused by
   name.
8. A run waiting on the user had no state the poll could read, so REMOUNT or GATE fired every
   cycle. Now the postmaster touches `.waiting-on-user` when it takes a run's question to the
   user (Stage E step 3, and Stage F under user authority), and `runs-status.sh` reports USER.
9. In consult mode, "another round" after a ruling collided with the round cap. Now a round
   past the cap runs only when the ruling says so.
10. A coachman refused by `stage.sh` with exit 3 had no instruction. Now it logs a `note` and
    exits.
11. The refusals of `team.coachman` and the fallback on a lane's model had no controls. Now
    both do.
12. The parse-error control could not tell the Python catch from the shell's fallback. Now it
    expects the message that names the file.
13. Stage B checked the coachman roles only. Now it checks every lane in the team too.
14. `apply` had no target. Now its target is the fix's commit.
15. A wiki heading still said every fix is re-reviewed. Now it says each round's fixes are.
16. Stage C step 2 had no branch for leg 1. Now the hand-off check runs from leg 2 on.
17. In Stage F, removing `.card-ready` was still numbered after the delivery. Now it is removed
    before any word is delivered.
18. A round re-run after an interruption failed on every scratch the first attempt left. Now a
    scratch left behind is checked like any other and removed before it is cut again, and the
    worktree list is pruned first.
19. An empty per-leg entry fell back to `team.coachman` without a word. Now it is refused.
20. `unset HARNESS MODEL EFFORT ENV_FILE` was exercised by no control. Now it is gone; the
    shell's guard and the assignments the config read always prints cover the case.
21. The resume prompt's `k` had no derivation. Now a resume prompt is named by its UTC time.
22. A takeover appends a second thread to the leg's stream. Now the new thread id is read from
    the events the takeover appended.

Not changed:

- `stage.sh` trusts the actor its caller names; under one account nothing can enforce it. Its
  header now says so.
- #35's log entry calls the ticket-shape page the second decision page. That is its order of
  creation; the index now lists the decision pages in that order.

Deferred, each to its own ticket, and still open:

- #45: codex's resume form passes no model, effort or `--json`.
- #46: a resume reads the live config rather than `run.json`.
- #47: `cut-scratch.sh` copies dependencies in full on Linux, and exits 0 on a partial copy.
- #48: there is no step for `WAIT-TIMEOUT`, and the 2400 s limit, and a harness's cap on one
  command's run time, were not revisited for round 1.
- #49: the README poster shows sequential review gates.

Round 1's "not changed" and "refuted" items still stand: reviewer thread ids recorded at
harvest; no mechanical check that a round which applied a change is not the last; each lens
brief repeating shared content; the leg list written in several places; a fallback taking over
mid-loop possibly missing earlier style deferrals; and, by the user's request, one entry per
lens in `coachman.md` holding how its reviewers are launched.

## Your report

Your final message is your report, in two parts.

1. Closure: one line per fixed finding above, numbered as above, `closed` or `not closed`, with
   the evidence.
2. Findings, most severe first. For each: severity P1 (breaks a run or its record), P2 (wrong
   under conditions a run can meet) or P3 (minor); file:line at `86dcdfb`; the code quoted as
   evidence; your confidence; verified by execution or by reading; and the lens's extra field.
   If you find nothing, say CLEAN and what you checked.
