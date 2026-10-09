# Escalation — 268 review leg: cap reached with a repeated class

Two independent stops fired at once. `review-decide` prints `CAP 3:
round 3 logged a verified P1 or P2 finding; escalate with residue`,
and the identity-coverage class below was found in three consecutive
rounds. The loop stops; stage 3 (ship card, handoff-2) waits on the
ruling.

## The repeated class

The identity's covered-code approximation misses code the tool
actually covers, so an approval survives a change to the covered
code. Each round closed the sites it could name; the next round
found another of the same kind:

- Round 1: bug-1 — the Biome identity hashed one line while Biome
  covers the next node. Closed with `biomeCovered()` (bracket
  continuation) in `7e07807`.
- Round 2: security-5 — the TS next-line identity missed tsc's blank
  and comment skipping. Closed with `tsCovered()` skipping in
  `b0f7d8a`.
- Round 3: bug-13 — the Biome identity stops before an implicit
  (operator) continuation; security-12 — a block-comment next-line
  identity hashes a comment line, not the code after the comment.
  Both verified by execution (identity byte-identical across a
  covered-code change). HELD UNPATCHED per the repeated-class rule:
  patching the fourth site is the named anti-pattern.

## Why it is not converging

Each tool and form computes "covered code" with its own
approximator, and each tool's real coverage rule (Biome nodes, tsc
skipping, Oxlint line attribution across comment shapes) keeps
exceeding its approximation. The fix that removes the class is to
make the approximation conservative by construction: hash a wide
window (the covered line plus following lines to end of file, or
the enclosing block) so any later edit re-asks. Over-approximation
errs toward asking, which is the safe direction, at the cost of
friction when unrelated later edits re-ask. That safety-vs-friction
tradeoff is the ruling asked below. Watch, not escalated: JSX-text
detection shapes appeared in rounds 2 and 3; round 3's is fixed
generally (rescan, not one punctuation), so the class has two
rounds, not three.

## Residue

- Open P2, unpatched (the class): bug-13
  (`scripts/lib/switch-offs.ts:687`), security-12
  (`scripts/lib/switch-offs.ts:771`).
- Applied but not re-reviewed, at `2d81c73`: bug-12 (P1, unclosed
  quote in JSX text swallowed a live directive) and bug-14 (P2, a
  switch-off record with no user words was accepted). Verified
  without a review round: 4 new/extended tests fail pre-fix and
  pass post-fix, both lane repros close, oracle 55/55, sweep 100
  merges with 93 clear and the same seven non-clear (5 exit 2, 2
  exit 3), gate pass exit 0 (`bun run check`, 2793 pass, 0 fail).
- Open P3, carried to the ship card's open findings: bug-11 (bug,
  round 2), security-11 (security, round 2), bug-15 (bug, round 3),
  bug-16 (bug, round 3).
- Style residue: 10 items to aftercare; the card says the lens
  rested on 2 lanes in round 1.

## Ruling asked

1. Identity class direction: the conservative window (and how
   wide), continued site patches, or another shape?
2. After the ruling's fix lands: run round 4 past the cap to
   re-review `2d81c73` and the class fix? A round past the cap
   needs its own ruling; this asks for it in the same breath.
