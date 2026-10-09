# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> When a review runs, multiple agents analyze the diff and surrounding code in parallel on Anthropic infrastructure.

"How reviews work"; checked

> Each agent looks for a different class of issue, then a verification step checks candidates against actual code behavior to filter out false positives.

"How reviews work"; checked

> The results are deduplicated, ranked by severity, and posted as inline comments on the specific lines where issues were found, with a summary in the review body.

"How reviews work"; checked

> Reviews scale in cost with PR size and complexity, completing in 20 minutes on average.

"How reviews work"; checked

> Findings are tagged by severity and don't approve or block your PR, so existing review workflows stay intact.

Introduction; checked

> Anthropic collects reaction counts after the PR merges and uses them to tune the reviewer.

"Rate and reply to findings"; checked

> Each review averages $15-25 in cost, scaling with PR size, codebase complexity, and how many issues require verification.

"Pricing"; checked

> At `low` and `medium`, the review reports only the findings it's most confident in, so you see fewer false positives; `high` through `max` broaden coverage and may include findings the review is less sure about.

"Review a diff locally", "Tune effort and arguments"; checked

The page text read names no model.
