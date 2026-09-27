---
title: "Models cannot reliably identify and reason about security vulnerabilities, yet (Ullah and others, 2024)"
type: source
sources: [papers/ullah-2024-llm-vulnerabilities]
updated: 2026-09-26
---

# Models' false positives, and answers that change between runs

Ullah, Han, Pujar, Pearce, Coskun and Stringhini, IEEE Symposium on Security and Privacy, 2024.

**What it claims.** Models give different answers to the same question on different runs, their
reasoning is often wrong or unfaithful, and every model tested had a high false positive rate,
flagging code whose vulnerability had been patched as still vulnerable
[@papers/ullah-2024-llm-vulnerabilities/passages.md].

**On what evidence.** 228 code scenarios and eight models, tested along eight dimensions
[@papers/ullah-2024-llm-vulnerabilities/passages.md]. The task is judging whether a code
scenario is vulnerable, not reviewing a change.

**What it would mean here if true.** A fresh reviewer is a fresh sample: it will report some things
the last reviewer did not, and some that are not there. Flagging patched code as still vulnerable
is exactly the error that would make a closure check report a fix as not closed.

Bears on [when a review loop should stop](../concepts/review-convergence.md).
