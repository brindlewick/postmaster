# The list file

The list lives in one JSON file: the file `TODO_FILE` names, or `todo.json` in the working directory when it is not set.

## Sub-features

- `store-env` uses the file `TODO_FILE` names.
- `store-default` uses `todo.json` in the working directory when `TODO_FILE` is unset or empty.
- `store-corrupt` refuses a file that is not a todo list: exit 1, one error line, the file left as it was.
- `store-whole` writes the list whole, through a temporary file, so a failed write never leaves half a list.

## How to get to it (user POV)

Set `TODO_FILE` to choose where the list lives, or run `todo` in a folder and find `todo.json` there. Open the file in an editor to read or change it by hand.

## Driving it with control-todo

Preconditions:

- `control-todo doctor` exits 0.
- The label is new. `control-todo path store1` prints its list file path.

- **Env file.** Run `control-todo run store1 -- add "buy milk"`, then `control-todo show store1`. The file at the path `control-todo path store1` prints holds the task.
- **Not JSON.** Write `not a list` to that path, then run `control-todo run store1 -- add x`. stderr is `todo: <path> is not valid JSON`, the exit code is 1, and `control-todo show store1` still prints `not a list`.
- **JSON that is not a list.** Write `{"tasks": 3}` to the same path and run `control-todo run store1 -- list`. stderr is `todo: <path> does not hold a todo list` and the exit code is 1.
- **No leftovers.** After any command that succeeds, the list folder holds no `.tmp` file.

## Gotchas

- Run without `TODO_FILE` and the app uses `todo.json` in the current folder, which is somebody's real list. The helper always sets it, and runs the app in its own list folder.
- Two processes on one list file can lose a task: each reads, changes and writes the whole file, with no lock. Give each drive its own label.
- `todo.json` is git-ignored, so a stray one does not show in `git status`.
