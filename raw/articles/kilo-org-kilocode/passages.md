# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> The Agent Manager is a control panel for running and orchestrating multiple Kilo Code agents, with support for parallel worktree-isolated sessions and multiple conversations in the same worktree.

agent-manager.md, opening; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> You can run up to 4 parallel implementations of the same prompt across separate worktrees:

agent-manager.md, Multi-Version Mode; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Optionally assign different models to each version

agent-manager.md, Multi-Version Mode, step 2; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Kilo creates one worktree + session per version and runs them in parallel

agent-manager.md, Multi-Version Mode, step 3; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Sessions in one worktree have separate transcripts and prompt queues, but share the same checkout, branch, and terminal state.

agent-manager.md, Sessions and History; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> A `task` subagent does not create a git worktree.

agent-manager.md, Orchestration model; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> For genuinely hard tasks where you do not know which approach will work:

agent-manager-workflows.md, Workflows, 3. Multiple approaches in parallel; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Review the diffs side by side, pick the winner, apply it, discard the rest.

agent-manager-workflows.md, Workflows, 3. Multiple approaches in parallel, step 3; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

## Numbers from the GitHub API, 2026-10-04

- full_name: Kilo-Org/kilocode
- stars: 27488
- forks: 3227
- created: 2025-03-10T15:34:26Z
- last push: 2026-10-04T09:00:13Z
- licence (API spdx_id): MIT
- archived: false
- description: Kilo is the all-in-one agentic engineering platform. Build, ship, and iterate faster with the most popular open source coding agent.
- latest release: v7.8.3 (2026-10-01T13:19:25Z)
