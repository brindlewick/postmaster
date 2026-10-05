# What a fixture run costs in time, and how it has changed

One question for candidate 5 of [pstack](../../../wiki/sources/pstack.md): how long does a fixture run take
now, and what is the spread so far? The conclusions are in that page, not here.

## What was read

On 2026-10-05, between about 04:55 and 05:10 UTC, the folder that `scripts/run fixture new` writes its
copies to: 70 folders, of which 60 hold a run record, all of the fixture ticket `remove`. For each, the
table `results/fixtures.tsv` gives the flow commit the run was dispatched from (`toolcommit`), the time
the record was written, the first and last action in the copy's `actions.jsonl` and the minutes between them
rounded down (`dur_min`, which includes the wait for the postmaster to land the card), the stage in the
run's manifest, the lane set from the run's `run.json`, the number of stage lines and the number of review
rounds. A copy with no run record has blank cells. Nothing was run and no copy was changed.

`results/medians.out` gives the minimum, median, mean and maximum of `dur_min` for the runs that ended
`done`, in groups, computed from the table. A spot check of three rows against their action logs
(`202-remove-2`, `217-remove`, `218-remove-final-2`) gave the same times to within a minute.

**Controls.** The groups add up: 50 `done`, 10 `abandoned` and 10 folders with no record make the 70. A lane set
that no run has (`zzqx`) holds 0 runs. The group of 27 earlier runs with a MiMo Code lane has a median of
101 minutes and a mean of 127, which agrees with the figure in the ticket for #265, "about 2 hours 10
minutes", read as the time of one of the last eleven runs.

## What it does not show

The fixture folder is live: two runs were still going while it was read. The table says nothing of a run's
score, which `scripts/run fixture score` prints and does not save. A fixture run is the flow at its lowest
efforts on one small ticket that every lane passes, so its time is the time of that setup and not of a
real ticket.
