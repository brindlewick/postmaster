# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

On 36 hard sentences chosen by five temporal-logic experts, Codex translated 44.4% correctly at first, 58.3% with examples drawn from the same data, and 86.1% when a person could correct sub-translations for up to three rounds.

## measured

TASK: one English sentence, five atomic propositions, to an LTL formula, with the model also mapping each sub-formula back to the part of the sentence it covers so that a person can fix it. JUDGED BY: a person: "correct" only if the result matches the intended meaning of the expert who wrote the sentence; one reference formula per instance; no equivalence check mentioned. DATA: 36 instances written by five temporal-logic experts as cases they thought hard for neural methods; at least 9 contained ambiguous wording. MODELS: Codex (code-davinci-002) and Bloom 176B, few-shot (2 minimal examples, or 4 drawn from the dataset); comparison with a fine-tuned T5 and nl2ltl. NUMBERS (Table 1, read twice, identical): nl2ltl 1/36 (2.7%); fine-tuned T5 2/36 (5.5%); Bloom initial 5/36 (13.8%); Codex minimal prompt 44.4% (16/36); Codex with 4 in-distribution examples 58.3% (21/36); Codex interactive 86.1% (31/36); 5 instances stayed unsolved; on average 1.4 translation loops (Sec 4.2).

## quotes

"In total, we correctly translated 31 out of 36 instances, i.e., 86.1% using the nl2spec sub-translation methodology by performing only 1.4 translation loops on average." (checked in substance, two reads agree on 31/36, 86.1% and 1.4; the first read gave it as a paraphrase, so the words are single read); "Out of the 36 instances in the benchmark set, at least 9 of the instances contain ambiguous natural language." (single read, Sec 4.2)

## does not cover

36 instances and one reference per instance; 2022-era models; the person doing the correcting is the same kind of expert who wrote the sentence, so the 86.1% says what a formal-methods expert can do with the tool, not what a developer can do; no run on larger or real requirements.

## strength

one report (small, one team)

## how chosen

SERIOUS (the standard model-based "sentence to temporal logic" tool; reports first-try accuracy and accuracy with interaction)

## period

language-model

## group

G4     claims: C3     direction: supports (models are weak at first-try specifications; a person in the loop repairs them)

