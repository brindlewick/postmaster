# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A small fine-tuned model that retrieves relevant lemmas and similar proofs from the project proved 32.0% of 10,396 theorems from 12 real Coq projects, and success fell steeply as the human proof got longer.

## measured

- TASK: given a Coq theorem statement from an open-source project, produce a proof script that Coq accepts with no goals left.
  - SIZE: CoqStoq dataset 196,929 theorems from 2,226 GitHub projects (abstract); the curated test set 12 projects and 10,396 theorems, including CompCert and also mathematics projects such as FourColor and MathClasses (Table II, Section IV as read). Median human proof about 3 to 4 tactics (Figure 2, as read).
  - SPECIFICATION AUTHOR: people (the projects' authors).
  - MODEL AND NUMBERS (Table II as read; the paper's own experiments, 10 minute timeout per theorem): fine-tuned DeepSeek-Coder 1.3B (a small model). Rango 3,325 of 10,396 (32.0%); Tactician 2,575 (24.8%); Proverbot9001 2,007 (19.3%). Adding relevant proofs to the context raised proved theorems by 47% (abstract). Not evaluated: GPT-4o and CoqHammer (as read).
  - LENGTH EFFECT: "all proof synthesis tools show a sharp decrease in the percentage of theorems proven as the length of human-written proofs increases" (Section V-G1, as read).

## quotes

- "On this benchmark, Rango synthesizes proofs for 32.0% of the theorems, which is 29% more theorems than the prior state-of-the-art tool Tactician." (abstract; single read, abs page)
  - "It is possible that [CoqStoq's benchmark] intersects with the LLM's pretraining data." (single read, Section V-H, as read)

## does not cover

Statements are given by people; nothing about writing specifications or code. Contamination mitigated only by two post-cutoff projects (Table III). A 1.3B model; frontier models were not tried in this paper.

## strength

controlled study

## how chosen

SERIOUS (largest evaluation of proof synthesis on real Coq projects, including CompCert; the 32.0% figure is the prior result that aria-2026 compares against)

## period

language-model

## group

G4     claims: C2     direction: mixed (a third of real theorems; falls sharply with proof length)

