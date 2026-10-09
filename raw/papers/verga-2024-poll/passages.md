# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> using a PoLL composed of a larger number of smaller models outperforms a single large judge, exhibits less intra-model bias due to its composition of disjoint model families, and does so while being over seven times less expensive.

Abstract; not checked (one fetch)

> We construct a PoLL from three models being drawn from three disparate model families (Command R, Haiku, and GPT-3.5).

Section 3 (panel composition); not checked (one fetch; an earlier fetch named the same three models in a paraphrase)

> the highest positive delta for each individual model being scored occurs when it is judged by itself.

Section 4.4 (intra-model bias); checked

> running the entire three model PoLL is seven to eight times less expensive than running a single GPT-4 judge.

Section 4.5 (cost); checked

> In this work we investigated only three evaluator settings and a limited number of judges and panel compositions.

Section 5 (limitations); checked

> further work is needed to see how broadly applicable the method is, for example, in math or reasoning evaluations, where language models often struggle.

Section 5 (limitations); checked for the clause shared by both fetches

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Table 1, Cohen's kappa with human judgements on single-hop QA (NQ, TQA, HPQA): EM 0.651, 0.827, 0.662; GPT-4 0.627, 0.841, 0.830; CMD-R 0.734, 0.902, 0.815; Haiku 0.749, 0.894, 0.873; GPT-3.5 0.726, 0.859, 0.833; PoLL 0.763, 0.906, 0.867.

Table 1; checked (two fetches agree on every cell)

Table 2, Chatbot Arena Hard correlation with crowd rankings, Pearson / Kendall tau: GPT-4 0.817 / 0.667; Haiku 0.883 / 0.722; GPT-3.5 0.883 / 0.730; CMD-R 0.817 / 0.676; PoLL 0.917 / 0.778.

Table 2; checked for the GPT-4 and PoLL rows (two fetches agree); the other rows come from one fetch. The fetches found no confidence intervals or standard deviations for these results.

## Added by package P4-independence, retrieved 2026-10-04

Read through the arXiv abstract page (once) and the HTML full text (one fetch).

> using a PoLL composed of a larger number of smaller models outperforms a single large judge, exhibits less intra-model bias due to its composition of disjoint model families, and does so while being over seven times less expensive.

Abstract; checked (abstract page and HTML agree; the abstract page writes "intramodel")

> The GPT-4 judge ranks another GPT-4 variant in position 2, higher than its actual position 4, which is in line with previous works that have also observed GPT-4's preference for its own generations

Section 4.2 (Chatbot Arena Hard); not checked (one fetch)

> Intra-model scoring bias is reduced by pooling judgements across a panel of heterogeneous evaluator models

Introduction, contribution list; not checked (one fetch)

The paper reports no ablation of panel composition (same family against different families) or panel size, as the limitation quoted above says; the datasets are question answering and Chatbot Arena Hard, with no code-generation task.
