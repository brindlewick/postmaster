# raw — immutable sources

Everything the wiki's claims rest on, exactly as it was produced. **Nothing in this
directory is edited, corrected or deleted.** A page in `wiki/` may say a raw record is wrong;
it may not change the record.

That rule is what makes a claim checkable. A hypothesis in `wiki/concepts/` cites a run
record in `wiki/sources/`, which cites files here, so a reader can follow any standing back
to the evidence and re-derive it. A wiki that can edit its own evidence proves nothing.

## What lands here

```
raw/runs/<run-id>/        one finished postmaster run, copied in whole when it ends
  ledger.jsonl            every action, one JSON line, from scripts/log-action.sh
  run-log.md              the coachman's narrative
  card.md                 the ship card
  reviews/                the review notes of each round
  handoffs/               the written hand-off between legs
```

A run is copied in when it ends, not while it runs: a live run is still writing, and a
citation to a moving file is not a citation. `<run-id>` is the dispatch directory's own name,
so the wiki and the ledger agree on what a run is called.

## What does not land here

Anything a person wrote to make a point: notes, summaries, arguments. Those belong in
`wiki/`, where they can be revised and where their standing is tracked. Raw is only what a
run produced.

Secrets never land here. A ledger carries actions, not credentials; check before copying.
