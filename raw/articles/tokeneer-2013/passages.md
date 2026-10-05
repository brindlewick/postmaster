# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A verified, 10,000-line security system was built in 260 person-days under a fixed price and the NSA's testers found no faults at the time, yet five defects were counted by 2013 and later work reports further problems that the proofs had not caught.

## measured

one project, by the firm that developed SPARK, to show cost-effectiveness to the NSA. The slides give "Lines of code: 9939", "Total effort (days): 260", "Productivity (lines of code / day): 38", "Process assessment: EAL5+", "Defects found to date: 5" (slide 9). Jones and Thomas (section 4): the NSA "were unable to find any faults in the software" and said the Praxis team's productivity "was the highest they had ever experienced", but this did not lead to further sales or projects; the artefacts were then released so people could "see whether other tools might reveal defects that had not been found". Cristia and Rossi (related work, section 7): Moy and Wallenburg "find problems in Tokeneer, although it was formally verified", aim to find out why these were not found when the system was verified, and "propose to complement formal verification with static analysis and code reviews". A mailing-list message (Derek Jones, 25 Oct 2017, informal, one read) quotes that work as having "found new 20 problems, of which half could lead to system failure": I could not check this against the paper. A 2018 AdaCore post (Yannick Moy, 23 Feb 2018, read) says that after porting to SPARK 2014 "we went from 234 unproved checks on Tokeneer code ... down to 39 unproved but justified checks" and that all four vulnerabilities they seeded were caught: that is a different, positive point about the later tool, not about the original defects. On specification skill, Jones and Thomas (section 4, about Praxis's courses): four-day courses were "enough for computer science graduates to be able to read and start understanding a formal specification, though the ability to write good Z developed over a period of working on a project with access to experienced Z practitioners."

## quotes

- "Lines of code : 9939 / Total effort (days) : 260 / Productivity (lines of code / day) : 38 / Process assessment : EAL5+ / Defects found to date : 5" (slide 9, text layer; set out on separate lines in the slide) (single read)
  - "the ability to write good Z developed over a period of working on a project with access to experienced Z practitioners" (Jones and Thomas, section 4) (single read, text layer)
  - "There are numerous stories of formal machine-checked proofs that do not actually capture what the user intended to establish." (Jones and Thomas, section 5.2, an opinion of the authors; no source given for the stories) (single read, text layer)

## does not cover

the cost is for a demonstrator built by the tool's own makers (so it is the best case, not an average), and SPARK proofs were mostly of absence of run-time errors plus functional post-conditions on one cyclic-scheduler program. The later defects are known to me only through secondary accounts, with no count or type verified from the primary paper; the five defects on the 2013 slide are not described there. The mailing-list figure (20 problems) is an informal quote of unknown reliability. It is evidence that "verified" in 2003 did not mean "no defects", but not of how many were specification gaps against missed properties.

## strength

one report or one team's experience (cost); not found as a controlled study (the later problems)

## how chosen

CONTRADICTS the claim that proofs cost too much (low cost reported) and CONTRADICTS the claim that proofs make code trustworthy (later problems); named in the search for "reports that verification was cheap"

## period

older (project 2003; reports 2006 to 2021)

## group

G2-adjacent (SPARK and Z, not in the brief's list, but the best-known industrial proof-and-specification project)     claims: C2, C3     direction: mixed (the clearest report that the cost was low, and the clearest that "verified" software still had defects)

## Corrected after an independent check of the page against its sources, 2026-10-05

The sentence above includes "under a fixed price". Neither these notes nor the cited slides give it: slide 9 of the deck reads "Lines of code : 9939", "Total effort (days) : 260" and "Defects found to date : 5". The phrase is removed.

The one-sentence summary under `says` above is replaced, in `source.md` and on the wiki page, by: A verified, 10,000-line security system was built in 260 person-days and the NSA's testers found no faults at the time, yet five defects were counted by 2013 and later work reports further problems that the proofs had not caught.

