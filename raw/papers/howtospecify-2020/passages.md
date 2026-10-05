# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A tutorial gives five ways to write properties for pure code (validity invariants, postconditions, metamorphic, inductive, model-based), compares them on eight planted bugs in a binary search tree, and says that newcomers find it hard to identify properties to write.

## measured

One data structure (a binary search tree with insert, delete, union and find), eight buggy implementations planted by the author (Fig. 7: three in insert, two in delete, three in union), tested against many properties of the five kinds (Fig. 8). Sec. 5.1: validity properties miss five of the eight bugs; every bug is found by at least one postcondition, one metamorphic property and one model-based property; model-based properties each find every bug in the one operation they test; bug 2 makes invalid trees and so causes false failures in unrelated properties and is left out of the timing study. Sec. 5.2 and Fig. 9 (for seven of the eight bugs, and for each postcondition, metamorphic and model-based property that detects the bug, a counterexample was found 1,000 times with different random seeds, and the mean number of tests needed was recorded, then averaged over bugs and over properties of the same type): the table's Min, Max and Mean of the average mean number of tests to make a property of that type fail are postconditions 7.1, 245 and 77, metamorphic 2.4, 714 and 56, model-based 3.1, 9.8 and 5.8; finding a counterexample 1,000 times took over 700,000 tests of the hardest-to-falsify property; for the same union bug the postcondition `prop_UnionPost` failed after 50 tests on average and the logically equivalent model-based `prop_UnionModel` after 8.4. Sec. 4.6 and 4.2: with the integer key generator first used, a key generated independently of a tree was absent from that tree in 79.2% of a million tests, and two independently generated keys were equal in only about 3.3% of cases, so most test effort of a property like the insert postcondition went to an unrelated case until the key generator was changed to draw from a smaller range (then 44.6% absent). Fig. 8 totals the number of properties that fail for each bug: 12, 17, 8, 12, 9, 10, 10 and 8 for bugs 1 to 8; bug 2 makes the generator produce invalid trees, which makes properties that never call insert fail too. Sec. 4.5: model-based properties make up a complete specification with one property per operation, but they require a model, which in more complex situations may be quite expensive or may resemble the actual implementation more than is healthy (paraphrase). Sec. 4.3: the first attempt at a metamorphic property often needs correcting (the paper's example needed two corrections and an equivalence relation on trees before it passed), and the authors derived sixteen metamorphic properties for the four operations. Sec. 4.1: a bug in the generator or shrinker produced false failures in other properties, so generators and shrinkers need their own properties (the paper's example: a shrinker that broke the tree invariant). Sec. 5.3: if time is limited, model-based properties may offer the best return on investment, together with validity properties; where the model is costly or too like the implementation, metamorphic properties are the alternative, at the cost of writing many more properties (paraphrase). Sec. 2: replicating the implementation in the test (an expected-result function as hard to write as the function) is called expensive and low value.

## quotes

"the costs, benefits, and bug-finding power of each approach" (checked: the Chalmers record page and the PDF abstract gave identical words) | "many developers trying property-based testing for the first time find it difficult to identify properties to write" (single read of the page text; Sec. 1) | "The ideas in this paper are applicable to testing any pure code, but code with side-effects demands a somewhat different approach." (single read of the page text; Sec. 7)

## does not cover

Eight bugs planted by the paper's author (a co-founder of Quviq AB, a company set up in 2006 to commercialize property-based testing, as the paper's footnote 11 says) in one small pure structure, not real defects, found by properties the same expert wrote; no comparison with example-based tests (the only example test in the paper is the toy `reverse` one in Sec. 2). Side-effecting code is not evaluated: the paper says each operation then has an implicit state argument and an invisible state result, which makes properties harder to formulate, and that state-machine modelling libraries adapt the same ideas (Sec. 7). A news article about the paper (InfoQ) gives effectiveness percentages (38, 79, 90 and 100) that I did not find in the pages I read, so I do not use them.

## strength

one report or one team's experience (a worked example on planted bugs); argued (the claim that pure code is the easier case)

## how chosen

SERIOUS (named in the brief; the only source in this file that compares kinds of property on the same bugs; cited 7 times by Semantic Scholar's count and 12 by Crossref's on the day, so not widely cited)

## period

older (before 2022)

## group

G1     claims: C4, C1     direction: mixed

## Provenance

The reading helper's url line for this entry says it was VERIFIED against the page images of the source, naming the pages; the helper's notes for this group say an entry is verified only if its url line says so.

