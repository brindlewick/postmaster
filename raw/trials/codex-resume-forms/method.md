---
kind: trial
subject: codex 0.157.1 resume forms, and the model and effort a resumed thread runs on
date: 2026-09-27
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
ran with HOME set to a fresh directory, so it read no user configuration and needed no login,
and with its stdin empty. The stand-in and the runner are `trial.py`, beside this file.

Left to its defaults, codex 0.157.1 also clones `https://github.com/openai/plugins` into its
home, about 24 MB, and connects to `ab.chatgpt.com` when it starts. That was seen with strace
while preparing the trial, and is not part of this record. The trial's codex config turns both
off, with `features.plugins = false`, `features.remote_plugin = false` and
`analytics.enabled = false`. With those, a launch connects to nothing but the stand-in. Every
request the stand-in received is listed in each case's record.

Every turn is read twice: from the request the stand-in received (`model`,
`reasoning.effort`), and from codex's own record of the turn, the `turn_context` line in the
thread's rollout file (model, effort, sandbox, directory).

**Three levels per setting**, so that each value names where it came from:

| setting | codex config default | launch | resume flag |
|---|---|---|---|
| model | `config-model` | `launch-model` | `resume-model` |
| effort | `low` | `high` | `medium` |

**Trust.** The codex config marks the worktrees `wt` and `scratch` trusted, as `launch.sh`
does before a launch. A third worktree, `wt-untrusted`, has no entry. codex writes a trusted
entry for it itself when a thread is launched there with the bypass flag, so the runner
removes that entry before the resume, and records that it was there.

**Part 1.** Each case launches a fresh thread in the launch form `scripts/launch.sh` builds:

```
codex exec -C <wt> --json -o <file> -m launch-model -c model_reasoning_effort="high" \
  --dangerously-bypass-approvals-and-sandbox "<prompt>"
```

It then resumes the thread in the form under test, from the worktree unless a case says
otherwise:

- `bare`: `codex exec resume <id> --dangerously-bypass-approvals-and-sandbox "<prompt>"`,
  the form `launch.sh resume` built before issue #45
- `json`, `last`, `model`, `effort`: `bare` plus one of `--json`, `-o <file>`,
  `-m resume-model` or `-c model_reasoning_effort="medium"`
- `all-four`: all four, after `resume <id>`
- `all-four-before-resume`: all four, before `resume`
- `dash-prompt`: all four, with a prompt that starts with `- `
- `the-form`: all four, then `--`, then a prompt that starts with `- `: the form `launch.sh
  resume` builds after issue #45
- `no-bypass`: all four and no bypass flag, in a trusted worktree
- `no-bypass-untrusted`: the same, launched and resumed in `wt-untrusted`
- `sandbox-flag` and `cd-flag`: `-s danger-full-access`, and `-C <wt>`, after `resume <id>`
- `sandbox-flag-before-resume`: `-s danger-full-access` before `resume`, with all four and no
  bypass flag
- `cd-flag-before-resume`: `-C <wt>` before `resume`, with all four, run from another directory
- `detached-scratch`: a thread launched in a detached worktree with `--skip-git-repo-check`,
  as `launch.sh` launches one, then resumed with all four and without that flag
- `bare-no-config-defaults`: `bare`, with a codex config that names no model and no effort

A resume continues the thread when its stream's `thread.started` carries the launch's thread
id, or it prints none, and its request carries the launch's prompt.

**Part 2.** A postmaster config puts lane `one` on codex with `lane-model` and effort `high`,
and the coachman's review leg on `review-model` and effort `medium`. Each is launched, resumed,
and resumed again with a prompt that starts with `- `, through two copies of
`scripts/launch.sh`, the lane with `--last` as `coachman.md` gives it. `before` is the file on
`main` at `155eb82`, git blob `b5b0e1d815ba2ae6adc85c199c76cb02d73c09e7`. `after` is the file
as changed for issue #45, git blob `ef83da19a2bc29e0601f13a13cd247e9fe0ff82d`. A shim first on
PATH records the directory and the exact command each copy ran. The codex config's defaults
are `config-model` and `low`, as in part 1.

**What else the records show.** codex names a model it has no metadata for in an `error` item
on every turn ("Model metadata for `launch-model` not found"), because the trial's model names
are its own. It adds a second one on any resume that changes the model ("This session was
recorded with model `launch-model` but is resuming with `config-model`").

The two readings agree in every case but one. In `bare-no-config-defaults`, nothing names an
effort: codex's record of the resumed turn gives none, its header prints "reasoning effort:
none", and the request carried `low`.

**Not established here.** What a real provider does with the model a resume names. The trial
records what codex asks for, which is the question. It does not test whether OpenAI's backend
accepts a resumed thread on a model other than the one it was launched on. The flow never asks
for that, since a resume names the model its launch did.

**Repeating it.** With codex and python3 on PATH:

```
python3 trial.py [--keep] <out-dir> [<launch.sh before> <launch.sh after>]
```

It takes under a minute and writes `results.md`, `part1/` and `part2/` as they are here. The
work directory is written `<trial>` in the output, and the temporary directory holding it
`<tmp>`. It is removed at the end unless `--keep` is given. The thread ids differ from run to
run. `results.md` gives each launch.sh copy's git blob, so a record can be matched to the file
that produced it.
