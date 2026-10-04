# todo verification map

This directory is the maintained source for verifying the user-facing behavior of todo. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Bun is installed and `control-todo doctor` exits 0.
- Every drive uses a list file of its own: `control-todo run <label> -- ...` keeps one in the helper's folder, named by the label. The default `todo.json` is never used.
- Start each recipe from an empty list, which means a new label, unless its preconditions say otherwise.
- There is no instance to share: each command is a process this run starts and that exits by itself.

## Driving conventions

- Treat every command as literal. Everything after `--` goes to todo unchanged.
- Read the exit code with the output: 0 did what it said, 1 could not, 2 usage error.
- After a command that should change the list, read the list back with the proof block's `list after` line or `control-todo show`.
- After a command that should change nothing, compare `control-todo show` before and after.
- Cleanup removes lists and never proof files.

## Proof and skip reporting

- Capture the command, stdout, stderr, exit code and stored list for every drive; `run` writes all five to the label's proof file.
- Record the feature ID and the label with every proof.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped feature as verified through a different one.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with control-todo` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, required state, commands, and observable proof.

## Features

- [Add a task](./add.md) covers storing a task, joining words, ids and persistence.
- [List tasks](./list.md) covers the line format, the empty list and that list writes nothing.
- [Mark a task done](./done.md) covers marking, marking again, a missing id and the id forms.
- [Usage errors](./usage.md) covers no arguments, unknown words and wrong arguments.
- [The list file](./store.md) covers `TODO_FILE`, the default file and a file that is not a list.
