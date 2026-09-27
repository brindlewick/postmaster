---
kind: trial
subject: which skills folders claude 2.1.283, pi 0.87.0, mimo 0.1.15, codex 0.157.1 and muse 1.4.0 read, and whether they follow a linked skill
date: 2026-09-26
---

# Method

**Question.** Does each harness load a skill whose folder is a symbolic link into the
postmaster repo, from which folders, and what does it do with a link that is missing or
points nowhere?

**Setup.** Claude Code 2.1.283, pi 0.87.0, MiMo Code 0.1.15 (`mimo`), codex 0.157.1 and Muse
Code 1.4.0 (`muse`), every harness installed on the machine that ran it. Every case
gets a fresh temporary HOME holding only the link under test, and an empty working directory,
so no real skills folder is read or written. `run.sh` beside this file is the whole trial;
`results.txt` is its output.

**How a harness is asked what it found.** Before any model is called:

- claude: the first event of `claude -p hi --output-format stream-json --verbose` is the init
  event, which lists the skills it loaded. It is printed before authentication, so the
  temporary HOME needs no credentials and nothing reaches a provider; the run then stops at
  "Not logged in".
- pi: `pi --mode rpc --offline --no-session` answers a `get_commands` request with every skill
  command it registered and the path it loaded each from.
- mimo: `mimo debug skill` prints every skill it found as JSON, with the path it loaded each
  from, its own built-in skills among them.
- codex: `codex debug prompt-input` renders the input the model would be given, whose skills
  list names each skill's file under a root alias (`r0/postmaster/SKILL.md`) and defines each
  alias as a folder.
- muse: `muse skills list --json` lists every skill with its path and scope, and any
  diagnostics about the skills it could not load.

**Cases.** For each harness: a link in each user-level folder its docs or its binary name; no
link (the negative control, which must read "not listed"); a link that points nowhere. For
claude also a link in `~/.agents/skills`, which it does not document, one in
`$CLAUDE_CONFIG_DIR/skills`, and one in the working directory's `.claude/skills`. For pi also
links in both of its folders to the same target. For mimo also `~/.claude/skills`, the project
folders `.agents/skills`, `.mimocode/skills` and `.claude/skills`, and a repo's `.agents/skills`
seen from a subfolder of that repo. For codex also `~/.codex/skills` and `~/.claude/skills`. For
muse also `~/.config/muse/skills`, `~/.claude/skills`, `~/.codex/skills`, and links in both
`~/.agents/skills` and `~/.claude/skills` to the same target.

**Whether a harness says anything about a link that points nowhere.** For those cases the trial
keeps each harness's stderr and output, and counts the bytes on stderr and the times the link's
path or its missing target appears in either. The same count of a string that output is known
to hold is the control that it can read more than zero: the working directory in claude's and
codex's output, the request name in pi's answer, mimo's data folder in the paths of its built-in
skills, and the source type of muse's. mimo's stderr on a fresh HOME is its one-time database
migration notice, and codex's is a warning that it will not create helper binaries under a
temporary folder; both are the same with or without a link.

**Not established here.** Whether a skill loaded through a link behaves differently in use
from one that is not, and anything about grok or agy, which were not installed.

**Repeating it.** `run.sh <postmaster-checkout>` with claude, pi, mimo, codex and muse on PATH.
