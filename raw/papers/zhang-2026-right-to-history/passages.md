# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> AI agents increasingly act on behalf of humans, yet no existing system provides a tamper-evident, independently verifiable record of what they did.

Abstract, first sentence; not checked (one fetch)

> Adversarial testing confirms all five invariants hold. Performance evaluation shows sub-1.3 ms median action latency, ~400 actions/sec throughput, and 448-byte Merkle inclusion proofs at 10,000 log entries.

Abstract, last two sentences; the numbers are checked against the full text's table (below), the wording is one fetch

> The kernel records _what agents claim to have done_, not necessarily _what actually happened in the external world_.

Section 8, Trust Boundary (underscores mark italics in the source); checked (two fetches agree; one of them also gave a shorter form ending "what actually happened")

> A user (or attacker) with root access to the host OS can stop the kernel process, directly modify the underlying storage

Section 3.2, Scope of Defense (the first fetch continued "and reconstruct the Merkle tree"); checked up to the word "storage" (two fetches agree)

> single-point linearization yields a deterministic total-order log

Section 4.1, Remark 4.1 (a fragment of a sentence); checked (two fetches agree)

> Distributed extension requires introducing consensus (e.g., Raft) and re-proving invariants under multi-committer semantics.

Section 8, Limitations; not checked (one fetch)

## Read from the full text (one fetch each unless noted; not quotations)

- The five invariants, as the first fetch named them: append-only (INV-1), completeness (INV-2, "every boundary-checked, energy-funded action is recorded"), integrity (INV-3, the Merkle root commits the log), boundary enforcement (INV-4), energy conservation (INV-5).
- An action is a five-part tuple (actor, type, target, payload, timestamp) with type one of observe, create, mutate, execute (two fetches agree on the four types); the logged event has twelve fields.
- Adversarial testing: five targeted tests, one per invariant, for example 20 submitted actions (15 permitted, 5 out of bounds) for INV-2 and ten inclusion proofs for INV-3. Small, scripted tests.
- Performance table (first fetch): median latency 0.7 to 1.3 ms per action; about 400 actions per second, single-threaded; a 448-byte inclusion proof at 10,000 entries; about 19 ms proof generation at 10,000 entries; hardware an Intel i7-14700K with 64 GB memory; log sizes tested up to 10,000 entries.
- Neither fetch found a mention of coding agents, git or commits in the paper; the first fetch said agent frameworks named include the OpenAI SDK and LangGraph.
- Several agents running in parallel: the design uses a single committer; the first fetch said multi-agent operation is future work.

## Numbers from the GitHub API, 2026-10-04

The paper's comment field names the open-source kernel repository PunkGo/punkgo-kernel (plain GET of the repository and latest-release endpoints):

- stars 4; forks 0; created 2026-02-20T16:12:03Z; last push 2026-07-02T05:27:12Z
- latest release v0.5.1, published 2026-03-16T16:19:39Z
- licence MIT
