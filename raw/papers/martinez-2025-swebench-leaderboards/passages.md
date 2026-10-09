# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> no single architecture consistently achieves state-of-the-art performance

Abstract (HTML) and Section 4; checked

> they range from single-LLM solutions without agentic capabilities, to complex multi-agent systems with emergent workflows

Abstract (HTML) and Section 1; checked

> By July 17th 2025, we count, in total, 79 and 99 entries on SWE-Bench Lite and SWE-Bench Verified, respectively.

Section 3.1.1; not checked

## Passages added by package P2-code-evidence, retrieved 2026-10-04

Reads by this package: HTML v3 read twice with different prompts (the PDF came back as binary).

> The majority of submissions report using a single LLM

Section 3.1.5, "Use of Multiple LLMs" (fragment); checked (two reads agree)

> Solutions that use more than one LLM often assign different roles to each model within the repair process.

Section 3.1.5; checked (two reads agree word for word)

> submissions are not required to disclose how the reported results were obtained

Introduction (fragment); checked (two reads agree)

> By July 17th 2025, we count, in total, 79 and 99 entries on SWE-Bench Lite and SWE-Bench Verified, respectively.

Section 3.1.1; checked (this read and the capture above agree word for word)

> the state-of-the-art result (75.2%), by TRAE (June 2025) was achieved using a combination of multiples state-of-the-art models including Claude 4 Sonnet and Opus Claude 3.7 Sonnet.

Section 3.1.5 (wording and grammar as returned by one read); not checked. The other read listed the models as Claude 3.7 Sonnet, Claude 4 Sonnet, Claude 4 Opus and Gemini 2.5 Pro.

Reading by the fetch tool (a paraphrase, not a quote): the paper reports no statistic on how many submissions use a separate selector or LLM judge, and no overlap of resolved instances across submissions.

