# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Open-weight models turn Python programs into TLA+ models that run in about half of the cases at best and reproduce about half of the program's states.

## measured

TASK: Python program in, TLA+ specification checkable with TLC out. JUDGED BY: "Runnable@k" (TLC runs the model without failure at least once in k tries), "Similarity" (share of the reference model's states also present in the generated model's states) and the original benchmark tests. The paper itself calls the metric a compromise, since full semantic alignment cannot be assessed. DATA: 400 Python programs (HumanEval 105, MBPP 262, LiveCodeBench 33); reference models were drafted by GPT-4o and verified and refined by three practitioners with more than three years' experience. MODELS: eight open-weight models, DeepSeek-V3 the best (DeepSeek-V2.5, Qwen3-32B/14B/8B, DeepSeek-R1-Distill-Qwen-32B, Gemma-3-12B-it, Llama-3.1-8B-Instruct). NUMBERS (Table 2, few-shot, original code): DeepSeek-V3 Runnable@1 51.75%, mean similarity 49.55%; DeepSeek-V2.5 44.33% and 46.17%; Qwen3-32B 39.50% and 52.03%; the paper's own summary is "only 66.25% runnable and 49.55% state similarity ... at best". Nested loops and data-structure complexity, not algorithmic difficulty, predict failure.

## quotes

none kept

## does not cover

reference models partly written by a model and then corrected; no frontier closed models tested; the task is "translate this program", with the program given, so it measures faithfulness to code, not to intent.

## strength

controlled study (one team)

## how chosen

RECENT (2026 test of Python to TLA+ model checking models, with a measure of how much of the program's state space the model reproduces)

## period

language-model

## group

G3, G4     claims: C3     direction: supports (models are weak at modelling code formally)

## Corrected after an independent check of the page against its sources, 2026-10-05

The abstract's own summary is "only 66.25% runnable and 49.55% state similarity under in-context learning at best": DeepSeek-V3 is 51.75% at Runnable@1 and 66.25% at Runnable@3.

The one-sentence summary under `says` above is replaced, in `source.md` and on the wiki page, by: Open-weight models turn Python programs into TLA+ models that run in about half of the cases on the first try and in two thirds in three tries at best, and reproduce about half of the program's states.

