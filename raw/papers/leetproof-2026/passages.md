# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A pipeline in Lean that tests each model-written specification with randomised property-based tests before any code is written certified 28 of 50 LeetCode-style problems against 17 for a single-mode Lean baseline at a $5 budget per problem, and the same tests found 16 defective reference specifications in Verina and 18 in CLEVER.

## measured

- TASK: from a prose problem, produce a specification, a program with its loop invariants, and a machine-checked proof, in Velvet (a verifier embedded in Lean) with property-based testing (Lean's Plausible library), SMT tactics and a Lean-specialised AI prover for residual obligations.
  - SIZE: own benchmark of 50 LeetCode-style algorithm problems (15 development, 35 evaluation); audit of Verina (189 specifications, 188 analysed) and CLEVER (161) (Section 5, as read).
  - SPECIFICATION AUTHOR: the MODEL writes the specification (and concrete test cases); then type-checking, a model judge, and property-based testing validate it before code synthesis (Section 3.1, as read).
  - AUDIT NUMBERS (Section 5.2 and Table 1, as read): "we identify 16 issues in VERINA (out of 189 specifications, 8.5%)": 12 underspecified postconditions and 4 incorrect postconditions; "18 in CLEVER (out of 161 specifications, 11.2%)": 16 underspecified postconditions, 1 implementation issue, 1 possibly incorrect specification. Property-based testing found 13 of the Verina issues in about 9 minutes on a laptop; equivalence checking with an AI prover "takes approximately 8 hours" and found the rest. Reported to the benchmark authors: "The VERINA authors acknowledged and addressed 15; the remaining one is under review. The CLEVER authors acknowledged the 18 issues but have not yet released fixes." Specification inference on Verina: 97.4% semantic accuracy (Section 1, as read).
  - PIPELINE RESULT (Section 6.2, Figure 7, as read; the paper's own experiments, GPT-5.2 as the main backend, Claude Opus 4.6 on a 25-problem subset): fully proven 28 of 50 against 17 of 50 for single-mode Lean; evaluation set 23 of 35 against 16 of 35; "all 18 partially proven programs are fully discharged by" a Lean prover afterwards, so incomplete proofs reflected budget, not errors (Section 6.3).

## quotes

- "specifications synthesised from natural language are often either too weak to be meaningful or too strong to be implementable, yet existing approaches lack systematic means to detect such defects." (abstract on the abs page; the HTML read has "natural language descriptions", so the two pages differ by a word and this is a single read)
  - "the 13 VERINA issues require only 9 minutes of PBT, whereas Aristotle-based equivalence checking takes approximately 8 hours" (checked: two reads of the HTML, Section 5.2)
  - "Because the generated test cases happen to satisfy these constraints, PBT cannot detect them" (checked: two reads of the HTML, Section 5.1; the specifications that over-constrain the output on edge cases)

## does not cover

50 problems; a fixed $5 budget (a bigger budget might close the gap, Section 7); LeetCode-style algorithmic programs, not concurrent or I/O-heavy software. Property tests cannot catch over-constraining specifications whose edge cases the generated tests do not reach (the authors' own words). The audit counted defects by type but did not show a defect changing a downstream result.

## strength

controlled study (small N of 50; real defects found in two public benchmarks and acknowledged by the owners of one)

## how chosen

RECENT and CONTRADICTS (an independent audit found defects in the reference specifications of two benchmarks, found by randomised property tests in minutes)

## period

language-model

## group

G4 (also G1: property-based testing of specifications)     claims: C2, C3, C4     direction: supports (PBT found real defects in expert-written reference specifications; staged checking beat a single verifier) with a stated limit

## Corrected after an independent check of the page against its sources, 2026-10-05

The sentence above says the same tests found 16 defective reference specifications in Verina and 18 in CLEVER. The paper (Section 5.2) says property-based testing found 13 issues in Verina and 18 in CLEVER "purely via PBT", and "in total, we identify 16 issues in VERINA ... with the help of Aristotle", an AI prover doing equivalence checking, which takes about 8 hours.

The one-sentence summary under `says` above is replaced, in `source.md` and on the wiki page, by: A pipeline in Lean that tests each model-written specification with randomised property-based tests before any code is written certified 28 of 50 LeetCode-style problems against 17 for a single-mode Lean baseline at a $5 budget per problem; the same tests found 13 defective reference specifications in Verina and 18 in CLEVER, and an AI prover's equivalence check brought the Verina total to 16.

