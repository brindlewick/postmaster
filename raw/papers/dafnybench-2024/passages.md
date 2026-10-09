# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Models are given a Dafny program that already has its specification and asked to put back the removed assert and invariant hints, and the best of them got 68% of 750-plus programs through the verifier.

## measured

- TASK: proof-hint filling. Ground-truth programs that already verify; all `assert` and `invariant` statements in bodies removed; the model must add hints back until Dafny verifies. Not code synthesis, not specification writing.
  - SIZE: "over 750 programs with about 53,000 lines" (abstract); the HTML read gives 782 programs: 556 scraped from GitHub (deduplicated from about 15,000 to about 5,000 files), 62 human-written textbook programs from the Clover dataset, 164 translated from MBPP (Dafny-synthesis). About 68 lines per program on average (derived: 53,000/782; paraphrase). A second read gives Table 2: 1,916 characters per program on average, with no single lines-of-code figure; the 2026 DafnyPro paper reports an average of 52.77 lines and a maximum of 41.3k lines for the same 782 programs (see dafnypro-2026), so "about 50 to 70 lines" is the order of size.
  - SPECIFICATION AUTHOR: given, not written by the model. Written by the original program authors (people) for the GitHub and Clover parts; the MBPP-translated part was written with GPT-4 (HTML read, section on data sources).
  - WHAT SUCCESS MEANS: the HTML read says three checks: "1) The reconstructed program is verified with Dafny; 2) LLM preserves all preconditions (requires statements) and postconditions (ensures statements); and 3) LLM does not use {:verify false} or {assume false} to 'cheat.'" So the benchmark guards the three obvious cheats. It does not check that the specification is the right one (it is taken as given).
  - MODELS AND NUMBERS (HTML read, results table, up to 10 attempts with error feedback, 95% interval as printed): no-LLM baseline 26.9% (programs that verify with no hints at all); GPT-3.5 Turbo 44.0 +/- 1.8%; GPT-4 Turbo 59.8 +/- 1.8%; GPT-4o 59.3 +/- 1.8%; Claude 3 Opus 67.8 +/- 1.7% (best); CodeLlama-7b-Instruct 28.0 +/- 1.6%. First attempt for the best models about 54%, plateau about 65% by n of about 5. These are the paper's own experiments, mid-2024 models.
  - SIZE EFFECT: success drops with program length and with the amount of hint text needed (Figures 4a and 4b, as read).

## quotes

- "this benchmark does not assess a model's competence in translating natural language into concise formal specifications." (checked: two reads; the limitations section)
  - "LLM does not use {:verify false} or {assume false} to 'cheat.'" (checked: two reads, same words apart from markdown marks; the evaluation rule)
  - "Data contamination emerges as a potentially significant limitation for evaluating LLMs on this benchmark." (checked: two reads)

## does not cover

Whether the given specifications are the right ones for any user need (taken as correct). Writing the specification (the paper says so). Code synthesis from scratch. Contamination is flagged by the authors as a risk because 556 of 782 programs are scraped from public GitHub, so a number here may partly reflect memorised programs; no contamination control is reported beyond asking users not to train on the listed repositories. Mid-2024 figures: the vericoding paper reports later models at 89% and 96% on this same set.

## strength

controlled study (one benchmark, several models, repeated attempts, intervals given); about the narrow task of filling hints.

## how chosen

SERIOUS (largest Dafny hint benchmark when published; the vericoding paper uses it as its year-on-year yardstick, see vericoding-2025)

## period

language-model

## group

G4     claims: C2, C3     direction: mixed

