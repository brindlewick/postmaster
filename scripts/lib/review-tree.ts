// The file tree of a change as a phone lists it: built from the changed paths, merged along
// single-directory chains, rolled up per directory, then flattened to the rows on screen.
// The review page inlines this file with its exports stripped, so it stands alone: no
// imports, no platform, clock or random calls, no locale-aware calls, no classes, and
// nothing kept between calls.

/** One changed file as the tree takes it; its position in the list is its index. */
export interface TreeInput {
  path: string;
  add: number;
  del: number;
  status: string;
  quiet?: boolean;
}

/** A directory row; a chain of single-directory levels is one row, labelled "a/b/c". */
export interface TreeDir {
  kind: "dir";
  /** The full path of the deepest directory in the row. */
  id: string;
  label: string;
  /** Rows above this one, not path segments. */
  depth: number;
  /** Rollups over every file below. */
  files: number;
  add: number;
  del: number;
  /** It holds a file and every file below is quiet. */
  quiet: boolean;
  /** Directories first, then files, each in name order. */
  children: TreeNode[];
}

/** A file row; `fi` is the file's index in the list the tree was built from. */
export interface TreeFile {
  kind: "file";
  id: string;
  fi: number;
  name: string;
  depth: number;
  status: string;
  add: number;
  del: number;
  quiet: boolean;
}

export type TreeNode = TreeDir | TreeFile;

/** One line on screen: whether a directory shows its children, and how many files it stands for. */
export interface TreeRow {
  node: TreeNode;
  open: boolean;
  shown: number;
}

interface TreeEntry {
  readonly segs: readonly string[];
  readonly fi: number;
  readonly file: TreeInput;
}

/** Names order by lower case first, then by case, one code unit at a time: -1, 0 or 1. */
export function compareNames(a: string, b: string): number {
  return codeUnitOrder(a.toLowerCase(), b.toLowerCase()) || codeUnitOrder(a, b);
}

function codeUnitOrder(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** The tree of the changed files; `fi` is each file's index in `files`, in any order. */
export function buildTree(files: readonly TreeInput[]): TreeNode[] {
  const entries = files.map((file, fi) => ({ segs: file.path.split("/"), fi, file }));
  return childrenAt(entries, 0, 0);
}

/** The sorted rows under one directory, whose path is the first `at` segments of each entry. */
function childrenAt(entries: readonly TreeEntry[], at: number, depth: number): TreeNode[] {
  const deeper = entries.filter((e) => e.segs.length > at + 1);
  const dirs = [...groupBySegment(deeper, at).values()]
    .map((group) => dirRowFrom(group, at, at + 1, depth))
    .sort((a, b) => compareNames(a.label, b.label));
  const files = entries
    .filter((e) => e.segs.length === at + 1)
    .map((e) => fileNodeFrom(e, depth))
    .sort((a, b) => compareNames(a.name, b.name) || a.fi - b.fi);
  return [...dirs, ...files];
}

/** Entries grouped by the segment at index `at`. */
function groupBySegment(entries: readonly TreeEntry[], at: number): Map<string, TreeEntry[]> {
  const groups = new Map<string, TreeEntry[]>();
  for (const e of entries) {
    const group = groups.get(e.segs[at]);
    if (group) group.push(e);
    else groups.set(e.segs[at], [e]);
  }
  return groups;
}

/**
 * The row for the directory made of the first `end` segments of `group`, labelled from
 * segment `top`. While every file below sits in one further directory, that directory
 * joins the row.
 */
function dirRowFrom(group: readonly TreeEntry[], top: number, end: number, depth: number): TreeDir {
  const next = group[0].segs[end];
  if (group.every((e) => e.segs.length > end + 1 && e.segs[end] === next)) {
    return dirRowFrom(group, top, end + 1, depth);
  }
  const children = childrenAt(group, end, depth + 1);
  const path = group[0].segs;
  return {
    kind: "dir",
    id: path.slice(0, end).join("/"),
    label: path.slice(top, end).join("/"),
    depth,
    files: sumOver(children, (n) => (n.kind === "dir" ? n.files : 1)),
    add: sumOver(children, (n) => n.add),
    del: sumOver(children, (n) => n.del),
    // A directory exists only because a file is below it, so `children` is never empty.
    quiet: children.every((n) => n.quiet),
    children,
  };
}

function fileNodeFrom(e: TreeEntry, depth: number): TreeFile {
  return {
    kind: "file",
    id: e.file.path,
    fi: e.fi,
    name: e.segs[e.segs.length - 1],
    depth,
    status: e.file.status,
    add: e.file.add,
    del: e.file.del,
    quiet: e.file.quiet === true,
  };
}

function sumOver(nodes: readonly TreeNode[], pick: (n: TreeNode) => number): number {
  return nodes.reduce((total, n) => total + pick(n), 0);
}

/** File indices in tree order, depth first. */
export function fileOrder(tree: readonly TreeNode[]): number[] {
  return tree.flatMap((n) => (n.kind === "file" ? [n.fi] : fileOrder(n.children)));
}

function dirRowsOf(tree: readonly TreeNode[]): TreeDir[] {
  return tree.flatMap((n) => (n.kind === "dir" ? [n, ...dirRowsOf(n.children)] : []));
}

/** The id of every directory row, parents before children. */
export function allDirIds(tree: readonly TreeNode[]): string[] {
  return dirRowsOf(tree).map((d) => d.id);
}

/** The directory rows to start open: those above `levels` rows deep that are not quiet. */
export function defaultOpen(tree: readonly TreeNode[], levels = 2): string[] {
  return dirRowsOf(tree)
    .filter((d) => d.depth < levels && !d.quiet)
    .map((d) => d.id);
}

/**
 * True when every whitespace-separated word of the query is inside the haystack, any case.
 * An empty word is inside every text, so a blank query, or blanks around words, need no care.
 */
export function matchWords(haystack: string, query: string): boolean {
  const text = haystack.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/u)
    .every((word) => text.includes(word));
}

/**
 * The rows to draw. A directory's children follow only when its id is in `open`. With `keep`
 * (a filter is active) `open` is ignored: kept files are listed under every directory that
 * holds one, each shown open with the count of kept files below it.
 */
export function visibleRows(
  tree: readonly TreeNode[],
  open: ReadonlySet<string>,
  keep?: (fi: number) => boolean,
): TreeRow[] {
  return keep ? tree.flatMap((n) => keptRows(n, keep)) : tree.flatMap((n) => openRows(n, open));
}

function openRows(node: TreeNode, open: ReadonlySet<string>): TreeRow[] {
  if (node.kind === "file") return [{ node, open: false, shown: 1 }];
  const isOpen = open.has(node.id);
  const below = isOpen ? node.children.flatMap((child) => openRows(child, open)) : [];
  return [{ node, open: isOpen, shown: node.files }, ...below];
}

function keptRows(node: TreeNode, keep: (fi: number) => boolean): TreeRow[] {
  if (node.kind === "file") return keep(node.fi) ? [{ node, open: false, shown: 1 }] : [];
  const below = node.children.flatMap((child) => keptRows(child, keep));
  const shown = below.filter((row) => row.node.kind === "file").length;
  return shown === 0 ? [] : [{ node, open: true, shown }, ...below];
}
