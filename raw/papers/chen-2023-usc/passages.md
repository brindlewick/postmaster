# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Given multiple candidate responses, USC simply calls the LLM to select the most consistent response among them as the final output

Section 3; checked

> On mathematical reasoning, USC matches the standard self-consistency performance without requiring the answer formats to be similar.

Results (math); not checked (one fetch)

> USC matches the execution-based self-consistency performance on both benchmarks, while USC does not utilize code execution to perform the voting.

Results (code: BIRD-SQL and ARCADE); not checked (one fetch)

> Unless otherwise specified, the LLM generates 8 initial samples for both SC and USC

Section 4 (setup); not checked (one fetch; temperatures 0.6 for PaLM 2-L and 1.0 for gpt-3.5-turbo)

> Despite that USC supports open-ended generation tasks and generally achieves comparable performance in those domains where the standard self-consistency can be applied, our current USC implementation has its own limitations compared to the extraction-based self-consistency approach.

Section 6, limitations; not checked (one fetch; this sentence is 41 words, the opening clause is quoted in full for fidelity)

## Table data (numbers as rendered by the fetch tool; not a sentence quote)

Table 1, GSM8K and MATH accuracy, greedy / SC / USC: PaLM 2-L 85.7 / 90.4 / 90.2 and 30.8 / 37.9 / 37.4; gpt-3.5-turbo 73.4 / 78.5 / 77.8 and 33.2 / 38.0 / 38.1.

Table 1 (general, math); checked (two fetches agree on every PaLM 2-L cell; the gpt-3.5-turbo cells come from one fetch)

Table 2, code: BIRD-SQL execution accuracy greedy 42.4, SC-Exec 45.6, USC 45.5; ARCADE greedy 26.0, SC-Exec (fuzzy) 30.3, USC 30.1.

Table 2 (code, reported separately); checked (two fetches agree on SC-Exec and USC; greedy values from one fetch)

Table 3, GovReport summarization ROUGE-1: greedy 38.8, random 38.5, USC 40.2.

Table 3 (general); checked (two fetches agree)
