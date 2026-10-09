# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> We find a significant (p<0.01) positive correlation (average Pearson r=0.84) between LLM-as-a-judge scores and model similarity (κp) for all judges.

Section 3.2 (9 judges, 39 models, MMLU-Pro); checked

> Model mistakes are becoming more similar with increasing capabilities, pointing to risks from correlated failures.

Section 5.2, Figure 6 (130 models from the Open LLM Leaderboard); not checked (one verbatim fetch; the other fetch gave the same finding in a paraphrase)

> similarity between the weak supervisor and initial strong student inversely correlates with the improvement obtained from weak-to-strong training (r=−0.85)

Section 4.2 (12 model pairs, 15 tasks); checked

> It could undermine benefits from using LM juries by compromising independence and amplifying collective biases.

Discussion; checked for the clause "by compromising independence and amplifying collective biases"

> To establish causality, we need methods to make a model less similar without harming capabilities, which is itself a challenging open problem.

Section 7, limitations; checked for the first clause (the first fetch ended it at "capabilities")

## Added by package P4-independence, retrieved 2026-10-04

Read through the arXiv abstract page (once) and the HTML full text (two fetches with different prompts). The arXiv record lists v1 on 6 Feb 2025, v2 on 12 Jun 2025, the comment "60 pages, 20 figures", and no venue.

> Using CAPA, we first show that LLM-as-a-judge scores favor models similar to the judge, generalizing recent self-preference results.

Abstract; checked (abstract page and HTML agree)

> we observe a concerning trend -- model mistakes are becoming more similar with increasing capabilities, pointing to risks from correlated failures.

Abstract; checked (the two pages differ only in the dash character)

> 130 official models from the OpenLLM Leaderboard

Section 5 (fragment); not checked (one fetch; another fetch gave 130 models in a paraphrase). The page does not say whether proprietary models were included.

> Like much work on benchmarking, we had to limit to MCQ tasks as the science of precisely evaluating free-text is still evolving.

Limitations; not checked (one fetch)

The tasks in the pages as read are general (MMLU-Pro, BBH, AlpacaEval, binary NLP tasks); no code task.
