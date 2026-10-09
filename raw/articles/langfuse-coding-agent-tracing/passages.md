# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Tracing them answers three questions teams keep asking: what did the agent actually do, what does it cost per developer or per session, and where does it fail or waste work.

Section "Three reasons teams trace coding agents" (the source shows part of it in bold); checked (two fetches agree word for word)

> Hooks are per-machine and user-serviceable. A developer can disable a hook in their local config. If you need guaranteed capture for compliance, treat hook-based tracing as telemetry, not enforcement.

Section "Limits", second bullet; checked (two fetches agree word for word; a third gave only the first two sentences)

> Enforcement belongs at a gateway or provider level.

Section "Limits", the sentence that follows the quote above; not checked (one fetch gave it verbatim)

> You see the conversation and tool calls, not the assembled context.

Section "Limits", first bullet (about `CLAUDE.md`, skills and auto-loaded context not being captured); not checked (one fetch)

> Long agent sessions that went wrong are hard to reconstruct from terminal scrollback. The trace timeline preserves the full sequence, including retries and reasoning summaries where the agent exposes them.

Section "What the traces let you do"; not checked (one fetch)

## Supported coding agents the page lists

Two fetches agree on nine: Claude Code, OpenAI Codex, GitHub Copilot, Cursor, Kiro IDE, Kiro CLI, OpenCode, Augment Code, VS Code (MCP). The page's section headings, as returned: Tracing coding agents with Langfuse; Three reasons teams trace coding agents; Supported coding agents; What the traces let you do; Limits; FAQ. One fetch reported that the page gives no usage figures and does not discuss git commits, subagents or parallel agents; that is one fetch's reading of the page, not checked.

## Numbers from the GitHub API, 2026-10-04

Repository langfuse/langfuse (plain GET of the repository and latest-release endpoints). This is the platform's repository, not the coding-agent integration:

- stars 35358; forks 3920; open issues and pull requests 1002 (the API's combined count)
- created 2023-05-18T17:47:09Z; last push 2026-10-03T13:05:48Z
- latest release v4.50.0, published 2026-10-02T10:13:55Z
- licence field "Other" (SPDX NOASSERTION); default branch main
- description field: "Open source agent evals & observability: Trace, evaluate, and improve LLM applications with one open platform."
