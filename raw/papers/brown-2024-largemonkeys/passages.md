# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> In domains like coding and formal proofs, where answers can be automatically verified, these increases in coverage directly translate into improved performance.

Abstract; checked (two reads agree word for word)

> the fraction of issues solved with DeepSeek-Coder-V2-Instruct increases from 15.9% with one sample to 56% with 250 samples

Abstract (the sentence continues: "outperforming the single-sample state-of-the-art of 43%"); checked (two reads agree on this wording)

> common methods for picking from a sample collection (majority voting and reward models) plateau beyond several hundred samples and fail to fully scale with the sample budget

Abstract, about domains without automatic verifiers; the body places majority voting and reward models in Section 4.1 on GSM8K and MATH only; not checked (one verbatim read)

Table data as rendered by the fetch tool (not a sentence quote): DeepSeek-Coder-V2-Instruct | $0.0072 per attempt | 5 attempts | 29.62% solved | $10.8 total | 1x || GPT-4o | $0.13 | 1 attempt | 24.00% | $39 | 3.6x || Claude 3.5 Sonnet | $0.17 | 1 attempt | 26.70% | $51 | 4.7x

Table 1 (SWE-bench Lite, rows as printed, reformatted by the fetch tool); checked (two reads give the same numbers)

> Candidate solutions can be automatically checked using the repository's suite of unit tests.

Section on SWE-bench verification; not checked (one read)

> we explore only a simple version of repeated sampling where all attempts to a problem are generated independently of one another using the exact same prompt and hyperparameters

Limitations; checked (two reads agree on this wording)
