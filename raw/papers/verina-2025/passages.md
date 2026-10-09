# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

In Lean, with natural-language problems, the best model (o3) got code right 72.6% of the time, wrote a sound and complete specification 52.3% of the time, and proved the code against a specification only 4.9% of the time, one try each.

## measured

- TASK: three tasks and their compositions: CodeGen (code from a description and signature), SpecGen (pre and postconditions from the description), ProofGen (a Lean proof that the code meets the specification). Lean compiler checks proofs; proofs containing `sorry` are marked incorrect (HTML read).
  - SIZE: 189 tasks, Lean. Table 2 as read: description median 110 words; code median 9 lines (max 38); specification median 4 lines (max 62); median 5 positive and 12 negative tests per task. Sources: MBPP-DFY-50 (49 translated), CloverBench (59), student theorem-proving course submissions (81). So tiny programs.
  - SPECIFICATION AUTHOR: reference specifications written by people (the authors), each "manually reviewed by at least two authors" and checked to pass positive tests and fail negative tests. The model's own specifications are judged against them.
  - HOW A MODEL-WRITTEN SPECIFICATION IS SCORED: soundness (accepts only correct programs) and completeness (accepts all correct programs), by a pipeline that tries a Lean prover first and falls back to tests; when only tests pass the result is "might hold", and for some relations "unknown" (HTML read, Section 3-4).
  - WHAT SUCCESS MEANS: code passes tests; spec sound and complete against the reference; proof accepted by Lean with no `sorry`. The ground-truth specs were written so they "cannot be directly used to solve the coding problem" (guard against a spec that is the implementation). Negative tests: "at least three different negative tests" per positive test, mutated to violate pre or postcondition.
  - NUMBERS (abstract, the paper's own experiments, o3, one trial per task): code 72.6%, spec sound and complete 52.3%, proof 4.9%. From a second HTML read, verbatim: "proof generation remains the most challenging with pass@11 rates below 4.9% for all general purpose models"; "the best model, Goedel Prover V2 32B ..., achieved an 11.2% proof success rate in one trial" (a specialised prover); "iterative proof refinement using Lean compiler feedback can increase the proof success rate up to 20.1% with 64 refinement steps". (The o4-mini 3.2% and Claude Sonnet 3.7 figures from the first read came from figures and are not repeated here.)
  - CONTAMINATION CHECK (Appendix B, second HTML read): "we conducted 10-gram overlap detection and found zero matches" against the bigcode/the-stack pretraining dataset (about 550 million rows), concluding "Verina's Lean artifacts are novel and not present in public pretraining corpora" (single read of each sentence). This checks n-gram overlap only; it does not rule out memorised algorithms in other languages.

## quotes

- "The best model, OpenAI o3, achieves a 72.6% code correctness rate, 52.3% for specification soundness and completeness, and a mere 4.9% proof success rate" (checked: abstract on the abs page and the HTML read, same words; the abstract adds "(based on one trial per task)")
  - "code generation generally achieves the highest success rates across models, followed by specification generation, while proof generation remains the most challenging." (single read, HTML Section 5, as paraphrased by the reader; treat as paraphrase)

## does not cover

Programs are tiny (median 9 lines) so this says little about real programs. Spec scoring leans on tests when no proof is found, so a specification can score "sound" on test evidence only. Contamination risk from widely used sources is acknowledged (Appendix B). Lean only; Dafny and Verus are listed as future work. The 4.9% proof figure is one trial per task, and the refinement run shows it moves a lot with feedback and with specialised provers.

## strength

controlled study (189 tasks, several models, three separate measures).

## how chosen

SERIOUS (the one benchmark that scores code, specification and proof separately and together, with the specification scored for soundness and completeness)

## period

language-model

## group

G4     claims: C2, C3     direction: mixed (separates code, specification and proof; specification is the middle difficulty)

## Read again by the research session on 2026-10-04

Route: arXiv abstract page, read by the research session on 2026-10-04.

- "The best model, OpenAI o3, achieves a 72.6% code correctness rate, 52.3% for specification soundness and completeness, and a mere 4.9% proof success rate (based on one trial per task)." (single read (this read only))
- "VERINA consists of 189 manually curated coding tasks in Lean" (single read (this read only))

