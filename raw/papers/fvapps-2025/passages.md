# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Unit tests from the APPS programming problems were turned into unproven Lean 4 theorems by a model, and on a 100-sample slice Claude 3.5 Sonnet proved 30% of the theorems and Gemini 1.5 Pro 18%.

## measured

- TASK: write the program in Lean 4 and prove the given theorems (given with `sorry`).
  - SIZE: 4,715 samples, of which 1,083 "curated and quality controlled"; program length not reported ("provides no explicit metrics for program size" in my read).
  - SPECIFICATION AUTHOR: a MODEL, from tests. Claude 3.5 Sonnet converted APPS tests to property tests and then to Lean theorem statements ("The model is prompted to explicitly convert the property tests into unproven theorem statements (cleared via sorry)", Stage 3, as read). Five-stage pipeline; the last stage filters by Lean's property-based testing (Plausible). So there are no hand-written specifications.
  - WHAT SUCCESS MEANS: a theorem proved by the model (a Lean-checked proof) for a program the model also wrote. Nothing in my read says that theorem statements were checked as faithful to the problem beyond manual spot-checking ("did not reveal any systematic failures").
  - NUMBERS (abstract and HTML read, the paper's own experiments): the abstract says 406 theorems of 100 random samples; the HTML read says 101 samples. Sonnet proved 121 of 406 (30%), Gemini 74 of 406 (18.5%) (Section III-D, Table II as read). Models: claude-3-5-sonnet-20241022 and Gemini 1.5 Pro. A human baseline of 10 hours on one sample "did not make it through any of the proofs".

## quotes

- "it is nonetheless possible that the theorem statements do not correspond to desirable properties nor that they, in union, cover the full range of properties one would ideally prefer." (single read, HTML Section V)
  - "Sonnet correctly proves 30% and Gemini correctly proves 18%" (checked: abstract on the abs page and the HTML read; the abstract's sentence begins "On the 406 theorems of 100 randomly selected samples,")

## does not cover

Whether the theorem statements are the right properties; the authors say they may not be. Early-2025 models. A proved theorem here is evidence only that code agrees with test-derived properties.

## strength

one report or one team's experience (one team; two models; a sample of about 100 problems).

## how chosen

SERIOUS (largest stated Lean benchmark at the time; the specification is generated from existing tests, which makes it the clearest case of the specification coming from tests)

## period

language-model

## group

G4     claims: C2, C3     direction: mixed (statements were translated from tests by a model; authors say they may not capture the desirable properties)

