# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A cryptographic library written and verified in F* and compiled to C, whose code runs in Firefox, Linux and several other systems, built at a cost of roughly one person-week per symmetric primitive and several person-months for the bignum ones, according to a survey of it.

## measured

no new measurement from me. Project page (documentation, 2026-10-05): deployed in Firefox's NSS, the Linux kernel, mbedTLS, the Tezos blockchain, the ElectionGuard SDK and the Wireguard VPN, and "ongoing research projects" that "should be treated as such" (both sentences are in the quotes below). Figures as the Huang survey gives them (paraphrase of its section 7.8): 801 lines of pure F* specification, 22,926 lines of Low* (code and proof), 7,225 lines of C generated; verified in 9,127 seconds; "The proof-to-code ratio hovers around 2, and each primitive took around one person-week" for Chacha20 and SHA2; for bignum code the ratio is "up to 6" and Poly1305, X25519, Ed25519 "took several person-months"; its table gives effort under one person-year for the library. Trust base per the survey: "it relies on a large trusted computing base ... the F* type checker, the Z3 SMT solver, the KreMLin compiler, and the C compiler (when GCC is used instead of CompCert)"; side-channel guarantees cover "secret independence" but not power analysis.

## quotes

- "Code from HACL*, ValeCrypt and EverCrypt is deployed in several production systems, including Mozilla Firefox's NSS, the Linux kernel, mbedTLS, the Tezos blockchain, the ElectionGuard Electronic Voting SDK, and the Wireguard VPN." (project page) (checked, two separate fetches of the page gave these words)
  - "Still, HACL*, Vale, and EverCrypt remain ongoing research projects and should be treated as such." (project page) (checked, two separate fetches)

## does not cover

I could not read the CCS 2017 paper (the IACR address returned 403 and the HAL copy was behind an access wall), so the code sizes and effort figures are a survey's account of it, not checked against the paper. "Deployed" is the project's own statement; I did not check each project's own repository. Cryptographic primitives are small, closed, well-specified problems.

## strength

one report or one team's experience (deployment claim from the project; costs second-hand)

## how chosen

USE (named industrial adoption: Firefox's NSS, the Linux kernel, mbedTLS, the Tezos blockchain, the ElectionGuard SDK, the Wireguard VPN)

## period

older (2017 paper; deployments to the present)

## group

G2 (F*)     claims: C2     direction: supports (deployment) and mixed (cost, trust base)

