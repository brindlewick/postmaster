# model

## Launch

Command:

```sh
codex exec -C <trial>/wt --json -o <trial>/model-launch-last.md -m launch-model -c 'model_reasoning_effort="high"' --dangerously-bypass-approvals-and-sandbox 'Say the word pineapple and stop. (model, launch)'
```

Exit: 0

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0dc31-4570-7180-97e2-1d7bab7001ec"}
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Model metadata for `launch-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."}}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"stand-in reply: model=launch-model effort=high"}}
{"type":"turn.completed","usage":{"input_tokens":1,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":1,"reasoning_output_tokens":0}}
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/home-defaults/.codex"))
Reading additional input from stdin...
```

The `-o` file:

```
stand-in reply: model=launch-model effort=high
```

What each turn request to the stand-in asked for:

```jsonl
{"path": "/v1/responses", "model": "launch-model", "effort": "high", "input_items": 3, "user_prompts": ["Say the word pineapple and stop. (model, launch)"]}
```

## Resume

Command:

```sh
codex exec resume 01a0dc31-4570-7180-97e2-1d7bab7001ec -m resume-model --dangerously-bypass-approvals-and-sandbox 'Say the word pineapple again. (model, resume)'
```

Exit: 0

stdout:

```
stand-in reply: model=resume-model effort=low
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/home-defaults/.codex"))
OpenAI Codex v0.157.1
--------
workdir: <trial>/wt
model: resume-model
provider: standin
approval: never
sandbox: danger-full-access
reasoning effort: low
reasoning summaries: none
session id: 01a0dc31-4570-7180-97e2-1d7bab7001ec
--------
user
Say the word pineapple again. (model, resume)
warning: This session was recorded with model `launch-model` but is resuming with `resume-model`. Consider switching back to `launch-model` as it may affect Codex performance.
warning: Model metadata for `resume-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues.
codex
stand-in reply: model=resume-model effort=low
tokens used
4
```

The `-o` file:

```
(not written)
```

What each turn request to the stand-in asked for:

```jsonl
{"path": "/v1/responses", "model": "resume-model", "effort": "low", "input_items": 6, "user_prompts": ["Say the word pineapple and stop. (model, launch)", "Say the word pineapple again. (model, resume)"]}
```

codex's own record of each turn, from the thread's rollout file:

```jsonl
{"model": "launch-model", "effort": "high", "approval_policy": "never", "sandbox": "danger-full-access"}
{"model": "resume-model", "effort": "low", "approval_policy": "never", "sandbox": "danger-full-access"}
```

