import { describe, expect, test } from "bun:test";
import { addTask, completeTask, emptyList, formatList, type TodoList } from "../src/tasks.ts";

const two: TodoList = {
  tasks: [
    { id: 1, text: "buy milk", done: false },
    { id: 5, text: "post the letter", done: true },
  ],
};

describe("addTask", () => {
  test("gives the first task id 1, not done", () => {
    const { list, task } = addTask(emptyList, "buy milk");
    expect(task).toEqual({ id: 1, text: "buy milk", done: false });
    expect(list.tasks).toEqual([task]);
  });

  test("gives a task an id one higher than the highest in the list", () => {
    expect(addTask(two, "water the plants").task.id).toBe(6);
  });

  test("adds to the end and leaves the list it was given alone", () => {
    const { list } = addTask(two, "water the plants");
    expect(list.tasks.map((task) => task.text)).toEqual([
      "buy milk",
      "post the letter",
      "water the plants",
    ]);
    expect(two.tasks).toHaveLength(2);
  });
});

describe("completeTask", () => {
  test("marks the task done and leaves the others as they were", () => {
    expect(completeTask(two, 1)?.tasks).toEqual([
      { id: 1, text: "buy milk", done: true },
      { id: 5, text: "post the letter", done: true },
    ]);
  });

  test("returns undefined for an id the list does not have", () => {
    expect(completeTask(two, 2)).toBeUndefined();
    expect(completeTask(emptyList, 1)).toBeUndefined();
  });
});

describe("formatList", () => {
  test("gives one line per task: id, a box ticked when done, and the text", () => {
    expect(formatList(two)).toEqual(["1 [ ] buy milk", "5 [x] post the letter"]);
  });

  test("says so when there are no tasks", () => {
    expect(formatList(emptyList)).toEqual(["no tasks"]);
  });
});
