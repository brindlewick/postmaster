# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> Surprisingly, we find that while each approach individually saturates around 42-43%, significantly higher gains can be obtained by leveraging their complementary strengths.

Abstract; not checked (one verbatim read)

> our hybrid approach demonstrates substantially superior scaling properties, yielding significant performance improvements (additional 7-8%)

Section 4.3 (fragment); checked (two reads agree word for word)

> R2E-Gym (Pass@1) 34.4 | R2E-Gym (Best@16 w/ Hybrid) 49.4 | R2E-Gym (Best@26 w/ Hybrid) 51.0 | Claude + Tools (Claude-3.7-Sonnet) 62.3 | Claude + Tools (Best@Any) 70.3

Table 4, SWE-bench Verified % resolved, rows as listed by the fetch tool; checked for 34.4 and 51.0 (the abstract and a read agree); the other rows are not checked (one read)

> Surprisingly, the final Best@26 drops from 42.8% to 37.6% when we remove the trajectory from the verifier input (i.e., only use the final patches).

Section 4.2; not checked (one verbatim read, another a close paraphrase)

> we first use the trajectories collected for code-editing agent training

Verifier training (fragment); not checked (one read). The same read says the execution-free verifier is Qwen2.5-Coder-14B and the testing agent Qwen-Coder-32B, both from the agent's model family.

