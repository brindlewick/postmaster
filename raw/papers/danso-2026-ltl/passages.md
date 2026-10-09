# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Models translate English into well-formed LTL much more often than into LTL with the right meaning, and rewriting the task as Python code completion lifts the semantic score a lot.

## measured

TASK: from an assertive English sentence, write a propositional LTL formula (also: extract atomic propositions, judge well-formedness, classify traces). JUDGED BY: syntax by grammar check; semantics by two-way entailment with the NuSMV model checker (the formula is equivalent to the reference when each implies the other); no check that the reference captures the sentence beyond the experts' selection. DATA: several sets from textbooks, published benchmarks and hand-made examples: 306 "Little Tricky Logic" sentences with reference formulas, 294 past-time rephrasings, 141 textbook sentences, 56 security requirements, and sets for the other tasks. MODELS: GPT-3.5-Turbo, GPT-4o, GPT-4o-Mini, Gemini-1.5-Flash, Gemini-1.5-Pro, Gemini-2.5-Flash, Claude-3.5-Sonnet (mostly 2024-era models). NUMBERS (as printed in a summary of the html page; single read): natural language to future-time LTL with a minimal interface, averaged over models: 48.7% syntactically valid and 23.9% semantically equivalent (Table 2); with the Python/AST interface Claude-3.5-Sonnet reached 72.13% equivalence (Fig 3); the Python interface raised equivalence by about 23.8% over minimal prompting (Table 4); past-time LTL with Gemini-2.5-Flash 96.84% syntactic and 72.96% equivalent (Fig 5); errors concentrate in nested temporal operators.

## quotes

"LLMs perform better on syntactic aspects of LTL than on semantic ones" (single read, abs page abstract, where it follows "in line with prior findings,")

## does not cover

short sentences, not whole requirement documents (the authors say real requirements are longer and more interdependent); no frontier 2026 models; contamination not evaluated; the metric gives no credit to a formula that is right under another reading of an ambiguous sentence, which the authors list as a difficulty of fair evaluation.

## strength

controlled study

## how chosen

RECENT (the 2026 follow-up on "a temporal-logic formula from a sentence", the task of nl2spec; it judges meaning by logical equivalence, not by resemblance)

## period

language-model

## group

G3, G4     claims: C3     direction: supports (models are weak at the meaning of a temporal-logic formula)

