# Checkpoint: review leg, run 216

Snapshot at loop end: `cbd03840bb1966ff0b1190b99a3409175d469b9f` (clean tree).
Loop ended after round 3: `CAP 3: round 3 logged a verified P1 or P2 finding; escalate with residue`.
Rounds ran: 1 (all lenses), 2 and 3 (gating lenses alone).

States: `closed round <r>` means applied in the synthesis worktree that round;
`not re-reviewed` marks fixes no reviewer has seen yet. `open` means verified and
carried forward, to the ship card's open findings (gating P3) or Style residue.

## Bug lens (rounds 1-3; lanes luna, mimo, REVIEWED every round)

- [P1] bug-1: closed round 1 — scrub-core.ts:826, pattern-code whole-line skip let a secret pass the gate.
- [P2] bug-2: closed round 1 — landing.ts:497, card scan inherited SCRUB_CHECK_DISABLE through the run env merge (same hole in scrub-rewrite.ts parseFindings, fixed together).
- [P2] bug-3: closed round 1 — raw-promote-main.ts:345, symlinked dest ancestor escaped the repo on mkdir+rename.
- [P2] bug-4: closed round 1 — bundle-scrub.ts:92, --check passed an edited bundle body on a matching header hash.
- [P2] bug-5: closed round 1 — landing.ts:484, card literals froze held-out scores and D1/D8/D9/D19 into every future card.
- [P3] bug-6: open, Style residue — scrub-rewrite.ts:6, style-class hygiene (unused imports/bindings, dead set) reported under the bug lens.
- [P2] bug-7: closed round 2 — scrub-core.ts:1514, range scan missed UTF-16 content that --files found.
- [P3] bug-8: open, ship card open findings — tree-check.ts:137 (round 2), merge resolution-added paths scanned and logged twice; card dedupes by key, no count inflation.
- [P2] bug-9: closed round 3, not re-reviewed — landing.ts:475, block generator died past 50 census suspects, accepted 236-line census unrepresentable.
- [P2] bug-10: closed round 3, not re-reviewed — raw-promote-main.ts:53, ambient DISABLE turned promote scrub into straight copy; same hole in tree-check entry, gate chain and runbook scan commands, fixed together. Reported by luna and mimo.
- [P2] bug-11: closed round 3, not re-reviewed — tree-check.ts:28, hasReasoning depth-64 fail-open, 66-deep encrypted_content passed the tree gate.
- [P2] bug-12: closed round 3, not re-reviewed — raw-promote-main.ts:276, marker strip ate closing JSON syntax, malformed record promoted exit 0.
- [P3] bug-13: open, ship card open findings — runs-status.ts:48 (round 3), unreadable detections log returns an empty set and suppresses TELL silently; trigger environmental only.

Overlap: bug-10 spans promote, tree-check, the gate and the runbook (one finding, fixed once).
bug-9 overlaps the escalated census question (236 accepted lines vs the ticket's 50).
bug-2/bug-10 are the same DISABLE class in different entries, found one round apart.

Dismissed claims: round 1 host-scratch (pre-existing line, lane artifacts), fragmentation
(ticket-sanctioned), clean-file perms (no findings), confine test (environmental, untouched
code); round 2 verify-P1 (contradicts D17; prDescription logs findings), mimo-order
(rewrites correctly, worst case fail-closed), mimo-safePath (idempotent), mimo-split
(comments load-bearing); round 3 rule-narrow (item_0 flags per spec D2, census-counted),
mimo-split re-file (round-2 verdict stands, no new evidence).

## Style lens (round 1 only, gates nothing; lanes luna, mimo, REVIEWED)

9 findings go to the ship card's Style residue, as `style-findings.sh count` prints it: 9.

- [P3] style-1: open, Style residue — scrub-core.ts:438, env reads and IO in core against the functional-core paradigm (luna+mimo dedup).
- [P3] style-2: open, Style residue — scrub-rewrite.ts:76, two sibling-scanner invocation forms.
- [P3] style-3: open, Style residue — scrub-rewrite.ts:37, fail/safeError three names two behaviours.
- [P3] style-4: open, Style residue — tree-check.ts:41, encrypted-reasoning shapes written twice.
- [P3] style-5: open, Style residue — scrub-check-main.ts:41, citation front-matter detection duplicated.
- [P3] style-6: open, Style residue — scrub-core.ts:438b, disabled Set vs predicate, DISABLE parsed three ways.
- [P3] style-7: open, Style residue — scrub-check.ts:5, production bundles carry the PY_GOLDEN_PROG generator.
- [P3] style-8: open, Style residue — raw-promote-main.ts:29, two repo-root helpers, two algorithms.
- [P3] bug-6: open, Style residue — counted above under the bug lens (style class, bug lens).

## Security lens (lane opus)

- [P3] sec-1: closed round 1 — scrub-rewrite.ts:263, rewrite followed symlinks; realistic cases refused or unlinked, newline-target links could escape. Filed below the lane's confidence cut, verified by the coachman, applied with round 1 (round 1 applies P3).
- Round 1: REVIEWED, 0 findings at bar plus the sub-cut sec-1.
- Round 2: REVIEWED, no findings. Correction: the run log's "1 dismissed + 1 applied" for this round matches no finding line and no triage note; the final report says no candidate reached bar.
- Round 3: DEGRADED, wall (`You've hit your session limit`); the lane never reviewed. The final tree has had no security review.

## P3 findings carried to the ship card's open findings

- bug-8 (bug lens, round 2): tree-check.ts:137, merge double-scan.
- bug-13 (bug lens, round 3): runs-status.ts:48, unreadable detections log suppresses TELL.
- Correction: the round-3 harvest note said "1 P3 deferred, 3 dismissed"; the log shows 1 P3 deferred (bug-13), 2 dismissed (rule-narrow, split re-file), and 4 P2 applied.

## Gate status

Final round checks (`logs/review-r3-checks.txt`, snapshot 26ba0d0): gate exit 1 on the known
host load flake (88/89 leg controls); host suite 33/33 alone and the full gate green on that
commit, judged environmental, round proceeded; coachman-contract pass.
Post-fix state (`cbd0384`): full `bun run check` green, 2770 pass, 0 fail, 8534 expects
(1306s); coachman-contract self-test 34 passed, 0 failed. Tree clean.
Blind oracle on the final tree: pass 148, fail 2 (both the held-out census count, 236 vs 50),
skip 1. The census remainder is escalated separately and stays open.

## Residue this loop escalates with

- 4 round-3 P2 fixes (bug-9..bug-12, commit cbd0384) applied but not re-reviewed.
- Security lens never reviewed the final tree (opus DEGRADED round 3).
- Census 236 vs ticket 50: oracle C24 fails; needs the acceptance extended from 192 or redirected.
- 2 P3 open findings (bug-8, bug-13); 9 style residue findings.
- Read on non-convergence: the loop is converging (6 fixes, then 1, then 4 after two lenses
  saw the tree twice); round 3's yield is new holes the widened diff exposed (DISABLE shed,
  uncapped traversal, strict markers), not repeats of one class. No repeated class over three
  rounds; no step-5 design-signal stop.
