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

const self = join(scriptsDir(import.meta), "ticket-ready.sh");
const localSh = join(scriptsDir(import.meta), "local.sh");

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
  const r = run(self, args, env ? { env } : {});
  return { code: r.code, out: `${r.out ?? ""}${r.err ?? ""}` };
}

function local(args: string[]) {
  const r = run(localSh, [repo, ...args]);
  if (r.code !== 0) throw new Error(`local.sh ${args.join(" ")} failed: ${r.out}${r.err}`);
  return (r.out ?? "").trim();
}

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "ticket-ready-"));
  repo = join(tmp, "repo");
  mkdirSync(repo, { recursive: true });
  if (run("git", ["init", "-q", repo]).code !== 0) throw new Error("git init failed");
  if (run(localSh, [repo, "store", "init"]).code !== 0) throw new Error("store init failed");
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
});

describe("the marking and queue verbs", () => {
  test("marking a failing ticket exits 2 and adds no label", () => {
    const before = run(localSh, [repo, "read", "3"]);
    const r = ready(["mark", repo, "3"]);
    expect(r.code).toBe(2);
    const after = run(localSh, [repo, "read", "3"]);
    expect(after.out).toContain("labels: ready");
    expect(before.out.split("\n").find((l) => l.startsWith("labels:"))).toBe(
      after.out.split("\n").find((l) => l.startsWith("labels:")),
    );
  }, 30000);

  test("marking a passing ticket labels, notes and queues it", () => {
    const r = ready(["mark", repo, "2"]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("marked ready and queued");
    expect(run(localSh, [repo, "read", "2"]).out).toContain("labels: ready");
    const ledger = readFileSync(join(repo, ".postmaster", "runs", "ledger.jsonl"), "utf8");
    expect(ledger).toContain('"action":"note"');
    expect(ledger).toContain("turnpikes: style, bug, security");
    expect(ready([repo, "2"]).code).toBe(0);
    expect(ready(["pending", repo]).out).toContain("2");
  }, 30000);

  test("mark writes a draft body and title through the adapter", () => {
    const n = local(["create", "Old title", join(tmp, "c.md")]);
    const f = join(tmp, "final.md");
    writeFileSync(f, TWO_PART);
    const r = ready(["mark", repo, n, "--body", f, "--title", "New title"]);
    expect(r.code).toBe(0);
    const read = run(localSh, [repo, "read", n]).out;
    expect(read).toContain("title: New title");
    expect(read).toContain("labels: ready");
    expect(read).toContain("## For the agents");
  }, 30000);

  test("unmark drops the label and the marker, consume drops only the marker", () => {
    const r = ready(["unmark", repo, "2"]);
    expect(r.code).toBe(0);
    expect(run(localSh, [repo, "read", "2"]).out).toContain("labels: \n");
    expect(ready(["pending", repo]).out.includes("2")).toBe(false);
    expect(ready([repo, "2"]).code).toBe(2);
    expect(ready(["mark", repo, "2"]).code).toBe(0);
    expect(ready(["consume", repo, "2"]).code).toBe(0);
    expect(run(localSh, [repo, "read", "2"]).out).toContain("labels: ready");
    expect(ready(["pending", repo]).out.includes("2")).toBe(false);
  }, 30000);

  test("queue checks before it queues", () => {
    expect(ready(["queue", repo, "3"]).code).toBe(2);
    expect(ready(["pending", repo]).out.includes("3")).toBe(false);
    expect(ready(["queue", repo, "1"]).code).toBe(0);
    expect(ready(["pending", repo]).out).toContain("1");
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
    ]);
    expect(good.code).toBe(0);
    const bad = ready(["--body", a, "--labels", "", "--title", "Sorted list", "--project", repo]);
    expect(bad.code).toBe(2);
    expect(bad.out).toContain("ready label is missing");
  }, 30000);

  test("mark records the marking once the label is applied outside", () => {
    const a = join(tmp, "a.md");
    const early = ready(["mark", "--body", a, "--labels", "", "--repo", repo, "--id", "EXT-1"]);
    expect(early.code).toBe(2);
    expect(early.out).toContain("through the tracker's own tooling");
    const r = ready(["mark", "--body", a, "--labels", "ready", "--repo", repo, "--id", "EXT-1"]);
    expect(r.code).toBe(0);
    expect(ready(["pending", repo]).out).toContain("EXT-1");
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
    expect(ready([otherRepo, "EXT-1"], env).out).toContain("ticket-ready.sh --body <file>");
    expect(ready(["mark", otherRepo, "EXT-1"], env).out).toContain(
      "ticket-ready.sh mark --body <file>",
    );
    expect(ready(["unmark", otherRepo, "EXT-1"], env).out).toContain(
      "ticket-ready.sh consume ",
    );
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
  "label list") echo '[{"name": "ready"}]' ;;
  "label create") echo '{}' ;;
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
  const labels = [{ id: "l-1", name: "ready" }];
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
    } finally {
      server.stop(true);
    }
  }, 60000);
});

async function readyAsync(args: string[], env?: Record<string, string | undefined>) {
  // Async spawn: the in-process stub API can only answer while this loop runs.
  const p = Bun.spawn([self, ...args], {
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
