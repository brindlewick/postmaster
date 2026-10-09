// Read, validate and write a project's optional shared and local settings.
//
//   run project-settings inspect <repo>       resolved facts and their source as JSON
//   run project-settings report <repo>        compact key=value source report
//   run project-settings effective <repo> [<machine-config>]
//                                             global config with the person's file applied
//   run project-settings accept <repo>        record the user's acceptance of the tracked file
//   run project-settings ensure <repo>         create .postmaster/.gitignore, no settings
//   run project-settings write <repo> project|local [<toml-file>]
//                                             validate, then write the agreed settings
//
//   exit 0  printed, wrote, accepted, or ensured
//   exit 1  usage; anything invalid, missing, or unreadable
//
// Shared settings are .postmaster/project.toml: project facts and checks, which name no
// machine path or credential. The person's file is .postmaster/settings.toml, written
// like the global config: it overrides the global config setting by setting, a group
// merging and a list or single value replaced whole, so it may name models, env files
// and other machine settings. Missing files are normal. A settings file git tracks is
// used only after the user accepts it, and again after it changes; until then every
// reader uses the global value and says the file waits for acceptance.
import {
  asTable,
  effectiveConfig,
  effectiveConfigForProject,
  ensureIgnore,
  fail,
  globalConfigPath,
  inspect,
  isDie,
  loadMachine,
  pendingNoticeFor,
  projectRoot,
  pyTruthy,
  recordAcceptance,
  scanMachineData,
  sortedJson,
  validateCommon,
  writeProfile,
  type Rec,
} from "./lib/effective-config.ts";

// Backwards-compatible names for the suite beside this file; readers import the
// loader itself.
export {
  asTable,
  effectiveConfig,
  ensureIgnore,
  inspect,
  isDie,
  loadMachine,
  pyTruthy,
  scanMachineData,
  validateCommon,
  writeProfile,
};
export type { Rec };

const USAGE =
  "usage: run project-settings inspect|report <repo> | effective <repo> [<machine-config>]" +
  " | accept <repo> | ensure <repo> | write <repo> project|local [<toml-file>]";

const report = (repo: string): void => {
  const notice = pendingNoticeFor(repo);
  if (notice !== null) console.error(notice);
  const p = inspect(repo);
  console.log(`project_shared=${p.shared_present === true ? "yes" : "no"}`);
  console.log(`project_local=${p.local_present === true ? "yes" : "no"}`);
  const sources = p.sources as Rec;
  for (const key of [
    "project.default_turnpikes",
    "tracker.binding",
    "project.risk_surfaces",
    "roles",
  ]) {
    console.log(`project_source.${key}=${String(sources[key])}`);
  }
  const project = p.project as Rec;
  if (Object.hasOwn(project, "default_turnpikes")) {
    console.log(`project_default_turnpikes=${(project.default_turnpikes as string[]).join(", ")}`);
  }
  const tracker = p.tracker as Rec;
  if (Object.hasOwn(tracker, "binding")) console.log(`tracker_binding=${String(tracker.binding)}`);
};

// --- entry ----------------------------------------------------------------------------------------
const main = (): void => {
  const argv = process.argv.slice(2);
  if (argv.length === 0) fail(USAGE);
  const cmd = argv[0]!;
  const rest = argv.slice(1);
  if (cmd === "ensure" && rest.length === 1) {
    ensureIgnore(projectRoot(rest[0]!));
  } else if ((cmd === "inspect" || cmd === "report") && rest.length === 1) {
    const repo = projectRoot(rest[0]!);
    if (cmd === "report") report(repo);
    else {
      const notice = pendingNoticeFor(repo);
      if (notice !== null) console.error(notice);
      console.log(sortedJson(inspect(repo)));
    }
  } else if (cmd === "effective" && (rest.length === 1 || rest.length === 2)) {
    const repo = projectRoot(rest[0]!);
    const configPath = rest.length === 2 ? rest[1]! : undefined;
    const resolved = effectiveConfigForProject(repo, configPath);
    if (resolved.notice !== null) console.error(resolved.notice);
    if (resolved.config === null || resolved.error !== null) {
      fail(resolved.error ?? "no effective config");
    }
    console.log(sortedJson(resolved.config));
  } else if (cmd === "accept" && rest.length === 1) {
    console.log(recordAcceptance(projectRoot(rest[0]!), globalConfigPath()));
  } else if (cmd === "write" && (rest.length === 2 || rest.length === 3)) {
    writeProfile(projectRoot(rest[0]!), rest[1]!, rest.length === 3 ? rest[2]! : "-");
  } else {
    fail(USAGE);
  }
};

if (import.meta.main) {
  try {
    main();
  } catch (e) {
    if (isDie(e)) {
      console.error(`project-settings: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}
