# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A QuickCheck-style framework in TypeScript that generates inputs, runs a predicate on hundreds of them, shrinks a failing input to a small counterexample, and plugs into Jest, Vitest and other runners.

## measured

no study. Use figures: stars 5,177; forks 214; created 2017-10-30; MIT; latest release v4.10.2 published 2026-09-19 (a fix to the `interruptAfterTimeLimit` plugin crash); repository pushed 2026-10-04. Features the README names: shrinking, model-based testing of UIs, APIs and state machines, race-condition detection in async code, replay of a failing run, custom examples beside generated ones, `fc.pre` preconditions. The README lists jest, jasmine, fp-ts, io-ts, ramda, js-yaml and query-string as projects that use it (the project's own list; not independently checked). `@fast-check/vitest` gives `test.prop` and `it.prop`, needs Node 20.19 or newer with Vitest 4, and its "one-time random mode" runs once and does not shrink (single read of the package README).

## quotes

"Property based testing framework for JavaScript (like QuickCheck) written in TypeScript" (checked: the GitHub API description field and the README gave identical words)

## does not cover

It checks a property on generated inputs and proves nothing; the README's own framing is that it generates counterexamples to falsify a claim. A pass means no counterexample turned up in the cases tried. It does not write the property: finding the property is the user's job (see goldstein-icse2024 for what that costs). The adopter list is a README list, not a count of use.

## strength

n/a (a tool page; the figures are use counts and say nothing about defects found)

## how chosen

USE (5,177 GitHub stars; 59,653,692 npm downloads of `fast-check` in the week 2026-09-27 to 2026-10-03; `@fast-check/jest` 668,945 and `@fast-check/vitest` 452,362 in the same week)

## period

2022 or later, no language model (project started 2017; figures are for the current v4 line)

## group

G5 (also G1)     claims: C4 (the tool that makes C4 usable in TypeScript), C1     direction: background

## Provenance

The reading helper's notes for this group say that an entry is verified only if its url line says VERIFIED against the page images, and this entry's does not. Its figures and quotes are the helper's reading of an abstract, a web page or a data interface, or were checked again by the research session only where a section below says so. Nothing here that a section below does not confirm should be taken as read from the source.

