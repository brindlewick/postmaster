# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Human-facing checkpoints for plan-review are auto approved

Method (setup of the runs); checked (two fetches)

> skips intermediate artifacts and proceeds directly to implementation

Definition of the Baseline condition; checked (two fetches)

> Full-Augmented achieves the strongest overall quality, improving from 3.51 to 3.66 (+0.15)

Results; checked (three fetches; the sentence goes on "relative to Full" and names a 90-minute workflow family)

> executes the full Spec Kit workflow

Definition of the Full condition (one fetch said it produces SPEC.md, PLAN.md and TASKS.md before implementation); not checked

> Claude Code CLI, routed to an Anthropic-compatible endpoint backed by MiniMax-M2.5

Method, as reported by one fetch (another fetch also names MiniMax-M2.5 as the generator and Claude Opus 4.6 as the judge, so the judge is not the generator); not checked

Table 1, overall judged quality on a 1 to 5 composite (two fetches agree on Baseline 3.46 and Full-Augmented 3.66; Full 3.51 is also in the sentence above; Augmented 3.50 is from one fetch): Baseline 3.46, Augmented 3.50, Full 3.51, Full-Augmented 3.66. The "+0.15" compares Full with Full-Augmented. One fetch said the paper does not compare Baseline with Full or give a significance test for it. The abstract (one fetch) says 128 runs covering 32 features across five repositories, repository-level test compatibility of 99.7 to 100 percent, and on SWE-bench Lite (300 tasks) 56.5% for the baseline and 58.2% Pass@1 with the hooks. Full and Full-Augmented runs have a 90-minute budget (one fetch); the budget of the Baseline is not given in what was read, so equal compute is not shown. The paper has no limitations section.
