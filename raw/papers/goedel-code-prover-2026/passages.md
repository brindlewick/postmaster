# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

On 427 Lean code-verification tasks with program and specification given, a specialised 8B proving model succeeded on 62.0%, against 23.8% for the best other model in the comparison, and general frontier models scored below about 24% on the same tasks.

## measured

- TASK: given a Lean 4 program with precondition P and postcondition Q, construct a proof of {P} C {Q}. Program and specification are given.
  - SIZE: three benchmarks, 427 tasks: Verina 189, CLEVER 161, AlgoVeri 77 (as read). Program size not given.
  - SPECIFICATION AUTHOR: given. For CLEVER and AlgoVeri "we prompt GPT-5.2 to generate the code and manually verify the results" (as read), so the programs are model-written and spot-checked and the specifications are the benchmarks' (people).
  - MODELS AND NUMBERS (Figure 3 and text as read; the paper's own experiments; pass@128 for baselines, pass@k up to 32 parallel runs for the new model): Goedel-Code-Prover-8B (Qwen-3-8B base, supervised then reinforcement learning): Verina 68.8%, CLEVER 54.0%, AlgoVeri 62.3%, overall 62.0%. Strongest baseline overall BFS-Prover-V2-32B at 23.8% ("2.6x"). Frontier general models in the comparison: Claude-Opus-4.6, Gemini-3-Flash, GPT-5.2-Pro, GPT-5.3-Codex, DeepSeek-V3.2-Speciale; GPT-5.3-Codex was the best of those on CLEVER at 23.6% and under 20% on Verina (as read). Neural provers: Kimina-Prover-72B, DeepSeek-Prover-V2-671B, Goedel-Prover-V2-32B, BFS-Prover-V2-32B.
  - WHAT SUCCESS MEANS: Lean kernel accepts; only the standard axioms propext, Classical.choice and Quot.sound are allowed and "proofs invoking Lean.ofReduceBool or Lean.trustCompiler are rejected, as these bypass the kernel's deductive checking" (as read); no `sorry` in final outputs.

## quotes

- "On three Lean-based code verification benchmarks comprising 427 tasks, our 8B-parameter model achieves a 62.0% prove success rate" (checked: abstract on the abs page and the HTML read; the abstract continues ", a 2.6× improvement over the strongest baseline under the reported inference settings")
  - "Our framework achieves prove success rates of 68.8%, 54.0%, and 62.3% on Verina, Clever, and AlgoVeri, respectively" (checked: two reads of the HTML)
  - "Among frontier reasoning models, the strongest (GPT-5.3-Codex) reaches only 23.6% on Clever" (single read of the HTML)

## does not cover

Programs pre-formalised in Lean; informal specifications not handled; one RL run so no variance estimate; no cost accounting (limitations as read). The comparison sets baseline and new model at different sampling regimes. It says nothing on writing specifications. The "frontier models score below about 24%" reading is for a proof-only task in Lean with these budgets, not for coding in general.

## strength

one report or one team's experience (a single training run; no variance estimate)

## how chosen

RECENT (newest Lean code-verification figure found; compares frontier models with specialised provers on the same proof-only task)

## period

language-model

## group

G4     claims: C2     direction: mixed (proof alone: a tuned 8B model beats general frontier models by a wide margin)

