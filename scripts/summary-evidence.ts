#!/usr/bin/env bun
// Hold a workhorse's WORKHORSE-SUMMARY.md to the evidence shape: under `## Evidence`, one entry
// per acceptance criterion the ticket numbers, each citing one or more worktree-relative paths
// under .postmaster/verify/ that exist once `..` and symlinks are resolved, or the line
// `not shown: <reason>`. Criteria are read the way scripts/ticket-check.sh reads the list, and
// matched by number, so wording drift does not matter. Expected criteria come from the ticket,
// never inferred from the summary.
//
//   bun scripts/summary-evidence.ts <summary.md> <worktree> [--ticket <file>]
//
// The ticket defaults to the armed copy at <worktree>/.postmaster/verify/ticket.md. A ticket
// that is a waybill is read from its `## Ticket` heading to its `## Project profile` heading.
// Run it as the coachman does, `bun --no-env-file --config=/dev/null
// <tool>/scripts/summary-evidence.ts …`, beside `verify.sh summary`, so no .env or bunfig.toml
// from a worktree is read.
//
//   exit 0  each ticket criterion has existing evidence or a not shown reason
//   exit 1  usage or unreadable/malformed input
//   exit 2  a criterion is missing, unsupported, or cites evidence outside the verify directory;
//           each is named

import { readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

export const USAGE = "usage: bun scripts/summary-evidence.ts <summary.md> <worktree> [--ticket <file>]";

type Heading = { level: number; text: string; index: number };
export type EvidenceEntry = { criterion: number; lines: string[] };
type CriterionParse = { criteria: number[]; problem?: string };
export type Problem = { criterion: number; reason: string };
type PathProbe = { path: string; status: "ok" } | { path: string; status: "missing" | "outside" | "not-file" };

const headingPattern = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
const numberedItemPattern = /^( *)(\d{1,9})[.)](?:[ \t]+|$)/;
const codeFencePattern = /^\s*(`{3,}|~{3,})/;

function normalizedHeading(text: string): string {
  return text
    .replace(/[ \t]+#+$/, "")
    .trim()
    .replace(/[ \t]*\/[ \t]*/g, " / ")
    .replace(/\s+/g, " ")
    .replace(/:$/, "")
    .trim()
    .toLowerCase();
}

function headings(lines: string[]): Heading[] {
  const found: Heading[] = [];
  let fence: { char: string; length: number } | undefined;
  let inComment = false;
  for (const [index, line] of lines.entries()) {
    let visible = line;
    if (inComment) {
      const close = visible.indexOf("-->");
      if (close < 0) continue;
      visible = visible.slice(close + 3);
      inComment = false;
    }
    const comment = visible.indexOf("<!--");
    if (comment >= 0) {
      const close = visible.indexOf("-->", comment + 4);
      if (close < 0) {
        visible = visible.slice(0, comment);
        inComment = true;
      } else {
        visible = visible.slice(0, comment) + visible.slice(close + 3);
      }
    }
    if (fence) {
      const close = visible.trim();
      if (close.length >= fence.length && [...close].every((char) => char === fence?.char)) {
        fence = undefined;
      }
      continue;
    }
    const fenceMatch = codeFencePattern.exec(visible);
    if (fenceMatch) {
      fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
      continue;
    }
    const match = headingPattern.exec(visible);
    if (match) found.push({ level: match[1].length, text: normalizedHeading(match[2]), index });
  }
  return found;
}

export function extractTicketBody(text: string): string {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const found = headings(lines);
  const ticket = found.find((heading) => heading.level === 2 && heading.text === "ticket");
  if (!ticket) return lines.join("\n");
  const profile = found.find((heading) => heading.level === 2 && heading.text === "project profile" && heading.index > ticket.index);
  return lines.slice(ticket.index + 1, profile?.index ?? lines.length).join("\n");
}

export function parseTicketCriteria(text: string): CriterionParse {
  const lines = extractTicketBody(text).split("\n");
  const found = headings(lines);
  const section = found.find((heading) => heading.level === 2 && heading.text === "acceptance criteria");
  if (!section) return { criteria: [], problem: 'ticket has no "## Acceptance criteria" section' };

  const end = found.find((heading) => heading.level <= 2 && heading.index > section.index)?.index ?? lines.length;
  const numbers: number[] = [];
  let baseIndent: number | undefined;
  let fence: { char: string; length: number } | undefined;

  for (const line of lines.slice(section.index + 1, end)) {
    if (fence) {
      const close = line.trim();
      if (close.startsWith(fence.char.repeat(fence.length)) && [...close].every((char) => char === fence?.char)) {
        fence = undefined;
      }
      continue;
    }
    const fenceMatch = codeFencePattern.exec(line);
    if (fenceMatch) {
      fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
      continue;
    }
    const item = numberedItemPattern.exec(line);
    if (!item) continue;
    const indent = item[1].length;
    if (baseIndent === undefined) {
      if (indent > 3) continue;
      baseIndent = indent;
    }
    // ticket-check.sh permits a criterion list indented by up to three spaces. Nested numbered
    // items are indented beyond the list's base and remain part of their parent criterion.
    if (indent === baseIndent) numbers.push(Number(item[2]));
  }

  if (numbers.length === 0) return { criteria: [], problem: "ticket acceptance criteria are not a numbered list" };
  return { criteria: numbers };
}

export function parseEvidenceEntries(text: string): EvidenceEntry[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const found = headings(lines);
  const section = found.find((heading) => heading.level === 2 && heading.text === "evidence");
  if (!section) return [];
  const end = found.find((heading) => heading.level <= 2 && heading.index > section.index)?.index ?? lines.length;
  const entries: EvidenceEntry[] = [];
  for (const line of lines.slice(section.index + 1, end)) {
    const match = numberedItemPattern.exec(line);
    if (match && match[1].length <= 3) {
      entries.push({ criterion: Number(match[2]), lines: [line.slice(match[0].length).trim()] });
    } else if (entries.length > 0) {
      entries[entries.length - 1]?.lines.push(line.trim());
    }
    // Lines before the first numbered entry, such as an intro sentence, are ignored.
  }
  return entries;
}

function pathIsInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

export function probeEvidencePath(worktree: string, verifyDirectory: string, reference: string): PathProbe {
  if (isAbsolute(reference)) return { path: reference, status: "outside" };
  const lexicalPath = resolve(worktree, reference);
  if (!pathIsInside(verifyDirectory, lexicalPath)) return { path: reference, status: "outside" };

  let realWorktree: string;
  let realVerifyDirectory: string;
  let realEvidence: string;
  try {
    realWorktree = realpathSync(worktree);
    realVerifyDirectory = realpathSync(verifyDirectory);
    realEvidence = realpathSync(lexicalPath);
  } catch {
    return { path: reference, status: "missing" };
  }
  if (!pathIsInside(realWorktree, realVerifyDirectory) || !pathIsInside(realVerifyDirectory, realEvidence)) {
    return { path: reference, status: "outside" };
  }
  try {
    if (!statSync(realEvidence).isFile()) return { path: reference, status: "not-file" };
  } catch {
    return { path: reference, status: "missing" };
  }
  return { path: reference, status: "ok" };
}

export function evidencePaths(lines: string[]): string[] {
  const paths: string[] = [];
  for (const line of lines) {
    const codePaths = [...line.matchAll(/`([^`]+)`/g)]
      .map((match) => match[1].trim())
      .filter((value) => value.includes("/"));
    if (codePaths.length > 0) {
      paths.push(...codePaths);
      continue;
    }
    const bare = line.replace(/^[-*+]\s+/, "");
    for (const token of bare.split(/[,\s]+/)) {
      const cleaned = token.replace(/^`+|`+$/g, "").replace(/[.,;:!?]+$/, "").trim();
      if (cleaned.includes("/")) paths.push(cleaned);
    }
  }
  return paths;
}

export function validateEvidence(criteria: number[], entries: EvidenceEntry[], worktree: string): Problem[] {
  const problems: Problem[] = [];
  const byCriterion = new Map<number, EvidenceEntry[]>();
  for (const entry of entries) {
    byCriterion.set(entry.criterion, [...(byCriterion.get(entry.criterion) ?? []), entry]);
    if (!criteria.includes(entry.criterion)) {
      problems.push({ criterion: entry.criterion, reason: "is not in the ticket" });
    }
  }

  const verifyDirectory = resolve(worktree, ".postmaster/verify");
  for (const criterion of criteria) {
    const matched = byCriterion.get(criterion) ?? [];
    if (matched.length === 0) {
      problems.push({ criterion, reason: "is missing from the evidence section" });
      continue;
    }
    if (matched.length > 1) {
      problems.push({ criterion, reason: "has more than one evidence entry" });
      continue;
    }

    const lines = matched[0]?.lines ?? [];
    const content = lines.join("\n").trim();
    const notShown = /^not shown:\s*(.*)$/im.exec(content);
    const paths = evidencePaths(lines);
    if (notShown) {
      if (!notShown[1]?.trim()) {
        problems.push({ criterion, reason: "has an empty not shown reason" });
      }
      if (paths.length > 0) {
        problems.push({ criterion, reason: "mixes not shown with evidence paths" });
      }
      continue;
    }
    if (paths.length === 0) {
      problems.push({ criterion, reason: "has no evidence path or not shown reason" });
      continue;
    }
    for (const path of paths) {
      const probe = probeEvidencePath(worktree, verifyDirectory, path);
      if (probe.status === "missing") problems.push({ criterion, reason: `evidence does not exist: ${path}` });
      else if (probe.status === "outside") problems.push({ criterion, reason: `evidence is outside .postmaster/verify/: ${path}` });
      else if (probe.status === "not-file") problems.push({ criterion, reason: `evidence is not a file: ${path}` });
    }
  }
  return problems;
}

export function formatProblem(problem: Problem): string {
  return `criterion ${problem.criterion} ${problem.reason}`;
}

function readText(path: string, label: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`summary-evidence: cannot read ${label} ${path}: ${message}`);
    return undefined;
  }
}

function parseArgs(args: string[]): { summary: string; worktree: string; ticket?: string } | undefined {
  if (args.length < 2) return undefined;
  const [summary, worktree, ...rest] = args;
  let ticket: string | undefined;
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] !== "--ticket" || rest[index + 1] === undefined || ticket !== undefined) return undefined;
    ticket = rest[index + 1];
    index += 1;
  }
  return summary && worktree ? { summary, worktree, ...(ticket ? { ticket } : {}) } : undefined;
}

export function main(args: string[]): number {
  const parsed = parseArgs(args);
  if (!parsed) {
    console.error(USAGE);
    return 1;
  }
  const worktree = resolve(parsed.worktree);
  const summaryPath = resolve(parsed.summary);
  const ticketPath = resolve(parsed.ticket ?? `${worktree}/.postmaster/verify/ticket.md`);
  const summary = readText(summaryPath, "summary");
  const ticket = readText(ticketPath, "ticket");
  if (summary === undefined || ticket === undefined) return 1;

  const parsedCriteria = parseTicketCriteria(ticket);
  if (parsedCriteria.problem) {
    console.error(`summary-evidence: ${parsedCriteria.problem}`);
    return 1;
  }
  const entries = parseEvidenceEntries(summary);
  const problems = validateEvidence(parsedCriteria.criteria, entries, worktree);
  for (const problem of problems) {
    console.error(`summary-evidence: ${formatProblem(problem)}`);
  }
  if (problems.length > 0) {
    console.error(`summary-evidence: ${problems.length} evidence problem(s)`);
    return 2;
  }
  const notShown = entries.filter((entry) => /^not shown:/im.test(entry.lines.join("\n"))).length;
  console.log(`summary-evidence: evidence shape holds for ${parsedCriteria.criteria.length} criteria${notShown ? ` (${notShown} not shown)` : ""}`);
  return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
