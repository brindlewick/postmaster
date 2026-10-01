// Tests beside scripts/summary-evidence.ts. The script cases run it the way the coachman
// does at harvest — `bun --no-env-file --config=/dev/null scripts/summary-evidence.ts
// <summary> <worktree>` — against a throwaway worktree with an armed ticket, so a clean pass
// and every refusal are shown through the identical command. The core cases call the pure
// functions directly.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  evidencePaths,
  extractTicketBody,
  formatProblem,
  parseEvidenceEntries,
  parseTicketCriteria,
  probeEvidencePath,
  validateEvidence,
} from "./summary-evidence";

const script = join(import.meta.dir, "summary-evidence.ts");

const TICKET = `# A thing

## Problem / feature
Things need doing.

## Acceptance criteria
1. The first thing happens.
2. The second thing happens, with a detail
   that runs on under it.
3. The third thing happens.

## Direction
None.
## Turnpikes
default
`;

const NESTED_TICKET = `# A thing

## Acceptance criteria
1. First criterion works with realistic input.
2. Second criterion handles its edge case:
    1. This nested item is not a criterion.

## Direction
Keep the change small.
`;

function ticketWith(count: number): string {
  const items = Array.from({ length: count }, (_, i) => `${i + 1}. Criterion ${i + 1} happens.`).join("\n");
  return `# A thing

## Problem / feature
Things need doing.

## Acceptance criteria
${items}

## Direction
None.
## Turnpikes
default
`;
}

function evidenceAll(count: number, file = "ok.md"): string {
  const items = Array.from({ length: count }, (_, i) => `${i + 1}. \`.postmaster/verify/${file}\``).join("\n");
  return `# Summary

## Evidence
${items}
`;
}

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "summary-evidence-"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function freshWorktree(name: string, ticketText = TICKET): string {
  const wt = join(root, name);
  mkdirSync(join(wt, ".postmaster", "verify"), { recursive: true });
  writeFileSync(join(wt, ".postmaster", "verify", "ticket.md"), ticketText);
  writeFileSync(join(wt, ".postmaster", "verify", "ok.md"), "transcript\n");
  return wt;
}

function writeSummary(wt: string, text: string, name = "WORKHORSE-SUMMARY.md"): string {
  const p = join(wt, name);
  writeFileSync(p, text);
  return p;
}

function runCheck(summary: string, worktree: string, extra: string[] = []) {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && k !== "POSTMASTER_VERIFY") env[k] = v;
  }
  const r = spawnSync("bun", ["--no-env-file", "--config=/dev/null", script, summary, worktree, ...extra], {
    encoding: "utf8",
    env,
  });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

describe("pure core", () => {
  test("a waybill is read from ## Ticket to ## Project profile", () => {
    const body = extractTicketBody(`# brief\n\n## Ticket\n${TICKET}\n## Project profile\nrepo: x\n`);
    expect(body).toContain("## Acceptance criteria");
    expect(body).not.toContain("Project profile");
  });

  test("criteria are numbered 1 to n, and continuation lines belong to the item above", () => {
    expect(parseTicketCriteria(TICKET)).toEqual({ criteria: [1, 2, 3] });
  });

  test("nested numbered items are not criteria", () => {
    expect(parseTicketCriteria(NESTED_TICKET)).toEqual({ criteria: [1, 2] });
  });

  test("evidence paths come from code spans or bare tokens, comma-separated or bulleted", () => {
    expect(evidencePaths(["`.postmaster/verify/a.md`, `.postmaster/verify/b.md`"])).toEqual([
      ".postmaster/verify/a.md",
      ".postmaster/verify/b.md",
    ]);
    expect(evidencePaths(["- .postmaster/verify/a.md"])).toEqual([".postmaster/verify/a.md"]);
    expect(evidencePaths(["see .postmaster/verify/a.md."])).toEqual([".postmaster/verify/a.md"]);
    expect(evidencePaths(["shown"])).toEqual([]);
  });

  test("entries keep their criterion numbers and continuation lines", () => {
    const entries = parseEvidenceEntries("## Evidence\nAn intro line.\n1. `.postmaster/verify/a.md`\n2. not shown: x\n");
    expect(entries.map((e) => e.criterion)).toEqual([1, 2]);
  });

  test("a path outside .postmaster/verify is refused, once by .. and once by a symlink", () => {
    const wt = freshWorktree("pure-paths");
    const verify = join(wt, ".postmaster", "verify");
    writeFileSync(join(wt, "outside.md"), "no\n");
    expect(probeEvidencePath(wt, verify, ".postmaster/verify/ok.md")).toEqual({ path: ".postmaster/verify/ok.md", status: "ok" });
    expect(probeEvidencePath(wt, verify, ".postmaster/verify/../outside.md").status).toBe("outside");
    symlinkSync(join(wt, "outside.md"), join(verify, "escape.md"));
    expect(probeEvidencePath(wt, verify, ".postmaster/verify/escape.md").status).toBe("outside");
    expect(probeEvidencePath(wt, verify, ".postmaster/verify/missing.md").status).toBe("missing");
    mkdirSync(join(verify, "sub"));
    expect(probeEvidencePath(wt, verify, ".postmaster/verify/sub").status).toBe("not-file");
  });

  test("problems name the criterion and what is wrong", () => {
    const wt = freshWorktree("pure-problems");
    const problems = validateEvidence(
      [1, 2],
      [{ criterion: 1, lines: ["`.postmaster/verify/missing.md`"] }],
      wt,
    );
    expect(problems.map(formatProblem)).toEqual([
      "criterion 1 evidence does not exist: .postmaster/verify/missing.md",
      "criterion 2 is missing from the evidence section",
    ]);
  });
});

describe("the script", () => {
  test("a summary with evidence for every criterion holds", () => {
    const wt = freshWorktree("all");
    const summary = writeSummary(wt, evidenceAll(3));
    const { code, out } = runCheck(summary, wt);
    expect(code).toBe(0);
    expect(out).toContain("evidence shape holds for 3 criteria");
  });

  test("a criterion missing from the evidence section is a problem", () => {
    const wt = freshWorktree("missing");
    const summary = writeSummary(wt, `# Summary\n\n## Evidence\n1. \`.postmaster/verify/ok.md\`\n3. \`.postmaster/verify/ok.md\`\n`);
    const { code, out } = runCheck(summary, wt);
    expect(code).toBe(2);
    expect(out).toContain("criterion 2 is missing from the evidence section");
  });

  test("evidence that does not exist is a problem", () => {
    const wt = freshWorktree("absent");
    const summary = writeSummary(
      wt,
      `# Summary\n\n## Evidence\n1. \`.postmaster/verify/ok.md\`\n2. \`.postmaster/verify/ghost.md\`\n3. \`.postmaster/verify/ok.md\`\n`,
    );
    const { code, out } = runCheck(summary, wt);
    expect(code).toBe(2);
    expect(out).toContain("criterion 2 evidence does not exist: .postmaster/verify/ghost.md");
  });

  test("a not shown line with its reason is valid for its criterion", () => {
    const wt = freshWorktree("not-shown");
    const summary = writeSummary(
      wt,
      `# Summary\n\n## Evidence\n1. \`.postmaster/verify/ok.md\`\n2. not shown: the harness has no browser backend\n3. \`.postmaster/verify/ok.md\`\n`,
    );
    const { code, out } = runCheck(summary, wt);
    expect(code).toBe(0);
    expect(out).toContain("evidence shape holds for 3 criteria (1 not shown)");
  });

  test("a criterion claimed shown with no evidence is a problem", () => {
    const wt = freshWorktree("bare");
    const summary = writeSummary(wt, `# Summary\n\n## Evidence\n1. \`.postmaster/verify/ok.md\`\n2. shown\n3. \`.postmaster/verify/ok.md\`\n`);
    const { code, out } = runCheck(summary, wt);
    expect(code).toBe(2);
    expect(out).toContain("criterion 2 has no evidence path or not shown reason");
  });

  test("a path outside .postmaster/verify is a problem, once by .. and once by a symlink", () => {
    const wt = freshWorktree("escape");
    writeFileSync(join(wt, "outside.md"), "no\n");
    symlinkSync(join(wt, "outside.md"), join(wt, ".postmaster", "verify", "escape.md"));
    const viaDots = writeSummary(
      wt,
      `# Summary\n\n## Evidence\n1. \`.postmaster/verify/../outside.md\`\n2. \`.postmaster/verify/ok.md\`\n3. \`.postmaster/verify/ok.md\`\n`,
      "dots.md",
    );
    const dots = runCheck(viaDots, wt);
    expect(dots.code).toBe(2);
    expect(dots.out).toContain("criterion 1 evidence is outside .postmaster/verify/: .postmaster/verify/../outside.md");
    const viaLink = writeSummary(
      wt,
      `# Summary\n\n## Evidence\n1. \`.postmaster/verify/escape.md\`\n2. \`.postmaster/verify/ok.md\`\n3. \`.postmaster/verify/ok.md\`\n`,
      "link.md",
    );
    const link = runCheck(viaLink, wt);
    expect(link.code).toBe(2);
    expect(link.out).toContain("criterion 1 evidence is outside .postmaster/verify/: .postmaster/verify/escape.md");
  });

  test("an entry for a criterion the ticket does not have is a problem", () => {
    const wt = freshWorktree("extra");
    const summary = writeSummary(wt, `${evidenceAll(3)}\n4. \`.postmaster/verify/ok.md\`\n`);
    const { code, out } = runCheck(summary, wt);
    expect(code).toBe(2);
    expect(out).toContain("criterion 4 is not in the ticket");
  });

  test("a criterion with two entries is a problem", () => {
    const wt = freshWorktree("dupe");
    const summary = writeSummary(
      wt,
      `# Summary\n\n## Evidence\n1. \`.postmaster/verify/ok.md\`\n2. \`.postmaster/verify/ok.md\`\n2. \`.postmaster/verify/ok.md\`\n3. \`.postmaster/verify/ok.md\`\n`,
    );
    const { code, out } = runCheck(summary, wt);
    expect(code).toBe(2);
    expect(out).toContain("criterion 2 has more than one evidence entry");
  });

  test("a summary with no evidence section names each missing criterion", () => {
    const wt = freshWorktree("nosection");
    const summary = writeSummary(wt, "# Summary\n\nNo evidence section here.\n");
    const { code, out } = runCheck(summary, wt);
    expect(code).toBe(2);
    expect(out).toContain("criterion 1 is missing from the evidence section");
    expect(out).toContain("criterion 3 is missing from the evidence section");
  });

  test("an intro line before the first entry is tolerated", () => {
    const wt = freshWorktree("intro");
    const summary = writeSummary(wt, `# Summary\n\n## Evidence\nEvidence for the three criteria.\n${evidenceAll(3).split("\n").slice(3).join("\n")}\n`);
    const { code, out } = runCheck(summary, wt);
    expect(code).toBe(0);
    expect(out).toContain("evidence shape holds for 3 criteria");
  });

  test("a not shown line with no reason, or mixed with paths, is a problem", () => {
    const wt = freshWorktree("reason");
    const empty = writeSummary(
      wt,
      `# Summary\n\n## Evidence\n1. \`.postmaster/verify/ok.md\`\n2. not shown:\n3. \`.postmaster/verify/ok.md\`\n`,
      "empty.md",
    );
    const r1 = runCheck(empty, wt);
    expect(r1.code).toBe(2);
    expect(r1.out).toContain("criterion 2 has an empty not shown reason");
    const mixed = writeSummary(
      wt,
      `# Summary\n\n## Evidence\n1. \`.postmaster/verify/ok.md\`\n2. not shown: x, see \`.postmaster/verify/ok.md\`\n3. \`.postmaster/verify/ok.md\`\n`,
      "mixed.md",
    );
    const r2 = runCheck(mixed, wt);
    expect(r2.code).toBe(2);
    expect(r2.out).toContain("criterion 2 mixes not shown with evidence paths");
  });

  test("--ticket reads a waybill's ticket part", () => {
    const wt = freshWorktree("waybill", ticketWith(1));
    const waybill = join(wt, "brief.md");
    writeFileSync(waybill, `# brief\n\n## Ticket\n${ticketWith(2)}\n## Project profile\nrepo: x\n`);
    const summary = writeSummary(wt, evidenceAll(2));
    expect(runCheck(summary, wt, ["--ticket", waybill]).code).toBe(0);
    expect(existsSync(join(wt, ".postmaster", "verify", "ticket.md"))).toBe(true);
  });

  test("usage and an unreadable input exit 1", () => {
    const wt = freshWorktree("usage");
    expect(runCheck(join(wt, "nope.md"), wt).code).toBe(1);
    expect(runCheck(join(wt, "nope.md"), wt, ["--ticket"]).code).toBe(1);
  });
});
