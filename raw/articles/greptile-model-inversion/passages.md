# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Both models find more bugs in code written by the other model than in code they wrote themselves.

Findings section; checked (two reads give the same sentence)

> Model inversion is experimental, and we're still learning how far the effect goes as models improve.

Closing section; checked (two reads agree on the sentence and its fragments)

> two datasets of 500 PRs each

Method section (fragment; one read also said the ground truth is "roughly 1,500 ground truth comments in total"); not checked (one read quoted it, another gave the same counts in other words)

> Using sentiment analysis, upvote/downvote ratios, and git archaeology, I built a ground truth dataset of verified bugs.

Method section; not checked (quoted in one read; an earlier read listed the same three methods)

> I ran both Codex and Claude Code's `/review` feature 3 times per PR, measured recall by matching comments against ground truth with an LLM-as-a-judge, and averaged the results.

Method section; not checked (quoted in one read; earlier reads gave "3 times each" and "LLM-as-a-judge" in other words)

> It detects which coding agent authored a PR - based on commit trails, branch prefixes, and PR titles - and routes the review to a different model.

Description of the "model inversion" feature; not checked (one read)

Figure 1 caption, as read in one fetch: "RECALL OF HIGH SEVERITY BUGS / Each model finds more bugs in the _other_ model's code"; not checked.

Note on the figures: the reads agree that the reviewing models were Claude Opus 4.7 and GPT 5.5 and that the four recall values are 50.5%, 53.7%, 60.0% and 62.0%. Three reads placed these four values in different cells of the reviewer-by-author table, so which value belongs to which cell is not established here. The post's own sentence that GPT found a higher share than Opus on Claude-written PRs (one read) and the caption above fix only part of the layout. The page, as read, reports no union of what both models find, no confidence intervals and no significance test.
