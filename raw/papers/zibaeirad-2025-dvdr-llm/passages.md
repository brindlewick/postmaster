# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> DVDR-LLM achieves 10-12% higher detection accuracy compared to the average performance of individual models

Results; checked

> For multi-file vulnerabilities, the ensemble approach demonstrates significant improvements in recall (+18%)

Results (fragment; the first fetch continued "and F1 score (+11.8%) over individual models"); checked

> Multiple LLMs independently assess code with a vulnerability flagged if a majority of models agree.

Method; checked for the words shared by both fetches ("vulnerability flagged if a majority of models agree")

Models in the ensemble, as listed by both fetches: CodeLlama (7B, 34B), Llama3 (8B, 70B), Llama3.1 (8B, 70B), Gemma2 (9B, 27B), Mistral 7B and Mixtral 8x7B; checked (two fetches agree).

The dataset is VulnLLMEval (real Linux-kernel vulnerabilities); neither fetch found its sample counts in the page text. The paper says it compares the ensemble with the average of single models; the fetches found no comparison with repeated runs of one model (absences, not quotes). The two fetches word the false-negative trade-off differently; only the direction is taken from them: fewer false positives in verification tasks, more false negatives in detection tasks.

## Added by package P4-independence, retrieved 2026-10-04

Read through the arXiv abstract page (once) and the HTML full text (one fetch). The arXiv page lists v1 on 14 Dec 2025, no comment field and no journal reference.

> Our evaluation reveals that DVDR-LLM achieves 10-12% higher detection accuracy compared to the average performance of individual models, with benefits increasing as code complexity grows.

Abstract; checked (abstract page and HTML agree word for word)

> reducing false positives in verification tasks while simultaneously increasing false negatives in detection tasks

Abstract (fragment); checked (abstract page and HTML agree)

> For vulnerability detection tasks (SVD1 and SVD3), most individual models outperform the ensemble.

Results; not checked (one fetch)

> The ensemble approach prioritizes model diversity over individual performance, which may limit effectiveness.

Limitations; not checked (one fetch)
