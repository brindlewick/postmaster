# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> Using PlanSearch on top of Claude 3.5 Sonnet achieves a state-of-the-art pass@200 of 77.0% on LiveCodeBench, outperforming both the best score achieved without search (pass@1 = 41.4%) and using standard repeated sampling (pass@200 = 60.6%).

Abstract; not checked (one verbatim read; the body gives the same figures in Table 1)

> We hypothesize that a core missing component is a lack of diverse LLM outputs, leading to inefficient search

Abstract and Section 1 (fragment; the abstract sentence continues "due to models repeatedly sampling highly similar, yet incorrect generations"); checked for the fragment (two reads agree)

> we can accurately predict performance gains due to search as a direct function of the diversity over generated ideas

Abstract; not checked (one verbatim read)

> LiveCodeBench pass@200, repeated sampling / IdeaSearch / PlanSearch: GPT-4o-mini 53.3 / 59.4 / 64.9 | GPT-4o 60.6 / 70.4 / 73.0 | DeepSeek-Coder-V2 53.2 / 65.9 / 70.3 | Claude-Sonnet-3.5 55.6 / 70.2 / 77.0

Table 1, as listed by the fetch tool; not checked (one read)

> For this paper, we use only the subset of problems between May 2024 and September 2024 to avoid possibilities of contamination.

Section 5.1; not checked (one read)

Appendix D as read (a paraphrase, not a quote): about 244 tokens per completion for repeated sampling against about 1,428 for PlanSearch, and PlanSearch ahead of repeated sampling once about 10,000 tokens or more are spent per problem (Figure 18). Not checked.

