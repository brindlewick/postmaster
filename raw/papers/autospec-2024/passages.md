# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A model driven by static analysis and Frama-C feedback wrote ACSL annotations (loop invariants, pre- and postconditions) that let Frama-C prove the benchmark's own assertion for 199 of 251 C programs.

## measured

TASK: given a C program and the property to verify (an assertion that comes with the benchmark program), write ACSL annotations so that Frama-C's WP plugin proves it. JUDGED BY: legality (compiles), satisfiability (consistent with the program's behaviour) and adequacy (suffices to prove the assertion); a count of generated specifications that match the benchmark's ground truth is also reported; no mutant or human rating of strength. The intent was therefore already given as an assertion; the model supplied the supporting annotations. PROGRAMS: 251 = Frama-C-problems 51 (9-36 lines), SyGuS 133 (13-34), OOPSLA-13 46 (22-62), SV-COMP 21 (17-61), plus 6 functions of the X509-parser (55-136 lines, which took people about 5 months to annotate by hand). MODEL: GPT-3.5-turbo-0613 (Llama-2-70b as a generality check: 25/51 against 31/51 on Frama-C-problems). BASELINES: Code2Inv, CLN2Inv, Pilat, plain prompting. NUMBERS: 199/251 = 79% programs verified ("success"; five runs per program, results stable); the baselines together handled 125, hence "1.592x" = 199/125; ablation says program decomposition and hierarchical generation contribute most; a mutation check for training-data leakage (renaming variables, reordering statements) kept 98% of results on 100 programs.

## quotes

"successfully verifying 79% of programs through automatic specification synthesis" (single read; html abstract)

## does not cover

the assertion to prove is supplied by the benchmark, so this does not show a model deriving the right assertion from intent; programs are 9-136 lines; one 2023 model; nothing checks that the annotations are strong beyond proving the one assertion; the paper says whole-project verification "remains challenging".

## strength

controlled study (one team)

## how chosen

SERIOUS (CAV paper; the most-compared tool for model-written ACSL annotations)

## period

language-model

## group

G4     claims: C3     direction: mixed

