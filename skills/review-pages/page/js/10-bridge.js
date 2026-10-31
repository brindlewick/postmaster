// The page bridge in the page: a thin shell around the pure session in scripts/lib/page-bridge-session.ts.
// When the page runs in a frame whose viewer speaks the page bridge, ticks are read from and written to
// the viewer's saved state and line comments are sent to the viewer, which keeps them for the page.
// The shell does three things: it feeds the session its events (the page starts, a message arrives, the
// reader ticks or comments, a timer fires), it carries out what the session returns (a message to the
// viewer, lines to show), and it paints what the session says (the ticks, the comments, the "Not saved"
// lines). The session decides everything else, so none of it lives here.
import { fileTickKey, stateView } from "../../../../scripts/lib/page-bridge-state.ts";
import { parseViewerMessage } from "../../../../scripts/lib/page-bridge.ts";
import {
  NEW_SESSION, commentsNote, entryNote, reduceSession, sessionWake, ticksNote,
} from "../../../../scripts/lib/page-bridge-session.ts";
import { $, S, note } from "./01-core.js";
import { gotoLines, paintComments, repaintCommentCounts } from "./04-diff.js";
import { repaintTicks } from "./03-ticks.js";

// The session counts time in milliseconds on a clock that only moves forward, so a change of the
// device's clock stretches or shortens none of its waits.
const clockNow = () => performance.now();

let session = NEW_SESSION;
let wakeTimer = 0;
let paintedState = null;
let paintedBook = null;
let paintedNotes = "";
let started = false;

function dispatch(event) {
  const step = reduceSession(session, event);
  session = step.session;
  for (const effect of step.effects) {
    if (effect.type === "send") deliver(effect.message);
    else showLines(effect.anchor);
  }
  paintBridge();
  const at = sessionWake(session);
  clearTimeout(wakeTimer);
  if (at !== null) wakeTimer = setTimeout(() => dispatch({ type: "clock", now: clockNow() }), Math.max(0, at - clockNow()));
}

function deliver(message) {
  try {
    window.parent.postMessage(message, "*");
  } catch {
    /* the request is not answered, so the session counts it unavailable after 5 seconds */
  }
}

// Start the visit: in a frame, say hello and listen; on its own, there is no viewer to ask.
export function connectBridge() {
  started = true;
  const framed = window.parent !== window;
  if (framed) {
    window.addEventListener("message", (event) => {
      if (event.source !== window.parent) return;
      const message = parseViewerMessage(event.data);
      if (message !== null) dispatch({ type: "viewer", now: clockNow(), message });
    });
    const leaving = () => dispatch({ type: "hide", now: clockNow() });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") leaving(); });
    window.addEventListener("pagehide", leaving);
  }
  dispatch({ type: "start", now: clockNow(), framed });
}

// The reader ticked or unticked a file: the session keeps the change and writes it after a short wait.
export function bridgeTick(fi, on) {
  const f = S.files[fi];
  if (!f || !f.hash) return;
  dispatch({ type: "tick", now: clockNow(), key: fileTickKey(f.path, f.hash), on });
}

// The reader saved a comment on lines of a file and no database keeps it: it is in view at once, and the
// session sends it to the viewer, or keeps it for this visit when there is none.
export function submitBridgeComment(draft) {
  dispatch({ type: "comment", now: clockNow(), draft });
}

// The viewer asked to show the lines of a comment.
function showLines(anchor) {
  if (!S.files.some((f) => f.path === anchor.file)) { note("That file is not in this change."); return; }
  gotoLines(anchor.file, anchor.from, anchor.to, anchor.side);
}

// The most characters a comment may have: the page's own 3,000, or less where the viewer allows less.
const commentChars = () => Math.min(3000, session.limits.bodyChars);

// What to say beside a comment of the bridge's: "Saving", or why it is not saved, or nothing.
export function commentNote(c) {
  return c.source === "bridge" ? entryNote(session, c) : null;
}

// The ticks follow the viewer's document (and the changes still on their way), the comments follow the
// session's book (and what is said beside each), and every "Not saved" line follows the session.
function paintBridge() {
  if (session.state !== paintedState) {
    paintedState = session.state;
    syncTicks();
  }
  const notes = `${ticksNote(session)}|${commentsNote(session)}`;
  if (session.book !== paintedBook || notes !== paintedNotes) {
    paintedBook = session.book;
    paintedNotes = notes;
    syncComments();
  }
  paintSaveNotes();
}

function syncTicks() {
  if (!session.state.loaded) return;
  const view = stateView(session.state);
  let changed = false;
  for (const f of S.files) {
    if (!f.hash) continue;
    const on = view[fileTickKey(f.path, f.hash)] === true;
    if (on === S.ticks.has(f.sig)) continue;
    changed = true;
    if (on) S.ticks.add(f.sig); else S.ticks.delete(f.sig);
  }
  if (changed) repaintTicks();
}

function syncComments() {
  if (S.db) return;
  S.comments = session.book.entries;
  paintComments();
  repaintCommentCounts();
}

// Show or hide each "Not saved" line. Nothing is shown where the page's database keeps ticks and
// comments (or is still being asked for), or while the viewer has not yet answered.
export function paintSaveNotes() {
  if (!started) return;
  const databaseKeeps = !!S.db || S.dbTrying;
  for (const line of document.querySelectorAll(".savenote")) {
    const text = databaseKeeps ? null : line.dataset.scope === "comments" ? commentsNote(session) : ticksNote(session);
    line.hidden = text === null;
    line.textContent = text === null ? "" : text;
  }
  const area = $("mtext");
  if (area) area.maxLength = commentChars();
}
