---
title: Run records
type: source
updated: 2026-09-22
---

# Run records

One page per finished run, compiled from `raw/runs/<run-id>/` in the shape of
[the template](template.md). Newest first.

None yet. The first will arrive from the first dispatch that reaches a ship card.

A record is written by **ingest**, never by the run itself: a run writes to its dispatch
directory, that directory is copied whole into `raw/` when it ends, and the record is
compiled from the copy. See [how the wiki is kept](../schema.md).
