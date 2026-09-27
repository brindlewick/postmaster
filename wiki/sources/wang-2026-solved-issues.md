---
title: "Are solved issues in SWE-bench really solved correctly? (Wang, Pradel and Liu, 2026)"
type: source
sources: [papers/wang-2026-solved-issues]
updated: 2026-09-26
---

# A patch that passes its tests can still be wrong

Wang, Pradel and Liu, ICSE 2026.

**What it claims.** Of the patches agents wrote that passed the benchmark's tests, 29.6% behave
differently from the developers' own patch, and 28.6% of those are certainly incorrect
[@papers/wang-2026-solved-issues/passages.md]. Together that is about 8% of passing patches
certainly incorrect (computed here from the two figures).

**On what evidence.** Patches from three issue-solving tools on SWE-bench Verified, compared with
the developers' patches by generated differential tests and by manual inspection
[@papers/wang-2026-solved-issues/passages.md].

**What it would mean here if true.** A fix written by a model that passes its checks can still be
wrong. The loop's closure check asks whether each fix holds; a fix whose closure rests on a test
passing, rather than on the behaviour the finding described, may not.

Bears on [when a review loop should stop](../concepts/review-convergence.md).
