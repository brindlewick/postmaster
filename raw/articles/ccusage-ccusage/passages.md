# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Analyze coding (agent) CLI token usage and costs from local data.

Tagline under the screenshot (a block quote in the source); checked (raw file)

> ccusage reads local usage data from coding agent CLIs and turns it into daily, weekly, monthly, and session reports.

Section "Supported Sources"; checked (raw file)

Paraphrase, not a quotation: the table under "Supported Sources" lists eighteen sources: Claude Code, Codex, OpenCode, Amp, Droid, Codebuff, Hermes Agent, pi-agent, Goose, OpenClaw, Kilo, Kimi, Qwen, GitHub Copilot CLI, Gemini CLI, Antigravity, Grok Build CLI and ZCode. A case-insensitive search of the whole README for "commit", "commits", "tamper", "hash" and "audit" found no line, and the word "git" appears only in developer instructions (cloning the repository, a development shell). The usage section lists reports by day, week, month and session, a `--by-agent --json` option and a `--json` output. The tool reports usage, not what the agent did.

## Numbers from the GitHub API, 2026-10-04

Repository ccusage/ccusage (plain GET of the repository and latest-release endpoints):

- stars 18863; forks 864; open issues and pull requests 13 (the API's combined count)
- created 2025-05-29T16:56:50Z; last push 2026-10-04T11:04:02Z
- latest release v20.0.26, published 2026-09-27T16:26:00Z
- licence field "NOASSERTION"; default branch main; not archived
- description field: "npx ccusage"
