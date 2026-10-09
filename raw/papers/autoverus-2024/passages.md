# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A network of model agents writes the proof annotations (invariants, assertions, proof functions) for Rust programs whose Verus specifications are given, and proved 91.3% of 150 tasks against a 44.7% baseline of direct GPT-4o prompting.

## measured

- TASK: proof annotation only. Input: Rust code with its Verus pre and postconditions. Output: loop invariants, asserts, proof functions so that Verus accepts. Specifications are user-provided and not generated ("the goal of this work is to automatically generate proof annotations when provided with Rust code and its specifications", Section 1.1, as read).
  - SIZE: Verus-Bench, 150 tasks, 2,849 lines of executable code and 1,252 lines of specification in total (Table 1, Section 6.1), so about 19 executable lines per task on average (derived; paraphrase). Sources: CloverBench 11, Diffy 38 (array and loop programs from SV-COMP 2021), MBPP 78 (from MBPP-DFY-153), Misc 23 (Verus tutorials and libraries). 88 candidate tasks were rejected as trivial.
  - SPECIFICATION AUTHOR: people (taken from prior benchmark suites, translated to Verus).
  - WHAT SUCCESS MEANS and the cheat guard: a tool called Lynette compares the code with ghost code erased, compares the pre and postconditions with the originals "so the LLM cannot tweak them to change the goal of the verification", and "also searches for debugging ghost function, such as admit() or assume()" (Section 5, as read). So the success rule rejects modified specs, `admit` and `assume`.
  - MODELS AND NUMBERS (Table 2, Sections 7.1 to 7.2, as read; the paper's own experiments, 2024 models): GPT-4o (2024-05-13) is the main model; also GPT-4-turbo, GPT-3.5-turbo and Deepseek-R1-32B for comparison. AutoVerus 137 of 150 (91.3%); baseline 67 of 150 (44.7%). Per source: CloverBench 11 of 11 vs 8; Diffy 38 of 38 vs 5; MBPP 68 of 78 vs 43; Misc 20 of 23 vs 11. Cost: 8.8 LLM calls per task on average over three attempts; about 3 million input and 1.5 million output tokens in total (about 37 US dollars, as read).

## quotes

- "Our evaluation shows that AutoVerus can automatically generate correct proof for more than 90% of them, with more than half of them tackled in less than 30 seconds or 3 LLM calls." (abstract; single read, abs page)
  - "Lynette compares the pre- and post-condition of P and P_o so the LLM cannot tweak them to change the goal of the verification" (single read, HTML Section 5)

## does not cover

The paper assumes the user-provided specifications are correct and does not check them (Section 8, stated limitation). Small programs (about 19 executable lines on average). No real Verus codebase tested (few projects exist; "fewer than 10 projects on GitHub developed under Verus", Section 3, as read). The agents' phase-3 design came from the authors' own manual expertise. Some tasks were modified after translation (threats, Section 8). Temperature 1.0, three runs.

## strength

controlled study (150 tasks; baseline included; one team).

## how chosen

SERIOUS (the standard Verus proof-generation system; alphaverus-2024 compares to it, and verusage-2025 builds on the same Microsoft Research authors' line of work)

## period

language-model

## group

G4     claims: C2     direction: supports (narrowly: proofs for given Verus specifications) with a stated limit on specification correctness

