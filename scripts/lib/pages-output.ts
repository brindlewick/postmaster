// The tool's side of docs/pages-contract.md, the output half: what a publish command printed (the
// exact title and the link), what a comments command printed (one JSON array, read leniently), how a
// comment is shown to a person, and what may be said about ticks. The commands themselves, and the
// settings that name them, are in pages-host.ts. Everything here is pure.
import { bad, type Checked, isTable, ok, type PagesSettings, plain } from "./pages-host.ts";

// ---------- what publish prints ----------

export interface PublishedPage {
  readonly title: string;
  readonly link: string;
}

const isHttpLink = (text: string): boolean => {
  if (!/^https?:\/\/\S+$/iu.test(text)) return false; // ASCII: a link holds no whitespace of any kind
  try {
    const url = new URL(text);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
  } catch {
    return false;
  }
};

/**
 * The page a publish command named: the exact text after "Title: " on one line and an absolute
 * http or https link on the line after it. Other lines are ignored; null when no such pair is there.
 */
export function parsePublished(stdout: string): PublishedPage | null {
  const lines = stdout.split(/\r?\n/u);
  for (let i = 0; i + 1 < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!line.startsWith("Title: ")) continue;
    const title = line.slice("Title: ".length);
    const link = (lines[i + 1] ?? "").trim();
    if (title.trim() !== "" && isHttpLink(link)) return { title, link };
  }
  return null;
}

// ---------- what comments prints ----------

export type Anchor =
  | {
      readonly kind: "text";
      readonly quote: string;
      readonly prefix: string;
      readonly suffix: string;
    }
  | {
      readonly kind: "line";
      readonly file: string;
      readonly side: "old" | "new";
      readonly from: number;
      readonly to: number;
      readonly quote?: string;
    };

export interface PageComment {
  readonly id: string | number;
  readonly status: "open" | "closed";
  readonly author: string;
  readonly body: string;
  readonly createdAt: string;
  readonly version: number | null;
  /** Null for a comment with no anchor, or one of a kind this tool does not know. */
  readonly anchor: Anchor | null;
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");
const whole = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

function anchorOf(raw: unknown): Anchor | null {
  if (!isTable(raw)) return null;
  if (raw.kind === "text" && typeof raw.quote === "string") {
    return { kind: "text", quote: raw.quote, prefix: text(raw.prefix), suffix: text(raw.suffix) };
  }
  if (
    raw.kind === "line" &&
    typeof raw.file === "string" &&
    raw.file !== "" &&
    (raw.side === "old" || raw.side === "new") &&
    whole(raw.from) &&
    whole(raw.to) &&
    raw.from >= 1 &&
    raw.to >= raw.from
  ) {
    const lines = {
      kind: "line",
      file: raw.file,
      side: raw.side,
      from: raw.from,
      to: raw.to,
    } as const;
    return typeof raw.quote === "string" ? { ...lines, quote: raw.quote } : lines;
  }
  return null;
}

function commentOf(raw: unknown): PageComment | null {
  if (!isTable(raw)) return null;
  const id = raw.id;
  if (!(typeof id === "string" && id !== "") && !whole(id)) return null;
  return {
    id,
    status: raw.status === "closed" ? "closed" : "open",
    author: text(raw.author),
    body: text(raw.body),
    createdAt: text(raw.createdAt),
    version: whole(raw.version) ? raw.version : null,
    anchor: anchorOf(raw.anchor),
  };
}

/**
 * The comments a host printed. Fields the tool does not know are dropped; a comment whose anchor is of
 * another kind, or is not whole, is kept without one; an element with no usable id is counted as skipped.
 */
export function parseComments(
  stdout: string,
): Checked<{ readonly comments: readonly PageComment[]; readonly skipped: number }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return bad("the comments command did not print one JSON array");
  }
  if (!Array.isArray(parsed)) return bad("the comments command did not print one JSON array");
  const comments: PageComment[] = [];
  let skipped = 0;
  for (const element of parsed) {
    const comment = commentOf(element);
    if (comment === null) skipped += 1;
    else comments.push(comment);
  }
  return ok({ comments, skipped });
}

/** A comment as lines for a person: who and when, where it points, then its words. */
export function formatComment(c: PageComment): string {
  const head = [
    `${c.id} ${c.status}`,
    c.author,
    c.createdAt,
    c.version === null ? "" : `version ${c.version}`,
  ]
    .filter((part) => part !== "")
    .join(", ");
  const a = c.anchor;
  const where =
    a === null
      ? "not anchored to a place on the page"
      : a.kind === "text"
        ? `on the text ${JSON.stringify(a.quote)}`
        : `on ${a.file}, ${a.side} side, ${a.from === a.to ? `line ${a.from}` : `lines ${a.from} to ${a.to}`}`;
  const lines = [head, `  ${where}`];
  if (a !== null && a.kind === "line" && a.quote !== undefined) {
    lines.push(`  lines read: ${JSON.stringify(a.quote)}`);
  }
  for (const line of c.body.split(/\r?\n/u)) lines.push(`  ${line}`);
  return plain(lines.join("\n"));
}

// ---------- what may be said about ticks ----------

/** One sentence about whether a published page's ticks are kept: promised only when state is set. */
export function stateLine(settings: PagesSettings): string {
  return settings.state
    ? "Ticks are kept between visits, and line comments are sent to the host."
    : "Ticks are not promised to outlast one visit: pages.state is not true for this host.";
}
