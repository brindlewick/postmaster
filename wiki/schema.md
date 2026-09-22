---
title: How the wiki is kept
type: schema
updated: 2026-09-22
---

# How the wiki is kept

This page is the contract for every other page, and for any agent operating on the wiki.
Read it before ingesting, querying or linting.

**Scope: anything relevant to the project.** How harnesses really behave, what the services
the flow depends on really do, why the design is as it is, what outside work claims, and what
happens when several models implement one ticket. That last is the founding question, not the
only subject.

The shape is the LLM-wiki pattern: immutable sources in `raw/`, compiled pages in `wiki/`,
these conventions as the schema, and an append-only `log.md`. Knowledge is compiled once and
kept current, rather than re-derived from scratch each time somebody asks.

## Layers

| layer | what it is | who writes it |
|---|---|---|
| `<project>/.postmaster/` | where every run's full record lives, harness logs included; gitignored in its own project | every run, automatically |
| `raw/` | the runs somebody chose to keep as evidence, plus web captures; never edited, never committed ([the contract](../raw/README.md)) | ingest, by decision |
| `wiki/` | compiled pages, revised freely, every claim cited | ingest and query |
| `wiki/log.md` | append-only record of every operation | every operation |

## Page kinds

**`wiki/concepts/`** — a claim, with its standing and what would settle it. A hypothesis about
combining models is one kind; so is a finding about a harness, a service, or a design decision
and its reason. If it could be wrong and evidence bears on it, it is a concept.

**`wiki/sources/`** — one page per run, distilled from `raw/runs/<run-id>/`, in the shape of
[the template](sources/template.md). Numbers, not impressions, each citing the file it came
from.

**`wiki/entities/`** — a thing the other pages keep referring to: a lane, a harness, a target
project. Only when it has accumulated enough to be worth a page.

## Concepts against runbooks

`skills/postmaster/*.md` say what an agent **must do**: terse, current, authoritative. A
concept says what the project **knows**: the claim, what it rests on, how sure it is, what
would change it. A concept that settles may change a runbook, and then records that it did.
Never restate a runbook's instructions in a concept, and never put a standing or an argument
in a runbook.

## Front matter

Every page carries it:

```yaml
---
title: <one line>
type: concept | source | entity | schema
standing: claimed | supported | mixed | refuted | settled   # concepts only
sources: [runs/2026-09-22-postmaster-17]                    # raw ids this rests on,
                                                           # or trial/<what> for a recorded trial
updated: YYYY-MM-DD
---
```

## What may be published

`wiki/` is committed and served publicly; `raw/` is not. Everything written here is written
for that audience:

- **Numbers and outcomes, not transcripts.** A record may say a lane produced three findings
  of which two were corroborated; it may not quote the ledger line, the review note or the
  diff.
- **No instance detail.** No filesystem paths, hostnames, machine names, or the text of a
  ticket belonging to someone's private project. A target is named by its repository name
  where that repository is public, and by a stable label where it is not.
- **Provenance instead of evidence.** Each citation carries the `sha256` of the raw file it
  came from, so the holder of `raw/` can show the record matches and a reader can see what
  was counted.

When those pull against each other, the disclosure rule wins and the page says what it had to
leave out.

## Citations and links

- **`[@runs/<run-id>]`**, **`[@papers/<slug>]`**, **`[@articles/<slug>]`** cite a raw record.
  Every number and every claim taken from evidence carries one. A claim with no citation is
  marked `unverified` in the sentence that makes it, or it does not go in.
- **Outside work does not move a standing.** A paper may motivate a hypothesis and belongs in
  its "what would settle it"; only `[@runs/...]` records decide whether it holds here. A
  concept citing only papers stays `claimed`.
- **`[[page-name]]`** cross-references another wiki page. Link liberally; a link to a page
  that does not exist yet marks something worth writing.
- A run record cites the exact file: `[@runs/<id>/ledger.jsonl]`, `[@runs/<id>/card.md]`.

## Standing of a claim

Concepts carry one of these, and the log records every change:

- **claimed** — stated somewhere with no run record behind it yet
- **supported** — consistent with every run record that bears on it, and there are at least three
- **mixed** — run records on both sides; the page says what separates them
- **refuted** — contradicted by run records a defender of the claim would accept
- **settled** — supported, and the measurement that would refute it has been tried

## Operations

**ingest a run** — a run has ended. Copy `<dispatch>` into `raw/runs/<run-id>/` unchanged,
including each lane's events stream and its exported harness session, write a run record in
`wiki/sources/` from it, update the standing of every concept the record bears on, add the
cross-references, and append to the log.

**ingest a source** — a paper or article worth keeping. Capture the text into
`raw/papers/<slug>/` or `raw/articles/<slug>/` with its `source.md`, write a page in
`wiki/sources/` saying what it claims and what it would mean here if true, and link it from
every concept it bears on. It does not change a standing.

**query** — a question. Read the relevant pages, answer with citations, and where the answer
is worth keeping, file it back as a page rather than leaving it in a chat.

**lint** — health check, and part of the repo's gate: every page has front matter; every
claim has a citation or is marked unverified; every `[@...]` resolves to something in `raw/`;
every `[[...]]` resolves to a page; no orphan pages; no concept whose standing contradicts
the run records it cites; no page citing a run that has no raw record.

## Writing

Plain, short sentences. A number with the control that could have come out otherwise. Name a
target by its repository name only: no paths, hosts or people. Links are ordinary relative
markdown, so they work in the repository and on the published site alike.

## Publishing

GitHub Pages builds `wiki/` with Jekyll on every push to `main` that touches it
(`.github/workflows/pages.yml`). `raw/` is deliberately not published: it is evidence, read in
the repository. A `[@...]` citation is therefore a repository reference, not a web link.
