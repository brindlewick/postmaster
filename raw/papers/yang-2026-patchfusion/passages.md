# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> a deterministic atomic evidence fusion approach for candidate patches that consults no test outcome at decision time

Abstract (fragment); checked (the abstract listing and a full-text read agree)

> Once correct patches already populate the pool, handing the decision to a strong generator is therefore worse than a deterministic selector: generation adds format errors, hallucinated edits, and the risk of overwriting an available fix.

Section V-A1; checked (two reads agree; the first read gave the first half)

Table data as rendered by the fetch tool (not a sentence quote): Best single source 396 | 218 | 62 || Token medoid 403 | 219 | 73 || Agentless (test-based) 392 | 222 | 84 || DeepSeek-V4-Pro listwise 396 | 214 | 74 || DeepSeek-V4-Pro fusion 317 | 183 | 40 || PatchFusion 426 | 236 | 87

Table II, bugs solved on SWE-bench Verified (500) | SWE-bench Multilingual (300) | Defects4J (371, plausible patches), rows as listed by the fetch tool; checked (two reads give the same numbers)

> without ECF 421/500 | 230/300 | 78/371 || with ECF 426/500 | 236/300 | 87/371

Table V (ablation of evidence-constrained fusion), as listed by the fetch tool; checked (two reads give the same numbers)

> reaches the candidate-reachable ceiling (443 and 263 on the two SWE-bench pools)

Section V, definition of the ceiling (fragment of "A post-hoc oracle that keeps, for each bug, a candidate carrying the official solved label ..."); checked for the numbers (two reads agree on 443 and 263); the sentence is from one read

> Complementarity does not require diverse systems: one model's pass@10 sampling already fuses, lifting the single-model pool from 62 to 87.

RQ-4; not checked (one read)

Reading of the setup (a paraphrase, not a quote; first read, not checked): the Verified pool comes from six leaderboard entries (including Live-SWE-agent with Claude Opus 4.5 and Gemini 3 Pro Preview, TRAE with Doubao-Seed-Code, Atlassian Rovo Dev, EPAM AI/Run with Claude 4 Sonnet, ACoder), the Multilingual pool from seven systems (Gemini 3 Flash, Claude Opus 4.6, Claude Opus 4.5, GLM-5, Gemini 3 Pro, MiniMax 2.5, Kimi K2.5), the Defects4J pool from ten samples of one model. The free-form fusion baseline used DeepSeek-V4-Pro at temperature 0 with JSON output, was asked to emit a final patch rather than select one, and saw the candidates in hash order; Table III counts for it on Verified: 96 non-applying diffs, 92 new failing patches, 87 copies of an existing candidate (the counts agree across two reads). Pooled paired sign tests at p<0.05 are reported against the nine test-free selectors (one read).

