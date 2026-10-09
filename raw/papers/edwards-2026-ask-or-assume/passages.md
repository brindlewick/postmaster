# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> our scaffold achieves a 69.40% task resolve rate, significantly outperforming a standard single-agent setup and closing the performance gap with agents operating on fully specified instructions.

Abstract; not checked (abstract page only; the full text gives the same 69.4% for both models)

> We propose an uncertainty-aware multi-agent scaffold that decouples underspecification detection from code execution.

Abstract; not checked

Numbers as reported by the full text, 500 instances of an underspecified SWE-bench Verified (issues rewritten by GPT-4o), agents Claude Sonnet 4.5 and Kimi K2.6, user simulated by GPT-5.1 with the full issue text. Two fetches agree on: Claude Sonnet 4.5 resolves 70.8% with the full specification ("Full") and 54.8% with the underspecified one and no questions ("Hidden"); the two-agent scaffold ("UA-Multi") reaches 69.4% on both models. One fetch only (not checked): Kimi K2.6 about 74.6% Full and about 59% Hidden; single-agent scaffold ("UA-Single") 61.2% and 61.6%; forced-questions baseline 70.4% and 47.2%; total inference cost $1,748.08 (Claude) and $498.36 (Kimi) over 500 tasks, "roughly doubling single-agent costs"; one evaluation run per configuration with no variance reported; the paper's own limits are that simulated users are unreliable proxies for people and that results may not carry to smaller open-weight models.
