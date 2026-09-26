# bare-no-config-defaults

## Launch

Command:

```sh
codex exec -C <trial>/wt --json -o <trial>/bare-no-config-defaults-launch-last.md -m launch-model -c 'model_reasoning_effort="high"' --dangerously-bypass-approvals-and-sandbox 'Say the word pineapple and stop. (bare-no-config-defaults, launch)'
```

Exit: 0

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0dc31-bbff-7df0-bb80-370c26d96834"}
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"Model metadata for `launch-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."}}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"stand-in reply: model=launch-model effort=high"}}
{"type":"turn.completed","usage":{"input_tokens":1,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":1,"reasoning_output_tokens":0}}
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/home-no-defaults/.codex"))
Reading additional input from stdin...
```

The `-o` file:

```
stand-in reply: model=launch-model effort=high
```

What each turn request to the stand-in asked for:

```jsonl
{"path": "/v1/responses", "model": "launch-model", "effort": "high", "input_items": 3, "user_prompts": ["Say the word pineapple and stop. (bare-no-config-defaults, launch)"]}
```

## Resume

Command:

```sh
codex exec resume 01a0dc31-bbff-7df0-bb80-370c26d96834 --dangerously-bypass-approvals-and-sandbox 'Say the word pineapple again. (bare-no-config-defaults, resume)'
```

Exit: 0

stdout:

```
stand-in reply: model=gpt-6-astra effort=low
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/home-no-defaults/.codex"))
OpenAI Codex v0.157.1
--------
workdir: <trial>/wt
model: gpt-6-astra
provider: standin
approval: never
sandbox: danger-full-access
reasoning effort: none
reasoning summaries: none
session id: 01a0dc31-bbff-7df0-bb80-370c26d96834
--------
user
Say the word pineapple again. (bare-no-config-defaults, resume)
warning: This session was recorded with model `launch-model` but is resuming with `gpt-6-astra`. Consider switching back to `launch-model` as it may affect Codex performance.
codex
stand-in reply: model=gpt-6-astra effort=low
tokens used
4
```

The `-o` file:

```
(not written)
```

What each turn request to the stand-in asked for:

```jsonl
{"path": "/v1/responses", "model": "gpt-6-astra", "effort": "low", "input_items": 9, "user_prompts": ["Say the word pineapple and stop. (bare-no-config-defaults, launch)", "Say the word pineapple again. (bare-no-config-defaults, resume)"]}
```

codex's own record of each turn, from the thread's rollout file:

```jsonl
{"model": "launch-model", "effort": "high", "approval_policy": "never", "sandbox": "danger-full-access"}
{"model": "gpt-6-astra", "effort": null, "approval_policy": "never", "sandbox": "danger-full-access"}
```

