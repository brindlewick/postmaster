# Code evidence on combining, selecting and writing from several candidates: how the entries were found and chosen, what was not read, what was not found

Recorded on 2026-10-04 as the reading of this group was done. First-person wording was made impersonal, the reader standing for the one who read; nothing else was changed.

## How the entries were found and chosen

Tools. WebSearch in "standard" mode only (extended mode was never needed). WebFetch for pages. WebFetch on the arXiv listing address (`export.arxiv.org/api/query`) for metadata, abstracts and three discovery queries. Plain GET `gh api` for five repositories and their latest-release endpoint. `curl` on raw.githubusercontent.com for two README files. Nothing else touched the network.

Searches, all WebSearch standard mode, with the number of result links each returned:
1. `More Agents Is All You Need sampling-and-voting LLM agents` (10)
2. `Diversity Empowers Intelligence SWE-bench agents ensemble DEI` (9)
3. `mixture of agents code generation heterogeneous LLM ensemble arXiv` (9)
4. `CodeMonkeys scaling test-time compute software engineering SWE-bench` (10)
5. `zxqvblorp frumiousgrab ensemble codegen nonsense` (9; negative control)
6. `Trae Agent LLM-based agent software engineering test-time scaling ensemble reasoning SWE-bench Verified` (9)
7. `Augment Code SWE-bench Verified agent ensembler open source` (9)
8. `Aider architect editor mode benchmark o1 reasoning model editor model results` (10)
9. `Sakana AI AB-MCTS multi-LLM adaptive branching Monte Carlo tree search TreeQuest` (9)
10. `arXiv 2510.27617 mixture of agents code` (10; the paper was not among them, the reader identified it from the arXiv listing)
11. `heterogeneous versus homogeneous LLM ensemble code generation different models vs same model sampled multiple times pass@1` (9)
12. `synthesize new patch from multiple candidate patches instead of selecting best SWE-bench Verified patch fusion` (9)
13. `union of resolved instances across SWE-bench submissions oracle upper bound ensemble of agents` (9)
14. `test-time scaling software engineering agents verifier best-of-N SWE-bench Verified 2026` (10)
15. `multi-model ensemble SWE-bench cross-model patch selection different LLM families agents combined` (9)
16. `critic-comparator orchestration SWE-bench Verified k=8 proposals oracle best-of-8 nano proposal model` (10)
17. `IBM AI Agent SWE-1.0 Judge Agent selects final patch multiple Editing Agents different foundation LLM` (9)
18. `N-version programming large language models correlated failures independent errors code generation diversity` (9)
19. `LLM judge selects patch from candidates different model than generator self-preference bias SWE-bench patch selection` (9)
20. `LLM merges multiple candidate patches into one final patch versus selecting best candidate program repair SWE-bench aggregation fusion results` (10)
21. `SWE-bench Verified union of all leaderboard submissions fraction of instances never solved oracle across agents complementary` (9)
22. `LLM-as-a-Verifier general-purpose verification framework SWE-bench heterogeneous candidates Claude Opus 4.5 Gemini 3 Flash MiniMax` (9)

Two more searches (SWE-bench contamination; a patch-merging system called DeIMerge) were refused because the session's search budget of 200 was spent. The reader replaced them with arXiv listing queries and by following a citation to a contamination paper; an arXiv listing query for the name "DeIMerge" returned no entries.

arXiv listing discovery queries (WebFetch on the listing address, newest first), with the number of entries returned:
- `abs:"SWE-bench" AND (abs:"ensemble" OR abs:"mixture of agents" OR abs:"multiple LLMs" OR abs:"multi-model")` (7 entries, mostly off target; it returned Trae Agent and CodeMonkeys)
- `abs:"code generation" AND (abs:"heterogeneous" OR abs:"model diversity" OR abs:"ensemble of LLMs" OR abs:"different LLMs") AND (abs:"ensemble" OR abs:"voting" OR abs:"mixture")` (11 entries; it returned the multi-LLM orchestration paper and the similarity-selection paper)
- `abs:"patch" AND (abs:"fusion" OR abs:"merge" OR abs:"synthesize" OR abs:"aggregation") AND abs:"candidate" AND (abs:"repair" OR abs:"SWE-bench")` (13 entries; it returned PatchFusion and REFINE)

Selection rule. The reader read a source in full if it reports a measured comparison on code between several models, agents or candidates and a single one, or between choosing and writing a result, or if the ticket names it, or if it is a vendor post or a leaderboard analysis that describes an ensemble. The reader labelled vendor posts as reports. The reader left out papers that train a verifier or an agent without any ensemble question, and papers where the title or snippet was all the reader saw (they are under "Not read").

Controls. Positive: the first search returned the arXiv page of "More Agents Is All You Need" at the top, and the fourth returned the CodeMonkeys paper and its authors' page. Negative: the nonsense query returned only pages about nonsense-word generators and unrelated gems; nothing relevant. The arXiv listing queries have no negative control; they are loose (they returned serving-system and training papers) and the reader read the abstracts before choosing.

How hard the reader looked. 22 searches; 4 listing queries (three discovery queries and one for the name DeIMerge); about 95 page fetches (more than the budget of about 60, because second reads kept correcting first reads: a table cell, the identity of a baseline, a number that differed between versions; the fetch tool also hit a session limit for about five minutes near the end, after which the reader re-read three sources and read two program-repair papers and one more vendor post); two PDF fetches came back as binary and were not used; 1 shell command for GitHub API numbers of five repositories and 2 raw README fetches. Where the reader could not look: more searches (budget spent); the Science page of AlphaCode and the ICLR proceedings page of DEI (not fetched); the SWE-bench leaderboard site (needs scripts; not tried); the SWE-bench results repository (the reader used another reader's capture of one entry). Several sources were captured at the same time by other readers; for those the reader appended the reader's passages to their folder under a heading with the reader's date and the reader names their slug.

Count. 35 papers and 10 non-paper pages that the reader read are cited, each with a capture folder; the reader also cite captures by other readers for the Trae repository, the Trae selector page, the Trae leaderboard entry, the TreeQuest repository, the Aider repository and the Augment repository. Of the 35 papers, 34 were read in full text (AB-MCTS only up to its appendix results) and 1, the SWE-Bench Illusion, by abstract only. This is above the 15 to 25 the ticket aimed for because the lead list was long.

## Not read

Marked "unverified, snippet only" unless stated.
- Rethinking Mixture-of-Agents: Is Mixing Different Large Language Models Beneficial? (arXiv 2502.00674v1, 2025-02-02): appeared in a search; general language-model work and another reader's package (capture `li-2025-selfmoa`); the reader did not read it. unverified, snippet only; from memory it includes a code-reasoning benchmark (CRUXEval), which the reader could not confirm.
- When Does Combining Language Models Help? A Co-Failure Ceiling (arXiv 2606.27288): another reader's capture (`chen-2026-cofailure`); general tasks, with a separate competitive-programming result; not read by the reader.
- Agentic Rubrics as Contextual Verifiers for SWE Agents (arXiv 2601.04171), SWE-Replay (arXiv 2601.22129), Thinking Longer, Not Larger (arXiv 2503.23803), EGSS (arXiv 2602.05242), SWE-World (arXiv 2602.03419), ORACLE-SWE (arXiv 2604.07789), Vero (arXiv 2608.13522; a snippet said weaker agents' solved instances were subsets of the strongest agent's on that benchmark): titles and snippets only. unverified, snippet only.
- Multi-Programming Language Ensemble (arXiv 2409.04114), Galapagos N-version programming with LLMs (arXiv 2408.09536), LLM-as-a-Judge for software engineering (arXiv 2510.24367), SWE-Bench+ (arXiv 2410.06992), a patch-merging system named DeIMerge (named in a search summary; an arXiv listing query for the name returned no entries), AgentScope's SWE example (snippet said Qwen2.5 picks among Claude 3.5 Sonnet trials), CodeFuse Agent: titles or snippets only. unverified, snippet only.
- The IBM research blog post of October 2024 (capture `ibm-research-swe-agents`) was read once: it describes agents for localising, editing and testing and a 23.7% SWE-bench result with a Granite model, and no judge agent or several editing agents. A search summary had attributed to "IBM AI Agent SWE-1.0" a judge agent that chooses among editing agents powered by different models; the reader could not verify that, and it may refer to a later leaderboard entry (unverified, snippet only).
- The OpenHands post was read for the first time by another reader and a third time by the reader; it is cited above with the limits noted.
- Pages the reader did not try or could not use: the Science version of AlphaCode and DeepMind's blog; the ICLR proceedings page for DEI; the SWE-bench leaderboard site; the SWE-bench results repository (one entry through another reader's capture); two PDFs that came back as binary (AlphaCode, Dissecting), replaced by HTML renderings.

