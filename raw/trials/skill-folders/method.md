---
kind: trial
subject: which skills folders claude 2.1.283 and pi 0.87.0 read, and whether they follow a linked skill
date: 2026-09-26
---

# Method

**Question.** Does each harness load a skill whose folder is a symbolic link into the
postmaster repo, from which user-level folders, and what does it do with a link that is
missing or points nowhere?

**Setup.** Claude Code 2.1.283 and pi 0.87.0, the two harnesses installed on the machine that
ran it. Every case gets a fresh temporary HOME holding only the link under test, and an empty
working directory, so no real skills folder is read or written. `run.sh` beside this file is
the whole trial; `results.txt` is its output.

**How a harness is asked what it found.** Before any model is called:

- claude: the first event of `claude -p hi --output-format stream-json --verbose` is the init
  event, which lists the skills it loaded. It is printed before authentication, so the
  temporary HOME needs no credentials and nothing reaches a provider; the run then stops at
  "Not logged in".
- pi: `pi --mode rpc --offline --no-session` answers a `get_commands` request with every skill
  command it registered and the path it loaded each from.

**Cases.** For each harness: a link in each user-level folder its docs name; no link (the
negative control, which must read "not listed"); a link that points nowhere. For claude also
a link in `~/.agents/skills`, which it does not document, one in `$CLAUDE_CONFIG_DIR/skills`,
and one in the working directory's `.claude/skills`. For pi also links in both of its folders
to the same target.

**Whether a harness says anything about a link that points nowhere.** For those two cases the
trial keeps each harness's stderr and output, and counts the bytes on stderr and the times the
missing target's path appears in either. The same count of a string that output is known to
hold, the working directory in claude's init event and the request name in pi's answer, is the
control that it can read more than zero.

**Not established here.** Whether a skill loaded through a link behaves differently in use
from one that is not, and anything about codex, grok, agy or muse, none of which was installed.

**Repeating it.** `run.sh <postmaster-checkout>` with claude and pi on PATH.
