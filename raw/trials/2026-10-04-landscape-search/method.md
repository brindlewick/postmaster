---
kind: trial
subject: what exists for coding with several models, and what has been shown about mixing them, from public pages and papers
date: 2026-10-04
---

# Method

**Question.** [Issue #277](https://github.com/brindlewick/postmaster/issues/277): which parts of
postmaster's flow exist elsewhere, whether mixing models for coding is shown to work, and what
postmaster adds. The wiki page that answers it is
[mixing-models-for-coding](../../../wiki/concepts/mixing-models-for-coding.md).

**What was done.** On 2026-10-04, nine groups of reading, each by web search and page fetch. Six cover
groups of tools and projects: parallel and best-of-N coding agents, synthesis of several candidates,
multi-agent and adversarial review, spec-first workflows with a person's sign-off, audit trails of
agent runs, and tests of the orchestration itself. Three cover the evidence: code evidence on
combining and choosing, general language-model evidence on mixing models, and the older and newer
work on whether independently produced versions fail independently. A ninth group looked for the
closest tools. Each group's record is in [records/](records/): the queries with their tool and mode and
how many results each gave, the rule for choosing, what was left out, what was not read, and what
was not found.

**Tools.** Web search, in its standard mode first and its extended mode where standard came back thin.
Page fetch, which returns a page as text processed by a small model. The GitHub API by plain read
requests for repository figures: `gh api repos/<owner>/<repo>`, a latest release, a head commit and a
file listing. `curl` of raw README files from raw.githubusercontent.com at a named commit. arXiv and
OpenAlex listing queries by fetch. No third-party code was installed, cloned, built or run, and nothing
was posted, starred, forked or filed anywhere.

**What a read is.** A source counts as read only if its text was fetched and the reported parts
were read. A search snippet is not a read, and a claim known only from a snippet is listed as
unverified in that group's record and is not used. PDFs could not be fetched as text, so a paper was
read as its arXiv HTML page, an author manuscript, or, for several older papers and one debate paper,
a PDF-to-text conversion through a public converter, which can drop words. Each passage kept in a capture is marked `checked`
when two reads with different prompts agreed word for word, or when it was matched by string
comparison against a raw file, and `not checked` otherwise.

**Controls.** Every search group has a positive control, a query for something known to exist, and a
negative control, a nonsense query. [controls.md](controls.md) gives each. Repository lookups were
paired with a lookup of a repository that does not exist, which returned 404. One "not found" was
wrong: a web search did not find `alecnielsen/adversarial-review` and the API did, so every "not found"
in the page is about the search.

**The count of five elements** that ranks the closest tools, with every mark, is in
[ranking-closest-tools.md](ranking-closest-tools.md).

**Budget and limits.** The web search tool allowed 200 calls for the whole reading, shared by all groups,
and it was spent partway. Later discovery went by direct fetch, GitHub list pages and arXiv listing
queries, and some groups could not run a web-search negative control. The search could not look
inside closed products and did not search Reddit, X, Discord or video. Searches by keyword missed
tools that call themselves something other than the words searched, for instance swarms and
harnesses in place of orchestrators. The fetch tool sometimes paraphrased or contradicted itself, so
each claim-bearing quote was read twice where it could be. Repository figures change daily.

**To repeat.** Run the queries in the records. A repeat will differ, since pages, stars and last-push dates
move, and the anchor is the day each source was read, which is in its capture.
