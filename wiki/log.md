---
title: Log
type: schema
updated: 2026-09-22
---

# Log

Append-only. Newest first. One entry per operation, prefixed so it can be parsed.

## [2026-09-22] lint | raw is committed, and promotion is the gate

`raw/` had been gitignored on the grounds that logs are public-unsafe and instance-specific.
That reasoning outlived its cause: everything automatic now lives in each project's
`.postmaster/`, so reaching `raw/` is already a deliberate act. Making that act the publication
decision — scrub, publishable target, lawful redistribution — lets the evidence be committed,
which is the point of a wiki with sources: a standing can be followed to the record behind it
by anyone who clones the repository. The sha256 provenance mechanism goes with it, since git
supplies integrity. The two entries below recording the opposite stand as written; this log is
append-only and they are accurate as history.

## [2026-09-22] ingest | prompt delivery differs by harness

First concept outside the founding question, and the first carrying evidence: pi's attachment
form delivers a different message from stdin, it hangs on an inherited pipe, and a resume
against another directory's session exits 0 having done nothing. Settled by controlled trial
against pi 0.87.0; changed harnesses.md and launch.sh in pull request #1.

## [2026-09-22] lint | wiki rescoped to the whole project

It had been written as though its only subject were whether combining models works. That is
the founding question, not the scope: harness behaviour, the services the flow depends on, and
the reasons behind design decisions all belong here. Index reorganised by area, and the line
between a concept and a runbook stated: a runbook says what to do, a concept says what is
known and how sure.

## [2026-09-22] lint | raw is a deliberate subset, not the default home of a run

Every run's full record, harness logs included, belongs in `<project>/.postmaster/`, which is
gitignored in whatever project it is. Nothing reaches `raw/` automatically: a record is copied
in only when somebody decides that run is evidence for a claim. Most runs are operational; a
few are evidence, and the difference is a decision rather than a default.

## [2026-09-22] lint | raw made local and uncommitted

`raw/` sat in the repository root, so run evidence would have been committed to a public repo
whatever the published site rendered. It is now gitignored, its contract aside. Runs are
specific to the instance that made them and carry its paths and ticket text; the tool's
history is not the place for them. Compiled records now carry the sha256 of each file they
drew on, so provenance survives without the evidence being published, and lint checks that no
page quotes raw or names a path.

## [2026-09-22] lint | raw widened to published sources

`raw/` had been restricted to runs, which contradicted the pattern and would have blocked the
literature the spec-detail and harness-diversity questions need. It now takes `papers/` and
`articles/` alongside `runs/`, each capture carrying its url and retrieval date. The rule that
keeps the two apart: a run can move a standing, a paper cannot. Run ingest also now copies each
lane's harness events stream and its exported session, which were previously left on the
machine.

## [2026-09-22] lint | wiki rebuilt on the LLM-wiki pattern

Restructured to immutable `raw/` sources, compiled `wiki/` pages, front matter with
standings, `[@source]` citations and `[[wikilinks]]`. Added the harness-diversity open
question. No raw records and no run records yet, so every standing is `claimed` and nothing
carries a citation.

## [2026-09-22] ingest | wiki created

The three claims the README makes, entered as hypotheses at standing `claimed`, with four
open questions and the run-record template.
