# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> We introduce Adversarial Review (AR), a minimal cooperative code-review protocol in which a main coding agent works with a reviewer and a critic agent.

Abstract; not checked (one fetch)

> The reviewer evaluates code, while the critic audits the review through structured disagreement before the main agent edits.

Abstract and Section 3; checked

> We use Claude Sonnet 4.5 Medium Reasoning for all subsequent agent and subagent calls for all benchmarks.

Experimental setup; checked

> R1 and R2 review M's code independently, then M edits once based on the union.

Baselines, "Two-reviewers"; checked (the first fetch returned it as a definition without quote marks)

> Reviewers do NOT see each other's outputs.

Baselines, "MARS" (a system with three reviewers in parallel and a meta-reviewer); checked

> LCB measures competitive-programming style correctness, SWE-PRBench measures similarity to human pull-request feedback, and SWE-bench Verified measures repository-level repair through hidden tests.

Limitations; not checked (one fetch)

> A GPT-5.2 judge matches the agent's comments against the actual human reviewer's comments. The judge agrees with human annotators at Cohen's kappa = 0.75.

SWE-PRBench setup; not checked (the two fetches differ in small words)

> False consensus is especially concerning because it can look like independent validation: two agents appear to agree, but the agreement may only reflect conversational pressure to converge.

Limitations; not checked (one fetch)

> AR is not a free improvement. It uses more tokens than Zero-shot on all three benchmarks

Limitations (fragment); not checked (one fetch)

## Table data (values as rendered by the fetch tool; not a sentence quote)

Table 1, LiveCodeBench, 105 problems, 57 of them hard. Columns: method, pass out of 105, pass on hard out of 57, number of agents.
Zero-shot 77%, 35/57 (61%), 1; Self-Refine 77%, 35/57 (61%), 1; Single-reviewer 77%, 36/57 (63%), 2; Two-reviewers 75%, 34/57 (60%), 3; MARS 82%, 39/57 (68%), 5; AR 87%, 43/57 (75%), 3.

Table 1; checked (two fetches agree on every row)

Table 2, SWE-PRBench, F1 against human reviewers' comments, N = 100: AR with text constraint 0.533; Two-reviewers 0.503; MARS 0.501; Single-reviewer 0.495; AR 0.457.

Table 2; checked (two fetches agree on every row)

Table 3, SWE-bench Verified, pass rate, N = 500: AR 75.2%; Zero-shot 71.6%; MARS 72.6%.

Table 3; checked (two fetches agree)

The fetches found no sentence on statistical significance, confidence intervals, variance across runs or seeds, and no separate precision or recall (two fetches; an absence, not a quote).
