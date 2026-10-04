# A first look at pstack's verification skill

What was run, against which version, and what was compared. The conclusions are in
[pstack](../../../wiki/sources/pstack.md), not here.

## What was run

- **The skill.** `/create-verification-skill` from the pstack plugin, in the cursor/plugins
  repository at commit `23e4138daa01c42d4969f7a5465f82704e64f798`, file
  `pstack/skills/create-verification-skill/SKILL.md`, plugin version 0.15.6. It is a Cursor skill.
  It was not run through Cursor. An agent session read the file and followed its steps by hand, once,
  on 2026-10-04.
- **The target.** A scratch copy of the `todo` fixture app: the tree of `fixtures/app` at postmaster
  commit `8157c7a`, the same tree at `5c58c83`, committed as the copy's first commit. The app has three
  commands, `add`, `list` and `done`, and keeps its tasks in a JSON file. It declares three checks in
  `fixtures/app/.postmaster/project.toml`: its gate (`npm run check`), the transcripts in a ticket's
  user journey, and one process-level add and list.
- **The steps, as the skill gives them.** Read the repository, not the user, for how to launch, check,
  drive and clean up the app. Write a project-local skill with launch, doctor, drive, evidence,
  cleanup and helper sections. Write a map of the app's user-facing features. Run the skill once, end
  to end, before handing it over.
- **Time and tokens.** 8 minutes of wall time and about 80,000 tokens, from the session's own clock
  and counters. Not recorded here.

## What it produced

`skill/` holds the folder the skill made, `.cursor/skills/verify-todo/` of the copy, as it stood at the
end: `SKILL.md` (57 lines), `control-todo.ts` (144), and `features/` with an index (44) and five features
(30 to 32 lines each). That is eight files and 400 lines. Two edits were made to the generated files
after the skill's own proof, and they are in the files as kept:

1. A sentence in `SKILL.md`, "A proof file only grows", with the advice to use a new label for a new
   session. It answers a miss of the walk below.
2. The project's formatter, `npm run format`, run over `control-todo.ts`, because the project's gate
   (`npm run check`) stopped at its format check on that file.

The files as first generated were not kept.

## What was done with it

1. **The walk**, `apparatus/walk.sh`. It runs every recipe in the feature map through the helper and
   checks each claim the map makes, 37 in all, against what the app prints, exits with and stores.
   Before the claims it runs a wrong expectation and requires it to be reported as a failure, which is
   the control. After the claims it runs 30 parallel `add` commands on one list file, three rounds, and
   counts the tasks stored and the ids repeated. Its output on the app as the skill left it is
   `walk.out`.
2. **After a change.** The reference solution of the fixture ticket `remove`,
   `fixtures/tickets/remove/reference.patch`, was applied to a copy of the app that holds the same
   skill files, and the same walk was run on it: `walk-after-remove.out`.

## What was kept and what was not

The two outputs are from a re-run of the walk made on 2026-10-04, after the look, on the files in
`skill/`. The look's own output was shown in the conversation and not kept. So four things from the look
are not in this record: the first walk's output, on which 36 of the 37 claims held, the miss being the
walk's own check, which counted proof blocks and did not allow for a proof file growing across runs;
the files as first generated; the failing gate run; and the time and tokens.

The race rounds are not repeatable. They stored 11, 6 and 8 tasks of 30 in the first walk and 12, 12 and
10 in the second.

Two changes were made to the script and the output. In `walk.sh` the app copy and the scratch directory
are arguments, where the script as run had them written in. In both outputs the scratch path in the
line `removed 7 list file(s); proof kept in ...` is replaced by `<scratch>`.

## To repeat

Make a git repository of a copy of `fixtures/app`, put `skill/` at `.cursor/skills/verify-todo/` in it,
and run `apparatus/walk.sh <the copy> <a scratch directory>` with Bun 1.4.2. For the second output,
apply the reference patch to the copy first.
