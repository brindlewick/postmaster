// Say whether a ticket is ready to run, and mark it when the user says it is.
//
// A ticket is ready when it passes ticket-check and ticket-parts --final and
// carries the ready mark. The clerk marks it once the user signs the draft
// off; the postmaster asks before it dispatches anything, and refuses what is
// not ready instead of dispatching it.
//
// Usage:
//   ticket-ready.sh <repo> <id>                        exit 0 when ready, 2 with one line per reason
//   ticket-ready.sh --body <file> --labels <list> [--title <t>] [--project <p>]
//   ticket-ready.sh mark <repo> <id> [--body <file>] [--title <title>]
//   ticket-ready.sh mark --body <file> --labels <list> --repo <repo> --id <id> [--title <t>]
//   ticket-ready.sh unmark <repo> <id>
//   ticket-ready.sh consume <repo> <id>
//   ticket-ready.sh pending <repo>
//   ticket-ready.sh queue <repo> <id>
//
// The --body forms check a tracker of kind other from a body file and a label
// list, as ticket-check --body does; the mark --body form records the marking
// after the label is applied through the tracker's own tooling. mark writes
// the ledger note with the ticket's turnpikes line as the user's word, and
// every marking queues a ready marker under the project's run root; consume
// drops the marker when the postmaster dispatches, and unmark drops the mark
// with it.
//
// Exit 0 the ticket is ready, or the verb did its work; 2 the ticket is not
// ready, or the marking was refused; 1 anything else (an unreadable ticket,
// an unknown tracker, usage).
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { scriptsDir } from "./lib/paths.ts";
import { run } from "./lib/proc.ts";

const HERE = scriptsDir(import.meta);

function die(message: string, code = 1): never {
  console.error(`ticket-ready: ${message}`);
  process.exit(code);
}

function runScript(name: string, args: string[]): { code: number; out: string; err: string } {
  const r = run(join(HERE, name), args);
  return { code: r.code, out: r.out ?? "", err: r.err ?? "" };
}

function trackerKind(repo: string): string {
  const r = runScript("tracker-kind.sh", [repo]);
  if (r.code !== 0) die(`tracker-kind.sh ${repo}: ${(r.out + r.err).trim() || `exit ${r.code}`}`);
  return r.out.trim();
}

// The read every adapter prints: header fields, a blank line, then the body.
// ticket-parts tolerates the ## Log trailer the adapters append, so the body
// is checked as read, exactly as ticket-check reads it.
function parseTicketRead(out: string): { title: string; labels: string[]; body: string } {
  const lines = out.split("\n");
  let title = "";
  let labels: string[] = [];
  let i = 0;
  for (; i < lines.length; i++) {
    const line = (lines[i] ?? "").replace(/\r$/, "");
    if (line === "") break;
    const m = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    if (m[1]!.toLowerCase() === "title") title = m[2]!;
    if (m[1]!.toLowerCase() === "labels")
      labels = m[2]!
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  }
  return { title, labels, body: lines.slice(i + 1).join("\n") };
}

function hasReadyMark(labels: string[]): boolean {
  return labels.some((l) => l.toLowerCase() === "ready");
}

type CheckInput = { body: string; title: string; project: string };

function runChecks(input: CheckInput): { reasons: string[]; turnpikes: string } {
  const work = mkdtempSync(join(tmpdir(), "ticket-ready-"));
  try {
    const bodyFile = join(work, "body.md");
    writeFileSync(bodyFile, input.body);
    const reasons: string[] = [];
    let turnpikes = "";
    const checkArgs = ["--body", bodyFile];
    if (input.title) checkArgs.push("--title", input.title);
    if (input.project) checkArgs.push("--project", input.project);
    const checkR = runScript("ticket-check.sh", checkArgs);
    if (checkR.code !== 0) {
      for (const line of (checkR.out + checkR.err).split("\n")) {
        const t = line.trim();
        if (t) reasons.push(`ticket-check: ${t}`);
      }
    } else {
      for (const line of checkR.out.split("\n")) {
        if (line.startsWith("turnpikes:")) turnpikes = line.trim();
      }
    }
    const partsR = runScript("ticket-parts.sh", [bodyFile, "--final"]);
    const partsText = partsR.out + partsR.err;
    if (partsR.code !== 0) {
      for (const line of partsText.split("\n")) {
        const t = line.trim();
        if (t) reasons.push(`ticket-parts: ${t}`);
      }
    }
    // ticket-parts stops at a structural failure, so on a ticket failing
    // several ways its draft finding never prints; name the draft line then.
    const first = input.body.split("\n").find((l) => l.trim() !== "") ?? "";
    if (first.startsWith("DRAFT:") && !/draft/i.test(partsText)) {
      reasons.unshift("the first line is a DRAFT line");
    }
    return { reasons, turnpikes };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function reportCheck(
  repo: string,
  id: string,
  title: string,
  labels: string[],
  body: string,
): number {
  const reasons: string[] = [];
  if (!hasReadyMark(labels)) reasons.push("ready label is missing");
  const { reasons: found, turnpikes } = runChecks({ body, title, project: repo });
  reasons.push(...found);
  if (reasons.length > 0) {
    for (const r of reasons) console.log(r);
    return 2;
  }
  console.log(`ready: ${id}`);
  if (!turnpikes) die(`checked ${id} but ticket-check printed no turnpikes line`);
  console.log(turnpikes);
  return 0;
}

// --- the ready queue: one marker per ticket under the project's run root ---

function readyDir(repo: string): string {
  return join(repo, ".postmaster", "runs", "postmaster", "ready");
}

function markerPath(repo: string, id: string): string {
  return join(readyDir(repo), `${encodeURIComponent(id)}.ready`);
}

function writeQueue(repo: string, id: string): void {
  mkdirSync(readyDir(repo), { recursive: true });
  writeFileSync(markerPath(repo, id), `${id}\n`);
}

function removeQueue(repo: string, id: string): void {
  rmSync(markerPath(repo, id), { force: true });
}

function pendingQueue(repo: string): string[] {
  let names: string[] = [];
  try {
    names = readdirSync(readyDir(repo));
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const name of names.sort()) {
    if (!name.endsWith(".ready")) continue;
    try {
      const id = readFileSync(join(readyDir(repo), name), "utf8").trim();
      if (id === decodeURIComponent(name.slice(0, -".ready".length))) out.push(id);
    } catch {
      // A marker being written beside this listing is listed next time.
    }
  }
  return out;
}

function labelViaAdapter(
  repo: string,
  id: string,
  kind: string,
  verb: "add" | "remove",
  name = "ready",
): void {
  const base = kind === "plane" ? [] : [repo];
  const r = runScript(`${kind}.sh`, [...base, "label", id, verb, name]);
  if (r.code !== 0) die(`the ${kind} adapter could not ${verb} the label (${(r.out + r.err).trim()})`);
}

function readViaAdapter(repo: string, id: string, kind: string): { title: string; labels: string[]; body: string } {
  const base = kind === "plane" ? [] : [repo];
  const r = runScript(`${kind}.sh`, [...base, "read", id]);
  if (r.code !== 0) die(`the ${kind} adapter could not read ${id} (${(r.out + r.err).trim()})`, 1);
  return parseTicketRead(r.out);
}

function removeClerkRecord(repo: string, id: string): void {
  // The clerk's session ends with the marking; a missing record is fine.
  rmSync(join(repo, ".postmaster", "runs", "postmaster", "clerks", `${encodeURIComponent(id)}.json`), {
    force: true,
  });
}

function logLedgerNote(repo: string, id: string, turnpikes: string): void {
  const r = runScript("log-action.sh", ["--project", repo, "clerk", "note", id, turnpikes]);
  if (r.code !== 0) die(`the ledger note could not be written (${(r.out + r.err).trim()})`);
}

function markAdapterTicket(
  repo: string,
  id: string,
  kind: string,
  draftFile: string,
  draftTitle: string,
): number {
  const live = readViaAdapter(repo, id, kind);
  let body = live.body;
  let title = live.title;
  if (draftFile) body = readFileSync(draftFile, "utf8");
  if (draftTitle) title = draftTitle;
  const { reasons, turnpikes } = runChecks({ body, title, project: repo });
  if (reasons.length > 0) {
    for (const r of reasons) console.log(r);
    return 2;
  }
  if (!turnpikes) die(`checked ${id} but ticket-check printed no turnpikes line`);
  const base = kind === "plane" ? [] : [repo];
  if (draftFile && body !== live.body) {
    const work = mkdtempSync(join(tmpdir(), "ticket-ready-"));
    try {
      const baseFile = join(work, "base.md");
      const newFile = join(work, "new.md");
      writeFileSync(baseFile, live.body);
      writeFileSync(newFile, body);
      const r = runScript(`${kind}.sh`, [...base, "edit", id, newFile, baseFile]);
      if (r.code !== 0) die(`the ${kind} adapter could not write the body (${(r.out + r.err).trim()})`);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }
  if (draftTitle && title !== live.title) {
    const r = runScript(`${kind}.sh`, [...base, "title", id, title]);
    if (r.code !== 0) die(`the ${kind} adapter could not write the title (${(r.out + r.err).trim()})`);
  }
  labelViaAdapter(repo, id, kind, "add");
  logLedgerNote(repo, id, turnpikes);
  removeClerkRecord(repo, id);
  writeQueue(repo, id);
  console.log(`ticket-ready: ${id} marked ready and queued`);
  return 0;
}

function takeFlag(argv: string[], name: string): string {
  const i = argv.indexOf(name);
  if (i < 0 || i + 1 >= argv.length) die(`usage: ${usage()}`);
  return argv[i + 1]!;
}

function usage(): string {
  return [
    "ticket-ready.sh <repo> <id>",
    "ticket-ready.sh --body <file> --labels <list> [--title <t>] [--project <p>]",
    "ticket-ready.sh mark <repo> <id> [--body <file>] [--title <title>]",
    "ticket-ready.sh mark --body <file> --labels <list> --repo <repo> --id <id> [--title <t>]",
    "ticket-ready.sh unmark <repo> <id> | consume <repo> <id> | pending <repo> | queue <repo> <id>",
  ].join(" | ");
}

function main(argv: string[]): number {
  if (argv.length === 0) die(`usage: ${usage()}`);
  if (argv[0] === "--body") {
    if (argv[1] === "--labels" || argv[1] === undefined) die(`usage: ${usage()}`);
    const body = readFileSync(argv[1]!, "utf8");
    const labels = takeFlag(argv, "--labels")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const title = argv.includes("--title") ? takeFlag(argv, "--title") : "";
    const project = argv.includes("--project") ? takeFlag(argv, "--project") : "";
    if (project) process.env.POSTMASTER_PROJECT = resolve(project);
    const reasons: string[] = [];
    if (!hasReadyMark(labels)) reasons.push("ready label is missing");
    const { reasons: found, turnpikes } = runChecks({ body, title, project });
    reasons.push(...found);
    if (reasons.length > 0) {
      for (const r of reasons) console.log(r);
      return 2;
    }
    console.log("ready: --body");
    if (!turnpikes) die("checked --body but ticket-check printed no turnpikes line");
    console.log(turnpikes);
    return 0;
  }
  const verb = argv[0]!;
  if (verb === "mark" && argv[1] === "--body") {
    const body = readFileSync(takeFlag(argv, "--body"), "utf8");
    const labels = takeFlag(argv, "--labels")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const repo = takeFlag(argv, "--repo");
    const id = takeFlag(argv, "--id");
    const title = argv.includes("--title") ? takeFlag(argv, "--title") : "";
    process.env.POSTMASTER_PROJECT = resolve(repo);
    if (!hasReadyMark(labels))
      die("apply the ready label through the tracker's own tooling first, then mark again", 2);
    const { reasons, turnpikes } = runChecks({ body, title, project: repo });
    if (reasons.length > 0) {
      for (const r of reasons) console.log(r);
      return 2;
    }
    if (!turnpikes) die(`checked ${id} but ticket-check printed no turnpikes line`);
    logLedgerNote(repo, id, turnpikes);
    removeClerkRecord(repo, id);
    writeQueue(repo, id);
    console.log(`ticket-ready: ${id} marked ready and queued`);
    return 0;
  }
  if (verb === "mark" || verb === "unmark" || verb === "consume" || verb === "pending" || verb === "queue") {
    const repo = argv[1] ?? die(`usage: ${usage()}`);
    process.env.POSTMASTER_PROJECT = resolve(repo);
    if (verb === "pending") {
      if (argv.length !== 2) die(`usage: ${usage()}`);
      for (const id of pendingQueue(repo)) console.log(id);
      return 0;
    }
    const id = argv[2] ?? die(`usage: ${usage()}`);
    if (verb === "unmark") {
      if (argv.length !== 3) die(`usage: ${usage()}`);
      labelViaAdapter(repo, id, trackerKind(repo), "remove");
      removeQueue(repo, id);
      console.log(`ticket-ready: ${id} ready mark removed`);
      return 0;
    }
    if (verb === "consume") {
      if (argv.length !== 3) die(`usage: ${usage()}`);
      removeQueue(repo, id);
      console.log(`ticket-ready: ${id} ready marker consumed`);
      return 0;
    }
    if (verb === "queue") {
      if (argv.length !== 3) die(`usage: ${usage()}`);
      const kind = trackerKind(repo);
      const ticket = readViaAdapter(repo, id, kind);
      const rc = reportCheck(repo, id, ticket.title, ticket.labels, ticket.body);
      if (rc !== 0) return rc;
      writeQueue(repo, id);
      console.log(`ticket-ready: ${id} queued for dispatch`);
      return 0;
    }
    // mark <repo> <id> [--body <file>] [--title <title>]
    const rest = argv.slice(3);
    let draftFile = "";
    let draftTitle = "";
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "--body" && i + 1 < rest.length) draftFile = rest[++i]!;
      else if (rest[i] === "--title" && i + 1 < rest.length) draftTitle = rest[++i]!;
      else die(`usage: ${usage()}`);
    }
    return markAdapterTicket(repo, id, trackerKind(repo), draftFile, draftTitle);
  }
  if (argv.length !== 2) die(`usage: ${usage()}`);
  const repo = argv[0]!;
  const id = argv[1]!;
  process.env.POSTMASTER_PROJECT = resolve(repo);
  const kind = trackerKind(repo);
  const ticket = readViaAdapter(repo, id, kind);
  return reportCheck(repo, id, ticket.title, ticket.labels, ticket.body);
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
