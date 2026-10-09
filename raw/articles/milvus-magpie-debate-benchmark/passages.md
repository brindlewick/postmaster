# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> The best-performing model caught only 53% of known bugs.

Introduction; checked (two reads give the same sentence)

> after five rounds of adversarial debate, bug detection jumped to 80%.

Introduction (fragment of a longer sentence; the first read gave "bug detection jumped to 80%"); checked

> The dataset consists of 15 pull requests from Milvus

Test set (fragment; the page then gives L2 with 10 cases and L3 with 5 cases, and says L1 bugs visible in the diff alone were excluded from scoring); checked (two reads agree on 15 PRs, 10 L2 and 5 L3)

> The sample size is small. There are only 15 PRs, all from the same Go/C++ project (Milvus)

Caveats (fragment; one read); not checked

> The numbers in this post are a single snapshot, not a stable expected value.

Caveats (one read); not checked

Raw-mode detection table as printed in the reads (L2 and L3 bugs only; both reads agree): Claude 53%, Gemini 13%, Codex 33%, MiniMax 27%, Qwen 33%. The first read also gave a context-assisted row (Claude 47%, Gemini 33%, Codex 27%, MiniMax 33%, Qwen 40%); the second read did not repeat it; not checked. Models as named in the reads: Claude Opus 4.6, Gemini 3 Pro, GPT-5.2-Codex, Qwen-3.5-Plus, MiniMax-M2.5. The second read said that in round 1 each model reviews the same pull request independently and that the debate runs to round 5; whether the debate had the same surrounding-code context as the context-assisted single runs was not established by the reads.
