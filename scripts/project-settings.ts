// Read, validate and write a project's optional shared and local settings.
//
//   project-settings.sh inspect <repo>       resolved facts and their source as JSON
//   project-settings.sh report <repo>        compact key=value source report
//   project-settings.sh effective <repo> [<machine-config>]
//                                             machine config with local role choices applied
//   project-settings.sh ensure <repo>         create .postmaster/.gitignore, no settings
//   project-settings.sh write <repo> project|local [<toml-file>]
//                                             validate, then write the agreed settings
//   project-settings.sh --self-test
//
//   exit 0  printed, wrote, or ensured
//   exit 1  usage; anything invalid, missing, or unreadable
//
// Shared settings are .postmaster/project.toml. Local settings are the ignored
// .postmaster/settings.toml. Missing files are normal. Project files may not name machine paths
// or credentials. The only machine data accepted by a local role choice is a name already in the
// machine config; harnesses, models, env files and other machine details stay there.
// Risk surfaces are prose and check commands are shell the project runs, so those values may
// mention a path or a secret's name; a name field (tracker binding, lane, turnpike) may not.
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseTomlText } from "./lib/data.ts";
import { scriptsDir } from "./lib/paths.ts";
import { mkstempSync, run, withTempDir } from "./lib/proc.ts";
import { SelfTest } from "./lib/selftest.ts";
import {
  BOUND_L,
  BOUND_R,
  END_OR_BEFORE_NL,
  PY_S_CLASS,
  pySplitLines,
  pyTrim,
  pyWords,
} from "./lib/text.ts";

const HERE = scriptsDir(import.meta);
const USAGE =
  "usage: project-settings.sh inspect|report <repo> | effective <repo> [<machine-config>]" +
  " | ensure <repo> | write <repo> project|local [<toml-file>] | --self-test";

// --- failure ----------------------------------------------------------------------------
// Internal failures throw a branded value the entry point (and the self-test's
// expect-fail controls) catch; anything else propagates as an unexpected crash,
// the way BASE's uncaught tracebacks did.
interface Die {
  tag: "die";
  message: string;
}

const isDie = (e: unknown): e is Die =>
  typeof e === "object" && e !== null && (e as { tag?: unknown }).tag === "die";

function fail(message: string): never {
  const d: Die = { tag: "die", message };
  throw d;
}

const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

// --- filesystem edges ---------------------------------------------------------------------
const isSymlink = (p: string): boolean => {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};

const isFile = (p: string): boolean => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

const isDir = (p: string): boolean => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

// BASE reads text strict: undecodable bytes fail the read instead of becoming U+FFFD,
// and a byte-order mark stays in the text for the parser to refuse (the decoder would
// otherwise strip it silently).
const strictDecode = (bytes: Uint8Array): string =>
  new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);

const strictRead = (p: string): string => strictDecode(readFileSync(p));

const strictStdin = (): string => strictDecode(readFileSync(0));

// pathlib's ~ expansion: a leading ~ or ~/ names this user's home, ~user names
// theirs from the passwd table, and an unknown user stays unexpanded.
const expandUser = (p: string): string => {
  if (p === "~" || p.startsWith("~/")) return homedir() + p.slice(1);
  if (p.startsWith("~")) {
    const slash = p.indexOf("/");
    const user = slash < 0 ? p.slice(1) : p.slice(1, slash);
    const rest = slash < 0 ? "" : p.slice(slash);
    if (user !== "") {
      try {
        for (const line of readFileSync("/etc/passwd", "utf8").split("\n")) {
          const fields = line.split(":");
          if (fields[0] === user && fields.length >= 6) return (fields[5] ?? "") + rest;
        }
      } catch {
        // Unknown user or no passwd table: fall through unexpanded, as BASE does.
      }
    }
  }
  return p;
};

// --- patterns -------------------------------------------------------------------------------
// BASE's (?i) groups cannot compile with an i flag here: NAMED_CREDENTIAL and ENV_PATH keep
// case-sensitive ASCII lookarounds beside them, and an i flag would widen those too
// ("mysecret" would suddenly refuse). Instead every letter expands to the exact class
// Python matches for it: only I takes U+0130/U+0131, only K takes U+212A and only S takes
// U+017F — every ASCII letter differenced over the full range against re.fullmatch.
const ci = (upper: string): string => {
  const lo = String.fromCharCode(upper.charCodeAt(0) + 32);
  if (upper === "I") return `[I${lo}\u0130\u0131]`;
  if (upper === "K") return `[K${lo}\u212A]`;
  if (upper === "S") return `[S${lo}\u017F]`;
  return `[${upper}${lo}]`;
};

const ciWord = (word: string): string => [...word].map(ci).join("");

// Python (?i) ranges, exactly: the ASCII letters in both cases plus U+0130, U+0131, U+017F
// and U+212A — each differenced over the full range against its re character set.
const AZ09 = String.raw`[A-Za-z0-9_\u017F\u212A\u0130\u0131]`; // (?i)[A-Z0-9_]
const AZ09B = String.raw`[A-Za-z0-9\u017F\u212A\u0130\u0131]`; // (?i)[A-Za-z0-9]
const AZ09D = String.raw`[A-Za-z0-9_\u017F\u212A\u0130\u0131-]`; // (?i)[A-Z0-9_-]
const AZ09H = String.raw`[A-Za-z0-9\u017F\u212A\u0130\u0131-]`; // (?i)[A-Za-z0-9-]
const AZL = String.raw`[A-Za-z\u017F\u212A\u0130\u0131]`; // (?i)[a-z]
const SEP = "[_-]?";

const RX_BAD_KEY = new RegExp(
  `(?:${ciWord("SECRET")}|${ciWord("CREDENTIAL")}|${ciWord("PASSWORD")}|${ciWord("TOKEN")}|${ciWord("KEY")}${SEP}${ciWord("FILE")}|${ciWord("ENV")}${SEP}${ciWord("FILE")}|${ciWord("API")}${SEP}${ciWord("KEY")}|${ciWord("PRIVATE")}${SEP}${ciWord("KEY")}|${ciWord("AUTH")}${SEP}${ciWord("TOKEN")})`,
  "u",
);
const RX_ABS = new RegExp(`(?:^|[${PY_S_CLASS}="'(])/(?!/)(?:[^${PY_S_CLASS}"']+)`, "u");
// BASE's HOME_PATH is case-sensitive ($HOME only); RX_ENV holds the (?i) spellings.
const RX_HOME = new RegExp(
  String.raw`(?:^|[${PY_S_CLASS}="'(])(?:~(?:/|${END_OR_BEFORE_NL})|\$HOME(?:/|${END_OR_BEFORE_NL})|\$USERPROFILE(?:\\|/|${END_OR_BEFORE_NL})|%USERPROFILE%(?:\\|/|${END_OR_BEFORE_NL}))`,
  "u",
);
const RX_PARENT = new RegExp(String.raw`(?:^|[/\\])\.\.(?:[/\\]|${END_OR_BEFORE_NL})`, "u");
const RX_WINDOWS = new RegExp(String.raw`(?:^|[${PY_S_CLASS}="'(])[A-Za-z]:[\\/]`, "u");
const RX_UNC = new RegExp(
  String.raw`(?:^|[${PY_S_CLASS}="'(])(?:\\\\[^\\${PY_S_CLASS}]+\\|//[^/${PY_S_CLASS}]+/)`,
  "u",
);
const RX_FILE_URL = new RegExp(
  String.raw`${BOUND_L}(?:${ciWord("FILE")}):(?:/|\\)+[^${PY_S_CLASS}"']*`,
  "u",
);
const RX_ENV = new RegExp(
  String.raw`(?<![A-Za-z0-9_])(?:\$(?:${ciWord("HOME")}|${ciWord("USERPROFILE")}|${ciWord("HOMEDRIVE")}|${ciWord("HOMEPATH")}|${ciWord("PWD")}|${ciWord("PATH")}|${ciWord("TMP")}|${ciWord("TEMP")}|${ciWord("TMPDIR")}|${AZ09}*(?:${ciWord("PATH")}|_${ciWord("DIR")}|_${ciWord("ROOT")}|_${ciWord("HOME")}))|%(?:${ciWord("USERPROFILE")}|${ciWord("HOMEDRIVE")}|${ciWord("HOMEPATH")}|${ciWord("APPDATA")}|${ciWord("LOCALAPPDATA")}|${ciWord("TMP")}|${ciWord("TEMP")})%)`,
  "u",
);
const RX_ASSIGN = new RegExp(
  `${BOUND_L}${AZ09}*(?:${ciWord("API")}${SEP}${ciWord("KEY")}|${ciWord("AUTH")}${SEP}${ciWord("TOKEN")}|${ciWord("ACCESS")}${SEP}${ciWord("TOKEN")}|${ciWord("PASSWORD")}|${ciWord("SECRET")}|${ciWord("CREDENTIAL")})[${PY_S_CLASS}]*=[${PY_S_CLASS}]*[^${PY_S_CLASS},;]+`,
  "u",
);
const RX_TOKEN = new RegExp(
  String.raw`${BOUND_L}(?:${ciWord("GH")}[PpOoUuRrSs\u017F]_${AZ09B}{8,}|${ciWord("GITHUB")}_${ciWord("PAT")}_${AZ09}{8,}|${ciWord("GLPAT")}-${AZ09D}{8,}|${ciWord("SK")}-${AZ09D}{8,}|${ciWord("XOX")}${AZL}-${AZ09H}{8,})${BOUND_R}`,
  "u",
);
// A credential word in identifier position: bounded by non-letters on each side, or
// split from a lowercase run by a camelCase step on either side (githubApiKey,
// secretKey). The boundary tests are case-sensitive while the word itself matches
// in any case. Glued lowercase ("secretary", "mysecret") is indistinguishable
// from a natural word and stays out.
const RX_NAMED_CRED = new RegExp(
  `(?:(?<![A-Za-z])|(?<=[a-z])(?=[A-Z]))(?:${ciWord("API")}${SEP}${ciWord("KEY")}|${ciWord("AUTH")}${SEP}${ciWord("TOKEN")}|${ciWord("ACCESS")}${SEP}${ciWord("TOKEN")}|${ciWord("TOKEN")}|${ciWord("PASSWORD")}|${ciWord("SECRET")}|${ciWord("CREDENTIAL")}${ci("S")}?|${ciWord("KEY")}${SEP}${ciWord("FILE")}|${ciWord("ENV")}${SEP}${ciWord("FILE")}|${ciWord("PRIVATE")}${SEP}${ciWord("KEY")}|${ciWord("ACCESS")}${SEP}${ciWord("KEY")})(?:(?![A-Za-z])|(?<=[a-z])(?=[A-Z]))`,
  "u",
);
// Identifier shape: a separator, a digit, a camelCase step, or all caps.
const RX_IDENT = /[_-]|[0-9]|[a-z][A-Z]|^[A-Z0-9_]+$/u;
const RX_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/u;
const RX_CHECK_NAME = /^[a-z][a-z0-9-]*$/u;
const RX_SCHEME = /^[A-Za-z\u017F\u212A\u0130\u0131][A-Za-z0-9+.\u017F\u212A\u0130\u0131-]*:[^ ]/u;
const RX_CONTROL = /[\x00-\x1f\x7f]/u;
// verify.sh counts a score's groups this way and stays authoritative: the count below
// matches it literally.
const RX_GROUP_OPEN = /\((?!\?)/gu;

// --- values ---------------------------------------------------------------------------------
type Rec = Record<string, unknown>;

// A TOML/JSON table: isinstance dict. Arrays, dates and other exotica are not tables.
const isRec = (v: unknown): v is Rec => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

const asTable = (value: unknown, where: string): Rec => {
  if (!isRec(value)) fail(`${where} must be a table`);
  return value;
};

// Python truthiness for JSON values: {} and [] are falsy, NaN stays truthy.
const pyTruthy = (v: unknown): boolean => {
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v !== "";
  if (Array.isArray(v)) return v.length > 0;
  if (isRec(v)) return Object.keys(v).length > 0;
  return true;
};

// Python's sorted() on strings: code points, where UTF-16 order would put astral
// characters before U+E000.
const cmpPoints = (a: string, b: string): number => {
  const ax = [...a];
  const bx = [...b];
  const n = Math.min(ax.length, bx.length);
  for (let i = 0; i < n; i++) {
    const d = ax[i]!.codePointAt(0)! - bx[i]!.codePointAt(0)!;
    if (d !== 0) return d;
  }
  return ax.length - bx.length;
};

const typeName = (v: unknown): string =>
  typeof v === "object" && v !== null
    ? String((v as { constructor?: { name?: unknown } }).constructor?.name ?? typeof v)
    : typeof v;

// BASE's json.dumps: the control escapes JSON.stringify already emits, plus \u007f and
// every non-ASCII code point as lowercase \uXXXX, astral as a surrogate pair.
const jsonEscape = (s: string): string => {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x7f) out += ch;
    else if (cp === 0x7f) out += "\\u007f";
    else if (cp <= 0xffff) out += `\\u${cp.toString(16).padStart(4, "0")}`;
    else {
      const v = cp - 0x10000;
      out += `\\u${(0xd800 + (v >> 10)).toString(16).padStart(4, "0")}`;
      out += `\\u${(0xdc00 + (v & 0x3ff)).toString(16).padStart(4, "0")}`;
    }
  }
  return out;
};

// json.dumps(sort_keys=True): keys sorted by code point, ", " and ": " separators,
// Infinity/-Infinity/NaN tokens. Anything else (a TOML date in a machine config)
// refuses the way BASE's TypeError did: exit 1.
const sortedJson = (v: unknown): string => {
  if (v === null) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (typeof v === "string") return jsonEscape(JSON.stringify(v));
  if (typeof v === "number") {
    if (Number.isFinite(v)) return JSON.stringify(v) as string;
    return v > 0 ? "Infinity" : v < 0 ? "-Infinity" : "NaN";
  }
  if (Array.isArray(v)) return `[${v.map(sortedJson).join(", ")}]`;
  if (isRec(v)) {
    const keys = Object.keys(v).sort(cmpPoints);
    const parts = keys.map((k) => `${jsonEscape(JSON.stringify(k))}: ${sortedJson(v[k])}`);
    return `{${parts.join(", ")}}`;
  }
  return fail(`Object of type ${String(typeName(v))} is not JSON serializable`);
};

// BASE's json.loads(json.dumps(machine)): a deep copy that keeps inf/nan and refuses
// anything JSON cannot carry.
const deepCopy = (v: unknown): unknown => {
  if (v === null || typeof v === "string" || typeof v === "boolean" || typeof v === "number") {
    return v;
  }
  if (Array.isArray(v)) return v.map(deepCopy);
  if (isRec(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepCopy(x)]));
  return fail(`Object of type ${String(typeName(v))} is not JSON serializable`);
};

// --- settings paths -----------------------------------------------------------------------------
const projectRoot = (raw: string): string => {
  let resolved: string;
  try {
    resolved = realpathSync(expandUser(raw));
  } catch {
    return fail(`no such project directory: ${raw}`);
  }
  if (!isDir(resolved)) fail(`no such project directory: ${raw}`);
  return resolved;
};

const settingsDir = (repo: string): string => {
  const p = join(repo, ".postmaster");
  if (isSymlink(p)) fail(`${p} must be a directory inside the project, not a symlink`);
  if (existsSync(p) && !isDir(p)) fail(`${p} is not a directory`);
  return p;
};

// --- machine-data scan ----------------------------------------------------------------------------
const credentialNameIn = (value: string): boolean => {
  const words = pyWords(value);
  if (words.length > 1) {
    // Phrasing: only identifier-shaped words can name a credential, so
    // "Secret Santa" passes while "Migrate api_key usage" does not.
    return words.some((word) => RX_IDENT.test(word) && RX_NAMED_CRED.test(word));
  }
  // One token: any credential word in identifier position names one.
  return RX_NAMED_CRED.test(pyTrim(value));
};

const scanMachineData = (value: unknown, location: string, path: string[]): void => {
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      scanMachineData(item, `${location}[${i}]`, path);
    });
    return;
  }
  if (isRec(value)) {
    for (const [key, item] of Object.entries(value)) {
      // Check names are validated by shape below, not scanned: a check called
      // secret-scan names no credential field.
      if (path[0] !== "checks" && RX_BAD_KEY.test(key)) {
        fail(`${location} names a credential or machine file field: ${key}`);
      }
      scanMachineData(item, `${location}.${key}`, [...path, key]);
    }
    return;
  }
  if (typeof value !== "string") return;
  if (path[0] === "checks" || (path[0] === "project" && path[1] === "risk_surfaces")) {
    return; // prose about the project and shell it runs: shaped, not scanned
  }
  if (
    RX_ABS.test(value) ||
    RX_HOME.test(value) ||
    RX_PARENT.test(value) ||
    RX_WINDOWS.test(value) ||
    RX_UNC.test(value) ||
    RX_FILE_URL.test(value) ||
    RX_ENV.test(value)
  ) {
    fail(`${location} names a filesystem path on a machine`);
  }
  // ASCII: the needle is ASCII, and only ASCII letters plus U+0131 upper into it;
  // ASCII: differenced over the full range, so toUpperCase matches str.upper here exactly.
  const uppered = value.toUpperCase();
  if (
    RX_ASSIGN.test(value) ||
    RX_TOKEN.test(value) ||
    credentialNameIn(value) ||
    uppered.includes("-----BEGIN PRIVATE KEY-----")
  ) {
    fail(`${location} contains a credential value`);
  }
};

// --- settings reads -------------------------------------------------------------------------------
const parseTomlStrict = (raw: string, label: string): unknown => {
  // BASE's tomllib refuses a byte-order mark; Bun's parser swallows it.
  if (raw.startsWith("\uFEFF")) fail(`${label} does not parse: unexpected byte-order mark`);
  try {
    return parseTomlText(raw);
  } catch (e) {
    return fail(`${label} does not parse: ${errText(e)}`);
  }
};

const parseSettings = (raw: string, label: string): Rec => {
  const candidate = asTable(parseTomlStrict(raw, label), label);
  scanMachineData(candidate, label, []);
  return candidate;
};

const readToml = (path: string, label: string): { data: Rec; present: boolean } => {
  if (isSymlink(path)) fail(`${path} must not be a symlink`);
  if (!existsSync(path)) return { data: {}, present: false };
  if (!isFile(path)) fail(`${path} is not a regular file`);
  let raw: string;
  try {
    raw = strictRead(path);
  } catch (e) {
    if (isDie(e)) throw e;
    return fail(`${label} does not parse: ${errText(e)}`);
  }
  return { data: parseSettings(raw, label), present: true };
};

const knownTurnpikes = (): Set<string> => {
  const r = run(join(HERE, "turnpikes.sh"), ["--list"], { env: { POSTMASTER_PROJECT: undefined } });
  if (r.code !== 0) {
    fail(`cannot read the turnpike list: ${pyTrim(r.err) || pyTrim(r.out)}`);
  }
  const names = new Set<string>();
  for (const line of pySplitLines(r.out)) {
    const words = pyWords(line);
    if (words.length > 0) names.add(words[0]!);
  }
  return names;
};

// --- validation -------------------------------------------------------------------------------
const nonblankString = (value: unknown, where: string): string => {
  if (typeof value !== "string" || pyTrim(value) === "" || RX_CONTROL.test(value)) {
    fail(`${where} must be a non-empty string without control characters`);
  }
  return pyTrim(value);
};

const nameList = (value: unknown, where: string, allowEmpty = false): string[] => {
  const ok =
    Array.isArray(value) &&
    (value.length > 0 || allowEmpty) &&
    value.every((x) => typeof x === "string" && pyTrim(x) !== "");
  if (!ok) fail(`${where} must be a ${allowEmpty ? "" : "non-empty "}list of names`);
  const names = (value as string[]).map((x) => pyTrim(x));
  if (new Set(names).size !== names.length) fail(`${where} repeats a name`);
  for (const name of names) {
    if (!RX_NAME.test(name)) fail(`${where} has an invalid name: ${name}`);
  }
  return names;
};

const CHECK_KEYS = ["command", "shows", "use", "score", "threshold", "timeout"];
const CHECK_USES = ["cli-examples", "browser-suite", "web-journey", "library-tests"];

const validateCheck = (name: string, specValue: unknown, where: string): void => {
  // Mirrors the declared-check rules in scripts/verify.sh, which stays
  // authoritative: write must never persist a shape checks would reject, and
  // the self-test runs both validators on every bad shape below.
  if (!RX_CHECK_NAME.test(name)) fail(`${where}: a check's name is a lowercase word`);
  const spec = asTable(specValue, where);
  const extra = Object.keys(spec)
    .filter((k) => !CHECK_KEYS.includes(k))
    .sort(cmpPoints);
  if (extra.length > 0) {
    fail(`${where}: ${extra.join(", ")} is not a key; the keys are ${CHECK_KEYS.join(", ")}`);
  }
  if (Object.hasOwn(spec, "command") === Object.hasOwn(spec, "use")) {
    fail(`${where} needs a command or a use, not both`);
  }
  const shows = spec.shows;
  if (shows !== undefined && (typeof shows !== "string" || pyTrim(shows) === "")) {
    fail(`${where}: shows is words saying what the check shows`);
  }
  const timeout = spec.timeout;
  if (
    timeout !== undefined &&
    (typeof timeout === "boolean" ||
      typeof timeout !== "number" ||
      !Number.isInteger(timeout) ||
      timeout <= 0)
  ) {
    fail(`${where}: timeout is a whole number of seconds`);
  }
  if (Object.hasOwn(spec, "use")) {
    if (name === "gate" || !CHECK_USES.includes(spec.use as string)) {
      fail(
        `${where}: use names a default, one of ${CHECK_USES.join(", ")}; the gate takes a command`,
      );
    }
    if (Object.hasOwn(spec, "score") || Object.hasOwn(spec, "threshold")) {
      fail(`${where}: a score is read from a command's output, so it goes with command, not use`);
    }
    return;
  }
  const command = spec.command;
  if (typeof command !== "string" || pyTrim(command) === "") {
    fail(`${where}: command is the shell command that runs the check`);
  }
  if (shows === undefined) fail(`${where}: shows says what the check shows`);
  const hasScore = Object.hasOwn(spec, "score");
  const hasThreshold = Object.hasOwn(spec, "threshold");
  if (hasScore !== hasThreshold) fail(`${where}: score and threshold go together`);
  if (hasScore) {
    const score = spec.score;
    if (typeof score !== "string") {
      fail(`${where}: score is a regular expression with one group, the number`);
    }
    // A user pattern, compiled the way verify.sh compiles it: no flags, so the two
    // validators agree on what counts as a regular expression.
    let groups = 0;
    try {
      // ASCII: BASE compiles user score patterns with no flags.
      groups = (new RegExp(score).source.match(RX_GROUP_OPEN) ?? []).length;
    } catch (e) {
      fail(`${where}: score is not a regular expression: ${errText(e)}`);
    }
    if (groups !== 1) fail(`${where}: score is a regular expression with one group, the number`);
    const threshold = spec.threshold;
    if (typeof threshold === "boolean" || typeof threshold !== "number") {
      fail(`${where}: threshold is a number`);
    }
  }
};

const validateCommon = (data: Rec, label: string, local: boolean): Rec => {
  const allowed = local
    ? new Set(["project", "tracker", "roles"])
    : new Set(["project", "tracker", "checks"]);
  const unknown = Object.keys(data)
    .filter((k) => !allowed.has(k))
    .sort(cmpPoints);
  if (unknown.length > 0) fail(`${label} has unsupported table or key: ${unknown[0]}`);
  const project = asTable(Object.hasOwn(data, "project") ? data.project : {}, `${label}.project`);
  const unknownProject = Object.keys(project)
    .filter((k) => k !== "default_turnpikes" && k !== "risk_surfaces")
    .sort(cmpPoints);
  if (unknownProject.length > 0) fail(`${label}.project has unsupported key: ${unknownProject[0]}`);
  if (Object.hasOwn(project, "default_turnpikes")) {
    const names = nameList(project.default_turnpikes, `${label}.project.default_turnpikes`, true);
    const known = knownTurnpikes();
    const bad = names.filter((n) => !known.has(n));
    if (bad.length > 0) {
      fail(`${label}.project.default_turnpikes names an unknown turnpike: ${bad[0]}`);
    }
    project.default_turnpikes = names;
  }
  if (Object.hasOwn(project, "risk_surfaces")) {
    const surfaces = project.risk_surfaces;
    if (typeof surfaces === "string") {
      project.risk_surfaces = nonblankString(surfaces, `${label}.project.risk_surfaces`);
    } else if (
      Array.isArray(surfaces) &&
      surfaces.length > 0 &&
      surfaces.every((x) => typeof x === "string" && pyTrim(x) !== "")
    ) {
      project.risk_surfaces = surfaces.map((x) => pyTrim(x as string));
    } else {
      fail(`${label}.project.risk_surfaces must be non-empty text or a list of non-empty strings`);
    }
  }
  const tracker = asTable(Object.hasOwn(data, "tracker") ? data.tracker : {}, `${label}.tracker`);
  const unknownTracker = Object.keys(tracker)
    .filter((k) => k !== "binding")
    .sort(cmpPoints);
  if (unknownTracker.length > 0) fail(`${label}.tracker has unsupported key: ${unknownTracker[0]}`);
  if (Object.hasOwn(tracker, "binding")) {
    const binding = nonblankString(tracker.binding, `${label}.tracker.binding`);
    // A name admits board-title punctuation; a path or URL does not pass. The value
    // scan above already refuses absolute, home, parent, Windows, UNC, file: and
    // env-var paths, so this refuses only what it misses: separators anywhere, a
    // URL scheme, and a leading ~ or $ expansion.
    if (
      binding.includes("/") ||
      binding.includes("\\") ||
      binding.includes("://") ||
      RX_SCHEME.test(binding) ||
      binding.startsWith("~") ||
      binding.startsWith("$")
    ) {
      fail(`${label}.tracker.binding must be a tracker name, not a path or URL`);
    }
    tracker.binding = binding;
  }
  if (!local && Object.hasOwn(data, "checks")) {
    const checks = asTable(data.checks, `${label}.checks`);
    for (const [checkName, checkSpec] of Object.entries(checks)) {
      validateCheck(checkName, checkSpec, `${label}.checks.${checkName}`);
    }
  }
  if (local) {
    const roles = asTable(Object.hasOwn(data, "roles") ? data.roles : {}, `${label}.roles`);
    const allowedRoles = new Set(["workhorses", "reviewers", "coachman", "lens_reviewers"]);
    const unknownRoles = Object.keys(roles)
      .filter((k) => !allowedRoles.has(k))
      .sort(cmpPoints);
    if (unknownRoles.length > 0) fail(`${label}.roles has unsupported key: ${unknownRoles[0]}`);
    for (const key of ["workhorses", "reviewers"]) {
      if (Object.hasOwn(roles, key)) roles[key] = nameList(roles[key], `${label}.roles.${key}`);
    }
    if (Object.hasOwn(roles, "coachman")) {
      const coachman = nonblankString(roles.coachman, `${label}.roles.coachman`);
      if (coachman !== "coachman" && coachman !== "coachman_fallback") {
        fail(`${label}.roles.coachman must name coachman or coachman_fallback`);
      }
      roles.coachman = coachman;
    }
    if (Object.hasOwn(roles, "lens_reviewers")) {
      const lenses = asTable(roles.lens_reviewers, `${label}.roles.lens_reviewers`);
      const allowedLenses = new Set(["style", "bug", "security"]);
      for (const [lens, lensNames] of Object.entries(lenses)) {
        if (!allowedLenses.has(lens)) {
          fail(`${label}.roles.lens_reviewers names an unknown lens: ${lens}`);
        }
        lenses[lens] = nameList(lensNames, `${label}.roles.lens_reviewers.${lens}`);
      }
    }
  }
  return data;
};

// --- profiles -----------------------------------------------------------------------------------
const loadProfiles = (
  repo: string,
): { shared: Rec; local: Rec; hasShared: boolean; hasLocal: boolean } => {
  const d = settingsDir(repo);
  const shared = readToml(join(d, "project.toml"), "shared project settings");
  const local = readToml(join(d, "settings.toml"), "local project settings");
  validateCommon(shared.data, "shared project settings", false);
  validateCommon(local.data, "local project settings", true);
  return {
    shared: shared.data,
    local: local.data,
    hasShared: shared.present,
    hasLocal: local.present,
  };
};

const mergedProfile = (shared: Rec, local: Rec, hasShared: boolean, hasLocal: boolean): Rec => {
  const out: Rec = {
    shared_present: hasShared,
    local_present: hasLocal,
    project: {},
    tracker: {},
    roles: {},
    sources: {},
  };
  const project = out.project as Rec;
  const tracker = out.tracker as Rec;
  const sources = out.sources as Rec;
  const sharedProject = asTable(Object.hasOwn(shared, "project") ? shared.project : {}, "project");
  const localProject = asTable(Object.hasOwn(local, "project") ? local.project : {}, "project");
  for (const field of ["default_turnpikes", "risk_surfaces"]) {
    if (Object.hasOwn(sharedProject, field)) {
      project[field] = sharedProject[field];
      sources[`project.${field}`] = "shared";
    }
    if (Object.hasOwn(localProject, field)) {
      project[field] = localProject[field];
      sources[`project.${field}`] = "local";
    }
    if (!Object.hasOwn(project, field)) sources[`project.${field}`] = "discovery";
  }
  const sharedTracker = asTable(Object.hasOwn(shared, "tracker") ? shared.tracker : {}, "tracker");
  const localTracker = asTable(Object.hasOwn(local, "tracker") ? local.tracker : {}, "tracker");
  if (Object.hasOwn(sharedTracker, "binding")) {
    tracker.binding = sharedTracker.binding;
    sources["tracker.binding"] = "shared";
  }
  if (Object.hasOwn(localTracker, "binding")) {
    tracker.binding = localTracker.binding;
    sources["tracker.binding"] = "local";
  }
  if (!Object.hasOwn(tracker, "binding")) sources["tracker.binding"] = "discovery";
  const roles = asTable(Object.hasOwn(local, "roles") ? local.roles : {}, "roles");
  out.roles = roles;
  sources.roles = Object.keys(roles).length > 0 ? "local" : "machine";
  return out;
};

const loadMachine = (path: string): Rec => {
  if (path === "-") {
    try {
      return asTable(JSON.parse(strictStdin()), "machine config");
    } catch (e) {
      if (isDie(e)) throw e;
      return fail(`machine config JSON does not parse: ${errText(e)}`);
    }
  }
  let raw: string;
  try {
    raw = strictRead(expandUser(path));
  } catch (e) {
    return fail(`machine config ${path} does not parse: ${errText(e)}`);
  }
  return asTable(parseTomlStrict(raw, `machine config ${path}`), "machine config");
};

const effectiveConfig = (repo: string, machine: Rec, pair?: { shared: Rec; local: Rec }): Rec => {
  const cfg = asTable(deepCopy(machine), "machine config");
  let shared: Rec;
  let local: Rec;
  let hs: boolean;
  let hl: boolean;
  if (pair === undefined) {
    ({ shared, local, hasShared: hs, hasLocal: hl } = loadProfiles(repo));
  } else {
    ({ shared, local } = pair);
    hs = Object.keys(shared).length > 0;
    hl = Object.keys(local).length > 0;
  }
  const profile = mergedProfile(shared, local, hs, hl);
  const roles = asTable(profile.roles, "roles");
  if (Object.keys(roles).length === 0) return cfg;
  const lanes = asTable(Object.hasOwn(cfg, "lanes") ? cfg.lanes : {}, "machine config [lanes]");
  if (!Object.hasOwn(cfg, "team")) cfg.team = {};
  const team = asTable(cfg.team, "machine config [team]");
  for (const key of ["workhorses", "reviewers"]) {
    if (Object.hasOwn(roles, key)) {
      const names = roles[key] as string[];
      const unknown = names.filter((n) => !Object.hasOwn(lanes, n));
      if (unknown.length > 0)
        fail(`local roles.${key} names ${unknown[0]}, which is not a machine lane`);
      team[key] = names;
    }
  }
  if (Object.hasOwn(roles, "coachman")) {
    const source = roles.coachman as string;
    const coachman = Object.hasOwn(team, source) ? team[source] : undefined;
    if (!isRec(coachman) || !pyTruthy(coachman.harness) || !pyTruthy(coachman.model)) {
      fail(`local roles.coachman selects ${source}, but the machine config does not define it`);
    }
    team.coachman = coachman;
  }
  if (Object.hasOwn(roles, "lens_reviewers")) {
    const own = asTable(
      Object.hasOwn(team, "lens_reviewers") ? team.lens_reviewers : {},
      "machine config [team.lens_reviewers]",
    );
    for (const [lens, lensNames] of Object.entries(roles.lens_reviewers as Rec)) {
      const names = lensNames as string[];
      const unknown = names.filter((n) => !Object.hasOwn(lanes, n));
      if (unknown.length > 0) {
        fail(`local roles.lens_reviewers.${lens} names ${unknown[0]}, which is not a machine lane`);
      }
      own[lens] = names;
    }
    team.lens_reviewers = own;
  }
  return cfg;
};

// --- commands -------------------------------------------------------------------------------------
const inspect = (repo: string): Rec => {
  const { shared, local, hasShared, hasLocal } = loadProfiles(repo);
  const profile = mergedProfile(shared, local, hasShared, hasLocal);
  profile.shared_file = hasShared ? ".postmaster/project.toml" : null;
  profile.local_file = hasLocal ? ".postmaster/settings.toml" : null;
  return profile;
};

const report = (repo: string): void => {
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

const ensureIgnore = (repo: string, quiet = false): void => {
  const d = settingsDir(repo);
  mkdirSync(d, { recursive: true });
  const ignore = join(d, ".gitignore");
  if (isSymlink(ignore)) fail(`${ignore} must not be a symlink`);
  if (existsSync(ignore) && !isFile(ignore)) fail(`${ignore} is not a regular file`);
  const existing = existsSync(ignore) ? strictRead(ignore) : "";
  // A bare star anywhere is not enough: a later negation (!settings.toml) re-includes
  // what it ignored. The last effective rule decides, so it must be the star.
  const effective = pySplitLines(existing)
    .map((line) => pyTrim(line))
    .filter((line) => line !== "" && !line.startsWith("#"));
  if (effective.length === 0 || effective[effective.length - 1] !== "*") {
    let prefix = existing;
    if (prefix !== "" && !prefix.endsWith("\n")) prefix += "\n";
    if (prefix === "") {
      prefix =
        "# .postmaster/ holds this instance's settings and every run's full record.\n" +
        "# Nothing in it is committed by default. To share what a run requires of\n" +
        "# everyone, commit project.toml alone with: git add -f .postmaster/project.toml\n";
    }
    writeFileSync(ignore, `${prefix}*\n`);
  }
  if (!quiet) console.log(`project-settings: ensured ${ignore}`);
};

const writeProfile = (repo: string, layer: string, source: string): void => {
  if (layer !== "project" && layer !== "local") fail("write layer must be project or local");
  const d = settingsDir(repo);
  const name = layer === "project" ? "project.toml" : "settings.toml";
  const dest = join(d, name);
  if (isSymlink(dest)) fail(`${dest} must not be a symlink`);
  let raw: string;
  try {
    raw = source === "-" ? strictStdin() : strictRead(expandUser(source));
  } catch (e) {
    if (isDie(e)) throw e;
    fail(`cannot read settings input: ${errText(e)}`);
  }
  const candidate = asTable(parseTomlStrict(raw, "settings input"), "settings input");
  scanMachineData(candidate, "settings input", []);
  validateCommon(candidate, "settings input", layer === "local");
  // Validate the complete resulting pair before changing either file.
  const { shared: oldShared, local: oldLocal } = loadProfiles(repo);
  const nextShared = layer === "project" ? candidate : oldShared;
  const nextLocal = layer === "local" ? candidate : oldLocal;
  validateCommon(nextShared, "shared project settings", false);
  validateCommon(nextLocal, "local project settings", true);
  const nextRoles = Object.hasOwn(nextLocal, "roles") ? nextLocal.roles : {};
  if (isRec(nextRoles) && Object.keys(nextRoles).length > 0) {
    const configPath = expandUser(
      process.env.POSTMASTER_CONFIG ?? join(homedir(), ".postmaster/config.toml"),
    );
    if (!isFile(configPath))
      fail(`local role assignments need the machine config at ${configPath}`);
    effectiveConfig(repo, loadMachine(configPath), { shared: nextShared, local: nextLocal });
  }
  mkdirSync(d, { recursive: true });
  ensureIgnore(repo, true);
  if (existsSync(dest) && !isFile(dest)) fail(`${dest} is not a regular file`);
  const tmpName = mkstempSync(d, `.${name}.`);
  try {
    const text = raw.endsWith("\n") ? raw : `${raw}\n`;
    const fd = openSync(tmpName, "w");
    try {
      writeSync(fd, text);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmpName, dest);
  } catch (e) {
    try {
      unlinkSync(tmpName);
    } catch {
      // The rename already failed; a leftover temp file is not the error to report.
    }
    throw e;
  }
  console.log(`project-settings: wrote ${dest}`);
};

// --- entry ----------------------------------------------------------------------------------------
const main = (): void => {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && argv[0] === "--self-test") {
    selfTest();
    return;
  }
  if (argv.length === 0) fail(USAGE);
  const cmd = argv[0]!;
  const rest = argv.slice(1);
  if (cmd === "ensure" && rest.length === 1) {
    ensureIgnore(projectRoot(rest[0]!));
  } else if ((cmd === "inspect" || cmd === "report") && rest.length === 1) {
    const repo = projectRoot(rest[0]!);
    if (cmd === "report") report(repo);
    else console.log(sortedJson(inspect(repo)));
  } else if (cmd === "effective" && (rest.length === 1 || rest.length === 2)) {
    const repo = projectRoot(rest[0]!);
    const configPath =
      rest.length === 2
        ? rest[1]!
        : (process.env.POSTMASTER_CONFIG ?? join(homedir(), ".postmaster/config.toml"));
    console.log(sortedJson(effectiveConfig(repo, loadMachine(configPath))));
  } else if (cmd === "write" && (rest.length === 2 || rest.length === 3)) {
    writeProfile(projectRoot(rest[0]!), rest[1]!, rest.length === 3 ? rest[2]! : "-");
  } else {
    fail(USAGE);
  }
};

// --- self-test --------------------------------------------------------------------------------------
const SELF = join(HERE, "project-settings.sh");
const VERIFY = join(HERE, "verify.sh");

const selfTest = (): void => {
  withTempDir((tmp) => {
    const st = new SelfTest();
    const at = (name: string): string => join(tmp, name);
    const write = (path: string, text: string): void => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    };
    const mustDie = (label: string, fn: () => void): void => {
      try {
        fn();
      } catch (e) {
        if (isDie(e)) {
          st.ok(label);
          return;
        }
        throw e;
      }
      st.fail(label, "accepted but must refuse");
    };
    const mustPass = (label: string, fn: () => void): void => {
      try {
        fn();
      } catch (e) {
        if (isDie(e)) {
          st.fail(label, e.message);
          return;
        }
        throw e;
      }
      st.ok(label);
    };

    const repo = at("repo");
    mkdirSync(repo, { recursive: true });
    const machine = at("config.toml");
    write(
      machine,
      '[lanes.alpha]\nharness="codex"\nmodel="a"\n[lanes.beta]\nharness="claude"\nmodel="b"\n[team]\nworkhorses=["alpha","beta"]\nreviewers=["alpha","beta"]\ncoachman={harness="grok",model="coach"}\ncoachman_fallback={harness="pi",model="backup"}\n',
    );
    process.env.POSTMASTER_CONFIG = machine;
    const missing = inspect(repo);
    st.check(
      "missing profiles are normal and retain discovery defaults",
      missing.shared_present === false &&
        missing.local_present === false &&
        (missing.sources as Rec)["project.default_turnpikes"] === "discovery",
    );
    const shadow = at("shadow");
    write(join(shadow, "json", "__init__.py"), 'raise SystemExit("target module imported")\n');
    const isolated = run("timeout", ["10", SELF, "inspect", shadow], { cwd: shadow });
    st.check(
      "project modules cannot shadow the settings reader's standard library imports",
      isolated.code === 0,
      `target modules were imported: ${isolated.err}`,
    );
    ensureIgnore(repo);
    st.check(
      "ensure creates the folder ignore without prompting for settings",
      readFileSync(join(repo, ".postmaster", ".gitignore"), "utf8").endsWith("*\n") &&
        !existsSync(join(repo, ".postmaster", "settings.toml")),
    );
    write(join(repo, ".postmaster", ".gitignore"), "# existing local rules\n!keep-me\n");
    ensureIgnore(repo);
    const kept = readFileSync(join(repo, ".postmaster", ".gitignore"), "utf8");
    st.check(
      "ensure completes an existing ignore file without discarding its rules",
      kept.startsWith("# existing local rules\n") && kept.endsWith("*\n"),
    );
    const negated = at("negated");
    mkdirSync(negated, { recursive: true });
    ensureIgnore(negated);
    write(join(negated, ".postmaster", ".gitignore"), "*\n!settings.toml\n");
    ensureIgnore(negated);
    const repaired = readFileSync(join(negated, ".postmaster", ".gitignore"), "utf8");
    const negInit = run("git", ["init", "-q", negated]);
    const negIgnore1 = run("git", [
      "-C",
      negated,
      "check-ignore",
      "-q",
      ".postmaster/settings.toml",
    ]);
    const negIgnore2 = run("git", [
      "-C",
      negated,
      "check-ignore",
      "-q",
      ".postmaster/runs/T-1/card.md",
    ]);
    st.check(
      "ensure re-ignores a folder a negation had re-included, keeping its rules",
      repaired.endsWith("*\n") &&
        repaired.includes("!settings.toml\n") &&
        negInit.code === 0 &&
        negIgnore1.code === 0 &&
        negIgnore2.code === 0,
    );
    write(join(negated, ".postmaster", ".gitignore"), "*\n!runs/\n!runs/**\n");
    ensureIgnore(negated);
    const negIgnore3 = run("git", [
      "-C",
      negated,
      "check-ignore",
      "-q",
      ".postmaster/runs/T-1/card.md",
    ]);
    st.check("ensure re-ignores run artifacts a negation had re-included", negIgnore3.code === 0);
    const before = readFileSync(join(negated, ".postmaster", ".gitignore"), "utf8");
    ensureIgnore(negated);
    st.check(
      "ensure is a no-op once the last rule is the star",
      readFileSync(join(negated, ".postmaster", ".gitignore"), "utf8") === before,
    );
    const candidate = at("shared.toml");
    write(
      candidate,
      '[project]\ndefault_turnpikes=["bug"]\nrisk_surfaces="the API and subprocess boundary"\n[tracker]\nbinding="Team board"\n',
    );
    writeProfile(repo, "project", candidate);
    const shared = inspect(repo);
    const guarded = run("timeout", ["10", SELF, "inspect", repo], {
      env: { POSTMASTER_PROJECT: repo },
    });
    st.check(
      "inspect stays bounded when POSTMASTER_PROJECT is inherited",
      guarded.code === 0,
      `inspect recursed or failed with POSTMASTER_PROJECT set: ${guarded.err}`,
    );
    const repoInit = run("git", ["init", "-q", repo]);
    const sharedIgnored = run("git", ["-C", repo, "check-ignore", ".postmaster/project.toml"]);
    const postmaster = join(repo, ".postmaster");
    write(join(postmaster, "settings.toml"), "[roles]\nworkhorses=['alpha']\n");
    mkdirSync(join(postmaster, "runs", "T-1"), { recursive: true });
    write(join(postmaster, "runs", "T-1", "card.md"), "private run text\n");
    const localIgnored = run("git", ["-C", repo, "check-ignore", ".postmaster/settings.toml"]);
    const runIgnored = run("git", ["-C", repo, "check-ignore", ".postmaster/runs/T-1/card.md"]);
    st.check(
      "the shared file writes, and .postmaster ignores it by default",
      shared.shared_present === true &&
        JSON.stringify((shared.project as Rec).default_turnpikes) === '["bug"]' &&
        (shared.sources as Rec)["project.default_turnpikes"] === "shared" &&
        readFileSync(join(postmaster, ".gitignore"), "utf8").endsWith("*\n") &&
        repoInit.code === 0 &&
        sharedIgnored.code === 0 &&
        localIgnored.code === 0 &&
        runIgnored.code === 0,
    );
    const emptyRepo = at("empty-default");
    mkdirSync(emptyRepo, { recursive: true });
    const emptySettings = at("empty-default.toml");
    write(emptySettings, "[project]\ndefault_turnpikes = []\n");
    writeProfile(emptyRepo, "project", emptySettings);
    st.check(
      "a project may define an empty default turnpike set",
      JSON.stringify((inspect(emptyRepo).project as Rec).default_turnpikes) === "[]",
    );
    const local = at("local.toml");
    write(
      local,
      '[project]\ndefault_turnpikes=["style"]\n[roles]\nworkhorses=["alpha","beta"]\ncoachman="coachman_fallback"\n',
    );
    writeProfile(repo, "local", local);
    const result = inspect(repo);
    const effective = effectiveConfig(repo, loadMachine(machine));
    const team = effective.team as Rec;
    st.check(
      "local choices override shared defaults and select machine-defined roles",
      (result.sources as Rec)["project.default_turnpikes"] === "local" &&
        (result.sources as Rec).roles === "local" &&
        ((team.coachman as Rec).model as string) === "backup" &&
        JSON.stringify(team.workhorses) === '["alpha","beta"]' &&
        (!Object.hasOwn(team, "postmaster") || pyTruthy(team.postmaster)),
    );
    const rejects: Array<[string, string]> = [
      ["shared roles", '[roles]\nworkhorses=["alpha"]\n'],
      ["home path in a binding", '[tracker]\nbinding="~/.config/key"\n'],
      ["absolute path in a binding", '[tracker]\nbinding="/srv/boards/main"\n'],
      ["credential field", '[tracker]\nenv_file="credential.env"\n'],
      ["key file field", '[tracker]\nkeyfile="my.key"\n'],
      ["unknown role", '[roles]\nworkhorses=["ghost"]\n'],
      ["slash in a binding", '[tracker]\nbinding="user/board"\n'],
      ["backslash in a binding", "[tracker]\nbinding='C:\\boards\\x'\n"],
      ["URL in a binding", '[tracker]\nbinding="https://example.com/b"\n'],
      ["scheme in a binding", '[tracker]\nbinding="file:boards"\n'],
      ["colon-no-space in a binding", '[tracker]\nbinding="Team:Board"\n'],
      ["leading tilde in a binding", '[tracker]\nbinding="~other"\n'],
      ["leading dollar in a binding", '[tracker]\nbinding="$FOO"\n'],
      ["parent traversal in a binding", '[tracker]\nbinding=".."\n'],
      ["lowercase credential name", '[tracker]\nbinding="github_token"\n'],
      ["credential word with a dash", '[tracker]\nbinding="my-secret"\n'],
      ["keyword-initial credential name", '[tracker]\nbinding="TOKEN"\n'],
      ["bare credential words", '[tracker]\nbinding="API_KEY"\n'],
      ["all-caps credential token", '[tracker]\nbinding="MY_TOKEN"\n'],
      ["lowercase snake key", '[tracker]\nbinding="api_key"\n'],
      ["lowercase kebab key", '[tracker]\nbinding="api-key"\n'],
      ["bare lowercase key", '[tracker]\nbinding="apikey"\n'],
      ["mixed-case snake key", '[tracker]\nbinding="Api_Key"\n'],
      ["bare auth token", '[tracker]\nbinding="authtoken"\n'],
      ["bare access token", '[tracker]\nbinding="accesstoken"\n'],
      ["key file as value", '[tracker]\nbinding="keyfile"\n'],
      ["snake key file as value", '[tracker]\nbinding="key_file"\n'],
      ["kebab key file as value", '[tracker]\nbinding="key-file"\n'],
      ["caps key file as value", '[tracker]\nbinding="KEYFILE"\n'],
      ["env file as value", '[tracker]\nbinding="env_file"\n'],
      ["bare env file as value", '[tracker]\nbinding="envfile"\n'],
      ["kebab env file as value", '[tracker]\nbinding="env-file"\n'],
      ["bare private key", '[tracker]\nbinding="privatekey"\n'],
      ["snake private key", '[tracker]\nbinding="private_key"\n'],
      ["kebab private key", '[tracker]\nbinding="private-key"\n'],
      ["kebab access key", '[tracker]\nbinding="access-key"\n'],
      ["snake access key", '[tracker]\nbinding="access_key"\n'],
      ["bare password", '[tracker]\nbinding="password"\n'],
      ["bare secret", '[tracker]\nbinding="secret"\n'],
      ["bare token", '[tracker]\nbinding="token"\n'],
      ["bare credentials", '[tracker]\nbinding="credentials"\n'],
      ["bare caps secret", '[tracker]\nbinding="SECRET"\n'],
      ["single titlecase secret", '[tracker]\nbinding="Secret"\n'],
      ["camelCase api key", '[tracker]\nbinding="githubApiKey"\n'],
      ["camelCase token", '[tracker]\nbinding="accessToken"\n'],
      ["camelCase continuation", '[tracker]\nbinding="secretKey"\n'],
      ["camelCase sandwich", '[tracker]\nbinding="mySecretKey"\n'],
      ["credential value word", '[tracker]\nbinding="secretValue"\n'],
      ["token value word", '[tracker]\nbinding="tokenValue"\n'],
      ["password hash word", '[tracker]\nbinding="passwordHash"\n'],
      ["credential name word", '[tracker]\nbinding="credentialName"\n'],
      ["token value sandwich", '[tracker]\nbinding="authTokenValue"\n'],
      ["identifier word in phrasing", '[tracker]\nbinding="Migrate api_key usage"\n'],
      ["caps word in phrasing", '[tracker]\nbinding="The TOKEN is here"\n'],
      ["padded credential name", '[tracker]\nbinding="  api_key  "\n'],
      ["credential word in a role name", '[roles]\nworkhorses=["API_KEY"]\n'],
      ["classic token value", '[tracker]\nbinding="ghp_12345678901234567890"\n'],
      ["short classic token value", '[tracker]\nbinding="ghp_12345678"\n'],
      ["fine-grained token value", '[tracker]\nbinding="github_pat_ABCDEFGHIJKL"\n'],
      ["gitlab token value", '[tracker]\nbinding="glpat-ABCDEFGHIJKL"\n'],
      ["chat token value", '[tracker]\nbinding="xoxc-123456789012"\n'],
      ["key-like token value", '[tracker]\nbinding="sk-1234567890123456"\n'],
      ["credential assignment", '[tracker]\nbinding="X_API_KEY=abc123"\n'],
      ["lowercase credential assignment", '[tracker]\nbinding="password = hunter2"\n'],
      ["private key block", '[tracker]\nbinding="-----BEGIN PRIVATE KEY-----"\n'],
    ];
    for (const [label, contents] of rejects) {
      const bad = at("bad.toml");
      write(bad, contents);
      mustDie(`rejects ${label}`, () => {
        if (label === "shared roles") {
          validateCommon(
            asTable(parseTomlText(contents), "shared"),
            "shared project settings",
            false,
          );
        } else if (label !== "unknown role") {
          const parsed = asTable(parseTomlText(contents), "settings input");
          scanMachineData(parsed, "settings input", []);
          validateCommon(
            asTable(parseTomlText(contents), "settings input"),
            "settings input",
            true,
          );
        } else {
          writeProfile(repo, "local", bad);
          effectiveConfig(repo, loadMachine(machine));
        }
      });
    }
    const accepts: Array<[string, string, boolean]> = [
      ["risk prose naming a path", '[project]\nrisk_surfaces="reads /home/alex/secret"\n', true],
      [
        "risk prose naming a secret",
        '[project]\nrisk_surfaces="reads PLANE_API_KEY and lane env files"\n',
        true,
      ],
      [
        "risk prose naming a machine",
        '[project]\nrisk_surfaces="runs on build-01 beside //server/share"\n',
        true,
      ],
      [
        "a check command with paths",
        '[checks.x]\ncommand="cat /tmp/out $HOME/f"\nshows="y"\n',
        false,
      ],
      ["a check named secret-scan", '[checks.secret-scan]\ncommand="true"\nshows="s"\n', false],
      ["a plain board name", '[tracker]\nbinding="Team board"\n', true],
      ["an ampersand board name", '[tracker]\nbinding="Platform & DevEx"\n', true],
      ["a comma board name", '[tracker]\nbinding="Team, Platform"\n', true],
      [
        "the documented example binding",
        '[tracker]\nbinding="the board, workspace or team name"\n',
        true,
      ],
      [
        "the documented local binding",
        '[tracker]\nbinding="the board, workspace or team name for this checkout"\n',
        true,
      ],
      ["a dotted board name", '[tracker]\nbinding="Board_1.v2"\n', true],
      ["a colon-space board name", '[tracker]\nbinding="Team: Board"\n', true],
      ["a natural secret word", '[tracker]\nbinding="Secret Santa"\n', true],
      ["a natural token word", '[tracker]\nbinding="Password reset project"\n', true],
      ["a glued lowercase word", '[tracker]\nbinding="secretary"\n', true],
      ["a glued lowercase credential", '[tracker]\nbinding="mysecret"\n', true],
      ["a keyword-prefixed natural word", '[tracker]\nbinding="Tokenomics review"\n', true],
      ["a token prefix too short to be a token", '[tracker]\nbinding="ghp_abc"\n', true],
      ["an assignment without a credential word", '[tracker]\nbinding="a=b"\n', true],
    ];
    for (const [label, contents, localSettings] of accepts) {
      mustPass(`accepts ${label}`, () => {
        const parsed = asTable(parseTomlText(contents), "settings input");
        scanMachineData(parsed, "settings input", []);
        validateCommon(
          asTable(parseTomlText(contents), "settings input"),
          "settings input",
          localSettings,
        );
      });
    }
    const badShapes: Array<[string, string]> = [
      ["unknown key", '[checks.x]\ncommand = "true"\nshows = "s"\nunknown = 1\n'],
      ["command and use", '[checks.x]\ncommand = "true"\nuse = "cli-examples"\nshows = "s"\n'],
      ["neither command nor use", '[checks.x]\nshows = "s"\n'],
      ["command without shows", '[checks.x]\ncommand = "true"\n'],
      ["score without threshold", '[checks.x]\ncommand = "true"\nshows = "s"\nscore = "(x)"\n'],
      ["threshold without score", '[checks.x]\ncommand = "true"\nshows = "s"\nthreshold = 1\n'],
      [
        "score with two groups",
        '[checks.x]\ncommand = "true"\nshows = "s"\nscore = "(a)(b)"\nthreshold = 1\n',
      ],
      [
        "score that is not a regex",
        '[checks.x]\ncommand = "true"\nshows = "s"\nscore = "(a"\nthreshold = 1\n',
      ],
      [
        "string threshold",
        '[checks.x]\ncommand = "true"\nshows = "s"\nscore = "(x)"\nthreshold = "high"\n',
      ],
      ["zero timeout", '[checks.x]\ncommand = "true"\nshows = "s"\ntimeout = 0\n'],
      ["boolean timeout", '[checks.x]\ncommand = "true"\nshows = "s"\ntimeout = true\n'],
      ["unknown default", '[checks.x]\nuse = "nope"\n'],
      ["gate with use", '[checks.gate]\nuse = "cli-examples"\n'],
      ["score with use", '[checks.x]\nuse = "cli-examples"\nscore = "(x)"\nthreshold = 1\n'],
      ["blank shows", '[checks.x]\ncommand = "true"\nshows = ""\n'],
      ["blank command", '[checks.x]\ncommand = "  "\nshows = "s"\n'],
      ["non-lowercase name", '[checks.Bad]\ncommand = "true"\nshows = "s"\n'],
    ];
    badShapes.forEach(([label, contents], i) => {
      const shapeRepo = at(`bad-shape-${i}`);
      mkdirSync(shapeRepo, { recursive: true });
      const shapeIn = at(`bad-shape-${i}.toml`);
      write(shapeIn, contents);
      let writeRefused = false;
      try {
        writeProfile(shapeRepo, "project", shapeIn);
      } catch (e) {
        if (isDie(e)) writeRefused = true;
        else throw e;
      }
      const planted = join(shapeRepo, ".postmaster", "project.toml");
      write(planted, contents);
      const checked = run("timeout", ["10", VERIFY, "checks", shapeRepo]);
      st.check(
        `write and verify.sh agree in refusing ${label}`,
        writeRefused && checked.code !== 0,
        `accepted bad check shape: ${label}`,
      );
    });
    const goodShapes: Array<[string, string]> = [
      [
        "command with shows and timeout",
        '[checks.x]\ncommand = "true"\nshows = "s"\ntimeout = 60\n',
      ],
      [
        "scored command",
        '[checks.x]\ncommand = "true"\nshows = "s"\nscore = "(x)"\nthreshold = 0.5\n',
      ],
      ["bare default", '[checks.x]\nuse = "cli-examples"\n'],
      [
        "default with shows and timeout",
        '[checks.x]\nuse = "library-tests"\nshows = "s"\ntimeout = 60\n',
      ],
      ["gate command", '[checks.gate]\ncommand = "true"\nshows = "s"\n'],
    ];
    goodShapes.forEach(([label, contents], i) => {
      const shapeRepo = at(`good-shape-${i}`);
      mkdirSync(shapeRepo, { recursive: true });
      const shapeIn = at(`good-shape-${i}.toml`);
      write(shapeIn, contents);
      let writeError: string | null = null;
      try {
        writeProfile(shapeRepo, "project", shapeIn);
      } catch (e) {
        if (isDie(e)) writeError = e.message;
        else throw e;
      }
      const checked = run("timeout", ["10", VERIFY, "checks", shapeRepo]);
      st.check(
        `write and verify.sh agree in accepting ${label}`,
        writeError === null && checked.code === 0,
        writeError ?? `verify.sh refused ${label}: ${checked.err}`,
      );
    });
    mustPass("this repo's own committed profile validates", () => {
      inspect(join(HERE, ".."));
    });
    st.finish();
  }, "project-settings-test-");
};

try {
  main();
} catch (e) {
  if (isDie(e)) {
    console.error(`project-settings: ${e.message}`);
    process.exit(1);
  }
  throw e;
}
