// Acceptance oracle for #233: the gate refuses the any type, and the tree carries no
// use of it apart from a few reasoned suppressions. Pure file reads plus the gate's own
// lint command, run as a user runs it; nothing here imports the change's own modules.
//
//   run no-explicit-any-acceptance [repo-root]   default: the repo this script lives in
//
//   exit 0  the rule is on, the gate refuses a planted probe, no use remains, and at
//           most five reasoned suppressions stand
//   exit 1  findings, one per line on stdout: <file>: <what fails>
//   exit 2  usage, an unreadable tree, a probe left behind, or a lint run that never started
//
// The beside-script test fails on a tree that still carries the old shape, at its
// live-tree step; that failure is the control proving the checks bite on the real
// files, not only fixtures.
import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { toolRoot } from "./lib/paths.ts";

export interface AcceptResult {
  code: number;
  out: string;
  err: string;
}

export interface RunResult {
  code: number;
  out: string;
  err: string;
  ran: boolean;
}

export type Runner = (cmd: string[], cwd: string) => RunResult;

const RULE = "typescript/no-explicit-any";
const PROBE_REL = "scripts/zz-probe.ts";
const PROBE_SRC = "export const z = (x: any): number => x;\n";
const MAX_SUPPRESS = 5;
const WANT_IGNORE = '["fixtures/**"]';
// The matcher is built from the constant so this file holds no line the walk below
// would count: the literal rule name and the comment form never share one.
const SUPPRESS = new RegExp(`(oxlint|eslint)-disable.*${RULE}`, "u");

/** Spawn through node. `ran` is false when the command never started or never exited. */
export function spawnRunner(cmd: string[], cwd: string): RunResult {
  const name = cmd[0] ?? "(empty)";
  let r: SpawnSyncReturns<string>;
  try {
    r = spawnSync(cmd[0] ?? "", cmd.slice(1), {
      cwd,
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (e) {
    return { code: 127, out: "", err: `${name}: did not start: ${String(e)}\n`, ran: false };
  }
  if (typeof r.status !== "number") {
    const how = r.signal === null ? "never exited" : `died on ${r.signal}`;
    return { code: 127, out: "", err: `${name}: ${how}\n`, ran: false };
  }
  return { code: r.status, out: r.stdout, err: r.stderr, ran: true };
}

function readJson(path: string): { ok: true; value: unknown } | { ok: false } {
  try {
    // JSON.parse returns any; the assertion keeps the value unknown-typed.
    return { ok: true, value: JSON.parse(readFileSync(path, "utf8")) as unknown };
  } catch {
    return { ok: false };
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The rule's setting and the config's shape, from the parsed .oxlintrc.json. */
function lintConfigFindings(value: unknown): string[] {
  if (!isRecord(value)) return [".oxlintrc.json: want an object at the top"];
  const out: string[] = [];
  const rules: unknown = value["rules"];
  if (!isRecord(rules)) {
    out.push(".oxlintrc.json: want a rules object");
  } else {
    const setting: unknown = rules[RULE];
    if (setting !== "error" && setting !== 2) {
      out.push(`.oxlintrc.json: ${RULE} is ${JSON.stringify(setting) ?? "missing"}, want "error"`);
    }
  }
  const raw: unknown = value["overrides"];
  if (raw !== undefined) {
    if (!Array.isArray(raw)) {
      out.push(".oxlintrc.json: overrides is not an array");
    } else {
      const entries: unknown[] = raw;
      for (let i = 0; i < entries.length; i++) {
        const entry: unknown = entries[i];
        if (!isRecord(entry)) {
          out.push(`.oxlintrc.json: overrides[${i}] is not an object`);
          continue;
        }
        const erules: unknown = entry["rules"];
        if (erules === undefined) continue;
        if (!isRecord(erules)) {
          out.push(`.oxlintrc.json: overrides[${i}].rules is not an object`);
          continue;
        }
        const setting: unknown = erules[RULE];
        if (setting === "off" || setting === 0) {
          out.push(`.oxlintrc.json: overrides[${i}] turns ${RULE} off`);
        }
      }
    }
  }
  const ignore: unknown = value["ignorePatterns"];
  if (JSON.stringify(ignore) !== WANT_IGNORE) {
    out.push(`.oxlintrc.json: ignorePatterns is ${JSON.stringify(ignore) ?? "missing"}, want ${WANT_IGNORE}`);
  }
  return out;
}

/** The gate runs the linter as it is, with no flag that fails every warning. */
function gateFindings(value: unknown): string[] {
  if (!isRecord(value)) return ["package.json: want an object at the top"];
  const scripts: unknown = value["scripts"];
  if (!isRecord(scripts)) return ["package.json: want a scripts object"];
  const check: unknown = scripts["check"];
  if (typeof check !== "string") return ["package.json: no check script runs the linter"];
  if (!check.includes("oxlint")) return ["package.json: the check script does not run oxlint"];
  if (check.includes("--deny-warnings")) {
    return ["package.json: the check script fails on every warning, want only this rule to fail it"];
  }
  return [];
}

interface Hit {
  loc: string;
  reasoned: boolean;
}

/** Every suppression of the rule under one directory, symlinks and unreadable files aside. */
function walk(dir: string, root: string, hits: Hit[]): void {
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch {
    return;
  }
  for (const name of names) {
    const full = join(dir, name);
    try {
      const st = lstatSync(full);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        walk(full, root, hits);
        continue;
      }
      if (!st.isFile()) continue;
    } catch {
      continue;
    }
    let text: string;
    try {
      text = readFileSync(full, "utf8");
    } catch {
      continue;
    }
    for (const [i, line] of text.split("\n").entries()) {
      if (!SUPPRESS.test(line)) continue;
      const tail = line.slice(line.indexOf(RULE) + RULE.length);
      hits.push({ loc: `${relative(root, full)}:${i + 1}`, reasoned: / -- \S/u.test(tail) });
    }
  }
}

function suppressionFindings(hits: Hit[]): string[] {
  const out = hits.filter((h) => !h.reasoned).map((h) => `${h.loc}: suppression without ' -- <reason>'`);
  if (hits.length > MAX_SUPPRESS) {
    out.push(`${RULE}: ${hits.length} suppressions stand, at most ${MAX_SUPPRESS}`);
  }
  return out;
}

export function accept(root: string, run: Runner = spawnRunner): AcceptResult {
  const me = "no-explicit-any-acceptance";
  const findings: string[] = [];
  const cfg = readJson(join(root, ".oxlintrc.json"));
  if (!cfg.ok) return { code: 2, out: "", err: `${me}: cannot read ${join(root, ".oxlintrc.json")}\n` };
  findings.push(...lintConfigFindings(cfg.value));
  const pkg = readJson(join(root, "package.json"));
  if (!pkg.ok) return { code: 2, out: "", err: `${me}: cannot read ${join(root, "package.json")}\n` };
  findings.push(...gateFindings(pkg.value));
  const hits: Hit[] = [];
  for (const dir of ["scripts", "lint", "types"]) walk(join(root, dir), root, hits);
  hits.sort((a, b) => (a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0));
  findings.push(...suppressionFindings(hits));
  const counted = run(["bunx", "oxlint", "-A", "all", "-D", RULE, "-f", "unix"], root);
  if (!counted.ran) {
    return { code: 2, out: "", err: `${me}: the count run never started: ${counted.err}` };
  }
  const m = /(\d+) problems/u.exec(counted.out);
  const n = m === null ? -1 : Number(m[1]);
  if (counted.code !== 0 || n !== 0) {
    findings.push(`${RULE}: ${n < 0 ? "no count" : `${n} problems`} reported, want 0 problems`);
  }
  const probe = join(root, "scripts", "zz-probe.ts");
  if (existsSync(probe)) {
    return { code: 2, out: "", err: `${me}: ${PROBE_REL} already exists; remove it first\n` };
  }
  try {
    writeFileSync(probe, PROBE_SRC);
  } catch (e) {
    return { code: 2, out: "", err: `${me}: cannot plant the probe: ${String(e)}\n` };
  }
  const flagged = run(["bunx", "oxlint"], root);
  let leftover = false;
  try {
    rmSync(probe);
  } catch {
    leftover = true;
  }
  if (leftover) {
    return { code: 2, out: "", err: `${me}: the probe is left behind at ${PROBE_REL}; remove it\n` };
  }
  if (!flagged.ran) {
    return { code: 2, out: "", err: `${me}: the planted run never started: ${flagged.err}` };
  }
  if (flagged.code !== 1 || !flagged.out.includes(RULE) || !flagged.out.includes(`${PROBE_REL}:1`)) {
    findings.push(`probe: the gate exits ${flagged.code} on the planted file without naming ${RULE} at ${PROBE_REL}:1`);
  }
  const calm = run(["bunx", "oxlint"], root);
  if (!calm.ran) {
    return { code: 2, out: "", err: `${me}: the calm run never started: ${calm.err}` };
  }
  if (calm.code !== 0) {
    findings.push(`probe: the gate exits ${calm.code} without the probe, want 0`);
  }
  return { code: findings.length === 0 ? 0 : 1, out: findings.map((l) => `${l}\n`).join(""), err: "" };
}

function printAccept(r: AcceptResult): never {
  if (r.out) process.stdout.write(r.out);
  if (r.err) process.stderr.write(r.err);
  process.exit(r.code);
}

function usage(): never {
  console.error("usage: run no-explicit-any-acceptance [repo-root]");
  process.exit(2);
}

// --- entry ------------------------------------------------------------------------------
const ROOT = toolRoot(import.meta);
const argv = process.argv.slice(2);

if (import.meta.main) {
  if (argv.length > 1 || (argv.length === 1 && (argv[0] === "" || argv[0].startsWith("-")))) {
    usage();
  }
  printAccept(accept(argv[0] ?? ROOT));
}
