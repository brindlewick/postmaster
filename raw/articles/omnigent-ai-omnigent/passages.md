# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> is a multi-agent coding orchestrator who writes no code herself.

README, Polly and Debby; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> She's the tech lead: she plans, delegates the work to coding sub-agents (Claude Code, Codex, or Pi) in parallel git worktrees, then routes each diff to a reviewer from a different vendor than the one that wrote it. You merge.

README, Polly and Debby; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> is a brainstorming partner with two heads, one Claude and one GPT. Every question you ask goes to both heads, and she lays the two answers out side by side.

README, Polly and Debby; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Ask one agent to review another's work, or split a task across agents that are each good at different things.

README, Why Omnigent?; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Type `/debate` and the heads critique each other for a few rounds before converging.

README, Polly and Debby; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Status: alpha

README, status badge (alt text); checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> A coding orchestrator that breaks your goal into pieces and hands them to a team of Claude Code, Codex, OpenCode, Cursor, Hermes, Pi, and Antigravity sub-agents to build.

examples/polly/config.yaml, description; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Record the worktree path + branch in the registry (`.polly/registry.json`).

examples/polly/skills/fanout/SKILL.md, step 1; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Cross-vendor verification is the point: review is ALWAYS done by a DIFFERENT vendor than the implementer

examples/polly/config.yaml, the agent's prompt; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Pull the human in at the plan gate and on hard blocks.

examples/polly/config.yaml, the agent's prompt; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> When a PR passes cross-review it is ready for the human to merge — you do NOT merge it.

examples/polly/config.yaml, the agent's prompt; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> The implementer never signs off on its own work — a different model does

examples/polly/skills/cross-review/SKILL.md, opening; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Give the reviewer ONLY the diff snapshot + contract — never the implementer's transcript or worktree.

examples/polly/skills/cross-review/SKILL.md, Notes; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> If the contract can't be satisfied after a few loops, stop and escalate to the user with specifics.

examples/polly/skills/cross-review/SKILL.md, step 7; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Use ONLY for subtasks that are parallel-safe (no shared files, no ordering dependency).

examples/polly/skills/fanout/SKILL.md, opening; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Because polly never merges, cross-PR conflicts surface when the human merges, not here.

examples/polly/skills/fanout/SKILL.md, Notes; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> A pluggable conformance suite that probes harness behavior and reconciles the observed verdicts with the capability model to surface drift.

tests/harness_bench/README.md, opening; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

## Numbers from the GitHub API, 2026-10-04

- full_name: omnigent-ai/omnigent
- stars: 10482
- forks: 1679
- created: 2026-06-11T12:18:13Z
- last push: 2026-10-04T11:56:15Z
- licence (API spdx_id): Apache-2.0
- archived: false
- description: Omnigent is an open-source AI agent framework and meta-harness: orchestrate Claude Code, Codex, Cursor, Pi, and custom agents — swap harnesses without rewriting, enforce policies and sandboxing, and collaborate in real time from any device.
- latest release: v0.16.0 (2026-09-29T20:34:22Z)
