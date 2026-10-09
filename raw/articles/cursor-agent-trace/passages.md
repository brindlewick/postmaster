# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Agent Trace is an open specification for tracking AI-generated code. It provides a vendor-neutral format for recording AI contributions alongside human authorship in version-controlled codebases.

Abstract; checked (two fetches agree word for word)

> Version: 0.1.0 Status: RFC Date: January 2026

Header block of the specification (three lines in the page); not checked (the second fetch gave the three lines; the first gave the same version, status and date only as a summary)

> Line numbers in a trace refer to positions at the recorded revision, not current positions.

Section 6.5, Line Tracking; checked (two fetches agree word for word)

> This spec intentionally does not define how traces are stored. This could be local files, git notes, a database, or anything else.

Appendix C, FAQ, "How should I store the traces?"; checked (two fetches agree word for word)

> We expect to see different implementations in open source. This may influence the spec in the future. We are open to feedback.

Appendix C, FAQ, "How should I handle rebases or merge commits?"; checked (two fetches agree word for word)

> Agent Trace does not track legal ownership or copyright.

Section 3, Non-Goals, item "Code Ownership"; checked (two fetches agree; the first returned it without the final full stop)

> A reference implementation is provided in the `reference/` directory, demonstrating how to integrate Agent Trace with coding agents.

Section 8, Reference Implementation, first sentence; checked (two fetches agree word for word)

> The reference is an example for Cursor or Claude Code, but the patterns are applicable to any AI coding agent.

Section 8, Reference Implementation, last sentence; not checked (one fetch)

> Thanks to the following partners for helping shape Agent Trace:

Page footer; the list that follows names Amp, Amplitude, Cline, Cloudflare, Cognition, git-ai, Jules, OpenCode, Tapes and Vercel; checked (two fetches agree on the list; the sentence itself was returned once)

## Fields of the trace record, from the JSON schema

Read from https://agent-trace.dev/schemas/v1/trace-record.json through the same fetch tool (one fetch; a paraphrase of the schema, not a quotation): top-level fields `version`, `id`, `timestamp`, `vcs`, `tool`, `files`, `metadata`, of which `version`, `id`, `timestamp` and `files` are required; `vcs.type` is one of `git`, `jj`, `hg`, `svn` and `vcs.revision` is required; each file has `path` and `conversations`; each conversation has `ranges` (each with `start_line`, `end_line`, optional `content_hash` and optional `contributor`) and optional `url`, `contributor` and `related`; contributor type is one of `human`, `ai`, `mixed`, `unknown`; `model_id` is a string of at most 250 characters in the models.dev convention. Not checked by a second fetch.

## Numbers

Repository numbers: none read. A plain GET of repos/cursor/agent-trace returned HTTP 404 on 2026-10-04, and the Cursor organisation's public repository list (10 repositories) did not include it.
