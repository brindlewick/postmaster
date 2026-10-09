# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> Using the same nano model, our critic–comparator orchestration reaches 76.4% with k=8 proposals

Abstract (fragment; the abstract goes on to say this matches the standalone performance of Gemini 3 Pro and Claude Opus 4.5 Thinking and approaches the 79.0% oracle best-of-8 upper bound); not checked (one verbatim read; the figures 67.0%, 76.4% and 79.0% agree across reads)

> Thus, many correct patches are already present in weak-model proposal pools; the main challenge is selecting them.

Abstract; not checked (one verbatim read)

> The remaining failures are mostly proposal-coverage failures, indicating shared blind spots that stronger selection alone cannot close.

Abstract; not checked (one verbatim read; the body says it in other words)

> for each task, we generate a fixed pool of k=8 candidate patches using independent GPT-5.4 nano proposer runs

Experiments (fragment); checked (two reads agree word for word)

Reading by the fetch tool (a paraphrase, not a quote): no cost accounting, no confidence intervals, no majority-vote or single-judge baseline on the same pool, no experiment with candidates from different models, contamination not discussed. Not checked. The abstract's "single GPT-5.4 nano proposal solves 67.0% of tasks" is the one-sample baseline.

