// Screens and navigation. Four screens: overview, tree, order and file. On a phone exactly one is
// shown; from 700px the tree (or the order) is a left pane with the file beside it. Opening a file
// on a phone pushes a history entry, so the browser's back gesture returns to the list; the Back
// button does the same, and works by itself where history is blocked (a sandboxed frame).
import { $, S, baseName, note } from "./01-core.js";
import { reviewedFile } from "./02-data.js";
import { setReviewed } from "./03-ticks.js";
import { keepComposerVisible, renderFile } from "./04-diff.js";
import { markCurrentRows, revealInTree } from "./05-tree.js";
import { closeFind, fitFind, openFind } from "./08-find.js";

const mqWide = window.matchMedia("(min-width: 700px)");
let canHistory = true;
let pushed = false;
let backTimer = 0; // the fallback that shows the list when history.back() brings no popstate

const sequence = () => (S.seq === "tree" ? S.treeSeq : S.orderSeq);
export function barOffset() {
  const h = $("hdr");
  return (parseFloat(getComputedStyle(h).top) || 0) + h.offsetHeight;
}
export function scrollToEl(node, gap) {
  window.scrollTo(0, Math.max(0, window.scrollY + node.getBoundingClientRect().top - barOffset() - (gap == null ? 8 : gap)));
}
const measureHeader = () => $("app").style.setProperty("--hdr-h", `${$("hdr").offsetHeight}px`);

export function updateFileBar() {
  if (!S.R) return;
  const have = S.fi >= 0;
  const seq = sequence();
  const at = have ? seq.indexOf(S.fi) : -1;
  $("pos").textContent = have && at >= 0 ? `${at + 1}/${seq.length}` : "";
  $("fname").textContent = have ? baseName(S.files[S.fi].path) : "";
  const label = S.tab === "tree" ? "Tree" : S.tab === "order" ? "Order" : "Overview";
  $("back-label").textContent = label;
  $("done-back").textContent = `Back to ${label.toLowerCase()}`;
  $("prev").disabled = !have || at <= 0;
  $("next").disabled = !have || at < 0 || at >= seq.length - 1;
}

export function applyScreens() {
  S.wide = mqWide.matches;
  if (S.wide) {
    if (S.tab === "overview" && S.screen === "file") S.tab = "tree";
    if (S.screen === "file") S.screen = S.tab;
  }
  const show = S.wide ? (S.tab === "overview" ? ["overview"] : [S.tab, "file"]) : [S.screen];
  for (const name of ["overview", "tree", "order", "file"]) $(`screen-${name}`).hidden = !show.includes(name);
  const app = $("app");
  app.dataset.screen = S.screen;
  app.dataset.tab = S.tab;
  const onFile = S.screen === "file";
  $("hdr-tabs").hidden = !S.wide && onFile;
  $("hdr-file").hidden = S.wide ? !(S.fi >= 0 && S.tab !== "overview") : !onFile;
  for (const t of document.querySelectorAll(".tab")) t.setAttribute("aria-selected", String(t.dataset.tab === S.tab));
  $("file-empty").hidden = S.fi >= 0;
  $("file-card").hidden = S.fi < 0;
  updateFileBar();
  markCurrentRows();
  measureHeader();
}

// The scroll position of each list, so Back returns to the same place.
const saveScroll = () => { if (!S.wide && S.screen !== "file") S.scroll[S.screen] = window.scrollY; };
function restoreScroll() {
  const y = S.wide ? 0 : S.scroll[S.tab] || 0;
  requestAnimationFrame(() => window.scrollTo(0, y));
}

export function selectTab(tab) {
  saveScroll();
  S.tab = tab;
  S.screen = tab;
  applyScreens();
  restoreScroll();
}

function pushFileState(wasOnFile) {
  if (!canHistory) return;
  try {
    const st = { s: "file", fi: S.fi, tab: S.tab, seq: S.seq };
    if (wasOnFile) {
      history.replaceState(st, "");
    } else {
      history.replaceState({ s: "index", tab: S.tab }, "");
      history.pushState(st, "");
      pushed = true;
    }
  } catch {
    canHistory = false;
    pushed = false;
  }
}

export async function openFile(fi, opts = {}) {
  clearTimeout(backTimer);
  if (!$("find").hidden) closeFind();
  const tab = opts.tab || S.tab;
  const wasOnFile = S.screen === "file" && !S.wide;
  if (!S.wide && S.screen !== "file") saveScroll();
  S.tab = S.wide && tab === "overview" ? "tree" : tab;
  S.seq = opts.seq || (S.tab === "tree" ? "tree" : "order");
  S.fi = fi;
  if (S.wide) {
    S.screen = S.tab;
    if (S.tab === "tree" && opts.reveal !== false) revealInTree(fi);
  } else {
    S.screen = "file";
    pushFileState(wasOnFile);
  }
  applyScreens();
  window.scrollTo(0, 0);
  await renderFile(fi);
}

function showIndex() {
  pushed = false;
  S.screen = S.tab;
  applyScreens();
  restoreScroll();
}

function goBack() {
  if (S.screen !== "file") return;
  if (pushed && canHistory) {
    clearTimeout(backTimer);
    history.back();
    backTimer = setTimeout(() => { if (S.screen === "file") showIndex(); }, 400);
  } else {
    showIndex();
  }
}

function step(dir) {
  const seq = sequence();
  const at = seq.indexOf(S.fi);
  const next = seq[at + dir];
  if (S.fi < 0 || next == null) { note(dir > 0 ? "That was the last file." : "That was the first file."); return; }
  openFile(next, { tab: S.tab, seq: S.seq });
}

function doneNext() {
  if (S.fi < 0) return;
  setReviewed(S.fi, true);
  step(1);
}

function onPop(ev) {
  clearTimeout(backTimer);
  const st = ev.state;
  if (st && st.s === "file" && S.files[st.fi]) {
    S.tab = st.tab;
    S.seq = st.seq;
    S.fi = st.fi;
    S.screen = "file";
    pushed = true;
    applyScreens();
    renderFile(S.fi);
    window.scrollTo(0, 0);
  } else {
    pushed = false;
    if (st && st.tab) S.tab = st.tab;
    S.screen = S.tab;
    applyScreens();
    restoreScroll();
  }
}

export function initNav() {
  for (const t of document.querySelectorAll(".tab")) t.addEventListener("click", () => selectTab(t.dataset.tab));
  $("prog").addEventListener("click", openFind);
  $("filebtn").addEventListener("click", openFind);
  $("back").addEventListener("click", goBack);
  $("done-back").addEventListener("click", goBack);
  $("prev").addEventListener("click", () => step(-1));
  $("next").addEventListener("click", () => step(1));
  $("done-next").addEventListener("click", doneNext);
  $("file-head").addEventListener("click", (ev) => {
    if (ev.target.closest("#wrap")) {
      S.wrap = !S.wrap;
      $("wrap").setAttribute("aria-pressed", String(S.wrap));
      const rows = document.querySelector("#file-code .rows");
      if (rows) rows.classList.toggle("wrap", S.wrap);
    }
  });
  // every tick button on the page, in any list
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest(".tick[data-fi]");
    if (!b) return;
    const fi = Number(b.dataset.fi);
    setReviewed(fi, !reviewedFile(fi));
  });
  window.addEventListener("popstate", onPop);
  mqWide.addEventListener("change", () => { applyScreens(); restoreScroll(); });
  if (typeof ResizeObserver === "function") new ResizeObserver(measureHeader).observe($("hdr"));
  if (window.visualViewport) {
    const fit = () => { fitFind(); keepComposerVisible(); };
    window.visualViewport.addEventListener("resize", fit);
    window.visualViewport.addEventListener("scroll", fit);
  }
}
