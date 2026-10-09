# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

A two-agent loop in which a tester model writes properties from the problem statement and feeds back the smallest failing input improved pass@1 over test-driven repair methods on HumanEval, MBPP and LiveCodeBench.

## measured

TASK: write code; a Tester agent writes properties from the problem statement, checks them for soundness against the public test cases and for sensitivity against wrong outputs, runs Hypothesis, and returns the minimised failing case. COMPARED WITH: Self-Edit, Self-Debugging, Reflexion, MGDebugger, CodeT, LDB, plain and chain-of-thought prompting. DATA: HumanEval (164), MBPP (about 500), LiveCodeBench v5 (880). MODELS: DeepSeek-Coder-V2, Qwen2.5-Coder, DeepSeek-R1-Distilled-32B. NUMBERS (Table I, pass@1, property loop against the best baseline): DeepSeek-Coder-V2 HumanEval 89.0% vs 86.6%, MBPP 67.6% vs 63.8%; Qwen2.5-Coder HumanEval 94.5% vs 92.7%, MBPP 69.6% vs 64.4%; R1-Distilled-32B HumanEval 97.6% vs 96.3%, MBPP 81.2% vs 74.4%; the abstract states relative pass@1 gains of 23.1% to 37.3% over established test-driven methods (which benchmark and model give each end I did not find in the tables I read; one read put it on problems hard for direct prompting); on LiveCodeBench, among instances the first attempt got wrong, feedback from public tests alone corrected 46.6% and property-based feedback on the same set 75.9% (Sec IV-C, read twice); the shortest failing input worked best as feedback (74.5% against 73.3% by run time and 72.1% by coverage, Table III).

## quotes

"PGS's efficacy depends on the quality of LLM-generated properties. Trivial or irrelevant properties may limit PBT's benefits." (checked: two reads of the html page, Sec IV-F, give the same words)

## does not cover

the property is written by a model from the problem statement; the paper says its gains depend on the quality of those properties and that "trivial or irrelevant properties" limit them, and gives no count of wrong or weak ones; three models, three benchmarks of short programs, possible training-data leakage.

## strength

controlled study

## how chosen

SERIOUS (a controlled comparison of property-based and example-based feedback inside code generation)

## period

language-model

## group

G4     claims: C3, C4     direction: supports (property feedback beats example feedback in repair)

