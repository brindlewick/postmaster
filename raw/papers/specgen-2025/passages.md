# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

With a conversational prompt plus mutation of its own output, a model produced JML specifications that OpenJML accepts for 279 of 385 Java programs, well ahead of plain few-shot prompting, Houdini and Daikon, but the task is "specify code that already exists" and it needed that scaffolding.

## measured

TASK: a Java program in, JML out (preconditions, postconditions, loop invariants). JUDGED BY: (a) OpenJML accepts the program under the specification; (b) 15 PhD students rated specifications on a 1-5 scale (Sec V-D, Table V), for 15 SpecGenBench programs that all three tools handled plus the experts' reference, with the source hidden from them; the paper does not state the rating criteria and Table V gives only overall means (second read); (c) comparison with reference specifications written by three experts, one chosen as ground truth. No test of whether the specification rejects wrong programs. A verifier-accepted specification is consistent with the code; it is not shown to say what the program should do. PROGRAMS: 385 = 265 SV-COMP Java classes (mean 22.5 lines, 88.7% loop-free) + 120 SpecGenBench programs (20 from an earlier dataset, 100 from LeetCode; mean 20.8 lines); plus a separate set of 50 Defects4J programs (mean 375 lines). MODEL: gpt-3.5-turbo-1106 only (4 few-shot examples). NUMBERS (Table II, programs verified, 10 trials per LLM method): SpecGen 279 of 385; AutoSpec 247; plain conversational 218; 4-shot prompting 164; Houdini 98; Daikon 72. NUMBERS (Table V): mean rating SpecGen 4.54, expert reference 4.83, Houdini and Daikon 2.32. Defects4J set: SpecGen 38 of 50, conversational 28, Daikon 15. Ablation (Table III): removing the comparative-mutation operator drops 279 to 223.

## quotes

"succeeds in generating verifiable specifications for 279 out of 385 programs" (single read; the abs page and the html page agree on the figure but the abs-page text was a summary)

## does not cover

programs are small and mostly loop-free; one model from 2023; baselines were re-run by the same authors; the paper does not state the human-rating criteria (15 programs, 15 raters); 20 programs come from a public dataset (the authors discuss leakage risk and report 87 of the remaining 100 handled); nothing here shows a specification that captures intent from a sentence.

## strength

controlled study (one team, its own benchmark plus SV-COMP)

## how chosen

SERIOUS (ICSE paper, the usual comparison point for "specification from code with a model", and it adds a human rating of quality on top of a verifier)

## period

language-model

## group

G4     claims: C3     direction: mixed

