# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Among 198 randomly sampled user-reported failures of five distributed data systems, 92% of the catastrophic ones came from incorrect handling of non-fatal errors that the software had explicitly signalled, and most of those faults were easy to find with simple tests of the error-handling code.

## measured

198 failures sampled at random (40, 41, 41, 38 and 38 per system) from the failures reported in the issue trackers of Cassandra, HBase, HDFS, MapReduce and Redis (Table 1 gives 17,216 as the total number of reported failures; the text does not say whether that is before or after the filter); the pool was filtered to priority Blocker, Critical or Major, dated 2010 or later, with the reporter and the assignee different, and duplicates removed, so the 198 are a sample of severe, developer-confirmed failures; 48 of the 198 were catastrophic (all or most users affected; Table 1 lists them as 2, 21, 9, 8 and 8 per system); of those 48, 92% came from incorrect handling of non-fatal errors explicitly signalled in software; in 58% the faults "could easily have been detected through simple testing of error handling code"; 35% fit three trivial patterns (an empty or log-only handler, an over-broad abort, a FIXME or TODO), another 23% had logic so wrong that statement-coverage testing or code review would have caught it. Across all 198: 74% were deterministic, 77% could be reproduced by a unit test, and almost all needed 3 nodes or fewer. Their static checker Aspirator, built from three patterns, found 121 new bugs and 379 bad practices in 9 systems, of which 143 were fixed or confirmed.

## quotes

"almost all (92%) of the catastrophic system failures are the result of incorrect handling of non-fatal errors explicitly signaled in software" (single read; Sec. 1) | "the majority of catastrophic failures could easily have been prevented by performing simple testing on error handling code" (checked: the abstract on the USENIX page and the PDF abstract gave the same words)

## does not cover

Five large Java and C systems for storage and computation, not small tools and not TypeScript. It is not about purity: nothing in the pages I read says whether the faulty handlers were pure or not, and "simple testing suffices" says that testing the shell is cheap, not that it must be pure. It shows where the severe failures sat in these systems: in the code that reacts to errors from the environment, which in a functional-core design is the shell. "Catastrophic" is the authors' definition (all or most users affected). Their own limits (Sec. 2): only distributed data-intensive systems, only failures that reached an issue tracker (so no misconfiguration or forum reports), and a 6.9% margin of error at 95% confidence for the 198 samples.

## strength

one report or one team's experience (a random sample of 198 failures from 5 systems)

## how chosen

CONTRADICTS (it places the severe failures in error handling, at the boundary with the outside world); also SERIOUS (a random sample, OSDI)

## period

older (before 2022)

## group

none (older; the contradicting side of C1)     claims: C1 (contradicts), C4 (background: simple tests suffice)     direction: contradicts

## Provenance

The reading helper's url line for this entry says it was VERIFIED against the page images of the source, naming the pages; the helper's notes for this group say an entry is verified only if its url line says so.

