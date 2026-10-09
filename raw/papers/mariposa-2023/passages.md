# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

In six existing verification projects, up to 5% of the solver queries behind their proofs are unstable, that is, a semantically irrelevant change such as renaming a variable can make verification slow or fail, and upgrading the solver often makes this worse.

## measured

Mariposa mutates each SMT query (renaming, reordering, shuffling) and re-runs the Z3 solver; 17,043 queries from six projects in three verification frameworks (Table I, source lines and queries per project: Komodo in Dafny 26K lines, 2,054 queries; Komodo re-done in the Serval framework 4K, 773; VeriBetrKV (a key-value store) in Dafny 44K, 5,325, and a linear-types variant 49K, 5,600; DICE* in F* 25K, 1,536; vWasm in F* 15K, 1,755); over three million mutant queries and "~ 578 CPU days". Abstract: "the most recent SMT solver version is unstable on 2.6% of the queries. For individual projects, the unstable ratio can grow to 5.0%." "SMT solver upgrades often make projects less stable." Dafny and F* "only offer heuristic options to identify it" and "these heuristics only capture a fraction of the problem" (introduction). The authors state the consequence for developers: instability "substantially lengthens their code-prove-debug cycle" and may require fixing "issues that arise in code or proofs they did not write and may not even understand".

## quotes

- "the most recent SMT solver version is unstable on 2.6% of the queries. For individual projects, the unstable ratio can grow to 5.0%." (abstract) (checked, page image and text layer agree)
  - "multiple teams anecdotally report that this style of automated verification is plagued by proof instability" (abstract) (checked, page image and text layer agree)

## does not cover

six research projects, mostly from 2018 to 2021 and run on solver versions up to the study's date; it measures solver behaviour on stored queries, not the cost to a team, and does not say whether a user would see 5% of proofs break in a day. It covers the SMT-based tools (Dafny, F*, Verus-style Rust, Serval); proof assistants such as Rocq, Lean and Isabelle do not use an SMT solver as their checker, so its figures do not apply to them.

## strength

one report or one team's experience (a systematic measurement by one group, with the data released)

## how chosen

SERIOUS (the one systematic measurement of proof brittleness in SMT-based verifiers; the measured counterpart of the AWS report in dafny-2022)

## period

older (2023)

## group

G2 (Dafny, F*, and the Rust and Serval toolchains' SMT back end)     claims: C2 (trust and cost: proofs that break for no semantic reason)     direction: contradicts (in part)

