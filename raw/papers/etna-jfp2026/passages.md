# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A platform measures how fast different input generators find hand-injected bugs for the same properties in Haskell, Rocq, OCaml, Racket and Rust, and finds that hand-written generators beat type-derived ones where the precondition is sparse, and that larger inputs are not always better.

## measured

Six workloads (Sec. 3.2): binary search trees (the bugs and properties of Hughes 2019 ported), red-black trees, a simply typed lambda calculus, System F with subtyping, a parser and pretty-printer for a Lua-like language, and information-flow control. Bugs are written in by hand as mutants; a "task" is a mutant and property pair where the mutant makes the property fail (Sec. 2.3). Each strategy runs on each task for 10 trials (unless said otherwise) with a 60-second timeout, and a task counts as solved if the strategy finds the injected bug in all trials within the time (Sec. 2.5). Haskell (Sec. 4.1; BST, RBT, STLC and System F, four strategies: bespoke QuickCheck generator, and naive QuickCheck, SmallCheck and LeanCheck): the bespoke strategy solved all tasks and naive QuickCheck failed 43; among tasks both solved, the bespoke strategy's average time was significantly lower (Mann-Whitney U, alpha 0.05) in 83 of 124 tasks and its average number of valid inputs lower in 89 of 124; LeanCheck had an 82% solve rate and SmallCheck 35%; in the first thousand binary trees only 1% of SmallCheck's were valid against 13% of LeanCheck's; LeanCheck produced over a hundred times more tests per second. The paper says that for BST, type-driven generation can find all of Hughes's bugs, but "generate-and-filter" breaks down with sparse preconditions such as red-black trees (Sec. 2.1). Size (4.2): for a BST, larger inputs sometimes need many more inputs to find a bug (one task rose from near zero to about 1,700 inputs as trees grew from 3 to 30 nodes). Enumeration order (4.3): putting the tree argument last made SmallCheck solve 17 more tasks. Rocq (Sec. 5.1; type-based generator, type-based fuzzer, specification-derived generator, bespoke): on the red-black workload the type-based generator fails 23 tasks and the type-based fuzzer 25, the bespoke generator solves all in under ten seconds and the specification-derived one all but 10; on the information-flow workload only the bespoke generator is precondition-driven, type-based generation is basically unable to produce valid inputs, and about 30 tasks are solved at least once by the fuzzers over 10 runs but fewer than 10 are fully solved. Sec. 5.2: the platform exposed a bug in the FuzzChick fuzzer's seed handling and a stack overflow from Rocq's code extraction. OCaml (Sec. 6): hand-written Base_quickcheck generators outperform the other frameworks in almost all situations; the paper adds that when one takes the effort to handcraft generators that satisfy a precondition by construction, coverage-guided fuzzing "only adds overhead for minimal gain". Cross-language (Sec. 7): bespoke generators in five languages all find the 52 BST tasks quickly, the slowest in 130 ms (Haskell QuickCheck), and the 20 STLC tasks in between 300 ms and just over 2 s.

## quotes

"In the existing literature, there are plenty of performance evaluations for individual PBT tools, but a dearth of comparisons across the various available design dimensions." (single read of the page text; Sec. 1) | "PBT users should not naively expect that larger inputs are better, especially for properties with multiple inputs." (single read; end of Sec. 4.2)

## does not cover

It does not compare property-based tests with example-based tests at all. The bugs are mutants written by hand into small, well-known workloads, and the properties came from the literature (written by experts); the best strategy in every language needed a hand-written generator, which is the effort the Jane Street interviewees complained about (see goldstein-icse2024). The paper's own conclusion is modest: it uncovered "unexpected nuances", not a ranking of tools. It says nothing about TypeScript or about how many real bugs a team's PBT finds.

## strength

controlled study (of generator strategies on injected bugs)

## how chosen

SERIOUS (the most rigorous controlled comparison of PBT techniques I found; its authors cite the original QuickCheck paper as the most cited ICFP paper of all time, by a factor of two, according to the ACM Digital Library, a statement I did not check)

## period

2022 or later, no language model

## group

G1     claims: C4 (and its cost side)     direction: background (it compares generators with each other, not PBT with example tests)

## Provenance

The reading helper's url line for this entry says it was VERIFIED against the page images of the source, naming the pages; the helper's notes for this group say an entry is verified only if its url line says so.

