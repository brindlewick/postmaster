# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Given Dafny code with prose comments and tests, a two-model combination wrote preconditions, postconditions, invariants and helpers that verified for 108 of 110 programs within 8 repair rounds, and 96.4% of the generated specifications were logically equivalent to the expert ones.

## measured

- TASK: from code plus natural-language specification (comments) plus test code, generate the pre and postconditions, loop invariants, auxiliary predicates and proof helpers (abstract).
  - SIZE: TESTDAFNY110: 85 programs from MBPP-DFY-153, 15 from LOOPINV100, 10 new; 2,505 lines of code (without annotations) and 1,211 lines of annotations (Section 3, Table 1, as read). So about 23 lines per program.
  - SPECIFICATION AUTHOR: the MODEL writes the specification; the test assertions serve as "specification-level oracles, validating specifications at compile time"; expert-written specifications exist for the manual comparison (Section 6.4).
  - WHAT SUCCESS MEANS: verifier accepts (with the tests' assertions kept); guardrails "to prevent the LLM from cheating, by inserting unproved assume statements, disabling termination checking (with decreases *), or removing test assertions" (Section 4, as read). Then a manual comparison of all 110: "generated pre/postconditions were logically equivalent to the expert-written specifications in 96.4% of the cases"; the other 3.6% (four cases): one overly strong postcondition and three overly weak preconditions, caught using negative tests marked `//@invalid` (Section 6.4, Table 3, as read).
  - MODELS AND NUMBERS (Table 2 as read; the paper's own experiments, models of late 2025): Claude Opus 4.5 at temperature 0.5: repair@5 90.0%, repair@10 96.4%. GPT-5.2 (low reasoning): repair@5 75.5%, repair@10 89.1%. Combination Claude Opus 4.5 with GPT-5.2: repair@8 98.2% (108 of 110); unsolved: FastModularExponentiation and PrimeFactorization. On average 2 attempts.

## quotes

- "a multimodel approach combining Claude Opus 4.5 and GPT-5.2 generated correct annotations for 98.2% of the programs within at most 8 repair iterations" (checked: abstract on the abs page and the HTML read; the abstract continues ", using verifier feedback")
  - "the generated pre/postconditions were logically equivalent to the expert-written specifications in 96.4% of the cases." (checked: two reads, Section 6.4)
  - "guardrails to prevent the LLM from cheating, by inserting unproved assume statements, disabling termination checking (with decreases *), or removing test assertions." (checked: two reads, Section 4)

## does not cover

Small programs (about 23 lines); two very large commercial models only; the authors say "Practical problems may be more challenging, and performance results may not generalise" (Section 6.6). The tests are written by people, so the oracle is only as strong as the tests; the four bad specifications were all caught because negative tests existed. Seven participants in the usability study.

## strength

controlled study (110 programs; two models; one team)

## how chosen

RECENT and SERIOUS (it asks the model for the specification and checks it against tests and against expert specifications)

## period

language-model

## group

G4     claims: C2, C3     direction: supports (with a check on the specification), narrowly

## Second reading (notes-H2.md, entry `faria-2026-testdafny`)

### says

Given a Dafny program with its intent written in comments and tests with assert statements, current models wrote pre/postconditions, loop invariants and proof helpers that Dafny accepted, and 96.4% of the pre/postconditions were judged logically equivalent to the experts' specifications.

### measured

TASK: add Dafny annotations (preconditions, postconditions, loop invariants, ghost helpers) to programs that come with natural-language specifications in comments and test code with static assertions. JUDGED BY: (a) the Dafny verifier accepting the program, including the test assertions, so the tests act as oracles that reject weak postconditions; (b) manual comparison with expert annotations (96.4% logically equivalent, Sec 6.4); (c) a usability study (Sec 7.2). DATA: TESTDAFNY110: 110 programs (85 from MBPP-DFY-153, 15 from LOOPINV100, 10 new), 2,505 code lines and 1,211 annotation lines, 8 categories; expert solutions exist. MODELS: Claude Opus 4.5, GPT-5.2, DeepSeek-V3.2, GPT-4 (old baseline). NUMBERS: 98.2% of the 110 programs within at most 8 repair iterations with two models (abstract, read twice); first read only (not re-checked): direct prompting pass@5 51.8% (Claude Opus 4.5, T=0.5) and 57.3% with two models, with a repair loop repair@5 90.0% and repair@10 96.4% (Claude Opus 4.5); the remaining 3.6% (4 of 110 programs) were edge cases: 1 overly strong postcondition and 3 overly weak preconditions (Sec 6.4, read twice); extra lines before minimisation 63.2%, after 10.6%; usability study success 85.7% with the tool against 42.1% by hand, SUS 74.6. Proof helpers were the hardest part (the strongest negative predictor of success).

### quotes

"Assertions in the test cases served as static oracles to automatically validate the generated pre/postconditions." (checked: abs page and html page give the same words); "generated correct annotations for 98.2% of the programs within at most 8 repair iterations, using verifier feedback" (checked, same two pages)

### does not cover

the intent is supplied as comments plus tests that a person wrote, so the human intent entered through the tests; the programs are small and from textbook-style sets (MBPP-derived); generated solutions "should be manually inspected" because a model can cheat with assume statements (the paper's own warning); no real project.

### strength

controlled study (one team)

