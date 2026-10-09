# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Asked to prove lemmas extracted from the seL4 verification in Isabelle, GPT-4 managed about 42% of the easiest tier on the first attempt and almost none of the hardest.

## measured

- TASK: proof only. The model gets the lemma statement extracted from seL4 (with a context) and writes an Isabelle proof (Section 4.1, as read).
  - SIZE: seL4 verification is "over 100k lines of code in Isabelle and thousands of lemmas" (Section 1); from 5,464 extracted lemmas the benchmark keeps 360 (tiers P1 160, P2 120, P3 80; plus 45 declarative-style lemmas; Table 1 as read).
  - SPECIFICATION AUTHOR: the seL4 team (people); Selene reuses it.
  - WHAT SUCCESS MEANS: Isabelle accepts; trials with "sorry" or "oops", over 2,048 tokens or over 10 minutes "are all considered as failures" (Section 4.2, as read).
  - MODELS AND NUMBERS (Table 2, Table 4, Table 6 as read; the paper's own experiments, early 2024): GPT-3.5-turbo P1: 28.1% first attempt (ACC#1), 35.3% best of five (ACC#5); P3: 0%. GPT-4 P1: 41.7% and 51.8%; P3: 0 to 1.7%. Augmentations for GPT-4 P1 (ACC#1): similar-lemma examples 47.5%; dependency augmentation 52.5%; fixing augmentation 53.2%; similar plus fixing 61.9%.

## quotes

- "both models struggle significantly when attempting to prove lemmas within the P3 category" (single read, Section 4.3 as read)
  - "Even GPT-4 has difficulty in solving the rather difficult categories in Selene" (single read, Section 1 as read)

## does not cover

Early-2024 models; much has moved since (compare Goedel-Code-Prover and Vero for 2026). seL4 is public so contamination is possible and the paper does not discuss it (as read). The specification-writing stage is not addressed (Section 7). The 360 lemmas are a filtered subset of 5,464.

## strength

controlled study

## how chosen

SERIOUS (the one benchmark here built on a real, industrial verified system: the seL4 microkernel)

## period

language-model

## group

G4     claims: C2     direction: contradicts (on a real verified kernel, success is low and falls to near zero on hard lemmas)

