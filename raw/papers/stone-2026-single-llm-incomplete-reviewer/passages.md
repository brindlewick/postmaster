# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> using a live software team's corpus with a human-reconciled answer key: 33 code/mixed artifacts, 294 confirmed issues, reviewed by fifteen model versions across eight providers (April to July 2026)

Abstract; checked

> For each artifact we measure per-model recall against the reconciled confirmed-issue set (a deliberately generous denominator)

Abstract; checked

> 56.8% of confirmed defects (167 of 294) were found by exactly one model, cross-family overlap was low (median Jaccard about 0.29), and a permutation null confirms this disjointness is not an artifact of the denominator.

Abstract; checked

> coverage of an artifact's confirmed defects rises from about 47% with one reviewer to about 72% with a second (the largest single step), with diminishing returns after

Abstract (the sentence begins: "Computed within each artifact, among only the reviewers that actually reviewed it,"); checked

> No large-sample model exceeded about 61% recall on code; a typical model caught roughly half of confirmed defects

Abstract; not checked (the first fetch returned "No large-model exceeded")

> We could not establish that repeated passes vary, that newer versions detect more, or any fine ranking among the non-weakest versions, and we decline to assert them.

Abstract; checked

> We recommend running a small panel of two to three independent reviewers (different providers are a sensible default this corpus cannot prove beats re-runs)

Abstract (fragment of a longer sentence); checked

> Conclusions are directional, not a universal benchmark.

Abstract, last sentence; checked

> This version 2 expands the version 1 corpus (18 artifacts, 154 issues, five providers) and incorporates corrections surfaced by additional independent adversarial review, including a within-artifact recomputation of the coverage curve.

Abstract; not checked (one fetch)

The abstract does not give a false-alarm rate, and does not say how the answer key was built beyond "human-reconciled" (an absence, not a quote).
