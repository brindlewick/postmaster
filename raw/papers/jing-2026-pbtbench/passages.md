# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Agents given only a library's documentation found 31% to 77% of injected semantic bugs with an open-ended prompt and 42% to 83% when told to write Hypothesis property tests, and the gain from the property prompt was largest for weaker models.

## measured

TASK: from documentation only, write a Hypothesis test that fails on the buggy library and passes once the injected bug is reversed (a bug is "found" only on that fail-to-pass test, per bug, in a two-container harness); the agent has to pick the invariant and an input strategy that reaches the trigger region. JUDGED BY: fail-to-pass execution; no reference property is given. DATA: 100 problems over 40 real Python libraries, 365 injected bugs (mean 3.65 per problem; 24% easy, 50% medium, 26% hard), injected by human authors with model help and put through a three-stage check including manual adversarial review; built so that default-strategy random inputs "almost never trigger" them. MODELS: eight (Claude Sonnet 4.6, DeepSeek V3.2, Gemini 3 Flash, GLM 5.1, Grok 4.1 Fast, Qwen 3.6 Plus, Qwen 3.5-30B-A3B, Step 3.5 Flash) on one scaffold (OpenHands), two prompts: open-ended baseline vs. a prompt naming Hypothesis and a property taxonomy; three independent runs per configuration. NUMBERS (Table 1, mean bug recall over the three runs, read twice, PBT prompt vs baseline; the page prints a plus-minus after each figure, e.g. Sonnet 4.6 83.4% plus-minus 3.3 and 76.7% plus-minus 2.7, without saying whether it is a standard error or an interval in what I read): Claude Sonnet 4.6 83.4% vs 76.7%; Qwen 3.6 Plus 78.0% vs 53.5%; GLM 5.1 72.1% vs 66.6%; Gemini 3 Flash 62.8% vs 56.2%; Step 3.5 Flash 58.1% vs 37.8%; Qwen 3.5-30B 54.3% vs 31.4%; DeepSeek V3.2 61.0% vs 64.2%; Grok 4.1 Fast 42.1% vs 50.1%. Sonnet 4.6 baseline found at least one bug in 98.0% of problems but all bugs in 43.0%; with the property prompt 92.7% and 67.0%. All 16 model-and-prompt cells together reached 363 of 365 bugs. Failure causes: with the open prompt 59% were wrong assertions or too-concrete tests; with the property prompt 31% misused assume() and 31% chose a wrong strategy range.

## quotes

"Hypothesis scaffolding lifts mid-capability models by over 20 percentage points, but yields smaller gains for the strongest models, with two exceptions showing degradation" (checked: abs page and html page give the same words)

## does not cover

injected, not natural, bugs, chosen to be property-testable (the authors say so); Python with English documentation; one scaffold; a 200-example budget that may cap hard cases; the baseline is open-ended and may still write property-style tests, so it is not a clean "example tests only" arm; an early harness leak affected 8.0% of runs (re-run).

## strength

controlled study

## how chosen

RECENT (the newest benchmark of agents writing property-based tests; it has a second arm with no mention of property-based testing)

## period

language-model

## group

G4     claims: C3, C4     direction: mixed

