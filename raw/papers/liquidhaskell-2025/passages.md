# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Interviewing and observing 19 developers using LiquidHaskell found nine usability barriers; among them developers struggled to say what to prove, wrote post-conditions weaker than they should be, and could not tell from a passing check whether the specification was too weak.

## measured

a qualitative study, 19 participants from academia and industry: 12 new users (a condensed two-hour tutorial, with interviewer present) and 7 experienced users (interviews, observation, retrospectives, think-aloud); six of the seven experienced users' projects were academic, one personal or industrial (section 4.1). Nine barriers (sections 4.2 to 4.10): unclear divide between Haskell and LiquidHaskell; confusing verification features; unfamiliarity with proof engineering; limits of automation and manual proof; scalability and solver limits; unhelpful error messages; limited IDE support; insufficient learning resources; complex installation. The authors warn that counts per barrier "should not be interpreted as measuring the significance or prevalence of each problem". Findings that bear on C3 (section 4.4): "pilot participants struggled to identify the proper invariants, with this single exercise consuming over 30 minutes of session time" (they removed the exercise and gave the invariants); three new users "consistently wrote post-conditions that were weaker than optimal, only realizing this when reviewing the exercise solutions" (for example "less than the original size" where "exactly one less" was right); one new user said that a passing check "did not necessarily mean that everything was correct because the specification might be too permissive"; an experienced user said the process makes it difficult to estimate the effort needed to verify a part of the code. Scalability (4.6): six of seven experienced users reported solver or compile-time limits; one reported a full verification taking "5h or so, maybe longer".

## quotes

- "pilot participants struggled to identify the proper invariants, with this single exercise consuming over 30 minutes of session time" (section 4.4.1, printed page 224:13) (checked, page image and text layer agree)
  - "consistently wrote post-conditions that were weaker than optimal, only realizing this when reviewing the exercise solutions" (section 4.4.2, printed page 224:13) (checked, page image and text layer agree)
  - "our findings may not generalize to a broader population of potential LiquidHaskell users" (section 4.11) (single read, text layer)

## does not cover

a small qualitative sample of mostly academic users and a tutorial condition run by the interviewers, using an older release of the tool; not a comparison with other verifiers (the authors say most findings "apply broadly to formal methods techniques" but did not test that). Not a study of language models. The authors cite another study (Goldstein and others, on property-based testing, which another helper covers) finding that developers "do not go out of their way to write specifications".

## strength

one report or one team's experience (a qualitative exploratory study of 19 participants, with the authors' own threats-to-validity section; not a controlled experiment)

## how chosen

SERIOUS (the one rigorous study of how developers use a refinement-type verifier; the brief named it) and USE for the tool (1.3k stars; the founding paper, Vazou and others, ICFP 2014, I did not read)

## period

older (not language-model work; published 2025)

## group

G2, background (Liquid Haskell, the usability caveat; also bears on C3)     claims: C3     direction: supports C3 (specifications are hard for people)

