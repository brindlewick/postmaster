# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Our results on the popular SWE-bench Lite benchmark show that surprisingly the simplistic Agentless is able to achieve both the highest performance (32.00%, 96 correct fixes) and low cost ($0.70) compared with all existing open-source software agents!

Abstract; not checked

> For baseline tools, we directly use the reported results either from the official leaderboard or from the tool's official paper/repository.

Section 5.1, experimental setup; not checked

> SWE-agent | GPT-4o | 55 (18.33%) | $2.53 | 498,346
> AutoCodeRover-v2 | GPT-4o | 92 (30.67%)
> Agentless | GPT-4o | 96 (32.00%) | $0.70 | 78,166

Table in Section 5.1 (tool, model, resolved on SWE-bench Lite's 300 problems, average cost, average tokens), rows as rendered by the fetch tool; checked (two fetches give the same numbers)

> By only using majority voting, we can already achieve 77 correct fixes.

Section 5.2.3, Table 4; checked

> If we consider all patch samples (instead of only selecting one patch) for each issue, the total number of possible issues that Agentless can solve is 126 (42.0%).

Section 5.2.2; checked

> One threat to validity comes from the data leakage of ground truth developer patches in SWE-bench Lite being part of the training data for GPT-4o.

Section 7, internal threats; not checked

## Numbers from the GitHub API, 2026-10-04

- repository: OpenAutoCoder/Agentless
- stars: 2119
- forks: 239
- created: 2024-06-30
- last push: 2024-12-22
- latest release: v1.5.0, published 2024-10-29
- licence: MIT
- archived: false

## Passages added by package P2-code-evidence, retrieved 2026-10-04

Reads by this package: HTML v2 read twice through a fetch tool with different prompts.

> Majority voting 77 (25.67%) $0.00 || +Regression test 81 (27.00%) $0.01 || +Reproduction test 96 (32.00%) $0.25

Table 4 (patch selection ablation, SWE-bench Lite), rows as listed by the fetch tool; checked (two reads give the same numbers)

> Greedy location (40 samples) 88 (29.33%) || Multi-samples merged (40 samples) 85 (28.33%) || Multi-samples (4 x 10 samples) 96 (32.00%)

Table 3 (repair ablation); the numbers 88, 85 and 96 agree across two reads, the row labels differ between the reads, so the labels are not checked

> Agentless is extremely competitive compared with prior agent-based approaches while using a much simpler design.

Section 5.1; not checked (one read)

> One threat to validity comes from the data leakage of ground truth developer patches in SWE-bench Lite being part of the training data for GPT-4o.

Threats to validity; checked (this read and the capture above agree word for word)

