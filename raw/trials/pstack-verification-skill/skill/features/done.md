# Mark a task done

Done marks the task with the given id as done and prints `done <id>`.

## Sub-features

- `done-mark` marks an open task done.
- `done-again` accepts a task that is already done, with the same output.
- `done-missing` refuses an id the list does not have: exit 1, `no task <id>`, list unchanged.
- `done-id-form` accepts only a positive whole number written plainly.

## How to get to it (user POV)

Run `todo done <id>` with the id that `add` printed or `list` shows. It takes exactly one argument.

## Driving it with control-todo

Preconditions:

- `control-todo doctor` exits 0.
- A label with one task: `control-todo run done1 -- add "buy milk"`.

- **Mark.** Run `control-todo run done1 -- done 1`. stdout is `"done 1\n"`, the exit code is 0, and `list after` has `"done": true` for id 1.
- **Again.** Run the same command a second time. stdout and the exit code are the same.
- **Missing id.** Run `control-todo show done1` and keep the output. Then run `control-todo run done1 -- done 7`: stdout is empty, stderr is `"no task 7\n"`, the exit code is 1. `control-todo show done1` prints the same text as before.
- **Id forms.** Run `control-todo run done1 -- done 01`, then `done 1.5`, `done -1`, `done 1e3` and `done one`. Each prints the usage line to stderr and exits 2.

## Gotchas

- `done` takes one id. `done 1 2` is a usage error and marks nothing.
- Ids are numbers kept in the list file, not positions: they do not change when other tasks change.
