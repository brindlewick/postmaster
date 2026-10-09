# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A survey of how large machine-checked proofs of programs are built, which says that scale has been reached only by small expert teams, that the cost literature finds proof effort tracking proof size, and that proof assistants and their extraction and linking steps are themselves part of what must be trusted.

## measured

no new measurement; a review of the proof-engineering literature (history, foundations, automation, organisation, evolution). The figures it carries are other people's: on CompCert, "The original development comprised of approximately 35,000 lines of Coq code; functionality accounted for only 13% of this, while specifications and proofs accounted for the other 87%" (p. 111) and "This is not unusual for large proof developments"; the seL4 proofs "took around 20 person years" (p. 103) and "consisted of 480,000 lines of specifications and proof scripts" (p. 103). Cost studies, section 7.3, p. 214 (about seL4 data): Staples et al. (2013) found the size of formal specifications significantly related to the size of the verified code; Staples et al. (2014) found "that effort is correlated linearly with proof size"; Matichuk et al. (2015a) found "a quadratic relationship between the size of a formal property and the proof script required to prove it" (I read the third of these studies myself: see matichuk-2015; the first two are the survey's account). Section 3.3 (p. 125) on practical use: "proof assistants have had the strongest practical impact in systems software"; CompCert is "sold as a commercial product" and used in aviation; BoringSSL in Chrome "recently started to include high-performance cryptographic code in C verified in Coq"; seL4 "is used in SCADA systems, and aviation and automotive systems". Proof-assistant trust, section 8 (p. 221): 23 fixed critical bugs documented in the history of stable Coq releases, of which "only 1 (fixed in 2015) was assessed as likely to be exploited by chance, but the risk of others was not determined".

## quotes

- "Omissions in and misunderstandings of specifications may lead to lowered expectations and negative perceptions of formally verified software." (p. 220) (checked, page image and text layer agree)
  - "An overwhelming majority of large successful software verification projects using proof assistants are carried out and maintained by small teams of highly specialized and trained researchers" (p. 220) (checked, page image and text layer agree)
  - "Proof engineering is particularly far behind software engineering with respect to maintenance" (p. 219) (checked, page image and text layer agree)

## does not cover

it is a survey of tools and techniques, not of how hard specifications are to write; its conclusions on specifications are two sentences (the one quoted above). It reports no failure rate and no study of people writing specifications. Its cost figures are all from seL4 and CompCert, which are research projects by the groups that built the tools. Published 2020: nothing about language models.

## strength

argued but not measured (a literature review; the primary studies it cites are not all controlled)

## how chosen

SERIOUS (the standard survey of proof engineering, named in the brief)

## period

older (2020)

## group

G2     claims: C2, C3     direction: mixed (survey; supports "proofs work at scale", records the costs and the trust gaps)

## Corrected after an independent check of the page against its sources, 2026-10-05

The survey says (page 220): "An overwhelming majority of large successful software verification projects using proof assistants are carried out and maintained by small teams of highly specialized and trained researchers". That is a majority, not all.

The one-sentence summary under `says` above is replaced, in `source.md` and on the wiki page, by: A survey of how large machine-checked proofs of programs are built, which says that large projects have mostly been carried out by small expert teams, that the cost literature finds proof effort tracking proof size, and that proof assistants and their extraction and linking steps are themselves part of what must be trusted.

