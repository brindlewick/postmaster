---
kind: trial
subject: MiMo Code's headless forms, through postmaster's launch.sh
date: 2026-09-27
---

# Method

**Question.** Issue #74 makes MiMo Code a harness the flow can launch. What are its headless
launch and resume forms, its thread id and final message? Does a resume keep the model and the
variant? What does it read as ambient context, and what does it take from Claude Code's
settings? Does it wait on its stdin, and how does a failure show? What does it keep between
sessions, and does the launch keep each lane's apart?

**Redacted 2026-09-27.** The provider id of the account's plan, which names a region, is shown
as `<plan-provider>`. Nothing else in this record was changed.

**Versions.** MiMo Code 0.1.15 on `<plan-provider>/mimo-v2.6-pro` at variant `low`, git
2.43.0, and the flow's scripts from the branch that closes #74.

**Setup.** `apparatus/run.sh` builds a one-commit repository holding an `AGENTS.md` with the
line `Marker: AGENTS-OK` and a `CLAUDE.md` with `Marker: CLAUDE-OK`. It also holds a project
hook in `.claude/settings.json` that touches a file before any shell command, and a project MCP
server in `.claude.json` whose command touches another; both files land outside the repository.
A config names two mimo lanes, `x` and `y`, each taking `XIAOMI_API_KEY` from an env file.
`POSTMASTER_HARNESS_DATA` points into the trial's own folder, and so does `XDG_DATA_HOME` for the
runs that call MiMo Code directly, so nothing touches the machine's own MiMo Code data.

**Runs**, through `scripts/launch.sh` unless marked direct:

1. `launch.txt`: lane `x` is asked to remember the code word KESTREL, to write PELICAN into
   `proof.txt`, and to reply DONE.
2. `resume.txt`: lane `x` is resumed on the launch's session and asked for the code word; then
   `mimo export` lists each assistant message's model and variant.
3. `resume-unnamed.txt`, direct: the same resume, in lane `x`'s data directory, naming no model
   and no variant, and the export again.
4. `same-lane.txt`: a fresh launch of lane `x` in the same repository, asked to search its memory
   and its session history for the code word.
5. `other-lane.txt`: a launch of lane `y` in the same repository, asked the same.
6. `ambient.txt`: lane `x` is asked to quote every `Marker:` line in its instructions, and
   whether its instructions name the author of git commits. The machine's Claude Code user rules
   do.
7. `ambient-no-claude.txt`: the same, with `MIMOCODE_DISABLE_CLAUDE_CODE_PROMPT=1`.
8. `claude-settings.txt`: lane `x` is asked to run `echo hi`; the record says whether the project
   hook ran and whether the project MCP server was started.
9. `open-stdin.txt`, direct: the prompt in argv, on a pipe that stays open for 60 seconds and
   sends nothing.
10. `bad-model.txt`: lane `x` on a provider and model that do not exist.

**What is recorded.** For each run: its exit, its duration, the event types, the number of
sessions, the tools used, the `step_finish` reasons, any `error` event's name, and the text of
the last `text` event. No stream is kept whole.

# Results

- **Launch.** Exit 0 in 38 seconds, `proof.txt` written with no approval asked, one session,
  and a final text of DONE. It also wrote the code word into its data directory's shared
  session notes, `memory/sessions/current_session_id/notes.md`.
- **Resume.** Exit 0, every event on the launch's session, and KESTREL answered with no tool
  call. `mimo export` lists every assistant message on `mimo-v2.6-pro` at variant `low`.
- **Resume naming no model or variant.** It answered KESTREL, but its message ran with no
  variant: the export shows `None` where the others show `low`.
- **Memory.** A fresh launch of the same lane, in its own data directory, found KESTREL with
  its `memory` and `history` tools. A launch of the other lane found nothing with those tools;
  asked to search, it then searched the machine: `find` over the home directory, other
  harnesses' data, SQLite databases, Claude Code's transcripts, and at last lane `x`'s notes file
  in lane `x`'s data directory, where it read KESTREL.
- **Ambient context.** It quoted both markers, since `AGENTS.md` is under 500 characters, and
  said its instructions name the author of git commits. With
  `MIMOCODE_DISABLE_CLAUDE_CODE_PROMPT=1` it quoted only the `AGENTS.md` marker and said they
  do not.
- **Claude Code's settings.** The project's hook did not run; the project's MCP server was
  started.
- **Stdin.** With the prompt in argv and an open pipe, it waited the whole 60 seconds, then
  answered.
- **A bad model.** Exit 0 all the same, one `error` event (`UnknownError`), no text, and 25
  lines on stderr.

# What it settles

Facts about one tool at one version. MiMo Code 0.1.15's headless launch is `mimo run --format
json` with the prompt on stdin and `--dangerously-skip-permissions`, and a resume is the same
with `-s`; a resume must name its variant again. The thread id is the `sessionID`, and the final
message is the last `text` event's text; a failure exits 0 and shows as an `error` event. It
reads `AGENTS.md`, a `CLAUDE.md` beside a short one, and Claude Code's user rules; it starts a
project's MCP servers and runs no Claude Code hook. Its memory is per data directory, so a lane
of its own keeps other lanes' notes out of its memory tools. It does not keep a lane from
reading another lane's files, or any other file on the machine, when the lane goes looking.
