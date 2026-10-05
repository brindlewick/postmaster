# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A full functional-correctness proof of a roughly 10,000-line C microkernel, extended to security properties and the compiled binary, took about 20 person-years of proof effort against 2.2 for building the kernel, found 144 defects in the C code, and rests on stated assumptions (assembly, boot code, caches, hardware) that it does not prove.

## measured

one system, seL4 (ARMv6 and ARMv7 verified; the x86 port "is currently unverified", p. 2:4), Isabelle/HOL, one team. The specification was written by the team (a Haskell prototype made into an executable specification, plus a hand-written abstract specification). Sizes were counted for every commit from November 2004 to December 2012 (p. 2:52). Some effort figures come from "rigorous effort counting", analysing "every contributor's effort per week", starred in Fig. 19; the rest are "rough, conservative estimates" (p. 2:55). Figures:
  - size, p. 2:4: "the only evolving formally-verified code base of the order of 10 000 lines of code" with "its now 480 000 lines of Isabelle proofs and specifications".
  - effort, Fig. 19 (p. 2:56): kernel development 2.2 py (Haskell prototype 2 py, C 0.2 py); functional-correctness proof 20.5 py (generic frameworks and tools 9 py; abstract spec 0.3 py (4 pm); executable spec 0.2 py (3 pm); first refinement 8 py; second refinement 3 py); fastpath optimisation proof 0.4 py (5 pm); security proofs 4.1 py; binary verification 2 py; capDL 2 py. Text, p. 2:55: "The total effort for the seL4-specific proof was 11 py" (the rest is research and tools); a repeat on a new kernel is estimated at "6 py" of proof, "8 py" in all, "only twice the SLOCCount estimate" of 4 py for a kernel with no assurance. My check: the Fig. 19 rows (2.2 + 20.5 + 0.4 + 4.1 + 2 + 2) add to 31.2 py.
  - cost per line, p. 2:57: "$362 for the whole 22.7 py"; "$127/SLOC" for the estimated 8 py of a repeat; "the industry rule-of-thumb for the lower EAL6 is already $1 k/LOC", with footnote 3: the 2009 paper "contained an embarrassing typo, claiming $10 k/LOC" (see sel4-2009). Security proofs alone, p. 2:58: "$78/SLOC".
  - one proof against its code, p. 2:25: the two main fastpath functions are "only 287 source lines of code in total"; "the total size of the fastpath proof is 5913 lines of proof script"; "roughly 5 person months by one experienced verification engineer" (about 20 lines of proof per line of code, my division).
  - where the effort went, p. 2:57: first refinement 8 py against "less than 3 py" for the second; "80% of the effort in the first refinement went into establishing invariants, only 20% into the actual correspondence proof".
  - defects, p. 2:59 and Fig. 20: "16 defects in the implementation before verification had started in earnest" (found by student projects and the x86 port), and "the formal verification has uncovered another 144 defects and resulted in 54 further changes to the code to aid in the proof"; the first refinement led to "some 300 changes in the abstract specification and 200 in the executable specification", "About 50% of these changes relate to bugs in the associated algorithms or design". "None of the bugs found in the C verification stage were deep in the sense that the corresponding algorithm was flawed." "Simple typos also made up a surprisingly large fraction of discovered bugs in the relatively well-tested executable specification in the first refinement proof".
  - cost of change, p. 2:60: adding interrupts, ARM page tables and address spaces "resulted in 1.5-2 py to re-verify. It modified about 12% of existing Haskell code, added another 37%, and reverification cost about 32% of the time previously invested in verification"; adding reply capabilities, a change of "less than 5% of the total code base", "took about 1 py or 17% of the original proof effort to reverify".
  - security proofs, p. 2:59: the information-flow proof uncovered channels that "do not represent code defects as such"; it "makes seL4 no more secure than it was to begin with (excepting the implementation changes mentioned above)" while giving "a strong piece of evidence".

## quotes

- "We still assume correctness of TLB and cache-flushing operations, as well the correctness of the machine interface functions implemented in handwritten assembly. We also assume hardware correctness." (p. 2:29; "as well the", not "as well as the", is the paper's wording) (checked, page image and text layer agree)
  - "The effort for proving the correctness of seL4 is significantly higher than developing the kernel in the first place, in total about 20 py" (p. 2:55) (checked, page image and text layer agree)
  - "Our total cost per SLOC is $362 for the whole 22.7 py" (p. 2:57) (checked, page image and text layer agree)

## does not cover

one microkernel by the team that designed the proof method, in a research setting; 9 of the 20 py is research on tools and frameworks, not the kernel's own proof (the team's own 11 py figure strips that out). Not a controlled comparison with testing. The boot and initialisation code (about 1.2 kLOC), the assembly, cache and TLB handling and the hardware are assumed (p. 2:29); the x86 port was unverified. The paper itself says the verification of the C stage found no "deep" algorithm flaw, so the 144 defects are mostly typos, missing checks and mis-readings of the specification. The $362 per line is total cost over 22.7 py; the survey huang-2026 gives a different, less precise ratio column.

## strength

one report or one team's experience (but with effort counted per contributor per week for part of it, and the most detailed figures in the field)

## how chosen

SERIOUS (the most complete public account, by the team itself, of what a whole-kernel proof cost and what it found)

## period

older (2014; covers work from 2004 to 2012)

## group

G2 (Isabelle/HOL)     claims: C2, C3     direction: mixed

## Read again by the research session on 2026-10-05

Route: text layer of the saved PDF, read with a text extractor, by the research session on 2026-10-05.

- "While the effort of the whole seL4 microkernel development, including design, documentation, coding, and testing, was 2.2 person-years (py), the total effort of the seL4 correctness proof was about 20 py" (single read (this read only))

