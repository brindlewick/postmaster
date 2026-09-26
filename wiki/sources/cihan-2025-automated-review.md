---
title: "Automated code review in practice (Cihan and others, 2024)"
type: source
sources: [papers/cihan-2025-automated-review]
updated: 2026-09-26
---

# A model reviewer in one company

Cihan, Haratian, İçöz, Gül, Devran, Bayendur, Uçar and Tüzün, a preprint of December 2024 on one
company's use of a model-based review tool.

**What it claims.** 73.8% of the tool's comments were marked resolved. The other 26.2% were not
acted on, as too trivial, unrelated, or not a problem for the pull request. Pull requests took
longer to close, from five hours 52 minutes to eight hours 20 minutes on average. Its drawbacks
included faulty reviews, unnecessary corrections and irrelevant comments, and people who used it
said it suggested fixes outside the task's scope and "mistakes" that were not mistakes
[@papers/cihan-2025-automated-review/passages.md].

**On what evidence.** 4,335 pull requests in three projects, 1,568 of them reviewed by the tool,
with surveys of the people involved [@papers/cihan-2025-automated-review/passages.md]. "Resolved"
is a label the developers chose, not a check that the comment was right.

**What it would mean here if true.** About one comment in four is not worth acting on, even in a
team that adopted the tool. Suggestions outside the task's scope are a named complaint, which
bears on keeping older problems out of the loop.

Bears on [when a review loop should stop](../concepts/review-convergence.md).
