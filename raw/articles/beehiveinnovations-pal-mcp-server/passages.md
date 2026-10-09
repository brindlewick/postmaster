# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Formerly known as Zen MCP

README, header line (link text); checked (raw file text)

> Why rely on one AI model when you can orchestrate them all?

README, "Why PAL MCP?"; checked (raw file text)

> Claude Code can spawn Codex subagents, Codex can spawn Gemini CLI subagents, etc.

README, "Now with CLI-to-CLI Bridge", bullet "CLI Subagents"; checked (raw file text)

> Perform a codereview using gemini pro and o3 and use planner to generate a detailed plan, implement the fixes and do a final precommit check by continuing from the previous codereview

README, example prompt 1 in the code-review walkthrough; checked (raw file text)

> Use consensus with gpt-5 and gemini-pro to decide: dark mode or offline support next

README, "Now with CLI-to-CLI Bridge", example block; checked (raw file text)

Note on evidence: a search of the README text for "benchmark", "measured" and "evidence" found no line giving a measurement that using several models helps.

## Numbers from the GitHub API, 2026-10-04

- stars 11767; forks 1041; created 2025-06-08; last push 2025-12-15; licence field "NOASSERTION"
- latest release v9.8.2, published 2025-12-15; default branch main; not archived
- a request for BeehiveInnovations/zen-mcp-server returned the repository now named pal-mcp-server

## Added by P5-review, retrieved 2026-10-04

Read as raw README text with curl (first 9,000 characters); the same commit as above.

> **Multi-Model Orchestration** - Claude coordinates with Gemini Pro, O3, GPT-5, and 50+ other models to get the best analysis for each task

README, "Reasons to Use PAL MCP", item 1; checked (raw file text)

> Shares the relevant files, findings, etc with **Gemini Pro** to perform a deep dive for a second [`codereview`](docs/tools/codereview.md)

README, "Example: Multi-Model Code Review Workflow", step 6 (the second reviewer is given the first reviewer's findings); checked (raw file text)

> When done, Claude takes in all the feedback and combines a single list of all critical -> low issues, including good patterns in your code.

README, "Example: Multi-Model Code Review Workflow", step 8; checked (raw file text)

Further numbers from the GitHub API, 2026-10-04: default branch head 7afc7c1cc96e23992c8f105f960132c657883bb1, committed 2025-12-15T17:07:31Z (about ten months before the read).
