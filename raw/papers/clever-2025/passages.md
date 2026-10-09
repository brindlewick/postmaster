# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

When the model has to write the specification itself and prove it equivalent to a held-out reference, and then write and prove the implementation, almost nothing gets through in Lean: the best end-to-end result was 1 problem of 161.

## measured

- TASK: two certification tasks. (1) Specification: the model writes a Lean specification and proves it equivalent to a hidden ground-truth specification; (2) implementation: the model writes a Lean implementation for a given signature and proves it satisfies the ground-truth specification. Everything checked by Lean's kernel (HTML read, Figure 1, Section 2).
  - SIZE: 161 problems derived from HumanEval (3 of 164 excluded). Authors' proofs ran 10 to 225 lines.
  - SPECIFICATION AUTHOR: people. "writing a formal specification took annotators 25 minutes per problem on average, with an additional 15 minutes spent reviewing each other's specifications" (Section 2, as read). Specifications are non-computable logical propositions so a model cannot copy the logic of a reference implementation; no tests, no model-written annotations.
  - WHAT SUCCESS MEANS: both proofs compile and pass Lean's kernel; no `sorry` or added axioms in successful proofs (as read). This is the strictest success definition among the benchmarks read so far, because "the specification is right" is defined by a held-out reference and checked by proof.
  - MODELS AND NUMBERS (Table 1 as read, "pass@k-seconds" with k=600, the paper's own experiments, latest version): GPT-4o, Claude-3.7, o4-mini, DeepSeek-R1 few-shot; GPT-4o and Claude-3.7 with the COPRA agent; GPT-5-mini with KiminaProver-7b. Specification proved: 0.621% to 1.242% (that is 1 or 2 of 161) across the four few-shot models. Implementation proved: 0.621% to 1.863% for three models and about 5.6% for DeepSeek-R1 (the read printed 5.559%, which is not a multiple of 1/161; treat as about 9 of 161). End-to-end: every approach 0.621%, one problem (problem 53).

## quotes

- "CLEVER avoids test-case supervision, LLM-generated annotations, and specifications that leak implementation logic or allow vacuous solutions." (checked: abstract on the abs page and the HTML read, same words)
  - "These methods all struggle to achieve full verification, establishing it as a challenging frontier benchmark" (abstract; single read, abs page)

## does not cover

HumanEval-level problems; Lean only; the numbers are for 2025 models under a fixed time budget, and they are far below Verina's and vericoding's because the model must prove equivalence to a held-out specification, not just pass a verifier on a specification it was given. A reader should not read 1 of 161 as "models cannot write specifications": the specification task is judged by a strict equivalence proof against a hidden reference, so a correct but differently shaped specification still needs a proof of equivalence. The authors say that even when an approach certifies several specifications "the overall end-to-end success rate remains low" (Results, Section 3, as read; single read).

## strength

controlled study (strictly designed; small N of 161; hand-authored references).

## how chosen

SERIOUS (strictest design against cheating: held-out ground-truth specification, non-computable specifications, no tests or model-written annotations)

## period

language-model

## group

G4     claims: C2, C3     direction: contradicts (C2: end-to-end verified generation barely works); mixed for C3

## Read again by the research session on 2026-10-04

Route: arXiv abstract page, read by the research session on 2026-10-04.

- "These methods all struggle to achieve full verification, establishing it as a challenging frontier benchmark for program synthesis and formal reasoning." (single read (this read only))
- "CLEVER avoids test-case supervision, LLM-generated annotations, and specifications that leak implementation logic or allow vacuous solutions" (checked: the reading helper's quote and this read give the same words)

