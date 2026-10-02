# Workhorse spec: 218, Every script runs as its TypeScript file, with no .sh wrapper left

## Summary

Delete the 51 `scripts/*.sh` wrappers and run every script through one entry command,
`scripts/run <name> [args]`, which keeps the wrappers' isolation by execing Bun with
`--no-env-file` and the tool's own `bunfig.toml`; rewrite every wrapper reference the
same way across the runbooks, docs, config examples, tests and fixtures.

## Technical context

- **Language and version**: TypeScript on Bun 1.4.2 or newer, as today; the one entry
  `scripts/run` is shell, restricted to constructs POSIX `sh` and bash 3.2 both accept.
- **Dependencies used or added**: none.
- **Testing**: `bun run check` (exit 0) from the worktree root; the contract checker's
  live self-test `scripts/run coachman-contract --self-test` (exit 0); the AC2 isolation
  control pair (entry leaves no marker, plain bun writes it); the AC3 skill-refs
  check/fix proofs; the AC1 reference inventory greps. The run's frozen
  `coachman-contract` check is expected `not run` (exit 127): its dispatch-frozen
  command names a wrapper this ticket deletes, so the run's `verify.sh run` exits 3
  with the gate passing beside it.
- **Constraints**: keep both Bun isolation flags with the tool's own config (proved by
  the AC2 controls, not by reading); the entry works on Linux and macOS 13 or newer
  (no `readlink -f`, no GNU `env` options, no bash newer than 3.2); one form for every
  script including the `.ts` files run directly today; `raw/` trial evidence,
  `oracle-*.sh` past-ticket records and non-wrapper `.sh` names stay untouched; the
  pinned tool checkout the brief names stays on the old form, migrate the worktree
  only; no behavior change in any `.ts` beyond usage strings, child-process argv and
  the two logic changes this spec names (skill-refs, the contract self-test).

## Direction check

- Ticket direction "keep the isolation the wrappers give": the entry execs the same
  `bun --no-env-file --config=<tool>/bunfig.toml <script>` the wrappers ran, with the
  tool root from its own location (`dirname "$0"`), and AC2's control pair proves both
  flags still hold. The `.env` and the preload need different flags, so both stay.
- Ticket direction "the same for every script and every harness": `scripts/run <name>`
  names all 51 previously wrapped scripts, the 6 runnable `.ts` files that have no
  wrapper today (clean-checkout, fixture-lanes, run-clash, summary-evidence,
  synthesis-shares, usage) and `text` (which resolves to `lib/text.ts`); nothing in
  the form branches on harness.
- Project rule "nothing repo-specific": the entry computes the tool root from its own
  path; no hardcoded paths, hosts or users anywhere in the change.
- Project rule "deterministic work goes in scripts/, not in prose": the isolation
  mechanism lives once in the entry, the reference check once in skill-refs; no
  call site repeats the Bun flags.
- Project rule "every count needs a control": AC2 runs as a positive control (plain
  bun writes the marker) and a negative control (the entry leaves none) through the
  identical command shape; the contract self-test keeps its existing controls.
- macOS portability (runs beside #217): the entry uses `#!/usr/bin/env bash` with a
  body POSIX `sh` also accepts: `dirname`, `exec`, `shift`, `case`, `[ -f ]` only.
- In-flight runs keep the wrappers (pinned tool versions); a merge conflict with #217
  or any other run is the postmaster's to resolve at merge, not the lane's.

## Structure

- `scripts/run` (new, executable): the one entry. Resolves `<name>` to
  `scripts/<name>.ts`, else `scripts/lib/<name>.ts`, and execs Bun with both
  isolation flags and the tool's own `bunfig.toml`.
- `scripts/*.sh` (all 51 deleted, including `text.sh`).
- `scripts/*.ts` headers and usage strings: `<name>.sh` becomes `run <name>`,
  `scripts/<name>.sh` becomes `scripts/run <name>`.
- `scripts/*.test.ts` and any `.ts` that spawns a sibling script: argv updated to the
  entry (e.g. `[join(HERE, "run"), "<name>", ...]`).
- `scripts/skill-refs.ts` + `scripts/skill-refs.test.ts`: check and fix the new form.
- `scripts/coachman-contract.ts`: self-test fixtures replicate the new layout and run
  the detector through the entry; `docs/coachman-contract.toml`: listed wrappers
  become the `.ts` files now holding the behavior, detector becomes
  `scripts/coachman-contract.ts`.
- `skills/postmaster/*.md`, `skills/wiki/SKILL.md`: `<tool>/scripts/<name>.sh` becomes
  `<tool>/scripts/run <name>`; bare-bun `.ts` invocations become the entry too.
- `README.md` (the script catalog and prose), `AGENTS.md` (the scripts paragraph and
  every command), `config.example.toml`, `project.example.toml`: same rewrite.
- `package.json` check: `scripts/run skill-refs` and `scripts/run wiki-lint`, the
  rest byte-identical. `.postmaster/project.toml` coachman-contract check:
  `scripts/run coachman-contract --self-test`.
- `fixtures/app/.postmaster/project.toml`, `fixtures/tickets/user.ts`: same rewrite.
- `wiki/` concept pages: live command prose rewritten; dated log entries left alone.
- Untouched: `raw/` (trial evidence), `oracle-*.sh` (past-ticket records, including
  oracle-109's wrapper assertions, which test the pre-218 world by design),
  `scripts/host-self-test.ts` (import-only, not a runnable script), `scripts/lib/`
  (import-only), non-wrapper `.sh` names in tests and fixtures.

## Decisions

- The form is one entry command, `scripts/run <name> [args]`. The executable-`.ts`
  form cannot keep the isolation: a plain `#!/usr/bin/env bun` script run from a
  target directory loads that directory's `.env` and `bunfig.toml` preload (shown by
  execution), `--config` needs a computed path a shebang line cannot carry, and the
  remaining flag trick (`env -S`) is not portable-safe for macOS 13.
- The entry resolves `scripts/<name>.ts` first, then `scripts/lib/<name>.ts`, so
  `text` keeps working with no file move and no special case. The name must not
  contain `/` and must not be `.` or `..`; anything else without a match, including a
  name with a `.sh` suffix, is `run: no such script: <name>` on stderr with exit 2
  (the repo's usage-error exit). No arguments prints usage to stderr with exit 2.
  Bun's own exit propagates, as with the wrappers.
- `scripts/run` is executable and invoked directly, never through a `bash` prefix in
  committed commands (tests exec the path).
- All 58 runnable scripts go through the entry; the bare-bun invocations used today
  (some with isolation flags, `usage.ts` and `run-clash.ts` without) all become
  `scripts/run <name>`. Import-only modules (`host-self-test.ts`, `lib/*.ts`) need
  no entry path.
- skill-refs checks `<tool>/scripts/run <name>` by the entry's resolution rule: it
  faults when `run` is missing and when `<name>` resolves to no script, and an old
  `<tool>/scripts/<name>.sh` reference faults as naming a script the repo does not
  have. Fix mode rewrites exactly the 51 wrapper names from `scripts/<name>.sh` to
  `<tool>/scripts/run <name>`, keeps prefixing other bare `scripts/` paths with
  `<tool>/`, and stays idempotent. The exact combination is the lane's to design;
  the AC3 checks below are the acceptance.
- The contract list swaps each listed `scripts/<name>.sh` for its `scripts/<name>.ts`
  (merging the two entries where both forms were listed), keeps `version = 1`, and
  sets `detector = "scripts/coachman-contract.ts"`. `scripts/run` itself is generic
  plumbing and is not listed. Holds-text that named a wrapper now names the behavior.
- The contract self-test's fixtures copy `scripts/run` (executable), the detector
  `.ts`, `scripts/lib` and `bunfig.toml`; its per-file cases edit the listed `.ts`
  files; its neutering, version, detector, merge and repo-form controls run the
  detector through the entry. The prose anchors in the runbooks the cases edit must
  still match after the rewrite, or the cases move to anchors that do.
- References are rewritten only where they name one of the 51 wrappers or one of the
  6 runnable un-wrapped `.ts` files. Every other `.sh` token (oracle names, fixture
  fakes such as `foo.sh`/`sleeper.sh`, skill-refs' own negative fixtures, prose) and
  every file under `raw/` stays as it is; the AC1 inventory names each exclusion.
- The frozen `verify.sh run` exits 3 with `gate: pass` and `coachman-contract: not
  run, exit 127`; the lane records both lines honestly in its summary. The live proof
  for the detector is `scripts/run coachman-contract --self-test`, exit 0.
- The lane does not dispatch a fixture run; the coachman runs the AC4 fixture run
  from the branch. The lane's AC4 check is `bun run check`, exit 0, with the
  fixture paths converted.

## Showing each criterion

| # | Criterion, as the ticket words it | Check (command and input) | Expected output |
|---|---|---|---|
| AC1 | No scripts/*.sh file remains, and every script runs through one form that AGENTS.md, the README, every runbook, package.json's check, the checks in .postmaster/project.toml and the tests all use. | From the worktree root. (a) `git ls-files 'scripts/*.sh'` prints nothing and `ls scripts/*.sh` fails with no match. (b) `grep -rn '\.sh' --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=raw .` : every hit reviewed; only the spec's documented exclusions remain. (c) `grep -rn 'bun .*scripts/[a-z-]*\.ts' --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=raw .` prints nothing (no bare-bun script invocation survives). (d) Show the one form in each named surface: the `check` line of package.json, the coachman-contract command in .postmaster/project.toml, one runbook line, one test argv line, the README catalog. | (a) empty output, then the shell's no-match error. (b) the exclusion list only, each hit a non-wrapper token, an oracle record, or dated prose. (c) empty output, exit 1 from grep. (d) every shown invocation is `scripts/run <name>` (with the surface's own prefix: `<tool>/` in runbooks, `./` or bare in docs, `join(HERE, "run")` in tests). |
| AC2 | A script run from inside a repository that has its own .env and a bunfig.toml with a preload loads neither: a control preload that writes a marker file leaves no marker, and the same script run there with plain bun writes it. | In a scratch dir (never the worktree): write `.env` with a sentinel, `preload.ts` writing a marker file, `bunfig.toml` with `preload = ["./preload.ts"]`. (a) From inside it, run the worktree's entry on a side-effect-free script: `<wt>/scripts/run turnpikes --list`. (b) From inside it, run `<wt>`'s script with plain bun: `bun <wt>/scripts/turnpikes.ts --list`. (c) Argv proof: prepend a stub `bun` that prints its argv to PATH and run `<wt>/scripts/run turnpikes --list` from inside it. | (a) exit 0, the turnpike list, no marker file. (b) exit 0, the turnpike list, the marker file present. (c) exit 0 and the argv contains `--no-env-file` and `--config=<wt>/bunfig.toml` before the script path. |
| AC3 | skill-refs checks the new form, and its fix mode rewrites the old .sh form. | From the worktree root. (a) `scripts/run skill-refs` exits 0. (b) Copy one runbook file to a scratch copy; plant a bare `scripts/host.sh` reference and a bare `scripts/run stage` reference in the copy; run `scripts/run skill-refs --fix <copy>`, then `scripts/run skill-refs <copy>`; run `--fix` on the copy again. (c) Plant `<tool>/scripts/run no-such-script` in a scratch copy and run `scripts/run skill-refs <copy>`. | (a) exit 0, no faults. (b) fix exits 0 and the copy holds `<tool>/scripts/run host` and `<tool>/scripts/run stage`; check exits 0; the second fix changes nothing (idempotent). (c) exit 1 naming the unresolvable script. |
| AC4 | bun run check passes, and a fixture run dispatched from the branch scores clean, since the runbooks are coachman contract files. | From the worktree root: `bun run check`. Plus `grep -rn '\.sh' fixtures/ package.json .postmaster/project.toml` shows the fixture and check paths converted. | `bun run check` exits 0 (tsc, Oxlint, Biome, the Bun tests, skill-refs, wiki-lint all pass). The fixture grep shows no wrapper reference. The fixture run itself is the coachman's verification from the branch, not the lane's. |

## Tasks

- [ ] T001 [P] [AC1] Write executable `scripts/run` resolving `<name>` to `scripts/<name>.ts` then `scripts/lib/<name>.ts`, refusing `/` and `.`/`..` names with `run: no such script: <name>` (exit 2), usage on no arguments (exit 2), execing `bun --no-env-file --config=<tool>/bunfig.toml` with the tool root from its own path.
- [ ] T002 [AC1] Delete all 51 `scripts/*.sh` files.
- [ ] T003 [AC1] Rewrite usage strings in every `scripts/*.ts` header: `<name>.sh` to `run <name>`, `scripts/<name>.sh` to `scripts/run <name>`.
- [ ] T004 [AC1] Update every sibling-script spawn in `scripts/*.ts` and every script invocation in `scripts/*.test.ts` to the entry argv.
- [ ] T005 [AC3] Rework `scripts/skill-refs.ts` to check `<tool>/scripts/run <name>` by the entry's resolution rule and to rewrite the 51 old-form names in fix mode; update `scripts/skill-refs.test.ts` to the new behavior.
- [ ] T006 [AC4] Convert `docs/coachman-contract.toml` (listed wrappers to their `.ts`, detector to `scripts/coachman-contract.ts`) and rework the self-test in `scripts/coachman-contract.ts` to the new layout; keep every control green.
- [ ] T007 [AC1] Rewrite `skills/postmaster/*.md` and `skills/wiki/SKILL.md`: every wrapper reference and every bare-bun `.ts` invocation to the entry form.
- [ ] T008 [AC1] Rewrite `README.md`, `AGENTS.md`, `config.example.toml`, `project.example.toml` the same way, including the scripts paragraph in AGENTS.md that describes the wrapper mechanism.
- [ ] T009 [AC1] Set package.json's check to `scripts/run skill-refs` and `scripts/run wiki-lint` (rest identical), `.postmaster/project.toml`'s coachman-contract check to `scripts/run coachman-contract --self-test`, and convert `fixtures/app/.postmaster/project.toml` and `fixtures/tickets/user.ts`.
- [ ] T010 [AC1] Rewrite live command prose in `wiki/` concept pages; leave dated log entries, `raw/`, and `oracle-*.sh` alone.
- [ ] T011 [P] [AC1] Run the AC1 inventory greps; review every hit; record the exclusion list under `.postmaster/verify/` with the transcript.
- [ ] T012 [P] [AC2] Run the AC2 control pair and the stub-bun argv proof; keep the transcript under `.postmaster/verify/`.
- [ ] T013 [P] [AC3] Run the AC3 check/fix/idempotency/negative proofs; keep the transcript under `.postmaster/verify/`.
- [ ] T014 [AC4] Run `bun run check` to exit 0 from the worktree root; keep the transcript under `.postmaster/verify/`.
- [ ] T015 [AC4] Run the frozen `/home/brindlewick/.postmaster/tool-pins/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/verify.sh run .` last; record its gate line and its expected `coachman-contract: not run, exit 127` line in WORKHORSE-SUMMARY.md.
