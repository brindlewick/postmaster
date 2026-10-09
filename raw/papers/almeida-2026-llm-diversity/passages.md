# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Reliability improvement is evaluated in a 1-out-of-2 configuration across both homogeneous and heterogeneous program populations, including within-LLM pairings and pairings across programming languages and across LLM-generated and human-written programs.

Abstract; checked (abstract page and HTML agree)

> The results show that combining LLM-generated programs, especially in heterogeneous settings, can yield reliability gains, although this is partly conditioned by the programming language and generation setting.

Abstract; checked (abstract page and HTML agree)

> While failures of LLMs-based programs tend to be positively correlated, they tend to do so to a lesser extent than failures of human-written ones.

Section V-A; checked (two fetches)

> In certain pools of this specification, the enforced heterogeneous curve actually crosses above the theoretical independence line. This reveals a rare instance of negative failure correlation.

Section IV-C (human-written with LLM-generated pairs, first specification, Figure 3); checked (two fetches)

> Heterogeneous pairs combined different language-specific sub-pools.

Section III-F1; not checked (one fetch). This is what "heterogeneous" means for pairs of LLM programs in that section as relayed; a comparison of different model families against one model repeated was not retrieved.

> We use programs from UVa Online Judge repository written for the three specifications in one of the 4 programming langauges: C, C++, Java, and Pascal.

Section III-D (spelling as relayed); not checked (one fetch)

> They also show that LLMs do not eliminate the classical challenge of correlated failures; rather, they provide a inexpensive source of heterogeneous programs whose value depends on how much they reduce failure overlap.

Conclusion (fragment, spelling as relayed); not checked (one fetch)

> they do not represent industrial software or full software-development processes.

Threats to validity, external validity (fragment); not checked (one fetch)

Set-up as relayed by the fetch tool (not a sentence quote): three specifications from the UVa online judge (3n+1, Factors and Factorials, Factovisors); 15,295 valid human programs for 3n+1 out of 95,659 raw submissions; LLM programs generated at temperatures 0.5 to 1.5 in C, C++, Java and Pascal; five commercial-API models (gemini-3.1-pro-preview, gemini-2.5-pro, gpt-5-mini, gpt-4o-mini, gpt-5.1-codex-mini) and nine local open-weight models (Qwen2.5-Coder 7B, 14B and 32B, DeepSeek-Coder-V2-Lite, llama-3.3-70b-instruct-awq, Codestral-22B-v0.1, Mistral-Small-Instruct-2409, Mixtral-8x7B-Instruct-v0.1, falcon-mamba-7b-instruct).

Section III and Table I; not checked (one fetch)

> Different programs tend to fail on the same subset of test cases, and thus their failures overlap, reflecting varying difficulty across the test suite.

Section on how diversity is defined and measured; not checked (one fetch)
