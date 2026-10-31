// The file screen: the file's head, its unified diff, line selection, the comment box that opens
// under a tapped line (kept above the phone keyboard) and the comment threads.
import {
  $, MINUS, S, baseName, dirName, el,
  hl, hm, note, num, parseDiff, runs, softBreaks,
} from "./01-core.js";
import { fileKind, item, reviewedFile } from "./02-data.js";
import { barOffset, openFile, scrollToEl } from "./09-nav.js";
import { cutText } from "../../../../scripts/lib/page-bridge.ts";
import { commentNote, paintSaveNotes, submitBridgeComment } from "./10-bridge.js";

let drawn = -1;
const SLICE = 400; // rows drawn at a time in a long diff

// The text parts of a file (directory, name, purpose, counts), shared by every list that shows files.
export function fileTextNodes(f, fi) {
  const out = [];
  const dir = dirName(f.path);
  const dirText = el("span", "fdir");
  dirText.append(softBreaks(dir));
  const nameText = el("span", "fname");
  nameText.append(softBreaks(baseName(f.path)));
  if (dir) out.push(dirText);
  out.push(nameText);
  if (f.purpose) out.push(el("span", "fpurpose", f.purpose));
  const meta = el("span", "fmeta");
  meta.append(el("span", "plus", `+${num(f.add)}`), el("span", "minus", `${MINUS}${num(f.del)}`), fileKind(f));
  if (f.first) meta.append(el("span", "pill", "Read closely"));
  const cc = el("span", "pill soft ccount");
  cc.dataset.fi = String(fi);
  cc.hidden = true;
  meta.append(cc);
  out.push(meta);
  return out;
}

export function tickButton(fi) {
  const f = S.files[fi];
  const b = el("button", "tick");
  b.type = "button";
  b.dataset.fi = String(fi);
  b.setAttribute("role", "checkbox");
  b.setAttribute("aria-checked", String(reviewedFile(fi)));
  b.setAttribute("aria-label", `Reviewed: ${f.path}`);
  b.append(el("span", "box"));
  return b;
}

function renderFileHead(fi) {
  const f = S.files[fi];
  const text = el("div", "ftext");
  text.append(...fileTextNodes(f, fi));
  const wrap = el("button", "wrapbtn", "Wrap");
  wrap.type = "button";
  wrap.id = "wrap";
  wrap.setAttribute("aria-pressed", String(S.wrap));
  wrap.setAttribute("aria-label", "Wrap long lines");
  $("file-head").replaceChildren(tickButton(fi), text, wrap);
  repaintCommentCounts();
}

const lineEl = (side, n) => document.getElementById(`l-${side === "new" ? "n" : "o"}${n}`);

function diffRows(f, hunks, into) {
  const flat = [];
  for (const h of hunks) {
    flat.push({ hunk: h.header });
    const colored = hl(h.lines.map((l) => l.s).join("\n"), f.lang);
    h.lines.forEach((l, k) => flat.push({ l, runs: colored[k] || [] }));
  }
  const step = (at) => {
    const end = Math.min(flat.length, at + SLICE);
    const frag = document.createDocumentFragment();
    for (let k = at; k < end; k++) {
      const x = flat[k];
      if (x.hunk) { frag.append(el("div", "hunk", x.hunk)); continue; }
      const l = x.l;
      const isNew = l.n != null;
      const line = String(isNew ? l.n : l.o);
      const r = el("div", `r${l.t === "+" ? " add" : l.t === "-" ? " del" : ""}`);
      r.id = `l-${isNew ? "n" : "o"}${line}`;
      r.dataset.side = isNew ? "new" : "old";
      r.dataset.line = line;
      // The line number is a faint layer behind the code (css/60-file.css), not a column in front of it.
      const number = el("span", "n", line);
      number.setAttribute("aria-hidden", "true");
      r.append(number, runs(el("span", "c"), x.runs));
      frag.append(r);
    }
    into.append(frag);
    if (end < flat.length) {
      const b = el("button", "more", `Show ${Math.min(SLICE, flat.length - end)} more of ${flat.length - end} lines`);
      b.type = "button";
      b.addEventListener("click", () => { b.remove(); step(end); paintComments(); applyFlags(S.fi); });
      into.append(b);
    }
  };
  step(0);
}

export async function renderFile(fi) {
  const f = S.files[fi];
  $("file-empty").hidden = true;
  $("file-card").hidden = false;
  renderFileHead(fi);
  if (drawn === fi) return;
  clearSel();
  drawn = fi;
  const code = $("file-code");
  code.replaceChildren(el("div", "status", "Loading the diff…"));
  try {
    const it = await item(fi);
    if (drawn !== fi) return;
    const rows = el("div", S.wrap ? "rows wrap" : "rows");
    code.replaceChildren(rows);
    if (f.withheld) rows.append(el("div", "status", f.withheld));
    else if (f.binary) rows.append(el("div", "status", "A binary file: nothing to show."));
    else if (!it.diff.trim()) rows.append(el("div", "status", f.status === "R" ? "Renamed, with no change to its text." : "No change to show."));
    else {
      diffRows(f, parseDiff(it.diff), rows);
    }
    watchBox(code);
    paintComments();
    applyFlags(fi);
  } catch (e) {
    drawn = -1;
    code.replaceChildren(el("div", "status", `This file did not load (${e.message}).`));
  }
}

// --codew is the width of what the box shows. It is rounded down, so a layer that is this wide never
// sticks out of a box whose width has a fraction.
const boxWatcher = typeof ResizeObserver === "function"
  ? new ResizeObserver((entries) => { for (const en of entries) en.target.style.setProperty("--codew", `${Math.floor(en.contentRect.width)}px`); })
  : null;
function watchBox(code) {
  if (boxWatcher) boxWatcher.observe(code);
  else code.style.setProperty("--codew", `${Math.floor(code.getBoundingClientRect().width)}px`);
}

// ---------- links to lines ----------
function applyFlags(fi) {
  if (!S.flag || S.flag.fi !== fi) return;
  for (let n = S.flag.from; n <= S.flag.to; n++) lineEl(S.flag.side, n)?.classList.add("flag");
}

// Open a file at lines of one side of its diff (the new side unless said): a ruling's link, or a viewer
// asking to show the lines of a comment.
export async function gotoLines(path, from, to, side = "new") {
  const fi = S.files.findIndex((f) => f.path === path);
  if (fi < 0) return;
  for (const r of document.querySelectorAll("#file-code .r.flag")) r.classList.remove("flag");
  S.flag = { fi, from, to, side };
  await openFile(fi, { tab: S.tab, seq: "order" });
  let row = lineEl(side, from);
  while (!row) {
    const more = document.querySelector("#file-code .more");
    if (!more) break;
    more.click();
    row = lineEl(side, from);
  }
  if (!row) { note("That line is not in the diff."); return; }
  applyFlags(fi);
  scrollToEl(row, 96);
}

// ---------- selecting lines and the comment box ----------
function selectRange(side, a, b) {
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  clearSel(true);
  S.sel = { side, from, to };
  for (let n = from; n <= to; n++) lineEl(side, n)?.classList.add("sel");
  placeComposer();
}

function clearSel(keepBox) {
  S.sel = null;
  for (const r of document.querySelectorAll(".r.sel")) r.classList.remove("sel");
  if (!keepBox) closeComposer();
}

export function initComposer() {
  const c = document.createElement("form");
  c.className = "composer";
  c.id = "composer";
  c.hidden = true;
  c.innerHTML = '<label for="mtext" id="mclabel">Comment</label><textarea id="mtext" maxlength="3000" rows="3" placeholder="What should change here?"></textarea><p class="mhint" id="mhint">Tap another line to extend the comment to a range.</p><p class="savenote" data-scope="comments" hidden></p><div class="mbtns"><button type="button" class="btn quiet" id="mcancel">Cancel</button><button type="button" class="btn" id="msave">Save comment</button></div>';
  document.body.append(c);
  $("mcancel").addEventListener("click", () => { $("mtext").value = ""; clearSel(); });
  // A button that is clicked, not a form that is submitted: a frame sandboxed without allow-forms blocks a
  // submission before the page can see it.
  $("msave").addEventListener("click", saveComment);
  c.addEventListener("focusin", () => { setTimeout(keepComposerVisible, 60); setTimeout(keepComposerVisible, 400); });
  $("file-code").addEventListener("click", (ev) => {
    const r = ev.target.closest(".r");
    if (!r) return;
    if (String(window.getSelection ? window.getSelection() : "").length) return;
    const side = r.dataset.side;
    const n = Number(r.dataset.line);
    const s = S.sel;
    if (s && s.side === side && s.from === s.to) {
      if (s.from === n) { clearSel(); return; }
      selectRange(side, s.from, n);
      return;
    }
    selectRange(side, n, n);
  });
}

function placeComposer() {
  const c = $("composer");
  const s = S.sel;
  if (!c || !s) return;
  const row = lineEl(s.side, s.to);
  if (!row) return;
  let anchor = row;
  while (anchor.nextElementSibling && anchor.nextElementSibling.classList.contains("thread")) anchor = anchor.nextElementSibling;
  anchor.after(c);
  c.hidden = false;
  const where = s.from === s.to ? `${s.side === "old" ? ", removed line " : ", line "}${s.from}` : `${s.side === "old" ? ", removed lines " : ", lines "}${s.from} to ${s.to}`;
  $("mclabel").textContent = `Comment on ${baseName(S.files[S.fi].path)}${where}`;
  paintSaveNotes();
  if (window.matchMedia("(pointer: fine)").matches) $("mtext").focus({ preventScroll: true });
  keepComposerVisible();
}

function closeComposer() {
  const c = $("composer");
  if (c) { c.hidden = true; document.body.append(c); }
  keepComposerVisible();
}

// The visible area is the visual viewport: on a phone it shrinks when the keyboard is up. Leave room
// under the page for the keyboard, then scroll so the whole comment box sits between the header and
// the keyboard.
export function keepComposerVisible() {
  const c = $("composer");
  const app = $("app");
  const vv = window.visualViewport;
  const vTop = vv ? vv.offsetTop : 0;
  const vBottom = vTop + (vv ? vv.height : window.innerHeight);
  const open = !!c && !c.hidden;
  app.style.setProperty("--kb", open ? `${Math.round(Math.max(0, window.innerHeight - vBottom))}px` : "0px");
  if (!open) return;
  const r = c.getBoundingClientRect();
  const free = Math.max(vTop, barOffset()) + 8;
  let dy = r.bottom > vBottom - 8 ? r.bottom - (vBottom - 8) : 0;
  if (r.top - dy < free) dy = r.top - free;
  if (Math.abs(dy) > 1) window.scrollBy(0, dy);
}

// Who wrote a comment, as the page names them: the session's replies carry the session's name; for a comment
// the viewer keeps, the name it gives (or "Reader"); a comment of the reader's own that is not yet kept, or
// one from the page's database, is "You".
function whoWrote(x) {
  if (x.by === "claude") return "Claude";
  if (x.source === "bridge" && x.save === "kept") return x.by || "Reader";
  return "You";
}

// A comment the viewer keeps may have been left on an earlier version: its quote is the text of its lines
// then, so lines that read differently now say the comment is about something that has changed.
function movedSince(c) {
  if (c.source !== "bridge" || c.save !== "kept" || c.quote === "") return false;
  return cutText(selectedText(c), 2000) !== c.quote;
}

// The text of the lines a selection covers on its side of the diff, one line to a row, as the comment's quote.
function selectedText(sel) {
  const lines = [];
  for (let n = sel.from; n <= sel.to; n++) {
    const row = lineEl(sel.side, n);
    if (row) {
      const code = row.querySelector(".c");
      lines.push(code.dataset.blank ? "" : code.textContent);
    }
  }
  return lines.join("\n");
}

async function saveComment(ev) {
  ev.preventDefault();
  const text = $("mtext").value.trim();
  const s = S.sel;
  if (!text || !s) return;
  const f = S.files[S.fi];
  if (!S.db) {
    // No database: the viewer around the page keeps the comment through the page bridge, or, with no
    // viewer, the page keeps it for this visit and says so. It shows at once either way.
    submitBridgeComment({ path: f.path, side: s.side, from: s.from, to: s.to, quote: selectedText(s), text, at: new Date().toISOString() });
    $("mtext").value = "";
    clearSel();
    return;
  }
  const entry = { kind: "comment", page: "review", path: f.path, side: s.side, from: s.from, to: s.to, view: "changes", text, by: "user", at: new Date().toISOString() };
  $("msave").disabled = true;
  try {
    await S.db.collection("comments").add(entry);
    $("mtext").value = "";
    clearSel();
    note(`Comment saved ${hm(entry.at)}. Claude reads it when you tell your session.`);
  } catch (e) {
    note(`The comment was not saved (${(e && e.code) || "error"}). Your text is still in the box.`);
  } finally {
    $("msave").disabled = false;
  }
}

// ---------- threads and counts ----------
export function paintComments() {
  for (const t of document.querySelectorAll("#file-code .thread")) t.remove();
  if (S.fi < 0) return;
  const f = S.files[S.fi];
  for (const c of S.comments.filter((x) => !x.replyTo && x.path === f.path)) {
    if (c.side !== "new" && c.side !== "old") continue;
    const row = lineEl(c.side, c.to);
    if (!row) continue;
    const th = el("div", "thread");
    const add = (x) => {
      const m = el("div", `cm${x.by === "claude" ? " claude" : ""}${x.status === "closed" ? " closed" : ""}`);
      const place = c.from === c.to ? `line ${c.from}` : `lines ${c.from} to ${c.to}`;
      const said = commentNote(x);
      m.append(el("span", "who", `${whoWrote(x)} · ${place} · ${hm(x.at)}${x.status === "closed" ? " · closed" : ""}${said === "Saving" ? " · saving" : ""}`));
      m.append(x.text);
      if (x.source === "bridge") m.dataset.save = x.save;
      if (said !== null && said !== "Saving") m.append(el("span", "cnote", said));
      if (movedSince(x)) m.append(el("span", "cnote", "The lines have changed since this comment was left."));
      th.append(m);
    };
    add(c);
    for (const r of S.comments.filter((x) => x.replyTo === c.id)) add(r);
    row.after(th);
  }
}

export function repaintCommentCounts() {
  const counts = new Map();
  for (const c of S.comments) if (!c.replyTo && c.status !== "closed") counts.set(c.path, (counts.get(c.path) || 0) + 1);
  for (const chip of document.querySelectorAll(".ccount[data-fi]")) {
    const n = counts.get(S.files[Number(chip.dataset.fi)].path) || 0;
    chip.hidden = n === 0;
    chip.textContent = n === 1 ? "1 comment" : `${n} comments`;
  }
}
