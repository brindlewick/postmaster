// Oracle for #407, committed before the change: a run can work from a ticket
// without its technical notes. C1 pins the setup key; C2 pins the default and
// leaves the run's copies to a dispatched run; C3 pins the cut on the two
// fixture tickets and the shapes the ticket names, and that the run's own
// checks read whole and cut alike; C4 pins the fixture score's premises item
// and leaves the run's actions to a dispatched run; C5 needs model runs and
// stays hand-verified by the postmaster at landing. Every case drives
// scripts/run as a subprocess.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  RUN,
  cutTicket,
  readFixtureTicket,
  readTrackerBody,
  removeDir,
  scratchApp,
  scratchDir,
  setupDryRun,
  summaryEvidence,
  summaryFor,
  ticketCheckBody,
  verifyExamples,
  verifyJourney,
  writeAnswers,
} from "./acceptance-407.ts";
import { run } from "./lib/proc.ts";

let tmp = "";

beforeAll(() => {
  tmp = scratchDir("acceptance-407-");
});

afterAll(() => {
  removeDir(tmp);
});

function writeTicket(name: string, text: string): string {
  const path = join(tmp, name);
  writeFileSync(path, text, "utf8");
  return path;
}

describe("C1: the setting", () => {
  test("setup --keys lists ticket_notes with given, held-back and the given default", () => {
    const r = run(RUN, ["setup", "--keys"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("ticket_notes");
    expect(r.out).toContain("given");
    expect(r.out).toContain("held-back");
    expect(r.out).toMatch(/ticket_notes +given /u);
  });

  test("a dry run with each value carries it in team.ticket_notes", () => {
    for (const value of ["given", "held-back"]) {
      const answers = writeAnswers(tmp, `notes-${value}`, `ticket_notes=${value}`);
      const r = setupDryRun(tmp, answers);
      expect(r.code).toBe(0);
      expect(r.out).toContain(`ticket_notes = "${value}"`);
    }
  }, 120000);

  test("any other value is refused, exit 1", () => {
    const answers = writeAnswers(tmp, "notes-bad", "ticket_notes=sometimes");
    const r = setupDryRun(tmp, answers);
    expect(r.code).toBe(1);
    expect(r.out).toContain("ticket_notes");
  }, 120000);
});

describe("C2: unset keeps today's behavior", () => {
  test("run-meta ticket-notes on a run with no key prints given", () => {
    const dispatch = join(tmp, "no-key");
    mkdirSync(dispatch, { recursive: true });
    writeFileSync(
      join(dispatch, "run.json"),
      JSON.stringify({ config: { team: { mode: "single-thread" } } }),
      "utf8",
    );
    const r = run(RUN, ["run-meta", "ticket-notes", dispatch]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("given");
  });

  test.skipIf(true)("a run with no key holds both sections in every copy", () => {
    // Needs a dispatched run: the waybill's ## Ticket part, each workhorse's
    // brief and armed ticket.md. C5's run with no key is that run; the
    // postmaster reads it at landing.
  });
});

describe("C3: the cut", () => {
  /** Whole minus the two sections, found by their known headings. */
  function expectedCut(whole: string, tech: string, verifiedPrefix: string): string {
    const lines = whole.split("\n");
    const techAt = lines.indexOf(tech);
    expect(techAt).toBeGreaterThanOrEqual(0);
    const verifiedAt = lines.findIndex((l) => l.startsWith(verifiedPrefix));
    expect(verifiedAt).toBeGreaterThanOrEqual(0);
    const first = Math.min(techAt, verifiedAt);
    const second = Math.max(techAt, verifiedAt);
    // The first section runs to the next heading of level 3 or above; the
    // second runs to the next such heading or the end.
    const isHeading = (l: string): boolean => /^#{1,3} /u.test(l);
    let firstEnd = second;
    for (let i = first + 1; i < second; i++) {
      if (isHeading(lines[i]!)) {
        firstEnd = i;
        break;
      }
    }
    let secondEnd = lines.length;
    for (let i = second + 1; i < lines.length; i++) {
      if (isHeading(lines[i]!)) {
        secondEnd = i;
        break;
      }
    }
    const kept = [
      ...lines.slice(0, first),
      ...lines.slice(firstEnd, second),
      ...lines.slice(secondEnd),
    ];
    return kept.join("\n");
  }

  for (const name of ["remove", "undo"]) {
    test(`the ${name} ticket loses exactly the two sections and keeps its journey`, () => {
      const whole = readFixtureTicket(name);
      const path = writeTicket(`${name}-whole.md`, whole);
      const cut = cutTicket(path);
      expect(cut.code).toBe(0);
      const expected = expectedCut(whole, "### Technical notes", "### Verified at");
      expect(cut.out).toBe(expected);
      expect(cut.out).toContain("## User journey");
      expect(cut.out).not.toContain("Technical notes");
      expect(cut.out).not.toContain("Verified at");
    });
  }

  test("ticket-parts passes whole and fails cut naming both sections", () => {
    const project = join(tmp, "parts-proj");
    mkdirSync(project, { recursive: true });
    for (const name of ["remove", "undo"]) {
      const whole = readFixtureTicket(name).replaceAll("FIXTURE_BASE", "57d47032");
      const wholePath = writeTicket(`${name}-parts-whole.md`, whole);
      const cut = cutTicket(wholePath);
      expect(cut.code).toBe(0);
      const cutPath = writeTicket(`${name}-parts-cut.md`, cut.out);
      const wholeR = run(RUN, ["ticket-parts", "--final", wholePath]);
      expect(wholeR.code).toBe(0);
      const cutR = run(RUN, ["ticket-parts", "--final", cutPath]);
      expect(cutR.code).toBe(1);
      expect(`${cutR.out}\n${cutR.err}`).toContain("Technical notes");
      expect(`${cutR.out}\n${cutR.err}`).toContain("Verified at");
    }
  });

  const SMALL_HEAD = `# T

## Problem / feature

P.

## Acceptance criteria

1. A works.

## Direction

D.

## Turnpikes

default

## For the agents

### Checks

- **C1** Check one works.
`;

  test("headings in other letter cases are cut", () => {
    const whole = `${SMALL_HEAD}
### Technical Notes

- Note here. (C1)

### VERIFIED AT abc1234

- Verified here.
`;
    const path = writeTicket("cases-whole.md", whole);
    const cut = cutTicket(path);
    expect(cut.code).toBe(0);
    expect(cut.out).toBe(`${SMALL_HEAD}`);
  });

  test("a notes heading inside a fenced block is not a section and stays", () => {
    const whole = `${SMALL_HEAD}
### Checks example

\`\`\`md
### Technical notes
\`\`\`

### Technical notes

- Note here. (C1)

### Verified at abc1234

- Verified here.
`;
    const path = writeTicket("fence-whole.md", whole);
    const cut = cutTicket(path);
    expect(cut.code).toBe(0);
    expect(cut.out).toBe(`${SMALL_HEAD}
### Checks example

\`\`\`md
### Technical notes
\`\`\`
`);
  });

  test("the two sections in the other order are both cut", () => {
    const whole = `${SMALL_HEAD}
### Verified at abc1234

- Verified here.

### Technical notes

- Note here. (C1)
`;
    const path = writeTicket("order-whole.md", whole);
    const cut = cutTicket(path);
    expect(cut.code).toBe(0);
    expect(cut.out).toBe(`${SMALL_HEAD}`);
  });

  test("a level-two section after Verified at ends it and stays", () => {
    const whole = `${SMALL_HEAD}
### Technical notes

- Note here. (C1)

### Verified at abc1234

- Verified here.

## Appendix

Kept.
`;
    const path = writeTicket("appendix-whole.md", whole);
    const cut = cutTicket(path);
    expect(cut.code).toBe(0);
    expect(cut.out).toBe(`${SMALL_HEAD}
## Appendix

Kept.
`);
  });

  test.skipIf(true)("C5's runs without the notes hold no section line in any copy", () => {
    // Needs dispatched runs: the waybill, every leg prompt, each workhorse's
    // brief and armed copy. The postmaster reads C5's two runs at landing.
  });
});

describe("C3: the run's checks read whole and cut alike", () => {
  const BODIES: Array<{ name: string; text: () => string }> = [
    { name: "remove", text: () => readFixtureTicket("remove") },
    { name: "undo", text: () => readFixtureTicket("undo") },
    { name: "251", text: () => readTrackerBody("251") },
    { name: "266", text: () => readTrackerBody("266") },
    { name: "270", text: () => readTrackerBody("270") },
  ];

  test("ticket-check --body gives the same output and exit", () => {
    const project = join(tmp, "check-proj");
    mkdirSync(project, { recursive: true });
    for (const body of BODIES) {
      const wholePath = writeTicket(`${body.name}-check-whole.md`, body.text());
      const cut = cutTicket(wholePath);
      expect(cut.code).toBe(0);
      const cutPath = writeTicket(`${body.name}-check-cut.md`, cut.out);
      const wholeR = ticketCheckBody(wholePath, project);
      const cutR = ticketCheckBody(cutPath, project);
      expect(cutR.code).toBe(wholeR.code);
      expect(cutR.out).toBe(wholeR.out);
    }
  });

  test("summary-evidence gives the same output and exit", () => {
    const project = join(tmp, "ev-proj");
    mkdirSync(project, { recursive: true });
    for (const body of BODIES) {
      const wt = join(tmp, `ev-${body.name}`);
      mkdirSync(wt, { recursive: true });
      const wholePath = writeTicket(`${body.name}-ev-whole.md`, body.text());
      const cut = cutTicket(wholePath);
      expect(cut.code).toBe(0);
      const cutPath = writeTicket(`${body.name}-ev-cut.md`, cut.out);
      const summary = summaryFor(wholePath, wt, project);
      const wholeR = summaryEvidence(summary, wt, wholePath);
      const cutR = summaryEvidence(summary, wt, cutPath);
      expect(cutR.code).toBe(wholeR.code);
      expect(cutR.out).toBe(wholeR.out);
    }
  }, 120000);

  test("verify-examples gives the same output and exit on a scratch app", () => {
    for (const body of BODIES) {
      const dir = join(tmp, `ex-${body.name}`);
      mkdirSync(dir, { recursive: true });
      const wt = scratchApp(dir);
      const wholePath = writeTicket(`${body.name}-ex-whole.md`, body.text());
      const cut = cutTicket(wholePath);
      expect(cut.code).toBe(0);
      const cutPath = writeTicket(`${body.name}-ex-cut.md`, cut.out);
      const wholeR = verifyExamples(wt, wholePath);
      const cutR = verifyExamples(wt, cutPath);
      expect(cutR.code).toBe(wholeR.code);
      expect(cutR.out).toBe(wholeR.out);
    }
  }, 180000);

  test("verify-journey gives the same output and exit on a scratch app", () => {
    for (const body of BODIES) {
      const dir = join(tmp, `jo-${body.name}`);
      mkdirSync(dir, { recursive: true });
      const wt = scratchApp(dir);
      const wholePath = writeTicket(`${body.name}-jo-whole.md`, body.text());
      const cut = cutTicket(wholePath);
      expect(cut.code).toBe(0);
      const cutPath = writeTicket(`${body.name}-jo-cut.md`, cut.out);
      const wholeR = verifyJourney(wt, wholePath);
      const cutR = verifyJourney(wt, cutPath);
      expect(cutR.code).toBe(wholeR.code);
      expect(cutR.out).toBe(wholeR.out);
    }
  }, 180000);
});

describe("C4: the postmaster checks the premises without the notes", () => {
  function scoreDispatch(
    name: string,
    ticketNotes: string | null,
    premisesActor: string | null,
  ): { dispatch: string; repo: string } {
    const dispatch = join(tmp, `score-${name}`);
    mkdirSync(dispatch, { recursive: true });
    const team: Record<string, unknown> = { workhorses: ["alpha", "beta"] };
    if (ticketNotes !== null) team["ticket_notes"] = ticketNotes;
    writeFileSync(join(dispatch, "run.json"), JSON.stringify({ config: { team } }), "utf8");
    writeFileSync(join(dispatch, "manifest.json"), JSON.stringify({}), "utf8");
    writeFileSync(join(dispatch, "brief.md"), "# Waybill: x\n", "utf8");
    // The premises line goes through log-action as the flow writes it: a
    // hand-written line passes the score while the script refuses the actor.
    writeFileSync(join(dispatch, "actions.jsonl"), "\n", "utf8");
    if (premisesActor !== null) {
      const logged = run(RUN, [
        "log-action",
        dispatch,
        premisesActor,
        "premises",
        "abc1234",
        "base=abc1234",
        "result=same",
      ]);
      if (logged.code !== 0) throw new Error(`log-action failed: ${logged.err}`);
    }
    const repo = join(tmp, `score-repo-${name}`);
    mkdirSync(repo, { recursive: true });
    const r = run("git", ["init", "-q", "-b", "main", repo]);
    if (r.code !== 0) throw new Error("git init failed");
    writeFileSync(join(repo, "README.md"), "# app\n", "utf8");
    const add = run("git", ["-C", repo, "add", "."]);
    if (add.code !== 0) throw new Error("git add failed");
    const commit = run("git", [
      "-C",
      repo,
      "-c",
      "user.name=brindlewick",
      "-c",
      "user.email=332054101+brindlewick@users.noreply.github.com",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-q",
      "-m",
      "first",
    ]);
    if (commit.code !== 0) throw new Error("git commit failed");
    return { dispatch, repo };
  }

  function premisesLine(dispatch: string, repo: string): string {
    const r = run(RUN, ["fixture", "score", dispatch, repo]);
    const line = r.out.split("\n").find((l) => l.includes("premises-order")) ?? "";
    return line;
  }

  test("held-back with a postmaster premises line scores its premises item", () => {
    const { dispatch, repo } = scoreDispatch("held-post", "held-back", "postmaster");
    expect(premisesLine(dispatch, repo)).toMatch(/^ok +premises-order/u);
  });

  test("given with a coachman premises line scores its premises item", () => {
    const { dispatch, repo } = scoreDispatch("given-coach", "given", "coachman");
    expect(premisesLine(dispatch, repo)).toMatch(/^ok +premises-order/u);
  });

  test("held-back with no premises line fails its premises item", () => {
    const { dispatch, repo } = scoreDispatch("held-none", "held-back", null);
    expect(premisesLine(dispatch, repo)).toMatch(/^FAIL premises-order/u);
  });

  test.skipIf(true)("C5's runs carry the postmaster line and no coachman line", () => {
    // Needs dispatched runs: actions.jsonl before the first leg starts. The
    // postmaster reads C5's two runs at landing.
  });

  test.skipIf(true)("a changed premise asks the user before any leg starts", () => {
    // Needs a dispatch of a ticket whose cited text changed: the postmaster
    // asks the user with no leg started. Hand-verified at landing.
  });
});

describe("C5: fixture runs", () => {
  test.skipIf(true)("without the notes in single-thread mode scores clean", () => {
    // Needs a model run from this branch; the postmaster dispatches and
    // scores it at landing.
  });

  test.skipIf(true)("without the notes in synthesis mode scores clean", () => {
    // Needs a model run from this branch; the postmaster dispatches and
    // scores it at landing.
  });

  test.skipIf(true)("with no key scores clean", () => {
    // Needs a model run from this branch; the postmaster dispatches and
    // scores it at landing.
  });
});
