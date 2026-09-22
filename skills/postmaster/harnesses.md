# Harness adapters

Every harness-specific fact in the flow lives here and nowhere else. The runbooks say "launch
form", "resume form", "thread id", "final message" and "ambient context"; this file says what
each of those means for each harness. When a harness changes, this file changes and the
runbooks do not.

**Every form below runs in the foreground and writes its event stream to stdout.** The caller
adds the redirect to the lane's events file, the backgrounding, and any marker that must land
on exit; that is what makes one wrapper in the runbooks correct for every harness.

**`scripts/launch.sh` is the executable form of this file.** `launch.sh form <name>` prints the
exact command for a configured lane or role; `launch` and `resume` run it. The script and this
file change together, and a form the script refuses (muse; agy resume) is a form this file has
not recorded yet.

Every lane runs unrestricted. Its containment is its worktree (`coachman.md`, Lane capability),
so the bypass form below is passed on every launch AND every resume. Nothing in the flow depends
on one session messaging another; the postmaster polls files.

**Different CLIs, different output-format flags. Never copy one into another.**

| harness | headless form | stream flag | reads ambient context | prompt from a file |
|---|---|---|---|---|
| codex | `codex exec` | `--json` | `AGENTS.md`, natively | no, argv |
| grok | `grok --prompt-file`, or `grok -p` | `--output-format streaming-json` | `AGENTS.md`, natively | yes |
| agy (Antigravity CLI) | `agy -p` | `--output-format stream-json` | none | no, argv |
| claude | `claude -p` | `--output-format stream-json` | `CLAUDE.md` and what it imports | no, argv |
| pi | `pi --mode json` | `--mode json` | `AGENTS.override.md`, else `AGENTS.md` or `CLAUDE.md`, natively | yes, on stdin |
| muse | `muse exec` | not recorded here | none | `--prompt-file` |

A harness that reads no ambient context file must be handed the project's docs by name in its
prompt, and must have the `ARM-SUMMARY.md` / `ARM-BLOCKED.md` contract spelled out in full. The
others pick both up from the brief and the docs. A harness that reads a context file under a
different name needs that file present: a `CLAUDE.md` that is a symlink to `AGENTS.md` serves
both.

Prefer `--prompt-file` wherever a harness offers it. A prompt in argv is visible to every process
listing on the machine, and a process must never be selected by matching text that could appear
in a prompt: match on pid or working directory.

## codex

Launch, arm or reviewer:

```sh
# Mark the worktree trusted first. The grep guard is idempotent on purpose:
# duplicate [projects] tables are invalid TOML.
grep -qF "[projects.\"<abs wt>\"]" ~/.codex/config.toml \
  || printf '\n[projects."%s"]\ntrust_level = "trusted"\n' "<abs wt>" >> ~/.codex/config.toml
codex exec -C <wt> --json -o <dispatch>/logs/<lane>-last.md -m <model> \
  -c model_reasoning_effort="<effort>" --dangerously-bypass-approvals-and-sandbox \
  "$(cat <dispatch>/<lane>-prompt.txt)"
```

- A detached reviewer scratch needs `--skip-git-repo-check`.
- Thread id: `grep '"thread_id"'` in the events stream.
- Final message: `<lane>-last.md` from `-o`, plus the last result line of the events stream.
- Resume: `codex exec resume <thread_id> --dangerously-bypass-approvals-and-sandbox "<prompt>"`.
  `codex exec resume` accepts no sandbox flag (`-s` errors with "unexpected argument") and a
  bare resume runs read-only, so the bypass flag goes on every resume that must write, reviewers
  included. `--last` is safe only when no other codex thread has run since; otherwise recover
  the id from the events log or `~/.codex/sessions/YYYY/MM/DD/`.
- Durable record: rollout jsonl under `~/.codex/sessions/YYYY/MM/DD/`. `codex resume
  <thread_id>` opens the full TUI on a finished thread. `codex archive <thread_id>` at teardown.
- Headless `codex exec` exposes no browser backend. An arm on codex cannot run the render gate;
  the coachman runs it.

## grok

Launch, coachman or lane:

```sh
cd <wt> && grok --prompt-file <dispatch>/<lane>-prompt.txt -m <model> \
  --reasoning-effort <effort> --max-turns 1000 --always-approve \
  --output-format streaming-json
```

- Thread id: the session uuid in the stream, minted at launch.
- Final message: the last result line of the events stream.
- Resume: `grok --resume <uuid> -p "<prompt>"` with the same flags, the caller appending to
  the same stream. This is the coachman's own resume form when the coachman runs on grok: the
  postmaster delivers a ruling this way.
- Durable record: its session store; `grok export` renders a thread as Markdown. Threads persist
  harmlessly; nothing to archive.
- No cross-session messaging.

## agy (Antigravity CLI)

```sh
cd <wt> && agy -p "$(cat <dispatch>/<lane>-prompt.txt)" \
  --model <model> --output-format stream-json \
  --dangerously-skip-permissions --add-dir <wt>
```

- No `--effort` flag for any model: effort is baked into the model NAME, so the lane's model
  string carries it (`gemini-3.7-flash-high`; the effort suffix is part of the id, and an id
  without one is not valid).
- `--sandbox` is opt-IN restriction. Never pass it to a lane.
- Reads NO ambient context file: not `AGENTS.md`, `GEMINI.md`, `AGENT.md`, `.agy/` or
  `.antigravity/`. The prompt must open by naming the project's docs and must spell out the
  `ARM-SUMMARY.md` / `ARM-BLOCKED.md` contract.
- Thread id: `conversationId` in the stream.
- Final message: the last result line of the events stream.
- Resume: relaunch against its `conversationId`; `agy --help` for the flag. Not recorded here,
  so `launch.sh resume` refuses agy; a postmaster on agy is an interactive session in tmux and
  is never resumed this way.
- Threads persist harmlessly; nothing to archive.

## claude

```sh
cd <wt> && claude -p "$(cat <dispatch>/<lane>-prompt.txt)" --model <model> \
  --output-format stream-json --verbose --dangerously-skip-permissions
```

- `--output-format stream-json` in print mode requires `--verbose`. `--effort <effort>` sets the
  effort where the lane has one.
- **Alternate backends.** The claude harness reaches an Anthropic-compatible endpoint through
  the environment: `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN`, plus whatever the endpoint
  documents. A lane's `env_file` in the config is loaded before launch and holds exactly that;
  the key never enters the config or this repo. A model id the harness does not know needs the
  `[1m]` suffix (or the window the endpoint offers), or the harness assumes 200k and compacts
  early.
- Thread id: `session_id` on the first event of the stream.
- Resume: `claude -p --resume <session_id> "<prompt>"` with the same flags.
- Ambient context: reads `CLAUDE.md` in the repo and the files it imports. A project that keeps
  its context in `AGENTS.md` needs a `CLAUDE.md` pointing at it; a symlink works.
- As the coachman's own harness: background tasks are reaped at about 29 minutes, and a long
  lane routinely outlives that. A "stopped" notification without a quota error is the cap, not
  a failure. Resume the lane's thread in place, instruct arms to commit incrementally, and
  expect to resume any leg that needs more than 25 minutes.

## pi

```sh
cd <wt> && pi --mode json --approve --model <provider/model> \
  --thinking <effort> < <dispatch>/<lane>-prompt.txt
```

- **The prompt goes in on stdin, never as `@<file>`.** An `@file` argument is an attachment:
  pi sends it as `<file name="/abs/path">…</file>` with no instruction around it, so the
  lane is handed a file rather than told to do something, and the dispatch path ends up in
  the conversation. Stdin sends the prompt verbatim, which is the message every other
  harness gets. pi also reads stdin to EOF before it starts in every mode but rpc, so a
  launch that inherits an open pipe never begins; the redirect closes that case too.
- `--mode json` already selects non-interactive mode, so `--print` adds nothing.
- `--approve` trusts project-local resources for the run. Pi has no permission prompts; its
  built-in tools run unrestricted, with the worktree as the lane's containment.
- Reads `~/.pi/agent/AGENTS.md`, then one context file per directory while walking from the
  filesystem root to the worktree: `AGENTS.override.md` when present, otherwise `AGENTS.md`
  before `CLAUDE.md`.
- Thread id: `id` in the first `session` record of the JSON stream.
- Final message: the last `message_end` record whose message has role `assistant`. The
  stream also emits `message_end` for the system and user messages.
- Resume: `pi --mode json --approve --session <id> --model <provider/model>
  --thinking <effort> < <prompt-file>`, appending to the same stream.
- **Resume from the directory the thread was launched in.** `--session` looks in the current
  working directory's sessions first. Given an id that exists only under another directory,
  pi prints "Session found in different project", asks "Fork this session into current
  directory? [y/N]" on stdin, reads the first line of the piped prompt as the answer, prints
  "Aborted." and exits 0 having done nothing. `launch.sh resume` always changes to the given
  directory first, so this bites only a caller that passes a different one.
- Durable record: session JSONL under `~/.pi/agent/sessions/--<path>--/`, where `<path>` is the
  working directory with `/` replaced by `-`. Threads persist harmlessly; nothing to archive.
- Use a provider-qualified model id when the same model name could match more than one provider.

## muse

- Installed as `muse`; headless form `muse exec`, takes `--prompt-file` and `--api-key-stdin`.
  Reads no ambient context file.
- **Not usable as a lane until this section records its stream flag, its bypass form, where
  its thread id appears and its resume form.** Fill those in from `muse --help` and a trial
  run before configuring a lane on it; the probe lists it so the gap is visible, not so it is
  chosen.

## Walls, any harness

A lane that never launched is lame for that round: DEGRADED. Recognise a wall by the provider's
own error string and quote it in `run-log.md`: a `402 Payment Required`, a usage-limit message,
a quota wall, a spawn misfire, a stale session lock. The fix is restoring the lane on the next
round, never suppressing the label.
