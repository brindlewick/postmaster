// Tests beside scripts/lib/pr-size.ts. Each count has a positive control, a change that reads
// non-zero, and a negative control, the same call on a change that reads zero. The project is
// invented: a small shop with a web app and a core package.
import { describe, expect, test } from "bun:test";
import { parseNumstat, sizeOf } from "./pr-size.ts";

const report = (...cells: string[]): string => cells.map((cell) => `${cell}\0`).join("");
const keep = (): boolean => false;

describe("the numstat report", () => {
  test("reads the added and removed lines of each text file, a renamed file by its new path", () => {
    const rows = report(
      "3\t1\tapps/web/src/cart.ts",
      "1\t0\t",
      "apps/web/old name.ts",
      "apps/web/new name.ts",
      "10\t0\tpackages/core/src/tax.ts",
    );
    expect(parseNumstat(rows)).toEqual([
      { path: "apps/web/src/cart.ts", added: 3, removed: 1 },
      { path: "apps/web/new name.ts", added: 1, removed: 0 },
      { path: "packages/core/src/tax.ts", added: 10, removed: 0 },
    ]);
  });

  test("leaves out a binary file, renamed or not, and reads an empty report as no files", () => {
    const rows = report("-\t-\tlogo.png", "-\t-\t", "a.woff", "b.woff", "4\t0\tREADME.md");
    expect(parseNumstat(rows)).toEqual([{ path: "README.md", added: 4, removed: 0 }]);
    expect(parseNumstat("")).toEqual([]);
  });
});

describe("the size of a change", () => {
  const changes = parseNumstat(
    report("3\t1\tapps/web/src/cart.ts", "10\t5\tapps/web/src/cart.test.ts"),
  );

  test("adds the added lines to the removed lines, tests included", () => {
    expect(sizeOf(changes, new Set(), keep)).toEqual({ lines: 19, files: 2 });
  });

  test("a file deleted whole counts as one line, whatever its length", () => {
    const rows = report("0\t300\tpackages/core/src/legacy.ts", "2\t0\tapps/web/src/cart.ts");
    const size = sizeOf(parseNumstat(rows), new Set(["packages/core/src/legacy.ts"]), keep);
    expect(size).toEqual({ lines: 3, files: 2 });
  });

  test("the files skip names count for no lines and no file", () => {
    const rows = report("3\t1\tapps/web/src/cart.ts", "900\t800\tpnpm-lock.yaml");
    const size = sizeOf(parseNumstat(rows), new Set(), (path) => path === "pnpm-lock.yaml");
    expect(size).toEqual({ lines: 4, files: 1 });
  });

  test("a change with no files, or with every file skipped, reads zero", () => {
    expect(sizeOf([], new Set(), keep)).toEqual({ lines: 0, files: 0 });
    expect(sizeOf(changes, new Set(), () => true)).toEqual({ lines: 0, files: 0 });
  });
});
