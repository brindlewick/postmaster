# launch.sh after, coachman --leg review

launch.sh's git blob: `ef83da19a2bc29e0601f13a13cd247e9fe0ff82d`

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

What launch.sh ran, recorded by the shim (directory, then command):

```sh
<trial>/wt
codex exec -C <trial>/wt --json -m review-model -c 'model_reasoning_effort="medium"' --dangerously-bypass-approvals-and-sandbox 'Say the word pineapple and stop. (after coachman, launch)'
```

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0e1d3-adbb-7d80-8240-85942d441f41"}
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

Every request the stand-in received:

```
POST /v1/responses
```

What each turn request asked for:

```jsonl
{"path": "/v1/responses", "model": "review-model", "effort": "medium", "input_items": 3, "user_prompts": ["Say the word pineapple and stop. (after coachman, launch)"]}
```

## Resume

Command:

```sh
launch.sh resume coachman <trial>/wt 01a0e1d3-adbb-7d80-8240-85942d441f41 <trial>/after-coachman-resume.txt --leg review
```

Exit: 0

What launch.sh ran, recorded by the shim (directory, then command):

```sh
<trial>/wt
codex exec resume 01a0e1d3-adbb-7d80-8240-85942d441f41 --json -m review-model -c 'model_reasoning_effort="medium"' --dangerously-bypass-approvals-and-sandbox -- 'Say the word pineapple again. (after coachman, resume)'
```

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0e1d3-adbb-7d80-8240-85942d441f41"}
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Model metadata for `review-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."}}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"stand-in reply: model=review-model effort=medium"}}
{"type":"turn.completed","usage":{"input_tokens":2,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":2,"reasoning_output_tokens":0}}
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/lhome-after/.codex"))
```

Every request the stand-in received:

```
POST /v1/responses
```

What each turn request asked for:

```jsonl
{"path": "/v1/responses", "model": "review-model", "effort": "medium", "input_items": 5, "user_prompts": ["Say the word pineapple and stop. (after coachman, launch)", "Say the word pineapple again. (after coachman, resume)"]}
```

## Resume-dash

Command:

```sh
launch.sh resume coachman <trial>/wt 01a0e1d3-adbb-7d80-8240-85942d441f41 <trial>/after-coachman-resume-dash.txt --leg review
```

Exit: 0

What launch.sh ran, recorded by the shim (directory, then command):

```sh
<trial>/wt
codex exec resume 01a0e1d3-adbb-7d80-8240-85942d441f41 --json -m review-model -c 'model_reasoning_effort="medium"' --dangerously-bypass-approvals-and-sandbox -- '- Say the word pineapple once more. (after coachman, resume)'
```

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0e1d3-adbb-7d80-8240-85942d441f41"}
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Model metadata for `review-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."}}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"stand-in reply: model=review-model effort=medium"}}
{"type":"turn.completed","usage":{"input_tokens":3,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":3,"reasoning_output_tokens":0}}
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/lhome-after/.codex"))
```

Every request the stand-in received:

```
POST /v1/responses
```

What each turn request asked for:

```jsonl
{"path": "/v1/responses", "model": "review-model", "effort": "medium", "input_items": 7, "user_prompts": ["Say the word pineapple and stop. (after coachman, launch)", "Say the word pineapple again. (after coachman, resume)", "- Say the word pineapple once more. (after coachman, resume)"]}
```

codex's own record of each turn, from the thread's rollout file:

```jsonl
{"model": "review-model", "effort": "medium", "approval_policy": "never", "sandbox": "danger-full-access", "cwd": "<trial>/wt"}
{"model": "review-model", "effort": "medium", "approval_policy": "never", "sandbox": "danger-full-access", "cwd": "<trial>/wt"}
{"model": "review-model", "effort": "medium", "approval_policy": "never", "sandbox": "danger-full-access", "cwd": "<trial>/wt"}
```

