// Read every run with activity in the window and write one row per run (see ../method.md).
//
//   bun extract.ts --project <repo> --legacy <dir> --fixtures <dir> --tool <repo> \
//       --since <iso> --until <iso> --out <file>
//
// `--project` is the repository whose `.postmaster/runs` holds this project's runs, `--legacy` the
// older shared folder where earlier runs live, `--fixtures` the folder of fixture repositories,
// and `--tool` a checkout of this repository, whose `scripts/usage.ts` reads the coachman's
// session records. The window is inclusive. A run is covered when any of its actions falls in it.
//
// The output holds counts, times, lane names and parsed fields. It holds no path, thread or
// session id, and no free text except incident candidates, which are scrubbed first.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  discover,
  loadReader,
  privacyFaults,
  type RunRecord,
  readRun,
  type UsageReader,
} from "./records.ts";

export type Extract = {
  window: { since: string; until: string };
  /** the commit of this repository whose reader and scripts were used */
  tool: string | null;
  runs: RunRecord[];
  /** run directories found and left out because none of their actions falls in the window */
  outside: string[];
};

/**
 * The extract as JSON with each run on a line of its own, so the file stays small and a change to
 * one run shows as one changed line.
 */
export function serialize(result: Extract): string {
  const { runs, ...rest } = result;
  const head = JSON.stringify(rest).slice(0, -1);
  return `${head},"runs":[\n${runs.map((r) => JSON.stringify(r)).join(",\n")}\n]}\n`;
}

/** Every run found, split into those with activity in the window and those without. */
export function extract(
  roots: { project?: string; legacy?: string; fixtures?: string },
  window: { since: string; until: string },
  reader: UsageReader | null,
  toolCommit: string | null = null,
): Extract {
  const rows = discover(roots).map((s) => readRun(s, window, reader));
  return {
    window,
    tool: toolCommit,
    runs: rows.filter((r) => r.actionsInWindow > 0),
    outside: rows.filter((r) => r.actionsInWindow === 0).map((r) => r.id),
  };
}

const arg = (args: string[], name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

const main = async (args: string[]): Promise<void> => {
  const since = arg(args, "--since");
  const until = arg(args, "--until");
  const out = arg(args, "--out");
  if (!since || !until || !out) {
    throw new Error(
      "usage: extract.ts --project <repo> --legacy <dir> --fixtures <dir> --tool <repo> --since <iso> --until <iso> --out <file>",
    );
  }
  const tool = arg(args, "--tool") ?? null;
  const commit = tool
    ? Bun.spawnSync(["git", "-C", tool, "rev-parse", "--short", "HEAD"]).stdout.toString().trim() ||
      null
    : null;
  const reader = tool ? await loadReader(resolve(tool)) : null;
  const result = extract(
    {
      project: arg(args, "--project"),
      legacy: arg(args, "--legacy"),
      fixtures: arg(args, "--fixtures"),
    },
    { since, until },
    reader,
    commit,
  );
  const text = serialize(result);
  const faults = privacyFaults(text);
  if (faults.length > 0)
    throw new Error(`the output holds ${faults.join(" and ")}; nothing was written`);
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, text);
  console.error(`${result.runs.length} runs in the window, ${result.outside.length} outside it`);
};

if (import.meta.main) await main(process.argv.slice(2));
