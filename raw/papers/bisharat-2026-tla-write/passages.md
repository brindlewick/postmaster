# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Models usually fail to turn a natural-language description into a TLA+ specification that the model checker accepts: the best pooled open-weight result was 26.6% parseable and 8.6% passing TLC, and GPT-5 passed TLC on 7 of 26.

## measured

TASK: from the natural-language comments of a TLA+ specification (without the specification), write the whole specification. JUDGED BY: syntactic correctness = SANY parses it (30-second timeout); semantic correctness = it parses and TLC model-checks it with the reference configuration file; text similarity (BLEU, ROUGE-L, edit distance) only for the completion strategies. So "semantic" means "runs under the reference configuration", not "behaves as intended". DATA: 205 specifications from the TLA+ Foundation repository (consensus protocols such as Paxos and Raft, dining philosophers, Towers of Hanoi) split 143 train, 31 validation, 26 test; reference = the community's own specification. MODELS: 30 from eight families: 25 open-weight models x 26 specifications x 4 prompt strategies = 2,600 runs, plus 5 proprietary models with few-shot only (130 runs). NUMBERS: the abstract's 26.6% syntactic and 8.6% semantic figures describe the open-weight runs (best strategy: 26.6% SANY pass with few-shot; 8.6% TLC pass, only with progressive prompting, 0% for the other strategies); best open model DeepSeek r1:8b 14/26 under progressive prompting (first read); a 70B variant scored lower than its 8B sibling. The five proprietary models under few-shot (Table 6, read twice; SANY pass / TLC pass out of 26): GPT-5 26 / 7 (26.9%), Claude Sonnet 4.5 24 / 3, Claude Haiku 4.5 21 / 3, Claude Opus 4.1 23 / 1, GPT-4o 20 / 1. So the best frontier result is about one specification in four, and the headline 8.6% understates it. Five recurring failure kinds are listed (Unicode operator substitution, syntax from other languages, leaked reasoning, wrong length, structural errors).

## quotes

"LLMs achieve up to 26.6% syntactic correctness but only 8.6% semantic correctness, with successes exclusive to progressive prompting" (checked: abs page and html page give the same words); "current LLMs do not generate reliable TLA+ specifications without expert oversight" (checked, same two pages)

## does not cover

one run per model and specification, only 26 test specifications, no Amazon or Microsoft industrial specifications, a TLC pass shows the specification runs and keeps the reference configuration's properties, not that it models what the comment meant; the specifications are public and may be in training data.

## strength

controlled study

## how chosen

RECENT (2026 test of natural language to TLA+ over 30 models; model checking of designs is the other half of the owner's question)

## period

language-model

## group

G3, G4     claims: C3     direction: supports (models are weak)

