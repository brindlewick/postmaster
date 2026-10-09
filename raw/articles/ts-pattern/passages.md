# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Pattern matching for TypeScript whose `.exhaustive()` makes the compiler fail when a case of a union is not handled.

## measured

no study. Use figures: stars 15,178; forks 174; created 2020-05-24; MIT; latest release v5.9.0 published 2025-10-26; last push 2026-09-11. README: about 2kB; the match "exhaustiveness checking" is at compile time and fails with a `NonExhaustiveError`; at runtime an unexpected value throws by default; the README warns of longer compile times.

## quotes

"exhaustiveness checking, making sure that we have handled all possible cases" (single read)

## does not cover

It checks that every case of a declared type is covered, not that each branch is right, and a value outside the declared type at runtime still throws. It proves nothing about the branches.

## strength

n/a (a tool page; use figures only)

## how chosen

USE (15,178 GitHub stars; 8,313,194 npm downloads in the week 2026-09-27 to 2026-10-03)

## period

2022 or later, no language model

## group

G5     claims: C1 (making a closed set of cases explicit)     direction: background

## Provenance

The reading helper's notes for this group say that an entry is verified only if its url line says VERIFIED against the page images, and this entry's does not. Its figures and quotes are the helper's reading of an abstract, a web page or a data interface, or were checked again by the research session only where a section below says so. Nothing here that a section below does not confirm should be taken as read from the source.

