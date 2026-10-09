# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> We find that SAS consistently match or outperform MAS on multi-hop reasoning tasks when reasoning tokens are held constant.

Abstract and Section 5.1; checked

> This perspective further predicts that multi-agent systems become competitive when a single agent's effective context utilization is degraded, or when more compute is expended.

Abstract; not checked

> We identify significant artifacts in API-based budget control (particularly in Gemini 2.5) and in standard benchmarks, both of which can inflate apparent gains from MAS.

Abstract; not checked

> SAS is the best-performing system or statistically indistinguishable from the best for all budgets except the lowest one.

Section 5.1; not checked

## Added by package P3-general-mixing, retrieved 2026-10-04

Read as the abstract page plus HTML v2 through a fetch tool over three fetches. The paper's systems all use one model in every seat (Qwen3-30B-A3B, DeepSeek-R1-Distill-Llama-70B, Gemini-2.5-Flash, Gemini-2.5-Pro); its "Ensemble" design has several workers answer independently and a judge pick one.

> SAS is the best-performing system or statistically indistinguishable from the best for all budgets except the lowest one

Section 5.1 (results); checked (two further fetches agree word for word; the second adds "(100 tokens)")

> Multiple workers answer independently under equal budget splits with higher sampling temperature, and a judge selects the best candidate answer.

Section 3, the Ensemble architecture; not checked (one verbatim fetch; the other gave it in a paraphrase)

> many reported advantages of multi-agent systems are better explained by unaccounted computation and context effects rather than inherent architectural benefits

Abstract (inside the last sentence); not checked (one fetch of the abstract page)

> We only study the effect on performance across model families and datasets while increasing the thinking token cap. We do not enforce the models to actually use up all of those budgets.

Appendix C, limitations; not checked

Table cells: the fetches' tables for the Ensemble row disagreed with each other (for example at 5,000 thinking tokens one fetch gave the Qwen3 ensemble 0.254 against 0.260 for the single agent on FRAMES, another gave 0.226 against 0.271), so no table cell is kept. The 95% bootstrap intervals are said to be in Appendix F, which was not read.
