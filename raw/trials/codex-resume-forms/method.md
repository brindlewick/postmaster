---
kind: trial
subject: codex 0.157.1 resume forms, and the model and effort a resumed thread runs on
date: 2026-09-26
---

# Method

**Question.** Which of `-m`, `-c model_reasoning_effort=...`, `--json` and `-o` does
`codex exec resume` accept, and which model and effort does a resumed thread run on? Issue #45
asked it: `scripts/launch.sh resume` passed none of the four to codex, and its launch passed
all four.

**Setup.** codex-cli 0.157.1, installed from npm (`@openai/codex@0.157.1`), on Linux x64.
A local HTTP server stands in for an OpenAI Responses API provider. It is registered as the
codex config's `model_provider`, with `wire_api = "responses"`. It records every request and
answers each turn with one message naming the model and effort the request asked for. codex
ran with HOME set to a fresh directory, so it read no user configuration, needed no login and
sent nothing to OpenAI. Its stdin was empty. The stand-in and the runner are `trial.py`,
beside this file.

Every turn is read twice: from the request the stand-in received (`model`,
`reasoning.effort`), and from codex's own record of the turn, the `turn_context` line in the
thread's rollout file (model, effort, sandbox).

**Three levels per setting**, so that each value names where it came from:

| setting | codex config default | launch | resume flag |
|---|---|---|---|
| model | `config-model` | `launch-model` | `resume-model` |
| effort | `low` | `high` | `medium` |

**Part 1.** Each case launches a fresh thread in the launch form `scripts/launch.sh` builds:

```
codex exec -C <wt> --json -o <file> -m launch-model -c model_reasoning_effort="high" \
  --dangerously-bypass-approvals-and-sandbox "<prompt>"
```

It then resumes the thread in the form under test:

- `bare`: `codex exec resume <id> --dangerously-bypass-approvals-and-sandbox "<prompt>"`,
  the form `launch.sh resume` built before issue #45
- `json`, `last`, `model`, `effort`: `bare` plus one of `--json`, `-o <file>`,
  `-m resume-model` or `-c model_reasoning_effort="medium"`
- `all-four`: all four, after `resume <id>`
- `all-four-before-resume`: all four, before `resume`
- `no-bypass`: all four, and no bypass flag
- `sandbox-flag` and `cd-flag`: `-s danger-full-access`, and `-C <wt>`
- `detached-scratch`: a thread launched in a detached worktree with `--skip-git-repo-check`,
  as `launch.sh` launches one, then resumed with all four and without that flag
- `bare-no-config-defaults`: `bare`, with a codex config that names no model and no effort

A resume continues the thread when its stream's `thread.started` carries the launch's thread
id, or it prints none, and its request carries the launch's prompt.

**Part 2.** A postmaster config puts lane `one` on codex with `lane-model` and effort `high`,
and the coachman's review leg on `review-model` and effort `medium`. Each is launched and
resumed through two copies of `scripts/launch.sh`. `before` is the file on `parallel-review` at
`ad786ec`, and `after` is the file as changed for issue #45. The codex config's defaults are
`config-model` and `low`, as in part 1.

**What else the records show.** codex names a model it has no metadata for in an `error` item
on every turn ("Model metadata for `launch-model` not found"), because the trial's model names
are its own. It adds a second one on any resume that changes the model ("This session was
recorded with model `launch-model` but is resuming with `config-model`"). codex also sent
`GET /` to the stand-in on every run. The stand-in answered 404, and those requests are not
recorded, since they carry no model.

The two readings agree in every case but one. In `bare-no-config-defaults`, nothing names an
effort: codex's record of the resumed turn gives none, its header prints "reasoning effort:
none", and the request carried `low`.

**Not established here.** What a real provider does with the model a resume names. The trial
records what codex asks for, which is the question. It does not test whether OpenAI's backend
accepts a resumed thread on a model other than the one it was launched on. The flow never asks
for that, since a resume names the model its launch did.

**Repeating it.** With codex and python3 on PATH:

```
python3 trial.py <out-dir> [<launch.sh before> <launch.sh after>]
```

It takes about a minute and writes `results.md`, `part1/` and `part2/` as they are here. The
work directory is written `<trial>` in the output, and the temporary directory holding it
`<tmp>`. The thread ids differ from run to run.
