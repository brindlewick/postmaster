# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Random testing found 325 reported bugs across GCC, LLVM and other compilers, none in the verified middle end of CompCert after about six CPU-years, but bugs in its unverified front end and in a gap in its target semantics.

## measured

Csmith (a random C program generator avoiding undefined behaviour) with differential testing across compilers; "To date, we have reported 325 in total across all tested compilers (GCC, LLVM, and others)" (p. 6), of which 79 for GCC and 202 for LLVM (the later paper fonseca-2017 writes "more than 325"; I did not view the abstract). CompCert (verified optimising C compiler for PowerPC, ARM, x86; version 1.6 named) tested separately (p. 6): the first silent wrong-code error was in the unverified front end ("This bug and five others like it were in CompCert's unverified front-end code", so six); "Partly in response to these bug reports, the main CompCert developer expanded the verified portion of CompCert to include C's integer promotions and other tricky implicit casts." A second kind, two bugs: a PowerPC stack-frame offset overflowed a 16-bit field because "CompCert's PPC semantics failed to specify a constraint on the width of this immediate value, on the assumption that the assembler would catch out-of-range values". Also "a handful of crash errors". "We have devoted about six CPU-years to the task" without finding a wrong-code error in the verified parts. The spec was the compiler's own semantics; no person wrote a specification for this study.

## quotes

- "First, a verified compiler is only as good as its specification of the source and target language semantics, and these specifications are themselves complex and error-prone." (p. 2) (checked, page image read twice and the text layer agrees)
  - "Using Csmith, we found previously unknown bugs in unproved parts of CompCert—bugs that cause this compiler to silently produce incorrect code." (p. 2) (checked, page image read twice and the text layer agrees)
  - "As of early 2011, the under-development version of CompCert is the only compiler we have tested for which Csmith cannot find wrong-code errors." (p. 6) (checked, page image read twice and the text layer agrees)

## does not cover

a 2011 snapshot of an under-development CompCert; a test study, so absence of bugs in the verified part is evidence, not proof; the paper gives no single total for CompCert bugs (six front-end wrong-code, two from the PowerPC semantics gap, "a handful" of crashes); fonseca-2017 reads it as "more than 325 bugs, 11 of which were located in a verified compiler (CompCert)". Its own closing view: "verification does not obviate testing, but rather complements it" (p. 10).

## strength

one report or one team's experience (a large, systematic, independent test; one verified compiler)

## how chosen

SERIOUS (the most cited independent test of a verified compiler) and CONTRADICTS

## period

older (2011)

## group

G2 (Coq; CompCert)     claims: C2, C3     direction: mixed

