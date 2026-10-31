// Core: DOM helpers, number and text formatting, a small markdown renderer, code highlighting,
// storage that never throws, the page state and the short message at the bottom.

export const $ = (id) => document.getElementById(id);
export const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
export const MINUS = "−";
export const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const plural = (n, one, many) => `${num(n)} ${n === 1 ? one : many}`;
export const baseName = (p) => p.slice(p.lastIndexOf("/") + 1);
export const dirName = (p) => p.slice(0, p.lastIndexOf("/") + 1);
export const KINDS = { A: "added", M: "modified", D: "deleted", R: "renamed" };

// A path or file name as text with a soft break after each dot, dash, underscore and slash, so a
// long name wraps at a separator and not in the middle of a word.
export function softBreaks(text) {
  const out = document.createDocumentFragment();
  text.split(/([./_-])/).forEach((part, k) => {
    if (part) out.append(part);
    if (k % 2 === 1) out.append(document.createElement("wbr"));
  });
  return out;
}

export function hm(iso) {
  try {
    return new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export const store = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage is off: the state lasts for this visit */
    }
  },
};

// The page state. One object, read and written by the modules below.
export const S = {
  R: null, files: [], key: "review-page", hay: [],
  tree: [], treeSeq: [], orderSeq: [], allDirs: [], defaultOpen: new Set(),
  open: new Set(), query: "", ticks: new Set(), comments: [], db: null, dbOff: false,
  tab: "overview", screen: "overview", seq: "order", fi: -1, wide: false,
  scroll: { overview: 0, tree: 0, order: 0 }, wrap: false, sel: null, flag: null,
};

let toastTimer = 0;
export function note(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 4500);
}

// ---------- markdown: headings, lists, tables, fences, code spans, links ----------
function inline(text, into) {
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\((https?:[^)\s]+)\))/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) into.append(text.slice(last, m.index));
    if (m[2]) into.append(el("strong", null, m[2]));
    else if (m[4]) into.append(el("code", null, m[4]));
    else {
      const a = el("a", null, m[6]);
      a.href = m[7]; a.target = "_blank"; a.rel = "noopener";
      into.append(a);
    }
    last = re.lastIndex;
  }
  if (last < text.length) into.append(text.slice(last));
  return into;
}

export function markdown(src, into) {
  const lines = src.replace(/\r/g, "").split("\n");
  const isList = (l) => /^\s*([-*]|\d+[.)])\s+/.test(l);
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(l);
    if (h) { into.append(inline(h[2], el("h3"))); i++; continue; }
    if (/^\s*(```|~~~)/.test(l)) {
      const fence = l.trim().slice(0, 3);
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) buf.push(lines[i++]);
      i++;
      into.append(el("pre", "quote", buf.join("\n")));
      continue;
    }
    if (/^\s*\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const t = el("table");
      const head = el("tr");
      for (const c of cells(rows[0])) head.append(inline(c, el("th")));
      t.append(head);
      for (const r of rows.slice(2)) {
        const tr = el("tr");
        for (const c of cells(r)) tr.append(inline(c, el("td")));
        t.append(tr);
      }
      const w = el("div", "tablewrap");
      w.append(t);
      into.append(w);
      continue;
    }
    if (isList(l)) {
      const ordered = /^\s*\d+[.)]\s+/.test(l);
      const list = el(ordered ? "ol" : "ul");
      while (i < lines.length && isList(lines[i])) {
        let item = lines[i++].replace(/^\s*([-*]|\d+[.)])\s+/, "");
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !isList(lines[i])) item += " " + lines[i++].trim();
        list.append(inline(item, el("li")));
      }
      into.append(list);
      continue;
    }
    const buf = [l];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|~~~|\s*\|)/.test(lines[i]) && !isList(lines[i])) buf.push(lines[i++]);
    into.append(inline(buf.join(" "), el("p")));
  }
  return into;
}

// ---------- code: highlight into per-line runs, parse a unified diff ----------
export function hl(text, lang) {
  let html = null;
  try {
    if (window.hljs && hljs.getLanguage(lang)) html = hljs.highlight(text, { language: lang, ignoreIllegals: true }).value;
  } catch {
    html = null;
  }
  if (html == null) return text.split("\n").map((t) => (t ? [{ text: t, cls: [] }] : []));
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const out = [[]];
  const walk = (node, cls) => {
    for (const ch of node.childNodes) {
      if (ch.nodeType === Node.TEXT_NODE) {
        ch.nodeValue.split("\n").forEach((p, k) => {
          if (k > 0) out.push([]);
          if (p) out.at(-1).push({ text: p, cls });
        });
      } else if (ch.nodeType === Node.ELEMENT_NODE) {
        walk(ch, ch.className ? cls.concat(String(ch.className).split(/\s+/)) : cls);
      }
    }
  };
  walk(tpl.content, []);
  return out;
}

export function runs(into, list) {
  for (const r of list) {
    if (r.cls.length) into.append(el("span", r.cls.join(" "), r.text));
    else into.append(document.createTextNode(r.text));
  }
  // A blank line holds one space so that its row has a height; the mark says the line itself is empty.
  if (!list.length) {
    into.dataset.blank = "1";
    into.append(document.createTextNode(" "));
  }
  return into;
}

export function parseDiff(text) {
  const hunks = [];
  let h = null;
  let o = 0;
  let n = 0;
  for (const line of text.split("\n")) {
    const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(line);
    if (m) { h = { header: line, lines: [] }; hunks.push(h); o = Number(m[1]); n = Number(m[2]); continue; }
    if (!h || line.startsWith("\\")) continue;
    const t = line[0];
    const s = line.slice(1);
    if (t === "+") h.lines.push({ t, o: null, n: n++, s });
    else if (t === "-") h.lines.push({ t, o: o++, n: null, s });
    else if (t === " ") h.lines.push({ t, o: o++, n: n++, s });
  }
  return hunks;
}
