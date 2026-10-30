// The file list sheet: search the names and purposes of every file, tap one to open it, or tick it
// as reviewed. The sheet follows the visual viewport, so the phone keyboard does not cover it.
function buildFind() {
  const list = $("find-list");
  list.replaceChildren();
  S.R.groups.forEach((g, gi) => {
    const sec = el("section", "find-group");
    sec.dataset.gi = String(gi);
    const h = el("h3", "find-h");
    h.append(`${g.num ? `${g.num} · ` : ""}${g.title}`);
    const c = el("small");
    c.id = `find-gc-${gi}`;
    h.append(c);
    sec.append(h);
    S.files.forEach((f, fi) => {
      if (f.group !== gi) return;
      const row = orderRow(f, fi);
      row.dataset.hay = S.hay[fi];
      sec.append(row);
    });
    list.append(sec);
  });
  filterFind();
}

function filterFind() {
  const words = $("find-q").value.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const sec of document.querySelectorAll("#find-list .find-group")) {
    let any = 0;
    for (const row of sec.querySelectorAll(".orow")) {
      const ok = words.every((w) => row.dataset.hay.includes(w));
      row.hidden = !ok;
      if (ok) any++;
    }
    sec.hidden = any === 0;
    shown += any;
  }
  $("find-none").hidden = shown !== 0;
  $("find-count").textContent = words.length ? `${shown} of ${S.files.length} files match` : `${S.files.length} files. Tap one to open it, or tick it as reviewed.`;
}

function fitFind() {
  const x = $("find");
  const vv = window.visualViewport;
  if (!vv || x.hidden) { x.style.removeProperty("height"); x.style.removeProperty("top"); return; }
  x.style.top = `${Math.round(vv.offsetTop)}px`;
  x.style.height = `${Math.round(vv.height)}px`;
}

function openFind() {
  $("find").hidden = false;
  document.documentElement.classList.add("lock");
  $("filebtn").setAttribute("aria-expanded", "true");
  fitFind();
  filterFind();
  const cur = S.fi >= 0 ? $("find-list").querySelector(`.orow[data-fi="${S.fi}"]`) : null;
  if (cur) cur.scrollIntoView({ block: "center" });
  else $("find-list").scrollTop = 0;
  if (window.matchMedia("(pointer: fine)").matches) $("find-q").focus();
}

function closeFind() {
  $("find").hidden = true;
  fitFind();
  document.documentElement.classList.remove("lock");
  $("filebtn").setAttribute("aria-expanded", "false");
  $("find-q").blur();
}

function initFind() {
  $("find-q").addEventListener("input", filterFind);
  $("find-close").addEventListener("click", closeFind);
  $("find-list").addEventListener("click", (ev) => {
    const go = ev.target.closest(".ogo");
    if (!go) return;
    const fi = Number(go.closest(".orow").dataset.fi);
    closeFind();
    openFile(fi, { tab: S.tab, seq: S.tab === "tree" ? "tree" : "order" });
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !$("find").hidden) closeFind(); });
}
