# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> One limitation of self-consistency is that it incurs more computation cost.

Conclusion; checked

> Self-consistency boosts the performance of chain-of-thought prompting with a striking margin on a range of popular arithmetic and commonsense reasoning benchmarks, including GSM8K (+17.9%), SVAMP (+11.0%), AQuA (+12.2%), StrategyQA (+6.4%) and ARC-challenge (+3.9%).

Abstract; not checked (one fetch; the other fetch gave PaLM-540B gains of +17.9, +7.6, +12.5, +6.3 and +3.5 points for the same five tasks, so the abstract's figures appear to be for a different model)

> We report the results of self-consistency averaged over 10 runs, where we sampled 40 outputs independently from the decoder in each run.

Section 3 (setup); not checked (the other fetch gave "40 sampled outputs per run, averaged over 10 runs" in a paraphrase)

> Note this is a typical ensemble approach (averaging over the predictions over multiple models) and it achieves a performance significantly worse than self-consistency (self-consistency over PaLM-540B gets an accuracy of 74.4%).

Appendix, explanation of Table 10; not checked (one fetch)

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Table 10, "Comparison of GSM8K accuracy over multiple-model ensembles": single model PaLM-540B greedy 56.5, self-consistency 74.4; ensemble LaMDA-137B plus PaLM-540B 36.9 ± 0.5; ensemble PaLM-540B plus GPT-3 (code-davinci-001) 36.6 ± 0.4.

Table 10; checked for the 36.9, 56.5 and 74.4 cells (two fetches agree); the 36.6 cell and the caption come from one fetch
