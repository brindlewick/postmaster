// Tests beside scripts/turnpikes.ts, moved from its --self-test on #109: 70 controls.
// The self-test staged shared waybills and run state between controls; each test below builds
// its own fixtures so it passes alone as well as in file order. The root-conditional control
// is gated by test.skipIf with a top notice.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./lib/proc.ts";
import { pyWords } from "./lib/text.ts";
import {
  ALWAYS,
  LEGS,
  MARKER,
  named,
  NAME_CHAR_RE,
  parseTable,
  resolve,
  TABLE,
  WORD_SPLIT_RE,
} from "./turnpikes.ts";

const SELF = join(import.meta.dir, "turnpikes.sh");
const HERE = import.meta.dir;
const NOPE = "zz-not-listed";
const PLUS = `${TABLE}\n${NOPE}  -        ship    a check the table does not have yet`;

delete process.env.POSTMASTER_PROJECT;

let canRestrict = true;
{
  const probe = mkdtempSync(join(tmpdir(), "postmaster-"));
  try {
    const f = join(probe, "f");
    writeFileSync(f, "x");
    chmodSync(f, 0o000);
    try {
      readFileSync(f);
      canRestrict = false;
    } catch {
      canRestrict = true;
    }
    chmodSync(f, 0o644);
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
}
if (!canRestrict) {
  console.log(
    "skip an unreadable brief.md names the read error: this user reads every file, so no denial was compared",
  );
}

let tmp = "";

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "postmaster-"));
  {
    const r = run("bash", [SELF, "--list"]);
    if (r.out.split("\n").some((l) => pyWords(l)[0] === NOPE)) {
      throw new Error(`test setup: ${NOPE} is in the table; pick another unused name`);
    }
  }
  const project = join(tmp, "project-profile");
  mkdirSync(join(project, ".postmaster"), { recursive: true });
  writeFileSync(
    join(project, ".postmaster", "project.toml"),
    '[project]\ndefault_turnpikes = ["bug"]\n',
  );
  const emptyProject = join(tmp, "empty-project");
  mkdirSync(join(emptyProject, ".postmaster"), { recursive: true });
  writeFileSync(
    join(emptyProject, ".postmaster", "project.toml"),
    "[project]\ndefault_turnpikes = []\n",
  );
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const runSelf = (...args: string[]): { code: number; out: string } => {
  const r = run("bash", [SELF, ...args]);
  return { code: r.code, out: (r.out + r.err).replace(/\n+$/u, "") };
};

const checkIs = (r: { code: number; out: string }, exit: number, expected: string): void => {
  expect(r.code).toBe(exit);
  expect(r.out).toBe(expected);
};

const checkHas = (
  r: { code: number; out: string },
  exit: number,
  want: string,
  notWant?: string,
): void => {
  expect(r.code).toBe(exit);
  expect(r.out.includes(want)).toBe(true);
  if (notWant !== undefined && notWant !== "") expect(r.out.includes(notWant)).toBe(false);
};

const waybill = (dir: string, line: string, notes = ""): void => {
  mkdirSync(dir, { recursive: true });
  const content = `# Waybill: T-1\n${line}\n\n## Ticket\n## Problem / feature\nA change.\n\n## Turnpikes\ndefault\n\n## Notes\n${notes}\n\n## Project profile\nrepo: /r\n\n## Dispatch\nname: #1, A change\ndispatch: ${dir}\ntool: /t\n`;
  writeFileSync(join(dir, "brief.md"), content, "utf8");
};

const lines = (...args: string[]): string => args.join("\n");

const wantDescs = [
  "idiom, naming, abstraction and consistency with the project's own conventions",
  "correctness, logic, and whether the tests are adequate",
  "exploit paths through the project's risk surfaces",
];
const descsFull = (ds: string[]): boolean =>
  ds.length === 3 && ds.every((d, i) => d === wantDescs[i]);

const bad = (extra: string, want: string): void => {
  const { faults } = parseTable(`${TABLE}\n${extra}`);
  const r = {
    code: faults.length > 0 ? 1 : 0,
    out: faults.map((f) => `turnpikes: the table's ${f}`).join("\n"),
  };
  checkHas(r, 1, want, "style");
};

const poll = (runsDir: string): string => {
  const r = run("bash", [join(HERE, "runs-status.sh"), runsDir]);
  const t9 = r.out.split("\n").find((l) => l.startsWith("T-9"));
  return t9 ? (pyWords(t9).pop() ?? "") : "";
};

const setupWalk = (tag: string): { repo: string; d: string } => {
  const repo = join(tmp, `repo-${tag}`);
  const d = join(repo, ".postmaster", "runs", "T-9");
  waybill(d, "turnpikes: none");
  writeFileSync(join(d, "run-log.md"), "", "utf8");
  writeFileSync(
    join(d, "manifest.json"),
    '{"stage": "checkpoint-1", "leg": 1, "base": "abc123", "lanes": {}, "coachman": {"legs": {}}}\n',
    "utf8",
  );
  run("bash", [join(HERE, "log-action.sh"), d, "postmaster", "dispatch", "T-9", "leg 1"]);
  writeFileSync(
    join(d, "handoff-1.md"),
    "## Decisions\nx\n\n## Deferred findings\nx\n\n## Verified by execution\nx\n\n## Unverified\nx\n\n## Branches and lanes\nx\n\n## Open questions\nx\n\n## Next leg\nx\n",
    "utf8",
  );
  writeFileSync(join(d, ".leg-1-done"), "", "utf8");
  writeFileSync(join(d, ".leg-1-exited"), "", "utf8");
  return { repo, d };
};

const advanceWalk = (d: string, leg: number): void => {
  const p = join(d, "manifest.json");
  const m = JSON.parse(readFileSync(p, "utf8"));
  m.leg = leg;
  writeFileSync(p, JSON.stringify(m), "utf8");
};

describe("unicode primitives", () => {
  test("a list marker may be Arabic-Indic digits", () => {
    expect(MARKER.exec("١. x") !== null).toBe(true);
  });

  test("name-char test matches [^W_]", () => {
    const nameWant = ["a", "_", "٣", "½", "-"].map((s) => NAME_CHAR_RE.test(s));
    expect(nameWant).toEqual([true, false, true, true, false]);
  });

  test("table fields split on U+001C", () => {
    const p1 = parseTable("style\x1c-\x1creview\x1cwhat here");
    expect(p1.faults).toEqual([]);
    expect(p1.rows[0]?.what).toBe("what here");
  });

  test("what keeps FEFF edges (Python strip)", () => {
    const p2 = parseTable("style - review \uFEFFwhat\uFEFF");
    expect(p2.rows[0]?.what).toBe("\uFEFFwhat\uFEFF");
  });

  test("waybill words split on U+001C", () => {
    expect("a\x1cb,c".split(WORD_SPLIT_RE)).toEqual(["a", "b", "c"]);
  });
});

describe("positive controls: the list", () => {
  test("--list names style, bug and security, once each", () => {
    const r = runSelf("--list");
    expect(r.code).toBe(0);
    expect(
      ["style", "bug", "security"].every(
        (n) => r.out.split("\n").filter((l) => pyWords(l)[0] === n).length === 1,
      ),
    ).toBe(true);
  });

  test("the default set is style, bug and security", () => {
    const r = runSelf("--list");
    const defaults = r.out
      .split("\n")
      .filter((l) => pyWords(l)[1] === "default")
      .map((l) => pyWords(l)[0])
      .join(" ");
    expect(defaults).toBe("style bug security");
  });

  test("the three run in the review leg", () => {
    const r = runSelf("--list");
    const legs = [
      ...new Set(
        r.out
          .split("\n")
          .filter((l) => /^(style|bug|security)$/u.test(pyWords(l)[0] ?? ""))
          .map((l) => pyWords(l)[2]),
      ),
    ];
    expect(legs).toEqual(["review"]);
  });

  test("each line carries its full description, not its first word", () => {
    const r = runSelf("--list");
    const descs = r.out
      .split("\n")
      .filter((l) => /^(style|bug|security)$/u.test(pyWords(l)[0] ?? ""))
      .map((l) => pyWords(l).slice(3).join(" "));
    expect(descsFull(descs)).toBe(true);
  });

  test("a truncated description fails the full-description control", () => {
    const short = TABLE.replace(
      "idiom, naming, abstraction and consistency with the project's own conventions",
      "idiom, naming, abstraction",
    );
    const { rows } = parseTable(short);
    const got = rows
      .filter((r) => ["style", "bug", "security"].includes(r.name))
      .map((r) => r.what);
    expect(descsFull(got)).toBe(false);
  });
});

describe("positive controls: a ticket's section", () => {
  test("--list does not read project settings", () => {
    const plain = runSelf("--list");
    expect(plain.code).toBe(0);
    const r = run("bash", [SELF, "--list"], {
      env: {
        ...(process.env as Record<string, string>),
        POSTMASTER_PROJECT: join(tmp, "no-such-project"),
      },
    });
    const out = (r.out + r.err).replace(/\n+$/u, "");
    expect(r.code).toBe(0);
    expect(out).toBe(plain.out);
  });

  test("default resolves to the target project's declared turnpikes", () => {
    checkIs(
      runSelf("resolve", "--project", join(tmp, "project-profile"), "default"),
      0,
      "turnpikes: bug",
    );
  });

  test("a project may define default as no turnpikes", () => {
    checkIs(
      runSelf("resolve", "--project", join(tmp, "empty-project"), "default"),
      0,
      "turnpikes: none",
    );
  });

  test("short names the project's defaults omitted by a ticket", () => {
    checkIs(
      runSelf("short", "--project", join(tmp, "project-profile"), "turnpikes: none"),
      0,
      "bug",
    );
  });

  test("an explicitly empty --project is refused, never resolved as discovery", () => {
    checkHas(runSelf("resolve", "--project", "", "default"), 1, "no such project directory");
  });

  test("short refuses an explicitly empty --project too", () => {
    checkHas(runSelf("short", "--project", "", "turnpikes: none"), 1, "no such project directory");
  });

  test("default stands for the default set", () => {
    checkIs(runSelf("resolve", "default"), 0, "turnpikes: style, bug, security");
  });

  test("none stands for no turnpike", () => {
    checkIs(runSelf("resolve", "none"), 0, "turnpikes: none");
  });

  test("a list names its turnpikes, in the table's order", () => {
    checkIs(runSelf("resolve", "security, bug"), 0, "turnpikes: bug, security");
  });

  test("in a list, default still stands for the three", () => {
    checkIs(runSelf("resolve", "default, bug"), 0, "turnpikes: style, bug, security");
  });

  test("case, backticks, list markers and a closing full stop are ignored", () => {
    checkIs(runSelf("resolve", lines("- Bug", "- `security`.")), 0, "turnpikes: bug, security");
  });

  test("a thematic break is not a name", () => {
    checkIs(
      runSelf("resolve", lines("default", "", "---", "", "***")),
      0,
      "turnpikes: style, bug, security",
    );
  });

  test("a tab-indented rule is a name, not a break, as BASE has it", () => {
    checkIs(
      runSelf("resolve", lines("default", "", "\t---")),
      2,
      '"---" is not a turnpike; the section holds only default, none, or names from: style, bug, security',
    );
  });

  test("a three-space-indented rule is still a break", () => {
    checkIs(
      runSelf("resolve", lines("default", "", "   ---")),
      0,
      "turnpikes: style, bug, security",
    );
  });

  test("a hard line break is not part of a name", () => {
    checkIs(runSelf("resolve", "bug\\\nsecurity"), 0, "turnpikes: bug, security");
  });

  test("an invisible character is not part of a name", () => {
    checkIs(runSelf("resolve", "default\u200B"), 0, "turnpikes: style, bug, security");
  });

  test("an isolate or soft hyphen is not part of a name either", () => {
    checkIs(runSelf("resolve", "defau\u2066lt\u00AD"), 0, "turnpikes: style, bug, security");
  });

  test("with no text given, the section is read from stdin", () => {
    const r = run("bash", ["-c", `printf '1. bug\\n2. security\\n' | "${SELF}" resolve`]);
    checkIs(
      { code: r.code, out: (r.out + r.err).replace(/\n+$/u, "") },
      0,
      "turnpikes: bug, security",
    );
  });

  test("the waybill's line resolves to itself", () => {
    const first = runSelf("resolve", "bug, security");
    const second = runSelf("resolve", first.out.replace(/^turnpikes: /u, ""));
    checkIs(second, 0, first.out);
  });

  test("a turnpike added to the table resolves with nothing else changed", () => {
    const { names } = resolve(PLUS, `default, ${NOPE}`);
    checkIs(
      { code: 0, out: `turnpikes: ${(names ?? []).join(", ")}` },
      0,
      `turnpikes: style, bug, security, ${NOPE}`,
    );
  });
});

describe("positive controls: a run's legs", () => {
  test("a run with no turnpikes goes from synthesis to ship", () => {
    waybill(join(tmp, "none"), "turnpikes: none");
    checkIs(runSelf("legs", join(tmp, "none")), 0, lines("1 synthesis", "3 ship"));
  });

  test("a run with the default turnpikes has a review leg that runs all three", () => {
    waybill(join(tmp, "default"), "turnpikes: style, bug, security");
    checkIs(
      runSelf("legs", join(tmp, "default")),
      0,
      lines("1 synthesis", "2 review style bug security", "3 ship"),
    );
  });

  test("one review turnpike is enough for a review leg", () => {
    waybill(join(tmp, "style"), "turnpikes: style");
    checkIs(
      runSelf("legs", join(tmp, "style")),
      0,
      lines("1 synthesis", "2 review style", "3 ship"),
    );
  });

  test("a turnpikes line inside the ticket is never read", () => {
    waybill(join(tmp, "notes"), "turnpikes: none", "turnpikes: style, bug, security");
    checkIs(runSelf("legs", join(tmp, "notes")), 0, lines("1 synthesis", "3 ship"));
  });

  test("a fence the ticket leaves open changes nothing", () => {
    waybill(
      join(tmp, "fence"),
      "turnpikes: style, bug, security",
      lines("```", "## Dispatch", "turnpikes: none"),
    );
    checkIs(
      runSelf("legs", join(tmp, "fence")),
      0,
      lines("1 synthesis", "2 review style bug security", "3 ship"),
    );
  });

  test("--expect passes a waybill whose line is the check's", () => {
    waybill(join(tmp, "default"), "turnpikes: style, bug, security");
    checkIs(
      runSelf("legs", join(tmp, "default"), "--expect", "turnpikes:  style, bug,  security"),
      0,
      lines("1 synthesis", "2 review style bug security", "3 ship"),
    );
  });

  test("a turnpike that runs in another leg makes no review leg", () => {
    waybill(join(tmp, "extra"), `turnpikes: ${NOPE}`);
    const got = named(PLUS, `turnpikes: ${NOPE}`);
    const legLines: string[] = [];
    for (const [n, leg] of LEGS) {
      const runs = (got ?? []).filter(
        (x) => parseTable(PLUS).rows.find((r) => r.name === x)?.leg === leg,
      );
      if (ALWAYS.has(leg) || runs.length > 0) legLines.push([String(n), leg, ...runs].join(" "));
    }
    checkIs({ code: 0, out: legLines.join("\n") }, 0, lines("1 synthesis", `3 ship ${NOPE}`));
  });

  test("legs --line gives the legs of a line", () => {
    checkIs(runSelf("legs", "--line", "turnpikes: none"), 0, lines("1 synthesis", "3 ship"));
  });

  test("legs --line gives a review leg for a review turnpike", () => {
    checkIs(
      runSelf("legs", "--line", "turnpikes: security"),
      0,
      lines("1 synthesis", "2 review security", "3 ship"),
    );
  });

  test("short names the default turnpikes a line leaves out", () => {
    checkIs(runSelf("short", "turnpikes: bug"), 0, lines("style", "security"));
  });

  test("short names nothing for a line that leaves none out", () => {
    checkIs(runSelf("short", "turnpikes: style, bug, security"), 0, "");
  });
});

describe("negative controls: a ticket's section", () => {
  test("a turnpike the table does not list is named", () => {
    checkHas(runSelf("resolve", NOPE), 2, `"${NOPE}" is not a turnpike`);
  });

  test("none listed with another turnpike is refused", () => {
    checkHas(runSelf("resolve", "none, bug"), 2, "none stands alone");
  });

  test("a reason is not a turnpike", () => {
    checkHas(
      runSelf("resolve", "none. A research ticket"),
      2,
      '"a", "research" and "ticket" are not turnpikes; the section holds only',
    );
  });

  test("a dash between names is not a list marker, and is named", () => {
    checkHas(runSelf("resolve", "default - security"), 2, '"-" is not a turnpike');
  });

  test("a word of dots is still a word, and is named", () => {
    checkHas(runSelf("resolve", "style, ..."), 2, '"..." is not a turnpike');
  });

  test("an empty section names no turnpike", () => {
    checkHas(runSelf("resolve", ""), 2, "names no turnpike");
  });
});

describe("negative controls: a run's legs", () => {
  test("with no line under the title, one in the ticket is not taken instead", () => {
    waybill(join(tmp, "missing"), "", "turnpikes: style, bug, security");
    checkHas(runSelf("legs", join(tmp, "missing")), 2, "has no turnpikes: line", "ship");
  });

  test("a waybill naming an unknown turnpike is refused, and no leg is printed", () => {
    waybill(join(tmp, "unknown"), `turnpikes: bug, ${NOPE}`);
    checkHas(runSelf("legs", join(tmp, "unknown")), 2, `"${NOPE}" is not a turnpike`, "synthesis");
  });

  test("two turnpikes lines are refused", () => {
    waybill(join(tmp, "twice"), lines("turnpikes: none", "turnpikes: style, bug, security"));
    checkHas(runSelf("legs", join(tmp, "twice")), 2, "has 2 turnpikes: lines", "synthesis");
  });

  test("a waybill that says default is refused: it carries names", () => {
    waybill(join(tmp, "word"), "turnpikes: default");
    checkHas(runSelf("legs", join(tmp, "word")), 2, "says default", "synthesis");
  });

  test("--expect refuses a waybill that dropped a name the check printed", () => {
    waybill(join(tmp, "default"), "turnpikes: style, bug, security");
    checkHas(
      runSelf("legs", join(tmp, "default"), "--expect", "turnpikes: bug, security"),
      2,
      `and the ticket's check printed "turnpikes: bug, security"`,
      "synthesis",
    );
  });

  test("legs --line refuses a line that is not a turnpikes: line", () => {
    checkHas(runSelf("legs", "--line", "style, bug"), 2, "is not a turnpikes: line", "synthesis");
  });

  test("legs --line refuses a line with a newline in it", () => {
    checkHas(
      runSelf("legs", "--line", lines("turnpikes: none", "style")),
      2,
      "is not a turnpikes: line",
      "synthesis",
    );
  });

  test("short refuses default: a line carries names", () => {
    checkHas(runSelf("short", "turnpikes: default"), 2, "says default");
  });

  test("no waybill is a usage error", () => {
    checkHas(runSelf("legs", join(tmp, "nowhere")), 1, "no waybill at");
  });

  test("a brief.md that is a directory is no waybill", () => {
    const d = join(tmp, "briefdir");
    mkdirSync(join(d, "brief.md"), { recursive: true });
    checkHas(runSelf("legs", d), 1, "no waybill at");
  });

  test.skipIf(!canRestrict)("an unreadable brief.md names the read error", () => {
    const d = join(tmp, "noperm");
    waybill(d, "turnpikes: none");
    chmodSync(join(d, "brief.md"), 0o000);
    try {
      checkHas(runSelf("legs", d), 1, "cannot read", "Bun v");
    } finally {
      chmodSync(join(d, "brief.md"), 0o644);
    }
  });
});

describe("negative controls: the table", () => {
  test("a turnpike named none is refused", () => {
    bad("none       -        review  nothing", '"none" already means something in a ticket');
  });

  test("a turnpike named default is refused", () => {
    bad("default    -        review  everything", '"default" already means something in a ticket');
  });

  test("a turnpike listed twice is refused", () => {
    bad("bug        -        review  bugs again", '"bug" is listed twice');
  });

  test("a leg that does not exist is refused", () => {
    bad(`${NOPE}      -        deploy  a check`, '"deploy" is not a leg');
  });

  test("a set other than default or - is refused", () => {
    bad(`${NOPE}    yes      ship    a check`, '"yes" is neither default nor -');
  });

  test("a name that is not a lowercase word is refused", () => {
    bad("Zz-Not  -       ship    a check", '"Zz-Not" is not a lowercase word');
  });

  test("a line with no description is refused", () => {
    bad(`${NOPE}      -        ship`, "needs a name, default or -, a leg, and what it checks");
  });
});

describe("a run with no turnpikes, walked from synthesis to ship through the poll, the hand-off check and the stages", () => {
  test("after synthesis the poll says DISPATCH", () => {
    const { repo } = setupWalk("poll");
    expect(poll(join(repo, ".postmaster", "runs"))).toBe("DISPATCH");
  }, 30000);

  test("the leg after synthesis is ship", () => {
    const { d } = setupWalk("leg-after");
    const r = run("bash", [SELF, "legs", d]);
    const next = r.out.split("\n").find((l) => {
      const n = parseInt(pyWords(l)[0] ?? "", 10);
      return n > 1;
    });
    const nextVal = next ? `${pyWords(next)[0]} ${pyWords(next)[1]}` : "";
    expect(nextVal).toBe("3 ship");
  }, 30000);

  test("the ship leg starts from synthesis's hand-off, which passes its check", () => {
    const { d } = setupWalk("handoff");
    const r = run("bash", [SELF, "legs", d]);
    const prevs = r.out
      .split("\n")
      .map((l) => parseInt(pyWords(l)[0] ?? "", 10))
      .filter((n) => n < 3);
    const prev = prevs[prevs.length - 1] ?? 0;
    const hc = run("bash", [join(HERE, "handoff-check.sh"), join(d, `handoff-${prev}.md`)]);
    expect(hc.code).toBe(0);
    expect(prev).toBe(1);
  }, 30000);

  test("after ship the poll says DISPATCH, and no leg follows: Stage G", () => {
    const { repo, d } = setupWalk("after-ship");
    advanceWalk(d, 3);
    run("bash", [join(HERE, "stage.sh"), d, "shipping"]);
    run("bash", [join(HERE, "stage.sh"), d, "shipped"]);
    writeFileSync(join(d, ".leg-3-done"), "", "utf8");
    writeFileSync(join(d, ".leg-3-exited"), "", "utf8");
    const r = run("bash", [SELF, "legs", d]);
    const after = r.out.split("\n").filter((l) => parseInt(pyWords(l)[0] ?? "", 10) > 3);
    expect(poll(join(repo, ".postmaster", "runs"))).toBe("DISPATCH");
    expect(after).toEqual([]);
  }, 30000);

  test("it closes with no review stage", () => {
    const { repo, d } = setupWalk("closes");
    advanceWalk(d, 3);
    run("bash", [join(HERE, "stage.sh"), d, "shipping"]);
    run("bash", [join(HERE, "stage.sh"), d, "shipped"]);
    writeFileSync(join(d, ".leg-3-done"), "", "utf8");
    writeFileSync(join(d, ".leg-3-exited"), "", "utf8");
    run("bash", [join(HERE, "stage.sh"), d, "done", "postmaster"]);
    let stages = "";
    try {
      const text = readFileSync(join(d, "actions.jsonl"), "utf8");
      const targets = text
        .split("\n")
        .filter((l) => l !== "")
        .map((l) => JSON.parse(l))
        .filter((o: { action: string }) => o.action === "stage")
        .map((o: { target: string }) => o.target);
      stages = targets.join(" ");
    } catch {
      stages = "";
    }
    expect(stages).toBe("shipping shipped done");
    expect(poll(join(repo, ".postmaster", "runs"))).toBe("-");
  }, 30000);
});
