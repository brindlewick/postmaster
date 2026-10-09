# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

`Result` and `ResultAsync` types put failure in the return type so that a caller can see it, in place of thrown exceptions.

## measured

no study. Use figures: stars 7,735; forks 152; created 2019-04-28; MIT; latest release v8.2.0 published 2025-02-21; last push 2026-02-14. README: `safeTry` uses generator functions to return errors implicitly; the project recommends a separate package, `eslint-plugin-neverthrow`, which makes unconsumed Results a lint error (a port of Rust's must-use).

## quotes

"Throwing and catching is very similar to using goto statements - in other words; it makes reasoning about your programs harder." (single read; an argument, not a measurement)

## does not cover

The compiler enforces nothing about handling a Result unless the separate lint plugin is on. Code that throws and is not wrapped stays invisible in types. It proves nothing. The "reasoning" claim is argued, not measured.

## strength

argued but not measured (the README's claim about reasoning); n/a for the use figures

## how chosen

USE (7,735 GitHub stars; 4,170,209 npm downloads in the week 2026-09-27 to 2026-10-03)

## period

2022 or later, no language model

## group

G5     claims: C1     direction: background

## Provenance

The reading helper's notes for this group say that an entry is verified only if its url line says VERIFIED against the page images, and this entry's does not. Its figures and quotes are the helper's reading of an abstract, a web page or a data interface, or were checked again by the research session only where a section below says so. Nothing here that a section below does not confirm should be taken as read from the source.

