# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Entire hooks into your Git workflow to capture AI agent sessions as you work. Sessions are indexed alongside commits, creating a searchable record of how code was written in your repo.

Opening paragraph; checked (raw file)

> **Maintain traceability** — support audit and compliance requirements when needed

Bullet list under the opening paragraph ("With Entire, you can:"); checked (raw file)

> Checkpoints are created when you or the agent make a git commit, and the commit carries an `Entire-Checkpoint: <id>` trailer linking the two.

Key Concepts, Checkpoints; checked (raw file)

> Checkpoints live in your repository's own git object store, never in your branch's history. Each checkpoint is its own git ref:

Key Concepts, Checkpoint Storage (the ref pattern shown next is `refs/entire/checkpoints/<shard>/<id>`); checked (raw file)

> Each worktree has independent session tracking, so you can run multiple AI sessions in different worktrees without conflicts.

Key Concepts, Git Worktrees; checked (raw file)

> Multiple AI sessions can run on the same commit. If you start a second session while another has uncommitted work, Entire warns you and tracks them separately.

Key Concepts, Concurrent Sessions; checked (raw file)

> Entire automatically redacts detected secrets (API keys, tokens, credentials) from transcripts and metadata before writing a checkpoint, but redaction is best-effort.

Security & Privacy; checked (raw file)

> | `entire review` | Run a multi-agent review against a branch |

Commands Reference, Experimental Commands (a table row); checked (raw file)

> | `entire experts` | Rank agent provenance for code scopes |

Commands Reference, Experimental Commands (a table row; the README gives no further description of this command); checked (raw file)

> These are visible in developer and nightly builds and hidden in stable releases, but always runnable in every build.

Commands Reference, Experimental Commands, lead-in to the table above; checked (raw file)

> `entire why <file>:<line>` jumps from a specific line back to the prompt, session, and checkpoint that created it.

Commands Reference, Experimental Commands, paragraph after the table; checked (raw file)

## Numbers from the GitHub API, 2026-10-04

Repository entireio/cli (read with a plain GET of the repository and latest-release endpoints):

- stars 5152; forks 482; open issues and pull requests 325 (the API's combined count)
- created 2026-01-02T17:13:58Z; last push 2026-10-04T09:52:54Z
- latest release v0.11.3, published 2026-09-25T20:55:22Z
- licence MIT; default branch main; not archived
- description field: "Entire CLI hooks into your Git workflow to capture AI agent sessions as you work. Sessions are indexed alongside commits, creating a searchable record of how code was written in your repo."
