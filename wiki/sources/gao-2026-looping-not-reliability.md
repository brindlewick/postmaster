---
title: "Looping is not reliability (Gao, Yang and Yang, 2026)"
type: source
sources: [papers/gao-2026-looping-not-reliability]
updated: 2026-09-26
---

# More revision rounds can undo a correct fix

Gao, Yang and Yang, a workshop paper at AgenticDev 2026, under CC BY 4.0.

**What it claims.** Repeating a generate, test and revise loop gives no guarantee of reliability.
Forcing a second revision lowered the share of programs that were correct from 0.820 after one
revision to 0.673 after two, while the share that had been correct at some point rose to 0.847. A
second model is not automatically an independent judge of the first
[@papers/gao-2026-looping-not-reliability/passages.md].

**On what evidence.** A study with five seeds over 30 HumanEval repairs, 900 trajectories of three
revisions each [@papers/gao-2026-looping-not-reliability/passages.md]. The caution about a second
model is drawn from the work it cites, not measured in this paper.

**What it would mean here if true.** Another round can break a fix that was right, so a loop needs
a way to keep a verified state rather than revise it again. And model B checking model A is not an
independent check when the two share a vendor, which is how the review of #36 ran.

Bears on [when a review loop should stop](../concepts/review-convergence.md).
