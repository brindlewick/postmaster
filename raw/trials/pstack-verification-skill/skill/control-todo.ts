#!/usr/bin/env bun
// Drives the todo command line the way a user does, against list files of its own, and keeps
// proof of each command. SKILL.md says what each command is for.

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dir, "../../..");
const listDir = process.env.TODO_VERIFY_DIR ?? join(tmpdir(), "todo-verify");
const proofDir = process.env.TODO_VERIFY_PROOF ?? join(tmpdir(), "todo-verify-proof");
const USAGE =
  "usage: control-todo doctor | run <label> -- <todo arguments> | show <label> | path <label> | cleanup";

function listPath(label: string): string {
  if (!/^[a-z0-9-]+$/.test(label)) {
    throw new Error(`a label is lower-case letters, digits and hyphens: ${label}`);
  }
  return join(listDir, `${label}.json`);
}

function git(...args: string[]): string {
  return Bun.spawnSync(["git", "-C", repo, ...args])
    .stdout.toString()
    .trim();
}

function doctor(): number {
  const problems: string[] = [];
  console.log(`bun ${Bun.version}`);
  const pkg = JSON.parse(readFileSync(join(repo, "package.json"), "utf8"));
  if (pkg.bin?.todo !== "src/cli.ts") {
    problems.push("package.json no longer names src/cli.ts as the todo bin");
  }
  if (!existsSync(join(repo, "src/cli.ts"))) {
    problems.push("src/cli.ts is missing");
  }
  if (existsSync(join(repo, "todo.json"))) {
    problems.push(
      "todo.json sits in the repository root: it is a real list, never drive against it",
    );
  }
  const changed = git("status", "--porcelain", "--", "src") !== "";
  console.log(
    `revision ${git("rev-parse", "--short", "HEAD")}${changed ? " + uncommitted src changes" : ""}`,
  );
  console.log(`lists: ${listDir}`);
  console.log(`proof: ${proofDir}`);
  for (const problem of problems) {
    console.log(`PROBLEM: ${problem}`);
  }
  return problems.length === 0 ? 0 : 1;
}

function run(label: string, args: string[]): number {
  const file = listPath(label);
  mkdirSync(listDir, { recursive: true });
  mkdirSync(proofDir, { recursive: true });
  const result = Bun.spawnSync([process.execPath, join(repo, "src/cli.ts"), ...args], {
    cwd: listDir,
    env: { PATH: process.env.PATH ?? "", TODO_FILE: file },
  });
  const stored = existsSync(file) ? readFileSync(file, "utf8") : "(no list file)";
  const block = [
    `$ todo ${args.map((arg) => JSON.stringify(arg)).join(" ")}`,
    `stdout: ${JSON.stringify(result.stdout.toString())}`,
    `stderr: ${JSON.stringify(result.stderr.toString())}`,
    `exit: ${result.exitCode}`,
    `list after: ${stored.trim().replace(/\s+/g, " ")}`,
  ].join("\n");
  appendFileSync(join(proofDir, `${label}.txt`), `${block}\n\n`);
  console.log(block);
  return 0;
}

function show(label: string): number {
  const file = listPath(label);
  if (!existsSync(file)) {
    console.log("(no list file)");
    return 0;
  }
  process.stdout.write(readFileSync(file, "utf8"));
  return 0;
}

function cleanup(): number {
  if (!existsSync(listDir)) {
    console.log("nothing to clean up");
    return 0;
  }
  let removed = 0;
  for (const name of readdirSync(listDir)) {
    if (/\.(json|tmp)$/.test(name)) {
      rmSync(join(listDir, name));
      removed += 1;
    }
  }
  rmdirSync(listDir);
  console.log(`removed ${removed} list file(s); proof kept in ${proofDir}`);
  return 0;
}

function main(argv: string[]): number {
  const [command, label, ...rest] = argv;
  try {
    switch (command) {
      case "doctor":
        return doctor();
      case "run":
        if (label !== undefined && rest[0] === "--") {
          return run(label, rest.slice(1));
        }
        break;
      case "show":
        if (label !== undefined) {
          return show(label);
        }
        break;
      case "path":
        if (label !== undefined) {
          console.log(listPath(label));
          return 0;
        }
        break;
      case "cleanup":
        return cleanup();
    }
  } catch (error) {
    console.error(`control-todo: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  console.error(USAGE);
  return 2;
}

process.exit(main(process.argv.slice(2)));
