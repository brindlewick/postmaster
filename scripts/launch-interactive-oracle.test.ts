// Blind acceptance tests for #332: sessions the flow opens for the user run
// the harness as the pane's own process. One case per check the ticket pins:
// the harness leads the terminal's foreground group on a pty and as a tmux
// window's own command, it keeps its environment including the role's env
// file, and the headless launches behave exactly as at the base. The Herdr
// leg of C1 needs a live space, so it stays hand-verified and out of this file.
import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Layout } from "./launch-interactive-oracle.ts";
import {
  expectEnv,
  expectLead,
  makeLayout,
  parseProbe,
  printForm,
  runHeadless,
  runPlain,
  runPty,
  runTmux,
  teamConfig,
} from "./launch-interactive-oracle.ts";

function oracle(name: string, fn: (lay: Layout) => void, timeout = 120000): void {
  test(
    name,
    () => {
      const lay = makeLayout();
      try {
        fn(lay);
      } finally {
        lay.cleanup();
      }
    },
    timeout,
  );
}

oracle("pty: the clerk's harness leads the terminal's foreground group", (lay) => {
  const cfg = teamConfig(
    lay,
    "clerk",
    `clerk = { harness = "claude", model = "m", env_file = "${lay.fooEnv}" }`,
  );
  const text = runPty(lay, printForm(lay, cfg, "clerk"));
  expectLead(parseProbe(text), text);
});

oracle("pty: the clerk's harness keeps its environment", (lay) => {
  const cfg = teamConfig(
    lay,
    "clerk",
    `clerk = { harness = "claude", model = "m", env_file = "${lay.fooEnv}" }`,
  );
  const text = runPty(lay, printForm(lay, cfg, "clerk"));
  expectEnv(parseProbe(text), lay, "1", "bar");
});

oracle("pty: the postmaster's harness leads the terminal's foreground group", (lay) => {
  const cfg = teamConfig(
    lay,
    "pm",
    `postmaster = { harness = "claude", model = "m", env_file = "${lay.fooEnv}" }`,
  );
  const text = runPty(lay, printForm(lay, cfg, "postmaster"));
  expectLead(parseProbe(text), text);
});

oracle("pty: the postmaster's harness keeps its environment", (lay) => {
  const cfg = teamConfig(
    lay,
    "pm",
    `postmaster = { harness = "claude", model = "m", env_file = "${lay.fooEnv}" }`,
  );
  const text = runPty(lay, printForm(lay, cfg, "postmaster"));
  expectEnv(parseProbe(text), lay, "1", "bar");
});

oracle("tmux: the clerk's harness is the window's own process", (lay) => {
  const cfg = teamConfig(
    lay,
    "clerk",
    `clerk = { harness = "claude", model = "m", env_file = "${lay.fooEnv}" }`,
  );
  const text = runTmux(lay, printForm(lay, cfg, "clerk"));
  if (text === null) {
    console.log("skip tmux window probe: tmux not on PATH");
    return;
  }
  expectLead(parseProbe(text), text);
});

oracle("an env file that sets FOO hands FOO and SHLVL=1, without the launch names", (lay) => {
  const cfg = teamConfig(
    lay,
    "clerk",
    `clerk = { harness = "claude", model = "m", env_file = "${lay.fooEnv}" }`,
  );
  const r = runPlain(lay, printForm(lay, cfg, "clerk"));
  if (r.code !== 0) throw new Error(`form exited ${r.code}\n--- out ---\n${r.out}\n--- err ---\n${r.err}`);
  expectEnv(parseProbe(r.out), lay, "1", "bar");
});

oracle("an env file that sets SHLVL hands it verbatim", (lay) => {
  const cfg = teamConfig(
    lay,
    "clerk",
    `clerk = { harness = "claude", model = "m", env_file = "${lay.shlvlEnv}" }`,
  );
  const r = runPlain(lay, printForm(lay, cfg, "clerk"));
  if (r.code !== 0) throw new Error(`form exited ${r.code}\n--- out ---\n${r.out}\n--- err ---\n${r.err}`);
  expectEnv(parseProbe(r.out), lay, "9", "UNSET");
});

oracle("an env file that exits 3 starts no harness and ends 3", (lay) => {
  const cfg = teamConfig(
    lay,
    "clerk",
    `clerk = { harness = "claude", model = "m", env_file = "${lay.exit3Env}" }`,
  );
  const report = join(lay.dir, "report.txt");
  const r = runPlain(lay, printForm(lay, cfg, "clerk"), { ORACLE_REPORT: report });
  expect(r.code).toBe(3);
  expect(existsSync(report)).toBe(false);
});

oracle("without an env file the form is the bare harness command", (lay) => {
  const cfg = teamConfig(lay, "clerk", `clerk = { harness = "claude", model = "m" }`);
  const form = printForm(lay, cfg, "clerk");
  expect(form.includes("bash")).toBe(false);
  expect(form.startsWith(`cd ${lay.repo} && claude `)).toBe(true);
  const r = runPlain(lay, `echo PARENT_SHLVL=$SHLVL; ${form}`);
  if (r.code !== 0) throw new Error(`form exited ${r.code}\n--- out ---\n${r.out}\n--- err ---\n${r.err}`);
  const parent = /PARENT_SHLVL=(\S+)/u.exec(r.out);
  if (!parent) throw new Error(`no parent level in:\n${r.out}`);
  // No wrapper, so the harness sees the parent environment verbatim, as today.
  const p = parseProbe(r.out);
  expect(p.shlvl).toBe(parent[1] ?? "");
  expect(p.foo).toBe("UNSET");
  expect(p.parent).toBe("oracle-yes");
  expect(p.launchName).toBe("oracle-name");
  expect(p.launchRole).toBe("oracle-role");
  expect(p.stream).toBe(lay.stream);
});

for (const harness of ["muse", "claude"]) {
  oracle(
    `headless: a self-TERM harness with an env file exits 143 on ${harness}, not by signal`,
    (lay) => {
      const r = runHeadless(lay, harness);
      expect(r.signal).toBeNull();
      expect(r.status).toBe(143);
    },
  );
}
