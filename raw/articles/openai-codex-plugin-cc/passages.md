# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Use Codex from inside Claude Code for code reviews or to delegate tasks to Codex.

README, line 3; checked (raw file text)

> Runs a **steerable** review that questions the chosen implementation and design.

README, "/codex:adversarial-review"; checked (raw file text)

> When the review gate is enabled, the plugin uses a `Stop` hook to run a targeted Codex review based on Claude's response. If that review finds issues, the stop is blocked so Claude can address them first.

README, "Enabling review gate"; checked (raw file text)

> The review gate can create a long-running Claude/Codex loop and may drain usage limits quickly.

README, warning under "Enabling review gate"; checked (raw file text)

Note: a search of the README text for "measure", "benchmark" and "evidence" found no line giving a measurement.

## Numbers from the GitHub API, 2026-10-04

- stars 33828; forks 2370; created 2026-03-30; last push 2026-07-08; licence Apache-2.0
- latest release v1.0.6, published 2026-07-08; default branch main; not archived

## Added by P5-review, retrieved 2026-10-04

Read as raw README text with curl; the same commit as above.

> Runs a normal Codex review on your current work. It gives you the same quality of code review as running `/review` inside Codex directly.

README, "/codex:review"; checked (raw file text)

> Shows the final stored Codex output for a finished job. When available, it also includes the Codex session ID so you can reopen that run directly in Codex with `codex resume <session-id>`.

README, "/codex:result"; checked (raw file text)

Further numbers from the GitHub API, 2026-10-04: subscribers_count 129; open_issues_count 521; created_at 2026-03-30T15:29:52Z; pushed_at 2026-07-08T00:17:31Z; default branch head db52e28f4d9ded852ab3942cea316258ae4ef346, committed 2026-07-08T00:17:00Z.
