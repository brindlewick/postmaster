# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A formal-methods researcher used Claude Code to formalise a published concurrency logic in Lean 4, found that it can write proofs but sometimes thrashes or makes deep conceptual mistakes that do not cause a build error, and judged it slower than doing it by hand.

## measured

one project, one person. Claude Code in Lean 4; formalising the 2009 paper on Deny-Guarantee Reasoning; the author acted as "project manager". At the time of writing about 50% through the formalisation plan, 2,535 lines of Lean in total of which about 1,232 are proof (as read). Typical task took 5 to 10 minutes. Failure kinds named: "Thrashing (fairly common)" and "Deep persistent mistakes (rare, but very important)" where "the agent made a conceptual mistake which I didn't notice and didn't result in a build error." Specification author: the human wrote the plan; the agent wrote definitions and proofs. No cheating tests are reported.

## quotes

- "I think formalizing using AI was way slower than if I'd done it by hand." (checked: two calls on the same page, same words)
  - "But more than 60% of the Lean code consists of _definitions_ not theorems." (checked: two calls on the same page, same words, ignoring the leading "But" in one read)
  - "Claude Code points to a future where theorem proving is _solved_ - cheap, abundant, and automatic." (checked: two calls on the same page, same words, ignoring the leading clause in one read)

## does not cover

One person, one project (a formalisation of a paper, not shipping software). The point most useful to C2: more than 60% of the code is definitions, which Lean does not check against intent; the author says they "look reasonably plausible" but would need careful auditing (paraphrase). Early-autumn-2025 Claude Code.

## strength

one report or one team's experience

## how chosen

CONTRADICTS (a first-hand account from a formal-methods researcher that the checked proofs do not settle whether the definitions are right, and that the agent was slower than doing it by hand; line and proof counts are given and the Lean code is public)

## period

language-model

## group

G4     claims: C2, C3     direction: mixed

