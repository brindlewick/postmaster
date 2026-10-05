# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Amazon engineers learned TLA+ in two to three weeks and wrote design-level specifications of 102 to 939 lines that, in the authors' account, "added significant value" in all 10 systems (bugs found in four of the five components in their table; the fifth, a lock-free structure, got "improved confidence" and missed a liveness bug the spec did not state), while the authors state that nothing checks that the code implements the verified design.

## measured

no controlled study; the authors' account of 10 real systems (S3, DynamoDB, EBS, an internal lock manager). Table, PDF p. 3, spec size excluding comments: S3 low-level network algorithm 804 lines PlusCal, "Found 2 bugs"; S3 background redistribution 645 PlusCal, 1 bug; DynamoDB replication and membership 939 TLA+, 3 bugs, "some requiring traces of 35 steps"; EBS volume management 102 PlusCal, 3 bugs; lock-free data structure 223 PlusCal, "Improved confidence. Failed to find a liveness bug as we did not check liveness."; replication and reconfiguration algorithm 318 TLA+, 1 bug and a verified optimisation. Effort figures are anecdotes: one engineer "wrote a detailed specification of these components in a couple of weeks" (p. 7); another "spent two weeks learning TLA+ and writing the spec" and the model checker "found the bug in a few seconds" in an algorithm whose bug "had passed unnoticed through multiple design reviews and code reviews, and had only surfaced after months of testing" (p. 9); a second spec of that engineer found no bug but "did uncover several important ambiguities in the documentation" (p. 9). The DynamoDB author "believes that the investment he made in writing and checking the formal TLA+ specifications was both more reliable, and also less time consuming than the work he put into writing and checking his informal proofs" (p. 7-8). Limits stated by the authors: "What Formal Specification Is Not Good For" (p. 5) names sustained performance degradation from feedback loops: "We don't yet know of a feasible way to model a real system that would enable tools to predict such emergent behavior."; and p. 10: they know of no tool that verifies that executable code implements the high-level specification "for distributed systems as large and complex as those we are building".

## quotes

- "Engineers from entry level to Principal have been able to learn TLA+ from scratch and get useful results in 2 to 3 weeks" (PDF p. 3) (checked, page image read twice and the text layer agrees)
  - "How do we know that the executable code correctly implements the verified design?" The answer is that we don't." (PDF p. 9; the question is quoted in the report as what engineers ask) (checked, page image read twice and the text layer agrees)

## does not cover

models of designs checked by exhaustive search, not proofs of code, so it bears on how hard a specification is to write rather than on how hard a proof is. Self-reported by the engineers who adopted the method, no comparison group, and no count of specifications that found nothing. Written before 2015; says nothing about language models. The seven-teams adoption is internal and not independently checked. One example in its own table shows a spec that missed a bug class because it did not state the property (liveness).

## strength

one report or one team's experience

## how chosen

USE (named industrial use at one company: 10 systems, 7 teams, as the report counts) and requested in the brief

## period

older (2014)

## group

G3 (TLA+, another helper's area); used here only for what it says about specification effort and limits     claims: C3 (also C2)     direction: mixed

