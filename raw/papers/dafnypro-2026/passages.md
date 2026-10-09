# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A wrapper that stops the model from touching the program's logic, prunes needless invariants and adds fixed proof strategies lifted Claude 3.5 Sonnet from about 70% to 86% on DafnyBench, and tuned 7B and 14B open models reached 68% and 70%.

## measured

- TASK: add verification annotations to a base program that comes with its specification (same task as DafnyBench).
  - SIZE: DafnyBench 782 programs, average 52.77 lines, maximum 41.3k lines (Section 4.2, as read). Clover 63 samples (avg 18.62 lines), MBPP-Dafny 164 (avg 19.47), HumanEval-Dafny 132 (avg 50.45) (Table 2).
  - SPECIFICATION AUTHOR: given (people or earlier translation).
  - WHAT SUCCESS MEANS: the Dafny verifier accepts the annotated program, and a diff-checker uses the Dafny parser to confirm that, with annotations stripped, "the regenerated code ... is identical to the original base code" (Section 3.1, as read). So the program logic cannot be changed to pass.
  - MODELS AND NUMBERS (Table 1(a) as read; the paper's own experiments, up to 10 attempts): Claude 3.5 Sonnet: Clover 97.43%, MBPP 97.76%, HumanEval 95.32%, DafnyBench 86.18%. Claude 3.7 Sonnet: Clover 100.0%, MBPP 98.73%, HumanEval 94.39%, DafnyBench 85.67%. The abstract says the 86% is "a 16 pp improvement over the base model". Fine-tuned Qwen2.5-7B 68% and Qwen3-14B 70% on a held-out 197-program split of DafnyBench with N=5 attempts (Section 5.2).

## quotes

- "Notably, on DafnyBench, the most challenging benchmark, Claude Sonnet 3.5 enhanced with DafnyPro achieves 86% correct proofs, a 16 pp improvement over the base model." (abstract; single read, abs page)

## does not cover

Only Claude 3.5 and 3.7 Sonnet; no frontier models of 2026. The task keeps the specification fixed. Contamination "not addressed" in the paper (as read). Supervised fine-tuning only.

## strength

controlled study

## how chosen

RECENT (a 2026 result on DafnyBench that supersedes the 2024 figure; two of its three authors, Bouissou and Zetzsche, also appear on the AWS-affiliated ATLAS paper, but the affiliation on this paper was not read)

## period

language-model

## group

G4     claims: C2     direction: supports (narrowly: hints for given specifications)

