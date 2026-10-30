// The Order tab: the files in the order worth reading them, grouped by importance, each with a
// plain purpose line. A group can be folded; test and generated groups start folded.
const groupKey = () => `${S.key}-groups-v1`;
let openGroups = new Set();

function initGroupState() {
  const saved = store.read(groupKey(), null);
  const known = new Set((saved && saved.known) || []);
  const open = new Set((saved && saved.open) || []);
  openGroups = new Set(S.R.groups.filter((g) => (known.has(g.id) ? open.has(g.id) : !g.collapsed)).map((g) => g.id));
}
const saveGroupState = () => store.write(groupKey(), { open: [...openGroups], known: S.R.groups.map((g) => g.id) });

function orderRow(f, fi) {
  const row = el("div", "orow");
  row.dataset.fi = String(fi);
  const go = el("button", "ogo");
  go.type = "button";
  go.append(...fileTextNodes(f, fi));
  row.append(go, tickButton(fi));
  return row;
}

function renderOrder() {
  const list = $("order-list");
  list.replaceChildren();
  S.R.groups.forEach((g, gi) => {
    const sec = el("section", `ogroup${openGroups.has(g.id) ? " open" : ""}`);
    sec.dataset.gi = String(gi);
    const head = el("button", "ghead");
    head.type = "button";
    head.setAttribute("aria-expanded", String(openGroups.has(g.id)));
    const text = el("span", "gtext");
    text.append(el("span", "gtitle", g.title), el("span", "gsub", g.sub || ""));
    if (g.note) text.append(el("span", "gnote", g.note));
    const count = el("span", "gcount");
    count.id = `gcount-${gi}`;
    head.append(el("span", "gnum", g.num || "•"), text, count);
    const body = el("div", "gbody");
    S.files.forEach((f, fi) => { if (f.group === gi) body.append(orderRow(f, fi)); });
    sec.append(head, body);
    list.append(sec);
  });
  updateOrderCounts();
  repaintCommentCounts();
}

function updateOrderCounts() {
  if (!S.R) return;
  const per = S.R.groups.map(() => ({ n: 0, d: 0 }));
  S.files.forEach((f, fi) => {
    const g = per[f.group];
    g.n++;
    if (reviewedFile(fi)) g.d++;
  });
  per.forEach((g, gi) => {
    const c = $(`gcount-${gi}`);
    if (c) c.textContent = `${g.d} of ${g.n}`;
    const x = $(`find-gc-${gi}`);
    if (x) x.textContent = `${g.d} of ${g.n} reviewed`;
  });
}

function initOrder() {
  $("order-list").addEventListener("click", (ev) => {
    const head = ev.target.closest(".ghead");
    if (head) {
      const sec = head.closest(".ogroup");
      const id = S.R.groups[Number(sec.dataset.gi)].id;
      if (openGroups.has(id)) openGroups.delete(id); else openGroups.add(id);
      sec.classList.toggle("open", openGroups.has(id));
      head.setAttribute("aria-expanded", String(openGroups.has(id)));
      saveGroupState();
      return;
    }
    const go = ev.target.closest(".ogo");
    if (go) openFile(Number(go.closest(".orow").dataset.fi), { tab: "order", seq: "order" });
  });
}
