# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> draw a heterogeneous pool of N=3 candidates per task by sampling one trajectory each from Claude Opus 4.5, Gemini 3 Flash, and MiniMax M2.5

SWE-Bench Verified experiment (fragment of a sentence that begins "We use mini-swe-agent as the scaffold and, in contrast to the homogeneous proposal pool used on Terminal-Bench,"); checked (two reads agree word for word)

> LLM-as-a-Verifier achieves state-of-the-art performance on Terminal-Bench V2 (86.5%), SWE-Bench Verified (78.2%), RoboRewardBench (87.4%), and MedAgentBench (73.3%).

Abstract (v2); not checked (one verbatim read; the 78.2% agrees across reads)

> Claude Opus 4.5 76.8 | Gemini 3 Flash 75.8 | MiniMax M2.5 75.8 | mean Pass@1 76.1 | oracle Pass@3 84.4 | LLM-as-a-Verifier 78.2

Table 3, SWE-Bench Verified % resolved, rows as listed by the fetch tool; checked (two reads give the same numbers)

Verifier and settings: the verifier on SWE-Bench Verified is Gemini 2.5 Flash (checked, two reads agree); granularity G=20, K=8 repeated evaluations and three criteria are from one read (not checked). The text read has no majority-vote or discrete-judge baseline and no same-model pool on SWE-Bench Verified; on Terminal-Bench the pool is five trajectories from one model (GPT-5.5) and the verifier is the same Gemini 2.5 Flash (one read).

