// The one command a session runs to put a page where its reader can open it, read what the reader
// said about it, and close what has been answered. It runs the three commands the person's [pages]
// settings name (docs/pages-contract.md) and nothing else: with no publish command it publishes
// nothing, and it falls back to no other host or service.
//
//   scripts/run pages publish <file> --slug <slug> [--marks] [--project <repo>]
//   scripts/run pages comments <slug> [--all] [--json] [--project <repo>]
//   scripts/run pages close <id>... [--project <repo>]
//   scripts/run pages slug <word>...
//   scripts/run pages status [--project <repo>]
//
// publish   hands the file and the slug to the publish command and prints the page's exact title and
//           link, as the host printed them. --marks says the page lets its reader tick files and
//           comment on lines, and adds one sentence about whether the host keeps ticks (state).
// comments  prints the open comments on a slug, or every comment with --all, or the comments as one
//           JSON array with --json. A comment the tool cannot place is printed without a place.
// close     closes each comment id; an id the host does not know fails, and the rest are still tried.
// slug      makes a name any host can take from words: lowercase letters, digits, single hyphens.
// status    says which settings are set, without printing the commands.
//
// The settings are the machine config's [pages] with the project's .postmaster/settings.toml over it,
// key by key; the shared project.toml cannot carry them. --project names the project whose settings
// are read; it defaults to the repository the command runs in.
//
//   exit 0  done; or a command that is not set and is allowed to be left out (comments, close) said so
//   exit 1  usage, settings that do not read, a host command that failed, or output the contract does
//           not allow, with the reason on stderr
//   exit 2  there is no publish command, so nothing was (publish), or can be (status), published
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { effectiveConfigForProject, repoTopLevel } from "./lib/effective-config.ts";
import {
  type Checked,
  commandFor,
  describeFailure,
  execute,
  isSlug,
  type PagesSettings,
  parsePages,
  plain,
  slugOf,
} from "./lib/pages-host.ts";
import {
  formatComment,
  type PageComment,
  parseComments,
  parsePublished,
  stateLine,
} from "./lib/pages-output.ts";

export const USAGE = [
  "usage: run pages publish <file> --slug <slug> [--marks] [--project <repo>]",
  "       run pages comments <slug> [--all] [--json] [--project <repo>]",
  "       run pages close <id>... [--project <repo>]",
  "       run pages slug <word>...",
  "       run pages status [--project <repo>]",
].join("\n");

/** How long a command may run before it is stopped: a publish sends a whole page. */
const PUBLISH_SECONDS = 300;
const READ_SECONDS = 60;

export type Parsed =
  | {
      readonly command: "publish";
      readonly file: string;
      readonly slug: string;
      readonly marks: boolean;
      readonly project: string | null;
    }
  | {
      readonly command: "comments";
      readonly slug: string;
      readonly all: boolean;
      readonly json: boolean;
      readonly project: string | null;
    }
  | { readonly command: "close"; readonly ids: readonly string[]; readonly project: string | null }
  | { readonly command: "slug"; readonly parts: readonly string[] }
  | { readonly command: "status"; readonly project: string | null };

const usage = (): Checked<Parsed> => ({ ok: false, error: USAGE });

/** The words after a command: flags by name (the value-taking ones listed), everything else in order. */
function split(
  rest: readonly string[],
  withValue: readonly string[],
  without: readonly string[],
): { words: string[]; values: Map<string, string>; flags: Set<string> } | null {
  const words: string[] = [];
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < rest.length; i++) {
    const word = rest[i] ?? "";
    if (withValue.includes(word)) {
      const value = rest[i + 1];
      if (value === undefined) return null;
      values.set(word, value);
      i += 1;
    } else if (without.includes(word)) {
      flags.add(word);
    } else if (word.startsWith("-") && word !== "-") {
      return null;
    } else {
      words.push(word);
    }
  }
  return { words, values, flags };
}

export function parseArgs(argv: readonly string[]): Checked<Parsed> {
  const [command, ...rest] = argv;
  if (command === "slug") {
    return rest.length === 0 ? usage() : { ok: true, value: { command, parts: rest } };
  }
  const parsed =
    command === "publish"
      ? split(rest, ["--slug", "--project"], ["--marks"])
      : command === "comments"
        ? split(rest, ["--project"], ["--all", "--json"])
        : command === "close" || command === "status"
          ? split(rest, ["--project"], [])
          : null;
  if (parsed === null) return usage();
  const project = parsed.values.get("--project") ?? null;
  const [first, ...others] = parsed.words;
  switch (command) {
    case "publish": {
      const slug = parsed.values.get("--slug");
      if (first === undefined || others.length > 0 || slug === undefined) return usage();
      return {
        ok: true,
        value: { command, file: first, slug, marks: parsed.flags.has("--marks"), project },
      };
    }
    case "comments":
      if (first === undefined || others.length > 0) return usage();
      return {
        ok: true,
        value: {
          command,
          slug: first,
          all: parsed.flags.has("--all"),
          json: parsed.flags.has("--json"),
          project,
        },
      };
    case "close":
      return first === undefined
        ? usage()
        : { ok: true, value: { command, ids: parsed.words, project } };
    default:
      return parsed.words.length > 0
        ? usage()
        : { ok: true, value: { command: "status", project } };
  }
}

// ---------- settings ----------

/** The [pages] settings of a project: its own over the machine's, key by key. Nothing set is fine. */
function loadSettings(project: string | null): Checked<PagesSettings> {
  const repo = project ?? (repoTopLevel(process.cwd()) || process.cwd());
  const resolved = effectiveConfigForProject(repo);
  if (resolved.notice !== null) console.error(resolved.notice);
  // A project with no settings anywhere has no [pages], which is not a fault.
  if (resolved.error !== null && !resolved.error.startsWith("no config at ")) {
    return { ok: false, error: resolved.error };
  }
  return parsePages(resolved.config?.pages);
}

const SETTINGS_PLACE =
  "in the machine config or in the project's .postmaster/settings.toml (docs/pages-contract.md)";

// ---------- the commands ----------

const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

const slugProblem = (): string =>
  "the slug must be lowercase letters and digits with single hyphens, 64 characters at most (run pages slug <word>... makes one)";

function publish(c: Extract<Parsed, { command: "publish" }>): number {
  if (!isSlug(c.slug)) {
    console.error(`pages: ${slugProblem()}`);
    return 1;
  }
  const file = resolve(c.file);
  if (!isFile(file)) {
    console.error(`pages: ${file} is not a file`);
    return 1;
  }
  const settings = loadSettings(c.project);
  if (!settings.ok) {
    console.error(`pages: ${settings.error}`);
    return 1;
  }
  const argv = commandFor(settings.value, "publish", { file, slug: c.slug });
  if (argv === null) {
    console.error(
      [
        "pages: no publish command is set, so nothing was published.",
        `Set publish in [pages] ${SETTINGS_PLACE}.`,
        `The page is at ${file}.`,
      ].join("\n"),
    );
    return 2;
  }
  const result = execute(argv, { timeoutMs: PUBLISH_SECONDS * 1000 });
  if (result.code !== 0) {
    console.error(`pages: ${describeFailure("publish", result, PUBLISH_SECONDS)}`);
    return 1;
  }
  const page = parsePublished(result.out);
  if (page === null) {
    console.error(
      "pages: the publish command exited 0 but printed no line `Title: <title>` with an http or https link on the next line (docs/pages-contract.md), so the page cannot be named",
    );
    return 1;
  }
  console.log(`Title: ${plain(page.title)}`);
  console.log(plain(page.link));
  if (c.marks) console.log(stateLine(settings.value));
  return 0;
}

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function comments(c: Extract<Parsed, { command: "comments" }>): number {
  if (!isSlug(c.slug)) {
    console.error(`pages: ${slugProblem()}`);
    return 1;
  }
  const settings = loadSettings(c.project);
  if (!settings.ok) {
    console.error(`pages: ${settings.error}`);
    return 1;
  }
  const argv = commandFor(settings.value, "comments", { slug: c.slug });
  if (argv === null) {
    const note =
      "pages: cannot read comments for this host: no comments command is set in [pages] (pages.comments)";
    if (c.json) {
      console.error(note);
      console.log("[]");
    } else {
      console.log(note);
    }
    return 0;
  }
  const result = execute(argv, { timeoutMs: READ_SECONDS * 1000 });
  if (result.code !== 0) {
    console.error(`pages: ${describeFailure("comments", result, READ_SECONDS)}`);
    return 1;
  }
  const read = parseComments(result.out);
  if (!read.ok) {
    console.error(`pages: ${read.error}`);
    return 1;
  }
  if (read.value.skipped > 0) {
    console.error(
      `pages: ${count(read.value.skipped, "element", "elements")} of the comments output had no usable id and ${read.value.skipped === 1 ? "was" : "were"} left out`,
    );
  }
  const shown: readonly PageComment[] = c.all
    ? read.value.comments
    : read.value.comments.filter((comment) => comment.status === "open");
  if (c.json) {
    console.log(JSON.stringify(shown, null, 2));
    return 0;
  }
  const kind = c.all ? "comment" : "open comment";
  if (shown.length === 0) {
    console.log(`No ${c.all ? "comments" : "open comments"} on ${c.slug}.`);
    return 0;
  }
  console.log(`${count(shown.length, kind, `${kind}s`)} on ${c.slug}:`);
  for (const comment of shown) console.log(`\n${formatComment(comment)}`);
  return 0;
}

/** Whether an id can go to a host as it is: some text, on one line, that no command line reads as an option. */
const isId = (id: string): boolean =>
  id !== "" && id.length <= 256 && !id.startsWith("-") && !/[\u0000-\u001f\u007f]/u.test(id);

function close(c: Extract<Parsed, { command: "close" }>): number {
  const bad = c.ids.find((id) => !isId(id));
  if (bad !== undefined) {
    console.error(
      `pages: ${JSON.stringify(plain(bad).slice(0, 60))} is not an id: it must be some text on one line that does not start with a hyphen`,
    );
    return 1;
  }
  const settings = loadSettings(c.project);
  if (!settings.ok) {
    console.error(`pages: ${settings.error}`);
    return 1;
  }
  if (settings.value.close === null) {
    console.log(
      "pages: cannot close comments: no close command is set in [pages] (pages.close), so they stay open",
    );
    return 0;
  }
  let failed = 0;
  for (const id of c.ids) {
    const argv = commandFor(settings.value, "close", { id });
    if (argv === null) continue;
    const result = execute(argv, { timeoutMs: READ_SECONDS * 1000 });
    if (result.code === 0) {
      console.log(`closed ${id}`);
    } else {
      failed += 1;
      console.error(`pages: ${describeFailure(`close ${plain(id)}`, result, READ_SECONDS)}`);
    }
  }
  return failed === 0 ? 0 : 1;
}

function slug(c: Extract<Parsed, { command: "slug" }>): number {
  const made = slugOf(c.parts);
  if (made === "") {
    console.error("pages: those words hold no letter or digit to make a slug from");
    return 1;
  }
  console.log(made);
  return 0;
}

function status(c: Extract<Parsed, { command: "status" }>): number {
  const settings = loadSettings(c.project);
  if (!settings.ok) {
    console.error(`pages: ${settings.error}`);
    return 1;
  }
  const s = settings.value;
  const set = (v: string | null): string => (v === null ? "not set" : "set");
  console.log(`publish: ${set(s.publish)}`);
  console.log(`comments: ${set(s.comments)}`);
  console.log(`close: ${set(s.close)}`);
  console.log(`bridge: ${s.bridge ?? "not set"}`);
  console.log(`state: ${s.state}`);
  if (s.publish === null) {
    console.log(
      `no publish command is set: pages are built but not published. Set publish in [pages] ${SETTINGS_PLACE}.`,
    );
    return 2;
  }
  return 0;
}

export function main(argv: readonly string[]): number {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 1;
  }
  const c = parsed.value;
  switch (c.command) {
    case "publish":
      return publish(c);
    case "comments":
      return comments(c);
    case "close":
      return close(c);
    case "slug":
      return slug(c);
    case "status":
      return status(c);
  }
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
