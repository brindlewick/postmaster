# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

The author argues that the key unsolved problem for AI-written code is validating that a formal specification says what the user meant, because "there is no oracle for specification correctness other than the user", and surveys early results.

## measured

nothing of its own. A survey of early research as the abstract states it: interactive test-driven formalisation that improves program correctness, AI-generated postconditions that catch real-world bugs missed by prior methods, and end-to-end verified pipelines that produce provably correct code from informal specifications. The numbers are in the cited papers, not here.

## quotes

- "since there is no oracle for specification correctness other than the user, we need semi-automated metrics that can assess specification quality with or without code" (abstract; single read, abs page)

## does not cover

Only the abstract was read. No evaluation. The open challenges it lists: scaling beyond benchmarks, compositionality over changes, metrics for validating specifications, rich logics, human-AI specification interaction.

## strength

argued but not measured

## how chosen

RECENT (a March 2026 position paper; the author is also a co-author of autoverus-2024 and fstar-neural-2024); marked argued

## period

language-model

## group

G4     claims: C2, C3     direction: supports C3 as argued; background for C2

## Second reading (notes-H2.md, entry `lahiri-2026-intent-formalization`)

### says

AI-generated code is plausible but not correct by construction, the gap between what the user means and what the program does is the bottleneck, and the central difficulty is validating specifications because the user is the only oracle.

### measured

nothing new; it is a position paper that surveys earlier results (page summary, single read): nl2postcond caught about one in eight real Defects4J bugs; TiCoder's user study raised correct evaluation of generated code from about 40% to 84% (15 developers); work on class invariants (ClassInvGen) and Verus data-structure proofs (VeriStruct) is cited; a four-level range of specification kinds is proposed (tests; code contracts; logical contracts in Dafny, F* or Verus; domain-specific languages) with the advice to start with lightweight checks at the likely points of ambiguity; validation signals named are tests, mutation of outputs, symbolic testing, user feedback and cross-checking code, docstring and annotations; property-based testing is named once as a possible technique and not developed.

### quotes

"there is no oracle for specification correctness other than the user" (checked: the abstract on the abs page and Section 3.2 on the html page give the same words); "The central bottleneck is validating specifications" (checked, abs page and html page abstract)

### does not cover

no new experiment; the author is also the author of several of the surveyed systems; no number here is the paper's own.

### strength

argued but not measured

