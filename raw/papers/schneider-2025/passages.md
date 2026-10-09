# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

An independent study found that some compilers turn the constant-time code in HACL*'s P-256 implementation into secret-dependent branches or memory accesses on some processors, so the source-level guarantee did not survive compilation.

## measured

a trace-based dynamic analysis tool run on 8 cryptographic libraries (the formally verified HACL* and seven hand-written ones: Libsodium, Botan, BearSSL, BoringSSL, OpenSSL, WolfSSL, MbedTLS), 9 GCC versions and 14 LLVM versions, 6 architectures and 7 optimisation levels: 44,604 experiments (paraphrase of the fetch summary: 6,608 binaries compiled, 5,716 compiled successfully). Result sentence (single read): "In the 5,716 binaries, we found at least one secret-dependent control-flow operation in 429 (7.5%) and at least one secret-dependent memory access in 368 (6.4%)." HACL* finding: "we found a code pattern in the secp256 implementation of HACL* that is optimized by some compilers. The resulting binary then contains secret-dependent operations, potentially leading to a side-channel vulnerability." (single read); the function `cmovznz4`, a conditional move done with bitmask arithmetic, is rewritten by LLVM 13 to 15 through its InstCombine pass into a `select`, giving "secret-dependent branches (on RISC-V) and secret-dependent memory operations on MIPS, x86-i386, and armv7" (the fetch summary adds that it was reported to the maintainers and the fix was under development; I did not check this against the project). The paper's own words on the verified library: "Notable findings include issues in libraries that were formally verified to be free of such side channels" (single read). The proof boundary matters here: the HACL* guarantee is about the F* and generated C source (see `hacl-2017`, `huang-2026` section 7.8.10: "the C compiler (when GCC is used instead of CompCert)" is trusted).

## quotes

- "LLVM versions 13, 14, and 15 compile the snippet to secret-dependent branches (on RISC-V) and secret-dependent memory operations on MIPS, x86-i386, and armv7." (checked, two separate fetches of the HTML)
  - "However, such techniques are only meaningful if they persist across compilation." (abstract) (checked, the abstract page and the HTML agree)

## does not cover

a side-channel property (timing), not functional correctness, which is the property HACL* proves most of; the HACL* finding is for LLVM 13 to 15 and mostly on less common architectures (RISC-V, MIPS, 32-bit x86, armv7 at the small-size levels), so the effect on the browser deployments in `fiatcrypto-2019` is not shown; the hand-written libraries were affected too (5 of 8 libraries in the summary), so the verified library was not worse than the others. It shows where a proof stops, not that proofs fail. I did not read the PDF, only the HTML and abstract.

## strength

one report or one team's experience (a large, systematic, independent tool-based study; the verified-library finding is one primitive)

---

## how chosen

CONTRADICTS (an independent test in which a formally verified cryptographic library is among those whose binaries leak)

## period

older (non-language-model, 2024 to 2025)

## group

G2 (F* and HACL*; compiler trust base)     claims: C2     direction: contradicts (in part)

