# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> In comparison, the best-performing LLM (GPT-4o) has an accuracy of 83.5% and 43.4%, respectively.

Abstract (the sentence before it gives the ensemble's 90.2% on HumanEval and 50.2% on LiveCodeBench); not checked (one verbatim read; the Table 1 numbers agree across two reads)

> generate multiple candidate programs from different LLMs and apply a structured voting mechanism to select the most reliable solution

Abstract (fragment); not checked (one verbatim read)

Table data as rendered by the fetch tool (not a sentence quote): GPT-4o 83.5 | 43.4 || EnsLLM (All, 14 models) 90.2 (upper bound 90.9) | 50.2 (53.8) || EnsLLM (Top 5) 87.2 (90.9) | 48.3 (53.8) || EnsLLM (All Free, 9 open-source models) 80.5 (83.2) | 41.6 (44.1) || best free single model on HumanEval: OpenChat 71.3

Table 1 (HumanEval % | LiveCodeBench % on its 511-problem code-generation subset; the numbers in brackets are the upper bound set by candidate availability), as listed by the fetch tool; checked (two reads give the same numbers)

> Since EnsLLM does not generate new program but rather selects the best candidate from multiple LLM outputs, its upper bound performance is inherently constrained by the presence of correct solutions among the generated candidates.

Section 4 (as returned by one read); not checked

> A potential threat to validity in our study is the presence of the solution of the datasets in the pretraining sets of some LLMs.

Threats to validity (fragment; the sentence goes on to say overlap could inflate performance); not checked (one read)

> The one failure occurred when three models (Llama 3.2, Gemma 2, and CodeLlama) produced incorrect programs with similar mistakes, leading EnsLLM to select the wrong output.

Section 5.1 (a failure case on HumanEval); not checked (one verbatim read; another read gave the same case in a paraphrase)

Reading by the fetch tool (a paraphrase, not a quote): one output per model, so no same-model repeated-sampling baseline and no matched-compute comparison; no repeated runs, confidence intervals or significance tests; collecting the 14 outputs took about 94 seconds per problem, with 86 seconds more for CodeBLEU comparisons and 212 seconds for behavioural checks. Not checked.

