# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Models can usually write valid pre- and postconditions from a description, better for preconditions than postconditions, but none got every task right, and extra machine-generated tests showed that about one in ten of the best model's accepted solutions was wrong.

## measured

TASK: from a natural-language description with input-output examples, write full pre- and postconditions as Python boolean functions. JUDGED BY: execution against test suites: a specification is correct when it agrees with the reference specification on every test (positive and negative tests); manually written suites with full branch coverage, then extra tests generated with Pynguin and, for negative postcondition tests, mutants made with Poodle; metrics accept@1, mean passing tests, false-negative rate, false-positive rate, error rate. No person rated the outputs. DATA: 40 tasks prepared by the authors for the study (to avoid training-data leakage), reference specifications written by the authors, four semantic difficulty classes (S, Q, QQ, NQ; NQ = not expressible with quantifiers, i.e. recursive or looping) and two complexity classes. MODELS: 24 (7 proprietary, 17 open; the top five all proprietary, including Claude 3.7, Gemini 2.0, GPT-4o); 10 repetitions each. NUMBERS: Claude 3.7 average accept@1 0.78; best open models (Gemma 3, Athene) 0.47; for Claude 3.7, 9.6% (32) of the solutions that the hand-written tests accepted were wrong once the generated tests were applied; for non-quantifiable tasks the majority of the models did not produce valid postconditions (first read). The 0.78 and the 9.6% (32) sentence are in Section 6.5 (second read; the paper gives no per-model accept@1 table in the part I saw, only Figures 3-7).

## quotes

"none of the LLMs were able to correctly formalize all the tasks in our benchmark" (checked: abs page and html page give the same words); "augmenting the manually prepared dataset with automatically generated tests leads to the exposure of wrong solutions, which would have otherwise been accepted as correct" (checked, same two pages); "when considering only manual tests, 9.6% (32) of the valid solutions proposed by Claude 3.7 are actually invalid when automatically generated tests are also used" (single read, html, Section 6.5)

## does not cover

40 unit-level tasks, Python only, reference specifications by the authors (which could contain errors; the authors say so); correctness is "agrees with the reference on tests", so a specification that differs from the reference in a way the tests do not probe is counted as right.

## strength

controlled study (one team, small benchmark)

## how chosen

RECENT (2026 benchmark of 24 models on full pre- and postconditions; the only one I found that measures how many "correct" specifications are exposed as wrong by extra generated tests)

## period

language-model

## group

G4     claims: C3     direction: mixed

