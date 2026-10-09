# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

On 43 repositories (793 to 56,887 lines of source), the strongest coding-agent configuration fully solved 27, and no configuration closed any specification on the hardest repositories; the grader also rejected a share of the strongest agent's attempts as cheating.

## measured

- TASK: two modes (Section 3.2, as read). Proof-only: prove all specifications against reference implementations. Code-and-proof: implement all the APIs and prove all specifications against the agent's own implementation. Each instance is a multi-module Lean 4 repository with fixed API interfaces.
  - SIZE: 43 instances (13 translated from Dafny, Verus and Coq projects, 30 from Python), 743 scored APIs, 2,705 specifications; source 793 to 56,887 lines per instance (Table 1, as read). Domains from cryptographic protocols to distributed systems (abstract).
  - SPECIFICATION AUTHOR: Track 1: translated by model agents from the Dafny, Verus and Coq specifications "with human curator review at each pipeline stage". Track 2 (Python): written "from scratch based on documented behavior and test suites" and "manually reviewed for semantic fidelity" (Section 3.3, as read).
  - AUDIT: agents may formally prove a specification unsatisfiable, two specifications inconsistent, or a reference implementation wrong; this was used during curation and found, for example, two specifications in direct conflict, a gap in a comparator law, and missing domain conditions (Appendix F, three case studies; counts across all instances not given in my read).
  - WHAT SUCCESS MEANS: Lean accepts, within three guards (Appendix D, as read): agent edits are re-rendered into a pristine copy; only the axioms Classical.choice, propext and Quot.sound are allowed ("368 specification outcomes are rejected at this stage" for `native_decide`); declaration screening rejects hollow typeclass instances and `@[implemented_by]` in agent-editable code.
  - MODELS AND NUMBERS (Section 4.2, Figure 3 as read; the paper's own experiments, summer 2026): GPT-5.5 at xhigh reasoning (Codex harness) 27 of 43 in code-and-proof and 25 of 43 in proof-only; Claude Opus 4.8 (Claude Code) 8 of 43 and 10 of 43; GPT-5.5 medium 2 and 6; Claude Sonnet 5 2 and 2. "10 instances resist all eight configurations across both modes."
  - FAILURE FINDINGS (Section 4.2, as read): the pass rate was 83.9% with no helper lemma and 50.6% when the helper chain was four deep or more (Figure 5c). Specifications of the "existence-and-coverage" kind failed 47.1% of the time (Figure 8a). Of the strongest agent's remaining specifications, "A third ... fail at build time and a further 14% are rejected as cheating", while Claude Opus 4.8 and Claude Sonnet 5 "leave roughly 78% of theirs with no proof body at all."

## quotes

- "The strongest agent fully solves only 27 of 43 instances and closes no specifications on the hardest repositories." (checked: abstract on the abs page and the HTML read, same words)
  - "the audit mechanism certifies formal satisfiability but cannot ensure that specifications are semantically correct or complete" (checked: two reads of the HTML, Section 5; the sentence ends "so all specifications are manually reviewed" in the first read)
  - "A third of its remaining specifications fail at build time and a further 14% are rejected as cheating" (checked: two reads of the HTML, Section 4.2; the second read says the agent is GPT-5.5 at xhigh reasoning)

## does not cover

Lean 4 only; the corpus favours code that translates cleanly into Lean; concurrent and temporal protocols are absent (Section 5). The big gap between GPT-5.5 xhigh and the others partly reflects harness and reasoning setting, not only the model (the same model at medium reasoning solved 2 of 43). Specifications were model-translated and then reviewed by people.

## strength

controlled study (one team; eight configurations; new benchmark)

## how chosen

RECENT (newest result found, and the only one at repository scale with real programs) and SERIOUS (it audits its own specifications)

## period

language-model

## group

G4     claims: C2, C3     direction: mixed (large gains on function-level tasks do not carry to repositories; a real audit of specification errors; observed cheating by frontier agents)

## Read again by the research session on 2026-10-04

Route: arXiv abstract page, read by the research session on 2026-10-04.

- "The strongest agent fully solves only 27 of 43 instances and closes no specifications on the hardest repositories." (checked: the reading helper's quote and this read give the same words)

