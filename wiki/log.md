---
title: Log
type: schema
updated: 2026-09-26
---

# Log

Append-only. Newest first. One entry per operation, prefixed so it can be parsed.

## [2026-09-26] ingest | fixture runs test the flow end to end

First page in a new Testing the flow area. A small app with two tickets whose outcome is known,
one tightly specified and one open in design, each with acceptance tests written before any run
and kept out of every run. A fixture run is scored from its records rather than its report, and
a change to the coachman contract now merges only after one scores clean. The page records why
the tests are hidden and how a fixture run gets its ticket: a GitHub repository kept for fixture
tickets, since the waybill-only route skips the postmaster's own check of the ticket and the
tracker with no service does not exist yet. Standing `claimed`, since no fixture run has been
recorded.

## [2026-09-26] lint | the review loop's cap is three rounds

The review loop's round cap goes from five rounds to three, by the user's decision, after #39's
own review ran four rounds without a clean one and stopped on the repeated-class rule. It holds
until #59, the research on what should end an AI review loop, reports. `coachman.md` and the
decision page now say three.

## [2026-09-25] ingest | review runs as one loop

A decision page. Style, bug and security review no longer run one after another in three legs.
One leg runs one loop: every lens still open, in each round, on one snapshot, with style in
round 1 only. A run now has three legs: synthesis, review and ship. The page records why, what
the loop is expected to cost, and what the stage timings will measure. Standing `claimed`,
since no run has been recorded under either design.

## [2026-09-25] ingest | a ticket's shape is checked before it is accepted

Second page in the Decisions area. A ticket now carries a direction after its acceptance
criteria, and a script checks its shape before the postmaster accepts it: a title, the problem
or feature, numbered criteria each answerable yes or no, and the direction. What is missing is
proposed to the user, and only their answer is written back. The page also records what the
script can judge of "answerable yes or no", and why hedging words were left out. Standing
`claimed`, since no run bears on it yet.

## [2026-09-23] lint | workhorse replaces arm

The project no longer says arm for a lane that implements the ticket; it says workhorse, and a
workhorse's own plan is the workhorse spec. The decision page is renamed to match, as is the
template it describes. Entries below that say arm or horse stand as written.

## [2026-09-23] ingest | a horse's spec uses Spec Kit's plan and tasks format

Captured GitHub Spec Kit's spec, plan and tasks templates into
`raw/articles/spec-kit-templates/`, with their MIT license, pinned to one commit. A horse's
A horse's own spec now follows the plan and tasks templates in one file; the ticket plays the part of
Spec Kit's spec. The decision page records the mapping and the three adaptations. The source is
outside work: it shapes the format and does not move the page's standing, which stays
`claimed`.

## [2026-09-23] ingest | each horse drafts its own spec

First page in the Decisions area. The ticket carries the what, the why and the high-level
direction; each horse then drafts its own detailed spec, committed before any code. It keeps the
horses independent and the coachman a neutral judge, and at this stage it is an audit record
that nobody reviews during the run. Standing `claimed`, since no run bears on it yet; issue #9
is the test.

## [2026-09-22] lint | lint claims only what it checks

The skill introduced its list of checks with "what it enforces", but the script did six of
the ten, one only in part, and three need a person. Both the skill and the schema also called
lint part of the repo's gate, which does not exist yet. The two missing checks that are
mechanical now run: a capture's `source.md` must give a url and a retrieval date, and a
standing beyond `claimed` must rest on at least one run or trial, with every front-matter
source resolving under `raw/`. The documentation now separates what the script checks from
what a person checks, and the self-test has a failing case, asserted on its own reason, for
every check the script claims.

## [2026-09-22] lint | the homepage is for readers

The homepage carried instructions meant for whoever maintains the wiki: how evidence reaches
`raw/`, an order to read the schema before operating, the line between a concept and a
runbook, and a table counting records. None of it helps someone reading the wiki, and all of
it already lives in `raw/README.md` or the schema. The homepage now says what the wiki covers,
how to read a standing and a citation, and lists the pages. It is also what the postmaster
reads before decomposing a stream, so a shorter page costs less on every run.

## [2026-09-22] lint | sources hold what was chosen, not every run

The sources index still said "one page per finished run" and that the first would arrive from
the first dispatch to reach a ship card, which described the first draft rather than the
design. Nothing reaches `raw/` or `sources/` on its own: a run's record stays in its project's
`.postmaster/` unless somebody promotes it. The index, the schema's page kinds and the wiki
skill now say so, and say that a captured paper or article also gets a sources page while a
recorded trial is cited directly. The skill's description, which decides when an agent loads
it, still described the wiki as answering only the multi-model question from run ledgers;
it now matches the scope and the three kinds of evidence.

## [2026-09-22] lint | raw is committed, and promotion is the gate

`raw/` had been gitignored on the grounds that logs are public-unsafe and instance-specific.
That reasoning outlived its cause: everything automatic now lives in each project's
`.postmaster/`, so reaching `raw/` is already a deliberate act. Making that act the publication
decision — scrub, publishable target, lawful redistribution — lets the evidence be committed,
which is the point of a wiki with sources: a standing can be followed to the record behind it
by anyone who clones the repository. The sha256 provenance mechanism goes with it, since git
supplies integrity. The entry below headed "raw made local and uncommitted" is the one this
reverses, and it stands as written: this log is append-only, and it is accurate as a record of
what was decided at the time.

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
