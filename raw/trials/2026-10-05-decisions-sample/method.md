# The decisions of eight tickets, marked by what could have settled them

One question for candidate 8 of [pstack](../../../wiki/sources/pstack.md): how many of the decisions a
ticket puts to the user are ones that running something could have settled? The conclusions are in that
page, not here.

## What was read

The eight tickets of this repository that were closed on 2026-10-04 or 2026-10-05 and hold three or
more decisions: #251, #252, #259, #237, #265, #291, #287 and #227. The rule was fixed before any
decision was read. The other five closed in those days hold fewer: #282 one decision, #298 two, and #218, #256
and #257 none. #258 had not landed. The bodies came from one `gh issue list --state all --json
number,title,body` call on 2026-10-05. The decisions are the lines of the `## Decisions` section that
begin `- **D<n>`.

**Controls.** Counting those lines gave 20, 14, 11, 8, 3, 3, 3 and 6, which is 68. The same count with a
heading that is not in any ticket gave 0.

## How a decision was marked

The test applied to each: if the clerk had run everything runnable at the base and read the
repository, would the choice still be open? If yes, the mark is **U**. If something run or measured
settled it, **R**. If an existing rule or precedent in the repository settled it, **K**. Where a mark
was close, the table says so. A decision that the writer of the ticket had already settled by
running something before writing it can show only through its reason, so only a reason that says so can
be marked R.

## What the marks are

One reader's marking of the decisions as signed off, in `results/marks.md`. No second reader marked them.
The user has not read the marks. A spot check of five rows against the tickets (#237 D2 and D7, #227 D1,
#251 D18 and D19) found each mark consistent with the decision and its reason. Five of the eight tickets
(#251, #252, #259, #237, #227) were prepared in hand-started ticket sessions before the booking clerk
existed, #265 was marked ready by the new command four minutes after #251 merged, and #287 and #291 are
docs-only.

## What it does not show

What the writer settled before writing the list is not visible in the end state, so a decision that
running removed cannot show up here. The sessions where the tickets were prepared, and the user's
comments on the drafts, are private and were not read. Eight tickets and one reader are a small sample.
