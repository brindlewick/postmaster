---
title: How the wiki is kept
type: schema
updated: 2026-09-22
---

# How the wiki is kept

This page is the contract for every other page, and for any agent operating on the wiki.
Read it before ingesting, querying or linting.

The shape is the LLM-wiki pattern: immutable sources in `raw/`, compiled pages in `wiki/`,
these conventions as the schema, and an append-only `log.md`. Knowledge is compiled once and
kept current, rather than re-derived from scratch each time somebody asks.

## Layers

| layer | what it is | who writes it |
|---|---|---|
| `raw/` | what runs produced and what was published elsewhere, never edited ([the contract](../raw/README.md)) | a finished run, or a web capture |
| `wiki/` | compiled pages, revised freely, every claim cited | ingest and query |
| `wiki/log.md` | append-only record of every operation | every operation |

## Page kinds

**`wiki/concepts/`** — a claim about how the fleet behaves, with its standing and what would
settle it. This is where the hypotheses live.

**`wiki/sources/`** — one page per run, distilled from `raw/runs/<run-id>/`, in the shape of
[the template](sources/template.md). Numbers, not impressions, each citing the file it came
from.

**`wiki/entities/`** — a thing the other pages keep referring to: a lane, a harness, a target
project. Only when it has accumulated enough to be worth a page.

## Front matter

Every page carries it:

```yaml
---
title: <one line>
type: concept | source | entity | schema
standing: claimed | supported | mixed | refuted | settled   # concepts only
sources: [runs/2026-09-22-postmaster-17]                    # raw ids this rests on
updated: YYYY-MM-DD
---
```

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
