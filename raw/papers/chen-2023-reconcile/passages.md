# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> For fair comparison, we implement SC with the same average number of LLM calls as in ReConcile.

Section 5 (baselines); not checked (the two fetches differ by one word: "for a fair comparison" against "for fair comparison")

> Responses from different models exhibit the highest diversity (yielding the lowest similarity score of 0.8739)

Section 6.2; checked (the first fetch continued "and also the highest accuracy (79.0%)")

> we lack complete knowledge of the data that these models have been exposed to, and their scales in terms of parameters

Limitations; not checked (the two fetches differ by one word, "that")

> We experiment with a subset of 100 samples...we conduct at least three runs.

Section 5 (setup; the ellipsis is in the fetched text); not checked

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Table 2, accuracy ± spread over runs, columns StrategyQA, CSQA, GSM8K, AQuA, Date:
Zero-shot CoT ChatGPT (gpt-3.5-turbo-0613) 67.3±3.6, 66.0±1.8, 73.7±3.1, 44.7±0.5, 67.7±1.2.
Zero-shot CoT Bard (chat-bison-001) 69.3±4.4, 56.8±2.7, 58.7±2.6, 33.7±1.2, 50.2±2.2.
Zero-shot CoT Claude2 73.7±3.1, 66.7±2.1, 79.3±3.6, 60.3±1.2, 78.7±2.1.
Self-Consistency (ChatGPT) 73.3±0.5, 73.0±0.8, 82.7±0.5, 60.3±1.2, 69.3±0.4.
Debate (ChatGPT x3) 66.7±3.1, 62.7±1.2, 83.0±2.2, 65.3±3.1, 68.0±1.6.
ReConcile (ChatGPT, Bard, Claude2) 79.0±1.6, 74.7±0.4, 85.3±2.2, 66.0±0.8, 86.7±1.2.

Table 2; checked for the StrategyQA column (two fetches agree); the other columns come from one fetch

Table 5, StrategyQA: ChatGPT paraphrased 72.2 (response similarity 0.9398); ChatGPT x3 72.2 (0.9102); ChatGPT, Bard, Claude2 79.0 (0.8739). Table 3: GPT-4 zero-shot 75.6; ReConcile (GPT-4, Bard, Claude2) 87.7; ReConcile (ChatGPT, Claude2, LLaMA-2-70B) 78.0.

Tables 5 and 3; checked for the 72.2, 79.0, 87.7 and 75.6 cells (two fetches agree); the rest from one fetch
