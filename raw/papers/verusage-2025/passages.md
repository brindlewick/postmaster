# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Coding agents completed 81% of 849 proof tasks taken from real Verus-verified systems (best model, Sonnet 4.5), up from 41% for the weakest model in the same study, and one model cheated in 14% of tasks until it was given a cheat checker.

## measured

- TASK: proof annotations only. Input: Rust code with its Verus pre and postconditions, proof annotations removed; output: annotations so that Verus accepts. "In all cases, we do not change the pre- and post-conditions of F" (Section 3.1, as read).
  - SIZE: VeruSAGE-Bench: 849 proof tasks extracted from eight (the table lists nine abbreviations) open-source Verus-verified systems: Anvil library and controller, IronKV, a memory allocator, node replication, NRKernel, Atmosphere (an OS), a storage system, Vest (Table 2, as read). Mean per task (Table 3, as read): 947 total lines, of which 496 specification lines, 401 helper-lemma lines and 23 proof-annotation lines to be written; the average per project runs from 84 lines (Anvil library) to 4,016 (Anvil controller).
  - SPECIFICATION AUTHOR: the systems' developers (people).
  - WHAT SUCCESS MEANS: Verus accepts and a "cheat checker" confirms no illegal change. The prompt forbids `admit`, `assume`, new `external_body` functions, new axioms, changes to pre or postconditions and changes to executable Rust (Section 4.1, as read). "Without the cheat checker, Sonnet 4 cheated in 14% of proof tasks ... Once we suggest LLMs to use the cheat checker in our prompt, the cheat rate decreases to less than 1.5% for all models." (Section 5.6, as read, single read).
  - MODELS AND NUMBERS (Table 5, share of the 849 tasks completed, best agent setting per model; the paper's own experiments): o4-mini 41%, GPT-5 55%, Sonnet 4 64%, Sonnet 4.5 81%. Per project the range is wide: for Sonnet 4.5, 100% on the Anvil library, node replication and Vest but 37% on the Anvil controller and 74% on NRKernel.
  - EXTRA SET: 25 functions in Atmosphere that human experts had not finished (10 lemmas with no proof, 17 functions with partial proofs containing `assume`, as read): Sonnet 4.5 wrote complete proofs for 23 of 25 (92%); and "Sonnet 4.5 points out five lemmas whose specification requires adjustment, with all five confirmed by human experts" (Section 5.2, as read). Model proofs were 2.5 times longer than human proofs (Section 5.3).

## quotes

- "The best LLM-agent combination in our study completes over 80% of system-verification tasks in VeruSAGE-Bench." (checked: abstract on the abs page and the HTML read, same words)
  - "Without the cheat checker, Sonnet 4 has cheated in 14% of the proof tasks!" (single read, HTML; the 14% figure itself appeared in two reads; the other read gave the cheat rate with the checker prompted as "less than 1.5% for all models")
  - "Notably, Sonnet 4.5 points out five lemmas whose specification requires adjustment, with all five confirmed by human experts." (checked: two reads, Section 5.2)

## does not cover

Specification choice: the authors say LLMs have not been shown to break "the project-level verification goal into the right specification at the level of every executable function" (Section 7, as read). Single-file extraction; a whole-project run failed in an hour and cost 1.6 to 2.2 times more (Section 5.7, as read). About 10% of initially failed tasks succeeded on a second run (nondeterminism). Inductive invariant synthesis for state machines was out of reach (Section 5.4). Only Verus.

## strength

controlled study (849 tasks, four models, real systems; one group)

## how chosen

SERIOUS (the largest study of agents on real verified Rust systems) and RECENT (models of mid to late 2025; shows how fast the figure moved between models)

## period

language-model

## group

G4     claims: C2, C3     direction: mixed (strong on proofs for given specifications in real systems; says nothing yet on choosing the specification; measures cheating)

