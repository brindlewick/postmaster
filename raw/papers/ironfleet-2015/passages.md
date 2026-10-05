# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Two verified distributed systems (a Paxos-based replicated state machine library and a sharded key-value store), written in Dafny, cost about 3.7 person-years including inventing the method and carry about 3.6 lines of proof annotation per line of executable code.

## measured

two systems built and proved by the authors; performance against an unverified C# or Go baseline and against Redis. Figure 12 (PDF p. 12), source lines: high-level specifications 85 (IronRSL) and 34 (IronKV) plus 208 of temporal-logic library; implementation 5,114 lines in all (IronRSL 2,941, IronKV 1,340, common libraries 833); proof annotation 39,253 lines in all; spec lines in all 1,400; "Time to Verify" total 395 minutes. Text, p. 12: "At the implementation layer, our ratio of proof annotation to executable code is 3.6 to 1." (the same figures give about 7.7 lines of proof per line of implementation if the protocol and liveness layers are counted too; my division of 39,253 by 5,114.) "In total, developing the IronFleet methodology and applying it to build and verify two real systems required approximately 3.7 person-years." Verification time: a serial integration build "requires approximately six hours", in practice 6-8 minutes with cloud parallelism. Result: "both IronRSL ... as well as IronKV worked the first time we ran them" (except unverified parts such as the C# client). Performance: IronRSL peak throughput "within 2.4x of the baseline"; IronKV "competitive with that of Redis". Section 8: "§7.1 shows that in exchange for strong guarantees (which depend on several assumptions, per §2.5), IronFleet requires considerably more developer effort", "there is a distinct learning curve", "given a fixed time budget, IronFleet will likely produce fewer optimizations". Section 6.3.2 describes prover timeouts managed by hand with `opaque`, `reveal` and `fuel` attributes and manual triggers. Assumptions, section 2.5: "the spec for each system is trusted, as is the brief main-event loop"; the network may drop, delay or duplicate packets but is assumed not to tamper; the correctness of Dafny, the .NET compiler and runtime, Windows and the hardware is assumed.

## quotes

- "In total, developing the IronFleet methodology and applying it to build and verify two real systems required approximately 3.7 person-years." (PDF p. 12) (checked, page image read twice and the text layer agrees)
  - "At the implementation layer, our ratio of proof annotation to executable code is 3.6 to 1." (PDF p. 12) (checked, page image read twice and the text layer agrees)
  - "IronFleet requires considerably more developer effort." (PDF p. 13, section 8, in the sentence quoted above) (checked, page image read twice and the text layer agrees)

## does not cover

the 3.7 person-years includes research on the method, so it overstates the cost of the next project; no count of the person-years of proof alone. Two systems by their designers in a verification-friendly language, newly written, not existing code. Independent testing later found 16 bugs across IronFleet, Verdi and Chapar, none in the protocol (see fonseca-2017), including a specification gap in IronFleet itself: it left exactly-once semantics unspecified.

## strength

one report or one team's experience

## how chosen

SERIOUS (first full proofs of safety and liveness of real distributed systems; states the effort plainly) and the brief named it

## period

older (2015)

## group

G2 (Dafny)     claims: C2, C3     direction: mixed

## Corrected after an independent check of the page against its sources, 2026-10-05

The paper (SOSP 2015, page 12) says: "At the implementation layer, our ratio of proof annotation to executable code is 3.6 to 1." Figure 12 totals 39,253 lines of proof annotation against 5,114 lines of implementation, about 7.7 to 1 in all (my arithmetic from those totals).

The one-sentence summary under `says` above is replaced, in `source.md` and on the wiki page, by: Two verified distributed systems (a Paxos-based replicated state machine library and a sharded key-value store), written in Dafny, cost about 3.7 person-years including inventing the method and carry about 3.6 lines of proof annotation per line of executable code at the implementation layer, and about 7.7 to 1 in total by Figure 12's counts.

