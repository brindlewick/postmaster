// Tests beside scripts/ticket-ready.ts: the readiness matrix on a local store,
// the marking and queue verbs, the kind=other forms, and the same matrix
// through the github and plane test doubles.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scriptsDir } from "./lib/paths.ts";
import { run } from "./lib/proc.ts";
import { mdToHtml } from "./plane.ts";
import { storedMatches } from "./ticket-ready.ts";

const self = join(scriptsDir(import.meta), "run");
const localSh = join(scriptsDir(import.meta), "run");

const TWO_PART = [
  "## Problem / feature",
  "",
  "The list view shows entries in whatever order they arrive. When this is done the list shows entries sorted by name.",
  "",
  "## Acceptance criteria",
  "",
  "1. The list shows its entries sorted by name.",
  "",
  "## Decisions",
  "",
  "- **D1 (proposed)** Sorting ignores letter case. Why: users expect mixed-case names together. Instead of: byte order, which splits them.",
  "",
  "## Out of scope",
  "",
  "- Grouping entries by kind.",
  "",
  "## Direction",
  "",
  "Linux and macOS. None: any approach that meets the criterion.",
  "",
  "## Turnpikes",
  "",
  "default",
  "",
  "## For the agents",
  "",
  "*Everything above is what the user signed off. This part follows from it and adds nothing to it.*",
  "",
  "### Checks",
  "",
  "- **C1** `list --sort name` on three entries out of order → names in case-blind order, exit 0. **At the base:** entries arrive unsorted.",
  "",
  "### Technical notes",
  "",
  "- The list renders in `list.ts`, sorted with a case-blind comparator. (C1, D1)",
  "",
  "### Verified at ede70e2",
  "",
  "- `list.ts` exists and renders entries unsorted.",
  "",
].join("\n");

const ONE_PART = [
  "## Problem / feature",
  "",
  "A task added by mistake stays on the list for good.",
  "",
  "## Acceptance criteria",
  "",
  "1. The remove command deletes a task by id.",
  "2. The remove command takes several ids.",
  "",
  "## Direction",
  "",
  "Follow the existing split. Add no dependency.",
  "",
  "## Turnpikes",
  "",
  "default",
  "",
].join("\n");

const DRAFT = "DRAFT: still being written\n\n";

let tmp = "";
let repo = "";

function ready(args: string[], env?: Record<string, string | undefined>) {
  const r = run(self, ["ticket-ready", ...args], env ? { env } : {});
  return { code: r.code, out: `${r.out ?? ""}${r.err ?? ""}` };
}

function local(args: string[]) {
  const r = run(localSh, ["local", repo, ...args]);
  if (r.code !== 0) throw new Error(`run local ${args.join(" ")} failed: ${r.out}${r.err}`);
  return (r.out ?? "").trim();
}

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "ticket-ready-"));
  repo = join(tmp, "repo");
  mkdirSync(repo, { recursive: true });
  if (run("git", ["init", "-q", repo]).code !== 0) throw new Error("git init failed");
  if (run(localSh, ["local", repo, "store", "init"]).code !== 0)
    throw new Error("store init failed");
  const a = join(tmp, "a.md");
  const c = join(tmp, "c.md");
  const d = join(tmp, "d.md");
  writeFileSync(a, TWO_PART);
  writeFileSync(c, ONE_PART);
  writeFileSync(d, `${DRAFT}${TWO_PART}`);
  local(["create", "Sorted list", a]);
  local(["create", "Fix the list", a]);
  local(["create", "Remove", c]);
  local(["create", "Draft list", d]);
  local(["label", "1", "add", "ready"]);
  local(["label", "3", "add", "ready"]);
  local(["label", "4", "add", "ready"]);
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("the readiness matrix on a local store", () => {
  test("a marked ticket passing both checks reads ready", () => {
    const r = ready([repo, "1"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("ready: 1");
    expect(r.out).toContain("turnpikes: style, bug, security");
  }, 30000);

  test("an unmarked ticket names the missing mark", () => {
    const r = ready([repo, "2"]);
    expect(r.code).toBe(2);
    expect(r.out).toBe("ready label is missing\n");
  }, 30000);

  test("a one-part ticket names the parts finding", () => {
    const r = ready([repo, "3"]);
    expect(r.code).toBe(2);
    expect(r.out).toContain("ticket-parts:");
    expect(r.out).toContain("For the agents");
    expect(r.out.includes("ready label is missing")).toBe(false);
  }, 30000);

  test("a draft ticket names the draft line once", () => {
    const r = ready([repo, "4"]);
    expect(r.code).toBe(2);
    const drafts = r.out.split("\n").filter((l) => /draft/iu.test(l));
    expect(drafts.length).toBe(1);
  }, 30000);

  test("a ticket failing several ways names every reason", () => {
    const e = join(tmp, "e.md");
    writeFileSync(e, `${DRAFT}${ONE_PART}`);
    const n = local(["create", "Bad all ways", e]);
    const r = ready([repo, n]);
    expect(r.code).toBe(2);
    expect(/draft/iu.test(r.out)).toBe(true);
    expect(/parts|for the agents/iu.test(r.out)).toBe(true);
    expect(/ready label is missing/iu.test(r.out)).toBe(true);
  }, 30000);

  test("an unknown id exits 1", () => {
    const r = ready([repo, "9999"]);
    expect(r.code).toBe(1);
  }, 30000);

  test("one label holding a comma is not the ready mark", () => {
    const n = local(["create", "Comma label", join(tmp, "a.md")]);
    local(["label", n, "add", "blocked, ready"]);
    const r = ready([repo, n]);
    expect(r.code).toBe(2);
    expect(r.out).toContain("ready label is missing");
    local(["label", n, "add", "ready"]);
    expect(ready([repo, n]).code).toBe(0);
  }, 30000);
});

describe("the marking and queue verbs", () => {
  test("marking a failing ticket exits 2 and adds no label", () => {
    const before = run(localSh, ["local", repo, "read", "3"]);
    const r = ready(["mark", repo, "3"]);
    expect(r.code).toBe(2);
    const after = run(localSh, ["local", repo, "read", "3"]);
    expect(after.out).toContain("labels: ready");
    expect(before.out.split("\n").find((l) => l.startsWith("labels:"))).toBe(
      after.out.split("\n").find((l) => l.startsWith("labels:")),
    );
  }, 30000);

  test("marking a passing ticket labels, notes and queues it", () => {
    const r = ready(["mark", repo, "2"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("marked ready and queued");
    expect(run(localSh, ["local", repo, "read", "2"]).out).toContain("labels: ready");
    const ledger = readFileSync(join(repo, ".postmaster", "runs", "ledger.jsonl"), "utf8");
    expect(ledger).toContain('"action":"note"');
    expect(ledger).toContain("turnpikes: style, bug, security");
    expect(ledger).toContain('"action":"ticket-edit"');
    expect(ledger).toContain("label add ready");
    expect(ready([repo, "2"]).code).toBe(0);
    expect(ready(["pending", repo]).out.split("\n")).toContain("2");
  }, 30000);

  test("mark writes a draft body and title through the adapter", () => {
    const n = local(["create", "Old title", join(tmp, "c.md")]);
    const f = join(tmp, "final.md");
    writeFileSync(f, TWO_PART);
    const r = ready(["mark", repo, n, "--body", f, "--title", "New title"]);
    expect(r.code).toBe(0);
    const read = run(localSh, ["local", repo, "read", n]).out;
    expect(read).toContain("title: New title");
    expect(read).toContain("labels: ready");
    expect(read).toContain("## For the agents");
    const ledger = readFileSync(join(repo, ".postmaster", "runs", "ledger.jsonl"), "utf8");
    expect(ledger).toContain("body updated");
    expect(ledger).toContain("title updated");
    expect(ledger).toContain("label add ready");
  }, 30000);

  test("marking a commented ticket writes the draft against the stored body", () => {
    const n = local(["create", "Old title", join(tmp, "c.md")]);
    expect(run(localSh, ["local", repo, "comment", n, "coachman", "prior discussion"]).code).toBe(
      0,
    );
    const f = join(tmp, "final-commented.md");
    writeFileSync(f, TWO_PART);
    const r = ready(["mark", repo, n, "--body", f, "--title", "New title"]);
    expect(r.code).toBe(0);
    const read = run(localSh, ["local", repo, "read", n]).out;
    expect(read).toContain("title: New title");
    expect(read).toContain("labels: ready");
    expect(read).toContain("## For the agents");
    expect(ready([repo, n]).code).toBe(0);
  }, 30000);

  test("a genuine Log-shaped tail binds fully: editing it refuses", () => {
    const f = join(tmp, "tailed.md");
    writeFileSync(f, `${TWO_PART}\n## Log\n- signed note\n`);
    const n = local(["create", "Tailed text", f]);
    expect(ready(["mark", repo, n]).code).toBe(0);
    expect(ready([repo, n]).code).toBe(0);
    const live = run(localSh, ["local", repo, "read", n, "--body"]);
    const baseFile = join(tmp, "tail-base.md");
    const newFile = join(tmp, "tail-new.md");
    writeFileSync(baseFile, live.out ?? "");
    writeFileSync(newFile, (live.out ?? "").replace("- signed note", "- swapped note"));
    expect(run(localSh, ["local", repo, "edit", n, newFile, baseFile]).code).toBe(0);
    const changed = ready([repo, n]);
    expect(changed.code).toBe(2);
    expect(changed.out).toContain("changed since it was signed off");
  }, 60000);

  test("a post-sign-off turnpikes edit refuses until the ticket is signed off again", () => {
    const n = local(["create", "Bound text", join(tmp, "a.md")]);
    expect(ready(["mark", repo, n]).code).toBe(0);
    expect(ready([repo, n]).code).toBe(0);
    expect(ready(["queue", repo, n]).code).toBe(0);
    expect(ready(["pending", repo]).out.split("\n")).toContain(n);
    const marker = readFileSync(
      join(repo, ".postmaster", "runs", "postmaster", "ready", `${n}.ready`),
      "utf8",
    ).split("\n");
    expect(marker[0]).toBe(n);
    expect(/^[0-9a-f]{64}$/u.test(marker[1] ?? "")).toBe(true);
    // The attack: drop the review leg after sign-off.
    const live = run(localSh, ["local", repo, "read", n, "--body"]);
    const baseFile = join(tmp, "bind-base.md");
    const newFile = join(tmp, "bind-new.md");
    writeFileSync(baseFile, live.out ?? "");
    writeFileSync(
      newFile,
      (live.out ?? "").replace("## Turnpikes\n\ndefault", "## Turnpikes\n\nnone"),
    );
    expect(run(localSh, ["local", repo, "edit", n, newFile, baseFile]).code).toBe(0);
    const changed = ready([repo, n]);
    expect(changed.code).toBe(2);
    expect(changed.out).toContain("changed since it was signed off");
    // Queue does not rebind a changed ticket.
    const q = ready(["queue", repo, n]);
    expect(q.code).toBe(2);
    expect(q.out).toContain("changed since it was signed off");
    // Re-signing binds the new text.
    expect(ready(["mark", repo, n]).code).toBe(0);
    const again = ready([repo, n]);
    expect(again.code).toBe(0);
    expect(again.out).toContain("turnpikes: none");
  }, 60000);

  test("a malformed marker fails closed instead of reading unbound", () => {
    const n = local(["create", "Ragged marker", join(tmp, "a.md")]);
    expect(ready(["mark", repo, n]).code).toBe(0);
    const marker = join(repo, ".postmaster", "runs", "postmaster", "ready", `${n}.ready`);
    writeFileSync(marker, `${n}\nNOT-A-DIGEST\n`);
    const bad = ready([repo, n]);
    expect(bad.code).toBe(2);
    expect(bad.out).toContain("marker for");
    expect(bad.out).toContain("is malformed");
    expect(ready(["queue", repo, n]).code).toBe(2);
    writeFileSync(marker, `${n}\n`);
    const short = ready([repo, n]);
    expect(short.code).toBe(2);
    expect(short.out).toContain("is malformed");
    // The named recovery works: unmark, then sign off again.
    expect(ready(["unmark", repo, n]).code).toBe(0);
    expect(ready(["mark", repo, n]).code).toBe(0);
    expect(ready([repo, n]).code).toBe(0);
  }, 60000);

  test("a comment after sign-off stays ready, and an edit under it still refuses", () => {
    const n = local(["create", "Commented text", join(tmp, "a.md")]);
    expect(ready(["mark", repo, n]).code).toBe(0);
    expect(run(localSh, ["local", repo, "comment", n, "coachman", "noting progress"]).code).toBe(0);
    expect(ready([repo, n]).code).toBe(0);
    expect(ready(["queue", repo, n]).code).toBe(0);
    // Queue binds the stored bytes it checked, not the display body: the
    // ticket stays ready with the comment present.
    expect(ready([repo, n]).code).toBe(0);
    const live = run(localSh, ["local", repo, "read", n, "--body"]);
    const baseFile = join(tmp, "comment-base.md");
    const newFile = join(tmp, "comment-new.md");
    writeFileSync(baseFile, live.out ?? "");
    writeFileSync(
      newFile,
      (live.out ?? "").replace("## Turnpikes\n\ndefault", "## Turnpikes\n\nnone"),
    );
    expect(run(localSh, ["local", repo, "edit", n, newFile, baseFile]).code).toBe(0);
    const changed = ready([repo, n]);
    expect(changed.code).toBe(2);
    expect(changed.out).toContain("changed since it was signed off");
  }, 60000);

  test("storedMatches compares with the adapter's own base check", () => {
    const n = local(["create", "Match probe", join(tmp, "a.md")]);
    const first = run(localSh, ["local", repo, "read", n, "--body"]).out ?? "";
    expect(storedMatches(repo, n, "local", first)).toBeNull();
    const baseFile = join(tmp, "match-base.md");
    const newFile = join(tmp, "match-new.md");
    writeFileSync(baseFile, first);
    writeFileSync(newFile, first.replace("## Turnpikes\n\ndefault", "## Turnpikes\n\nnone"));
    expect(run(localSh, ["local", repo, "edit", n, newFile, baseFile]).code).toBe(0);
    const reason = storedMatches(repo, n, "local", first);
    expect(reason).toContain("changed since");
    // The mark-time rollback on a mismatch needs a concurrent edit mid-mark
    // and stays untested; every mark test exercises the match path.
  }, 30000);

  test("a post-sign-off title edit refuses as well", () => {
    const n = local(["create", "Bound title", join(tmp, "a.md")]);
    expect(ready(["mark", repo, n]).code).toBe(0);
    expect(run(localSh, ["local", repo, "title", n, "Bound title, revised"]).code).toBe(0);
    const changed = ready([repo, n]);
    expect(changed.code).toBe(2);
    expect(changed.out).toContain("changed since it was signed off");
  }, 60000);

  test("unmark drops the label and the marker, consume drops only the marker", () => {
    const r = ready(["unmark", repo, "2"]);
    expect(r.code).toBe(0);
    expect(run(localSh, ["local", repo, "read", "2"]).out).toContain("labels: \n");
    const ledger = readFileSync(join(repo, ".postmaster", "runs", "ledger.jsonl"), "utf8");
    expect(ledger).toContain("label remove ready");
    expect(ready(["pending", repo]).out.split("\n").includes("2")).toBe(false);
    expect(ready([repo, "2"]).code).toBe(2);
    expect(ready(["mark", repo, "2"]).code).toBe(0);
    expect(ready(["consume", repo, "2"]).code).toBe(0);
    expect(run(localSh, ["local", repo, "read", "2"]).out).toContain("labels: ready");
    expect(ready(["pending", repo]).out.split("\n").includes("2")).toBe(false);
  }, 30000);

  test("queue checks before it queues", () => {
    expect(ready(["queue", repo, "3"]).code).toBe(2);
    expect(ready(["pending", repo]).out.split("\n").includes("3")).toBe(false);
    expect(ready(["queue", repo, "1"]).code).toBe(0);
    expect(ready(["pending", repo]).out.split("\n")).toContain("1");
  }, 30000);
});

describe("a tracker of kind other", () => {
  test("a body file and label list read ready and unready", () => {
    const a = join(tmp, "a.md");
    const good = ready([
      "--body",
      a,
      "--labels",
      "ready",
      "--title",
      "Sorted list",
      "--project",
      repo,
      "--id",
      "EXT-9",
    ]);
    expect(good.code).toBe(0);
    const bad = ready([
      "--body",
      a,
      "--labels",
      "",
      "--title",
      "Sorted list",
      "--project",
      repo,
      "--id",
      "EXT-9",
    ]);
    expect(bad.code).toBe(2);
    expect(bad.out).toContain("ready label is missing");
  }, 30000);

  test("each --labels flag names one label, and a lone comma flag is refused", () => {
    const a = join(tmp, "a.md");
    const base = ["--body", a, "--title", "Sorted list", "--project", repo, "--id", "EXT-8"];
    const lone = ready([...base, "--labels", "blocked, ready"]);
    expect(lone.code).toBe(1);
    expect(lone.out).toContain("is ambiguous; pass --labels once per label");
    const exact = ready([...base, "--labels", "blocked, ready", "--labels", "other"]);
    expect(exact.code).toBe(2);
    expect(exact.out).toContain("ready label is missing");
    const marked = ready([...base, "--labels", "blocked, ready", "--labels", "ready"]);
    expect(marked.code).toBe(0);
    const plain = ready([...base, "--labels", "ready"]);
    expect(plain.code).toBe(0);
  }, 30000);

  test("mark records the marking once the label is applied outside", () => {
    const a = join(tmp, "a.md");
    const early = ready(["mark", "--body", a, "--labels", "", "--repo", repo, "--id", "EXT-1"]);
    expect(early.code).toBe(2);
    expect(early.out).toContain("through the tracker's own tooling");
    const r = ready(["mark", "--body", a, "--labels", "ready", "--repo", repo, "--id", "EXT-1"]);
    expect(r.code).toBe(0);
    expect(ready(["pending", repo]).out.split("\n")).toContain("EXT-1");
  }, 30000);

  test("a body changed after marking refuses until marked again", () => {
    const f = join(tmp, "bind-other.md");
    writeFileSync(f, readFileSync(join(tmp, "a.md"), "utf8"));
    const markArgs = (file: string) => [
      "mark",
      "--body",
      file,
      "--labels",
      "ready",
      "--repo",
      repo,
      "--id",
      "EXT-7",
      "--title",
      "Sorted list",
    ];
    const checkArgs = (file: string) => [
      "--body",
      file,
      "--labels",
      "ready",
      "--title",
      "Sorted list",
      "--project",
      repo,
      "--id",
      "EXT-7",
    ];
    expect(ready(markArgs(f)).code).toBe(0);
    expect(ready(checkArgs(f)).code).toBe(0);
    writeFileSync(
      f,
      readFileSync(f, "utf8").replace("## Turnpikes\n\ndefault", "## Turnpikes\n\nnone"),
    );
    const changed = ready(checkArgs(f));
    expect(changed.code).toBe(2);
    expect(changed.out).toContain("changed since it was signed off");
    expect(ready(markArgs(f)).code).toBe(0);
    const again = ready(checkArgs(f));
    expect(again.code).toBe(0);
    expect(again.out).toContain("turnpikes: none");
  }, 60000);

  test("a malformed marker on the body form names the external recovery", () => {
    const a = join(tmp, "a.md");
    const markArgs = [
      "mark",
      "--body",
      a,
      "--labels",
      "ready",
      "--repo",
      repo,
      "--id",
      "EXT-6",
      "--title",
      "Sorted list",
    ];
    expect(ready(markArgs).code).toBe(0);
    const marker = join(repo, ".postmaster", "runs", "postmaster", "ready", "EXT-6.ready");
    writeFileSync(marker, "EXT-6\nbogus\n");
    const checkArgs = [
      "--body",
      a,
      "--labels",
      "ready",
      "--title",
      "Sorted list",
      "--project",
      repo,
      "--id",
      "EXT-6",
    ];
    const bad = ready(checkArgs);
    expect(bad.code).toBe(2);
    expect(bad.out).toContain("is malformed");
    expect(bad.out).toContain("through the tracker's own tooling");
  }, 60000);

  test("the check without a project or id is refused", () => {
    const a = join(tmp, "a.md");
    expect(ready(["--body", a, "--labels", "ready", "--project", repo]).code).toBe(1);
    expect(ready(["--body", a, "--labels", "ready", "--id", "EXT-9"]).code).toBe(1);
  }, 30000);

  test("the adapter verbs refuse with the body-and-labels form", () => {
    const otherRepo = join(tmp, "other-repo");
    mkdirSync(otherRepo, { recursive: true });
    if (run("git", ["init", "-q", otherRepo]).code !== 0) throw new Error("git init failed");
    const cfg = join(tmp, "other-config.toml");
    writeFileSync(cfg, '[tracker]\nkind = "other"\n');
    const env = { ...process.env, POSTMASTER_CONFIG: cfg };
    for (const args of [
      [otherRepo, "EXT-1"],
      ["mark", otherRepo, "EXT-1"],
      ["queue", otherRepo, "EXT-1"],
      ["unmark", otherRepo, "EXT-1"],
    ]) {
      const r = ready(args, env);
      expect(r.code).toBe(1);
      expect(r.out).toContain("has no adapter script");
    }
    expect(ready([otherRepo, "EXT-1"], env).out).toContain("run ticket-ready --body <file>");
    expect(ready(["mark", otherRepo, "EXT-1"], env).out).toContain(
      "run ticket-ready mark --body <file>",
    );
    expect(ready(["unmark", otherRepo, "EXT-1"], env).out).toContain("run ticket-ready consume ");
  }, 60000);
});

describe("usage", () => {
  test("no arguments and bad verbs exit 1", () => {
    expect(ready([]).code).toBe(1);
    expect(ready(["mark", repo]).code).toBe(1);
    expect(ready([repo]).code).toBe(1);
  }, 30000);

  test("a flag in a value's place is refused", () => {
    const a = join(tmp, "a.md");
    const r = ready(["--body", a, "--labels", "ready", "--title", "--project", repo]);
    expect(r.code).toBe(1);
    expect(r.out).toContain("--title needs a value; got --project");
    const m = ready(["mark", repo, "1", "--title", "--body", a]);
    expect(m.code).toBe(1);
    expect(m.out).toContain("--title needs a value; got --body");
  }, 30000);
});

// --- the same matrix through the github and plane test doubles ---

const STUB_GH = `#!/usr/bin/env bash
d="$GITHUB_SH_STUB"
case "$1 $2" in
  "auth status") exit 0 ;;
  "api graphql")
    q="" n=""
    for a in "$@"; do case $a in query=*) q=$a ;; number=*) n=\${a#number=} ;; esac; done
    case $q in
      *projectsV2*) cat "$d/boards.json" ;;
      *"issue(number:"*) if [ -f "$d/issue-$n.json" ]; then cat "$d/issue-$n.json"
                         else echo '{"data": {"repository": {"issue": null}}}'; fi ;;
      *) echo "stub gh: unexpected query" >&2; exit 1 ;;
    esac ;;
  "project item-list") cat "$d/items.json" ;;
  "issue edit")
    f="" prev="" body=0
    for a in "$@"; do [ "$prev" = --body-file ] && { f=$a; body=1; }; prev=$a; done
    printf 'call:%s\\n' "$(printf ' [%s]' "$@")" >> "$d/edits.log"
    if [ $body = 1 ]; then cp -- "$f" "$d/edited-body"; fi ;;
  "api "*)
    case "$*" in
      "api repos/o/r/labels/"*) echo '{}' ;;
      "api -X POST repos/o/r/issues/"*) echo '[]' ;;
      *) echo "stub gh: unexpected REST call: $*" >&2; exit 1 ;;
    esac ;;
  *) echo "stub gh: unexpected: $*" >&2; exit 1 ;;
esac
`;

function storedIssue(dir: string, n: number, bodyFile: string, labels: string[]): void {
  const body = readFileSync(bodyFile, "utf8");
  const obj = {
    data: {
      repository: {
        issue: {
          number: n,
          title: n === 2 ? "Fix the list" : `Ticket ${n}`,
          body,
          state: "OPEN",
          stateReason: null,
          url: `https://github.com/o/r/issues/${n}`,
          createdAt: "2026-10-03T00:00:00Z",
          labels: { nodes: labels.map((name) => ({ name })) },
          comments: { nodes: [] },
        },
      },
    },
  };
  writeFileSync(join(dir, `issue-${n}.json`), `${JSON.stringify(obj)}\n`);
}

describe("the matrix through the github double", () => {
  test("ready, unready, one-part, draft and unknown read the same", () => {
    const dir = join(tmp, "gh-double");
    const bin = join(dir, "bin");
    const stub = join(dir, "stub");
    const repoGh = join(dir, "repo");
    mkdirSync(bin, { recursive: true });
    mkdirSync(stub, { recursive: true });
    mkdirSync(repoGh, { recursive: true });
    writeFileSync(join(bin, "gh"), STUB_GH);
    chmodSync(join(bin, "gh"), 0o755);
    if (run("git", ["init", "-q", repoGh]).code !== 0) throw new Error("git init failed");
    if (
      run("git", ["-C", repoGh, "remote", "add", "origin", "https://github.com/o/r.git"]).code !== 0
    )
      throw new Error("git remote add failed");
    const cfg = join(dir, "config.toml");
    writeFileSync(cfg, '[tracker]\nkind = "github"\n');
    writeFileSync(
      join(stub, "boards.json"),
      '{"data": {"repository": {"projectsV2": {"nodes": [{"id": "PVT_1", "number": 1, "title": "r", "closed": false, "url": "https://github.com/users/o/projects/1", "owner": {"login": "o"}}]}}}}\n',
    );
    writeFileSync(join(stub, "items.json"), '{"items": []}\n');
    storedIssue(stub, 1, join(tmp, "a.md"), ["ready"]);
    storedIssue(stub, 2, join(tmp, "a.md"), []);
    storedIssue(stub, 3, join(tmp, "c.md"), ["ready"]);
    storedIssue(stub, 4, join(tmp, "d.md"), ["ready"]);
    storedIssue(stub, 5, join(tmp, "a.md"), ["blocked, ready"]);
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      POSTMASTER_CONFIG: cfg,
      GITHUB_SH_STUB: stub,
    };
    expect(ready([repoGh, "1"], env).code).toBe(0);
    const unmarked = ready([repoGh, "2"], env);
    expect(unmarked.code).toBe(2);
    expect(unmarked.out).toContain("ready label is missing");
    const onePart = ready([repoGh, "3"], env);
    expect(onePart.code).toBe(2);
    expect(onePart.out).toContain("ticket-parts:");
    const draft = ready([repoGh, "4"], env);
    expect(draft.code).toBe(2);
    expect(/draft/iu.test(draft.out)).toBe(true);
    expect(ready([repoGh, "9999"], env).code).toBe(1);
    const comma = ready([repoGh, "5"], env);
    expect(comma.code).toBe(2);
    expect(comma.out).toContain("ready label is missing");
    // Mark through the double exercises the post-write verify on github
    // semantics: the no-op edit must match.
    expect(ready(["mark", repoGh, "1"], env).code).toBe(0);
    expect(ready([repoGh, "1"], env).code).toBe(0);
  }, 60000);
});

type StubItem = {
  id: string;
  sequence_id: number;
  name: string;
  description_html: string;
  project: string;
  state: string;
  labels: string[];
  created_at: string;
};

function startPlaneStub(items: Record<string, StubItem>) {
  const labels = [
    { id: "l-1", name: "ready" },
    { id: "l-2", name: "blocked, ready" },
  ];
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const u = new URL(req.url);
      const p = u.pathname;
      const j = (v: unknown) => Response.json(v);
      if (req.method === "GET" && p === "/api/v1/workspaces/ws/projects/")
        return j({ results: [{ id: "p1", identifier: "PM" }], next_page_results: false });
      if (req.method === "GET" && p === "/api/v1/workspaces/ws/projects/p1/states/")
        return j({
          results: [
            { id: "s-todo", group: "unstarted", sequence: 1 },
            { id: "s-prog", group: "started", sequence: 1 },
            { id: "s-done", group: "completed", sequence: 1 },
            { id: "s-cancel", group: "cancelled", sequence: 1 },
          ],
          next_page_results: false,
        });
      if (req.method === "GET" && p === "/api/v1/workspaces/ws/projects/p1/labels/")
        return j({ results: labels, next_page_results: false });
      const mItem = /^\/api\/v1\/workspaces\/ws\/work-items\/([A-Z]+-[0-9]+)\/$/u.exec(p);
      if (req.method === "GET" && mItem) {
        const it = items[mItem[1]!];
        if (!it) return new Response("no such item", { status: 404 });
        return j(it);
      }
      const mComments =
        /^\/api\/v1\/workspaces\/ws\/projects\/p1\/work-items\/([^/]+)\/comments\/$/u.exec(p);
      if (req.method === "GET" && mComments) return j({ results: [], next_page_results: false });
      const mPatch = /^\/api\/v1\/workspaces\/ws\/projects\/p1\/work-items\/([^/]+)\/$/u.exec(p);
      if (req.method === "PATCH" && mPatch) {
        const it = Object.values(items).find((v) => v.id === mPatch[1]);
        if (!it) return new Response("no such item", { status: 404 });
        Object.assign(it, JSON.parse(await req.text()) as Record<string, unknown>);
        return j(it);
      }
      return new Response(`stub plane: unexpected ${req.method} ${p}`, { status: 500 });
    },
  });
  return { server, url: `http://127.0.0.1:${server.port}` };
}

function planeItem(n: number, bodyFile: string, labels: string[]): StubItem {
  return {
    id: `item-${n}`,
    sequence_id: n,
    name: n === 2 ? "Fix the list" : `Ticket ${n}`,
    description_html: mdToHtml(readFileSync(bodyFile, "utf8")),
    project: "p1",
    state: "s-todo",
    labels,
    created_at: "2026-10-03T00:00:00Z",
  };
}

describe("the matrix through the plane double", () => {
  test("ready, unready, one-part, draft and unknown read the same", async () => {
    const { server, url } = startPlaneStub({
      "PM-1": planeItem(1, join(tmp, "a.md"), ["l-1"]),
      "PM-2": planeItem(2, join(tmp, "a.md"), []),
      "PM-3": planeItem(3, join(tmp, "c.md"), ["l-1"]),
      "PM-4": planeItem(4, join(tmp, "d.md"), ["l-1"]),
      "PM-5": planeItem(5, join(tmp, "a.md"), ["l-2"]),
    });
    try {
      const dir = join(tmp, "plane-double");
      mkdirSync(dir, { recursive: true });
      const repoPl = join(dir, "repo");
      mkdirSync(repoPl, { recursive: true });
      if (run("git", ["init", "-q", repoPl]).code !== 0) throw new Error("git init failed");
      const cfg = join(dir, "config.toml");
      writeFileSync(cfg, `[tracker]\nkind = "plane"\nurl = "${url}"\nworkspace = "ws"\n`);
      const env: Record<string, string | undefined> = {
        ...process.env,
        POSTMASTER_CONFIG: cfg,
        PLANE_API_KEY: "self-test",
      };
      delete env.POSTMASTER_PROJECT;
      env.GIT_CEILING_DIRECTORIES = dir;
      const r1 = await readyAsync([repoPl, "PM-1"], env);
      expect(r1.code).toBe(0);
      const unmarked = await readyAsync([repoPl, "PM-2"], env);
      expect(unmarked.code).toBe(2);
      expect(unmarked.out).toContain("ready label is missing");
      const onePart = await readyAsync([repoPl, "PM-3"], env);
      expect(onePart.code).toBe(2);
      expect(onePart.out).toContain("ticket-parts:");
      const draft = await readyAsync([repoPl, "PM-4"], env);
      expect(draft.code).toBe(2);
      expect(/draft/iu.test(draft.out)).toBe(true);
      expect((await readyAsync([repoPl, "PM-9999"], env)).code).toBe(1);
      const comma = await readyAsync([repoPl, "PM-5"], env);
      expect(comma.code).toBe(2);
      expect(comma.out).toContain("ready label is missing");
      // Mark through the double exercises the post-write verify on plane
      // semantics: the no-op edit must match the rendered body.
      expect((await readyAsync(["mark", repoPl, "PM-1"], env)).code).toBe(0);
      expect((await readyAsync([repoPl, "PM-1"], env)).code).toBe(0);
    } finally {
      server.stop(true);
    }
  }, 60000);
});

async function readyAsync(args: string[], env?: Record<string, string | undefined>) {
  // Async spawn: the in-process stub API can only answer while this loop runs.
  const p = Bun.spawn([self, "ticket-ready", ...args], {
    env: env as Record<string, string>,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
    p.exited,
  ]);
  return { code, out: `${out}${err}` };
}
