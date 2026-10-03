// Tests beside scripts/clerk.ts: the form splitter, the model comparison, the
// brief writer, the headless start, and the reader's guards. The reader's
// lane, and a start against a live host, need a model and a session host,
// so the checks that need them stay code-reviewed.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { chmodSync } from "node:fs";
import { baseModelName, splitCommand } from "./clerk.ts";

const SELF = join(import.meta.dir, "clerk.sh");

function sh(cmd: string, args: string[], env?: Record<string, string | undefined>): { code: number; out: string; err: string } {
  const r = spawnSync(cmd, args, { encoding: "utf8", env: { ...process.env, ...env } });
  return { code: r.status ?? 1, out: String(r.stdout ?? ""), err: String(r.stderr ?? "") };
}

function stubBin(): string {
  const bin = mkdtempSync(join(tmpdir(), "clerk-bin-"));
  writeFileSync(join(bin, "claude"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(bin, "claude"), 0o755);
  return bin;
}

function stubConfig(dir: string, extra = ""): string {
  mkdirSync(dir, { recursive: true });
  const cfg = join(dir, "config.toml");
  writeFileSync(
    cfg,
    [
      `[lanes.one]`,
      `harness = "claude"`,
      `model = "lane-model"`,
      ``,
      `[team]`,
      `clerk = { harness = "claude", model = "clerk-model" }`,
      ...(extra ? [extra] : []),
      ``,
    ].join("\n"),
  );
  return cfg;
}

function localRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "clerk-repo-"));
  sh("git", ["init", "-q", repo]);
  sh("git", ["-C", repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "base"]);
  const here = join(import.meta.dir, "local.sh");
  const init = sh(here, [repo, "store", "init"]);
  if (init.code !== 0) throw new Error(`store init failed: ${init.err}`);
  return repo;
}

function localTicket(repo: string, title: string): string {
  const body = join(repo, "body.md");
  writeFileSync(body, "A body.\n");
  const r = sh(join(import.meta.dir, "local.sh"), [repo, "create", title, body]);
  if (r.code !== 0) throw new Error(`create failed: ${r.err}`);
  return r.out.trim();
}

describe("splitCommand", () => {
  test("a printed interactive form splits back into argv", () => {
    expect(
      splitCommand("launch: cd /tmp/lit && claude --model cm --name \\#2\\,\\ Fix\\ the\\ list --dangerously-skip-permissions"),
    ).toEqual(["claude", "--model", "cm", "--name", "#2, Fix the list", "--dangerously-skip-permissions"]);
  });

  test("quotes group, an escaped space stays one word, and '' is an empty word", () => {
    expect(splitCommand('launch: cd /x && foo "a b" \'c d\' plain\\ x \'\'')).toEqual([
      "foo",
      "a b",
      "c d",
      "plain x",
      "",
    ]);
  });

  test("a form without a cd prefix splits as printed", () => {
    expect(splitCommand("launch: claude -p hello")).toEqual(["claude", "-p", "hello"]);
  });
});

describe("baseModelName", () => {
  test("the provider prefix and the window suffix are not the model", () => {
    expect(baseModelName("acme/big-one[200k]")).toBe("big-one");
    expect(baseModelName("big-one")).toBe("big-one");
    expect(baseModelName("a/b/c")).toBe("c");
  });
});

describe("brief", () => {
  test("brief writes the draft and the brief, and unmarks a ready ticket", () => {
    const repo = localRepo();
    const id = localTicket(repo, "Fix the list");
    const labels = sh(join(import.meta.dir, "local.sh"), [repo, "label", id, "add", "ready"]);
    expect(labels.code).toBe(0);
    const cfgDir = mkdtempSync(join(tmpdir(), "clerk-cfg-"));
    const cfg = stubConfig(cfgDir, `[planning]\nreview_link = "https://edit.example/{path}"`);
    writeFileSync(join(cfgDir, "preferences.md"), "Prefer short tickets.\n");
    const r = sh(SELF, ["brief", repo, id], { POSTMASTER_CONFIG: cfg });
    expect(r.code).toBe(0);
    const draft = readFileSync(join(repo, ".postmaster", "clerk", `${id}.md`), "utf8");
    expect(draft).toContain(`DRAFT: #${id} is being prepared`);
    const brief = readFileSync(join(repo, ".postmaster", "clerk", `${id}.brief.md`), "utf8");
    expect(brief).toContain(`# Brief: booking clerk for #${id}, Fix the list`);
    expect(brief).toContain(`Ticket: #${id} on local`);
    expect(brief).toContain(`Repository: ${repo}`);
    expect(brief).toContain("Base: ");
    expect(brief).toContain("skills/clerk/SKILL.md");
    expect(brief).toContain("skills/clerk/clerk.md");
    expect(brief).toContain("Prefer short tickets.");
    expect(brief).toContain("Editor link: https://edit.example/");
    expect(brief).toContain("Title: Fix the list");
    const read = sh(join(import.meta.dir, "local.sh"), [repo, "read", id]);
    const labelsLine = read.out.split("\n").find((l) => l.startsWith("labels:")) ?? "";
    expect(labelsLine).not.toContain("ready");
  });

  test("brief keeps an existing draft and proceeds for an unreadable ticket", () => {
    const repo = localRepo();
    const cfgDir = mkdtempSync(join(tmpdir(), "clerk-cfg-"));
    const cfg = stubConfig(cfgDir);
    const first = sh(SELF, ["brief", repo, "9"], { POSTMASTER_CONFIG: cfg });
    expect(first.code).toBe(0);
    const draftPath = join(repo, ".postmaster", "clerk", "9.md");
    writeFileSync(draftPath, "The clerk's own words.\n");
    const second = sh(SELF, ["brief", repo, "9"], { POSTMASTER_CONFIG: cfg });
    expect(second.code).toBe(0);
    expect(readFileSync(draftPath, "utf8")).toBe("The clerk's own words.\n");
    const brief = readFileSync(join(repo, ".postmaster", "clerk", "9.brief.md"), "utf8");
    expect(brief).not.toContain("## The ticket as read");
    expect(brief).toContain("None are set.");
  });
});

describe("start", () => {
  test("start with no host prints the command to open by hand and exits 3", () => {
    const repo = localRepo();
    const id = localTicket(repo, "Fix the list");
    const cfgDir = mkdtempSync(join(tmpdir(), "clerk-cfg-"));
    const cfg = stubConfig(cfgDir);
    const bin = stubBin();
    const r = sh(SELF, ["start", repo, id], {
      POSTMASTER_CONFIG: cfg,
      POSTMASTER_HOST: "none",
      PATH: `${bin}:${process.env.PATH ?? ""}`,
    });
    expect(r.code).toBe(3);
    expect(r.err).toContain(`open #${id}, Fix the list by hand:`);
    expect(r.err).toContain(
      `cd ${repo} && claude --model clerk-model --name \\#${id}\\,\\ Fix\\ the\\ list --dangerously-skip-permissions`,
    );
    expect(r.err).toContain(`${id}.brief.md`);
  });
});

describe("reader", () => {
  test("the reader's guards refuse without a model", () => {
    const dir = mkdtempSync(join(tmpdir(), "clerk-reader-"));
    const plain = join(dir, "plain.md");
    writeFileSync(plain, "# A ticket\n\n## Problem\n\nIt breaks.\n");
    const cfgDir = mkdtempSync(join(tmpdir(), "clerk-cfg-"));
    const cfg = stubConfig(cfgDir);
    const env = { POSTMASTER_CONFIG: cfg };
    expect(sh(SELF, ["reader", "", plain, dir], env).code).toBe(1);
    expect(sh(SELF, ["reader", "m", join(dir, "missing.md"), dir], env).code).toBe(1);
    expect(sh(SELF, ["reader", "m", plain, join(dir, "missing")], env).code).toBe(1);
    const agents = join(dir, "agents.md");
    writeFileSync(agents, "# A ticket\n\n## Problem\n\nIt breaks.\n\n## For the agents\n\nChecks.\n");
    const r = sh(SELF, ["reader", "m", agents, dir], env);
    expect(r.code).toBe(1);
    expect(r.err).toContain("the plain part only");
  });

  test("a draft is not tested when every lane is the clerk's model", () => {
    const dir = mkdtempSync(join(tmpdir(), "clerk-reader-"));
    const plain = join(dir, "plain.md");
    writeFileSync(plain, "# A ticket\n\n## Problem\n\nIt breaks.\n");
    const cfgDir = mkdtempSync(join(tmpdir(), "clerk-cfg-"));
    const cfg = stubConfig(cfgDir);
    const r = sh(SELF, ["reader", "other/lane-model[1m]", plain, dir], { POSTMASTER_CONFIG: cfg });
    expect(r.code).toBe(2);
    expect(r.err).toContain("the draft was not tested");
  });
});
