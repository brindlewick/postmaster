# Evidence: the review loop on PR #39

Private working evidence for the research ticket on when an AI review loop should stop. It is not
scrubbed: the reports carry local paths and names. Nothing here goes into `raw/`, the wiki or a
ticket until it has been through the promotion checks in `raw/README.md`.

PR: https://github.com/brindlewick/postmaster/pull/39 (closes #36; merged as `547687c`). Its
description has the round-by-round summary.

## What is here

- `reports/`: each reviewer's final report, verbatim, extracted from its transcript.
- `briefs/`: the briefs the round 2 to 4 reviewers were given.
- `code-review/`: round 1's `final.json` from `/code-review`, and the diffs it wrote.

## The rounds

| round | reviewed | reviewers | fixes in |
|---|---|---|---|
| 0 | `b17699b` against the ticket's criteria | one general reviewer | `2814e09` |
| 1 | the whole PR at `2814e09` (and `fb7d5d6`, which landed mid-review) | `/code-review`: ten finder angles, a gap sweep, one verifier per candidate, about 50 helper agents | `33feb83` (plus `fb7d5d6`) |
| 2 | the round-1 fixes, `fb7d5d6..33feb83`, and a merge at `ad786ec` | bug and security lenses, each on [model A] and on [model B] | `86dcdfb` |
| 3 | the round-2 fixes, `ad786ec..86dcdfb` | the same four | `b4b1199` |
| 4 | the round-3 fixes, `86dcdfb..b4b1199` | the same four | none: stopped |

Rounds 2 to 4 each ran in fresh detached scratches, with round 1's (then round 2's, round 3's)
findings and their dispositions restated in the brief, and the reviewers told to closure-check each
fix and not to re-report a deferred or refuted finding.

### Cost, per reviewer (from the task notifications)

| round | reviewer | tokens | tool calls | minutes |
|---|---|---|---|---|
| 0 | criteria check | 231,292 | 49 | 11 |
| 1 | /code-review orchestrator (helpers not counted) | 528,626 | 110 | 201 |
| 2 | security, [model A] | 225,000 | 30 | 13 |
| 2 | bug, [model A] | 203,444 | 27 | 14 |
| 2 | security, [model B] | 197,370 | 40 | 19 |
| 2 | bug, [model B] | 214,724 | 42 | 22 |
| 3 | bug, [model A] | 186,484 | 25 | 12 |
| 3 | security, [model B] | 159,176 | 27 | 15 |
| 3 | security, [model A] | 210,168 | 30 | 15 |
| 3 | bug, [model B] | 220,177 | 44 | 19 |
| 4 | bug, [model A] | 173,318 | 32 | 11 |
| 4 | security, [model A] | 192,268 | 25 | 13 |
| 4 | security, [model B] | 172,852 | 33 | 17 |
| 4 | bug, [model B] | 187,169 | 53 | 19 |

### Findings, as the coachman tallied them (recompute from `reports/`)

- Round 1: 39 candidates; 24 confirmed, 11 plausible, 4 refuted by the tool's own verifiers. Of
  what was acted on: 21 fixed (3 of them already fixed in `fb7d5d6` while the review ran), 5
  deferred to tickets #45 to #49, 7 left unchanged with a reason, 4 refuted.
- Round 2: 20 of round 1's 21 fixes confirmed closed, 1 partly. 26 verified findings after merging
  duplicates across the four reports: 8 at P2, the rest P3, none P1. All fixed in `86dcdfb` but
  two dispositions (one dismissed, one documented as a limit).
- Round 3: 21 of round 2's 22 fixes closed, 1 not. 13 verified: 3 at P1, 4 at P2, 6 at P3. All
  fixed in `b4b1199` except one deferred to #48; two dismissed.
- Round 4: all 10 of round 3's fixes closed. New findings all in one class (what the postmaster
  does with a leg that exited without finishing), found by all four reviewers, plus small P3s
  elsewhere. The loop stopped under `coachman.md`'s repeated-class rule; filed as #57 and #58.

Counting P1 and P2 together: 8 in round 2, 7 in round 3, 2 in round 4.

### Where the findings sat (the coachman's classification, unverified)

- Round 2: about 5 or 6 of the 8 P2s were in code the round-1 fixes had just written (a new
  REMOUNT rule, the new wait-on-user paths, the marker order in Stage F, the scratch chain).
- Round 3: all 3 P1s, and 3 of the 4 P2s, were in the round-2 fixes (a relaunch path, moving the
  env file's loading, an appended stream, a dropped refusal rule, a single-suffix regex, the
  left-behind scratch removal).
- Round 4: the main P2 was in a round-3 fix (a refusal rule restored without its follow-through);
  the other P2 (an env file failing to load) was older behaviour the new rules exposed.

### Severity disagreements seen

The same finding rated differently by different reviewers, for example: the stale marker after a
relaunch (round 3): P1, P2, P1; the relative env file (round 3): P1, P2; the refused resume with no
next step (round 4): P1 from one reviewer, P2 from three.

### Limits of this evidence

- All reviewers were [one vendor's] models. Round 1's `/code-review` ran as a fork of the implementing
  session, on its model and with its context up to that point.
- The implementing session was also the coachman: it wrote the fixes, the briefs and the
  dispositions, and verified the findings. Its briefs anchored reviewers to its dispositions.
- The loop's fixes widened the change beyond the ticket in places (older problems in touched areas
  were fixed in-loop rather than filed), which enlarged each round's surface.
- Nothing reviewed here has run: the flow has not yet done a real dispatch on this machine.
