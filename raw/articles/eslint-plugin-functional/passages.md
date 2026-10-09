# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

ESLint rules that forbid mutation, loops, throwing, classes and similar, grouped as no-mutations, no-statements, no-exceptions, currying, no-other-paradigms and stylistic.

## measured

no study. Use figures: stars 1,001; forks 36; created 2019-07-01; MIT; latest release v10.0.1 published 2026-09-16 (a fix to `no-expression-statements`); pushed 2026-10-04. Example rules from the README: `no-let`, `immutable-data`, `prefer-immutable-types`, `no-loop-statements`, `no-throw-statements`, `functional-parameters`, `no-classes`. Some rules need type information. The README offers strict, recommended and lite presets, the recommended one "a little more lenient".

## quotes

"ESLint rules to disable mutation and promote fp in JavaScript and TypeScript." (single read; the GitHub description field. The README's own sentence words it a little differently.)

## does not cover

These are pattern rules, not an effect system. My inference from the rule list (the README makes no claim either way): a function that uses only `const` and calls an impure function still passes, so the plugin does not check purity. Adoption is small next to the other tools here (about 1,000 stars).

## strength

n/a (a tool page; use figures only)

## how chosen

USE (1,001 GitHub stars; 518,934 npm downloads in the week 2026-09-27 to 2026-10-03)

## period

2022 or later, no language model

## group

G5     claims: C1 (a mechanical check for "no mutation, no hidden effect" patterns)     direction: background

## Provenance

The reading helper's notes for this group say that an entry is verified only if its url line says VERIFIED against the page images, and this entry's does not. Its figures and quotes are the helper's reading of an abstract, a web page or a data interface, or were checked again by the research session only where a section below says so. Nothing here that a section below does not confirm should be taken as read from the source.

