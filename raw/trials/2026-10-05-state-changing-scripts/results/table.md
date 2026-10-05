# Which scripts remove or rewrite something, and which have a dry run

Read on 2026-10-05 at postmaster commit `a265197`. One reader's classification by reading, with the grep controls in `method.md`. `contract` is whether the file is in `docs/coachman-contract.toml`.

| script | class | what it removes or rewrites (or why not) | dry run | JSON | contract |
|---|---|---|---|---|---|
| aftercare | Y | removes run worktrees and clones, stops the preview process group, sets the ticket done, marks the run done, releases the pin (L897, L1030, L1631, L1723, L1779) | **yes** | **flag** | yes |
| check-target | R | reads; runs `git fetch` | - | no | no |
| clean-checkout | T | makes then removes its own temp worktree; on its failure path runs `git worktree prune` (repo-wide stale entries) | - | no | no |
| clerk | Y | overwrites the clerk brief and session record; `brief` unmarks a ready ticket (L228, L269, L305) | no | no | no |
| coachman-contract | T | reads git; `--self-test` builds and removes its own copies | - | no | yes |
| cut-scratch | Y | `--remove` deletes a scratch worktree or clone (L271-275); creating refuses an existing destination | no | no | no |
| discover-project | R | reads | - | no | no |
| export-session | Yw | replaces an earlier export of the same thread by temp file and rename (L424) | no | no | no |
| find-projects | R | reads | - | no | no |
| fixture-lanes | T | scores lane branches in its own temp checkouts | - | no | no |
| fixture | A | `new` makes a repo and a ticket and refuses an existing destination; `score` and `hidden` use temp folders | - | no | yes |
| front-door-acceptance | R | reads docs | - | no | no |
| front-door | R | reads | - | no | no |
| github | Y | edits an issue body, title, labels; sets state (reopen, close, board column) (L395-397, L526-533, L601-611) | no | no | no |
| handoff-check | R | reads | - | no | yes |
| host | Y | `stop`, `stop-run` kill launches; `close`, `close-run` close windows; `leg launch` rewrites the manifest; removes lock, spec and marker files; rewrites the waiting list (L2202, L2685, L3792, L4458) | no (the only match is a comment, L5378) | no | yes |
| landing | R | reads git and prints answers; no write and no git mutation found | - | no | yes |
| launch | Y | starts harness processes; rewrites the user's Codex config to add a trust block; removes the previous last-message file (L1718, L1754) | no (`launch form` prints the harness command form) | no | yes |
| link-skills | Y | makes links (the dry run covers this); `--remove` deletes links (L285) | **part** | no | no |
| local | Y | rewrites ticket files (state, title, label, edit); `store remove` (L230, L362) | no | no | no |
| log-action | A | appends one line to `actions.jsonl` and the ledger | - | no | no |
| parallel-runs-acceptance | R | reads docs | - | no | no |
| plane | Y | PATCHes a work item: description, title, labels, state (L1252-1379) | no | no | no |
| premises | R | reads | - | no | yes |
| probe-confine | R | reads | - | no | no |
| probe-harnesses | R | runs `--version` of each harness | - | no | no |
| probe-trackers | R | reads | - | no | no |
| project-settings | Y | `write` replaces `project.toml` or `settings.toml` (L847) | no | default (`inspect`, `effective`) | no |
| review-decide | R | reads | - | no | no |
| review-findings | A | `harvest` copies outputs and refuses to overwrite a differing file; `normalize` prints JSON | - | default | no |
| review-forms | R | reads | - | no | no |
| review-page | Yw | writes a page's files into the out folder, replacing same-named files (L246-294) | no | no | no |
| review-round | Y | `start` writes the deadline and clears the round's old `.done` markers; `wait` stops reviewers at the deadline; `teardown` removes scratches (L250, L410, L497) | no | no | no |
| reviewers | R | reads | - | no | no |
| run-clash | R | reads | - | no | no |
| run-log | A | appends to `run-log.md` | - | no | no |
| run-meta | Y | `release` removes the pin and its claims file (L1045, L1062); dispatch writes `run.json` once and refuses to overwrite | no | no | yes |
| run-times | R | reads | - | no | no |
| runs-status | R | reads | - | no | yes |
| runs-watch | Y | launches and resumes legs, removes leg and wall-pause markers (L867-868, L1326-1327) | no | no | yes |
| setup | Y | writes, or on a yes replaces, the machine config; `--add-clerk` rewrites it and restores on a parse failure (L262-268, L651) | **yes** (both modes) | no | no |
| skill-refs | Y | `--fix` rewrites runbook text in place (L85); the default only reports | no | no | no |
| stage | Y | rewrites the manifest stage by temp file and rename (L230-233) | no | no | yes |
| style-findings | R | reads | - | no | no |
| summary-evidence | T | reads; stages a file in its own temp folder | - | no | yes |
| synthesis-shares | A | writes a new report with flag `wx`; own temp index | - | no | no |
| ticket-check | R | reads | - | no | yes |
| ticket-parts | R | reads | - | no | no |
| ticket-ready | Y | `mark` adds the label and a marker; `unmark` removes both; `consume` removes the marker (L231, L363, L379) | no | no | yes |
| tool-faults | Y | rewrites its fault state file, writes drafts; `file` and `comment` add tickets and comments (L208-209, L925) | no | no | no |
| tracker-kind | R | reads | - | no | no |
| turnpikes | R | reads | - | no | yes |
| usage | Yw | `record` replaces `<stream>-usage.json` for the same stream (L374-375) | no | default (`read`) | no |
| verify-examples | T | runs examples in its own temp folder | - | no | no |
| verify-journey | R | reads | - | no | no |
| verify-library | R | runs the project's own build and tests | - | no | no |
| verify | Y | `record` replaces the run's `checks.json` (L944-945); `arm` replaces the armed ticket copy (L483-484) | no | **flag** (`checks --json`) | no |
| view-stream | R | reads | - | no | no |
| wait-for-markers | T | plants and removes its own probe marker | - | no | no |
| walls | Yw | `escalate` rewrites `ESCALATION.md` and sets two markers (L366-368); `told`, `rule`, `carry` append | no | no | yes |
| wiki-lint | R | reads | - | no | no |
| fixture-time-oracle, host-self-test, walls-oracle | X | test modules (no `import.meta.main`) | - | - | no |

Counts, from the table with `awk`:

- 64 files: 61 commands and 3 test modules.
- Remove or rewrite: 23 (class Y 19, class Yw 4). Add or append only 5, touch only their own temporary files 6, read only 27.
- Of the 23: a full dry run on 2 (`aftercare`, `setup`), a partial one on 1 (`link-skills`, for making links only), none on 20. Over all 64 files, 3 have one.
- Of the 20 with none, 7 are contract files: `host`, `launch`, `run-meta`, `runs-watch`, `stage`, `ticket-ready`, `walls`.
- JSON by flag or by default: 5 of 64 (`aftercare` and `verify` by flag; `project-settings`, `review-findings` and `usage` by default).
