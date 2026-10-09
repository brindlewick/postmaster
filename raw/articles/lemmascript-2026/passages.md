# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A tech-preview toolchain verifies the pure, functional core of ordinary TypeScript carrying `//@ ` specification annotations by generating Dafny or Lean 4 code from it, and its own case studies verify parts of real packages in place.

## measured

no independent study. The project's own README and design note, read twice by two routes (the npm copy of the README and the repository's DESIGN.md), plus one read of the Lean Reservoir rendering of the README.
  - SUBSET (DESIGN, read twice, same words): "LemmaScript verifies a subset of TypeScript chosen for clean, well-defined semantics that align with both backends: the pure, functional core — variables, the primitive types, arrays, maps, sets, ordinary control flow, named and higher-order functions with lambda callbacks, discriminated-union records, ghost state, and ternaries."
  - EXCLUDED BY DESIGN (read twice): this and method dispatch; prototypes and classes with inheritance; closures over mutable state; any and unknown; implicit coercions; eval, with and dynamic property access. await and async are listed as not yet supported.
  - TRUST (read twice, same words, see the last quote): fidelity of the generated code is checked by inspection. A runtime guard at the boundary where unverified code meets a verified module (one read, summary). `number` is modelled as an integer by default, with the safe-integer question deferred (one read, summary).
  - CASE STUDIES (23 listed on the page as read): node-casbin, "5 functions verified, 217 existing tests pass" (read twice, same words); hono's security middleware, "Four CVEs covered" (read twice) and 51 Dafny lemmas (one read); a coding-agent command line whose "security- and protocol-critical core is verified", three modules and 48 Dafny verification conditions with 0 errors (one read); balanced-match, "the ~70-line balanced-bracket finder" (the description read twice) with 2233 verification conditions and 0 errors (the count read once); greenfield apps with their own counts of lemmas, for example 123 Dafny lemmas for a todo app's domain model (one read). Each case study states a trust boundary, for example "The *aggregate* is proven; the React UI, WebSocket/DO I/O, and timezone labeling are the stated trust boundary." (one read). No person-time, no effort figures, and no count of bugs found other than the CVE coverage line.

## quotes

- "A verification toolchain for TypeScript. Write ordinary TypeScript with `//@ ` specification annotations." (checked: two reads, README)
  - "This is a **Tech Preview**: the core idea is there, but support, semantics, and ergonomics are still evolving." (checked: two reads, README)
  - "the pure, functional core — variables, the primitive types, arrays, maps, sets, ordinary control flow, named and higher-order functions with lambda callbacks, discriminated-union records, ghost state, and ternaries." (checked: two reads, DESIGN)
  - "The TypeScript source *is* the production code." (checked: two reads, DESIGN)
  - "**The trust question.** Does the generated embedding faithfully model the TypeScript code? This is a one-directional question (TS → prover) validated by inspection of the code generator. The code generator is a straightforward syntactic translation — it does not optimize, reorder, or transform." (checked: two reads, DESIGN)

## does not cover

Every figure is the project's own, from a tech preview. "0 errors" means the verifier accepted the annotated code, not that the specifications are the right ones, and the specifications were written by the project's authors and their agents. No cost figures and no independent replication were found. The translation from TypeScript is trusted by inspection, not proved. async and await are unsupported, so the part of a program that does I/O is outside what it verifies, which is the stated trust boundary of each case study. Whether postmaster's own scripts fall inside the subset was not checked.

## strength

one report or one team's experience (the tool's own case studies)

## how chosen

USE (112 GitHub stars on 2026-10-05, 12 forks, MIT, created 2026-03-30, last push 2026-10-01) and RECENT (the only tool found that verifies TypeScript source) and CONTRADICTS (the statement that no tool verifies TypeScript)

## period

2022 or later; its case studies include coding-agent code

## group

G5 (also G2 and G4)     claims: C1, C2     direction: mixed (it supports C1 as a design choice and C2 as a report of use)

