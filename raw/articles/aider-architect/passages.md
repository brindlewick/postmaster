# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Sonnet, GPT-4o and GPT-4o-mini all scored higher when used as an Architect/Editor pair.

Body text; checked (two reads give the same sentence)

Results table, rows relevant here (columns Architect, Editor, edit format, pass rate; "Baseline" is the architect model used alone); checked (two reads give identical rows):

> o1-preview | o1-mini | whole | 85.0%
> o1-preview | deepseek | whole | 85.0%
> o1-preview | claude-3-5-sonnet | diff | 82.7%
> o1-preview | Baseline | diff | 79.7%

> claude-3.5-sonnet | claude-3.5-sonnet | diff | 80.5%
> claude-3.5-sonnet | deepseek | diff | 78.9%
> claude-3.5-sonnet | Baseline | diff | 77.4%

> gpt-4o | gpt-4o | diff | 75.2%
> gpt-4o | deepseek | diff | 74.4%
> gpt-4o | Baseline | diff | 71.4%

Results table (rows reproduced as printed).

## Passages added by package P2-code-evidence, retrieved 2026-10-04

Reads by this package: the page read twice with different prompts. Rows of the results table not listed above:

> o1-preview | gpt-4o | diff | 80.5%
> o1-preview | deepseek | diff | 80.5%

Results table; checked (two reads give the same numbers)

> o1-mini | deepseek | whole | 71.4%
> o1-mini | Baseline | diff | 61.1%
> gpt-4o-mini | gpt-4o-mini | whole | 60.2%
> gpt-4o-mini | Baseline | whole | 55.6%

Results table; not checked (one read of these rows)

> Pairing many models with themselves in the Architect/Editor configuration can provide significant benefits.

Body text, the sentence before the one captured above; not checked (one verbatim read)

> Strong reasoning model like o1-preview make excellent Architects, while the Editor role can be assigned to an appropriate model based on cost, speed and code editing skill.

Body text; not checked (one read)


## Passages added by P8-orchestration-tests, retrieved 2026-10-04

> An Architect model is asked to describe how to solve the coding problem.

Body text, description of the split; checked (two fetches give the same sentence)

> An Editor model is given the Architect's solution and asked to produce specific code editing instructions.

Body text, description of the split; not checked (one fetch)

> Pairing many models with themselves in the Architect/Editor configuration can provide significant benefits.

Body text, same-model pairs; checked (two fetches give the same sentence)

The seven rows of the results table asked for (o1-preview with o1-mini, o1-preview with deepseek, o1-preview alone, claude-3.5-sonnet with itself and alone, gpt-4o with itself and alone) read the same on the two fetches as in the rows above. The text the fetches returned did not state the benchmark's number of exercises.

## Numbers from the GitHub API, 2026-10-04 (repository Aider-AI/aider)

- stars 49369; forks 5026; created 2023-05-09; last push 2026-05-22; licence Apache-2.0
- latest release v0.86.0, published 2025-08-09; default branch main; not archived
