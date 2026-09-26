---
title: "Measuring determinism in models for code review (Klishevich and others, 2025)"
type: source
sources: [papers/klishevich-2025-review-determinism]
updated: 2026-09-26
---

# The same review, repeated, comes out different

Klishevich, Denisov-Blanch, Obstbaum, Ciobanu and Kosinski, a preprint of February 2025.

**What it claims.** Repeating the same code review five times, at temperature zero and with a
cleared context, gave different assessments, to a degree that varied by model. The authors suggest
this variability may be comparable to how much expert raters differ
[@papers/klishevich-2025-review-determinism/passages.md].

**On what evidence.** Four models reviewing 70 Java commits
[@papers/klishevich-2025-review-determinism/passages.md]. It measures scores given to fixed
questions about each commit, not lists of findings, so it bears on consistency, not on what a
review finds.

**What it would mean here if true.** A reviewer lane is a sample, not a measurement: the same model
on the same snapshot would not return the same review twice. A round that finds nothing may say
more about the draw than about the code, and a round that finds something new may too.

Bears on [when a review loop should stop](../concepts/review-convergence.md).
