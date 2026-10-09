# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Run eight parallel passes with randomized diff order

Post body, list of the original pipeline, step 1; checked

> Majority voting to filter out bugs found during only one pass

Post body, list of the original pipeline, step 3; checked

> Run results through a validator model to catch false positives

Post body, list of the original pipeline, step 6; not checked (one fetch)

> Each pass received a different ordering of the diff, which nudged the model toward different lines of reasoning. When several passes independently flagged the same issue, we treated it as a stronger signal that the bug was real.

Post body, early design; not checked (one fetch)

> Since launch, we have run 40 major experiments that have increased Bugbot's resolution rate from 52% to over 70%

Post body, results; checked

> Today, Bugbot reviews more than two million PRs per month for customers like Rippling, Discord, Samsara, Airtable, and Sierra AI.

Post body, scale; checked for the sentence core (the first fetch returned "reviews more than two million PRs per month")

> It uses AI to determine, at PR merge time, which bugs were actually resolved by the author in the final code.

Post body, definition of the resolution-rate metric; checked for the shared words

> We saw the largest gains when, this fall, we switched Bugbot to a fully agentic design.

Post body; not checked (one fetch)

> The agent could reason over the diff, call tools, and decide where to dig deeper instead of following a fixed sequence of passes.

Post body; not checked (one fetch)
