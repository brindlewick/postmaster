---
kind: trial
subject: Muse Code and MiMo Code through launch.sh, each check with a positive and a negative control
date: 2026-09-27
---

# Method

**Question.** Issue #71 asks for a trial of each CLI that shows a headless launch and a resume of
the same thread, with each check under a positive and a negative control: the thread id read
from the stream where `harnesses.md` says it is, the final message found where it says, the
prompt received verbatim, and the resumed thread keeping its model. The trials of issues #73 and
#74 (`raw/trials/muse-headless-forms/`, `raw/trials/mimo-headless-forms/`) established the forms
on the real providers. This one adds what the model received and the negative controls, and asks
what each harness does with a resume of a thread it does not hold.

**Versions.** Muse Code 1.4.0 (R4302.1), MiMo Code 0.1.15, git 2.43.0, Python 3.12, and the
flow's scripts from the branch that closes #71. `versions.txt` has them as run.

**Setup.** `apparatus/run.sh` builds a one-commit repository holding an `AGENTS.md`, and a
second repository to resume from. HOME, `POSTMASTER_HARNESS_DATA` and each direct run's
`XDG_DATA_HOME` are the trial's own folders, so nothing touches the machine's own harness data
or user rules, and `MUSE_NO_AUTO_UPDATE=1` holds Muse Code at one version. The prompt file holds
quotes, a dollar sign, backticks, an `@` mention, a line opening with a dash, non-ASCII text and
a final newline; `checks.txt` prints it.

- **Muse Code** runs on its echo provider, which answers with `echo: ` and the prompt it was
  given. A wrapper first on PATH adds `--provider echo` to `muse exec` and drops `--model` and
  `--reasoning-effort`, which the echo provider refuses; `muse export` passes through. The echo
  provider records no model, so the model checks run on Muse Code's own provider, on
  `muse-spark-1.3-contributor` at effort `low`, with `META_API_KEY` from the coachman's
  `env_file`: two billed turns, and one resume on a model that does not exist, which fails
  before any turn.
- **MiMo Code** runs on `apparatus/standin.py`, an OpenAI-compatible stand-in registered in the
  trial's MiMo Code config. It logs each request's model, its user, assistant and tool messages,
  the context files its system message names, and its answer, never a header or a whole system
  message. A user message holding `REPLY=<word>` is answered with that word, `FAIL=400` with an
  HTTP 400, and `RUNPWD` first with a shell call to `pwd`. Its log is `standin-requests.jsonl`.

**Runs**, through `scripts/launch.sh` unless marked direct. Muse Code runs as the coachman,
MiMo Code as lane `x`:

1. Launch, on the prompt file. The coachman's synthesis leg; lane `x` in the repository.
2. Resume of the launch's thread, through `launch.sh`, with a second prompt.
3. A fresh launch: the coachman's review leg; lane `x` in the second repository.
4. Direct: the prompt as an argument, `"$(cat <file>)"`, in place of the launch form's file.
5. Direct: the harness's own export of the launch's thread, and of an id it never issued.
6. Resume of an id the harness never issued, through `launch.sh`, then direct.
7. Resume of the launch's thread from the second repository, through `launch.sh`, then direct
   with the launch's data directory (MiMo Code's with `RUNPWD`).
8. MiMo Code only, direct: the launch's thread resumed naming another model, `standin-b`; and,
   through `launch.sh`, a launch whose turn the stand-in fails.
9. Muse Code only, its own provider: the ship leg launched, resumed through `launch.sh`, then
   resumed through `launch.sh` from a config naming a model that does not exist.

`apparatus/checks.py` reads each check where `harnesses.md` says it is and prints the controls:
`checks.txt`. The trial's folder is written `<trial>` in every record.

# Results

All 23 controls came out as they had to (`checks.txt`).

- **Thread id.** Muse Code's first `stream.id` was on each of the launch's 28 records, and
  `muse export --session` found it in the launch's data directory. MiMo Code's first
  `sessionID` was on each of its 3 events, and `mimo export` found it. Each export refused an
  id its harness never issued, with exit 1.
- **Final message.** Muse Code's last `run.terminal.completed` carried `echo: ` and the prompt
  file, byte for byte. MiMo Code's last `text` event was the stand-in's answer. A Muse Code
  resume on a model that does not exist ended on `run.terminal.failed` with no text, exit 1. A
  MiMo Code turn the stand-in failed wrote one `error` event and no `text`, and exited 0.
- **The prompt.** Muse Code's `--prompt-file` reached the turn byte for byte. MiMo Code sent the
  model a newline and then the prompt file, byte for byte. As an argument, the prompt reached
  Muse Code without its final newline, and MiMo Code in double quotes with its own quotes
  escaped.
- **Resume.** Through `launch.sh`, each resume carried the launch's id. Muse Code's record says
  `session.resumed` after 1 turn, and MiMo Code sent the launch's turn and answer ahead of the
  new prompt, on `standin-a`, the launch's model. On its own provider, Muse Code's launch ran on
  `muse-spark-1.3-contributor` with `source` `startup` and answered kumquat. The resume ran on the
  same model with `source` `replay` and answered damson. Each negative read something else: a
  fresh launch had another id and no earlier turn; a MiMo Code resume naming `standin-b` was
  sent as `standin-b`; a Muse Code resume naming a model that does not exist reported
  `no-such-model`.
- **A thread the harness does not hold.** Resumed directly on an id it never issued, Muse Code
  opened a new thread under that id, answered the prompt and exited 0. MiMo Code wrote no event,
  sent the stand-in nothing, and exited 0, with `Session not found` on stderr only. Resumed
  directly from the second repository with the launch's data directory, Muse Code refused, exit
  1, naming the workspace the thread was created in. MiMo Code continued the thread and ran its
  shell tool in the second repository. Through `launch.sh`, all four resumes were refused with
  exit 1 before the harness ran, and no thread by the unknown id appeared.

# What it settles

Facts about two tools at one version each. Muse Code 1.4.0's `--prompt-file` delivers the prompt
verbatim. MiMo Code 0.1.15 delivers it verbatim after a newline of its own on stdin, and quotes
an argument. The thread ids, final messages and models are where `harnesses.md` says, and a
resume through `launch.sh` continues its thread on its model. Neither harness's exit shows a
resume of a thread it does not hold: Muse Code starts afresh, and MiMo Code does nothing.
`launch.sh` refuses such a resume, which the trial shows for an unknown id and for a resume
from another directory. The effort is in no record, so the trial cannot show that a resume
keeps it; `launch.sh` passes it on every resume.
