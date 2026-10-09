# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> `tapes` is an Agentic telemetry system for content-addressable LLM interactions.

Opening paragraph; checked (raw file)

> Capture is **append-only**: every intercepted LLM interaction is persisted to an immutable `raw_turns` log.

Section "About"; checked (raw file)

> Content addressing (the merkle node layer) is retained **internally** for provenance and dedup; it is not a user-facing browsing surface.

Section "About"; checked (raw file)

> `tapesctl start` launches the agent under a just-in-time capture proxy and ships the turns to this server.

Quickstart, after "Ready for the real thing?" (the README then says `start` launches `claude`, `codex` and `pi`); checked (raw file)

The product page https://tapes.dev, fetched once, was reported as saying "tapes records your agent sessions and saves them in a local Postgres. No SDK, just two commands." Not checked by a second fetch. The README states no tie to git commits (a search of the README for "commit" and the word "git" found no relevant line) and no guarantee that the append-only log cannot be altered by whoever runs the server.

## Numbers from the GitHub API, 2026-10-04

Repository papercomputeco/tapes (plain GET of the repository and latest-release endpoints):

- stars 327; forks 30; open issues and pull requests 25 (the API's combined count)
- created 2026-01-16T22:13:08Z; last push 2026-10-02T06:10:03Z
- latest release v0.49.0, published 2026-10-01T23:17:11Z
- licence field Apache-2.0 (the README says dual-licensed Apache-2.0 or MIT); default branch main
- description field: "Transparent telemetry collector for hi-fidelity agent traces"
