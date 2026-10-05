# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Each routine carries a precondition (the caller's obligation) and a postcondition (the routine's), each class an invariant, all written as Boolean expressions that can be checked at run time during development; a violated precondition is a bug in the caller and a violated postcondition a bug in the routine.

## measured

Nothing. No study, no data; the method is worked Eiffel examples. Assertion monitoring is a per-class compilation option with five levels: no checking, preconditions only (the default), preconditions and postconditions, those plus class invariants, or all assertions (p. 46); preconditions are the default because client code is young and may pass bad arguments to trusted library routines. On the assertion language (p. 45) Meyer notes that software functions are imperative and can change state, so a function called in an assertion must not change state or cause abnormal situations; full first-order logic in assertions is not needed. On concurrency (p. 47) he says a precondition a client has checked can be false by the time the call runs, so preconditions may need a different reading there (paraphrases).

## quotes

"while certainly not providing infallible ways to guarantee reliability, may help considerably toward this goal" (single read; p. 40) | "any function used in assertions must be of unimpeachable quality, avoiding any change to the current state and any operation that could result in abnormal situations" (single read; p. 45) | "Assertion monitoring, then, is a way to call the developer's bluff by checking what the software does against what its author thinks it does." (single read of the page text; p. 46)

## does not cover

There is no evidence in it that contracts reduce defects; the claim is a hope ("may help considerably"). The article says the main use of run-time assertion monitoring is debugging (p. 46, "Why monitor?"), so a violation shows only on an input that actually runs (my inference: which is why contracts need tests or generated inputs to exercise them). On "defensive programming revisited" (p. 41) and "Who should check?" (p. 44) Meyer argues against redundant checks inside a routine when the contract already puts the burden on the caller; he does not discuss checking data that comes from outside the program. Contract checks do not carry over unchanged to concurrent code, as the author says (p. 47).

## strength

argued but not measured

## how chosen

SERIOUS (the original statement of design by contract; named in the brief)

## period

older (before 2022)

## group

G1 (design by contract)     claims: C1 (the point about side-effect-free functions in assertions); background for C3     direction: background

## Provenance

The reading helper's url line for this entry says it was VERIFIED against the page images of the source, naming the pages; the helper's notes for this group say an entry is verified only if its url line says so.

