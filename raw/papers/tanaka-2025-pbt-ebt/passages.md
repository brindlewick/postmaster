# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

On 16 HumanEval problems whose solutions fail the extended tests, model-written property tests and model-written example tests each exposed the bug in 11 cases, and together in 13.

## measured

TASK: the same model writes property-based tests (Hypothesis) and example-based assertion tests for a function with a hidden defect. JUDGED BY: whether a test fails (assertion failure or a 15-second timeout) on the defective solution; test code with syntax or run-time errors, invalid properties or wrong outputs was removed by hand (5 of 16 property-test cases and 12 of 16 example-test cases had such removals). DATA: 16 HumanEval problems chosen from 21 that fail HumanEval+'s extended tests, with boundary, performance or input-structure bugs. MODEL: Claude-4-sonnet only. NUMBERS (Table I, Sec IV-A): each method 11 of 16 (68.75%); property tests only 2, example tests only 2, both 9, neither 3; at least one method 13 of 16 (81.25%); mean run time 2.540 s against 1.046 s. The property tests were better on performance problems and wide input ranges, the example tests on specific boundary conditions.

## quotes

"each method individually achieved a 68.75% bug detection rate, combining both approaches improved detection to 81.25%" (checked: abs page and html page give the same words); "Traditional testing approaches using Example-based Testing (EBT) often miss edge cases" (single read, abs page; it is the authors' premise, not a result)

## does not cover

16 problems, one model, one run; the defects are known to fail an 80-fold extended test set, so they are the kind that tests can find; the manual removals differ by arm, which can shift the comparison; the authors state that no automatic check of a property's validity exists.

## strength

one report or one team's experience (small)

## how chosen

SERIOUS (the only head-to-head of model-written property tests against model-written example tests that I found; it is small)

## period

language-model

## group

G4     claims: C4     direction: mixed

