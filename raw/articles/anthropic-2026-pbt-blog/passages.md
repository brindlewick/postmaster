# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

The blog repeats the paper's counts (984 reports, 56% valid, 32% reportable) and adds that when code carries an implicit assumption only the maintainers can decide the right property.

## measured

nothing new that I could separate from the paper, except a second phase on 10 important packages with a newer model (Sonnet 4.5); 5 bugs reported by hand, with patches merged for numpy.random.wald, aws-lambda-powertools and tokenizers and one patch submitted to cloudformation-cli-java-plugin (per my read of the page); three experts reviewed high-priority bugs at about an hour each before anything was filed; early versions raised false alarms when tests were wrapped in try/catch; no cost figure on the page.

## quotes

"If the code makes an implicit assumption, only the library maintainers can decide what the correct property to test is" (single read; as printed in a summary)

## does not cover

a vendor blog by the paper's authors; no baseline or control; the 56% still rests on the 50 reports they scored; "good at identifying properties that should be true" is the authors' claim.

## strength

one report or one team's experience

## how chosen

RECENT (the authors' own plain-language account and a later round of the agentic study above; it states who decides what a function should do)

## period

language-model

## group

G4     claims: C3, C4     direction: mixed

