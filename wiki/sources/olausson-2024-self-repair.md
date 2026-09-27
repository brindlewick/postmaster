---
title: "Is self-repair a silver bullet for code generation? (Olausson and others, 2024)"
type: source
sources: [papers/olausson-2024-self-repair]
updated: 2026-09-26
---

# Repair is only as good as the feedback

Olausson, Inala, Wang, Gao and Solar-Lezama, ICLR 2024.

**What it claims.** Once its cost is counted, a model repairing its own code gains little, the gains
vary a lot, and sometimes there are none. The limit is the quality of the feedback: with feedback
from a stronger model, the gains are much larger
[@papers/olausson-2024-self-repair/passages.md].

**On what evidence.** Three models repairing their own code on HumanEval and APPS problems
[@papers/olausson-2024-self-repair/passages.md].

**What it would mean here if true.** In the loop, a finding is the feedback a fix is made from. A
finding that carries its evidence, such as a reproduction, is better feedback than a finding that
carries only a label, and should give better fixes and fewer new defects in them.

Bears on [when a review loop should stop](../concepts/review-convergence.md).
