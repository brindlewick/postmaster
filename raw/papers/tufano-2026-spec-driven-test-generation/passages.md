# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> we propose Spec-Driven Test Generation, where we instruct an agent to first reason about -- and explicitly document -- code pre-conditions, post-conditions, and undefined behaviors.

Abstract; not checked (abstract page only)

> The Spec-Driven Agent consumed a total of 336.6M tokens, representing a 38.0% overhead over the Baseline Agent's 243.9M tokens.

Cost section, as reported by one fetch (another fetch gave 336.7M); not checked

Numbers as reported by two fetches of the full text, which agree: 90 historical bug fixes from an internal issue tracker, in C++, Java, Python and Go; both agents use Gemini 3 Flash with the same tools, and Gemini 3.1 Pro judges the qualitative comparison; 5 sampling runs per bug. Bug detection (detect@5) 53.4% for the baseline and 63.2% for the spec-driven agent, +9.8 percentage points (p = 0.0352); branch coverage 46.4% and 48.9%, +2.5 points; test-suite pass rate 98.9% for both. The spec-driven agent used about 38% more tokens (so the comparison is not at equal compute). Both fetches say the evaluation skipped the human-in-the-loop phase and accepted all agent-generated tests automatically.
