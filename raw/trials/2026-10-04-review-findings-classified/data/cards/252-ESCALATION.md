# Escalation: review loop hit the three-round cap

`review-decide.sh` round 3 printed: `CAP 3: round 3 logged a verified P1 or P2
finding; escalate with residue`. The loop stops; each further round needs its
own ruling. This file carries the residue and my read on why the loop did not
converge. The full per-finding record is `checkpoint-review.md`.

## Residue needing a ruling

1. **Round-3 fixes applied but not re-reviewed** (commit a6ed189 on branch
   252): bug-22 (P1, inherited git overrides redirecting scans), bug-23 (P2,
   locked pin dry-run promise), bug-24 (P2, quoted paths missing flags),
   bug-25 (P2, plane adapter argv). Each has a regression test that fails
   pre-fix and passes post-fix; the head is gate-green
   (`logs/review-postr3-checks.txt`) and oracle-clean at 189/189
   (`logs/oracle-postr3.log`). No review round has closure-checked them.
2. **Security lens missing a verdict on the round-3 snapshot.** Round 3's
   opus lane hit its session limit and ran without tool use (DEGRADED), so
   neither d2a5e88 nor a6ed189 has had a security review. Rounds 1-2 were
   security-clean.
3. **Open P3 findings for the ship card** (8): bug-12 and style-2 (dry-run
   host preflight, carried as needing read-only host introspection the
   ticket does not provide), bug-19 (teardown target suffix), bug-20
   (preview-left note), bug-26 (lock creation steal), bug-27 (folder-loop
   faults omitting closing rows), bug-28 (other-tracker wordless rerun),
   bug-29 (same-folder pid reuse). Plus the Style residue (8 findings).

## Why it is not converging

Two things, one structural and one about this tool.

First, the repeated class is dry-run/real-run parity: round 1 found the
tracker-kind exit divergence, round 2 the live-preview hold and the locked
worktree, round 3 the locked pin. Each round closed the sites it could name
and the next found another of the same kind. The design signal is that the
dry run re-implements every real-run decision inline, so each new refusal
the real run grows needs its own predicted twin; the ticket's D9 structures
it this way, so convergence means enumerating every refusal, and locks took
two rounds (folders, then pins). A fourth round may well find the next
refusal-shaped gap — most likely around host state, which the ticket keeps
out of the dry run's enumerated reads.

Second, the P1s are narrowing, not repeating: round 1's was any non-UTF-8
file (broad, silent loss), round 3's an inherited `GIT_DIR` (environmental,
narrow). Reviewers are correctly hammering a deletion tool's
save-then-remove paths, and each fix held under its regression test, the
gate, and the oracle. Severity-weighted, the loop is converging; it simply
did not reach zero inside three rounds.

## Recommendation

Rule a round 4 (bug and security lenses) on a6ed189: it closure-checks the
four round-3 fixes and gives security the verdict round 3 denied it. If the
ruling instead accepts the residue, the fixes rest on their regression
tests, the green gate, and the clean oracle, and the leg continues to stage
3 with items 2 and 3 above on the ship card.
