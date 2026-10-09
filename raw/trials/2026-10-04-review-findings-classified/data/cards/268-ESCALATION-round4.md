# Escalation — 268 round 4: verified P1/P2 findings, nothing applied

Supersedes the round-3 escalation (ruled on: window direction plus round
4, user's word "a and yes", 2026-10-04 ~22:20Z). Round 4 ran on that
ruling at `4a789d3` (window fix `a4dd635`, spec note `4a789d3`, plus the
re-reviewed `2d81c73`), bug lens (luna, mimo) and security lens (opus),
all three lanes REVIEWED, no timeouts. Triage verified 2 P1 + 2 P2 + 3
P3, all by execution. Per the round-4 orders, nothing is applied: there
is no round 5 without a new ruling from the user.

## Verified P1

- security-13 (`switch-offs.ts:73`, opus): a divide after `!` or after a
  keyword-like member opens a fake regex that eats a trailing directive.
  `size! / 2; // @ts-ignore …`, `range.of / 2; // …` and `of / 2; // …`
  all report `clear`, exit 0, while tsc honors each ignore (exit 0 with,
  error without). The `!` shape is everyday TypeScript. Advice: read `!`
  as postfix (divide follows a value, `)` or `]`), read a keyword after
  `.`/`?.` as an identifier, and read `of` outside a `for` head as an
  identifier; pin each shape beside the plus-plus test. The same root
  also skews brace depth when the fake regex swallows a `{`, which can
  shorten a window — the fix should cover both.
- security-14 (`switch-offs.ts:126`, opus): a quote after member
  modifiers, `extends`, `default`, `module` or a spread never opens, so
  a `/*` inside the literal opens a phantom block comment that swallows
  later directives. `readonly "/api/*"` above a live `// @ts-ignore`
  reports `clear` while tsc parses and honors the file. `declare module
  "*.css"` is the everyday trigger. Advice: extend `QUOTE_EXTRA` and
  `REGEX_AFTER` as the lane lists, plus the backstop (search block
  bodies after every `//` and `/*` — over-listing only asks more).

## Verified P2

- bug-17 (`switch-offs.ts:677`, luna): identical twins share one
  approval identity. Two identical directives over identical windows
  list the same id twice, and one approval record marks both approved
  (`clear`, exit 0) — C6's "each one" and C7's one line per switch-off
  break. Advice: hash a per-occurrence discriminator, stable across
  line moves, into the approval id (occurrence order survives merges;
  a reorder re-asks, safe).
- bug-18 (`switch-offs.ts:897`, opus + luna): five honored settings
  names are unlisted. Probed against the pinned binaries:
  `.oxlintrc.jsonc`, `oxlint.config.ts` and `oxlint.config.mts` are
  honored by Oxlint 1.86 (error-level rule fires), `.biome.json` and
  `.biome.jsonc` by Biome 2.5 (rule-off honored); `settingsKind` knows
  none of them. Advice: add the five names, one entry each per the
  ticket's rule, update the spec's fifth note, and pin a test per name.

## Verified P3 (carried, not applied)

- security-15 (`switch-offs.ts:298`, opus): the `2d81c73` rescan reads
  regex bodies as code (`noRegex`), so `\/*` or a backtick inside a
  rescanned regex opens a phantom comment/template that swallows the
  next line's directive — confirmed a regression (pre-`2d81c73` lists
  it, post misses it). Same finding: the reparse looks only for a
  later `//`, so a URL plus a `/*` directive on one tsx line is missed
  (predates `2d81c73`). P3 because both need contrived tsx shapes and
  a deliberate run has the simpler documented path already.
- bug-19 (`switch-offs.ts:793`, mimo + opus): a block window excludes
  the directive's own lines, but Oxlint suppresses trailing code on
  the opener's line (probed); editing it keeps the id. P3 for the
  rarity of the shape; both lenses agree.
- security-16 (`switch-offs.ts:889`, opus): removing the first of two
  identical main comments mispairs the survivor by order, listing it
  with `no reason` (exit 3) — a false hold, fails closed. P3.

## Not findings

- mimo-3 (exit-4 refused identification) duplicates open bug-15; folded
  there, no new id.
- luna-2 (recheck after the merge-word wait) dismissed: the TOCTOU is
  real on reading, but it predates this ticket, covers every check
  (the gate too), and only the user can advance the branch during the
  wait — the run has handed off. A switch-off-only recheck would be
  incoherent. Recommend a landing-integrity ticket.
- mimo-1 (ESLint block pairing) dismissed: the code is correct under
  the probed Oxlint semantics (bare enable after a named disable is a
  no-op, exit 0), ESLint is not installed and cannot be probed here,
  and the ticket's tool set is the probed one. Recommend documenting
  the Oxlint semantics.

## Residue and advice

Branch at `4a789d3`, gate green. Round 4 re-reviewed `2d81c73` (its
rescan gained security-15) and the window (which gained bug-17,
bug-18 in part, and security-16). Open: 2 P1 + 2 P2 above; P3s from
rounds 2–4 (7) plus 10 style items for the card. My advice: fix the
two P1s and two P2s on this branch, then ask the user for round 5 —
the fixes touch the scanner core and the settings list, and an
unreviewed scanner change is exactly what round 4 just caught.
