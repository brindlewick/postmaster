---
title: A headless MiMo Code lane's CPU goes to its Bun's garbage collector while a reply streams
type: concept
standing: settled
sources: [trials/mimo-cpu]
updated: 2026-09-29
---

# A headless MiMo Code lane's CPU goes to its Bun's garbage collector while a reply streams

**Claim.** A headless MiMo Code 0.1.15 launch uses 40 to 50% of a CPU core for as long as its
model's reply streams. The cost is not MiMo Code's own code. It comes from the Bun its executable
is built with, 1.3.14, which runs an eden garbage collection on nearly every event-loop tick
while the stream keeps the loop busy. The same modules on Bun 1.4.2 use a quarter to a third as
much, level with codex on the same prompt.

**Standing: settled**, for MiMo Code 0.1.15 on Linux, whose executable carries Bun 1.3.14. The
control that could have overturned it was run: the same modules, extracted from the executable,
were run on Bun 1.3.14 and on Bun 1.4.2, at the same time and under the same load. Only the Bun
changed the result [@trials/mimo-cpu].

## The evidence

CPU of the harness process while a reply streamed, as a share of one core, with each set of
conditions run at the same time [@trials/mimo-cpu]:

| | stand-in, 20 deltas a second | eden collections, 30 s stream | real provider, a 2,000-word story |
|---|---|---|---|
| MiMo Code as shipped (Bun 1.3.14) | 45.7, 49.4, 48.9% | 1,121 | 40.7, 43.1% |
| its modules on Bun 1.3.14 | 48.0, 47.5, 49.3% | 1,103 | |
| its modules on Bun 1.4.2 | 13.3, 12.4, 18.9% | 48 | 12.7, 11.7% |
| codex 0.157.1 | | | 12.9, 13.1% |

- **Where it goes.** With Bun 1.3.14, about a third of a core was the main thread and a tenth was
  JavaScript Core's `HeapHelper` threads. With Bun 1.4.2, `HeapHelper` fell to 0.5 to 2.6%.
- **Plain Bun shows the same cadence, with no MiMo Code.** Bun's own cadence workload ran 132
  eden collections on 1.3.14 and 4 on 1.4.2. Reading a 20-event-a-second stream while holding
  250 MB of objects, Bun 1.3.14 ran 903 eden collections over 397 chunks, and Bun 1.4.2 ran 18.
- **No setting stops it.** `BUN_GC_TIMER_DISABLE=1`, the switch Bun documents, left the count at
  136 on 1.3.14.
- **Bun names the cause.** Its `GarbageCollectionController` asked for a collection 16 ms after
  any tick that changed the heap size, and each collection's own changes to the counters set it
  off again. Bun replaced it with an idle timer in oven-sh/bun#35356, first released in Bun 1.4.0.
- **A second cost in Bun 1.3.14.** Each chunk of a `fetch` body comes back as a view on a new
  256 KiB buffer, whatever its size: 5.57 ms and 64 page faults per 150-byte chunk. Bun 1.4.2
  returns exact-size chunks at 0.52 ms each. The trial does not apportion the streaming cost
  between this and the collector.

The first sign was the fleet's own lanes, `unverified` because the sample was not recorded. On
2026-09-28, six runs in flight on 8 cores left the machine CPU-bound. Five `.mimocode` processes
used 250% of a core between them, and five codex processes used 22%.

## Why it matters

A config that puts a mimo lane on the team, as a workhorse or a reviewer, gives every run one or
more of them. At 40 to 50% of a core per streaming lane, a handful of runs at once is enough to
make a machine CPU-bound. That slows
every other lane, the gate, and the self-test controls that time themselves.

## What changed because of it

- **Upstream.** Reported as XiaomiMiMo/MiMo-Code#2582, which asks for releases built on Bun 1.4.0
  or later.
- **Stopgap trialled, not adopted.** An env file can name, in `MIMOCODE_BIN_PATH`, a launcher
  that runs MiMo Code's own modules on an installed Bun 1.4. MiMo Code's npm launcher runs that
  in place of its executable, and MiMo Code re-runs itself through the same variable.
- **What the stopgap trial showed.** Through `launch.sh`, the stopgap launched, used its shell
  tool, streamed the same event types, resumed its thread and exported its messages on the same
  model and variant, as the shipped executable did [@trials/mimo-cpu].
- **Adoption waits on the user.** The flow's mimo form does not use the stopgap. It depends on
  unpacking the executable, and would go stale when MiMo Code updates.

## What would overturn it

A MiMo Code release built on Bun 1.4.0 or later that still uses 40% of a core while a reply
streams. That would put the cost back in MiMo Code's own code. Short of that, a setting that stops
Bun 1.3.14's cadence would not overturn the claim, but would give the flow a fix without the
stopgap.
