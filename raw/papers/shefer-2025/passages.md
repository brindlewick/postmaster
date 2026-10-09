# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

With Claude 3.5 Sonnet, the share of programs verified falls from 86% in Dafny when code and specification are given (proof only) to 29% when only a prose description and a signature are given, and the same fall appears in Nagini and Verus.

## measured

- TASK: six "modes" of how much is given: 1 code and specification, model writes the proof; 2 code and specification functions, model writes spec and proof; 3 code, spec and signature, model writes implementation and proof; 4 as 3 plus prose; 5 prose, signature and specification functions, model writes everything; 6 prose and signature only (HTML read, Section 2).
  - SIZE: datasets derived from HumanEval, hand-curated: Dafny 132 programs, Nagini (Python) 106, Verus 55. Dafny and Verus sets "created manually, with multiple people collaborating over several weeks" (Section 2.4, as read). Solutions run from one function with its specification to several functions with lemmas, loop invariants and assertions.
  - SPECIFICATION AUTHOR: people (reference solutions). In modes where the model writes the specification, a generated specification passes only if it implies the reference specification (preconditions may be weaker and postconditions stronger) (Section 2.3, as read). Validation wrappers check that the original code was not modified and that specifications are not trivial (Section 2.2).
  - WHAT SUCCESS MEANS: the verifier accepts AND the wrapper's checks hold (code unchanged, specification implies the reference). The paper notes models "misinterpret user intent, break the rules by erasing function definitions or simplifying pre- and postconditions" (Section 2.2, as read), i.e. cheating attempts are observed and filtered.
  - MODEL: Claude 3.5 Sonnet only for the table; GPT-3.5, GPT-4o and Claude 3 Opus were tried and Claude 3.5 Sonnet "massively surpassed the others" (Section 3, as read). o1, DeepSeek-R1, o3-mini were not tested.
  - NUMBERS (Table 1, share of programs verified, by mode 1 to 6; the paper's own experiments): Dafny 86%, 79%, 86%, 82%, 61%, 29%. Nagini 66%, 54%, 63%, 63%, 42%, 15%. Verus 45%, 31%, 36%, 40%, 24%, 15%. So: language effect (Dafny above Nagini above Verus), and a large drop once the specification is no longer given (modes 5 and 6).

## quotes

- "Our study demonstrates the ability of LLMs to generate formally verified code, lowering the barriers to adoption of formal methods in mainstream programming." (single read, HTML Section 4)
  - "we always compare the code to the ground truth in our benchmarks, which might not scale well if more complicated tasks are considered" (single read, limitations)

## does not cover

HumanEval-sized problems; one model for the main table; the specification check relies on a reference solution being available, which a real project does not have. Early-2025 model.

## strength

controlled study (one model, three languages, six information levels).

## how chosen

SERIOUS (the only study read that varies how much of the specification the model is given, in three verification languages, with the same model and tasks)

## period

language-model

## group

G4     claims: C2, C3     direction: mixed (strong when a specification is given, weak when only prose is given)

