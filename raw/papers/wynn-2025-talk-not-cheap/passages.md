# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> debate can lead to a decrease in accuracy over time — even in settings where stronger (i.e., more capable) models outnumber their weaker counterparts.

Abstract; not checked (one verbatim fetch)

> introducing a weak or less capable (lower-performing) LLM agent into a debate with a strong or more capable (higher-performing) agent can detrimentally affect the debate outcome, producing results worse than if the agents had not engaged in discussion.

Introduction; not checked (the other fetch gave the first half without "(higher-performing)")

> We take 100 random samples for each task from the dataset and report result over 5 random seeds.

Experimental setup; checked

> correct → incorrect transitions occur more frequently than incorrect → correct transitions (red >> green) across the runs.

Section on answer changes (Figure 3); not checked (the other fetch gave "correct →incorrect transitions occur more frequently than incorrect →correct transitions")

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Table 1, accuracy ± spread over 5 seeds, without debate then after debate (final answer by majority of the three agents), columns CommonSenseQA / MMLU / GSM8K:
3x GPT-4o-mini 75.6±2.2 then 74.8±2.1; 81.4±3.3 then 82.2±2.7; 94.0±0.9 then 94.4±1.5.
3x LLaMA 63.0±3.9 then 58.6±2.3; 61.6±2.4 then 57.8±1.8; 87.6±1.5 then 84.2±2.0.
1x GPT + 2x LLaMA 66.2±2.2 then 64.4±2.1; 65.0±2.3 then 68.0±2.2; 88.4±1.3 then 92.8±1.7.
2x GPT + 1x LLaMA 74.8±1.3 then 74.0±0.7; 82.6±3.2 then 81.0±3.0; 93.6±0.8 then 94.6±1.3.
1x GPT + 2x Mistral 62.4±1.1 then 59.4±1.9; 65.8±2.9 then 58.8±1.2; 90.2±0.8 then 87.8±1.9.
2x GPT + 1x Mistral 74.6±1.6 then 72.4±2.7; 82.8±2.7 then 80.8±2.8; 93.4±1.3 then 93.0±1.3.
1x GPT + 1x LLaMA + 1x Mistral 66.6±1.9 then 65.4±2.1; 57.8±3.1 then 63.4±2.1; 86.8±0.9 then 90.2±1.2.

Table 1; checked for the 3x LLaMA CommonSenseQA cells and the 1x GPT + 2x LLaMA GSM8K cells (both fetches gave them); the other cells come from one fetch
