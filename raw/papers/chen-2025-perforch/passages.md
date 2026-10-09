# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool
that returns the page as text. Only the passages the report relies on are kept. Each passage
names its section, table or page.

> exhibit complementary strengths: no single model dominates across all programming languages, algorithmic problem categories, or development stages

Abstract (fragment of "We observe that different LLMs ..."); checked (two reads agree on this wording)

> improving over the strongest single-model pipeline by 1.22-14.58 percentage points across languages

Abstract (fragment); checked for the numbers (the abstract listing and the first read's table agree on +1.22 for Python on HumanEval-X and up to +14.58)

> matching the refinement coverage of exhaustive multi-model evaluation at roughly half the token cost

Abstract (fragment); not checked (one verbatim read of the abstract; another read worded it "PerfOrch matches refinement coverage of exhaustive multi-model evaluation at roughly half the token cost")

> Memory rankings constructed solely from HumanEval-X profiling generalize to

Abstract (fragment; the sentence continues "the entirely unseen EffiBench-X benchmark without re-profiling"); checked for the fragment (two reads agree)

> A solution is accepted only when the process exits with code 0 (all assertions pass)

Acceptance rule (second read); not checked (one read)

> the full evaluation test cases

Evaluation setup (fragment; both reads add that they are "entirely hidden from the LLM during coding processes", and the third read says they decide the reported pass@1); checked (two reads agree on the fragments)

> The agent invokes one generation model per attempt and moves to the next-ranked generator only after all debugging candidates for the current generator's output are exhausted.

Sequential fallback over ranked generators (third read); not checked (one read)

> Memory rankings are constructed exclusively from HumanEval-X profiling; EffiBench-X is entirely unseen during this process

Evaluation setup (fragment; the second read continues ", enabling a direct test of generalization"); checked (two reads agree)

> The full HumanEval-X problem set (164 problems per language) is used to construct the agent-specific memory rankings

Evaluation setup (the third read continues "...and to evaluate in-distribution performance"); checked for this part (two reads agree)

> Notably, Qwen's strong EffiBench-X correctness comes at substantially higher token cost, on most languages exceeding even PerfOrch's multi-model budget.

Cost discussion; not checked (one read)

> Majority voting (3 models) 97.56% | 84.76% || Per-stage pairing 98.17% | 85.98% || Per-stage and per-category 98.17% | 88.41%

Table 3 (preliminary study, Python | Rust pass@1), as listed by the fetch tool; not checked (one read)

> HumanEval-X Python: PCG+Qwen 98.17% || PerfOrch 99.39%

Table 9 (best single-model pipeline against PerfOrch); the Python cell agrees across two reads; other cells differ between the reads and are not kept

Reading by the fetch tool (a paraphrase, not a quote). Second read: the single-model baseline PerfCodeGen uses one fixed model across the three stages with one attempt per stage. Third read: PerfCodeGen is "a single-model generate→fix→refine pipeline" that also debugs with failed-test execution traces against the same evaluation test cases. The third read is the more specific, so both pipelines use the tests as feedback, and PerfOrch can in addition move to the next-ranked generator when debugging for the current generator's output is exhausted (up to five ranked models per stage). The rankings were built from the HumanEval-X problems, which are also evaluated in-distribution, while EffiBench-X is held out. No same-model multi-agent baseline; single run with deterministic decoding; no confidence intervals. Not checked.

