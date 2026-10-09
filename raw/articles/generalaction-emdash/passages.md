# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Emdash is a desktop app for running AI coding agents in parallel. Each task runs in its own Git worktree, so you can explore multiple fixes or features at once, review the diffs, and merge what works.

README, opening paragraph; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Bring the CLI agents you already use: Claude Code, Codex, OpenCode, Amp, and more.

README, opening paragraph; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> feat: Best-of-N - Run multiple instances of the same provider

GitHub release tagged v0 (published 2026-04-28), release notes, one bullet that names pull request 362; read twice through the API (a jq filter and a grep on the body), same text both times; checked (two reads of the API body gave the same text)

## Numbers from the GitHub API, 2026-10-04

- full_name: generalaction/emdash
- stars: 5905
- forks: 622
- created: 2025-08-28T07:19:57Z
- last push: 2026-10-02T12:40:48Z
- licence (API spdx_id): Apache-2.0
- archived: false
- description: Emdash is the Open-Source Agentic Development Environment (🧡 YC W26). Run multiple coding agents in parallel. Use any provider.
- latest release: v1.2.7 (2026-09-27T09:29:15Z)

Note: The best-of-N docs page found by a search (docs.emdash.sh/best-of-n) redirects to emdash.com/docs/best-of-n, which returned HTTP 404 on 2026-10-04. The docs index (emdash.com/docs) lists a Tasks page but no best-of-N page, and the Tasks page has no section on several agents for one task. A listing of the repository file tree at main (GitHub API) has no path containing 'best-of', 'multi-agent' or 'multiagent'. it could not be told whether the feature was removed.
