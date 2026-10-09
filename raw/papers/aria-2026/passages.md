# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A general coding agent wrapped in a verification harness re-proved every lemma it was given in the Iris separation-logic library (4,257 lemmas), 217 lemmas in Rust's standard libraries built on it, and 318 in a regular-language library, with no human help, using Claude Opus 4.7.

## measured

- TASK: proof only. The agent gets a Coq lemma statement from the library (written by the library's developers) with the proof body removed and must produce a complete proof (HTML read).
  - SIZE: Iris core: 4,257 lemmas in 113 files (modules algebra, bi, base_logic, program_logic); 217 lemmas for Rust's standard libraries built on Iris; reglang 318 lemmas; iris-lean 72 not-yet-ported lemmas in the Lean 4 port. Lines per lemma not stated (as read).
  - SPECIFICATION AUTHOR: people (the library's developers); the paper does not address writing specifications (Section VII, as read).
  - WHAT SUCCESS MEANS and the cheat guard (as read): the prover kernel must close the proof; the harness bans `admit` and `Admitted`, applies a lemma-coverage check so that the target obligation cannot be silently dropped, and caps each tactic at 300 seconds so that tactics cannot diverge. In the paper's words: "the kernel rejects anything incorrect, so the confident-but-wrong output that makes LLMs risky elsewhere cannot slip through" (checked: two reads). The statements are fixed and the checker is the Coq kernel, so the guard covers wrong proofs, not wrong statements.
  - MODEL AND BUDGET (as read): Claude Opus 4.7 for the main results; total about 380 hours (15.8 days) of model time; mean 321.1 seconds per lemma, range 8.7 seconds to 4.7 hours; up to 30 attempts per lemma, mean 0.51 retries; "zero Coq expert intervention and zero failures"; needed a high-tier consumer subscription, "significantly reducing expenses compared to metered API pricing" (Section VII, as read).
  - NUMBERS (abstract and HTML read; the paper's own experiments): Iris core 4,257 of 4,257; Rust standard-library lemmas 217 of 217; reglang 318 of 318, where the abstract says prior provers "manage barely one in eight" (the HTML table as read said Rango 255 of 318, 80.2%, which does not match the abstract; not resolved); iris-lean 72 lemmas. Prior numbers quoted on other benchmarks (Table I as read): PALM on CoqGym 40.4%, COPRA on a CompCert subset 48.3%, Rango on CoqStoq 32.0%. Open-source models showed "a genuine capability gap on long proofs" beyond about 50 lines (Section VI-G, as read).
  - CONTAMINATION: "For each target lemma we remove its original proof body, leaving the lemma statement intact", with no network and no version control, so the agent cannot fetch the removed proofs (as read). No held-out lemmas or other contamination test (as read). Iris is a public GitHub project, so its proofs may be in the training data.

## quotes

- "A state-of-the-art model (Claude Opus 4.7) can write proofs for verified software development fully and automatically." (single read, abstract; the conclusion of the HTML says "We conclude that a state-of-the-art model—Claude Opus 4.7—is capable of writing proofs for state-of-the-art verified software development fully and automatically.", also single read)
  - "Trust is free: the kernel rejects anything incorrect, so the confident-but-wrong output that makes LLMs risky elsewhere cannot slip through" (checked: two reads of the HTML)
  - "For each target lemma we remove its original proof body, leaving the lemma statement intact" (checked: two reads of the HTML; the contamination protocol)

## does not cover

Proofs of statements that already exist in a public library, so training-data memory could explain part of the result; no held-out test. Specification writing is out of scope. Cost and time: about 15.8 days of model time and a consumer subscription. The table comparing with prior provers had an inconsistent row in my read.

## strength

one report or one team's experience (one team, one model, a very large run)

## how chosen

RECENT and SERIOUS (a very large, fully automatic run on real verified-software libraries; the figures supersede Rango's 32.0% of CoqStoq theorems)

## period

language-model

## group

G4 (also G2: Coq, Lean)     claims: C2     direction: supports C2 narrowly (proofs of given statements in a real verified library) with a contamination caveat

## Corrected after an independent check of the page against its sources, 2026-10-05

The notes above record that the lemma statements already exist in public libraries, that no held-out lemmas or other contamination test were used, and that Iris is a public GitHub project whose proofs may be in the training data. The abstract says "no Coq expert intervention", not that no human was involved.

The one-sentence summary under `says` above is replaced, in `source.md` and on the wiki page, by: A general coding agent wrapped in a verification harness re-proved every lemma it was given in the Iris separation-logic library (4,257 lemmas), 217 lemmas in Rust's standard libraries built on it, and 318 in a regular-language library, with no Coq expert intervention, using Claude Opus 4.7; the lemma statements come from public libraries and no held-out set was used.

