# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

No algorithm can show that a specification matches the user's intent, so the paper tests specifications symbolically against input-output examples and shows the metric mostly agrees with human labels while exposing mislabelled specifications.

## measured

TASK: judge Dafny postconditions written for MBPP problems (natural-language task, signature, 3 test cases per problem). JUDGED BY: symbolic testing: correctness = the postcondition is verified to hold on every given input-output pair (Hoare triple check); completeness = share of mutated outputs (5 per input) the postcondition rejects. The human labels (wrong_spec, weak_spec, strong_spec) come from an earlier dataset (MBPP-DFY by Misu and others, specifications mostly written by GPT-4); the paper does not say who labelled or how many labelled. PROGRAMS: 153 problems with specifications; the tool could be applied to 64, the other 89 were out of reach of its simple Dafny parsing. NUMBERS (Sec II-B): every weak_spec scored below 0.66 completeness and every strong_spec above 0.66; at least 3 specifications labelled strong_spec were found to be weaker than a precise one (for example SharedElements); a few labelled strong_spec failed the correctness check; two wrong specifications are named (RemoveDuplicates, countSubstrings). Overall agreement is stated as "for the large majority" without a percentage.

## quotes

"yet demonstrates cases where the human labeling is not perfect" (single read, html abstract)

## does not cover

a metric based on examples and mutated outputs, so a specification can pass it and still miss the intent; 64 problems; short MBPP-style functions; spec writer mostly one model; quantifier and recursion limits stop the metric on many specifications.

## strength

one report (small sample, one team)

## how chosen

SERIOUS (it addresses the exact gap, "does the specification match what the user meant", and checks an automatic metric against human labels)

## period

language-model

## group

G4     claims: C3     direction: mixed

