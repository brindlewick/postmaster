// Where the list is kept: a JSON file, todo.json in the working directory unless TODO_FILE names
// another. Parsing and serialising are pure; load and save are the only functions here that
// touch the file system.

import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { emptyList, type Task, type TodoList } from "./tasks.ts";

/** The file exists but does not hold a todo list. */
export class StoreError extends Error {}

export function storePath(env: Readonly<Record<string, string | undefined>>, cwd: string): string {
  return resolve(cwd, env.TODO_FILE || "todo.json");
}

export function parseList(text: string, path: string): TodoList {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new StoreError(`${path} is not valid JSON`);
  }
  if (!isRecord(data) || !Array.isArray(data.tasks) || !data.tasks.every(isTask)) {
    throw new StoreError(`${path} does not hold a todo list`);
  }
  return { tasks: data.tasks.map(({ id, text, done }) => ({ id, text, done })) };
}

export function serializeList(list: TodoList): string {
  return `${JSON.stringify(list, null, 2)}\n`;
}

/** The stored list, or an empty one when the file does not exist yet. */
export async function load(path: string): Promise<TodoList> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return emptyList;
    }
    throw error;
  }
  return parseList(text, path);
}

/** Writes the list whole, through a temporary file, so a failed write never leaves half a list. */
export async function save(path: string, list: TodoList): Promise<void> {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, serializeList(list));
  await rename(temporary, path);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTask(value: unknown): value is Task {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    typeof value.text === "string" &&
    typeof value.done === "boolean"
  );
}
