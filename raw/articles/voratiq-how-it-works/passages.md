# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

Operator table, "Swarm" (rows as printed, padding spaces removed); checked (raw file text):

> | `run` | Dispatch agents to execute against a spec | Generate multiple implementations for the same task |
> | `reduce` | Dispatch agents to synthesize artifacts | Synthesize several artifacts into one summary |

> | `verify` | Dispatch agents to judge outputs | Recommend whether a result should be applied, inspected, or rerun |

> Rubric verification is blinded when comparing multiple outputs: verifiers see randomized aliases, not agent names.

"Verification"; checked (raw file text)

> Voratiq supports two kinds of verification:

"Verification", followed by the two bullets "Programmatic checks — tests, type checks, lint, build commands" and "Rubric verifiers — agents that evaluate outputs against structured instructions"; checked (raw file text)

> Durable run artifacts remain the post-run contract even after workspace scratch state is cleaned up, so recorded history stays usable as an audit trail and as input to follow-on operations like `apply`, `reduce`, and `verify`.

"Sessions and Artifacts"; checked (raw file text)

> **Improve** - use verification outcomes to refine steps, agents, rubrics, and policies over time

"Product Model" (a stated aim; no measurement of it appears in the file); checked (raw file text)
