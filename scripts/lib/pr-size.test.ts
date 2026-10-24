// Tests beside scripts/lib/pr-size.ts. Each count has a positive control, a change that reads
// non-zero, and a negative control, the same call on a change that reads zero. The project is
// invented: a small shop with a web app and a core package.
import { describe, expect, test } from "bun:test";
import {
  budgetOf,
  limitsLine,
  overCap,
  parseNumstat,
  sizeLine,
  sizeOf,
  standing,
} from "./pr-size.ts";

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

describe("the budget a project's settings give", () => {
  const drafts = { draft_pull_requests: "on" };
  // Every way a project's runs can fail to open draft pull requests: no table, no key, or off.
  const noDrafts = [undefined, null, {}, { draft_pull_requests: "off" }, "on"];

  test("aims at 200 lines and stops at 400 where the project's runs open draft pull requests", () => {
    expect(budgetOf(drafts, {})).toEqual({ aim: 200, cap: 400 });
  });

  test("is none where they do not and the project names no cap, an aim alone turning nothing on", () => {
    for (const ship of noDrafts) {
      expect(budgetOf(ship, {})).toBeNull();
      expect(budgetOf(ship, { pr_size_aim: 100 })).toBeNull();
    }
    expect(budgetOf(drafts, { pr_size_aim: 100 })).toEqual({ aim: 100, cap: 400 });
  });

  test("is the project's own cap where it names one: only a cap, a cap with drafts off, a cap with drafts on", () => {
    for (const ship of [...noDrafts, drafts]) {
      expect(budgetOf(ship, { pr_size_cap: 300 })).toEqual({ aim: 200, cap: 300 });
      expect(budgetOf(ship, { pr_size_aim: 150, pr_size_cap: 300 })).toEqual({
        aim: 150,
        cap: 300,
      });
    }
  });

  test("takes the project's own aim and cap, and a cap below the default aim brings the aim down", () => {
    const own = { pr_size_aim: 150, pr_size_cap: 300 };
    expect(budgetOf(drafts, own)).toEqual({ aim: 150, cap: 300 });
    expect(budgetOf(drafts, { pr_size_cap: 100 })).toEqual({ aim: 100, cap: 100 });
    expect(budgetOf({}, { pr_size_cap: 100 })).toEqual({ aim: 100, cap: 100 });
  });

  test("is none where the project turns the cap off, with drafts on or without", () => {
    for (const ship of [drafts, ...noDrafts]) {
      expect(budgetOf(ship, { pr_size_cap: "off" })).toBeNull();
    }
  });

  test("refuses an aim above the cap, set or defaulted, however the budget came on", () => {
    expect(() => budgetOf(drafts, { pr_size_aim: 300, pr_size_cap: 200 })).toThrow(
      "pr_size_aim (300) is above pr_size_cap (200)",
    );
    expect(() => budgetOf({}, { pr_size_aim: 300, pr_size_cap: 200 })).toThrow(
      "pr_size_aim (300) is above pr_size_cap (200)",
    );
    expect(() => budgetOf(drafts, { pr_size_aim: 500 })).toThrow(
      "pr_size_aim (500) is above pr_size_cap (400)",
    );
  });

  test("refuses a draft_pull_requests value that is neither on nor off, with a cap or without, and reads on, off and none as before", () => {
    for (const value of [true, false, "yes", "On", 1]) {
      const message = `ship.draft_pull_requests must be "on" or "off", not ${JSON.stringify(value)}`;
      expect(() => budgetOf({ draft_pull_requests: value }, {})).toThrow(message);
      expect(() => budgetOf({ draft_pull_requests: value }, { pr_size_cap: 300 })).toThrow(message);
    }
    expect(budgetOf({ draft_pull_requests: "on" }, {})).toEqual({ aim: 200, cap: 400 });
    expect(budgetOf({ draft_pull_requests: "off" }, {})).toBeNull();
    expect(budgetOf({}, {})).toBeNull();
  });
});

describe("the words about a size", () => {
  const budget = { aim: 200, cap: 400 };
  const at = (lines: number) => ({ lines, files: 3 });

  test("the card line and the waybill line carry the count and the budget", () => {
    expect(sizeLine(at(312), budget)).toBe("Size: 312 changed lines (aim 200, cap 400)");
    expect(limitsLine(budget)).toBe(
      "size: aim 200, cap 400 changed lines per pull request; the cap is a hard limit",
    );
  });

  test("a change stands within the aim, over the aim, or over the cap, and the cap itself is allowed", () => {
    expect([200, 201, 400, 401].map((lines) => standing(at(lines), budget))).toEqual([
      "within the aim",
      "over the aim, within the cap",
      "over the aim, within the cap",
      "over the cap by 1",
    ]);
    expect([400, 401].map((lines) => overCap(at(lines), budget))).toEqual([false, true]);
  });
});
