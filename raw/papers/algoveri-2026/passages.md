# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

On 77 classical algorithms with the same specification written in all three languages, the best of the tested models verified 40.3% in Dafny, 24.7% in Verus and 7.8% in Lean, so the language matters as much as the model.

## measured

- TASK: given a prose algorithm description and a specification aligned across Dafny, Verus and Lean, write the implementation and the proof artefacts (invariants, ghost code, tactic scripts). Multi-turn repair: up to 15 rounds on verifier feedback (Section 4, as read).
  - SIZE: 77 classical algorithms (data structures, graph algorithms, math) (Section 2.2). Line counts not obtained.
  - SPECIFICATION AUTHOR: people. "Expert curation: formal methods experts manually write, align, and review specifications" (Section 2.3, as read). Alignment is checked by well-formedness checks formalised in Lean for local satisfiability and "necessity against degeneracy" (as read).
  - WHAT SUCCESS MEANS: the verifier accepts AND an LLM "semantic filter" judges the solution matches the intended algorithm and rules out cheating (using `assume`, `sorry`) and "algorithmic degeneracy" (Section 2.4, as read). The prompt tells models not to cheat: "You should not cheat: even if you cannot implement or verify the code, you should not try to bypass the compiler (e.g, writing 'assume', 'verify false', 'axiom', 'extern', or 'expect')." (Appendix C.1, single read).
  - MODELS AND NUMBERS (Table 2 as read, compiler-verified and semantic-filtered, one sample with 15 repair rounds unless stated; the paper's own experiments): Gemini-3 Flash: Dafny 40.26%, Verus 24.68%, Lean 7.79%. GPT-5 mini: 30.47%, 6.49%, 5.19%. GPT-OSS-120B with one sample: 13.51%, 7.01%, 7.01%; with ten parallel samples: 28.57%, 10.39%, 14.29%. Also tested: Qwen3-235B-A22B-Instruct, Qwen3-Next-80B-A3B-Thinking, Devstral-2-123B-Instruct. The models are mid-tier and open models, not the top frontier models of the day.
  - FAILURE ANALYSIS (Section 4.2, Figures 3 and 6 as read): Dafny fails mostly on verification once syntax is fixed; Verus keeps failing on syntax and types through all 15 rounds; Lean fails on hallucinated lemma names. A cliff on advanced data structures and graph algorithms that need auxiliary state or global properties.

## quotes

- "While frontier models achieve tractable success in Dafny (40.3% for Gemini-3 Flash)" and "performance collapses under the systems-level memory constraints of Verus (24.7%) and the explicit proof construction required by Lean (7.8%)." (checked: abstract read on the HTML page and on the abs page; the abs page has the clause "where high-level abstractions and SMT automation simplify the workflow" between them)

## does not cover

77 problems; the semantic filter is itself a model ("introducing potential bias", limitations as read). Lean specifications are non-idiomatic because they were bent to match the other languages. Not the strongest models of its date. Its Dafny number is not comparable with the vericoding or DafnyBench numbers: different tasks (code and proof from prose, versus hints or code from given specifications).

## strength

controlled study

## how chosen

RECENT (2026; the only benchmark read that gives the same specification in Dafny, Verus and Lean, so the three languages are comparable)

## period

language-model

## group

G4     claims: C2, C3     direction: mixed

