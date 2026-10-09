# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

"Isabelle is a generic proof assistant." (project page)

## measured

Statistics as the fetch tool read them from the AFP page: Entries 1035; Authors 611; Lemmas ~326,400; Lines of Code ~5,442,200 (a single read of the page; the page gives no timestamp). The project page lists no named verification project. Named verified system: seL4 (sel4-2014: about 10,000 lines of C against 480,000 lines of Isabelle proof and specification, about 20 person-years of proof, 144 defects found in the C by the proof). From the survey qed-2020 (section 7.4, p. 215): for the AFP in aggregate theorem statements, definitions and proofs make 19%, 8% and 58% of the lines, and Sledgehammer could prove about 60% of all theorems (Blanchette and others, 2015: a result about 2015, not today).
- second source, for the user-side caveat: Beckert, Grebing, Boehl, 2014, "How to Put Usability into Focus: Using Focus Groups to Evaluate the Usability of Interactive Theorem Provers" (UITP 2014, EPTCS 167; arXiv 1410.8215; read 2026-10-05 from the PDF's text layer; the abstract page agreed). Two focus groups, one on Isabelle/HOL with five participants and one on the KeY verifier with seven, "mostly Master or PhD students" recruited through personal contacts; results are mainly about the method. Concrete findings, section 4.2: "A typical weakness is, for example, an inadequate understanding of what the effect of automatic proof search strategies is. Users may lose the comprehension of the proof by applying automatic strategies", and technical annoyances such as "unstable proof loading mechanisms or a user interface that is not sufficiently reactive". The authors write that "the evidence for a better usability is lacking in many cases". The full analysis they promise I did not find.

## quotes

- "Isabelle is a generic proof assistant." (project page) (single read)
  - "A typical weakness is, for example, an inadequate understanding of what the effect of automatic proof search strategies is." (Beckert and others, section 4.2) (single read, text layer)

## does not cover

the AFP counts are a library of mostly research and mathematics entries; the page does not say how many describe verified software. Not a count of users. The only Isabelle usability study I found is the 2014 focus group above: five participants for Isabelle, in a paper that is mostly about method, so a hint, not a finding. The real cost caveat is the seL4 effort and change-cost data (sel4-2014) and the observation in qed-2020 that large successful proof projects are carried out "by small teams of highly specialized and trained researchers".

## strength

one report or one team's experience

## how chosen

USE (the Archive of Formal Proofs: 1,035 entries, 611 authors, about 326,400 lemmas, about 5,442,200 lines of code, no date on the page; and seL4 is proved in Isabelle/HOL)

## period

older (the tool dates from the 1990s; the founding book, Nipkow, Paulson and Wenzel 2002, I did not read)

## group

G2, background     claims: C2 (use in practice)     direction: background

