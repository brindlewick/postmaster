# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

The model proposes input-output tests, a person answers yes or no to each, and the answers prune and rank code candidates, lifting Codex's pass@1 by 22-38 points on MBPP and 25-54 points on HumanEval within one to five questions.

## measured

TASK: from a sentence, produce code plus tests; the user approves or rejects tests, and the approved set (T+) is the formal statement of intent. JUDGED BY: pass@k@m (does one of k suggestions pass hidden tests after m queries) and accept@m (is at least one of m suggested tests consistent with intent). The "user" is simulated by the reference implementation; no real user study. BENCHMARKS: MBPP (427 problems), HumanEval (164, with docstring examples removed); tests and reference code are the benchmarks' own. MODEL: Codex code-davinci-002, 100 code and 50 test suggestions per problem. NUMBERS: pass@1 baseline 48.24% (MBPP) and 30.49% (HumanEval); with 1 query MBPP 70.73% and HumanEval 55.28%; the gains with 1 to 5 queries are 22.49-37.71 points (MBPP) and 24.79-53.98 points (HumanEval); an acceptable test was found in 1.7 (MBPP) and 1.5 (HumanEval) queries on average, within 10 queries for 87.12% and 95.73% of problems.

## quotes

none kept

## does not cover

the user is simulated by the reference solution, which never says "I do not know what I want"; the paper does not report how often a suggested test was wrong; short benchmark functions; Codex is a 2022 model.

## strength

controlled study (simulated users)

## how chosen

SERIOUS (the origin of the "tests as the formalised intent, approved by the user" workflow that later work builds on)

## period

language-model

## group

G4     claims: C3     direction: supports (the user must confirm the intent; the model alone cannot)

## Corrected after an independent check of the page against its sources, 2026-10-05

The paper's evaluation used "between 1 to 5 simulated user queries": the answers in the lifts above are simulated, not from people.

The one-sentence summary under `says` above is replaced, in `source.md` and on the wiki page, by: The model proposes input-output tests, a person answers yes or no to each, and the answers prune and rank code candidates, lifting Codex's pass@1 by 22-38 points on MBPP and 25-54 points on HumanEval within one to five questions, which in the paper's evaluation were answered by simulated users.

