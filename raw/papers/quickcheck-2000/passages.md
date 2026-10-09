# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

The paper introduces QuickCheck, where a Haskell programmer writes properties as functions and the tool tests them on random inputs, and it argues that pure functions are much easier to test than side-effecting ones ("in Haskell, only computations in the IO monad are hard to test"), so random testing can be done at a fine grain.

## measured

Not a study. The introduction says that, despite anecdotal evidence that functional programs need somewhat less testing, testing is still a major part of functional program development (paraphrase of Sec. 1). Five case studies, three by the authors and two by users, with no count of defects across systems. (5.1) A unification algorithm: no error was found in the unifier itself, but errors were found in the specification, and writing the specification took quite a lot of work, perhaps more than writing the implementation; over 95% of generated cases that met a precondition were trivial until a custom generator cut that to 20 to 25% (5.1.4). (5.2) Lava hardware circuits: errors of two kinds, logical errors in the circuits, which formal verification would also have found, and errors in combinations of input sizes that had not been formally verified (5.2.5). (5.3) Two propositional-logic provers written for teaching: 3 bugs found, all from unjustified assumptions about the input (5.3). (5.4) A pretty-printing library: three problems found, in the words of its author Andy Gill, a user (5.4). (5.5) The Edison data-structure library: its author, Chris Okasaki, says QuickCheck lets him test with probably 25% (maybe less) of the effort of his previous test suite (5.5; a user's estimate). Section 6.1 cites Duran and Ntafos (1984) and Hamlet and Taylor (1990) on random against partition testing: differences were small. Section 6.6 says the errors found are divided roughly evenly between test-data generators, specifications and programs (no counts given).

## quotes

"It is generally accepted that pure functions are much easier to test than side-effecting ones, because one need not be concerned with a state before and after execution." (single read of the page text; Section 1, no study cited for it) | "In fact, no errors at all were found in the unifier itself." (single read; 5.1.3, followed by the authors' remark that this reflects their practice at writing unifiers more than the tool's effectiveness) | "the errors we find are divided roughly evenly between errors in test data generators, errors in the specification, and errors in the program" (single read; 6.6)

## does not cover

The pure-versus-effects claim is stated as common belief, with no citation and no measurement. Bug-finding evidence is the authors' own case studies and two users' comments, with no comparison against example-based tests. The one case examined at length found no error in the code, only in the specification. The authors name the main limitation themselves: no measure of test coverage, so many inadequate tests can give a false sense of security (Sec. 6.6).

## strength

argued but not measured (pure code easier to test); one report or one team's experience (the case studies)

## how chosen

SERIOUS (the original paper; 1,379 citations by Semantic Scholar's count on the day read)

## period

older (before 2022)

## group

G1     claims: C1, C4     direction: mixed

## Provenance

The reading helper's url line for this entry says it was VERIFIED against the page images of the source, naming the pages; the helper's notes for this group say an entry is verified only if its url line says so.

