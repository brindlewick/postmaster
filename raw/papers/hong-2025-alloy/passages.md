# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Two reasoning models wrote correct Alloy formulas for the classic graph and relation properties from English descriptions, and could list many distinct correct formulas, so on small, well-known specifications they do well.

## measured

TASKS: (1) English description to Alloy formula; (2) Alloy formula to equivalent different formulas; (3) completing a formula sketch that has holes. JUDGED BY: equivalence to the reference formula checked with the Alloy Analyzer (no counterexample within the default scope of 3 atoms); no person checked that a formula says what the sentence meant. SUBJECTS: 11 properties (3 graph: DAG, cycle, circular; 8 binary-relation: connex, reflexive, symmetric, transitive, antisymmetric, irreflexive, functional, function). MODELS: OpenAI o3-mini, DeepSeek R1. NUMBERS: English to Alloy (Table 3): o3-mini 1 to 16 correct formulas per property (6 of 11 properties with at least 10); R1 8 to 19 (10 of 11 with at least 10); sketch completion (Table 5): 10 of 11 for both, the eleventh after a second attempt.

## quotes

"The LLMs generally perform well at creating Alloy formulas from their descriptions in natural language." (single read, as printed in a summary)

## does not cover

textbook properties very likely in training data (the authors name memorisation as a possibility); small scope; equivalence is to a reference the authors supplied; no real system specification.

## strength

one report or one team's experience

## how chosen

CONTRADICTS (a clearly positive result for models writing declarative specifications; the weak point is that the properties are classic textbook ones)

## period

language-model

## group

G3, G4     claims: C3     direction: contradicts (models do well here)

