# dash-prompt

## Launch

Command:

```sh
codex exec -C <trial>/wt --json -o <trial>/dash-prompt-launch-last.md -m launch-model -c 'model_reasoning_effort="high"' --dangerously-bypass-approvals-and-sandbox 'Say the word pineapple and stop. (dash-prompt, launch)'
```

Exit: 0

stdout:

```jsonl
{"type":"thread.started","thread_id":"01a0e1d3-422b-7730-a2d8-35bf20312a37"}
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

Every request the stand-in received:

```
POST /v1/responses
```

What each turn request asked for:

```jsonl
{"path": "/v1/responses", "model": "launch-model", "effort": "high", "input_items": 3, "user_prompts": ["Say the word pineapple and stop. (dash-prompt, launch)"]}
```

## Resume, from <trial>/wt

Command:

```sh
codex exec resume 01a0e1d3-422b-7730-a2d8-35bf20312a37 --json -o <trial>/dash-prompt-resume-last.md -m resume-model -c 'model_reasoning_effort="medium"' --dangerously-bypass-approvals-and-sandbox '- Say the word pineapple again. (dash-prompt, resume)'
```

Exit: 2

stdout:

```
(empty)
```

stderr:

```
WARNING: proceeding, even though we could not create PATH aliases: Refusing to create helper binaries under temporary dir "<tmp>" (codex_home: AbsolutePathBuf("<trial>/home-defaults/.codex"))
error: unexpected argument '- ' found

  tip: to pass '- ' as a value, use '-- - '

Usage: codex exec resume [OPTIONS] [SESSION_ID] [PROMPT]

For more information, try '--help'.
```

The `-o` file:

```
(not written)
```

Every request the stand-in received:

```
(none)
```

What each turn request asked for:

```jsonl
(empty)
```

codex's own record of each turn, from the thread's rollout file:

```jsonl
{"model": "launch-model", "effort": "high", "approval_policy": "never", "sandbox": "danger-full-access", "cwd": "<trial>/wt"}
```

