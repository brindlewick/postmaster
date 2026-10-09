# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Of 62 industrial projects that used formal methods, projects that reported cost effects were five times as likely to report a reduction as an increase, and 92% reported better quality, but only half reported cost at all and the authors say the review is not a basis for general inference.

## measured

a structured questionnaire on 62 industrial projects "known from the literature, mailing lists, and personal experience", 56 answered by people involved; the authors warn the collection "may be biased to those with whom we had the strongest contacts". Sizes: half of respondents estimated size, split roughly evenly among 1-10, 10-100 and 100-1000 KLOC; 37 projects from 2000-2008; the largest domains were transport (16) and finance (12); 85% of staff had prior formal-methods experience; model checking use rose from 13% in the 1990s to 51% in the 2000s, with no significant change in proof, refinement, execution or test-case generation. Results (page 3, section 2): "three times as many reported a reduction in time as reported an increase"; "Several projects noted increased time in the specification phase"; "Of those reporting on costs, five times as many projects reported reductions as reported an increase. 92% of projects reported enhanced quality compared to other techniques; none reported a decrease." The improvement was attributed to better fault detection (36%), improved design (12%), confidence in correctness (10%) and understanding (10%). Section 3 (page 4): "Only half the projects that we reviewed reported the cost consequences of using formal methods"; "the entry cost for formal methods is perceived as high, although the cost can drop dramatically on second use"; and, from respondents, "many developers are 'builders' who do not want to specify everything" and "skills deficiencies as a major impediment".

## quotes

- "Of those reporting on costs, five times as many projects reported reductions as reported an increase." (page 3) (checked, page image and text layer agree)
  - "It should be stressed that the review is not a statistical survey and so does not form a basis for general inferences about formal methods applications." (page 3) (checked, page image and text layer agree)
  - "Only half the projects that we reviewed reported the cost consequences of using formal methods." (page 4) (single read, text layer)

## does not cover

self-selected, self-reported projects, mostly from the authors' own network; formal methods here includes lightweight and model-checking uses, so it is not a measure of the cost of proofs of code; "reduction" has no stated size; the projects that reported cost are half the sample. Set beside seL4 (sel4-2014) the range is wide; my reading, not the authors', is that the reported savings come from lighter uses and the large costs from proving a whole implementation. I read only the four-page summary, not the 36-page survey.

## strength

one report or one team's experience (a self-reported review, with its own caveat)

## how chosen

CONTRADICTS (the best-known review in which projects reported that formal methods lowered cost and raised quality)

## period

older (2009; the projects run from the 1980s to 2008)

## group

G2-adjacent (formal methods broadly: model checking, proof, refinement, test generation)     claims: C2 (cost), C3 (skills, "builders")     direction: supports "formal methods paid for themselves" in the reports reviewed, with the authors' own warning

