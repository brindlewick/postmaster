// The overview: the title, the reviewer's progress, the summary, the rulings with links to their
// lines, the ticket and the line that copies a note for the chat.
import { $, MINUS, S, el, hm, markdown, note, num, plural } from "./01-core.js";
import { reviewedFile } from "./02-data.js";
import { reviewedCount } from "./03-ticks.js";
import { gotoLines } from "./04-diff.js";
import { openFind } from "./08-find.js";
import { openFile, selectTab } from "./09-nav.js";

function ruleCards(into, ol) {
  const items = [...ol.children];
  S.R.rulings.forEach((r, k) => {
    const li = items[k];
    const card = el("article", "ruling");
    const head = el("div", "rhead");
    head.append(el("span", `rbadge ${r.state}`, `Ruling ${r.n} of ${S.R.rulings.length} · ${r.state === "open" ? "Open" : "Decided"}`));
    card.append(head, el("h3", "rtitle", r.title));
    const lead = new RegExp(`^\\s*${r.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.?\\s*(Open|Decided)\\.\\s*`, "i");
    card.append(el("p", "rtext", li ? li.textContent.replace(lead, "").trim() : ""));
    const links = el("div", "rlinks");
    for (const l of r.links) {
      const a = el("a", "lnk");
      a.href = `#${l.path}`;
      a.append(l.label, el("small", null, `${l.path}, ${l.from === l.to ? `line ${l.from}` : `lines ${l.from} to ${l.to}`}`));
      a.addEventListener("click", (ev) => { ev.preventDefault(); gotoLines(l.path, l.from, l.to); });
      links.append(a);
    }
    card.append(links);
    into.append(card);
  });
}

export function renderOverview() {
  const R = S.R;
  $("ov-title").textContent = R.ticket ? `#${R.ticket}, ${R.ticketTitle}` : R.ticketTitle;
  $("ov-eyebrow").textContent = `Review${R.pr ? ` · pull request ${R.pr}` : ""}${R.mergedAt ? ` · merged ${hm(R.mergedAt)}` : ""} · head ${R.head.slice(0, 7)}`;
  const meta = $("ov-meta");
  meta.append(`${plural(R.changedFiles, "file", "files")} · `, el("b", null, `+${num(R.additions)}`), " ", el("i", null, `${MINUS}${num(R.deletions)}`));
  if (R.redactions) meta.append(` · ${plural(R.redactions, "email address", "email addresses")} in the code shown as <address removed>`);
  const tmp = document.createElement("div");
  markdown(R.body ? R.body.replace(/^Closes #\d+\.\s*/i, "") : "No summary was given for this change.", tmp);
  const rh = [...tmp.querySelectorAll(":scope > h3")].find((h) => /ruling|decision|open question/i.test(h.textContent));
  if (rh && R.rulings && R.rulings.length) {
    const intro = [];
    let n = rh.nextElementSibling;
    while (n && n.tagName !== "OL" && n.tagName !== "H3") { intro.push(n); n = n.nextElementSibling; }
    if (n && n.tagName === "OL") {
      $("ov-rulings").append(el("h2", "ovh", rh.textContent));
      for (const p of intro) $("ov-rulings").append(p);
      ruleCards($("ov-rulings"), n);
      rh.remove();
      n.remove();
    }
  }
  $("ov-body").append(...tmp.childNodes);
  if (R.ticketBody) markdown(R.ticketBody, $("ov-ticket-body"));
  else $("ov-ticket").hidden = true;
  $("ov-note").textContent = `Each diff shows the usual three lines around a change. There is no whole-file view.${R.files.some((f) => f.withheld) ? " Environment files are listed without their content." : ""}`;
  renderStart();
}

// The first file not yet reviewed, in review order, outside the groups that start folded.
const nextEssential = () => S.orderSeq.find((fi) => !reviewedFile(fi) && !S.R.groups[S.files[fi].group].collapsed);

export function renderStart() {
  if (!S.R) return;
  const box = $("ov-start");
  box.replaceChildren();
  const done = reviewedCount();
  const total = S.files.length;
  const big = el("p", "big-n");
  big.append(String(done), el("small", null, ` of ${total} files reviewed`));
  const track = el("div", "bar-track");
  const fill = el("i");
  fill.style.width = `${total ? (100 * done) / total : 0}%`;
  track.append(fill);
  const next = nextEssential();
  const go = el("button", "btn big", done === 0 ? "Start with the first file" : "Continue with the next file to review");
  go.type = "button";
  if (next == null) { go.textContent = "Every file outside tests and generated files is reviewed"; go.disabled = true; }
  else go.addEventListener("click", () => openFile(next, { tab: "overview", seq: "order" }));
  const tree = el("button", "btn big quiet", "Browse the file tree");
  tree.type = "button";
  tree.addEventListener("click", () => selectTab("tree"));
  const find = el("button", "btn big quiet", "Find a file");
  find.type = "button";
  find.addEventListener("click", openFind);
  box.append(el("p", "k", "Your review"), big, track, go, tree, find);
}

function chatText() {
  const R = S.R;
  // The comments the session can read: not its own replies, not the closed ones, and, where a viewer keeps them,
  // only those the viewer holds.
  const n = S.comments.filter((c) => !c.replyTo && c.by !== "claude" && c.status !== "closed" && (c.save === undefined || c.save === "kept")).length;
  return `I reviewed ${R.ticket ? `#${R.ticket}` : "the change"}${R.pr ? ` (pull request ${R.pr})` : ""} on its page: ${n} ${n === 1 ? "line comment" : "line comments"}. Read them there.`;
}

export function initOverview() {
  $("copy").addEventListener("click", async () => {
    const t = chatText();
    try {
      await navigator.clipboard.writeText(t);
      note("Copied. Paste it into your chat with the session.");
      $("copyout").hidden = true;
    } catch {
      const o = $("copyout");
      o.value = t;
      o.hidden = false;
      o.focus();
      o.select();
      note("Copy the selected text and paste it into your chat.");
    }
  });
}
