---
kind: trial
subject: Muse Code's headless forms, through postmaster's launch.sh
date: 2026-09-27
---

# Method

**Question.** Issue #73 makes Muse Code a harness the flow can launch. What are its headless
launch and resume forms, its thread id and final message? What does it read as ambient context,
and does it wait on its stdin? What does it keep between sessions, and does the launch keep each
lane's and each leg's apart?

**Versions.** Muse Code 1.4.0 (R4302.1) on `muse-spark-1.3-contributor` at effort `low`, git
2.43.0, and the flow's scripts from the branch that closes #73.

**Setup.** `apparatus/run.sh` builds a one-commit repository holding an `AGENTS.md` with the
line `Marker: AGENTS-OK` and a `CLAUDE.md` with `Marker: CLAUDE-OK`. A config names two muse
lanes, `m` and `n`, each taking `META_API_KEY` from an env file. `POSTMASTER_HARNESS_DATA` points
into the trial's own folder, and so does `XDG_DATA_HOME` for the runs that call Muse Code
directly, so nothing touches the machine's own Muse Code data.

**Runs**, through `scripts/launch.sh` unless marked direct:

1. `launch.txt`: lane `m` is asked to remember the code word KESTREL, to write PELICAN into
   `proof.txt`, and to reply DONE.
2. `resume.txt`: lane `m` is resumed on the launch's session and asked for the code word.
3. `same-lane.txt`: a fresh launch of lane `m`, in the same repository, asked for the code word.
4. `other-lane.txt`: a launch of lane `n`, in the same repository, asked the same.
5. `ambient.txt`: lane `m` is asked to quote every `Marker:` line in its instructions, and
   whether its instructions name the author of git commits. The machine's Claude Code user rules
   do.
6. `ambient-no-personal.txt`, direct: the same, with `--no-foreign-personal-context`.
7. `open-stdin.txt`, direct: the launch form without its `/dev/null`, on a pipe that stays open
   for 60 seconds and sends nothing.
8. `bad-model.txt`: lane `m` on a model that does not exist.

**What is recorded.** For each run: its exit, its duration, the number of records and sessions,
the first record's type, the model `run.model.configured` names and its source, the tools whose
results came back, and the last `run.terminal.*` record with its text. No stream is kept whole.

# Results

- **Launch.** Exit 0 in 25 seconds, `proof.txt` written with no approval asked, one session in
  the stream, and a final text of DONE. Muse Code stored the code word with `add_memory`.
- **Resume.** Exit 0, every record on the launch's session, the model reported again with
  `source` `replay`, and KESTREL answered with no tool call.
- **Memory.** A fresh launch of the same lane, whose data directory is the launch's, answered
  KESTREL. A launch of the other lane in the same repository, whose data directory is its own,
  answered NONE.
- **Ambient context.** It quoted `Marker: AGENTS-OK` and not the `CLAUDE.md` marker, and said
  its instructions name the author of git commits. With `--no-foreign-personal-context` it quoted
  the same marker and said they do not.
- **Stdin.** With an open pipe it waited the whole 60 seconds, then answered.
- **A bad model.** Exit 1 in 2 seconds, the stream ending on `run.terminal.failed` with no
  text, and five lines on stderr.

# What it settles

Facts about one tool at one version. Muse Code 1.4.0's headless launch is `muse exec --json`
with the prompt from a file and `--yolo`, and a resume is the same with `--session-id`. The
thread id is the first record's `stream.id`, and the final message is the last
`run.terminal.*` record's text. It reads `AGENTS.md` in a trusted workspace and, by default,
Claude Code's user rules. It reads its stdin to the end. Its memory outlives a session unless
each lane has its own `XDG_DATA_HOME`, which `launch.sh` now gives it. No record carries the
effort, so the trial cannot show that a resume keeps it; the launch form passes it on every
resume, which `launch.sh`'s self-test shows.
