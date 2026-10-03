import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extract } from "./extract.ts";
import { privacyFaults, type RunRecord } from "./records.ts";
import { load, render, sortRuns } from "./render.ts";

const scratch = mkdtempSync(join(tmpdir(), "lane-audit-render-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const put = (name: string, text: string): void => {
  mkdirSync(join(scratch, name, ".."), { recursive: true });
  writeFileSync(join(scratch, name), text);
};

const action = (ts: string, actor: string, name: string, target = "", detail = ""): string =>
  `${JSON.stringify({ ts, project: "p", run: "r", actor, action: name, target, detail })}\n`;

const window = { since: "2026-09-30T15:40:00Z", until: "2026-10-03T15:40:00Z" };

put(
  "proj/.postmaster/runs/200/actions.jsonl",
  action("2026-10-03T01:00:00Z", "postmaster", "dispatch", "#200"),
);

describe("render", () => {
  test("every table is drawn from the data and none names the machine", () => {
    const extracted = extract({ project: join(scratch, "proj") }, window, null);
    put("results/runs.json", JSON.stringify(extracted));
    put("results/titles.json", JSON.stringify({ "200": "A title", fixture: "Remove tasks by id" }));
    put("results/judgements.json", JSON.stringify({ runs: [], earlierAudit: {} }));
    put("results/incidents.json", "[]");
    put("results/hidden-tests.json", "[]");
    const files = render(load(join(scratch, "results")));
    expect(Object.keys(files)).toEqual([
      "inventory.md",
      "workhorses-real.md",
      "workhorses-real-compact.md",
      "workhorses-fixture.md",
      "reviews-real.md",
      "reviews-fixture.md",
      "tokens.md",
      "time.md",
      "incidents.md",
      "numbers.md",
    ]);
    for (const text of Object.values(files)) expect(privacyFaults(text)).toEqual([]);
    expect(files["inventory.md"]).toContain("A title");
  });
});

describe("sortRuns", () => {
  test("real runs by number, a set-aside run after its run, fixtures last and by number", () => {
    const row = (id: string, kind: "real" | "fixture", parked = false) =>
      ({ id, kind, parked }) as unknown as RunRecord;
    const ids = sortRuns([
      row("fixture-9", "fixture"),
      row("200-parked-20261002", "real", true),
      row("57", "real"),
      row("fixture-15", "fixture"),
      row("200", "real"),
      row("109", "real"),
    ]).map((r) => r.id);
    expect(ids).toEqual(["57", "109", "200", "200-parked-20261002", "fixture-9", "fixture-15"]);
  });
});
