# cd-flag

## Launch

Command:

```sh
codex exec -C <trial>/wt --json -o <trial>/cd-flag-launch-last.md -m launch-model -c 'model_reasoning_effort="high"' --dangerously-bypass-approvals-and-sandbox 'Say the word pineapple and stop. (cd-flag, launch)'
```

Exit: 0

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0dc31-a5a5-7041-9ce0-7ca0174b4f89"}
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
{"path": "/v1/responses", "model": "launch-model", "effort": "high", "input_items": 3, "user_prompts": ["Say the word pineapple and stop. (cd-flag, launch)"]}
```

## Resume

Command:

```sh
codex exec resume 01a0dc31-a5a5-7041-9ce0-7ca0174b4f89 -C <trial>/wt --dangerously-bypass-approvals-and-sandbox 'Say the word pineapple again. (cd-flag, resume)'
```

Exit: 2

stdout:

```
(empty)
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/home-defaults/.codex"))
error: unexpected argument '-C' found

  tip: to pass '-C' as a value, use '-- -C'

Usage: codex exec resume [OPTIONS] [SESSION_ID] [PROMPT]

For more information, try '--help'.
```

The `-o` file:

```
(not written)
```

What each turn request to the stand-in asked for:

```jsonl
(empty)
```

codex's own record of each turn, from the thread's rollout file:

```jsonl
{"model": "launch-model", "effort": "high", "approval_policy": "never", "sandbox": "danger-full-access"}
```

