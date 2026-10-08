---
kind: trial
subject: what one run of the flow would cost on Cloudflare Containers and as pay-per-token model use, from the lane audit's times and token counts, and which of the flow's scripts lean on one machine
date: 2026-10-08
---

# Method

**Question.** [Issue #341](https://github.com/brindlewick/postmaster/issues/341) asks whether the flow could run on
Cloudflare, with Workers as the control plane and Containers for the lanes. Its third criterion asks what a run
would cost there: instance-hours from the lane audit's times, and the model bill if API keys replace subscription
logins, from the audit's token counts. This trial computes those two figures and the controls that could have
made them come out wrong. It answers a question about arithmetic on the fleet's own records. It does not show
that the flow runs on Cloudflare, which needs a trial of its own.

**Inputs.**

- The lane audit's derived data, `../2026-10-03-lane-audit/results/runs.json`, committed: 18 real runs and 24
  fixture runs that reached synthesis, with each lane's seconds, each reviewer's exit, each gate run's seconds and
  each stage's seconds. Nothing in that file was changed.
- Two things the audit's file does not hold, read once on 2026-10-08 from the runs' own records, read-only, and kept
  only as derived numbers that name no path, thread or session: the uptime of each coachman thread's last process
  (`results/coachman-uptime.json`), from the session exports; and the tokens of every workhorse, reviewer and
  coachman launch split by kind (`results/tokens-by-kind.json`), from each launch's own events stream and the
  coachman's session export.
- The rates. Cloudflare's: the Containers pricing page and instance-types partial of the documentation
  repository at commit 6e1b96433cf016efd2c0c9057a7e27a8e112376f, read on 2026-10-08. The models': each vendor's own
  pricing page, read on 2026-10-08, with the page and tier in `results/prices.json`.
- The flow's scripts, `scripts/` and `scripts/lib/` of this repository at the base of this branch, for the table of
  what they lean on.

**Definitions.**

- *A launch* is one workhorse lane, one reviewer or one coachman leg. The costing assumes each runs in a container
  of its own, started when it starts and stopped when it exits.
- *Lane seconds*: from the start of implementing to the exit of the lane's process, as the lane audit defines them.
- *Reviewer seconds*: each reviewer's exit less the first launch line of its round, for rounds that have a launch
  line and an exit marker; the audit's `roundTimes`. A round with no launch line is left out, so the sum reads low.
- *Gate seconds* are the coachman's runs of the gate on a branch. They run inside a container that exists anyway, so
  they are shown and not added.
- *The coachman's seconds* are bracketed. The floor is the sum, over a run's coachman threads, of the uptime of the
  thread's last process, from the session export; a thread resumed after a stop ran in several processes and the
  export keeps only the last, so the sum is a floor. The ceiling is the seconds in the stages in which a leg can run
  (planning, workhorses running, synthesis, checkpoint, review), which counts the user's wait for a spec review.
- *Cost of container time*: seconds times the per-second rate of an instance type, memory and disk for what the type
  provisions and CPU for active use only, from the Containers pricing page. The audit holds no CPU measurement, so
  CPU use is bracketed at none, a quarter and all vCPUs busy. List rates; the monthly allowance is not taken off,
  and `cost.ts` reports how far it goes.
- *Tokens by kind*: uncached input, cache reads, cache writes and output. Codex's and Muse Code's input includes
  cache reads, MiMo Code's and Claude Code's leaves them out, which is why the audit's input counts do not mean the
  same thing across harnesses. Reasoning tokens are counted as output (MiMo Code reports them apart; codex includes
  them).
- *Model bill*: the tokens of each kind times the vendor's rate for that kind. For Claude Code the figure is the
  dollars the harness reported, which are cumulative for the session; its top-level usage is the last iteration's and
  reads low. "If no cache hit" prices every input token at the plain input rate and brackets what the vendors'
  caches do.

**Counts and controls.** Every count has a control, listed with its result in
[results/controls.md](results/controls.md), 18 in all, and `apparatus/controls.test.ts` runs them against the
committed data. They include: the audit's own published gate totals reproduced through the new code (36 lane-branch
gate runs, 6.5 hours; 260 synthesis runs, 43.5 hours); one lane's seconds recomputed from its two timestamps; that
lane's cost recomputed by hand; a run with nothing in it reading zero everywhere; the coachman's floor below its
ceiling in all 14 runs that have both, and the same comparison swapped failing in all 14; the token totals by role
reproducing the audit's published ones (coachman 1478M in and 5253k out, codex reviewers 119 launches and 240M in,
codex workhorses 18 launches and 438M in, Opus 71 launches and $644.17); and Claude Code's reported dollars
recomputed from each launch's own per-model tokens at the published Opus 5.5 prices, inside the bracket from all
cache writes at five minutes to all at one hour for 61 of 61 launches that used one model, against 0 launches when
the same arithmetic uses Opus 4.1's prices. The unit tests beside each module hold the other positive and negative
cases, 65 tests in all. They show the code applies a rule the same way on a case that must read non-zero and one that
must read zero. They cannot show that the rule is the right one.

**To repeat.** From a checkout of this repository, with the run folders for the two steps that read them:

```
bun apparatus/uptime.ts --runs <ids> --dir <runs folder> [--dir <another>] --out results/coachman-uptime.json
bun apparatus/measure.ts --audit ../2026-10-03-lane-audit/results/runs.json --runs <ids> --dir <runs folder> --out results/tokens-by-kind.json
bun apparatus/primitives.ts --repo <checkout> --out results/script-primitives.md
bun apparatus/run.ts          # instance-time.json, instance-time.md, cost.md
bun apparatus/model-bill.ts    # model-bill.md
bun apparatus/controls.ts      # controls.md
bun apparatus/quotes.ts --notes ../../articles/<capture>/passages.md --root <cloudflare-docs>/src/content   # quote-check.md
bun apparatus/quotes.ts --page <page.md> --capture ../../articles/<capture>/passages.md ...
bun test apparatus/
```

A reader without the run folders runs `run.ts`, `model-bill.ts`, `controls.ts` and the tests alone and gets every table from the committed
data. The quote check needs a checkout of `cloudflare-docs` at commit 6e1b96433cf016efd2c0c9057a7e27a8e112376f. `uptime.ts` and
`measure.ts` refuse to write anything that looks like a path. `passages.ts` turned the readers' notes into the passages files of
the ten captures.

**Limits.**

- Every figure is the fleet's own, for 18 real runs of one repository over about a week, on the flow as it stood
  then. A different ticket mix gives different seconds.
- The costing puts every launch in a container of its own and starts none early or late. A design that shares a
  container between roles, or keeps one warm, costs differently.
- Instance sizes were not measured. The machine's own caps were 8 GiB for a launch and 16 GiB for the coachman after
  a kill at 8; the largest Cloudflare instance has 12 GiB. Whether a lane or the coachman fits is not shown here.
- The gate's seconds are the machine's, under its load. On a container with its own CPU they may be less or more.
- CPU use is bracketed, not measured.
- The coachman's floor leaves out earlier processes of a resumed thread; its ceiling counts waits for the user. The
  true figure is between. Four of the 18 runs have no session exports and are missing from the floor, and from the
  coachman's tokens, as they are from the audit's own coachman figure.
- Reviewer seconds read low where a round has no launch line, and high where a lane was restarted after a kill:
  the longest single reviewer is 344 minutes.
- The model bill prices the lanes at pay-per-token list prices. The MiMo lane ran on a Token Plan billed in credits,
  and Meta's contributor tier lets the vendor train on what is sent. Under a subscription the contributor model gives
  no discount (Meta's Terms 13.4, read the same day).
- Fixture runs are cheap and short and say little about a real ticket's tokens. Their tokens were not measured here;
  the trial's cost for a fixture lane uses the audit's medians.
- A price is the vendor's page on the day it was read. Pages carry no date of their own, and prices change.
- The scan of scripts counts files that match a pattern. A file that reaches a machine primitive through a library the
  patterns do not name is missed, and a match is a file that uses the primitive, not a measure of how much.
