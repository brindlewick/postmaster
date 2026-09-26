---
title: A skill is a link to the postmaster repo, never a copy
type: concept
standing: claimed
sources: [trials/skill-folders]
updated: 2026-09-26
---

# A skill is a link to the postmaster repo, never a copy

**Claim.** Installing each skill as a link from a harness's user-level skills folder to the
postmaster repo's main checkout keeps one source of truth, lets the skill run from any project,
and tells a session where the repo is: it is wherever the link leads.

**Standing: claimed.** This is the user's decision, taken in
[issue #15](https://github.com/brindlewick/postmaster/issues/15) before any run bears on it. A
trial settles the narrower fact it rests on for the two harnesses that were installed: they
load a linked skill [@trials/skill-folders].

## The reasoning

- **A copy breaks silently.** The skills name their scripts, and the scripts live at the repo's
  root. A copied skill leaves them behind, so every command in it fails, and it goes stale as
  the runbooks change. A link cannot drift from the checkout it points at.
- **The link says where the repo is.** A session resolves the skill's own folder through its
  link, and the repo is two levels up. That path is `<tool>` in the runbooks, found once and
  handed to every session the flow briefs, so no path is configured and none goes stale.
- **The main checkout, never a worktree.** A worktree is a branch in progress and is removed
  when it merges. A link into one would load unmerged runbooks, then point nowhere.
- **Nothing is added to a project.** Every harness the flow covers reads a user-level folder,
  and none loads skills only from inside a project, so no project gets a link. A link in a
  project would hold an absolute path on one machine, which does not belong in its commits.
- **The first check cannot be a script.** Finding the repo is the one step that runs before
  `scripts/` can be reached: when the link is missing or leads to a copy, the scripts are
  exactly what is out of reach. So it is one line in `SKILL.md` that names the link when it
  fails, rather than a bare "no such file". `scripts/link-skills.sh --self-test` runs that line
  as written, so it cannot drift from what the self-test proves.

## What the trial found

Claude Code 2.1.283 and pi 0.87.0, each with a temporary HOME holding only the link under test
[@trials/skill-folders]:

- Both list a skill whose folder is a link, in each user-level folder they document, and
  neither lists one whose link is missing or points nowhere. Neither says anything about a link
  that points nowhere, on stderr or in its output, so the harness is no check that a link
  works; the resolver in `SKILL.md` and `scripts/link-skills.sh` are.
- Claude Code reads `~/.claude/skills`, or `$CLAUDE_CONFIG_DIR/skills` when that is set, and
  does not read `~/.agents/skills`. pi reads both `~/.pi/agent/skills` and `~/.agents/skills`,
  and lists a skill linked from both to one target once.
- pi reports a linked skill at the link's path, not at its target. A session given that path
  must resolve it to find the repo, which is why the resolver uses `cd -P`.

codex, grok and muse document a user-level folder that `~/.agents/skills` serves; codex's
documentation says it follows a linked skill, and grok's and muse's do not say. Antigravity's
CLI documentation names `~/.gemini/antigravity-cli/skills`, while its changelog moves its global
configuration to `~/.gemini/config/`. It is not linked until a trial settles which folder it
reads, and until then a session on it is pointed at the skill by absolute path.
`skills/postmaster/harnesses.md` records each harness's folder and its source.

## What would change it

- A harness that does not follow a linked skill folder. The fix would stay a link, to wherever
  that harness does look, or an absolute path in its brief; never a copy.
- A harness update that removes links. One was reported against Claude Code's auto-update on
  macOS ([issue 50052](https://github.com/anthropics/claude-code/issues/50052), closed as not
  planned); it has not been seen here. Running `scripts/link-skills.sh` again restores the
  links, and the resolver names a missing one.
- A trial of Antigravity's CLI showing which folder it reads, which would add it to the table.

## What changed because of it

`scripts/link-skills.sh` makes the links, and setup runs it. `SKILL.md` finds `<tool>` from
its own link before anything else, and every script path in `skills/postmaster/` goes through
`<tool>`; `scripts/skill-refs.sh` names any that does not. The Skills folders table in
`skills/postmaster/harnesses.md` is the link script's source, and the README describes the
linked install only.
