import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { run } from "./proc.ts";
import { packageSettingsDiffer, parseSwitchOff, scanComments } from "./switch-offs.ts";

const SELF = join(import.meta.dir, "../run");
const CLEAN_GIT_ENV = {
  GIT_DIR: undefined,
  GIT_WORK_TREE: undefined,
  GIT_COMMON_DIR: undefined,
  GIT_INDEX_FILE: undefined,
  GIT_OBJECT_DIRECTORY: undefined,
  GIT_ALTERNATE_OBJECT_DIRECTORIES: undefined,
  GIT_NAMESPACE: undefined,
};

let root = "";
let repo = "";

function freshRepo(name: string): string {
  const path = join(root, name);
  mkdirSync(path);
  const initialized = run("git", ["init", "-q", "-b", "main", path], { env: CLEAN_GIT_ENV });
  if (initialized.code !== 0) throw new Error(`git init: ${initialized.err}`);
  repo = path;
  git(repo, "config", "user.email", "332054101+brindlewick@users.noreply.github.com");
  git(repo, "config", "user.name", "brindlewick");
  git(repo, "config", "commit.gpgsign", "false");
  write("scripts/base.ts", "export const base = true;\n");
  write("package.json", '{"scripts":{"check":"tsc --noEmit"},"devDependencies":{}}\n');
  commit("base");
  git(repo, "checkout", "-qb", "ticket");
  return repo;
}

function git(where: string, ...args: string[]): string {
  const r = run("git", ["-C", where, ...args], { env: CLEAN_GIT_ENV });
  if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.err}${r.out}`);
  return r.out.trim();
}

function write(path: string, text: string): void {
  const full = join(repo, path);
  const parent = full.slice(0, full.lastIndexOf("/"));
  mkdirSync(parent, { recursive: true });
  writeFileSync(full, text);
}

function commit(message: string): string {
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", message);
  return git(repo, "rev-parse", "HEAD");
}

function call(...args: string[]): { code: number; out: string } {
  const result = run(SELF, ["landing", "switch-offs", ...args], { env: CLEAN_GIT_ENV });
  return { code: result.code, out: `${result.out}${result.err}`.replace(/\n+$/u, "") };
}

function check(...args: string[]): { code: number; out: string } {
  return call("--repo", repo, "--default", "main", "--ticket", "ticket", ...args);
}

beforeAll(() => {
  const scratch = join(import.meta.dir, "../../.postmaster/verify/tmp");
  mkdirSync(scratch, { recursive: true });
  root = mkdtempSync(join(scratch, "postmaster-switch-offs-"));
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("switch-off detection", () => {
  test("recognizes each supported form once and reports reason and scope", () => {
    freshRepo("forms");
    const forms: [string, string][] = [
      ["ts-ignore-line.ts", "// @ts-ignore -- known mismatch\nconst x: string = 1;"],
      ["ts-ignore-block.ts", "/* @ts-ignore -- known mismatch */\nconst x: string = 1;"],
      ["ts-expect.ts", "// @ts-expect-error: known mismatch\nconst x: string = 1;"],
      ["ts-nocheck.ts", "// @ts-nocheck known generated file\nconst x = 1;"],
      ["eslint-next.ts", "// eslint-disable-next-line rule-a -- known mismatch\nconst x = 1;"],
      ["oxlint-line.ts", "const x = 1; // oxlint-disable-line rule-b -- known mismatch"],
      ["eslint-block.ts", "/* eslint-disable -- known file issue */\nconst x = 1;"],
      ["oxlint-block.ts", "/* oxlint-disable rule-c -- known file issue */\nconst x = 1;"],
      ["biome-one.ts", "// biome-ignore format: known formatting exception\nconst x = 1;"],
      ["biome-all.ts", "// biome-ignore-all format: generated file\nconst x = 1;"],
    ];
    for (const [name, text] of forms) write(`scripts/${name}`, `${text}\n`);
    commit("add switch-offs");
    const result = check();
    expect(result.code).toBe(2);
    expect(result.out.startsWith("held\n## Switch-offs\n\n")).toBe(true);
    for (const [name] of forms) {
      expect(result.out.split(`scripts/${name}:`).length - 1).toBe(1);
    }
    expect(result.out).toContain("every rule");
    expect(result.out).toContain("-- reason: known mismatch");
    expect(result.out).toContain("-- reason: known file issue");
    expect(result.out).toContain("-- reason: generated file");
    expect(result.out).toContain("scripts/ts-ignore-line.ts:1 ts-ignore every rule");
    expect(result.out).toContain("scripts/biome-one.ts:1 biome-ignore format");
    expect(result.out).toContain("(id comment:");
  });

  test("ignores directive text in strings, regexps, template text, written text and Markdown", () => {
    freshRepo("lexing");
    write(
      "scripts/text-input.ts",
      [
        'const double = "// eslint-disable-next-line fake -- nope";',
        "const single = '// @ts-ignore nope';",
        "const plain = `// oxlint-disable fake -- nope`;",
        "const expression = `text ${1 /* eslint-disable expression-rule -- real reason */}`;",
        "const re = /\\/\\/ biome-ignore format: nope/;",
        'writeFile("x.ts", "/* oxlint-disable fake */");',
        "export const who = `value ${1} // biome-ignore format: fake-trailing`;",
      ].join("\n"),
    );
    write("docs/switch-offs.md", "// @ts-nocheck this is Markdown\n");
    commit("add directive text inputs");
    const comments = scanComments(readFileSync(join(repo, "scripts/text-input.ts"), "utf8"));
    expect(comments).toHaveLength(1);
    const result = check();
    expect(result.code).toBe(2);
    expect(result.out).toContain("scripts/text-input.ts");
    expect(result.out).toContain("expression-rule");
    expect(result.out).not.toContain("docs/switch-offs.md");
    expect(result.out).not.toContain("fake");
  });

  test("a Biome start block is listed, and widening it by dropping its end counts as added", () => {
    freshRepo("biome-block");
    write(
      "scripts/styled.ts",
      [
        "// biome-ignore-start format: generated section",
        "const      spaced      =      1;",
        "// biome-ignore-end format: generated section",
        "export const done = true;",
      ].join("\n"),
    );
    commit("add closed Biome block");
    const before = check();
    expect(before.code).toBe(2);
    const idBefore = /\(id (comment:[0-9a-f]{16})\)/u.exec(before.out)?.[1];
    expect(idBefore).toBeDefined();
    write(
      "scripts/styled.ts",
      [
        "// biome-ignore-start format: generated section",
        "const      spaced      =      1;",
        "export const done = true;",
      ].join("\n"),
    );
    commit("drop the Biome end");
    const after = check();
    expect(after.code).toBe(2);
    const idAfter = /\(id (comment:[0-9a-f]{16})\)/u.exec(after.out)?.[1];
    expect(idAfter).toBeDefined();
    expect(idAfter).not.toBe(idBefore);
  });

  test("requires reasons for active TypeScript and linter directives but ignores ineffective Biome comments", () => {
    freshRepo("reasons");
    write("scripts/missing-ts.ts", "// @ts-ignore\nconst x: string = 1;\n");
    write("scripts/missing-eslint.ts", "// eslint-disable-next-line rule-a\nconst x = 1;\n");
    write("scripts/missing-oxlint.ts", "/* oxlint-disable */\nconst x = 1;\n");
    write("scripts/biome-no-colon.ts", "// biome-ignore format\nconst x = 1;\n");
    write("scripts/biome-no-reason.ts", "// biome-ignore format:\nconst x = 1;\n");
    commit("add missing-reason comments");
    const result = check();
    expect(result.code).toBe(3);
    expect(result.out.startsWith("no reason\n")).toBe(true);
    expect((result.out.match(/reason: missing/gu) ?? []).length).toBe(3);
    expect(result.out).not.toContain("biome-no-colon.ts");
    expect(result.out).not.toContain("biome-no-reason.ts");
  });

  test("recognizes each specified settings path and a removed linter settings file", () => {
    const cases: [string, string, string][] = [
      ["oxlintrc", ".oxlintrc.json", '{"rules":{"rule-a":"off"}}\n'],
      ["strict", "tsconfig.json", '{"compilerOptions":{"strict":false}}\n'],
      ["biome", "biome.json", '{"overrides":[{"include":["scripts/**"],"format":false}]}\n'],
      ["gate-script", "package.json", '{"scripts":{"check":"bunx biome format"}}\n'],
      ["bunfig", "bunfig.toml", '[test]\nroot = "scripts"\n'],
      ["nested-tsconfig", "scripts/tsconfig.json", '{"compilerOptions":{"strict":false}}\n'],
    ];
    for (const [name, path, content] of cases) {
      freshRepo(`setting-${name}`);
      write(path, content);
      commit(`add ${path}`);
      const result = check();
      expect(result.code).toBe(2);
      expect(result.out).toContain(
        `- settings ${path} (${path === "package.json" ? "changed" : "added"})`,
      );
    }

    freshRepo("setting-delete");
    git(repo, "checkout", "main");
    write(".oxlintrc.json", '{"rules":{"rule-a":"off"}}\n');
    commit("base linter setting");
    git(repo, "checkout", "-q", "-B", "ticket", "main");
    git(repo, "rm", "-q", ".oxlintrc.json");
    commit("delete linter setting");
    const removed = check();
    expect(removed.code).toBe(2);
    expect(removed.out).toContain("- settings .oxlintrc.json (deleted)");
  });

  test("a block disable becomes new when its matching enable is removed", () => {
    freshRepo("block-end");
    write(
      "scripts/block.ts",
      [
        "/* eslint-disable rule-a -- generated code */",
        "const first = 1;",
        "/* eslint-enable rule-a */",
        "const second = 2;",
      ].join("\n"),
    );
    commit("add closed block");
    const before = check();
    expect(before.code).toBe(2);
    const idBefore = /\(id (comment:[0-9a-f]{16})\)/u.exec(before.out)?.[1];
    write(
      "scripts/block.ts",
      [
        "/* eslint-disable rule-a -- generated code */",
        "const first = 1;",
        "const second = 2;",
      ].join("\n"),
    );
    commit("widen block");
    const after = check();
    const idAfter = /\(id (comment:[0-9a-f]{16})\)/u.exec(after.out)?.[1];
    expect(after.code).toBe(2);
    expect(idAfter).toBeDefined();
    expect(idAfter).not.toBe(idBefore);
  });

  test("a line move keeps the same identity when its covered code is unchanged", () => {
    freshRepo("line-move");
    write(
      "scripts/moved.ts",
      'const face = "😀";\n// @ts-ignore generated typing\nconst value: number = 1;\n',
    );
    commit("add switch-off");
    const before = check();
    const idBefore = /\(id (comment:[0-9a-f]{16})\)/u.exec(before.out)?.[1];
    write(
      "scripts/moved.ts",
      'const face = "😀";\n\n// @ts-ignore generated typing\nconst value: number = 1;\n',
    );
    commit("move switch-off down a line");
    const after = check();
    const idAfter = /\(id (comment:[0-9a-f]{16})\)/u.exec(after.out)?.[1];
    expect(idAfter).toBe(idBefore);
    expect(after.out).toContain("scripts/moved.ts:3");
  });

  test("lists check-setting changes, including scripts, and ignores dependency-only edits", () => {
    freshRepo("settings");
    write("package.json", '{"scripts":{"check":"bunx oxlint"},"devDependencies":{}}\n');
    write(".oxlintrc.json", '{"rules":{"example":"off"}}\n');
    write("nested/tsconfig.json", '{"compilerOptions":{"strict":false}}\n');
    commit("change check settings");
    let result = check();
    expect(result.code).toBe(2);
    expect(result.out).toContain("- settings package.json (changed)");
    expect(result.out).toContain("- settings .oxlintrc.json (added)");
    expect(result.out).toContain("- settings nested/tsconfig.json (added)");
    expect(result.out).toContain("bunx oxlint");

    write(
      "package.json",
      '{"scripts":{"check":"bunx oxlint"},"devDependencies":{"example":"1"}}\n',
    );
    commit("add dependency only");
    result = check();
    expect(result.out).toContain("- settings package.json (changed)"); // Earlier script change remains new to the merge base.

    git(repo, "checkout", "-q", "main");
    git(repo, "checkout", "-q", "-B", "ticket-clean");
    write(
      "package.json",
      '{"scripts":{"check":"tsc --noEmit"},"devDependencies":{"example":"1"}}\n',
    );
    commit("dependency only from base");
    const clean = run(
      SELF,
      ["landing", "switch-offs", "--repo", repo, "--default", "main", "--ticket", "ticket-clean"],
      { env: CLEAN_GIT_ENV },
    );
    expect(clean.code).toBe(0);
    expect(clean.out).not.toContain("package.json");
    git(repo, "checkout", "-q", "ticket");
  });

  test("subtracts comments already on the merge base after the default branch is merged", () => {
    freshRepo("merge-base");
    git(repo, "checkout", "-q", "main");
    write(
      "scripts/base-one.ts",
      "// eslint-disable-next-line inherited -- first base comment\nconst x = 1;\n",
    );
    write("scripts/base-two.ts", "// @ts-ignore second base comment\nconst x: string = 1;\n");
    commit("add base switch-off comments");
    git(repo, "checkout", "-q", "-B", "ticket", "main");
    git(repo, "checkout", "-q", "main");
    write(
      "scripts/main-switch.ts",
      "// eslint-disable-next-line inherited -- main reason\nconst x = 1;\n",
    );
    commit("add main switch-off");
    git(repo, "checkout", "-q", "ticket");
    git(repo, "merge", "-q", "--no-edit", "main");
    const inherited = check();
    expect(inherited.code).toBe(0);
    expect(inherited.out).not.toContain("scripts/base-one.ts");
    expect(inherited.out).not.toContain("scripts/base-two.ts");
    expect(inherited.out).not.toContain("scripts/main-switch.ts");
    write("scripts/ticket-switch.ts", "// @ts-ignore ticket reason\nconst x: string = 1;\n");
    commit("add ticket switch-off");
    const result = check();
    expect(result.code).toBe(2);
    expect(result.out).toContain("scripts/ticket-switch.ts");
    expect(result.out).not.toContain("scripts/main-switch.ts");
  });

  test("touching a base file without touching its comment still lists nothing", () => {
    freshRepo("touch-base");
    git(repo, "checkout", "-q", "main");
    write("scripts/so-base.ts", "// oxlint-disable-line no-debugger -- from main\n;");
    commit("base comment on main");
    git(repo, "checkout", "-q", "-B", "ticket", "main");
    write("scripts/plain.ts", "export const x = 1;\n");
    commit("plain work");
    const first = check();
    expect(first.code).toBe(0);
    expect(first.out).toBe("clear\n## Switch-offs\n\nnone");
    write(
      "scripts/so-base.ts",
      "// oxlint-disable-line no-debugger -- from main\n;\nexport const more = 2;\n",
    );
    commit("touch the base file");
    const second = check();
    expect(second.code).toBe(0);
    expect(second.out).toBe("clear\n## Switch-offs\n\nnone");
  });

  test("matches approval records from both the run log and project ledger", () => {
    freshRepo("approval");
    write("scripts/approved.ts", "// @ts-nocheck generated source\nexport const value = 1;\n");
    write(".oxlintrc.json", '{"rules":{"example":"off"}}\n');
    commit("add approved switch-off");
    const pending = check();
    const ids = [...pending.out.matchAll(/\(id ((?:comment|settings):[0-9a-f]{16})\)/gu)].map(
      (match) => match[1]!,
    );
    expect(ids).toHaveLength(2);
    git(repo, "update-ref", "refs/remotes/origin/main", git(repo, "rev-parse", "main"));
    git(repo, "update-ref", "refs/remotes/origin/ticket", git(repo, "rev-parse", "ticket"));
    const pullRequestRoute = run(
      SELF,
      [
        "landing",
        "switch-offs",
        "--repo",
        repo,
        "--default",
        "origin/main",
        "--ticket",
        "origin/ticket",
      ],
      { env: CLEAN_GIT_ENV },
    );
    expect(pullRequestRoute.code).toBe(2);
    expect(pullRequestRoute.out).toContain("scripts/approved.ts");
    const dispatch = join(repo, ".postmaster", "runs", "TEST-1");
    mkdirSync(dispatch, { recursive: true });
    const words = [
      "I approve the generated-file exception because the generator owns this output.",
      "I approve the linter setting because this ticket is testing the rule configuration.",
    ];
    for (const [index, id] of ids.entries()) {
      const logged = run(
        SELF,
        ["log-action", dispatch, "postmaster", "switch-off", id, "approved", words[index]!],
        { env: CLEAN_GIT_ENV },
      );
      expect(logged.code).toBe(0);
      if (index === 0) {
        const stillHeld = run(
          SELF,
          [
            "landing",
            "switch-offs",
            "--repo",
            repo,
            "--default",
            "main",
            "--ticket",
            "ticket",
            "--dispatch",
            dispatch,
          ],
          { env: CLEAN_GIT_ENV },
        );
        expect(stillHeld.code).toBe(2);
      }
    }
    const ledger = readFileSync(join(repo, ".postmaster", "runs", "ledger.jsonl"), "utf8");
    expect(ledger.split("\n").filter(Boolean)).toHaveLength(2);
    expect(ledger).toContain(words[0]!);
    expect(ledger).toContain(words[1]!);
    for (const id of ids) expect(ledger).toContain(`"target":"${id}"`);
    const approved = run(
      SELF,
      [
        "landing",
        "switch-offs",
        "--repo",
        repo,
        "--default",
        "main",
        "--ticket",
        "ticket",
        "--dispatch",
        dispatch,
      ],
      { env: CLEAN_GIT_ENV },
    );
    expect(approved.code).toBe(0);
    expect(approved.out.startsWith("clear\n")).toBe(true);
    expect(approved.out).toContain("(approved)");
  });

  test("a refusal is held and a changed covered line requires a new approval", () => {
    freshRepo("refusal");
    write(
      "scripts/refused.ts",
      "// @ts-expect-error known generated mismatch\nconst value: number = 1;\n",
    );
    commit("add switch-off");
    const first = check();
    const id = /\(id (comment:[0-9a-f]{16})\)/u.exec(first.out)?.[1];
    expect(id).toBeDefined();
    const dispatch = join(repo, ".postmaster", "runs", "TEST-2");
    mkdirSync(dispatch, { recursive: true });
    const refusal = run(
      SELF,
      [
        "log-action",
        dispatch,
        "postmaster",
        "switch-off",
        id!,
        "refused",
        "I do not approve this suppression because the type error needs a fix.",
      ],
      { env: CLEAN_GIT_ENV },
    );
    expect(refusal.code).toBe(0);
    const refused = run(
      SELF,
      [
        "landing",
        "switch-offs",
        "--repo",
        repo,
        "--default",
        "main",
        "--ticket",
        "ticket",
        "--dispatch",
        dispatch,
      ],
      { env: CLEAN_GIT_ENV },
    );
    expect(refused.code).toBe(4);
    expect(refused.out.startsWith("refused\n")).toBe(true);

    write(
      "scripts/refused.ts",
      "// @ts-expect-error known generated mismatch\nconst value: number = 2;\n",
    );
    commit("change covered code");
    const changed = run(
      SELF,
      [
        "landing",
        "switch-offs",
        "--repo",
        repo,
        "--default",
        "main",
        "--ticket",
        "ticket",
        "--dispatch",
        dispatch,
      ],
      { env: CLEAN_GIT_ENV },
    );
    expect(changed.code).toBe(2); // The changed code creates a new, unapproved identity.
    expect(changed.out).toContain("-- reason: known generated mismatch");
    expect(changed.out).not.toContain(`(id ${id})`);
  });

  test("records that are not this run's word are ignored with a warning, never obeyed", () => {
    freshRepo("stale-approvals");
    write("scripts/held.ts", "// @ts-ignore held reason\nconst x: string = 1;\n");
    commit("add switch-off");
    const id = /\(id (comment:[0-9a-f]{16})\)/u.exec(check().out)?.[1];
    expect(id).toBeDefined();
    const dispatch = join(repo, ".postmaster", "runs", "TEST-3");
    mkdirSync(dispatch, { recursive: true });
    const actionsPath = join(dispatch, "actions.jsonl");
    const line = (rec: Record<string, unknown>): string => `${JSON.stringify(rec)}\n`;
    const valid = {
      run: "TEST-3",
      actor: "postmaster",
      action: "switch-off",
      target: id,
      detail: "approved scripts/held.ts:1 ts-ignore -- yes",
    };
    writeFileSync(
      actionsPath,
      "this line is not JSON\n" +
        line({ ...valid, run: "OTHER-9" }) +
        line({ ...valid, actor: "lane:mimo" }) +
        line({ ...valid, detail: "maybe yes" }),
    );
    const ledgerPath = join(repo, ".postmaster", "runs", "ledger.jsonl");
    mkdirSync(join(repo, ".postmaster", "runs"), { recursive: true });
    writeFileSync(ledgerPath, line({ ...valid, run: "OTHER-9" }));
    const held = run(
      SELF,
      [
        "landing",
        "switch-offs",
        "--repo",
        repo,
        "--default",
        "main",
        "--ticket",
        "ticket",
        "--dispatch",
        dispatch,
      ],
      { env: CLEAN_GIT_ENV },
    );
    expect(held.code).toBe(2);
    expect(held.err).toContain("ignoring");
    const logged = run(
      SELF,
      ["log-action", dispatch, "postmaster", "switch-off", id!, "approved", "yes, keep it"],
      { env: CLEAN_GIT_ENV },
    );
    expect(logged.code).toBe(0);
    const clear = run(
      SELF,
      [
        "landing",
        "switch-offs",
        "--repo",
        repo,
        "--default",
        "main",
        "--ticket",
        "ticket",
        "--dispatch",
        dispatch,
      ],
      { env: CLEAN_GIT_ENV },
    );
    expect(clear.code).toBe(0);
  });

  test("a biome-ignore covers its whole node, not just its next line", () => {
    freshRepo("biome-node");
    const node = (a: string, after: string): string =>
      [
        "// biome-ignore format: generated table",
        "const table = {",
        `  a: ${a},`,
        "};",
        `const after = ${after};`,
        "",
      ].join("\n");
    const idOf = (out: string): string | undefined =>
      /\(id (comment:[0-9a-f]{16})\)/u.exec(out)?.[1];
    write("scripts/node.ts", node("1", "2"));
    commit("add biome node");
    const first = check();
    expect(first.code).toBe(2);
    const id = idOf(first.out);
    expect(id).toBeDefined();
    write("scripts/node.ts", node("2", "2"));
    commit("edit a later line of the node");
    const edited = idOf(check().out);
    expect(edited).toBeDefined();
    expect(edited).not.toBe(id);
    write("scripts/node.ts", node("2", "3"));
    commit("edit past the node");
    expect(idOf(check().out)).toBe(edited);
  });

  test("a partial enable narrows a block instead of ending it", () => {
    freshRepo("partial-enable");
    const idOf = (out: string): string | undefined =>
      /\(id (comment:[0-9a-f]{16})\)/u.exec(out)?.[1];
    write(
      "scripts/partial.ts",
      [
        "/* eslint-disable rule-a, rule-b -- two rules */",
        "const first = 1;",
        "/* eslint-enable rule-a */",
        "const second = 2;",
        "",
      ].join("\n"),
    );
    commit("add narrowed block");
    const id = idOf(check().out);
    expect(id).toBeDefined();
    write(
      "scripts/partial.ts",
      [
        "/* eslint-disable rule-a, rule-b -- two rules */",
        "const first = 1;",
        "/* eslint-enable rule-a */",
        "const second = 2;",
        "const third = 3;",
        "",
      ].join("\n"),
    );
    commit("append code still suppressed by rule-b");
    const grown = idOf(check().out);
    expect(grown).toBeDefined();
    expect(grown).not.toBe(id);
  });

  test("closes match opens across the linter's two spellings", () => {
    freshRepo("cross-spelling");
    const idOf = (out: string): string | undefined =>
      /\(id (comment:[0-9a-f]{16})\)/u.exec(out)?.[1];
    write(
      "scripts/cross.ts",
      [
        "/* eslint-disable rule-a -- one rule */",
        "const first = 1;",
        "/* oxlint-enable rule-a */",
        "const second = 2;",
        "",
      ].join("\n"),
    );
    commit("add cross-spelling block");
    const id = idOf(check().out);
    expect(id).toBeDefined();
    write(
      "scripts/cross.ts",
      [
        "/* eslint-disable rule-a -- one rule */",
        "const first = 1;",
        "/* oxlint-enable rule-a */",
        "const second = 2;",
        "const third = 3;",
        "",
      ].join("\n"),
    );
    commit("append past the close");
    expect(idOf(check().out)).toBe(id);
  });

  test("a bare enable ends bare disables only", () => {
    freshRepo("bare-enable");
    const idFor = (out: string, name: string): string | undefined =>
      new RegExp(`scripts/${name}:[0-9]+ [^(]*\\(id (comment:[0-9a-f]{16})\\)`, "u").exec(out)?.[1];
    write(
      "scripts/named.ts",
      [
        "/* eslint-disable rule-a -- named */",
        "const first = 1;",
        "/* eslint-enable */",
        "const second = 2;",
        "",
      ].join("\n"),
    );
    write(
      "scripts/bare.ts",
      [
        "/* eslint-disable -- all */",
        "const first = 1;",
        "/* eslint-enable */",
        "const second = 2;",
        "",
      ].join("\n"),
    );
    commit("add blocks");
    const first = check();
    expect(first.code).toBe(2);
    const namedId = idFor(first.out, "named.ts");
    const bareId = idFor(first.out, "bare.ts");
    expect(namedId).toBeDefined();
    expect(bareId).toBeDefined();
    write(
      "scripts/named.ts",
      [
        "/* eslint-disable rule-a -- named */",
        "const first = 1;",
        "/* eslint-enable */",
        "const second = 2;",
        "const third = 3;",
        "",
      ].join("\n"),
    );
    write(
      "scripts/bare.ts",
      [
        "/* eslint-disable -- all */",
        "const first = 1;",
        "/* eslint-enable */",
        "const second = 2;",
        "const third = 3;",
        "",
      ].join("\n"),
    );
    commit("append past both closes");
    const second = check().out;
    expect(idFor(second, "named.ts")).not.toBe(namedId);
    expect(idFor(second, "bare.ts")).toBe(bareId);
  });

  test("a refusal stands even when an approval for the same entry is recorded", () => {
    freshRepo("refusal-sticky");
    write("scripts/held.ts", "// @ts-ignore held reason\nconst x: string = 1;\n");
    commit("add switch-off");
    const id = /\(id (comment:[0-9a-f]{16})\)/u.exec(check().out)?.[1];
    expect(id).toBeDefined();
    const record = (dispatch: string, decision: string, words: string): void => {
      const r = run(
        SELF,
        ["log-action", dispatch, "postmaster", "switch-off", id!, decision, words],
        { env: CLEAN_GIT_ENV },
      );
      expect(r.code).toBe(0);
    };
    const statusOf = (dispatch: string): { code: number; out: string } =>
      call("--repo", repo, "--default", "main", "--ticket", "ticket", "--dispatch", dispatch);
    const refusedFirst = join(repo, ".postmaster", "runs", "TEST-4");
    mkdirSync(refusedFirst, { recursive: true });
    record(refusedFirst, "refused", "remove this suppression");
    record(refusedFirst, "approved", "changed my mind");
    const first = statusOf(refusedFirst);
    expect(first.code).toBe(4);
    expect(first.out.startsWith("refused\n")).toBe(true);
    const approvedFirst = join(repo, ".postmaster", "runs", "TEST-4b");
    mkdirSync(approvedFirst, { recursive: true });
    record(approvedFirst, "approved", "looks fine");
    record(approvedFirst, "refused", "on reflection remove it");
    const second = statusOf(approvedFirst);
    expect(second.code).toBe(4);
    expect(second.out.startsWith("refused\n")).toBe(true);
  });

  test("a settings diff shows even under a colon-led directory", () => {
    freshRepo("colon-settings");
    write(":odd/bunfig.toml", "x = 1\n");
    commit("add colon settings");
    const result = check();
    expect(result.code).toBe(2);
    expect(result.out).toContain("- settings :odd/bunfig.toml (added)");
    expect(result.out).toContain("x = 1");
    expect(result.out).not.toContain("(no textual diff)");
  });

  test("an unreadable source blob fails the check instead of reporting clear", () => {
    freshRepo("unreadable");
    write("scripts/real.ts", "export const ok = true;\n");
    git(repo, "add", "-A");
    git(
      repo,
      "update-index",
      "--add",
      "--cacheinfo",
      "160000",
      git(repo, "rev-parse", "HEAD"),
      "scripts/ghost.ts",
    );
    git(repo, "commit", "-qm", "add unreadable source path");
    const result = check();
    expect(result.code).toBe(1);
    expect(result.out).toContain("cannot read scripts/ghost.ts");
  });
});

describe("switch-off units", () => {
  test("the scanner tells comments from strings, templates and regexes", () => {
    const text = [
      'const a = "// @ts-ignore in-string";',
      "const b = `tpl // oxlint-disable-line x -- in-template ${1 /* real */}`;",
      "const c = /eslint-disable in-regex/;",
      "// eslint-disable-next-line no-debugger -- real-reason",
      "debugger;",
    ].join("\n");
    const cs = scanComments(text);
    expect(cs.length).toBe(2);
    expect(cs[0]!.line).toBe(2);
    expect(cs[0]!.raw).toBe("/* real */");
    expect(cs[1]!.line).toBe(4);
    expect(cs[1]!.raw).toBe("// eslint-disable-next-line no-debugger -- real-reason");
  });

  test("an unterminated string ends at its newline and swallows no later comment", () => {
    const cs = scanComments('const a = "oops;\n// @ts-ignore real reason\nconst x: string = 1;\n');
    expect(cs.length).toBe(1);
    expect(cs[0]!.line).toBe(2);
  });

  test("the scanner counts CR, CRLF and U+2028 as line breaks", () => {
    const cr = scanComments("const a = 1;\r// @ts-ignore cr reason\rconst x: string = 1;\r");
    expect(cr.length).toBe(1);
    expect(cr[0]!.line).toBe(2);
    expect(cr[0]!.raw).toBe("// @ts-ignore cr reason");
    const crlf = scanComments(
      "const a = 1;\r\n// @ts-ignore crlf reason\r\nconst x: string = 1;\r\n",
    );
    expect(crlf.length).toBe(1);
    expect(crlf[0]!.line).toBe(2);
    const u = scanComments("const a = 1;\u2028// @ts-ignore u reason\u2028const x: string = 1;\n");
    expect(u.length).toBe(1);
    expect(u[0]!.line).toBe(2);
    const block = scanComments("/* one\r two */\n// @ts-ignore block reason\ncode;\n");
    expect(block.length).toBe(2);
    expect(block[1]!.line).toBe(3);
  });

  test("parseSwitchOff reads each form and its reason", () => {
    expect(parseSwitchOff("// @ts-ignore")).toEqual({
      form: "ts-ignore",
      scope: "next",
      tool: "ts",
      rules: "every rule",
      reason: null,
    });
    expect(parseSwitchOff("/** @ts-ignore JSDoc reason */")).toEqual({
      form: "ts-ignore",
      scope: "next",
      tool: "ts",
      rules: "every rule",
      reason: "JSDoc reason",
    });
    expect(parseSwitchOff("// @ts-nocheck")).toEqual({
      form: "ts-nocheck",
      scope: "file",
      tool: "ts",
      rules: "every rule",
      reason: null,
    });
    expect(parseSwitchOff("/* eslint-disable -- a reason */")).toEqual({
      form: "eslint-disable",
      scope: "open",
      tool: "linter",
      rules: "every rule",
      reason: "a reason",
    });
    expect(parseSwitchOff("// eslint-disable-line no-console")).toEqual({
      form: "eslint-disable-line",
      scope: "line",
      tool: "linter",
      rules: "no-console",
      reason: null,
    });
    expect(parseSwitchOff("/* oxlint-enable no-debugger */")).toEqual({
      form: "oxlint-enable",
      scope: "close",
      tool: "linter",
      rules: "no-debugger",
      reason: null,
    });
    expect(parseSwitchOff("// biome-ignore-all lint/suspicious: why")).toEqual({
      form: "biome-ignore-all",
      scope: "file",
      tool: "biome",
      rules: "lint/suspicious",
      reason: "why",
    });
    expect(parseSwitchOff("// biome-ignore format")).toBeNull();
    expect(parseSwitchOff("// biome-ignore format: ")).toBeNull();
    expect(parseSwitchOff("// a plain comment")).toBeNull();
  });

  test("parseSwitchOff honors only a directive that starts the comment", () => {
    expect(parseSwitchOff("/* prefix eslint-disable */")).toBeNull();
    expect(parseSwitchOff("// prefix @ts-ignore")).toBeNull();
    expect(parseSwitchOff("/**\n * eslint-disable-next-line no-debugger\n */")).toBeNull();
    expect(parseSwitchOff("/* a note\neslint-disable-next-line no-debugger\n*/")).toBeNull();
    expect(parseSwitchOff("/** eslint-disable-next-line no-debugger -- r */")).toBeNull();
    expect(parseSwitchOff("/**\n * @ts-ignore r\n */")).toBeNull();
    expect(parseSwitchOff("/*\neslint-disable-next-line no-debugger -- r\n*/")).toEqual({
      form: "eslint-disable-next-line",
      scope: "next",
      tool: "linter",
      rules: "no-debugger",
      reason: "r",
    });
  });

  test("package.json differs only on scripts or a tool's settings block", () => {
    expect(packageSettingsDiffer(null, '{"dependencies":{"x":"1"}}')).toBe(false);
    expect(packageSettingsDiffer('{"scripts":{"check":"a"}}', '{"scripts":{"check":"b"}}')).toBe(
      true,
    );
    expect(
      packageSettingsDiffer(
        '{"scripts":{"check":"a"},"dependencies":{"x":"1"}}',
        '{"scripts":{"check":"a"},"dependencies":{"x":"2"}}',
      ),
    ).toBe(false);
    expect(packageSettingsDiffer(null, '{"scripts":{"check":"a"}}')).toBe(true);
    expect(packageSettingsDiffer("{broken", '{"scripts":{}}')).toBe(true);
    expect(
      packageSettingsDiffer('{"prettier":{"x":1}}', '{"prettier":{"x":2},"scripts":{"c":"a"}}'),
    ).toBe(true);
  });
});

describe("switch-off landing instructions", () => {
  const coachman = readFileSync(
    join(import.meta.dir, "../../skills/postmaster/coachman.md"),
    "utf8",
  );
  const postmaster = readFileSync(
    join(import.meta.dir, "../../skills/postmaster/postmaster.md"),
    "utf8",
  );

  test("the coachman lists switch-offs before the gate and pastes the section after the block", () => {
    expect(coachman).toContain("List the branch's switch-offs before anything else here");
    expect(
      coachman.indexOf("List the branch's switch-offs before anything else here"),
    ).toBeLessThan(coachman.indexOf("1. **Verify the final HEAD.**"));
    expect(coachman).toContain(
      "pasted after the block as its own section, never retyped, so the card shows the",
    );
  });

  test("Stage F holds both landing routes on the check and never approves itself", () => {
    const check = "Check switch-offs after the claims and before step 2's landing route";
    expect(postmaster).toContain(check);
    expect(postmaster).toContain("on both routes");
    expect(postmaster.indexOf(check)).toBeLessThan(
      postmaster.indexOf("2. **Follow the landing route in the waybill.**"),
    );
    expect(postmaster).toContain("The merge authority never approves these entries");
    expect(postmaster).toContain("before it opens a\n   pull request or merges");
    expect(postmaster).toContain("with the refused\n   entry as the exact discrepancy");
  });
});
