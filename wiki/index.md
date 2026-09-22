---
title: postmaster wiki
type: schema
updated: 2026-09-22
---

# postmaster wiki

What this project has learned, compiled once and kept current, instead of being re-derived
from chat histories and scattered across pull requests.

Anything relevant to postmaster belongs here: how harnesses actually behave, what trackers
and their APIs really do, why the design is shaped as it is, what outside work claims, and
what happens when several models implement one ticket. The last of those is the project's
founding question, not the wiki's only subject.

It follows the LLM-wiki pattern. [`raw/`](../raw/README.md) holds the evidence these pages
rest on, committed beside them and never edited: promoted runs, recorded trials, and papers
and articles captured from elsewhere. Pages here compile it, every claim cites what it rests
on, and [the log](log.md) records each operation. A run or a trial can move a standing;
outside work can only motivate one.

**Nothing arrives in `raw/` on its own.** A run's full record goes to its own project's
gitignored `.postmaster/`. Promoting one is a separate decision, and it is a decision to
publish: it happens only after a scrub, only when the target may be published, and only
carrying what may lawfully be redistributed. Most runs are operational and stay where they
are. What that buys is the thing a wiki with sources exists for — clone this repository and
you can follow any standing to the record behind it and count again.

[How the wiki is kept](schema.md) is the contract. Read it before ingesting, querying or
linting.

## Areas

**Combining models** — the founding question: does implementing one ticket with several
models in blinkers produce better software than one good model, and through which mechanisms?

- [Combining models](concepts/combining-models.md) — three hypotheses and five open
  questions, all **claimed**: no run records yet.

**Harnesses** — how each agent CLI really behaves, as distinct from what its documentation
says. `skills/postmaster/harnesses.md` is the operating contract; pages here are what was
found and how.

- [Prompt delivery differs by harness](concepts/prompt-delivery.md) — **settled**.

**Trackers and tooling** — what the services and CLIs the flow depends on actually do.

*Nothing yet.*

**Decisions** — why the design is as it is, so a later reader finds the reason rather than
re-litigating it.

*Nothing yet.*

**Sources** — [run records and captured reading](sources/index.md), and
[the run record template](sources/template.md).

**Entities** — a harness, a lane or a target project, once the other pages keep referring to
it. *Nothing yet.*

## What belongs here, and what belongs in a runbook

`skills/postmaster/*.md` say what an agent **must do**: terse, current, authoritative, no
argument. The wiki holds what the project **knows**: a claim, what it rests on, how sure it
is, and what would change it. A finding here that settles may well change a runbook, and the
page then records that it did. Do not restate a runbook's instructions here, and do not put a
standing or an argument in a runbook.

## State

| | |
|---|---|
| raw runs | 0 |
| raw papers and articles | 0 |
| compiled records | 0 |
| concepts | 2 pages |

Only one page carries evidence so far, and it says how it was obtained. Every claim about
combining models is `claimed`: those came from the README, which drew on runs made before the
ledger existed and which therefore cannot be cited.
