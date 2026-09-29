---
kind: trial
subject: What a headless MiMo Code launch spends its CPU on while it waits on its model, and a stopgap
date: 2026-09-29
---

# Method

**Question.** Issue #115 asks why a headless mimo lane uses about half a CPU core while its agent
waits on the model, measured on launches of the flow's own form. Does MiMo Code spend it while
the model streams, or while it is silent? Is the cost MiMo Code's own code, or the Bun runtime
its executable is built with? Does anything bring it down, and does a launch that uses it still
stream, use its tools, resume and export as before? How does codex compare on the same prompt?

**Redactions.** The provider id of the account's plan, which names a region, is shown as
`<plan-provider>`. The trial's working folder is shown as `<trial>`, and the home folder as `~`.

**Versions.** MiMo Code 0.1.15, whose executable carries Bun 1.3.14; Bun 1.4.2 as installed on
the machine; Node 24.21.0; codex-cli 0.157.1; Linux 6.8 on 18 cores. `versions.txt` has them as
run. The machine was busy with the fleet's own runs throughout, at a load average of 40 to 57.
So each comparison runs its conditions at the same time, under the same load.

**Setup.** `apparatus/run.sh <stage> <work dir> <record dir>` runs each stage. Every launch goes
through the flow's `scripts/host.sh run`, with no host, and `scripts/launch.sh`, in a fresh copy
of a one-commit repository. `apparatus/sample.py` reads the launch's processes from `/proc` every
half second, and never signals, traces or attaches to them. `apparatus/report.py` gives the
harness process's CPU in each window as a share of one core, overall and by thread.

The conditions:

- **shipped**: MiMo Code as installed, its executable on its own Bun 1.3.14.
- **stopgap**: MiMo Code's own modules on the installed Bun 1.4.2. `apparatus/extract.py` takes
  the modules out of the executable's `.bun` section. It points their internal paths at the
  folder it writes, and writes a launcher that runs the entry point on the given Bun with the
  executable's own runtime arguments. The lane's env file names that launcher in
  `MIMOCODE_BIN_PATH`, which MiMo Code's npm launcher runs in place of its executable. MiMo Code
  re-runs itself through the same variable.
- **control**: the same extraction on the Bun inside MiMo Code's own executable (`BUN_BE_BUN=1`).
  It differs from shipped only in being extracted, and from stopgap only in its Bun.
- **codex**: the flow's `luna` lane.

**Stages**, each recorded in `<stage>.txt`:

1. `bench`, with no MiMo Code. `apparatus/bench-client.js` reads a local stream of 150-byte
   server-sent events, 20 a second for 20 seconds, with `fetch` and a default reader. It runs on
   Bun 1.3.14, Bun 1.4.2 and Node at once, then on each Bun again holding 250 MB of small objects,
   with `BUN_JSC_logGC=1` counting collections. Last, Bun's own collection-cadence workload,
   taken from its test suite (`test/js/bun/gc/gc-controller-cadence.test.ts`), runs on each Bun,
   and on Bun 1.3.14 with `BUN_GC_TIMER_DISABLE=1`.
2. `forms`, on the real provider, shipped then stopgap:
   - The launch is asked to remember KESTREL, write PELICAN into `proof.txt` with its shell tool,
     and reply DONE.
   - It is resumed through `launch.sh` and asked for the code word.
   - `mimo export` lists the thread's assistant messages.
   - `launch.sh` is asked to resume an id no launch issued.
3. `standin`: `apparatus/standin.py`, an OpenAI-compatible stand-in registered in each copy's
   project config, holds the agent's turn silent for 20 seconds, then streams 20 deltas a second
   for 45 seconds. Shipped, control and stopgap run at once, twice.
4. `gc`: the same, silent 10 seconds and streaming 30, with `BUN_JSC_logGC=1`.
5. `real`: the real providers, all given one prompt at once, twice: a story of about 2,000 words,
   with no tools. The conditions are shipped and stopgap on the `mimo` lane, and codex on `luna`.
   The window runs from the harness's first model request to its exit: for mimo, the first
   `service=llm` line in its log; for codex, its first event.

**What is recorded.** For each launch: the harness process, its CPU in each window by thread, and
its whole CPU time. For `forms`, each stream's event types, sessions, tools, finish reasons,
errors and last text, and the export's models and variants. For `gc`, the collections JavaScript
Core logged. No stream is kept whole.

# Results

- **Plain Bun** (`bench.txt`).
  - Reading 20 events a second, Bun 1.3.14 used 11.1% of a core: 5.57 ms and 64 page faults per
    chunk. 399 of its 400 chunks were views on a new 262,144-byte buffer. Bun 1.4.2 used 1.0%,
    and Node 2.4%, each chunk a buffer of its own size.
  - Holding 250 MB of objects, Bun 1.3.14 ran 903 eden collections over 397 chunks. Bun 1.4.2
    ran 18.
  - Bun's cadence workload ran 132 eden collections on Bun 1.3.14, 136 with
    `BUN_GC_TIMER_DISABLE=1`, and 4 on Bun 1.4.2.
- **Forms** (`forms.txt`).
  - The stopgap's harness process was `bun`, and shipped's was `.mimocode`, so the stopgap did
    take effect.
  - Both launches wrote the same event types (3 `step_start`, 2 `text`, 3 `tool_use`,
    3 `step_finish`) on one session. Both finished `tool-calls, tool-calls, stop` with no error,
    wrote PELICAN into `proof.txt`, and replied DONE.
  - Both resumes stayed on the launch's thread and answered KESTREL.
  - Both exports listed 4 assistant messages on `<plan-provider>/mimo-v2.6-pro` at variant `high`.
  - Both refused the unknown id with exit 1, MiMo Code's export saying the session was not found.
- **Stand-in** (`standin.txt`, `gc.txt`).
  - While streaming 20 deltas a second: shipped used 45.7%, 49.4% and 48.9% of a core; control
    48.0%, 47.5% and 49.3%; stopgap 13.3%, 12.4% and 18.9%.
  - For shipped and control, about a third of a core was the main thread and a tenth was
    JavaScript Core's `HeapHelper` threads. For stopgap, `HeapHelper` was 0.5 to 2.6%.
  - With `BUN_JSC_logGC=1`, shipped ran 1,121 eden collections and control 1,103, in 40,561 ms
    and 38,710 ms of collection cycles. Stopgap ran 48, in 6,431 ms.
  - Over the whole launch, shipped took 39.7 and 41.3 seconds of CPU, control 39.4 and 39.6, and
    stopgap 19.6 and 18.6.
  - The silent windows varied from 6.0% to 31.2%. They overlap the end of start-up and are noisy,
    so they carry no conclusion.
- **Real providers** (`real.txt`).
  - While the story streamed, shipped used 40.7% and 43.1% of a core over 117 and 136 seconds.
    Stopgap used 12.7% and 11.7% over 120 and 134 seconds. Codex used 12.9% and 13.1% over 69 and
    82 seconds.
  - Whole launches: shipped 67.5 and 73.5 seconds of CPU for 2,406 and 2,814 words; stopgap 28.5
    and 26.1 for 2,528 and 2,725; codex 10.9 and 12.0 for 1,964 and 1,673.

# What it settles

Facts about one tool at one version, and the Bun it ships with. A headless MiMo Code 0.1.15 launch
spends its CPU while its model's reply streams, and most of it goes to garbage collection. Its
Bun, 1.3.14, runs an eden collection on nearly every event-loop tick while the stream keeps the
loop busy: over a thousand in 30 seconds.

Bun's source names the cause. Its `GarbageCollectionController` requested a collection 16 ms
after any tick that changed the heap size, and Bun replaced it in oven-sh/bun#35356, first
released in Bun 1.4.0. The trial shows the same cadence in plain Bun, and shows
`BUN_GC_TIMER_DISABLE=1` leaving it unchanged on 1.3.14. So no setting brings the shipped
executable down.

MiMo Code's own modules, run on Bun 1.4.2, spend about a quarter to a third as much while
streaming, level with codex. They launch, use tools, stream the same events, resume and export
as the shipped executable does. Bun 1.3.14 also hands back each `fetch` chunk in a new 256 KiB
buffer, which Bun 1.4.2 does not. The trial measures that separately and does not apportion the
cost between the two.
