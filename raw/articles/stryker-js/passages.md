# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

It inserts small bugs ("mutants") into production code, runs the tests for each, and reports the mutants that no test caught.

## measured

no study. Use figures: stars 3,167; forks 293; created 2016-02-12; Apache 2.0; latest release v10.0.0 published 2026-08-14; pushed 2026-10-04. Docs: a surviving mutant means no test failed, so a test or an assertion is probably missing; the docs contrast code coverage with mutation testing as quantity against quality.

## quotes

"bugs, or mutants, are automatically inserted into your production code. Your tests are run for each mutant." (single read)

## does not cover

It does not find bugs in the code; it measures whether the tests would notice a small change. Mutants that do not change behaviour cannot be killed (the docs name equivalent mutants; I did not read their treatment). A high score says the tests are sensitive to the changes made, not that the code is right. It adds run time (the docs I read give no figure).

## strength

n/a (a tool page; use figures only)

## how chosen

USE (3,167 GitHub stars; 3,858,461 npm downloads of `@stryker-mutator/core` in the week 2026-09-27 to 2026-10-03)

## period

2022 or later, no language model

## group

G5 (touches G1)     claims: C4 (a way to measure how strong a test suite is, example-based or property-based)     direction: background

## Provenance

The reading helper's notes for this group say that an entry is verified only if its url line says VERIFIED against the page images, and this entry's does not. Its figures and quotes are the helper's reading of an abstract, a web page or a data interface, or were checked again by the research session only where a section below says so. Nothing here that a section below does not confirm should be taken as read from the source.

