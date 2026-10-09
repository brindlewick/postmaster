# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> We evaluate our method on complex coding and engineering tasks using frontier models.

Abstract (latest version); not checked (one fetch)

> The models were instructed to generate the transformation rule as Python code

Appendix D.2.1 (ARC-AGI-2 experiment; the fetched text ends mid-sentence after this); not checked

> we evaluated our approach on the 120 problems comprising the public evaluation set of ARC-AGI-2

Appendix D (multi-LLM AB-MCTS); not checked (one fetch; the page text stops before the results)

> For each problem, the generation budget was set to 250.

Appendix D.2.1; not checked

> Our approach assumes the existence of a reliable score evaluator, but developing such an evaluator itself can be challenging depending on the task.

Conclusion; not checked (one fetch)

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Code results at a 128-call budget, GPT-4o and DeepSeek-V3 only (one fetch, possibly an earlier version's table): LiveCodeBench AB-MCTS-A 39.1 ± 1.9 and 42.5 ± 1.5 against repeated sampling 37.8 ± 0.5 and 40.7 ± 1.9; CodeContest AB-MCTS-M 40.6 ± 1.0 and 44.6 ± 0.9 against repeated sampling 37.9 ± 0.3 and 43.2 ± 0.9; ARC-AGI (original, Pass@2) repeated sampling 15.0 ± 1.0 and 18.6 ± 1.0 against AB-MCTS-A 14.0 ± 2.1 and 16.6 ± 0.6.

Table 1 as returned by one fetch (code tasks, reported separately); not checked

## Added by the package on closest tools, retrieved 2026-10-04

Read from the arXiv abstract page (one fetch), listing the versions and the venue status:

> Accepted as a spotlight at NeurIPS 2025

Abstract page, comments line as summarised by the fetch tool (the fetch tool returned a summary, not the line itself); not checked

Version list as read from the abstract page: v1 2025-03-06, v2 2025-06-12, v3 2025-06-27, v4 2025-10-24, v5 2025-11-07.

> Empirical results show that AB-MCTS consistently outperforms both repeated sampling and standard MCTS

Abstract (fragment); not checked (one read)

## Passages added by package P2-code-evidence, retrieved 2026-10-04

Reads by this package: HTML v5 and v4 (one read each; both texts stopped before the results of Appendix D) and the abstract page.

> Although repeated sampling (i.e., generating multiple candidate outputs) is a highly effective strategy, it does not leverage external feedback signals for refinement, which are often available in tasks like coding.

Abstract; not checked (one verbatim read of the abstract page)

> In LiveCodeBench, we only use problems released between August and November 2024, aligning with the previous work to prevent data contamination.

Experiments; not checked (one read)

> Under the same computational budget, AB-MCTS achieved better results than previous approaches.

Experiments (fragment as returned by one read); not checked. The same read gave a generation budget of 2^7 = 128 calls for the main experiments and 3 to 5 runs per condition (LiveCodeBench 5, CodeContest 3, ARC-AGI 3, MLE-Bench 1).

Table 1 as read in the v5 fetch (code tasks, single LLM, 128-call budget; mean ± standard deviation; repeated sampling / standard MCTS / AB-MCTS variants); not checked (one read; it agrees with the table summary above on the cells that overlap): LiveCodeBench GPT-4o 37.8±0.5 / 36.7±1.0 / 38.7 to 39.1; DeepSeek-V3 40.7±1.9 / 43.2±2.1 / 42.3 to 43.0; CodeContest GPT-4o 37.9±0.3 / 37.5±0.0 / 40.2 to 40.6; DeepSeek-V3 43.2±0.9 / 43.8±0.9 / 43.4 to 44.8; ARC-AGI (first release) repeated sampling ranks first for both models.

