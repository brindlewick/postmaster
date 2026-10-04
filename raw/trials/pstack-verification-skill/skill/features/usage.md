# Usage errors

A command todo cannot read prints one usage line to stderr and exits 2. Nothing is written.

## Sub-features

- `usage-none` covers no arguments at all.
- `usage-unknown` covers a first word that is not `add`, `list` or `done`, including `help` and flags.
- `usage-args` covers a known command with the wrong arguments: `add` with no text or only spaces, `list` with any argument, `done` with no id, a bad id, or more than one.

## How to get to it (user POV)

Run `todo` with nothing, with a word it does not know, or with a known command and the wrong arguments.

## Driving it with control-todo

Preconditions:

- `control-todo doctor` exits 0.
- The label is new.

- **No arguments.** Run `control-todo run u1 --`. stdout is empty, stderr is `"usage: todo add <text> | todo list | todo done <id>\n"`, the exit code is 2, and `list after` says `(no list file)`.
- **Unknown word.** Run `control-todo run u1 -- help`. The stderr and the exit code are the same.
- **Blank add.** Run `control-todo run u1 -- add "  "`. The stderr and the exit code are the same, and there is still no list file.
- **Extra argument.** Run `control-todo run u1 -- list all`. The stderr and the exit code are the same.

## Gotchas

- There is no `--help` or `--version`. Both are unknown words and give exit 2.
- The usage line goes to stderr, never stdout. A recipe that reads only stdout sees nothing.
