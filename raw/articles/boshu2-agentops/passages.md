# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> **DevOps discipline for AI coding agents: shape the work, track it as a graph, and get each change judged by a fresh agent session that didn't write it.**

Opening line (bold in the source); checked (raw file)

> A new session that didn't write it returns `PASS`, `FAIL` or `NOT_PROVEN` against the same scenarios.

Table of steps, row "Judge"; checked (raw file)

> The author never approves its own work.

Paragraph after the table of steps; checked (raw file)

> judges in fresh contexts, each with the model, effort and perspective you assign (one model family or several vendors), compare, duel (score each other's ideas) or debate to your majority, keep dissent

Table "Why use AgentOps?", the row about one model's answer to a hard call (a fragment of the right-hand cell, which describes a "council"); checked (raw file)

> On request, Validate can save `verdict.v2` with exact content, checked scope and evidence. New proof belongs in selected, protected storage outside Git; existing evidence is preserved.

Section near the end of the README (inside a collapsed block); checked (raw file)

> The Claude Code plugin includes PreToolUse guards for private tracker data in commits, manual provenance-ledger edits and installed-skill overwrites.

Same collapsed block, "Permissions, optional hooks, and removal"; checked (raw file)

The README gives no measurement of whether the judging improves results: a case-insensitive search of the whole file for "benchmark", "evaluat", "measured", "study", "swe-bench", "accuracy" and "success rate" returned no line.

## Numbers from the GitHub API, 2026-10-04

Repository boshu2/agentops (plain GET of the repository and latest-release endpoints):

- stars 447; forks 41; open issues and pull requests 1 (the API's combined count)
- created 2025-11-05T19:18:56Z; last push 2026-10-04T01:19:06Z
- latest release v3.9.0, published 2026-10-03T20:03:39Z
- licence Apache-2.0; default branch main
- description field: "DevOps discipline for AI coding agents: shape the work, track it as a graph, and get each change judged by a context that didn't write it."
