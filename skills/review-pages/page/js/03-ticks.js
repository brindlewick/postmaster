// Reviewed ticks: kept in this browser, and shared through the page's database when it is there.
// A tick is keyed by the file's signature (its path and diff), so a file whose diff changed on a
// new head loses its tick, and an unchanged file keeps it.
import { $, S, note, store } from "./01-core.js";
import { reviewedFile } from "./02-data.js";
import { paintComments, repaintCommentCounts } from "./04-diff.js";
import { updateTreeSummary } from "./05-tree.js";
import { updateOrderCounts } from "./06-order.js";
import { renderStart } from "./07-overview.js";
import { updateFileBar } from "./09-nav.js";

const tickKey = () => `${S.key}-ticks-v1`;
export function loadTicks() {
  for (const s of store.read(tickKey(), [])) S.ticks.add(String(s));
}
const saveTicks = () => store.write(tickKey(), [...S.ticks]);
export const reviewedCount = () => S.files.reduce((n, f) => n + (S.ticks.has(f.sig) ? 1 : 0), 0);

export function setReviewed(fi, on) {
  const f = S.files[fi];
  if (on) S.ticks.add(f.sig); else S.ticks.delete(f.sig);
  saveTicks();
  repaintTicks();
  writeTick(fi, on);
}

function writeTick(fi, on) {
  if (!S.db) return;
  const f = S.files[fi];
  const ref = S.db.collection("reviewed").doc(`r-${f.sig}`);
  (on ? ref.set({ sig: f.sig, path: f.path, at: new Date().toISOString() }) : ref.delete())
    .catch(() => note("The tick is kept on this device only."));
}

// Every tick button, row and count on the page follows the tick set.
export function repaintTicks() {
  for (const b of document.querySelectorAll(".tick[data-fi]")) {
    const on = reviewedFile(Number(b.dataset.fi));
    b.setAttribute("aria-checked", String(on));
    const row = b.closest(".trow, .orow");
    if (row) row.classList.toggle("done", on);
  }
  const done = reviewedCount();
  const total = S.files.length;
  $("prog-n").textContent = String(done);
  $("prog-t").textContent = String(total);
  $("meter").style.width = `${total ? (100 * done) / total : 0}%`;
  updateTreeSummary();
  updateOrderCounts();
  renderStart();
  updateFileBar();
}

export async function connectDb() {
  let d = null;
  try {
    d = window.claude && typeof window.claude.use === "function" ? await window.claude.use("db") : null;
  } catch {
    d = null;
  }
  if (!d) { S.dbOff = true; return; }
  S.db = d;
  const bySig = new Map(S.files.map((f, fi) => [f.sig, fi]));
  let pushed = false;
  d.collection("reviewed").onSnapshot((snap) => {
    for (const ch of snap.docChanges()) {
      const data = ch.doc.data();
      const sig = data && data.sig;
      if (!sig) continue;
      if (ch.type === "removed") S.ticks.delete(sig); else S.ticks.add(sig);
    }
    if (!pushed && !snap.metadata.fromCache) {
      pushed = true;
      const have = new Set(snap.docs.map((x) => x.data().sig));
      for (const sig of S.ticks) {
        const fi = bySig.get(sig);
        if (fi != null && !have.has(sig)) writeTick(fi, true);
      }
    }
    saveTicks();
    repaintTicks();
  }, () => {});
  d.collection("comments").orderBy("at").onSnapshot((s) => {
    S.comments = s.docs.map((x) => Object.assign({ id: x.id }, x.data()));
    paintComments();
    repaintCommentCounts();
  }, (e) => note(`Comments stopped updating (${e.code}).`));
}
