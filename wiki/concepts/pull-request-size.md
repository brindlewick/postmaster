---
title: A pull request meant for a person to review aims at 200 changed lines and never passes 400
type: concept
standing: claimed
sources: []
updated: 2026-10-24
---

# A pull request meant for a person to review aims at 200 changed lines and never passes 400

**Claim.** A person reviews a small pull request soon and a large one late or not at all, so a
project whose runs open pull requests for a person to review keeps each to a budget: it aims at
200 changed lines and never passes 400. The cap is a hard limit, so no pull request over it is
opened for review: work that will not fit is split, or lands in increments behind a feature flag.
Changed lines are lines added plus lines removed, tests included, generated files left out.

**Standing: claimed.** This is the user's decision of 2026-10-24, taken after reading published
guidance on review size, and the user's rulings the same day: the cap is hard, a cap named in the
settings turns the budget on by itself, the user answers a split request, and the ticket carries
only the clerk's number. No run of this fleet bears on it yet, and nothing here shows that smaller
pull requests get better reviews or fewer defects.

## The reasoning

- **One number a script can recount.** `git diff --numstat` over the range a pull request shows
  gives the lines added and removed in every file, so the size of a branch is a count of the pull
  request's own diff and not a promise.
- **Tests count; generated files do not.** A reviewer reads a test as closely as the code it
  tests. Nobody reads a lock file, a translation catalog, a vector image or a generated file line
  by line, and a binary file has no lines. A file deleted whole counts as one line.
- **Two numbers.** The aim is what the booking clerk plans each ticket to. The cap is a line the
  user drew and not a prediction, and the flow does not pass it: no exception is offered at the
  cap. An estimate that lands a little over the aim is normal.
- **The ticket carries only the number.** The clerk thinks through how it would build the ticket to
  get its estimate of the changed lines, and writes the number alone under `### Size`: no files, no
  approach, no steps. A list of files and expected changes would steer the coachman's own thinking,
  so the thinking stays off the ticket, the ready check refuses a Size section that holds more, and
  the waybill's copy of the ticket never carries the section. The number is for the ready check and
  the user.
- **It applies where a person reviews, or where the project asks.** A project's runs open draft
  pull requests, which a person marks ready for review, when `ship.draft_pull_requests` is on, and
  the budget then applies with its defaults. A project that merges locally has no reviewer to
  spare and no budget, unless it names a number for `pr_size_cap`, which turns the budget on by
  itself and outranks `draft_pull_requests = "off"`. An aim alone turns nothing on, since the cap
  is the limit, and a project that wants no limit says so with `pr_size_cap = "off"`, even where
  drafts are on.
- **The clerk splits before the code is written.** A plan above the cap becomes tickets that each
  merge alone: the refactors first, then the thinnest slice that works from end to end, then one
  behaviour at a time. Where the pieces cannot stand alone as working slices, the increments land
  behind a feature flag, the project's own: one ticket per increment, each within the cap and each
  stating the flag in its own words, the flag off until the last increment turns it on. Cutting a
  built branch apart afterwards is the costly way to the same end, which is why a branch is counted
  at the end of the synthesis leg, before any review round.
- **The numbers are published guidance and not a measurement here.** One widely cited review study
  advised keeping a review to 200 to 400 lines, and a large software company's published
  engineering guidance calls about 100 lines a reasonable change and about 1,000 too large
  (unverified: none of it is captured under `raw/`).

## What it costs

- A change that is one thing but large, such as a rename across the tree or a dependency bump,
  gets no exception. It is split by folder or package, and the pieces land in order.
- An estimate is a guess and the count is the measure, so a branch can pass the clerk and still
  stop at the cap. The coachman counts at the end of the synthesis leg and again before the card,
  and the postmaster counts once more at landing, since a review fix or the merge of main can grow
  a branch. A branch over the cap is not carried on: the coachman stops with a split request, the
  postmaster puts it to the user, who chooses how the work is split or put behind a feature flag,
  never whether, and the work goes back to the clerk. Slices that depend on one another land in
  order, which can lengthen the time to the whole.
- Nobody accepts a size once or raises the cap in the flow. A new cap is the user editing the
  project's setting.
- A feature flag leaves code on the default branch switched off until the last increment turns
  it on, and the flag is removed later.

## What would change it

- This fleet's own pull requests, with the time to first review and to merge by size band: if the
  bands do not differ, the cap does nothing and the aim is a preference.
- Reviewers saying the count does not track their effort, for instance that tests or deletions
  weigh differently from added code.

## What changed because of it

`pr_size_aim` and `pr_size_cap` in `project.toml` or the person's `settings.toml`
([the settings](project-settings.md)), and `scripts/run pr-size`, which counts a change against
them. The clerk plans to the budget, writes only its number under Size, and `ticket-ready` holds
that number to the cap ([the ticket's shape](ticket-shape.md)). The waybill states the budget and
that its cap is hard and carries the ticket without its Size section, the ship card carries the
count, and the coachman stops with a split request instead of an oversize branch. The postmaster
recounts when it gets a request and again at landing; over the cap it puts the request to the user
as an ordinary escalation and, on the answer, sends the ticket back to the clerk.
