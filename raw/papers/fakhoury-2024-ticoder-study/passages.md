# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

In a within-subjects study of 15 programmers, those who confirmed model-proposed tests judged generated code correctly 84% of the time against 40% for those given plain suggestions, with lower workload.

## measured

TASK: from a sentence, code suggestions plus tests; the person answers on tests. JUDGED BY: correctness of the person's final choice and NASA-TLX workload. SUBJECTS: 15 programmers (8 industry, 7 academia), three MBPP tasks (LowerUnderscore, FirstMissing, MaxProduct), 15 minutes each, Latin-square order. NUMBERS (Table III): correctness control 0.40, test pass/fail variant 0.84 (p=0.001), expected-output variant 0.64; cognitive load 45.46 against 28.00 (p=0.007); in the output variant half of the users gave a wrong expected output on one edge case (FirstMissing: 3 instead of 0). Scale experiment: MBPP 427 and HumanEval 164 with an idealised proxy user (the reference code), several models including GPT-3.5, GPT-4-turbo, CodeGen; the abstract reports an average absolute pass@1 gain of 45.97% within 5 interactions while Section VII gives 45.73% for the output variant (two reads agree that the paper's own two figures differ).

## quotes

"We observe an average absolute improvement of 45.97% in the pass@1 code generation accuracy for both datasets and across all LLMs within 5 user interactions" (checked: abs page and html page give the same words)

## does not cover

15 people, three small tasks, no ability to edit prompts or code; the idealised proxy is an upper bound by the authors' own statement; says nothing about large specifications.

## strength

controlled study (small human sample)

## how chosen

SERIOUS (the only human-subject study I found of whether a person can confirm a model's reading of their intent)

## period

language-model

## group

G4     claims: C3     direction: supports (people judge intent better through tests than by reading code)

