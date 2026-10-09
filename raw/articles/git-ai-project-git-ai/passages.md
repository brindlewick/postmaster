# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Git AI is an open source git extension that tracks the AI-generated code in your repositories.

Opening paragraph; checked (raw file)

> every line of AI code is linked to the **agent, model, and prompts** that generated it

Opening paragraph (second sentence, middle part); checked (raw file)

> On commit, Git AI stores line-level attribution data in Git Notes, linking each line of AI-generated code to the agent, model, and session that created it.

FAQs, "How does it work?", step 2; checked (raw file)

> *Git AI does not use AI or heuristics to "detect" AI code — the Agents report exactly which lines they wrote, providing the most accurate, explicit attribution possible.*

FAQs, "How does it work?", closing line (italic in the source); checked (raw file)

> These sessions are scanned and redacted, and saved outside of Git -- keeping repos lean, enabling fine-grained access control, and preventing PII or secrets from leaking.

"Our Choices", the "Secure Prompt Storage" bullet; checked (raw file)

> Calculates % AI-code, AI-lines generated vs committed, accepted rates, human overrides broken down by tool and model.

"Attribution Stats", text under `git ai stats --json` (the example JSON that follows has a `tool_model_breakdown` object keyed by tool and model); checked (raw file)

> Attribute lines from multiple Agent Sessions in the same commit

FAQs, capabilities table, row label (status column: supported); checked (raw file)

> Attribution maintained across linked worktrees.

FAQs, capabilities table, note on the "Git worktrees" row; checked (raw file)

> Resolves attributed lines to the tool call that generated them.

FAQs, capabilities table, note on the "Tool-call level attribution" row; checked (raw file)

> Records token usage and session activity even when no code is accepted.

FAQs, capabilities table, note on the "Attribute sessions that produced no code" row; checked (raw file)

> Hundreds of engineering teams (including many in the Fortune 100) use Git AI to understand their AI usage and make agents more effective on their codebase.

FAQs, "Who uses this?" (a vendor claim, no count or list given); checked (raw file)

## Numbers from the GitHub API, 2026-10-04

Repository git-ai-project/git-ai (plain GET of the repository and latest-release endpoints):

- stars 2813; forks 308; open issues and pull requests 253 (the API's combined count)
- created 2025-07-02T16:09:26Z; last push 2026-10-01T23:45:48Z
- latest release v1.7.5, published 2026-09-09T20:30:05Z
- licence Apache-2.0; default branch main; not archived
- description field: "A Git extension for tracking the AI-generated code in your repos"
