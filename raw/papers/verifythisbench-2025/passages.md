# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Asked to go from a plain description of a VerifyThis competition challenge all the way to specification, implementation and machine-checked proof, the best model passed under 4% zero-shot and under 10% after five feedback rounds.

## measured

- TASK: from a natural-language description: (i) extract a formal specification, (ii) implement in a verification-aware language, (iii) construct a machine-checkable proof. A relaxed variant (XS) gives partial implementations or proofs.
  - SIZE: 154 tasks from 41 competition challenges (VerifyThis, 2011 to 2024); XS has 580 relaxed tasks (226 code, 233 specification, 121 loop) (HTML read, as printed). Tools: Dafny, Why3, VerCors, VeriFast, Frama-C, Verus, CBMC (Section 3.2), so C, Rust, Java and verification languages.
  - SPECIFICATION AUTHOR: none given to the model (the model writes it). Reference solutions come from past human solutions and competition submissions; the authors added Verus solutions.
  - WHAT SUCCESS MEANS: "A task is marked as pass/succeed if no error is returned" from the verification tool (Section 4.2; checked: two reads). Fidelity of the specification to the description is NOT checked automatically; the paper uses a model self-assessed "coherence check" plus manual inspection of a subset of successes, and says: "Automatically verifying the alignment between generated specifications and user intent in natural language remains an open technical challenge." (single read, as read.) Also "While passing a formal verifier indicates syntactic and logical correctness, it does not address the alignment problem." (checked: two reads, limitations)
  - NUMBERS (HTML read, the paper's own experiments, nine models; read only roughly): zero-shot best o3-mini 3.62% (abstract: "less than 4%"); after 5 refinement rounds about 9.4% for o3-mini; by tool zero-shot to refinement: CBMC 4.76% to 18.11%, Verus 3.32% to 8.15%, Dafny 1.30% to 4.47%, VeriFast 0% to 0.43%. The XS variant: o4-mini 3.45% to 17.24%. Compile errors dominate failures; Claude produced compilable output in about 25% of first attempts on the full set and nearly 50% on XS. A second read of the main table gives, zero-shot then after refinement (percent of tasks passed): o3-mini 3.62 then 9.37; Claude 2.32 then 7.98; Llama 3.34 then 7.88; GPT-4o 1.48 then 6.22; o4-mini 0.93 then 7.98; Gemini 1.48 then 6.86; DeepSeek 1.02 then 5.19; GPT-4o-mini 2.23 then 4.64; Qwen 0.28 then 1.11 (model versions not given in the read). The refinement figures are after five rounds (as I read the earlier text; not re-checked).

## quotes

- "even state-of-the-art (SOTA) models, such as o3-mini, achieve a pass rate of less than 4%, with many outputs failing to compile." (abstract; single read, abs page)
  - "Automatically verifying the alignment between generated specifications and user intent in natural language remains an open technical challenge." (checked: two reads of the HTML, same words)

## does not cover

Competition-style challenges are harder than textbook tasks and are written as prose, so the low number mixes understanding the problem, writing the specification, and proving. It cannot separate those without the XS variant. Models of spring 2025.

## strength

controlled study (nine models, seven tools; self-assessed fidelity check only).

## how chosen

SERIOUS (the only benchmark here whose tasks come from a human verification competition and which asks for specification, implementation and proof from prose, across seven tools)

## period

language-model

## group

G4     claims: C2, C3     direction: contradicts (end-to-end from a plain-language description is near zero) and states the limit of "verified"

