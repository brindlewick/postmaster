---
title: "Code reviews do not find bugs (Czerwonka, Greiler and Tilford, 2015)"
type: source
sources: [papers/czerwonka-2015-code-reviews]
updated: 2026-09-26
---

# What people's review comments are about

Czerwonka, Greiler and Tilford, a two-page industry paper from Microsoft, 2015.

**What it claims.** About 15% of reviewers' comments point to a possible defect, and at least 50%
concern long-term maintainability. A reviewer new to the code has 33% of their comments judged
useful by the change's author, rising to about 67% by their third review of the same code. Review
usefulness falls once a review holds 20 or more changed files
[@papers/czerwonka-2015-code-reviews/passages.md].

**On what evidence.** Microsoft's review data, summarised without a method section. The figures
are the authors' report, not a study that can be checked from the paper.

**What it would mean here if true.** Most of what people say in review is not about defects. A
loop that ends only when a round returns no findings at all waits for something that review rarely
produces, by people or by models. It also suggests a reviewer who has seen the code before is more
useful than a fresh one; the loop uses fresh reviewers each round on purpose, for independence, and
pays for it.

Bears on [when a review loop should stop](../concepts/review-convergence.md).
