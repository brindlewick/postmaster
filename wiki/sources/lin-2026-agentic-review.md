---
title: "Is agentic code review helpful? (Lin, Liang, Thongtanunam and Tantithamthavorn, 2026)"
type: source
sources: [papers/lin-2026-agentic-review]
updated: 2026-09-26
---

# How developers answered an agent's review comments

Lin, Liang, Thongtanunam and Tantithamthavorn, a preprint of July 2026.

**What it claims.** Of an agent's review comments, 36.4% were accepted, 7.3% led to discussion and
56.3% were rejected, mostly as false positives, redundant or out of scope. Its comments on
behaviour were more likely to be invalid than its comments on maintainability
[@papers/lin-2026-agentic-review/passages.md].

**On what evidence.** 31,073 pairs of review comment and developer response, from 10,191 pull
requests in 239 repositories [@papers/lin-2026-agentic-review/passages.md]. A rejection is the
developer's call, which can be wrong in either direction.

**What it would mean here if true.** Most of a model reviewer's comments may not survive the
judgement of the people who own the code, and the comments about behaviour, the ones a gating lens
exists for, fared worst. In the review of #36 the coachman accepted 46 of 48 distinct findings
([run record](2026-09-26-postmaster-36.md)), a gap this one record cannot explain.

Bears on [when a review loop should stop](../concepts/review-convergence.md).
