---
title: "Capture-recapture in software inspections (Petersson, Thelin, Runeson and Wohlin, 2004)"
type: source
sources: [papers/petersson-2004-capture-recapture]
updated: 2026-09-26
---

# Capture-recapture in software inspections

Petersson, Thelin, Runeson and Wohlin, Journal of Systems and Software, 2004. A survey of ten years
of work on estimating what an inspection left unfound.

**What it claims.** The faults that independent reviewers found overlap, and the size of the
overlap estimates how many faults the document still holds: a large overlap means few are left, a
small one many [@papers/petersson-2004-capture-recapture/passages.md]. The estimate is meant to
decide whether to inspect again, and should not decide it alone.

**On what evidence.** The studies it surveys agree that at least four to five reviewers are needed
for acceptable accuracy, that with four or more one estimator (Mh-JK) does best, that with few
reviewers the results are ambiguous, and that most estimators underestimate
[@papers/petersson-2004-capture-recapture/passages.md]. The method assumes the reviewers work
independently of each other.

**What it would mean here if true.** Reviewer lanes already work in blinkers, each in its own
scratch, so every round of the loop produces the overlap the method needs, at no extra cost. A loop
could stop when the estimate of serious findings still unfound drops below one. Against that: the
loop runs two lanes, not four or five, and two lanes from one vendor may share blind spots, which
would make the overlap larger and the estimate smaller than the truth (unverified here).

Bears on [when a review loop should stop](../concepts/review-convergence.md).
