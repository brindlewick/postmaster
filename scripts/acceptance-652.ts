// Oracle helpers for #652: a stand-in greptile first on PATH, and a scratch project to review. The
// tests spawn git and scripts/run as subprocesses; nothing here imports the change. The stand-in
// records what it was given and what it saw, never a value of the environment but the switches it
// is told to watch, and the key only as set or unset, so nothing a test fails on shows more.
import { chmodSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type FixtureOptions, gitOrThrow, type Machine, machine } from "./acceptance-467.ts";

/** The address the scratch project's origin has on the web. */
export const ORIGIN = "https://github.com/example/app.git";

/** What the stand-in does when it is called. An absent field is the default: exit 0, print nothing. */
export interface Behaviour {
  exit?: number;
  out?: string;
  err?: string;
  sleep?: number;
}

/** One call the stand-in recorded: what it was given, and what it saw of its checkout and environment. */
export interface Call {
  args: string;
  branch: string;
  head: string;
  remote: string;
  env: string;
}

/** A scratch project, with the folder of the stand-in greptile that heads its PATH. */
export interface Greptiled extends Machine {
  bin: string;
}

// The stand-in records the names of its environment that matter and whether the key is set, never
// the key itself.
const STAND_IN = [
  "#!/bin/sh",
  'dir=$(dirname "$0")',
  "b=$(git symbolic-ref --short -q HEAD)",
  'r=$(git config --get "branch.$b.remote" 2>/dev/null)',
  'if [ -n "$GREPTILE_API_KEY" ]; then key=set; else key=unset; fi',
  "{",
  '  echo "args: $*"',
  '  echo "branch: $b"',
  '  echo "head: $(git rev-parse HEAD)"',
  '  echo "remote: $(git remote get-url -- "$r" 2>/dev/null)"',
  '  echo "env: telemetry=${GREPTILE_TELEMETRY_DISABLED-unset} update=${GREPTILE_NO_UPDATE_CHECK-unset} install=${GREPTILE_NO_AUTO_INSTALL-unset} key=$key"',
  '  echo "--"',
  '} >> "$dir/calls.log"',
  '[ -f "$dir/out" ] && cat "$dir/out"',
  '[ -f "$dir/err" ] && cat "$dir/err" >&2',
  '[ -f "$dir/sleep" ] && sleep "$(cat "$dir/sleep")"',
  'exit "$(cat "$dir/exit" 2>/dev/null || echo 0)"',
  "",
].join("\n");

/**
 * A scratch project whose origin is on the web, with the stand-in greptile first on PATH unless asked
 * for none. The tools run with no Greptile key and none of the machine's git settings, so that the
 * machine the test runs on decides nothing.
 */
export function greptileMachine(
  root: string,
  opts: FixtureOptions & { standIn?: boolean } = {},
): Greptiled {
  // The physical path, as git and the tools print it, so that a path a test compares is the same one.
  const here = realpathSync(root);
  const m = machine(here, opts);
  gitOrThrow(m.repo, "remote", "add", "origin", ORIGIN);
  const bin = join(here, "greptile-bin");
  mkdirSync(bin, { recursive: true });
  if (opts.standIn !== false) {
    writeFileSync(join(bin, "greptile"), STAND_IN);
    chmodSync(join(bin, "greptile"), 0o755);
    m.env.PATH = `${bin}:${m.env.PATH}`;
  }
  m.env.GIT_CONFIG_GLOBAL = "/dev/null";
  m.env.GIT_CONFIG_NOSYSTEM = "1";
  m.env.GREPTILE_API_KEY = undefined;
  return { ...m, bin };
}

/** Commit files to the run's branch in its synthesis worktree, those its ignore rules match too:
 * the new snapshot. */
export function commitFiles(g: Machine, files: Record<string, string>, message: string): string {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(g.synthesis, path)), { recursive: true });
    writeFileSync(join(g.synthesis, path), text);
  }
  gitOrThrow(g.synthesis, "add", "-A", "-f");
  gitOrThrow(g.synthesis, "commit", "-q", "-m", message);
  return gitOrThrow(g.synthesis, "rev-parse", "HEAD").trim();
}

/** Set what the stand-in does from its next call on. */
export function behave(g: Greptiled, b: Behaviour = {}): void {
  const files: Array<[string, string | undefined]> = [
    ["exit", b.exit === undefined ? undefined : String(b.exit)],
    ["out", b.out],
    ["err", b.err],
    ["sleep", b.sleep === undefined ? undefined : String(b.sleep)],
  ];
  for (const [name, text] of files) {
    if (text === undefined) rmSync(join(g.bin, name), { force: true });
    else writeFileSync(join(g.bin, name), text);
  }
}

/** Every call the stand-in recorded, oldest first. */
export function calls(g: Greptiled): Call[] {
  let text = "";
  try {
    text = readFileSync(join(g.bin, "calls.log"), "utf8");
  } catch {
    return [];
  }
  return text
    .split("--\n")
    .filter((block) => block.trim() !== "")
    .map((block) => {
      const field = (name: string): string =>
        new RegExp(`^${name}: ?(.*)$`, "mu").exec(block)?.[1] ?? "";
      return {
        args: field("args"),
        branch: field("branch"),
        head: field("head"),
        remote: field("remote"),
        env: field("env"),
      };
    });
}

/** A comment as `greptile review --json` prints it, with the fields a test does not name filled in. */
export interface Comment {
  path: string;
  startLine: number;
  endLine?: number;
  severity?: string;
  body?: string;
  side?: string;
  securityIssue?: boolean;
  category?: string;
  suggestion?: string | null;
  verifiedEvidence?: string | null;
}

/** The one line of JSON `greptile review --json` prints for a finished review. */
export function report(comments: Comment[]): string {
  return JSON.stringify({
    summary: "A review.",
    confidence: 4,
    confidenceReasoning: "A focused change.",
    securitySummary: null,
    instructions: null,
    comments: comments.map((c, i) => ({
      id: `comment-${i + 1}`,
      side: "new",
      severity: "P2",
      securityIssue: false,
      category: "logic",
      body: "A finding.",
      verifiedEvidence: null,
      suggestion: null,
      hunk: null,
      ...c,
      endLine: c.endLine ?? c.startLine,
    })),
  });
}
