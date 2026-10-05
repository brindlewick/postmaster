# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

GPT-4o kept the intended functional behaviour in nearly all outputs but only 9 of 126 output files verified.

## measured

TASK: write VeriFast specifications (separation logic) for C programs from three kinds of input: natural-language description, functional-behaviour pre/postconditions, or the latter plus reference-file contents; two prompt styles, basic and chain of thought. JUDGED BY: VeriFast accepting; manual comparison with the existing verified specifications, error categories, and redundancy. DATA: 21 programs from VeriFast's public repository, whose existing specifications are the reference. MODEL: GPT-4o only. NUMBERS: 106 of 126 outputs preserved functional behaviour in the pre/postconditions and 123 in the source code (Table II); only 9 of 126 verified directly (Sec VI-B); 539 errors with basic prompting and 555 with chain of thought (Table III); 10 cases of redundant specifications among the verified ones (Sec VI-C).

## quotes

"GPT-4o generates VeriFast specifications with limited success across the input types and prompting strategies assessed" (single read, as printed in a summary)

## does not cover

one model, one verifier, 21 programs likely in training data; the analysis is partly subjective by the authors' own statement.

## strength

one report or one team's experience (small)

## how chosen

SERIOUS (a measured test of a model writing separation-logic specifications for C, a case where the specification language is hard)

## period

language-model

## group

G2, G4     claims: C3     direction: supports

## Corrected after an independent check of the page against its sources, 2026-10-05

The paper's abstract says only that the outputs "preserve functional behavior, but struggle to be verifiable". The notes above count 106 of 126 outputs that kept the intended functional behaviour in the pre- and postconditions (84%) and 123 of 126 in the source code.

The one-sentence summary under `says` above is replaced, in `source.md` and on the wiki page, by: GPT-4o kept the intended functional behaviour in most outputs (106 of 126 specification files) but only 9 of 126 output files verified.

