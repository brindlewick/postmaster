# Which harness versions the runs were dispatched with

One question for candidate 3 of [pstack](../../../wiki/sources/pstack.md): how fast do the installed
versions of the harnesses move under the facts this wiki rests on, as the project's own run records show it?
The conclusions are in that page, not here.

## What was read

On 2026-10-05, the `run.json` of every run folder of this repository's project, 40 files. The file's
`harness_versions` map holds what each configured harness printed for `--version` when the run was
dispatched (`scripts/run-meta.ts` writes it), and its `written` field the time. `apparatus/versions-by-run.ts`
prints one row per run, in `results/versions-by-run.tsv`, and `results/first-last.out` gives for each version the
number of runs and the first and last time. Nothing was run and no run folder was changed. Some of the 40 are
parked copies of a ticket's earlier run, so a ticket can appear twice.

**Controls.** The map is present in all 40 files, and holds exactly four keys, `claude`, `codex`, `mimo`
and `muse`. A version string that no run holds (`2.1.999 (Claude Code)`) matches 0 runs.

## What it does not show

Only the runs that exist as folders, from 2026-09-29, the day the field began. The version at dispatch is
not the version a later leg ran on: a harness may update itself between legs, and the field is written
once. It does not show a harness's build id, so a rebuilt executable that keeps its version string (the MiMo
Code fork) reads as the same version.
