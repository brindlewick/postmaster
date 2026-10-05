# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A Coq-checked generator for cryptographic arithmetic replaced hand-written code in BoringSSL, so that the code behind most browser TLS handshakes in 2018 was machine-proved, with the proof covering one algorithm for many parameter sets.

## measured

one library by its authors; deployment is the authors' own report. Abstract: "Implementations from our library were included in BoringSSL to replace existing specialized code, for inclusion in several large deployments for Chrome, Android, and CloudFlare." Introduction (section I): "so today about half of HTTPS connections opened by Web browsers worldwide use our fast verified code (Chrome versions since 65 have about 60% market share [7], and 90% of connections use X25519 or P-256 [8])"; section V: "The two curves thus generated with our framework for BoringSSL together account for over 99% of ECDH connections. Chrome version 65 is the first release to use our P-256 code." Performance, from the abstract: the library "achieves competitive performance for 80 prime fields and multiple CPU architectures" (tables I and II hold the comparisons with GMP code; I did not summarise them). Effort: no person-years or proof-to-code ratio is given in the sections I read; the design claim is that "implementation and proof effort scales with the number and complexity of conceptually different algorithms, not their use cases" (abstract), because one proof of the algorithm covers every prime. Trusted base, section I and VI: "All formal reasoning is done in the Coq proof assistant, and the overall trusted computing base also includes a simple pretty-printer and the C language toolchain"; "We trust only the standard Coq theorem prover ... and the (rather short, whiteboard-level) statements of the formal claims that we make (plus, for now, the C compiler)". Appendix A (own survey of bugs in hand-written crypto code): they "surveyed project bug trackers and other Internet sources, stopping after finding 26 bugs" in non-trivial cryptography-specific optimisations, in five categories, e.g. one of 16,184 repetitive handwritten lines in an Ed25519 implementation should have been `r2 += 0 + carry` instead of `r1 += 0 + carry`.

## quotes

- "Implementations from our library were included in BoringSSL to replace existing specialized code, for inclusion in several large deployments for Chrome, Android, and CloudFlare." (abstract) (checked, page image and text layer agree)
  - "We trust only the standard Coq theorem prover" (section VI) (single read)

## does not cover

a narrow, well-specified domain (modular arithmetic on fixed-size integers) where a specification is a short mathematical statement; this is the best case for proofs and says little about code with open-ended requirements. Authors report their own deployment figures; "half of HTTPS connections" is an estimate built from browser market share and a developer's private communication, not a measurement. The proofs stop at C: a C compiler bug would be outside them. No effort figure for the proofs was found in the text read. The bug survey (26 bugs) is the authors' sample, not a rate.

## strength

one report or one team's experience (with real deployment)

## how chosen

USE (named industrial adoption: Google's BoringSSL, hence Chrome and Android; the authors' figure is about half of HTTPS connections from browsers)

## period

older (2019)

## group

G2 (Coq)     claims: C2, C3     direction: supports (for C2; for the narrow case of finite-field arithmetic) with a stated trust base

