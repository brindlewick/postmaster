// Say, for a project, where setup stands and what comes next: whether the
// global config and the project's own settings exist, whether git ignores
// the settings, the set-up verdict with its reasons, and the next step.
// Both runbooks call this; neither re-derives the order.
//
//   run setup-next <project>
//
//   exit 0  reported
//   exit 1  usage
//
// next=global means no usable global config: set it up or skip it.
// next=project means set up the project's own settings or use the global
// config as it is; with no global config it goes straight to the project's
// own settings. next=done means the check says the project is set up.
// POSTMASTER_CONFIG overrides the global config path, as check-setup reads it.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { check } from "./check-setup.ts";
import { tryTomlFile } from "./lib/data.ts";
import { globalConfigPath, repoTopLevel, settingsIgnored } from "./lib/effective-config.ts";

const USAGE = "usage: run setup-next <project>";

function usage(): never {
  console.error(USAGE);
  process.exit(1);
}

export function main(argv: string[]): number {
  if (argv.length !== 1 || !argv[0]) usage();
  const target = argv[0] as string;
  const root = repoTopLevel(target) || target;
  const globalPath = globalConfigPath();
  const globalPresent = existsSync(globalPath);
  // A global config that does not parse is no base for the project step: the
  // global step replaces it, or its removal leaves the project step alone.
  const globalUsable = globalPresent && tryTomlFile(globalPath) !== null;
  const settingsPath = join(root, ".postmaster", "settings.toml");
  const settingsPresent = existsSync(settingsPath);
  const verdict = check(target);
  if (verdict.notice !== null) console.error(verdict.notice);
  const setUp = verdict.code === 0;
  const next = setUp ? "done" : globalUsable ? "project" : "global";
  const lines = [
    `root=${root}`,
    `global=${globalPresent ? "present" : "missing"}:${globalPath}`,
    `project_settings=${settingsPresent ? "present" : "missing"}:${settingsPath}`,
    `settings_ignored=${settingsIgnored(root) ? "yes" : "no"}`,
    `setup=${setUp ? "set up" : "not set up"}`,
    ...verdict.lines.slice(1).map((reason) => `reason=${reason}`),
    `next=${next}`,
  ];
  console.log(lines.join("\n"));
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
