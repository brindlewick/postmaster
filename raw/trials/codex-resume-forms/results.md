# Results

Written by `trial.py`, from the files beside it. The codex config's defaults are
`config-model`, effort `low`, except in `bare-no-config-defaults`, where it names neither.
Every launch passes `-m launch-model` and effort `high`. A resume passing `-m` names
`resume-model`, and one passing an effort names `medium`.

## Part 1: the resume forms, run directly

| case | exit | stdout | `-o` file | request: model, effort | codex's record: model, effort, sandbox | same thread |
|---|---|---|---|---|---|---|
| [bare](part1/bare.md) | 0 | text | none | config-model, low | config-model, low, danger-full-access | yes |
| [json](part1/json.md) | 0 | thread.started, error x2, turn.started, agent_message, turn.completed | none | config-model, low | config-model, low, danger-full-access | yes |
| [last](part1/last.md) | 0 | text | written | config-model, low | config-model, low, danger-full-access | yes |
| [model](part1/model.md) | 0 | text | none | resume-model, low | resume-model, low, danger-full-access | yes |
| [effort](part1/effort.md) | 0 | text | none | config-model, medium | config-model, medium, danger-full-access | yes |
| [all-four](part1/all-four.md) | 0 | thread.started, error x2, turn.started, agent_message, turn.completed | written | resume-model, medium | resume-model, medium, danger-full-access | yes |
| [all-four-before-resume](part1/all-four-before-resume.md) | 0 | thread.started, error x2, turn.started, agent_message, turn.completed | written | resume-model, medium | resume-model, medium, danger-full-access | yes |
| [no-bypass](part1/no-bypass.md) | 0 | thread.started, error x2, turn.started, agent_message, turn.completed | written | resume-model, medium | resume-model, medium, workspace-write | yes |
| [sandbox-flag](part1/sandbox-flag.md) | 2 | empty | none | no request | no turn | n/a |
| [cd-flag](part1/cd-flag.md) | 2 | empty | none | no request | no turn | n/a |
| [detached-scratch](part1/detached-scratch.md) | 0 | thread.started, error x2, turn.started, agent_message, turn.completed | written | resume-model, medium | resume-model, medium, danger-full-access | yes |
| [bare-no-config-defaults](part1/bare-no-config-defaults.md) | 0 | text | none | gpt-6-astra, low | gpt-6-astra, None, danger-full-access | yes |

## Part 2: through launch.sh

The postmaster config puts lane `one` on `lane-model`, effort `high`, and the
coachman's review leg on `review-model`, effort `medium`. The codex config's
defaults are `config-model`, effort `low`, as in part 1.

| launch.sh | name | step | exit | stdout | `-o` file | request: model, effort | codex's record: model, effort |
|---|---|---|---|---|---|---|---|
| before | [one](part2/before-one.md) | launch | 0 | thread.started, error, turn.started, agent_message, turn.completed | written | lane-model, high | lane-model, high |
| before | [one](part2/before-one.md) | resume | 0 | text | none | config-model, low | config-model, low |
| before | [coachman --leg review](part2/before-coachman.md) | launch | 0 | thread.started, error, turn.started, agent_message, turn.completed | not asked | review-model, medium | review-model, medium |
| before | [coachman --leg review](part2/before-coachman.md) | resume | 0 | text | not asked | config-model, low | config-model, low |
| after | [one](part2/after-one.md) | launch | 0 | thread.started, error, turn.started, agent_message, turn.completed | written | lane-model, high | lane-model, high |
| after | [one](part2/after-one.md) | resume | 0 | thread.started, error, turn.started, agent_message, turn.completed | written | lane-model, high | lane-model, high |
| after | [coachman --leg review](part2/after-coachman.md) | launch | 0 | thread.started, error, turn.started, agent_message, turn.completed | not asked | review-model, medium | review-model, medium |
| after | [coachman --leg review](part2/after-coachman.md) | resume | 0 | thread.started, error, turn.started, agent_message, turn.completed | not asked | review-model, medium | review-model, medium |

codex: `codex-cli 0.157.1`
