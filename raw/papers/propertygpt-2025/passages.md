# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A retrieval-augmented GPT-4 wrote Solidity invariants and pre/postconditions that matched human auditors' properties with 80% recall and 64% precision and, checked by a prover, found known and unknown vulnerabilities.

## measured

TASK: from smart-contract code, write properties in a Solidity-like property language (state invariants, function pre/postconditions, cross-function rules), reusing properties from audit reports retrieved by similarity, revised on compiler feedback; a symbolic-execution prover then checks them (bounded depth 3). JUDGED BY: (a) two auditors with 5 years' experience each, independently, judged whether a generated property is equivalent to a human-written Certora property, a third settled ties (there is no automatic checker for this); (b) the prover's results; (c) bugs confirmed. The paper reports no check for vacuous or too-weak properties. DATA: 623 human-written Certora properties from 23 projects (533 as retrieval knowledge base, 90 from 9 projects as the test set); 13 CVEs picked at random from 577; 24 attack incidents; 4 bounty projects. MODEL: GPT-4-turbo (gpt-4-0125-preview); baselines SmartInv, GPTScan, Slither, Manticore, Mythril. NUMBERS: property recall 0.80 and precision 0.64 (F1 0.71) against the human properties, as the average over nine projects of Table III (read twice; per project the recall runs from 0.10 for OpenZeppelin, where 1 of 10 properties was reproduced from 2 generated, to 1.00 for four projects, and precision from 0.47 to 1.00, with eight of nine projects between 0.47 and 0.74; an average of 10 human properties per project, 42 generated, 26 matched, 16 unmatched); 9 of 13 CVEs and 17 of 24 attack incidents detected (26 of 37 in all; Tables IV and V); 22 findings in 4 bounty projects, 12 confirmed and fixed, $8,256 in bounties; 87% of properties compiled after revision.

## quotes

none kept (summary text only; the abstract figures are "80% recall compared to the ground truth", "26 CVEs among 37 tested contracts", "12 zero-day vulnerabilities", single read)

## does not cover

the human reference is a different property language (CVL), so equivalence is a manual judgement by two people; 36% of generated properties did not match a human one (the paper does not say how many of these were wrong rather than merely different); known classes (access control, randomness, delegatecall) were missed; domain is smart contracts only.

## strength

controlled study (one team; reference judged manually)

## how chosen

SERIOUS (the main example of a model writing formal properties that a prover then checks, judged against human auditors' properties and real bugs)

## period

language-model

## group

G4     claims: C3, C4     direction: mixed

