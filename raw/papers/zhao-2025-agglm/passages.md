# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> we propose to learn aggregation as an explicit reasoning skill: given a set of candidate solutions, we train an aggregator model to review, reconcile, and synthesize a final, correct answer using reinforcement learning from verifiable rewards.

Abstract; not checked (one verbatim fetch)

> aggregating just eight solutions with AggLM-1.7B is better than majority voting with sixteen

Results, on AIME25, HMMT24 and HMMT25; checked

> roughly one-third as many tokens

Token-efficiency discussion (the full sentence says the aggregator model "uses roughly one-third as many tokens as the solution models", read once); checked for this phrase

> Because our evaluation datasets are relatively small, we adopt a robust protocol.

Evaluation protocol, as returned by one fetch; not checked (each of the four test sets has 30 problems)

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Table 1, Qwen3-1.7B in thinking mode as solver, accuracy on AIME24 / AIME25 / HMMT24 / HMMT25: pass@1 50.91 / 35.68 / 22.45 / 22.84; majority voting 67.92 / 45.89 / 29.01 / 26.72; best-of-N with AceMath-7B 59.39 / 40.30 / 28.09 / 22.50; weighted majority with AceMath-7B 64.09 / 39.49 / 25.04 / 17.71; prompted aggregation (no training) 63.57 / 44.85 / 29.52 / 27.91; AggLM-1.7B 70.69 / 50.00 / 33.34 / 32.07.

Table 1; checked for the AIME25 column (two fetches agree: 35.68, 45.89, 50.00); the other cells come from one fetch

Table 2, Qwen3-8B solutions, same columns: pass@1 74.17 / 69.27 / 41.61 / 45.99; majority voting 81.61 / 78.70 / 44.58 / 56.35; prompted aggregation 79.90 / 76.73 / 48.58 / 57.63; AggLM-1.7B 82.38 / 79.70 / 53.01 / 60.66.

Table 2; checked for the AIME25 column (78.70 and 79.70, two fetches agree); the other cells come from one fetch. The fetches found no error bars or significance tests.
