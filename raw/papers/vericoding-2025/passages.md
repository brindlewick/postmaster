# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Given a formal specification, off-the-shelf models produce verified code for 82% of Dafny tasks, 44% of Verus tasks and 27% of Lean tasks when a task counts as solved if any one model solved it; the best single model solves far fewer.

## measured

- TASK: "vericoding": the model gets a formal specification (precondition and postcondition) in Dafny, Verus/Rust or Lean and writes the code and its proof; the specification is fixed.
  - SIZE: 12,504 tasks: 3,029 Dafny, 2,334 Verus/Rust, 7,141 Lean; 6,174 are new (abstract). Program size: "the tasks in our dataset are typically solvable in under 100 lines of code" (single read, HTML).
  - SPECIFICATION AUTHOR: mixed. From existing formal benchmarks (DafnyBench, VerifiedCogen, Verina, Clever); from programming datasets (APPS, FVAPPS, HumanEval); from maths-library documentation (NumPy, BigNum). For the second and third group "autoformalization" by a model produced the spec (HTML read, benchmark construction). Checked by "LLM as a judge" and by manual sampling.
  - WHAT SUCCESS MEANS: verifier acceptance, with a validation script that looks for "known proof bypass patterns" (e.g. `sorry` in Lean), `assume(false)`, changing postconditions to `ensures true`, implementation leakage from the spec; the proof checker is told to reject such proofs and the model is blocked from altering specs (HTML read). Manual review of 5 successes per language and source found, in the paper's words: "No further cheating was discovered, other than those which were caught by our validation checks." (checked: two reads)
  - SPEC QUALITY FOUND: "a handful of specifications admitted trivial solutions"; "conditioned on vericoding success, roughly 9% of the specs were too weak and another 15% had poor translations" (HTML read). Verus "showed many weak specs due to spec translation issues".
  - HEADLINE NUMBERS (abstract and HTML read, the paper's own experiments, models of mid-2025): 82.2% Dafny, 44.2% or 44.3% Verus (two reads differ by 0.1; the abstract rounds to 44%), 26.8% Lean for the UNION of models (tasks solved by at least one). Single models: Claude-Opus-4.1 alone 67.5% on Dafny; GPT-5 best on Verus (30.9%) and Lean (17.9%). Natural-language descriptions added on the Verina set: "no statistically significant performance improvement" (indeed slightly worse).
  - SPEED OF CHANGE: on the original 782-task DafnyBench: "The June 2024 state-of-the-art of 68% with Opus-3 has now risen to 89% with Opus-4.1 and 96% for the model union." That is 68% to 89% (single model) in about 14 months.

## quotes

- "We find vericoding success rates of 27% in Lean, 44% in Verus/Rust and 82% in Dafny using off-the-shelf LLMs." (abstract; single read, abs page)
  - "The June 2024 state-of-the-art of 68% with Opus-3 has now risen to 89% with Opus-4.1 and 96% for the model union." (checked: two reads of the v1 HTML, same words)
  - "roughly 9% of the specs were too weak and another 15% had poor translations" (checked: two reads of the v1 HTML; the full sentence begins "Across Dafny, Verus and Lean, conditioned on vericoding success,")

## does not cover

The headline is a union over models, not one model; a reader should not take 82% as what one model does. Specification is given, so this is silent on writing specs. Lean figures are low partly because Lean tasks need proofs, not just code (the paper's reading; paraphrase). The abstract sentence "We find vericoding success rates of 27% in Lean, 44% in Verus/Rust and 82% in Dafny" was read once on the arXiv abstract page; the POPL 2026 Dafny-workshop listing carries a different, shorter abstract without the figures. The unversioned arXiv HTML page returned only a table of contents on the first read; the figures above come from the v1 HTML read. Numbers were produced with proprietary models at one date; nothing says they hold for other tasks.

## strength

controlled study (large, several models and languages); specification quality checked by sampling only.

## how chosen

RECENT and SERIOUS (largest benchmark of code from formal specifications, three languages, with a validation script for cheating, and a year-on-year comparison on DafnyBench)

## period

language-model

## group

G4     claims: C2, C3     direction: mixed

## Read again by the research session on 2026-10-04

Route: arXiv abstract page, read by the research session on 2026-10-04.

- "We find vericoding success rates of 27% in Lean, 44% in Verus/Rust and 82% in Dafny using off-the-shelf LLMs." (checked: the reading helper's quote and this read give the same words)
- "Adding natural-language descriptions does not significantly improve performance." (single read (this read only))
- "We also find that LLM progress has improved progress on pure Dafny verification from 68% to 96% over the past year." (single read (this read only))

