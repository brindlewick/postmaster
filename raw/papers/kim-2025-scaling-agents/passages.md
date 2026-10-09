# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Across 260 configurations spanning six agentic benchmarks, five canonical architectures (Single-Agent and four Multi-Agent: Independent, Centralized, Decentralized, Hybrid), and three LLM families, we perform controlled evaluations, standardizing tools, prompts, and compute to isolate architectural effects.

Abstract (v3); not checked

> Relative performance change compared to single-agent baseline ranges from +80.8% on decomposable financial reasoning to -70.0% on sequential planning

Abstract (v3); checked (the fragment from 'ranges from' on agrees with a second fetch, which prints a typographic minus)

> all MAS architectures show slight degradation relative to SAS (mean 0.522): Hybrid −2.1%, Centralized −3.1%, Decentralized −5.4%, and Independent −14.9%

Section 4.2, SWE-bench Verified; not checked (the four numbers agree across three fetches; one fetch also printed the absolute scores in brackets)

> Independent shows marginal gains (+1.7%, 0.350) while Centralized degrades substantially (−19.2%, 0.278)

Section 4.2, Terminal-Bench; checked

> SWE-bench Verified and Terminal-Bench use 20-instance subsets due to the computational cost of Docker-based evaluation

Section 4.1, benchmarks; checked

> To ensure computational fairness, we matched maximum total iterations between MAS and SAS systems

Section 4.1, LLMs and intelligence scaling; checked

## Added by package P3-general-mixing, retrieved 2026-10-04

Read as HTML v3 through a fetch tool over two fetches; these passages bear on the non-code benchmarks (Finance-Agent, BrowseComp-Plus, PlanCraft, Workbench) and on the Independent architecture.

> tasks where single-agent performance already exceeds 45% accuracy experience negative returns from additional agents

Section 4.3; checked (both fetches)

> The synthesis_only policy concatenates sub-agent outputs without cross-validation or majority voting

Appendix, description of the Independent architecture; not checked (one fetch)

Data as rendered by the fetch tool (not a sentence quote): trace-level error amplification relative to a single agent, Single-Agent 1.0x, Centralized 4.4x, Decentralized 7.8x, Hybrid 5.1x, Independent 17.2x (Table 5).

Table 5; checked for 17.2x and 4.4x (both fetches); the other values come from one fetch

Data as rendered by the fetch tool (not a sentence quote): relative change against a single agent on the non-code benchmarks, best variant: Finance-Agent Centralized +80.8%, BrowseComp-Plus Decentralized +9.2%, Workbench Decentralized +5.6%, PlanCraft Hybrid -39.1%; the second fetch's list for the Independent architecture read Finance-Agent +57 to +80.8% (printed as a range; which variant is which is unclear), BrowseComp-Plus -35%, PlanCraft -70.0%.

Section 4.2, Figure 2; not checked (one fetch gave the best-variant row, the other the Independent row)

No multi-agent arm that mixes model families inside one system was found in the text read; one fetch said none was reported (not verified).
