# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> We found that a multi-agent system with Claude Opus 4 as the lead agent and Claude Sonnet 4 subagents outperformed single-agent Claude Opus 4 by 90.2% on our internal research eval.

Performance section; checked

> In our data, agents typically use about 4× more tokens than chat interactions, and multi-agent systems use about 15× more tokens than chats.

Token-usage discussion; checked

> In our analysis, three factors explained 95% of the performance variance in the BrowseComp evaluation.

Evaluation of performance factors; not checked

> We found that token usage by itself explains 80% of the variance, with the number of tool calls and the model choice as the two other explanatory factors.

Evaluation of performance factors; checked

> For instance, most coding tasks involve fewer truly parallelizable tasks than research, and LLM agents are not yet great at coordinating and delegating to other agents in real time.

Discussion of where multi-agent systems fit; checked

> We started with a set of about 20 queries representing real usage patterns.

Evaluation section; not checked

> We used an LLM judge that evaluated each output against criteria in a rubric: factual accuracy, citation accuracy, completeness, source quality, and tool efficiency.

Evaluation section; not checked (the part up to 'criteria in a rubric' agrees across two fetches)
