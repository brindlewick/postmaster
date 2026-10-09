# Group 6: tests of the orchestration itself: how the entries were found and chosen, what was not read, what was not found

Recorded on 2026-10-04 as the reading of this group was done. First-person wording was made impersonal, the reader standing for the one who read; nothing else was changed.

## How the entries were found and chosen

### Queries (all WebSearch, mode "standard"; results per query in brackets)

35 queries returned results. Three more were refused because the session's web-search budget (200 calls, shared with other work) had run out; they are listed after the 35.

1. `Terminal-Bench benchmark agents command line harness comparison same model` [9]
2. `Why Do Multi-Agent LLM Systems Fail? MAST taxonomy Cemri` [9]
3. `MultiAgentBench MARBLE evaluating collaboration and competition of LLM agents` [9]
4. `benchmark multi-agent software development systems ChatDev MetaGPT DevBench ProjectEval evaluation` [9]
5. `Anthropic "How we built our multi-agent research system"` [9]
6. `Cognition "Don't Build Multi-Agents" Walden Yan` [9]
7. `Cursor scaling long-running autonomous coding agents hundreds of agents browser` [10]
8. `Building a C compiler with a team of parallel Claudes Anthropic engineering` [9]
9. `Claude Code agent teams documentation orchestrate teams of Claude Code sessions` [9]
10. `OpenAI harness engineering leveraging Codex in an agent-first world` [10]
11. `single-agent versus multi-agent coding equal token budget comparison study` [9]
12. `SWE-bench: Can Language Models Resolve Real-World GitHub Issues?` [9] (positive control)
13. `zxqvortlebrix frumpulent quillborne orchestration benchmark qwplm` [9] (negative control)
14. `same model different agent scaffold SWE-bench Verified resolve rate comparison scaffolds OpenHands SWE-agent Agentless` [10]
15. `Holistic Agent Leaderboard HAL scaffolds same model evaluation reliability` [9]
16. `Towards a science of scaling agent systems multi-agent coordination degrade sequential tasks` [9]
17. `multi-agent coding benchmark parallel agents same repository merge conflicts evaluation 2026` [9]
18. `Agentless Demystifying LLM-based software engineering agents simple pipeline outperforms agents SWE-bench Lite` [10]
19. `mini-swe-agent bash only SWE-bench leaderboard same minimal scaffold across models` [10]
20. `CooperBench why coding agents cannot be your teammates yet` [9]
21. `Anthropic harness design for long-running application development planner generator evaluator solo agent comparison` [9]
22. `Cognition multi-agents what's actually working Devin follow-up to Don't Build Multi-Agents` [10]
23. `Rethinking the value of multi-agent workflow strong single agent baseline` [9]
24. `Aider architect editor mode benchmark separating code reasoning and editing results` [10]
25. `DeepSWE measuring frontier coding agents original long-horizon engineering tasks harness comparison` [10]
26. `SWE-bench Pro same model three scaffolds differ by 17 issues 731 problems agent framework matters` [9]
27. `Anthropic quantifying infrastructure noise in agentic coding evals Terminal-Bench resource limits` [9]
28. `multi-agent vs single-agent software engineering SWE-bench empirical study does adding agents help` [9]
29. `ChatDev MetaGPT compared with single LLM baseline end-to-end software development benchmark results` [9]
30. `Do More Agents Help? Controlled and Protocol-Aligned Evaluation of LLM Agent Workflows` [10]
31. `test our own agent orchestration fixture repository hidden tests scored regression multi-agent coding flow open source` [9]
32. `benchmark agent teams subagents coding parallel decomposition orchestrator evaluation arXiv 2026 multi-agent underperforms single agent` [9]
33. `A Comprehensive Empirical Evaluation of Agent Frameworks on Code-centric Software Engineering Tasks` [9]
34. `Dissecting the SWE-Bench Leaderboards profiling submitters and architectures` [9]
35. `Terminal-Bench 2.0 leaderboard tbench.ai Terminus harness agents models` [9]

Refused for budget (no results): `Cursor blog long-running agents planners workers follow-up self-driving codebase 2026 multi-agent harness`; `published results our multi-agent orchestrator versus single agent same model SWE-bench or hidden tests coding orchestration evaluation 2026`; `same model different harness Claude Code Codex CLI Gemini CLI comparison hidden tests benchmark harness effect 2026 study`.

Other reading: about 104 WebFetch calls (abstract pages, HTML full text, vendor pages, index pages, venue pages), 2 raw README downloads with curl, GitHub API reads for 13 repositories. That is well over the guide of about 60 fetches; most of the excess was second reads to check quotes (see the capture files, where each passage is marked checked or not checked).

### Selection rule

1. Every lead in the ticket: find its primary page and read it. All were found and read except the OpenAI post (refused, HTTP 403) and the full text of the Terminal-Bench paper (see Not read).
2. "Most used": a benchmark or harness that other entries use as their yardstick. SWE-bench (Lite, Verified, Pro) and Terminal-Bench recur in Agentless, HAL, Kim et al., Yin et al., the infrastructure-noise post and the DeepSWE post. GitHub stars where a repository exists are given for each (no cut-off; all are reported).
3. "Most serious": publishes its method and numbers, and either holds the model fixed across compared setups, matches a budget, is peer reviewed (NeurIPS 2025, ICLR 2026, ACL 2025, ICLR 2024, ICSE-SEIP 2026) or releases traces and code.
4. Newer than the ticket's leads: everything from March to October 2026 that the reader could find (BenchAgent, ClawArena-Team, DeepSWE, CAID version 2, AgentRoom, Terminal-Bench 2.1, 3.0 and 4.0, Kim et al. version 3, Cognition's April 2026 follow-up, Anthropic's March 2026 harness post).
5. Left out: aggregator pages and blogs that restate numbers (kept under Not read where the reader saw a claim in a snippet); papers that present a new multi-agent method with its own results but no test of orchestration (Agyn, AgileCoder, EvoMAC and similar); the original ChatDev and MetaGPT papers (the MAST paper measures how those systems fail).

### Controls

- Positive: query 12 is the SWE-bench paper's title. It returned arXiv 2310.06770 first among nine results; the reader then read it (entry below).
- Negative: query 13 is a nonsense string. It returned nine results and none was relevant (German news-briefing pages, music-library and band-repertoire pages).

### How hard the reader looked, and where the reader could not

35 searches, all "standard": 22 by a known title or lead name, 12 by concept without a known title (harness comparisons, equal budgets, parallel agents on one repository, projects testing their own orchestration), and 1 nonsense control. Could not look: the search budget ran out before queries on Cursor follow-up posts, on projects that publish tests of their own orchestration (only query 31 covers this) and on 2026 same-model harness comparisons, so "not found" for those is weak. openai.com refused every fetch. The Terminal-Bench leaderboard and the Harbor Hub leaderboard need JavaScript. The arXiv text of the Terminal-Bench paper reached the reader's fetch tool as a title block and contents list. The SWE-bench "bash only" page returned 404. Not searched at all: social media, Hacker News, issue trackers, Semantic Scholar, non-English sources.

## Not read

- OpenAI, "Harness engineering: leveraging Codex in an agent-first world": four address variants returned HTTP 403 (openai.com/index/harness-engineering/, www.openai.com/index/harness-engineering, openai.com/blog/harness-engineering, openai.com/en/index/harness-engineering/). Search snippets and secondary write-ups say five months, about one million lines, no manually written code and 3.5 pull requests per engineer per day: unverified, snippet only.
- Terminal-Bench paper body and the tbench.ai and Harbor Hub leaderboards: the arXiv text reached the reader's fetch tool as title block and contents only; the leaderboards need JavaScript. The reader did not read the paper's results tables or limitations.
- SWE-bench "bash only" leaderboard page: 404; the swebench.com home page was truncated before any table.
- Secondary posts on Terminal-Bench and harness effects (for example a claim that GPT-5.5 scores 83.4% in Codex CLI and 76.40% in Terminus 2, and "a 16-point swing from scaffolding"): unverified, snippet only; the reader could not trace them to a leaderboard.
- A claim that Claude Opus 4 scores 64.9% on GAIA in one scaffold and 57.6% in another, attributed to HAL by a secondary article: unverified, snippet only; not found in the HAL text the reader read.
- A claim that three agent frameworks with one model scored 17 issues apart on 731 problems (a glossary page): unverified, snippet only; no primary found; the SWE-bench Pro paper was not opened.
- A claim that Warp first tried multi-agent designs and found a single primary agent most reliable on SWE-bench Verified: unverified, snippet only.
- A claim that OpenAI adopted Agentless to show GPT-4o and o1 coding performance (an aggregator page): unverified, snippet only.
- Papers seen only as titles or snippets: Agyn (2602.01465), SWE-Dev (2505.16975), AgileCoder (2406.11912), EvoMAC and rSDE-Bench (2410.16946), MetaGPT (2308.00352), ChatDev (2307.07924), UA-ChatDev (2607.02186), E2EDev (2510.14509), RPG (2509.16198), Confucius Code Agent (2512.10398), "Unlocking Model Potentials Through Adaptive Multi-Agent Scaffolding for Efficient Issue Resolution" (2606.25514), the survey "From Question Answering to Task Completion: A Survey on Agent System and Harness Design" (2606.20683), Tmax (2606.23321), ProgramBench (2605.03546). The snippet for "Rethinking the Value of Multi-Agent Workflow: A Strong Single Agent Baseline" (2601.12307) says a single agent can reach the performance of homogeneous workflows and match an automatically optimized heterogeneous one across seven benchmarks including coding; it bears directly on the equal-cost question and deserves a full read (unverified, snippet only).
- Anthropic posts listed on the engineering index (capture anthropic-engineering-index) but not read: "Scaling Managed Agents: Decoupling the brain from the hands" (2026-04-08), "Effective harnesses for long-running agents" (2025-11-26), "Eval awareness in Claude Opus 4.6's BrowseComp performance" (2026-03-06). Cursor posts after January 2026: the index returned only the 12 newest posts and the search budget ran out.
- The ICLR 2026 listing for CooperBench (snippet only); Aider's benchmark definition (the number of exercises was not in the text returned); HAL's per-model per-scaffold SWE-bench Verified Mini scores; MAST's per-category failure shares (the versions disagree and the reader could not verify the v3 numbers by two fetches).

