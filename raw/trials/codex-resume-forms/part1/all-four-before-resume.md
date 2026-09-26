# all-four-before-resume

## Launch

Command:

```sh
codex exec -C <trial>/wt --json -o <trial>/all-four-before-resume-launch-last.md -m launch-model -c 'model_reasoning_effort="high"' --dangerously-bypass-approvals-and-sandbox 'Say the word pineapple and stop. (all-four-before-resume, launch)'
```

Exit: 0

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0dc31-7d3f-7f90-aeef-8e4383ded15f"}
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
{"path": "/v1/responses", "model": "launch-model", "effort": "high", "input_items": 3, "user_prompts": ["Say the word pineapple and stop. (all-four-before-resume, launch)"]}
```

## Resume

Command:

```sh
codex exec --json -o <trial>/all-four-before-resume-resume-last.md -m resume-model -c 'model_reasoning_effort="medium"' --dangerously-bypass-approvals-and-sandbox resume 01a0dc31-7d3f-7f90-aeef-8e4383ded15f 'Say the word pineapple again. (all-four-before-resume, resume)'
```

Exit: 0

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0dc31-7d3f-7f90-aeef-8e4383ded15f"}
{"type":"item.completed","item":{"id":"item_0","type":"error","message":"This session was recorded with model `launch-model` but is resuming with `resume-model`. Consider switching back to `launch-model` as it may affect Codex performance."}}
{"type":"item.completed","item":{"id":"item_1","type":"error","message":"Model metadata for `resume-model` not found. Defaulting to fallback metadata; this can degrade performance and cause issues."}}
{"type":"turn.started"}
{"type":"item.completed","item":{"id":"item_2","type":"agent_message","text":"stand-in reply: model=resume-model effort=medium"}}
{"type":"turn.completed","usage":{"input_tokens":2,"cached_input_tokens":0,"cache_write_input_tokens":0,"output_tokens":2,"reasoning_output_tokens":0}}
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/home-defaults/.codex"))
```

The `-o` file:

```
stand-in reply: model=resume-model effort=medium
```

What each turn request to the stand-in asked for:

```jsonl
{"path": "/v1/responses", "model": "resume-model", "effort": "medium", "input_items": 6, "user_prompts": ["Say the word pineapple and stop. (all-four-before-resume, launch)", "Say the word pineapple again. (all-four-before-resume, resume)"]}
```

codex's own record of each turn, from the thread's rollout file:

```jsonl
{"model": "launch-model", "effort": "high", "approval_policy": "never", "sandbox": "danger-full-access"}
{"model": "resume-model", "effort": "medium", "approval_policy": "never", "sandbox": "danger-full-access"}
```

