# Undo the last change

## Problem / feature
A mistaken `todo add` or `todo done` can only be put right by editing todo.json by hand. Users
want to take back what they just did, and to keep taking back changes one at a time.

## Acceptance criteria
1. `todo undo` reverts the most recent change made by `todo add` or `todo done`, prints one
   line saying what it reverted, and exits 0.
2. Each further `todo undo` reverts the change before the one last reverted, back to at least
   the 10th most recent change.
3. With no change left to revert, `todo undo` changes nothing, prints a message to stderr, and
   exits 1.
4. A command that fails or changes nothing is not a change: `todo list`, `todo done` with an id
   not on the list, and `todo done` on a task already done leave nothing for `todo undo` to
   revert.
5. Two lists kept in different files through `TODO_FILE` have separate histories: undoing in
   one never changes the other.
6. A todo.json written before this change still loads, and has nothing to undo until its next
   change.
7. The usage line printed by `todo` with no arguments names the `undo` command.

## Direction
How the history is kept is the design question here, and it is open: what is recorded for each
change, where it is stored, and how much of it is kept. Choose, and give the reason in the
commit that adds it. Keep changes to the list pure functions in `src/tasks.ts`, with the
reading and writing at the edges. Add no dependency. Every criterion has a test in `test/`.

## User journey
The user adds `buy milk` and `post the letter`, then marks the first done by mistake with
`todo done 1`. They type `todo undo` and see one line saying what was undone, and `todo list`
shows both tasks, neither done. They type `todo undo` again and `post the letter` is gone. A
third `todo undo` empties the list, and a fourth says there is nothing to undo.

## Notes
Every command is a separate process, so what can be undone has to outlive the command that made
the change. Out of scope: redo, undoing an undo, and any change to what `todo list` prints.
Which id a task added after an undo gets is left to the implementation.
