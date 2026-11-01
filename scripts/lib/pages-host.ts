// The tool's side of docs/pages-contract.md, the settings half: the [pages] table, the three commands
// it names, and how a command runs. Nothing here knows which host a person has. The commands are theirs,
// written in their own settings; the tool splits each into words, puts its values into the words, and
// runs the result as an argument list, never through a shell. The tool falls back to no other host.
// What the commands print is read in pages-output.ts.
//
// The functions are pure except `execute`, which is the one place a command starts.
import { type RunResult, run } from "./proc.ts";

/** The one bridge version the contract defines. */
export const BRIDGE_V1 = "page-bridge-v1";

export type Checked<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export const ok = <T>(value: T): Checked<T> => ({ ok: true, value });
export const bad = (error: string): Checked<never> => ({ ok: false, error });

/** What a person's [pages] table holds, once it has been read. A command that is not set is null. */
export interface PagesSettings {
  readonly publish: string | null;
  readonly comments: string | null;
  readonly close: string | null;
  readonly bridge: typeof BRIDGE_V1 | null;
  readonly state: boolean;
}

export const NO_PAGES: PagesSettings = {
  publish: null,
  comments: null,
  close: null,
  bridge: null,
  state: false,
};

/** The three commands and the placeholders each one takes, every one of which it needs. */
const COMMANDS = {
  publish: ["file", "slug"],
  comments: ["slug"],
  close: ["id"],
} as const;

export type CommandKey = keyof typeof COMMANDS;

const KEYS = ["publish", "comments", "close", "bridge", "state"] as const;

/** A whole placeholder: braces round a name with no braces or spaces in it. */
const PLACEHOLDER = /\{([^{}\s]*)\}/gu; // ASCII: JavaScript's own whitespace set, on purpose: no space of any kind in a name
/** Control characters that are not whitespace; a command line holds none. */
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
/** Control characters a terminal would act on, to drop from text shown to a person; tab and line break stay. */
const TERMINAL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/gu;

export const isTable = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/** Text for a person's screen: the characters a terminal would act on are dropped. */
export const plain = (text: string): string => text.replace(TERMINAL, "");

/** A template's words: split on whitespace, before anything is put in. */
export function splitTemplate(template: string): string[] {
  return template.split(/\s+/u).filter((word) => word !== ""); // ASCII: whitespace is JavaScript's own set
}

const listOf = (names: readonly string[]): string => names.map((n) => `{${n}}`).join(" and ");

function checkTemplate(key: CommandKey, value: unknown): Checked<string> {
  const where = `pages.${key}`;
  if (typeof value !== "string" || value.trim() === "" || CONTROL.test(value)) {
    return bad(`${where} must be a command: text with the program first, on one command line`);
  }
  const words = splitTemplate(value);
  const needed = COMMANDS[key];
  if (/[{}]/u.test(words[0] ?? "")) {
    return bad(`${where} starts with a brace; its first word is the program and is fixed text`);
  }
  const used = new Set<string>();
  for (const word of words) {
    const rest = word.replace(PLACEHOLDER, (_m, name: string) => {
      used.add(name);
      return "";
    });
    if (/[{}]/u.test(rest)) {
      return bad(
        `${where} has a brace that is not a whole placeholder, in ${JSON.stringify(word)}`,
      );
    }
  }
  for (const name of used) {
    if (!(needed as readonly string[]).includes(name)) {
      return bad(
        `${where} uses {${name}}, which is not a placeholder of ${key}; it takes ${listOf(needed)}`,
      );
    }
  }
  for (const name of needed) {
    if (!used.has(name)) {
      return bad(
        `${where} has no {${name}}; it needs ${listOf(needed)} to say which page it is about`,
      );
    }
  }
  return ok(value.trim());
}

/**
 * The [pages] table as the contract allows it. Nothing set is fine, and so is any command left out;
 * a key the contract does not have, an unknown placeholder, a command that cannot name the page or
 * comment it is for, an unknown bridge version, and state without a bridge each stop with the key named.
 */
export function parsePages(raw: unknown): Checked<PagesSettings> {
  if (raw === undefined) return ok(NO_PAGES);
  if (!isTable(raw)) return bad("pages must be a table (the [pages] settings)");
  const unknown = Object.keys(raw)
    .filter((k) => !(KEYS as readonly string[]).includes(k))
    .sort()[0];
  if (unknown !== undefined) {
    return bad(`pages.${unknown} is not a key of [pages]; the keys are ${KEYS.join(", ")}`);
  }
  const commands: Record<CommandKey, string | null> = {
    publish: null,
    comments: null,
    close: null,
  };
  for (const key of Object.keys(COMMANDS) as CommandKey[]) {
    if (raw[key] === undefined) continue;
    const checked = checkTemplate(key, raw[key]);
    if (!checked.ok) return checked;
    commands[key] = checked.value;
  }
  let bridge: PagesSettings["bridge"] = null;
  if (raw.bridge !== undefined) {
    if (typeof raw.bridge !== "string" || raw.bridge === "") {
      return bad(
        `pages.bridge must be text naming a bridge version; the only one is "${BRIDGE_V1}"`,
      );
    }
    if (raw.bridge !== BRIDGE_V1) {
      const named = JSON.stringify(raw.bridge).slice(0, 80);
      return bad(
        `pages.bridge names ${named}, a bridge version this tool does not know; the only one is "${BRIDGE_V1}"`,
      );
    }
    bridge = BRIDGE_V1;
  }
  if (raw.state !== undefined && typeof raw.state !== "boolean") {
    return bad("pages.state must be true or false");
  }
  const state = raw.state === true;
  if (state && bridge === null) {
    return bad(
      `pages.state is true, but only a bridge offers state; set pages.bridge to "${BRIDGE_V1}"`,
    );
  }
  return ok({ ...commands, bridge, state });
}

/** The words of a template with its values put in; each value stays inside the one word it was put in. */
export function expandTemplate(
  template: string,
  values: Readonly<Record<string, string>>,
): string[] {
  // A function replacer, so a value holding "$&" or "$1" goes in as written, and one pass,
  // so a value that looks like a placeholder is not read as one.
  return splitTemplate(template).map((word) =>
    word.replace(PLACEHOLDER, (_m, name: string) => values[name] ?? ""),
  );
}

/** The argument list a command setting makes for these values, or null when the command is not set. */
export function commandFor(
  settings: PagesSettings,
  key: CommandKey,
  values: Readonly<Record<string, string>>,
): string[] | null {
  const template = settings[key];
  return template === null ? null : expandTemplate(template, values);
}

// ---------- names ----------

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SLUG_MAX = 64;

/** Whether a name is one any host can take: lowercase letters and digits with single hyphens, 64 at most. */
export const isSlug = (name: string): boolean => name.length <= SLUG_MAX && SLUG.test(name);

/** A slug from its parts, or an empty string when they hold no letter or digit. */
export function slugOf(parts: readonly string[]): string {
  return parts
    .join("-")
    .toLowerCase() // LOWER: every letter that is not a-z after this becomes a hyphen
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/u, "");
}

// ---------- running a command ----------

const SHOWN_STDERR = 2000;

/** What a person is shown when a command did not succeed: the host's own words, whatever stdout held. */
export function describeFailure(what: string, r: RunResult, seconds: number): string {
  if (r.timedOut) return `${what} did not finish in ${seconds} seconds and was stopped`;
  const said = plain(r.err).trim();
  if (said === "") return `${what} failed (exit ${r.code}); the command wrote nothing on stderr`;
  const cut = said.length > SHOWN_STDERR ? `${said.slice(0, SHOWN_STDERR)} ...` : said;
  const [first = "", ...rest] = cut.split("\n");
  return [`${what} failed (exit ${r.code}): ${first}`, ...rest.map((line) => `  ${line}`)].join(
    "\n",
  );
}

/** Start the program with its arguments, with no shell and no input; the one effect here. */
export function execute(
  argv: readonly string[],
  options: { readonly timeoutMs: number; readonly cwd?: string },
): RunResult {
  const [program = "", ...args] = argv;
  return run(program, args, {
    timeout: options.timeoutMs,
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
  });
}
