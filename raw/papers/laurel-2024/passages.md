# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

On lemmas taken from three real Dafny codebases, GPT-4o with the verifier's error location and similar examples produced the missing assertion for 56.6% of 145 cases within ten tries; with the code alone it managed 6.2%.

## measured

- TASK: given a real Dafny lemma that fails to verify because a helper assertion is missing, write the assertion. The specification and the proof around it are the codebase's own.
  - SIZE: DafnyGym, 145 assertion-synthesis tasks from three codebases written by engineers: the Dafny libraries, the Cedar specification (authorisation-policy language), and DafnyVMC (verified Monte-Carlo algorithms). Codebase total 33,054 lines with 2,613 assertions; "Most lemmas exceed 10 lines of code, with half spanning more than 18 lines" (Section 5.1, as read).
  - SPECIFICATION AUTHOR: people (the codebases' own).
  - WHAT SUCCESS MEANS: removing one assertion makes the lemma fail; a generated assertion counts if the lemma then verifies (Section 5.2: "we consider an assertion correctly generated if, and only if, the verifier fails to prove the lemma without it"). The paper documents no separate cheating check; since the task is to add an assertion to an existing lemma whose statement is unchanged, the specification is not at risk (my reading; paraphrase).
  - MODEL AND NUMBERS (Figures 9 and 11, Section 6.4 as read; the paper's own experiments): GPT-4o. Code only: 6.2% at k=10; with a placeholder at the error location: 34.4%; with placeholder plus examples chosen by a proof-similarity metric: 56.6% (82 of 145).

## quotes

- "Laurel is able to generate over 56.6% of the required assertions given only a few attempts" (abstract; single read, abs page)

## does not cover

One missing assertion per lemma only; the technique relies on mature existing assertion sets and may be weak early in a project (Appendix A.1, as read). Three codebases. It writes helper assertions, not specifications and not whole programs.

## strength

controlled study (145 tasks on real code; one model).

## how chosen

SERIOUS (evaluated on lemmas from real, large Dafny codebases, including the Cedar specification)

## period

language-model

## group

G4     claims: C2     direction: supports (narrowly) and the only one here on real, industrial code

