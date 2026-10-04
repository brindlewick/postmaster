# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> R1 as architect with Sonnet as editor has set a new SOTA of 64.0% on the aider polyglot benchmark.

Body text; checked (two reads give the same sentence)

> They achieve this at 14X less cost compared to the previous o1 SOTA result.

Body text; checked (two reads give the same sentence)

Results table (columns: model, percent completed correctly, percent using correct edit format, total cost); checked (two reads give identical values):

> R1+Sonnet | 64.0% | 100.0% | $13.29
> o1 | 61.7% | 91.5% | $186.5
> R1 | 56.9% | 96.9% | $5.42
> Sonnet | 51.6% | 99.6% | $14.41
> DeepSeek V3 | 48.4% | 98.7% | $0.34

> the results above are _not_ using R1's thinking tokens, just the normal final output.

Body text (one read quoted it; the other read gave the same point in other words); not checked

## Passages added by package P2-code-evidence, retrieved 2026-10-04

Reads by this package: the page read twice with different prompts.

> Using various other models as editor didn't seem to improve o1 or R1 versus their solo scores.

Body text; not checked (one read). Both reads found no author and no statement of the number of exercises; the date as read is January 24, 2025.


## Numbers from the GitHub API, 2026-10-04 (repository Aider-AI/aider)

- stars 49369; forks 5026; created 2023-05-09; last push 2026-05-22; licence Apache-2.0
- latest release v0.86.0, published 2025-08-09; default branch main; not archived
