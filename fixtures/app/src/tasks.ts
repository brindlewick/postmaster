// The list, and every change to it, as pure functions. Nothing here reads or writes a file or
// prints: src/store.ts keeps the list and src/cli.ts talks to the user.

export type Task = {
  readonly id: number;
  readonly text: string;
  readonly done: boolean;
};

export type TodoList = {
  readonly tasks: readonly Task[];
};

export const emptyList: TodoList = { tasks: [] };

/** Adds a task, not done, with an id one higher than the highest in the list. */
export function addTask(
  list: TodoList,
  text: string,
): { readonly list: TodoList; readonly task: Task } {
  const id = list.tasks.reduce((highest, task) => Math.max(highest, task.id), 0) + 1;
  const task: Task = { id, text, done: false };
  return { list: { tasks: [...list.tasks, task] }, task };
}

/** Marks a task done, or returns undefined when the list has no task with that id. */
export function completeTask(list: TodoList, id: number): TodoList | undefined {
  if (!list.tasks.some((task) => task.id === id)) {
    return undefined;
  }
  return { tasks: list.tasks.map((task) => (task.id === id ? { ...task, done: true } : task)) };
}

export function formatTask(task: Task): string {
  return `${task.id} [${task.done ? "x" : " "}] ${task.text}`;
}

/** One line per task, in the order they were added. */
export function formatList(list: TodoList): string[] {
  return list.tasks.length === 0 ? ["no tasks"] : list.tasks.map(formatTask);
}
