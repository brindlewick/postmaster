// Tests beside scripts/runs-watch.ts, moved from its --self-test on #109: 33 controls.
// POSTMASTER_CONFIG is pointed at a 1s-poll config for the run and restored in afterAll.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./lib/proc.ts";

const self = join(import.meta.dir, "runs-watch.sh");
const savedConfig = process.env.POSTMASTER_CONFIG;

let tmp = "";

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "postmaster-"));
  writeFileSync(join(tmp, "config.toml"), "[postmaster]\npoll_seconds = 1\n");
  process.env.POSTMASTER_CONFIG = join(tmp, "config.toml");
});

afterAll(() => {
  if (savedConfig === undefined) delete process.env.POSTMASTER_CONFIG;
  else process.env.POSTMASTER_CONFIG = savedConfig;
  rmSync(tmp, { recursive: true, force: true });
});

function watch(root: string, timeout = "2", config?: string): { rc: number; out: string } {
  const r = run(
    self,
    ["--timeout", timeout, root],
    config === undefined ? {} : { env: { POSTMASTER_CONFIG: config } },
  );
  return { rc: r.code, out: `${r.out}${r.err}` };
}

function mkrun(root: string, name: string, stage: string, leg: number, ...markers: string[]): void {
  const d = join(root, name);
  mkdirSync(join(d, "logs"), { recursive: true });
  writeFileSync(join(d, "manifest.json"), `{"stage": "${stage}", "leg": ${leg}}\n`);
  writeFileSync(join(d, "run-log.md"), "");
  for (const m of markers) writeFileSync(join(d, m), "");
}

function age(root: string, name: string): void {
  // Nothing in the run has changed for an hour: files only, as os.walk lists them.
  const t = Date.now() / 1000 - 3600;
  const walk = (d: string): void => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else {
        try {
          utimesSync(p, t, t);
        } catch {
          /* ignore */
        }
      }
    }
  };
  walk(join(root, name));
}

function later(file: string): void {
  // The shell sleeps in the foreground and watches in the background; here
  // the marker arrives from a detached sleeper while run() blocks.
  const child = spawn("sh", ["-c", 'sleep 2; : > "$1"', "sh", file], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

describe("positive controls: each NEXT that needs the postmaster names its run", () => {
  const specs: Array<[string, string, number, string, string]> = [
    ["rule", "review", 2, ".escalation-ready", "RULE"],
    ["gate", "shipping", 3, ".card-ready", "GATE"],
    ["spec", "planning", 1, ".spec-review-ready", "SPEC"],
    ["dispatch", "review", 2, ".leg-2-done", "DISPATCH"],
    ["remount", "review", 2, ".leg-2-exited", "REMOUNT"],
    ["read", "review", 2, ".checkpoint-review-ready", "READ"],
  ];
  for (const [name, stage, leg, marker, want] of specs) {
    test(`NEXT ${want} names ${name}`, () => {
      const root = join(tmp, `pos-${name}`);
      mkdirSync(root, { recursive: true });
      mkrun(root, name, stage, leg, marker);
      const { rc, out } = watch(root);
      expect(rc).toBe(0);
      expect(out).toContain(`needs ${name} ${want}`);
      expect(out).toContain("NEXT");
    }, 30000);
  }

  test("NEXT INSPECT names inspect", () => {
    const root = join(tmp, "pos-inspect");
    mkdirSync(root, { recursive: true });
    mkrun(root, "inspect", "review", 2);
    age(root, "inspect");
    const { rc, out } = watch(root);
    expect(rc).toBe(0);
    expect(out).toContain("needs inspect INSPECT");
  }, 30000);

  test("a run that becomes actionable mid-wait is named", () => {
    const root = join(tmp, "pos-late");
    mkdirSync(root, { recursive: true });
    mkrun(root, "late", "review", 2);
    later(join(root, "late", ".escalation-ready"));
    const { rc, out } = watch(root, "10");
    expect(rc).toBe(0);
    expect(out).toContain("needs late RULE");
    expect(out).not.toContain("the poll interval is the default");
  }, 30000);

  test("every waking run is named", () => {
    const root = join(tmp, "pos-multi");
    mkdirSync(root, { recursive: true });
    mkrun(root, "first", "review", 2, ".escalation-ready");
    mkrun(root, "second", "shipping", 3, ".card-ready");
    const { rc, out } = watch(root);
    expect(rc).toBe(0);
    expect(out).toContain("needs first RULE");
    expect(out).toContain("needs second GATE");
    expect(out).toContain("NEXT");
  }, 30000);

  test("a usable poll interval wakes promptly", () => {
    const root = join(tmp, "pos-prompt");
    mkdirSync(root, { recursive: true });
    mkrun(root, "prompt", "review", 2);
    const t0 = Math.floor(Date.now() / 1000);
    later(join(root, "prompt", ".escalation-ready"));
    const { rc, out } = watch(root, "30");
    const took = Math.floor(Date.now() / 1000) - t0;
    expect(rc).toBe(0);
    expect(out).toContain("needs prompt RULE");
    expect(took <= 15).toBe(true);
  }, 30000);
});

describe("negative controls: WAIT, USER, - and a held run leave it waiting", () => {
  test("a leg at work is left waiting until the timeout", () => {
    const root = join(tmp, "neg-wait");
    mkdirSync(root, { recursive: true });
    mkrun(root, "wait", "review", 2);
    const { rc, out } = watch(root);
    expect(rc).toBe(3);
    expect(out).toContain("NEXT");
    expect(out).toContain("wait ");
    expect(out).toContain("WAIT");
    expect(out).not.toContain("needs ");
  }, 30000);

  test("a run put to the user is left waiting until the timeout", () => {
    const root = join(tmp, "neg-user");
    mkdirSync(root, { recursive: true });
    mkrun(root, "user", "review", 2, ".waiting-on-user", ".leg-2-exited");
    const { rc, out } = watch(root);
    expect(rc).toBe(3);
    expect(out).toContain("NEXT");
    expect(out).toContain("user ");
    expect(out).toContain(".waiting-on-user");
    expect(out).not.toContain("needs ");
  }, 30000);

  test("a closed run is left waiting until the timeout", () => {
    const root = join(tmp, "neg-closed");
    mkdirSync(root, { recursive: true });
    mkrun(root, "closed", "done", 3, ".leg-3-done");
    const { rc, out } = watch(root);
    expect(rc).toBe(3);
    expect(out).toContain("NEXT");
    expect(out).toContain("closed ");
    expect(out).toContain(".leg-3-done");
    expect(out).not.toContain("needs ");
  }, 30000);

  test("a run on the held list never needs the postmaster", () => {
    const root = join(tmp, "neg-held");
    mkdirSync(root, { recursive: true });
    mkrun(root, "held", "review", 2, ".escalation-ready");
    mkdirSync(join(root, "postmaster"), { recursive: true });
    writeFileSync(join(root, "postmaster/held"), "held\n");
    const { rc, out } = watch(root);
    expect(rc).toBe(3);
    expect(out).toContain("NEXT");
    expect(out).toContain("held ");
    expect(out).toContain(".escalation-ready");
    expect(out).not.toContain("needs ");
    expect(out).not.toContain("matches no run");
  }, 30000);

  test("a #ticket held line warns that it matches no run", () => {
    const root = join(tmp, "neg-heldhash");
    mkdirSync(root, { recursive: true });
    mkrun(root, "121", "review", 2, ".escalation-ready");
    mkdirSync(join(root, "postmaster"), { recursive: true });
    writeFileSync(join(root, "postmaster/held"), "#121\n");
    const { rc, out } = watch(root, "0");
    expect(rc).toBe(0);
    expect(out).toContain("needs 121 RULE");
    expect(out).toContain('held "#121" matches no run');
  }, 30000);

  test("a held line for no run warns", () => {
    const root = join(tmp, "neg-heldtypo");
    mkdirSync(root, { recursive: true });
    mkrun(root, "wait", "review", 2);
    mkdirSync(join(root, "postmaster"), { recursive: true });
    writeFileSync(join(root, "postmaster/held"), "999\n");
    const { rc, out } = watch(root, "0");
    expect(rc).toBe(3);
    expect(out).toContain("wait ");
    expect(out).toContain('held "999" matches no run');
    expect(out).not.toContain("needs ");
  }, 30000);

  test("a held run is left out of the names even beside a waking run", () => {
    const root = join(tmp, "neg-mixed");
    mkdirSync(root, { recursive: true });
    mkrun(root, "free", "review", 2, ".card-ready");
    mkrun(root, "held", "review", 2, ".escalation-ready");
    mkdirSync(join(root, "postmaster"), { recursive: true });
    writeFileSync(join(root, "postmaster/held"), "held\n");
    const { rc, out } = watch(root);
    expect(rc).toBe(0);
    expect(out).toContain("needs free GATE");
    expect(out).toContain("held ");
    expect(out).toContain(".escalation-ready");
    expect(out).not.toContain("needs held");
  }, 30000);

  test("a dangling held link is refused", () => {
    const root = join(tmp, "neg-heldlink");
    mkdirSync(root, { recursive: true });
    mkrun(root, "held", "review", 2, ".escalation-ready");
    mkdirSync(join(root, "postmaster"), { recursive: true });
    symlinkSync(join(tmp, "no-such-target"), join(root, "postmaster/held"));
    const { rc, out } = watch(root, "0");
    expect(rc).toBe(1);
    expect(out).toContain("cannot read");
    expect(out).not.toContain("needs ");
  }, 30000);

  test("a held list that is a directory is refused", () => {
    const root = join(tmp, "neg-helddir");
    mkdirSync(root, { recursive: true });
    mkrun(root, "held", "review", 2, ".escalation-ready");
    mkdirSync(join(root, "postmaster/held"), { recursive: true });
    const { rc, out } = watch(root, "0");
    expect(rc).toBe(1);
    expect(out).toContain("cannot read");
    expect(out).not.toContain("needs ");
  }, 30000);

  test("an unreadable held list is refused", () => {
    const root = join(tmp, "neg-heldperm");
    mkdirSync(root, { recursive: true });
    mkrun(root, "held", "review", 2, ".escalation-ready");
    mkdirSync(join(root, "postmaster"), { recursive: true });
    writeFileSync(join(root, "postmaster/held"), "held\n");
    chmodSync(join(root, "postmaster/held"), 0);
    const { rc, out } = watch(root, "0");
    chmodSync(join(root, "postmaster/held"), 0o644);
    expect(rc).toBe(1);
    expect(out).toContain("cannot read");
    expect(out).not.toContain("needs ");
  }, 30000);

  test("an unlistable postmaster dir is refused", () => {
    const root = join(tmp, "neg-heldlock");
    mkdirSync(root, { recursive: true });
    mkrun(root, "held", "review", 2, ".escalation-ready");
    mkdirSync(join(root, "postmaster"), { recursive: true });
    writeFileSync(join(root, "postmaster/held"), "held\n");
    chmodSync(join(root, "postmaster"), 0);
    const { rc, out } = watch(root, "0");
    chmodSync(join(root, "postmaster"), 0o755);
    expect(rc).toBe(1);
    expect(out).toContain("cannot read");
    expect(out).not.toContain("needs ");
  }, 30000);

  test("a run root with a backslash still holds its held runs", () => {
    const root = join(tmp, "neg-bsroot");
    mkdirSync(root, { recursive: true });
    mkrun(root, "heldrun", "review", 2, ".escalation-ready");
    mkdirSync(join(root, "postmaster"), { recursive: true });
    writeFileSync(join(root, "postmaster/held"), "heldrun\n");
    const bsroot = join(tmp, "neg-bs\\q");
    renameSync(root, bsroot);
    const { rc, out } = watch(bsroot, "0");
    expect(rc).toBe(3);
    expect(out).toContain("NEXT");
    expect(out).toContain("heldrun ");
    expect(out).not.toContain("needs ");
    expect(out).not.toContain("warning");
  }, 30000);

  test("an empty timeout still looks once, prints the table and exits 3", () => {
    const root = join(tmp, "neg-none");
    mkdirSync(root, { recursive: true });
    mkrun(root, "alone", "done", 1);
    const { rc, out } = watch(root, "0");
    expect(rc).toBe(3);
    expect(out).toContain("NEXT");
    expect(out).toContain("alone ");
    expect(out).not.toContain("needs ");
  }, 30000);
});

describe("config: a missing or unusable poll interval falls back to the default", () => {
  let root = "";

  beforeAll(() => {
    root = join(tmp, "cfg-missing");
    mkdirSync(root, { recursive: true });
    mkrun(root, "wait", "review", 2);
  });

  test("a missing config still runs on the default, and says so", () => {
    const { rc, out } = watch(root, "2", join(tmp, "nowhere.toml"));
    expect(rc).toBe(3);
    expect(out).toContain("NEXT");
    expect(out).toContain("wait ");
    expect(out).not.toContain("needs ");
    expect(out).toContain("the poll interval is the default, 120s");
  }, 30000);

  test("an unusable poll interval falls back to the default, and says so", () => {
    writeFileSync(join(tmp, "bad.toml"), '[postmaster]\npoll_seconds = "soon"\n');
    const { rc, out } = watch(root, "2", join(tmp, "bad.toml"));
    expect(rc).toBe(3);
    expect(out).toContain("NEXT");
    expect(out).toContain("wait ");
    expect(out).toContain("the poll interval is the default, 120s");
  }, 30000);

  test("a zero poll interval falls back to the default, and says so", () => {
    writeFileSync(join(tmp, "zero.toml"), "[postmaster]\npoll_seconds = 0\n");
    const { rc, out } = watch(root, "2", join(tmp, "zero.toml"));
    expect(rc).toBe(3);
    expect(out).toContain("wait ");
    expect(out).toContain("the poll interval is the default, 120s");
  }, 30000);

  test("a config that is not UTF-8 falls back to the default, and says so", () => {
    writeFileSync(
      join(tmp, "badutf8.toml"),
      new Uint8Array([0xff, 0xfe, 0x00, 0x62, 0x61, 0x64, 0x80]),
    );
    const { rc, out } = watch(root, "2", join(tmp, "badutf8.toml"));
    expect(rc).toBe(3);
    expect(out).toContain("wait ");
    expect(out).toContain("the poll interval is the default, 120s");
    expect(out).not.toContain("Traceback");
  }, 30000);

  test("a timeout shorter than the poll interval still ends on time", () => {
    writeFileSync(join(tmp, "slow.toml"), "[postmaster]\npoll_seconds = 8\n");
    const t0 = Math.floor(Date.now() / 1000);
    const { rc, out } = watch(root, "2", join(tmp, "slow.toml"));
    const took = Math.floor(Date.now() / 1000) - t0;
    expect(rc).toBe(3);
    expect(out).toContain("wait ");
    expect(took <= 5).toBe(true);
  }, 30000);
});

describe("usage", () => {
  test("no run root is refused with the usage", () => {
    const r = run(self, []);
    const out = `${r.out}${r.err}`;
    expect(r.code).toBe(1);
    expect(out).toContain("usage:");
    expect(out).not.toContain("NEXT");
  }, 30000);

  test("a timeout that is not a number is refused", () => {
    const r = run(self, ["--timeout", "soon", join(tmp, "neg-wait")]);
    const out = `${r.out}${r.err}`;
    expect(r.code).toBe(1);
    expect(out).toContain("not a whole number");
  }, 30000);

  test("an empty timeout is refused", () => {
    const r = run(self, ["--timeout", "", join(tmp, "neg-wait")]);
    const out = `${r.out}${r.err}`;
    expect(r.code).toBe(1);
    expect(out).toContain("not a whole number");
  }, 30000);

  test("a run root that does not exist is refused", () => {
    const r = run(self, ["--timeout", "2", join(tmp, "nowhere")]);
    const out = `${r.out}${r.err}`;
    expect(r.code).toBe(1);
    expect(out).toContain("no such root");
  }, 30000);

  test("--help prints the usage", () => {
    const r = run(self, ["--help"]);
    const out = `${r.out}${r.err}`;
    expect(r.code).toBe(0);
    expect(out).toContain("runs-watch.sh");
    expect(out).toContain("held");
  }, 30000);
});
