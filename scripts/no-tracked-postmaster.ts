// Fail when postmaster's own .postmaster/ holds a tracked file. D7 of #320:
// that folder holds one person's settings and run records, so the repository
// tracks nothing in it. Only the repository root's .postmaster/ counts; a
// nested one such as fixtures/app/.postmaster/ belongs to a sample project.
//
//   run no-tracked-postmaster [repo]   default: the repo this script lives in
//
//   exit 0  nothing tracked under the root .postmaster/
//   exit 1  tracked files, one per line on stdout: <path> is tracked under .postmaster/
//   exit 2  usage, or git that cannot answer
import { toolRoot } from "./lib/paths.ts";
import { run } from "./lib/proc.ts";

function usage(): never {
  console.error("usage: run no-tracked-postmaster [repo]");
  process.exit(2);
}

interface CheckResult {
  code: number;
  out: string;
  err: string;
}

export function check(root: string): CheckResult {
  const top = run("git", ["-C", root, "rev-parse", "--show-toplevel"]);
  if (top.code !== 0) {
    const detail = top.err.trim() || top.out.trim() || `exit ${top.code}`;
    return {
      code: 2,
      out: "",
      err: `no-tracked-postmaster: cannot find the repository: ${detail}\n`,
    };
  }
  const dir = top.out.trim();
  if (dir === "") {
    return { code: 2, out: "", err: "no-tracked-postmaster: cannot find the repository\n" };
  }
  const listed = run("git", ["-C", dir, "ls-files", "-z", "--", ".postmaster"]);
  if (listed.code !== 0) {
    const detail = listed.err.trim() || listed.out.trim() || `exit ${listed.code}`;
    return { code: 2, out: "", err: `no-tracked-postmaster: git ls-files failed: ${detail}\n` };
  }
  const tracked = listed.out.split("\0").filter((name) => name !== "");
  if (tracked.length === 0) return { code: 0, out: "", err: "" };
  const lines = tracked.map((name) => `${name} is tracked under .postmaster/\n`).join("");
  return { code: 1, out: lines, err: "" };
}

function printCheck(r: CheckResult): never {
  if (r.out) process.stdout.write(r.out);
  if (r.err) process.stderr.write(r.err);
  process.exit(r.code);
}

const ROOT = toolRoot(import.meta);
const argv = process.argv.slice(2);

if (import.meta.main) {
  if (argv[0]?.startsWith("-")) {
    usage();
  } else if (argv[0] === undefined) {
    if (argv.length !== 0) usage();
    printCheck(check(ROOT));
  } else {
    if (argv.length !== 1) usage();
    printCheck(check(argv[0]));
  }
}
