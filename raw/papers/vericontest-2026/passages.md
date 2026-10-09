# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

On 946 competitive-programming problems in Verus, the best of ten May 2026 models wrote correct code from prose 92.18% of the time, but a correct specification 48.31%, a proof 13.95% and a full verified program from prose 5.29%.

## measured

- TASK (Table 3, Section 5, as read): nl2spec (specification from prose), nl2code, spec2code, proof generation from the ground-truth specification and code, and end-to-end from the description alone. pass@1 for specification, code and proof; for proofs also pass@k and repair@k up to k=20 (Section 6). So the headline numbers are single-attempt unless stated.
  - SIZE: 946 problems from LeetCode and Codeforces in Rust with Verus. Medians (Table 2): 32 lines of Rust, 23 lines of specification, 83 lines of proof; 276 positive and 2,670 negative tests per problem.
  - SPECIFICATION AUTHOR: people validated: 91 manually verified seed problems (81 LeetCode, 10 Codeforces), then semi-automatic expansion to 946 "with human-in-the-loop construction and validation" using a coding assistant; "Each benchmark instance reviewed by at least two human experts" (Section 4.1). Postconditions are tested by turning them into executable Rust and running them on positive and mutated negative tests (Post2Exe); 60 postconditions found incomplete this way were revised (Section 3.3, as read).
  - HOW A MODEL'S SPECIFICATION IS JUDGED: preconditions by model-written Verus proofs of equivalence to the reference; postconditions by the test suites (Section 5.2, Appendix A.4, as read).
  - WHAT SUCCESS MEANS and the cheat guard: Verus runs with a `--no-cheating` flag that disallows `assume` and `admit` ("allow properties to be accepted without proof") and `external_body` and `assume_specification` ("cause Verus to trust a function without verifying its body") (Section 3.2, as read).
  - MODELS AND NUMBERS (Table 3 as read; the paper's own experiments): nl2spec, nl2code, proof from specification and code, end-to-end: GPT-5.5 48.31%, 92.18%, 13.95%, 5.29%; Claude Opus 4.7 20.82%, 90.17%, 12.68%, 2.22%; Gemini 3.1 Pro 19.03%, 88.79%, 13.53%, 2.64%; Claude Sonnet 4.6 13.11%, 88.37%, 13.21%, 2.85%; DeepSeek V4 Pro 7.93%, 87.00%, 5.60%, 1.06%. Also GPT-5.4 mini, DeepSeek V4 Flash, Gemini 3 Flash, Qwen 3.6 and GLM-4.7-Flash, all lower (end-to-end 0.21% to 1.06%).

## quotes

- "the strongest model reaches 92.18% on natural-language-to-code generation, but only 48.31% on specification generation, 13.95% on proof generation, and 5.29% end-to-end" (checked for these words and numbers in two reads of the abstract; the abs page says "coding ability" and the HTML page says "ordinary coding ability" before "and verifiable code generation")
  - "We run Verus with the --no-cheating flag, which disallows constructs that bypass the verifier" (checked: two reads of the HTML, Section 3.2)
  - "Since LeetCode and Codeforces problems are public, some problem descriptions or solutions may appear in model pretraining corpora." (single read, HTML, contamination)

## does not cover

Rust with Verus only; competitive-programming problems (median 32 lines), no systems code or repositories (Appendix C, as read). pass@1 under a fixed protocol that, as I read it, is not an agent loop with tools; the agentic settings in other 2026 papers (agentic-proving-2026, aria-2026, axdafny-2026) report much higher figures for proofs in other languages, so this table is a plain-prompt baseline for May 2026 models and not a ceiling. The authors say contamination is possible but argue the low scores suggest it is not driving results. The same model, Gemini 3.1 Pro, scores 19.03% on specification generation here and 77.8% in verus-specbench-2026. The tasks and judges differ (here preconditions are checked by proof of equivalence and postconditions against a median of 2,670 negative tests per problem; there by official tests and adversarial "hacks"), so the two figures cannot be compared; how a specification is judged moves the number a lot (my reading; paraphrase).

## strength

controlled study (946 problems, ten models, one team)

## how chosen

RECENT (May 2026; ten current models; separates code, specification, proof and end-to-end)

## period

language-model

## group

G4     claims: C2, C3     direction: contradicts (end-to-end verified generation from prose is about 5% for the best of ten models; the gap between writing code and writing specification and proof is wide)

