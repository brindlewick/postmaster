# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> The conventional approach -- a reasoning model plans, a code specialist implements -- seems natural but fails: on HumanEval+, plan-then-code degrades performance by 2.4 percentage points versus the code specialist alone.

Abstract; not checked (abstract page only; the full text says the same in other words)

> review effectiveness scales with specification richness, yielding 4x more improvement on richly-specified problems (+9.8pp) than on lean ones (+2.3pp), while remaining net-positive in both cases.

Abstract; checked (the full text gave the same words; the HTML prints "4×")

> the same two models on the same hardware achieve 90.2% pass@1 -- exceeding GPT-4o (87.2%) and O1 Preview (89.0%) -- on ~$2/hr of commodity GPU.

Abstract; not checked

> Results are specific to Qwen2.5-Coder-14B + Qwen3-32B; other combinations may differ.

Limitations section, as reported by one fetch of the full text; not checked

> HumanEval+ tests single-function problems, not real-world multi-file development.

Limitations section, as reported by one fetch; not checked

> Review-then-fix requires 2–7 LLM calls per problem vs 1 for single-model generation.

Limitations section, as reported by one fetch; not checked

Setup as reported by one fetch of the full text (not checked): the two models are Qwen2.5-Coder-14B-Instruct (the code specialist) and Qwen3-32B (the reasoning model), both 4-bit AWQ, greedy decoding; HumanEval+ has 164 problems with rich specifications and MBPP+ has 378 with lean ones (542 in all); raw coder baseline 78.0%, plan-then-code 75.6%, review-then-fix without retry 87.8%, with retry 90.2% on HumanEval+. The two fetches of the full text agree that the paper states no number of runs or seeds.
