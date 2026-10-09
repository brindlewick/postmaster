# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

On 600K lines of real F* programs and proofs, fine-tuned small models matched or beat GPT-4 at writing a definition that type-checks against a given specification, but even the best single model solved well under half of the test definitions.

## measured

- TASK: given an F* type as the formal specification (plus file context), write the definition (program and proof) that has that type; F* type-checks the fragment (Section IV, as read).
  - SIZE: version 1: 600K lines, 32,054 top-level definitions; version 2: 940K lines, 54,404 definitions. Sources: HACL* (cryptography), EverParse (binary parsing), miTLS-F*, EverQuic-Crypto, the F* compiler, Karamel, Merkle-tree, Steel (Section III, as read). Split V1 (Table I): training 22,779, validation 1,541, intra-project test 5,965, cross-project test 1,769 definitions.
  - SPECIFICATION AUTHOR: people, the projects' own authors (types in existing code).
  - WHAT SUCCESS MEANS: the checking harness verifies "solutions do not use escape hatches such as admit() or assume that are intended for interactive use" (Section III, as read).
  - NUMBERS (Table II as read, verify@10; the paper's own experiments, early 2024): intra-project test GPT-3.5 29.81%, GPT-4 36.38%, Phi-2 fine-tuned 31.10%, StarCoder fine-tuned 43.98%, all models combined 55.34%. Cross-project test: 18.54%, 28.49%, 20.97%, 32.90%, 45.56%.

## quotes

- "Our main finding in that the performance of fine-tuned smaller language models (such as Phi-2 or StarCoder) compare favorably with large language models (such as GPT-4), at a much lower computational cost." (abstract; single read, abs page)

## does not cover

Contamination is acknowledged: the GPT models' training data "very likely ... intersects the intra-project and cross-project test sets" because the repositories are public (Section VII, as read); 343 clones in the intra-project test set. "Partial Specifications: Type-correct solutions may not match underspecified user intent" (Section VII as read; paraphrase). Goal types contain implicit hints. Closed models change, so reproduction is hard. 2024 models only.

## strength

controlled study

## how chosen

USE (Microsoft Research; the dataset covers code used in production in Windows, Linux, Python and Firefox via the Everest projects)

## period

language-model

## group

G4 (also G2: F*)     claims: C2     direction: mixed

