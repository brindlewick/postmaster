# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Agda is "a dependently typed programming language / interactive theorem prover"; one company wrote the specification of a production blockchain ledger in it, about one twentieth the size of the Haskell implementation, and uses it by generating a reference implementation and testing production code against it, rather than proving the production code.

## measured

the authors' own report, no controlled comparison. Repository README, two reads: "Agda is a dependently typed programming language / interactive theorem prover." and, for the ledger repository, "This is the formal ledger specifications for the Cardano blockchain. It is written in Agda and is executable; Haskell code can be extracted and run for conformance testing." Paper, page 2:2: the formalization overhead "has proven minuscule" next to the implementation, "~10 thousand lines of Agda formalization versus ~200 thousand of Haskell implementation", and "only a couple of full-time formal methods engineers versus tens of production developers". Method (section 7): all transitions are formulated as relations and each is proved "computational" (a function that is sound and complete for it); the Agda is compiled to Haskell and used "to ensure the developers have faithfully implemented the specification" by running both on randomly generated environments, states and signals and comparing results. What was proved: "key meta-theoretical properties", for example that "the global value carried by the system stays constant" (Property 4.1). Related work, page 2:12: one has to be "economical about which properties to prove", mechanizing just the core ones, because otherwise "the whole effort can quickly become practically infeasible to maintain"; the authors choose to extract a reference implementation in Haskell and test production against it, not to extract production code (see the second quote below); and about Agda itself, "Agda being notorious for its beautiful renderings but lack of proper support for practical 'big' proofs that arise in large scale software verification projects, where tactic-based proof assistants like Coq and Isabelle are more common".

## quotes

- "the formalization overhead has proven minuscule compared to the development effort of the actual implementation" (page 2:2) (checked, page image and text layer agree)
  - "we find the sweet spot lies in the middle: extracting a reference implementation in Haskell and using conformance testing to ensure the system in production behaves as it should" (page 2:12) (checked, page image and text layer agree)
  - "Agda is a dependently typed programming language / interactive theorem prover." (repository README) (checked, two separate fetches)

## does not cover

a company's account of its own project, with no defect counts and no measure of how many bugs the conformance tests caught. "Overhead" is lines of Agda (about 10K) against Haskell (about 200K) and head-count, not effort per property proved; the Agda covers a ledger written as small-step state transitions, the pure core of the system, and the production code is checked only by testing against it, not proved. The authors say that production code "might use different data structures, mainly for reasons of performance, which are not isomorphic to those used in the specification and might require non-trivial translation functions" for the tests. For the cost and use of this approach, see also `cardano-2024`.

## strength

one report or one team's experience


---

## how chosen

USE (named industrial use: Input Output's Cardano ledger specification is written in Agda and is "executable"; the only Agda-based specification of a production system found)

## period

older (not language-model work; 2024)

## group

G2, background (Agda)     claims: C2 (use in practice), C3 (cost and trust)     direction: mixed

