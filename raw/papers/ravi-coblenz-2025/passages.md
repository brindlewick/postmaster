# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A corpus study of 426 Python programs that use Hypothesis classifies their property-based tests into 12 categories and reports that, by mutation testing on 40 projects, each property-based test finds about 50 times as many mutations as the average unit test.

## quotes

"each property-based test finds about 50 times as many mutations as the average unit test" (checked: the Crossref abstract and the Semantic Scholar record gave identical words from that point; a search snippet agrees)

## does not cover

I read the abstract only. A per-test ratio is not a per-project result: property-based tests are few, and each runs many inputs. The abstract does not say how many unit tests the projects had, whether the mutations a property-based test found were also found by unit tests, or how much the unit-test suites caught in total. A mutation is an injected change, not a real defect. The projects chose to use Hypothesis, so they are not a random sample of Python code.

## strength

one report or one team's experience (observational corpus study; abstract only)

## how chosen

SERIOUS (the only corpus study with mutation testing of property-based tests against unit tests that I found; OOPSLA 2025, Proc. ACM Program. Lang.)

## period

2022 or later, no language model

## group

G1     claims: C4     direction: supports

## Provenance

The reading helper's notes for this group say that an entry is verified only if its url line says VERIFIED against the page images, and this entry's does not. Its figures and quotes are the helper's reading of an abstract, a web page or a data interface, or were checked again by the research session only where a section below says so. Nothing here that a section below does not confirm should be taken as read from the source.

