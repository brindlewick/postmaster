# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Rather than trust a verifier on code the model also annotated, Clover checks that code, docstring and formal annotations agree with each other, using the verifier plus the model, and on its small test set it accepted 87% of correct programs while accepting none of the deliberately wrong ones.

## measured

- TASK: consistency checking of three artefacts (code, docstring, Dafny annotations); also model-generated annotations. Six directed checks: code-to-annotations (verifier), annotations-to-code, docstring-to-annotations, annotations-to-docstring, docstring-to-code, code-to-docstring (Section 3.2, Algorithm 1; HTML read).
  - SIZE: CloverBench, 60 hand-written Dafny programs at "textbook level"; each has one correct instance and four adversarial incorrect variants made by mutating the ground truth in ways that still pass the verifier (Table 3, categories C1 to C6; HTML read). The abs page says "hand-designed dataset"; the HTML read says 60 programs; DafnyBench says it took 62 Clover programs (counts differ by two; not resolved here).
  - SPECIFICATION AUTHOR: people for CloverBench ground truth; the model generated annotations, docstrings and code in the checks.
  - MODEL: GPT-4 (HTML read, Section 4.3). Only GPT-4 is named.
  - NUMBERS: Table 1: ground-truth acceptance 75% (k=1) and 87% (k=10); adversarial false positives 0% in all four categories tested (C1, C2, C3, C6) at k=1 and k=10. Table 2 (k=1, per check on ground truth): anno-sound 100%, anno-complete 88%, doc2anno 85%, anno2doc 100%, code2doc 97%, doc2code 82%.
  - FINDING IN OTHER PEOPLE'S DATA: it flagged 6 incorrect programs in the human-written MBPP-DFY-50 set (Section 4.4): "5 have factual contradictions in their docstrings and pre-conditions; and 1 has trivial (too weak) post-conditions" (HTML read). So 6 of 50 (12%) of a published, human-verified Dafny set had a wrong or too-weak specification while passing the verifier.

## quotes

- "our consistency checker achieves a promising acceptance rate (up to 87%) for correct instances while maintaining zero tolerance for adversarial incorrect ones (no false positives)" (abstract; single read, abs page)
  - "5 have factual contradictions in their docstrings and pre-conditions; and 1 has trivial (too weak) post-conditions" (checked: two reads; Section 4.4, about the 50 human-written MBPP-DFY-50 programs)
  - "if the docstring, annotations, and code all miss the same edge case" (checked: two reads; the sentence goes on to say the error cannot be detected, which is a single read; Section 0.A.4.1)

## does not cover

Zero false positives is on 60 textbook programs and a fixed set of mutation types; it is not a proof of soundness. It depends on a model as an oracle for three of the six checks. Only GPT-4. Errors shared by all three artefacts are undetectable, which the authors say.

## strength

controlled study (small, hand-made, one model).

## how chosen

SERIOUS (the first paper to treat "the specification may be wrong" as the object of checking; cited by DafnyBench and Misu)

## period

language-model

## group

G4     claims: C2, C3     direction: mixed

## Second reading (notes-H2.md, entry `clover-2023`)

### says

Cross-checking code, docstring and annotations with six consistency checks, using GPT-4 and Dafny, accepted 87% of correct examples and rejected all 240 adversarial incorrect ones, where Dafny alone would have accepted every one of them.

### measured

TASK: check that Dafny code, its pre/postcondition annotations and its English docstring agree with each other; checks: annotations sound (Dafny), annotations complete (GPT-4 regenerates code from annotations, compared on test inputs), docstring to annotations (GPT-4 writes them, Dafny proves equivalence), annotations to docstring, code to docstring (GPT-4 judges equivalence), docstring to code. JUDGED BY: acceptance of ground-truth instances and rejection of incorrect ones. DATA: CloverBench, 60 small hand-written textbook-level programs by the authors, one method each, with 4 hand-written adversarial incorrect variants per program, built so that annotations are weakened while Dafny still verifies; MBPP-DFY-50 as an outside set. MODEL: GPT-4 with Dafny 4.0 and Z3 4.8.12. NUMBERS: ground-truth accepted 45/60 (75%) with one reconstruction attempt, 52/60 (87%) with 10; incorrect variants rejected 240/240 (0 false positives); on MBPP-DFY-50, 24/27 correct accepted and 6/6 incorrect rejected, which exposed 6 previously unknown errors; GPT-4 generated code from annotations for 53/60 and annotations from code for 41/60 (three tries with Dafny feedback); both code and annotations from a docstring: 39/60 accepted by Clover.

### quotes

"our consistency checker achieves a promising acceptance rate (up to 87%) for correct instances while maintaining zero tolerance for adversarial incorrect ones (no false positives)" (checked: abs page and html page give the same words); Section 4.3 gives the table: the four adversarial categories C1, C2, C3 and C6 each 0/60 accepted at k=1 and at k=10 (read once, html)

### does not cover

single-method programs whose docstring and annotations must pin down a unique output; the adversarial cases are the authors' own; the paper says the docstring-equivalence check "skews towards acceptance" and that an error cannot be found if docstring, annotations and code all miss the same edge case.

### strength

controlled study (one team, small hand-made benchmark)

