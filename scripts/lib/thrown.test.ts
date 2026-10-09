// Tests beside scripts/lib/thrown.ts: 8 controls over the shapes catch sites read.
import { describe, expect, test } from "bun:test";
import { thrownCode, thrownDetail } from "./thrown.ts";

describe("thrownCode", () => {
  test("an object carrying a code gives it", () => {
    expect(thrownCode({ code: "ENOENT" })).toBe("ENOENT");
  });

  test("an error without a code gives undefined", () => {
    expect(thrownCode(new Error("x"))).toBe(undefined);
  });

  test("a primitive gives undefined", () => {
    expect(thrownCode("x")).toBe(undefined);
    expect(thrownCode(null)).toBe(undefined);
    expect(thrownCode(undefined)).toBe(undefined);
  });
});

describe("thrownDetail", () => {
  test("an error gives its message", () => {
    expect(thrownDetail(new Error("boom"))).toBe("boom");
  });

  test("a primitive gives itself", () => {
    expect(thrownDetail("str")).toBe("str");
    expect(thrownDetail(undefined)).toBe(undefined);
  });

  test("an object with a message gives it", () => {
    expect(thrownDetail({ message: "m" })).toBe("m");
  });

  test("an object without one gives itself", () => {
    const o = { code: "E" };
    expect(thrownDetail(o)).toBe(o);
  });

  test("null gives null", () => {
    expect(thrownDetail(null)).toBe(null);
  });
});
