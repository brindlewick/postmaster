# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read as raw text with curl (not
processed by a model). Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Multi-agent adversarial code review for **any** coding agent.

README, first line; checked (raw file text)

> `adverse` does the third thing: one model, three **personas**, with explicit cross-examination between them.

README, "Why this design"; checked (raw file text)

> The next step up is what some prior projects did: two **different** models (Claude + GPT Codex), so each catches what the other misses.

README, "Why this design"; checked (raw file text)

> Trade-off, named honestly: a single model running three personas has anchoring bias that two separate models don't.

README, "Why this design"; checked (raw file text)

> - **Single-model anchoring bias.** Honest answer: a single model running three personas correlates more than three independent models would.

README, "Limitations"; checked (raw file text)

> Synthesis is **deterministic Node code**, not another LLM call.

README, "How it works"; checked (raw file text)

> Per review: 6 model invocations (3 round-1 + 3 round-2).

README, "How it works"; checked (raw file text)

> 111 unit + contract tests, no API calls

README, "Tests" (fragment of a code comment; the tests exercise parsing and synthesis, not review quality); checked (raw file text)

The README reports no measurement of defects found.

## Numbers from the GitHub API, 2026-10-04

- stargazers_count: 60
- forks_count: 9
- created_at: 2026-05-08T07:27:53Z
- pushed_at: 2026-06-20T23:31:13Z
- license: MIT
- open_issues_count: 0
- latest release: none (the releases endpoint returns 404)
- default branch head: 4b9eb7b764a9d55ea08dff4f1c960926e0691f2a, committed 2026-06-20T23:31:11Z
