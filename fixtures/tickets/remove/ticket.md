# Remove tasks by id

## Problem / feature
A task added by mistake stays on the list for good: the only way to get rid of it is to edit
todo.json by hand. `todo remove` deletes tasks by id.

## Acceptance criteria
1. `todo remove <id>` deletes the task with that id, prints `removed <id>`, and exits 0.
2. `todo remove` takes several ids, as in `todo remove 3 1`, deletes each, and prints one
   `removed <id>` line per id in the order given. An id given more than once is deleted and
   printed once.
3. If any id given is not on the list, `todo remove` deletes nothing, prints nothing to stdout,
   prints `no task <id>` to stderr for the first such id in the order given, and exits 1.
4. `todo remove` with no id, or with any argument that is not a positive whole number, deletes
   nothing, prints nothing to stdout, prints the usage line to stderr, and exits 2, whether or
   not the other ids are on the list.
5. The tasks that remain keep their ids, their text, whether they are done, and their order in
   `todo list`.
6. An id is never used twice: a task added after a remove gets an id one higher than the
   highest id the list has ever had, counting ids since removed.
7. A todo.json written before this change still loads, and its highest id counts as one the
   list has had, so a task added after that task is removed still gets a higher id.
8. The usage line printed by `todo` with no arguments names the `remove` command.

## Direction
Follow the existing split: the change to the list is a pure function in `src/tasks.ts`, and
`src/cli.ts` and `src/store.ts` do the reading and writing. Add no dependency. Every criterion
has a test in `test/`.

## User journey
In a directory whose list has three tasks, the user types `todo list` and sees ids 1, 2 and 3.
They type `todo remove 2` and see `removed 2`. `todo list` shows tasks 1 and 3 as they were.
`todo add call the bank` prints `added 4`.

## Notes
Users refer to tasks by id, so a new task that took a removed task's id would make an old note
or a line in their shell history point at the wrong task. Out of scope: removing every done
task at once, confirmation prompts, and undo.
