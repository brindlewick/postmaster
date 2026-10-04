# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> agents achieve on average 30% lower success rates when working together compared to performing both tasks individually

Abstract and Section 1; checked

> GPT-5 and Claude Sonnet 4.5 based agents achieve only 25% with two-agent cooperation on CooperBench, which is around 50% lower than a 'Solo' baseline

Section 4, near Figure 3 (HTML v2); not checked (the fragment 'only 25% with two-agent cooperation' agrees across two fetches)

> In the Solo baseline, the two tasks are assigned to one agent.

Section 4 (HTML v2); not checked

> The difference between 'with comm' and 'no comm' settings is not statistically significant.

Section 4, Figure 4(a) discussion; checked

> CooperBench comprises 652 tasks constructed from 12 popular open-source libraries across Python, TypeScript, Go, and Rust.

Benchmark description (HTML v2); not checked

> We create an agent framework incorporating leading open-source coding agent framework OpenHands (v0.54)

Experimental setup (HTML v2); the returned text continued after an ellipsis with the list of five models; not checked

> performance drops from 68.6% with 2 agents to 46.5% with 3 agents and further to 30.0% with 4 agents

Section 4, scaling experiment on 46 tasks (HTML v2); not checked (the numbers agree with an earlier fetch of HTML v1)

## Numbers from the GitHub API, 2026-10-04

- repository: cooperbench/CooperBench
- stars: 26
- forks: 16
- created: 2026-01-18
- last push: 2026-09-15
- latest release: v0.0.29, published 2026-08-15
- licence: none listed
- archived: false
