# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Rollout tracing is not telemetry. Codex does **not** upload or report these traces; it writes local bundles only when `CODEX_ROLLOUT_TRACE_ROOT` is set.

Privacy note at the top (a block quote in the source; its next sentence says the bundles can contain prompts, responses, tool inputs and outputs, terminal output and paths); checked (raw file)

> The key design choice is: **observe first, interpret later**.

Introduction; checked (raw file)

> `trace.jsonl`: append-only raw events ordered by writer-assigned `seq`.

Bundle Layout; checked (raw file)

> `InteractionEdge` records information flow between objects, such as a `spawn_agent` tool call delivering a task into a child thread.

Raw Evidence vs Reduced Graph; checked (raw file)

> Multi-agent v2 child threads share the root trace writer. That means one root bundle reduces into one graph containing the parent thread, child threads, and the edges between them.

Multi-Agent v2; checked (raw file)

> Trace startup and writes are best-effort. Rollout tracing must never make a Codex session fail just because diagnostic recording failed.

System Shape; checked (raw file)

> runtime payloads are evidence, not proof that the model saw the same bytes.

Reducer Invariants (last bullet); checked (raw file)

## Numbers from the GitHub API, 2026-10-04

Repository openai/codex (plain GET of the repository and latest-release endpoints). These numbers measure the whole Codex CLI repository, not the rollout-trace feature:

- stars 127797; forks 20011; open issues and pull requests 20511 (the API's combined count)
- created 2025-04-13T05:37:54Z; last push 2026-10-04T07:12:21Z
- latest release rust-v0.160.0, published 2026-10-01T20:19:13Z
- licence Apache-2.0; default branch main; not archived
- description field: "Lightweight coding agent that runs in your terminal"
