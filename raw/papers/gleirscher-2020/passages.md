# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

In a survey of 216 people who use or study formal methods in mission-critical software, usefulness is rated well, ease of use poorly, and scalability, skills and education are the main challenges.

## measured

an online cross-sectional survey, N = 216 responses from industry and academia (mission-critical domains: transportation, military, industrial machinery and others); the authors estimate the reachable population from channel sizes and give an estimated response rate that I did not record. Results (abstract; see the quotes below): increased intent to apply formal methods in industry, a positively perceived usefulness, a negatively perceived ease of use, and scalability, skills and education among the key challenges. General ranking, question Q13 (single read, text layer): "Most of them believe that scalability will be the toughest challenge and maintainability is considered the least difficult of all rated obstacles."; among respondents with increased intent, scalability and skills and education draw the most "tough" ratings for assurance (67%) and inspection (66%). The survey does not single out writing specifications as a category, so for C3 it speaks to skills and ease of use, not to specification as such. The authors say their findings are "strongly coherent with earlier observations by Austin and Parkin (1993)".

## quotes

- "Our results indicate an increased intent to apply FMs in industry, suggesting a positively perceived usefulness. But the results also indicate a negatively perceived ease of use." (abstract) (checked, the arXiv abstract page and the PDF text layer agree)
  - "Scalability, skills, and education seem to be among the key challenges to support this intent." (abstract) (checked, the arXiv abstract page and the PDF text layer agree)

## does not cover

self-selected respondents recruited through expert channels (the authors say so: few respondents with no experience); formal methods broadly, including model checking and process algebra, not machine-checked proofs of code; opinions, not measured effort. Nothing on language models. No TypeScript or web respondents were singled out.

## strength

one report or one team's experience (a survey, N = 216, with the authors' threats-to-validity section)

## how chosen

SERIOUS (the largest survey of its kind by its authors' account; asks practitioners what is hard)

## period

older (survey run in 2018)

## group

G2-adjacent (formal methods generally, not one tool)     claims: C3 (skills and ease of use), C2 (adoption)     direction: mixed

