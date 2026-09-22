---
title: postmaster wiki
type: schema
updated: 2026-09-22
---

# postmaster wiki

Research notes on what happens when several models implement the same ticket at once,
compiled from the runs themselves.

The question it exists to answer: **does combining models produce better software than one
good model, and if so, through which mechanisms?**

It follows the LLM-wiki pattern. [`raw/`](../raw/README.md) holds the evidence these pages
rest on and is never edited: runs somebody chose to keep, and papers and articles captured
from elsewhere. Pages here compile it, every claim cites what it rests on, and [the log](log.md)
records each operation. A run can move a claim's standing; outside work can only motivate one.

**Nothing arrives in `raw/` on its own.** A run's full record goes to that project's own
gitignored `.postmaster/`; a copy is promoted to evidence by decision, because most runs are
operational and only a few bear on a claim. `raw/` is not committed either: postmaster is a
tool others run against their own projects, and a run carries that instance's paths and
ticket text. What is published is what was compiled — counts, outcomes and the hash of the
file each came from — never the evidence itself. [How the wiki is kept](schema.md) is the contract, and any agent working here
reads it first.

## Catalog

### Concepts

- [Combining models](concepts/combining-models.md) — the hypotheses, their standings, and what
  would settle each. All **claimed**: no run records yet.

### Sources

- [Run records](sources/index.md) — one page per finished run. None yet.
- [Run record template](sources/template.md) — the shape every record takes.

### Entities

None yet. A lane, a harness or a target project gets a page here once the other pages keep
referring to it.

## State

| | |
|---|---|
| raw runs | 0 |
| raw papers and articles | 0 |
| compiled records | 0 |
| concepts | 1 page, 3 hypotheses, 5 open questions |
| every standing | claimed |

Nothing here is evidence-backed yet, and the pages say so. That is the honest starting
position: the claims come from the README, which drew on runs made before the ledger existed
and which therefore cannot be cited.
