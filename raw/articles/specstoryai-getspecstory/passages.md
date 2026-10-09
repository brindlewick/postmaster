# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> It saves your AI coding conversations as local markdown files of each session.

specstory-cli/README.md, opening; checked (raw file)

> **Capture** - SpecStory CLI and IDE extensions save every AI interaction locally to `.specstory/history/`

README.md, Workflow, item 1; checked (raw file)

> Automatic redaction of secrets (API keys, tokens, credentials) from saved markdown history and cloud-synced session data

specstory-cli/README.md, Features; checked (raw file)

> so support for a new coding agent is a pull request that adds one package under `pkg/providers/`.

specstory-cli/README.md, Agent Support (the sentence continues from "Every supported agent is a provider behind the Agent SPI"); checked (raw file)

> Lore mines your `.specstory/history` into evidence - what you actually ran, what worked, and the judgment you apply without noticing - and forges the skills you approve into every agent on your machine.

README.md, Lore section; checked (raw file)

Paraphrase, not a quotation: the Agent Support table in specstory-cli/README.md lists each supported agent's own session store and its data format: JSONL for Claude Code, Codex CLI, Droid CLI, Antigravity CLI, Muse Code, Pi, Qwen Code and Grok Build; JSON for Gemini CLI and DeepSeek TUI; SQLite for Cursor CLI, Cursor IDE and OpenCode; JSON or JSONL for VS Code Copilot. A case-insensitive search of the main README for the words "commit", "commits" and "git" returned no line. The same search of the CLI README found no "commit" and one "git", in a developer instruction to clone the repository. So neither README states any tie between a saved session and a git commit.

## Numbers from the GitHub API, 2026-10-04

Repository specstoryai/getspecstory (plain GET of the repository and latest-release endpoints):

- stars 1344; forks 90; open issues and pull requests 51 (the API's combined count)
- created 2024-12-13T18:05:13Z; last push 2026-10-02T07:15:01Z
- latest release v2.15.1, published 2026-09-24T21:46:36Z
- licence Apache-2.0; default branch dev; not archived

## Vendor badge values, 2026-10-04 (checked: a second fetch of each returned the same values; the fetch tool may have served a cached copy, and the endpoint says its cache lasts 3600 seconds)

The README embeds three live badges served by the vendor. The JSON the vendor's badge endpoint returned on the retrieval date: label "Installs", message "229,989"; label "Sessions Saved", message "8,165,878"; label "Active Users", message "12,411". The vendor does not say in the README what counts as an install or as active.
