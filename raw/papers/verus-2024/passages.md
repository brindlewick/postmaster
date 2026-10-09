# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Verus checks proofs about Rust programs with an SMT solver and the authors report 6.1K lines of verified Rust against 31K lines of proof across five systems, a proof-to-code ratio of 5.1 overall and up to 13.3 for the page table.

## measured

the authors' own five systems, ported or new: IronKV and a node-replication library (ported from Dafny), and from scratch an OS page table, a mimalloc-derived memory allocator, and a persistent log for a cloud storage system. Abstract: "6.1K lines of implementation and 31K lines of proof. Verus verifies code 3-61x faster and with less effort than the state of the art." Figure 9 (PDF p. 10), columns trusted-specification lines, proof lines, code lines, proof-to-code ratio, seconds on one core: IronKV in Verus 1,613 / 4,509 / 1,533 / 2.9 / 41 s (the Dafny original, from the same table: 1,205 / 8,070 / 1,923 / 4.2 / 445 s); node replication in Verus 369 / 5,237 / 736 / 7.1 / 17 s (Dafny original 104 / 7,828 / 730 / 10.7 / 1,089 s); page table 1,117 / 5,329 / 400 / 13.3 / 63 s; mimalloc port 282 / 13,703 / 3,178 / 4.3 / 262 s; persistent log 1,284 / 2,913 / 739 / 3.9 / 12 s; printed total 4,692 / 31,231 / 6,119 / 5.1 (I did not reconcile the printed total with the rows, which add up to slightly different numbers). Page-table text, section 4.2.3: "a relatively high 13.3:1 proof-to-code ratio. This may be a result of this being our first large-scale development in Verus"; an independent Verus microkernel reports 7.5:1; an automated, restricted-logic system (Hyperkernel) "reports 0.03:1". The comparison is against the authors' own earlier tools and ports, so "less effort" is their claim, measured here by lines and verifier time, not by person-time. Trusted base, section 1: "Verus's results depend on the correctness of the top-level specifications, the Verus verifier, the solvers it relies on, and the Rust compiler." Use in practice (the publications page, as the fetch tool summarised it): Anvil (cluster-management controllers, VMware Research, OSDI 2024 best paper), VeriSMo (a verified security module for confidential VMs, Microsoft, OSDI 2024), PoWER Never Corrupts (Microsoft, OSDI 2025), Atmosphere (verified kernels, SOSP 2025), AutoVerus (language-model proof generation: another helper covers it). The persistent log "is integrated into a production codebase, which incorporates it via Cargo.toml as just another Rust crate" (section 4.2.5).

## quotes

- "Any verification result is limited by its TCB." (section 1, PDF p. 2) (checked, page image and text layer agree)
  - "Formal verification is a promising approach to eliminate bugs at compile time, before they ship." (abstract) (checked, page image and text layer agree)
  - "much of this success has required heroic developer effort" (abstract, about earlier verified systems) (checked, page image and text layer agree)

## does not cover

the authors' own tool on the authors' own systems, written by the tool's designers; no study of other people using it (the paper says "the true evaluation will come from future projects"). The "trusted" column is the line count of the specifications a reader must trust: 4,692 printed lines against 6,119 lines of verified code, so the specification is not small beside the code in these case studies. The page-table specification (1,117 lines) is nearly three times the length of its 400 lines of code. Figure 9's times are seconds to verify each whole project on a 16-core machine, on one core and on eight cores. The projects-page list is the project's own, and I did not open each paper.

## strength

one report or one team's experience (artefact-evaluated)

## how chosen

USE (named industrial and company-research use: the projects page lists Microsoft Research and VMware Research systems; 3.3k GitHub stars read on the day) and SERIOUS (an artefact-evaluated systems paper with proof-to-code ratios)

## period

older in the sense of before language-model work; 2024 (the Verus tool itself is 2023-2024; its 2023 founding paper, Lattuada et al., OOPSLA 2023, "Verus: Verifying Rust Programs using Linear Ghost Types", I did not read)

## group

G2, background (Verus; also holds cost figures for C2 and C3)     claims: C2, C3     direction: mixed

