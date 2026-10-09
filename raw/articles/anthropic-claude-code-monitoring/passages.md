# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> When the Agent tool, or legacy Task tool, spawns a subagent, the subagent's API and tool spans nest under the parent's `claude_code.tool` span.

Traces (beta), subagents; checked (two fetches agree word for word)

> Identifier of the subagent or teammate that issued the request. Absent on the main session

Table of attributes on the `claude_code.llm_request` span, row `agent_id` (the `claude_code.tool` span has the same row, "ran the tool" in place of "issued the request"); checked (two fetches agree word for word)

> Identifier of the agent that spawned this one. Absent for the main session and for agents spawned directly from it

Same tables, row `parent_agent_id`; checked (two fetches agree word for word)

> Redacted by default. Set `OTEL_LOG_USER_PROMPTS=1` to include it

User prompt event, row `prompt`; checked (two fetches agree; the first gave it with the lead-in "Prompt content.")

> UUID v4 identifier linking all events produced while processing a single user prompt

Standard attributes, `prompt.id`; not checked (one fetch gave it verbatim; another gave a paraphrase)

> Number of git commits created

Metrics table, `claude_code.commit.count`; not checked (one fetch gave it verbatim; another gave a paraphrase)

> Distributed tracing exports spans that link each user prompt to the API requests and tool executions it triggers, so you can view a full request as a single trace in your tracing backend.

Traces (beta), introduction; not checked (one fetch)

> Tracing is off by default.

Traces (beta); not checked (one fetch)

## What the page lists (counts are derived from the headings the fetches returned)

Two fetches returned the same 8 metric headings (session, lines of code, pull request, commit, cost, token, code edit tool decision, active time) and the same 19 event headings (user prompt, assistant response, tool result, API request, API error, API refusal, API request body, API response body, tool decision, permission mode changed, auth, MCP server connection, internal error, plugin installed, plugin loaded, skill activated, at mention, API retries exhausted, hook registered). One of the fetches described them as "15 event types" in its prose while listing 19 names; the count here is from the names. The span names the fetches gave are `claude_code.interaction`, `claude_code.llm_request`, `claude_code.tool` and `claude_code.hook`. The content switches named were `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_ASSISTANT_RESPONSES`, `OTEL_LOG_TOOL_DETAILS`, `OTEL_LOG_TOOL_CONTENT` and `OTEL_LOG_RAW_API_BODIES`. These lists were not re-read against the page by any means other than the fetch tool.
