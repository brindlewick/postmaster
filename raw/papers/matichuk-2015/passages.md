# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

In six Isabelle proof developments the length of a proof grows roughly with the square of the size of the property it proves, and statements that say more than they need inflate that size, so a statement's size is a leading, though not yet predictive, indicator of proof effort.

## measured

six proof developments: four sub-projects of the seL4 proofs and the two largest verification developments in the Archive of Formal Proofs (JinjaThreads and SATSolverVerification); "15,018 lemma statements" and "more than 215,000 lines of proof" (introduction). Statement size is the number of unique constants needed to state a lemma, counted recursively (raw), and an "idealised" size with redundant constants removed. Result: quadratic regressions of proof size on statement size with R-squared from 0.154 to 0.845 for the raw measure, and 0.73 to 0.937 for the idealised one; linear and exponential fits "clearly not fitting the data", cubic only marginally better. One seL4 sub-project had many outliers with proofs much smaller than expected; investigation "revealed that these outliers were caused by over-specified lemma statements ... with large constants mentioned unnecessarily". The authors tie the result to a hypothesis by the seL4 project leader that "for microkernel refinement proofs, proof size scales roughly quadratically with code size". Prior work they rest on (Staples and others, ESEM 2014, not read; reported by qed-2020 section 7.3): effort in person-weeks is strongly linear in proof size in lines.

## quotes

- "We find a consistent quadratic relationship between the size of the formal statement of a property, and the final size of its formal proof in the interactive theorem prover Isabelle." (abstract) (checked, the abstract page and the PDF text layer agree)
  - "it is important to note that it is not yet necessarily predictive. It is not clear how to take a model from one proof and use it to predict proof sizes in another." (section VI.C) (single read, text layer)

## does not cover

not a prediction model: the authors say so (section VI.C), and the raw measure correlates poorly for one AFP development. All data are Isabelle proofs, mostly seL4, produced by researchers; the proof-size-to-effort link is from earlier seL4 data. The study measures size of finished proofs, with the iteration that went into them hidden; the authors list this as a threat. My reading, not the authors': a quadratic fit means that doubling the size of what is claimed may more than double the proof, which is a warning about large specifications; the paper says nothing about test-based checking.

## strength

one report or one team's experience (an empirical analysis on one team's proofs plus two open-source developments)

## how chosen

SERIOUS (the one empirical model of proof size from specification size, on the largest available proof corpus; named in the brief)

## period

older (2015)

## group

G2 (Isabelle/HOL)     claims: C2 (cost), C3 (over-specified statements)     direction: mixed

