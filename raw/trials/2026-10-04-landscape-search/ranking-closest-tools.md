# The count of five elements, with every mark

Each tool or write-up read in the closest-tools group was marked for five elements: **E1** several vendors' models each attempt the same coding task independently; **E2** the results are combined into one, by an agent writing one result, by a judge or selector, or by a person picking; **E3** several models review the result; **E4** a person signs off a plan or spec before code; **E5** the flow's own behaviour is audited, meaning a record of what the agents did, and tested, meaning tests or scored runs of the orchestration and not of a model. An element is marked Y if it is a core, described behaviour in the pages read, which scores 2; p if it is partial, optional, in a different form, or for plans and reviews rather than code, which scores 1; and a dash if it is not present or not stated in the pages read, which scores 0. The score is the sum, out of 10. Ties are broken by coding-specific before general, then a published measurement of its own, then adoption. The rule counts elements and does not judge quality. A study that measures other people's flows scores 0 on E5, which does not apply to it. Adoption for a repository is stars, forks, creation date, last push, latest release and licence from the GitHub API on 2026-10-04; for a closed product only what the vendor says.

The marks are the reading of each tool's own pages, which are linked from the captures under `raw/articles/` and `raw/papers/`. A reader can re-rank them.

## Ranking, part 1: tools and products

Marks: Y, p, or a dash as defined above. "Own measurement" says whether its own pages report a measurement that mixing, voting, selection or review helps. "Recent" means the last push was on or after 2026-07-06 (repositories only).

| Rank | Entry | E1 | E2 | E3 | E4 | E5 | Score | Coding | Own measurement | Recent |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Voratiq | Y | Y | Y | - | p | 7 | yes | no | no |
| 2 | LoopTroop | p | Y | p | Y | p | 7 | yes | no | yes |
| 3 | ai-jury | - | Y | Y | - | Y | 6 | yes (review) | yes, tiny | yes |
| 4 | Autopus-ADK | p | Y | Y | - | p | 6 | yes | no | yes |
| 5 | Trae Agent (paper, repository, SWE-bench record) | Y | Y | p | - | p | 6 | yes | yes | no |
| 6 | LLM Council (karpathy) | Y | Y | Y | - | - | 6 | no | no | no |
| 7 | Together MoA | Y | Y | p | - | p | 6 | no | yes (chat tasks) | no |
| 8 | Deliberation | - | Y | Y | - | p | 5 | yes (plan and code review) | no | yes |
| 9 | PAL MCP (was Zen MCP) | - | Y | Y | - | p | 5 | yes | no | no |
| 10 | Magpie (with the Milvus post) | - | Y | Y | - | p | 5 | yes (review) | yes, small | yes |
| 11 | OpenHands (inference-time scaling post) | p | Y | - | - | p | 4 | yes | yes | yes |
| 12 | Augment (Claude 3.7 and o1) | p | Y | - | - | p | 4 | yes | yes | (see entry) |
| 13 | TreeQuest and AB-MCTS | p | Y | - | - | p | 4 | partly | yes (puzzles) | no |
| 14 | Kilo Agent Manager | Y | Y | - | - | - | 4 | yes | no | yes |
| 15 | Cursor /best-of-n | Y | Y | - | - | - | 4 | yes | no | closed |
| 16 | Mozilla.ai Star Chamber | - | Y | Y | - | - | 4 | yes | no | not found |
| 17 | Parallel Code | p | Y | - | - | - | 3 | yes | no | yes |
| 18 | GitHub Agent HQ | - | - | p | Y | - | 3 | yes | no | closed |
| 19 | Zenflow | - | - | Y | p | - | 3 | yes | no (a speed claim) | closed |
| 20 | metaswarm | - | - | p | p | p | 3 | yes | no | no |
| 21 | SWE-AF | - | - | p | - | p | 2 | yes | yes, one prompt | yes |
| 22 | Aider architect/editor | - | p | - | - | p | 2 | yes | yes | no |
| 23 | oh-my-openagent | - | - | p | - | p | 2 | yes | no | yes |
| 24 | GitHub Spec Kit | - | - | - | Y | - | 2 | yes | no | yes |
| 25 | ChatDev | - | - | - | p | p | 2 | yes | no (in the README) | yes |
| 26 | Codex plugin for Claude Code | - | - | p | - | - | 1 | yes | no | yes |
| 27 | Amp oracle | - | - | p | - | - | 1 | yes | no | closed |
| 28 | MetaGPT | - | - | - | - | - | 0 | yes | no (in the README) | no |

## Ranking, part 2: studies and write-ups that measured something close

| Rank | Entry | E1 | E2 | E3 | E4 | E5 | Score | What was compared |
|---|---|---|---|---|---|---|---|---|
| S1 | N-Version Programming with Coding Agents (Ron, Baudry, Monperrus) | Y | Y | - | - | - | 4 | five vendors' agents, one spec, majority voting |
| S2 | Failure independence in LLM-generated code (Nogueira and others) | Y | Y | - | - | - | 4 | twelve models, 224 contest problems, majority voting |
| S3 | Ars Technica Minesweeper test (via a secondary summary) | Y | - | - | - | - | 2 | four vendors' agents, one prompt, scored by the publication |
| S4 | Cross-model code review (Xiang and others) | - | p | p | - | - | 2 | two vendors, each reviewing the other and itself |
| S5 | Greptile "model inversion" | - | - | p | - | - | 1 | two vendors' models reviewing each other's pull requests |
| S6 | One practitioner's hook (Proser) | - | - | p | - | - | 1 | Codex reviewing Claude's diffs; no numbers |
