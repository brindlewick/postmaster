# launch.sh before, coachman --leg review

The postmaster config:

```toml
[lanes.one]
harness = "codex"
model = "lane-model"
effort = "high"

[team]
coachman = { harness = "codex", model = "coach-model", effort = "medium" }

[team.coachman_legs]
review = { harness = "codex", model = "review-model", effort = "medium" }
```

## Launch

Command:

```sh
launch.sh launch coachman <trial>/wt <trial>/before-coachman-launch.txt --leg review
```

Exit: 0

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0dc31-dc3b-7900-9c37-47b0b409128f"}
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Model metadata for `review-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."}}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"stand-in reply: model=review-model effort=medium"}}
{"type":"turn.completed","usage":{"input_tokens":1,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":1,"reasoning_output_tokens":0}}
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/lhome-before/.codex"))
Reading additional input from stdin...
```

What each turn request to the stand-in asked for:

```jsonl
{"path": "/v1/responses", "model": "review-model", "effort": "medium", "input_items": 3, "user_prompts": ["Say the word pineapple and stop. (before coachman, launch)"]}
```

## Resume

Command:

```sh
launch.sh resume coachman <trial>/wt 01a0dc31-dc3b-7900-9c37-47b0b409128f <trial>/before-coachman-resume.txt --leg review
```

Exit: 0

stdout:

```
stand-in reply: model=config-model effort=low
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/lhome-before/.codex"))
OpenAI Codex v0.157.1
--------
workdir: <trial>/wt
model: config-model
provider: standin
approval: never
sandbox: danger-full-access
reasoning effort: low
reasoning summaries: none
session id: 01a0dc31-dc3b-7900-9c37-47b0b409128f
--------
user
Say the word pineapple again. (before coachman, resume)
warning: This session was recorded with model `review-model` but is resuming with `config-model`. Consider switching back to `review-model` as it may affect Codex performance.
warning: Model metadata for `config-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues.
codex
stand-in reply: model=config-model effort=low
tokens used
4
```

What each turn request to the stand-in asked for:

```jsonl
{"path": "/v1/responses", "model": "config-model", "effort": "low", "input_items": 6, "user_prompts": ["Say the word pineapple and stop. (before coachman, launch)", "Say the word pineapple again. (before coachman, resume)"]}
```

codex's own record of each turn, from the thread's rollout file:

```jsonl
{"model": "review-model", "effort": "medium", "approval_policy": "never", "sandbox": "danger-full-access"}
{"model": "config-model", "effort": "low", "approval_policy": "never", "sandbox": "danger-full-access"}
```

