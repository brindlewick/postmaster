// Hidden acceptance tests for ../ticket.md, one describe per acceptance criterion. What undo
// prints, how the history is kept and which id a task added after an undo gets are the run's to
// choose, so nothing here depends on them.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type Task, task, User } from "../../user.ts";

let user: User;
beforeEach(() => {
  user = new User();
});
afterEach(() => {
  user.close();
});

/** Undoes once and checks it reported one line and left the list as expected. */
function undoTo(expected: Task[], who: User = user): void {
  const result = who.todo("undo");
  expect(result.code).toBe(0);
  expect(result.out).toHaveLength(1);
  expect(result.out[0]?.trim()).not.toBe("");
  expect(who.list()).toEqual(expected);
}

function nothingToUndo(who: User = user): void {
  const before = who.list();
  const result = who.todo("undo");
  expect(result.code).toBe(1);
  expect(result.err.join("\n").trim()).not.toBe("");
  expect(who.list()).toEqual(before);
}

describe("1. undo reverts the most recent change", () => {
  test("after an add, the task is gone", () => {
    user.add("buy milk");
    user.add("post the letter");
    undoTo([task(1, "buy milk")]);
  });

  test("after a done, the task is not done", () => {
    user.add("buy milk");
    user.todo("done", "1");
    undoTo([task(1, "buy milk")]);
  });
});

describe("2. each further undo reverts the change before", () => {
  test("change by change, at least ten back", () => {
    const states: Task[][] = [user.list()];
    const change = (...args: string[]) => {
      expect(user.todo(...args).code).toBe(0);
      states.push(user.list());
    };
    for (const text of ["a", "b", "c", "d", "e", "f"]) {
      change("add", text);
    }
    for (const id of [2, 4, 6]) {
      change("done", String(id));
    }
    for (const text of ["g", "h", "i"]) {
      change("add", text);
    }
    for (let undone = 1; undone <= 10; undone++) {
      undoTo(states[states.length - 1 - undone] ?? []);
    }
  });

  test("the user journey: a done, then two adds, then nothing", () => {
    user.add("buy milk");
    user.add("post the letter");
    user.todo("done", "1");
    undoTo([task(1, "buy milk"), task(2, "post the letter")]);
    undoTo([task(1, "buy milk")]);
    undoTo([]);
    nothingToUndo();
  });

  test("an undone change stays undone after a new change", () => {
    user.add("a");
    user.add("b");
    undoTo([task(1, "a")]);
    user.add("c");
    undoTo([task(1, "a")]);
    undoTo([]);
    nothingToUndo();
  });
});

describe("3. with nothing left to undo", () => {
  test("a new list: exit 1, a message on stderr, nothing changed", () => {
    nothingToUndo();
    expect(user.list()).toEqual([]);
  });

  test("once every change is undone", () => {
    user.add("a");
    undoTo([]);
    nothingToUndo();
  });
});

describe("4. a command that fails or changes nothing is not a change", () => {
  test("todo list", () => {
    user.add("a");
    user.todo("list");
    undoTo([]);
    nothingToUndo();
  });

  test("todo done with an id not on the list", () => {
    user.add("a");
    expect(user.todo("done", "9").code).toBe(1);
    undoTo([]);
    nothingToUndo();
  });

  test("todo done on a task already done", () => {
    user.add("a");
    user.todo("done", "1");
    user.todo("done", "1");
    undoTo([task(1, "a")]);
    undoTo([]);
    nothingToUndo();
  });

  test("a usage error", () => {
    user.add("a");
    expect(user.todo("add").code).toBe(2);
    undoTo([]);
  });
});

describe("5. two lists in different files have separate histories", () => {
  test("undoing in one never changes the other", () => {
    const home = user.withFile("home.json");
    user.add("write the report");
    home.add("water the plants");
    user.add("book the room");
    undoTo([], home);
    expect(user.list()).toEqual([task(1, "write the report"), task(2, "book the room")]);
    undoTo([task(1, "write the report")]);
    nothingToUndo(home);
    undoTo([]);
    nothingToUndo();
  });
});

describe("6. a todo.json written before this change", () => {
  const old = [task(1, "a"), task(3, "b", true)];

  test("still loads, and has nothing to undo", () => {
    user.writeOldList(old);
    expect(user.list()).toEqual(old);
    nothingToUndo();
  });

  test("its next change can be undone", () => {
    user.writeOldList(old);
    user.todo("done", "1");
    undoTo(old);
    user.add("c");
    undoTo(old);
    nothingToUndo();
  });
});

describe("7. the usage line names undo", () => {
  test("todo with no arguments", () => {
    const result = user.todo();
    expect(result.code).toBe(2);
    expect(result.err.join("\n")).toContain("undo");
  });
});
