---
title: "On the unreliability of bug severity data (Tian, Ali, Lo and Hassan, 2016)"
type: source
sources: [papers/tian-2016-severity]
updated: 2026-09-26
---

# People disagree on severity

Tian, Ali, Lo and Hassan, Empirical Software Engineering, 2016.

**What it claims.** People give one problem different severities. Around 51% of duplicate bug
reports carry inconsistent severity labels: 28.9%, 36.6% and 50.8% in OpenOffice, Mozilla and
Eclipse. If people cannot agree on a severity, a model should not be expected to do better
[@papers/tian-2016-severity/passages.md].

**On what evidence.** Duplicate reports, which by definition describe one problem. A manual check
of 437 duplicate buckets, 1,394 reports, found that 95% describe the same problem
[@papers/tian-2016-severity/passages.md], so most of the disagreement is about severity, not about
which problem it is.

**What it would mean here if true.** A severity label from one reviewer is a noisy measurement,
even from a person. A rule that ends the loop on "no new P1 or P2" depends on that label. In the
review of #36, the labels split on 3 of the 9 findings that more than one reviewer made
([run record](2026-09-26-postmaster-36.md)).

Bears on [when a review loop should stop](../concepts/review-convergence.md).
