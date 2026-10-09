# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

With a verifier-guided repair loop, models verified 56.4% of 250 competition-style Dafny problems (against 11.6% for one shot of GPT-5.5) and 92.7% of DafnyBench, but most verified solutions then failed the original executable tests, mainly by running out of time.

## measured

- TASK: (a) LCB-Pro-Dafny: from a prose problem and a Dafny signature with a formal specification, write the implementation and the proof artefacts. (b) DafnyBench: the specification and code are given; restore invariants and assertions.
  - SIZE: 250 problems selected from LiveCodeBench-Pro (100 easy, 100 medium, 50 hard); lines of code per problem not given (as read). No contamination controls mentioned (as read).
  - SPECIFICATION AUTHOR: for LCB-Pro-Dafny, "produced with model assistance and then manually reviewed"; "During review, we removed or revised tasks with inconsistent, underspecified, or vacuous specifications." (HTML read, single read.)
  - WHAT SUCCESS MEANS: verifier acceptance plus a reviewer stage with deterministic checks that reject `assume` and `{:extern}`, a rule that the original requires and ensures clauses are a subset of the proposed ones ("This prevents specification weakening"), and a model reviewer for cheating patterns such as "rewriting a predicate to be trivially true" (as read).
  - MODELS AND NUMBERS (Tables 1 and 2 as read; the paper's own experiments, mid-2026 models): Gemini-3.1-Pro, GPT-5.5 (low and medium reasoning) and Claude Opus 4.5. LCB-Pro-Dafny verified: AxDafny 56.4% overall versus GPT-5.5 pass@1 11.6%; easy 75.0% vs 13.0%, medium 52.0% vs 14.0%, hard 28.0% vs 4.0%. DafnyBench: AxDafny with Gemini-3.1-Pro 92.7%; DafnyPro 86.2%; Gemini-3.1-Pro pass@1 68.5%; "DafnyBench baseline" 68.0%.
  - VERIFIED BUT NOT RUNNABLE: of 75 verified easy-split solutions, "32 pass the original executable tests, 39 fail by time limit exceeded (TLE), and 4 fail by memory limit exceeded"; of 52 verified medium-split solutions, "6 pass the executable tests, 44 fail by TLE, and 2 fail by MLE" (Section 5, as read). The authors: "Dafny specifications constrain functional correctness but generally do not constrain asymptotic complexity or memory usage."

## quotes

- "Lastly, we show that verification success and runtime test performance measure different aspects of generated code." (checked: abstract on the abs page and the HTML read, same words)
  - "Dafny specifications constrain functional correctness but generally do not constrain asymptotic complexity or memory usage." (checked: two reads of the HTML; one read has "The" before "Dafny")
  - "On the easy split, AxDafny verifies 75/100 tasks; among these verified outputs, 32 pass the original executable tests, 39 fail by time limit exceeded (TLE), and 4 fail by memory limit exceeded (MLE)." (checked: two reads of the HTML)

## does not cover

Part of the TLE rate is Dafny's compile-to-Python runtime being slow ("Dafny compilation to Python relies on runtime implementations... slower than native", limitations as read), so it is not wholly the models' fault. Hard problems are "far from saturated" at 28.0%. Specifications were written with model help ("produced with model assistance and then manually reviewed"). The ICML version is a workshop paper (AI for Math workshop), not a main-track paper.

## strength

controlled study (one team; new benchmark; model-assisted specifications)

## how chosen

RECENT (newest result found; includes the cleanest measurement of verified-but-fails-tests) and CONTRADICTS

## period

language-model

## group

G4     claims: C2, C3     direction: contradicts (what the verifier accepts is often too slow to run; verification and tests measure different things)

