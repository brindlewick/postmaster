# The closest tools and write-ups: how the entries were found and chosen, what was not read, what was not found

Recorded on 2026-10-04 as the reading of this group was done. First-person wording was made impersonal, the reader standing for the one who read; nothing else was changed.

## How the entries were found and chosen

### Queries run

WebSearch, mode "standard" unless marked. The count after each query is the number of result links returned.

1. `multi-model consensus MCP server coding agent second opinion Claude Code Gemini Codex` (10)
2. `BeehiveInnovations zen-mcp-server PAL MCP multi-model` (10)
3. `karpathy llm-council github` (9) - positive control
4. `multi-vendor coding agents run same task in parallel worktrees Claude Code Codex Gemini CLI compare and merge results` (9)
5. `bytedance trae-agent Trae Agent selector agent ensemble reasoning SWE-bench patches` (10)
6. `togethercomputer MoA Mixture-of-Agents github proposer aggregator` (9)
7. `SakanaAI treequest AB-MCTS multi-LLM github` (9)
8. `Amp oracle subagent second opinion o3 GPT-5 Sourcegraph Amp manual` (9)
9. `Aider architect mode editor model separate models benchmark results o1 DeepSeek Sonnet` (9)
10. `Perplexity Model Council multiple models answer synthesized` (9)
11. `the reader ran Claude Code, Codex and Gemini on the same coding task and compared results blog` (9)
12. `github topic multi-model code review MCP cross-vendor reviewer GPT reviews Claude code` (9)
13. `metaswarm multi-agent orchestration Claude Code Codex Gemini CLI cross-model adversarial review design review gate` (10)
14. `openai codex-plugin-cc Codex plugin for Claude Code adversarial review delegate` (9)
15. `GitHub Agent HQ run multiple agents Claude Codex Gemini same task compare results mission control` (9)
16. `Cursor parallel agents best-of-N run same prompt multiple models compare pick best` (10)
17. `Augment Code SWE-bench Verified Claude 3.7 o1 ensembler majority vote candidate patches` (9)
18. `OpenHands multiple attempts critic model best-of-n inference-time scaling SWE-bench` (9)
19. `MetaGPT ChatDev multi-agent software development roles evaluation results` (9)
20. `Vibe Kanban run multiple coding agents Claude Code Codex Gemini parallel review sunset` (9)
21. `gave the same task to three different AI models independently then merged the best parts; results, number of tasks, which model won experience report` (10; off target, returned model-weight merging papers)
22. `cross-model code review Codex reviews Claude Code output found bugs Claude missed experiment numbers` (9)
23. `Hacker News Show HN multiple LLM coding agents implement same ticket independently synthesize best solution` (9)
24. `multi-agent coding framework orchestrator tested with fixture repository hidden tests scores regression suite for the orchestration itself` (10)
25. `Ars Technica four AI coding agents Minesweeper Codex Claude Code Gemini CLI Mistral Vibe same prompt` (10)
26. `oh-my-opencode oh-my-openagent multi-model orchestration Oracle GPT Gemini Claude agents roles` (9)
27. `Rethinking Mixture-of-Agents: Is Mixing Different Large Language Models Beneficial Self-MoA` (9)
28. `llm council MCP server Claude Code skill multiple models deliberate vote chairman synthesize coding` (9)
29. `zqxv blorptastic flumphwork polyvendor snarglecode orchestrator` (9) - negative control
30. `SWE-bench Verified submission ensemble of models from different vendors Claude GPT Gemini patch selection leaderboard` (9)
31. `spec-driven development human approves requirements design before code multi-agent multiple models Kiro Spec Kit BMAD` (9)
32. `N-version programming large language models code generation independent failures diversity different LLMs coincident errors` (10)
33. mode "extended": `blog experiment: ran Claude, GPT-5 and Gemini on the same set of real tickets, compared pass rate of single model vs picking best of three vs merged result` (two result sets of about ten; off target)
34. `Kilo Code Agent Manager multi-version run same prompt multiple models compare` (10)

Two further WebSearch calls (a Cursor documentation search limited to cursor.com and a GitHub changelog search limited to GitHub domains) were refused: the session's budget of 200 WebSearch calls was spent. The budget is shared across the session, so other readers' searches counted against it. The reader made 34 searches of the reader's own. After that, discovery was by direct page fetches, the GitHub API and one forum index.

GitHub search API (plain GET, repositories, sorted by stars; the count is `total_count`):

- G1 `multi-model+consensus+coding+agent+mcp+in:description` (5)
- G2 `cross-model+code+review+claude+codex+gemini+in:description` (8)
- G3 `llm-council+in:name,description,topics` (1,225; the first result by stars is karpathy/llm-council with 25,141 stars - a second positive control)
- G4 `topic:multi-agent+topic:claude-code+topic:codex+topic:gemini-cli` (117)
- G5 `best-of-n+coding+agents+worktree+in:description` (4)
- G6 `mixture-of-agents+code+in:description` (26)
- G7 `multi-llm+ensemble+code+generation+select+best+patch+in:description` (0)
- G8 `multi-vendor+coding+agents+same+task+in:description` (0)
- G9 `ai-jury+in:name,description` (212)
- G10 `claude+codex+gemini+head-to-head+same+task+benchmark+in:description` (0)
- G11 `coding+agents+arena+compare+implementations+worktree+in:description` (0)
- G12 `n-version+programming+llm+agents+in:description,readme` (77; almost all unrelated)
- G13 `cross-vendor+review+in:description+language:TypeScript` (4)
- G14 `star-chamber+org:mozilla-ai` (0)
- G15 and G16: two README-text searches for independent implementations, a judge or synthesis and a spec approval by several vendors' agents, limited to repositories pushed after 2026-06-01 (289 and 330; the top results were curated "awesome" lists, so nothing came of them)

Hacker News index (through the page-fetch tool, JSON from the public search service):

- H1 `query=run+same+task+claude+codex+gemini+compare+merge+best&tags=story` (0 hits)
- H2 `query=codex+reviews+claude&tags=story` (15 hits; titles only were read; one led to a paper that is entry S4 below)
- H3 `query=multiple+models+same+prompt+worktrees&tags=story` (4 hits, none relevant)

### How the reader chose and ranked

Choosing. A tool or write-up was read if a search result or a named lead pointed to it and one of these held: it puts models from more than one vendor into a coding workflow; it reports a measurement of mixing, voting, selection or review; or the ticket named it. The reader read the primary text where the reader could: the README (as raw file text), the vendor's own page, or the paper. Where only a summary existed, the entry says so.

Ranking. Each entry gets a mark for each of E1 to E5: Y (a core, described behaviour in the pages the reader read) = 2, p (partly, optional, in a different form, or for plans and reviews rather than code) = 1, a dash (not present or not stated in the pages the reader read) = 0. The score is the sum, out of 10. Ties are broken by: coding-specific before general; then a published measurement of its own; then adoption. The rule is a count of elements, not a judgement of quality. The table shows the marks so that a reader can re-rank. Studies and write-ups (Part 2) are marked on the same elements as far as they apply; E5 is not applicable to a study that measures other people's flows, so it scores 0 there.

Adoption. For a repository, the GitHub API on 2026-10-04: stars (as a proxy for use, not a measure of quality), forks, creation date, last push, latest release, licence. The reader notes whether the last push was on or after 2026-07-06 (within 90 days). For a closed product the reader gives only what the vendor says, or "not stated".

What the reader left out and why. About twenty small repositories turned up in the GitHub searches (for example omp-best-of 71 stars, sage 106, the-llm-council 91, moa-x 32, crossfire 3, mmteam-cc 0). The reader did not read them: they are small, and the reader read the larger or better documented tools that do the same things. Orchestrators that only run several same-vendor agents in parallel or pass messages between them (for example agmsg, agor, munder-difflin) were left out because they do not mix vendors' attempts on one task in the pages the reader saw. They are listed under "Not read".

### How hard the reader looked, and where the reader could not

34 WebSearch queries, 16 GitHub search queries and 3 forum-index queries (all listed above), then about 63 page fetches (about 8 of them failed or returned nothing), about 36 raw-file reads from GitHub, and about 130 small GitHub API requests (repository figures, releases, commit ids, listings, searches). That is about 100 page and file fetches against a budget of about 60. The overrun came from second reads to check quotes and from pages that failed. Blocked or unreadable: Perplexity's Model Council post (HTTP 403, and a second address 404); the Ars Technica article (the fetch tool refused the domain; a secondary summary was read instead); Amp's news pages ("Parse Error: Header overflow"; its documentation pages were read); an AWS Builder Center post about Deliberation (the page returned only its header); the PyPI page for ai-jury (a JavaScript error; the repository README was read instead); a guessed GitHub changelog address (404). The reader could not search for practitioner blogs or forum threads beyond what the 34 searches and the forum index returned. The reader did not look at social media or video.

### Controls

- Positive control: query 3 ("karpathy llm-council github") returned the repository's coverage, and G3 returned karpathy/llm-council first of 1,225 results. A request for BeehiveInnovations/zen-mcp-server through the GitHub API returned the repository now named pal-mcp-server, which confirms the lead "zen-mcp-server (now PAL?)".
- Negative control: query 29, a string of invented words, returned nine unrelated pages about generic orchestrators and none containing the invented words. This search tool returns near matches rather than an empty list, so "no relevant result" here means none matched the nonsense terms. G7, G8, G10 and G11 returned zero results; they were narrow phrase searches.
- "Not found" in this note is a statement about these searches only.

### Ranking, Part 1: tools and products

Marks: Y, p, or a dash as defined above. "Own measurement" says whether its own pages report a measurement that mixing, voting, selection or review helps. "Recent" means the last push was on or after 2026-07-06 (repositories only).

| Rank | Entry | E1 | E2 | E3 | E4 | E5 | Score | Coding | Own measurement | Recent |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Voratiq | Y | Y | Y | - | p | 7 | yes | no | no |
| 2 | LoopTroop | p | Y | p | Y | p | 7 | yes | no | yes |
| 3 | ai-jury | - | Y | Y | - | Y | 6 | yes (review) | yes, tiny | yes |
| 4 | Autopus-ADK | p | Y | Y | - | p | 6 | yes | no | yes |
| 5 | Trae Agent (paper, repository, SWE-bench record) | Y | Y | p | - | p | 6 | yes | yes | no |
| 6 | LLM Council (karpathy) | Y | Y | Y | - | - | 6 | no | no | no |
| 7 | Together MoA | Y | Y | p | - | p | 6 | no | yes (chat tasks) | no |
| 8 | Deliberation | - | Y | Y | - | p | 5 | yes (plan and code review) | no | yes |
| 9 | PAL MCP (was Zen MCP) | - | Y | Y | - | p | 5 | yes | no | no |
| 10 | Magpie (with the Milvus post) | - | Y | Y | - | p | 5 | yes (review) | yes, small | yes |
| 11 | OpenHands (inference-time scaling post) | p | Y | - | - | p | 4 | yes | yes | yes |
| 12 | Augment (Claude 3.7 and o1) | p | Y | - | - | p | 4 | yes | yes | (see entry) |
| 13 | TreeQuest and AB-MCTS | p | Y | - | - | p | 4 | partly | yes (puzzles) | no |
| 14 | Kilo Agent Manager | Y | Y | - | - | - | 4 | yes | no | yes |
| 15 | Cursor /best-of-n | Y | Y | - | - | - | 4 | yes | no | closed |
| 16 | Mozilla.ai Star Chamber | - | Y | Y | - | - | 4 | yes | no | not found |
| 17 | Parallel Code | p | Y | - | - | - | 3 | yes | no | yes |
| 18 | GitHub Agent HQ | - | - | p | Y | - | 3 | yes | no | closed |
| 19 | Zenflow | - | - | Y | p | - | 3 | yes | no (a speed claim) | closed |
| 20 | metaswarm | - | - | p | p | p | 3 | yes | no | no |
| 21 | SWE-AF | - | - | p | - | p | 2 | yes | yes, one prompt | yes |
| 22 | Aider architect/editor | - | p | - | - | p | 2 | yes | yes | no |
| 23 | oh-my-openagent | - | - | p | - | p | 2 | yes | no | yes |
| 24 | GitHub Spec Kit | - | - | - | Y | - | 2 | yes | no | yes |
| 25 | ChatDev | - | - | - | p | p | 2 | yes | no (in the README) | yes |
| 26 | Codex plugin for Claude Code | - | - | p | - | - | 1 | yes | no | yes |
| 27 | Amp oracle | - | - | p | - | - | 1 | yes | no | closed |
| 28 | MetaGPT | - | - | - | - | - | 0 | yes | no (in the README) | no |

Reading the table. The most common pattern is a tool with E2 and E3 (a synthesis or vote over several reviewers). E1 as a core behaviour (several vendors attempting the same task in isolation) appears in six of the 28: Voratiq, Trae Agent's mixed setting, Kilo and Cursor for code, and the LLM Council and MoA for answers. Where several attempts exist, a person picks (Kilo, Cursor), a selector picks (Trae Agent), verifier agents rank and one is applied (Voratiq), or a chairman or aggregator writes one answer (LLM Council, MoA). E4 (a person signs off before code) is a core behaviour in LoopTroop and GitHub Agent HQ only, and a partial one in Zenflow and metaswarm. The only tool to have both E4 and a multi-model vote over drafts is LoopTroop, and its vote is over plans, not code.

### Ranking, Part 2: studies and write-ups that measured something close

| Rank | Entry | E1 | E2 | E3 | E4 | E5 | Score | What was compared |
|---|---|---|---|---|---|---|---|---|
| S1 | N-Version Programming with Coding Agents (Ron, Baudry, Monperrus) | Y | Y | - | - | - | 4 | five vendors' agents, one spec, majority voting |
| S2 | Failure independence in LLM-generated code (Nogueira and others) | Y | Y | - | - | - | 4 | twelve models, 224 contest problems, majority voting |
| S3 | Ars Technica Minesweeper test (via a secondary summary) | Y | - | - | - | - | 2 | four vendors' agents, one prompt, scored by the publication |
| S4 | Cross-model code review (Xiang and others) | - | p | p | - | - | 2 | two vendors, each reviewing the other and itself |
| S5 | Greptile "model inversion" | - | - | p | - | - | 1 | two vendors' models reviewing each other's pull requests |
| S6 | One practitioner's hook (Proser) | - | - | p | - | - | 1 | Codex reviewing Claude's diffs; no numbers |

## What the reader searched for and did not find

- A tool or write-up with all five elements: not found (queries 1 to 34, G1 to G16).
- A tool that audits and tests its own multi-model flow with scored runs: not found. Queries 24 ("multi-agent coding framework orchestrator tested with fixture repository hidden tests scores regression suite for the orchestration itself"), G10 and G11 returned nothing of that kind. Nearest: ai-jury (a benchmark with answer keys that runs each reviewer alone against the panel, golden-file tests, a coverage floor, live smoke tests of the real agents); PAL MCP (simulator tests and an activity log); SWE-AF (a one-prompt comparison against single agents); Autopus-ADK (evaluation code, with its own assessment saying the results "are not measured savings"); Voratiq, LoopTroop, Deliberation and Trae Agent (recorded sessions or trajectories); and, outside multi-model flows, AEVAL (anand-2026-aeval, an abstract-only read of a workshop paper on deterministic tests for agent skill workflows that keep the executor apart from the grader). None runs a repeated, scored fixture check of a cross-vendor implementation flow.
- A coding result comparing "one agent reads several candidate patches and writes one" against "pick the best candidate": not found among the tools. Trae Agent, Augment, OpenHands and TreeQuest select; Voratiq has a `reduce` operator that synthesises artifacts but reports no comparison; LoopTroop's winner refines its draft with ideas from the losing drafts, for plans, with no measurement. The only synthesis-versus-selection evidence the reader met is general (MoA, and the Self-MoA snippet).
- A tool combining a person's sign-off on a spec with several vendors' independent implementations and a combined result: not found. LoopTroop has the sign-off and a multi-model vote over drafts but one implementer; Voratiq has multi-vendor implementations, verification and apply but no sign-off in the pages read.
- Practitioner write-ups that merge several vendors' results on the same coding task with numbers: not found. Query 21 ("gave the same task to three different AI models independently then merged the best parts ...") returned papers on merging model weights, not code. Query 11 returned comparisons of single tools. What exists with numbers is on review (ai-jury, Magpie, Greptile, S4) or comparison without merging (S3). Query 23 and the forum index found projects and one thread, not numbers.
- Evidence that mixing vendors beats running one model several times, for implementation: not found, other than the negative signal in Trae Agent's Table 1 and the sequential-pair tables in Aider's posts.

## Not read

- Perplexity Model Council. The vendor's post returned HTTP 403 and a second address 404. From search results only, unverified, snippet only: three models answer in parallel and a separate model reviews and merges the answers; available to Max subscribers on the web.
- GitHub Agent HQ: the claim that one task can be assigned to several agents and compared comes from press coverage in search results (unverified, snippet only); the GitHub pages the reader read do not say it.
- Amp's older news posts on the oracle (o3, then GPT-5, then GPT-5.4): the fetch failed with "Parse Error: Header overflow". Search snippets said the oracle was a different vendor's model than the main agent and that a post gave response-quality and latency figures for GPT-5.4: unverified, snippet only.
- Ars Technica's original article (the fetch tool refused the domain).
- The AWS Builder Center post "Meet Deliberation: 400+ models is easy, knowing which ones earn a place is hard" (the page returned only a header). It may contain a measurement of which models are useful; unknown.
- The ai-jury PyPI page (a JavaScript error), and ai-jury's feasibility and architecture pages (not fetched). VulTrial (ICSE 2026, cited by ai-jury's README, arXiv 2505.10961): not read.
- Self-MoA, "Rethinking Mixture-of-Agents: Is Mixing Different Large Language Models Beneficial?" (arXiv 2502.00674; a search result said it found that aggregating one top model's outputs beat mixing models on AlpacaEval 2.0 and other general benchmarks): snippet only, not read. It bears directly on claim 2 in general (not coding) evidence; the reader expects another package covers it. The MoA paper (arXiv 2406.04692) and the MetaGPT and ChatDev papers were not read.
- Vibe Kanban (28,259 stars), Claude Squad (8,567), Agor (1,423), Munder Difflin (8,375), agmsg (1,539), sno-station (411), parari, CodeAgentSwarm: orchestrators or boards for running several agents, with the person comparing results; seen only in search results and the GitHub search listing (star counts from that listing on 2026-10-04): unverified, snippet only.
- Small repositories from the GitHub searches, seen by name and description only: spyrae/claude-concilium (14 stars), religa/multi_mcp (36), olaservo/mcp-code-crosscheck (the repository address returned 404), hyperb1iss/hyperskills "cross-model-review" (35), atompilot/claude-code-cross-review (0), Shelpuk-AI-Technology-Consulting/lad_mcp_server (22), wolfiesch/omp-best-of (71, best-of-N with a verifier), luigiluft/crossfire (3), drivelineresearch/moa-x (32), usetig/sage (106), sherifkozman/the-llm-council (91), mkritter3/codex-paired-superpowers, Aldenysq/agents-connector, and the HN-listed projects (Zenflow was read; Superset, Ralphex, Quibble, Neal, Cc-doubleteam, Sous-Chef, codex-review were not).
- The forum thread "Ask HN: Does anyone use codex to review Claude's code? What're your experiences?" (2026-05-15, 2 points, 1 comment as listed) and a gist "Have Codex review Claude's work": not opened.
- Spec-driven tools other than Spec Kit (Kiro, BMAD-METHOD, OpenSpec, Tessl): search snippets only.

