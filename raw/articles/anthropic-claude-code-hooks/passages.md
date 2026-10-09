# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Hooks are user-defined shell commands, HTTP endpoints, MCP tool calls, LLM prompts, or subagents that execute automatically at specific points in Claude Code's lifecycle.

First paragraph under the title; checked (two fetches agree word for word)

> Path to conversation JSON.

Common input fields, row `transcript_path`, first sentence of the description (the sentence quoted above follows it); checked (two fetches agree)

> The transcript file is written asynchronously and may lag the in-memory conversation, so it may not yet include the current turn's most recent messages when a hook fires.

Common input fields, row `transcript_path`; checked (two fetches agree word for word)

> When a subagent calls a tool, tool events such as `PreToolUse` and `PostToolUse` fire the same configured hooks as in the main conversation, and the input carries the `agent_id` and `agent_type` common input fields that identify the subagent.

Hooks in subagents (the source has a link around "common input fields"); checked (two fetches agree word for word)

## What the page lists

Both fetches returned the same 33 hook event names: SessionStart, Setup, UserPromptSubmit, UserPromptExpansion, PreToolUse, PermissionRequest, PermissionDenied, PostToolUse, PostToolUseFailure, PostToolBatch, Notification, MessageDisplay, SubagentStart, SubagentStop, TaskCreated, TaskCompleted, Stop, StopFailure, TeammateIdle, InstructionsLoaded, ConfigChange, CwdChanged, DirectoryAdded, FileChanged, WorktreeCreate, WorktreeRemove, PreCompact, PostCompact, PreModelSwitch, PostModelSwitch, Elicitation, ElicitationResult, SessionEnd (the order differs a little between the two fetches). The common input fields the fetches reported: `session_id`, `prompt_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`, `agent_id`, `agent_type`. The list is the fetch tool's reading of the page, not checked by any other means.

## Numbers from the GitHub API, 2026-10-04

Repository anthropics/claude-code (plain GET of the repository and latest-release endpoints). The product is closed source; these numbers describe the public repository, not the hooks or telemetry features, and the vendor's page states no figure for their use:

- stars 149351; forks 25453; open issues and pull requests 14147 (the API's combined count)
- created 2025-02-22T17:41:21Z; last push 2026-10-03T23:07:17Z
- latest release v2.1.289, published 2026-10-03T23:07:17Z
- licence field: none; default branch main; not archived
