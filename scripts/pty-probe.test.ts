// TEMP-DIAG-R6 pty probe, removed before the card: runPty returns empty on
// macOS, so each variant below runs one script shape and reports what the
// runner's script does with it. bun prints the console lines.
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

function probe(
  label: string,
  args: string[],
  input: string | null,
): void {
  const r = spawnSync("script", args, {
    ...(input === null ? {} : { input }),
    timeout: 30000,
    encoding: "utf8",
  });
  console.log(
    `${label}: status=${r.status} signal=${r.signal} error=${r.error ? String(r.error) : "none"}`,
  );
  console.log(`${label} stdout=${JSON.stringify(String(r.stdout ?? "").slice(0, 300))}`);
  console.log(`${label} stderr=${JSON.stringify(String(r.stderr ?? "").slice(0, 300))}`);
}

test("TEMP-DIAG-R6 probe: script shapes on this runner", () => {
  probe(
    "v1-current-darwin",
    ["-q", "/dev/null", "bash", "--norc", "--noprofile", "-i"],
    "echo PROBE-V1\nexit\n",
  );
  probe(
    "v2-no-interactive",
    ["-q", "/dev/null", "bash", "--norc", "--noprofile"],
    "echo PROBE-V2\nexit\n",
  );
  probe("v3-command-form", ["-q", "/dev/null", "bash", "--norc", "--noprofile", "-c", "echo PROBE-V3"], null);
  probe("v4-default-shell", ["-q", "/dev/null"], "echo PROBE-V4\nexit\n");
  probe("v5-monitor-mode", ["-q", "/dev/null", "bash", "--norc", "--noprofile", "-m", "-c", "echo PROBE-V5"], null);
  expect(typeof process.platform).toBe("string");
});
