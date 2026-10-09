# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

The authors state that models write syntactically correct property-based tests but weak properties that give "a false sense of security", and they add an agent that writes wrong implementations satisfying the property to expose its gaps.

## measured

abstract only: the tool PROBE has a Validator agent write "counter-implementations" (semantically incorrect code that satisfies the property) and builds a cross-function semantic graph; "mutation scores" rise by 9.79% over baselines; 45 previously unknown bugs in "top-tier libraries" were confirmed by developers. I did not read the benchmark, the models, the baselines, whether 9.79% is relative or in points, or how the 45 bugs were counted.

## quotes

"resulting in weak properties that provide a false sense of security" (single read, abstract)

## does not cover

everything beyond the abstract; the weakness of model-written properties is the premise here, and the evidence for it is in the body I did not read.

## strength

controlled study (abstract only; body not read)

## how chosen

RECENT (a 2026 paper whose premise is that model-written properties are superficial, with a second agent that tries to break them)

## period

language-model

## group

G4     claims: C3, C4     direction: mixed (it supports property tests once hardened, and states that model-written ones are weak)

