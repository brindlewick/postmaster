# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Surprisingly, our findings reveal that MAD often fail to outperform simple single-agent baselines such as Chain-of-Thought and Self-Consistency, even when consuming significantly more inference-time computation.

Abstract; checked (two fetches of the v3 page agree)

> To advance MAD research, we further explore the role of model heterogeneity and find it as a universal antidote to consistently improve current MAD frameworks.

Abstract; checked (the first fetch returned the phrase "a universal antidote to consistently improve current MAD frameworks")

> This paper presents a systematic evaluation of 5 representative MAD methods across 9 benchmarks using 4 foundational models.

Abstract; checked

## Added by package P4-independence, retrieved 2026-10-04

The HTML pages return only the abstract, so the arXiv PDF was read as text converted by a public text-conversion service called through the fetch tool, over two fetches. The passages below come from that text.

The nine benchmarks as listed in Table 1 (names only, citations dropped): MMLU, MMLU-Pro, AGIEval, CommensenseQA, ARC-Challenge, GSM8K, MATH, HumanEval, MBPP. HumanEval and MBPP are the code-generation benchmarks; the rest are general.

Table 1; checked for the nine names (two fetches agree, in a different order)

> gpt-4o-mini-2024-07-18, claude-3-5-haiku-2024-1022, Llama3.1:8b-instruct, and Llama3.1:70b-instruct

Section 3.1 (the four foundation models); not checked (one fetch)

> by incorporating model heterogeneity, Heter-SoM improves SoM-average (the average performance achieved by SoM when utilizing the two candidate models separately) by 6.4%

Section 4.2 (model heterogeneity); not checked as a quote (one fetch gave this sentence, the other the same figures in a summary). The baseline is the average of the two single-model runs, not the better of the two; the text retrieved does not say whether the mixture beats the better one.

> Every time that an agent generates an output, the agent queries a foundation model i (where i ∈ { 1, ..., n }) with probability pi from a pool of candidate models.

Section 4.1 (how heterogeneous debate is set up; one fetch says the mixture is gpt-4o-mini and Llama3.1-70b with probability 0.5 each); not checked

> Table 4: Performance results of Heter-MAD. CoT-Average represents the average performance achieved by these two models with CoT reasoning.

Table 4 caption; not checked (one fetch)

> SoM, EoT, ChatEval, and AgentVerse only outperformed CoT in approximately 15% cases, while MP did not demonstrate significant improvement over CoT.

Section 3.2; not checked (one fetch)

As relayed by one fetch (not checked): the main results do not compare heterogeneous debate with self-consistency at equal numbers of calls, and the paper has no formal limitations section.

As relayed by one fetch of the PDF text (not a sentence quote, not checked): Heter-EoT improves EoT-average by 8.2%, and Heter-SoM outperforms CoT-Average by 5.8%.

Section 4.2 and Table 4
