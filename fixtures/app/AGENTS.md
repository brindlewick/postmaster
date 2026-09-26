# todo

A small command-line todo list in TypeScript, run with Bun. `README.md` says what it does and
how to use it.

## Layout

- `src/tasks.ts`: the list and every change to it, as pure functions. No file access, no output.
- `src/store.ts`: where the list is kept, `todo.json` or the file `TODO_FILE` names. Parsing and
  serialising are pure; `load` and `save` touch the file system.
- `src/cli.ts`: the command line. It reads the arguments, runs one command, prints, and returns
  the exit code.
- `test/`: `bun test` files, one per module.

## Rules

- Keep the core pure. A change to the list is a function in `src/tasks.ts` that returns a new
  list; reading, writing and printing stay in `src/store.ts` and `src/cli.ts`.
- Every change comes with its tests in `test/`.
- Add a dependency only when the change cannot be made without one.
- The gate is `npm run check`: type-check, lint and format check, then the tests. Work is done
  when it passes. `npm run format` fixes formatting and import order.

## Risk surfaces

It reads and writes one file, the one `TODO_FILE` names or `todo.json` in the working
directory. It binds no port, serves nothing, spawns nothing and holds no secrets.
