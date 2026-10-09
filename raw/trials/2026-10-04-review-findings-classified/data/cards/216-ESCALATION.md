# Escalation: round 4 logged verified P2 findings, run 216

Round 4 ran on the user's word ("ok go for another round", 2026-10-04 ~21:50Z,
taken as choice (a)). Snapshot `cbd0384`; checks green (gate 1234s, contract 8s).
All three lanes REVIEWED: bug luna 4 items, bug mimo 6, security opus no
vulnerabilities at bar plus 3 defects outside its scope. Scratches clean, torn
down; synthesis clean. Nothing applied, per the ruling.

Triage verified 7 gating P2 findings, each by execution. There is no round 5 and
no fix round without a new ruling from the user, so the leg stops here.

## Verified P2 (all need fixes)

- bug-14 (bug/mimo, scrub-core.ts:700): `MAIL.test` on a `/g/` regex without a
  reset; successive bare key-kind fields miss `key` intermittently. Probed:
  call 2 of 3 missed, exactly as filed.
- bug-15 (bug/luna, raw-promote-main.ts:169): promote keeps the
  `encrypted_content` field with a placeholder, tree-check flags the field's
  presence regardless of value. Probed: promote exit 0, tree-check exit 1 on
  the promoted record. Success deadlocks the gate.
- bug-16 (bug/luna, tree-check.ts:89 + raw-promote-main.ts:222): reasoning
  findings never call `logFinding` in either script. Probed: gate fails with
  no detections.jsonl row. TELL and the card are blind to the whole class.
- bug-17 (bug/mimo, scrub-check-main.ts:654): `--pr-description` and card scans
  log draft rows to detections.jsonl. Probed all three legs: rows land, TELL
  fires, `privateDataBlock` dies "finding has no resolution". One dirty draft
  sticks landing until someone invents a resolution.
- sec-2 (security/opus, scrub-rewrite.ts:319): the manual-reword refusal prints
  the raw path. Probed: a file named `(zzz@corp.internal` prints its value on
  stderr, violating ticket rule 10 and C10. `safePath` handles all four shapes
  correctly; the fix is one call.
- sec-3 (security/opus, scrub-rewrite.ts:201): `git show -s --format=%B`
  appends one newline past the stored message, so every recreated commit gains
  a newline and a new id. Probed byte-level, plus end-to-end: a pushed,
  untouched commit was rewritten and the branch can't push (non-fast-forward).
  Breaks C18 ("rewrites only unpushed commits"). Each pass adds one more `\n`.
- sec-4 (security/opus, bundle-scrub.ts:52): header line 2 and the unanchored
  GENERATED pattern sit outside the body digest. Probed: injected live code on
  line 2 passes `--check` exit 0 and runs. Same class as round-1 bug-4 (P2).

## Deferred and dismissed

- P3 bug-18 (bug/mimo, scrub-check-main.ts:499, by reading): marker rows are
  logged for author/committer but skipped for messages; one side is wrong.
  Goes to the ship card's open findings with bug-8 and bug-13.
- Dismissed: luna tool-owned-scans P1 (re-file, contradicts D17, no new
  evidence); luna JSON-depth P2 (64 string layers need ~2^64 chars, unreachable
  — unlike bug-11's structural nesting at 2 chars a layer); mimo 20-char token
  floor (specified: long values, first-version minimums, golden-pinned);
  mimo's valueFromField/join notes (no defect shown); fragmented literals
  (ticket-sanctioned, as round 1).
- Closures hold: bug-9 (51-suspect census renders), bug-10 (full-DISABLE
  promote still scrubs), bug-11 (66-deep nesting flagged), bug-12
  (marker-breaking JSON refused, nothing promoted).
- No three-round repeated class: the nearest repeats (DISABLE r1+r3, markers
  r3+r4 aspects) span two rounds each. No design-signal stop.

## Advice

Grant a fix round for the 7 P2s, then a closure round: the sec-3 history churn
and bug-17 landing deadlock both break ticket guarantees (C18, and the
reword-and-rescan loop behind C29), and bug-14/sec-2/sec-4 are holes in the
gate's own redaction and integrity. The fixes are small and local (a reset, a
field drop or placeholder accept, two log calls, a log suppression or filter, a
safePath, a message-strip or cat-file read, a digest widening plus anchor), but
sec-3's message handling and bug-17's log routing deserve a reviewer's second
look after the fix. If the user would rather ship with known holes, the card
should carry all 7 as open, and C18 stays red.
