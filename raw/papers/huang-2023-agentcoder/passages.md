# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> AgentCoder (GPT-4) achieves 96.3% and 91.8% pass@1 in HumanEval and MBPP

Abstract (fragment; the sentence continues and the abstract compares with prior state of the art); checked for the fragment (two reads agree)

> AgentCoder generates tests independently without seeing the whole code snippet to keep objectivity and avoid being biased.

Section 3.2; not checked (one read)

> Programmer only 61.0% | + test designer 64.0% | + test executor 64.6% | full AgentCoder 79.9% (HumanEval, GPT-3.5-turbo); single agent 71.3% / 79.4% against multiple agents 79.9% / 89.9% (HumanEval / MBPP, same model)

Tables 2 and 7, as listed by the fetch tool; not checked (one read)

Reading of the setup by the fetch tool (a paraphrase, not a quote): all three agents use the same underlying LLM with different prompts, the executor is a Python script, and the paper reports no repeated runs or confidence intervals. Not checked.

