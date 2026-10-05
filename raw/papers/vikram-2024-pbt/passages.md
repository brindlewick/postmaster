# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Given only API documentation, the best model needed about 2.4 samples to get a Hypothesis test that runs and passes, but its tests covered only about a fifth of the properties the documentation states.

## measured

TASK: from API documentation of a Python method, write a Hypothesis property-based test (input strategies, a call, property assertions). JUDGED BY: validity (no run-time errors other than assertion failures over all invocations), soundness (no assertion failures on the correct implementation; checked by execution, then against two human raters: 219 labelled assertions of which 173, 79%, were sound; the metric agreed with the raters at 100% precision and 97% recall), and "property coverage" by mutation: for each documented property, mutants of the API that violate it, and the share the test kills. SUBJECTS: 40 API methods from 10 libraries (dateutil, html, zlib, cryptography.fernet, datetime, decimal, networkx, numpy, pandas, statistics), 200 properties (5 per method, extracted by prompting the model). SPEC WRITER: the model, from documentation; the properties for the coverage measure were also model-extracted. MODELS: GPT-4, Claude-3-Opus, Gemini-1.5-Pro; single-stage and two-stage prompts, 5 samples each at temperature 0.7. NUMBERS (Tables 2 and 5, read twice, identical): 3,110 test functions in all, 1,221 valid (39.26%), 814 valid and sound (26.17%); best setting (GPT-4, two-stage) valid and sound for 41.74% of test functions (306 of 733), against 25.47% single-stage; Claude-3-Opus two-stage 31.04%, Gemini-1.5-Pro two-stage 15.51%; the best approach needed 2.4 samples on average for a valid and sound test; property coverage (a property counts as covered if any of five samples kills one of its mutants): GPT-4 two-stage 20.5% of the 200 properties, Claude-3-Opus 13%, Gemini-1.5-Pro 12%, single-stage 5.5 to 9%; the abstract reports this as 21%.

## quotes

"a valid and sound PBT can be synthesized in 2.4 samples on average" (checked: abs page and html page give the same words); "the best model (GPT-4) is able to automatically synthesize correct PBTs for 21% of properties extractable from API documentation" (checked, same two pages); "Pain points in writing property-based tests include implementing diverse random input generators and thinking of meaningful properties to test." (single read, html abstract)

## does not cover

40 well-known library methods, probably in training data; the properties used for coverage are model-extracted from the same documentation, so a property the model never lists is never measured; mutants are property-violating variants, not real bugs; Python and Hypothesis only; 2024 models.

## strength

controlled study

## how chosen

SERIOUS (the first controlled study of models writing property-based tests from documentation, with a measure of what the tests cover; the agentic study above compares itself with it)

## period

language-model

## group

G4     claims: C3, C4     direction: mixed (leans against "models write good properties")

## Read again by the research session on 2026-10-05

Route: arXiv abstract page, read by the research session on 2026-10-05.

- "we find that with the best model and prompting approach, a valid and sound PBT can be synthesized in 2.4 samples on average" (single read (this read only))
- "the best model (GPT-4) is able to automatically synthesize correct PBTs for 21% of properties extractable from API documentation" (checked: the reading helper's quote and this read give the same words)

