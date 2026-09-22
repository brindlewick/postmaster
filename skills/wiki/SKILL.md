---
name: wiki
description: 'Operate the postmaster research wiki: ingest a finished run into immutable raw evidence and a compiled run record, query the wiki with citations, or lint it for contradictions, missing citations, broken links and orphan pages. Invoke via /wiki. The wiki answers whether combining several models produces better software than one, and every claim in it must trace to a run ledger.'
---

# /wiki: ingest, query, lint

The wiki compiles knowledge from runs once and keeps it current, instead of re-deriving it
from chat histories. **Read `wiki/schema.md` first**; it is the contract for every page, and
this file only says how to perform the three operations.

Three layers, and the direction is one-way: `raw/` is written once, by a finished run or a
web capture; `wiki/` compiles from it; and no operation ever edits `raw/`.

Two kinds of evidence with different force. A **run** says what this fleet did and can move a
standing. A **paper or article** says what someone else claims: it motivates a hypothesis and
belongs in what would settle it, but it never moves a standing on its own.

## ingest a run

A run has ended. It is only ingestible once it has stopped writing.

1. **Copy the dispatch whole** into `raw/runs/<run-id>/`, unchanged, where `<run-id>` is the
   dispatch directory's own name: the ledger, the narrative, the cards, `logs/` with each
   lane's harness events stream, and each lane's durable harness session exported at teardown
   (`grok export`, codex's rollout jsonl, pi's session jsonl). Check first that no credential
   is in any of them; a session can carry whatever was on screen.
2. **Write the run record** in `wiki/sources/YYYY-MM-DD-<target>-<ticket>.md` from
   `wiki/sources/template.md`, filling every section from the copied files. Every number
   carries `[@runs/<id>/<file>]`.
3. **Update the standings** of every concept the record bears on, per the evidence, not per
   the narrative. A standing may only move on what a run record says.
4. **Cross-reference** with `[[wikilinks]]` in both directions.
5. **Append to the log**: `## [YYYY-MM-DD] ingest | <title>`, naming which standings changed.

Never ingest a run that is still in flight, and never ingest twice: if `raw/runs/<run-id>/`
exists, the run is already in.

## ingest a source

A paper, article or documentation page worth keeping.

1. **Capture the text** into `raw/papers/<slug>/` or `raw/articles/<slug>/` with its
   `source.md` front matter (url, retrieved, title, author). A link alone is not a capture:
   pages move and a citation to a moving page is not a citation. Fetching is bounded by the
   machine's egress allowlist; a source behind a disallowed host is one the user supplies.
2. **Write its page** in `wiki/sources/`: what it claims, on what evidence, and what it would
   mean here if true.
3. **Link it** from every concept it bears on, in the section on what would settle that
   concept. **Do not change a standing**: outside work is a hypothesis, not a result.
4. **Append to the log**: `## [YYYY-MM-DD] ingest | <title>`.

## query

A question the wiki may already answer.

1. Read `wiki/index.md`, then the pages it points at. Do not re-derive from `raw/` what a
   page already compiles.
2. **Answer with citations.** Where the answer rests on a run, cite it; where it rests on
   nothing, say so plainly rather than inferring.
3. If the answer is worth keeping, file it as a page and log it. A good answer left in a chat
   is lost.

## lint

A health check, and part of the repo's gate. Report every fault, fix only the mechanical ones:

- every page has front matter with `title`, `type`, `updated`, and a concept also has `standing`
- every `[@runs/...]`, `[@papers/...]` and `[@articles/...]` resolves to something in `raw/`
- every web capture has a `source.md` with a url and a retrieval date
- no concept whose standing rests on papers alone
- every `[[...]]` resolves to a page
- every claim carries a citation or is marked unverified in the sentence making it
- no orphan page: everything is reachable from `wiki/index.md`
- no concept whose standing contradicts the run records it cites, and none at `supported`
  with fewer than three records
- the catalog and counts in `wiki/index.md` match what is on disk

A contradiction between a standing and its records is reported, never quietly corrected: it
means either the standing or the reading of a record is wrong, and which one is a judgement
for the user.
