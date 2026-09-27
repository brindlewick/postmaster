# launch.sh after, one

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
launch.sh launch one <trial>/wt <trial>/after-one-launch.txt --last <trial>/after-one-launch-last.md
```

Exit: 0

What launch.sh ran, recorded by the shim (directory, then command):

```sh
<trial>/wt
codex exec -C <trial>/wt --json -o <trial>/after-one-launch-last.md -m lane-model -c 'model_reasoning_effort="high"' --dangerously-bypass-approvals-and-sandbox 'Say the word pineapple and stop. (after one, launch)'
```

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0e1d3-9c78-78f1-854c-bf2472f407bf"}
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Model metadata for `lane-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."}}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"stand-in reply: model=lane-model effort=high"}}
{"type":"turn.completed","usage":{"input_tokens":1,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":1,"reasoning_output_tokens":0}}
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/lhome-after/.codex"))
Reading additional input from stdin...
```

The `-o` file:

```
stand-in reply: model=lane-model effort=high
```

Every request the stand-in received:

```
POST /v1/responses
```

What each turn request asked for:

```jsonl
{"path": "/v1/responses", "model": "lane-model", "effort": "high", "input_items": 3, "user_prompts": ["Say the word pineapple and stop. (after one, launch)"]}
```

## Resume

Command:

```sh
launch.sh resume one <trial>/wt 01a0e1d3-9c78-78f1-854c-bf2472f407bf <trial>/after-one-resume.txt --last <trial>/after-one-resume-last.md
```

Exit: 0

What launch.sh ran, recorded by the shim (directory, then command):

```sh
<trial>/wt
codex exec resume 01a0e1d3-9c78-78f1-854c-bf2472f407bf --json -o <trial>/after-one-resume-last.md -m lane-model -c 'model_reasoning_effort="high"' --dangerously-bypass-approvals-and-sandbox -- 'Say the word pineapple again. (after one, resume)'
```

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0e1d3-9c78-78f1-854c-bf2472f407bf"}
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Model metadata for `lane-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."}}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"stand-in reply: model=lane-model effort=high"}}
{"type":"turn.completed","usage":{"input_tokens":2,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":2,"reasoning_output_tokens":0}}
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/lhome-after/.codex"))
```

The `-o` file:

```
stand-in reply: model=lane-model effort=high
```

Every request the stand-in received:

```
POST /v1/responses
```

What each turn request asked for:

```jsonl
{"path": "/v1/responses", "model": "lane-model", "effort": "high", "input_items": 5, "user_prompts": ["Say the word pineapple and stop. (after one, launch)", "Say the word pineapple again. (after one, resume)"]}
```

## Resume-dash

Command:

```sh
launch.sh resume one <trial>/wt 01a0e1d3-9c78-78f1-854c-bf2472f407bf <trial>/after-one-resume-dash.txt --last <trial>/after-one-resume-dash-last.md
```

Exit: 0

What launch.sh ran, recorded by the shim (directory, then command):

```sh
<trial>/wt
codex exec resume 01a0e1d3-9c78-78f1-854c-bf2472f407bf --json -o <trial>/after-one-resume-dash-last.md -m lane-model -c 'model_reasoning_effort="high"' --dangerously-bypass-approvals-and-sandbox -- '- Say the word pineapple once more. (after one, resume)'
```

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0e1d3-9c78-78f1-854c-bf2472f407bf"}
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Model metadata for `lane-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."}}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"stand-in reply: model=lane-model effort=high"}}
{"type":"turn.completed","usage":{"input_tokens":3,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":3,"reasoning_output_tokens":0}}
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/lhome-after/.codex"))
```

The `-o` file:

```
stand-in reply: model=lane-model effort=high
```

Every request the stand-in received:

```
POST /v1/responses
```

What each turn request asked for:

```jsonl
{"path": "/v1/responses", "model": "lane-model", "effort": "high", "input_items": 7, "user_prompts": ["Say the word pineapple and stop. (after one, launch)", "Say the word pineapple again. (after one, resume)", "- Say the word pineapple once more. (after one, resume)"]}
```

codex's own record of each turn, from the thread's rollout file:

```jsonl
{"model": "lane-model", "effort": "high", "approval_policy": "never", "sandbox": "danger-full-access", "cwd": "<trial>/wt"}
{"model": "lane-model", "effort": "high", "approval_policy": "never", "sandbox": "danger-full-access", "cwd": "<trial>/wt"}
{"model": "lane-model", "effort": "high", "approval_policy": "never", "sandbox": "danger-full-access", "cwd": "<trial>/wt"}
```

