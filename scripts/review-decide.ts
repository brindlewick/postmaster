// Decide whether the review loop runs another round, from the round's finding and apply lines.
// The runbook calls this rather than counting findings itself.
//
//   review-decide.sh <dispatch> <round>
//   review-decide.sh --self-test
//
//   round    the round that just finished, a whole number from 1 to 3
//
// Reads <dispatch>/actions.jsonl. A finding is a `finding` line whose detail opens with its class,
// `gating` or `style`, then its severity (P1, P2 or P3), its round (r1, r2, ...) and the rest. An
// apply is an `apply` line whose detail names the finding targets it fixes, as whitespace-separated
// bare targets; it counts for round r when any target it names has a finding of round r. A target's
// latest finding line decides its severity, round and class, so a fix that does not verify closed,
// logged again in the round that checked it, is that round's. Only `gating` findings keep the loop
// going; a `style` finding never does.
//
// The rule (ticket #80, the user's of 2026-09-27): round 2 runs whenever round 1 applied a fix;
// after that, round r+1 runs only when round r logged a verified P1 or P2 finding. The cap of three
// rounds stays as a backstop: when round 3 logs a verified P1 or P2 finding the loop stops and
// escalates with the residue.
//
// Prints one decision line:
//   RUN <next>: <reason>
//   STOP <round>: <reason>
//   CAP 3: <reason>; escalate with residue
//
//   exit 0  the decision is printed
//   exit 1  usage, a round past 3 or below 1, a missing or unreadable action log, a line that is
//           not JSON or not an action object, an action object with no action, a finding whose
//           detail does not open with its class, a finding with no readable severity or round,
//           two findings sharing one target in one round, or an apply naming no target or a
//           target with no finding line
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scriptsDir } from "./lib/paths.ts";
import { run, withTempDir } from "./lib/proc.ts";
import { SelfTest } from "./lib/selftest.ts";
import { D_CLASS, digitValue, END_OF_STRING, pySplitLines, pyTrim, pyWords } from "./lib/text.ts";

const HERE = scriptsDir(import.meta);
const USAGE = "usage: review-decide.sh <dispatch> <round> | --self-test";

function die(msg: string): never {
  console.error(`review-decide: ${msg}`);
  process.exit(1);
  throw new Error("unreachable");
}

// Python str() of a parsed JSON value, for detail and target fields: the
// spellings scripts compare against. Objects keep JSON's spelling, where
// Python would print its repr; only malformed lines ever reach that, as do
// floats (1.0 prints "1" here, "1.0" there) and integers past 2^53.
function pyStr(value: unknown, missing: boolean): string {
  if (missing || typeof value === "string") return missing ? "" : (value as string);
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  const mark = pyFloatMark(value);
  if (mark !== null) return mark;
  return JSON.stringify(value) ?? "None";
}

// json.loads accepts bare NaN, Infinity and -Infinity (what json.dumps
// writes for them); JSON.parse rejects them. A first plain parse keeps the
// common path; the fallback quotes bare constants outside strings as float
// markers, and whatever still fails is not JSON in both languages. A real
// line that is exactly a marker object faults as not-an-object rather than
// missing its action; no log line is shaped that way.
const JSON_CONST_RE = /"(?:[^"\\\n]|\\.)*"|(-?Infinity|NaN)/gu;
const PY_FLOAT_MARK = "$pyfloat";
function tolerantParse(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    // fall through to the constants-tolerant parse
  }
  const marked = line.replace(JSON_CONST_RE, (m, c: string | undefined) =>
    c === undefined
      ? m
      : `{"${PY_FLOAT_MARK}":"${c === "NaN" ? "nan" : c === "Infinity" ? "inf" : "-inf"}"}`,
  );
  return JSON.parse(marked);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pyFloatMark(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== PY_FLOAT_MARK) return null;
  const tag = value[PY_FLOAT_MARK];
  return tag === "nan" || tag === "inf" || tag === "-inf" ? tag : null;
}

// Python int(s, 10): stripped, one sign, single underscores between digits,
// Unicode decimal digits. The normalized decimal spelling, or null where
// int() raises. Kept a string: huge rounds print in full, exactly as %d does.
const PY_INT_RE = new RegExp(`^([+-])?([${D_CLASS}](?:_?[${D_CLASS}])*)${END_OF_STRING}`, "u");
const UNDERSCORE_RE = /_/gu;
const LEADING_ZEROS_RE = /^0+/u;
function pyIntDigits(s: string): string | null {
  const m = PY_INT_RE.exec(pyTrim(s));
  if (!m) return null;
  let digits = digitValue(m[2]!.replace(UNDERSCORE_RE, "")).replace(LEADING_ZEROS_RE, "");
  if (digits === "") digits = "0";
  if (m[1] === "-" && digits !== "0") digits = `-${digits}`;
  return digits;
}

// Python str(OSError) for a failed read, as open().read() reports it.
function readErrorText(path: string, e: unknown): string {
  const code = (e as NodeJS.ErrnoException)?.code ?? "";
  const errno =
    code === "ENOENT"
      ? "[Errno 2] No such file or directory"
      : code === "EACCES"
        ? "[Errno 13] Permission denied"
        : code === "EISDIR"
          ? "[Errno 21] Is a directory"
          : code === "ENOTDIR"
            ? "[Errno 20] Not a directory"
            : code === "ELOOP"
              ? "[Errno 40] Too many levels of symbolic links"
              : null;
  if (errno !== null) return `${errno}: '${path}'`;
  return (e as Error)?.message ?? String(e);
}

function readActions(path: string): string[] {
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch (e) {
    die(`cannot read ${path}: ${readErrorText(path, e)}`);
  }
  try {
    // main opens utf-8 strict: undecodable bytes fail the read outright.
    return pySplitLines(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    die(`cannot read ${path}: not valid UTF-8`);
  }
}

// Python truthiness for parsed JSON: empty arrays and objects are falsy too.
function pyTruthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
  return Boolean(value);
}

const ROUND_RE = new RegExp(`^r([1-9][0-9]*)${END_OF_STRING}`, "u");

function decide(dispatch: string, roundS: string): void {
  const digits = pyIntDigits(roundS);
  if (digits === null) die(`round is a whole number from 1 to 3: ${roundS}`);
  if (digits !== "1" && digits !== "2" && digits !== "3") {
    die(`the loop has a cap of 3 rounds; round ${digits} is past it`);
  }
  const r = digits;
  const path = `${dispatch}/actions.jsonl`;
  const lines = readActions(path);

  const latest = new Map<string, { sev: string; rnd: string; cls: string }>();
  const roundsSeen = new Map<string, Set<string>>();
  const seenPairs = new Set<string>();
  const applies: Array<{ n: number; targets: string[] }> = [];
  const faults: string[] = [];
  lines.forEach((line, idx) => {
    const n = idx + 1;
    if (pyTrim(line) === "") return;
    let e: unknown;
    try {
      e = tolerantParse(line);
    } catch {
      faults.push(`actions.jsonl line ${n} is not JSON`);
      return;
    }
    if (!isRecord(e) || pyFloatMark(e) !== null) {
      faults.push(`actions.jsonl line ${n} is not an action object`);
      return;
    }
    const rec = e as Record<string, unknown>;
    const action = rec.action;
    if (!pyTruthy(action)) {
      faults.push(`actions.jsonl line ${n} has no action`);
      return;
    }
    if (action === "finding") {
      const words = pyWords(pyStr(rec.detail, !("detail" in rec)));
      if (words.length === 0 || (words[0] !== "gating" && words[0] !== "style")) {
        faults.push(
          `actions.jsonl line ${n}: a finding whose detail opens with ${words.length > 0 ? `"${words[0]}"` : "nothing"}, not gating or style`,
        );
        return;
      }
      const cls = words[0]!;
      const sev = words.length > 1 ? words[1]! : "";
      const rnd = words.length > 2 ? words[2]! : "";
      if (sev !== "P1" && sev !== "P2" && sev !== "P3") {
        faults.push(
          `actions.jsonl line ${n}: a finding with severity ${sev || "none"}, not P1, P2 or P3`,
        );
        return;
      }
      const m = ROUND_RE.exec(rnd);
      if (!m) {
        faults.push(`actions.jsonl line ${n}: a finding with round ${rnd || "none"}, not rN`);
        return;
      }
      // The round stays a digit string: rN has no leading zero, so string
      // equality is int equality, with no precision ceiling.
      const target = pyStr(rec.target, !("target" in rec));
      const rndN = m[1]!;
      // The round holds digits only, so the join splits deterministically.
      const pair = `${target}\0${rndN}`;
      if (seenPairs.has(pair)) {
        faults.push(
          `actions.jsonl line ${n}: a second finding for ${target} in round r${rndN}; ` +
            "two findings at one place take targets that differ",
        );
        return;
      }
      seenPairs.add(pair);
      let set = roundsSeen.get(target);
      if (!set) {
        set = new Set();
        roundsSeen.set(target, set);
      }
      set.add(rndN);
      latest.set(target, { sev, rnd: rndN, cls });
    } else if (action === "apply") {
      applies.push({ n, targets: pyWords(pyStr(rec.detail, !("detail" in rec))) });
    }
  });

  for (const { n, targets } of applies) {
    if (targets.length === 0) {
      faults.push(`actions.jsonl line ${n}: an apply naming no finding target`);
    }
    for (const t of targets) {
      if (!roundsSeen.has(t)) {
        faults.push(`actions.jsonl line ${n}: an apply naming ${t}, which has no finding line`);
      }
    }
  }
  if (faults.length > 0) die(faults.join("; "));

  const appliedIn = (roundNum: string): boolean =>
    applies.some(({ targets }) => targets.some((t) => roundsSeen.get(t)?.has(roundNum) ?? false));
  const hasP1P2 = (roundNum: string): boolean =>
    [...latest.values()].some(
      ({ sev, rnd, cls }) => rnd === roundNum && (sev === "P1" || sev === "P2") && cls === "gating",
    );

  if (r === "1") {
    console.log(
      appliedIn("1") ? "RUN 2: round 1 applied a fix" : "STOP 1: round 1 applied no fixes",
    );
  } else if (r === "2") {
    console.log(
      hasP1P2("2")
        ? "RUN 3: round 2 logged a verified P1 or P2 finding"
        : "STOP 2: round 2 logged no P1 or P2 finding",
    );
  } else {
    console.log(
      hasP1P2("3")
        ? "CAP 3: round 3 logged a verified P1 or P2 finding; escalate with residue"
        : "STOP 3: round 3 logged no P1 or P2 finding",
    );
  }
}

const argv = process.argv.slice(2);

if (argv[0] !== "--self-test") {
  if (argv.length !== 2 || argv[0] === "" || argv[1] === "") {
    console.error(USAGE);
    process.exit(1);
  }
  let isDir = false;
  try {
    isDir = statSync(argv[0]!).isDirectory();
  } catch {
    isDir = false;
  }
  if (!isDir) die(`no dispatch directory at ${argv[0]}`);
  decide(argv[0]!, argv[1]!);
} else {
  const self = join(HERE, "review-decide.sh");
  const st = new SelfTest();
  withTempDir((tmp) => {
    let out = "";
    let rc = 0;
    const runSelf = (...args: string[]): void => {
      const r = run(self, args);
      out = r.out + r.err;
      rc = r.code;
    };
    // Command substitution strips trailing newlines before the comparison.
    const TRAILING_NL_RE = /\n+$/u;
    const is = (label: string, exit: number, whole: string): void => {
      st.check(
        label,
        rc === exit && out.replace(TRAILING_NL_RE, "") === whole,
        `wanted exit ${exit} and "${whole}", got exit ${rc}\n${out}`,
      );
    };
    const has = (label: string, exit: number, text: string): void => {
      st.check(
        label,
        rc === exit && out.includes(text),
        `wanted exit ${exit} with "${text}", got exit ${rc}\n${out}`,
      );
    };
    const logged = (d: string, action: string, target: string, detail: string): void => {
      writeFileSync(
        join(d, "actions.jsonl"),
        '{"ts":"2026-09-27T00:00:00Z","project":"p","run":"r","actor":"coachman",' +
          `"action":"${action}","target":"${target}","detail":"${detail}"}\n`,
        { flag: "a" },
      );
    };
    const newRun = (name: string): string => {
      const d = join(tmp, name);
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, "actions.jsonl"), "");
      return d;
    };

    console.log("positive controls: another round runs");
    let d = newRun("r1-apply");
    logged(d, "finding", "src/a.ts:1", "gating P2 r1 bug luna reading: a defect");
    logged(d, "apply", "abc123", "src/a.ts:1");
    runSelf(d, "1");
    is("round 1 applied a fix", 0, "RUN 2: round 1 applied a fix");

    d = newRun("r2-p1");
    logged(d, "finding", "src/b.ts:2", "gating P1 r2 bug luna reading: a serious defect");
    runSelf(d, "2");
    is("round 2 logged a P1", 0, "RUN 3: round 2 logged a verified P1 or P2 finding");

    d = newRun("r2-p2");
    logged(d, "finding", "src/c.ts:3", "gating P2 r2 security sol reading: a security gap");
    runSelf(d, "2");
    is("round 2 logged a P2", 0, "RUN 3: round 2 logged a verified P1 or P2 finding");

    console.log("positive controls: the cap is reached");
    d = newRun("r3-p1");
    logged(d, "finding", "src/d.ts:4", "gating P1 r3 bug luna reading: still serious");
    runSelf(d, "3");
    is(
      "round 3 logged a P1",
      0,
      "CAP 3: round 3 logged a verified P1 or P2 finding; escalate with residue",
    );

    d = newRun("r3-p2");
    logged(d, "finding", "src/e.ts:5", "gating P2 r3 security sol reading: still a gap");
    runSelf(d, "3");
    is(
      "round 3 logged a P2",
      0,
      "CAP 3: round 3 logged a verified P1 or P2 finding; escalate with residue",
    );

    console.log("negative controls: no another round");
    d = newRun("r1-noapply");
    logged(d, "finding", "src/f.ts:6", "style P3 r1 style luna reading: a style note");
    runSelf(d, "1");
    is("round 1 applied no fix", 0, "STOP 1: round 1 applied no fixes");

    d = newRun("r2-p3");
    logged(d, "finding", "src/g.ts:7", "gating P3 r2 bug luna reading: a minor defect");
    runSelf(d, "2");
    is("round 2 logged no P1 or P2", 0, "STOP 2: round 2 logged no P1 or P2 finding");

    d = newRun("r2-none");
    runSelf(d, "2");
    is("round 2 logged no finding", 0, "STOP 2: round 2 logged no P1 or P2 finding");

    console.log("negative controls: the cap is not reached");
    d = newRun("r3-p3");
    logged(d, "finding", "src/h.ts:7", "gating P3 r3 bug luna reading: only minor defects");
    runSelf(d, "3");
    is("round 3 logged no P1 or P2", 0, "STOP 3: round 3 logged no P1 or P2 finding");

    d = newRun("r2-continues");
    logged(d, "finding", "src/i.ts:9", "gating P1 r2 bug luna reading: continues, not the cap");
    runSelf(d, "2");
    is("round 2 with a P1 is not the cap", 0, "RUN 3: round 2 logged a verified P1 or P2 finding");

    console.log("a fix that does not verify closed is the checking round's finding");
    d = newRun("reclosed");
    logged(d, "finding", "src/j.ts:10", "gating P1 r1 bug luna execution: an off-by-one");
    logged(d, "apply", "def456", "src/j.ts:10");
    logged(d, "finding", "src/j.ts:10", "gating P1 r2 bug luna reading: fix did not verify closed");
    runSelf(d, "2");
    is(
      "a P1 logged again in the round that checked the fix keeps the loop going",
      0,
      "RUN 3: round 2 logged a verified P1 or P2 finding",
    );
    runSelf(d, "1");
    is(
      "round 1 still sees its apply after the fix is logged again",
      0,
      "RUN 2: round 1 applied a fix",
    );

    d = newRun("reclosed-p3");
    logged(d, "finding", "src/k.ts:11", "gating P3 r1 bug luna reading: minor");
    logged(d, "apply", "ghi789", "src/k.ts:11");
    logged(d, "finding", "src/k.ts:11", "gating P3 r2 bug luna reading: fix did not verify closed");
    runSelf(d, "2");
    is(
      "a P3 logged again does not keep the loop going",
      0,
      "STOP 2: round 2 logged no P1 or P2 finding",
    );

    console.log("an apply of one round does not count for another");
    d = newRun("other-round");
    logged(d, "finding", "src/l.ts:12", "gating P2 r1 bug luna reading: fixed in round 1");
    logged(d, "apply", "jkl012", "src/l.ts:12");
    logged(
      d,
      "finding",
      "src/m.ts:13",
      "gating P3 r2 bug luna reading: nothing applied in round 2",
    );
    runSelf(d, "1");
    is("round 1 still sees its own apply", 0, "RUN 2: round 1 applied a fix");

    d = newRun("later-apply");
    logged(d, "finding", "src/n.ts:14", "gating P2 r2 bug luna reading: fixed in round 2");
    logged(d, "apply", "mno345", "src/n.ts:14");
    runSelf(d, "1");
    is("an apply of round 2 does not run round 2", 0, "STOP 1: round 1 applied no fixes");

    console.log("negative controls: style findings never keep the loop going");
    d = newRun("style-p2");
    logged(d, "finding", "src/s1.ts:1", "style P2 r2 style luna reading: a style gap");
    runSelf(d, "2");
    is("a style P2 in round 2 stops the loop", 0, "STOP 2: round 2 logged no P1 or P2 finding");

    d = newRun("style-p1-cap");
    logged(d, "finding", "src/s2.ts:2", "style P1 r3 style mimo reading: a serious style gap");
    runSelf(d, "3");
    is("a style P1 in round 3 stops, not the cap", 0, "STOP 3: round 3 logged no P1 or P2 finding");

    d = newRun("style-plus-p3");
    logged(d, "finding", "src/s3.ts:3", "gating P3 r2 bug luna reading: minor");
    logged(d, "finding", "src/s4.ts:4", "style P1 r2 style mimo reading: a serious style gap");
    runSelf(d, "2");
    is(
      "a gating P3 beside a style P1 stops the loop",
      0,
      "STOP 2: round 2 logged no P1 or P2 finding",
    );

    console.log("controls for the cap bound");
    d = newRun("past");
    runSelf(d, "4");
    has("a round past the cap is refused", 1, "cap of 3");
    runSelf(d, "0");
    has("round 0 is refused", 1, "cap of 3");

    console.log("negative controls: malformed lines fail loudly, each fault named");
    d = newRun("bad-json");
    writeFileSync(join(d, "actions.jsonl"), "not json\n", { flag: "a" });
    runSelf(d, "2");
    has("a line that is not JSON is refused", 1, "line 1 is not JSON");

    d = newRun("bad-scalar");
    writeFileSync(join(d, "actions.jsonl"), "42\n", { flag: "a" });
    runSelf(d, "2");
    has("a line that is not an action object is refused", 1, "line 1 is not an action object");

    d = newRun("no-action");
    writeFileSync(
      join(d, "actions.jsonl"),
      '{"ts":"2026-09-27T00:00:00Z","target":"t","detail":"d"}\n',
      {
        flag: "a",
      },
    );
    runSelf(d, "2");
    has("an action object with no action is refused", 1, "line 1 has no action");

    d = newRun("bad-class");
    logged(d, "finding", "src/t1.ts:1", "P1 r2 bug luna reading: no class first");
    runSelf(d, "2");
    has("a finding with no class is refused", 1, 'opens with "P1", not gating or style');

    d = newRun("bad-severity");
    logged(d, "finding", "src/t2.ts:2", "gating P9 r2 bug luna reading: no such severity");
    runSelf(d, "2");
    has("a finding with a bad severity is refused", 1, "severity P9, not P1, P2 or P3");

    d = newRun("no-severity");
    logged(d, "finding", "src/t3.ts:3", "gating");
    runSelf(d, "2");
    has("a finding with no severity is refused", 1, "severity none, not P1, P2 or P3");

    d = newRun("bad-round");
    logged(d, "finding", "src/t4.ts:4", "gating P1 round1 bug luna reading: no such round");
    runSelf(d, "2");
    has("a finding with a bad round is refused", 1, "round round1, not rN");

    d = newRun("no-round");
    logged(d, "finding", "src/t5.ts:5", "gating P1");
    runSelf(d, "2");
    has("a finding with no round is refused", 1, "round none, not rN");

    d = newRun("dup-target");
    logged(d, "finding", "src/t6.ts:6", "gating P1 r2 bug luna reading: serious");
    logged(d, "finding", "src/t6.ts:6", "gating P3 r2 security sol reading: minor, same target");
    runSelf(d, "2");
    has(
      "two findings sharing one target in one round are refused",
      1,
      "a second finding for src/t6.ts:6 in round r2",
    );

    d = newRun("unknown-apply");
    logged(d, "finding", "src/t7.ts:7", "gating P2 r1 bug luna reading: a defect");
    logged(d, "apply", "abc123", "src/nowhere.ts:99");
    runSelf(d, "1");
    has(
      "an apply naming an unknown target is refused",
      1,
      "an apply naming src/nowhere.ts:99, which has no finding line",
    );

    d = newRun("empty-apply");
    logged(d, "finding", "src/t8.ts:8", "gating P2 r1 bug luna reading: a defect");
    logged(d, "apply", "abc123", "");
    runSelf(d, "1");
    has("an apply naming no target is refused", 1, "an apply naming no finding target");

    {
      const r = run(self, [join(tmp, "nowhere"), "1"]);
      st.check(
        "a missing dispatch directory is refused",
        r.code === 1 && r.err.includes("no dispatch directory"),
        `(exit ${r.code})\n${r.err}`,
      );
    }
    {
      const r = run(self, []);
      st.check(
        "no arguments is refused",
        r.code === 1 && r.err.includes("usage:"),
        `(exit ${r.code})\n${r.err}`,
      );
    }
  });
  st.finish();
}
