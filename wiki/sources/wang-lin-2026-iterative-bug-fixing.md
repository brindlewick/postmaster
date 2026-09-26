---
title: "If it's not buggy, don't fix it: iterative bug-fixing with models (Wang-Lin, Isopoussu and Mahon, 2026)"
type: source
sources: [papers/wang-lin-2026-iterative-bug-fixing]
updated: 2026-09-26
---

# What happens when models review and fix the same code over and over

Wang-Lin, Isopoussu and Mahon, a preprint of September 2026, under CC BY 4.0.

**What it claims.** When a model reviews and fixes the same code round after round, with no memory
of earlier rounds, it claims bugs in programs that have none, it damages correct programs faster
than it repairs incorrect ones, and it often settles into a cycle that adds and removes the same
change [@papers/wang-lin-2026-iterative-bug-fixing/passages.md].

**On what evidence.** Two small models on the same 20 competitive-programming problems, 40 submitted
C++ programs each, for up to 100 turns
[@papers/wang-lin-2026-iterative-bug-fixing/passages.md]. With single search-and-replace edits at
temperature 0, starting from correct code, one model turned correct code incorrect at 0.293 per
step and incorrect code correct at 0.062; with whole-file rewrites the two rates were closer
[@papers/wang-lin-2026-iterative-bug-fixing/passages.md].

**Limits.** Small models, single-file programs, and a blind loop, with no history of earlier rounds
and no goal [@papers/wang-lin-2026-iterative-bug-fixing/passages.md].

**What it would mean here if true.** A loop run long enough can make correct code worse, and "until
no more bugs are found" may never arrive, because a model reviewer can always find something. The
coachman's loop differs in ways that should help: stronger models, findings verified before
anything is fixed, and briefs that carry the history of earlier rounds. So the paper's damage rate
is the risk the verification step exists to cut, not a rate measured for this flow.

Bears on [when a review loop should stop](../concepts/review-convergence.md).
