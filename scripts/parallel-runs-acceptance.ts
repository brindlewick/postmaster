// Acceptance oracle for parallel runs: nothing in skills/, AGENTS.md, README.md or the
// wiki still says two runs must not change the same files. Runs go in parallel up to
// `team.max_runs`, and whichever merges second resolves the conflicts at its merge.
// Five checks name one stale sentence each from before that change, matched
// case-insensitively after newlines are folded (carriage returns stripped first, so
// CRLF never hides one),
// and five match the claim itself in every file in scope (`overlapping file surfaces`,
// `never two runs on`, `not change/touch/edit the same files`): a new sentence in one
// of these phrasings trips the same guard. Further paraphrases are beyond a grep oracle.
// Six presence checks hold the sections that survive: step 6 still exists as the
// Order-them step under Stage A and orders by dependencies within its own lines (a
// word-boundary match, so `independence` never satisfies it), the `team.max_runs`
// hard-rule limit stays verbatim in its section, and the concurrency note is
// rewritten, not deleted, keeping second-resolves and never-rebase. The replacement
// wording beyond those pins is judged by reading, not by this script.
//
//   parallel-runs-acceptance.sh [repo-root]   default: the repo this script lives in
//   parallel-runs-acceptance.sh --self-test   prove each check fails on its own fault alone,
//                                             a clean tree passes, and the live tree passes
//
//   exit 0  no stale claim remains
//   exit 1  stale claims, one per line on stdout: <file>: <what is still claimed>
//   exit 2  usage, a file that cannot be read, or a tree that cannot be fully swept
//
// The self-test fails on a tree that still carries the old claims, at its live-tree step;
// that failure is the control proving the checks bite on the real files, not only fixtures.
import {
  chmodSync,
  cpSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { scriptsDir, toolRoot } from "./lib/paths.ts";
import { run, withTempDir } from "./lib/proc.ts";
import { SelfTest } from "./lib/selftest.ts";
import { casefold } from "./lib/text.ts";

function usage(): never {
  console.error("usage: parallel-runs-acceptance.sh [repo-root] | --self-test");
  process.exit(2);
}

/** Fold newlines and tabs to single spaces, so a reflow alone never passes. */
function fold(s: string): string {
  return s.replace(/[\n\t]/gu, " ").replace(/ {2,}/gu, " ");
}

/** The file folded for sweeping, carriage returns stripped first so CRLF never hides one. */
function flat(path: string): string {
  return fold(readFileSync(path, "utf8").replace(/\r/gu, ""));
}

/** The file's text, or "" when it cannot be read: the shell's awk reads "" then. */
function readText(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

interface AcceptResult {
  code: number;
  out: string;
  err: string;
}

const STALE: Array<readonly [string, string]> = [
  ["step 6 orders by file surfaces", "then the file surfaces"],
  [
    "two tickets on one module do not run together",
    "Two tickets touching the same route table, transport interface or shared module do not run at the same time",
  ],
  ["never two runs on overlapping file surfaces", "never two runs on overlapping file surfaces"],
  [
    "parallel runs are safe only on disjoint files",
    "Parallel runs are safe when their tickets touch disjoint files",
  ],
  [
    "prefer sequencing colliding tickets",
    "Prefer sequencing those tickets, or accept conflict resolution at each gated merge;",
  ],
  ["check file surfaces before mass-launching", "check the file surfaces before mass-launching"],
];
const CLAIMS = [
  "overlapping file surfaces",
  "never two runs on",
  "not change the same files",
  "not touch the same files",
  "not edit the same files",
];
// grep -qi -F is a case-insensitive fixed-string match: both sides folded once.
const STALE_FOLDED = STALE.map(([label, s]) => [label, casefold(s)] as const);
const CLAIMS_FOLDED = CLAIMS.map((c) => casefold(c));

function sweep(file: string, folded: string, out: string[]): void {
  for (const [label, sentence] of STALE_FOLDED) {
    if (folded.includes(sentence)) out.push(`${file}: still says ${label}`);
  }
  for (const claim of CLAIMS_FOLDED) {
    if (folded.includes(claim))
      out.push(`${file}: still says two runs must not change the same files`);
  }
}

// --- the scope: every regular file under skills/ and wiki/, symlinks followed ---------------
interface Scope {
  files: string[];
  error: string | null;
}

/** The directory's physical path, as `cd -P -- dir && pwd -P` prints it:
 * symlinks resolved, `.` and `..` gone, no trailing slash, a leading `//`
 * kept. Bun's realpathSync mistakes `\` for a separator, so this resolves
 * component by component. Throws when there is no such directory. */
function physicalDir(path: string): string {
  const abs = path.startsWith("/") ? path : `${process.cwd()}/${path}`;
  let dbl = abs.startsWith("//") && !abs.startsWith("///");
  const parts = abs.split("/");
  const out: string[] = [];
  let links = 0;
  let i = 0;
  while (i < parts.length) {
    const part = parts[i]!;
    i++;
    if (part === "" || part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    const probe = out.length === 0 ? `/${part}` : `/${out.join("/")}/${part}`;
    let lst;
    try {
      lst = lstatSync(probe);
    } catch {
      throw new Error(`no such directory: ${path}`);
    }
    if (lst.isSymbolicLink()) {
      links++;
      if (links > 40) throw new Error(`too many levels of symbolic links: ${path}`);
      let target: string;
      try {
        target = readlinkSync(probe);
      } catch {
        throw new Error(`no such directory: ${path}`);
      }
      if (target.startsWith("/")) {
        out.length = 0;
        dbl = target.startsWith("//") && !target.startsWith("///");
      }
      parts.splice(i, 0, ...target.split("/"));
      continue;
    }
    out.push(part);
  }
  const resolved = out.length === 0 ? (dbl ? "//" : "/") : `${dbl ? "//" : "/"}${out.join("/")}`;
  try {
    if (!statSync(resolved).isDirectory()) throw new Error(`no such directory: ${path}`);
  } catch {
    throw new Error(`no such directory: ${path}`);
  }
  return resolved;
}

/** Walk one path as find -L would: a dangling link is silently skipped, a loop,
// an unreadable directory or a missing top makes the tree unsweepable. Ancestor
// canonical paths (not a global visited set) catch loops, so a directory
// reached twice by different paths is still walked twice. */
function walkInto(
  path: string,
  top: boolean,
  files: string[],
  ancestry: Set<string>,
): string | null {
  let st;
  try {
    st = statSync(path);
  } catch (e: any) {
    if (!top && e?.code === "ENOENT") return null;
    return `${path}: ${e?.message ?? e}`;
  }
  if (st.isDirectory()) {
    let key: string;
    try {
      key = physicalDir(path);
    } catch (e: any) {
      return `${path}: ${e?.message ?? e}`;
    }
    if (ancestry.has(key)) return `${path}: file system loop detected`;
    let entries: string[];
    try {
      entries = readdirSync(path);
    } catch (e: any) {
      return `${path}: ${e?.message ?? e}`;
    }
    ancestry.add(key);
    for (const entry of entries) {
      const err = walkInto(`${path}/${entry}`, false, files, ancestry);
      if (err !== null) {
        ancestry.delete(key);
        return err;
      }
    }
    ancestry.delete(key);
    return null;
  }
  if (st.isFile()) files.push(path);
  return null;
}

function walkScope(root: string): Scope {
  const files: string[] = [];
  for (const top of [`${root}/skills`, `${root}/wiki`]) {
    const err = walkInto(top, true, files, new Set<string>());
    if (err !== null) return { files: [], error: err };
  }
  files.sort();
  return { files: [...new Set(files)], error: null };
}

// --- the surviving sections -----------------------------------------------------------------
const STEP6_RE = /^6\. /u;
const NUMSTEP_RE = /^[0-9]+\. /u;
// grep -qiE '\bdependenc(y|ies)\b': grep's \b is an ASCII word boundary.
const DEPENDENC_RE = /(?<![A-Za-z0-9_])dependenc(y|ies)(?![A-Za-z0-9_])/iu;

/** Step 6's lines: from the `6.` item under `## Stage A` to the next step or heading. */
function step6Lines(post: string): string[] {
  const step: string[] = [];
  let sect = false;
  let on = false;
  for (const line of post.split("\n")) {
    if (line.startsWith("## Stage A")) {
      sect = true;
      continue;
    }
    if (sect && line.startsWith("## ")) break;
    if (sect && STEP6_RE.test(line)) on = true;
    if (on && NUMSTEP_RE.test(line) && !STEP6_RE.test(line)) break;
    if (on) step.push(line);
  }
  return step;
}

/** A `## ` section's body: from its heading to the next `## ` heading. */
function sectionBody(text: string, head: string): string[] {
  const body: string[] = [];
  let on = false;
  for (const line of text.split("\n")) {
    if (line.startsWith(head)) {
      on = true;
      continue;
    }
    if (on && line.startsWith("## ")) break;
    if (on) body.push(line);
  }
  return body;
}

function accept(root: string): AcceptResult {
  for (const f of [
    "AGENTS.md",
    "README.md",
    "skills/postmaster/postmaster.md",
    "skills/postmaster/coachman.md",
  ]) {
    try {
      readFileSync(`${root}/${f}`);
    } catch {
      return { code: 2, out: "", err: `parallel-runs-acceptance: cannot read ${root}/${f}\n` };
    }
  }
  const out: string[] = [];
  for (const f of ["AGENTS.md", "README.md"]) {
    let text: string;
    try {
      text = casefold(flat(`${root}/${f}`));
    } catch {
      return { code: 2, out: "", err: `parallel-runs-acceptance: cannot read ${root}/${f}\n` };
    }
    sweep(f, text, out);
  }
  const scope = walkScope(root);
  if (scope.error !== null) {
    return {
      code: 2,
      out: "",
      err: `parallel-runs-acceptance: cannot fully sweep ${root}/skills and ${root}/wiki\n${scope.error}\n`,
    };
  }
  const prefix = `${root}/`;
  for (const full of scope.files) {
    const f = full.startsWith(prefix) ? full.slice(prefix.length) : full;
    let text: string;
    try {
      text = casefold(flat(full));
    } catch {
      return { code: 2, out: "", err: `parallel-runs-acceptance: cannot read ${root}/${f}\n` };
    }
    sweep(f, text, out);
  }
  const post = readText(`${root}/skills/postmaster/postmaster.md`);
  const step6 = step6Lines(post);
  const step6flat = fold(step6.join("\n"));
  if (step6.length === 0 || !step6flat.includes("Order them")) {
    out.push("skills/postmaster/postmaster.md: no longer orders tickets in an Order-them step");
  } else if (!DEPENDENC_RE.test(step6flat)) {
    out.push("skills/postmaster/postmaster.md: no longer orders step 6 by dependencies");
  }
  const rulesflat = fold(sectionBody(post, "## Hard rules").join("\n"));
  if (!rulesflat.includes("- Never launch more runs than `team.max_runs`.")) {
    out.push("skills/postmaster/postmaster.md: no longer limits runs with team.max_runs");
  }
  const note = sectionBody(
    readText(`${root}/skills/postmaster/coachman.md`),
    "## Concurrency note",
  );
  if (note.length === 0) {
    out.push("skills/postmaster/coachman.md: no longer keeps a concurrency note");
  } else {
    const noteflat = casefold(fold(note.join("\n")));
    if (!noteflat.includes("merges second")) {
      out.push(
        "skills/postmaster/coachman.md: no longer says the second merger resolves the conflicts",
      );
    }
    if (!noteflat.includes("never rebase")) {
      out.push("skills/postmaster/coachman.md: no longer says merge, never rebase");
    }
  }
  return { code: out.length === 0 ? 0 : 1, out: out.map((l) => `${l}\n`).join(""), err: "" };
}

function printAccept(r: AcceptResult): never {
  if (r.out) process.stdout.write(r.out);
  if (r.err) process.stderr.write(r.err);
  process.exit(r.code);
}

// --- entry ------------------------------------------------------------------------------
/** This script's arguments as invoked: bun swallows one `--` right after the
 * script path, so the raw command line is re-read and everything past the
 * script entry is taken. Without /proc, or when the entry is not found,
 * bun's view stands. */
function rawArgv(): string[] {
  try {
    const raw = readFileSync("/proc/self/cmdline");
    const parts: string[] = [];
    let start = 0;
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === 0) {
        parts.push(new TextDecoder().decode(raw.subarray(start, i)));
        start = i + 1;
      }
    }
    const here = import.meta.path;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === here || resolve(parts[i]!) === here) return parts.slice(i + 1);
    }
  } catch {
    /* fall through to bun's view */
  }
  return process.argv.slice(2);
}

const ROOT = toolRoot(import.meta);
const argv = rawArgv();

if (argv[0] === "--self-test") {
  if (argv.length !== 1) usage();
} else if (argv[0] === undefined) {
  if (argv.length !== 0) usage();
  printAccept(accept(ROOT));
} else if (argv[0] === "" || argv[0].startsWith("-")) {
  usage();
} else {
  if (argv.length !== 1) usage();
  printAccept(accept(argv[0]));
}

// --- self-test ----------------------------------------------------------------------------
const self = join(scriptsDir(import.meta), "parallel-runs-acceptance.sh");
withTempDir((tmp) => {
  const st = new SelfTest();

  const has = (name: string, output: string, line: string): void => {
    if (output.split("\n").includes(line)) st.ok(name);
    else st.fail(`${name}: no line "${line}" in:`, output);
  };

  const clean = join(tmp, "clean");
  mkdirSync(join(clean, "skills/postmaster"), { recursive: true });
  mkdirSync(join(clean, "wiki/concepts"), { recursive: true });
  writeFileSync(
    join(clean, "skills/postmaster/postmaster.md"),
    "## Stage A: the stream becomes tickets\n" +
      "6. **Order them.** Dependencies first: a ticket that needs another's change waits for it to land. Record the order and the reason in `<runs>/postmaster/plan.md`, current state only.\n" +
      "## Hard rules\n" +
      "- Never launch more runs than `team.max_runs`.\n",
  );
  writeFileSync(
    join(clean, "skills/postmaster/coachman.md"),
    "## Concurrency note (several runs on one project)\n" +
      "Runs go in parallel up to `team.max_runs`. When two runs change the same files, the one that merges second resolves the conflicts at its merge; merge, never rebase.\n",
  );
  writeFileSync(
    join(clean, "skills/postmaster/SKILL.md"),
    "You get the machine ready, choose a target, and start the postmaster.\n",
  );
  writeFileSync(
    join(clean, "skills/postmaster/harnesses.md"),
    "The launch keeps them, as a claude lane reads the same files.\n",
  );
  writeFileSync(
    join(clean, "AGENTS.md"),
    "| **postmaster** | decomposes a stream into tickets | `skills/postmaster/postmaster.md` |\n" +
      "Several models implement the same ticket independently, in separate worktrees.\n",
  );
  writeFileSync(
    join(clean, "README.md"),
    "Get one ticket implemented by several models at once, then judged before it lands.\n",
  );
  writeFileSync(
    join(clean, "wiki/concepts/review-loop.md"),
    "When the passes ran in sequence, each lens saw only its own output.\n" +
      "The overlap between independent reviewers estimates what an inspection left.\n",
  );

  const freshOne = (): string => {
    const one = join(tmp, "one");
    rmSync(one, { recursive: true, force: true });
    cpSync(clean, one, { recursive: true });
    return one;
  };

  const alone = (name: string, file: string, want: string, fault: string): void => {
    const one = freshOne();
    writeFileSync(join(one, file), `${fault}\n`, { flag: "a" });
    const r = accept(one);
    if (r.code === 1 && r.out.replace(/\n+$/u, "") === want) st.ok(name);
    else st.fail(`${name}: exit ${r.code} with:`, r.out + r.err);
  };

  const without = (name: string, file: string, want: string, op: (s: string) => string): void => {
    const one = freshOne();
    const p = join(one, file);
    writeFileSync(p, op(readFileSync(p, "utf8")));
    const r = accept(one);
    if (r.code === 1 && r.out.replace(/\n+$/u, "") === want) st.ok(name);
    else st.fail(`${name}: exit ${r.code} with:`, r.out + r.err);
  };

  const dropLines = (substr: string): ((s: string) => string) => {
    return (s) =>
      s
        .split("\n")
        .filter((l) => !l.includes(substr))
        .join("\n");
  };
  const sub = (a: string, b: string): ((s: string) => string) => {
    return (s) => s.replace(a, b);
  };

  console.log("each check fires on its own fault alone");
  alone(
    "step 6 file surfaces",
    "skills/postmaster/postmaster.md",
    "skills/postmaster/postmaster.md: still says step 6 orders by file surfaces",
    "6. **Order them.** Dependencies first; then the file surfaces.",
  );
  alone(
    "two tickets one module",
    "skills/postmaster/postmaster.md",
    "skills/postmaster/postmaster.md: still says two tickets on one module do not run together",
    "Two tickets touching the same route table, transport interface or shared module do not run at the same time.",
  );
  alone(
    "disjoint files",
    "skills/postmaster/coachman.md",
    "skills/postmaster/coachman.md: still says parallel runs are safe only on disjoint files",
    "Parallel runs are safe when their tickets touch disjoint files.",
  );
  alone(
    "prefer sequencing",
    "skills/postmaster/coachman.md",
    "skills/postmaster/coachman.md: still says prefer sequencing colliding tickets",
    "Prefer sequencing those tickets, or accept conflict resolution at each gated merge;",
  );
  alone(
    "check surfaces",
    "skills/postmaster/coachman.md",
    "skills/postmaster/coachman.md: still says check file surfaces before mass-launching",
    "check the file surfaces before mass-launching.",
  );
  alone(
    "AGENTS general claim",
    "AGENTS.md",
    "AGENTS.md: still says two runs must not change the same files",
    "Two runs must not change the same files.",
  );
  alone(
    "README general claim",
    "README.md",
    "README.md: still says two runs must not change the same files",
    "Two runs do not touch the same files.",
  );
  alone(
    "wiki general claim",
    "wiki/concepts/review-loop.md",
    "wiki/concepts/review-loop.md: still says two runs must not change the same files",
    "Two runs must not edit the same files.",
  );
  alone(
    "SKILL general claim",
    "skills/postmaster/SKILL.md",
    "skills/postmaster/SKILL.md: still says two runs must not change the same files",
    "The old overlapping file surfaces rule is gone.",
  );
  without(
    "step 6 kept",
    "skills/postmaster/postmaster.md",
    "skills/postmaster/postmaster.md: no longer orders tickets in an Order-them step",
    dropLines("Order them"),
  );
  without(
    "max_runs kept",
    "skills/postmaster/postmaster.md",
    "skills/postmaster/postmaster.md: no longer limits runs with team.max_runs",
    dropLines("team.max_runs"),
  );
  without(
    "step 6 dependencies",
    "skills/postmaster/postmaster.md",
    "skills/postmaster/postmaster.md: no longer orders step 6 by dependencies",
    sub("Dependencies first:", "Order kept:"),
  );
  without(
    "note kept",
    "skills/postmaster/coachman.md",
    "skills/postmaster/coachman.md: no longer keeps a concurrency note",
    dropLines("Concurrency note"),
  );
  without(
    "step 6 independence",
    "skills/postmaster/postmaster.md",
    "skills/postmaster/postmaster.md: no longer orders step 6 by dependencies",
    sub("Dependencies first:", "Order kept for independence of lanes:"),
  );
  without(
    "step 6 unrelated text",
    "skills/postmaster/postmaster.md",
    "skills/postmaster/postmaster.md: no longer orders tickets in an Order-them step",
    sub("6. **Order them.** Dependencies first:", "Order them whenever. Dependencies are fine:"),
  );
  without(
    "max_runs relocated",
    "skills/postmaster/postmaster.md",
    "skills/postmaster/postmaster.md: no longer limits runs with team.max_runs",
    (s) =>
      `${s.replace(
        "- Never launch more runs than `team.max_runs`.",
        "- Never launch runs without a ticket.",
      )}See also team.max_runs in the example config.\n`,
  );
  without(
    "note body resolves",
    "skills/postmaster/coachman.md",
    "skills/postmaster/coachman.md: no longer says the second merger resolves the conflicts",
    sub("merges second", "resolves things"),
  );
  without(
    "note body rebase",
    "skills/postmaster/coachman.md",
    "skills/postmaster/coachman.md: no longer says merge, never rebase",
    sub("never rebase", "always rebase"),
  );
  alone(
    "skills txt claim",
    "skills/NOTES.txt",
    "skills/NOTES.txt: still says two runs must not change the same files",
    "Two runs must not change the same files.",
  );
  alone(
    "wiki yml claim",
    "wiki/_config.yml",
    "wiki/_config.yml: still says two runs must not change the same files",
    "Two runs must not edit the same files.",
  );
  alone(
    "AGENTS known sentence",
    "AGENTS.md",
    "AGENTS.md: still says prefer sequencing colliding tickets",
    "Prefer sequencing those tickets, or accept conflict resolution at each gated merge;",
  );
  alone(
    "README known sentence",
    "README.md",
    "README.md: still says check file surfaces before mass-launching",
    "check the file surfaces before mass-launching.",
  );
  alone(
    "wiki known sentence",
    "wiki/concepts/review-loop.md",
    "wiki/concepts/review-loop.md: still says parallel runs are safe only on disjoint files",
    "Parallel runs are safe when their tickets touch disjoint files.",
  );
  alone(
    "capitalised claim",
    "skills/postmaster/SKILL.md",
    "skills/postmaster/SKILL.md: still says two runs must not change the same files",
    "Two Runs Must Not Change The Same Files.",
  );
  // The hard-rule clause carries two general phrasings inside it, so it fires three checks.
  {
    const one = freshOne();
    writeFileSync(
      join(one, "skills/postmaster/postmaster.md"),
      "- Never launch more runs than `team.max_runs`, and never two runs on overlapping file surfaces.\n",
      { flag: "a" },
    );
    const r = accept(one);
    const lines = r.out.replace(/\n+$/u, "").split("\n");
    if (
      r.code === 1 &&
      lines.length === 3 &&
      lines.includes(
        "skills/postmaster/postmaster.md: still says never two runs on overlapping file surfaces",
      ) &&
      lines.filter(
        (l) =>
          l ===
          "skills/postmaster/postmaster.md: still says two runs must not change the same files",
      ).length === 2
    ) {
      st.ok("hard-rule clause fires its check and the general one twice");
    } else {
      st.fail("hard-rule clause", `exit ${r.code} with:\n${r.out}`);
    }
  }
  // A capitalised hard-rule clause fires the same three checks.
  {
    const one = freshOne();
    writeFileSync(
      join(one, "skills/postmaster/SKILL.md"),
      "Never Two Runs On Overlapping File Surfaces.\n",
      { flag: "a" },
    );
    const r = accept(one);
    const lines = r.out.replace(/\n+$/u, "").split("\n");
    if (
      r.code === 1 &&
      lines.length === 3 &&
      lines.includes(
        "skills/postmaster/SKILL.md: still says never two runs on overlapping file surfaces",
      ) &&
      lines.filter(
        (l) =>
          l === "skills/postmaster/SKILL.md: still says two runs must not change the same files",
      ).length === 2
    ) {
      st.ok("capitalised clause fires its check and the general one twice");
    } else {
      st.fail("capitalised clause", `exit ${r.code} with:\n${r.out}`);
    }
  }

  console.log("all faults together");
  {
    const stale = join(tmp, "stale");
    rmSync(stale, { recursive: true, force: true });
    cpSync(clean, stale, { recursive: true });
    writeFileSync(
      join(stale, "skills/postmaster/postmaster.md"),
      "6. **Order them.** Dependencies first; then the file surfaces. Two tickets touching the same route table, transport interface or shared module do not run at the same time.\n" +
        "- Never launch more runs than `team.max_runs`, and never two runs on overlapping file surfaces.\n",
      { flag: "a" },
    );
    writeFileSync(
      join(stale, "skills/postmaster/coachman.md"),
      "Parallel runs are safe when their tickets touch disjoint files.\n" +
        "Prefer sequencing those tickets, or accept conflict resolution at each gated merge;\n" +
        "check the file surfaces before mass-launching.\n",
      { flag: "a" },
    );
    writeFileSync(join(stale, "AGENTS.md"), "Two runs must not change the same files.\n", {
      flag: "a",
    });
    writeFileSync(join(stale, "README.md"), "Two runs do not touch the same files.\n", {
      flag: "a",
    });
    writeFileSync(
      join(stale, "wiki/concepts/review-loop.md"),
      "Two runs must not edit the same files.\n",
      { flag: "a" },
    );
    const r = accept(stale);
    if (r.code === 1) st.ok("stale tree exits 1");
    else st.fail(`stale tree exits ${r.code}, want 1`);
    const lines = r.out.replace(/\n+$/u, "").split("\n");
    if (lines.length === 11) st.ok("stale tree lists 11 faults");
    else st.fail("stale tree lists:", r.out);
    has(
      "stale step 6 surfaces",
      r.out,
      "skills/postmaster/postmaster.md: still says step 6 orders by file surfaces",
    );
    has(
      "stale two tickets",
      r.out,
      "skills/postmaster/postmaster.md: still says two tickets on one module do not run together",
    );
    has(
      "stale hard rule",
      r.out,
      "skills/postmaster/postmaster.md: still says never two runs on overlapping file surfaces",
    );
    has(
      "stale disjoint",
      r.out,
      "skills/postmaster/coachman.md: still says parallel runs are safe only on disjoint files",
    );
    has(
      "stale sequencing",
      r.out,
      "skills/postmaster/coachman.md: still says prefer sequencing colliding tickets",
    );
    has(
      "stale check surfaces",
      r.out,
      "skills/postmaster/coachman.md: still says check file surfaces before mass-launching",
    );
    has(
      "stale postmaster general",
      r.out,
      "skills/postmaster/postmaster.md: still says two runs must not change the same files",
    );
    has(
      "stale AGENTS general",
      r.out,
      "AGENTS.md: still says two runs must not change the same files",
    );
    has(
      "stale README general",
      r.out,
      "README.md: still says two runs must not change the same files",
    );
    has(
      "stale wiki general",
      r.out,
      "wiki/concepts/review-loop.md: still says two runs must not change the same files",
    );
  }

  {
    const r = accept(clean);
    if (r.code === 0 && r.out === "") st.ok("clean tree passes");
    else st.fail(`clean tree exits ${r.code} with:`, r.out + r.err);
  }

  {
    const r = accept(join(tmp, "nowhere"));
    if (r.code === 2) st.ok("missing tree exits 2");
    else st.fail(`missing tree exits ${r.code}`);
  }

  {
    const r = run(self, [clean, "extra"]);
    if (r.code === 2) st.ok("an extra argument exits 2");
    else st.fail(`an extra argument exits ${r.code}`);
  }
  {
    const r = run(self, ["--self-test", "extra"]);
    if (r.code === 2) st.ok("--self-test with an extra argument exits 2");
    else st.fail(`--self-test with an extra argument exits ${r.code}`);
  }

  {
    const crlf = join(tmp, "crlf");
    rmSync(crlf, { recursive: true, force: true });
    cpSync(clean, crlf, { recursive: true });
    writeFileSync(
      join(crlf, "skills/postmaster/coachman.md"),
      "Prefer sequencing those tickets, or accept\r\nconflict resolution at each gated merge;\r\n",
      { flag: "a" },
    );
    const r = accept(crlf);
    if (
      r.code === 1 &&
      r.out.replace(/\n+$/u, "") ===
        "skills/postmaster/coachman.md: still says prefer sequencing colliding tickets"
    ) {
      st.ok("a CRLF stale sentence is still caught");
    } else {
      st.fail("a CRLF stale sentence", `exit ${r.code} with:\n${r.out}`);
    }
  }

  {
    const locked = join(tmp, "locked");
    rmSync(locked, { recursive: true, force: true });
    cpSync(clean, locked, { recursive: true });
    const p = join(locked, "skills/postmaster/postmaster.md");
    chmodSync(p, 0);
    const r = accept(locked);
    chmodSync(p, 0o644);
    if (r.code === 2) st.ok("an unreadable file exits 2, not a clean result");
    else st.fail(`an unreadable file exits ${r.code} with:`, r.out + r.err);
  }

  {
    const lockeddir = join(tmp, "lockeddir");
    rmSync(lockeddir, { recursive: true, force: true });
    cpSync(clean, lockeddir, { recursive: true });
    mkdirSync(join(lockeddir, "skills/hidden"));
    writeFileSync(
      join(lockeddir, "skills/hidden/evil.md"),
      "Two runs must not change the same files.\n",
    );
    chmodSync(join(lockeddir, "skills/hidden"), 0);
    const r = accept(lockeddir);
    chmodSync(join(lockeddir, "skills/hidden"), 0o755);
    if (r.code === 2) st.ok("an unreadable subtree exits 2, not a clean result");
    else st.fail(`an unreadable subtree exits ${r.code} with:`, r.out + r.err);
  }

  {
    const reflow = join(tmp, "reflow");
    rmSync(reflow, { recursive: true, force: true });
    cpSync(clean, reflow, { recursive: true });
    writeFileSync(
      join(reflow, "skills/postmaster/postmaster.md"),
      "## Stage A: the stream becomes tickets\n" +
        "6. **Order them.**\n" +
        "   Read the stream.\n" +
        "   Count the tickets.\n" +
        "   Name the owners.\n" +
        "   Check the board.\n" +
        "   Note the risks.\n" +
        "   Ask the room.\n" +
        "   Dependencies first: a ticket that needs another's change waits for it to land.\n" +
        "## Hard rules\n" +
        "- Never launch more runs than `team.max_runs`.\n",
    );
    const r = accept(reflow);
    if (r.code === 0 && r.out === "" && r.err === "") {
      st.ok("a reflowed step 6 still passes, silently");
    } else {
      st.fail(`a reflowed step 6: exit ${r.code} out:`, `${r.out}\nerr:\n${r.err}`);
    }
  }

  {
    const split = join(tmp, "split");
    rmSync(split, { recursive: true, force: true });
    cpSync(clean, split, { recursive: true });
    writeFileSync(
      join(split, "skills/postmaster/postmaster.md"),
      "## Stage A: the stream becomes tickets\n" +
        "6. **Order\n" +
        "them.** Dependencies first: a ticket that needs another's change waits for it to land.\n" +
        "## Hard rules\n" +
        "- Never launch more runs than `team.max_runs`.\n",
    );
    const r = accept(split);
    if (r.code === 0 && r.out === "" && r.err === "") {
      st.ok("a split Order-them still passes, silently");
    } else {
      st.fail(`a split Order-them: exit ${r.code} out:`, `${r.out}\nerr:\n${r.err}`);
    }
  }

  {
    const piped = join(tmp, "piped", "we|ird");
    rmSync(join(tmp, "piped"), { recursive: true, force: true });
    mkdirSync(join(tmp, "piped"), { recursive: true });
    cpSync(clean, piped, { recursive: true });
    writeFileSync(
      join(piped, "skills/postmaster/SKILL.md"),
      "Two runs must not change the same files.\n",
      { flag: "a" },
    );
    const r = accept(piped);
    if (
      r.code === 1 &&
      r.out.replace(/\n+$/u, "") ===
        "skills/postmaster/SKILL.md: still says two runs must not change the same files" &&
      r.err === ""
    ) {
      st.ok("a root path with a pipe still sweeps, silently");
    } else {
      st.fail(`a root path with a pipe: exit ${r.code} out:`, `${r.out}\nerr:\n${r.err}`);
    }
  }

  {
    const reflowrule = join(tmp, "reflowrule");
    rmSync(reflowrule, { recursive: true, force: true });
    cpSync(clean, reflowrule, { recursive: true });
    const p = join(reflowrule, "skills/postmaster/postmaster.md");
    writeFileSync(
      p,
      readFileSync(p, "utf8").replace(
        "- Never launch more runs than `team.max_runs`.",
        "- Never launch more runs than\n  `team.max_runs`.",
      ),
    );
    const r = accept(reflowrule);
    if (r.code === 0 && r.out === "" && r.err === "") {
      st.ok("a rewrapped hard rule still passes, silently");
    } else {
      st.fail(`a rewrapped hard rule: exit ${r.code} out:`, `${r.out}\nerr:\n${r.err}`);
    }
  }

  {
    const quoted = join(tmp, "quoted");
    rmSync(quoted, { recursive: true, force: true });
    cpSync(clean, quoted, { recursive: true });
    writeFileSync(
      join(quoted, "skills/postmaster/postmaster.md"),
      "## Stage A: the stream becomes tickets\n" +
        "6. **Order them.** Dependencies first: a ticket that needs another's change waits for it to land.\n" +
        "## Hard rules\n" +
        "- Never launch runs without a ticket.\n" +
        "## Notes\n" +
        "Quoting the old rule: - Never launch more runs than `team.max_runs`.\n",
    );
    const r = accept(quoted);
    if (
      r.code === 1 &&
      r.out.replace(/\n+$/u, "") ===
        "skills/postmaster/postmaster.md: no longer limits runs with team.max_runs" &&
      r.err === ""
    ) {
      st.ok("a hard rule quoted outside its section still faults");
    } else {
      st.fail(
        `a hard rule quoted outside its section: exit ${r.code} out:`,
        `${r.out}\nerr:\n${r.err}`,
      );
    }
  }

  {
    const movedin = join(tmp, "movedin");
    rmSync(movedin, { recursive: true, force: true });
    cpSync(clean, movedin, { recursive: true });
    writeFileSync(
      join(movedin, "skills/postmaster/postmaster.md"),
      "## Stage A: the stream becomes tickets\n" +
        "6. **Order them.** Dependencies first: a ticket that needs another's change waits for it to land.\n" +
        "## Hard rules\n" +
        "- Never merge without a ticket.\n" +
        "- Never launch more runs than `team.max_runs`.\n",
    );
    const r = accept(movedin);
    if (r.code === 0 && r.out === "" && r.err === "") {
      st.ok("a hard rule moved within its section still passes, silently");
    } else {
      st.fail(
        `a hard rule moved within its section: exit ${r.code} out:`,
        `${r.out}\nerr:\n${r.err}`,
      );
    }
  }

  {
    const flink = join(tmp, "flink");
    rmSync(flink, { recursive: true, force: true });
    cpSync(clean, flink, { recursive: true });
    writeFileSync(join(flink, "claim.txt"), "Two runs must not change the same files.\n");
    symlinkSync("../claim.txt", join(flink, "skills/evil-link.md"));
    const r = accept(flink);
    if (
      r.code === 1 &&
      r.out.replace(/\n+$/u, "") ===
        "skills/evil-link.md: still says two runs must not change the same files" &&
      r.err === ""
    ) {
      st.ok("a claim behind a file symlink faults");
    } else {
      st.fail(`a claim behind a file symlink: exit ${r.code} out:`, `${r.out}\nerr:\n${r.err}`);
    }
  }

  {
    const dlink = join(tmp, "dlink");
    rmSync(dlink, { recursive: true, force: true });
    cpSync(clean, dlink, { recursive: true });
    mkdirSync(join(dlink, "realdir"));
    writeFileSync(join(dlink, "realdir/evil.md"), "Two runs must not change the same files.\n");
    symlinkSync("../realdir", join(dlink, "wiki/sub"));
    const r = accept(dlink);
    if (
      r.code === 1 &&
      r.out.replace(/\n+$/u, "") ===
        "wiki/sub/evil.md: still says two runs must not change the same files" &&
      r.err === ""
    ) {
      st.ok("a claim behind a directory symlink faults");
    } else {
      st.fail(
        `a claim behind a directory symlink: exit ${r.code} out:`,
        `${r.out}\nerr:\n${r.err}`,
      );
    }
  }

  {
    const eloop = join(tmp, "eloop");
    rmSync(eloop, { recursive: true, force: true });
    cpSync(clean, eloop, { recursive: true });
    symlinkSync("loop", join(eloop, "skills/loop"));
    const r = accept(eloop);
    if (r.code === 2) st.ok("a symlink loop exits 2, not a clean result");
    else st.fail(`a symlink loop exits ${r.code} with:`, r.out + r.err);
  }

  {
    const r = accept(ROOT);
    if (r.code === 0) st.ok("live tree passes");
    else {
      console.log("  LIVE tree still carries stale claims (expected before the fix):");
      console.log(r.out.replace(/\n+$/u, ""));
      st.fails += 1;
    }
  }

  st.finish();
});
