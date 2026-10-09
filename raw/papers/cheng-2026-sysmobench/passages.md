# Notes and passages

Taken on 2026-10-04 from the document at the url in `source.md`, by a reading helper working for #300. A quote is verbatim and is marked `checked` only where two separate reads gave the same words, word for word; otherwise it is marked `single read`. A figure is transcribed with the place it sits in the source. A line marked `paraphrase` is a summary, not a quote. Nothing here is inferred from a title or a snippet. Where the notes say "the brief", they mean the written instructions the reading helper was given.

## says

Models can model a small piece of code, such as a spinlock, in TLA+ well, but on a large system such as an etcd Raft implementation the generated models mostly fail the runtime and conformance checks.

## measured

TASK: from the source code of a real system (Go, C, Java, Rust) and a task statement naming the core actions, write a TLA+ model with a TLC configuration. JUDGED BY four metrics: syntax (SANY, partial credit per action); runtime (TLC explores without error; action coverage); conformance (traces of the instrumented system replayed against the model, with a model-assisted mapping of variables and actions); invariants (system-specific safety and liveness templates supplied by the benchmark authors and made concrete by a model for each generated model). SYSTEMS: 11 artifacts (etcd Raft 2,159 lines of Go, Redis Raft 2,394 C, ZooKeeper leader election 5,360 Java, Asterinas spinlock, mutex, rwmutex and ring buffer in Rust, Xline CURP 4,064 Rust, three PGo programs). MODELS: Claude Sonnet 4, GPT-5, Gemini 2.5 Pro, DeepSeek-R1, run in a basic modelling agent and a code-translation agent. NUMBERS (Table 3): Asterinas spinlock, Claude Sonnet 4: 100% syntax, runtime, conformance and invariant; etcd Raft, basic agent, Claude Sonnet 4: 100% syntax, 25% runtime, 7.69% conformance, 69.23% invariant; the other models there reached 47-50% syntax; etcd Raft with the code-translation agent, Claude Sonnet 4: 100% syntax, 66.67% runtime, 15.38% conformance, 92.31% invariant; DeepSeek-R1 0% runtime. In the invariant results 8.3% of safety properties but 41.9% of liveness properties were violated, which the authors read as weak temporal reasoning. Appendix C.2: the generated models reproduced known bugs in five systems.

## quotes

none kept

## does not cover

a model-checker pass plus trace conformance still leaves out what the system should do; the invariants are templates set by the benchmark authors; the agents are the authors' own; I read only the main results table and text via a summary.

## strength

controlled study (one team)

## how chosen

SERIOUS (the one benchmark I found that checks a model-written TLA+ model against the running system's traces, not only against a model checker)

## period

language-model

## group

G3, G4     claims: C3     direction: mixed

