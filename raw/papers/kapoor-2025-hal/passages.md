# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> We validate the harness by conducting 21,730 agent rollouts across 9 models and 9 benchmarks in coding, web navigation, science, and customer service with a total cost of about $40,000.

Abstract; not checked (the body states the same figures in different words)

> Agent scaffolds create drastic differences in cost and accuracy.

Section 4.1, Finding 6; checked

> SeeAct with GPT-5 Medium costs $171 while Browser-Use with Claude Sonnet 4 costs $1,577: a 9x difference in cost despite just a two-percentage-point difference in accuracy.

Section 4.1, Finding 6 (the two entries differ in model as well as scaffold); checked

> In cases where the same models are used for both task-specific and generalist scaffolds across three benchmarks, task-specific agents consistently outperform.

Section 4.1, Finding 7; not checked (the fragment 'task-specific agents consistently outperform' agrees across two fetches)

> On CORE-Bench Hard, the task-specific CORE-Agent outperforms the generalist scaffold on 9 of 12 runs.

Section 4.1, Finding 7; checked

> A similar gap appears on SWE-bench Verified Mini (11 of 12).

Section 4.1, Finding 7; not checked (the fragment '11 of 12' agrees across two fetches)

## Numbers from the GitHub API, 2026-10-04

- repository: princeton-pli/hal-harness (the harness repository the paper links)
- stars: 310
- forks: 63
- created: 2024-07-29
- last push: 2026-07-01
- latest release: none returned by the API
- licence: none listed
- archived: true
