# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A pipeline that has a model write Dafny specifications for Python solutions and then screens them with test-based lemmas produced 2.7K verified Dafny programs; fine-tuning a 7B model on them lifted DafnyBench from about 32% to about 57%.

## measured

- TASK: synthesise verified Dafny programs (specification, implementation, proof) from the TACO set of LeetCode-style Python solutions, to produce training data (2.7K programs, 19K training examples after decomposition); then evaluate a tuned 7B model on proof hints (DafnyBench, 782 problems) and end-to-end synthesis (DafnySynthesis, 228 tasks: 178 test, 50 training) (Section 4.2, as read).
  - SPECIFICATION AUTHOR: a MODEL ("Given the method signature, we synthesize specifications as requires and ensures clauses"). Screening, as read (Section 3.2): soundness lemmas instantiate the contract with concrete test inputs and outputs ("Verification failure indicates the specification is inconsistent with known correct behavior"); a completeness check by contradiction (derive false from a negated output); a completeness check by perturbation (model-generated wrong outputs must fail against the postcondition; "successful verification reveals the postconditions have insufficient constraints").
  - WHAT SUCCESS MEANS: the problem statement is frozen before implementation "to prevent the model from weakening specifications or trivializing test cases"; contract adherence, complete program verification and test execution are enforced (Section 3.1.2, as read).
  - NUMBERS (HTML read; the paper's own experiments): Qwen 2.5 7B Coder base to tuned: DafnyBench pass@1 31.8% to 55.8%; DafnySynthesis pass@5 15.8% to 65.8%; the abstract gives 32.4% to 56.9% on DafnyBench (the HTML read says performance "plateaus at Pass@5 (56.9%)", so the abstract figure is a pass@5 figure; paraphrase). Comparison models: Claude 3 Opus on DafnyBench 53.8% pass@1; GPT-4 on DafnySynthesis 53.4% pass@5; Claude 4.1 Opus on DafnyBench 89.2% pass@10. Success falls from 47.1% on easy problems to about 20% on hard and very hard.

## quotes

- "Fine-tuning Qwen 2.5 7B Coder on this data improves performance from 32.4% to 56.9% on DafnyBench and from 15.8% to 65.8% on DafnySynthesis" (abstract; single read, abs page)

## does not cover

Training-data synthesis for a 7B model; contradiction lemmas "often exceed automated theorem provers capabilities" (Section 3.2, as read). Models of the comparison are not the 2026 frontier. The specification screening reduces weak specifications but is not a proof that specifications are the intended ones.

## strength

controlled study (one team; synthetic data; one 7B model)

## how chosen

USE (AWS-affiliated) and RECENT (it checks the quality of model-written specifications by construction)

## period

language-model

## group

G4     claims: C2, C3     direction: mixed

