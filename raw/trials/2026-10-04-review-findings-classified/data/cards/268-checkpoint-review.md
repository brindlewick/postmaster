# Review checkpoint — 268, switch-off detection

Loop: style + bug + security in round 1, bug + security in rounds 2 and 3.
Snapshots: round 1 at `8fe7775`, round 2 at `7e07807` then `2d8c9a0` (test-only
guard fix) then `b0f7d8a`, round 3 at `b0f7d8a`. Fixes at `7e07807` (round 1),
`b0f7d8a` (round 2), `2d81c73` (round 3, not re-reviewed).

## Bug lens (rounds 1, 2, 3; lanes luna, mimo)

Round 1 overlap: bug-6 also reported under style. Round 2 overlap: bug-7
also reported under security. Round 3: mimo's report failed to normalize
and was read by hand from `logs/review-r3-bug-mimo.jsonl` (findings at
`logs/review-r3-bug-mimo-findings.md`); mimo also modified its scratch
against the brief (fixes kept out, findings kept on their executed
verification) and ran the full gate there. No lane DEGRADED in any round.

- [P2] bug-1: closed round 1
- [P2] bug-2: closed round 1
- [P3] bug-3: closed round 1
- [P3] bug-4: closed round 1
- [P2] bug-5: closed round 1
- [P2] bug-6: closed round 1
- [P2] bug-7: closed round 2
- [P2] bug-8: closed round 2
- [P2] bug-9: closed round 2
- [P2] bug-10: closed round 2
- [P3] bug-11: open
- [P1] bug-12: closed round 3
- [P2] bug-13: open
- [P2] bug-14: closed round 3
- [P3] bug-15: open
- [P3] bug-16: open

bug-1 `switch-offs.ts:435`: biome-ignore covers the next node but the
identity hashed one line (luna). bug-2 `switch-offs.ts:416`: block closes
popped the whole stack but Oxlint matches by rule set and ignores a bare
enable (luna). bug-3 `postmaster.md:678`: legacy Stage F never ran the
switch-off check (luna). bug-4 `postmaster.md:566`: card-block validation
never compared the pasted Switch-offs section (luna). bug-5
`postmaster.md:568`: the switch-off ask never wrote `.waiting-on-user`
(mimo). bug-6 `coachman.md:1011`: the exit-2 paragraph misdescribed held
and its remedy could not clear it (mimo, style). bug-7
`switch-offs.ts:308`: triple-slash TS suppressions honored but not parsed
(luna, security). bug-8 `switch-offs.ts:334`: linter block rules read the
first line only but Oxlint reads across lines (coachman in triage).
bug-9 `switch-offs.ts:398`: JSX-text double-slash swallowed a trailing
directive (luna). bug-10 `switch-offs.ts:408`: covered lines split
Python-wide while the scanner counts tsc-narrow (mimo). bug-11
`postmaster.md:585`: card section compare written as prose instead of a
scripted check (mimo). bug-12 `switch-offs.ts:135`: an unclosed quote in
JSX text swallowed a trailing directive the tool honors (mimo). bug-13
`switch-offs.ts:687`: the Biome identity stops before an implicit
continuation (luna). bug-14 `log-action.ts:281`: a switch-off record with
no user words was accepted (luna). bug-15 `switch-offs.ts:1063`: refused
entries render unmarked (mimo). bug-16 `switch-offs.ts:838`: a rename
re-asks for a switch-off main already has (mimo).

Dismissed under bug: a scope-relist claim (D8-faithful: the relist errs
safe), Makefile/Cargo gate files (out of the ticket's scope), duplicate
identities under D8 (occurrence correctly excluded), package.json
dependency-only changes (ticket-faithful).

## Security lens (rounds 1, 2, 3; lane opus, own skill)

Round 1 verdict CLEAN apart from three verified P3s. Round 2 carried the
TS and scanner shapes below. Round 3 verdict CLEAN with one correctness
referral (security-12) and four below-the-bar notes, each read and agreed
below the bar (newline-bearing paths print consistently in card and
re-check, duplicate package.json keys need a run that could forge the
approval instead, the postmaster.md quoting note is documentation, the
remaining bypass shapes are the ticket's accepted risk or its fixed D5/D6
lists).

- [P3] security-1: closed round 1
- [P3] security-2: closed round 1
- [P3] security-3: closed round 1
- [P2] security-4: closed round 2
- [P2] security-5: closed round 2
- [P2] security-6: closed round 2
- [P2] security-7: closed round 2
- [P2] security-8: closed round 2
- [P2] security-9: closed round 2
- [P2] security-10: closed round 2
- [P3] security-11: open
- [P2] security-12: open

security-1 `switch-offs.ts:619`: a settings diff path without
`:(literal)` showed an empty diff. security-2 `switch-offs.ts:504`: an
unreadable source blob was silently skipped instead of failing loud.
security-3 `switch-offs.ts:146`: the scanner counted only LF while tsc
splits U+2028. security-4 `switch-offs.ts:309`: TS block directives read
the first line but tsc reads the last. security-5 `switch-offs.ts:555`:
the TS next-line identity missed tsc blank and comment skipping.
security-6 `switch-offs.ts:366`: Biome block directives read the first
line only but Biome reads any line. security-7 `switch-offs.ts:194`: an
apostrophe in JSX text opened a fake string hiding directives.
security-8 `switch-offs.ts:248`: a slash after a condition paren
divide-read hid regex directives. security-9 `switch-offs.ts:249`: a
slash after plus-plus regex-read hid trailing directives. security-10
`switch-offs.ts:199`: strings and regexes ended at U+2028 which ES2019
allows inside. security-11 `switch-offs.ts:211`: a backtick in JSX text
opens a fake template hiding directives (needs a real parser; pinned by
test). security-12 `switch-offs.ts:771`: a block-comment next-line
identity hashes a comment line, not the code the directive covers.

Dismissed under security: symlink blobs (negligible: a symlink cannot
carry a live directive the tools honor).

## Style lens (round 1 only; lanes luna, mimo)

Gates nothing; none applied in review. Two gating findings reported here
(style-1, style-2) were fixed as gating in round 1. Ten findings go to
the ship card's Style residue, as `style-findings count` prints it.

- [P3] style-1: closed round 1
- [P3] style-2: closed round 1
- [P3] style-3: open
- [P3] style-4: open
- [P3] style-5: open
- [P3] style-6: open
- [P3] style-7: open
- [P3] style-8: open
- [P3] style-9: open
- [P3] style-10: open
- [P3] style-11: open
- [P3] style-12: open

style-1 `switch-offs.ts:706` (gating): a later approval overwrote an
earlier refusal. style-2 `postmaster.md:569` (gating, also bug): the ask
named comment-only fields and omitted the settings diff. style-3
`landing.ts:102`: the new import breaks Biome organizeImports order.
style-4 `landing.ts:668`: input faults abandon the landing die() error
shape. style-5 `switch-offs.ts:761`: the lib prints warnings to stderr
instead of carrying them on the report. style-6 `switch-offs.ts:695`:
comment and test promise a warning the code never emits. style-7
`switch-offs.test.ts:66`: the test scratch deviates from the repo tmpdir()
convention. style-8 `switch-offs.test.ts:694`: mode tests and wrap-locked
prose assertions live in the lib test. style-9 `switch-offs.ts:53`:
SwitchComment naming collides with SwitchOffComment. style-10
`switch-offs.ts:44`: the no reason status spelling breaks the hyphenated
convention. style-11 `oracle-268.sh:4`: the oracle claims C10 but
implements half and does not say so. style-12 `landing.ts:69`: the header
states status precedence without its dominance.

## Loop outcome

Round 1 applied 11 gating findings, so round 2 ran. Round 2 logged
verified P1/P2 findings, so round 3 ran. Round 3 logged a verified P1
and verified P2s; `review-decide` prints `CAP 3: round 3 logged a
verified P1 or P2 finding; escalate with residue`. The loop stops at the
cap and escalates (see `ESCALATION.md`): the residue is two P2 findings
held unpatched (bug-13, security-12, one repeated class), two fixes not
re-reviewed (bug-12, bug-14, at `2d81c73`), and four P3 findings carried
to the ship card's open findings (bug-11 with lens bug round 2,
security-11 with lens security round 2, bug-15 with lens bug round 3,
bug-16 with lens bug round 3).

## Gate status

Final round checks, run once on the round 3 snapshot `b0f7d8a`
(`logs/review-r3-checks.txt`): gate pass, exit 0, 1130s (`bun run
check`); coachman-contract pass, exit 0, 9s. Earlier rounds green the
same way (round 1 gate 1212s, round 2 gate 1069s, each plus the contract
self-test). The round 3 fix commit `2d81c73`: gate pass, exit 0
(`bun run check`, 2793 pass, 0 fail, 1155s tests).
