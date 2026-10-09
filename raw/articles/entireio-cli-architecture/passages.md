# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Attribution tracks how much of a commit came from the agent vs the user.

docs/architecture/attribution.md, Overview; checked (raw file)

> Entire-Attribution: 73% agent (146/200 lines)

docs/architecture/attribution.md, Overview (the example trailer on a commit message); checked (raw file)

> It does not track keystrokes or exact authorship. The metrics are inferred from line diffs and hook timing.

docs/architecture/attribution.md, Attribution Metadata Fields; checked (raw file)

> Signing is **best-effort**: if the signer is unavailable or fails, the commit is created unsigned and a warning is logged to `.entire/logs/`.

docs/architecture/checkpoint-signing.md, intro; checked (raw file)

> `session.TaskRecord` (json `task_records`) on session state (`session/state.go`): `ToolUseID`, `AgentID`, `StartedAt`, `SubagentType`, `TaskDescription`, `DeclaredTranscriptPath`, `Files`, `TokenUsage`, `CompletedAt`

docs/architecture/sessions-and-checkpoints.md, Task Records (Subagent Work); checked (raw file)

> Metadata only, sharded by checkpoint ID. Supports **multiple sessions per checkpoint**:

docs/architecture/sessions-and-checkpoints.md, Committed Checkpoints (a tree listing follows: `metadata.json`, per-session folders holding `full.jsonl`, `transcript.jsonl`, `prompt.txt`, `content_hash.txt`, and `tasks/<tool-use-id>/task.json`); checked (raw file)

> When multiple sessions are ACTIVE in the same directory and one session's agent (or subagent) makes a commit, **all** ACTIVE sessions are condensed — including sessions that didn't contribute to the commit.

docs/KNOWN_LIMITATIONS.md, "Concurrent ACTIVE Sessions May Produce Spurious Checkpoints"; checked (raw file)

> Use separate git worktrees for concurrent sessions. Each worktree gets its own shadow branch namespace, so sessions in different worktrees don't interfere.

docs/KNOWN_LIMITATIONS.md, the "Workaround" line of the same entry; checked (raw file)

> Experimental review command for running one configured review profile.

docs/architecture/review-command.md, first line; checked (raw file)

> Multi-reviewer profiles run reviewers concurrently, then run one judge.

docs/architecture/review-command.md, Behavior; checked (raw file)

> In multi-worker profiles, the configured judge receives all worker reports and produces one final verdict. The judge prompt asks it to reject unsupported claims, resolve contradictions, merge duplicates, and prioritize evidence-backed findings.

docs/architecture/review-command.md, Flow, step 6 (two sentences; 31 words); checked (raw file)

> On the next `git commit`, the PostCommit hook condenses worker review sessions into the checkpoint on `entire/checkpoints/v1`, with `Kind`, `ReviewSkills`, and `ReviewPrompt` recorded in `CommittedMetadata`.

docs/architecture/review-command.md, Flow, step 7. Note: this document still names the branch `entire/checkpoints/v1`, while the README at the same commit describes per-checkpoint refs `refs/entire/checkpoints/<shard>/<id>`; checked (raw file)

> Their lifecycle hooks use those values to tag sessions as `Kind = "agent_review"`.

docs/architecture/review-command.md, Flow, step 4; checked (raw file)

Paraphrase, not a quotation: the same document shows a review profile as JSON with a `task`, an `agents` map of reviewer slots (the example names claude-code, codex and pi), an optional `judge`, and an `output` of `local` or `trail`; it gives no result of any measurement of review quality, and it does not say whether a saved finding records which reviewer raised it.
