# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

In a prototype where the model writes Dafny from a prose request, confirms its reading with the user in prose, and compiles verified Dafny to Python, 77% of 164 HumanEval tasks passed all tests, against 86% when the same model wrote Python directly.

## measured

- TASK: from a prose prompt: the model formalises it in Dafny, tells the user in plain language what its Dafny says, iterates until "both sides agree on a description of the task", then writes a solution and proof; the verifier accepts or rejects; verified code is compiled to Python (HTML read).
  - SIZE: HumanEval, 164 tasks; one model, Claude 3.5 Sonnet.
  - SPECIFICATION AUTHOR: the MODEL, with a prose round-trip to the user (in the experiment, the user's part is automated or scripted; not clear from my read).
  - WHAT SUCCESS MEANS: the Dafny verifier accepts AND the compiled Python passes the HumanEval tests. The paper counts both. Its guard against meaningless specifications is a consistency check: "a natural language description is consistent with a Dafny program, if it allows an LLM to reconstruct from it a second Dafny program that is equivalent to the first." (HTML read, single read).
  - NUMBERS (HTML read; the paper's own experiments, Claude 3.5 Sonnet): "On a set of 164 tasks, the prototype converged to a candidate solution in 144 cases, of which 127 passed all test cases. Overall, this leaves us with a pass rate of 77%." So 17 of the 144 verified candidates failed the tests (derived, 11.8%; paraphrase). Native Python generation by the same model: 86%. With a fallback to native generation when Dafny does not converge: about 88%. Causes of the failures of verified code, as read: "too ambiguous a prompt or failing interoperability with native Python code"; algorithmic incorrectness in "half of the time" among test failures.

## quotes

- "On a set of 164 tasks, the prototype converged to a candidate solution in 144 cases, of which 127 passed all test cases." (checked: two reads of the HTML, same words)
  - "Overall, this leaves us with a pass rate of 77%, which is lower than the 86% for native Python code generation with Claude Sonnet 3.5." (single read of the full sentence; the 77% and 86% appeared in two reads)
  - "Often it instead was due to either too ambiguous a prompt or failing interoperability with native Python code." (checked for the words after "due to": two reads)

## does not cover

HumanEval is small and well-known (contamination possible); one model of late 2024. The number of verified-but-failing is small and the paper's own causes (ambiguous prompts, interop) mean not all are specification errors. The generated Python is not idiomatic and needs a Dafny runtime (limitations).

## strength

one report or one team's experience (a prototype and one benchmark)

## how chosen

USE (industrial-affiliated, Amazon) and CONTRADICTS (verified code that still fails the user's tests)

## period

language-model

## group

G4     claims: C2     direction: mixed (verified path scored lower than the plain path on tests; it measures verified-but-failing programs)

