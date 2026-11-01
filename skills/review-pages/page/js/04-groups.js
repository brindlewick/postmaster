// Groups of lines: a run of consecutive lines of the open diff (code rows and hunk headers) wider than the code box is
// wrapped in one scroll container, .grp, so a swipe on any line of it moves the whole run; a single wide line is a group
// of one. A line that fits ends a run, but the first two below it stay in the group as .tail, pinned at the left, so that
// a finger can sit under the text. The Show more button and a note end a run; a comment and the comment box stay in it.
const TAIL_LINES = 2;

// A group has more of itself to the left, and to the right: the layers at its edges show the shade of those.
function edges(g) {
  g.toggleAttribute("data-l", g.scrollLeft > 1);
  g.toggleAttribute("data-r", g.scrollLeft + g.clientWidth < g.scrollWidth - 1);
}

// Make the groups of the open diff: take the lines out of their groups, find the runs again and put the nodes back
// with as few moves as it takes. A group that is as it was is not touched and keeps its scroll; a new group starts
// where the group its first line was in was. A node that is moved loses the focus, so the focus is given back.
export function regroup() {
  const rows = document.querySelector("#file-code .rows");
  if (!rows || rows.clientWidth === 0) return;
  const focus = document.activeElement;
  const flat = [];
  const was = new Map();
  for (const e of Array.from(rows.children)) {
    if (!e.matches(".grp")) {
      flat.push(e);
      continue;
    }
    for (const k of Array.from(e.children)) {
      flat.push(k);
      was.set(k, e.scrollLeft);
    }
  }
  // The code of a line is its last child; a line is wider than the box when its code is. Folded lines are never wider.
  const room = rows.clientWidth + 1;
  const folded = rows.classList.contains("wrap");
  const plan = [];
  let run = null;
  let tails = 0;
  for (const e of flat) {
    const line = e.matches(".r, .hunk");
    const wide = line && !folded && e.lastElementChild.offsetWidth > room;
    const under = line && !wide && run !== null && tails < TAIL_LINES;
    e.classList.toggle("tail", under);
    if (wide) {
      if (run === null || tails > 0) {
        run = [];
        plan.push(run);
      }
      tails = 0;
      run.push(e);
    } else if (under) {
      tails += 1;
      run.push(e);
    } else if (run !== null && !line && !e.matches(".more, .status")) {
      run.push(e);
    } else {
      run = null;
      plan.push(e);
    }
  }
  const had = new Map();
  for (const g of rows.querySelectorAll(":scope > .grp")) had.set(g.firstElementChild, g);
  const made = [];
  const want = plan.map((p) => {
    if (!Array.isArray(p)) return p;
    const old = had.get(p[0]);
    if (old && old.children.length === p.length && p.every((x, i) => old.children[i] === x)) return old;
    const g = document.createElement("div");
    g.className = "grp";
    // Chrome makes a scroller a tab stop; a file has hundreds of groups.
    g.tabIndex = -1;
    g.append(...p);
    made.push([g, was.get(p[0]) || 0]);
    return g;
  });
  const keep = new Set(want);
  let at = rows.firstElementChild;
  for (const w of want) {
    while (at !== null && at !== w && !keep.has(at)) at = at.nextElementSibling;
    if (w === at) at = at.nextElementSibling;
    else rows.insertBefore(w, at);
  }
  for (const e of Array.from(rows.children)) if (!keep.has(e)) e.remove();
  for (const [g, x] of made) if (x > 0) g.scrollLeft = x;
  for (const g of rows.querySelectorAll(":scope > .grp")) edges(g);
  if (focus !== document.activeElement && rows.contains(focus)) focus.focus({ preventScroll: true });
}

// Make the groups again when the code box changes size (a window turned or unfolded, more lines drawn) and when the
// fonts arrive; the observer runs before the next paint. Drawing a file and Wrap call regroup themselves: a file of the
// same size as the one before, and lines folded inside groups as wide as the longest line, change no size.
export function watchGroups() {
  const code = document.getElementById("file-code");
  code.addEventListener("scroll", (ev) => { if (ev.target.matches(".grp")) edges(ev.target); }, true);
  new ResizeObserver(regroup).observe(code);
  document.fonts.addEventListener("loadingdone", regroup);
}
