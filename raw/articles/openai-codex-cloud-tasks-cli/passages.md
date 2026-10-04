# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Number of assistant attempts (best-of-N).

cli.rs, the `attempts` option of the exec command (doc comment); checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> attempts must be between 1 and 4

cli.rs, parse_attempts (error message); checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Attempt number to apply (1-based).

cli.rs, the `attempt` option of the apply command; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Attempt number to display (1-based).

cli.rs, the `attempt` option of the diff command; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

## Numbers from the GitHub API, 2026-10-04

- full_name: openai/codex
- stars: 127799
- forks: 20011
- created: 2025-04-13T05:37:54Z
- last push: 2026-10-04T07:12:21Z
- licence (API spdx_id): Apache-2.0
- archived: false
- description: Lightweight coding agent that runs in your terminal
- latest release: rust-v0.160.0 (2026-10-01T20:19:13Z)

Note: The API numbers are for the whole Codex CLI repository, not for the cloud product.
