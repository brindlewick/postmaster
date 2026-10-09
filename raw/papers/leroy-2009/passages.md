# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

CompCert's Coq development is 42,000 lines and about 3 person-years, three quarters of it proof, and the author lists exactly what is still trusted: the semantics of the source and target languages, the unverified parser, assembler and linker, the extraction chain, and Coq itself.

## measured

one compiler (Clight subset of C to PowerPC, 14 passes, 8 intermediate languages), built and proved by the author's team. Size, PDF p. 5 (section 3.3): "42000 lines of Coq (excluding comments and blank lines) and approximately 3 person-years of work", of which 14% define the compilation algorithms, 10% specify the semantics of the languages, and "the remaining 76% correspond to the correctness proof itself" (so about 5,900 lines of compiler, 4,200 of semantics, 31,900 of proof; proof about 5 lines to one of code, my arithmetic from the percentages.) "Each compilation pass takes between 1500 and 3000 lines of Coq for its specification and correctness proof"; each intermediate language 300 to 600 lines; Clight 1,100 lines; a further 10,000 lines of shared infrastructure. Performance (section 3.5, own small suite, 2 GHz PowerPC): code "only 7% slower than gcc -O1 and 12% slower than gcc -O2" on average, compile time within a factor of 2 of gcc -O1. Design point worth noting for a TypeScript project: for hard algorithms (register allocation by graph colouring) the proof covers a small checker of the untrusted algorithm's result ("validate a posteriori"), not the algorithm (section 4.2). Trusted base, p. 8 (section 5): the semantics of Clight and PPC; "the CIL-based parser, the assembler, and the linker"; the extraction facility, the Caml compiler and runtime; "The Coq proof assistant itself".

## quotes

- "The whole Coq formalization and proof represents 42000 lines of Coq (excluding comments and blank lines) and approximately 3 person-years of work." (PDF p. 5) (checked, page image read twice and the text layer agrees)
  - "Perhaps the most delicate issue is (1): how can we make sure that a formal semantics agrees with language standards and common programming practice?" (PDF p. 8) (checked, page image read twice and the text layer agrees)
  - "manual reviews by experts, as well as testing conducted on executable forms of the semantics, could provide reasonable (but not formal) confidence." (PDF p. 8) (checked, page image read twice and the text layer agrees)

## does not cover

one compiler, one target (PowerPC), a subset of C, 2008 state; the 3 person-years excludes the earlier years of the project and the later extensions. It says nothing about the cost of keeping the proof current as the compiler grows. The semantics (the specification) is trusted on expert review and testing, in the author's own words, not on proof.

## strength

one report or one team's experience

## how chosen

SERIOUS (the founding paper of the best-known verified compiler; states its own trusted base)

## period

older (2008/2009)

## group

G2 (Coq)     claims: C2, C3     direction: mixed

