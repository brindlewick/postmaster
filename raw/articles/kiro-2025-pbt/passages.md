# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Kiro's agent turns requirements written in EARS form into "for any ..." properties and then into Hypothesis tests, surfaces a failure to the developer, and the developer decides whether to change the code, the test or the requirement.

## measured

nothing. The blog has one worked traffic-light example (no two directions green at once) and says property tests are "a more effective tool than traditional example-based testing at finding bugs", supported by argument and references, with no numbers; the docs page also gives no numbers. Both pages admit limits: property tests give "evidence of correctness, not a proof", properties that are too weak or state the wrong invariant pass despite wrong behaviour, not every requirement maps to a property (external services, non-determinism), and a person makes the final call on a disagreement. The blog names Hypothesis (Python); the docs page names no framework.

## quotes

"It provides evidence of correctness, not a proof." (single read, docs page, as printed in a summary)

## does not cover

no measurement of how often the properties derived from requirements are right, how often the failures are false alarms, or whether the tests find defects that example tests miss.

## strength

argued but not measured

## how chosen

USE (named industrial adoption: a major cloud vendor's IDE builds property-based tests from requirements; no usage figure was on either page)

## period

language-model

## group

G4     claims: C3, C4     direction: background (a vendor's claim, not evidence)

