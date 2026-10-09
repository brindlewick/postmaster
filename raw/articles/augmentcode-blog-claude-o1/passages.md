# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> there is a gain of 3-8% to be had from ensembling techniques

Body text (fragment of a sentence; the sentence after it says the agent's results are highly unstable); checked (two reads agree)

> We did not investigate the ensembling route further because it is too expensive to use in real-world settings.

Body text (the first read gave the fragment "it is too expensive to use in real-world settings"); checked

> For ensembling, we used a simple majority voting technique with OpenAI's o1 model by showing it a list of candidate diffs, along with the problem statement, and asking it to pick the majority vote solution.

Body text (one read; the repository README, captured separately, says the same in other words); not checked

Note: the first read said the page does not report the score of the base model alone against the combined system, and does not state the number of candidates. The repository README (separate capture) gives a default of 8 candidate solutions per problem.

## Passages added by package P2-code-evidence, retrieved 2026-10-04

Reads by this package: the page read twice with different prompts.

> We found o1 was better than Sonnet 3.7 at ensembling by a couple percent.

Body text; checked (two reads agree word for word)

> we have achieved a 65.4% success rate on SWE-bench verified.

Body text (opening); not checked (one read)

> SWE-bench leans heavily towards fixing small bugs rather than creating new features.

Body text, limitations of the benchmark; not checked (one read)

Page header as read (checked, two reads agree): dated "Mar 31, 2025", with a "Last updated" line of Jun 18, 2026, by Tongfei Chen and Colin Flaherty. The second read found no sentence giving the number of candidates; the repository README (separate capture) gives a default of 8.

