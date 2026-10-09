# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Multi-agent debating systems, in their current form, do not reliably outperform other proposed prompting strategies, such as self-consistency and ensembling using multiple reasoning paths.

Abstract; checked (the first fetch returned the same sentence cut off after "ensembling")

> We utilize API calls to a publicly available LLM which, whilst sufficient in the context of our investigation, exposes us to variable inference time calls and unforeseen model updates

Limitations; checked

> MAD typically requires a higher number of API calls, increasing the number of tokens to produce and process and ultimately, the total running cost of the system

Section 4 (conclusion); not checked (one fetch)

> hyperparameter settings can be effectively transferred to GPT-4. However, this transferability does not extend well to Mixtral

Section 3; checked (the second fetch gave the same two sentences, ending with "Mixtral 8x7B")

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Table 2, best accuracy per system, gpt-3.5-turbo, columns MedQA, PubMedQA, MMLU, CosmosQA, CIAR, GPQA, Chess:
Medprompt 0.65, 0.77, 0.74, 0.48, 0.54, 0.27, 0.32.
Society of Mind 0.64, 0.74, 0.73, 0.44, 0.56, 0.27, 0.26.
Ensemble Refinement 0.64, 0.74, 0.76, 0.45, 0.48, 0.32, 0.32.
ChatEval 0.60, 0.75, 0.71, 0.45, 0.48, 0.26, 0.32.
Self-Consistency 0.60, 0.74, 0.78, 0.46, 0.56, 0.24, 0.27.
Single Agent 0.60, 0.75, 0.76, 0.45, 0.50, 0.33, 0.27.
Multi-Persona 0.58, 0.70, 0.72, 0.46, 0.52, 0.29, 0.33.

Table 2; checked for the MedQA column (both fetches); the other columns come from one fetch. The paper reports the best result of a hyperparameter search per system, without equal-call control and without run-to-run spread in this table; the fetches found no use of different models as different debaters.
