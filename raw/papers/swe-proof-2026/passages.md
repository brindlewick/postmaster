# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

On 500 real issues from SWE-bench Verified, an adversarial audit that wrote new tests overturned 26.8 points of the 85.0% of patches that pass the benchmark's tests, a correct formal specification handed to the agent raised resolution to about 95%, but an agent that had to write its own specification did no better than an unaided agent.

## measured

- TASK: resolve a real GitHub issue and prove the patch satisfies a formal specification, in one of three backends: Nagini (a Python verifier), Velvet (an imperative language in Lean) or plain Lean. The agent can call the verifier as a tool (Section 3, as read). The pipeline that builds the instances, Benchproofer, produces the specification, axioms that summarise the unchanged functions the code calls, a reference implementation in the backend language, a pre-fix implementation and a proof.
  - SIZE: 500 instances from SWE-bench Verified (real projects such as matplotlib and numpy); ground-truth patches average 2 functions and 14 lines changed on SWE-bench Verified, and 9 functions and 146 lines on SWE-bench Pro (Section 3.5, as read). 242 of 266 Python tasks in SWE-bench Pro admit a verified twin.
  - SPECIFICATION AUTHOR: a MODEL (Claude) during construction, which sees the ground-truth patch, the buggy code, the test patch and the pass lists during construction but never during evaluation; admission after mechanical gates (reference verifies, pre-fix fails, mutants fail, no escape hatches, patch passes the official harness) and adversarial gates (axioms fuzzed against the real callees, conformance on 10^5 inputs, soundness and completeness attacks, property-based falsification, equivalence, leakage) (Section 3.3, as read). The human review count is not reported.
  - AUDIT: three independent adversarial auditors score each specification on five properties; it passes "only if a majority accept all five" (Section 4.5). Pass rate 46 to 61% by backend (Table 3, as read). "Faithfulness" is "whether the functions it models cover the whole behavioral surface the issue requires"; the dominant failure: "Models write specifications that are correct on the functions they model but cover too few of them." Failure rate 52.2% for Nagini, 38.0% for Velvet, 37.2% for Lean (Table 3).
  - NUMBERS (Table 2 and abstract, Claude Opus 4.8, 500 instances; the paper's own experiments; two reads agree): Row 0, unaided baseline resolution by the benchmark's tests: 85.0%. Row 1, the same patches re-scored by an adversarial audit (an auditor writes new tests that tell the agent's patch apart from the ground-truth patch; "a test counts only if it fails under the agent's patch and passes under the ground-truth one"): 58.2%. The paper: "Under this audit, 26.8% of the patches that pass every test in SWE-bench Verified's are overturned (Row 0 minus Row 1)"; that is 26.8 percentage points of all 500 instances, which is about 31% of the 85.0% that passed (my arithmetic; the abstract says "a quarter"). So the quarter is found by adversarial tests, not by a proof checker. Correct formal specification handed to the agent (Row 6, no verification step): 96.2% (Nagini), 94.0% (Velvet), 95.2% (Lean); with the patch also verified against it (Row 7): 95.0%, 94.0%, 93.6% (abstract: "from 85% to 95%"). The agent writes its own specification (Rows 2 and 3): "Resolution does not improve over the baseline under any backend (Row 2 against Row 0)"; Row 3, which also requires the patch to verify against the self-written specification, "stays within 1.6 points of Row 2 under every formal backend, so the bottleneck is not writing the implementation or the proof but the self-constructed specification." A structured natural-language specification (EARS) does not help: "A structured non-formal specification confers none of the improvement that a formal one does"; 17.8 points of its pass rate come from patches still distinguishable from the ground-truth patch. "only 56% of those specifications pass our audit". Specification quality versus outcome: failing the audit on 92% of unresolved instances against 51% of resolved ones (Section 4.6).
  - WHAT THE PROOF DOES NOT COVER (Section 3.4, as read): "No guarantee can be established that a specification matches informal natural language intent"; the axioms for the unchanged callees are trusted (checked only by fuzzing, not proved); and "each backend verifies code in its own language while the repository is Python, so a formal artifact and the code it stands for can never be the same text" (equivalence to the real patch is by adversarial checks, not proof).

## quotes

- "Writing that specification is the hard part: an agent that must write its own gains nothing over an unaided baseline, and only 56% of those specifications pass our audit." (checked: abstract on the abs page and the HTML read, same words)
  - "no guarantee can be established that a specification matches informal natural language intent" (checked: two reads of the HTML, Section 3.4)
  - "each backend verifies code in its own language while the repository is Python, so a formal artifact and the code it stands for can never be the same text" (checked: two reads of the HTML, Section 3.4)

## does not cover

One model (Claude Opus 4.8); the specification quality judgement is by model auditors (three, majority rule) not by the issue's authors; specifications are written knowing the ground-truth patch during construction, so the "correct formal specification" condition is an oracle condition, not what an agent would produce. The 85% to 95% gain is for a specification handed over. The abstract's "verification catches what tests miss" rests, for the quarter figure, on an adversarial test audit and not on a proof checker; the proof route is shown by the specification-provided rows. None of the three backends is TypeScript; the repositories are Python.

## strength

controlled study (500 real instances; one team; one model)

## how chosen

RECENT (newest result found, 12 days before the read date) and SERIOUS (real repositories, real issues, specification written by the agent as an experimental condition, audited)

## period

language-model

## group

G4     claims: C2, C3     direction: mixed (strongest single entry for both claims: the benchmark's tests are incomplete, a correct formal specification handed to the agent lifts results, and writing the specification is where agents gain nothing)

## Read again by the research session on 2026-10-04

Route: arXiv abstract page, read by the research session on 2026-10-04.

- "a quarter of test-passing patches admit counterexamples" (single read (this read only))
- "Writing that specification is the hard part: an agent that must write its own gains nothing over an unaided baseline, and only 56% of those specifications pass our audit." (checked: the reading helper's quote and this read give the same words)
- "The usual failure is faithfulness, a specification that constrains part of the required behavior and leaves the rest free." (single read (this read only))

