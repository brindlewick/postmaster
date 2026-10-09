# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Postconditions that pass the tests are mostly unsound once a verifier checks them, because the model leaves out the preconditions; asking for a full contract (NL2Contract) lifts soundness from 13.0% to 81.1% for GPT-5 on HumanEval+.

## measured

TASK: from a docstring, signature and file context, write a Python contract (preconditions in try/except, postconditions as asserts). JUDGED BY: (a) soundness: the verifier CrossHair shows the precondition admits only valid inputs and the postcondition holds on the reference implementation (60-second timeout); (b) bug-discriminating power: mutants (4 to 233 per task, median 55, from ChatGPT completions) and 31 real bugs in Python-by-Contract; (c) usability: false alarms from CrossHair and Pynguin. No human rating. BENCHMARKS: HumanEval+ (164 Python tasks; 92 have non-trivial preconditions); Python-by-Contract (55 introductory tasks from Advent of Code 2020 and an ETH course, 59 buggy solutions, 31 implementation bugs). SPEC WRITER: the model; reference implementations and specifications are manually validated by the benchmarks' authors. MODELS: GPT-5 (Chat), GPT-4o, CodeQwen 2.5 32B. NUMBERS (read twice, same values; NL2Contract against nl2postcond): Table 1 verification-sound@1: GPT-5 81.1% vs 13.0%, GPT-4o 72.8% vs 13.4%, CodeQwen 2.5 66.7% vs 11.5%; Table 2 share of contracts that are bug-complete: GPT-5 39.5% vs 7.3%, GPT-4o 31.4% vs 4.8%, CodeQwen 18.4% vs 4.6%; Table 3 real bugs found with CrossHair: 14, 14, 14 vs 3, 5, 4 (the benchmark holds 31 implementation bugs, of which 19 are checkable with CrossHair according to my first read); (Fig 4a, first read) nl2postcond-style output violates the reference precondition in 75.8-82.0% of specifications against 10.4-12.4% for NL2Contract; the paper says verifiers supplied with NL2Contract contracts detect up to 73% of mutants.

## quotes

"Using the generated postconditions as specifications in a subsequent verification, however, often leads verifiers to suggest invalid inputs, hinting at potential issues that ultimately turn out to be false alarms." (single read, abs page; the html page's abstract is a shortened version, so the words differ); "current LLMs – as expected – typically ignore input assumptions leading to inferred postconditions which are only valid for a subset of inputs" (single read, html, Section 1)

## does not cover

simple Python tasks, no dependencies beyond one file; CrossHair is incomplete; public benchmarks (leakage risk); the comparison is partly between two prompt designs by the same authors, so it shows what the task framing changes, not a ceiling for the model.

## strength

controlled study (one team)

## how chosen

SERIOUS (it re-tests nl2postcond with a verifier instead of tests and shows that "test-set correct" postconditions are mostly unsound for verification)

## period

language-model

## group

G4     claims: C3     direction: mixed (specifications written, but weak in a specific way)

