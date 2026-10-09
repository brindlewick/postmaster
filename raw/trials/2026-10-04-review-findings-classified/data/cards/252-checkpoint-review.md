# Review checkpoint, run 252

Loop ended by `review-decide.sh` round 3 with: `CAP 3: round 3 logged a verified
P1 or P2 finding; escalate with residue`. The loop stops at the three-round cap
with round-3's fixes applied but not re-reviewed; see `ESCALATION.md`. Round-3's
security lane was also degraded (no verdict), so the security lens has not
reviewed the round-3 snapshot either.

Rounds: bug ran 1-3; style ran 1 only, per the loop; security reviewed rounds
1-2 and was degraded in round 3.

## Lanes

- Round 1: style luna REVIEWED (1 finding), style mimo REVIEWED (10 findings),
  bug luna REVIEWED (9 findings), bug mimo REVIEWED (7 findings), security opus
  REVIEWED (clean).
- Round 2: bug luna REVIEWED (5 findings), bug mimo REVIEWED (3 findings),
  security opus REVIEWED (clean).
- Round 3: bug luna REVIEWED (8 findings), bug mimo REVIEWED (5 findings),
  security opus DEGRADED, cause session limit, ran without tool use, no verdict.

## Bug lens

Overlap: bug-1 was reported under bug by both lanes and under style by mimo;
bug-3 and bug-5 under bug by both lanes. The round-1 dry-run host refusals
(bug-12) were re-reported in round 3 and deduped, still carried. The round-2
pin-regex and missing-note P3s were re-reported in round 3 and deduped.

- [P1] bug-1: closed round 1
- [P1] bug-2: closed round 1
- [P2] bug-3: closed round 1
- [P2] bug-4: closed round 1
- [P2] bug-5: closed round 1
- [P3] bug-6: closed round 1
- [P3] bug-7: closed round 1
- [P3] bug-8: closed round 1
- [P3] bug-9: closed round 1
- [P3] bug-10: closed round 1
- [P3] bug-11: closed round 1
- [P3] bug-12: open
- [P1] bug-13: dismissed: format-patch includes binary payloads without the flag, shown by execution
- [P2] bug-14: closed round 2
- [P2] bug-15: closed round 2
- [P2] bug-16: closed round 2
- [P2] bug-17: closed round 2
- [P2] bug-18: closed round 2
- [P3] bug-19: open
- [P3] bug-20: open
- [P2] bug-21: dismissed: success logging stays C13-exact, a carried synthesis decision with no new evidence
- [P1] bug-22: closed round 3
- [P2] bug-23: closed round 3
- [P2] bug-24: closed round 3
- [P2] bug-25: closed round 3
- [P3] bug-26: open
- [P3] bug-27: open
- [P3] bug-28: open
- [P3] bug-29: open
- [P2] bug-30: dismissed: success logging re-reported, same carried decision, no new evidence

What each id is: bug-1 tar and git bytes corrupted by UTF-8 decode; bug-2
preview pid reuse signalling another group; bug-3 preview left yet exit 0;
bug-4 `.worktrees` read errors scanning as empty; bug-5 substring run-log
check and wordless-rerun fault; bug-6 tracker post then log failure reposting;
bug-7 dry run refusing a torn lock; bug-8 rename second path misparsed;
bug-9 tracker-kind dry-run exit; bug-10 waiting rows omitted; bug-11 markers
read before the lock; bug-12 dry run promising close-run success; bug-13
format-patch `--binary`; bug-14 dirty submodules removed unsaved; bug-15
unbranched merges omitted from patches; bug-16 locked worktree dry-run
promise; bug-17 reconcile substring over-match; bug-18 live preview holding
the dry run; bug-19 teardown target carrying `, which was not clean`;
bug-20 preview-left branch without a note; bug-21 success logging;
bug-22 inherited git overrides redirecting scans; bug-23 locked pin dry-run
promise; bug-24 quoted paths missing flags; bug-25 plane adapter argv;
bug-26 lock creation steal; bug-27 folder-loop faults omitting closing rows;
bug-28 other-tracker wordless rerun; bug-29 same-folder pid reuse; bug-30
success logging.

## Style lens

Rested on 2 lanes in round 1. Overlap: style-1 is gating by nature and was
fixed as one; the unions finding was reported by both lanes as one.

- [P3] style-1: closed round 1
- [P3] style-2: open
- [P3] style-3: open
- [P3] style-4: open
- [P3] style-5: open
- [P3] style-6: open
- [P3] style-7: open
- [P3] style-8: open
- [P3] style-9: open
- [P3] style-10: open

What each id is: style-1 symlink-to-file dropped from the plan (gating);
style-2 dry-run close narrower than real close (gating, carried with bug-12);
style-3 free-string statuses; style-4 presence then bytes double git runs;
style-5 raw parser duplication; style-6 finish parameters and triple
bookkeeping; style-7 skipped/already comment wording; style-8 marker literal
coupling; style-9 set/set_ naming; style-10 plan printing steps before folders.

8 findings go to the ship card's Style residue, as `style-findings.sh count`
prints it (style-3 through style-10).

## Security lens

Rounds 1-2 reviewed clean by opus: no findings at its bar either round. Round
3 has no security verdict: the lane hit its session limit and ran without
tool use (DEGRADED). The round-3 snapshot and the round-3 fixes have had no
security review.

## Carried to the ship card's open findings

P3 findings the loop carried, each with its lens and round: bug-12 (bug, r1),
style-2 (style, r1), bug-19 (bug, r2), bug-20 (bug, r2), bug-26 (bug, r3),
bug-27 (bug, r3), bug-28 (bug, r3), bug-29 (bug, r3).

## Gate

Final round's checks, run once on its snapshot d2e17a8 by `verify.sh`:

- gate: pass, exit 0, 1253s: bun run check
- coachman-contract: pass, exit 0, 10s

The ticket's blind oracle scores 189/189 on d2e17a8
(`logs/oracle-review3.log`). The round-3 fixes (a6ed189) re-ran the full gate
green after the loop stopped (`logs/review-postr3-checks.txt`: gate pass exit
0, 1321s; coachman-contract pass exit 0, 9s), with 29/29 aftercare tests and
the blind oracle at 189/189 (`logs/oracle-postr3.log`); their review
verification still needs a ruling (see `ESCALATION.md`).
