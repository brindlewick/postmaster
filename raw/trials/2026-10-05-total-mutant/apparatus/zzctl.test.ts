import { expect, test } from "bun:test";
import { add, label } from "./zzctl.ts";

test("strong: add adds", () => {
  expect(add(2, 3)).toBe(5);
});
test("strong: label formats", () => {
  expect(label(4)).toBe("n=4");
});
test("vacuous: add is defined", () => {
  expect(add).toBeDefined();
});
test("vacuous: no assertion", () => {
  add(1, 1);
});
test("vacuous: absence only", () => {
  expect(label(1)).not.toBe("wrong");
});
