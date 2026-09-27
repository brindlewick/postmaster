# todo

A small command-line todo list.

## Use

```sh
todo add <text>    # add a task; prints its id
todo list          # the tasks, one per line: id, [ ] or [x], text
todo done <id>     # mark a task done
```

The list is kept in `todo.json` in the working directory, or in the file `TODO_FILE` names.
Exit codes: 0 when a command did what it says, 1 when it could not, 2 for a usage error.

It runs with [Bun](https://bun.sh), which runs TypeScript directly: `bun src/cli.ts list`.

## Develop

```sh
npm install
npm run check      # type-check, lint and format check, then the tests
npm run format     # fix formatting and import order
```
