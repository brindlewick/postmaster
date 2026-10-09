# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

The inventor of QuickCheck recounts three industrial stories (a toy C queue, 20,000 lines of QuickCheck models for Volvo's AUTOSAR code, and five bugs in Erlang's `dets` database found with generated parallel tests, two of them in about ten minutes each, after the database's maintainer had spent six weeks at a customer hunting one), and concludes that the need for a specification is the real weakness of property-based testing.

## measured

No experiment: the abstract says "This is not a typical scientific paper. It does not present a new method, with careful experiments to evaluate it" (checked: the Chalmers record and the PDF abstract give the same words). Counts the author gives: Volvo AUTOSAR project: around 3,000 pages of standards read; the specification formalized in 20,000 lines of QuickCheck code; used to test a million lines of C in total from 6 suppliers; "more than 200 problems", of which "well over 100" were ambiguities or inconsistencies in the standard itself; where the code could be compared with a traditional test suite (TTCN3), the QuickCheck code was an order of magnitude smaller and tested more (Sec. 3). Erlang `dets` at the Swedish firm Klarna (Sec. 4): a model of the core API of under 100 lines against an implementation of over 6,000 lines; before any parallel testing, tens of thousands of sequential tests checked the model against the code and turned up a few surprises (read as misunderstandings in the model); then five bugs were found with parallel tests: the first "almost immediately", a second in another run, a third after the failing operation was switched off; the maintainer at Ericsson sent a fix the next day but thought the Klarna symptom, file corruption, was a different bug, and gave a one-line corruption check; with that check added, a fourth bug took around ten minutes of testing to find and a fifth, found when rerunning the tests for a talk, again around ten minutes; the last two produced the 'bad object' error from the customer's mailing-list message; a general argument (Sec. 4) that parallel tests cannot be judged by example, because even a tiny two-customer ticket-dispenser test has three correct outcomes and a slightly larger one has thirty, so a property (some interleaving matches the model) is the only practical oracle, which he calls a "killer app" for property-based testing (an argument on a toy example, not a measurement); the dets maintainer at Ericsson had spent six weeks at Klarna hunting for the bug before this; the bugs could be provoked with at most one record and 5 to 6 API calls, and each fix took under a day; at Klarna, where the problem had begun to appear once a week, there has been only one 'bad object' error since the new code went into production, from reading a file last written before the new code was installed (the author's observation, not a controlled result). Conclusion (Sec. 5): a bug in Riak's eventual consistency, present too in the original Amazon Dynamo paper, and surprising results from testing Dropbox's sync service (cited, not described). Cost items the author names: the toy queue's specification was larger than its code (Sec. 3); in the queue example (Sec. 2) the first failing test was a fault in the model (a missing precondition on `put`, since the C code is not meant to be abused), the next was a real design fault in the C code (a full queue looked like an empty one, fixed by allocating one more slot), the next a negative remainder, and the first fix of that (taking an absolute value) was itself wrong and was caught by further random tests; its lesson 2 reads "Errors are often in the model, rather than the code. Calling something a specification does not make it right!"; shrinking tended to isolate the same bug on each run, so they developed ways to steer away from known bugs (Sec. 5).

## quotes

"formulating specifications is hard—and many developers struggle with it. It may often be easier to give examples of correct behaviour, than to define in general what correctness means." (single read of the page text; Sec. 5) | "we find bugs by comparing two independent descriptions of the desired behaviour—the implementation, and the specification—and it is the inconsistencies between the two that reveal errors." (single read; Sec. 5, his answer to the idea of synthesizing code from a specification, which he says would "just replace buggy code with buggy specifications") | "The need for a specification is the real weakness of property-based testing" (single read; Sec. 5, followed by "not that we use testing, rather than static analysis or proof, to relate specifications and implementations"; he continues that the real question is how to make specifications more useable and easier to construct, and that future tools might help developers construct specifications from examples)

## does not cover

The author co-founded Quviq, the company that sells the tool he evaluates (abstract), and says the paper's purpose is as much to entertain as to inform. The paper's opening argument for generated tests is by counting, not data: n features need 3 or 4 hand-written tests each (linear), pairs of features a quadratic number, triples a cubic number, "DON'T WRITE TESTS! ... don't write tests, generate them!" (Sec. 1). All results are single projects reported by the people who did them, with no comparison group, no count of what example-based tests would have found, and no count of the bugs that the generated tests missed. Most of the Volvo errors are, in the author's words, confidential. The AUTOSAR "problems" include ambiguities in the standard, which are specification findings and not necessarily code defects. The stories concern stateful, concurrent and C code, so they are the opposite of pure functions: the paper is evidence that a model plus generated sequences found bugs in effectful code, not that purity helped.

## strength

one report or one team's experience

## how chosen

SERIOUS (the author's own account of the largest industrial QuickCheck projects; named in the brief; 53 citations by Semantic Scholar's count, 30 by Crossref's, on the day)

## period

older (before 2022)

## group

G1     claims: C4, C3 (the specification is the hard part), C2 (a specification can be wrong)     direction: mixed

## Provenance

The reading helper's url line for this entry says it was VERIFIED against the page images of the source, naming the pages; the helper's notes for this group say an entry is verified only if its url line says so.

