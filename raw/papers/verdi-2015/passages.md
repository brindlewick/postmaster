# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A Coq framework with a verified Raft implementation: about 4,100 lines of proof for 520 lines of implementation and 170 of specification, which exposed a serious data-loss bug in the authors' own Raft code that testing was unlikely to find.

## measured

case studies by the authors (a sequence-numbering transformer, a key-value store, a primary-backup transformer, Raft). Table 2 (PDF p. 366), lines of code including blank lines and comments: sequence numbering spec 20, impl 89, proof 576; key-value store 41 / 138 / 337; primary-backup 20 / 134 / 1,155; KV plus primary-backup 5 / not applicable / 19 (a property proved on top of reusable transformers); Raft linearizability 170 / 520 / 4,144; Verdi (shim and shared lemmas) 148 / 220 / 2,364. Performance: the verified key-value store on Raft reached 34.3 requests per second against 38.9 for etcd, latency 232 ms against 205 ms (get) and 198 ms (put) (Table 3). Experience, section 8.2: "several serious errors in our system implementations", the most subtle in their Raft code: "servers could delete committed entries when a complex sequence of failures occurred" (the sentence after it is the quote below) Scope in this paper: safety only; "We verified linearizability ... as a consequence of Raft's state machine safety property" and, on page 365, the proof of state machine safety "is still in progress as of this writing" (the later paper, not read, reports it finished: see GAPS).

## quotes

- "Such a sequence is unlikely to arise in regular testing, but proving Raft in Verdi forced us to reason about all possible executions." (PDF p. 366, section 8.2) (checked, page image read twice and the text layer agrees)

## does not cover

this paper gives lines of proof, not person-months; the effort figure for the full Raft proof is in the 2016 follow-up (not read). The Verdi shim and network semantics are assumed correct (fonseca-2017 found 11 shim-layer bugs in the three systems it studied). Research prototype, by its authors.

## strength

one report or one team's experience

## how chosen

SERIOUS (the other verified distributed system studied by fonseca-2017; the brief named it)

## period

older (2015)

## group

G2 (Coq)     claims: C2, C3     direction: mixed

