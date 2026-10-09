# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Invoke each `/speckit-*` **skill in your agent's chat**, one at a time, and review the result before continuing.

README, "Choose your process" (three source lines joined); checked (raw file text)

> SDD turns your requirements into a specification, a technical plan, and actionable tasks, then guides implementation against those artifacts.

README, "Spec-Driven Development"; checked (raw file text)

## Numbers from the GitHub API, 2026-10-04

- stars 140068; forks 12537; created 2025-08-21; last push 2026-10-03; licence MIT
- latest release v1.1.0, published 2026-10-02; default branch main; not archived

## Added by package P6-spec-first, retrieved 2026-10-04

Two more files at the same commit (ae5ade7234be5cb1d975f736c4e06dd46d1326d6): docs/reference/agentic-sdd.md and
spec-driven.md, read as raw text. Each passage was matched character for character against the raw file after
whitespace was collapsed. Markdown marks are kept as they appear in the file.

> The clarify, checklist, and analyze commands are quality gates you add for anything with meaningful ambiguity.

docs/reference/agentic-sdd.md, opening; checked

> An agent may help evaluate them when explicitly asked, but implementation must not silently self-approve them.

docs/reference/agentic-sdd.md, section on `/speckit.checklist` (custom checklists are "reviewer-owned"); checked

> `/speckit.implement` counts checked and unchecked items and asks before proceeding when any are unchecked, but it must not change checklist markers.

docs/reference/agentic-sdd.md, section on `/speckit.implement`; checked

> Generate multiple implementation approaches from the same specification to explore different optimization targets—performance, maintainability, user experience, cost.

spec-driven.md, list of principles ("Branching for Exploration"); checked

> 2. Tests are validated and approved by the user

spec-driven.md, the "NON-NEGOTIABLE" test-first rule (item 2 of a three-item list); checked

> where team-reviewed specifications are expressed and versioned, created in branches, and merged.

spec-driven.md, third paragraph of the workflow description; checked
