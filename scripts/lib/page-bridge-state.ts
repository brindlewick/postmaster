// The saved state of a page, as the page keeps it through the page bridge: the viewer's document as
// last seen, and the changes the reader has made to it that the viewer has not yet confirmed. A
// change is a key set or deleted; the viewer merges writes by key, so two readers ticking different
// files never collide, and a write that meets a key changed after the revision it was based on
// is answered with the current document, to which the page reapplies its change.
//
// A change is written even where our copy of the document already agrees, because our copy may be
// out of date: the viewer's answer to the write brings it up to date. Pure: every function takes
// a model and returns a new one; the review page inlines this file with its exports stripped.
import type { BridgeLimits, JsonObject } from "./page-bridge.ts";
import { messageBytes, stateSetMessage } from "./page-bridge.ts";

export type Change = { readonly kind: "set"; readonly value: unknown } | { readonly kind: "del" };

export type Changes = Readonly<Record<string, Change>>;

export interface StateModel {
  /** The viewer's document as last answered, and its revision: the base of the next write. */
  readonly doc: JsonObject;
  readonly rev: number;
  /** True once the viewer has answered with its document; nothing is written before. */
  readonly loaded: boolean;
  /** Changes the viewer refused: shown to the reader, never sent again. */
  readonly held: Changes;
  /** Changes in the write that is out. */
  readonly inFlight: Changes;
  /** Changes made since, not yet written. */
  readonly pending: Changes;
}

export const EMPTY_STATE: StateModel = {
  doc: {},
  rev: 0,
  loaded: false,
  held: {},
  inFlight: {},
  pending: {},
};

/** The write the viewer is sent: what changes, against the revision it is based on. */
export interface Write {
  readonly baseRev: number;
  readonly set: JsonObject;
  readonly del: readonly string[];
}

const MAX_KEY_CHARS = 256;

/**
 * The key of a file's tick: `tick:<path>:<hash>`, the hash being the SHA-256 of what the page
 * shows of the file. A path too long for a key of 256 characters keeps its end.
 */
export function fileTickKey(path: string, hash: string): string {
  const head = "tick:";
  const tail = `:${hash}`;
  const room = MAX_KEY_CHARS - head.length - tail.length;
  if (path.length <= room) return `${head}${path}${tail}`;
  const cut = path.slice(path.length - room);
  const first = cut.charCodeAt(0);
  return `${head}${first >= 0xdc00 && first <= 0xdfff ? cut.slice(1) : cut}${tail}`;
}

const hasKeys = (changes: Changes): boolean => Object.keys(changes).length > 0;

/** The changes with `key` last, so that changes stay in the order they were last made. */
const touched = (changes: Changes, key: string, change: Change): Changes => ({
  ...Object.fromEntries(Object.entries(changes).filter(([k]) => k !== key)),
  [key]: change,
});

const without = (changes: Changes, key: string): Changes =>
  key in changes ? Object.fromEntries(Object.entries(changes).filter(([k]) => k !== key)) : changes;

function applyChanges(doc: JsonObject, changes: Changes): JsonObject {
  if (!hasKeys(changes)) return doc;
  const out: Record<string, unknown> = { ...doc };
  for (const [key, change] of Object.entries(changes)) {
    if (change.kind === "set") out[key] = change.value;
    else delete out[key];
  }
  return out;
}

/** The document the reader sees: the viewer's, then the refused, the sent and the waiting changes over it. */
export function stateView(m: StateModel): JsonObject {
  return applyChanges(applyChanges(applyChanges(m.doc, m.held), m.inFlight), m.pending);
}

export function isTicked(m: StateModel, key: string): boolean {
  return stateView(m)[key] === true;
}

/** True while any change is refused, on its way or waiting: the page holds something the viewer does not. */
export function hasChanges(m: StateModel): boolean {
  return hasKeys(m.held) || hasKeys(m.inFlight) || hasKeys(m.pending);
}

export function setKey(m: StateModel, key: string, value: unknown): StateModel {
  return {
    ...m,
    held: without(m.held, key),
    pending: touched(m.pending, key, { kind: "set", value }),
  };
}

export function delKey(m: StateModel, key: string): StateModel {
  return { ...m, held: without(m.held, key), pending: touched(m.pending, key, { kind: "del" }) };
}

/** The reader ticks (a key set to true) or unticks (the key deleted) a file. */
export function editTick(m: StateModel, key: string, on: boolean): StateModel {
  return on ? setKey(m, key, true) : delKey(m, key);
}

/** The document's size as the viewer counts it: its JSON in UTF-8 bytes. */
export function docBytes(doc: JsonObject): number {
  return messageBytes(doc);
}

export type NextWrite =
  | { readonly kind: "none"; readonly model: StateModel }
  | { readonly kind: "write"; readonly model: StateModel; readonly write: Write }
  /** Nothing can be sent: every waiting change is held, as it would pass a limit the viewer set. */
  | { readonly kind: "refused"; readonly model: StateModel };

/** Messages are sized for the longest id a request can carry. */
const LONGEST_ID = "r".repeat(64);

/**
 * The write to send next, if there is one: the waiting changes in the order they were made, as
 * many as fit one message, and none that would make the document pass the viewer's limit (those are
 * held). Only one write is out at a time, and none goes before the document is loaded.
 */
export function nextWrite(m: StateModel, limits: BridgeLimits): NextWrite {
  if (!m.loaded || hasKeys(m.inFlight) || !hasKeys(m.pending)) return { kind: "none", model: m };
  let taken: Changes = {};
  let rest: Changes = {};
  let held = m.held;
  let full = false;
  for (const [key, change] of Object.entries(m.pending)) {
    if (full) {
      rest = { ...rest, [key]: change };
      continue;
    }
    const candidate: Changes = { ...taken, [key]: change };
    const write = writeOf(m.rev, candidate);
    const fitsMessage =
      messageBytes(stateSetMessage(LONGEST_ID, write.baseRev, write.set, write.del)) <=
      limits.messageBytes;
    if (!fitsMessage && hasKeys(taken)) {
      full = true;
      rest = { ...rest, [key]: change };
    } else if (fitsMessage && docBytes(applyChanges(m.doc, candidate)) <= limits.stateBytes) {
      taken = candidate;
    } else {
      held = { ...held, [key]: change };
    }
  }
  if (!hasKeys(taken)) {
    return held === m.held
      ? { kind: "none", model: m }
      : { kind: "refused", model: { ...m, held, pending: rest } };
  }
  return {
    kind: "write",
    model: { ...m, held, inFlight: taken, pending: rest },
    write: writeOf(m.rev, taken),
  };
}

function writeOf(baseRev: number, changes: Changes): Write {
  const entries = Object.entries(changes);
  return {
    baseRev,
    set: Object.fromEntries(
      entries.flatMap(([key, change]) => (change.kind === "set" ? [[key, change.value]] : [])),
    ),
    del: entries.flatMap(([key, change]) => (change.kind === "del" ? [key] : [])),
  };
}

/** The viewer answered `state-get`: its document and revision. Changes already made stay over it. */
export function stateLoaded(m: StateModel, doc: JsonObject, rev: number): StateModel {
  return { ...m, doc, rev, loaded: true };
}

/** The viewer applied the write and answered with the whole document. */
export function stateApplied(m: StateModel, doc: JsonObject, rev: number): StateModel {
  return { ...m, doc, rev, loaded: true, inFlight: {} };
}

/** The viewer found a key changed after our revision and answered with its document: our change goes back to be written against it. */
export function stateConflicted(m: StateModel, doc: JsonObject, rev: number): StateModel {
  return { ...m, doc, rev, loaded: true, inFlight: {}, pending: { ...m.inFlight, ...m.pending } };
}

/** The write did not get through (no answer, rate limited): its changes go back to be written again. */
export function stateReturned(m: StateModel): StateModel {
  return { ...m, inFlight: {}, pending: { ...m.inFlight, ...m.pending } };
}

/** The viewer refused the write (too large, not understood): its changes are held. */
export function stateRefused(m: StateModel): StateModel {
  return { ...m, inFlight: {}, held: { ...m.held, ...m.inFlight } };
}
