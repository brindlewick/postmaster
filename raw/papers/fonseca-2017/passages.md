# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Searching three machine-checked distributed systems for more than eight months found 16 bugs, none in the verified protocol logic, all in the specification, the unverified shim layer or the verification tools, and the authors trace them to assumptions the proofs relied on.

## measured

three systems (Fig. 2): IronFleet (Multi-Paxos, linearizability, 34K lines of Dafny/C#), Verdi (Raft, linearizability, 54K lines of Coq/OCaml), Chapar (causal consistency, 20K lines of Coq/OCaml). Method (section 3): reading the code, specification and documentation to find the assumptions, then testing with a network and file-system fuzzer and hand-written test cases, and cross-checking each bug against the other systems; they built a toolkit, PK, and reported the bugs to the developers, "nearly all of them" already fixed or confirmed. Result (Fig. 3, PDF p. 3): 16 bugs: 11 in the shim layer (the unverified code between the verified system and the operating system; 9 of the 11 crash or hang servers, Finding 1), 2 in specifications (I1 in IronFleet, C4 in a Chapar test case), 3 in verification tools (I2, I3, I4). The abstract: "These bugs were caused by violations of a wide-range of assumptions on which the verified components relied. Our results revealed that these assumptions referred to a small fraction of the trusted computing base, mostly at the interface of verified and unverified components." PK "is able to automate the detection of 13 (out of 16) bugs". Specification bug I1 (PDF p. 9): IronFleet's specification "did not specify that the implementation had exactly-once semantics even though it did implement this functionality"; the authors patched out the de-duplication by changing "only seven lines of the implementation" and "the patched implementation still verified". NUANCE the paper gives: the developers replied that "their understanding of linearizability does not include exactly-once semantics", that they "had been aware of the absence of exactly-once semantics in the specification", and added a comment saying so; the authors call it a bug "because generally applications expect replicated state machine libraries to provide exactly-once semantics". Bug C4: a Chapar client assertion that "always evaluated to true" (it tested `post` where it should test `photo`). Tool bug I2 (PDF p. 10): a build tool bug made the verifier "falsely report that any program passed verification checks, including programs that asserted false". Finding 5: "No protocol bugs were found in the verified systems." The authors explain why: a verified component can fail only if there is both an implementation bug and a matching verification bug that hides it.

## quotes

- "Through code review and testing, we found a total of 16 bugs, many of which produce serious consequences, including crashing servers, returning incorrect results to clients, and invalidating verification guarantees." (abstract) (checked, page image and text layer agree)
  - "Even if verification tools are correct, specifications must be correct for verification to deliver its promise." (PDF p. 9, Finding 6) (checked, page image and text layer agree)
  - "None of the bugs we found were due to mistakes in the implementation of distributed protocols (e.g., Paxos, Raft), which are well known to be complex and difficult to implement correctly." (PDF p. 8, Finding 5) (checked, page image and text layer agree)

## does not cover

three research prototypes and 16 bugs ("small values necessarily require care in generalizing results", section 3.4); the authors say their focus on code and specification means "it is possible that our results could under-represent bugs in other parts of the TCB". It does not test the strength of the proofs. The verified protocol part holding up is also a result: it supports the claim that proofs prevent protocol bugs, and it says the defects sit at the edges (shim, specification, tools), which is a statement about what the proof boundary leaves out, not about the proofs. One of the two specification bugs is disputed by the system's own developers.

## strength

one report (a systematic bug hunt by an independent team; small sample; bugs confirmed or fixed by developers for nearly all)

## how chosen

SERIOUS (independent study of three verified systems by people outside the teams) and CONTRADICTS (against "proved means trustworthy")

## period

older (2017)

## group

G2 (Dafny, Coq)     claims: C2, C3     direction: mixed (it is the main source that a verified system still failed, and where)

## Corrected after an independent check of the page against its sources, 2026-10-05

The `how chosen` and `strength` lines above call this an independent study "by people outside the teams". The paper does not say that. Its authors are Pedro Fonseca, Kaiyuan Zhang, Xi Wang and Arvind Krishnamurthy (University of Washington); the Verdi paper, one of the three systems studied, lists Xi Wang among its authors. The paper says only that its authors "searched for protocol bugs and spent more than eight months in this process". Of the 2 bugs in the specification, the developers disputed one: they stated that their understanding of linearizability does not include exactly-once semantics, and the authors "consider this a bug because generally applications expect" it (bug I1). The wiki page says "a group that included a co-author of one of them (Verdi)" and "the developers disputed one".

