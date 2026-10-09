# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read as raw text with curl (not
processed by a model). Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Automated code review for pull requests using multiple specialized agents with confidence-based scoring to filter false positives.

First line; checked

> Launches 4 parallel agents to independently review:

"/code-review", "What it does", step 4; checked

> **Agents #1 & #2**: Audit for CLAUDE.md compliance

"/code-review", "What it does", step 4; checked

> **Agent #3**: Scan for obvious bugs in changes

"/code-review", "What it does", step 4; checked

> Filters out issues below 80 confidence threshold

"/code-review", "What it does", step 6; checked

> **2x CLAUDE.md compliance agents**: Redundancy for guideline checks

"Technical Details", "Agent architecture"; checked

> **Nx confidence scorers**: One per issue for independent scoring

"Technical Details", "Agent architecture"; checked

The README offers no measurement of how many issues one agent finds against several.

## Numbers from the GitHub API, 2026-10-04

Repository anthropics/claude-code (the plugin is a folder inside it; the numbers are for the whole repository, not for the plugin).
- stargazers_count: 149351
- forks_count: 25453
- created_at: 2025-02-22T17:41:21Z
- pushed_at: 2026-10-03T23:07:17Z
- license: none recorded by the API (null)
- latest release: v2.1.289, published 2026-10-03T23:07:17Z
- default branch head: 2bfb629dfaff0c8318047a4beb93cf1dc5b58b18, committed 2026-10-03T23:06:56Z
