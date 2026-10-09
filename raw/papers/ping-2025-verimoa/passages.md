# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> Comprehensive experiments on VerilogEval 2.0 and RTLLM 2.0 benchmarks demonstrate that VeriMoA achieves 15–30% improvements in Pass@1

Abstract (fragment; the sentence continues); not checked (one verbatim read)

> a multi-path generation strategy that leverages C++ and Python as intermediate representations

Abstract (fragment); not checked (one verbatim read)

> Two-Path (C++ + Python) achieves 64.52% Pass@1 on VerilogEval 2.0 and 57.89% on RTLLM 2.0, while Two-Path Python achieves 59.47% and 53.22% respectively.

Section 6.3 (GPT-4o-mini); checked for the numbers (two reads give the same figures; the sentence is from one read)

> Golden testbench | VerilogEval 2.0 P@1 72.43% | P@3 76.94% | P@5 79.46% | RTLLM 2.0 P@1 64.23% | P@3 67.45% | P@5 68.67% || LLM-generated testbench | 67.84% | 73.57% | 76.63% | 60.51% | 63.87% | 65.74%

Table 5, as listed by the fetch tool; checked (two reads agree on the size of the drop, 2.83 to 4.59 points)

> VeriMoA performance with golden vs. LLM-generated testbenches using GPT-4o-mini.

Table 5 caption; not checked (one read, the third)

> testbenches are used only in quality evaluation and optional self-refinement

Section introducing Table 5 (fragment; the sentence goes on "(contributing merely ∼2% improvement)"); not checked (one read, the third)

Reading of the method by the fetch tool (a paraphrase, not a quote): the quality evaluator scores each candidate by simulation against a testbench (Algorithm 1); the second read took that testbench to be the benchmark's golden one. The third read found no sentence in the setup that says which testbench the main results use, none on access to the evaluation testbench during generation, and none on testbench availability in practice. The caption of Table 5, which compares golden with LLM-generated testbenches, implies the main results use golden ones. The aggregator and the proposers are the same LLM within a configuration; the "Mixed-MoA" versus "Self-MoA" contrast is mentioned from earlier work but the experiments use one LLM backbone per run; no confidence intervals. Not checked.

