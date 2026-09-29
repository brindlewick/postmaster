---
title: Muse Code ends a model call that streams nothing for 180 seconds
type: concept
standing: settled
sources: [trials/muse-stream-timeouts]
updated: 2026-09-29
---

# Muse Code ends a model call that streams nothing for 180 seconds

**Claim.** Once a model call has streamed a reasoning summary or any output, Muse Code 1.4.0
ends it when 180 seconds pass with no further event, and does not retry it. The Meta API streams
at most ten reasoning summaries per response and then nothing until the answer. So a call that
is still reasoning 180 seconds after its last summary fails with "model stream idle timeout
after 180000ms", and the leg that made it ends with no hand-off. The limit is an environment
variable Muse Code does not document, `TBH_STREAM_IDLE_TIMEOUT_SECS`. A lower reasoning effort
does not avoid the failure on a problem that needs long reasoning.

**Standing: settled**, for Muse Code 1.4.0-R4302.1 on `muse-spark-1.3-contributor`. The failure
was reproduced on the real API. Each part was then tested against a mock of the API, including
the settings that could have shown otherwise [@trials/muse-stream-timeouts].

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
the idle timeout. The long
calls that succeeded level off at about 50 wire events, which is ten summaries and the answer's
events.

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
| the same, with the variable at 5, 30 or 600 | fails after 5 s, fails after 30 s, completes after a 205 s silence |
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

## What changed because of it

`skills/postmaster/harnesses.md` records the timeouts, the retries and the variables. Setting
`TBH_STREAM_IDLE_TIMEOUT_SECS` for the coachman is a change to the config, which is the user's
to make, and is proposed on issue #127.

## What would overturn it

A Muse Code release that retries an idle timeout, keeps the stream alive while the model
reasons, or drops or renames the variable. Muse Code updates itself unless
`MUSE_NO_AUTO_UPDATE=1` is set, so the variable's effect needs checking again after an update;
the mock's 5-second case takes 20 seconds. Or a Meta API that streams more than ten summaries a
response.
