# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> **Status**: [Development][DocumentStatus]

Top of the document (the status of the whole page); checked (raw file)

> Represents an operation that executes a coordinated process composed of multiple agents or other operations involving generative AI.

Section "Invoke workflow span", first paragraph; checked (raw file)

> The `gen_ai.operation.name` SHOULD be `invoke_workflow`.

Section "Invoke workflow span"; checked (raw file)

> Describes a tool call that executes one or more commands.

Section "Command execution span", first paragraph; checked (raw file)

Read from the attribute tables (not quoted): in the "Execute tool span" tables `gen_ai.tool.name` is Required, `gen_ai.tool.call.id` is Recommended, and `gen_ai.tool.call.arguments` and `gen_ai.tool.call.result` are Opt-In; `gen_ai.conversation.id` is Conditionally Required on the agent spans. Every attribute in these tables carries the Development stability badge. A search of the file for "commit" and "coding agent" found nothing relevant to version control or to coding agents.

## Numbers from the GitHub API, 2026-10-04

Repository open-telemetry/semantic-conventions-genai (plain GET):

- stars 404; forks 116; open issues and pull requests 204 (the API's combined count)
- created 2026-05-05T03:08:44Z; last push 2026-10-04T00:40:42Z
- no GitHub release (the latest-release endpoint returned 404); licence Apache-2.0; default branch main
- the parent repository open-telemetry/semantic-conventions: stars 660, forks 400, last push 2026-10-04T04:21:57Z
