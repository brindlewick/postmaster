# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> In empirical evaluation, we find that CAID improves accuracy over single-agent baselines by 25.6% absolute on paper reproduction tasks (PaperBench) and 14.7% on Python library development tasks (Commit0).

Abstract; not checked

> Through systematic analysis, we find that branch-and-merge is a central coordination mechanism for multi-agent collaboration, and that SWE primitives such as git worktree, git commit, and git merge enable it to be realized in a reliable and executable manner.

Abstract; not checked

> PaperBench | Claude 4.5 | 57.2% | 63.3% | +6.1pp
> PaperBench | MiniMax 2.5 | 10.5% | 36.1% | +25.6pp
> Commit0-Lite | Claude 4.5 | 53.1% | 59.1% | +6.0pp
> Commit0-Lite | MiniMax 2.5 | 42.3% | 57.0% | +14.7pp

Main results table (benchmark, model, single agent, CAID, gain), rows as rendered by the fetch tool with its bold marks removed; checked (the single-agent and CAID numbers agree across two fetches)

> multi-agent execution consistently incurs higher API cost than single-agent baselines, and wall-clock runtime is not substantially reduced

Analysis and limitations; checked (the common part of two fetches; one continues 'despite parallel execution')

> Worktree isolation further increases performance to 59.1%

Isolation analysis, Commit0-Lite; the same sentence reports soft isolation at 56.1% against a single-agent 53.1% in one fetch; checked

> doubling the iteration limit yields only marginal improvements and, in some cases, even degraded results.

Iteration-budget analysis; checked

> In Commit0-Lite at 8 engineers, performance declines despite higher computation cost.

Scaling-engineers analysis; not checked

> Following the benchmark's evaluation paradigm, we use gpt-5-mini as the judge model to assess functional correctness.

PaperBench scoring; not checked
