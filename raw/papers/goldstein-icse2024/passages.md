# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Interviews with 30 experienced PBT users at one financial firm found they use PBT mostly where a property is obvious and a third said it found bugs other methods missed, while writing properties, writing generators and judging whether the tests are effective are its weak points.

## measured

30 semi-structured one-hour interviews (31 people; one joint interview) at Jane Street, a firm that uses PBT heavily, mostly in OCaml; 26 of 30 were testers and 4 of 30 maintainers; among those who answered an optional questionnaire the median was 7 years of software engineering and 6 of PBT (Table 1); recruited by a volunteer at the firm, an internal blog post and snowball sampling; transcripts coded (an open pass, then an axial pass). Counts from Section 4 (what participants said): 10/30 said their property-based tests found bugs that they had not found via other methods (4.1); 9/30 said PBT raised their confidence; 12/30 used properties as documentation; 18/30 valued them in code review; 16/30 said writing specifications slowed their progress, one calling the commonest failure mode not knowing what properties to test (4.3); 17/30 needed generators for values that satisfy a precondition, 7/30 called writing generators high-effort and 6/30 tedious (4.4); 19/30 used handwritten generators, 19/30 derived ones (4.4); 17/30 used differential or model-based properties (the most widely implemented kind), 11/30 round-trip, 11/30 classical, 7/30 catastrophic-failure properties (4.3); 11/30 said they did not think as hard as they should about testing effectiveness, 3 of those 11 seeing a property catch a couple of bugs and deciding not to improve it further, and 7/30 deliberately added bugs to their code to check that the tests found them (4.6). Time budgets ran from 50 ms to 30 s (4.2). Comparison with example tests (4.2): the firm's most common approach to testing is not PBT but "expect tests", an example-based kind in which the output of a previous run is captured and the developer decides whether it is the intended output; participants saw PBT as sometimes more legible and sometimes less than expect tests, one saying writing a single expect test is much easier than writing invariants but that over a whole suite they "love not writing specific unit tests cases" (P13); the authors conclude there was no universal preference, that expect tests are attractive when a simple example says it all, and that PBT may be better when code is hard to get right or writing enough examples is tedious; the one clear advantage they report for properties is the confidence they give (about a third of participants). Observation OB4 (5.1): PBT is used opportunistically in high-leverage scenarios where properties are readily available, and developers rarely go out of their way to write subtle specifications; the authors say the usual assumption, that developers decide to use PBT and then think of a specification, is the reverse of what participants did: they saw an obvious testable property and then decided to use PBT. In 4.6, participants who judged effectiveness did so by mutation testing (7/30), looking at example inputs (8/30), code coverage (2/30) or property coverage (1/30). On stateful and effectful code (4.3, this is the passage that bears on C1): participants said that some systems seemed to have no properties at all (P1: a server that serves queries "and has some... nuanced behavior" not compatible with logical properties), that hidden mutable state makes it harder to think about what the right laws are (P7), and that integrating the outside world and the interaction of very large and complicated systems make it less clear how to test meaningfully with PBT (P22). The authors add that these findings are not surprising: it is well known that code that interacts with its environment is a challenge for testing in general, not just PBT, since stateful code can differ between runs if state is not reset, and effectful code may use files, databases or networks that are not safe to hit repeatedly. Shrinking (4.5): one participant called it necessary (P15), and two who built their own PBT frameworks said it was one of the most important features they built (P8, P21); participants found QuickCheck's hand-written shrinkers hard to write ("I hate writing shrinkers", P4), and one said it is easy to write a shrinker that does not preserve some invariant, which makes the test fail (P13). In Related Work (Sec. 6) the authors summarise a Dropbox experience report (Hughes, Pierce, Arts and Norell 2016, which I did not read) as finding usability problems with timing-dependent code: sequences of timed operations resist shrinking and timing dependence caused flaky tests. Context in Sec. 1: Hypothesis had an estimated 500K users in 2021 (a JetBrains survey), which is 4% of Python users, against 50% for pytest, and its maintainers estimate the addressable market at at least 25%.

## quotes

"PBT's main strengths lie in testing complex code and in increasing confidence beyond what is available through conventional testing methodologies" (checked: the Semantic Scholar abstract and the PDF gave identical words) | "I think the most common failure mode is actually not knowing what properties to test." (single read of the page text; Sec. 4.3, participant P4) | "Developers may not interrogate properties that do not find bugs, even in cases where they acknowledge they should." (single read of the page text; the same words appear in the Figure 1 box and in the OB6 heading of Sec. 5.1)

## does not cover

One company, one main language (OCaml), experienced volunteers. The authors name that their interviewers are PBT researchers with a stake in the result (Sec. 3.3), that saturation was not measured, and that experienced developers who like PBT are over-represented, so novices' experience is under-reported. Counts are what participants said, not measured defects: that PBT found bugs not found by other methods is a participant's claim. No comparison against example-based tests on the same code. Nothing about TypeScript.

## strength

one report or one team's experience (a qualitative interview study; 30 interviews)

## how chosen

SERIOUS (the most rigorous study of how PBT is used in practice; named in the brief; 50 citations by Semantic Scholar's count on the day)

## period

2022 or later, no language model

## group

G1     claims: C4, C1     direction: mixed

## Provenance

The reading helper's url line for this entry says it was VERIFIED against the page images of the source, naming the pages; the helper's notes for this group say an entry is verified only if its url line says so.

