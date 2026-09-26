# Review round 4, security lens: pull request #39 at b4b1199

You are a reviewer in round 4 of a review loop on pull request #39 of the postmaster repository
(https://github.com/brindlewick/postmaster/pull/39, "Run the style, bug and security reviews as one
loop", closing issue #36). Rounds 1 to 3 reviewed earlier snapshots, and their findings were acted on.
Round 4 runs the bug and security lenses only, on the fixed code. You are the security lens
(gating).

## Your lens: security

General exploit hunting, plus the project's own surfaces: what `launch.sh` spawns and with what
arguments (the shell it generates and evals, how config values are quoted, how an env file is
loaded); what the runbooks' shell blocks do with paths and names (`rm -f` of markers, heredocs,
globs, values a coachman substitutes); what reaches a public record (tickets, the wiki, `raw/`,
run logs): secrets, paths, a target's details; and whether a new refusal or guard can be bypassed,
or turned against a run in flight so that it stops or reviews nothing while looking complete.

The extra field for each finding: the exploit path, meaning who controls the input and what they
get.

## Where you work

Your scratch is the path your prompt names: a disposable git worktree detached at the snapshot
`b4b1199`. You may run anything there, including every script's `--self-test`, simulations and
stub harnesses. The one thing you must not do is modify the code under review: no edits, no
commits, no pushes, and nothing written in any other worktree under
`[repo]/.worktrees/`. Put any files you need in a directory from `mktemp -d`.
Do not create, edit or comment on any GitHub issue or pull request. Run things to check your own
claims, and say for each finding whether you verified it by execution or by reading. A test that
passes is not evidence until you have seen it fail for the right reason.

## What to review

1. The fixes made after round 3, in commit `b4b1199`: `git diff 86dcdfb b4b1199`. It touches
   `scripts/launch.sh`, `scripts/stage.sh`, `skills/postmaster/coachman.md` and
   `skills/postmaster/postmaster.md`.
2. For each round-3 finding listed as fixed below, whether it is closed at `b4b1199`.
3. New holes the fixes opened, anywhere they reach. The whole pull request is
   `git diff origin/main...b4b1199` when you need its context. Earlier rounds' fixes were
   confirmed closed; look at them again only where `b4b1199` touches them.

This is round 4 of a loop capped at 5. Findings that are real and new matter; restatements of
the dispositions below do not.

The project's rules are in `AGENTS.md`: runbooks say only what an agent must do and carry no
reasoning; deterministic work belongs in scripts with positive and negative controls; nothing
harness-specific outside `harnesses.md` and `launch.sh`; a process is never selected by text that
could appear in a prompt. The project says "user", never "operator" or "human".

## Round 3's findings and what became of them

Reviewers argue the coachman out of wrong calls. Closure-check every fixed finding. Do not
re-report a deferred, dismissed or standing one as new; if you think its disposition is wrong,
say so and why.

Fixed in `b4b1199`:

1. A leg launched again after a refusal kept the first launch's exited marker, so the poll
   resumed a live leg. Now Stage C step 3's wrapper clears `.leg-<n>-exited` first, as step 5's
   does.
2. A refused resume was resumed again at every poll, since the `launch:` branch had been dropped
   from REMOUNT. Now a `.err` that opens with a `launch:` line is a refusal from `launch.sh`: it
   goes to the user, and nothing is launched or resumed until they answer.
3. A relative `env_file` was checked from the caller's directory and loaded from the lane's
   worktree. Now it is resolved against the config's directory, and must be readable.
4. The scratch integrity check missed staged and committed changes. Now it is
   `git diff --name-only <SNAP>`, at harvest and for a scratch left behind.
5. Stacked bracketed suffixes (`model[1m][2m]`) slipped past the lane-model check. Now every
   trailing bracketed suffix is stripped before comparing.
6. `stage.sh` exit 3 had two causes. Now a non-postmaster setting a terminal stage exits 4, and
   exit 3 means only that the run is already closed or abandoned, which is when a coachman stops.
7. `launch.sh`'s header contradicted itself about the env file and claimed more than it gives.
   Now it says the env file is shell, sourced last, and the user's to write.
8. `.waiting-on-user` held no question, and one escalation file served every run. Now the
   question is written into the run's `.waiting-on-user`, `<runs>/postmaster/ESCALATION.md` lists
   every run waiting, and USER puts the question to the user again when this session has not.
9. A missing, unreadable or empty prompt file launched a harness with an empty prompt. Now it is
   refused.
10. The takeover's thread id was to be read from a stream holding two threads, where
    `harnesses.md` reads the first event. Now the walled stream is moved to
    `coachman-leg-<n>-walled-events.jsonl`, and the takeover starts a fresh stream through Stage C
    step 3's wrapper.

Deferred to #48, and noted on that ticket: re-running an interrupted round while its first
attempt's reviewers still run. The runbook now states the precondition (re-run only once no
reviewer from the first attempt still runs, selected by working directory); the scripted check
of whether a process still runs in a scratch is #48's to build.

Dismissed:

- A non-worktree directory at a scratch path: the removal fails, the cut prints SCRATCH BROKEN,
  and the launch's snapshot check launches nothing.
- Two resumes of one leg in the same second would share a prompt file name: resumes are minutes
  apart.

Standing, not fixable here: the env file runs as the user's shell code; `stage.sh` trusts the
actor its caller names; a process running as the user can forge a marker or edit a manifest.

Still open as tickets: #45 (codex resume form), #46 (a run keeps its config), #47 (scratch
clones on Linux), #48 (the round's timeout and interrupted rounds), #49 (the poster). Round 1's
standing items also stand, including one entry per lens in `coachman.md` for how its reviewers
are launched, by the user's request.

## Your report

Your final message is your report, in two parts.

1. Closure: one line per fixed finding above, numbered as above, `closed` or `not closed`, with
   the evidence.
2. Findings, most severe first. For each: severity P1 (breaks a run or its record), P2 (wrong
   under conditions a run can meet) or P3 (minor); file:line at `b4b1199`; the code quoted as
   evidence; your confidence; verified by execution or by reading; and the lens's extra field.
   If you find nothing, say CLEAN and what you checked.
