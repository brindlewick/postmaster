# raw — immutable sources, local to this instance

Everything the wiki's claims rest on, exactly as it was produced or found. Two rules, and the
second is as important as the first.

**Nothing here is edited, corrected or deleted.** A page in `wiki/` may say a raw record is
wrong; it may not change the record. That is what makes a claim checkable: a hypothesis cites
a record here, so whoever holds this directory can follow any standing back to its evidence
and re-derive it. A wiki that can edit its own evidence proves nothing.

**Nothing here is committed.** `.gitignore` excludes it, this file aside. postmaster is a
tool other people run against their own projects, and this repository is public. A run's
ledger, narrative and harness sessions carry that instance's paths, ticket text and whatever
was on screen; none of it belongs in the tool's history, and a run against somebody's private
project is not the tool's business. The wiki commits **what it compiled, never what it
compiled from**.

**Nothing arrives here automatically.** Every run already writes its full record, harness
logs included, to `<project>/.postmaster/`, which is where a run's evidence lives by default
and which is gitignored in every project. A record is copied into `raw/` only when somebody
decides this particular run is worth keeping as evidence for a claim. That keeps the research
set small and deliberate, and it keeps the decision with a person: most runs are operational,
a few are evidence.

So a citation here is verifiable by whoever holds this directory and is a claim of provenance
to everyone else. A compiled record therefore carries the numbers themselves plus the
`sha256` of the raw file they came from, so the holder can prove the record was not drifted
from and a reader can see exactly what was counted. That is the honest limit of a public
research note, and the alternative — publishing the evidence — is not available.

## What lands here

```
raw/runs/<run-id>/        one finished run, copied by choice from <project>/.postmaster/
  ledger.jsonl            every action, one JSON line, from scripts/log-action.sh
  run-log.md              the coachman's narrative
  card.md                 the ship card
  logs/                   one harness events stream per lane and per review round
  sessions/               each lane's durable harness record, exported at teardown
  reviews/  handoffs/     the review notes and the hand-off between legs

raw/papers/<slug>/        a paper: the PDF or text, plus source.md
raw/articles/<slug>/      an article, post or documentation page, plus source.md
```

A run's own home is `<project>/.postmaster/runs/<run-id>/`, not here: that directory holds
everything a run produced, including the raw harness logs, and is gitignored in whatever
project it belongs to. `raw/` holds the subset somebody chose to keep.

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

Secrets never land here, and being uncommitted is not a reason to relax: a harness session can
carry anything that was on screen, and this directory sits inside a working tree where a stray
`git add -f` or a future change to `.gitignore` would expose it. Scrub before copying.
