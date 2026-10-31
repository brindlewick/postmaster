// Page bridge v1, the page's half: the messages a page sends to the viewer around it, and the checks
// on the messages it gets back. A viewer that speaks the bridge keeps a page's state between visits
// and stores the line comments the page leaves; the page reaches nothing else through it. This file
// is host-agnostic: it names no viewer, and works with any that answers the same messages.
// The review page inlines this file with its exports stripped, so it stands alone: no imports, no
// clock, no window, nothing kept between calls, and names that no page script also declares.

/** The `bridge` field of every message, and the one version this file speaks. */
export const BRIDGE_TAG = "page-bridge";
export const BRIDGE_VERSION = 1;

/** How long the page waits for `bridge-ready`, and for the answer to a request, in milliseconds. */
export const READY_WAIT_MS = 1500;
export const REQUEST_WAIT_MS = 5000;

export type BridgeCap = "state" | "comments";

/** What the page asks the viewer for in its hello. */
export const WANTED_CAPS: readonly BridgeCap[] = ["state", "comments"];

export type BridgeErrorCode =
  | "bad_message"
  | "too_large"
  | "conflict"
  | "rate_limited"
  | "unsupported"
  | "unavailable";

const ERROR_CODES: readonly BridgeErrorCode[] = [
  "bad_message",
  "too_large",
  "conflict",
  "rate_limited",
  "unsupported",
  "unavailable",
];

export type JsonObject = Readonly<Record<string, unknown>>;

export interface BridgeLimits {
  readonly messageBytes: number;
  readonly stateBytes: number;
  readonly bodyChars: number;
  readonly writesPerSecond: number;
}

/** The most a viewer may announce; a viewer may announce smaller values, never fewer fields. */
export const SPEC_LIMITS: BridgeLimits = {
  messageBytes: 65536,
  stateBytes: 262144,
  bodyChars: 4000,
  writesPerSecond: 10,
};

/** A line anchor: lines of a file as the page shows it. `quote` is the text of those lines. */
export interface LineAnchor {
  readonly kind: "line";
  readonly file: string;
  readonly side: "old" | "new";
  readonly from: number;
  readonly to: number;
  readonly quote?: string;
}

/** A comment in the contract's shape. */
export interface BridgeComment {
  readonly id: string | number;
  readonly status: "open" | "closed";
  readonly author: string;
  readonly body: string;
  readonly createdAt: string;
  readonly anchor: LineAnchor;
  readonly version: number;
}

export interface PageMessage {
  readonly bridge: typeof BRIDGE_TAG;
  readonly v: typeof BRIDGE_VERSION;
  readonly type: string;
  readonly [field: string]: unknown;
}

/** A message from the viewer, after the checks; anything that fails them is `null`. */
export type ViewerMessage =
  | {
      readonly type: "ready";
      readonly version: number;
      readonly caps: readonly BridgeCap[];
      readonly limits: BridgeLimits;
    }
  | { readonly type: "state"; readonly id: string; readonly doc: JsonObject; readonly rev: number }
  | { readonly type: "comment"; readonly id: string; readonly comment: BridgeComment }
  | {
      readonly type: "comments";
      readonly id: string;
      readonly list: readonly BridgeComment[];
      readonly truncated: boolean;
    }
  | { readonly type: "focus"; readonly anchor: LineAnchor }
  | {
      readonly type: "error";
      readonly id: string | null;
      readonly code: BridgeErrorCode;
      readonly message: string;
      /** Only on a conflict: the current document and revision, to reapply the change to. */
      readonly doc?: JsonObject;
      readonly rev?: number;
    };

const MAX_FILE_CHARS = 1024;
const MAX_QUOTE_CHARS = 2000;
const MAX_LINE_NUMBER = 2 ** 31 - 1;

// ---------- the messages the page sends ----------

const message = (type: string, fields: Readonly<Record<string, unknown>>): PageMessage => ({
  bridge: BRIDGE_TAG,
  v: BRIDGE_VERSION,
  type,
  ...fields,
});

export function helloMessage(): PageMessage {
  return message("bridge-hello", { versions: [BRIDGE_VERSION], want: [...WANTED_CAPS] });
}

export function stateGetMessage(id: string): PageMessage {
  return message("state-get", { id });
}

export function stateSetMessage(
  id: string,
  baseRev: number,
  set: JsonObject,
  del: readonly string[],
): PageMessage {
  return message("state-set", { id, baseRev, set, del });
}

export function commentsGetMessage(id: string): PageMessage {
  return message("comments-get", { id });
}

export function commentCreateMessage(id: string, body: string, anchor: LineAnchor): PageMessage {
  return message("comment-create", { id, body, anchor });
}

/** A message's size as the viewer counts it: its JSON in UTF-8 bytes. */
export function messageBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

// ---------- checks ----------

export function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A request id: 1 to 64 characters of letters, digits, underscore and hyphen. */
export function isRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/u.test(value);
}

const isRevision = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isLineNumber = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= 1 &&
  value <= MAX_LINE_NUMBER;

const positiveOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : fallback;

/** The limits in `bridge-ready`: each a positive whole number, else the spec's value for that field. */
export function readLimits(raw: unknown): BridgeLimits {
  const r = isPlainObject(raw) ? raw : {};
  return {
    messageBytes: positiveOr(r.messageBytes, SPEC_LIMITS.messageBytes),
    stateBytes: positiveOr(r.stateBytes, SPEC_LIMITS.stateBytes),
    bodyChars: positiveOr(r.bodyChars, SPEC_LIMITS.bodyChars),
    writesPerSecond: positiveOr(r.writesPerSecond, SPEC_LIMITS.writesPerSecond),
  };
}

/** Text cut to at most `max` code units, never leaving the first half of a pair. */
export function cutText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/** A line anchor as the contract defines it, or null; fields it does not know are dropped. */
export function parseLineAnchor(raw: unknown): LineAnchor | null {
  if (!isPlainObject(raw) || raw.kind !== "line") return null;
  const { file, side, from, to, quote } = raw;
  if (typeof file !== "string" || file.length < 1 || file.length > MAX_FILE_CHARS) return null;
  if (side !== "old" && side !== "new") return null;
  if (!isLineNumber(from) || !isLineNumber(to) || from > to) return null;
  if (quote !== undefined && (typeof quote !== "string" || quote.length > MAX_QUOTE_CHARS)) {
    return null;
  }
  return quote === undefined
    ? { kind: "line", file, side, from, to }
    : { kind: "line", file, side, from, to, quote };
}

/** The anchor for lines the page shows: the quote is left out when empty and cut to the limit. */
export function lineAnchorOf(
  file: string,
  side: string,
  from: number,
  to: number,
  quote: string,
): LineAnchor | null {
  const base = { kind: "line", file, side, from, to };
  return parseLineAnchor(quote === "" ? base : { ...base, quote: cutText(quote, MAX_QUOTE_CHARS) });
}

/** A comment's text: trimmed, not empty, and within the viewer's limit. */
export function checkBody(
  text: string,
  limits: BridgeLimits,
):
  | { readonly ok: true; readonly body: string }
  | { readonly ok: false; readonly reason: "empty" | "long" } {
  const body = text.trim();
  if (body === "") return { ok: false, reason: "empty" };
  return body.length > limits.bodyChars ? { ok: false, reason: "long" } : { ok: true, body };
}

function parseComment(raw: unknown): BridgeComment | null {
  if (!isPlainObject(raw)) return null;
  const anchor = parseLineAnchor(raw.anchor);
  const { id, body } = raw;
  const knownId =
    (typeof id === "string" && id !== "") || (typeof id === "number" && Number.isSafeInteger(id));
  if (anchor === null || typeof body !== "string" || !knownId) return null;
  return {
    id: id as string | number,
    status: raw.status === "closed" ? "closed" : "open",
    author: typeof raw.author === "string" ? raw.author : "",
    body,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    anchor,
    version: typeof raw.version === "number" && Number.isSafeInteger(raw.version) ? raw.version : 0,
  };
}

function parseError(raw: JsonObject): ViewerMessage {
  const id = isRequestId(raw.id) ? raw.id : null;
  const text = typeof raw.message === "string" ? raw.message : "";
  const named = (ERROR_CODES as readonly unknown[]).includes(raw.code);
  const code = named ? (raw.code as BridgeErrorCode) : "unavailable";
  if (code !== "conflict") return { type: "error", id, code, message: text };
  // A conflict is answered by reapplying the change to the document it carries; without one there is nothing to reapply to.
  return isPlainObject(raw.doc) && isRevision(raw.rev)
    ? { type: "error", id, code, message: text, doc: raw.doc, rev: raw.rev }
    : { type: "error", id, code: "unavailable", message: text };
}

/** One message from the viewer after the checks, or null when it is not a well formed version 1 message of a kind the page reads. */
export function parseViewerMessage(data: unknown): ViewerMessage | null {
  if (!isPlainObject(data) || data.bridge !== BRIDGE_TAG || data.v !== BRIDGE_VERSION) return null;
  switch (data.type) {
    case "bridge-ready": {
      if (data.version !== BRIDGE_VERSION || !Array.isArray(data.caps)) return null;
      const caps = WANTED_CAPS.filter((cap) => (data.caps as readonly unknown[]).includes(cap));
      return { type: "ready", version: BRIDGE_VERSION, caps, limits: readLimits(data.limits) };
    }
    case "state":
      return isRequestId(data.id) && isPlainObject(data.doc) && isRevision(data.rev)
        ? { type: "state", id: data.id, doc: data.doc, rev: data.rev }
        : null;
    case "comment": {
      const comment = parseComment(data.comment);
      return isRequestId(data.id) && comment !== null
        ? { type: "comment", id: data.id, comment }
        : null;
    }
    case "comments": {
      if (!isRequestId(data.id) || !Array.isArray(data.list)) return null;
      const list = (data.list as readonly unknown[]).flatMap((entry) => parseComment(entry) ?? []);
      return { type: "comments", id: data.id, list, truncated: data.truncated === true };
    }
    case "comment-focus": {
      const anchor = parseLineAnchor(data.anchor);
      return anchor === null ? null : { type: "focus", anchor };
    }
    case "bridge-error":
      return parseError(data);
    default:
      return null;
  }
}
