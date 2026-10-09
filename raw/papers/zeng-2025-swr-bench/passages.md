# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Subsequently, we propose and validate a simple multi-review aggregation strategy that significantly boosts ACR performance, increasing F1 scores by up to 43.67%.

Abstract; not checked (one fetch)

> Specifically, Gemini-2.5-Flash with Self-Agg (n=10) achieved an F1 of 21.91% (a 43.67% increase)

RQ3 results; checked

> A key finding is that Gemini-2.5-Flash Self-Agg (n=5) achieves an F1 of 20.48%, surpassing the single-pass Gemini-2.5-Pro baseline (F1: 19.38%)

RQ3, Figure 9(b) discussion; checked

> a Recall of 30.44% (a 118.83% increase)

RQ3 results (fragment); checked

> Self-Agg, which employs the same LLM to both generate and aggregate

RQ3 definitions (fragment); not checked (one fetch returned it as a quote; another described it in its own words)

> Execute PR-Review...multiple times on the same code change to generate n independent review reports, which are then aggregated into a final review report using an additional LLM call

RQ3 setup, Figure 8 (the ellipsis is the fetch tool's); not checked (one fetch)

## Table data (values as rendered by the fetch tool; not a sentence quote)

Table 4, PR-Review baseline, single pass: Gemini-2.5-Flash precision 16.88, recall 13.91, F1 15.25; Gemini-2.5-Pro precision 16.65, recall 23.18, F1 19.38.

Table 4; checked for Flash (two fetches agree) and for the Pro F1 (two fetches); the Pro precision and recall are from one fetch

Arithmetic check by the reader, not in the paper: 21.91 / 15.25 = 1.437 (the stated 43.67%); 30.44 / 13.91 = 2.188 (the stated 118.83%). From F1 21.91 and recall 30.44 the implied precision at n=10 is about 17.1%, against 16.88% at n=1. The paper reports no precision for the aggregated runs in the text read.

The fetches found no result for Multi-Agg (aggregating reports from different LLMs) in the page text; the Self-Agg results are described with Figure 9 (two fetches; an absence, not a quote).
