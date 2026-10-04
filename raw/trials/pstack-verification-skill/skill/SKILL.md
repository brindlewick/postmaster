---
name: verify-todo
description: "Drive the todo command-line app the way a user does: add tasks, list them and mark them done against a list file of its own, then capture the command, output, exit code and stored list as proof. Use for /verify-todo, 'verify the todo CLI', or to show that a change to todo works."
---

# Verify todo

`todo` is a command-line todo list run with Bun: `bun src/cli.ts <command>`, the `todo` bin in `package.json`. It has three commands (`add`, `list`, `done`), no server, no port and no login. Its whole state is one JSON file. This page is written for an agent that reads it cold, in the middle of a task.

`control-todo` below stands for `bun .cursor/skills/verify-todo/control-todo.ts`.

## Launch

There is nothing to start. Each command is a short process that reads the list file, does one thing and exits. Running it needs Bun (`bun --version` prints a version) and no `npm install`; the install is only for the gate (`npm run check`).

Give every drive a list file of its own, so that no drive touches a real list. `control-todo run <label> -- <todo arguments>` runs `bun src/cli.ts <todo arguments>` with `TODO_FILE` set to a file named by the label, inside the helper's own folder. Two labels are two independent lists, so two drives can run side by side. Never run the app by hand with `TODO_FILE` unset: it then reads and writes `todo.json` in the working directory, which is somebody's real list. Two processes on one list file are not safe (each reads, changes and writes the whole file, with no lock), so give each its own label.

## Doctor

`control-todo doctor` is read-only. Run it before the first drive, and again after any drive that failed or surprised you. It prints the Bun version and the revision under test (`+ uncommitted src changes` when the code differs from the commit). It exits 1, naming the problem, when `package.json` no longer names `src/cli.ts` as the `todo` bin, when `src/cli.ts` is missing, or when a `todo.json` sits in the repository root.

## Drive

`control-todo run <label> -- <todo arguments>` runs one command, prints the proof block and appends it to the label's proof file. `control-todo show <label>` prints the label's stored list, read-only. The recipe for each user-facing feature is in `features/`; start at [features/README.md](features/README.md), which lists them. For a broad pass, walk the index top to bottom.

Every proof block carries the exit code: 0 when the command did what it said, 1 when it could not, 2 for a usage error.

## Evidence

A proof block holds the command, stdout, stderr, the exit code and the stored list after the command. The proof standards:

- Run the real command as a process. Never import `main` or call `src/tasks.ts` to show behavior; the unit tests do that.
- For a command that should change the list, show the stored list after it. For one that should change nothing, run `control-todo show <label>` before and after and show that the two are identical.
- There is no external system, so there is nothing to mock.
- Say what a drive proved and the label it ran under. Report a feature you could not reach with the command you tried; never report it as verified through another.

Proof files are in `$TODO_VERIFY_PROOF`, or in `todo-verify-proof/` in the system temp folder: one text file per label. A proof file only grows: `run` appends, and `cleanup` keeps it. Use a new label for a new session, or the file mixes the two.

## Cleanup

`control-todo cleanup` removes the list files and leftover `.tmp` files this helper made, and the folder that held them. It never touches the proof files, and it never kills a process: the app leaves none running. Run it after every drive session, and after a failed attempt too.

## Helpers

`control-todo.ts` (Bun, no dependencies) runs through `bun`. Its commands:

- `doctor`: the check above.
- `run <label> -- <todo arguments>`: one command against the label's list.
- `show <label>`: the label's stored list, as written.
- `path <label>`: the label's list file path, for a recipe that must write a bad list by hand.
- `cleanup`: the cleanup above.

`TODO_VERIFY_DIR` and `TODO_VERIFY_PROOF` move the list folder and the proof folder.

## Feature map

The behavior inventory lives in [`features/`](features/). Each file uses the same four H2s: `Sub-features`, `How to get to it (user POV)`, `Driving it with control-todo`, `Gotchas`.
