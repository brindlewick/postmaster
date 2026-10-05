# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

The first full functional-correctness proof of a general-purpose OS kernel: 8,700 lines of C and 600 of assembler, about 200,000 lines of Isabelle proof script, about 20 person-years of proof effort (11 of them seL4-specific); the authors state in so many words that the proof shows the code matches the specification, not that the specification is what the user expects.

## measured

one kernel, one team; the specification was written by the team (Haskell prototype to executable specification, plus abstract specification). Table 1 (PDF p. 12): abstract specification 4,900 lines of Isabelle (about 75 invariants); executable specification 5,700 lines of Haskell and 13,000 of Isabelle (about 80 invariants); C implementation 8,700 lines of C and 15,000 of Isabelle; the "Proof LOP" column gives 110,000 and 55,000 (first and second refinement, paired by position in a table whose cells span rows). Text, p. 12: "The overall size of the proof, including framework, libraries, and generated proofs (not shown in the table) is 200,000 lines of Isabelle script." "over 150 invariants" proved. Effort, pp. 12-13: abstract spec 4 pm, Haskell prototype about 2 py, executable spec 3 pm, C about 2 pm, "a total cost of 2.2 py including the Haskell effort"; "The cost of the proof is higher, in total about 20 py", of which about 9 py frameworks and tools, "The total effort for the seL4-specific proof was 11 py"; a repeat on a new kernel 6 py of proof, 8 py in all, "only twice the SLOCCount estimate" (4 py). Cost comparison, p. 13: "industry rules-of-thumb of $10k/LOC for Common Criteria EAL6 certification, which would be $87M for seL4". THE 2014 PAPER (sel4-2014) CORRECTS THIS: its footnote 3 says the 2009 paper "contained an embarrassing typo, claiming $10k/LOC" and the figure is $1k/LOC. Defects, p. 13: 16 found before verification started in earnest, "another 144 defects" by the verification and "54 further changes to the code to aid in the proof"; "None of the bugs found in the C verification stage were deep"; "Simple typos also made up a surprisingly large fraction of discovered bugs in the relatively well tested executable specification".

## quotes

- "A cynic might say that an implementation proof only shows that the implementation has precisely the same bugs that the specification contains. This is true: the proof does not guarantee that the specification describes the behaviour the user expects." (PDF p. 10, Assurance paragraph) (checked, page image read twice and the text layer agrees)
  - "We assume the correctness of the compiler, assembly code, boot code, management of caches, and the hardware; we prove everything else." (PDF p. 1, introduction) (checked, page image and text layer agree)

## does not cover

the cost comparison with EAL6 as printed in 2009 is wrong by a factor of ten (see above); use the 2014 figure. Superseded for effort by sel4-2014. One kernel, a research team, ARMv6 only.

## strength

one report or one team's experience

## how chosen

SERIOUS (the original seL4 result; also the source of a cost comparison the authors later corrected)

## period

older (2009)

## group

G2 (Isabelle/HOL)     claims: C2, C3     direction: mixed

## Read again by the research session on 2026-10-05

Route: PDF pages 1, 12 and 13 read as page images by the research session on 2026-10-05.

- "seL4, a third-generation microkernel of L4 provenance, comprises 8,700 lines of C code and 600 lines of assembler." (single read (this read only))
- "The overall size of the proof, including framework, libraries, and generated proofs (not shown in the table) is 200,000 lines of Isabelle script." (single read (this read only))
- "The cost of the proof is higher, in total about 20 py." (single read (this read only))
- "The total effort for the seL4-specific proof was 11 py." (single read (this read only))
- "Those two activities uncovered 16 defects in the implementation before verification had started in earnest, the formal verification has uncovered another 144 defects and resulted in 54 further changes to the code to aid in the proof." (single read (this read only))
- "which suggests that normal testing may not only miss hard and subtle bugs, but also a larger number of simple, obvious faults than one may expect." (single read (this read only))

