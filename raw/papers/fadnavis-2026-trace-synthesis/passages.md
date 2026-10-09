# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> A single model with perturbation-induced trace variation outperforms heterogeneous model pools across structured reasoning, PhD-level science, competition mathematics, and competitive programming.

Abstract; checked (abstract page and HTML agree)

> We show this is unnecessarily lossy: an LLM aggregator that reads complete reasoning traces recovers correct solutions even when agents unanimously agree

Abstract; not checked (abstract page only)

> Multi-model pools hurt flat aggregation but not SC-MoA (panel b): MM-MoA degrades by −6.1 pp as weak models enter the pool, while Multi-SC-MoA's anchored pipeline filters weak proposals and keeps improving with pool size

Section 5, "Scaling and robustness" (the sentence ends with a pointer to Appendix E, which could not be read); checked

> (b) MM-MoA degrades with weak models; Multi-SC-MoA filters them.

Figure 6 caption; checked

> All methods use gpt-oss-120b with greedy decoding (temperature 0).

Section 5, setup; checked

> All baselines are compute-equalized at ∼7–11 calls (Appendix): Zero-shot CoT (1 call), SC k=10 (10 calls), MoA (9 calls), Self-MoA (7 calls), and TextGrad (∼10 calls).

Section 5, baselines; checked

> MoA uses N=4 SPUQ paraphrases (2N+1=9 calls), isolating aggregation architecture.

Section 5, baselines; checked (two fetches agree; it sits uneasily with the Table 1 caption below, see the notes)

> GoA reports the GoAMean variant (3-model pool); MoA uses 4 heterogeneous proposers; MoA (para) uses SPUQ paraphrases with a single model.

Table 1 caption (last sentence); not checked (one fetch; an earlier fetch described the MoA baseline as "heterogeneous proposers" in a paraphrase)

> Self-MoA collapses to 64.1%—below zero-shot (66.7%)—illustrating the unanchored debate martingale.

Section 5, GPQA results; checked (three fetches agree)

> Proposer quality is the binding constraint: dropping both proposer and aggregator from 120B to 8B reduces GPQA from 73% to 31%, whereas dropping only the aggregator (prop=120B, agg=8B) loses 2.5 pp on QA

Section 5, "Scaling and robustness"; not checked (another fetch returned a shortened version)

> Perturbation-diverse and i.i.d. proposals yield nearly identical ρ¯: 0.633 vs. 0.603 on GPQA-Diamond, 0.571 vs. 0.607 on LCB-Hard, with fully overlapping 95% confidence intervals

Section 3, "Beyond the voting ceiling"; not checked (one fetch)

> Non-significant comparisons concentrate on GPQA (n=198) and LCB-Hard (n=171), where power is limited by sample size

Appendix G, as returned by one fetch; not checked

> On LCB-Hard, test-pass clustering is unfaithful—48.3% of unanimous clusters mask hidden-test divergence

Section 5, "Aggregation safety" (code task: LiveCodeBench-Hard); not checked

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Table 1, "gpt-oss-120b, N=5, k=2, 11 calls"; columns BBH-3 (296 problems), MMLU-ML (112), GPQA (198), AIME (90), LCB-Hard (171, code):
Zero-shot CoT 32.8, 83.9, 66.7, 70.0, 42.1.
SC (k=10) 80.4, 90.2, 70.7, 85.6, 57.3.
MoA 69.9, 85.7, 67.7, 87.8, 57.3.
MoA (para) 68.2, 86.6, 65.2, 73.3, 50.9.
Self-MoA 67.6, 85.7, 64.1, 90.0, 57.3.
TextGrad 83.8, 90.2, 69.7, 85.6, 52.0.
GoA 82.8, 89.3, 72.7, 77.8, 24.6.
SC-MoA 86.5, 92.0, 73.2, 91.1, 62.6.

Table 1; checked (two fetches agree on every cell)
