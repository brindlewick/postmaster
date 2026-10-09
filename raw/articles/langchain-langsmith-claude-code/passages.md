# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Each trace includes user messages, tool calls, compaction, subagent runs, and assistant responses.

Section on what is traced; checked (two fetches agree word for word)

> Subagents are only traced upon completion.

Section on subagents, first sentence of the caveat; checked (two fetches agree; the first fetch gave the following sentence, which says that an interrupted turn leaves a subagent's child runs untraced; that second sentence is not checked)

> This guide shows you how to send conversations automatically from the Claude Code CLI to LangSmith.

First paragraph under the title; not checked (one fetch)

## A conflict between two fetches of the same page

One fetch returned the sentence "This lets you correlate traces back to specific PRs, commits, and authors in LangSmith." as the sentence under a GitHub Actions example that attaches PR URLs and commit SHAs as metadata. The other fetch said it found no sentence with those words but did find a `commit_sha` field in a GitHub Actions example. So the page does show a commit SHA being attached as metadata in an example, and the wording of the sentence is not confirmed. The fetches also differ on the mechanism: one said the integration is a plugin and "not hooks or OpenTelemetry"; that was not checked.

## Numbers

Hosted product: the page states no usage figures (neither fetch returned any). The open-source client repository langchain-ai/langsmith-sdk (plain GET, 2026-10-04): stars 1067; forks 307; open issues and pull requests 231 (the API's combined count); created 2023-05-30T19:03:00Z; last push 2026-10-03T00:56:03Z; licence MIT; description field "LangSmith Client SDK Implementations". That repository is the client library, not the hosted service.
