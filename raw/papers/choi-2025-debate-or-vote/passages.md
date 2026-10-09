# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Majority Voting alone accounts for most of the performance gains typically attributed to MAD

Abstract; checked (both fetches)

> in most cases, majority voting performs on par with MAD.

Section 3.2; checked (the second fetch has "Notably," in front)

> distinct personas, as shown in Table 4.

Section 6 (heterogeneous agents, as returned by one fetch); not checked

> Second, we focus primarily on relatively small-scale settings with 5 agents; scaling properties to larger agent populations remain unexplored.

Appendix H, limitations; not checked (one verbatim fetch; the other fetch noted that heterogeneous analysis is limited)

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Table 1, Qwen2.5-7B-Instruct, accuracy averaged over seven benchmarks (Arithmetics, GSM8K, MMLU professional medicine, MMLU formal logic, HellaSwag, CommonsenseQA, HH-RLHF): single-agent baseline 0.7205; decentralized MAD with 2, 3 and 5 rounds 0.7377, 0.7112, 0.7050; majority voting 0.7691. Llama3.1-8B-Instruct: single-agent 0.6203; MAD with 2, 3 and 5 rounds 0.6929, 0.6788, 0.6761; majority voting 0.7242.

Table 1; checked for the Qwen2.5-7B-Instruct averages (two fetches agree); the Llama3.1-8B rows come from one fetch. Settings: 5 agents, temperature 1.0; single-agent baselines averaged over 5 runs; the debate and voting cells carry no spread; debate uses more calls than voting and the paper does not equalize them.
