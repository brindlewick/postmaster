# launch.sh after, coachman --leg review

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
launch.sh launch coachman <trial>/wt <trial>/after-coachman-launch.txt --leg review
```

Exit: 0

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0dc31-fb26-7193-bf77-ab0ec3d31cfa"}
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Model metadata for `review-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."}}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"stand-in reply: model=review-model effort=medium"}}
{"type":"turn.completed","usage":{"input_tokens":1,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":1,"reasoning_output_tokens":0}}
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/lhome-after/.codex"))
Reading additional input from stdin...
```

What each turn request to the stand-in asked for:

```jsonl
{"path": "/v1/responses", "model": "review-model", "effort": "medium", "input_items": 3, "user_prompts": ["Say the word pineapple and stop. (after coachman, launch)"]}
```

## Resume

Command:

```sh
launch.sh resume coachman <trial>/wt 01a0dc31-fb26-7193-bf77-ab0ec3d31cfa <trial>/after-coachman-resume.txt --leg review
```

Exit: 0

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0dc31-fb26-7193-bf77-ab0ec3d31cfa"}
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Model metadata for `review-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."}}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"stand-in reply: model=review-model effort=medium"}}
{"type":"turn.completed","usage":{"input_tokens":2,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":2,"reasoning_output_tokens":0}}
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/lhome-after/.codex"))
```

What each turn request to the stand-in asked for:

```jsonl
{"path": "/v1/responses", "model": "review-model", "effort": "medium", "input_items": 5, "user_prompts": ["Say the word pineapple and stop. (after coachman, launch)", "Say the word pineapple again. (after coachman, resume)"]}
```

codex's own record of each turn, from the thread's rollout file:

```jsonl
{"model": "review-model", "effort": "medium", "approval_policy": "never", "sandbox": "danger-full-access"}
{"model": "review-model", "effort": "medium", "approval_policy": "never", "sandbox": "danger-full-access"}
```

