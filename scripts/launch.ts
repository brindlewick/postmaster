// Launch or resume a lane or a role by name, from the config, in the exact form harnesses.md
// records for its harness. One command for every harness, so no form is ever copied by hand;
// this script and harnesses.md must agree, and a change to one is a change to both.
//
//   launch.sh form   <name> [--leg <leg>] [--run <dispatch>] [--project <repo>]
//   launch.sh launch <name> <cwd> <prompt-file> [--leg <leg>] [--last <file>] [--run <dispatch>]
//   launch.sh review <name> <cwd> <base> [--last <file>] [--run <dispatch>]
//   launch.sh resume <name> <cwd> <thread-id> <prompt-file> [--leg <leg>] [--last <file>]
//                    [--run <dispatch>]
//   launch.sh skill  <name> <skill> [--run <dispatch>]
//
//   exit 0  the forms or the skill's prompt were printed, or the harness exited 0
//   exit 1  usage, config or run.json missing or unreadable, unknown name, a leg that is not
//           synthesis, review or ship, the coachman launched or resumed with no --leg, a
//           coachman or fallback on a lane's model, harness not on PATH, env_file missing, a
//           form this script does not have (agy resume), a skill that is not security-review,
//           or a muse or mimo resume of a thread the launch's data directory does not hold
//   exit 3  skill or review: the lane's harness has no such review form recorded
//   else    the harness's own exit code

import { spawnSync } from "node:child_process";
import {
  accessSync,
  existsSync,
  constants as fsConstants,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { readTomlFile, tryJsonFile } from "./lib/data.ts";
import { scriptsDir } from "./lib/paths.ts";
import { run, signalExitCode } from "./lib/proc.ts";

const CONFIG =
  process.env.POSTMASTER_CONFIG ?? join(process.env.HOME ?? "", ".postmaster/config.toml");
const LEGS = ["synthesis", "review", "ship"] as const;

function die(msg: string): never {
  console.error(`launch: ${msg}`);
  process.exit(1);
}

interface Spec {
  harness: string;
  model: string;
  effort: string;
  envFile: string;
}

function baseModel(model: unknown): string {
  return String(model ?? "").replace(/(\[[^\]]*\])+$/u, "");
}

function resolveSpec(
  sourcePath: string,
  name: string,
  leg: string,
  recorded: boolean,
  project: string,
): Spec {
  let cfg: Record<string, unknown>;
  if (recorded) {
    const data = tryJsonFile<Record<string, unknown>>(sourcePath);
    if (!data) die(`cannot read ${sourcePath}: it does not parse`);
    const c = data.config;
    if (c === null || typeof c !== "object" || Array.isArray(c)) {
      die(`cannot read ${sourcePath}: it records no config`);
    }
    cfg = c as Record<string, unknown>;
  } else if (project) {
    try {
      readTomlFile(sourcePath);
    } catch (e) {
      die(`cannot read ${sourcePath}: ${String(e)}`);
    }
    const r = run(join(scriptsDir(import.meta), "project-settings.sh"), [
      "effective",
      project,
      sourcePath,
    ]);
    if (r.code !== 0) die(r.err.trim() || "cannot resolve project role choices");
    try {
      cfg = JSON.parse(r.out);
    } catch (e) {
      die(`project settings gave no effective config: ${String(e)}`);
    }
  } else {
    try {
      cfg = readTomlFile(sourcePath);
    } catch (e) {
      die(`cannot read ${sourcePath}: ${String(e)}`);
    }
  }
  if (leg && !(LEGS as readonly string[]).includes(leg)) {
    die(`no such leg: --leg ${leg}; the legs are synthesis, review and ship`);
  }
  const lanes = (cfg.lanes as Record<string, unknown>) ?? {};
  const laneModels = new Set(
    Object.values(lanes)
      .filter((v) => v !== null && typeof v === "object" && (v as Record<string, unknown>).model)
      .map((v) => baseModel((v as Record<string, unknown>).model)),
  );
  const notALane = (spec: unknown, what: string): void => {
    if (
      spec !== null &&
      typeof spec === "object" &&
      (spec as Record<string, unknown>).model &&
      laneModels.has(baseModel((spec as Record<string, unknown>).model))
    ) {
      die(
        `${what} in ${sourcePath} runs on ${(spec as Record<string, unknown>).model}, a lane's model, and a coachman never does`,
      );
    }
  };
  let spec: unknown;
  if (name === "coachman") {
    const team = (cfg.team as Record<string, unknown>) ?? {};
    const legs = (team.coachman_legs as Record<string, unknown>) ?? {};
    const merged = Object.keys(legs).filter((k) => ["style", "bug", "security"].includes(k));
    if (merged.length > 0) {
      die(
        `[team.coachman_legs] in ${sourcePath} names ${merged.join(", ")}: style, bug and security are one leg now, review; give review one entry instead`,
      );
    }
    const unknown = Object.keys(legs).filter((k) => !(LEGS as readonly string[]).includes(k));
    if (unknown.length > 0) {
      die(
        `[team.coachman_legs] in ${sourcePath} names no such leg: ${unknown.join(", ")}; the legs are synthesis, review and ship`,
      );
    }
    for (const [k, v] of Object.entries(legs)) {
      if (v === null || typeof v !== "object" || Array.isArray(v)) {
        die(`[team.coachman_legs] ${k} in ${sourcePath} is not a table`);
      }
      const vt = v as Record<string, unknown>;
      if (!vt.harness || !vt.model) {
        die(`[team.coachman_legs] ${k} in ${sourcePath} needs a harness and a model`);
      }
      notALane(v, `[team.coachman_legs] ${k}`);
    }
    notALane(team.coachman, "team.coachman");
    spec = (leg ? legs[leg] : undefined) ?? team.coachman;
  } else if (name === "coachman_fallback") {
    const team = (cfg.team as Record<string, unknown>) ?? {};
    if (team === null || typeof team !== "object") die(`[team] in ${sourcePath} is not a table`);
    spec = team.coachman_fallback;
    notALane(spec, "team.coachman_fallback");
  } else if (name === "postmaster") {
    const team = (cfg.team as Record<string, unknown>) ?? {};
    spec = team.postmaster;
  } else {
    spec = lanes[name];
  }
  if (!spec) die(`no such lane or role in ${sourcePath}: ${name}`);
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) {
    die(`${name} in ${sourcePath} is not a table`);
  }
  const s = spec as Record<string, unknown>;
  const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v));
  return {
    harness: str(s.harness),
    model: str(s.model),
    effort: str(s.effort),
    envFile: str(s.env_file),
  };
}

interface FormsResult {
  cmd: string[];
  data: string;
  stdinFile: string;
  // Index into cmd holding the prompt text, or -1 when the prompt travels by
  // file or stdin: the spawn replaces that argument from the prompt file, so
  // its bytes survive as BASE's `$(cat)` hands them.
  promptArg: number;
}

export function harnessData(
  harness: string,
  cmdMode: string,
  cwd: string,
  name: string,
  leg: string,
  runDir: string,
): string {
  if (cmdMode === "form" || cmdMode === "form-resume") return `<harness-data>/${harness}/<key>`;
  const root =
    process.env.POSTMASTER_HARNESS_DATA ?? join(process.env.HOME ?? "", ".postmaster/harness-data");
  // BASE's key, byte for byte: cksum over the run, the physical directory, the
  // name and the leg, its two fields joined with a dash. A run in flight across
  // the cutover keeps its sessions only if both sides compute this identically.
  let phys = "";
  try {
    phys = realpathSync(cwd);
  } catch {
    phys = ""; // a vanished directory keys empty, as BASE's failed cd does
  }
  const key = `${runDir}|${phys}|${name}|${leg}`;
  const sum = run("cksum", [], { input: key }).out.trim().replace(/ /gu, "-");
  return `${root}/${harness}/${sum}`;
}

function buildForms(
  harness: string,
  cmdMode: string,
  cwd: string,
  prompt: string,
  promptText: string,
  thread: string,
  model: string,
  effort: string,
  last: string,
  name: string,
  leg: string,
  runDir: string,
  base: string,
): FormsResult {
  let data = "";
  let stdinFile = "";
  let promptArg = -1;
  const cmd: string[] = [];
  const isResume = cmdMode === "resume" || cmdMode === "form-resume";
  const isReview = cmdMode === "review";
  switch (harness) {
    case "codex": {
      if (isReview) cmd.push("codex", "exec", "review", "--base", base, "--json");
      else if (isResume) cmd.push("codex", "exec", "resume", thread, "--json");
      else cmd.push("codex", "exec", "-C", cwd, "--json");
      if (last) cmd.push("-o", last);
      cmd.push("-m", model);
      if (isReview) cmd.push("-c", 'model_reasoning_effort="max"');
      else if (effort) cmd.push("-c", `model_reasoning_effort="${effort}"`);
      cmd.push("--dangerously-bypass-approvals-and-sandbox");
      if (cmdMode === "launch" || isReview) {
        const ref = run("git", ["-C", cwd, "symbolic-ref", "-q", "HEAD"]);
        if (ref.code !== 0) cmd.push("--skip-git-repo-check");
      }
      if (isResume) cmd.push("--");
      if (!isReview) {
        cmd.push(promptText);
        promptArg = cmd.length - 1;
      }
      break;
    }
    case "grok": {
      if (isResume) {
        cmd.push("grok", "--resume", thread, "-p", promptText);
        promptArg = cmd.length - 1;
      } else cmd.push("grok", "--prompt-file", prompt);
      cmd.push("-m", model);
      if (effort) cmd.push("--reasoning-effort", effort);
      cmd.push("--max-turns", "1000", "--always-approve", "--output-format", "stream-json");
      break;
    }
    case "agy": {
      if (isResume) {
        throw new Error(
          "agy resume form is not recorded; relaunch against its conversationId by hand (harnesses.md)",
        );
      }
      cmd.push("agy", "-p", promptText);
      promptArg = cmd.length - 1;
      cmd.push(
        "--model",
        model,
        "--output-format",
        "stream-json",
        "--dangerously-skip-permissions",
        "--add-dir",
        cwd,
      );
      break;
    }
    case "claude": {
      const text = isReview ? `/code-review max ${base}...HEAD` : promptText;
      if (isResume) cmd.push("claude", "-p", "--resume", thread, text);
      else cmd.push("claude", "-p", text);
      // A review's text is already literal; only a launch or resume splices the file after the cd.
      if (!isReview) promptArg = cmd.length - 1;
      cmd.push("--model", model);
      if (isReview) cmd.push("--effort", "max");
      else if (effort) cmd.push("--effort", effort);
      const launchName = process.env.POSTMASTER_LAUNCH_NAME;
      if (launchName) cmd.push("--name", launchName);
      cmd.push("--output-format", "stream-json", "--verbose", "--dangerously-skip-permissions");
      break;
    }
    case "pi": {
      cmd.push("pi", "--mode", "json", "--approve");
      if (isResume) cmd.push("--session", thread);
      cmd.push("--model", model);
      if (effort) cmd.push("--thinking", effort);
      const launchName = process.env.POSTMASTER_LAUNCH_NAME;
      if (launchName) cmd.push("--name", launchName);
      stdinFile = prompt;
      break;
    }
    case "muse": {
      data = harnessData("muse", cmdMode, cwd, name, leg, runDir);
      cmd.push("env", `XDG_DATA_HOME=${data}`, "muse", "exec", "--json", "--prompt-file", prompt);
      if (isResume) cmd.push("--session-id", thread);
      cmd.push("--model", model);
      if (effort) cmd.push("--reasoning-effort", effort);
      cmd.push("--yolo"); /*BYPASS*/
      stdinFile = "/dev/null";
      break;
    }
    case "mimo": {
      data = harnessData("mimo", cmdMode, cwd, name, leg, runDir);
      cmd.push(
        "env",
        `XDG_DATA_HOME=${data}`,
        "MIMOCODE_DISABLE_CLAUDE_IMPORT=1",
        "mimo",
        "run",
        "--format",
        "json",
        "-m",
        model,
      );
      if (isReview) cmd.push("--command", "review");
      if (isResume) cmd.push("-s", thread);
      if (isReview) cmd.push("--variant", "high");
      else if (effort) cmd.push("--variant", effort);
      if (cmdMode === "launch") {
        const launchName = process.env.POSTMASTER_LAUNCH_NAME;
        if (launchName) cmd.push("--title", launchName);
      }
      cmd.push("--dangerously-skip-permissions"); /*BYPASS*/
      stdinFile = prompt;
      break;
    }
    default:
      die(`no form for harness '${harness}'`);
  }
  return { cmd, data, stdinFile, promptArg };
}

function shellQuote(s: string): string {
  // bash's printf %q: '' when empty, $'...' with escapes for control characters, and a
  // backslash before each character outside bash's unquoted-safe set otherwise.
  if (s === "") return "''";
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/u.test(s)) {
    const named: Record<string, string> = {
      "\\": "\\\\",
      "'": "\\'",
      "\n": "\\n",
      "\t": "\\t",
      "\r": "\\r",
      "\x00": "\\0",
      "\x07": "\\a",
      "\x08": "\\b",
      "\x0b": "\\v",
      "\x0c": "\\f",
      "\x1b": "\\e",
    };
    return (
      "$'" +
      // eslint-disable-next-line no-control-regex
      s.replace(
        /[\x00-\x1f\x7f\\']/gu,
        (c) => named[c] ?? `\\${c.charCodeAt(0).toString(8).padStart(3, "0")}`,
      ) +
      "'"
    );
  }
  return s.replace(/[ !"#$&'()*,;:<>?[\\\]^`{|}~]/gu, "\\$&");
}

function showArg(a: string): string {
  if (/^<.*>$/u.test(a) || /=<.*>$/u.test(a) || a === "$(cat <prompt-file>)") return `${a} `;
  return `${shellQuote(a)} `;
}

function _putForm(cwd: string, cmd: string[], stdinFile: string): string {
  let s = `cd ${showArg(cwd)}&& `;
  for (const a of cmd) s += showArg(a);
  if (stdinFile) s += `< ${showArg(stdinFile)}`;
  return s.trimEnd();
}

/** The PWD bash exports after `cd -- dir`: the path as given, folded
 * lexically (`.` and `..` resolved, symlinks kept), falling back to the
 * physical directory when the logical path names something else. */
function logicalPwd(dir: string, from: string, physical: string): string {
  try {
    if (!dir.startsWith("/") && !from) return physical;
    const abs = dir.startsWith("/") ? dir : `${from}/${dir}`;
    const parts: string[] = [];
    for (const seg of abs.split("/")) {
      if (seg === "" || seg === ".") continue;
      if (seg === "..") parts.pop();
      else parts.push(seg);
    }
    const logical = `/${parts.join("/")}`;
    return realpathSync(logical) === physical ? logical : physical;
  } catch {
    return physical;
  }
}
/** The SHLVL a fresh bash reports when started with `seen` inherited: a
 * decimal integer steps up by one (floored at zero, and 1000 or more warns
 * and restarts at 1, which the real bash downstream still does); anything
 * else restarts at 1. Pinned against bash: "040" steps to 41, "-5" to 0,
 * and "4 0", "0x10" and "" to 1. */
function nextShlvl(seen: string | undefined): string {
  let v = 1;
  if (seen !== undefined && /^[ \t\n\v\f\r]*[+-]?[0-9]+[ \t\n\v\f\r]*$/u.test(seen)) {
    const n = Number(seen);
    if (Number.isSafeInteger(n)) {
      v = n + 1;
      if (v < 0) v = 0;
      if (v >= 1000) v = 1;
    }
  }
  return String(v);
}
/** argv for `bash` to source an env_file and run cmd, as main's launcher
 * does: `set -a; . file; set +a` in the shell, then the fixed assignment main
 * makes after the source, then the harness as a child. File output reaches
 * the launch streams, an `exit` in the file exits without launching, any
 * environment size works, and no dump is ever parsed back: both callers end
 * on the child's status. The file path and cmd travel as positional
 * parameters, never interpolated into shell text. The shell starts with
 * SHLVL unset and takes the launcher's level as $1: its own startup bump
 * would otherwise collide with a file that sets the bumped level, and
 * main's child spawn hands a file-set level verbatim. */
function sourcedLaunch(file: string, cmd: string[], level: string): string[] {
  return [
    "-c",
    'SHLVL=$1; export SHLVL; f=$2; shift 2; s=${POSTMASTER_EVENT_STREAM:-}; set -a; . "$f"; set +a; POSTMASTER_EVENT_STREAM=$s; unset POSTMASTER_LAUNCH_NAME POSTMASTER_LAUNCH_ROLE; "$@"; s=$?; exit $s',
    "_",
    level,
    file,
    ...cmd,
  ];
}
/** As sourcedLaunch, for the resume export check. Main runs the check's
 * export as the last command of an `if` in its subshell, which forks: the
 * export sees the subshell's SHLVL, one above the caller's, and a file that
 * sets SHLVL lands verbatim — so the shell takes the level as $1 with SHLVL
 * unset, as in sourcedLaunch, and always forks. */
function sourcedExport(file: string, data: string, cmd: string[], level: string): string[] {
  return [
    "-c",
    'SHLVL=$1; export SHLVL; f=$2; d=$3; shift 3; set -a; . "$f"; set +a; export XDG_DATA_HOME="$d" MIMOCODE_DISABLE_CLAUDE_IMPORT=1; "$@"; s=$?; exit $s',
    "_",
    level,
    file,
    data,
    ...cmd,
  ];
}
/** argv for `bash` to splice the prompt file's bytes into argv position idx
 * and exec cmd, as BASE's `$(cat)` hands them: trailing newlines stripped,
 * every other byte raw. A prompt unreadable this late fails closed instead
 * of launching with the wrong text. */
function promptedArgv(promptFile: string, idx: number, cmd: string[]): string[] {
  return [
    "-c",
    't=$(cat "$1") || exit 1; i=$2; shift 2; set -- "${@:1:$i}" "$t" "${@:$((i + 2))}"; exec "$@"',
    "_",
    promptFile,
    String(idx),
    ...cmd,
  ];
}
/** sourcedLaunch and promptedArgv in one shell, in main's order: the prompt
 * is read before the file is sourced (so `cat` runs with PATH intact and no
 * file-defined function in scope), then the source, then the harness as a
 * child — always forked, with the level as $1 and SHLVL unset, as in
 * sourcedLaunch. */
function sourcedPrompted(
  file: string,
  promptFile: string,
  idx: number,
  cmd: string[],
  level: string,
): string[] {
  return [
    "-c",
    'SHLVL=$1; export SHLVL; t=$(cat "$2") || exit 1; f=$3; i=$4; shift 4; s=${POSTMASTER_EVENT_STREAM:-}; set -a; . "$f"; set +a; POSTMASTER_EVENT_STREAM=$s; unset POSTMASTER_LAUNCH_NAME POSTMASTER_LAUNCH_ROLE; set -- "${@:1:$i}" "$t" "${@:$((i + 2))}"; "$@"; s=$?; exit $s',
    "_",
    level,
    promptFile,
    file,
    String(idx),
    ...cmd,
  ];
}
/** A held directory for a resume's export check, as `mktemp -d` makes one:
 * a random name that never reuses an existing path, mode 0700. */
export function makeHeldDir(): string {
  return mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "launch-held-"));
}

// --- entry ------------------------------------------------------------------------------
const argv = process.argv.slice(2);

if (import.meta.main) {
  // This process is main's bash launcher: a fresh bash reports SHLVL one
  // above what it inherited, and everything below inherits that level.
  process.env.SHLVL = nextShlvl(process.env.SHLVL);
  if (argv.length < 2) die("usage: launch.sh form|launch|review|resume|skill <name> ...");
  const CMD: string = argv[0] ?? "";
  const NAME = argv[1] ?? "";
  let LEG = "";
  let LAST = "";
  let RUN = "";
  let PROJECT = "";
  const args: string[] = [];
  let i = 2;
  while (i < argv.length) {
    const a = argv[i];
    if (a === "--leg") {
      if (i + 1 >= argv.length) die("--leg needs a value");
      LEG = argv[i + 1] ?? "";
      i += 2;
    } else if (a === "--last") {
      if (i + 1 >= argv.length) die("--last needs a file");
      LAST = argv[i + 1] ?? "";
      i += 2;
    } else if (a === "--run") {
      if (i + 1 >= argv.length || !argv[i + 1]) die("--run needs a dispatch directory");
      RUN = argv[i + 1] ?? "";
      i += 2;
    } else if (a === "--project") {
      if (i + 1 >= argv.length || !argv[i + 1]) die("--project needs a project directory");
      PROJECT = argv[i + 1] ?? "";
      i += 2;
    } else {
      args.push(a ?? "");
      i += 1;
    }
  }
  if (NAME === "coachman" && CMD !== "form" && !LEG) {
    die(`coachman needs --leg synthesis, review or ship to ${CMD}`);
  }

  let source: string;
  let recorded = false;
  if (RUN) {
    if (PROJECT) die("use --run or --project, not both");
    source = join(RUN.replace(/\/$/u, ""), "run.json");
    if (!existsSync(source)) {
      die(
        `no run.json in ${RUN}; inside a run, a launch or resume runs only on the config the run recorded at dispatch`,
      );
    }
    recorded = true;
  } else {
    source = CONFIG;
    if (!existsSync(source)) {
      die(`no config at ${CONFIG} (POSTMASTER_CONFIG overrides the path)`);
    }
  }
  const spec = resolveSpec(source, NAME, LEG, recorded, PROJECT);
  const HARNESS = spec.harness;
  const MODEL = spec.model;
  const EFFORT = spec.effort;
  let ENV_FILE = spec.envFile;
  if (!HARNESS) die(`${NAME} has no harness in ${source}`);
  if (!MODEL) die(`${NAME} has no model in ${source}`);
  if (CMD === "review") {
    const forms = run(join(scriptsDir(import.meta), "review-forms.sh"), ["has", HARNESS]);
    if (forms.code !== 0) {
      console.error(
        `launch: ${NAME} runs on ${HARNESS}, which has no bug code-review form recorded in harnesses.md`,
      );
      process.exit(3);
    }
  }
  const pathCheck = spawnSync("sh", ["-c", 'command -v "$1"', "_", HARNESS], {
    encoding: "utf8",
  });
  if (pathCheck.status !== 0) die(`harness '${HARNESS}' is not on PATH`);
  if (ENV_FILE) {
    if (ENV_FILE.startsWith("~")) {
      ENV_FILE = (process.env.HOME ?? "") + ENV_FILE.slice(1);
    }
    if (!ENV_FILE.startsWith("/")) {
      // A relative path is read from the live config's directory, under --run too.
      let configDir: string;
      try {
        configDir = dirname(realpathSync(CONFIG));
      } catch {
        configDir = dirname(resolve(CONFIG));
      }
      ENV_FILE = join(configDir, ENV_FILE);
    }
    try {
      accessSync(ENV_FILE, fsConstants.R_OK);
    } catch {
      die(`env_file for ${NAME} not found or not readable: ${ENV_FILE}`);
    }
  }

  if (CMD === "skill") {
    if (args.length !== 1) die("skill needs <skill>");
    const skill = args[0] ?? "";
    if (HARNESS === "claude" && skill === "security-review") {
      console.log("/security-review");
      process.exit(0);
    } else if (skill === "security-review") {
      console.error(
        `launch: ${NAME} runs on ${HARNESS}, which has no security review skill recorded in harnesses.md`,
      );
      process.exit(3);
    } else {
      die(`no such skill: ${skill}; the one skill is security-review`);
    }
  }

  let CWD = "";
  let PROMPT = "";
  let THREAD = "";
  let BASE = "";
  let PTEXT = "";
  let REVIEW_PROMPT = "";
  const promptText = (): void => {
    try {
      accessSync(PROMPT, fsConstants.R_OK);
      const st = readFileSync(PROMPT);
      if (st.length === 0) throw new Error("empty");
      PTEXT = st.toString("utf8").replace(/\n+$/u, "");
    } catch {
      die(`prompt file missing, unreadable or empty: ${PROMPT}`);
    }
  };

  if (CMD === "form") {
    if (args.length !== 0) die("form takes no argument but --leg and --run");
    CWD = "<cwd>";
    PROMPT = "<prompt-file>";
    THREAD = "<thread-id>";
    PTEXT = "$(cat <prompt-file>)";
  } else if (CMD === "launch") {
    if (args.length !== 2) die("launch needs <cwd> <prompt-file>");
    CWD = args[0] ?? "";
    PROMPT = args[1] ?? "";
    promptText();
  } else if (CMD === "review") {
    if (args.length !== 2) die("review needs <cwd> <base>");
    CWD = args[0] ?? "";
    BASE = args[1] ?? "";
    PROMPT = "<review-prompt-file>";
  } else if (CMD === "resume") {
    if (args.length !== 3) die("resume needs <cwd> <thread-id> <prompt-file>");
    CWD = args[0] ?? "";
    THREAD = args[1] ?? "";
    PROMPT = args[2] ?? "";
    if (!THREAD) die("resume needs a thread id, and none was given");
    promptText();
  } else {
    die(`unknown command: ${CMD}`);
  }
  // BASE's `[ -d ]`: a file is no working directory, and nothing is mutated
  // for one — no trust entry, no chdir, no launch.
  if (CMD !== "form") {
    let isDir = false;
    try {
      isDir = statSync(CWD).isDirectory();
    } catch {
      isDir = false;
    }
    if (!isDir) die(`no such directory: ${CWD}`);
  }
  if (CMD === "review") {
    if (run("git", ["-C", CWD, "rev-parse", "--verify", `${BASE}^{commit}`]).code !== 0)
      die(`review base is not a commit in ${CWD}: ${BASE}`);
    if (run("git", ["-C", CWD, "diff", "--quiet", "HEAD", "--"]).code !== 0)
      die(`review scratch is dirty, which would widen the review past ${BASE}...HEAD: ${CWD}`);
    if (HARNESS === "mimo") {
      // Absolute at creation: the cd below would re-resolve a relative path, and the
      // removal after it would miss while rm -f still exits 0. Exclusive create, as mktemp.
      let promptDir = "";
      try {
        promptDir = realpathSync(CWD);
      } catch {
        die(`cannot resolve the MiMo review prompt in ${CWD}`);
      }
      REVIEW_PROMPT = join(promptDir, `.postmaster-review-${process.pid}`);
      try {
        writeFileSync(REVIEW_PROMPT, `${BASE}...HEAD\n`, { flag: "wx" });
      } catch {
        die(`cannot create the MiMo review prompt in ${CWD}`);
      }
      PROMPT = REVIEW_PROMPT;
      process.on("exit", () => {
        try {
          if (REVIEW_PROMPT) rmSync(REVIEW_PROMPT, { force: true });
        } catch {
          /* best effort */
        }
      });
    }
  }
  // For pi/muse/mimo, the prompt file is resolved to an absolute path (read after the cd),
  // and for the harnesses that take the prompt text as argv (codex, claude, agy, and grok's
  // resume), whose text is spliced from the file after the cd.
  const promptInArgv =
    HARNESS === "codex" ||
    HARNESS === "claude" ||
    HARNESS === "agy" ||
    (HARNESS === "grok" && CMD === "resume");
  if ((["pi", "muse", "mimo"].includes(HARNESS) || promptInArgv) && CMD !== "form") {
    const promptDir = dirname(resolve(PROMPT));
    PROMPT = join(promptDir, basename(PROMPT));
  }

  const mkForms = (cmdMode: string): FormsResult =>
    buildForms(
      HARNESS,
      cmdMode,
      CWD,
      PROMPT,
      PTEXT,
      THREAD,
      MODEL,
      EFFORT,
      LAST,
      NAME,
      LEG,
      RUN,
      BASE,
    );

  if (CMD === "form") {
    const show = (a: string): string => showArg(a);
    const put = (cwd: string, cmd: string[], stdinFile: string): string => {
      let s = `cd ${show(cwd)}&& `;
      for (const a of cmd) s += show(a);
      if (stdinFile) s += `< ${show(stdinFile)}`;
      return s;
    };
    const launchForms = mkForms("form");
    process.stdout.write(`launch: ${put(CWD, launchForms.cmd, launchForms.stdinFile)}\n`);
    try {
      const resumeForms = (() => {
        // Build the resume form: as the launch form's twin, with a placeholder data directory.
        return buildForms(
          HARNESS,
          "form-resume",
          CWD,
          PROMPT,
          PTEXT,
          THREAD,
          MODEL,
          EFFORT,
          LAST,
          NAME,
          LEG,
          RUN,
          BASE,
        );
      })();
      process.stdout.write(`resume: ${put(CWD, resumeForms.cmd, resumeForms.stdinFile)}\n`);
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e).replace(/^launch: /u, "");
      process.stdout.write(`resume: none: ${msg}\n`);
    }
    process.exit(0);
  }

  const forms = mkForms(CMD);
  const DATA = forms.data;
  const STDIN_FILE = forms.stdinFile;

  if (DATA) {
    try {
      mkdirSync(DATA, { recursive: true });
    } catch {
      die(`cannot create ${DATA}`);
    }
  }

  // The directory the launch leaves: BASE's `cd` takes it from $PWD — the
  // logical path when the caller came through a symlink — falling back to
  // the physical directory only when PWD is unset. The resume check's
  // subshell cds before the check and the launch itself cds after it, so
  // both see the same pair.
  let from = "";
  try {
    from = process.env.PWD || process.cwd();
  } catch {
    from = "";
  }

  // muse/mimo resume: verify the thread exists in this launch's data directory.
  if (CMD === "resume" && DATA) {
    const held = makeHeldDir();
    const exportCmd =
      HARNESS === "muse"
        ? ["muse", "export", "--session", THREAD, "--out", join(held, "thread.json")]
        : ["mimo", "export", THREAD];
    const exportEnv: Record<string, string | undefined> = {
      ...process.env,
      XDG_DATA_HOME: DATA,
      MIMOCODE_DISABLE_CLAUDE_IMPORT: "1",
    };
    // The check runs where the launch will, seeing what it will: PWD names
    // CWD logically and OLDPWD the directory it came from, as below. Main's
    // check subshell is a fork, so the export inherits the launcher's level.
    if (from !== "") exportEnv.OLDPWD = from;
    try {
      exportEnv.PWD = logicalPwd(CWD, from, realpathSync(CWD));
    } catch {
      /* keep the inherited PWD on any surprise */
    }
    // With an env file the check runs in a shell started in CWD that sources
    // the file and forks the export, as main's subshell does.
    if (ENV_FILE) exportEnv.SHLVL = undefined;
    const [expBin, expArgs] = ENV_FILE
      ? ["bash", sourcedExport(ENV_FILE, DATA, exportCmd, process.env.SHLVL ?? "1")]
      : [exportCmd[0] ?? "", exportCmd.slice(1)];
    const expResult = spawnSync(expBin, expArgs, {
      cwd: CWD,
      encoding: "utf8",
      env: exportEnv,
      stdio: ["ignore", "ignore", "pipe"],
    });
    const why = (expResult.stderr ?? "")
      .replace(/\x1b\[[0-9;]*m/gu, "")
      .replace(/\n/gu, " ")
      .slice(0, 300);
    rmSync(held, { recursive: true, force: true });
    if (expResult.status !== 0) {
      die(
        `no ${HARNESS} thread ${THREAD} in this launch's data directory, so nothing was resumed; resume from the directory, --leg and --run it was launched with (its export: ${why || "no message"})`,
      );
    }
  }

  // Codex: mark the worktree trusted first.
  if (HARNESS === "codex" && CMD === "launch") {
    const codexDir = join(process.env.HOME ?? "", ".codex");
    mkdirSync(codexDir, { recursive: true });
    const codexConfig = join(codexDir, "config.toml");
    if (!existsSync(codexConfig)) writeFileSync(codexConfig, "");
    const existing = readFileSync(codexConfig, "utf8");
    if (!existing.includes(`[projects."${CWD}"]`)) {
      writeFileSync(codexConfig, `${existing}\n[projects."${CWD}"]\ntrust_level = "trusted"\n`);
    }
  }

  // Enter the working directory and exec the harness. The directory is physical first:
  // a review prompt created in a symlinked cwd resolves the same from base or HEAD.
  try {
    CWD = realpathSync(CWD);
  } catch {
    die(`cannot resolve ${CWD}`);
  }
  try {
    process.chdir(CWD);
  } catch {
    die(`cannot enter ${CWD}`);
  }
  // BASE's `exec < file` opens the prompt before the review file is unlinked; the
  // harness inherits the open fd. The port reads the bytes at the same point.
  let stdinBytes: Buffer | null = null;
  if (STDIN_FILE) {
    try {
      stdinBytes = readFileSync(STDIN_FILE);
    } catch {
      die(`cannot read ${STDIN_FILE}`);
    }
  }
  if (REVIEW_PROMPT) {
    try {
      rmSync(REVIEW_PROMPT, { force: true });
    } catch {
      /* best effort */
    }
    REVIEW_PROMPT = "";
  }
  if (HARNESS === "codex" && CMD === "review" && LAST) {
    try {
      rmSync(LAST, { force: true });
    } catch {
      /* best effort */
    }
  }
  // BASE's `cd` leaves OLDPWD naming the directory it came from, and PWD
  // naming the directory it entered, logically; the harness inherits both.
  if (from !== "") process.env.OLDPWD = from;
  try {
    process.env.PWD = logicalPwd(CWD, from, process.cwd());
  } catch {
    /* keep the inherited PWD on any surprise */
  }
  // The role is read before the spawn: an env file the child sources can
  // neither change nor export it, as main's save/restore and unset do.
  const launchRole = process.env.POSTMASTER_LAUNCH_ROLE ?? "";
  delete process.env.POSTMASTER_LAUNCH_NAME;
  delete process.env.POSTMASTER_LAUNCH_ROLE;

  // With an env file a shell sources it and runs the harness as a child, as
  // main does: file output reaches the launch streams, an `exit` in the file
  // exits without launching, and nothing is parsed back. Where the prompt
  // travels as argv, the shell splices the file's bytes into its position, as
  // main's `$(cat)` hands them; the two wraps combine into one shell.
  let cmd = forms.cmd[0] ?? "";
  let cmdArgs = forms.cmd.slice(1);
  let freshShell = false;
  if (ENV_FILE && forms.promptArg >= 0) {
    cmd = "bash";
    cmdArgs = sourcedPrompted(
      ENV_FILE,
      PROMPT,
      forms.promptArg,
      forms.cmd,
      process.env.SHLVL ?? "1",
    );
    freshShell = true;
  } else if (ENV_FILE) {
    cmd = "bash";
    cmdArgs = sourcedLaunch(ENV_FILE, forms.cmd, process.env.SHLVL ?? "1");
    freshShell = true;
  } else if (forms.promptArg >= 0) {
    cmd = "bash";
    cmdArgs = promptedArgv(PROMPT, forms.promptArg, forms.cmd);
  }

  const child = spawnSync(cmd, cmdArgs, {
    stdio: STDIN_FILE ? ["ignore", "inherit", "inherit"] : ["inherit", "inherit", "inherit"],
    // Raw bytes, as main's `exec < file` hands them: no UTF-8 decode.
    ...(stdinBytes ? { input: stdinBytes } : {}),
    // A sourcing shell starts with SHLVL unset and takes the level as $1.
    ...(freshShell ? { env: { ...process.env, SHLVL: undefined } } : {}),
  });
  const rc =
    child.status !== null && child.status !== undefined
      ? child.status
      : child.signal
        ? signalExitCode(child.signal)
        : 1;
  const stream = process.env.POSTMASTER_EVENT_STREAM ?? "";
  if (RUN && stream) {
    const r = run(join(scriptsDir(import.meta), "export-session.sh"), [
      RUN,
      NAME,
      HARNESS,
      CWD,
      stream,
      forms.data,
    ]);
    if (r.code !== 0) {
      console.error(`launch: the harness exited ${rc} but its session was not exported`);
    }
    let recordRole = "";
    let recordLane = "";
    if (launchRole === "lane") {
      recordRole = "workhorse";
      recordLane = NAME;
    } else if (launchRole === "reviewer") {
      recordRole = "reviewer";
      recordLane = NAME;
    } else if (launchRole === "coachman") {
      recordRole = "coachman";
      recordLane = LEG;
      if (!recordLane && NAME !== "coachman_fallback") recordLane = NAME;
    }
    if (recordRole && recordLane) {
      const u = run("bun", [
        join(scriptsDir(import.meta), "usage.ts"),
        "record",
        stream,
        HARNESS,
        NAME,
        RUN,
        "--role",
        recordRole,
        "--lane",
        recordLane,
      ]);
      if (u.code !== 0) {
        console.error(`launch: the harness exited ${rc} but its usage was not recorded`);
      }
    } else {
      console.error(
        `launch: the harness exited ${rc} but its usage was not recorded; launch role or lane is missing`,
      );
    }
  }
  if (child.signal) {
    // BASE execs the harness, so a harness dead by a signal dies as one and
    // the caller sees the signal. Re-raise it on ourselves; if the signal
    // does not kill us, exit as a shell reports it.
    process.kill(process.pid, child.signal);
    process.exit(rc);
  }
  process.exit(rc);
}
