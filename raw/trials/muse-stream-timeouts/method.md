---
kind: trial
subject: How Muse Code ends a model call on a silent stream, and what changes it
date: 2026-09-29
---

# Method

**Question.** Issue #127. Three coachman legs on Muse Code ended with "model stream idle timeout
after 180000ms" on 2026-09-28 and 29. How long was each stream silent, and why? Was the silence
the model reasoning, the provider stalling, or the machine's load? Can Muse Code be made to wait
longer or to retry? Does a lower reasoning effort avoid it?

**Versions.** Muse Code 1.4.0 (R4302.1) on `muse-spark-1.3-contributor`, the Meta API. See
`versions.txt`. The machine had 18 cores at a load of about 27 throughout, from the fleet's own
runs.

**The clock.** `recorded_at` in Muse Code's `--json` stream is not a time: it rises by one
microsecond per record from a fixed base per process. Real times come from two places. Task,
call and command ids are UUIDv7, whose first 48 bits are Unix milliseconds. Muse Code also writes
a trace log with UTC timestamps, under `<XDG_DATA_HOME>/muse/local-tracing/bootstrap/`, which
logs every model attempt and every provider stream's open, first event and close.

**Part 1: the fleet's own records.** Read-only, from the data directories `scripts/launch.sh`
gives each launch under `~/.postmaster/harness-data/muse/`. No live run was touched.

- `failed-calls.txt`: the trace-log lines of each failed call, from the context sent to the
  run's end.
- `fleet-census.txt`: every model attempt in every trace log, by outcome, duration and wire
  events (`apparatus/census.py`), and every attempt that timed out or failed.

**Part 2: the real API.** Launches of Muse Code's own form, in a scratch repository with a data
directory of their own (`apparatus/run.py`). `MUSE_TRANSPORT_TRACE=1` makes Muse Code print each
SSE event it reads to stderr, and `run.py` stamps each line as it arrives. `apparatus/gaps.py`
groups the events by response. The prompts ask for an answer worked out with no tools:

- `p-reason.txt`: a counting problem with a known answer, 352.
- `p-sudoku.txt`: a well-known hard sudoku.
- `p-sudoku2.txt`: a sudoku generated for this trial with one solution (`sudoku2.solution`), so
  no model has seen it.

Recorded in `real-api.txt`, per launch: the wire summary per response, when each reasoning
summary arrived, the final record, whether the answer is right, and Muse Code's attempt and
stream outcomes from its trace log.

**Part 3: a mock of the API.** `apparatus/mock.py` serves the Meta Responses API on loopback, and
Muse Code is pointed at it with `--base-url` and a throwaway key on stdin, so no credential
reaches it (`apparatus/mockpair.sh`). The model catalog is served from a copy of Muse Code's own
cache (`apparatus/model-catalog.json`). Each main response opens with `response.created`,
`response.in_progress` and a reasoning item. Then it stays silent, or sends SSE comment lines, or
sends reasoning summaries, for a set time, before answering "OK". Recorded in `mock.txt`.

**Part 4: through `launch.sh`.** A scratch config names the coachman on Muse Code with an
`env_file` that sets `TBH_STREAM_IDLE_TIMEOUT_SECS=600`. A launch through `scripts/launch.sh
launch coachman ... --leg synthesis` was checked for the variable in the Muse Code process's
environment (`/proc/<pid>/environ`), and for its answer.

**How the variables were found.** `binary-strings.txt` shows the printable text around each
match in the binary. Neither variable is in `muse --help`, `muse exec --help` or the settings.

# Results

**The three failed calls** (`failed-calls.txt`). Each opened its stream in under 2 s and had its
first event within 30 ms of opening. Each ended on `idle_timeout` 325.2 to 329.3 s after the
attempt began, as its only attempt, with `next_attempt=0`. With a 180 s limit, the last event of
each arrived 145 to 149 s in. Just before, each leg had read the round-1 verdicts or both
workhorses' diffs. The context sent was 121k, 265k and 173k tokens.

**The fleet** (`fleet-census.txt`). 7,688 model attempts, 4,320 of them by the main agent, by
01:49 UTC on 2026-09-29. Three ended on `idle_timeout`: the three above. Three more ended on
`first_event_timeout`, all Muse Code's reminder calls, after 30 s. Among main attempts longer
than 140 s, the wire events level off at about 50.

**The real API** (`real-api.txt`).

- Reasoning summaries arrived every 2 to 36 s. No response sent more than ten. Every long one
  stopped at nine or ten (`summary_index` up to 8 or 9) and then sent nothing until its answer.
- `p-sudoku.txt` at `max`, default limit: 9 summaries in 195 s, then the idle timeout 180 s
  later.
- `p-sudoku2.txt` at the default limit failed on the idle timeout at every effort: `max` after 10
  summaries in 141 s, `xhigh` 9 in 106 s, `high` 9 in 107 s, `medium` 9 in 96 s, `low` 9 in 136 s.
- `p-sudoku2.txt` at `max` with `TBH_STREAM_IDLE_TIMEOUT_SECS=900`: 10 summaries in 130 s, 197 s
  of silence, then the right solution, 343 s after launch.
- The same with the limit at 900, at lower efforts. `xhigh`: 10 summaries in 87 s, 538 s of
  silence, then the right solution, 653 s after launch. `high`: 10 summaries in 83 s, then 671 s
  of silence, and the response ended `incomplete` with reason `max_output_tokens`: 127,997 of
  its 128,000 output tokens went on reasoning, and it gave no answer. Muse Code ended that run on
  `run.terminal.completed` with no text, exit 0.
- `p-sudoku.txt` at `max` with `TBH_STREAM_IDLE_TIMEOUT_SECS=1200`: 10 summaries in 192 s, then
  the connection was dropped 352 s later, "transport_stream_error: body-truncated". Muse Code
  retried. The retry sent 10 summaries in 175 s, and its connection was dropped 762 s later.
  Muse Code then gave up: "model call chain exceeded the 12m wall-clock ceiling measured from
  its first failed attempt".
- `p-reason.txt`: 352, the right answer, at `max`, `xhigh` and `high`.

**The mock** (`mock.txt`).

- After a summary, silence fails at the idle limit: at 180 s by default, 5 s and 30 s with the
  variable at 5 and 30. With it at 600, a 210 s silence completes. The failure is terminal, with
  `next_attempt=0`.
- SSE comment lines every 10 s do not reset the idle limit.
- With no summary or output at all, the idle variable has no effect. After 180 s, or after
  `TBH_STREAM_FIRST_EVENT_TIMEOUT_SECS` when set (20 in the trial), the attempt fails as
  `retryable_failure` and is retried after 1, 2, then 4 s.
- A summary every 10 s for 200 s completes.

**Through `launch.sh`** (`through-launch.txt`). The variable was in the Muse Code process's
environment, and the launch answered.

**Recheck on 1.4.1** (`recheck-1.4.1.txt`). Muse Code updated itself to 1.4.1 (R4380.1) at 03:42 UTC,
after the trials. On 1.4.1 the variable at 5 failed after 5 s, the default failed after 180 s
unretried, and the variable at 900 let a 210 s silence complete. Two launches through `launch.sh`
with the live config, once the coachman and its fallback had the `env_file`, ran 1.4.1 with
`TBH_STREAM_IDLE_TIMEOUT_SECS=900` in the process's environment, and answered. While 1.4.1 was
installed, #135's synthesis leg ended on the idle timeout twice. At 05:49 UTC the updater put
1.4.0-R4302.1 back. Two more runs of `p-sudoku2.txt` on it, at `max` and `xhigh` with the default
limit, failed on the idle timeout again after 7 and 9 summaries.

# What it settles

Facts about Muse Code 1.4.0-R4302.1, rechecked on 1.4.1-R4380.1, with the Meta API on `muse-spark-1.3-contributor`. Once a
call has streamed a reasoning summary or output, Muse Code ends it after 180 s without an event
and does not retry it. The limit is `TBH_STREAM_IDLE_TIMEOUT_SECS`, and a role's `env_file` sets
it through `launch.sh`. The API sends at most ten reasoning summaries per response, so a model
that reasons on after them trips the limit. The three coachman legs failed that way, not from
the machine's load. Lowering the effort did not avoid it on a problem that needs long
reasoning, and raising the limit let the same call finish with the right answer. At a lower
effort the call was slower, or ran out of output tokens before it answered. A response cut
off at the output limit ends the run as completed with no text, exit 0.

It does not settle why the API stops at ten, or what drops a connection that has been silent for
minutes, the provider or something between. Two connections were dropped, after 352 s and 762 s
of silence, and two others lasted 538 s and 671 s, so the point is not fixed. Nor does it say
how often the coachman's own calls reason past the default: three of 4,320 main attempts did.
