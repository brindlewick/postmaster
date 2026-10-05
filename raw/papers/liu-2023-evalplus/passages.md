# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Adding about 80 times as many generated test inputs to HumanEval exposed wrong code from 26 models that the original ten or so tests had accepted, lowered pass@k by up to 19.3-28.9%, and changed the ranking of models.

## measured

TASK: generate many extra test inputs for each HumanEval problem, with ChatGPT-written seed inputs and type-aware mutation of them, and compare each model solution's output with a ground-truth solution (differential testing). JUDGED BY: pass@k on the original tests against the extended tests. DATA: HumanEval (164 problems, on average 9.6 tests each) extended to HumanEval+ (on average 764.1 tests each); 83 of the 164 tasks also got hand-written input contracts. The ground-truth solutions were re-implemented by the authors after they found over 10% of HumanEval's incorrect (18 defects: 5 unhandled edge cases, 10 logic errors, 3 performance). MODELS: 26, among them GPT-4, ChatGPT, CodeLlama, WizardCoder, Phind-CodeLlama, StarCoder, CodeGen. NUMBERS: up to 19.3-28.9% fewer problems passed on HumanEval+ across k; ChatGPT 12.6%, CodeGen-16B 18.5%, GPT-4 13.1% reduction in the page's wording; WizardCoder-CodeLlama and Phind-CodeLlama look no better than ChatGPT on HumanEval (73.2% against 73.2% pass@1) but beat it on HumanEval+ (67.1% and 67.0% against 63.4%); a distilled "mini" set cuts tests 47-fold with similar power.

## quotes

"Testing insufficiency can lead to mis-ranking." (single read; the longer sentence in the summary had an example attached)

## does not cover

this is generated inputs plus a reference solution as the oracle, not property-based testing; it shows that a handful of example tests misses defects, not that properties do better than examples; the target is model-written code on short puzzles; the same authors' reference solutions decide what is "correct".

## strength

controlled study

## how chosen

USE (the repository github.com/evalplus/evalplus showed 1.8k stars and 209 forks when read on 2026-10-04; its tests are the standard "more tests" extension of HumanEval)

## period

language-model

## group

G1, G4     claims: C4     direction: supports (indirectly; the oracle is a reference solution, not a property)

