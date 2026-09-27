# Results

Written by `trial.py`, from the files beside it. The codex config's defaults are
`config-model`, effort `low`, except in `bare-no-config-defaults`, where it names neither.
Every launch passes `-m launch-model` and effort `high`. A resume passing `-m` names
`resume-model`, and one passing an effort names `medium`. The codex config marks `wt`
and `scratch` trusted, as launch.sh does at a launch. codex marks `wt-untrusted` trusted
itself at its launch, and the runner removes that entry before the resume.

## Part 1: the resume forms, run directly

| case | exit | stdout | `-o` file | request: model, effort | codex's record: model, effort, sandbox, directory | same thread |
|---|---|---|---|---|---|---|
| [bare](part1/bare.md) | 0 | text | none | config-model, low | config-model, low, danger-full-access, <trial>/wt | yes |
| [json](part1/json.md) | 0 | thread.started, error x2, turn.started, agent_message, turn.completed | none | config-model, low | config-model, low, danger-full-access, <trial>/wt | yes |
| [last](part1/last.md) | 0 | text | written | config-model, low | config-model, low, danger-full-access, <trial>/wt | yes |
| [model](part1/model.md) | 0 | text | none | resume-model, low | resume-model, low, danger-full-access, <trial>/wt | yes |
| [effort](part1/effort.md) | 0 | text | none | config-model, medium | config-model, medium, danger-full-access, <trial>/wt | yes |
| [all-four](part1/all-four.md) | 0 | thread.started, error x2, turn.started, agent_message, turn.completed | written | resume-model, medium | resume-model, medium, danger-full-access, <trial>/wt | yes |
| [all-four-before-resume](part1/all-four-before-resume.md) | 0 | thread.started, error x2, turn.started, agent_message, turn.completed | written | resume-model, medium | resume-model, medium, danger-full-access, <trial>/wt | yes |
| [dash-prompt](part1/dash-prompt.md) | 2 | empty | none | no request | no turn | n/a |
| [the-form](part1/the-form.md) | 0 | thread.started, error x2, turn.started, agent_message, turn.completed | written | resume-model, medium | resume-model, medium, danger-full-access, <trial>/wt | yes |
| [no-bypass](part1/no-bypass.md) | 0 | thread.started, error x2, turn.started, agent_message, turn.completed | written | resume-model, medium | resume-model, medium, workspace-write, <trial>/wt | yes |
| [no-bypass-untrusted](part1/no-bypass-untrusted.md) | 0 | thread.started, error x2, turn.started, agent_message, turn.completed | written | resume-model, medium | resume-model, medium, read-only, <trial>/wt-untrusted | yes |
| [sandbox-flag](part1/sandbox-flag.md) | 2 | empty | none | no request | no turn | n/a |
| [sandbox-flag-before-resume](part1/sandbox-flag-before-resume.md) | 0 | thread.started, error x2, turn.started, agent_message, turn.completed | written | resume-model, medium | resume-model, medium, danger-full-access, <trial>/wt | yes |
| [cd-flag](part1/cd-flag.md) | 2 | empty | none | no request | no turn | n/a |
| [cd-flag-before-resume](part1/cd-flag-before-resume.md) | 0 | thread.started, error x2, turn.started, agent_message, turn.completed | written | resume-model, medium | resume-model, medium, danger-full-access, <trial>/wt | yes |
| [detached-scratch](part1/detached-scratch.md) | 0 | thread.started, error x2, turn.started, agent_message, turn.completed | written | resume-model, medium | resume-model, medium, danger-full-access, <trial>/scratch | yes |
| [bare-no-config-defaults](part1/bare-no-config-defaults.md) | 0 | text | none | gpt-6-astra, low | gpt-6-astra, None, danger-full-access, <trial>/wt | yes |

## Part 2: through launch.sh

The postmaster config puts lane `one` on `lane-model`, effort `high`, and the
coachman's review leg on `review-model`, effort `medium`. The codex config's
defaults are `config-model`, effort `low`, as in part 1. The second resume's prompt
starts with `- `.

- `before`: a launch.sh whose git blob is `b5b0e1d815ba2ae6adc85c199c76cb02d73c09e7`
- `after`: a launch.sh whose git blob is `ef83da19a2bc29e0601f13a13cd247e9fe0ff82d`

| launch.sh | name | step | exit | stdout | `-o` file | request: model, effort | codex's record: model, effort |
|---|---|---|---|---|---|---|---|
| before | [one](part2/before-one.md) | launch | 0 | thread.started, error, turn.started, agent_message, turn.completed | written | lane-model, high | lane-model, high |
| before | [one](part2/before-one.md) | resume | 0 | text | none | config-model, low | config-model, low |
| before | [one](part2/before-one.md) | resume-dash | 2 | empty | none | no request | no turn |
| before | [coachman --leg review](part2/before-coachman.md) | launch | 0 | thread.started, error, turn.started, agent_message, turn.completed | not asked | review-model, medium | review-model, medium |
| before | [coachman --leg review](part2/before-coachman.md) | resume | 0 | text | not asked | config-model, low | config-model, low |
| before | [coachman --leg review](part2/before-coachman.md) | resume-dash | 2 | empty | not asked | no request | no turn |
| after | [one](part2/after-one.md) | launch | 0 | thread.started, error, turn.started, agent_message, turn.completed | written | lane-model, high | lane-model, high |
| after | [one](part2/after-one.md) | resume | 0 | thread.started, error, turn.started, agent_message, turn.completed | written | lane-model, high | lane-model, high |
| after | [one](part2/after-one.md) | resume-dash | 0 | thread.started, error, turn.started, agent_message, turn.completed | written | lane-model, high | lane-model, high |
| after | [coachman --leg review](part2/after-coachman.md) | launch | 0 | thread.started, error, turn.started, agent_message, turn.completed | not asked | review-model, medium | review-model, medium |
| after | [coachman --leg review](part2/after-coachman.md) | resume | 0 | thread.started, error, turn.started, agent_message, turn.completed | not asked | review-model, medium | review-model, medium |
| after | [coachman --leg review](part2/after-coachman.md) | resume-dash | 0 | thread.started, error, turn.started, agent_message, turn.completed | not asked | review-model, medium | review-model, medium |

codex: `codex-cli 0.157.1`
