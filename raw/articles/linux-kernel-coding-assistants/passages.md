# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

## Release 7.2.0 (kernel.org/doc/html/v7.2)

> Assisted-by: AGENT_NAME:MODEL_VERSION [TOOL1] [TOOL2]

The format line of the tag; not checked (one fetch)

> Assisted-by: Claude:claude-3-opus coccinelle sparse

The example line of the tag; not checked (one fetch)

## Rolling documentation, header "7.3.0-rc5" (docs.kernel.org/process/coding-assistants.html)

> When AI tools contribute to kernel development, proper attribution helps track the evolving role of AI in the development process. Contributions should include an Assisted-by tag in the following format: Assisted-by: LLM [TOOL1] [TOOL2]

Attribution section (two sentences and the format line; 38 words); not checked (one fetch)

> AI agents MUST NOT add Signed-off-by tags. Only humans can legally certify the Developer Certificate of Origin (DCO).

Section on Signed-off-by; not checked (one fetch)

> Assisted-by: LLM coccinelle sparse

The example line of the tag in this version; not checked (one fetch)

## What differs between the two versions

The 7.2.0 page names the agent and the model version in the tag (`AGENT_NAME:MODEL_VERSION`); the rolling page shows the placeholder `LLM` instead. One fetch of the 7.2.0 page also gave "AGENT_NAME is the name of the AI tool or framework" and "MODEL_VERSION is the specific model version used" as definitions. It was not found out when or why the format changed. Neither page, as read, states how many commits carry the tag.
