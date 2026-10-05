# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

AWS wrote an executable model of Cedar in Lean and proved properties of it, checked the Rust production code against the model with differential random testing, and used property-based tests for the rest; proofs found 4 bugs and the testing 21 more.

## measured

process report, no language model anywhere (the read says "No mention of AI or language models appears anywhere in the document").
  - Sizes (Table 1, as read): Lean model 1,673 lines; Lean proofs 5,714 lines; Rust production code 15,693 lines; proofs to model about 13.4 to 1 by lines.
  - Properties proved about the authorizer and validator: forbid trumps permit, default deny, explicit allow, order independence, sound slicing, validation soundness, termination.
  - Bugs: 4 found while proving (1 non-termination in the validator, 3 while proving validator soundness); 21 found by differential random testing and property-based testing (Table 2: ABAC type-directed differential testing 6; validator parity 4; parser roundtrip 6; formatter roundtrip 2; validation soundness 3; RBAC 0). Table 4 lists 10 bugs that testing missed (as read), with reasons such as "Triggering input is too hard to generate".
  - What is outside the proofs: the parsers are not modelled in Lean ("there is currently no library support for parser generators", as read); the link between Lean model and Rust code is by testing, not proof. Proof check takes about 3 minutes.
  - Effort: no person-time figures given in the paper (as read).

## quotes

- "While carrying out proofs, we found and fixed 4 bugs in Cedar's policy validator, and DRT and PBT helped us find and fix 21 additional bugs in various parts of Cedar." (abstract; single read, abs page)

## does not cover

Whether the properties are the right ones; the paper does not address that (as read). It is a statement about a team of expert engineers, not about models. The abstract says the bugs "evade code reviews and unit testing", but the paper counts no review-found bugs for comparison.

## strength

one report or one team's experience (a process report with bug counts)

## how chosen

USE (named industrial adoption: Cedar is AWS's authorisation policy language) and SERIOUS (reports bug counts by technique)

## period

2024, but not language-model work (it uses no model); listed here only because the brief asked for AWS's account of Cedar and because laurel-2024 uses the Cedar specification

## group

G2 (also G1, G3 background)     claims: C1, C2, C4     direction: mixed

## Read again by the research session on 2026-10-04

Route: arXiv abstract page, read by the research session on 2026-10-04.

- "While carrying out proofs, we found and fixed 4 bugs in Cedar's policy validator, and DRT and PBT helped us find and fix 21 additional bugs in various parts of Cedar." (checked: the reading helper's quote and this read give the same words)
- "find and fix subtle implementation bugs that evade code reviews and unit testing" (single read (this read only))

## Read again by the research session on 2026-10-04

Route: arXiv HTML page, Table 1 in Section 3.1, read by the research session on 2026-10-04.

- "It takes about 3 minutes to check all proofs and compile models for execution." (single read (this read only))

Table 1 (Lean and Rust implementations, lines): Lean model 1,673; Lean proofs 5,714; Rust production code 15,693; Rust tests 20,458; Rust other 31,391. The Validator row holds 532 model lines and 4,686 proof lines; the Evaluator and Authorizer row 897 and 347; custom sets and maps 244 and 681.

