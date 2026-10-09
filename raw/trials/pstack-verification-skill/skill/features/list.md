# List tasks

List prints every task, one per line, in the order they were added.

## Sub-features

- `list-lines` prints `<id> [ ] <text>` for an open task and `<id> [x] <text>` for a done one.
- `list-empty` prints `no tasks` when the list is empty or the list file does not exist.
- `list-readonly` never writes the list file.

## How to get to it (user POV)

Run `todo list` in a terminal. It takes no arguments.

## Driving it with control-todo

Preconditions:

- `control-todo doctor` exits 0.
- A label with two tasks: `control-todo run list1 -- add "buy milk"`, then `control-todo run list1 -- add "post the letter"`.

- **Lines.** Run `control-todo run list1 -- list`. stdout is `"1 [ ] buy milk\n2 [ ] post the letter\n"` and the exit code is 0.
- **Done tasks.** Run `control-todo run list1 -- done 1`, then list again. The first line is `1 [x] buy milk`.
- **Empty.** On a new label, run `control-todo run list2 -- list`. stdout is `"no tasks\n"`, the exit code is 0, and `list after` says `(no list file)`: list creates nothing.
- **Read-only.** Run `control-todo show list1` before and after a `list`. The two outputs are identical.

## Gotchas

- `list` with any argument is a usage error (exit 2). `list all` does not filter.
- The output is plain lines, not JSON. There is no `--json` flag; it is an unknown argument and gives the usage error.
