// Helpers for the #344 oracle: temp repos, a stub harness that plays a finished
// session, and a stub tmux that records the interactive open. The tests spawn git
// and scripts/run as subprocesses; nothing here imports the change. The stubs
// assume a repo whose slug is "app", so its verifier folder is verify-app.
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitAll, initRepo, RUN, writeRepoFile } from "./acceptance-323.ts";
import { run } from "./lib/proc.ts";

export { RUN };

export interface Sandbox {
  dir: string;
  repo: string;
  bin: string;
  dispatch: string;
}

const SESSION_WORK = [
  "mkdir -p verify-app/features",
  "printf '# v\\n' > verify-app/README.md",
  "printf '# f1\\n' > verify-app/features/f1.md",
  "printf '# f2\\n' > verify-app/features/f2.md",
  "printf '# f3\\n' > verify-app/features/f3.md",
  "printf '# handover\\nproved under a stub\\n' > HANDOVER.md",
  "git add -A",
  "git commit -qm stub",
].join("\n");

/** A temp repo named app with one commit, a bin dir, and a dispatch holding run.json. */
export function makeSandbox(): Sandbox {
  const dir = mkdtempSync(join(tmpdir(), "acceptance-344-"));
  const repo = join(dir, "app");
  initRepo(repo);
  writeRepoFile(repo, "README.md", "# app\n");
  commitAll(repo, "first");
  const bin = join(dir, "bin");
  const dispatch = join(dir, "dispatch");
  mkdirSync(bin, { recursive: true });
  mkdirSync(dispatch, { recursive: true });
  writeFileSync(
    join(dispatch, "run.json"),
    JSON.stringify({
      config: { team: { coachman: { harness: "claude", model: "stub-model" } } },
    }),
  );
  // host run --under names its space from the brief's synthesis worktree, which
  // must exist; the headless fallback goes through host run, so the sandbox
  // carries a minimal brief pointing at its own repo.
  writeFileSync(
    join(dispatch, "brief.md"),
    ["# Waybill: oracle", "", "## Dispatch", "name: #0, oracle", `synthesis worktree: ${repo}`, ""].join(
      "\n",
    ),
  );
  return { dir, repo, bin, dispatch };
}

/** Hermetic env for a make run: forced host, stub PATH first, temp state dirs. */
export function makeEnv(sandbox: Sandbox, extra: Record<string, string | undefined>): Record<string, string | undefined> {
  return {
    PATH: `${sandbox.bin}:${process.env.PATH ?? ""}`,
    POSTMASTER_HARNESS_DATA: join(sandbox.dir, "harness-data"),
    POSTMASTER_HOST_STATE: join(sandbox.dir, "host-state"),
    POSTMASTER_ATTEMPT_PHASE: join(sandbox.dir, "attempt.phase"),
    ...extra,
  };
}

/** A stub `claude` that plays a finished headless session in its cwd. */
export function writeStubSession(bin: string): void {
  const path = join(bin, "claude");
  writeFileSync(path, `#!/bin/sh\nset -eu\n${SESSION_WORK}\n`);
  chmodSync(path, 0o755);
}

/**
 * A stub `tmux` that logs every call, fakes list-windows, has-session and
 * set-option, and answers new-session with a window id. With ORACLE_SESSION_WORK=1
 * it also plays a finished session in the new window's -c directory; with
 * ORACLE_TMUX_FAIL_NEW=1 the spawn fails. Every call appends one line to the log.
 */
export function writeStubTmux(bin: string, log: string): void {
  const path = join(bin, "tmux");
  writeFileSync(
    path,
    [
      "#!/bin/sh",
      `LOG=${JSON.stringify(log)}`,
      'echo "tmux $*" >> "$LOG"',
      'cmd=${1:-}',
      "case \"$cmd\" in",
      "  list-windows) exit 0 ;;",
      "  has-session) exit 1 ;;",
      "  new-session)",
      '    if [ "${ORACLE_TMUX_FAIL_NEW:-}" = "1" ]; then echo boom >&2; exit 1; fi',
      "    prev=''",
      '    for a in "$@"; do',
      '      if [ "$prev" = "-c" ]; then cwd=$a; fi',
      "      prev=$a",
      "    done",
      '    if [ "${ORACLE_SESSION_WORK:-}" = "1" ]; then',
      '      ( cd "$cwd"',
      ...SESSION_WORK.split("\n").map((line) => `        ${line}`),
      "      )",
      "    fi",
      '    echo "@1"',
      "    exit 0",
      "    ;;",
      "  *) exit 0 ;;",
      "esac",
      "",
    ].join("\n"),
  );
  chmodSync(path, 0o755);
}

export function promptOrThrow(repo: string, surface: string, args: string[] = []): string {
  const r = run(RUN, ["verifier", "prompt", repo, surface, ...args]);
  if (r.code !== 0) {
    throw new Error(`verifier prompt exited ${r.code}: ${r.err.trim() || r.out.trim()}`);
  }
  return r.out;
}

/** The value of a `key <value>` line in make's summary, or "" when absent. */
export function summaryLine(out: string, key: string): string {
  for (const line of out.split("\n")) {
    if (line.startsWith(`${key} `)) return line.slice(key.length + 1).trim();
  }
  return "";
}
