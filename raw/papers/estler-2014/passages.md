# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

In 21 projects that use contracts (Eiffel, C# and Java), more than a third of routines and classes carry contracts in most projects, the share is stable over time, and contracts change much less often than the code that implements them.

## measured

21 open-source contract-equipped projects: 8 Eiffel, 7 C# (Code Contracts) and 6 Java (JML) (Table 2); selection (Sec. 4.1) was every such project the authors could find with at least 30 revisions and contracts on at least 5% of elements (of 44 JML projects screened, 6 qualified). The abstract's "more than 260 million lines of code over 7700 revisions" is a sum over revisions: Table 2 gives 7,756 revisions in all and 830,747 lines at the latest revisions, with 228 committers. Findings (Sec. 5): contracts on more than 33% of routines and classes for most projects (in two thirds of projects at least a third of routines have some pre- or postcondition); stable over time except around major redesigns; no strong preference among preconditions, postconditions and invariants, though preconditions have more clauses in over 80% of projects; contracts change much less often than implementations (Wilcoxon, p = 9.5e-7, Cohen's d above 0.99); inheritance does not change the qualitative picture. Sec. 5.3: "The overwhelming majority of contracts involves Void/null checks. In contrast, quantifiers appear very rarely in contracts": 36% to 93% of Eiffel preconditions, 80% to 96% of C# preconditions and 88% to 100% of Java preconditions contain a void or null check, and quantifiers are practically never used in pre- or postconditions. Sec. 6: a control group of 10 projects by students of a software engineering course (Eiffel, about 6 weeks, average 4,185 lines, all graded good or very good) showed several of the same trends at a smaller scale. Who wrote the contracts: the projects' own developers, some of them professionals (the Eiffel libraries, and Microsoft Research tools such as Boogie and Dafny) and one (EiffelProgramAnalysis) mainly students.

## quotes

"the percentage of program elements that include contracts is above 33% for most projects and tends to be stable over time" (checked: the PDF abstract and the ar5iv rendering gave the same words) | "We do not compare different methodologies to design and write contracts; we just observe the results of programming practices." (single read; Sec. 1)

## does not cover

It does not look at defects at all: it counts contracts and how they change, so it cannot say that contract use reduces bugs. The authors deliberately picked projects from the minority that use contracts and note several of the projects' developers are supporters of formal specification; they say the choice limits generalisability. In Related Work (Sec. 7) they say information on how programmers use formal specification is largely anecdotal apart from a few surveys, and they cite, from others, some evidence of usefulness: one study in which a higher density of assertions goes with a lower density of faults (their reference 28; I read that study separately, see kudrjavets-2006), and one report that assertions may cut the effort of extending programs and raise reliability (not read). Their concluding discussion (Sec. 8) says the overwhelming majority of contracts written in practice are short and simple, so that tools should make the best use of simple contracts.

## strength

one report or one team's experience (a large descriptive study; no outcome measure)

## how chosen

SERIOUS (the largest empirical study of contract use that I found; named in the brief)

## period

older (before 2022)

## group

G1 (design by contract)     claims: background for C3 (what contract use looks like; no defect outcome)     direction: background

## Provenance

The reading helper's url line for this entry says it was VERIFIED against the page images of the source, naming the pages; the helper's notes for this group say an entry is verified only if its url line says so.

