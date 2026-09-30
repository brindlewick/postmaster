// Whether a harness has its own code-review skill. The executable half of harnesses.md's Own
// review skills table for code-review, so that launch.sh, reviewers.sh and setup.sh never each
// carry a copy of the list.
//
//   review-forms.sh has <harness>   exit 0 when the harness has a code-review form, 3 when not
//   review-forms.sh --self-test
//
//   exit 0  has: the harness has a form; --self-test: all controls behaved
//   exit 3  has: the harness has no code-review form
//   exit 1  usage
import { join } from "node:path";
import { scriptsDir } from "./lib/paths.ts";
import { run } from "./lib/proc.ts";
import { SelfTest } from "./lib/selftest.ts";

const HERE = scriptsDir(import.meta);
const USAGE = "usage: review-forms.sh has <harness> | --self-test";
const FORMS = new Set(["claude", "codex", "mimo"]);

const argv = process.argv.slice(2);

if (argv[0] === "--self-test") {
  const self = join(HERE, "review-forms.sh");
  const st = new SelfTest();

  console.log("positive controls");
  for (const h of ["claude", "codex", "mimo"]) {
    const r = run(self, ["has", h]);
    st.check(`a ${h} lane has a code-review form`, r.code === 0, r.out + r.err);
  }

  console.log("negative controls");
  for (const h of ["pi", "muse", "grok", "agy", "bash"]) {
    const r = run(self, ["has", h]);
    st.check(`a ${h} lane has no code-review form: exit 3`, r.code === 3, `got exit ${r.code}`);
  }
  {
    const r = run(self, ["has"]);
    st.check("has with no harness is refused", r.code === 1, `got exit ${r.code}`);
  }
  {
    const r = run(self, ["has", "claude", "extra"]);
    st.check("has with an extra argument is refused", r.code === 1, `got exit ${r.code}`);
  }
  st.finish();
} else if (argv[0] === "has" && argv.length === 2) {
  process.exit(FORMS.has(argv[1]!) ? 0 : 3);
} else {
  console.error(USAGE);
  process.exit(1);
}
