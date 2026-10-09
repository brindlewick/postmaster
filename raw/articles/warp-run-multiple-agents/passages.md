# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> A practical use of parallel agents is running the same task in different Git worktrees, with different agents, to compare their approaches.

4. Compare outputs from different agents; checked (two reads with different prompts gave the same words); also confirmed by string comparison against the raw docs source file

> You might find one agent produces cleaner code while the other catches an edge case the first missed.

docs source file, 4. Compare outputs from different agents (an observation; no data is given); checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> | Same task, different agents | You want to compare approaches or pick the best implementation. | Run each agent in a separate tab and worktree, then compare diffs in the [Code Review panel](/code/code-review/). |

docs source file, Choose a multi-agent pattern, table row; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Whether you will keep one winner, cherry-pick changes, merge multiple branches, or open separate PRs.

docs source file, Plan the split before launching agents, item 'Merge strategy'; checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

> Do not merge every agent's output automatically. Use a fan-in pass:

8. Validate, merge, and hand off; checked (two reads with different prompts gave the same words); also confirmed by string comparison against the raw docs source file

> Review each agent's summary, changed files, and validation results.

8. Validate, merge, and hand off, step 1; checked (three reads with different prompts gave the same words); also confirmed by string comparison against the raw docs source file

> Merge or cherry-pick one branch at a time.

8. Validate, merge, and hand off, step 3; checked (three reads with different prompts gave the same words); also confirmed by string comparison against the raw docs source file

> Re-run the full validation suite from the final integrated branch.

8. Validate, merge, and hand off, step 4; checked (three reads with different prompts gave the same words); also confirmed by string comparison against the raw docs source file

> Run Claude Code, Codex, Warp Agent, and other coding agents across worktrees, tabs, and cloud orchestration with clear task ownership.

docs source file, front-matter description (the fetch tool's Overview line stopped before 'with clear task ownership'); checked (raw file fetched with curl at the commit; the quote matches it character for character after whitespace is collapsed)

Note: Headings: Run multiple AI coding agents; Prerequisites; Choose a multi-agent pattern; Plan the split before launching agents; 1. Switch to vertical tabs; 2. Launch agents in separate tabs; 3. Monitor agents with notifications; 4. Compare outputs from different agents; 5. Save your workspace with tab configs; 6. Use Git worktrees for isolated agent workspaces; 7. Fan out work to cloud agents; 8. Validate, merge, and hand off; Productivity tips; Next steps. No number or evidence of better results on the page or in the docs source file.
