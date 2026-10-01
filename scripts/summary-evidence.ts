#!/usr/bin/env bun
// Hold a workhorse's WORKHORSE-SUMMARY.md to the evidence shape: under `## Evidence`, one entry
// per acceptance criterion the ticket numbers, each citing one or more worktree-relative paths
// under .postmaster/verify/ that exist once `..` and symlinks are resolved, or the line
// `not shown: <reason>`. The tokenizer is a faithful port of scripts/ticket-check.sh's
// (tokenize, uncomment, the criterion list rule, fenced items), checked by differential
// tests over shared fixtures; validation faults stay in ticket-check.sh, which sees
// tickets first. Criteria match by number, so wording drift does not matter. Expected
// criteria come from the ticket, never inferred from the summary.
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
type Fence = { char: string; length: number };
type ReadableLine = { text: string; code: boolean };

// The ticket parts, normalized as headings() writes them. A section ends at a
// heading naming one, at any level, as in ticket-check.sh.
const TICKET_PARTS = new Set([
  "problem / feature",
  "acceptance criteria",
  "direction",
  "turnpikes",
  "notes",
  "user journey",
]);

function sectionEnd(found: Heading[], section: Heading, lineCount: number): number {
  return (
    found.find((heading) => heading.index > section.index && (heading.level <= 2 || TICKET_PARTS.has(heading.text)))?.index ??
    lineCount
  );
}

const headingPattern = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
const numberedItemPattern = /^( *)(\d{1,9})[.)](?:[ \t]+|$)/;
// ticket-check.sh's fence rules, verbatim: a backtick fence carries no backtick
// in its info string, and a list item that opens a fence is read while the
// body it opens is code.
const fencePattern = /^\s*(`{3,})[^`]*$|^\s*(~{3,})/;
const fencedItemPattern = /^ *(?:[-*+]|\d{1,9}[.)])[ \t]+(?:(`{3,})[^`]*|(~{3,}).*)$/;

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

function closesFence(fence: Fence, line: string): boolean {
  const close = line.trim();
  return close.length >= fence.length && [...close].every((char) => char === fence.char);
}

function lastCloser(lines: string[]): { line: number; index: number } {
  // Where the body's last --> starts, or (-1, -1): ticket-check.sh's `last`.
  // A line-leading <!-- opens a comment only when a closer comes after it.
  let best = { line: -1, index: -1 };
  for (const [k, t] of lines.entries()) {
    if (t.includes("-->")) {
      const index = t.lastIndexOf("-->");
      if (k > best.line || (k === best.line && index > best.index)) best = { line: k, index };
    }
  }
  return best;
}

function uncommentLine(
  t: string,
  inside: boolean,
  k: number,
  last: { line: number; index: number },
): { text: string; inside: boolean } {
  // One line without its HTML comments, code spans left alone: a faithful
  // port of ticket-check.sh's uncomment. A comment that starts a line runs to
  // the next --> on a later line; one inside a line must close on that line;
  // a <!-- that nothing closes is text.
  const out: string[] = [];
  let i = 0;
  let hidden = inside;
  for (;;) {
    if (hidden) {
      const j = t.indexOf("-->", i);
      if (j < 0) return { text: out.join(""), inside: true };
      i = j + 3;
      hidden = false;
      continue;
    }
    const c = t.indexOf("<!--", i);
    const tick = /`+/.exec(t.slice(i));
    if (tick && (c < 0 || tick.index + i < c)) {
      const run = tick[0];
      const closer = new RegExp(`(?<!\`)${run}(?!\`)`, "g");
      closer.lastIndex = tick.index + i + run.length;
      const found = closer.exec(t);
      const end = found ? found.index + run.length : tick.index + i + run.length;
      out.push(t.slice(i, end));
      i = end;
    } else if (c < 0) {
      out.push(t.slice(i));
      return { text: out.join(""), inside: false };
    } else if (!t.slice(0, c).trim() && (k < last.line || (k === last.line && c + 4 <= last.index))) {
      out.push(t.slice(i, c));
      i = c + 4;
      hidden = true;
    } else if (t.indexOf("-->", c + 4) >= 0) {
      out.push(t.slice(i, c));
      i = t.indexOf("-->", c + 4) + 3;
    } else {
      out.push(t.slice(i, c + 4));
      i = c + 4;
    }
  }
}

function tokenize(lines: string[]): ReadableLine[] {
  // The lines as written, and as read: ticket-check.sh's tokenize. Fenced
  // lines are code, except a list item that opens a fence, which is read
  // while its body is code; every other line is uncommented. One entry per
  // input line, so indices still address the input.
  const last = lastCloser(lines);
  const read: ReadableLine[] = [];
  let fence: Fence | undefined;
  let inside = false;
  for (const [k, t] of lines.entries()) {
    if (fence) {
      if (closesFence(fence, t)) fence = undefined;
      read.push({ text: "", code: true });
      continue;
    }
    const m = inside ? null : fencePattern.exec(t);
    const item = inside || m ? null : fencedItemPattern.exec(t);
    if (m) {
      const run = m[1] ?? m[2];
      fence = { char: run[0], length: run.length };
      read.push({ text: "", code: true });
    } else if (item) {
      const run = item[1] ?? item[2];
      fence = { char: run[0], length: run.length };
      read.push({ text: t, code: false });
    } else {
      const uncommented = uncommentLine(t, inside, k, last);
      inside = uncommented.inside;
      read.push({ text: uncommented.text, code: false });
    }
  }
  return read;
}

function headings(lines: string[]): Heading[] {
  const found: Heading[] = [];
  for (const [index, line] of tokenize(lines).entries()) {
    if (line.code) continue;
    const match = headingPattern.exec(line.text);
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

  const end = sectionEnd(found, section, lines.length);
  const numbers: number[] = [];
  let baseIndent: number | undefined;

  // The whole body is tokenized first, as in ticket-check.sh, so a comment's
  // closer may come from outside this section.
  for (const { text, code } of tokenize(lines).slice(section.index + 1, end)) {
    if (code) continue;
    const item = numberedItemPattern.exec(text);
    if (!item) continue;
    const indent = item[1].length;
    if (baseIndent === undefined) {
      if (indent > 3) continue;
      baseIndent = indent;
    }
    // ticket-check.sh counts an item as a new criterion at indent up to two past
    // the list's base; deeper numbered items remain part of their parent criterion.
    if (indent <= baseIndent + 2) numbers.push(Number(item[2]));
  }

  if (numbers.length === 0) return { criteria: [], problem: "ticket acceptance criteria are not a numbered list" };
  return { criteria: numbers };
}

export function parseEvidenceEntries(text: string): EvidenceEntry[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const found = headings(lines);
  const section = found.find((heading) => heading.level === 2 && heading.text === "evidence");
  if (!section) return [];
  const end = sectionEnd(found, section, lines.length);
  const entries: EvidenceEntry[] = [];
  let baseIndent: number | undefined;
  for (const { text, code } of tokenize(lines).slice(section.index + 1, end)) {
    if (code) continue;
    const match = numberedItemPattern.exec(text);
    const startsEntry = match && (baseIndent === undefined ? match[1].length <= 3 : match[1].length <= baseIndent + 2);
    if (startsEntry && match) {
      if (baseIndent === undefined) baseIndent = match[1].length;
      entries.push({ criterion: Number(match[2]), lines: [text.slice(match[0].length).trim()] });
    } else if (entries.length > 0) {
      entries[entries.length - 1]?.lines.push(text.trim());
    }
    // Lines before the first numbered entry, such as an intro sentence, are ignored.
    // Entries follow the same indent rule as criteria: a numbered line indented more
    // than two past the entries' base continues its entry.
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
      // A code span is prose until it names the verify directory: terms like
      // `CLI/iOS` and incidental paths are not evidence citations.
      .filter((value) => value.includes(".postmaster/verify/"));
    paths.push(...codePaths);
    // Bare citations share the line with code spans, so the rest of the line
    // is still read, with the spans blanked to avoid counting them twice.
    const bare = line.replace(/`[^`]*`/g, " ").replace(/^[-*+]\s+/, "");
    for (const token of bare.split(/[,\s]+/)) {
      const cleaned = token.replace(/^`+|`+$/g, "").replace(/[.,;:!?]+$/, "").trim();
      // Bare prose carries slashes (and/or, CLI/iOS) that are not paths, so a
      // bare token counts only when it names the verify directory.
      if (cleaned.includes(".postmaster/verify/")) paths.push(cleaned);
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
    // The contract form is `1. not shown: <reason>` on the entry's own line;
    // a `not shown:` on a continuation line is prose, neither a pass nor a mix.
    const notShown = /^not shown:\s*(.*)$/i.exec((lines[0] ?? "").trim());
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
  const notShown = entries.filter((entry) => /^not shown:/i.test((entry.lines[0] ?? "").trim())).length;
  console.log(`summary-evidence: evidence shape holds for ${parsedCriteria.criteria.length} criteria${notShown ? ` (${notShown} not shown)` : ""}`);
  return 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
