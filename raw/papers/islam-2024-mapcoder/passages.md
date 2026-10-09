# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> MapCoder showcases remarkable code generation capabilities, achieving new state-of-the-art results (pass@1) on HumanEval (93.9%)

Abstract (fragment; the sentence continues); not checked (one verbatim read)

> Every agent has its role in the pipeline as turning off any agent decreases performance.

Section 6.1; not checked (one read)

> MapCoder generates large number of tokens, which may pose challenges in resource-constrained environments.

Limitations; not checked (one read)

Reading of the setup by the fetch tool (a paraphrase, not a quote): all four agents use the same LLM in a run (gpt-3.5-turbo-1106, gpt-4-1106-preview, Gemini Pro or Mistral-7B-instruct), HumanEval pass@1 is 93.9% with GPT-4 against 88.3% for direct prompting, each problem takes 15 to 30 calls, and no repeated runs or confidence intervals are reported. Not checked.

