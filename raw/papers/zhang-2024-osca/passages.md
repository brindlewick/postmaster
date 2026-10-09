# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> we can achieve accuracy better than the best single configuration with 128x less compute on code generation

Abstract (code result, reported separately); checked

> when Osca is not allowed to use multiple models, its accuracy degrades to that of optimal pure. When Osca is not allowed to use multiple temperatures, its accuracy degrades to be worse than optimal pure.

Section 4.4, Figure 5 (LiveBench, general tasks); not checked (one verbatim fetch; the earlier fetch said the same in a paraphrase: single model gives the optimal pure level, single temperature falls below it)

> Due to the computation limitation, we limited our inference compute budget to 512.

Limitations; checked

> This split gives us 305 problems for training and 205 problems for evaluation.

Section 4.1, LiveCodeBench (code); not checked (the other fetch gave the same counts in a paraphrase)

Results as described by the fetches (not a quote): LiveBench has 201 training and 471 test problems; SWE-Bench Lite 150 training and 150 test issues; the allocation is learned on the training problems and scored on the held-out test problems; comparisons are at equal total compute budget. Claimed savings: "25x less compute on 4 reasoning tasks" and 3x on SWE-Bench (abstract, one fetch).

Sections 3 and 4; not checked
