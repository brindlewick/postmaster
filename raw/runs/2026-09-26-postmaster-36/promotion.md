# What this record is

The review of ticket #36 (pull request #39), rounds 0 to 4, run by hand on 2026-09-25 and
2026-09-26. One session implemented the ticket and acted as its coachman: it wrote the fixes,
wrote each round's briefs, verified the findings and chose their dispositions. It was not a
postmaster dispatch, so there is no ledger, run log, card or harness stream. It is kept under
`runs/` because it is this project's own review of its own change.

The record was kept outside the repository until it was promoted on 2026-09-26 for #59.

## Files

- `README.md`: the implementing session's index of the rounds. It carries each reviewer's cost,
  copied from the session's task notifications, and the session's own tallies and readings.
- `reports/`: each reviewer's final report. `round-0-criteria-check.md` is one general reviewer
  checking the ticket's criteria. `round-1-code-review.md` is the report of `/code-review`, run
  on the implementing session's model. `round-<n>-<lens>-<a|b>.md` are rounds 2 to 4: the bug
  and security lenses, each run on model a and on model b.
- `briefs/`: what the round 2 to 4 reviewers were given.
- `code-review/final.json`: round 1's findings as `/code-review` wrote them.
- `commits.txt`: the pull request's commits with their commit times, from `git log`.

## Changed at promotion

Every substitution is bracketed where it stands, so the files show what was replaced.

- Local paths became `[repo]`, `[tmp]` and `[session scratchpad]`, and a session id went with
  the scratchpad path.
- The two reviewer models are named `[model A]` and `[model B]`, and the vendor's name became
  `[one vendor's]`. Both models are from one vendor. In file names they are `a` and `b`.

Nothing else was changed.

## Left out

Round 1's two diffs: the commit `fb7d5d6`, which landed while round 1 ran, and the pull request
as round 1 saw it. Both come from the repository, byte for byte: `git show --format= fb7d5d6`
and `git diff ad604e2...fb7d5d6`.

## Limits

Every reviewer was one vendor's model. The session that verified the findings also wrote the
fixes and the briefs, and its briefs told reviewers the dispositions of earlier findings. The
costs are the session's copy of its task notifications; the reports carry none. Nothing that was
reviewed had run.
