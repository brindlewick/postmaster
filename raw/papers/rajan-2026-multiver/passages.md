# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Union voting achieves 82.7% recall with 85.0% FPR

Section 4.4, ablation discussion; checked

> At 48.8% precision with 85% FPR, the system generates approximately one false positive per true detection

Section 5, discussion; not checked (the first fetch returned only the phrase "one false positive per true detection")

> The balanced test set contains 300 samples (150 vulnerable, 150 fixed); we evaluate on the 202 Python-only samples (100 vulnerable, 102 fixed)

Section 4.1; checked for the 202-sample split, not checked for the 300

> The third tier invokes Claude Opus 4.5 (Anthropic, 2025) with extended thinking

Section 3.2; not checked (one fetch). The first fetch said, in its own words, that the four agents are the same model with different prompts.

## Table data (values as rendered by the fetch tool; not a sentence quote)

Table 1, PyVul results (recall, precision, F1): Security-only agent 65.7%, none, none; MultiVer union 82.7% plus or minus 0.6%, 48.8%, 61.4%; GPT-3.5 fine-tuned 81.3%, 63.9%, 71.6%.

Table 1; checked (two fetches agree)
