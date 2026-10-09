# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Our case study shows that constitutional constraints reduce security defects by 73% compared to unconstrained AI generation while maintaining developer velocity.

Abstract; not checked (abstract page only)

> CWE Violations Detected | 3 | 11 | 73% reduction

Table 3 (columns: Metric, Constitutional, Unconstrained, Improvement), row 1; checked (two fetches report the row; the table also has rows for time to first secure build, 4 days against 9, and others, from one fetch)

> We developed the banking application over a two-week period with a single developer utilizing AI assistance (Claude) for code generation.

Case-study description, as reported by one fetch; not checked (another fetch reports the same facts in other words)

> Small sample size (n=1 project) limits statistical power for quantitative claims.

Limitations, as reported by one fetch; not checked

One fetch reports that defects were counted by "static analysis tools and manual review" and that the paper does not say who approved the constitution or the specification. The paper's own limitations also say the team had prior security training, which may inflate the benefit (one fetch, not checked).
