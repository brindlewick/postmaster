# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Our extensive experiments reveal that, surprisingly, Self-MoA outperforms standard MoA that mixes different LLMs in a large number of scenarios: Self-MoA achieves 6.6% improvement over MoA on the AlpacaEval 2.0 benchmark

Abstract; not checked (only the clause "Self-MoA outperforms standard MoA that mixes different LLMs in a large number of scenarios" was repeated word for word by another fetch; the rest is from the abstract page alone)

> MoA performance is rather sensitive to the quality, and mixing different LLMs often lowers the average quality of the models.

Abstract (the abstract page has "We confirm that the" in front); checked

> We propose Self-MoA -- an ensemble method that aggregates outputs from only the single top-performing LLM.

Abstract; not checked (one fetch)

> Each model is sampled with a temperature of 0.7, following the default in (Wang et al., 2024a).

Section 3.1; checked (the first fetch returned the first clause, the second the full sentence)

> We note that this experiment is similar to the "single-proposer" setting in Wang et al. (2024a), however our reproduced result is different.

Section 3.2 (Table 1 discussion); not checked (the first fetch returned the same clause without "We note that" and with different citation formatting)

> From Table 6, we observe that Mixed-MoA indeed outperforms Self-MoA of dddddd.

Section 4.2; not checked

> Even when the performance of two individual models is close, Self-MoA—utilizing six Llama-3.1-8B-Instruct proposers—still outperforms the Mixed-MoA configuration.

Section 4.2; not checked

> MoA is quite sensitive to variations in quality, with optimal performance typically occurring in regions characterized by high quality and relatively low diversity.

Section 4; not checked

> Aggregator Qwen2-7B-Instruct is relatively weak on MATH compared to the strongest individual model, Qwen2-Math-7B-Instruct. This limitation constrains the performance of MoA

Section 4.1, as returned by one fetch; not checked

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Table 1, AlpacaEval 2.0 length-controlled win rate, Qwen1.5-110B-Chat as aggregator, 2 layers, 6 proposer samples: Individual WizardLM-2-8x22B 53.1; Individual Qwen1.5-110B-Chat 43.9; Mixed-MoA (2-Layer MoA, six different models) 59.1; Self-MoA (2-Layer, six WizardLM-2-8x22B samples) 65.7.

Table 1; checked (three fetches agree)

Table 3 (task-specific small models; average of MMLU-redux, CRUX, MATH): Qwen2-7B-Instruct 52.07; DeepSeek-Coder 54.74; Qwen2-Math 50.60; best Mixed-MoA 60.04; Self-MoA TaskBest 63.81 (MMLU 69.01, CRUX 52.62, MATH 69.80).

Table 3; checked (two fetches agree; 63.81 is the mean of the three task scores)

Table 6, mixing two models of similar quality: mmmddd 60.04; mmdddd 59.86; Self-MoA of dddddd 59.69 (margins 0.35 and 0.17 points).

Table 6; checked (three fetches agree on the numbers; the meaning of the letters was not verified)

Regression of MoA performance on quality and diversity (Section 4.1): quality coefficient 2.558 to 4.719, diversity coefficient 1.421 to 2.839 across MMLU, CRUX and MATH, R-squared 0.685 to 0.771, "around 70 data points" from "over 200 experiments".

Section 4.1; not checked (one fetch)

## Added by package P4-independence, retrieved 2026-10-04

Read through the arXiv abstract page (once) and the HTML full text (one fetch).

> Self-MoA outperforms standard MoA that mixes different LLMs in a large number of scenarios: Self-MoA achieves 6.6% improvement over MoA on the AlpacaEval 2.0 benchmark, and an average of 3.8% improvement across various benchmarks, including MMLU, CRUX, and MATH.

Abstract; checked (abstract page and HTML agree word for word)

CRUX as described in the page (not a sentence quote): 800 Python code functions, a code-reasoning task rather than code generation; the other benchmarks are general (AlpacaEval 2.0, MMLU-redux, MATH, MT-Bench). One fetch; not checked.

Aggregator as relayed by the fetch tool (a reading of the set-up, not a quote): in the main AlpacaEval runs Qwen1.5-110B-Chat is the aggregator and is also among the proposer candidates; in Table 3 Qwen2-7B-Instruct is the aggregator and also a proposer. One fetch; not checked.

> To complement the study, we identify the scenarios where mixing different LLMs could be helpful.

Abstract; not checked (abstract page once)
