---
title: Before 1.4.2, Muse Code ended a model call that streamed nothing for 180 seconds
type: concept
standing: settled
sources: [trials/muse-stream-timeouts]
updated: 2026-10-01
---

# Before 1.4.2, Muse Code ended a model call that streamed nothing for 180 seconds

**Claim.** Once a model call has streamed a reasoning summary or any output, Muse Code 1.4.0 and
1.4.1 end it when 180 seconds pass with no further event, and does not retry it. The Meta API streams
at most ten reasoning summaries per response and then nothing until the answer. So a call that
is still reasoning 180 seconds after its last summary fails with "model stream idle timeout
after 180000ms", and the leg that made it ends with no hand-off. The limit is an environment
variable Muse Code does not document, `TBH_STREAM_IDLE_TIMEOUT_SECS`. A lower reasoning effort
does not avoid the failure on a problem that needs long reasoning. Muse Code 1.4.2 fixes it:
a call still reasoning has a separate limit, and a call that stalls is retried.

**Standing: settled**, for Muse Code 1.4.0-R4302.1 on `muse-spark-1.3-contributor`, and rechecked
on 1.4.1-R4380.1. The failure was reproduced on the real API. Each part was then tested against a mock of the API, including
the settings that could have shown otherwise [@trials/muse-stream-timeouts]. On 1.4.2 the same
trial no longer fails.

## The three legs

On 2026-09-28 and 29, three coachman legs ended this way. Each was one attempt of one model
call, and none was retried [@trials/muse-stream-timeouts].

| leg | what it had just done | context | last event | then silent | call ended after |
|---|---|---|---|---|---|
| #114 leg 2, review | read the round-1 verdicts, tore the round down | 121k tokens | about 149 s in | 180 s | 329.3 s |
| #18 leg 1, synthesis | read both workhorses' diffs, decisions and gaps | 265k tokens | about 148 s in | 180 s | 328.0 s |
| #18 leg 2, review | read the round-1 verdicts of every lens | 173k tokens | about 145 s in | 180 s | 325.2 s |

Each had just gathered what one of the coachman's hardest calls needs: ruling on a round's
findings, or choosing what the synthesis takes from each workhorse. Of the fleet's 7,688 Muse
Code model attempts up to 01:49 UTC on 2026-09-29, these three are the only ones that ended on
the idle timeout. The long calls that succeeded level off at about 50 wire events, which is ten
summaries and the answer's events. Later that day, while Muse Code 1.4.1 was installed, #135's
synthesis leg ended the same way twice [@trials/muse-stream-timeouts].

## Why the stream goes quiet

While the model reasons, the Meta API streams short reasoning summaries
(`response.reasoning_summary_part.*`), one every 2 to 36 seconds in the trial. Every long
response recorded stopped at ten, `summary_index` 0 to 9, or fewer. The model kept reasoning
after that, and nothing came until its answer [@trials/muse-stream-timeouts].

- A hard sudoku at `max` sent 9 summaries in 195 s, then nothing, and failed 180 s later.
- A sudoku made for the trial, which no model has seen, did the same at every effort, `low`
  to `max`: nine or ten summaries within 96 to 141 s, then silence, then the failure.
- With the limit raised to 900 s, the same sudoku at `max` was silent for 197 s after its tenth
  summary, then answered with the right solution. At `xhigh` it was silent for 538 s and also
  answered right, taking twice as long. At `high` it spent all 128,000 output tokens reasoning
  and never answered: the response ended `incomplete`, and Muse Code ended the run as completed,
  with no text and exit 0.

A lower effort is no way out. On a problem that needs long reasoning, every effort reasons past
its tenth summary, and the lower ones reasoned longer or ran out of tokens.

## What it is not

- **Not the machine's load.** The silence is on the wire: Muse Code's transport trace logs each
  SSE event as it is read, and none was read. The trials ran at the same load as the fleet,
  about 27 on 18 cores, and Muse Code's timers fired within 0.1 s of their limits.
- **Not a dead provider.** The model was still working. With the limit raised, the call that
  had failed answered after 197 s of silence, and correctly.

## What Muse Code does, and what changes it

Tested against a loopback mock of the Meta API (`--base-url`), and on the real API where marked
[@trials/muse-stream-timeouts].

| on the stream | Muse Code |
|---|---|
| a reasoning summary, then silence | fails after `TBH_STREAM_IDLE_TIMEOUT_SECS`, default 180; not retried |
| the same, with the variable at 5, 30 or 600 | fails after 5 s, fails after 30 s, completes after a 210 s silence |
| the same, with SSE comment lines every 10 s | fails after 180 s: comments do not count |
| no summary or output at all | retries after `TBH_STREAM_FIRST_EVENT_TIMEOUT_SECS`, default 180 |
| a reasoning summary every 10 s for 200 s | completes |
| a dropped connection (real API) | retries from the start, until 12 minutes after the first failure |

Neither variable is in `muse --help`, `muse exec --help` or the settings; both are in the
binary. A role's `env_file` in the config sets them for its launches: `scripts/launch.sh`
sources it, and the variable reached the Muse Code process.

On the real API, with the limit raised, a silent connection was sometimes dropped from outside,
"body-truncated": once after 352 s of silence and once after 762 s, while two others lasted
538 s and 671 s. Muse Code retried the first drop and gave up after the second, 12 minutes after
the first failure. So a raised limit lets a long call finish unless its connection is dropped
first, and when that happens is not fixed.

## Why it matters

The calls that reason longest are the coachman's judgments, and those are the ones that fail.
The leg then sits with no hand-off until someone resumes it: an hour, once, on 2026-09-28. The
fallback is the same harness and model, so it fails the same way.

## Fixed in 1.4.2

Muse Code 1.4.2 reached the stable channel on 2026-10-01. Its changelog, in Meta's public SDK
repository, says: "Long reasoning turns are no longer cut off by the stream idle timeout while the
model is still thinking", and "Retry stalled model responses through the remaining attempt budget".
The binary has a new variable beside the two above, `TBH_STREAM_REASONING_IDLE_TIMEOUT_SECS`
[@trials/muse-stream-timeouts].

- The fresh sudoku at `max`, with no variable set, went quiet for 225 s after its tenth summary
  and answered correctly. On 1.4.0 the same call had failed.
- Against the mock, a 210 s silence after a summary completes with no variable set.
- With the new variable at 5, the same silence ends the attempt after 5 s, and it is retried
  with backoff instead of ending the run.

The default for the new limit is not known yet; it is more than 225 s.

## What changed because of it

`skills/postmaster/harnesses.md` records the timeouts, the retries and the variables. On
2026-09-29, on the user's word, the coachman and its fallback were given an `env_file` that sets
`TBH_STREAM_IDLE_TIMEOUT_SECS=900` (issue #127). It reaches runs dispatched after the change; a run
launches from the config it recorded at dispatch. On 1.4.2 that variable no longer governs a
reasoning call's silence, so the `env_file` matters only if Muse Code goes back to an earlier
release, as it did once, from 1.4.1 to 1.4.0.

## What would overturn it

For 1.4.0 and 1.4.1, nothing further: those releases are fixed in what they did. For 1.4.2, a
reasoning call that fails on the idle timeout, or a stalled one that is not retried. Muse Code
updates itself unless `MUSE_NO_AUTO_UPDATE=1` is set, so each new release needs the real-API
sudoku at `max` with no variable set, about six minutes. Or a Meta API that streams more than ten
summaries a response.
