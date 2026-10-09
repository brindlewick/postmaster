# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> the mean failure count drops from 387.44 for single versions to 130.99 for triples

Abstract and results (majority voting over three versions); checked (abstract page and two full-text reads)

> 69 configured [harness, model, language] triples were generated and 48/69 passed all 200 acceptance cases

Setup; checked for the counts (two full-text reads gave 69 and 48)

> Five AI coding agent systems serve as the 'programmers': Cursor, Claude Code, OpenAI Codex, Gemini, and OpenCode

Setup; not checked (one read quoted it; another listed the same five harnesses)

> 429 coincident-failure cases where the independence model predicts 115.36

Results (fragment; one read had "the experiment produces" before it); checked for the fragment

> 158 have defined φ, with 87 at exact φ=1

Results on pairs of versions from different agent systems (907 pairs in all, per one read); checked for the fragment

> does not eliminate highly correlated failure profiles

Results (fragment of "Crossing an agent boundary ... does not eliminate highly correlated failure profiles"; one read had "therefore" in the sentence, the other did not); checked for the fragment

> The experiment is based on a single specification: the LIP problem.

Threats to validity; checked (two full-text reads agree in substance; one quoted this sentence)

Notes from the reads (paraphrase, not quotes): the specification is the Launch Interceptor Program of the Knight-Leveson experiment, with 15 examples; the test oracle is a reference implementation validated by 82 unit tests; 17,296 three-version units were formed from the 48 admitted versions, of which 11,844 showed no failure in the one million inputs; the second read said the paper does not compare voting among versions from one model with voting among versions from different models.

## Passages added by package P2-code-evidence, retrieved 2026-10-04

Reads by this package: abstract through the arXiv listing and full text (HTML v1) read twice with different prompts.

> The results show substantial common-mode failure, along the findings of Knight-Leveson.

Abstract; checked (the abstract listing and a full-text read agree, apart from a dash)

> across majority voting three-version units, the mean failure count drops from 387.44 for single versions to 130.99 for triples, and 11,844 N-version units exhibit zero observed failures

Abstract; checked (the abstract listing and a full-text read agree word for word)

> Our original results is the strongest evidence to date that N-Version Programming with coding agents is a useful engineering strategy.

Abstract (the grammar is the authors'; it is their own claim); not checked (one verbatim read)

Read once, not checked (second read): admissions by agent system, Cursor 6 of 6, Claude Code 13 of 15, Codex 11 of 15, Gemini 8 of 15, OpenCode 10 of 18; by language, Python 18 of 23, Rust 17 of 23, Pascal 13 of 23; a version is admitted only if it passes all 200 acceptance tests.

Read once, not checked (first read): coincident-failure z statistics by language, Python 80.69, Rust 186.93, Pascal 253.30; pairs from the same agent system, 52 with defined phi, 34 of them at phi 1; pairs from different agent systems, 158 with defined phi, 87 at phi 1 (the capture above has the 158 and 87).


## Added by package P4-independence, retrieved 2026-10-04

Read through the arXiv abstract page (once) and the HTML full text (four fetches with different prompts).

> we study whether diversity across agent systems, models, and implementation languages creates diverse failure modes.

Abstract; checked (abstract page and HTML agree)

> The results show substantial common-mode failure, along the findings of Knight-Leveson.

Abstract; not checked (abstract page once)

> Our original results is the strongest evidence to date that N-Version Programming with coding agents is a useful engineering strategy.

Abstract (the authors' own claim, wording as published); not checked (abstract page once)

> the mean failure count drops from 387.44 for single versions to 130.99 for triples, and 11,844 N-version units exhibit zero observed failures.

Abstract; checked (abstract page and HTML agree)

> The observed count is K=429, an excess of K/μ≈3.7× over the independence prediction, yielding z=29.20 with p≈1.765×10−187.

Results, fault independence (pooled 48 versions); not checked as a sentence (one verbatim fetch; another fetch gave 429 cases, a predicted 115.36 and z=29.20)

> Among the 221 same-agent pairs, 52 have defined ϕ, with 34 at exact ϕ=1 and 6 non-positive; among the 907 cross-agent pairs, 158 have defined ϕ, with 87 at exact ϕ=1 and 50 non-positive.

Results, pairwise co-failure; checked (two fetches). "Agent" here means the harness (Cursor, Claude Code, Codex, Gemini, OpenCode), not the model, so a same-agent pair can use two different models.

> Nominal diversity in agent, model, or language does not automatically buy behavioral diversity.

Results or discussion; checked (two fetches)

> Each admitted version corresponds to a single [harness, model, language] tuple; we therefore measure diversity across distinct configurations rather than within-configuration variability due to LLM sampling.

Threats to validity; checked (two fetches). This is the paper's own statement that it has no same-model repeated-run baseline.

> 27 are failure-free, while the worst version fails 10,469 of the 10^6 inputs

Section IV-B; not checked as a sentence (one fetch; another fetch gave 27 failure-free versions and a maximum of 10,469)

> 11,844 triples (68.48%) have zero majority-vote failures, compared with 27 failure-free individual versions (56.25%)

Section IV-E; not checked as a sentence (one fetch; another fetch gave 11,844 triples and 68.48%)

Table III as rendered by the fetch tool (not a sentence quote). Columns: versions, expected coincident-failure cases under independence, observed cases K, z. Python 18, 23.97, 419, 80.69; Rust 17, 4.91, 419, 186.93; Pascal 13, 2.70, 419, 253.30. The z values agree across two fetches; the other columns come from one fetch. Not checked as a table.

Admitted versions per harness as relayed (Figure 3, one fetch, not checked): Cursor 6 of 6, Claude Code 13 of 15, Codex 11 of 15, Gemini 8 of 15, OpenCode 10 of 18; 48 of 69 in all. Model identifiers as the paper's model table lists them (two fetches list the same names; the Claude Code ones carry an "anthropic/" prefix in one): Cursor composer-2.5, composer-2; Claude Code claude-opus-4.6, claude-opus-4.5, claude-sonnet-4.6, claude-sonnet-4.5, claude-haiku-4.5; OpenAI Codex gpt-5.4, gpt-5.4-mini, gpt-5.3-codex, gpt-5.2-codex, gpt-5.2; Gemini gemini-3.1-pro-preview, gemini-3-flash-preview, gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite; OpenCode qwen/qwen3.6-plus, qwen/qwen3.5-flash-02-23, qwen/qwen3.5-plus-02-15, qwen/qwen3.5-397b-a17b, google/gemma-4-26b-a4b-it, google/gemma-4-31b-it. Checked for the names.

> The dominant failure modes are concentrated in LICs #9 and #14, where many agents compute the circumcircle instead of the minimum enclosing circle.

RQ4 answer (causes of faults); not checked (one fetch)
