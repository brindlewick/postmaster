// The Tree tab: the real directory tree of the change. Single-child folder chains are one row,
// folders come first, every folder row shows its file count and its added and deleted lines, and
// a search box filters it. The open folders are remembered in this browser.
import { matchWords, visibleRows } from "../../../../scripts/lib/review-tree.ts";
import { $, MINUS, S, el, num, plural, store } from "./01-core.js";
import { fileKind, reviewedFile, statusClass } from "./02-data.js";
import { reviewedCount } from "./03-ticks.js";
import { repaintCommentCounts, tickButton } from "./04-diff.js";
import { openFile } from "./09-nav.js";

const treeKey = () => `${S.key}-tree-v1`;

// A folder the reader opened or closed keeps that state; a folder seen for the first time takes
// the default (the first two levels open, test and generated folders closed).
export function initTreeState() {
  const saved = store.read(treeKey(), null);
  const known = new Set((saved && saved.known) || []);
  const open = new Set((saved && saved.open) || []);
  S.open = new Set(S.allDirs.filter((id) => (known.has(id) ? open.has(id) : S.defaultOpen.has(id))));
}
const saveTreeState = () => store.write(treeKey(), { open: [...S.open], known: S.allDirs });

function treeKeep() {
  const q = S.query.trim();
  return q ? (fi) => matchWords(S.hay[fi], q) : undefined;
}

function treeRow(row) {
  const n = row.node;
  const li = el("li", `trow ${n.kind}`);
  li.style.setProperty("--d", String(n.depth));
  li.setAttribute("role", "treeitem");
  li.setAttribute("aria-level", String(n.depth + 1));
  const go = el("button", "tgo");
  go.type = "button";
  if (n.kind === "dir") {
    li.dataset.id = n.id;
    li.setAttribute("aria-expanded", String(row.open));
    if (n.quiet) li.classList.add("quiet");
    const lead = el("span", "tlead");
    lead.append(el("span", "tchev"));
    const files = S.query.trim() ? `${num(row.shown)} of ${plural(n.files, "file", "files")}` : plural(n.files, "file", "files");
    const meta = el("span", "tmeta");
    meta.append(`${files} · `, el("span", "plus", `+${num(n.add)}`), " ", el("span", "minus", `${MINUS}${num(n.del)}`));
    go.append(lead, el("span", "tname", n.label), meta);
    li.append(go);
  } else {
    const f = S.files[n.fi];
    li.dataset.fi = String(n.fi);
    if (n.quiet) li.classList.add("quiet");
    if (n.fi === S.fi) li.classList.add("current");
    if (reviewedFile(n.fi)) li.classList.add("done");
    const lead = el("span", "tlead");
    const badge = el("span", `badge ${statusClass(f)}`, (f.status || "M").charAt(0));
    badge.title = fileKind(f);
    lead.append(badge);
    const meta = el("span", "tmeta");
    meta.append(el("span", "plus", `+${num(n.add)}`), " ", el("span", "minus", `${MINUS}${num(n.del)}`), ` · ${fileKind(f)}`);
    if (f.first) meta.append(" ", el("span", "pill", "Read closely"));
    const cc = el("span", "pill soft ccount");
    cc.dataset.fi = String(n.fi);
    cc.hidden = true;
    meta.append(" ", cc);
    go.append(lead, el("span", "tname", n.name), meta);
    go.setAttribute("aria-label", `${n.name}, ${fileKind(f)}`);
    li.append(go, tickButton(n.fi));
  }
  return li;
}

export function renderTree() {
  const rows = visibleRows(S.tree, S.open, treeKeep());
  const frag = document.createDocumentFragment();
  for (const r of rows) frag.append(treeRow(r));
  const held = document.activeElement && document.activeElement.closest ? document.activeElement.closest(".trow") : null;
  const heldId = held && held.dataset.id;
  $("tree").replaceChildren(frag);
  $("tree-empty").hidden = rows.length > 0;
  if (heldId) {
    for (const li of $("tree").children) {
      if (li.dataset.id === heldId) { li.querySelector(".tgo").focus({ preventScroll: true }); break; }
    }
  }
  repaintCommentCounts();
  updateTreeSummary();
}

export function updateTreeSummary() {
  if (!S.R) return;
  const q = S.query.trim();
  const done = reviewedCount();
  const base = `${plural(S.files.length, "file", "files")}, +${num(S.R.additions)} ${MINUS}${num(S.R.deletions)}`;
  if (q) {
    const shown = S.files.reduce((n, _f, fi) => n + (matchWords(S.hay[fi], q) ? 1 : 0), 0);
    $("tree-sum").textContent = `${num(shown)} of ${plural(S.files.length, "file", "files")} match`;
  } else {
    $("tree-sum").textContent = `${base} · ${num(done)} reviewed`;
  }
}

function toggleDir(id) {
  if (S.query.trim()) return; // while searching, every folder with a match is open
  if (S.open.has(id)) S.open.delete(id); else S.open.add(id);
  saveTreeState();
  renderTree();
}

function setAllDirs(open) {
  S.open = open ? new Set(S.allDirs) : new Set();
  saveTreeState();
  renderTree();
}

// The folders above a file, so a file opened from elsewhere can be shown in the tree.
function dirChain(path) {
  return S.allDirs.filter((id) => path.startsWith(`${id}/`));
}
export function revealInTree(fi) {
  for (const id of dirChain(S.files[fi].path)) S.open.add(id);
  S.query = "";
  $("tree-q").value = "";
  saveTreeState();
  renderTree();
  const li = $("tree").querySelector(`[data-fi="${fi}"]`);
  if (li && li.scrollIntoView) li.scrollIntoView({ block: "nearest" });
}

export function markCurrentRows() {
  for (const li of $("tree").children) li.classList.toggle("current", li.dataset.fi !== undefined && Number(li.dataset.fi) === S.fi);
  for (const r of document.querySelectorAll("#order-list .orow")) r.classList.toggle("current", Number(r.dataset.fi) === S.fi);
  if (S.wide && S.tab === "order") {
    const cur = document.querySelector("#order-list .orow.current");
    if (cur) cur.scrollIntoView({ block: "nearest" });
  }
}

export function initTree() {
  $("tree").addEventListener("click", (ev) => {
    const go = ev.target.closest(".tgo");
    if (!go) return;
    const li = go.closest(".trow");
    if (li.classList.contains("dir")) toggleDir(li.dataset.id);
    else openFile(Number(li.dataset.fi), { tab: "tree", seq: "tree", reveal: false });
  });
  $("tree-q").addEventListener("input", () => { S.query = $("tree-q").value; renderTree(); });
  $("tree-expand").addEventListener("click", () => setAllDirs(true));
  $("tree-collapse").addEventListener("click", () => setAllDirs(false));
}
