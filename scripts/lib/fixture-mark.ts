// The fixture-copy mark run fixture new writes: postmaster.fixture in the copy's
// own git config, read back wherever a fixture copy must behave differently.
import { run } from "./proc.ts";

/** Whether the repository at path carries run fixture new's mark. */
export function isFixtureCopy(path: string): boolean {
  if (!path) return false;
  const r = run("git", ["-C", path, "config", "--local", "--get", "postmaster.fixture"]);
  return r.code === 0 && r.out.trim().length > 0;
}
