# What the survivors assert, by reading the test

Read on 2026-10-05 at postmaster commit `a265197`. The names are in `survivors-mutant-a.txt`,
`survivors-mutant-b.txt` and `survive-both.out`. The totals are in `summary-mutant-a.txt` and
`summary-mutant-b.txt`: 23 test files, 862 cases, 860 passing on the base, 59 surviving mutant A and
24 surviving both mutants (the control file's 3 and 1 are not counted).

## Survive mutant A and die under mutant B: 35 cases

Mutant A is a script that does nothing and exits 0. A case survives it when it asserts an exit
status of 0, or that nothing was reported, written or flagged. Four were read:

- `summary-evidence`, "--ticket reads a waybill's ticket part": asserts exit status 0, and that
  the ticket file exists. The test's own set-up writes that file before the run.
- `clerk`, "brief leaves one label holding a comma alone": a negative control; a script that does
  nothing also leaves the label alone.
- `runs-status`, "the postmaster's own directory is not a run": asserts an empty result.
- `ticket-check`, "Notes and User journey are optional" (one of 21 such cases in that file): a
  positive control that a well-formed ticket passes.

Mutant B, a script that fails every time, kills all 35. These cases do notice a script that
crashes. They cannot tell a script that works from one that does nothing and succeeds.

## Survive both mutants: 24 cases

None of the 24 observes the script that was mutated. Read, they are five groups.

- **`landing.test.ts`, 5 cases** (Z1, AA5, AB2, AC6 twice): each runs `git for-each-ref` on a
  repository the test built and asserts what git prints. The script is never run. They pin an
  assumption about git that the script relies on.
- **`turnpikes.test.ts`, 10 cases:** each walks a run through the poll, the hand-off check and the
  stage script. `results/turnpikes-other-targets.out` shows all 10 die when `runs-status`, `stage`
  or `handoff-check` is the mutated script. They observe those scripts.
- **`skill-refs.test.ts`, 2 cases:** one runs the eleven shell blocks of a runbook in bash and in
  zsh and compares them; the other changes a quoting in one of those blocks and asserts the calls
  differ. They test the runbook text. The second is a hand-written mutation test of a runbook.
- **`stage.test.ts`, 1 case:** tests a temporary-file helper: names differ, mode 0600, bytes kept.
  It does not run the stage script.
- **`ticket-parts.test.ts`, 6 cases:** negative controls such as "plain words, a version number and
  a site name are not files". Each asserts that the findings of one kind are an empty list. The
  helper that reads the findings ignores the exit status, so a checker that crashes gives an empty
  list and the case passes. Six of the file's 76 cases. Each is the negative half of a pair: the five
  blocks they sit in hold 51 cases, and the other 45, which assert a finding, die under both
  mutants.

So of the 24, 18 watch something else (git, another script, a runbook, a helper), and 6 are
negative controls that a crashed script satisfies.
