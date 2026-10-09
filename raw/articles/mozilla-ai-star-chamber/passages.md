# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> When three independently-trained models flag the same concern, ignoring it is hard to justify.

Body text; checked (two reads give the same sentence)

> Out of the box, this means Claude, GPT, and Gemini, but the provider list is configurable.

Body text; checked for the default providers (the first read gave "Claude, GPT, and Gemini" and "the provider list is configurable")

> The Star Chamber is explicitly advisory, not blocking.

Body text (the page marks "advisory, not blocking" in bold); checked (two reads agree on the phrase)

Tier labels, as read in both reads: Consensus issues (all providers flagged it); Majority issues (two or more providers); Individual observations (one provider only); checked.

Note: both reads said the post reports no numbers comparing the multi-model approach with single-model review. One read gave the post date as 5 March 2026 and said that a table shows the tool reviewing itself with 3 consensus issues and 2 majority issues; those two items are from one read and not checked. The post's repository was not found at mozilla-ai/star-chamber, so no adoption figures are given.

## Added by P5-review, retrieved 2026-10-04

> Each model reviews the code independently, with no knowledge of what the others are saying.

Post body; checked

> The fact that the tool found genuine issues in its own implementation was a good early signal that the approach works.

Post body; checked

> The Star Chamber is explicitly **advisory, not blocking**

Post body (the second fetch added a full stop); checked

> fans out code reviews and design questions to multiple LLM providers simultaneously, aggregates their feedback, and presents consensus-based recommendations

Post body, opening (fragment); not checked (one fetch)

> Out of the box, this means Claude, GPT, and Gemini, but the provider list is configurable

Post body; not checked (one fetch)

The second fetch reported that the post gives no measured numbers comparing the tool with a single model or counting issues found (an absence, not a quote).

## Numbers from the GitHub API, 2026-10-04

Repository peteski22/star-chamber ("Multi-LLM council protocol SDK").
- stargazers_count: 4
- forks_count: 1
- created_at: 2026-03-04T22:29:01Z
- pushed_at: 2026-09-17T13:00:24Z
- license: Apache-2.0
- default branch head: cd9b40fcd37933e6fc0bbac003678fc06013853e, committed 2026-09-17T12:59:56Z
