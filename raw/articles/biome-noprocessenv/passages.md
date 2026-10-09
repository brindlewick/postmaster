# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Biome's noProcessEnv rule disallows the use of process.env; it is in the style group, available since v1.9.1, and not recommended by default.

## measured

no study. The rule page only.

## quotes

"Disallow the use of `process.env`." (single read; the rule page)

## does not cover

It checks one global. Whether Biome can restrict imports of node:fs or node:child_process, or reads of the clock, per folder was not checked.

## strength

n/a (documentation)

## how chosen

USE (the project's gate runs Biome 2.5.14 as a formatter only, `biome format`, and does not run its linter, from package.json at b6283aa)

## period

2022 or later, no language model

## group

G5     claims: C1     direction: background

