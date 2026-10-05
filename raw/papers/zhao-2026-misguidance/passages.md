# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

When models are shown buggy code, they write about eight times as many tests that assert the bug's behaviour (3.84% of tests against 0.46% with the fixed code) and about a third as many tests that expose it, and replacing the code in the prompt with a model-written specification docstring reduces this.

## measured

TASK: write unit tests for a Java method, given the buggy code, the fixed code (as control) or a specification docstring written by a model. JUDGED BY: execution against both versions: effective = fails on buggy and passes on fixed; misguided = passes on buggy and fails on fixed; also compile failures and false alarms; manual labelling of some cases with two annotators (Cohen's kappa 0.77 to 0.84). DATA: 318 focal methods from 233 Defects4J 3.0 defects in 17 projects (the human-written tests of Defects4J are the reference). MODELS: eleven (Gemini 2.5 Pro and Flash, Claude 4 Sonnet, Grok-4 and Grok-3, GPT-4.1, o4-mini, DeepSeek-V3 and R1, Qwen3-Coder-Plus, Qwen3-Plus), run in 13 base or reasoning configurations, temperature 0. NUMBERS (Table 4, averages over the 13 configurations, read twice, identical): misguided tests 137.69 (3.84% of generated tests) from buggy input against 16.46 (0.46%) from fixed input; effective tests 104.15 (2.98%) against 304.08 (8.51%); the reasoning models are worse than the base models (misguided 4.61% against 2.94% from buggy input); among tests that pass on the buggy code 6.23% are misguided on average, lowest for Claude 4 Sonnet (4.91%), DeepSeek-V3 (4.34%) and Qwen3-Coder-Plus (3.90%); Table 6, base docstring prompt: misguided 113.00, effective 186.77; advanced docstring prompt: misguided 87.38, effective 230.23; false alarms 16.36% to 18.15% with the advanced prompts.

## quotes

"buggy code steers LLMs toward generating tests that validate its erroneous behavior rather than expose it" (single read, abs page abstract); "On average, the models generate 137.69 misguided tests (3.84%)." (single read, html, Sec 3.1)

## does not cover

Java unit tests, not properties; the absolute rates are small (a few percent of tests); the specification docstring is itself written by a model from the code (the study reports that it helps, not that it is right); Defects4J tests may be in training data.

## strength

controlled study

## how chosen

RECENT (the newest measurement of the oracle problem with 2025-era frontier models; it supersedes the single-model study above)

## period

language-model

## group

G4     claims: C3, C4     direction: contradicts (tests written from code repeat the code's bug) and mixed (a specification in place of the code helps)

