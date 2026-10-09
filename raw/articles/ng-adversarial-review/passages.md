# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read as raw text with curl (not
processed by a model). Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Free mechanical checks run first. Then two agents — **The Optimizer** and **The Skeptic** — review your code independently and challenge each other's findings.

README, opening (line wraps joined); checked (raw file text)

> Only findings that survive the challenge at high confidence get auto-fixed, and a bounded verification loop catches regressions from the fixes themselves.

README, opening (line wraps joined); checked (raw file text)

> Add OpenAI Codex as a cross-vendor reviewer and agreement across providers becomes your strongest signal.

README, opening (line wraps joined); checked (raw file text)

> **Adversarial review** — change-type classification and weighted escalation scoring pick standard (2 agents) or full (4 agents) depth, spawned in two waves: Optimizers first, Skeptics after the Optimizer merge lands.

README, "How it works", step 7 (line wraps joined); checked (raw file text)

> **Synthesize** — confidence-based filtering and a Haiku scoring pass, then apply consensus fixes (auto-fix) or report them as suggestions (review-only).

README, "How it works", step 8 (line wraps joined); checked (raw file text)

> For a quick single-pass review of a working diff, the built-in command is cheaper and faster.

README, "vs. the built-in /code-review" (line wraps joined); checked (raw file text)

The README offers no measurement of how many defects the second agent or the Codex lane adds. Its design-rationale page was not read.

## Numbers from the GitHub API, 2026-10-04

- stargazers_count: 14
- forks_count: 4
- created_at: 2026-03-14T20:07:02Z
- pushed_at: 2026-09-15T16:10:48Z
- license: none recorded by the API (the README says MIT)
- open_issues_count: 1
- latest release: v1.7.0, published 2026-09-09T07:16:25Z
- default branch head: 6aff53cbc1e66e7b5f588fb5526da52b77695f54, committed 2026-09-09T07:15:36Z
