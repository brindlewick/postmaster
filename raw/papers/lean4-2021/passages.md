# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Lean 4 is a rewrite of the Lean proof assistant in Lean itself, "also an efficient functional programming language", whose users extend it with their own tactics and code.

## measured

no measurement by me. Abstract (PDF text layer, one read): "Lean 4 is a reimplementation of the Lean interactive theorem prover (ITP) in Lean itself. It addresses many shortcomings of the previous versions and contains many new features." The paper says mathlib then had "roughly half a million lines of code" (2021). Use in practice, from the people who run the tool or the company: (1) Microsoft Research blog, 13 July 2026, six named authors: "This first release includes complete proofs for the Rust ML-KEM and SHA3 code that is being used in insiders builds of Windows today"; the workflow is Rust, Aeneas (which translates Rust to a Lean model) and Lean; it also says "Some low-level wrappers, especially those that manipulate raw pointers or expose platform instructions, are modelled by small, carefully reviewed Lean specifications", that is, hand-written trusted models. (2) Talk by the head of engineering of the Lean FRO, 4 June 2026: AWS's SampCert, differential-privacy samplers, "12,000+ lines of Lean proof", "Deployed in AWS Clean Rooms Differential Privacy" (PLDI 2025 paper, not read); Google's Anneal for unsafe Rust is described as under construction. AWS Cedar is another Lean and Dafny case that another helper covers. Both 2026 sources say language-model agents help write specifications and proofs: that belongs to the language-model helpers and I did not evaluate it.

## quotes

- "This first release includes complete proofs for the Rust ML-KEM and SHA3 code that is being used in insiders builds of Windows today." (Microsoft Research blog) (checked, two separate fetches)
  - "Some low-level wrappers, especially those that manipulate raw pointers or expose platform instructions, are modelled by small, carefully reviewed Lean specifications." (same blog) (checked, two separate fetches)

## does not cover

both industrial sources are by the company or the toolmaker, neither independent, and neither gives effort, defect or cost figures. The Microsoft claim is for insider builds, not general release, and for named algorithms, not the library. Mathlib is a mathematics library, so its counts say little about verified software. No user study of Lean 4 found (see GAPS).

## strength

one report or one team's experience (promotional sources; no independent evaluation found)

## how chosen

USE (9.4k GitHub stars; Mathlib 137,962 definitions and 289,882 theorems from 772 contributors; named industrial use at Microsoft and AWS; the page gives no date for the Mathlib counts)

## period

older (the paper, 2021); the use evidence is 2026

## group

G2, background     claims: C2 (use in practice only)     direction: background

