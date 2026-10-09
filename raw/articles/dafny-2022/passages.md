# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

The tool's own page calls Dafny "a verification-aware programming language"; the AWS team says that several high-assurance AWS projects are written in it and that "verification instability", small changes breaking proofs that held before, is the biggest threat to its adoption.

## measured

a talk abstract by an engineer on the AWS Dafny core team: no data in the abstract. Project page, first sentence: "Dafny is a verification-aware programming language that has native support for recording specifications and is equipped with a static program verifier." Abstract: "multiple recent projects within Amazon Web Services (AWS) with high assurance requirements have been written in Dafny"; "the biggest threat to Dafny adoption by far is 'verification instability.'"; "Verification instability can turn a small bug fix task into a week-long ordeal"; and "the cost of verification correlates strongly with future verification instability", a claim stated to be based on "empirical data from multiple Dafny projects" that the abstract does not give. Other named use in this note: IronFleet (ironfleet-2015, Dafny, 3.7 person-years), Ironclad Apps (huang-2026, 85 KLoC, 3 person-years). AWS Cedar (reported in a search summary to use Dafny, which I did not check) is covered by another helper. The abstract's measured counterpart is Mariposa (mariposa-2023).

## quotes

- "multiple recent projects within Amazon Web Services (AWS) with high assurance requirements have been written in Dafny" (HCSS '22 abstract) (checked, two separate fetches from two sites)
  - "the biggest threat to Dafny adoption by far is 'verification instability.'" (HCSS '22 abstract) (checked, two separate fetches from two sites)
  - "Verification instability can turn a small bug fix task into a week-long ordeal" (HCSS '22 abstract) (checked, two separate fetches from two sites)

## does not cover

an abstract, not the talk or a paper; the instability claim is the team's observation, not a published measurement; no count of AWS projects, no code size, no effort. I could not check the AWS usage against an AWS or Amazon Science page, only against the talk abstract. The Dafny GitHub page and project page name no company. I found no published user study of Dafny (see GAPS).

## strength

one report or one team's experience

## how chosen

USE (named industrial adoption at AWS, by the AWS Dafny team's own account) and CONTRADICTS (the team names the main obstacle to adoption)

## period

older (2022 talk; Dafny itself dates from 2008 to 2010)

## group

G2, background     claims: C2 (use, cost, trust)     direction: mixed

