// Preloaded by bunfig.toml for every `bun test` run in this repository: the gate, a run's own test
// runs and a person's. A time limit catches a hang, so the default sits far above what any test takes
// on a loaded machine, where every test runs at half speed or less. A test or a hook states a limit
// only when it needs more than this.
import { afterAll, setDefaultTimeout } from "bun:test";
import { resolve } from "node:path";
import { scriptsDir } from "./paths.ts";
import "./test-children.ts";
import { removeStrayWorktrees } from "./test-worktrees.ts";

export const DEFAULT_TEST_TIMEOUT_MS = 60_000;

setDefaultTimeout(DEFAULT_TEST_TIMEOUT_MS);

// The gate tells everything it runs where the run's private-data record is, the test suite included,
// and many tests feed the scanner made-up private data on purpose. A test that inherited the path
// would write those findings into the run's record as if the run had made them. Every test run
// passes through this file, so forgetting the path here keeps the whole suite, and anything a test
// starts, out of the record; a test that needs a record names its own.
delete process.env.POSTMASTER_DETECTIONS_LOG;

// A test that pins the tool in a temporary folder and deletes the folder leaves the pin's
// registration in the tool's git folder, where `git worktree list` shows it as prunable. Every test
// run passes through this file, so it takes those registrations out: at the start, for a run that
// was interrupted before it could, and when each test file has ended, after the file's own teardown,
// whether its tests passed or not. Only an entry under the system temporary folder whose folder is
// gone is touched (test-worktrees.ts).
const TOOL = resolve(scriptsDir(import.meta), "../..");
removeStrayWorktrees(TOOL);
afterAll(() => {
  removeStrayWorktrees(TOOL);
});
