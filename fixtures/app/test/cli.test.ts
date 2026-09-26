import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, parseId, USAGE } from "../src/cli.ts";

let dir: string;
let path: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "todo-cli-"));
  path = join(dir, "todo.json");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function todo(...args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(args, path, { out: (l) => out.push(l), err: (l) => err.push(l) });
  return { code, out, err };
}

describe("add and list", () => {
  test("add prints the new task's id and list shows it", async () => {
    expect(await todo("add", "buy", "milk")).toEqual({ code: 0, out: ["added 1"], err: [] });
    expect(await todo("add", "post the letter")).toEqual({ code: 0, out: ["added 2"], err: [] });
    expect(await todo("list")).toEqual({
      code: 0,
      out: ["1 [ ] buy milk", "2 [ ] post the letter"],
      err: [],
    });
  });

  test("list says so when there are no tasks", async () => {
    expect(await todo("list")).toEqual({ code: 0, out: ["no tasks"], err: [] });
  });
});

describe("done", () => {
  test("marks the task done", async () => {
    await todo("add", "buy milk");
    expect(await todo("done", "1")).toEqual({ code: 0, out: ["done 1"], err: [] });
    expect((await todo("list")).out).toEqual(["1 [x] buy milk"]);
  });

  test("an id the list does not have is exit 1 and changes nothing", async () => {
    await todo("add", "buy milk");
    const before = readFileSync(path, "utf8");
    expect(await todo("done", "7")).toEqual({ code: 1, out: [], err: ["no task 7"] });
    expect(readFileSync(path, "utf8")).toBe(before);
  });
});

describe("usage", () => {
  test.each([
    [[]],
    [["help"]],
    [["add"]],
    [["add", "  "]],
    [["list", "all"]],
    [["done"]],
    [["done", "one"]],
    [["done", "1", "2"]],
  ])("%j prints the usage line and exits 2", async (args) => {
    expect(await todo(...args)).toEqual({ code: 2, out: [], err: [USAGE] });
  });
});

describe("a store that does not hold a list", () => {
  test("is reported, exit 1, and left as it was", async () => {
    writeFileSync(path, "not a list");
    const result = await todo("add", "buy milk");
    expect(result.code).toBe(1);
    expect(result.err).toEqual([`todo: ${path} is not valid JSON`]);
    expect(readFileSync(path, "utf8")).toBe("not a list");
  });
});

describe("parseId", () => {
  test("takes a positive whole number, written plainly", () => {
    expect(parseId("1")).toBe(1);
    expect(parseId("42")).toBe(42);
  });

  test("refuses anything else", () => {
    for (const arg of [
      undefined,
      "",
      "0",
      "-1",
      "1.5",
      "01",
      "1e3",
      " 1",
      "12345678901234567890",
    ]) {
      expect(parseId(arg)).toBeUndefined();
    }
  });
});

describe("the command", () => {
  test("runs as a process, with the list in the file TODO_FILE names", () => {
    const run = (...args: string[]) =>
      Bun.spawnSync([process.execPath, join(import.meta.dir, "../src/cli.ts"), ...args], {
        cwd: dir,
        env: { PATH: process.env.PATH ?? "", TODO_FILE: path },
      });
    const added = run("add", "buy milk");
    expect(added.exitCode).toBe(0);
    expect(added.stdout.toString()).toBe("added 1\n");
    const listed = run("list");
    expect(listed.stdout.toString()).toBe("1 [ ] buy milk\n");
    const usage = run();
    expect(usage.exitCode).toBe(2);
    expect(usage.stderr.toString()).toBe(`${USAGE}\n`);
  });
});
