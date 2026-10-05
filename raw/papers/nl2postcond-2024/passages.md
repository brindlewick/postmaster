# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

GPT-4 usually writes postconditions that pass the tests (77% on the first try with the simple prompt), but the prompt that gives stronger postconditions is correct less often, many correct ones are weak type checks, and on 525 real Defects4J bugs the postconditions discriminated 64.

## measured

TASK: a postcondition (an executable assertion on a function's output) from a docstring or comment, with or without the reference code. JUDGED BY two things: (a) "test-set correct" = the postcondition holds on every test input with the reference implementation's output; (b) "bug-completeness" = share of code mutants (variants sampled from GPT-3.5, filtered to differ from the reference on at least one test) that violate a correct postcondition. Also a manual classification of 900 postconditions (139 EvalPlus problems) into 9 kinds. Both are checks of consistency with tests, not with what the user meant; the limitations section says tests are only a proxy for intent (first read; paraphrase). BENCHMARKS: EvalPlus (164 short Python problems with docstrings, reference solutions by the benchmark's authors, several hundred tests each); Defects4J (525 of the 835 curated Java bugs, those reproducible on Java 8, 840 changed functions, 17 projects; reference = the fixed version, tests = the bug's trigger and regression tests). SPEC WRITER: a model (GPT-3.5-turbo, GPT-4, StarChat 16B); no human-written specification. PROMPTS (Sec 2.2): the "simple" prompt "explicitly instructs the LLM to generate postconditions that capture an aspect of a function, rather than the whole function"; the "base" prompt lets the model build complex postconditions "often striving for a fully functional implementation" (the authors' explanation, Sec 3.2: simple ones are more likely to be correct, base ones have higher bug-completeness scores). NUMBERS (Table 1, EvalPlus, NL only, read twice): GPT-4 simple prompt accept@1 0.77, accept@10 0.96, 158/164 problems with at least one correct postcondition; GPT-4 base prompt accept@1 0.63, 144/164; GPT-3.5 simple prompt accept@1 0.55; StarChat 0.21-0.25. NUMBERS (Table 2, bug-completeness, GPT-4 NL only): base prompt 35.1% of postconditions bug-complete, mean bug-completeness score 0.85; simple prompt 9.2% and 0.52. So the prompt with the higher "correct" rate is the weaker specification. NUMBERS (Table 3, 900 manually classified): type checks are 47.4% of them and score 0.14 on natural mutants (0.27 on all mutants). NUMBERS (Defects4J, Sec 4.2): 33,600 postconditions in all (840 functions x 10 samples x 4 model/prompt variants); across all variants 70 buggy methods from 64 distinct bugs discriminated = 12.2% of the 525 considered; best single GPT-4 variant up to 47 bugs; against TOGA (a neural test-oracle generator), of 101 bugs caught by either, 59 only nl2postcond, 37 only TOGA, 5 both. A false-positive rate was not stated.

## quotes

"were able to catch 64 real-world historical bugs from Defects4J" (checked: abs page and html page give the same words); "finding that they are generally correct and able to discriminate incorrect code" (single read, html abstract)

## does not cover

short single-function problems with docstrings; the specification is an assertion in the same language, not a rich specification language; mutants come from a model's idea of a plausible bug, which the authors say may make the metric easier than real bugs; no comparison with human-written assertions or with ordinary example tests; models are 2023-era; the Defects4J figure is 12.2% of bugs, so most real bugs were not caught.

## strength

controlled study (benchmark-based; metric validated by manual analysis)

## how chosen

SERIOUS (the first systematic evaluation of "sentence to postcondition", with metrics for both correctness and discriminating power, and a test on real bugs)

## period

language-model

## group

G4     claims: C3, C4     direction: mixed

## Read again by the research session on 2026-10-04

Route: arXiv abstract page, read by the research session on 2026-10-04.

- "nl2postcond generated postconditions were able to catch 64 real-world historical bugs from Defects4J." (single read (this read only))
- "finding that they are generally correct and able to discriminate incorrect code" (checked: the reading helper's quote and this read give the same words)

## Read again by the research session on 2026-10-05

Route: arXiv HTML page, read by the research session on 2026-10-05.

- "77% of postconditions were test-set-correct and a test-set-correct postcondition was generated for 96% of problems" (single read (this read only))
- "we were able to generate a bug-discriminating postcondition for 70 buggy methods from 64 unique bugs in Defects4J, 12.2% of all bugs considered." (single read (this read only))

