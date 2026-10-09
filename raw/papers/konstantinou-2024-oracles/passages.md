# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A model asked to classify or write test assertions for Java code tends to accept or produce assertions that match what the code actually does, including buggy code, rather than what it should do.

## measured

TASK: (1) oracle classification: decide whether a given assertion is correct for the code, in four cases (correct or wrong code x correct or wrong assertion); (2) oracle generation: write five assertions for a test prefix. JUDGED BY: execution against developer-written oracles as ground truth; wrong code from the mutation tool muBERT; wrong assertions by GPT sampling; 135 unique model answers checked by hand. DATA: 24 open-source Java repositories (EvoSuite benchmark and Apache Commons), at most 1,000 tests per scenario; a GitBug-Java set to check for training-data leakage. MODEL: GPT-3.5-turbo only, three prompt variants. NUMBERS (per my read of the tables, not re-checked): classification accuracy about 41-46% (correct code, correct assertion), about 51-62% (correct code, wrong assertion), about 79-84% (wrong code, wrong assertion); with wrong code and a correct assertion accuracy falls by 8-9.5 points; generation: 57.5-60.0% of generated assertions pass, at least one valid in five for 89.3-93.8% of tests; mutation score of the model's oracles 18.0-19.9% against EvoSuite's 17.1-17.6%; EvoSuite-style names cost up to 16.1 points of accuracy.

## quotes

"capture the actual program behaviour rather than the expected one" (checked: this fragment is identical in the abs page abstract and in the html page's statement of the main finding; the full sentences differ slightly)

## does not cover

one model (GPT-3.5-turbo) and Java; unit-test assertions, not properties; says nothing about property-based tests, whose oracles are general properties rather than one expected value; absolute figures are low for everything, so the finding is about a lean, not a rate.

## strength

controlled study (one model)

## how chosen

CONTRADICTS (the direct test of "do model-written test oracles just encode what the code does")

## period

language-model

## group

G4     claims: C3, C4     direction: contradicts (models restate current behaviour)

