# Which of a script's own tests still pass when the script does nothing

One question: in this repository's tests, how many pass although the script they sit beside has
been replaced by a stub that does nothing, or does the wrong thing every time? Pstack's principle
"test behavior, not implementation" calls such a test one that cannot fail for a defect. The
conclusions are in [pstack](../../../wiki/sources/pstack.md), not here.

## What was run

On 2026-10-05, in a scratch copy of postmaster at commit `a265197` (a plain export of the tree, no
repository), with Bun 1.4.2. For each of 23 scripts `scripts/<name>.ts` that has a test file
`scripts/<name>.test.ts` (57 of the files directly in `scripts/` are such pairs):

1. Run the test file on the unchanged script and note which cases pass (the base).
2. Replace the script by **mutant A**: every runtime export is a function that returns nothing, and
   a script with no exports becomes an empty module, so run as a program it exits 0 and prints
   nothing. Run the same test file.
3. Replace the script by **mutant B**: every runtime export throws, and run as a program the script
   prints one line and exits 70. Run the same test file. Mutant B ran only for the 11 scripts that
   had a survivor under mutant A.
4. Put the script back.

A **survivor** is a case that passed on the base and passed under the mutant. A case that survives
both mutants cannot tell the script working from the script doing nothing or failing every time.
`apparatus/total-mutant.ts` does steps 1 to 4, reading the junit report Bun writes, with
`MUTANT=A` or `MUTANT=B`; `apparatus/intersect.ts` takes the survivors of both.

The 23 scripts were chosen by size of test file and by not needing a service, a network or a
machine-wide change: `review-forms`, `run-log`, `run-times`, `wait-for-markers`, `discover-project`,
`review-page`, `wiki-lint`, `premises`, `reviewers`, `review-decide`, `clerk`, `stage`, `run-clash`,
`skill-refs`, `verify-journey`, `synthesis-shares`, `usage`, `runs-status`, `summary-evidence`,
`ticket-parts`, `ticket-check`, `turnpikes`, `landing`. Test files of scripts that start lanes,
call a tracker or a host were not run. The runs were at the lowest scheduling priority, one after
the other.

## Controls

A pair of files, `apparatus/zzctl.ts` and `apparatus/zzctl.test.ts`, was added to the scratch
copy. Its test file holds two cases that assert a literal result, which must die under both
mutants (the negative control), and three that assert nothing, only that a function exists, or only
an absence, which must survive mutant A (the positive control). The result under mutant A was 3
survivors of 5 and the two real cases died. Under mutant B the case that only checks that the
function exists survived, and the case that calls the function but asserts nothing died, because
the call threw. That is the expected result and is in `results/summary-mutant-a.txt` and
`results/summary-mutant-b.txt`, the first line of each.

A first attempt counted weak matchers (`toBeDefined`, `toBeTruthy`, `toEqual([])`) by syntax. It was
dropped: of the first eight blocks it flagged and that were read, all assert through a helper
function or a thrown error, which a syntax count cannot see.

## What the results hold

- `results/summary-mutant-a.txt`, `results/summary-mutant-b.txt`: per script, the cases on the base,
  under the mutant, and the survivors.
- `results/survivors-mutant-a.txt`, `results/survivors-mutant-b.txt`: the names of the survivors.
- `results/survive-both.out`: the survivors of both mutants, per script.
- `results/turnpikes-other-targets.out`: for the 10 cases of `turnpikes.test.ts` that survive both
  mutants of `turnpikes.ts`, whether they die when another script is the mutated one.
- `results/classification.md`: what each survivor group asserts, by reading the test.

The first run of mutant A named its survivor files without the letter; `apparatus/intersect.ts`
reads either name.

## A count that explains the choice of stub

`results/spawn-count.out`, made by `apparatus/count-spawning-tests.ts`: of the 62 test files, 54 start a process, either by a spawn call (34
files) or by importing the project's process helper and calling it (20 more), so a test that stubs what the test imports cannot see them. The
definition and its two controls are in the file. The test file of `runs-status` imports the process helper and calls the script's status
function in the same process, and is not counted.

## A note on the total line

The last line of `results/survive-both.out` totals only the 11 files that had a survivor of mutant A, and includes the control pair
(5 cases, 3 survivors of A, 1 of both): 620, 62 and 25. The page and `results/classification.md` leave the control out and count all
23 files: 862 cases, 59 survivors of A and 24 of both.

## Limits

A survivor is a case that does not notice the change made, not a proof the case is useless: a case
may watch something the mutated script does not do, such as git or another script. That is why every
survivor of both mutants was read. Cases are matched by name between the base and the mutant, so two
cases of one name count once: `reviewers` has two, which is why its base reads 33 of 34, and no case
of it survived. `verify-journey` has one skipped case, not counted. Only 23 of the 57 test files directly in
`scripts/` were run (the 5 in `scripts/lib/` were not tried), and the others may differ. Two mutants are two ways to
break a script, not all of them. Mutant A for a script with no exports is a program that exits 0 at
once, so a case that asserts only an exit status of 0 survives it; that is a property of command line
scripts, and mutant B is there to tell such cases from cases that observe nothing.
