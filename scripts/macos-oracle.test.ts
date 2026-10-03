// Bun test driver for the #217 blind acceptance oracle. One test per check;
// each timeout comes from the check, since launches and watchers take seconds.
import { describe, test } from "bun:test";
import { checks } from "./macos-oracle.ts";

describe("macOS oracle for #217", () => {
  for (const check of checks) {
    test(
      check.name,
      async () => {
        await check.run();
      },
      check.timeoutMs,
    );
  }
});
