# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> This instrumentation-free, framework-agnostic approach incurs under 3% performance overhead and detects prompt injection attacks, identifies resource-wasting loops, and reveals bottlenecks in multi-agent systems.

Abstract; not checked (one fetch)

> Table 1 quantifies the runtime overhead of AgentSight across three developer workflows, with a average 2.9% overhead.

Evaluation text (the grammar is the paper's); the number is checked (two fetches agree on 2.9%), the sentence is one fetch

> AgentSight monitored a team of 6 collaborating software development agents for our Github repo, using claude-code subagents, captured 3153 total events after Correlation Engine.

Case study on multi-agent coordination; the numbers (6 agents, 3,153 events) agree across two fetches, the wording is one fetch

> A key challenge at this stage is managing the latency and cost of LLM analysis, which our system mitigates through asynchronous processing and robust prompt engineering.

Discussion; checked (two fetches agree word for word)

## Table 1, overhead (two fetches agree on all rows)

| workflow | without | with AgentSight | overhead |
|---|---|---|---|
| Understand Repo | 127.98 s | 132.33 s | 3.4% |
| Code Writing | 22.54 s | 23.64 s | 4.9% |
| Repo Compilation | 92.40 s | 92.72 s | 0.4% |

## A conflict between the two fetches

For the sentence that ends the multi-agent case study, one fetch returned "While the agents developed some emergent coordination, separating the roles more clearly could reduce total runtime and token cost." and the other returned the same sentence with "more clear". The sentence is therefore paraphrased and not quoted.

## Read from the full text (one fetch; not quotations)

- Test agent: Claude Code 1.0.62 with the model the paper calls Claude 4; three developer workflows on a tutorial repository; each run three times with and without AgentSight. Small evaluation, one agent.
- Case studies: a prompt injection in a cloned repository's README (521 events merged into 37 events); a crewAI research agent in a loop of a failing tool call; and the six-agent team above, where the paper says the frontend and test agents were sometimes blocked by sequential dependencies and retry cycles caused by file-locking contention.
- Recorded streams: LLM prompts and responses taken from the encrypted traffic, and system calls and process events from the kernel. Neither fetch found any tie to git commits.
- Limits: the paper has no section called Limitations, according to the first fetch.

## Numbers from the GitHub API, 2026-10-04

Repository eunomia-bpf/agentsight (the paper links github.com/agent-sight/agentsight; the API resolves to this name) (plain GET of the repository and latest-release endpoints):

- stars 721; forks 109; open issues and pull requests 39 (the API's combined count)
- created 2025-07-07T21:16:41Z; last push 2026-10-04T11:38:29Z
- latest release v1.0.32, published 2026-10-04T08:16:48Z
- licence MIT
- description field: "lightweight system-level observability for AI Agents"
