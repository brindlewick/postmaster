---
title: "The impact of design and code reviews on software quality (Kemerer and Paulk, 2009)"
type: source
sources: [papers/kemerer-paulk-2009-review-rate]
updated: 2026-09-26
---

# Review rate and what one review finds

Kemerer and Paulk, IEEE Transactions on Software Engineering, 2009.

**What it claims.** How fast a person reviews decides how many defects the review removes. At 200
lines an hour or less, one review found nearly two-thirds of the defects in design reviews and more
than half of the defects in code reviews
[@papers/kemerer-paulk-2009-review-rate/passages.md].

**On what evidence.** Two data sets of 371 and 246 programs from the Personal Software Process,
analysed with regression and mixed models, controlling for the developer's ability. The reviews
are the steps a developer performs in an inspection, done in the Personal Software Process
[@papers/kemerer-paulk-2009-review-rate/passages.md], so they measure one person's review, not a
team's.

**What it would mean here if true.** Even a careful review by a person leaves about half the
defects in code behind. So when people re-review until the reviewer has no more comments, the end
comes from the reviewer's time and attention, not from the defects running out. "No more
comments" was never strong evidence of no defects, for people either.

Bears on [when a review loop should stop](../concepts/review-convergence.md).
