#!/usr/bin/env bun
// The command line. It reads the arguments, runs one command against the stored list and prints
// the result. Exit codes: 0 when the command did what it says, 1 when it could not, 2 for usage.

import { load, save, storePath } from "./store.ts";
import { addTask, completeTask, formatList } from "./tasks.ts";

export const USAGE = "usage: todo add <text> | todo list | todo done <id>";

export type Output = {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
};

export async function main(args: readonly string[], path: string, output: Output): Promise<number> {
  try {
    return await run(args, path, output);
  } catch (error) {
    output.err(`todo: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

async function run(args: readonly string[], path: string, { out, err }: Output): Promise<number> {
  const [command, ...rest] = args;
  switch (command) {
    case "add": {
      const text = rest.join(" ").trim();
      if (text === "") {
        err(USAGE);
        return 2;
      }
      const { list, task } = addTask(await load(path), text);
      await save(path, list);
      out(`added ${task.id}`);
      return 0;
    }
    case "list": {
      if (rest.length > 0) {
        err(USAGE);
        return 2;
      }
      for (const line of formatList(await load(path))) {
        out(line);
      }
      return 0;
    }
    case "done": {
      const id = rest.length === 1 ? parseId(rest[0]) : undefined;
      if (id === undefined) {
        err(USAGE);
        return 2;
      }
      const list = completeTask(await load(path), id);
      if (list === undefined) {
        err(`no task ${id}`);
        return 1;
      }
      await save(path, list);
      out(`done ${id}`);
      return 0;
    }
    default:
      err(USAGE);
      return 2;
  }
}

/** A task id as typed: a positive whole number, written plainly. */
export function parseId(arg: string | undefined): number | undefined {
  if (arg === undefined || !/^[1-9][0-9]*$/.test(arg)) {
    return undefined;
  }
  const id = Number(arg);
  return Number.isSafeInteger(id) ? id : undefined;
}

if (import.meta.main) {
  const code = await main(process.argv.slice(2), storePath(process.env, process.cwd()), {
    out: (line) => console.log(line),
    err: (line) => console.error(line),
  });
  process.exit(code);
}
