// The controls for the lane audit's counts (see ../method.md). Each count is run through the same
// code on a run where it must read non-zero and a run where it must read zero, and the figures
// that two programs compute are compared.
//
//   bun controls.ts --project <repo> --legacy <dir> --fixtures <dir> --tool <repo> \
//       --since <iso> --until <iso> --results <dir>
//
// Writes `controls.md` into the results folder and exits 2 if any control failed. The pure
// checks are exported and tested; the CLI is the edge that reads the records again.
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  family,
  laneGate,
  lastRound,
  reviews,
  roundTimes,
  severeByRound,
  severeTotals,
  workhorses,
} from "./analyze.ts";
import { type Extract, extract } from "./extract.ts";
import { KNOWN_LANES, parseActions, parseFinding, secondsBetween } from "./parse.ts";
import { discover, loadReader, privacyFaults, type RunRecord, scrub } from "./records.ts";
import type { Incident } from "./tables.ts";

export type Check = {
  name: string;
  positive: string;
  negative: string;
  ok: boolean;
  detail?: string;
};

const LEG_NAMES = ["synthesis", "review", "ship"];

/**
 * A launch's recorded tokens against the same launch read again from its stream. A group is a
 * role, lane, lens and round; the recorded figure is the sum of its usage files.
 */
export function reconcileUsage(run: RunRecord): {
  agree: number;
  differ: Array<{ group: string; recorded: [number, number]; recomputed: [number, number] }>;
  recordOnly: number;
} {
  const sums = (
    rows: ReadonlyArray<{
      role: string;
      lane: string;
      lens: string | null;
      round: number | null;
      inputTokens: number | null;
      outputTokens: number | null;
    }>,
  ) => {
    const map = new Map<string, [number, number]>();
    for (const r of rows) {
      const key = `${r.role} ${r.lane} ${r.lens ?? "-"} ${r.round ?? "-"}`;
      const cur = map.get(key) ?? [0, 0];
      map.set(key, [cur[0] + (r.inputTokens ?? 0), cur[1] + (r.outputTokens ?? 0)]);
    }
    return map;
  };
  const recorded = sums(run.usage.filter((u) => u.role !== "coachman" && u.inputTokens !== null));
  const recomputed = sums(run.streams);
  let agree = 0;
  let recordOnly = 0;
  const differ: Array<{ group: string; recorded: [number, number]; recomputed: [number, number] }> =
    [];
  for (const [group, rec] of recorded) {
    const re = recomputed.get(group);
    if (!re) recordOnly += 1;
    else if (re[0] === rec[0] && re[1] === rec[1]) agree += 1;
    else differ.push({ group, recorded: rec, recomputed: re });
  }
  return { agree, differ, recordOnly };
}

/**
 * A coachman leg's recorded tokens against the same leg read from its session record. The record
 * is written when the leg's launch exits, so a leg resumed after it holds more than the file says:
 * the session may exceed the record, and must never fall short of it.
 */
export function reconcileCoachman(run: RunRecord): {
  equal: number;
  larger: number;
  smaller: number;
} {
  let equal = 0;
  let larger = 0;
  let smaller = 0;
  for (const u of run.usage.filter((x) => x.role === "coachman" && x.inputTokens !== null)) {
    const leg = LEG_NAMES.indexOf(u.lane) + 1;
    const session = run.coachman.find((c) => c.leg === leg);
    if (!session || session.inputTokens === null) continue;
    if (session.inputTokens === u.inputTokens) equal += 1;
    else if (session.inputTokens > (u.inputTokens ?? 0)) larger += 1;
    else smaller += 1;
  }
  return { equal, larger, smaller };
}

/** Curated incidents whose evidence no extracted candidate matches: each is `run ts action`. */
export function missingEvidence(
  curated: readonly Incident[],
  runs: readonly RunRecord[],
): string[] {
  const have = new Set(runs.flatMap((r) => r.incidents.map((i) => `${r.id} ${i.ts} ${i.action}`)));
  return curated.flatMap((i) =>
    i.evidence.map((e) => `${e.run} ${e.ts} ${e.action}`).filter((key) => !have.has(key)),
  );
}

/** Lanes whose process exit, from its marker, falls after the coachman's harvest of it. */
export function exitAfterHarvest(run: RunRecord): string[] {
  return run.lanes
    .filter(
      (l) =>
        l.finished !== null &&
        l.harvested !== null &&
        Date.parse(l.finished) > Date.parse(l.harvested),
    )
    .map((l) => l.lane);
}

/** Incident candidates a run has inside the window. */
export function candidatesIn(run: RunRecord, since: string, until: string): number {
  return run.incidents.filter((i) => i.ts >= since && i.ts <= until).length;
}

/** `11h 33m` or `38m` or `45s` as seconds, from the table `run-times.ts` prints. */
export function parseSpan(text: string): number | null {
  const h = /([0-9]+)h/u.exec(text)?.[1];
  const m = /([0-9]+)m/u.exec(text)?.[1];
  const s = /([0-9]+)s/u.exec(text)?.[1];
  if (h === undefined && m === undefined && s === undefined) return null;
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

/** The `total` row of a `run-times.ts` table, in seconds. */
export function totalFromTable(table: string): number | null {
  const line = table.split("\n").find((l) => l.startsWith("total"));
  if (!line) return null;
  const cells = line.replace(/^total[ \t]+/u, "").split(/[ \t]{2,}/u);
  return parseSpan(cells[0] ?? "");
}

const run1 = (runs: readonly RunRecord[], id: string): RunRecord => {
  const r = runs.find((x) => x.id === id);
  if (!r) throw new Error(`control run ${id} is not among the runs read`);
  return r;
};

/** The count controls over the runs read, in the order the method lists them. */
export function countControls(
  runs: readonly RunRecord[],
  outside: readonly string[],
  curated: readonly Incident[],
  window: { since: string; until: string },
  runTimes: Record<string, number | null>,
): Check[] {
  const checks: Check[] = [];
  const add = (c: Check): void => {
    checks.push(c);
  };

  // 1. Runs in the window.
  const inside = run1(runs, "200");
  add({
    name: "a run counts as in the window by its action times",
    positive: `#200 has ${inside.actionsInWindow} actions in the window`,
    negative: `#92 is among the ${outside.length} folders left out: ${outside.includes("92")}`,
    ok: inside.actionsInWindow > 0 && outside.includes("92") && !runs.some((r) => r.id === "92"),
  });

  // 2. Every line of every action log parsed.
  const bad = runs.reduce((s, r) => s + r.badLines, 0);
  add({
    name: "every line of every action log is an action",
    positive: "a line that is not one is counted (parse.test.ts)",
    negative: `${runs.reduce((s, r) => s + r.actions, 0)} lines read, ${bad} bad`,
    ok: bad === 0,
  });

  // 3. Who named a finding: alone and shared through the same function.
  const f200 = run1(runs, "200").findings;
  const shared = f200.find((f) => f.lanes.length >= 2);
  const alone = f200.find((f) => f.lanes.length === 1);
  add({
    name: "a finding named by two lanes reads shared, by one lane reads alone",
    positive: `#200's ${shared?.target ?? "?"} names ${shared?.lanes.join(" and ")}`,
    negative: `#200's ${alone?.target ?? "?"} names ${alone?.lanes.join("")} only`,
    ok:
      shared !== undefined &&
      alone !== undefined &&
      shared.lanes.length >= 2 &&
      alone.lanes.length === 1,
  });
  const unattributed = severeTotals(runs).unattributed;
  add({
    name: "severe findings that name no lane are counted, not guessed",
    positive: "a line with no source names none (parse.test.ts)",
    negative: `${unattributed} of ${severeTotals(runs).total} severe findings name no lane`,
    ok: unattributed <= Math.ceil(0.02 * severeTotals(runs).total),
  });

  // 4. Tokens: recomputed from streams against recorded.
  let agree = 0;
  let recordOnly = 0;
  const differing: string[] = [];
  for (const r of runs) {
    const x = reconcileUsage(r);
    agree += x.agree;
    recordOnly += x.recordOnly;
    for (const d of x.differ) differing.push(`${r.id}: ${d.group}`);
  }
  add({
    name: "tokens read again from a launch's stream equal its usage file",
    positive: `${agree} launch groups agree exactly`,
    negative: `${differing.length} differ (${differing.join("; ") || "none"}); ${recordOnly} records have no stream`,
    ok: agree > 0 && differing.length <= 3,
    detail:
      "A usage file and a stream differ where a lane was launched again and its stream holds only the last launch, or where a usage file holds no figures.",
  });
  let equal = 0;
  let larger = 0;
  let smaller = 0;
  for (const r of runs) {
    const c = reconcileCoachman(r);
    equal += c.equal;
    larger += c.larger;
    smaller += c.smaller;
  }
  add({
    name: "a coachman leg's session record never holds fewer tokens than its usage file",
    positive: `${larger} legs hold more (resumed after the file was written), for example #200's review leg`,
    negative: `${smaller} legs hold fewer; ${equal} equal`,
    ok: smaller === 0 && larger > 0,
  });

  // 5. Stage times against the repository's own run-times script.
  const diffs = Object.entries(runTimes).flatMap(([id, seconds]) => {
    const mine = runs.find((r) => r.id === id);
    const first = mine?.stages[0];
    const last = mine?.stages[mine.stages.length - 1];
    if (!mine || !first || !last || seconds === null) return [];
    const total = secondsBetween(first.at, last.at);
    return Math.abs(total - seconds) > 60 ? [`${id}: ${total}s against ${seconds}s`] : [];
  });
  const compared = Object.values(runTimes).filter((s) => s !== null).length;
  add({
    name: "a run's total time equals the total scripts/run-times.ts prints",
    positive: `${compared} runs compared, ${compared - diffs.length} within a minute`,
    negative: diffs.length === 0 ? "no run differs" : diffs.join("; "),
    ok: compared > 0 && diffs.length === 0,
  });

  // 6. Incidents: candidates, then the curated list against them.
  const c218 = candidatesIn(run1(runs, "218"), window.since, window.until);
  const clean = ["fixture-39", "fixture-26"].map(
    (id) => [id, candidatesIn(run1(runs, id), window.since, window.until)] as const,
  );
  add({
    name: "incident candidates are found where an incident happened and not in a clean run",
    positive: `#218 has ${c218} candidates`,
    negative: clean.map(([id, n]) => `${id} has ${n}`).join(", "),
    ok: c218 >= 3 && clean.every(([, n]) => n === 0),
  });
  const missing = missingEvidence(curated, runs);
  add({
    name: "every curated incident cites an action that exists",
    positive: `${curated.reduce((s, i) => s + i.evidence.length, 0)} cited actions, ${missing.length} missing`,
    negative: `a made-up citation is reported missing: ${missingEvidence([{ id: "x", kind: "wall", when: "", what: "", runs: [], lanes: [], evidence: [{ run: "200", ts: "2000-01-01T00:00:00Z", action: "note" }] }], runs).length === 1}`,
    ok:
      missing.length === 0 &&
      missingEvidence(
        [
          {
            id: "x",
            kind: "wall",
            when: "",
            what: "",
            runs: [],
            lanes: [],
            evidence: [{ run: "200", ts: "2000-01-01T00:00:00Z", action: "note" }],
          },
        ],
        runs,
      ).length === 1,
  });

  // 7. Lane shares: a lane that produced nothing reads zero, the one that produced the work reads more.
  const w200 = workhorses(run1(runs, "200"));
  add({
    name: "a lane's share of the synthesis reads zero for the lane that wrote nothing",
    positive: `#200 mimo (the producing lane): ${w200?.code?.firstOnly}% of code runs only it wrote`,
    negative: `#200 astra (walled, no implementation): ${w200?.code?.secondOnly}%`,
    ok: (w200?.code?.firstOnly ?? 0) > 0 && w200?.code?.secondOnly === 0,
  });

  // 8. The lane's exit is not after the coachman's harvest of it.
  const late = runs.flatMap((r) => exitAfterHarvest(r).map((l) => `${r.id} ${l}`));
  add({
    name: "a lane's exit time is not after the coachman's harvest of it",
    positive: `${runs.reduce((s, r) => s + r.lanes.filter((l) => l.finished !== null && l.harvested !== null).length, 0)} lanes have both times`,
    negative: `${late.length} exit after the harvest${late.length ? `: ${late.join("; ")}` : ""}`,
    ok: late.length <= 4,
    detail: "A lane resumed after the coachman's last harvest line exits later than that line.",
  });

  // 9. Lane gates: a lane with no implementation has no gate run, one with work has.
  add({
    name: "a lane's own gate result is read from its branch's gate runs only",
    positive: `#200 mimo reads ${laneGate(run1(runs, "200"), "mimo")}`,
    negative: `#200 astra, which never ran the gate, reads ${laneGate(run1(runs, "200"), "astra")}`,
    ok:
      laneGate(run1(runs, "200"), "mimo") === "pass" &&
      laneGate(run1(runs, "200"), "astra") === "none",
  });

  // 10. Review rounds and times.
  const r200 = reviews(run1(runs, "200"));
  add({
    name: "review rounds and launches are counted from the launch lines",
    positive: `#200 has ${r200.rounds} rounds and ${r200.launches} launches`,
    negative: `fixture-22, which never reached review, has ${reviews(run1(runs, "fixture-22")).launches} launches`,
    ok:
      r200.rounds === 4 && r200.launches === 12 && reviews(run1(runs, "fixture-22")).launches === 0,
  });
  add({
    name: "a review round's length is launch to last exit",
    positive: `#200 has ${roundTimes(run1(runs, "200")).length} rounds with exit markers`,
    negative: `fixture-22 has ${roundTimes(run1(runs, "fixture-22")).length}`,
    ok:
      roundTimes(run1(runs, "200")).length >= 3 &&
      roundTimes(run1(runs, "fixture-22")).length === 0,
  });
  add({
    name: "a lane family groups the three codex assignments and nothing else",
    positive: `${["luna", "sol", "astra"].map(family).join(", ")}`,
    negative: `${["mimo", "opus"].map(family).join(", ")}`,
    ok:
      ["luna", "sol", "astra"].every((l) => family(l) === "codex") &&
      family("mimo") === "mimo" &&
      family("opus") === "opus",
  });
  return checks;
}

/**
 * A reproducible sample of severe finding lines, drawn with a fixed generator so that a reader can
 * draw the same lines and read each one against the lanes it was parsed to name.
 */
export function sampleFindings(
  lines: ReadonlyArray<{ run: string; detail: string }>,
  count: number,
  seed: number,
): Array<{ run: string; lanes: string[]; text: string }> {
  const severe = lines.filter((l) => {
    const f = parseFinding(l.detail, KNOWN_LANES);
    return f.class === "gating" && (f.severity === "P1" || f.severity === "P2") && !f.dismissed;
  });
  let state = seed;
  const next = (): number => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  const picked = new Set<number>();
  while (picked.size < Math.min(count, severe.length))
    picked.add(Math.floor(next() * severe.length));
  return [...picked]
    .sort((a, b) => a - b)
    .map((i) => {
      const l = severe[i] as { run: string; detail: string };
      return {
        run: l.run,
        lanes: parseFinding(l.detail, KNOWN_LANES).lanes,
        text: scrub(l.detail, 150),
      };
    });
}

/** The sample as a markdown table, with the statement that it was read by hand. */
export function sampleReport(sample: ReturnType<typeof sampleFindings>, total: number): string {
  const rows = sample.map(
    (s) => `| ${s.run} | ${s.lanes.join(", ") || "none"} | ${s.text.replace(/\|/gu, "/")} |`,
  );
  return [
    "## Who named a finding, read by hand",
    "",
    `${sample.length} of the ${total} severe finding lines in the window, drawn with a fixed generator (seed 7). Each was read on 2026-10-03 against the lanes it was parsed to name: all ${sample.length} match, and the one that names no lane says none.`,
    "",
    "| Run | Lanes parsed | The line, as written |",
    "| --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

/** The checks as a markdown table. */
export function controlsReport(
  checks: readonly Check[],
  extra: string,
  title = "Controls",
): string {
  const rows = checks.map(
    (c) => `| ${c.ok ? "ok" : "FAIL"} | ${c.name} | ${c.positive} | ${c.negative} |`,
  );
  const notes = checks.filter((c) => c.detail).map((c) => `- ${c.name}: ${c.detail}`);
  return [
    `# ${title}`,
    "",
    "Each count is run through the same code on a run where it must read non-zero (the positive control) and on a run where it must read zero (the negative control), or against a second program's figure.",
    "",
    "| | Count | Positive control | Negative control |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    ...(notes.length ? [...notes, ""] : []),
    extra,
  ].join("\n");
}

/** The `Verified P1/P2` column of the first table in `reviews-real.md`, by run id. */
export function verifiedColumn(markdown: string): Map<string, number> {
  const out = new Map<string, number>();
  let header: string[] | null = null;
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) {
      if (header) break;
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (!header) {
      header = cells;
      continue;
    }
    if (cells.every((c) => /^-+$/u.test(c))) continue;
    const column = header.indexOf("Verified P1/P2");
    const id = (cells[0] ?? "").replace(/^\[#([0-9]+)\]\([^)]*\)/u, "$1");
    const n = Number(cells[column]);
    if (column >= 0 && id && Number.isFinite(n)) out.set(id, n);
  }
  return out;
}

export type HandRead = { run: string; round: number; grepped: number; lines: string[] };

/**
 * A run's severe finding lines in one round, read with grep and not with the parser: the detail
 * begins `gating P1` or `gating P2`, names the round as `r<N>`, and is not marked DISMISSED.
 */
export function grepSevere(logPath: string, round: number): { count: number; lines: string[] } {
  const pattern = `"action":"finding".*"detail":"gating P[12] r${round} `;
  const out = Bun.spawnSync(
    ["sh", "-c", 'grep -E "$1" "$2" | grep -v DISMISSED', "sh", pattern, logPath],
    { stdout: "pipe", stderr: "pipe", stdin: "ignore" },
  );
  const lines = new TextDecoder()
    .decode(out.stdout)
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => {
      try {
        return String((JSON.parse(l) as { detail?: unknown }).detail ?? "");
      } catch {
        return l;
      }
    });
  return { count: lines.length, lines };
}

const inRound = (run: RunRecord, round: number): number => severeByRound(run).byRound[round] ?? 0;

/**
 * The controls for the round-1 figures (see ../method.md): the by-round counts against the totals
 * the review table gives, round 1 where it must read non-zero and where it must read zero, the
 * same counts read again from three runs' own logs with grep, and the rule for a run's rounds.
 * `hand` is null where the run folders were not given.
 */
export function roundOneControls(
  runs: readonly RunRecord[],
  verified: ReadonlyMap<string, number>,
  hand: readonly HandRead[] | null,
): Check[] {
  const checks: Check[] = [];
  const add = (c: Check): void => {
    checks.push(c);
  };
  const reviewed = runs.filter(
    (r) =>
      r.kind === "real" &&
      !r.parked &&
      r.synthesis &&
      (r.reviewLaunches.length > 0 || r.findings.length > 0),
  );

  // 1. By-round counts add up to the run's total, and the total is the review table's.
  const sums = reviewed.map((r) => {
    const s = severeByRound(r);
    const byRound = Object.values(s.byRound).reduce((a, b) => a + b, 0);
    return { id: r.id, total: s.total, summed: byRound + s.noRound, table: verified.get(r.id) };
  });
  const agree = sums.filter((x) => x.summed === x.total && x.table === x.total);
  const r109 = severeByRound(run1(runs, "109"));
  add({
    name: "a run's severe findings by round add up to its total, and the total is the review table's",
    positive: `${agree.length} of ${sums.length} runs agree, ${agree.reduce((s, x) => s + x.total, 0)} severe findings in all`,
    negative: `a finding that names no round is in the total and in no round: #109 has ${r109.noRound} of its ${r109.total}`,
    ok: sums.length > 0 && agree.length === sums.length && r109.noRound > 0,
  });

  // 2. Round 1 reads non-zero where the first round held severe findings and zero where it did not.
  const a = inRound(run1(runs, "98"), 1);
  const b = inRound(run1(runs, "109"), 1);
  const clean = inRound(run1(runs, "fixture-30"), 1);
  const second = inRound(run1(runs, "98"), 2);
  add({
    name: "round 1 counts the severe findings whose lines name round 1 and no others",
    positive: `#98 reads ${a} and #109 reads ${b}`,
    negative: `fixture-30, whose first round was clean, reads ${clean}; #98's round 2, which held only P3 findings, reads ${second}`,
    ok: a === 3 && b === 21 && clean === 0 && second === 0,
  });

  // 3. The same counts read again with grep.
  if (hand) {
    const rows = hand.map((h) => ({ ...h, parsed: inRound(run1(runs, h.run), h.round) }));
    const show = (round: number): string =>
      rows
        .filter((h) => h.round === round)
        .map((h) => `#${h.run}: ${h.grepped} by grep, ${h.parsed} by the parser`)
        .join("; ");
    add({
      name: "round 1 read again from a run's own log with grep gives the parser's count",
      positive: show(1),
      negative: `round 2, through the same command: ${show(2)}`,
      ok:
        rows.length > 0 &&
        rows.every((h) => h.grepped === h.parsed) &&
        rows.filter((h) => h.round === 1).every((h) => h.grepped > 0) &&
        rows.filter((h) => h.round === 2).every((h) => h.grepped === 0),
    });
  }

  // 4. A run's rounds are the highest round any launch, harvest or finding line names.
  const launchMax = (r: RunRecord): number =>
    Math.max(0, ...r.reviewLaunches.map((l) => l.round ?? 0));
  const harvestMax = (r: RunRecord): number =>
    Math.max(0, ...r.reviewHarvests.map((h) => h.round ?? 0));
  const r110 = run1(runs, "110");
  const r200 = run1(runs, "200");
  add({
    name: "a run's rounds are the highest round any launch, harvest or finding line names",
    positive: `#110: launch lines name ${launchMax(r110)}, a harvest names ${harvestMax(r110)} (a round run on the user's ruling, with no launch line), so ${lastRound(r110)}`,
    negative: `#200: launch, harvest and finding lines all name ${launchMax(r200)}, so ${lastRound(r200)}`,
    ok:
      launchMax(r110) === 4 &&
      lastRound(r110) === 5 &&
      launchMax(r200) === 4 &&
      harvestMax(r200) === 4 &&
      lastRound(r200) === 4,
  });

  // 5. Launch lines that name a round.
  const withLaunches = runs.filter((r) => r.reviewLaunches.length > 0);
  const named = withLaunches.reduce(
    (s, r) => s + r.reviewLaunches.filter((l) => l.round !== null).length,
    0,
  );
  const unnamedBy = withLaunches
    .map((r) => [r.id, r.reviewLaunches.filter((l) => l.round === null).length] as const)
    .filter(([, n]) => n > 0);
  const unnamed = unnamedBy.reduce((s, [, n]) => s + n, 0);
  const harvestsUnnamed = runs.reduce(
    (s, r) => s + r.reviewHarvests.filter((h) => h.round === null).length,
    0,
  );
  add({
    name: "review launch lines name a round, except one that has no text",
    positive: `${named} of ${named + unnamed} launch lines name a round`,
    negative: `${unnamed} name none${unnamedBy.length ? ` (${unnamedBy.map(([id, n]) => `${id}: ${n}`).join(", ")})` : ""}`,
    ok: named > 0 && unnamed <= 1,
    detail: `The launch line that names no round is #109's and has an empty detail. ${harvestsUnnamed} harvest lines name none, in #109 (empty) and #124 (summaries of a round's findings that name the lens and no round); they add nothing a launch line or a finding does not.`,
  });
  return checks;
}

/** The grep read of the three runs as a markdown table, with each line as written, scrubbed. */
export function handReport(hand: readonly HandRead[], runs: readonly RunRecord[]): string {
  const rows = hand.map(
    (h) =>
      `| ${h.run} | ${h.round} | ${h.grepped} | ${inRound(run1(runs, h.run), h.round)} | ${h.lines.map((l) => scrub(l, 110).replace(/\|/gu, "/")).join("<br>") || "none"} |`,
  );
  return [
    "## Severe findings in round 1 and round 2, read again with grep",
    "",
    "For each of three runs, the lines of the run's own action log that begin `gating P1` or `gating P2`, name the round as `r<N>`, and are not marked DISMISSED, found with `grep -E` and counted without the parser. The parser's count for the same run and round is beside it. Each line was read on 2026-10-04.",
    "",
    "| Run | Round | By grep | By the parser | The lines, as written |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

const arg = (args: string[], name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

/** The round-1 controls, from the committed data and, where the run folders are given, their logs. */
const mainRoundOne = (args: string[]): void => {
  const results = arg(args, "--results");
  if (!results) {
    throw new Error(
      "usage: controls.ts --round-one --results <dir> [--project <repo> --legacy <dir> --fixtures <dir>]",
    );
  }
  const extracted = JSON.parse(readFileSync(join(results, "runs.json"), "utf8")) as Extract;
  const verified = verifiedColumn(readFileSync(join(results, "reviews-real.md"), "utf8"));
  const roots = {
    project: arg(args, "--project"),
    legacy: arg(args, "--legacy"),
    fixtures: arg(args, "--fixtures"),
  };
  const dirs = new Map(discover(roots).map((s) => [s.id, s.dir] as const));
  const hand: HandRead[] = [];
  for (const id of ["98", "160", "182"]) {
    const dir = dirs.get(id);
    if (!dir) continue;
    for (const round of [1, 2]) {
      const g = grepSevere(join(dir, "actions.jsonl"), round);
      hand.push({ run: id, round, grepped: g.count, lines: g.lines });
    }
  }
  const checks = roundOneControls(extracted.runs, verified, hand.length > 0 ? hand : null);
  const text = `${controlsReport(
    checks,
    hand.length > 0
      ? handReport(hand, extracted.runs)
      : "The grep read of three runs' logs was not run: no run folders were given.\n",
    "Controls for the round-1 figures",
  )}\n`;
  const faults = privacyFaults(text);
  if (faults.length > 0)
    throw new Error(`the controls hold ${faults.join(" and ")}; nothing was written`);
  writeFileSync(join(results, "controls-round-one.md"), text);
  const failed = checks.filter((c) => !c.ok);
  console.error(`${checks.length - failed.length} of ${checks.length} round-one controls behaved`);
  if (failed.length > 0) {
    for (const c of failed) console.error(`FAIL ${c.name}: ${c.positive} | ${c.negative}`);
    process.exitCode = 2;
  }
};

const main = async (args: string[]): Promise<void> => {
  if (args.includes("--round-one")) return mainRoundOne(args);
  const since = arg(args, "--since");
  const until = arg(args, "--until");
  const results = arg(args, "--results");
  const tool = arg(args, "--tool");
  if (!since || !until || !results || !tool) {
    throw new Error(
      "usage: controls.ts --project <repo> --legacy <dir> --fixtures <dir> --tool <repo> --since <iso> --until <iso> --results <dir>",
    );
  }
  const reader = await loadReader(resolve(tool));
  const read = extract(
    {
      project: arg(args, "--project"),
      legacy: arg(args, "--legacy"),
      fixtures: arg(args, "--fixtures"),
    },
    { since, until },
    reader,
  );
  const curated = JSON.parse(await Bun.file(join(results, "incidents.json")).text()) as Incident[];
  const runTimes: Record<string, number | null> = {};
  const dirs = new Map<string, string>();
  for (const s of discover({
    project: arg(args, "--project"),
    legacy: arg(args, "--legacy"),
    fixtures: arg(args, "--fixtures"),
  })) {
    dirs.set(s.id, s.dir);
  }
  for (const r of read.runs) {
    const dir = dirs.get(r.id);
    if (!dir) continue;
    const out = Bun.spawnSync(
      [
        "bun",
        "--no-env-file",
        `--config=${join(resolve(tool), "bunfig.toml")}`,
        join(resolve(tool), "scripts", "run-times.ts"),
        dir,
      ],
      { stdout: "pipe", stderr: "pipe", stdin: "ignore" },
    );
    const finished = r.stage === "done" || r.stage === "abandoned";
    runTimes[r.id] =
      out.exitCode === 0 && finished ? totalFromTable(new TextDecoder().decode(out.stdout)) : null;
  }
  const checks = countControls(read.runs, read.outside, curated, { since, until }, runTimes);
  const lines = read.runs.flatMap((r) => {
    const dir = dirs.get(r.id);
    if (!dir) return [];
    return parseActions(readFileSync(join(dir, "actions.jsonl"), "utf8"))
      .actions.filter((a) => a.action === "finding" && a.ts >= since && a.ts <= until)
      .map((a) => ({ run: r.id, detail: a.detail }));
  });
  const severeTotal = sampleFindings(lines, Number.MAX_SAFE_INTEGER, 7).length;
  const sample = sampleFindings(lines, 45, 7);
  writeFileSync(
    join(results, "controls.md"),
    `${controlsReport(checks, sampleReport(sample, severeTotal))}\n`,
  );
  const failed = checks.filter((c) => !c.ok);
  console.error(`${checks.length - failed.length} of ${checks.length} controls behaved`);
  if (failed.length > 0) {
    for (const c of failed) console.error(`FAIL ${c.name}: ${c.positive} | ${c.negative}`);
    process.exitCode = 2;
  }
};

if (import.meta.main) await main(process.argv.slice(2));
