// Which of the flow's scripts lean on a machine's own files, processes and sockets (see ../method.md).
// A script is counted once per pattern, however often it uses it. Pure core; the edge at the bottom
// reads `scripts/` of a checkout and writes a table.
//
//   bun primitives.ts --repo <checkout> --out <file.md>
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Primitive = { id: string; label: string; pattern: RegExp };

export const PRIMITIVES: Primitive[] = [
  {
    id: "spawn",
    label: "starts child processes",
    pattern: /Bun\.spawn|spawnSync|execFileSync|execSync|node:child_process/u,
  },
  {
    id: "signal",
    label: "signals processes or process groups",
    pattern: /process\.kill|SIGTERM|SIGKILL|setsid|killpg|kill -/u,
  },
  {
    id: "helpers",
    label: "imports the shared process helpers (lib/proc, lib/processes)",
    pattern: /lib\/proc(?:esses)?\.ts/u,
  },
  { id: "proc", label: "reads /proc", pattern: /\/proc\//u },
  {
    id: "cgroup",
    label: "uses systemd scopes or cgroup limits",
    pattern: /systemd-run|MemoryMax|TasksMax|cgroup/u,
  },
  {
    id: "sandbox",
    label: "wraps a harness in bwrap or sandbox-exec",
    pattern: /bwrap|bubblewrap|sandbox-exec/u,
  },
  { id: "host", label: "drives herdr or tmux", pattern: /herdr|tmux/iu },
  { id: "symlink", label: "makes symbolic links", pattern: /symlinkSync|symlink\(/u },
  {
    id: "marker",
    label: "writes or waits on marker, pid or lock files",
    pattern: /\.done\b|\.pid\b|\.lock\b|\.marker|wait-for-markers|O_EXCL|flock/u,
  },
  {
    id: "worktree",
    label: "runs git worktree commands",
    pattern: /["'` ]worktree["'` ]/u,
  },
  {
    id: "home",
    label: "reads the home directory or ~/.postmaster",
    pattern: /homedir\(\)|~\/\.postmaster|process\.env\.HOME/u,
  },
];

export type Hits = Record<string, string[]>;

/** For each primitive, the names of the files whose text matches it. */
export function scan(files: Record<string, string>, primitives: readonly Primitive[] = PRIMITIVES): Hits {
  const hits: Hits = {};
  for (const p of primitives) {
    hits[p.id] = Object.entries(files)
      .filter(([, text]) => p.pattern.test(text))
      .map(([name]) => name)
      .sort();
  }
  return hits;
}

/** A markdown table: primitive, scripts using it, out of how many. */
export function table(hits: Hits, total: number, primitives: readonly Primitive[] = PRIMITIVES): string {
  const lines = ["| What a script does | Scripts | Of |", "| --- | --- | --- |"];
  for (const p of primitives) lines.push(`| ${p.label} | ${hits[p.id]?.length ?? 0} | ${total} |`);
  return lines.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const value = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const repo = value("--repo");
  const out = value("--out");
  if (!repo || !out) {
    process.stderr.write("usage: bun primitives.ts --repo <checkout> --out <file.md>\n");
    process.exit(2);
  }
  const files: Record<string, string> = {};
  for (const dir of ["scripts", "scripts/lib"]) {
    for (const name of readdirSync(join(repo, dir))) {
      if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
      files[`${dir}/${name}`] = readFileSync(join(repo, dir, name), "utf8");
    }
  }
  const total = Object.keys(files).length;
  const text = `# Scripts by what they lean on\n\n${total} non-test scripts under scripts/ and scripts/lib/.\n\n${table(scan(files), total)}\n`;
  writeFileSync(out, text);
}

if (import.meta.main) main();
