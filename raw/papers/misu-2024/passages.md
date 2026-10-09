# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

GPT-4 produced a verified Dafny method with a postcondition for far fewer problems than the raw verified count suggests, because almost half the verified outputs carried no postcondition at all.

## measured

- TASK: the model writes the whole Dafny method (body, preconditions and postconditions, loop invariants) from a natural-language problem; prompts: contextless, signature plus test cases, and a few-shot chain-of-thought prompt with retrieval (HTML read).
  - SIZE: 178 MBPP problems (basic algorithmic tasks); benchmark MBPP-DFY-153 of 153 verified Dafny solutions, 50 written by the first two authors by hand (about 220 hours, Section 3.2) and 103 synthesised by GPT-4.
  - SPECIFICATION AUTHOR: the MODEL writes the specification in the main task. The reference set: 50 by people, 103 by GPT-4.
  - WHAT SUCCESS MEANS: verified by Dafny AND a manual review of every verified method by the two authors, classing each postcondition Strong, Weak or Wrong (Table 3; Cohen's kappa 93.91%, Section 4.2). The reviewers were authors, not independent.
  - MODELS AND NUMBERS: GPT-4 and PaLM-2 (chosen from a pilot of eight models). Table 1, verified at k=5: GPT-4 contextless 58.42%, signature 53.37%, dynamic few-shot 64.04%; PaLM-2 0%, 6.74%, 29.21%. The abstract's figures count something stricter than Table 1: "58% of the problems" with the best prompt, and 19% (contextless) and 10% (signature) for the other two. They reconcile with the table numerators on 178 problems (my arithmetic from Table 3; paraphrase): 103 of 178 = 57.9% (few-shot, verified and judged Strong), 34 of 178 = 19.1% (contextless) and 18 of 178 = 10.1% (signature).
  - THE GAP (contextless prompt, GPT-4, paraphrase of the counts in Tables 1 to 3): the verifier accepted 104 of 178 problems (58.4%); only 56 of those 104 carried any postcondition; only 34 of those 56 were judged Strong. So about 58% pass the verifier but about 19% pass with a postcondition that a reviewer rates strong. The paper's words: "although GPT-4 generated 104 verified methods, only 56 of them contain postconditions. Since the other 48 verified methods have no postconditions, they cannot be considered formally verified" (Section 4.1.2, Table 2). Of the 56 with postconditions, 15 were Weak (Table 3). With the few-shot prompt: 114 verified (64.04%), 103 of the 114 Strong (90.35%).

## quotes

- "although GPT-4 generated 104 verified methods, only 56 of them contain postconditions." (checked: two reads; Section 4.1.2)
  - "methods with no specifications trivially avoid being wrong" (checked: two reads; Section 4.1.2)
  - "GPT-4 was able to generate verified, human-evaluated, Dafny methods for 58% of the problems" (checked: two reads, abstract)

## does not cover

Basic MBPP-level problems; no industrial-scale tasks; GPT-4 and PaLM-2 of early 2024 (the authors say both the model and Dafny were evolving fast). Human review by two authors only. It shows the cheap way to "pass": write no postcondition.

## strength

controlled study (small; manual review).

## how chosen

SERIOUS (first benchmark that reads the specification of each verified method by hand; DafnyBench and vericoding build on its MBPP-DFY set)

## period

language-model

## group

G4     claims: C2, C3     direction: mixed (it measures the gap between "verified" and "has a real specification")

## Second reading (notes-H2.md, entry `misu-2024-dafny`)

### says

In a Dafny synthesis study, many methods that the verifier accepted had weak or wrong postconditions, and with the plainest prompt fewer than six in ten verified GPT-4 methods had any postcondition at all.

### measured

TASK: from an English description, write a Dafny method with specification and loop invariants that the Dafny verifier accepts. JUDGED BY: verifier acceptance, then manual labelling of each verified method's postconditions as strong, weak or wrong by two authors independently (Cohen's kappa 93.91%, then consensus). DATA: MBPP-DFY-153: 345 usable MBPP problems, 228 sampled; 50 hand-built exemplars (about 220 hours of work for two authors) and 178 test problems; 103 verified methods by GPT-4 plus 50 written by hand give the 153. MODELS: GPT-4, PaLM-2 (also tried GPT-3.5, PaLM, CodeT5, CodeT5+, LLaMA, CodeLLaMA); three prompts: contextless, with signature, and dynamic few-shot with retrieval. NUMBERS (verify@5 on 178 problems): GPT-4 104 (58.4%) contextless, 95 (53.4%) with signature, 114 (64.0%) few-shot; PaLM-2 0, 12, 52. Postcondition labels (Table 3): GPT-4 contextless, of 56 verified methods that had a postcondition, 34 strong, 15 weak, 7 wrong, and only 56 of the 104 verified methods had a postcondition; with signature 18 strong, 9 weak, 3 wrong of 30; with few-shot 103 strong (90.35%), 3 weak, 8 wrong of 114; PaLM-2 few-shot 35 strong, 3 weak, 14 wrong of 52; PaLM-2 with signature: 12 verified, 1 had a postcondition. At k=1 (Table 1, read twice) GPT-4 verified 58 (32.58%), 59 (33.14%) and 86 (48.31%) of 178. The abstract's "58%", "19%" and "10%" equal 103, 34 and 18 divided by 178 (my arithmetic; the abstract does not say so), that is, the share of problems with a verified method and a strong postcondition, against verified-only shares of 64.0%, 58.4% and 53.4%: for the plain prompt, requiring a strong specification cuts the verified share from 58.4% to about 19%.

### quotes

"GPT-4 managed only 19% of the problems with the Contextless prompt, and even fewer (10%) for the Signature prompt" (checked: abs page and html page give the same words)

### does not cover

basic MBPP-style problems; models and Dafny of early 2023; two authors did the labelling; the later paper by Lahiri (2024, entry above) found some of these labels imperfect; the quality labels measure strength against the intended behaviour as the labellers understood it.

### strength

controlled study (small, one team)

