# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> the LLM selects or combines changes based on the issue description, producing one unified delta patch per group

Section 4.5.2 (fragment; the preceding text says patches that are subsets of each other are merged and divergent ones are chosen or combined); checked (two reads agree word for word)

> Refine is implemented using Claude 3.7 Sonnet as the backend LLM and Gemini 2.5 Pro as the reviewer agent.

Implementation; checked (two reads agree)

> aggregating partial fixes via an LLM-powered code review process

Abstract (fragment); not checked (one verbatim read)

> Specifically, Refine boosts AutoCodeRover's performance by 14.67%, achieving a score of 51.67% and surpassing all prior baselines. On SWE-Bench Verified, Refine improves the resolution rate by 12.2%

Abstract (two sentences of the abstract, joined here); not checked as sentences (one verbatim read); the figures 51.67%, 14.67 and 12.2 agree across reads, as do 37.00% (111 of 300) and 51.6% (258 of 500) for the base agent

> AutoCodeRover 36.67% -> 56.67% | ExpeRepair 40% -> 60% | Agentless 40% -> 56.67% | CodeV 50% -> 53.33% | BlackBoxAI 50% -> 60%

Table 1, on "a subset of thirty initial patches" (36.67% is 11 of 30), rows as listed by the fetch tool; checked (two reads give the same numbers and the same subset size)

Reading by the fetch tool (a paraphrase, not a quote, second read): the ablation (Table 3) goes from 37.00% with none of the modules to 44.66% with all three (context, diverse delta patches, reviewer); the paper reports no experiment that keeps the same candidates and selects one instead of aggregating; no confidence intervals; cost about $6.59 and 1.15M tokens per issue (first read). Not checked.

