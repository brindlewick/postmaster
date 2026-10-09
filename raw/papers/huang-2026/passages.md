# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Across 32 deployed verified systems the authors find cost to be the main obstacle, find that every team relied on something unverified or on a specification that could be wrong, and also collect several reports that verification lowered total cost.

## measured

a literature and questionnaire survey, "not a full Systematic Literature Review" (section 8.1): a questionnaire from December 2020 (20 responses, 10 relevant) plus literature search, 65 candidate systems found December 2020 to October 2021, 32 described. Systems must be both formally verified and deployed (public or in documented production use). Table 2 (p. 1:5) gives for each system the verified properties, size (KLoC), "Spec/Imp" (specification and proof against implementation) and effort in person-years, with blanks where unknown. Selected rows: CompCert 135 KLoC, ratio 1, 6 py; seL4 over 10 KLoC, ratio 100, 31.2 py (my check: the Fig. 19 rows of sel4-2014 add up to 31.2; 20.5 py of it the functional-correctness proof; section 7.10.9; the survey's ratio of 100 is higher than the roughly 20 to 1 of proof to code, or 48 to 1 counting specifications, that the TOCS figures give, so treat the ratio column as rough); HACL* 31 KLoC, ratio 3.3, under 1 py; Amazon s2n 0.7 KLoC, 0.86, over 3 py; Hyper-V 105 KLoC, ratio 5, 1.5 py; Ironclad Apps 85 KLoC, 0.5, 3 py; SHOLIS 27 KLoC, 3.07, 19 py; NATS iFACTS 250 KLoC (SPARK, absence of run-time exceptions), over 50 py, over 140 engineers over 10 years (7.22.8); Sizewell B 150 KLoC, 250 py. HACL* detail from section 7.8.8-7.8.9 (the survey's account of the HACL* paper, which I did not read): 801 lines of pure F* specification, 22,926 lines of Low* (code and proofs), 7,225 lines of generated C, verified in 9,127 seconds; "The proof-to-code ratio hovers around 2, and each primitive took around one person-week" for Chacha20 and SHA2; for bignum code "up to 6" and "several person-months" each for Poly1305, X25519 and Ed25519. Cost reports in favour (section 8.3, 7.21.8-9): four teams (Lockheed C130J, NATS iFACTS, EuroFighter Typhoon, Dutch Tunnel Control) "reported measurable reduction of costs"; on the C130J (SPARK, run-time-exception proofs) the code showed "less than one tenth of the expected industry norm" fault density in test and "an 80% saving in the expected budget allocated to MC/DC testing". Against (section 8.3-8.4): "22 of them had to depend on an unverified code elements"; "Bugs in the formal specifications themselves. Manual inspection revealed 3 such bugs in Ironclad Apps specification."; seven projects "state that their verification technology would be difficult for an average developer to practice"; Roissy Shuttle "were not 100% sure that the formal specification correctly formalized the actual needs and ... did find incorrect elements"; Ironclad found a bug in the verification tools; "Members from 14 projects reported performance issues". Re-verification: "re-verification costs much less than the original verification" (seL4 "less than 10% of the initial effort" for a new large feature, as the survey puts it; the TOCS paper I read gives 17% and 32% for two changes, which is a different measure, see sel4-2014).

## quotes

- "Any verification success is relative: we verify a certain program element against a certain specification under certain hypotheses. The specification may be wrong (in the sense of not correctly expressing the desired behavior) or incomplete." (section 4.4) (checked, HTML summary and PDF text layer agree)
  - "The key obstacle is the high entry level: each project needs one or more verification experts." (section 8.4) (single read, PDF text layer)
  - "Generalizing verification faces obstacles, of which the main one, per the results of the present study, remains cost" (section 9) (single read, PDF text layer)

## does not cover

a selection bias the authors name: "the papers themselves ... usually report successful verification efforts" (8.1); update and maintenance cost is largely missing (8.1); ratios are the survey's own column, defined across different kinds of proof (SPARK run-time proofs and full functional proofs are in one table); many entries rest on the teams' own papers or interviews, not independent measurement; no entry is a TypeScript or web project, and all systems are system software or safety-critical code (8.4). The cost-reduction claims (C130J, iFACTS) are for automated proofs of absence of run-time errors in SPARK, not for proofs of full functional correctness.

## strength

one report or one team's experience (a survey of many such reports; selection-biased towards successes by the authors' own account)

## how chosen

SERIOUS (the most comprehensive survey of deployed, formally verified systems; reports effort, ratios, limits and the teams' own lessons) and it holds the contradicting reports on cost

## period

older (the surveyed systems are 1989 to 2021; the revision is 2026, no language-model work)

## group

G2     claims: C2, C3     direction: mixed

