# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Run through a compiler-in-the-loop coding-agent harness, Claude Opus 4.6 reached 98.1% end-to-end on CLEVER's Lean problems where the benchmark paper's own end-to-end result had been 1 of 161, and in doing so it flagged bugs in about half of the benchmark's reference specifications.

## measured

- TASK: CLEVER's four tasks (write a specification, prove it equivalent to the hidden one, write an implementation, certify it) with a coding agent instead of few-shot prompting (HTML read).
  - SIZE: the same 161 CLEVER problems (HumanEval-derived; see clever-2025).
  - AGENT AND BUDGET (HTML read): Claude Opus 4.6 through the Claude Agent SDK with a Lean language-server tool and a set of Lean instructions; compiler feedback in the loop; pass@1; about 10 to 15 minutes per proving problem and about 90 seconds per formalisation problem; cost "$0.3 per solve for formalization ($0.5 multi-spec case); $2.0-2.5 for proving tasks"; one-hour timeout per attempt; run from a laptop through the vendor's API.
  - SPECIFICATION AUTHOR: the model writes the specification in the specification task; the reference specifications are the benchmark's (people, see clever-2025).
  - WHAT SUCCESS MEANS (HTML read): Lean compiles the generated script with no `sorry`; the authors left ground-truth specifications, helpers and theorem signatures untouched except for formatting; "Cross-checks of the Claude-reported flags against the evaluation through the benchmark harness showed no discrepancies, as all and only ok solutions passed the evaluation." For specifications, "arguably valid" is the authors' manual judgement that the generated specification "validly interpreted the source NL description of the function", not CLEVER's equivalence proof.
  - NUMBERS (abstract and HTML read; the paper's own experiments, spring 2026): specifications arguably valid for 159 of 161 (98.8%) against 3 of 161 (1.86%) for the earlier best (GPT-4o with the COPRA agent); of these, "81.3% are also accepted by Clever's isomorphism-based scoring on the portion of the benchmark where no issues in the ground-truth specifications were identified" (checked wording from the second read; the count printed beside it was 65 of 161, which does not give 81.3%, so the denominator is not resolved here). Implementations certified against correct ground-truth specifications: 70 of 80 (87.5%) against 14 of 161 (8.7%) for the earlier best (Claude with COPRA). End to end: 157 of 161 (98.1%), after setting aside 4 entries with unfixable premises, against 1 of 161 (0.62%) in the original CLEVER paper.
  - BUGS IN THE BENCHMARK (HTML read, Table 1 as read): 80 of 161 ground-truth specifications "flagged at least once as having bugs" (checked; one read also printed 81, which is probably the 81 unflagged problems, 161 minus 80, my arithmetic), plus 18 judged underspecified (11.2%) and 10 more found by property-based testing. Categories (as read): conjunct used as a guard (15), precedence bug (12), universal quantification over an invalid domain (7), wrong semantics (21). Examples: Collatz (a proof of correctness against the specification "essentially requires a proof of the Collatz conjecture itself") and prime Fibonacci (depends on an open question).

## quotes

- "These findings highlight a growing mismatch between the difficulty of existing program verification benchmarks and the capabilities of modern agentic provers" (checked: abstract on the abs page and the HTML read, same words)
  - "tight compiler-in-the-loop agentic paradigms are currently the most effective approach for foundational program verification" (checked: abstract on the abs page and the HTML read, same words)
  - "80 of the 161 ground-truth problem_spec were flagged at least once as having bugs." (checked: two reads of the HTML; "flagged" means identified by the agent as containing errors during its specification-equivalence runs and proof evaluation)

## does not cover

The "arguably valid" judgement is by the authors, so the 98.8% is not a machine-checked equivalence. A benchmark where the reference specifications are about half faulty (by the authors' own count) is not a clean yardstick, in either year. Single model, single attempt. It does not say the same agent would do as well on a project with no benchmark-style spec. The authors propose "agentic LLM judges, complemented by property-based testing" as an alternative to isomorphism scoring (Section 5, as read).

## strength

one report or one team's experience (one team; one model; manual judgement of specifications)

## how chosen

RECENT (newest figures on CLEVER, superseding the 2025 results) and CONTRADICTS (the benchmark's own reference specifications were faulty, which is evidence on C3)

## period

language-model

## group

G4     claims: C2, C3     direction: mixed (it reverses the 2025 CLEVER result for proofs, and it finds that about half of CLEVER's hand-written reference specifications had bugs)

## Read again by the research session on 2026-10-04

Route: arXiv abstract page, read by the research session on 2026-10-04.

- "Claude generates arguably valid specifications for 98.8% of problems (with 81.3% also accepted by CLEVER's isomorphism-based scoring on the correct portion of the benchmark)" (single read (this read only))
- "reaches a 98.1% success rate on the end-to-end program generation and verification pipeline over entries with self-consistent premises" (single read (this read only))

## Corrected after an independent check of the page against its sources, 2026-10-05

The 98.1% is 154 of 157 entries: the paper says that across both runs 154 entries had at least one successful attempt, and "if we remove the 4 instances of issue in the benchmark itself, this success rate further rises to 98.1%" (Section 3.2). An entry counts if any attempt over two runs worked.

The one-sentence summary under `says` above is replaced, in `source.md` and on the wiki page, by: Run through a compiler-in-the-loop coding-agent harness, Claude Opus 4.6 reached 98.1% end-to-end on CLEVER's Lean problems (154 of 157 entries, after setting aside 4 whose premises the benchmark broke, counting any success over two runs) where the benchmark paper's own end-to-end result had been 1 of 161, and in doing so it flagged bugs in about half of the benchmark's reference specifications.

