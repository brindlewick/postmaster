# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Gas Town is a workspace manager that lets you coordinate multiple AI coding agents (Claude Code, GitHub Copilot, Codex, Gemini, and others) working on different tasks.

README, Overview; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Scale comfortably to 20-30 agents

README, Overview, table 'What Problem Does This Solve?' (a claim; no measurement is given); checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> When polecats complete work via `gt done`, the Refinery batches merge requests, runs verification gates, and merges to main using a Bors-style bisecting queue.

README, Core Concepts, Refinery; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> This is a Bors-style merge queue — polecats never push directly to main.

README, Merge Queue (Refinery); checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Gas Town emits all agent operations as structured logs and metrics to any OTLP-compatible backend

README, observability section; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

## Numbers from the GitHub API, 2026-10-04

- full_name: gastownhall/gastown
- stars: 18248
- forks: 1680
- created: 2025-12-16T00:33:33Z
- last push: 2026-09-29T20:20:10Z
- licence (API spdx_id): MIT
- archived: false
- description: Gas Town - multi-agent workspace manager
- latest release: v1.2.1 (2026-06-06T17:17:53Z)

Note: The API request for repos/steveyegge/gastown returned full_name gastownhall/gastown.
