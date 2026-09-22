# raw — immutable sources

Everything the wiki's claims rest on, exactly as it was produced or found. **Nothing in this
directory is edited, corrected or deleted.** A page in `wiki/` may say a raw record is wrong;
it may not change the record.

That rule is what makes a claim checkable. A hypothesis in `wiki/concepts/` cites a record
here, so a reader can follow any standing back to its evidence and re-derive it. A wiki that
can edit its own evidence proves nothing.

## What lands here

```
raw/runs/<run-id>/        one finished postmaster run, copied in whole when it ends
  ledger.jsonl            every action, one JSON line, from scripts/log-action.sh
  run-log.md              the coachman's narrative
  card.md                 the ship card
  logs/                   one harness events stream per lane and per review round
  sessions/               each lane's durable harness record, exported at teardown
  reviews/  handoffs/     the review notes and the hand-off between legs

raw/papers/<slug>/        a paper: the PDF or text, plus source.md
raw/articles/<slug>/      an article, post or documentation page, plus source.md
```

Two kinds of evidence, one rule. A **run** is what this fleet did, and it answers questions
about this fleet. A **paper or article** is what someone else claims, and it answers nothing
on its own: outside work is a source of hypotheses, not of standings. A concept may cite a
paper for the claim it makes and must still cite runs for whether it holds here.

Every web capture carries `source.md` beside it:

```yaml
---
url: <the page>
retrieved: YYYY-MM-DD
title: <as published>
author: <as published, or unknown>
---
Why it was captured, in a sentence.
```

Capture the text, not a link alone: a link rots and a citation to a moving page is not a
citation. Fetching is bounded by the machine's egress allowlist, so a source behind a
disallowed host is one the user supplies rather than one the wiki fetches.

## What does not land here

Anything written to make a point about this project: notes, summaries, arguments,
conclusions. Those belong in `wiki/`, where they can be revised and where their standing is
tracked. Raw is only what a run produced or what was published elsewhere.

A run is copied in when it ends, never while it runs: a live run is still writing, and a
citation to a moving file is not a citation.

Secrets never land here. A ledger carries actions, not credentials, and a harness session can
carry anything that was on screen; check before copying.
