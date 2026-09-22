---
kind: trial
subject: pi 0.87.0 prompt delivery and session resume
date: 2026-09-22
---

# Method

**Question.** Does it matter whether pi is handed its prompt as an `@file` argument or on
stdin, and does a resume behave as the adapter assumed?

**Setup.** pi 0.87.0, the standalone Linux binary from its GitHub release, checksum verified.
A local HTTP server standing in for an OpenAI-compatible provider, registered through
`models.json`, logging every request body it received and replying with a fixed one-word
completion. Using a stand-in provider rather than a real one is what makes the comparison
exact: the recorded request is precisely what the model would have been given.

**The comparison.** The identical prompt file, passed two ways, everything else held constant:

```
pi --mode json --print --approve --model <m> @prompt.txt   </dev/null
pi --mode json --print --approve --model <m>             < prompt.txt
```

The user message each produced is recorded beside this file as
`at-file-user-message.json` and `stdin-user-message.json`.

**Further checks, same session.**

- The `@file` form was run once with stdin left as an inherited open pipe and once with
  `</dev/null`, to see whether pi's read of stdin blocks a launch.
- The session from the stdin launch was resumed with `--session <id>` from the launch
  directory, and again from a different directory, recording what the model received and
  what pi did. `resume-session-ids.txt` holds the launch and resume session ids.

**Not established here.** Whether the difference changes a capable model's behaviour on a
real task. The trial establishes what the model receives, not what it then does.

**Repeating it.** Any OpenAI-compatible stand-in that logs request bodies will do; the
finding is in the recorded `messages[]`, not in the reply.
