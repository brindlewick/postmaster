# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Frontier models wrote a Verus specification that survived official and adversarial tests for 51% to 78% of 581 competition problems, and a model acting as judge missed about a quarter of the wrong specifications that the tests caught.

## measured

- TASK: from an informal Codeforces statement, write a Verus specification (a `pre_spec` for valid inputs and a `post_spec` for correct input-output pairs) with no code. Models work in an agentic environment with Verus, bash and the file system (Section 3.1, as read).
  - SIZE: 581 tasks from Codeforces (single-file, competition style). Budget $2.5 per problem and 75 minutes per task (Section 4.1, as read).
  - SPECIFICATION AUTHOR: the model. There are no hand-written reference specifications; the evaluator runs the specification as Rust code (Verus `exec_spec` extended) against official Codeforces tests and "hacks" (edge cases written by competitors to break incorrect solutions) in four buckets: pre-completeness, pre-soundness, post-completeness, post-soundness (as read).
  - WHAT SUCCESS MEANS: a specification passes if it accepts all valid inputs and outputs and rejects all invalid ones across the four test buckets. Limit stated: "Faithfulness evaluation also remains an approximation: finite test suites can expose many specification errors, but they cannot rule out all possible errors." (Section 6, as read, single read).
  - NUMBERS (Table 1, pass@1, as read; the paper's own experiments, spring 2026): Gemini 3.1 Pro 77.8%; GPT-5.3-Codex 57.8%; Claude Opus 4.6 51.1%; DeepSeek-V4-Pro 24.3%; GLM-5.1 21.5%; Kimi-K2.6 25.5%.
  - FAILURE KINDS (Section 4.3, no counts given): omitted input assumptions (such as sortedness or existence guarantees), accepting incorrect outputs (such as non-leftmost positions or non-coprime pairs), and rejecting valid outputs.
  - MODEL AS JUDGE: GPT-5.3-Codex judging its own specifications "marked 49 of 191 incorrect but compilable specifications as correct" (25.7%; the abstract says "misses 26% of the failures our evaluator catches").

## quotes

- "Overall, our results suggest that spec autoformalization is within reach for frontier agents but remains brittle even on problems where they can already generate correct code." (abstract; single read, abs page)
  - "even on problems where current agents can generate correct code, they often fail to write a faithful specification" (single read, HTML Section 4.2)

## does not cover

Single-file competition problems; "multi-file, real-world systems" are left unexplored (Section 6). The evaluator is tests, so a specification can pass and still be wrong in ways the tests do not exercise. Models of spring 2026.

## strength

controlled study (581 tasks, six models, one team)

## how chosen

RECENT and SERIOUS (a 2026 benchmark that separates writing the specification from writing code, and evaluates specifications by execution against tests, including adversarial ones)

## period

language-model

## group

G4     claims: C3 (also C2)     direction: mixed (frontier models can write faithful specifications for a majority of competition tasks, but not all, and a model judge misses a quarter of the errors tests catch). Overlaps with the other helper's specification-generation scope; kept here because it is built on a verifier for Rust.

