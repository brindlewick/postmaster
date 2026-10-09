# Checkpoint review: #202

Nine review rounds ran against the synthesis. Round 1 ran all lenses
(style, bug, security); rounds 2 to 9 ran the gating lenses (bug,
security) on the fixed diff, closure-checking each fix and hunting new
holes. Rounds 1 to 3 ran under the runbook's three-round cap and ended
as review-decide printed it (CAP 3: round 3 logged a verified P1 or P2
finding; escalate with residue). Rounds 4 to 9 each ran under a fresh
user ruling after an escalation, with the loop decided by hand because
review-decide refuses a round past 3. Round 7 ended with a user-ruled
rescope: a finding comes only from an observed change, what a lane's
commands name outside its folder is a note, and the command classifier
was removed; rounds 8 and 9 judged the rescoped check. Round 9 verified
two P2s; the user ruled choice B (fix them plus one P3, each with a
failing test first, no round 10), so the loop ends with three fixes
applied on the user's word and not re-reviewed.

Deviations to record. Round 2 fixed bug-18, a P3, where the runbook
fixes P1 and P2 only from round 2 on; the fix was small, test-guarded,
and verified closed, so it stands. Rounds 4 to 7 ran no reach
before/check/restore step, because the run's pinned tool has no
reach.ts and no before snapshot exists for any round; each round noted
that, and no round applied fixes under an outcome that needed a
restore. Rounds 8 and 9 ran reach before/check/restore from the
synthesis worktree, at snapshots 092e163 and dec1100. Round-4 bug-luna
was DEGRADED (its review turn failed to load workspace requirements)
and was launched again in round 5. Round-8 security-opus attempt 1 was
DEGRADED (provider session limit, no report) and was retried on the
same snapshot, with attempt-1 files kept. Mimo's review output failed
to normalize in several rounds and was read by hand each time, per the
runbook.

## Findings (bug)

The bug lens ran all nine rounds with two lanes each (luna, mimo).
Round 1 verified 12 gating findings and 1 dismissal; round 2 verified
4 gating findings, 1 P3, and 2 dismissals; round 3 verified 3 gating
P2 findings, 1 P3, and 1 dismissal. Round 4 verified 2 P1 and 2 P3;
round 5 verified 4 P2, 2 P3, and 3 dismissals; round 6 verified 1 P2,
5 P3, and 1 dismissal; round 7 verified 1 P1, 4 P2, 1 P3, and 1
dismissal. Round 8 verified 3 P3 (its P2 came under the security
lens); round 9 verified 2 P2 and 5 P3 (its sixth P3 came under the
security lens). Two round-1 findings were reported under two lenses
each (bug-1 under bug and style, bug-4 under bug and style) and are
single findings kept under bug.

- bug-1, refusal attribution hides a successful write beside a denial:
  reported by bug-luna and style-mimo, verified by execution.
- bug-2, a write after a newline reads as a read: reported by bug-mimo,
  verified by execution.
- bug-3, bare cd and cd under an environment variable ignored: reported
  by bug-mimo, verified by execution.
- bug-4, the git block misses escapes (branch and tag names, dropped
  operands, redirects off git): reported by bug-mimo and style-mimo,
  verified by execution.
- bug-5, the shell-group rewrite flips inside reads to notes: reported
  by bug-mimo, verified by execution.
- bug-6, reads outside the home directory and the project not exempt,
  and tool-checkout and brief reads unreachable: reported by bug-luna,
  verified by execution.
- bug-7, the restore lane match is greedy on hyphenated names: reported
  by bug-luna, verified by execution.
- bug-8, one worktree touch claims every unexplained file change:
  reported by bug-mimo, verified by execution.
- bug-9, pipe-ampersand is not a separator: reported by bug-mimo,
  verified by execution.
- bug-10, a substitution consumed by a write command reads as a read:
  reported by bug-mimo, verified by execution.
- bug-11, hostile filenames break the card block: reported by bug-luna,
  verified by execution.
- bug-12, round-change places mislabelled inside: found by the
  coachman's own probe, verified by execution.
- bug-13, branch delete on a run-owned ref: reported by bug-mimo.
- bug-14, git subprocesses honor inherited directory overrides:
  reported by bug-luna, verified by execution.
- bug-15, substitutions inside double quotes skipped: reported by
  bug-luna, verified by execution.
- bug-16, a rider claims file changes its move did not produce:
  reported by bug-mimo, verified by execution.
- bug-17, the card reason is not escaped: reported by bug-mimo,
  verified by execution.
- bug-18, append-both and noclobber redirects missed: raised from a
  bug-mimo note by the coachman, verified by execution.
- bug-19, double-pipe splitting: reported by bug-luna.
- bug-20, fixture voids failing the score: reported by bug-mimo.
- bug-21, descriptor-duplication redirects invent a path write:
  reported by bug-mimo, verified by execution.
- bug-22, restore faults instead of reattaching a detached synthesis
  worktree: reported by bug-luna, verified by execution.
- bug-23, an unreadable task transcript still counts as checked:
  reported by bug-luna, verified by execution.
- bug-24, branch names unescaped on the card: reported by bug-luna,
  verified by reading plus a git validity probe.
- bug-25, ignored files invisible to status checks: reported by
  bug-luna.
- bug-26, a write redirect onto a substitution target reads as a read:
  reported by bug-mimo, verified by execution.
- bug-27, a write or delete under a glob or an unset variable reads
  clean: reported by bug-mimo, verified by execution.
- bug-28, cp and mv source over-reported with a substitution
  destination: reported by bug-mimo, verified by execution.
- bug-29, a workhorse missing from manifest lanes is skipped instead of
  not checked: reported by bug-mimo, verified by reading.
- bug-30, file tools drop a path holding a variable or a glob:
  reported by bug-mimo, verified by execution.
- bug-31, a git equals-flag reads as a path: reported by bug-mimo,
  verified by execution.
- bug-32, program text misread: reported in round 5, dismissed as a new
  capability beyond the ticket.
- bug-33, a bare write operand is dropped: reported by bug-luna,
  verified by execution.
- bug-34, an MCP shape misread: reported in round 5, dismissed for no
  genuine occurrence with the shape unpinned.
- bug-35, the card prints a not-checked reason as the lane wrote it:
  reported by bug-luna, verified by execution.
- bug-36, the round reach step restores after a faulted check: reported
  by bug-mimo, verified by reading.
- bug-37, a fixture void failing the score: reported in round 5,
  dismissed because bug-20 stands.
- bug-38, a sed script operand read as a path: reported by bug-mimo,
  verified by execution.
- bug-39, ordinary commands with patterns read not checked: reported by
  bug-mimo, verified by execution.
- bug-40, git refspecs read as paths: reported by bug-mimo, verified by
  execution.
- bug-41, XDG exemptions wider than the lane's own data: reported by
  bug-luna, verified by execution.
- bug-42, option-bearing cd commands unscanned: reported by bug-luna,
  verified by execution.
- bug-43, an unlistable task log reads clean: reported by bug-luna,
  verified by execution.
- bug-44, the reach helpers unlisted in the contract: reported by
  bug-luna, verified by reading.
- bug-45, an opus runRefs note: reported in round 6, dismissed as an
  exact mechanism with an unreachable trigger.
- bug-46, a substitution split hides writes: reported by bug-mimo,
  verified by execution.
- bug-47, cp roles confused under substitution: reported by bug-mimo,
  verified by execution.
- bug-48, ln and install sources misread: reported by bug-mimo,
  verified by execution.
- bug-49, the sed long in-place form missed: reported by bug-mimo,
  verified by execution.
- bug-50, a repository path with a space faults every check: reported
  by bug-luna, verified by execution.
- bug-51, restore faults on a deleted run branch: reported by bug-luna,
  verified by execution.
- bug-52, fixture lanes doubted: reported in round 7, dismissed because
  lanes are always emitted.
- bug-54, fixture score reports reach ok on a tied workhorse
  main-checkout change: reported by bug-luna in rounds 8 and 9,
  verified by execution.
- bug-55, status-letter diffing misses content changes to already-dirty
  files: reported by bug-mimo, verified by execution with an
  unreachable in-flow precondition.
- bug-56, moveProduced true on ticket-branch create or delete: reported
  by bug-mimo, verified by execution with unreachable in-flow triggers.
- bug-57, the synthesis guard passes a symlinked worktree and restore
  then resets the main checkout: reported by bug-luna, verified by
  execution.
- bug-58, only the first tied reviewer is voided: reported by bug-luna,
  verified by execution.
- bug-59, codex mcp tool calls count as recognized while nested MCP
  arguments go uninspected: reported by bug-luna, verified by reading.
- bug-60, a call carrying both a command and a path skips the path:
  reported by bug-mimo, verified by reading.
- bug-61, the tokenizer splits inside quotes and mis-notes spaced
  paths: reported by bug-mimo, verified by reading.
- bug-62, every void reads unexplained round change when any
  unexplained tracked change exists: reported by bug-mimo, verified by
  reading.
- bug-63, loadSnapshot accepts refs null and fails later with a poor
  diagnosis: reported by bug-mimo, verified by reading.

- [P1] bug-1: closed round 1
- [P1] bug-2: closed round 1
- [P2] bug-3: closed round 1
- [P2] bug-4: closed round 1
- [P2] bug-5: closed round 1
- [P2] bug-6: closed round 1
- [P2] bug-11: closed round 1
- [P3] bug-7: closed round 1
- [P3] bug-8: closed round 1
- [P3] bug-9: closed round 1
- [P3] bug-10: closed round 1
- [P3] bug-12: closed round 1
- [P2] bug-13: dismissed: consistent with C12, which voids without escalation
- [P2] bug-14: closed round 2
- [P2] bug-15: closed round 2
- [P2] bug-16: closed round 2
- [P2] bug-17: closed round 2
- [P3] bug-18: closed round 2
- [P1] bug-19: dismissed: splits correctly, verified by execution
- [P2] bug-20: dismissed: criterion 17 fails a run whose check found a reach
- [P2] bug-21: closed round 4
- [P2] bug-22: closed round 4
- [P2] bug-23: closed round 4
- [P3] bug-24: open
- [P2] bug-25: dismissed: C3 scopes status checks to non-ignored files
- [P1] bug-26: closed round 5
- [P1] bug-27: closed round 5
- [P3] bug-28: closed round 8
- [P3] bug-29: open
- [P2] bug-30: closed round 6
- [P3] bug-31: closed round 8
- [P2] bug-32: dismissed: program text is a new capability beyond the ticket
- [P2] bug-33: closed round 8
- [P2] bug-34: dismissed: no genuine occurrence, shape unpinned
- [P2] bug-35: closed round 6
- [P2] bug-36: closed round 6
- [P3] bug-37: dismissed: a fixture void stands under bug-20
- [P3] bug-38: closed round 8
- [P2] bug-39: closed round 7
- [P3] bug-40: closed round 8
- [P3] bug-41: closed round 8
- [P3] bug-42: closed round 8
- [P3] bug-43: closed round 8
- [P3] bug-44: closed round 7
- [P3] bug-45: dismissed: exact mechanism, unreachable trigger
- [P1] bug-46: closed round 8
- [P2] bug-47: closed round 8
- [P3] bug-48: closed round 8
- [P2] bug-49: closed round 8
- [P2] bug-50: closed round 8
- [P2] bug-51: closed round 8
- [P2] bug-52: dismissed: lanes are always emitted
- [P3] bug-54: open
- [P3] bug-55: open
- [P3] bug-56: open
- [P2] bug-57: applied on user word, not re-reviewed
- [P2] bug-58: applied on user word, not re-reviewed
- [P3] bug-59: open
- [P3] bug-60: open
- [P3] bug-61: open
- [P3] bug-62: open
- [P3] bug-63: open

Every finding closed round 8 for the classifier family (bug-28, bug-31,
bug-33, bug-38, bug-40 through bug-43, bug-46 through bug-49) closed by
the user-ruled rescope removal, which round 8 reviewed on the rescoped
head. Every applied fix from rounds 1 to 8 was re-reviewed in a later
round; none came back. The three round-9 fixes ship without re-review
under choice B.

## Findings (security)

The security lens ran all nine rounds with one lane (opus). Round 1
verified 6 gating findings, all closed in round 1; rounds 2 to 7 each
reported clean after reviewing the fixed diff. Round 8 verified one P2
below the lane's own reporting threshold, which the coachman triaged
and fixed; round 9 verified one P3, fixed under choice B without
re-review. The lens rests on that single lane throughout.

- sec-1, restore resets unmoved branches and wipes uncommitted work:
  reported by security-opus, verified by execution.
- sec-2, git configuration values never skipped: reported by
  security-opus, verified by execution.
- sec-3, refs named by git reads counted as writes: reported by
  security-opus, verified by execution.
- sec-4, reset climbs when the synthesis metadata is missing: reported
  by security-opus, verified by execution.
- sec-5, waybill paths read from the wrong section: reported by
  security-opus, verified by execution.
- sec-6, a second restore wipes the saved copy: reported by
  security-opus, verified by execution.
- bug-53, the card prints unresolved non-absolute paths verbatim:
  reported by security-opus, verified by execution.
- bug-64, a refs-prefixed token with dot-dot and a glob or variable
  prints verbatim on the card: reported by security-opus, verified by
  execution.

- [P1] sec-1: closed round 1
- [P2] sec-2: closed round 1
- [P2] sec-3: closed round 1
- [P2] sec-4: closed round 1
- [P3] sec-5: closed round 1
- [P3] sec-6: closed round 1
- [P2] bug-53: closed round 9
- [P3] bug-64: applied on user word, not re-reviewed

## Findings (style)

The style lens ran round 1 with two lanes (luna, mimo) and rested
there; it runs round 1 alone by design. Two of its reports were gating
defects, fixed as gating findings in round 1. Seven style findings go
to the ship card's Style residue, as style-findings.sh count prints.

- style-1, quoted shell text misread as a redirect: a gating defect
  reported by style-luna, verified by execution, fixed in round 1.
- style-2, a fully missing reach section on the card: reported by
  style-luna.
- style-3, thin wrappers and a shadowed name: reported by style-mimo.
- style-4, a dead recomputation loop: reported by style-mimo.
- style-5, a third shell tokenizer and path helper: reported by
  style-mimo.
- style-6, a misleading display-name helper: reported by style-mimo.
- style-7, a thin module header: reported by style-mimo.
- style-8, the catalog entry missing: reported by style-mimo.
- style-9, the card root unresolved through symlinks: a gating defect
  raised from a style-mimo note, verified by execution, fixed in
  round 1.
- style-10, an unused call parameter: reported by bug-mimo in round 2
  as a note, kept under style.

- [P2] style-1: closed round 1
- [P2] style-2: dismissed: specified for old tools, unreachable with the new one
- [P3] style-3: open
- [P3] style-4: open
- [P3] style-5: open
- [P3] style-6: open
- [P3] style-7: open
- [P3] style-8: open
- [P3] style-9: closed round 1
- [P3] style-10: open

The seven open style findings are Style residue for aftercare, not
ship blockers; style findings are never applied in the review leg.

## P3 findings carried to the ship card

- bug-24, branch names unescaped on the card: bug lens, round 3, open.
- bug-29, a workhorse missing from manifest lanes skipped: bug lens,
  round 4, open.
- bug-54, fixture score reach ok on a tied workhorse change: bug lens,
  rounds 8 and 9, open.
- bug-55, status-letter diffing misses dirty-file content changes: bug
  lens, round 8, open.
- bug-56, moveProduced true on ticket-branch create or delete: bug
  lens, round 8, open.
- bug-59, nested MCP arguments uninspected: bug lens, round 9, open.
- bug-60, a command-plus-path call skips the path: bug lens, round 9,
  open.
- bug-61, the tokenizer splits inside quotes: bug lens, round 9, open.
- bug-62, every void reads unexplained round change: bug lens, round 9,
  open.
- bug-63, loadSnapshot accepts refs null: bug lens, round 9, open.

## Gate and checks

Final checks, run once each at the merged head f28a02b after the last
code change: gate pass, exit 0, 1807s (bun run check: tsc, Oxlint,
Biome format, 2978 Bun tests across 62 files, skill-refs, wiki-lint);
coachman-contract pass, exit 0, 34 of 34; oracle pass, exit 0, 310s
(22 of 22). Full gate output in logs/review-final-checks.txt. The
branch merged origin/main at c92d5fa as f415de7 and carries four
commits after it; WORKHORSE-SPEC.md was removed before the
card and does not land. The synthesis worktree is clean at f28a02b;
every applied fix is committed there. Per-round checks live in
logs/review-r1-checks.txt through logs/review-r9-checks.txt.
