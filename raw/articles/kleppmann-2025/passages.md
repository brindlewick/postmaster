# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Kleppmann predicts that language models will make proofs cheap enough that formal verification becomes ordinary practice, on the grounds that a proof checker rejects any wrong proof, and he says the hard part moves to writing the right specification.

## measured

nothing of its own. The only figure in the essay is the old seL4 cost: 8,700 lines of C took 20 person-years and 200,000 lines of Isabelle (stated as a 2009 fact). It points to the vericoding paper (Sept 2025), Harmonic's Aristotle, Logical Intelligence, DeepSeek-Prover-V2, and a Galois article on Claude and Lean (see galois-dodds-2025) as signs. No specification author, model or task is evaluated.

## quotes

- "AI will bring formal verification, which for decades has been a bit of a fringe pursuit, into the software engineering mainstream." (checked: two calls on the same page, same words)
  - "It doesn't matter if they hallucinate nonsense, because the proof checker will reject any invalid proof and force the AI agent to retry." (checked: two calls on the same page, same words)
  - On the specification, two reads each gave a different part of one sentence: "As the verification process itself becomes automated, the challenge will move to correctly defining the specification" and "the challenge will move to correctly defining the specification: that is, how do you know that the properties that were proved are actually the properties that you cared about?" (each single read; the full sentence is not checked)

## does not cover

No measurement. The proof checker guard covers wrong proofs only; it says nothing about a wrong or weak specification, which the essay itself flags. The date of "mainstream" is not given beyond "the foreseeable future".

## strength

argued but not measured

## how chosen

RECENT (a dated December 2025 prediction by a named academic, which the brief asked for; it supersedes nothing measured); marked argued, not measured

## period

language-model

## group

G4     claims: C2, C3     direction: supports C2 in argument, and names C3 as the remaining obstacle

