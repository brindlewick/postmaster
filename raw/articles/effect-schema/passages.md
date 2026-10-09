# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

One schema definition decodes, encodes and asserts data, and also generates a fast-check arbitrary, a JSON Schema, an equivalence and a pretty printer.

## measured

no study. The Arbitrary page says `Arbitrary.make` takes a `Schema<A, I, R>` and returns a fast-check `Arbitrary<A>`. Limits the page states: filters applied before the last transformation are not considered when generating data; contradictory filters can make valid values hard or impossible to produce. Requirement stated: TypeScript 5.4 or newer, strict mode. The introduction page does not say whether it is a successor to io-ts, and does not say whether it was merged into core (the path names it "effect/Schema module").

## quotes

"The `Arbitrary.make` function allows for the creation of random values that align with a specific `Schema<A, I, R>`." (single read)

## does not cover

Generated values satisfy the schema; the schema gives no property about what a function does with them. A filter the generator cannot satisfy hangs or is ignored. No evidence found on how often schema-derived generators find defects.

## strength

n/a (documentation)

## how chosen

USE (shipped inside `effect`: 52,199,137 npm downloads of `effect` that week; I did not read download figures for any separate Schema package)

## period

2022 or later, no language model

## group

G5 (touches G1)     claims: C4, C1     direction: background

## Provenance

The reading helper's notes for this group say that an entry is verified only if its url line says VERIFIED against the page images, and this entry's does not. Its figures and quotes are the helper's reading of an abstract, a web page or a data interface, or were checked again by the research session only where a section below says so. Nothing here that a section below does not confirm should be taken as read from the source.

