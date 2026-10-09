# Notes and passages

Taken on 2026-10-05 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

"The Rocq Prover is an interactive theorem prover, or proof assistant", used to write definitions, executable algorithms and theorems with machine-checked proofs.

## measured

README sentence, whole: "The Rocq Prover is an interactive theorem prover, or proof assistant. It provides a formal language to write mathematical definitions, executable algorithms and theorems together with an environment for semi-interactive development of machine-checked proofs." The README names no verified system; the use evidence is in the entries named above and in qed-2020 (CompCert "sold as a commercial product", used in aviation). Survey (ITP 2023): 466 submitted responses in February 2022, "the largest survey of users of an interactive theorem prover (ITP) so far"; 54% of respondents are academically employed and 32% are students (the survey's own comparison with a Haskell sample: "CC is even more tied to academia"); about 67% use Coq for software verification; about 64% have used it for more than 2 years and about 17% are learners; the authors find "experience has significant impact on Coq user behavior". The survey does not ask about specification effort. Soundness: the project keeps a public list of past soundness-relevant bugs; the fetch tool's summary put its length at about 100 entries since Coq 8.0 (2004), which I did not count; qed-2020 counted 23 fixed critical bugs in stable releases as of 2019, with the exploit risk of all but one "not determined".

## quotes

- "The Rocq Prover is an interactive theorem prover, or proof assistant." (repository README) (checked, two separate fetches)
  - "The Coq Community Survey 2022 was an online public survey of users of the Coq proof assistant conducted during February 2022." (abstract) (checked, the Dagstuhl landing page and the PDF text layer agree)

## does not cover

the survey is of people who chose Coq, so it says what they do and want, not how hard it is for newcomers; I did not find a figure for the share of industrial users beyond "private sector" being "quite significant" in the community's own summary. The repository page does not mention the rename from Coq.

## strength

one report or one team's experience (a survey, self-selected respondents)

## how chosen

USE (CompCert, Fiat Crypto in BoringSSL and Verdi were all built in it, see leroy-2009, fiatcrypto-2019, verdi-2015; 5.6k stars) and SERIOUS (the survey is the largest survey of proof-assistant users: 466 responses)

## period

older (the survey is from February 2022 and published in 2023; the tool dates from the 1980s)

## group

G2, background     claims: C2 (use and trust base), C3 (who uses it)     direction: background, with a caveat

