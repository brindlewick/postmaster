# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Claude Opus 4.7 review raises Codex GPT-5.5 drafts from 71.6% to 89.7%; Codex GPT-5.5 self review raises them to 84.5%; Codex GPT-5.5 reviewing Claude Opus 4.7 drafts drops the pass rate from 91.4% to 82.8%.

Results summary sentence; checked for the figures (the abstract page and the first full-text read give the same figures in the same pairings; the abstract does not carry the model version numbers)

Table of the six conditions as read (writer, reviewer, pass rate), consistent with the sentence above and with the abstract:

A: Claude Opus 4.7, no reviewer, 91.4% | O: Codex GPT-5.5, no reviewer, 71.6% | AO: Claude writes, Codex reviews, 82.8% | OA: Codex writes, Claude reviews, 89.7% | AA: Claude writes and reviews, 91.4% | OO: Codex writes and reviews, 84.5%

Table (the condition letters and column labels as read from one full-text fetch; the figures agree with the abstract); checked for the figures

> We pool the two difficulty tiers and compare six conditions

Method (fragment, with "116 recent hard and medium LiveCodeBench tasks" given in the second read); checked (two reads agree on 116 tasks)

> The reviewer is instructed to inspect the draft for bugs...then write a final program inside tags: either the original draft if it is correct or a corrected version if it is not.

Method, reviewer role (the ellipsis is in the read's own quotation); not checked (one read)

> Our evidence also covers a single model pair, so whether the asymmetry generalizes beyond Claude Opus 4.7 and Codex GPT-5.5 to families such as Gemini, DeepSeek, Qwen, or Grok is untested.

Limitations; not checked (one read)

Notes from the reads (paraphrase): the abstract says the reviewer sees the problem and the writer's draft but cannot execute tests; each task was run once per condition; the adjusted p-values reported are .0010 (Codex drafts reviewed by Claude against Codex alone), .0222 (Codex self review against Codex alone) and .0456 (Codex reviewing Claude drafts against Claude alone), by McNemar tests with Benjamini-Hochberg correction; the model settings were high reasoning effort for both, accessed through their vendors' command-line agents; other stated limits are 116 tasks, self-contained Python problems without repository context, and sensitivity to prompt wording and model versions.
