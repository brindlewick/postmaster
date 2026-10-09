# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Real-time observability dashboard for Claude Code and Codex agents.

Opening line; checked (raw file)

> Agents Observe captures every hook event as it happens and streams it to a live dashboard.

Section "Why observability matters"; checked (raw file)

> **Multi-agent work is opaque.** A coordinator spawns a code reviewer, a test runner, and a documentation agent in parallel.

Section "Why observability matters", first bullet (the next sentence says that without observability you only see the final result); checked (raw file)

> See the full agent hierarchy — which subagent was spawned by which parent

Section "What you can do"; checked (raw file)

A search of the README for "commit", "git" (whole word), "hash" and "tamper" found no line that states a tie to commits or any integrity mechanism; "git" appears in the instruction to clone the repository. The README describes the data path as Claude Code hooks, a command-line script, an API server with SQLite and a React dashboard.

## Numbers from the GitHub API, 2026-10-04

Repository simple10/agents-observe (plain GET of the repository and latest-release endpoints):

- stars 688; forks 69; open issues and pull requests 8 (the API's combined count)
- created 2026-03-26; last push 2026-09-04
- latest release v0.9.12, published 2026-07-22T05:59:42Z
- licence MIT; default branch main
- description field: "Real-time observability of claude code sessions & multi-agents."
- the README names disler/claude-code-hooks-multi-agent-observability as the project that inspired it; that repository has stars 1545, forks 383, last push 2026-02-08 (read from the API, README not read)
