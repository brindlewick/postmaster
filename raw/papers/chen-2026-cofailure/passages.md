# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> For any policy whose output is one member model answer, accuracy cannot exceed one minus beta, where beta is the rate at which every model is wrong on the same query.

Abstract; checked (two fetches of the abstract page agree)

> At matched quality, low-rho heterogeneous ensembles beat high-rho Self-MoA, but on checkable tasks in our pool, combining models rarely beats the single best model without a strong query-level routing signal.

Abstract; not checked (the first fetch of the abstract page cut the abstract short)

> Gains come from models failing on different questions, not from adding more models.

Abstract, last sentence; not checked

> The equal-quality assumption is empirically load-bearing (naive heterogeneous voting hurts)

Limitations; checked (two fetches agree)

> mixing unequal-quality models lets diverse-but-weaker members outvote a strong one

Voting results, as returned by two fetches; checked

> the mean vote gain is negative (−0.10 hard, −0.02 saturated, robust across the jackknife)

Voting over all 455 three-model triplets; not checked (an earlier fetch gave the same numbers in a paraphrase)

> the low-correlation heterogeneous ensemble beats Self-MoA at k=3. Across 60 resamplings of the sample-to-split partition the gain averages +0.027

Introduction or results; not checked (an earlier fetch gave the same numbers: range +0.010 to +0.050, positive in all 60)

> On the higher-correlation MATH-500 regime (ρinter=0.59) it falls to +0.020 (not significant)

Results; not checked (one fetch; "it" is the matched-quality gain over Self-MoA)

> The matched-quality test rests on one provider-matched band; an alternative aggregation pipeline gives a smaller, non-significant gain.

Limitations; checked (two fetches agree)

> an LLM-as-router (GPT-5-mini shown each query and a capsule of every model's strengths, asked to pick the best) routes to single-best on 100% of queries

Routing results; checked (two fetches agree; the rest of the sentence says it "captures exactly 0" of the oracle gain)

> on open-ended tasks the best models increasingly fail alike, so the lever is failure-mode dispersion and market churn, not peak capability or model count

Conclusion; checked (two fetches agree)

> execution-graded competitive programming (code_contests: 63 hard problems, rating 1900–3500

Code result (reported separately); not checked

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Single-best, oracle, all-wrong rate beta, by pool: 15-model mix 0.923, 0.967, 0.033; MMLU-Pro hard (15 models) 0.850, 0.970, 0.030; MATH-500 (67 models) 0.836, 0.948, 0.052 (17 queries all wrong); GPQA-Diamond (52 models) 0.846, 1.000, about 0; code_contests (18 models, code) 0.825, 0.921, 0.079 (5 of 63).

Results table; checked (two fetches agree)

Router: a held-out TF-IDF plus domain logistic router 0.906 against single-best 0.901 on the 15-model mix.

Routing results; not checked (one verbatim fetch, one paraphrase, numbers agree)

Matched-quality test: Self-MoA means nine distinct draws from the single best model (within-model error correlation 0.80); the heterogeneous arm is a 6-model band with accuracies 0.74 to 0.865 (between-model correlation 0.42); "information-fair" comparison k=3.

Results; not checked (two fetches agree on the numbers in a paraphrase, one fetch verbatim)

## Added by package P4-independence, retrieved 2026-10-04

Read as HTML full text over two fetches with different prompts (the abstract in full, then targeted quotes). The page names the author's affiliation and no venue; it is a preprint.

> At matched quality, a diverse low-ρ ensemble beats a high-ρ Self-MoA one.

Abstract; checked (two fetches)

> On our pool, and on tasks where answers can be checked, combining models rarely beats the single best model without a strong query-level routing signal

Abstract (fragment); checked (two fetches)

> recurring on execution-graded code (β=0.079)

Abstract (fragment); checked (two fetches). Appendix F figures, which agree in both fetches: code_contests, 18 models, 63 problems, single-best 0.825, oracle 0.921, all-wrong rate 0.079 (5 of 63 problems, interval 0.026 to 0.176).

> Within-family ρ exceeds cross-family in both regimes, with a larger gap on the multi-domain mix (0.069 vs 0.022): family specialization shows most across domains

Table 1 and its discussion (fragment; the first fetch continued ", consistent with the shared-provider correlation"); checked (two fetches). Table 1 values: within-family ρ 0.528 (saturated mix) and 0.402 (hard MMLU-Pro); cross-family ρ 0.459 and 0.380.

> mixing unequal-quality models lets diverse-but-weaker members outvote a strong one

Voting results (fragment); checked (two fetches). The mean vote gain is given as -0.10 on the hard pool and -0.02 on the saturated pool.

> supported in one regime, not established

Section 7 (the author's own verdict on the matched-quality result; fragment); checked (two fetches)

> the code magnitude still rests on k=5 events under a strict-but-not-official judge on an 18-model pool, so the point ratio carries real uncertainty.

Section 7 (limitations; one fetch); not checked
