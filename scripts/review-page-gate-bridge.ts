// The verdicts the render gate (scripts/review-page-gate.ts) gives on how the review page keeps its
// ticks and line comments through the page bridge, and the small data helpers its checks need. The
// gate drives the page inside a stand-in for the viewer (scripts/lib/page-bridge-stand-in.ts),
// reads facts from the page and from the stand-in, and hands them here; nothing here touches a
// browser. A verdict names what went wrong, since a check that only says "failed" tells nobody
// where to look.
import type { ChangedFile } from "./lib/review-layout.ts";
import { contentHash } from "./lib/review-model.ts";
import type { Verdict } from "./review-page-gate.ts";

const pass = (detail: string): Verdict => ({ ok: true, detail });
const fail = (detail: string): Verdict => ({ ok: false, detail });
const judged = (problems: readonly string[], good: string): Verdict =>
  problems.length === 0 ? pass(good) : fail(problems.join("; "));

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** A line the page shows where ticks or comments appear, by what it is about. */
export interface Note {
  readonly scope: string;
  readonly text: string;
}

const saysNotSaved = (notes: readonly Note[]): boolean =>
  notes.some((n) => n.text.startsWith("Not saved"));

const sameList = <T>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

// ---------- ticks ----------

export interface TicksFacts {
  /** The files ticked, each with the key the spec gives it: `tick:<path>:<hash>`. */
  readonly ticked: readonly { readonly fi: number; readonly key: string }[];
  /** The tick keys the viewer holds once the writes have gone. */
  readonly written: readonly string[];
  /** After the viewer was reloaded: the files shown ticked, the reviewed count, the lines shown. */
  readonly after: {
    readonly fis: readonly number[];
    readonly count: number;
    readonly notes: readonly string[];
  };
}

/** Ticks reach the viewer under the key the spec gives and are found again after a reload. */
export function bridgeTicksVerdict(f: TicksFacts): Verdict {
  const expected = f.ticked.map((t) => t.key).sort();
  const held = [...f.written].sort();
  const fis = f.ticked.map((t) => t.fi).sort((a, b) => a - b);
  const problems = [
    ...(sameList(held, expected)
      ? []
      : [
          `the viewer holds ${plural(held.length, "tick", "ticks")} (${held.join(", ") || "none"}), expected ${expected.join(", ")}`,
        ]),
    ...fis
      .filter((fi) => !f.after.fis.includes(fi))
      .map((fi) => `after a reload file ${fi} is not ticked`),
    ...f.after.fis
      .filter((fi) => !fis.includes(fi))
      .map((fi) => `after a reload file ${fi} is ticked that was not`),
    ...(f.after.count === expected.length
      ? []
      : [`the reviewed count is ${f.after.count}, expected ${expected.length}`]),
    ...f.after.notes.slice(0, 1).map((n) => `the page says "${n}" although the viewer keeps ticks`),
  ];
  return judged(
    problems,
    `${plural(expected.length, "tick", "ticks")} written as tick:<path>:<hash> and all ticked after a reload`,
  );
}

export interface VersionFacts {
  /** The file whose diff changed in the new version, and one whose diff did not. */
  readonly changed: number;
  readonly kept: number;
  readonly ticked: readonly number[];
  readonly count: number;
}

/** On a new version the file whose diff changed starts unticked and the unchanged file keeps its tick. */
export function newVersionVerdict(f: VersionFacts): Verdict {
  const problems = [
    ...(f.ticked.includes(f.changed)
      ? [`file ${f.changed} kept its tick although its diff changed`]
      : []),
    ...(f.ticked.includes(f.kept)
      ? []
      : [`file ${f.kept} lost its tick although its diff did not change`]),
    ...(f.count === 1 ? [] : [`the reviewed count is ${f.count}, expected 1`]),
  ];
  return judged(problems, "the changed file started unticked and the unchanged file kept its tick");
}

// ---------- no viewer answers ----------

export interface NotSavedFacts {
  /** The lines shown while the page was still within its 1.5 seconds. */
  readonly early: readonly Note[];
  /** The lines shown once the wait was over. */
  readonly late: readonly Note[];
  /** A tick made then is shown as ticked. */
  readonly ticked: boolean;
  /** Ticks the viewer holds. */
  readonly written: number;
}

/** With no bridge-ready the page keeps working for the visit, and says Not saved only after 1.5 seconds. */
export function notSavedVerdict(f: NotSavedFacts): Verdict {
  const problems = [
    ...f.early
      .slice(0, 1)
      .map((n) => `the page said "${n.text}" before the wait for the viewer was over`),
    ...(saysNotSaved(f.late) ? [] : ["the page never said Not saved"]),
    ...(f.ticked ? [] : ["a tick did not work without a viewer"]),
    ...(f.written === 0
      ? []
      : [`the page wrote ${f.written} ticks to a viewer that never said ready`]),
  ];
  return judged(
    problems,
    "nothing was said for 1.5 seconds, then Not saved, and a tick still worked",
  );
}

export interface UnansweredFacts {
  /** The lines shown before the 5 seconds were up, and after. */
  readonly before: readonly Note[];
  readonly after: readonly Note[];
  readonly ticked: boolean;
}

/** A write unanswered for 5 seconds counts as unavailable: Not saved appears then, and the tick stays. */
export function unansweredVerdict(f: UnansweredFacts): Verdict {
  const problems = [
    ...f.before.slice(0, 1).map((n) => `the page said "${n.text}" before the 5 seconds were up`),
    ...(saysNotSaved(f.after) ? [] : ["the page never said Not saved"]),
    ...(f.ticked ? [] : ["the tick did not stay on the page"]),
  ];
  return judged(problems, "Not saved appeared once the write had gone 5 seconds with no answer");
}

// ---------- a conflict ----------

export interface ConflictFacts {
  /** What the viewer answered to the tick's write, in order: "error:conflict", "state", ... */
  readonly outcomes: readonly string[];
  readonly doc: Readonly<Record<string, unknown>>;
  readonly key: string;
  readonly ticked: boolean;
  readonly notes: readonly string[];
}

/** A conflict is answered by reapplying the change to the document returned and writing again, once. */
export function conflictVerdict(f: ConflictFacts): Verdict {
  const problems = [
    ...(sameList(f.outcomes, ["error:conflict", "state"])
      ? []
      : [
          `the viewer answered the writes with ${f.outcomes.join(", ") || "nothing"}; expected one conflict and then the write accepted`,
        ]),
    ...(f.doc[f.key] === true
      ? []
      : [`the document holds ${JSON.stringify(f.doc[f.key])} for the tick, not true`]),
    ...(Object.keys(f.doc).some((k) => k.startsWith("rival:"))
      ? []
      : ["the document lost the other reader's key"]),
    ...(f.ticked ? [] : ["the file is not shown as ticked"]),
    ...f.notes.slice(0, 1).map((n) => `the page says "${n}" although the tick was kept`),
  ];
  return judged(
    problems,
    "one conflict, the change written again against the new document, the other reader's key kept",
  );
}

// ---------- a comment ----------

export interface CommentFacts {
  readonly typed: string;
  /** The row the comment was left on: its file, side, line and the text of the line. */
  readonly row: {
    readonly path: string;
    readonly side: string;
    readonly line: number;
    readonly text: string;
  };
  /** The comment on the page right after Save, before the viewer answered; null if it was not there. */
  readonly atOnce: { readonly text: string; readonly save: string } | null;
  /** The comments the viewer keeps. */
  readonly stored: readonly {
    readonly body: string;
    readonly anchor: Readonly<Record<string, unknown>>;
  }[];
  /** The save state of the comment on the page once the viewer answered. */
  readonly settled: string | null;
  /** The comments under the file's lines after the viewer was reloaded, with what is said beside each. */
  readonly reloaded: readonly {
    readonly text: string;
    readonly save: string;
    readonly note: string;
  }[];
}

/** A comment shows at once, reaches the viewer as a line anchor, settles as kept, and is there after a reload. */
export function commentVerdict(f: CommentFacts): Verdict {
  const stored = f.stored[0];
  const anchor = stored?.anchor ?? {};
  const there = f.reloaded.filter((t) => t.text === f.typed && t.save === "kept").length;
  const said = f.reloaded.find((t) => t.text === f.typed && t.note !== "")?.note;
  const problems = [
    ...(f.atOnce === null ? ["the comment was not on the page right after Save"] : []),
    ...(f.atOnce !== null && f.atOnce.save !== "queued" && f.atOnce.save !== "sending"
      ? [`the comment showed as ${f.atOnce.save} before the viewer had answered`]
      : []),
    ...(f.stored.length === 1
      ? []
      : [`the viewer keeps ${plural(f.stored.length, "comment", "comments")}, expected 1`]),
    ...(stored === undefined
      ? []
      : [
          ...(stored.body === f.typed
            ? []
            : [`the viewer kept the body "${stored.body}", not "${f.typed}"`]),
          ...(anchor.kind === "line"
            ? []
            : [`the anchor kind is ${String(anchor.kind)}, not line`]),
          ...(anchor.file === f.row.path
            ? []
            : [`the anchor file is ${String(anchor.file)}, not ${f.row.path}`]),
          ...(anchor.side === f.row.side
            ? []
            : [`the anchor side is ${String(anchor.side)}, not ${f.row.side}`]),
          ...(anchor.from === f.row.line && anchor.to === f.row.line
            ? []
            : [
                `the anchor lines are ${String(anchor.from)} to ${String(anchor.to)}, not ${f.row.line}`,
              ]),
          ...(anchor.quote === undefined || anchor.quote === f.row.text
            ? []
            : [`the anchor quote is not the text of the line`]),
        ]),
    ...(f.settled === "kept"
      ? []
      : [`the comment never settled as kept (it is ${f.settled ?? "missing"})`]),
    ...(there === 1
      ? []
      : there === 0
        ? ["after a reload the comment is not on the page"]
        : [`after a reload the comment shows ${there} times`]),
    ...(said === undefined ? [] : [`after a reload the page says "${said}" beside the comment`]),
  ];
  return judged(
    problems,
    `shown at once, kept as a line anchor on ${f.row.path} line ${f.row.line}, and there after a reload`,
  );
}

export interface FocusFacts {
  /** The lines the viewer asked the page to show. */
  readonly side: string;
  readonly from: number;
  readonly to: number;
  /** The rows marked in the open diff. */
  readonly flagged: readonly { readonly side: string; readonly line: number }[];
  readonly fileShown: boolean;
  readonly fname: string | null;
  readonly expectedName: string;
}

/** A comment-focus opens the file at those lines and marks them. */
export function focusVerdict(f: FocusFacts): Verdict {
  const wanted = Array.from({ length: f.to - f.from + 1 }, (_, i) => f.from + i);
  const marked = f.flagged.filter((x) => x.side === f.side).map((x) => x.line);
  const problems = [
    ...(f.fileShown ? [] : ["the file screen was not shown"]),
    ...(f.flagged.length === 0 ? ["no line was marked"] : []),
    ...(f.flagged.length > 0 && marked.length === 0
      ? [`lines on the ${f.flagged[0]?.side} side were marked, not the ${f.side} side`]
      : []),
    ...(marked.length > 0 && !sameList(marked, wanted)
      ? [`the lines marked are ${marked.join(", ")}, not ${f.from} to ${f.to}`]
      : []),
    ...(f.fname === f.expectedName
      ? []
      : [`the file bar names ${f.fname ?? "no file"}, not ${f.expectedName}`]),
  ];
  return judged(problems, `${f.expectedName} opened with lines ${f.from} to ${f.to} marked`);
}

// ---------- data the checks make ----------

/**
 * The files the server serves in place of the built ones to play a new version of the page: file
 * `fi` gets a line added to its diff and the hash the builder gives that diff; nothing else changes.
 * `chunks` maps a chunk's request path ("/chunks/0.json") to its text.
 */
export function newVersionOverrides(
  review: string,
  chunks: ReadonlyMap<string, string>,
  fi: number,
): ReadonlyMap<string, string> {
  const data = JSON.parse(review) as { files: Record<string, unknown>[] };
  const file = data.files[fi];
  if (file === undefined) throw new Error(`file ${fi} is not in the review`);
  const path = `/chunks/${String(file["chunk"])}.json`;
  const items = JSON.parse(chunks.get(path) ?? "[]") as { i: number; diff: string }[];
  const next = items.map((it) =>
    it.i === fi ? { ...it, diff: `${it.diff}+a line added in a new version\n` } : it,
  );
  const diff = next.find((it) => it.i === fi)?.diff;
  if (diff === undefined) throw new Error(`file ${fi} is not in ${path}`);
  const hash = contentHash(file as unknown as ChangedFile, diff, {
    withheld: file["withheld"] !== undefined,
  });
  data.files[fi] = { ...file, hash };
  return new Map([
    ["/review.json", JSON.stringify(data)],
    [path, JSON.stringify(next)],
  ]);
}

/** A fault: the review data with the same hash for every file, as a build that ignored the content would give. */
export function constantHashes(review: string): string {
  const data = JSON.parse(review) as { files: Record<string, unknown>[] };
  return JSON.stringify({
    ...data,
    files: data.files.map((f) => ({ ...f, hash: "0".repeat(64) })),
  });
}

/** A fault: the page with a rule at the end that hides every Not saved line. */
export function withoutSaveNotes(html: string): string {
  return `${html}<style>.savenote{display:none!important}</style>`;
}
