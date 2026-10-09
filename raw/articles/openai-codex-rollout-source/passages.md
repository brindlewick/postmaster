# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Persist Codex session rollouts (.jsonl) so sessions can be replayed or inspected later.

codex-rs/rollout/src/recorder.rs, first line (a module doc comment); checked (raw file)

> Rollouts are recorded as JSONL and can be inspected with tools such as:

codex-rs/rollout/src/recorder.rs, doc comment on the recorder (examples with `jq` and `fx` follow); checked (raw file)

> Persisted rollout item used by core history and rollout storage.

codex-rs/history/src/lib.rs, doc comment on `pub enum RolloutItem`; checked (raw file)

The twelve variants of that enum, as written in the source: SessionMeta, ResponseItem, InterAgentCommunication, InterAgentCommunicationMetadata, Compacted, TurnContext, TokenUsageRecord, WorldState, SecurityRiskScore, RetainedContext, EventMsg, RealtimeItem. (A list of names read from the code, not a quotation.)

> pub git: Option<GitInfo>,

codex-rs/protocol/src/protocol.rs, field of `SessionMetaLine`; checked (raw file)

> Current commit hash (SHA)

codex-rs/protocol/src/protocol.rs, doc comment on the `commit_hash` field of `GitInfo` (the struct also has `branch` and `repository_url`); checked (raw file)

In the same file, `SessionMeta` has `session_id`, `id`, `forked_from_id` and `parent_thread_id` fields, and `InterAgentCommunication` is a defined type. Read from the field lists; not quoted.
