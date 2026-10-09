# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

GPT-4 finds the invariant for about half of 555 single-loop C programs on its own and for about seven in ten when its guesses are filtered by a Houdini-style algorithm and repaired, which is still below the symbolic tool Ultimate Automizer.

## measured

TASK: inductive loop invariants for C programs, checked with Frama-C WP (Z3, Alt-Ergo, CVC4); the property to prove is an assertion in the program, taken from earlier work (LoopInvGen, Code2Inv, SV-COMP). DATA: 1,005 benchmarks curated from 1,166, of which 555 integer programs with one loop and one method were used (469 with a sufficient invariant, 86 negative). MODELS: GPT-4, GPT-3.5-Turbo, CodeLlama-34b-Instruct; at most 15 completions per program at temperature 0.7. NUMBERS: GPT-4 solved 293 of 555 with the best prompt alone; with the Houdini filter 383 of 555 (GPT-3.5-Turbo 370); with filter and repair 398; Ultimate Automizer solved 430 of 469 positive instances; the model-based tool solved 31 programs Ultimate failed and Ultimate solved 63 the model-based tool failed. Failure causes: 44 programs need disjunctions in the invariant, 5 long clauses, 9 more precise constraints, 3 floating point, 10 Frama-C limits.

## quotes

none kept (the authors write that models are "much better at finding ingredients of loop invariants than they are at finding the complete set"; single read)

## does not cover

integer programs without arrays or pointers, under 500 lines; the assertion is given; 2023 models.

## strength

controlled study

## how chosen

SERIOUS (a measured comparison of a model plus a symbolic filter with a purely symbolic tool, with a failure analysis)

## period

language-model

## group

G4     claims: C3     direction: mixed

