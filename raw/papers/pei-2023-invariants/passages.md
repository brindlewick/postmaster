# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Code models fine-tuned for invariant generation can predict program invariants statically, with the best result from a scratchpad approach that predicts invariants step by step through the program, at a quality the abstract calls comparable to a dynamic analysis tool given five traces.

## measured

abstract only: invariant prediction by models trained on source code, compared with a dynamic invariant detector with five program traces. I did not read the benchmark, the model sizes or the numbers.

## quotes

"finding invariants statically of quality comparable to those obtained by a dynamic analysis tool with access to five program traces" (single read)

## does not cover

everything beyond the abstract; the invariants are what a program does, not what a user meant.

## strength

controlled study (abstract only; body not read)

## how chosen

SERIOUS (the ICML paper on models and program invariants; named in the brief)

## period

language-model

## group

G4     claims: C3     direction: mixed

