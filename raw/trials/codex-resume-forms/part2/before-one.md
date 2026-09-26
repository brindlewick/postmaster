# launch.sh before, one

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
launch.sh launch one <trial>/wt <trial>/before-one-launch.txt --last <trial>/before-one-launch-last.md
```

Exit: 0

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0dc31-cccd-7512-bf0e-b558882c6d41"}
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Model metadata for `lane-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."}}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"stand-in reply: model=lane-model effort=high"}}
{"type":"turn.completed","usage":{"input_tokens":1,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":1,"reasoning_output_tokens":0}}
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/lhome-before/.codex"))
Reading additional input from stdin...
```

The `-o` file:

```
stand-in reply: model=lane-model effort=high
```

What each turn request to the stand-in asked for:

```jsonl
{"path": "/v1/responses", "model": "lane-model", "effort": "high", "input_items": 3, "user_prompts": ["Say the word pineapple and stop. (before one, launch)"]}
```

## Resume

Command:

```sh
launch.sh resume one <trial>/wt 01a0dc31-cccd-7512-bf0e-b558882c6d41 <trial>/before-one-resume.txt --last <trial>/before-one-resume-last.md
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
session id: 01a0dc31-cccd-7512-bf0e-b558882c6d41
--------
user
Say the word pineapple again. (before one, resume)
warning: This session was recorded with model `lane-model` but is resuming with `config-model`. Consider switching back to `lane-model` as it may affect Codex performance.
warning: Model metadata for `config-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues.
codex
stand-in reply: model=config-model effort=low
tokens used
4
```

The `-o` file:

```
(not written)
```

What each turn request to the stand-in asked for:

```jsonl
{"path": "/v1/responses", "model": "config-model", "effort": "low", "input_items": 6, "user_prompts": ["Say the word pineapple and stop. (before one, launch)", "Say the word pineapple again. (before one, resume)"]}
```

codex's own record of each turn, from the thread's rollout file:

```jsonl
{"model": "lane-model", "effort": "high", "approval_policy": "never", "sandbox": "danger-full-access"}
{"model": "config-model", "effort": "low", "approval_policy": "never", "sandbox": "danger-full-access"}
```

