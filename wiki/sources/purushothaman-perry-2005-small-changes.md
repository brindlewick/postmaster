---
title: "Towards understanding the rhetoric of small source code changes (Purushothaman and Perry, 2005)"
type: source
sources: [papers/purushothaman-perry-2005-small-changes]
updated: 2026-09-26
---

# How often a fix by people brings a new defect

Purushothaman and Perry, IEEE Transactions on Software Engineering, 2005.

**What it claims.** Nearly 40% of the changes made to fix defects introduced one or more other
defects. A one-line change has less than a 4% chance of introducing an error
[@papers/purushothaman-perry-2005-small-changes/passages.md].

**On what evidence.** The change and defect history of one large maintained system. The 40% is
inferred: it is the share of later changes to code touched by a fix that were themselves fixes
[@papers/purushothaman-perry-2005-small-changes/passages.md], not a count of defects traced back
to the fix that caused each one.

**What it would mean here if true.** Fixes made by people are a common source of new defects, so a
review loop that finds most of each round's defects in the last round's fixes is not unusual in
itself. The small-change figure points one way to cut the rate: smaller fixes.

Also found and not captured: Yin and others, "How do fixes become bugs?" (FSE 2011), which reports
that at least 14.8% to 24.4% of sampled fixes for post-release bugs in four operating systems were
incorrect (unverified here: only the abstract page was reachable, through a tool that rewrites
text).

Bears on [when a review loop should stop](../concepts/review-convergence.md).
