# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> For each pair, we ask ChatGPT to judge the better candidate (or declare a tie).

Section 2.2 (how the comparison labels and the oracle are made); checked

> LLM-Blender significantly outperform individual LLMs and baseline methods across various metrics, establishing a substantial performance gap.

Abstract or introduction, as returned by one fetch; not checked

> To get optimal performance from PairRanker, one may need to call model O(n²) times

Limitations; not checked (one fetch; a second fetch described the same limitation in a paraphrase)

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Main results on MixInstruct (5,000-example test split; 11 open-source models), columns BERTScore, BARTScore, BLEURT, GPT-Rank (lower is better), win share against Vicuna, win share against Open Assistant, top-3 share:
Open Assistant 74.68, -3.45, -0.39, 3.90, 62.78, n/a, 51.98.
Vicuna 69.60, -3.44, -0.61, 4.13, n/a, 64.77, 52.88.
Random 66.36, -3.76, -0.77, 6.14, 37.75, 36.91, 29.05.
Oracle (GPT-Rank) 70.32, -3.33, -0.51, 1.00, 100.00, 100.00, 100.00.
PairRanker 72.97, -3.14, -0.37, 3.20, 54.76, 57.79, 65.12.
LLM-Blender (PairRanker plus GenFuser) 79.09, -3.02, -0.17, 3.01, 70.73, 77.72, 68.59.

Main results table; checked (two fetches agree on every GPT-Rank value; the other columns come from one fetch)

Dataset and models: 100k training and 5k validation examples, N=11 open-source LLMs; GenFuser fuses the top K=3 candidates and is a fine-tuned Flan-T5-XL (3B); the paper reports no repeated runs or standard deviations.

Sections 2 and 4; not checked (one fetch each)
