# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> three- and five-version ensembles realize only 0.43 and 0.44 of the reliability gain achievable under independence, dropping below 0.3 when ensembles are built from the same model.

Abstract; not checked (abstract read once; the full text says the same in other words)

> Overall, these results suggest LLM-generated solutions do not satisfy NVP's failure independence assumption, though heterogeneous models help partially.

Abstract; not checked (abstract read once)

> majority voting increases average reliability from 0.88 to 0.91 when combining five implementations, capturing less than half of the reliability gain that independence would have allowed

Results (two full-text reads agree word for word apart from capitalisation); checked

Table II as read in one full-text fetch (cells are reliability / share of the independence-achievable gain; the column grouping was inferred by the fetch tool): N=3, all ensembles 0.90 / 0.43; model-homogeneous ensembles 0.92 / 0.27; model-heterogeneous 0.90 / 0.44. N=5, all 0.91 / 0.44; model-homogeneous 0.94 / 0.24; model-heterogeneous 0.91 / 0.44. Not checked. An earlier read of the same table gave 0.37 for "same model", which turned out to be the language-homogeneous cell, so the cell labels need checking against the paper before anyone relies on them.

Problem set and models as read (paraphrase, one read): 224 problems selected from the PROBE benchmark (contest-style problems from IBM's Project CodeNet), five languages, twelve models from OpenAI, Google, Anthropic, Alibaba, Mistral and DeepSeek, mostly small or older models (for example GPT-4.1-mini, Gemini-2.0-flash, Claude-3.0-Haiku, Claude-4.5-Haiku), five samples per language and prompting strategy; stated limits include possible training-data overlap and the use of unit tests as the proxy for correctness. Not checked.

## Passages added by package P2-code-evidence, retrieved 2026-10-04

Reads by this package: abstract through the arXiv listing and full text (HTML v1) read twice with different prompts.

> Model choice is the dominant factor: same-model outputs are more similar, more correlated in failure, and yield lower redundancy benefits than cross-model ensembles.

Conclusion; checked (two reads agree word for word)

> Across all implementations, the mean similarity is 2.04, indicating a clear deviation from independence.

Section IV-B (the figure is the mean z-score of co-failure against independence); checked (two reads agree word for word)

> 224 problems across twelve models, five languages, and three prompting strategies

Abstract (fragment); not checked (one verbatim read of the abstract; the full text gives the same counts)

> Notably, even the strongest pair (GPT-4.1-mini/GPT-OSS, 0.97 reliability) does not surpass GPT-OSS alone (0.98), indicating that failure correlation limits the benefit of redundancy.

Results; not checked (one verbatim read; the other read named a different pair, GPT-OSS with Gemini-2.0-flash, but agreed that the best pair does not beat GPT-OSS alone)

> we set apart three basic unit tests and discarded all solutions that did not pass these.

Setup (fragment); not checked (one read). The same read says 40.8% of solutions failed this filter and were discarded.

Numbers read once in the first read (not checked): 65.9% of implementation pairs deviate from independence at alpha 0.05; same-model CodeBLEU similarity 0.76 against 0.55 across models (C++) and 0.88 against 0.67 (Python).


## Added by package P4-independence, retrieved 2026-10-04

Read through the arXiv abstract page (once) and the HTML full text (three fetches with different prompts).

> The same trend appears in behavioral diversity, with implementations from different models showing higher diversity yet still failing on the same tests far more often than expected under independence.

Abstract; checked (abstract page and HTML agree)

> three- and five-version ensembles realize only 0.43 and 0.44 of the reliability gain achievable under independence, dropping below 0.3 when ensembles are built from the same model.

Abstract; checked (abstract page and HTML agree; this settles the "not checked" above)

> Overall, these results suggest LLM-generated solutions do not satisfy NVP's failure independence assumption, though heterogeneous models help partially.

Abstract; checked (abstract page and two HTML reads agree)

> On average, 65.9% of pairs significantly deviate from independence

Results, behavioral correlation (fragment); checked (two fetches)

> The largest improvement comes from combining different models (0.27 vs. 0.44 at N=3; 0.24 vs. 0.44 at N=5)

Results on Table II (fragment); checked (two fetches). It names the model-homogeneous cells, 0.27 and 0.24, which settles the cell-label doubt in the note above for the model rows.

> N-version majority voting yields modest reliability gains, capturing less than half the gain available under independence.

RQ3 answer; not checked (one fetch; the passage above from another read says the same in other words)

> absolute reliability is influenced by the filtering step, which causes strong models to contribute disproportionately many homogeneous combinations, artificially inflating their average reliability.

Results on Table II; not checked (one fetch). It is the paper's explanation of why model-homogeneous ensembles show higher absolute reliability (0.92 at N=3, 0.94 at N=5) than model-heterogeneous ones (0.90, 0.91) while showing lower effectiveness.

> TABLE II: N-version reliability/Redundancy effectiveness

Table II caption; not checked (one fetch). Each cell reads absolute reliability / effectiveness, the share of the gain achievable under independence that is realised.

> Stronger models show larger separation between within- and cross-model similarity and lower similarity with other models, indicating more distinct failure patterns.

Results (similarity analysis); not checked (one fetch)

> we do not evaluate the very largest frontier systems, partly due to cost constraints

Threats to validity (fragment); not checked (one fetch)

> the study focuses on competitive programming tasks, which differ from real-world software.

Threats to validity; not checked (one fetch)
