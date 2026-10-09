# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> We present a systematic evaluation of five large language models on automated code review, comparing Claude Sonnet 4.6, Claude Haiku 4.5, GPT-5.4 mini, Minimax M2.7, and GLM-5 Turbo across 150 code review samples

Abstract; not checked (one fetch)

> 100 synthetic mutation-injected bugs and 50 real bug-fix pull requests mined from eight major open-source repositories.

Abstract; not checked (one fetch)

> on real PRs alone, the best model achieves F1 = 0.066, compared to F1 = 0.847 on synthetic samples, a 92% degradation

Abstract; not checked (one fetch)

> Table 9: Ensemble: union of findings from Haiku + one other model (n=150). Union means: a finding is kept if _either_ model flagged it.

Section 4, Table 9 caption (underscores are the page's emphasis marks); checked

> Ensembles _hurt_ F1. The models largely detect the _same_ bugs; adding a second model introduces its false positives without meaningfully increasing true positives.

Section 4, discussion of Table 9; checked

> For 55 of 150 samples, all five models found something (overlap); for 19 samples, _no_ model found anything (shared blind spot).

Section 4, overlap analysis; checked

> Model diversity does not address the fundamental capability gap.

Section 4, conclusion of the ensemble discussion; not checked (one fetch)

## Table data (values as rendered by the fetch tool; not a sentence quote)

Table 9, n = 150, columns F1, precision, recall: Haiku alone 0.365, 0.486, 0.293; Haiku union Sonnet 0.333, 0.627, 0.226; Haiku union GPT-5.4 mini 0.331, 0.634, 0.223; Haiku union Minimax 0.325, 0.664, 0.215; Haiku union GLM 0.304, 0.694, 0.195.

Table 9; checked (two fetches agree on every cell). Note by the reader: recall falls in every union row and precision rises, which does not follow from a union of findings, and does not match the sentence "adding a second model introduces its false positives".

Per the fetches (paraphrase, not a quote): all findings were judged by Claude Opus 4.6 with a structured rubric, and the authors list judge bias (one judge for all models, including the same vendor's) among six limitations, together with auto-extracted ground truth for the real pull requests, one prompt, and a sample too small for small differences. One fetch each for the judge and the limitations.
