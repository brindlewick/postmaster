// Data: the review file, the diff chunks that load on demand, and what is derived from the files
// (the tree, the two file orders, the search text of each file).
import {
  buildTree, fileOrder, allDirIds, defaultOpen,
} from "../../../../scripts/lib/review-tree.ts";
import { KINDS, S } from "./01-core.js";

const chunks = new Map();
function chunk(k) {
  if (!chunks.has(k)) {
    chunks.set(k, fetch(`chunks/${k}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }));
  }
  return chunks.get(k);
}
export async function item(fi) {
  const items = await chunk(S.files[fi].chunk);
  return items.find((x) => x.i === fi);
}
export async function loadReview() {
  const res = await fetch("review.json");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function prepare(R) {
  S.R = R;
  S.files = R.files;
  S.key = R.storageKey || "review-page";
  S.hay = R.files.map((f) => [
    f.path, f.purpose || "", R.groups[f.group].title, f.first ? "read closely" : "",
    f.status === "A" ? "new" : f.status === "D" ? "deleted" : f.status === "R" ? "renamed" : "",
  ].join(" ").toLowerCase());
  S.tree = buildTree(R.files.map((f) => ({
    path: f.path, add: f.add, del: f.del, status: f.status, quiet: R.groups[f.group].collapsed === true,
  })));
  S.treeSeq = fileOrder(S.tree);
  S.orderSeq = R.files.map((_f, i) => i);
  S.allDirs = allDirIds(S.tree);
  S.defaultOpen = new Set(defaultOpen(S.tree, 2));
}

export const fileKind = (f) => KINDS[f.status] || "changed";
export const statusClass = (f) => (f.status === "A" ? "a" : f.status === "D" ? "d" : f.status === "R" ? "r" : "m");
export const reviewedFile = (fi) => S.ticks.has(S.files[fi].sig);
