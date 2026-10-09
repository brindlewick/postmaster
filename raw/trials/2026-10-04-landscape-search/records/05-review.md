# Group 3: multi-agent and adversarial review, and the evidence for independent reviewers: how the entries were found and chosen, what was not read, what was not found

Recorded on 2026-10-04 as the reading of this group was done. First-person wording was made impersonal, the reader standing for the one who read; nothing else was changed.

## How the entries were found and chosen

### Queries

All queries were WebSearch in mode "standard". The reader never needed "extended": the standard results were not thin.
35 queries returned results, each 8 to 10 links (most 9). A 36th was refused because the session's search budget
(200 calls, shared by every reader) had been used up, so the reader could not run any search after that point.

Tools and projects (exact text):
1. Anthropic Claude Code Review multi-agent pull request review team of agents (9 links)
2. Cursor Bugbot parallel passes majority voting how Bugbot works (9)
3. Adversarial Review: Structured Disagreement for Grounded Agentic Code Review arXiv 2608.18167 (9)
4. addyosmani adverse adversarial review agents GitHub (9)
5. alecnielsen adversarial-review GitHub (9; no result was a repository of that owner, see the API result below)
6. GitHub Copilot code review agentic architecture tool calling pull request reviews statistics (10)
7. OpenAI Codex code review GitHub pull requests @codex review how it works (10)
8. CodeRabbit multiple LLMs review pipeline verification agents models used (9)
9. Greptile AI code review benchmark bug catch rate Cursor Copilot CodeRabbit Graphite (9)
10. Qodo code review benchmark multi-agent F1 precision recall PR-Agent (9)
11. Graphite Agent AI code review unhelpful comment rate how it works (9)
12. Codex plugin for Claude Code review openai codex-plugin-cc cross-model code review (9)
13. multi-model code review MCP server consensus codereview tool several LLMs github (9)
14. ng/adversarial-review multi-model adversarial code review Optimizer Skeptic (10)
15. qodo-ai pr-agent open source github repository (10) (positive control, below)
16. zxqvbl frobnitz quorbal multi-agent adversarial reviewer plugin 88412 (9) (negative control, below)
33. Claude Code skill Codex second opinion cross-model review loop GitHub stars gstack /codex review (10)
34. Mozilla.ai Star Chamber multi-LLM consensus code review (9)

Language-model review evidence:
17. SWR-Bench multi-review aggregation LLM code review benchmark F1 improvement independent reviews (9)
18. ensemble of large language models vulnerability detection union of models recall false positives majority voting arXiv (10)
19. different LLMs code review find different bugs overlap complementary union recall multiple models reviewers study (9)
20. Replacing Judges with Juries panel of LLM evaluators PoLL diverse models (9)
21. LLM self-preference bias code review model reviews its own code versus other model's code (9)
29. single LLM misses half of code review defects multi-model panel catches independent study (9)
30. heterogeneous LLM ensemble versus repeated sampling same model code review bug detection diversity different model families (9)
31. multi-agent code review LLM paper reviewers critic verifier recall precision pull request benchmark 2026 arXiv (9)
35. independent researcher multi-model code review study 154 confirmed defects 18 artifacts coverage 33.6% one provider 88.7% four providers (10)

Human inspection and review research:
22. Rigby German Cowen Storey peer review open source software projects parameters statistical models theory number of reviewers (10)
23. Cohen SmartBear Cisco "Best Kept Secrets of Peer Code Review" case study 2500 code reviews defects findings (9)
24. Porter Votta experiment assess different defect detection methods software requirements inspections ad hoc checklist scenario overlap defects found (9)
25. Biffl Halling nominal inspection teams defect detection effectiveness team size cost benefit (9)
26. Martin Tsai N-fold inspection requirements analysis technique independent teams percent of faults found (9)
27. Eick Loader Long Votta Vander Wiel Estimating software fault content before coding inspection reviewers (9)
28. Boehm Basili Software Defect Reduction Top 10 List peer reviews catch 60 percent of the defects (9)
32. Fagan Design and code inspections to reduce errors in program development 1976 IBM Systems Journal pdf (10)
(refused, budget gone) Rigby Bird "Convergent contemporary software peer review practices" two reviewers median number of reviewers FSE 2013

Besides searches the reader used: about 100 WebFetch calls (about 20 of them failed, redirected or returned nothing readable;
about 30 were second fetches with a different prompt to check quotes), 10 raw README reads with curl, and about 40
plain GitHub API reads (`gh api repos/...`, including head commits and latest release). The reader went well past the
suggested 60 fetches: the package covers two bodies of work, and many fetches were failures or checks.

### Selection rule

1. In scope: a tool or project in which several agents, passes, models or vendors review a code change or a plan, or
   its one-reviewer counterpart (PR-Agent, included as the single-call baseline).
2. Use: for repositories, stars and forks from the API as a proxy (kept about 10 stars or more, unless the ticket named
   it); for hosted products, only what the vendor states (quoted).
3. Serious: the pages describe passes, agents or a verification step, or give figures or a method.
4. Maintained: last push within 90 days of 2026-10-04 (since 2026-07-06). This is a flag, not a filter. Passing:
   codex-plugin-cc (2026-07-08), ng/adversarial-review (2026-09-15), PR-Agent (2026-10-04). Failing: adverse
   (2026-06-20), alecnielsen/adversarial-review (2026-01-22), PAL MCP (2025-12-15). The reader kept the three because the ticket
   named two of them and PAL has by far the most stars of any multi-model review server; each is marked.
5. Vendor-backed products in the ticket's list were all read, from the vendor's own pages only. Third-party summaries
   and leaderboards that came up in search (aicodereview.cc, particula.tech, morphllm.com, and similar) were not read.

### Left out, and why
- karpathy/llm-council (25,141 stars, API): general question answering, not code review; another reader captured it.
- garrytan/gstack (134,988 stars, API only): a 23-skill toolkit; one skill asks Codex for a second opinion (search
  snippet only, not read); the stars measure the whole toolkit, not that skill.
- religa/multi_mcp (36 stars, API only, README not read), atompilot/claude-code-cross-review (0 stars, API only),
  peteski22/star-chamber (4 stars; included inside the Star Chamber entry).
- Directory listings of other adversarial-review skills (poteto/noodle, alirezarezvani/claude-skills,
  robertoecf/adversarial-review, yldgio/vibe-grimoire, and others): adoption unknown, not examined.
- Products the reader did not search for: Gemini Code Assist, Amazon Q Developer, Sourcery, Ellipsis, Macroscope, cubic, Bito,
  Kodus. Not looked at for lack of search budget.
- Read and set aside: Argus, a company's internal review harness (see the end of Part 1); SLEAN, a research prototype
  (see Part 2b); arXiv 2508.16419 (three models, 26 samples, no ensemble or overlap data); arXiv 2606.20093 (self-preference
  in instruction-following revision, not code); arXiv 2510.05450 (what kinds of review comments get resolved).

### Controls
- Positive control: query 15 named a repository the reader knows exists (qodo-ai/pr-agent). It came back (the maintained fork
  The-PR-Agent/pr-agent and the old address), and `gh api repos/openai/codex-plugin-cc` returned the repository.
- Negative control: query 16 had four nonsense tokens and two real words. It returned 9 pages, all about adversarial
  review (they match the real words), and none contained a nonsense token; the search tool's own summary said the
  tokens matched no real software. A pure nonsense query would have been cleaner, but the budget ended first.
  `gh api repos/zxqvbl-frobnitz/quorbal-88412` returned 404.
- Another check: query 5 was for alecnielsen/adversarial-review and returned no repository of that owner, yet the
  repository exists (the API returned it, 43 stars). So "not found by search" was wrong for that lead; the API read
  corrected it. Treat every "not found" below as a statement about the reader's search only.

### How hard the reader looked, and where the reader could not
- 35 searches, about 100 fetches, vendor pages, raw READMEs, the GitHub API, arXiv abstract and HTML pages, a preprint
  record, and a scholarly index (OpenAlex) for abstracts.
- The fetch tool cannot read PDFs here: four tries (a Zenodo PDF, the Rigby TOSEM PDF, a Porter-Votta-Basili technical
  report, an arXiv PDF) all returned binary. Publisher pages for ACM returned 403; openai.com returned 403;
  stickyminds returned 403; one Microsoft Research page and one UMIACS page returned 404; one UMIACS host did not
  resolve; a Semantic Scholar API call returned 429 (rate limit). The reader did not look for another route round these.
- So for the human inspection studies the reader read abstracts only (through an index record) and one author's summary page.
- No extended search mode, no Google Scholar, no social media, no video.

## Not read
- Rigby, German, Cowen and Storey 2014 (TOSEM) full text: the fetch tool returned binary for the PDF; ACM returned 403. Abstract
  only, through an index record.
- Rigby and Bird 2013 (FSE) full text: ACM 403, the Microsoft Research page 404. Abstract only. Their reviewer counts are
  therefore not reported here.
- Fagan 1976, "Design and code inspections to reduce errors in program development": not fetched (PDFs unreadable by the
  tool). An index record's abstract field held only a process summary with no figures. A search snippet said 60 to 90 percent
  of defects can be found: unverified, snippet only.
- Eick, Loader, Long, Votta and Vander Wiel 1992: no readable text found in the search results.
- Porter and Votta 1994 (ICSE) and 1998 (EMSE) abstract pages: one host did not resolve, Springer redirected to a sign-in. The
  Porter, Votta and Basili technical report (UMD) is a PDF and returned binary.
- Cohen's "Best Kept Secrets of Peer Code Review": the book PDF was not tried (PDFs unreadable); the stickyminds article
  returned 403. Only SmartBear's own web page was read.
- Biffl and Halling 2003 (nominal inspection teams): snippet only; a search summary said "nominal teams perform significantly
  more effectively than real teams" and that mixing reading techniques beat the best single technique. Unverified, snippet only.
  The reader guessed one DOI and it returned a different paper, which the reader discarded.
- Land et al. 1997, Hatton 2008, the Kantor N-fold paper (a Technion PDF, snippet only: "FDR is primarily a function of the
  level of expertise of the inspectors and of the number of teams"): not read.
- OpenAI's own statement of what Codex review measured: openai.com returned 403.
- Stone 2026 full text (PDF unreadable); SWR-Bench Multi-Agg results (a figure, not in the text); SLEAN full text (HTML 404).
- Snippet only, not read: the "AI code review leaderboard" figure for Copilot (44.5% F1 across 747K reviews) on a third-party
  site; Martian Code Review Benchmark (a third-party benchmark named in the Kumar abstract and in a Qodo search result);
  CR-Bench (arXiv 2603.11078); OpenCodeReview (arXiv 2608.09290); LangChain ReviewBench; arXiv 2509.12629 (ensembling models for
  vulnerability detection); arXiv 2505.17928; Panickssery et al. 2024 (another reader wrote panickssery-2024-self-preference).
- Any search after the search budget ran out, including a second look for human review studies by number of reviewers.

