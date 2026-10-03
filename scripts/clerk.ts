// The booking clerk's launch: write the brief and start the session.
//
//   clerk.sh brief <repo> <id>                  write the draft and the brief
//   clerk.sh start <repo> <id>                  write the brief and open the clerk in a new tab
//
// brief unmarks a marked ticket first, so the postmaster cannot dispatch it
// while the clerk works; start refuses a ticket whose session the host still
// shows, and tells the user to open the clerk by hand when no host answers.
// The session is named for the ticket's number and title, as the adapter
// reads them. The postmaster logs the dispatch; this script records only the
// open session.
//
// Exit 0 done; 3 no session host; 1 anything else.

import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { tryTomlFile } from "./lib/data.ts";
import { scriptsDir, toolRoot } from "./lib/paths.ts";
import { run } from "./lib/proc.ts";

const HERE = scriptsDir(import.meta);
const TOOL = toolRoot(import.meta);

function die(message: string, code = 1): never {
  console.error(`clerk: ${message}`);
  process.exit(code);
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function readStrict(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (e: unknown) {
    die(`cannot read ${path} (${(e as Error)?.message ?? e})`);
  }
}

function findSection(doc: Record<string, unknown>, path: string[]): Record<string, unknown> | null {
  let node: unknown = doc;
  for (const key of path) {
    if (typeof node !== "object" || node === null || !(key in (node as Record<string, unknown>)))
      return null;
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === "object" && node !== null ? (node as Record<string, unknown>) : null;
}

function findString(doc: Record<string, unknown>, path: string[]): string {
  const parent = findSection(doc, path.slice(0, -1));
  const key = path[path.length - 1] ?? "";
  const value = parent?.[key];
  return typeof value === "string" ? value : "";
}

function configPath(): string {
  const override = (process.env.POSTMASTER_CONFIG ?? "").trim();
  if (override) return override;
  return join(homedir(), ".postmaster", "config.toml");
}

function readConfig(): { path: string; doc: Record<string, unknown> } {
  const path = configPath();
  if (!isFile(path)) die(`no machine config at ${path}; run setup.sh first`);
  const doc = tryTomlFile(path);
  if (!doc) die(`cannot parse ${path}`);
  return { path, doc };
}

function runScript(name: string, args: string[]): { code: number; out: string; err: string } {
  const r = run(join(HERE, name), args);
  return { code: r.code, out: r.out ?? "", err: r.err ?? "" };
}

function requireScript(name: string, args: string[], what: string): string {
  const r = runScript(name, args);
  if (r.code !== 0) die(`${what} (${(r.out + r.err).trim() || `exit ${r.code}`})`);
  return r.out;
}

function trackerKind(repo: string): string {
  return requireScript("tracker-kind.sh", [repo], `tracker-kind.sh ${repo} failed`).trim();
}

function parseTicketRead(out: string): { title: string; labels: string[] } {
  let title = "";
  let labels: string[] = [];
  for (const raw of out.split("\n")) {
    const line = raw.replace(/\r$/u, "");
    if (line === "") break;
    const m = /^([A-Za-z-]+):[ \t]*(.*)$/u.exec(line);
    if (!m) continue;
    // ASCII: adapter header names are machine-written; folded once against ASCII literals.
    const key = m[1]!.toLowerCase();
    if (key === "title") title = m[2]!;
    if (key === "labels")
      labels = m[2]!
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  }
  return { title, labels };
}

function readTicket(
  repo: string,
  id: string,
  kind: string,
): { title: string; labels: string[] } | null {
  const base = kind === "plane" ? [] : [repo];
  const r = runScript(`${kind}.sh`, [...base, "read", id]);
  if (r.code !== 0) return null;
  return parseTicketRead(r.out);
}

function displayId(kind: string, id: string): string {
  if (kind === "plane") return id.includes("-") ? id : `PM-${id}`;
  if (kind === "other") return id;
  return id.startsWith("#") ? id : `#${id}`;
}

function defaultBase(repo: string): string {
  const head = run("git", ["-C", repo, "rev-parse", "origin/HEAD"]);
  if (head.code === 0) {
    const ref = (head.out ?? "").trim().split(" ").pop() ?? "";
    if (ref) {
      const tip = run("git", ["-C", repo, "rev-parse", ref]);
      if (tip.code === 0 && (tip.out ?? "").trim()) return (tip.out ?? "").trim();
    }
  }
  const local = run("git", ["-C", repo, "rev-parse", "HEAD"]);
  if (local.code === 0 && (local.out ?? "").trim()) return (local.out ?? "").trim();
  die(`cannot read a base commit from ${repo}`);
}

function editorLink(template: string, draft: string): string {
  // The review link template addresses {path} as a folder (code-server opens
  // folders): the folder holding the draft.
  if (!template) return draft;
  return template.split("{path}").join(dirname(draft));
}

function clerkDir(repo: string): string {
  return join(repo, ".postmaster", "clerk");
}

// A ticket id can hold slashes on some trackers; encode it so the clerk's
// files always stay inside the clerk directory.
function clerkFile(repo: string, id: string, suffix: string): string {
  return join(clerkDir(repo), `${encodeURIComponent(id)}${suffix}`);
}

function sessionDir(repo: string): string {
  return join(repo, ".postmaster", "runs", "postmaster", "clerks");
}

type Brief = {
  id: string;
  name: string;
  session: string;
  ticket: string;
  repo: string;
  tool: string;
  base: string;
  draft: string;
  link: string;
  preferences: string;
  skill: string;
  runbook: string;
  title: string;
};

function writeBrief(repo: string, id: string): Brief {
  const kind = trackerKind(repo);
  const ticket = readTicket(repo, id, kind) ?? { title: "", labels: [] };
  const name = displayId(kind, id);
  const session = ticket.title ? `${name}, ${ticket.title}` : name;
  // ASCII: folds label names for the ASCII literal "ready"; only ASCII-equal names match.
  if (ticket.labels.some((l) => l.toLowerCase() === "ready")) {
    requireScript(
      "ticket-ready.sh",
      ["unmark", repo, id],
      `the ready mark on ${name} could not be removed; the clerk stops so the ticket is not dispatched mid-edit`,
    );
  }
  const { path: cfgPath, doc } = readConfig();
  const template = findString(doc, ["planning", "review_link"]);
  const prefsPath = join(dirname(cfgPath), "preferences.md");
  const preferences = isFile(prefsPath)
    ? readStrict(prefsPath).replace(/\n+$/u, "")
    : "None are set.";
  const base = defaultBase(repo);
  const dir = clerkDir(repo);
  mkdirSync(dir, { recursive: true });
  const draft = clerkFile(repo, id, ".md");
  const link = editorLink(template, draft);
  const skill = join(TOOL, "skills", "clerk", "SKILL.md");
  const runbook = join(TOOL, "skills", "clerk", "clerk.md");
  const briefPath = clerkFile(repo, id, ".brief.md");
  const lines = [
    `# Brief: booking clerk for ${session}`,
    "",
    `Ticket: ${name} on ${kind}`,
    `Repository: ${repo}`,
    `Tool: ${TOOL}`,
    `Base: ${base} (the default branch's tip when this was written)`,
    `Base worktree: ${repo}`,
    `Draft: ${draft}`,
    `Editor link: ${link}`,
    "",
    "## Standing preferences",
    "",
    preferences,
    "",
    "## Read first",
    "",
    `Skill: ${skill}`,
    `Runbook: ${runbook}`,
    "",
  ];
  if (ticket.title) lines.push(`## The ticket as read`, "", `Title: ${ticket.title}`, "");
  writeFileSync(briefPath, lines.join("\n"));
  if (!isFile(draft)) {
    writeFileSync(
      draft,
      [
        `DRAFT: ${name} is being prepared and is not ready to run`,
        "",
        "## Problem / feature",
        "",
        "",
      ].join("\n"),
    );
  }
  return {
    id,
    name,
    session,
    ticket: name,
    repo,
    tool: TOOL,
    base,
    draft,
    link,
    preferences,
    skill,
    runbook,
    title: ticket.title,
  };
}

function sessionPath(repo: string, id: string): string {
  return join(sessionDir(repo), `${encodeURIComponent(id)}.json`);
}

function recordOpen(repo: string, id: string, name: string, brief: string, handle: string): void {
  mkdirSync(sessionDir(repo), { recursive: true });
  writeFileSync(
    sessionPath(repo, id),
    `${JSON.stringify({ ticket: name, brief, handle, opened: new Date().toISOString() })}\n`,
  );
}

function readSession(repo: string, id: string): { handle: string } | null {
  try {
    const raw = JSON.parse(readFileSync(sessionPath(repo, id), "utf8")) as { handle?: unknown };
    if (typeof raw.handle !== "string") return null;
    return { handle: raw.handle };
  } catch {
    return null;
  }
}

function sessionAlive(handle: string): boolean {
  if (!handle) return false;
  const r = runScript("host.sh", ["read", handle]);
  return r.code === 0;
}

// Split a printed `launch: ...` form into argv words: single and double quotes
// group, a backslash escapes the next character, whitespace separates. The
// `launch: ` prefix and a leading `cd <dir> &&` are dropped: the caller
// passes its own cwd to the host.
export function splitCommand(line: string): string[] {
  const rest = line.replace(/^launch:[ \t]*/u, "");
  const words: string[] = [];
  let word = "";
  let quote = "";
  let escaped = false;
  let open = false;
  for (const ch of rest) {
    if (escaped) {
      word += ch;
      escaped = false;
      open = true;
    } else if (ch === "\\" && quote !== "'") {
      escaped = true;
    } else if ((ch === "'" || ch === '"') && !quote) {
      quote = ch;
      open = true;
    } else if (ch === quote) {
      quote = "";
    } else if (!quote && (ch === " " || ch === "\t" || ch === "\n")) {
      if (open) {
        words.push(word);
        word = "";
        open = false;
      }
    } else {
      word += ch;
      open = true;
    }
  }
  if (escaped) word += "\\";
  if (open) words.push(word);
  if (words.length >= 3 && words[0] === "cd" && words[2] === "&&") return words.slice(3);
  return words;
}

function usage(): string {
  return ["clerk.sh brief <repo> <id>", "clerk.sh start <repo> <id>"].join(" | ");
}

function cmdBrief(repo: string, id: string): number {
  const brief = writeBrief(repo, id);
  console.log(`clerk: brief for ${brief.name} at ${clerkFile(repo, id, ".brief.md")}`);
  return 0;
}

function cmdStart(repo: string, id: string): number {
  const open = readSession(repo, id);
  if (open?.handle && sessionAlive(open.handle)) {
    die(`one booking clerk session is open for ${id} already; continue it or finish it first`);
  }
  const brief = writeBrief(repo, id);
  const briefPath = clerkFile(repo, id, ".brief.md");
  const startCmd = requireScript(
    "launch.sh",
    ["interactive", "clerk", "--project", repo, "--name", brief.session],
    "launch.sh printed no interactive command for the clerk",
  ).trim();
  if (!startCmd) die("launch.sh printed no interactive command for the clerk");
  const form = splitCommand(startCmd);
  if (form.length === 0) die("launch.sh printed no interactive command for the clerk");
  // The handle is the ticket's id; the tab carries the session's number and title.
  const handle = brief.name;
  const started = runScript("host.sh", [
    "spawn",
    handle,
    repo,
    "--label",
    brief.session,
    "--",
    ...form,
  ]);
  if (started.code === 3) {
    console.error(`clerk: no session host answers; open ${brief.session} by hand:`);
    console.error(startCmd.replace(/^launch:[ \t]*/u, ""));
    console.error(`then read the brief at ${briefPath}.`);
    return 3;
  }
  if (started.code !== 0)
    die(`the clerk session could not start (${(started.out + started.err).trim()})`);
  if (!started.out.includes("handle=")) {
    die(
      `the clerk session started but the host did not confirm its handle (${started.out.trim()})`,
    );
  }
  recordOpen(repo, id, brief.session, briefPath, handle);
  const promptFile = clerkFile(repo, id, ".prompt.md");
  writeFileSync(
    promptFile,
    `You are the booking clerk for ${brief.session}. Read the skill at ${brief.skill}, then the runbook, then the brief at ${briefPath}. The draft is at ${brief.draft}; greet the user from there.\n`,
  );
  const sent = runScript("host.sh", ["send", handle, promptFile]);
  if (sent.code !== 0)
    die(
      `the clerk session started but the brief could not be sent (${(sent.out + sent.err).trim()})`,
    );
  console.log(`clerk: ${brief.session} opened (session ${handle})`);
  return 0;
}

function main(argv: string[]): number {
  const verb = argv[0] ?? "";
  if ((verb === "brief" || verb === "start") && argv.length === 3) {
    process.env.POSTMASTER_PROJECT = resolve(argv[1]!);
    return verb === "brief" ? cmdBrief(argv[1]!, argv[2]!) : cmdStart(argv[1]!, argv[2]!);
  }
  console.error(`usage: ${usage()}`);
  return 1;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
