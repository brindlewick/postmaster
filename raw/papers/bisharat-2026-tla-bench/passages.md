# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Every model wrote parseable TLA+ far more often than correct TLA+ (the best was correct 16% of the time by default), and the same outputs score anywhere from 18.7% to 1.7% depending on how strictly "correct" is screened.

## measured

TASK: from a natural-language description, write a TLA+ module. JUDGED BY: two gates: SANY parses it; TLC explores the full reachable state space with the reference configuration and finds no violation of the properties the configuration names. The paper itself states what this does and does not show: it is exact for the properties and constants in that configuration, it does not show behavioural equivalence to the reference, and "a weaker-than-intended property can pass"; failures are often a mismatch of names rather than a modelling error. Screens: configuration-aware, default, substantive (behavioural), and mutation-surviving (vacuity). DATA: 1,300 specifications from 13 public repositories (403 gold = parse and model-check, 897 silver = parse only; median 23 lines, mean 62.3 lines, basic tier mean 17, advanced tier mean 209), written by the repositories' authors; the descriptions were written by GPT-5 and Claude Opus 4.5. MODELS: GPT-5, Gemini 2.5 Pro, Claude Opus 4.5; qwen2.5-coder-32b, llama3.3-70b, gpt-oss-20b. NUMBERS (Table 6, 100 specifications, declarative descriptions, default regime; parse / TLC-correct): Claude Opus 4.5 87% / 16%; Gemini 2.5 Pro 63% / 10%; GPT-5 89% / 4%; qwen2.5-coder-32b 29% / 1%; llama3.3-70b 23% / 0%; gpt-oss-20b 7% / 1%. NUMBERS (Table 5, three frontier models pooled): 18.7% configuration-aware, 10.0% default, 4.0% substantive, 1.7% mutation-surviving. By difficulty (Sec 8.4): 25% correct on basic, 2% on intermediate and advanced.

## quotes

"Every model writes valid TLA+ far more often than correct TLA+" (checked: abs page and html page give the same words); "an exact oracle gives not one correctness number but a range" (checked, same two pages); the numbers in Tables 5 and 6 were read twice with identical values

## does not cover

one sample per specification (the authors give a sampling error of about 4 to 7 points); all models were graded on GPT-5-written descriptions (the authors name this as a confound); the descriptions are model-made, not from people asking for a specification; the "intent" style descriptions were not evaluated; the page names a 2027 conference as the venue.

## strength

controlled study (one team)

## how chosen

RECENT (newest result found on this task; it states the weakness of judging a specification by running it)

## period

language-model

## group

G3, G4     claims: C3     direction: supports, and it measures how the judging changes the figure

## Corrected after an independent check of the page against its sources, 2026-10-05

The same outputs score from 10.0% to 1.7% as the screen gets stricter. The 18.7% adds a change to the input, the interface-supply choice, where the model is told the configuration's names.

The one-sentence summary under `says` above is replaced, in `source.md` and on the wiki page, by: Every model wrote parseable TLA+ far more often than correct TLA+ (the best was correct 16% of the time by default), and the same outputs score from 10.0% to 1.7% depending on how strictly "correct" is screened, or 18.7% when the model is also told the configuration's names.

