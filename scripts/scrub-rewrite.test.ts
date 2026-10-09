import { afterEach, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  cleanupScratch,
  commit,
  email,
  gitAt,
  initRepo,
  runScript,
  scratchDir,
} from "./scrub-test-kit.ts";

afterEach(cleanupScratch);

function addThenDelete(removeFile = false): { repo: string; base: string; tree: string } {
  const repo = initRepo();
  const base = gitAt(repo, ["rev-parse", "HEAD"]);
  writeFileSync(join(repo, "notes.txt"), email());
  commit(repo, "add temporary note");
  if (removeFile) gitAt(repo, ["rm", "-q", "notes.txt"]);
  else writeFileSync(join(repo, "notes.txt"), "clean\n");
  commit(repo, "remove temporary note");
  return { repo, base, tree: gitAt(repo, ["rev-parse", "HEAD^{tree}"]) };
}

test("C17 rewrite removes an earlier-only finding and preserves the final tree", () => {
  const { repo, base, tree } = addThenDelete();
  const rewritten = runScript("scrub-rewrite", [base], repo);
  expect(rewritten.status).toBe(0);
  expect(rewritten.stdout.trim().split("\n")).toHaveLength(1);
  expect(rewritten.stdout).toContain(":notes.txt:1: email removed");
  expect(rewritten.stdout.includes(email())).toBe(false);
  expect(gitAt(repo, ["rev-parse", "HEAD^{tree}"])).toBe(tree);
  const clean = runScript("scrub-check", [base, "HEAD"], repo);
  expect(clean.status).toBe(0);
  expect(clean.stdout).toBe("");
});

test("C17 rewrite also drops an introduced file later deleted from the branch", () => {
  const { repo, base, tree } = addThenDelete(true);
  const rewritten = runScript("scrub-rewrite", [base], repo);
  expect(rewritten.status).toBe(0);
  expect(rewritten.stdout.trim().split("\n")).toHaveLength(1);
  expect(gitAt(repo, ["rev-parse", "HEAD^{tree}"])).toBe(tree);
  expect(runScript("scrub-check", [base, "HEAD"], repo).status).toBe(0);
});

test("C18 rewrite refuses any finding in a commit already pushed and preserves HEAD", () => {
  const { repo, base } = addThenDelete();
  const bare = join(scratchDir(), "remote.git");
  gitAt(repo, ["init", "-q", "--bare", bare]);
  gitAt(repo, ["remote", "add", "origin", bare]);
  gitAt(repo, ["push", "-qu", "origin", "main"]);
  gitAt(repo, ["fetch", "-q", "origin"]);
  const head = gitAt(repo, ["rev-parse", "HEAD"]);
  const refused = runScript("scrub-rewrite", [base], repo);
  expect(refused.status).toBe(2);
  expect(refused.stdout + refused.stderr).toContain("already pushed");
  expect(refused.stdout + refused.stderr).not.toContain(email());
  expect(gitAt(repo, ["rev-parse", "HEAD"])).toBe(head);
});

test("rewrite still removes the finding when SCRUB_CHECK_DISABLE hides email", () => {
  // Review round 1: the rewrite's scan inherited SCRUB_CHECK_DISABLE and silently kept history.
  const { repo, base, tree } = addThenDelete();
  const rewritten = runScript("scrub-rewrite", [base], repo, { SCRUB_CHECK_DISABLE: "email" });
  expect(rewritten.status).toBe(0);
  expect(rewritten.stdout).toContain(":notes.txt:1: email removed");
  expect(gitAt(repo, ["rev-parse", "HEAD^{tree}"])).toBe(tree);
  expect(runScript("scrub-check", [base, "HEAD"], repo).status).toBe(0);
});

test("rewrite refuses to write through a symlinked path", () => {
  // Review round 1: the snapshot write followed a link out of the worktree.
  const repo = initRepo();
  const base = gitAt(repo, ["rev-parse", "HEAD"]);
  const target = `${email()}\nsecond-line`;
  symlinkSync(target, join(repo, "P"));
  commit(repo, "add link");
  gitAt(repo, ["rm", "-q", "P"]);
  commit(repo, "drop link");
  const refused = runScript("scrub-rewrite", [base], repo);
  expect(refused.status).toBe(2);
  expect(refused.stdout + refused.stderr).toContain("symlink");
  expect(refused.stdout + refused.stderr).not.toContain(email());
  expect(readdirSync(repo)).not.toContain(target);
});

test("rewrite refusal redacts a value carried in a parenthesized file name", () => {
  // Review round 4: the manual-reword refusal printed the raw path, showing
  // the finding's value on stderr against the ticket's rule 10.
  const repo = initRepo();
  const base = gitAt(repo, ["rev-parse", "HEAD"]);
  writeFileSync(join(repo, `(${email()}`), "clean\n");
  commit(repo, "add parenthesized name");
  const refused = runScript("scrub-rewrite", [base], repo);
  expect(refused.status).toBe(2);
  expect(refused.stderr).toContain("needs a manual reword");
  expect(refused.stdout + refused.stderr).not.toContain(email());
});

test("rewrite keeps untouched commits byte-identical, with or without a trailing newline", () => {
  // Review round 4: show --format=%B appends one newline past the stored
  // message, so every recreated commit gained a newline and a new id.
  const repo = initRepo();
  const base = gitAt(repo, ["rev-parse", "HEAD"]);
  writeFileSync(join(repo, "plain.txt"), "plain\n");
  gitAt(repo, ["add", "-A"]);
  gitAt(repo, ["commit", "-q", "-m", "normal ancestor"]);
  const normal = gitAt(repo, ["rev-parse", "HEAD"]);
  writeFileSync(join(repo, "odd.txt"), "odd\n");
  gitAt(repo, ["add", "-A"]);
  const tree = gitAt(repo, ["write-tree"]);
  writeFileSync(join(repo, "msg.txt"), "no trailing newline");
  const bare = gitAt(repo, ["commit-tree", tree, "-p", "HEAD", "-F", "msg.txt"]);
  gitAt(repo, ["update-ref", "refs/heads/main", bare]);
  gitAt(repo, ["reset", "-q", "--hard", bare]);
  writeFileSync(join(repo, "notes.txt"), email());
  commit(repo, "add temporary note");
  writeFileSync(join(repo, "notes.txt"), "clean\n");
  commit(repo, "remove temporary note");
  const rewritten = runScript("scrub-rewrite", [base], repo);
  expect(rewritten.status).toBe(0);
  expect(gitAt(repo, ["log", "--format=%H", "--grep=normal ancestor", "HEAD"])).toBe(normal);
  expect(gitAt(repo, ["log", "--format=%H", "--grep=no trailing newline", "HEAD"])).toBe(bare);
});

test("rewrite removes reasoning that survives only in earlier history", () => {
  // Review round 11 (bug-59): the plan read scrub-check only, which never
  // detects reasoning, so the rewrite exited 0 and the exposed commit stood.
  const repo = initRepo();
  const base = gitAt(repo, ["rev-parse", "HEAD"]);
  mkdirSync(join(repo, "raw"));
  const live = ["sealed", "blob"].join("");
  writeFileSync(
    join(repo, "raw", "secret.jsonl"),
    `${JSON.stringify({ encrypted_content: live })}\n`,
  );
  commit(repo, "add the record");
  gitAt(repo, ["rm", "-q", "raw/secret.jsonl"]);
  commit(repo, "delete the record");
  const tree = gitAt(repo, ["rev-parse", "HEAD^{tree}"]);
  expect(runScript("tree-check", [base, "HEAD"], repo).status).toBe(1);
  const rewritten = runScript("scrub-rewrite", [base], repo);
  expect(rewritten.status).toBe(0);
  expect(rewritten.stdout).toContain(":raw/secret.jsonl:1: encrypted-reasoning removed");
  expect(rewritten.stdout.includes(live)).toBe(false);
  expect(gitAt(repo, ["rev-parse", "HEAD^{tree}"])).toBe(tree);
  expect(runScript("tree-check", [base, "HEAD"], repo).status).toBe(0);
  expect(runScript("scrub-check", [base, "HEAD"], repo).status).toBe(0);
});

test("rewrite removes every line of a spanning record in earlier history", () => {
  // Review round 11 (bug-59): a pretty-printed record flags at line 1 in
  // text, but removing one line would leave the value behind in pieces.
  const repo = initRepo();
  const base = gitAt(repo, ["rev-parse", "HEAD"]);
  mkdirSync(join(repo, "raw"));
  const live = ["sealed", "blob"].join("");
  const pretty = JSON.stringify({ type: "reasoning", encrypted_content: live }, null, 2);
  writeFileSync(join(repo, "raw", "pretty.jsonl"), `${pretty}\n`);
  commit(repo, "add the record");
  gitAt(repo, ["rm", "-q", "raw/pretty.jsonl"]);
  commit(repo, "delete the record");
  const tree = gitAt(repo, ["rev-parse", "HEAD^{tree}"]);
  const rewritten = runScript("scrub-rewrite", [base], repo);
  expect(rewritten.status).toBe(0);
  expect(gitAt(repo, ["rev-parse", "HEAD^{tree}"])).toBe(tree);
  expect(runScript("tree-check", [base, "HEAD"], repo).status).toBe(0);
  expect(rewritten.stdout.includes(live)).toBe(false);
});

test("rewrite refuses a run record under .postmaster instead of renaming it", () => {
  // Review round 11 (bug-59): renaming would keep private content in
  // history under another name, so the rewrite fails loud for a manual one.
  const repo = initRepo();
  const base = gitAt(repo, ["rev-parse", "HEAD"]);
  mkdirSync(join(repo, ".postmaster"));
  writeFileSync(join(repo, ".postmaster", "run.json"), "{}\n");
  commit(repo, "add a run record");
  gitAt(repo, ["rm", "-q", ".postmaster/run.json"]);
  commit(repo, "delete the run record");
  const head = gitAt(repo, ["rev-parse", "HEAD"]);
  const refused = runScript("scrub-rewrite", [base], repo);
  expect(refused.status).toBe(2);
  expect(refused.stdout + refused.stderr).toContain("needs a manual rewrite");
  expect(gitAt(repo, ["rev-parse", "HEAD"])).toBe(head);
});

function goneFileRepo(): { repo: string; base: string; head: string } {
  const repo = initRepo();
  const base = gitAt(repo, ["rev-parse", "HEAD"]);
  writeFileSync(join(repo, "gone.txt"), `${email()}\n`);
  commit(repo, "add a note");
  gitAt(repo, ["rm", "-q", "gone.txt"]);
  commit(repo, "delete the note");
  return { repo, base, head: gitAt(repo, ["rev-parse", "HEAD"]) };
}

test("rewrite refuses an untracked file colliding with a rewritten path", () => {
  // Review round 13 (bug-74): the snapshot loop checks each row tree out
  // over the live worktree. An untracked file at a path in a row tree is
  // adopted and then deleted or overwritten by the suspect rewrite.
  const { repo, base, head } = goneFileRepo();
  const body = `${email()}\n`;
  writeFileSync(join(repo, "gone.txt"), body);
  const refused = runScript("scrub-rewrite", [base], repo);
  expect(refused.status).toBe(2);
  expect(refused.stdout + refused.stderr).toContain("gone.txt");
  expect(refused.stdout + refused.stderr).toContain("collides with the rewritten history");
  expect(existsSync(join(repo, "gone.txt"))).toBe(true);
  expect(readFileSync(join(repo, "gone.txt"), "utf8")).toBe(body);
  expect(gitAt(repo, ["rev-parse", "HEAD"])).toBe(head);
});

test("rewrite refuses an ignored file colliding with a rewritten path", () => {
  // Review round 13 (bug-74): ignored files are untracked to git, so the
  // same adoption deletes them; the guard covers both.
  const { repo, base, head } = goneFileRepo();
  const body = `${email()}\n`;
  writeFileSync(join(repo, ".gitignore"), "gone.txt\n");
  writeFileSync(join(repo, "gone.txt"), body);
  const refused = runScript("scrub-rewrite", [base], repo);
  expect(refused.status).toBe(2);
  expect(refused.stdout + refused.stderr).toContain("gone.txt");
  expect(refused.stdout + refused.stderr).toContain("collides with the rewritten history");
  expect(existsSync(join(repo, "gone.txt"))).toBe(true);
  expect(readFileSync(join(repo, "gone.txt"), "utf8")).toBe(body);
  expect(gitAt(repo, ["rev-parse", "HEAD"])).toBe(head);
});

test("rewrite names a non-identical colliding file instead of aborting mid-loop", () => {
  // Review round 13 (bug-74): a differing file at a row-tree path used to
  // fail the snapshot read-tree with a cryptic message after rewriting
  // started; the guard refuses up front with the path.
  const { repo, base, head } = goneFileRepo();
  writeFileSync(join(repo, "gone.txt"), "something else\n");
  const refused = runScript("scrub-rewrite", [base], repo);
  expect(refused.status).toBe(2);
  expect(refused.stdout + refused.stderr).toContain("gone.txt");
  expect(refused.stdout + refused.stderr).toContain("collides with the rewritten history");
  expect(readFileSync(join(repo, "gone.txt"), "utf8")).toBe("something else\n");
  expect(gitAt(repo, ["rev-parse", "HEAD"])).toBe(head);
});

test("rewrite refuses an untracked file at a finding-free row-tree path", () => {
  // Review round 13 (bug-74): the snapshot checks out whole trees, not
  // suspect paths, so a colliding file without a finding is destroyed too.
  const repo = initRepo();
  const base = gitAt(repo, ["rev-parse", "HEAD"]);
  writeFileSync(join(repo, "gone.txt"), `${email()}\n`);
  writeFileSync(join(repo, "data.txt"), "data\n");
  commit(repo, "add notes");
  gitAt(repo, ["rm", "-q", "gone.txt", "data.txt"]);
  commit(repo, "delete the notes");
  const head = gitAt(repo, ["rev-parse", "HEAD"]);
  writeFileSync(join(repo, "data.txt"), "user data\n");
  const refused = runScript("scrub-rewrite", [base], repo);
  expect(refused.status).toBe(2);
  expect(refused.stdout + refused.stderr).toContain("data.txt");
  expect(refused.stdout + refused.stderr).toContain("collides with the rewritten history");
  expect(readFileSync(join(repo, "data.txt"), "utf8")).toBe("user data\n");
  expect(gitAt(repo, ["rev-parse", "HEAD"])).toBe(head);
});

test("rewrite allows untracked and ignored files outside the rewritten paths", () => {
  // Review round 13 (bug-74): files at novel paths are never checked out
  // by the snapshot loop, so they survive a successful rewrite untouched.
  const { repo, base } = goneFileRepo();
  writeFileSync(join(repo, "scratch.txt"), "scratch\n");
  writeFileSync(join(repo, ".gitignore"), "cache.bin\n");
  writeFileSync(join(repo, "cache.bin"), "cache\n");
  const rewritten = runScript("scrub-rewrite", [base], repo);
  expect(rewritten.status).toBe(0);
  expect(rewritten.stdout).toContain(":gone.txt:1: email removed");
  expect(readFileSync(join(repo, "scratch.txt"), "utf8")).toBe("scratch\n");
  expect(readFileSync(join(repo, "cache.bin"), "utf8")).toBe("cache\n");
});
