# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> we propose Trae Agent, the first agent-based ensemble reasoning approach for repository-level issue resolution.

Abstract (a claim by the authors); checked (abstract page and a full-text read give the same sentence in the abstract)

> We conduct extensive experiments using three leading LLMs on the widely-adopted SWE-bench benchmark, comparing Trae Agent against four state-of-the-art ensemble reasoning techniques.

Abstract; checked (abstract page read)

> Table 1: Effectiveness comparison in terms of Pass@1 (↑).

Section 4 results, Table 1 caption (first sentence); checked (two reads agree)

> The ensemble size N is set to 3.

Table 1 caption (second sentence); not checked (one read gave the sentence, one read gave "N=3" as a paraphrase)

Table 1 rows relevant here (SWE-bench Verified, 500 issues, N = 3, Pass@1; columns Gemini 2.5 Pro, Claude 3.7 Sonnet, GPT-4.1, Mixture); checked (two reads give the same numbers):

> Oracle | 66.20% | 70.00% | 63.00% | 73.40%
> Trae Agent | 62.27%±0.12% | 66.40%±0.20% | 59.00%±0.20% | 65.67%±0.23%
> Augment | 55.40%±0.60% | 63.13%±0.31% | 54.87%±0.92% | 58.93%±0.23%
> DeiBase | 53.53%±0.23% | 62.33%±0.42% | 53.13%±0.12% | 55.87%±0.76%

Table 1 (rows reproduced as printed; "Oracle" is the best case in which the correct patch is chosen whenever one of the N candidates is correct); checked

> a coder agent to generate diverse candidate patches in parallel

Method section, candidate generation (fragment present in two reads); checked

> Additionally, we introduce a Mixture setting, where the three LLMs generate patches in a round-robin manner to further enhance the diversity of the candidate patches.

Introduction or setup (one read; other reads worded it slightly differently); not checked

> Gemini 2.5 Pro (version gemini-2.5-pro-preview-06-05), Claude 3.7 Sonnet (version claude-3-7-sonnet-20250219), and GPT-4.1

Experimental setup (the version string of GPT-4.1 was given in one read as gpt-4.1-2025-04-14); checked for the portion shown

> each experiment is repeated three times

Experimental setup; checked (one read quoted it, another gave "three repetitions")

> the FP rate is 33.04%, while the FN rate accounts for only 3.69%

Regression-test analysis (the two figures agree across two reads; the wording differed); not checked

> Trae Agent has achieved first place on the SWE-bench Verified leaderboard, with a notable Pass@1 score of 75.20%.

Abstract (the text read does not say which model combination produced 75.20%); checked

## Passages added by package P2-code-evidence, retrieved 2026-10-04

Reads by this package: HTML v1 read twice through a fetch tool with different prompts, plus the abstract through the arXiv listing.

> Experimental results demonstrate that Trae Agent consistently achieves superior performance, with an average improvement of 10.22% over all baselines in terms of Pass@1.

Abstract; checked (the abstract listing and a full-text read agree word for word)

> Trae Agent has achieved first place on the SWE-bench Verified leaderboard, with a notable Pass@1 score of 75.20%.

Abstract; checked (the abstract listing and a full-text read agree word for word). The text read does not say which models or what ensemble size gave 75.20%.

Table 1 rows not listed above (columns Gemini 2.5 Pro, Claude 3.7 Sonnet, GPT-4.1, Mixture); checked (two reads give the same numbers):

> Average | 53.40% | 61.33% | 51.40% | 56.33%
> Adversary | 39.60% | 50.60% | 38.80% | 38.00%
> Augment w/ Pruning | 59.27%±0.31% | 64.33%±0.42% | 56.60%±0.53% | 61.07%±0.31%
> DeiBase w/ Pruning | 57.33%±0.12% | 63.87%±0.31% | 56.00%±0.35% | 58.07%±1.01%

Table 1 (the first read printed these rows without the standard deviations). "Average" and "Adversary" are labels as printed; no sentence defining them was kept.

Table 2 (ablations, Pass@1, same four columns), rows as printed, labels in brackets are glosses of the printed suffixes; checked (two reads give the same numbers):

> Trae Agent_woP [no pruning] | 58.40% | 63.60% | 56.20% | 61.80%
> Trae Agent_woM [no majority voting] | 59.60% | 63.60% | 57.40% | 62.60%
> Trae Agent_A [Augment selector] | 59.80% | 64.60% | 57.20% | 61.80%

> Claude 3.7 Sonnet demonstrated the best performance; therefore, for consistency and fair comparison, we adopt Claude 3.7 Sonnet as the base model for all ensemble reasoning techniques.

Section 4 (experimental setup); not checked (one read verbatim, another a paraphrase)

> To further mitigate the impact of randomness, each experiment is repeated three times.

Section 4; not checked (one read verbatim, another "repeated 3 times")

