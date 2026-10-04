---
title: Mixing models for coding, what exists, what is shown, and what postmaster adds
type: concept
standing: claimed
sources: [trials/2026-10-03-lane-audit, trials/2026-09-29-synthesis-audit, trials/2026-10-04-landscape-search, papers/agarwal-2026-specmine, papers/alenezi-2026-sdd-enterprise, papers/almeida-2026-llm-diversity, papers/anand-2026-aeval, papers/antoniades-2024-swesearch, papers/ashiga-2025-moacodeopt, papers/barkhordar-2026-code-attribution, papers/brilliant-1990-faults, papers/brown-2024-largemonkeys, papers/cemri-2025-mast, papers/chen-2022-codet, papers/chen-2023-reconcile, papers/chen-2023-usc, papers/chen-2024-llmcalls, papers/chen-2025-perforch, papers/chen-2026-cofailure, papers/cho-2026-agentroom, papers/choi-2025-debate-or-vote, papers/costanza-2026-argus, papers/dhanorkar-2026-human-oversight, papers/diaz-2026-sdd-human-agent-teamwork, papers/du-2023-debate, papers/eckhardt-1985-coincident-errors, papers/eckhardt-1991-redundancy, papers/edwards-2026-ask-or-assume, papers/ehrlich-2025-codemonkeys, papers/fadnavis-2026-trace-synthesis, papers/fu-2026-benchagent, papers/gao-2025-trae-agent, papers/geng-2026-caid, papers/goel-2025-great-models, papers/huang-2023-agentcoder, papers/huang-2026-deepswe, papers/inoue-2025-abmcts, papers/islam-2024-mapcoder, papers/jain-2025-r2egym, papers/jiang-2023-llmblender, papers/jimenez-2023-swe-bench, papers/kapoor-2025-hal, papers/kemerer-paulk-2009-review-rate, papers/khairi-2025-fusion-of-n, papers/khatua-2026-cooperbench, papers/kim-2025-correlated-errors, papers/kim-2025-scaling-agents, papers/knight-1986-independence, papers/kohli-2026-nine-judges, papers/kumar-2026-bigger-isnt-better, papers/kwok-2026-llmverifier, papers/lange-2025-shinkaevolve, papers/li-2022-alphacode, papers/li-2024-moreagents, papers/li-2025-selfmoa, papers/liang-2025-swebenchillusion, papers/littlewood-1989-forced-diversity, papers/littlewood-2001-diversity-review, papers/liu-2026-converged, papers/macedo-2026-prompt-to-process, papers/mahmud-2025-enslm, papers/marri-2026-constitutional-sdd, papers/martinez-2025-swebench-leaderboards, papers/merrill-2026-terminal-bench, papers/miller-2026-review-beats-planning, papers/nogueira-2026-failure-independence, papers/novikov-2025-alphaevolve, papers/pabba-2025-refine, papers/panickssery-2024-self-preference, papers/petersson-2004-capture-recapture, papers/ping-2025-verimoa, papers/piskala-2026-code-to-contract, papers/porter-1995-requirements-inspection-replication, papers/porter-1997-code-inspections-cost-benefits, papers/qiu-2026-adversarial-review, papers/rajan-2026-multiver, papers/richards-2026-agentlogs, papers/ron-2026-nvp-coding-agents, papers/saad-falcon-2024-archon, papers/schoenegger-2024-silicon-crowd, papers/shi-2022-mbrexec, papers/smit-2024-mad, papers/stone-2026-single-llm-incomplete-reviewer, papers/sunkaraneni-2026-boosting, papers/taghavi-2026-spec-kit-agents, papers/tran-2026-single-agent-budget, papers/tufano-2026-spec-driven-test-generation, papers/vallecillosruiz-2025-ensembles, papers/vargas-2025-slean, papers/verga-2024-poll, papers/vilasboas-2026-one-person-squad, papers/votta-1993-inspection-meeting, papers/wang-2022-selfconsistency, papers/wang-2024-moa, papers/wang-2024-plansearch, papers/wu-2024-inference-scaling, papers/wynn-2025-talk-not-cheap, papers/xia-2024-agentless, papers/xiang-2026-cross-model-review, papers/yang-2026-patchfusion, papers/yin-2025-agent-frameworks, papers/zeng-2025-e2edevbench, papers/zeng-2025-swr-bench, papers/zhang-2022-coderreviewer, papers/zhang-2024-dei, papers/zhang-2024-osca, papers/zhang-2025-stop-overvaluing-mad, papers/zhang-2026-aacr-bench, papers/zhang-2026-right-to-history, papers/zhao-2025-agglm, papers/zheng-2025-agentsight, papers/zhu-2025-multiagentbench, papers/zibaeirad-2025-dvdr-llm, articles/aclanthology-multiagentbench-2025, articles/addyosmani-adverse, articles/addyosmani-code-agent-orchestra, articles/agentops-ai-agentops, articles/aider-ai-aider, articles/aider-architect, articles/aider-r1-sonnet, articles/alecnielsen-adversarial-review, articles/anthropic-building-c-compiler, articles/anthropic-claude-code-agent-teams, articles/anthropic-claude-code-hooks, articles/anthropic-claude-code-monitoring, articles/anthropic-claude-code-plan-mode-docs, articles/anthropic-claude-code-review-blog, articles/anthropic-claude-code-review-docs, articles/anthropic-claude-sonnet-4-5-post, articles/anthropic-harness-design, articles/anthropic-infrastructure-noise, articles/anthropic-multi-agent-research-system, articles/anthropics-claude-code-code-review-plugin, articles/antonbabenko-deliberation, articles/aporter-inspection-structure, articles/augmentcode-augment-swebench-agent, articles/augmentcode-blog-claude-o1, articles/augmentcode-open-source-agent-orchestrators, articles/autopus-ai-autopus-adk, articles/autopus-ai-harness-assessment, articles/beehiveinnovations-pal-mcp-server, articles/berkayturanci-ai-jury, articles/berkayturanci-ai-jury-benchmark-results, articles/bloopai-vibe-kanban, articles/bmad-code-org-bmad-method, articles/boshu2-agentops, articles/bytedance-trae-agent, articles/bytedance-trae-swebench-verified-blog, articles/ccusage-ccusage, articles/cline-plan-and-act, articles/coderabbit-docs-architecture, articles/cognition-devin-ask-devin, articles/cognition-devin-managed-devins, articles/cognition-dont-build-multi-agents, articles/cognition-multi-agents-working, articles/conductor-home, articles/cursor-agent-trace, articles/cursor-building-bugbot, articles/cursor-changelog-2-0, articles/cursor-changelog-2-2, articles/cursor-docs-worktrees, articles/cursor-forum-best-of-n-models-bug, articles/cursor-plan-mode, articles/cursor-scaling-agents, articles/dagger-container-use, articles/datacurve-deepswe-blog, articles/entireio-cli, articles/entireio-cli-architecture, articles/firecrawl-codex-multi-agent-orchestration, articles/fission-ai-openspec, articles/gastownhall-gastown, articles/gemini-cli-extensions-conductor, articles/generalaction-emdash, articles/git-ai-project-git-ai, articles/github-blog-pick-your-agent, articles/github-blog-welcome-home-agents, articles/github-copilot-60-million-reviews, articles/github-docs-copilot-agent-sessions, articles/github-spec-kit, articles/google-antigravity-implementation-plan, articles/gotalab-cc-sdd, articles/graphite-effectiveness-guide, articles/greptile-homepage, articles/greptile-model-inversion, articles/gsd-build-get-shit-done, articles/helixml-helix, articles/ietf-draft-sharif-agent-audit-trail, articles/infoq-garg-spec-driven-pays-off, articles/karpathy-llm-council, articles/kilo-agent-manager-blog, articles/kiro-dev-docs, articles/langchain-langsmith-claude-code, articles/langfuse-coding-agent-tracing, articles/liliu-z-magpie, articles/linux-kernel-coding-assistants, articles/looptroop-ai-looptroop, articles/martinfowler-bockeler-sdd-three-tools, articles/mco-org-mco, articles/microsoft-vscode-copilot-plan-agent, articles/milvus-magpie-debate-benchmark, articles/mozilla-ai-star-chamber, articles/ng-adversarial-review, articles/obra-superpowers, articles/omnigent-ai-omnigent, articles/open-gsd-gsd-core, articles/openai-codex-best-of-n-announcement, articles/openai-codex-cloud-tasks-cli, articles/openai-codex-github-docs, articles/openai-codex-plugin-cc, articles/openai-codex-rollout-trace, articles/openai-symphony, articles/openhands-blog-inference-time-scaling, articles/opentelemetry-semantic-conventions-genai, articles/papercomputeco-tapes, articles/postmaster-repository, articles/qodo-introducing-qodo-2-0, articles/ruvnet-ruflo, articles/sakana-ab-mcts, articles/sakanaai-treequest, articles/simple10-agents-observe, articles/smtg-ai-claude-squad, articles/specstoryai-getspecstory, articles/spillwavesolutions-parallel-worktrees, articles/stablyai-orca, articles/superset-sh-superset, articles/sweagent-mini-swe-agent, articles/tbench-terminal-bench-2-1, articles/tessl-spec-driven-tile, articles/the-pr-agent-pr-agent, articles/thoughtworks-agent-trace, articles/togethercomputer-moa, articles/traycer-traycer, articles/untrivial-ai-agent-orchestrator, articles/vibekanban-goodbye-bloop, articles/voratiq-how-it-works, articles/voratiq-voratiq, articles/warp-run-multiple-agents, articles/windsurf-arena-mode, articles/wolfiesch-omp-best-of, articles/yeachan-heo-oh-my-claudecode, articles/zackproser-codex-reviews-claude]
updated: 2026-10-04
---

# Mixing models for coding: what exists, what is shown, and what postmaster adds

**Claim.** Each part of postmaster's flow exists elsewhere, most of it in tools that are used far more
widely. Mixing models for coding is neither proven nor disproven. What postmaster adds, as far as
238 sources and a limited search show, is the whole combination run as one audited process, and
an audit of its own flow. That audit points to reviewers, not to a second implementer, as the part that
earns its keep. The README says the opposite of the audit on the second implementer, and the evidence
supports the audit.

**Standing: claimed.** Outside work cannot move a standing here ([the schema](../schema.md)). The page
cites 110 papers and 128 project pages, vendor posts and repositories, read on 2026-10-04 except three
papers this wiki already held, and checks the README against [the lane audit](several-lanes.md), which promotes no run. It was raised as
[#277, Research: what exists for coding with several models, whether mixing models is proven, and what postmaster adds](https://github.com/brindlewick/postmaster/issues/277).

## The answer

**What exists.** Running several coding agents on one repository, each in its own worktree, is
routine: Orca has 84,682 stars, and Cursor, GitHub, Windsurf, Warp and Codex ship it. Giving one task to
several models and letting a person pick is a shipped feature in Cursor (`/best-of-n`), Windsurf
(Arena Mode), Kilo Code and GitHub Agent HQ. Several agents reviewing a change, in some tools on different vendors' models, is offered
by Claude Code Review, Qodo and CodeRabbit and by about ten open-source tools. A person's sign-off on a spec before code is
mainstream: Spec Kit has 140,068 stars and Superpowers 295,092. Agents' records are kept by Entire,
git-ai and Agent Trace. Strength: shown by the tools' own pages. Almost none of them offers evidence that
the feature helps. [The map](#the-map) lists them in six groups.

**Is mixing models for coding proven? No, and it is not disproven.**

| Claim | Answer | Strength |
| --- | --- | --- |
| Several models beat the best single model | **Not settled.** Reported gains over the best member are small point estimates at unmatched cost, such as +1.4 points for three vendors and an outside verifier on SWE-bench Verified. In the one controlled table from a team that shipped a three-vendor ensemble, the mixture scored 65.67% and Claude alone 66.40% | one report |
| Different models beat the same model run several times | **Not settled.** The two cleanest tests, on general tasks, find one strong model sampled repeatedly at least as good as a mix (65.7 against 59.1 at equal calls). No code study compares them at equal cost on realistic software | controlled studies, preprints, conflicting |
| A model that reads several candidates and writes one beats picking the best | **Not shown for code.** The one controlled comparison has a model asked to write the final patch solving 317 of 500 SWE-bench Verified issues where the same model choosing solved 396. Shown for open-ended general tasks | one controlled comparison for code |
| Independent reviewers find defects a single reviewer misses | **Shown that several reviewers or runs find more than one, with more false alarms.** One run finds about half of what several find together in the studies that report it. Not shown for different vendors against repeated runs of one model at equal cost | several small studies |

Under all four sits the older question. **Independently written versions do not fail independently.**
Knight and Leveson (1986) had 27 versions run on a million inputs and rejected independence. Replications
in 2026 with coding agents from five vendors found 3.7 times more shared failures than independence
predicts, and mixing models decorrelated failures only partly. A lane that cannot see another lane's work is
isolated, not independent in the sense that matters. Strength: controlled studies.

**What postmaster adds.** Three things were not found elsewhere. (1) The whole combination: a person's
signed-off spec, several vendors' implementers in separate worktrees, a synthesis composed by an agent that
is not one of the lanes, and capped review rounds by several models under several lenses. The closest of 28
tools scored 7 of 10 on a count of five elements, and each lacked at least one. (2) A measured account of
its own flow. The lane audit covers 18 real runs and 264 verified serious findings, and no other project
read publishes one. (3) Fixture runs that score the flow against hidden tests kept out of the lanes' worktrees.
Nothing like it was found. The search was limited, and a "not found" describes the search. Strength:
not found, for all three.

**What it claims that the evidence does not support.** The README says the synthesis "took
contributions from both lanes every time". The coachman's record cannot fail that test, because the
runbook requires it to name something from every lane, and in git the second lane wrote 0% to 25% of the
code in the five real runs with counts. The README says a second lane's agreement is corroboration "you
can act on", and that is unmeasured. Lanes "unable to see each other's work" holds by layout and instruction,
and by a sandbox only when confinement is on. A script saving tokens is not measured. The audit's own
reading is that a second reviewer earns its keep and a second implementer is not shown to be needed.

**What can be said in public.** That postmaster combines these parts as one process and publishes the
records of its own audits; that more reviewers find more defects; and that the question of mixing models is
open. Not that it is first or unique, that mixing models gives better code, that the synthesis takes the best
of both lanes, that agreement between lanes is corroboration, or that it is open source, since the
repository has no licence file. [The full list](#what-can-and-cannot-be-said-in-public) gives the strength
of each.

## How this was read

Each source was read on 2026-10-04, through a web search and a page fetch, except three papers this wiki
already held, which are cited from their earlier captures. Repository figures,
such as stars and the date of the last push, come from the GitHub API on the same day, by plain
read requests. Nothing was installed, cloned, run or posted. The page cites 110 papers and 128
pages, each captured under `raw/` with its address, the day it was read and the passages relied on.

**Strength.** Each answer says how strong its evidence is, in four grades.

- **Controlled study**: a comparison with a control, reported with its numbers.
- **One report**: one team's experience, one vendor's account, or a single small study.
- **Argued**: stated without a measurement.
- **Not found**: nothing turned up. This describes the search, not the world.

**Code and general.** Evidence from software tasks (code generation, repair, review, issue
resolution) is kept apart from evidence from other language-model work (question answering,
mathematics, chat, judging). A general result is no proof about code, and the page says which it is.

**How a quote was read.** The fetch tool returns a page as text processed by a small model, and it
can paraphrase. PDFs could not be read directly, so full texts are arXiv HTML pages, author
manuscripts, or a PDF-to-text conversion that may drop words. A passage in a capture is marked
`checked` when two reads with different prompts agreed word for word, or when it matched a raw file.
Otherwise it is marked `not checked`, and a number taken from such a passage says so here. Where a
paper could be read only in part, the page says what part.

**The search.** [The search record](../../raw/trials/2026-10-04-landscape-search/method.md) lists
every query, the selection rule for each group, the controls, and what blocked. The search budget of
the web tool was spent partway, so later discovery went by direct fetch. A "not found" below is about
those searches. A search is not proof that something does not exist.

**This wiki's own records.** Claims about postmaster rest on [the lane audit](several-lanes.md) and
[the earlier synthesis audit](combining-models.md), cited as trials, and on the repository at
commit `8ea503d`. Outside work moves no standing here, so this page stays **claimed**.

## The map

Six groups, as the ticket asks. Each row names the project or paper, links it, gives the day it was
read, and says in one sentence what it does. Use is stars from the GitHub API on 2026-10-04, or what
the vendor says about itself, or nothing where the pages gave none. Stars measure interest, not
quality: a repository with 295,092 stars says on its own page that it cannot tell how many people
use it [@articles/obra-superpowers/passages.md]. Each group says how its rows were chosen.

### 1. Parallel and best-of-N coding agents

Tools and products that run several coding agents at once on one repository, in worktrees,
containers or the cloud, and those that give one task to several agents or models. Chosen from
GitHub list pages sorted by stars, keeping in-scope repositories with at least 4,000 stars, then
adding every lead the ticket named, any repository that publishes numbers for choosing among
candidates, and the vendors' own pages for closed products. 39 entries were read, and the rows
below are the most used and the ones that run one task several times. A GitHub search for a nonsense
phrase returned 0 repositories and a search for `claude squad` returned that repository first. The
searches used the words worktrees and orchestrator, and tools that call themselves swarms or
harnesses may have been missed
[@trials/2026-10-04-landscape-search/method.md].

| Entry | Read | What it does | Use |
| --- | --- | --- | --- |
| [Cursor](https://cursor.com/docs/configuration/worktrees) | 2026-10-04 | `/best-of-n` runs the same task on several models, each in its own worktree, and an automatic judge recommends one run for a person to pick [@articles/cursor-changelog-2-2/passages.md]. | closed product, no figures |
| [OpenAI Codex](https://github.com/openai/codex/blob/afb436df8b70bb5bc57b86d9a3e829968988cd21/codex-rs/cloud-tasks/src/cli.rs) | 2026-10-04 | A cloud task can run one to four times, and subagent workflows run specialised agents in parallel [@articles/openai-codex-best-of-n-announcement/passages.md]. | closed product, no figures |
| [GitHub Agent HQ](https://github.blog/news-insights/company-news/pick-your-agent-use-claude-and-codex-on-agent-hq/) | 2026-10-04 | A person can assign one task to several of Copilot, Claude and Codex and compare the draft pull requests they open. | closed product; third-party agents are a public preview |
| [Windsurf Arena Mode](https://docs.devin.ai/desktop/cascade/arena.md) | 2026-10-04 | Runs one prompt on several models, each in its own worktree, with the model names hidden until a person picks one. | closed product, no figures |
| [Claude Code agent teams](https://code.claude.com/docs/en/agent-teams) | 2026-10-04 | Experimental teams of Claude Code sessions with a lead, a shared task list and messages between teammates. | closed; the page calls it experimental and off by default |
| [Warp](https://docs.warp.dev/guides/agent-workflows/how-to-run-multiple-ai-coding-agents) | 2026-10-04 | A guide to running several coding agents in tabs, worktrees and the cloud, including one task on different agents and a way to merge the results. | closed product, no figures |
| [Conductor](https://www.conductor.build) | 2026-10-04 | A Mac app that runs Claude Code, Codex and Cursor agents in isolated workspaces, with a diff view, for a person to review and merge. | closed product, no figures |
| [Devin managed sessions](https://docs.devin.ai/work-with-devin/advanced-capabilities.md) | 2026-10-04 | A coordinator session hands parts of a large task to child sessions, each in its own virtual machine, and a workflow script can fan work out and record every call. | closed product, no figures |
| [Orca](https://github.com/stablyai/orca/blob/87bc51d3710332ea8b0f7f0e5610a31413a79582/README.md) | 2026-10-04 | A desktop app that runs coding agents side by side, each in its own worktree, where one prompt can go to several agents and a person picks. | 84,682 stars |
| [ruflo](https://github.com/ruvnet/ruflo/blob/caf5078be6627c6496fa2497a63b72e80a0bcf14/README.md) | 2026-10-04 | Runs swarms of agents with assigned roles and says its agents reach consensus. | 73,831 stars |
| [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/13543f9d6fc1a13a15b68fe5c97baeb3268569e2/README.md) | 2026-10-04 | A Claude Code plugin that runs staged team pipelines and can start Codex, Gemini, Antigravity, Grok or Cursor workers in tmux panes. | 39,572 stars |
| [Vibe Kanban](https://github.com/BloopAI/vibe-kanban/blob/d5cbb5380fa0b32e98ef9b8d987f63decce4be3a/README.md) | 2026-10-04 | A kanban board that starts one coding agent per task in a workspace with its own branch. | 28,259 stars; its company announced on 2026-04-10 that it is shutting down and the project goes on community-maintained [@articles/vibekanban-goodbye-bloop/passages.md] |
| [Symphony](https://github.com/openai/symphony/tree/be10a1b79df723d6d7612b5651c8522704dafb2e) | 2026-10-04 | A specification and reference service that reads tickets from a tracker, makes an isolated workspace for each, runs a coding agent in it and ends at a handoff to a person. | 27,526 stars |
| [Kilo Code Agent Manager](https://blog.kilo.ai/p/agent-manager-run-multiple-agents) | 2026-10-04 | Runs agents in parallel worktrees, and its multi-version mode runs the same prompt in up to four versions, on different models if chosen, for a person to pick from. | 27,488 stars for the whole product |
| [Gas Town](https://github.com/gastownhall/gastown/blob/649b832b7672bc7a2dbef26f5983aba6198b819b/README.md) | 2026-10-04 | A workspace manager with a coordinator agent, worker agents with persistent identity, and a merge queue. | 18,248 stars |
| [Superset](https://github.com/superset-sh/superset/blob/84fa11a1f45a2ac9d06d528a2711dc71056f9fac/README.md) | 2026-10-04 | A desktop app where each task gets a worktree and a command-line agent, and one task can be raced across workspaces for a person to keep one. | 14,864 stars |
| [Agent Orchestrator](https://github.com/Untrivial-ai/agent-orchestrator/blob/fb55fdc159106c2d1f7dc2bba2afab87e1a71c87/README.md) | 2026-10-04 | A workspace with one worker agent per task, a project-level orchestrator that plans and starts workers, and a board built from session, pull request, CI and review state. | 12,718 stars |
| [Omnigent](https://github.com/omnigent-ai/omnigent/tree/ee3ca7cca758015de6a4de68615657486d9d1f81) | 2026-10-04 | An alpha meta-harness whose example orchestrator sends independent tasks to coding agents of different vendors in worktrees, has a different vendor review each diff, and leaves the merge to a person. | 10,482 stars |
| [Claude Squad](https://github.com/smtg-ai/claude-squad/blob/ce1ffb4392b01f38e2c4599c7c84d2a93973b138/README.md) | 2026-10-04 | A terminal app that runs several agents in tmux sessions, one git worktree per task. | 8,567 stars |
| [Emdash](https://github.com/generalaction/emdash/blob/a39d9c8339ebf2d96c287fa78bf28b7b5e41d2ba/README.md) | 2026-10-04 | A desktop app that runs coding agents in parallel, one worktree per task, locally or over SSH. | 5,905 stars |
| [container-use](https://github.com/dagger/container-use/blob/2e43e625e95216b719ec9338f4034fd3a0be2734/README.md) | 2026-10-04 | An MCP server that gives each coding agent its own container and git branch. | 4,055 stars |
| [MCO](https://github.com/mco-org/mco/blob/d7fef6c96dca10a3ed0fd7c5ecd505e665ca455e/README.md) | 2026-10-04 | Runs one task on several vendors' coding agents and leaves the raw answers for a person to compare, with no consensus step. | 531 stars |
| [Voratiq](https://github.com/voratiq/voratiq) | 2026-10-04 | Has Claude, Codex or Gemini agents draft specs and implement one spec several times, ranks the outputs with blinded verifier agents, and applies one. | 74 stars, last push 2026-05-05 |
| [omp-best-of](https://github.com/wolfiesch/omp-best-of/blob/b5d2c1e298e948d5ffe43b4e6e26ff528019bcc5/README.md) | 2026-10-04 | A plugin that runs several candidates of one model on one task in isolated workspaces, ranks their trajectories with a verifier model, and can apply the winner's patch. | 71 stars; reports its own small runs |
| [parallel-worktrees](https://github.com/SpillwaveSolutions/parallel-worktrees/blob/89eae06db5df402fe223f83258cc5c85095db10d/README.md) | 2026-10-04 | A skill that runs several identical prompts as parallel Claude Code agents in worktrees, for a person to pick the best. | 16 stars |

Three roundups were mined for names and not used as evidence:
[Augment's list of open-source orchestrators](https://www.augmentcode.com/tools/open-source-agent-orchestrators),
[The Code Agent Orchestra](https://addyosmani.com/blog/code-agent-orchestra/) and
[Firecrawl's article on Codex orchestration](https://www.firecrawl.dev/blog/codex-multi-agent-orchestration).

What the group shows. Running several agents at once, each in its own worktree, is routine.
Running the same task on several models and leaving the choice to a person is a shipped feature in
Cursor, Windsurf, Kilo Code, GitHub Agent HQ, Codex and several open-source tools. A person picks
in nearly all of them. Cursor adds a judge's recommendation, and omp-best-of and Voratiq have
verifier agents rank the candidates. No tool in the group is described as writing one change from
several. Voratiq's `reduce` writes one summary from several artifacts
[@articles/voratiq-how-it-works/passages.md]. None compares different models with one model repeated. Almost none
offers evidence that the feature helps. omp-best-of reports small runs of its own and says it
withdrew its earlier headline figures [@articles/wolfiesch-omp-best-of/passages.md]. Model diversity can also fail
without notice: Cursor's `/best-of-n` ran every runner on one model until staff said it was fixed
on 2026-07-22 [@articles/cursor-forum-best-of-n-models-bug/passages.md]. Strength: shown by the tools' own pages;
evidence of benefit not found.

### 2. Synthesis of several candidates

Systems that make one result from several candidates, by choosing, ranking, voting or writing, and
the studies that test whether it works. A paper was read in full when it reports a measured
comparison between several models or agents and one, or between choosing and writing, or when the
ticket named it. Vendor posts and leaderboard entries that describe an ensemble are marked as
reports. Code and general work are in two tables, and the numbers are in
[the evidence section](#is-mixing-models-shown-to-work). The queries and their controls are in
[the search record](../../raw/trials/2026-10-04-landscape-search/method.md). A year with `arXiv`
means the paper's arXiv record names no venue, and it may have been published elsewhere.

**Code**

| Entry | Read | What it does | Year and venue, or use |
| --- | --- | --- | --- |
| [Diversity Empowers Intelligence (DEI)](https://arxiv.org/abs/2408.07060) | 2026-10-04 | A model scores the patches that several existing SWE-bench agents produced and returns the best-scored one. | arXiv 2024 |
| [CodeMonkeys](https://arxiv.org/abs/2501.14723) | 2026-10-04 | Samples ten edit-and-test trajectories per issue from one model and picks one by voting and a selection trajectory, and also runs the selector over four existing leaderboard systems. | arXiv 2025 |
| [Trae Agent](https://arxiv.org/abs/2507.23370) | 2026-10-04 | A coder agent writes candidate patches, regression tests prune them, and a selector agent picks one by repeated selection and majority vote, with one setting that takes candidates from three vendors' models. | arXiv 2025; repository [bytedance/trae-agent](https://github.com/bytedance/trae-agent) 12,126 stars |
| [PatchFusion](https://arxiv.org/abs/2607.01597) | 2026-10-04 | Builds one patch from a pool of candidate patches, with no tests and no model, by keeping the edits that several candidates share. | arXiv 2026 |
| [REFINE](https://arxiv.org/abs/2510.03588) | 2026-10-04 | Has a model merge or choose among the draft patches of existing repair systems into one patch per group. | arXiv 2025 |
| [LLM-as-a-Verifier](https://arxiv.org/abs/2607.05391) | 2026-10-04 | Rates candidate trajectories from three vendors' models with another model and picks one. | arXiv 2026 |
| [EnsLLM](https://arxiv.org/abs/2503.15838) | 2026-10-04 | Takes one program from each of 14 models and returns the one most similar to the others. | arXiv 2025 |
| [Wisdom and Delusion of LLM Ensembles](https://arxiv.org/abs/2510.21513) | 2026-10-04 | Gives ten small open models ten outputs each and tests five ways of choosing which candidates to validate. | arXiv 2025 |
| [PerfOrch](https://arxiv.org/abs/2510.01379) | 2026-10-04 | Gives generation, debugging and refinement of each problem to the model ranked best for that language and category, and tries up to five models in turn. | arXiv 2025 |
| [Mixture-of-agents for code optimisation](https://arxiv.org/abs/2508.03329) | 2026-10-04 | Agents on different models propose optimised versions of a snippet and an aggregator model writes one. | arXiv 2025; authors include staff of the company whose baseline it beats |
| [VeriMoA](https://arxiv.org/abs/2510.27617) | 2026-10-04 | Layers of agents on one model propose hardware designs in Verilog and an aggregator writes the final one. | arXiv 2025 |
| [AB-MCTS](https://arxiv.org/html/2503.04412v5) | 2026-10-04 | A tree search that decides at each step whether to widen or refine an answer, and in its multi-model form which model to call; see also [the developer's post](https://sakana.ai/ab-mcts/). | NeurIPS 2025 spotlight per its abstract page; [TreeQuest](https://github.com/SakanaAI/treequest) 567 stars |
| [AlphaEvolve](https://arxiv.org/abs/2506.13131) | 2026-10-04 | Evolutionary program search that mixes a cheap model for many candidates with a stronger one for occasional better ones. | arXiv 2025 |
| [ShinkaEvolve](https://arxiv.org/abs/2509.19349) | 2026-10-04 | Evolutionary program search that picks among several vendors' models with a bandit. | arXiv 2025 |
| [Augment Code post](https://www.augmentcode.com/blog/1-open-source-agent-on-swe-bench-verified-by-combining-claude-3-7-and-o1) | 2026-10-04 | Claude Sonnet 3.7 generates candidate solutions and OpenAI's o1 picks the majority-vote one, for a reported 65.4% on SWE-bench Verified. | vendor report; [repository](https://github.com/augmentcode/augment-swebench-agent) 885 stars |
| [OpenHands critic post](https://openhands.dev/blog/sota-on-swe-bench-verified-with-inference-time-scaling-and-critic-model) | 2026-10-04 | Runs the agent several times on one issue and picks one result with a trained critic. | vendor report; OpenHands 89,953 stars |
| [Claude Sonnet 4.5 announcement](https://www.anthropic.com/news/claude-sonnet-4-5) | 2026-10-04 | A footnote reports a higher SWE-bench Verified score with parallel test-time compute, where an internal scoring model picks among patches. | vendor announcement |
| [Aider architect and editor](https://aider.chat/2024/09/26/architect.html) | 2026-10-04 | One model describes the solution and another writes the edits; see also [the 2025 post](https://aider.chat/2025/01/24/r1-sonnet.html). | vendor report; Aider 49,369 stars |
| [Agentless](https://arxiv.org/abs/2407.01489v2) | 2026-10-04 | Draws 40 patches, filters them with regression and reproduction tests, and picks one by majority vote. | arXiv 2024 |
| [R2E-Gym](https://arxiv.org/abs/2504.07164) | 2026-10-04 | Chooses among 26 candidate patches with two kinds of verifier, tests that a testing agent writes and a trained scorer. | arXiv 2025 |
| [SWE-Search](https://arxiv.org/abs/2410.20285) | 2026-10-04 | A tree search with a discriminator of debating instances of one model that picks among finished candidates. | arXiv 2024 |
| [Large Language Monkeys](https://arxiv.org/abs/2407.21787) | 2026-10-04 | Samples one model many times and counts a problem as solved if any sample passes the checker. | arXiv 2024 |
| [AlphaCode](https://arxiv.org/abs/2203.07814) | 2026-10-04 | Draws up to a million programs per problem, filters them on example tests, clusters the rest by behaviour and submits ten. | Science, 2022 |
| [CodeT](https://arxiv.org/abs/2207.10397) | 2026-10-04 | Chooses among a model's sampled programs by agreement over tests the same model wrote. | arXiv 2022 |
| [MBR-Exec](https://arxiv.org/abs/2204.11454) | 2026-10-04 | Chooses among sampled programs by how well their execution results agree with the other samples. | EMNLP 2022 per its arXiv record |
| [Coder-Reviewer reranking](https://arxiv.org/abs/2211.16490) | 2026-10-04 | Reranks samples by the likelihood of the code given the instruction and of the instruction given the code. | arXiv 2022 |
| [More Agents Is All You Need](https://arxiv.org/abs/2402.05120) | 2026-10-04 | Samples one model up to 40 times and picks the sample most similar to the others. | TMLR |
| [PlanSearch](https://arxiv.org/abs/2409.03733) | 2026-10-04 | Makes one model's samples more diverse by drawing observations and plans in natural language before code. | arXiv 2024 |
| [Agentic Systems as Boosting Weak Reasoning Models](https://arxiv.org/abs/2605.14163) | 2026-10-04 | Samples eight patches from one small model and picks one with critics and comparators of the same model. | arXiv 2026 |
| [AgentCoder](https://arxiv.org/abs/2312.13010) | 2026-10-04 | One model plays a programmer, a test designer that does not see the code, and an executor. | arXiv 2023 |
| [MapCoder](https://arxiv.org/abs/2405.11403) | 2026-10-04 | One model plays retrieval, planning, coding and debugging roles. | arXiv 2024 |

**General language-model work**

| Entry | Read | What it does | Year and venue, or use |
| --- | --- | --- | --- |
| [Mixture-of-Agents](https://arxiv.org/html/2406.04692v1) | 2026-10-04 | Layers of different open models each read the previous layer's answers, and an aggregator writes the final one. | arXiv 2024; [reference code](https://github.com/togethercomputer/MoA) 2,980 stars, last push 2025-01-07 |
| [Rethinking Mixture-of-Agents (Self-MoA)](https://arxiv.org/html/2502.00674) | 2026-10-04 | Compares mixing different models with aggregating samples of the single best model, at the same number of calls. | arXiv 2025 |
| [Beyond Consensus](https://arxiv.org/html/2605.29116v1) | 2026-10-04 | An aggregator reads complete reasoning traces, and one model with perturbed inputs is set against pools of different models. | arXiv 2026 |
| [When Does Combining Language Models Help?](https://arxiv.org/html/2606.27288) | 2026-10-04 | Shows that routing, voting and mixture-of-agents accuracy is capped by the share of queries on which every model is wrong. | arXiv 2026 |
| [LLM-Blender](https://ar5iv.labs.arxiv.org/html/2306.02561) | 2026-10-04 | Ranks several models' answers pairwise and fuses the top ones with a trained model. | arXiv 2023 |
| [Making, not Taking, the Best of N](https://arxiv.org/html/2510.00931v1) | 2026-10-04 | A model fuses N candidate answers into one instead of picking the best. | arXiv 2025 |
| [Archon](https://arxiv.org/html/2409.15254v6) | 2026-10-04 | Searches over inference-time architectures that combine ensembling, fusion, ranking and verification of several models. | arXiv 2024 |
| [Optimized sample compute allocation](https://arxiv.org/html/2410.22480) | 2026-10-04 | Learns how to spend a fixed inference budget across models and sampling settings. | arXiv 2024 |
| [ReConcile](https://arxiv.org/html/2309.13007v3) | 2026-10-04 | Different models discuss over rounds and a confidence-weighted vote decides. | arXiv 2023 |
| [Multiagent debate](https://ar5iv.labs.arxiv.org/html/2305.14325) | 2026-10-04 | Several instances of one model debate and revise their answers over rounds. | arXiv 2023 |
| [Wisdom of the silicon crowd](https://arxiv.org/html/2402.19379v6) | 2026-10-04 | Takes the median forecast of twelve models and compares it with a human crowd. | arXiv 2024 |
| [Replacing Judges with Juries](https://arxiv.org/html/2404.18796) | 2026-10-04 | A panel of three smaller judges from three model families replaces one large judge. | arXiv 2024 |
| [Universal Self-Consistency](https://arxiv.org/html/2311.17311) | 2026-10-04 | A model reads several samples and picks the most consistent one. | arXiv 2023 |
| [AggLM](https://arxiv.org/html/2509.06870) | 2026-10-04 | A trained aggregator reads several solutions and writes a final one. | arXiv 2025 |
| [Self-consistency](https://ar5iv.labs.arxiv.org/html/2203.11171) | 2026-10-04 | Samples several reasoning paths from one model and takes the majority answer. | arXiv 2022 |
| [Are More LLM Calls All You Need?](https://arxiv.org/html/2403.02419) | 2026-10-04 | Studies how the accuracy of voting systems scales with the number of calls. | arXiv 2024 |
| [Inference scaling laws](https://arxiv.org/html/2408.00724v3) | 2026-10-04 | Measures how problem-solving performance scales with the inference compute spent. | arXiv 2024 |
| [Should we be going MAD?](https://arxiv.org/html/2311.17371v3) | 2026-10-04 | Compares multi-agent debate strategies for language models. | arXiv 2024 |
| [Debate or Vote](https://arxiv.org/html/2508.17536v2) | 2026-10-04 | Compares debate with voting among agents. | arXiv 2025 |
| [Stop Overvaluing Multi-Agent Debate](https://arxiv.org/html/2502.08788v3) | 2026-10-04 | Tests five debate methods against chain-of-thought and self-consistency on nine benchmarks, then mixes two models in debate. | arXiv 2025 |
| [Talk Isn't Always Cheap](https://arxiv.org/html/2509.05396v1) | 2026-10-04 | Studies how debate among agents can fail, including with a weak model in the group. | arXiv 2025 |

What the group shows. Every way of making one result from several has been tried. The papers repeat
one point: a pool of candidates is easy to get, and a good choice from it is hard. In the code papers
the gap between a pool's best-case reach and what a selector gets is large, and the one controlled
comparison of writing against choosing found a model's written patch worse than its choice.
Strength: controlled studies for single comparisons, one report for most.

### 3. Multi-agent and adversarial review

Tools and papers in which several agents or several models review code, a diff or a plan. Chosen
from search results, the vendors' own pages, GitHub searches and the leads the ticket named. This
wiki already holds fourteen papers on review, listed in [the sources page](../sources/index.md), and
they are not repeated. The ticket's lead `arXiv 2608.18167` and both repositories it named exist and
are read here. One search did not find `alecnielsen/adversarial-review`, and the API did.

| Entry | Read | What it does | Venue or use |
| --- | --- | --- | --- |
| [Claude Code Review](https://code.claude.com/docs/en/code-review) | 2026-10-04 | On a pull request, several agents run in parallel, each on a different class of issue, followed by a verification step, deduplication and severity ranking, with inline comments posted; see also [the vendor's post](https://claude.com/blog/code-review). | closed research preview for Team and Enterprise plans |
| [Claude Code `code-review` plugin](https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/code-review/README.md) | 2026-10-04 | One command launches four agents in parallel, a separate scorer rates each issue from 0 to 100, and only issues rated 80 or above are posted. | a folder in a repository with 149,351 stars |
| [Cursor Bugbot](https://cursor.com/blog/building-bugbot) | 2026-10-04 | Reviews pull requests; the early design ran eight passes with a different diff order each and kept the bugs most passes found, and the vendor later moved to an agentic design. | vendor says more than two million pull requests a month |
| [GitHub Copilot code review](https://github.blog/ai-and-ml/github-copilot/60-million-copilot-code-reviews-and-counting/) | 2026-10-04 | Reviews pull requests with an agent that reads repository context through tool calls. | vendor says 60 million reviews and more than one in five reviews on GitHub |
| [OpenAI Codex review](https://learn.chatgpt.com/docs/third-party/github) | 2026-10-04 | Reviews a pull request when someone comments `@codex review`, or automatically if turned on. | not stated |
| [CodeRabbit](https://docs.coderabbit.ai/overview/architecture) | 2026-10-04 | Reviews pull requests with several named agents and, the vendor says, a different model for each stage. | not stated on the pages read |
| [Greptile](https://www.greptile.com/) | 2026-10-04 | Reviews pull requests, and its home page says parallel agents review changes and assess impact beyond the diff. | vendor says over 22,000 teams |
| [Qodo 2.0](https://www.qodo.ai/blog/introducing-qodo-2-0/) | 2026-10-04 | Reviews with several specialised agents, each with its own context, and a judge agent that merges and filters their findings. | not stated |
| [PR-Agent](https://raw.githubusercontent.com/The-PR-Agent/pr-agent/main/README.md) | 2026-10-04 | Runs `/review`, `/improve`, `/ask` and similar commands on a pull request, each with one model call. | 13,258 stars |
| [Graphite Agent](https://graphite.com/guides/effectiveness-and-limitations-of-ai-code-review) | 2026-10-04 | Reviews pull requests, and the vendor's guide says little about how. | not stated |
| [Codex plugin for Claude Code](https://github.com/openai/codex-plugin-cc) | 2026-10-04 | Lets a Claude Code user run Codex for a normal or steerable review and delegated tasks, with an optional gate that blocks Claude from stopping while a Codex review finds issues. | 33,828 stars |
| [ng/adversarial-review](https://raw.githubusercontent.com/ng/adversarial-review/main/README.md) | 2026-10-04 | Runs an Optimizer and a Skeptic agent per lane, has the Skeptic challenge the Optimizer's findings, fixes the consensus findings and runs a bounded verify loop. | 14 stars |
| [alecnielsen/adversarial-review](https://raw.githubusercontent.com/alecnielsen/adversarial-review/main/README.md) | 2026-10-04 | A shell prototype in which one Claude agent and one Codex agent review code in parallel, critique each other, and then Claude decides and fixes. | 43 stars |
| [adverse](https://raw.githubusercontent.com/addyosmani/adverse/main/README.md) | 2026-10-04 | Runs three reviewer personas on one model, has each answer the others in a second round, and merges the findings with a script. | 60 stars |
| [PAL MCP server](https://github.com/BeehiveInnovations/pal-mcp-server) | 2026-10-04 | An MCP server that lets a coding agent ask other vendors' models for reviews, consensus, planning and pre-commit checks. | 11,767 stars, last push 2025-12-15 |
| [The Star Chamber](https://blog.mozilla.ai/the-star-chamber-multi-llm-consensus-for-code-quality/) | 2026-10-04 | A skill that sends a review to several vendors' models, each reviewing independently, and sorts findings by how many models raised them. | 4 stars for the repository its author names |
| [Magpie](https://github.com/liliu-z/magpie) | 2026-10-04 | Several vendors' command-line agents review one pull request independently, debate for a set number of rounds, and a verifier agent checks each issue against the code. | 175 stars; the builder's post [reports 15 pull requests](https://milvus.io/blog/ai-code-review-gets-better-when-models-debate-claude-vs-gemini-vs-codex-vs-qwen-vs-minimax.md) |
| [ai-jury](https://github.com/berkayturanci/ai-jury) | 2026-10-04 | Several vendors' coding agents review one diff, debate, and reach one verdict by a chair's synthesis or a panel vote; see also [its benchmark](https://github.com/berkayturanci/ai-jury/blob/main/docs/benchmark-results.md). | 8 stars |
| [Deliberation](https://github.com/antonbabenko/deliberation) | 2026-10-04 | An MCP server that has other vendors' models review a plan, with a blind first verdict, an arbiter and a round cap. | 167 stars |
| [A hook that has Codex review Claude's diffs](https://zackproser.com/blog/codex-reviews-claudes-diffs) | 2026-10-04 | One practitioner's hook sends substantial diffs from Claude Code to Codex for an adversarial review before the author sees the patch. | one blog post, no numbers |
| [Adversarial Review](https://arxiv.org/html/2608.18167) | 2026-10-04 | A main agent writes, a reviewer reviews, and a critic audits the review before the main agent edits. | workshop paper, ICML 2026 DL4C |
| [A single LLM is an incomplete reviewer](https://zenodo.org/records/21328807) | 2026-10-04 | Counts how many of a human-reconciled set of issues each of fifteen model versions finds, and what a second reviewer adds. | Zenodo preprint 2026, abstract only |
| [SWR-Bench](https://arxiv.org/html/2509.01494) | 2026-10-04 | Scores code reviewers on 1,000 manually verified pull requests, including the effect of merging several runs of one model. | FSE 2026 research track |
| [Kumar et al.](https://arxiv.org/html/2606.15689) | 2026-10-04 | Compares five models as code reviewers on 150 samples, alone and combined. | arXiv 2026 |
| [MultiVer](https://arxiv.org/html/2602.17875v1) | 2026-10-04 | Combines four role-prompted agents of one model to detect vulnerabilities in Python code. | arXiv 2026 |
| [Cross-Model LLM Code Review](https://arxiv.org/abs/2607.21656) | 2026-10-04 | A writer drafts code and a reviewer from the same or the other vendor revises it, on 116 LiveCodeBench problems. | workshop paper, Agentic SE at KDD 2026 |
| [Greptile model inversion](https://greptile.com/blog/model-inversion) | 2026-10-04 | A vendor post that routes a pull request's review to a different model than the one that wrote it. | vendor report |
| [AACR-Bench](https://arxiv.org/html/2601.19494) | 2026-10-04 | A set of 1,505 verified review comments, counted by how many models find each. | arXiv 2026 |
| [SLEAN](https://arxiv.org/abs/2510.10010) | 2026-10-04 | Several providers' models analyse bugs independently, critique each other, and an arbiter accepts or rejects fix proposals. | arXiv 2025, abstract only |
| [DVDR-LLM](https://arxiv.org/html/2512.12536v1) | 2026-10-04 | Several open-weight models vote on whether Linux-kernel code is vulnerable. | arXiv 2025 |
| [Argus](https://www.redesignhealth.com/content/agentic-code-review-harness) | 2026-10-04 | A company paper on an internal review harness that fans out many reviewer agents on each pull request. | arXiv 2026 |

What the group shows. Reviewing a change with several agents is common. Several of the commercial
tools do it with separate agents for separate classes of issue, then a verifier or judge that
filters. Cross-vendor review is offered as plugins and skills, and the most starred of them, the
Codex plugin for Claude Code, offers no figure on whether the second review finds more. The two
repositories the ticket named take different positions with no measurement: `adverse` runs three
personas on one model and says two different models work but cost more, and
`alecnielsen/adversarial-review` says different models catch different problems. Where a vendor
gives a figure it uses its own metric, and none counts defects that one agent missed and another
found. Anthropic reports that 54% of pull requests now get substantive comments, up from 16%, with
no definition of substantive and no comparison of one agent with several
[@articles/anthropic-claude-code-review-blog/passages.md]. Strength: shown by the tools' own pages; evidence of
benefit is in [the evidence section](#is-mixing-models-shown-to-work), where it is one report or
small studies.

### 4. Spec-first workflows with a person's sign-off

Workflows and tools in which an agent drafts a spec, a plan or a design, a person reviews it, and
code follows. Chosen from search results, the GitHub topic page for spec-driven development, the
vendors' own pages and the leads the ticket named. The open-source tools were counted by stars
and, where it lists them, by a census of spec files [@papers/agarwal-2026-specmine/passages.md]. [The AI-native SDLC playbook](../sources/ai-native-sdlc-playbook.md) is
already in this wiki and is not repeated. Devin's interactive-planning page, Windsurf's planning
docs and Claude Code's permission-modes page could not be read.

| Entry | Read | What it does | Venue or use |
| --- | --- | --- | --- |
| [Superpowers](https://github.com/obra/superpowers/tree/8ca22dba9a94f28898bbce59f2537ff4d87c747d) | 2026-10-04 | Skills for many coding-agent CLIs that make the agent design with the person, get a written spec and then a written plan approved, and run a fresh subagent per task with a review after each. | 295,092 stars |
| [Spec Kit](https://github.com/github/spec-kit) | 2026-10-04 | Agent skills that take each feature through specify, plan, tasks and implement, writing `spec.md`, `plan.md` and `tasks.md` into the repository. | 140,068 stars; 54,640 spec files in 10,619 repositories [@papers/agarwal-2026-specmine/passages.md] |
| [OpenSpec](https://github.com/Fission-AI/OpenSpec/tree/2500d6da971336167548b53731a35b2127df35ac) | 2026-10-04 | For each change the assistant writes a proposal, delta specs, a design and tasks, the person reviews, and the change is archived after it is applied. | 71,021 stars; 274,955 spec files in 8,926 repositories [@papers/agarwal-2026-specmine/passages.md] |
| [GSD](https://github.com/gsd-build/get-shit-done/tree/bdcaab2c752d9a33a1a1ca9acf3a3c81fb991815) | 2026-10-04 | A meta-prompting system with a discuss, plan, execute and verify loop in which plans run in parallel waves. | 64,385 stars, archived; successor [GSD Core](https://github.com/open-gsd/gsd-core/tree/943dc11ac3227e6a8fc51ec90f6e688ce703efe9) 10,152 |
| [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD/tree/3cae711ea5274cf7c7cf6e173bb8d7f29cd71497) | 2026-10-04 | Planning skills that write a brief, requirements, architecture and tickets, and build skills that show a plan and ask the person to approve it. | 53,766 stars |
| [Kiro](https://kiro.dev/docs/specs/) | 2026-10-04 | AWS's spec-first IDE and CLI, with requirements, design and tasks and, in its standard flow, a person's approval of each phase. | closed; no user figure on its pages |
| [Cline Plan and Act](https://docs.cline.bot/features/plan-and-act) | 2026-10-04 | Plan mode reads and discusses but cannot change files, and the person switches to Act mode to execute. | Cline 69,821 stars |
| [Conductor, a Gemini CLI extension](https://github.com/gemini-cli-extensions/conductor/tree/6e8f9a860bcdd6a2c423473c12e745200688c633) | 2026-10-04 | Writes a spec and a plan for each track, and after the person approves the plan an implement command works through it. | 3,753 stars |
| [cc-sdd](https://github.com/gotalab/cc-sdd/tree/e2a0c671aef37a482404905b409ab5c27092b25b) | 2026-10-04 | Skills from discovery to tasks, then an implementation skill that gives each task a fresh implementer, an independent reviewer and a debugger. | 3,701 stars |
| [Claude Code plan mode](https://code.claude.com/docs/en/best-practices) | 2026-10-04 | Lets Claude read and propose without editing, and the person edits the plan and then approves it or leaves the mode. | closed |
| [Cursor Plan Mode](https://cursor.com/docs/agent/plan-mode) | 2026-10-04 | The agent researches the codebase, asks questions and writes an editable markdown plan, and the person clicks to build it. | closed |
| [Copilot plan agent in VS Code](https://code.visualstudio.com/docs/copilot/agents/planning) | 2026-10-04 | Researches the project and writes a plan the person can send feedback on or approve, with approval disabled while feedback is pending. | closed |
| [Antigravity implementation plan](https://antigravity.google/docs/implementation-plan) | 2026-10-04 | An implementation-plan artifact the agent writes before changes, which the person reviews unless the review policy is set to always proceed. | closed |
| [Traycer](https://traycer.ai/) | 2026-10-04 | A planning and verification layer over other coding agents that gives each agent its own worktree. | vendor statistics: 550K tasks created |
| [Tessl spec-driven tile](https://tessl.io/registry/tessl-labs/spec-driven-development) | 2026-10-04 | A registry entry that tells an agent to interview the person, write specs, wait for approval, then implement and verify. | closed; the vendor's score has no stated method |
| [Devin planning](https://docs.devin.ai/work-with-devin/ask-devin.md) | 2026-10-04 | Plans and scopes projects and starts agent sessions from the conversation, and the page does not say who approves. | closed |
| [LoopTroop](https://github.com/looptroop-ai/LoopTroop) | 2026-10-04 | Several models draft the interview questions, the spec and the task breakdown, score and vote on each other's drafts, the person signs off, and then one implementer works in a worktree. | 156 stars; its README says early alpha |
| [Helix](https://github.com/helixml/helix/blob/0787c98ea75f70b7b95105be4c0e12d5188f831d/README.md) | 2026-10-04 | An orchestrator over several command-line agents in which a person approves a spec and then a pull request. | 815 stars |
| [Autopus-ADK](https://github.com/autopus-ai/autopus-adk) | 2026-10-04 | A spec-driven harness for several agent CLIs with a mode in which three vendors' models analyse independently and a blind judge scores them. | 111 stars |
| [SpecMine](https://arxiv.org/abs/2608.25202) | 2026-10-04 | A data set of 470,795 spec files in 73,030 public repositories attributed to 17 tools, July 2026. | arXiv 2026 |
| [Spec Kit Agents](https://arxiv.org/abs/2604.05278) | 2026-10-04 | Runs a spec workflow with agents in the roles and no person at the gate, on 32 feature tasks and SWE-bench Lite. | arXiv 2026 |
| [When Spec-Driven Development Pays Off](https://www.infoq.com/articles/when-spec-driven-development-pays-off/) | 2026-10-04 | A pilot with five reviewers and two banking services, reported in an article. | InfoQ, 2026-09-10; the paper was not found |
| [Grounding AI Agents in Contracts](https://arxiv.org/abs/2608.17177) | 2026-10-04 | Compares a test-generation agent that writes a spec first with one that does not, on 90 bug fixes. | workshop paper, SpecOps 2026 |
| [Review Beats Planning](https://arxiv.org/abs/2603.03406) | 2026-10-04 | Compares plan-then-code with review-then-fix on 542 function-level problems with two models. | arXiv 2026 |
| [Ask or Assume?](https://arxiv.org/abs/2603.26233) | 2026-10-04 | Rewrites 500 SWE-bench Verified issues to be underspecified and tests agents that ask a simulated user. | EMNLP 2026 per the page |
| [Marri](https://arxiv.org/abs/2602.02584) | 2026-10-04 | One developer builds one banking application twice, with and without security rules in the specification. | arXiv 2026 |
| [Vilas Boas et al.](https://arxiv.org/abs/2605.18461) | 2026-10-04 | One engineer with four agents under a spec-first workflow, compared with the same squad's history. | arXiv 2026 |
| [Alenezi](https://arxiv.org/abs/2607.16680) | 2026-10-04 | A review whose two headline figures come from two single case studies by others, Marri and Vilas Boas et al. | arXiv 2026 |
| [Human oversight of agentic systems in practice](https://arxiv.org/abs/2606.05391) | 2026-10-04 | Interviews with 17 developers on four forms of oversight, including co-planning. | arXiv 2026 |
| [From Prompt to Process](https://arxiv.org/abs/2606.04967) | 2026-10-04 | A taxonomy applied to six spec-driven frameworks from their documentation. | arXiv 2026 |
| [Understanding Spec-Driven-Development](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) | 2026-10-04 | One practitioner's trials of Kiro, Spec Kit and Tessl in September 2025. | article, 2025-10-15 |
| [Diaz et al.](https://arxiv.org/abs/2609.00252) | 2026-10-04 | A conceptual paper on specifications as contracts between people and agents. | arXiv 2026, abstract only |
| [Piskala](https://arxiv.org/abs/2602.00180) | 2026-10-04 | A practitioner guide with three levels of spec rigour. | arXiv 2026, abstract only |

What the group shows. Signing off a plan before code is mainstream: Superpowers has 295,092 stars
[@articles/obra-superpowers/passages.md] and Spec Kit 140,068 [@articles/github-spec-kit/passages.md]. Approval is enforced by the tool in the plan modes of
Claude Code, Cline and Kiro, in Copilot's plan agent and, by default, in Antigravity. In Superpowers
it is an instruction to the agent, and in Spec Kit, OpenSpec and the Gemini CLI Conductor the person
types the next command. Kiro's own Quick Spec switches approval off. No source tests a person's
sign-off against none. The best numbers test a spec step done by agents with no person at the gate:
judged quality was 3.46 with no spec step, 3.51 with it and 3.66 with grounding hooks
[@papers/taghavi-2026-spec-kit-agents/passages.md]. The one small controlled pilot found that five reviewers
given an approved spec on two services found the same amount of drift as reviewers given only the
code, 0.525 against 0.518 [@articles/infoq-garg-spec-driven-pays-off/passages.md]. A widely quoted 73% fall in security defects is 3 violations
against 11 in one project built twice by one developer [@papers/marri-2026-constitutional-sdd/passages.md]. No
entry has a person approve a spec that several independent implementers then build. The nearest
pieces are separate: Spec Kit states a principle of several implementations from one spec, Cursor
and Kilo Code run one prompt on several models, and LoopTroop has the sign-off and a multi-model
vote but one implementer. Strength: one report; no controlled test found.

### 5. Audit trails of agent runs

Tools, formats and drafts that record what a coding agent did, in a form that can be checked later,
tied to the commits it made, and counted rather than only read. Chosen from search results, the
vendors' own pages and the leads the ticket named. AgentLogs (Richards, 2026) is already captured in
this wiki [@papers/richards-2026-agentlogs/passages.md] and is not read again. The search budget ended before the last
negative control for this group could be run, and one search for attestation standards applied to
agents (in-toto, SLSA) found explainers and no standard.

| Entry | Read | What it does | Use |
| --- | --- | --- | --- |
| [Entire](https://github.com/entireio/cli/blob/f3f598a4731652e04ac64e5b8514b043cc04ffbb/README.md) | 2026-10-04 | Hooks into git and into each agent's lifecycle hooks, saves every agent session as a checkpoint in the repository's own git refs, and links each checkpoint to its commit with a trailer. | 5,152 stars |
| [Agent Trace](https://agent-trace.dev/) | 2026-10-04 | A draft vendor-neutral JSON record that says, for one revision, which line ranges of which files a human, an AI, both or unknown wrote, with an optional model identifier. | draft 0.1.0 [@articles/cursor-agent-trace/passages.md]; Thoughtworks rates it Assess [@articles/thoughtworks-agent-trace/passages.md] |
| [git-ai](https://github.com/git-ai-project/git-ai/blob/0670e7ef27590af0e8ff5409267f3f4b09b8fcb4/README.md) | 2026-10-04 | A git extension that records, as git notes on each commit, which lines were written by which agent session, tool and model. | 2,813 stars |
| [SpecStory](https://github.com/specstoryai/getspecstory/blob/2722e74896036c3269dbbd3b25b3c1456dc5a691/README.md) | 2026-10-04 | Saves each coding-agent conversation as a markdown file in the repository. | 1,344 stars; the vendor says 229,989 installs |
| [Claude Code hooks, telemetry and transcripts](https://code.claude.com/docs/en/hooks) | 2026-10-04 | The agent offers lifecycle hooks that run user scripts, opt-in OpenTelemetry export and local transcripts; see also [its monitoring page](https://code.claude.com/docs/en/monitoring-usage). | closed agent; local transcripts are kept 30 days by default |
| [Codex rollouts and Rollout Trace](https://github.com/openai/codex/blob/afb436df8b70bb5bc57b86d9a3e829968988cd21/codex-rs/rollout-trace/README.md) | 2026-10-04 | Writes each session as a JSONL rollout file, can emit OpenTelemetry events, and has an opt-in trace that replays raw events into a graph that includes child agents. | closed agent |
| [OpenTelemetry GenAI conventions](https://github.com/open-telemetry/semantic-conventions-genai/blob/e07f4ebacb08f56db8c4c882d117720333fbca04/docs/gen-ai/gen-ai-agent-spans.md) | 2026-10-04 | Defines span names and attributes for agent runs, including invoking an agent or a workflow and executing a tool. | 404 stars; status Development |
| [Langfuse](https://langfuse.com/resources/engineering/coding-agent-tracing) | 2026-10-04 | An open-source platform for tracing LLM applications, with a page on tracing nine coding agents. | 35,358 stars for the platform |
| [LangSmith](https://docs.langchain.com/langsmith/trace-claude-code) | 2026-10-04 | A hosted tracing product with a plugin that sends Claude Code conversations to it. | closed |
| [AgentOps](https://github.com/AgentOps-AI/agentops/blob/f8e907b92dabe47232978023fdcb01e2a7d4b752/README.md) | 2026-10-04 | A Python SDK and dashboard that records the runs of agents built with frameworks. | 5,880 stars |
| [Agent Audit Trail](https://www.ietf.org/archive/id/draft-sharif-agent-audit-trail-06.txt) | 2026-10-04 | An Internet-Draft that specifies a JSON record of one agent action, chained by a hash of the previous record, with an optional signature. | one author's individual draft, revision 06 |
| [PunkGo](https://arxiv.org/abs/2602.20214) | 2026-10-04 | A Rust kernel that writes every agent action into a Merkle-tree log, with capability checks and human approval. | arXiv 2026; 4 stars |
| [AgentSight](https://arxiv.org/abs/2508.02736) | 2026-10-04 | Watches coding agents from outside by intercepting their encrypted model traffic and kernel events. | arXiv 2025; 721 stars |
| [Aider](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/website/docs/git.md) | 2026-10-04 | A terminal coding agent that commits every edit and marks its commits in standard git fields. | 49,369 stars; no push since 2026-05-22 |
| [Linux kernel guidance](https://docs.kernel.org/process/coding-assistants.html) | 2026-10-04 | Asks contributors to mark AI-assisted commits with an `Assisted-by` trailer and says the human submitter signs off and is responsible. | policy text |
| [Copilot cloud agent sessions](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/track-copilot-sessions) | 2026-10-04 | GitHub's cloud agent keeps a session log and links it from the commits it makes. | closed |
| [Tapes](https://github.com/papercomputeco/tapes/blob/35ded6d9365f099430747adc118fa0ffd55dff30/README.md) | 2026-10-04 | A proxy between a coding agent and the model service that stores each request in an append-only log. | 327 stars |
| [Agents Observe](https://github.com/simple10/agents-observe/blob/b3a7238b3913976c10da052f75c73e29ad084c61/README.md) | 2026-10-04 | A plugin that stores Claude Code and Codex hook events in SQLite and shows them in a dashboard with the subagent tree. | 688 stars |
| [ccusage](https://github.com/ccusage/ccusage/blob/b4a72f6d54974381289dc3660eeebf066bbc6535/apps/ccusage/README.md) | 2026-10-04 | Reads the local usage logs of coding agents and reports tokens and cost by day and session. | 18,863 stars |
| [agentops by boshu2](https://github.com/boshu2/agentops/blob/2a9c825244a39ac40042a43b48ff36fb56b0fc78/README.md) | 2026-10-04 | A skills toolkit in which a fresh agent session judges each change PASS, FAIL or NOT_PROVEN. | 447 stars |

What the group shows. Almost all of it records, and little of it audits. Entire's experimental
review command runs several reviewer agents and a judge that merges their reports and stores the
sessions, and its design document says nothing about labelling each finding with the reviewer who
raised it [@articles/entireio-cli-architecture/passages.md]. git-ai and Entire count what each session, tool or model
contributed to surviving code, which is a count of contribution and not an account of who found
what. Commits are tied to records in three ways: a trailer or name mark (Entire, Aider, the Linux
kernel, Copilot), a git note (git-ai), and a record that names a revision (Agent Trace). Tamper
evidence is rare and always qualified. Only the IETF draft and PunkGo are built for it, and both say
what stays unprotected. Langfuse's own page says to treat hook-based tracing as telemetry, not
enforcement [@articles/langfuse-coding-agent-tracing/passages.md]. An agent's own logs can be counted, since Claude
Code lists named events and Codex has twelve rollout item types, but they are opt-in or short-lived.
Entire's known-limitations file advises separate git worktrees for concurrent sessions, the
isolation postmaster uses. No entry reports whether mixing models works. Strength: shown by the
tools' own pages; none was found that audits a multi-agent flow as postmaster's audits do.

### 6. Tests of the orchestration itself

Benchmarks, studies and test suites that evaluate a multi-agent flow or an agent harness, the
scaffold around a model, and not a model. Also the public argument over whether several agents help
coding at all. Chosen from search results, the vendors' own posts and the leads the ticket named.
The search budget ran out partway through this group, so the last queries did not run. One query
looked for a project that publishes a standing test of its own orchestration, such as fixture
repositories, hidden tests or regression runs of the flow, and nothing of that kind turned up.

| Entry | Read | What it does | Venue or use |
| --- | --- | --- | --- |
| [Terminal-Bench](https://arxiv.org/abs/2601.11868) | 2026-10-04 | A benchmark of command-line tasks run through the Harbor framework, where each leaderboard entry is an agent harness paired with a model; see also [the 2.1 release post](https://www.tbench.ai/news/terminal-bench-2-1). | arXiv 2026; three new versions in 2026 |
| [SWE-bench](https://arxiv.org/abs/2310.06770v3) | 2026-10-04 | 2,294 real GitHub issues from 12 Python repositories, each scored by the repository's tests. | the standard issue-resolution benchmark |
| [Dissecting the SWE-Bench Leaderboards](https://arxiv.org/abs/2506.17208v3) | 2026-10-04 | A descriptive census of the Lite and Verified leaderboards. | ICSE-SEIP 2026 |
| [mini-swe-agent](https://raw.githubusercontent.com/SWE-agent/mini-swe-agent/main/README.md) | 2026-10-04 | A minimal bash-only agent that its authors use as one fixed harness. | open source |
| [Holistic Agent Leaderboard](https://arxiv.org/abs/2510.11977v1) | 2026-10-04 | A standardised harness and a study of 21,730 rollouts over nine models, scaffolds and benchmarks. | ICLR 2026 per its proceedings page; the harness repository is archived |
| [DeepSWE](https://arxiv.org/abs/2607.07946) | 2026-10-04 | A benchmark of 113 original tasks graded by hand-written verifiers; [a vendor post](https://deepswe.datacurve.ai/blog/deepswe) compares three models under a minimal harness and under their own vendor tools on ten tasks. | arXiv 2026 |
| [Quantifying infrastructure noise](https://www.anthropic.com/engineering/infrastructure-noise) | 2026-10-04 | Varies only the resource limits of the evaluation environment on Terminal-Bench 2.0, keeping model, harness and tasks fixed. | vendor report |
| [Towards a Science of Scaling Agent Systems](https://arxiv.org/abs/2512.08296v3) | 2026-10-04 | A controlled comparison of one agent and four multi-agent architectures on six benchmarks and three model families. | arXiv 2025 |
| [CooperBench](https://arxiv.org/abs/2601.13295v2) | 2026-10-04 | 652 two-agent coding tasks on 12 libraries, where two agents each get one feature and a solo baseline gets both. | arXiv 2026 |
| [CAID](https://arxiv.org/abs/2603.21489v2) | 2026-10-04 | A manager plans dependency-aware subtasks, engineer agents work in their own worktrees, and the manager merges with test-based checks. | arXiv 2026 |
| [AgentRoom](https://arxiv.org/abs/2608.23740v1) | 2026-10-04 | Two coding agents edit one shared file system through claim and status tools, compared with one agent and with two agents whose outputs are merged afterwards. | arXiv 2026, small |
| [Agent frameworks on code-centric tasks](https://arxiv.org/abs/2511.00872v1) | 2026-10-04 | Seven agent frameworks run with one model on software development, vulnerability detection and program repair. | arXiv 2025 |
| [E2EDevBench](https://arxiv.org/abs/2511.04064v1) | 2026-10-04 | Fifty PyPI projects scored by migrated tests and requirement checks, with single-agent and multi-agent variants on one framework. | arXiv 2025 |
| [BenchAgent](https://arxiv.org/abs/2606.05670v1) | 2026-10-04 | One framework that runs a single-agent anchor and six multi-agent workflows with one model on ten benchmarks. | arXiv 2026 |
| [Single-agent LLMs outperform multi-agent systems under equal thinking-token budgets](https://arxiv.org/abs/2604.02460v2) | 2026-10-04 | Compares one agent with five multi-agent designs at equal thinking tokens on multi-hop question answering. | arXiv 2026, general |
| [Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657v3) | 2026-10-04 | A taxonomy of 14 failure modes built from expert annotation of traces from seven multi-agent frameworks. | arXiv 2025 |
| [MultiAgentBench](https://arxiv.org/abs/2503.01935v1) | 2026-10-04 | A benchmark across six scenarios, coding among them, with milestone-based scores and coordination protocols. | ACL 2025 [@articles/aclanthology-multiagentbench-2025/passages.md] |
| [Anthropic's multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) | 2026-10-04 | A lead agent plans and subagents search in parallel, for a research product. | vendor report, 2025-06-13 |
| [Anthropic's harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps) | 2026-10-04 | A planner, a generator and an evaluator agent that build web apps over hours. | vendor report, 2026-03-24 |
| [Building a C compiler with parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler) | 2026-10-04 | Sixteen agents write a C compiler in Rust, coordinating by file locks in a shared repository, checked by test suites and a reference compiler. | vendor report, 2026-02-05 |
| [Cursor on scaling long-running autonomous coding](https://cursor.com/blog/scaling-agents) | 2026-10-04 | Hundreds of concurrent agents work on one project for about a week, with planners, workers and a judge agent. | vendor report, 2026-01-14 |
| [Don't Build Multi-Agents](https://cognition.com/blog/dont-build-multi-agents) | 2026-10-04 | Argues for sharing context and for a single-threaded linear agent. | vendor post, 2025 |
| [Multi-Agents: What's Actually Working](https://cognition.com/blog/multi-agents-working) | 2026-10-04 | Says multi-agent systems work best when writes stay single-threaded and extra agents add intelligence, and reports a review agent's findings. | vendor post, 2026-04-22 |
| [ai-jury](https://github.com/berkayturanci/ai-jury) | 2026-10-04 | A review tool that tests its own flow with a benchmark of five labelled diffs, golden-file tests, a coverage floor and live smoke tests of the real agents. | 8 stars |
| [AEVAL](https://arxiv.org/abs/2607.16345) | 2026-10-04 | A workshop paper on deterministic tests for agent skill workflows that keep the executor apart from the grader. | abstract only |

What the group shows. Testing the scaffold is a live field, and the benchmarks that do it are widely
used. On Terminal-Bench the same model scores very differently under different harnesses, and the
direction is not fixed. A second finding matters for any test of a flow: the benchmark's version and
the evaluation environment move scores as much as the harness does, so a test has to pin both
[@articles/tbench-terminal-bench-2-1/passages.md] [@articles/anthropic-infrastructure-noise/passages.md]. On coding, the controlled
comparisons that match iterations or budget mostly find several agents no better than one, and
sometimes worse, while reports that find gains rarely match cost. The public argument and the
measurements agree on parallel edits to shared state and differ where a separate reviewer is added.
No project was found that publishes a standing test of its own multi-agent flow. The nearest are
the one-off benchmark runs in a flow's own paper and ai-jury's small benchmark. Strength: controlled
studies for the single-versus-several comparisons, one report for the vendor accounts, argued for
the two Cognition posts; the standing test of a flow itself is not found.

## Is mixing models shown to work?

Four claims, each answered for code first and for general language-model work second. Each answer
says whether the evidence shows the claim, shows the opposite, or does not settle it, how strong the
evidence is, and what it leaves out. Under all four sits a question that older software work
asked first: do independently produced versions fail independently?

### Do independently produced versions fail independently?

**No, in every controlled study read, and the language-model studies agree with the old ones.**
Strength: controlled studies, human and model, all with limits.

*Human programmers, 1985 to 2001.* Knight and Leveson had 27 students at two universities write one
program from one specification and ran all versions on a million random inputs. Six versions never
failed and the rest passed more than 99% of tests. On 1,255 inputs more than one version failed. Their
test statistic was 100.51 against 2.33 at the 99% level, so independence was rejected, and about half
of the 45 faults involved two or more programs [@papers/knight-1986-independence/passages.md]. Among their
explanations is that some parts of any problem are harder than others. They warn that the result is
conditional on the application and "does not mean that N-version programming does not work". Eckhardt and Lee
had explained why: if inputs differ in how hard they are, versions fail together even when built
independently, and failures are independent only if difficulty is constant
[@papers/eckhardt-1985-coincident-errors/passages.md]. A second experiment, 20 versions from four universities on
about 921,000 cases, found coincident failures that "greatly exceed" what independence predicts, and
a three-version system failed only about four times less often than one version. Its authors note
that no single version was built at the same cost [@papers/eckhardt-1991-redundancy/passages.md]. A later review
puts both sides: all controlled experiments found multiple-version systems more reliable on average
than single versions, "and sometimes much more so", and independence has been "shown not to be
tenable" [@papers/littlewood-2001-diversity-review/passages.md]. Forced diversity can in theory give failures that are
better than independent, but whether that has practical use "remains moot"
[@papers/littlewood-2001-diversity-review/passages.md] [@papers/littlewood-1989-forced-diversity/passages.md].
Brilliant, Knight and Leveson found that minor differences in development environment would not
reduce correlated faults (abstract only) [@papers/brilliant-1990-faults/passages.md].

*Coding agents and language models, 2025 and 2026.* Ron and others repeated the design with coding
agents from five vendors, many models and three languages on Knight and Leveson's own specification.
Of 69 attempts, 48 passed the acceptance tests. On a million inputs, 429 inputs had more than one
failing version where independence predicts 115.36, about 3.7 times more. Their words are
"Nominal diversity in agent, model, or language does not automatically buy behavioral diversity." Voting
over three versions cut the mean failures from 387 to 131. But 27 of the 48 versions already had no
failures, so the vote is compared with the average version and not the best. It is one specification, one
run per configuration, and no same-model repeated baseline [@papers/ron-2026-nvp-coding-agents/passages.md].
Nogueira and others used 224 contest problems and twelve mostly small or older models. 65.9% of
pairs of solutions deviated from independence, and three- and five-version majority votes realised
0.43 and 0.44 of the gain independence would give. Ensembles that mixed models realised 0.44 and
same-model ensembles 0.27 and 0.24, but the same-model ensembles had the higher absolute reliability,
0.92 and 0.94 against 0.90 and 0.91, which the paper attributes to a filtering step (one read)
[@papers/nogueira-2026-failure-independence/passages.md]. On three problems, LLM-written programs failed together
less than human-written ones did, and in one pool a human-written and an LLM-written pair showed
negative failure correlation [@papers/almeida-2026-llm-diversity/passages.md].

*Across general tasks.* On the HELM leaderboard data, two models that are both wrong give the same
wrong answer 60% of the time, against a random baseline of a third, and larger, more accurate models
have more correlated errors [@papers/kim-2025-correlated-errors/passages.md]. Judges favour models
whose mistakes resemble their own (r = 0.84), and mistakes are becoming more alike as capability
rises [@papers/goel-2025-great-models/passages.md]. Nine judges from seven families were worth about two independent
votes, and same-family pairs were only slightly more correlated than cross-family pairs
[@papers/kohli-2026-nine-judges/passages.md]. One paper finds the opposite trend for code, that stronger models
separate more from other models [@papers/nogueira-2026-failure-independence/passages.md]. The measures and tasks
differ, so the two may not conflict, but they point opposite ways.

*On leaderboards.* Successes on SWE-bench Verified are nested. The top two systems each solve 396 of
500, their union is 414, and the union of the top ten is 449 [@papers/liu-2026-converged/passages.md]. A paper that
asks models to name the buggy file from the issue text alone gets 76% on SWE-bench and 53% on
repositories outside it, which points to memorisation (abstract only)
[@papers/liang-2025-swebenchillusion/passages.md]. Every SWE-bench number below carries that doubt.

**What it means for lanes.** Worktrees isolate lanes. They do not make them independent in the sense
that matters here. Different vendors help only partly, and agreement between lanes is weak evidence,
which is what the coachman's runbook already says. No study measured this for a flow in which an
agent writes the synthesis.

### Claim 1: several models together beat the best single model

**Code: not settled. Strength: one report.** Gains over the best member are reported, but they are
point estimates, none at matched cost, and the one controlled table from a team that shipped a
three-vendor ensemble goes the other way.

| Source | Pool | Result against the best member | Limits |
| --- | --- | --- | --- |
| [DEI](https://arxiv.org/abs/2408.07060) | four open SWE-bench Lite agents, a GPT-4o reviewer | 34.3% against 27.3% (+7.0); closed group 55.0% against 50.6% (+4.4) [@papers/zhang-2024-dei/passages.md] | the reviewer shares a model with some agents; no equal-cost test; one run |
| [CodeMonkeys](https://arxiv.org/abs/2501.14723) | four leaderboard systems and one more sample | selector 66.2% against 62.8% (+3.4); the pool's reach is 80.8% [@papers/ehrlich-2025-codemonkeys/passages.md] | single run |
| [PatchFusion](https://arxiv.org/abs/2607.01597) | six leaderboard systems on Verified | 426 against 396 bugs of 500 (+30) [@papers/yang-2026-patchfusion/passages.md] | public leaderboard outputs, which may be memorised |
| [LLM-as-a-Verifier](https://arxiv.org/abs/2607.05391) | Claude Opus 4.5, Gemini 3 Flash and MiniMax M2.5, one trajectory each | 78.2% against 76.8% (+1.4), oracle 84.4% [@papers/kwok-2026-llmverifier/passages.md] | cost not matched; no same-model pool |
| [EnsLLM](https://arxiv.org/abs/2503.15838) | 14 models, one program each | 90.2% against 83.5% on HumanEval (+6.7) [@papers/mahmud-2025-enslm/passages.md] | no repeated-sampling baseline; HumanEval is public |
| [PerfOrch](https://arxiv.org/abs/2510.01379) | five models routed by stage | +1.22 to +14.58 points over the best single-model pipeline [@papers/chen-2025-perforch/passages.md] | both pipelines debug against the full evaluation tests; only PerfOrch falls back to other models |
| [Aider, a sequential pair](https://aider.chat/2025/01/24/r1-sonnet.html) | R1 as architect, Sonnet as editor | 64.0% against 56.9% (R1) and 51.6% (Sonnet), at about Sonnet's cost [@articles/aider-r1-sonnet/passages.md] | two steps, not independent attempts; the project's own benchmark |
| [Trae Agent, Table 1](https://arxiv.org/abs/2507.23370) | three vendors, N = 3 candidates, three runs each | **65.67% against 66.40%** for Claude alone; the best-case ceiling is higher, 73.40% against 70.00% [@papers/gao-2025-trae-agent/passages.md] | the same team's blog reports 70.6% for a three-vendor ensemble against single models up to 62.6% [@articles/bytedance-trae-swebench-verified-blog/passages.md] |
| [AlphaCode](https://arxiv.org/abs/2203.07814) | 41B plus 9B models | slightly worse than the 41B model alone [@papers/li-2022-alphacode/passages.md] | two sizes of one architecture |
| [Leaderboard overlap](https://arxiv.org/abs/2609.17394) | top two systems on Verified | union 414 against 396 (+18) [@papers/liu-2026-converged/passages.md] | observational; one run per submission |

The ceilings are real. A pool of different systems solves far more than any one of them, and the
selector gets part of it: CodeMonkeys 57.4% against an oracle of 69.8% [@papers/ehrlich-2025-codemonkeys/passages.md], Agentless 96 of 126
reachable issues [@papers/xia-2024-agentless/passages.md], Trae 65.67% against 73.40% [@papers/gao-2025-trae-agent/passages.md]. The gain is bounded by where
the models fail together.

**General: mixed. Strength: controlled studies pointing both ways.** The Mixture-of-Agents paper
reported 65.1 on AlpacaEval 2.0 against 51.3 for its best member and 57.5 for GPT-4 Omni, judged by
a model [@papers/wang-2024-moa/passages.md]. A later study held the aggregator and the number of calls fixed and
found six samples of the best single model scoring 65.7 against 59.1 for six different models
[@papers/li-2025-selfmoa/passages.md]. A 2026 study finds that on tasks with a checkable answer "combining models
rarely beats the single best model without a strong query-level routing signal", and that naive voting
across models of unequal quality hurts [@papers/chen-2026-cofailure/passages.md]. Forecasts from twelve models had a
worse score than the best member, 0.20 against 0.15 on the Brier scale where lower is better
[@papers/schoenegger-2024-silicon-crowd/passages.md]. ReConcile reports gains of 5.3 to 8.0 points over the best single
model on sets of 100 questions [@papers/chen-2023-reconcile/passages.md]. Most of the favourable results were
reported by the authors of the method, and the papers that qualify them came from other authors.

**Not covered.** Realistic multi-file work, frontier models at equal cost, and any test where the
benchmark was certainly unseen.

### Claim 2: different models beat the same model run several times

**Code: not settled. Strength: one report; no direct test at equal cost.** The tests are indirect and
point both ways.

- In Trae Agent's Table 1 the three-vendor mixture beats the Gemini-only pool (65.67% against
  62.27%) and the GPT-4.1-only pool (59.00%) and loses to the Claude-only pool (66.40%)
  [@papers/gao-2025-trae-agent/passages.md].
- On 224 contest problems, ensembles that mix models come nearer to independence than same-model
  ensembles, 0.44 of the possible gain against 0.27 and 0.24, but same-model ensembles scored higher in
  absolute terms [@papers/nogueira-2026-failure-independence/passages.md].
- DEI's ten different agents together solve 54.3% of SWE-bench Lite issues, and ten runs of one agent
  34.7%. "Different agents resolve more distinct issues than different runs of a single agent." That is a
  best-case count. The committee's actual pick was 35.7% against 26.0% (one read), and the agents differ
  in scaffold as well as model [@papers/zhang-2024-dei/passages.md].
- One model sampled many times is strong where a checker exists. A cheaper model rose from 15.9% to 56%
  of SWE-bench Lite issues solved with 250 samples, counted as solved if any sample passes the
  repository's tests [@papers/brown-2024-largemonkeys/passages.md]. Drawing plans before code lifted pass@200 on
  LiveCodeBench for Claude 3.5 Sonnet from 55.6% to 77.0%, in one read of the table
  [@papers/wang-2024-plansearch/passages.md].
- In Aider's tables a same-model pair beat a cross-vendor pair for non-reasoning models, Sonnet with
  itself 80.5% against Sonnet with DeepSeek 78.9%. A cross-vendor pair did best when the architect was
  a reasoning model [@articles/aider-architect/passages.md].
- A choice across ten small open models by diversity realised up to 95% of the theoretical reach. The
  baseline there was one model's beam-search outputs, which are less varied than samples, so it is a
  weak test [@papers/vallecillosruiz-2025-ensembles/passages.md].

No code study was found that sets several vendors against one vendor repeated, at equal cost, with
an independent selector, on realistic software.

**General: not settled, and the two cleanest tests come out against mixing. Strength: controlled
studies, all preprints.** Li and others held the aggregator and the number of calls fixed. "Self-MoA
achieves 6.6% improvement over MoA on the AlpacaEval 2.0 benchmark, and an average of 3.8%
improvement across various benchmarks, including MMLU, CRUX, and MATH." Their regression finds that
the quality of the members matters more than their diversity, and mixing wins only narrowly, by 0.17
and 0.35 points, where members are close in quality [@papers/li-2025-selfmoa/passages.md]. The original paper had
suggested that "having a larger number of diverse LLM agents in each MoA layer can improve
performance". Its single-proposer baseline scored 56.7 against 61.3 for the mixture, and its role
table has WizardLM alone as proposer, with the same aggregator, at 63.8, above the mixture
[@papers/wang-2024-moa/passages.md]. The 6.6 above is against the later authors' reproduction of the mixture, 59.1. A 2026
paper finds that one model with perturbed inputs "outperforms heterogeneous model pools". Calls were
equalised, and the pool's make-up is in an appendix that could not be read. On its one code set,
LiveCodeBench-Hard with 171 problems, voting, mixture-of-agents and Self-MoA all scored 57.3% and the
paper's own method 62.6% [@papers/fadnavis-2026-trace-synthesis/passages.md]. At matched member quality a diverse
ensemble beat a same-model one by 0.027 on average, which its author calls "supported in one regime,
not established" [@papers/chen-2026-cofailure/passages.md]. In debate, mixing two models beat the average of the two
single-model runs by 6.4% (one read), not the better of the two
[@papers/zhang-2025-stop-overvaluing-mad/passages.md]. Gains from different models at a controlled budget are
reported for ReConcile, Fusion-of-N, Archon and the sample-allocation paper, mostly by their authors
[@papers/chen-2023-reconcile/passages.md] [@papers/khairi-2025-fusion-of-n/passages.md] [@papers/saad-falcon-2024-archon/passages.md]
[@papers/zhang-2024-osca/passages.md]. Groups of mixed models were no better than three copies of the strong model
[@papers/wynn-2025-talk-not-cheap/passages.md]. What seems to decide it is how close the members are in quality, and
how the single-model baseline was chosen. Quality and diversity are tangled in all of these.

### Claim 3: a model that reads several candidates and writes one beats picking the best

**Code: not shown. The one controlled comparison goes against a model writing the result. Strength:
one controlled comparison.** PatchFusion built a pool of candidate patches from six leaderboard
systems. A model asked to write the final patch from the pool solved 317 of 500 SWE-bench Verified
issues. The same model choosing among the same patches solved 396. The authors' reading is that
"Once correct patches already populate the pool, handing the decision to a strong generator is
therefore worse than a deterministic selector: generation adds format errors, hallucinated edits, and
the risk of overwriting an available fix." A rule that keeps the edits several candidates share, with
no model, added 5, 6 and 9 solved over choosing its own representative on Verified, Multilingual and
Defects4J [@papers/yang-2026-patchfusion/passages.md]. REFINE, the code-optimisation mixture of agents and VeriMoA
report gains from systems that write a result from several candidates, and none has a choose-one
baseline on the same candidates [@papers/pabba-2025-refine/passages.md] [@papers/ashiga-2025-moacodeopt/passages.md]
[@papers/ping-2025-verimoa/passages.md]. Choosing recovers only part of what a pool holds, which is the room that
writing would have to use: CodeMonkeys 57.4% against an oracle of 69.8% [@papers/ehrlich-2025-codemonkeys/passages.md],
and an outside verifier 78.2% against 84.4% [@papers/kwok-2026-llmverifier/passages.md]. Vendors report gains from
choosing. A critic took OpenHands from 60.6% to 66.4% with five attempts
[@articles/openhands-blog-inference-time-scaling/passages.md], and Augment found "a gain of 3-8%" from an ensembler and
called it too expensive for real-world use [@articles/augmentcode-blog-claude-o1/passages.md].

**General: shown for open-ended tasks, mixed elsewhere. Strength: controlled studies.** Fusing
beat picking in several papers. Fusion-of-N beat best-of-N with a reward model or a judge on open-ended
generation and translation [@papers/khairi-2025-fusion-of-n/passages.md]. LLM-Blender's fuser improved on its ranker
alone [@papers/jiang-2023-llmblender/passages.md]. A trained aggregator beat majority voting
[@papers/zhao-2025-agglm/passages.md]. An aggregator that reads whole reasoning traces beat voting by 1.8 to 6.1
points on four general sets, by its table [@papers/fadnavis-2026-trace-synthesis/passages.md]. It is mixed elsewhere. An untrained
aggregator fell below voting on AIME [@papers/zhao-2025-agglm/passages.md]. A model that only picks matched voting
[@papers/chen-2023-usc/passages.md]. Debate, which reads and revises, was no better than voting in comparisons by
other authors [@papers/smit-2024-mad/passages.md] [@papers/choi-2025-debate-or-vote/passages.md]. A selector has a provable ceiling,
the share of queries on which every model is wrong. A writer of a new answer has none, and two papers
show a fused answer scoring above the best candidate [@papers/chen-2026-cofailure/passages.md]. So this claim differs
in kind from claims 1 and 2 and should not be argued from voting results.

### Claim 4: independent reviewers find defects that a single reviewer misses

**Shown that several reviewers or runs find more than one, at a cost in false alarms. Not shown that
different vendors beat repeated runs of one model at equal cost. Strength: several small studies,
mostly preprints.**

| Source | Task | One reviewer or run | More than one | False alarms | Same or different |
| --- | --- | --- | --- | --- | --- |
| [Stone](https://zenodo.org/records/21328807), abstract only | 294 confirmed issues in 33 artifacts of one team | about 47% | about 72% with a second; 56.8% found by exactly one model | not in the abstract | 15 model versions, 8 providers; says it could not show repeated passes vary [@papers/stone-2026-single-llm-incomplete-reviewer/passages.md] |
| [SWR-Bench](https://arxiv.org/html/2509.01494) | 1,000 pull requests | recall 13.9% | recall 30.4% with ten runs merged | precision about 17% throughout (derived) | one model [@papers/zeng-2025-swr-bench/passages.md] |
| [MultiVer](https://arxiv.org/html/2602.17875v1) | 202 Python samples | recall 65.7% | 82.7% with four prompted agents | 85% false-positive rate | one model [@papers/rajan-2026-multiver/passages.md] |
| [Adversarial Review](https://arxiv.org/html/2608.18167) | 100 pull requests, F1 against human comments | 0.495 | 0.503 with two independent reviewers; 0.501 with three and a meta-reviewer | not reported | one model, workshop paper [@papers/qiu-2026-adversarial-review/passages.md] |
| [Kumar et al.](https://arxiv.org/html/2606.15689) | 150 samples | not stated | the text says a second model adds false positives without more true positives; its union table is inconsistent | stated in the text | five models [@papers/kumar-2026-bigger-isnt-better/passages.md] |
| [Cross-model review](https://arxiv.org/abs/2607.21656) | 116 LiveCodeBench problems | weaker writer 71.6%, stronger writer 91.4% | weaker writer 89.7% reviewed by the other vendor, 84.5% by itself; stronger writer 82.8% reviewed by the other vendor, 91.4% by itself | not applicable | two vendors [@papers/xiang-2026-cross-model-review/passages.md] |
| [AACR-Bench](https://arxiv.org/html/2601.19494) | 1,505 verified comments | not stated | of 1,145 found by at least one model (derived from its counts), 1,027 were found by exactly one | not in the table | different models [@papers/zhang-2026-aacr-bench/passages.md] |
| [ai-jury's own benchmark](https://github.com/berkayturanci/ai-jury/blob/main/docs/benchmark-results.md) | 5 diffs, 3 seeded bugs | best single reviewers 2 of 3, precision 1.00 | panel 3 of 3, precision 0.75 | "More reviewers found more bugs and raised more false alarms." | four vendors, run once by the author [@articles/berkayturanci-ai-jury-benchmark-results/passages.md] |
| [Magpie's builder](https://milvus.io/blog/ai-code-review-gets-better-when-models-debate-claude-vs-gemini-vs-codex-vs-qwen-vs-minimax.md) | 15 pull requests | best model 53% | 80% after five rounds of debate | not reported | five models, one snapshot [@articles/milvus-magpie-debate-benchmark/passages.md] |

Greptile reports that each of two models found more bugs in the other's code than in its own, on 500
pull requests each, with recall between 50.5% and 62.0% [@articles/greptile-model-inversion/passages.md]. Which of the
four recall figures belongs to which cell was returned differently by three reads, so none is given.

For people, nothing read gives defects found by one reviewer, by two and by the union. A large
industrial experiment assigned one, two or four reviewers at random and its abstract reports no
significant effect on defect effectiveness, while its author's own summary page says one-reviewer
inspections were less effective than two and that two teams on the same code "found few common
defects". The two could not be reconciled [@papers/porter-1997-code-inspections-cost-benefits/passages.md]
[@articles/aporter-inspection-structure/passages.md]. Two older studies, both abstract only, report that collection meetings produced no net
gain in detection, or were not as beneficial as people think
[@papers/porter-1995-requirements-inspection-replication/passages.md] [@papers/votta-1993-inspection-meeting/passages.md].
This wiki already holds the overlap method for estimating what reviewers leave
([@papers/petersson-2004-capture-recapture/passages.md]) and the finding that one careful review finds about half the
defects ([@papers/kemerer-paulk-2009-review-rate/passages.md]). The full texts of Fagan, Eick, Rigby and the later
Porter reports could not be read.

For judges, a panel of three smaller models from three families beat one large judge on question
answering at under a seventh of the cost [@papers/verga-2024-poll/passages.md]. In text, a model recognises and
favours its own output [@papers/panickssery-2024-self-preference/passages.md]. In short Python functions that
preference was small and followed length and style [@papers/barkhordar-2026-code-attribution/passages.md].

**Not covered.** Any test at equal cost of different vendors against repeated runs of one model.
Most defect keys here come from the models' own findings, so the union can flatter itself.

### The four answers together

| Claim | Code | General | Strength |
| --- | --- | --- | --- |
| 1. Several models beat the best single model | not settled: small gains in point estimates, one controlled table the other way | mixed, mostly against when members differ in quality | one report; controlled studies pointing both ways |
| 2. Different models beat the same model repeated | not settled: indirect tests only | not settled: the two cleanest tests are against mixing | controlled studies, preprints, conflicting |
| 3. Writing one from several beats picking | not shown: the one controlled comparison is against | shown for open-ended tasks, mixed elsewhere | one controlled comparison for code; controlled studies for general work |
| 4. Independent reviewers find what one misses | shown that more reviewers or runs find more, with more false alarms; not shown for different vendors against repeated runs | a panel of different families judged better than one large judge | several small studies |

## The closest tools, compared with postmaster

How the closest tools were found. A count of five elements was kept for every tool and write-up
read: (1) several vendors' models each attempt the same coding task independently, (2) the results
are combined into one, (3) several models review the result, (4) a person signs off a plan or spec
before code, and (5) the flow's own behaviour is audited and tested. An element scored 2 if it is a
core, described behaviour and 1 if it is partial or optional. 28 tools and six write-ups were scored
from their own pages, and the table of marks is in the search record
[@trials/2026-10-04-landscape-search/method.md]. The top of the count was Voratiq and LoopTroop at 7
of 10, then ai-jury, Autopus-ADK and Trae Agent at 6. Two projects at 6, Karpathy's LLM Council and
Together's Mixture-of-Agents, are not about code. PAL MCP, at 5, is the most used cross-model review
tool for code. Cursor and GitHub Agent HQ are added as the vendor products with the same-task and
sign-off features. Each is described from what it says and shows, with no guess at its internals,
and nothing was installed or run.

**What the flow does**

| | Independent implementations | How results are combined | Which models | Review | Person's sign-off on a spec |
| --- | --- | --- | --- | --- | --- |
| **postmaster** | Yes. Two or more workhorse lanes build the same ticket from one approved spec, each in its own worktree. Isolation is by worktree and instruction, and a sandbox enforces it only when confinement is on, which is off by default ([lane confinement](lane-confinement.md)) | One agent that is not a lane, a different model from every lane, composes the synthesis from the base commit part by part with a reason for each part. Agreement between lanes is treated as no evidence | Set by config for each role. In the audited runs, OpenAI and Xiaomi models as workhorses, an Anthropic model for security review, and a Meta model as coachman | Style, bug and security lenses, the first two by the workhorse lanes of two vendors and the security lens by a third vendor's model, in rounds capped at three before the user decides. The coachman verifies each finding | Yes. The user signs off the ticket and then the run's one spec before any code |
| [Voratiq](https://github.com/voratiq/voratiq) | Yes. Several implementations of one spec. Whether an agent sees another's work is not stated | Blinded verifier agents rank the outputs and one is applied. A `reduce` step writes one summary from several artifacts | Claude, Codex or Gemini command-line agents, each chosen per agent | Verifier agents, with tests, type checks, lint and build | None found in the pages read |
| [LoopTroop](https://github.com/looptroop-ai/LoopTroop) | Drafts of plans and specs are independent. The code is written by one implementer | A rubric vote picks a draft, and the winner refines it with ideas from the losers. This is for plans, not code | Two to ten configurable council models, with an implementer run through OpenCode | Council members score each other's drafts, then a final review and tests | Yes. The person signs off planning specs, blueprints and final pull requests, and the README says the gates will become optional |
| [Autopus-ADK](https://github.com/autopus-ai/autopus-adk) | Partly. Three vendors analyse independently, for ideas and plans | Strategies of consensus, debate with a judge, pipeline and fastest. One writer produces the spec after three advisers | Claude, Codex and Gemini in its multi mode | Independent review of plans and a multi-model code review | Not stated |
| [Trae Agent](https://arxiv.org/abs/2507.23370) | Yes. Candidates are generated in parallel. One setting takes them from three vendors' models | Regression tests prune, then a selector agent picks by repeated selection and majority vote | Gemini 2.5 Pro, Claude 3.7 Sonnet and GPT-4.1 in the paper. The leaderboard entry lists four models | A tester agent and a selector. No multi-model review | None |
| [ai-jury](https://github.com/berkayturanci/ai-jury) | No. It reviews code and writes none. Round 1 is parallel and independent | A chair's synthesis or a panel vote | Claude Code, Codex, Antigravity, hosted APIs and local models | It is the purpose of the tool | None |
| [Cursor](https://cursor.com/docs/configuration/worktrees) | Yes. `/best-of-n` runs one task on several models in isolated worktrees | An automatic judge recommends a run and a person picks. Nothing is merged | Several models of Cursor's own agent | A separate product, Bugbot, reviews pull requests [@articles/cursor-building-bugbot/passages.md] | Plan Mode has the person click to build a plan, and the pages do not tie it to `/best-of-n` [@articles/cursor-plan-mode/passages.md] |
| [GitHub Agent HQ](https://github.blog/news-insights/company-news/pick-your-agent-use-claude-and-codex-on-agent-hq/) | Several agents can be assigned one task. Whether they are kept apart is not stated | A person compares the draft pull requests | Copilot, Claude and Codex | Copilot gives a first-line review, and another agent can be used to hunt for edge cases | Yes in the VS Code flow. The person approves a plan before implementation [@articles/github-blog-welcome-home-agents/passages.md] |
| [PAL MCP](https://github.com/BeehiveInnovations/pal-mcp-server) | No. It consults other models in one conversation, and consensus is sequential | The host agent combines the perspectives | Gemini, OpenAI, Anthropic, Grok, Ollama, OpenRouter and others | Code review and pre-commit checks with several models | None |

**What stands behind it**

| | Audit trail | Test of the flow itself | Agents it works with | Evidence offered | How widely used |
| --- | --- | --- | --- | --- | --- |
| **postmaster** | One JSON line per action from a fixed set, per run and per project. Each lane's event stream and harness session are kept, and each run is pinned to the tool version it started on | Fixture runs on a small app with hidden tests, scored from the run's own records. A change to the coachman contract merges only after one scores clean | codex, claude, grok, agy, pi, muse and mimo through adapters | An audit of 18 real runs and fixture runs, in this wiki with standings that are mostly claimed. No head-to-head with another tool | Repository created 2026-09-21. 0 stars, 1 fork, no licence file, no releases [@articles/postmaster-repository/passages.md] |
| Voratiq | Per-agent diffs, logs and chat records under one folder | None described | Claude, Codex and Gemini command-line agents | One worked example. No measurement | 74 stars. Last push 2026-05-05 |
| LoopTroop | State in a database, JSON logs and ticket artifacts | None described | Through OpenCode. Anthropic, OpenAI and NVIDIA named | None on the council page | 156 stars. Its README says early alpha |
| Autopus-ADK | Telemetry and evaluation code, though its own assessment says synthetic results are not measured savings | Its assessment says it is "not a head-to-head performance trial" [@articles/autopus-ai-harness-assessment/passages.md] | Claude Code, Codex, Antigravity, OpenCode and Oh My Pi | The README says research shows debate beats any single model, with no source | 111 stars |
| Trae Agent | Recorded trajectories of agent actions | A published comparison with baselines on SWE-bench Verified, and no standing test | Its own agent, with several model providers | Table 1: the three-vendor mixture 65.67% against Claude alone 66.40%, and a headline of 75.20% whose configuration is not stated | 12,126 stars. Last push 2026-02-05 |
| ai-jury | Transcripts of reviews and debate | Golden-file tests, a 98% coverage floor, opt-in live smoke tests of the real agents, and a benchmark with answer keys | Claude Code, Codex, Antigravity, hosted APIs, local models | Its own benchmark, run once: 3 of 3 seeded bugs found by the panel against 2 of 3 by the best single reviewer, at precision 0.75 against 1.00 | 8 stars |
| Cursor | Not stated on the pages read | None found | Cursor's own agent | None for `/best-of-n`. The 2.0 post says several models on one problem "significantly improves the final output" [@articles/cursor-changelog-2-0/passages.md] | Closed. The vendor says Bugbot reviews more than two million pull requests a month |
| GitHub Agent HQ | Not stated | Not stated | Copilot, Claude and Codex, in public preview | None | Closed. GitHub says 180 million developers, about Copilot overall |
| PAL MCP | An activity log of tool calls | Unit tests and simulator tests that replicate Claude CLI interactions end to end | Claude Code, Gemini CLI, Codex CLI, Qwen Code CLI and Cursor as hosts | None found in its README | 11,767 stars. No push since 2025-12-15 |

**Reading the tables.** No tool has all five elements. The best two have 7 of 10. Voratiq has several
vendors implementing one spec, blinded verification and an applied result, with no sign-off in the
pages read. LoopTroop has the sign-off and a multi-model vote over drafts, but one implementer writes
the code. The most used items have the least evidence: the Codex plugin for Claude Code has 33,828
stars and no measurement [@articles/openai-codex-plugin-cc/passages.md], Karpathy's LLM Council has 25,141 stars and
its README says it will not be supported in any way [@articles/karpathy-llm-council/passages.md], and PAL MCP has 11,767
stars and has not been pushed to since 2025-12-15 [@articles/beehiveinnovations-pal-mcp-server/passages.md]. The projects that publish numbers are small,
ai-jury at 8 stars and Magpie at 175 [@articles/liliu-z-magpie/passages.md]. Strength: shown by the tools'
own pages, with a search that was limited by a shared budget.

## What postmaster shares, what it adds, and what it claims without support

### What it shares

Every part of the flow exists elsewhere. The flow is described in [the README](https://github.com/brindlewick/postmaster/blob/8ea503d/README.md)
and the runbooks at commit `8ea503d` [@articles/postmaster-repository/passages.md].

| Postmaster does | Others that do it | Strength |
| --- | --- | --- |
| Runs several coding agents on one repository, each in its own worktree | Cursor, Orca, Claude Squad, Superset, Conductor, Kilo Code and others in [group 1](#1-parallel-and-best-of-n-coding-agents) | shown by their pages |
| Gives one task to several models and keeps the attempts apart | Cursor `/best-of-n`, Windsurf Arena Mode, Kilo Code, Voratiq, Trae Agent's candidates | shown by their pages |
| Has an agent combine the candidates | Trae Agent's selector, Voratiq's verifiers and `reduce`, Augment's ensembler, PatchFusion, Mixture-of-Agents | shown by their pages and papers |
| Reviews a change with several models and lenses, and filters findings | Claude Code Review, Qodo, CodeRabbit, ai-jury, Magpie, the Codex plugin for Claude Code | shown by their pages |
| Has a person sign off a spec before code | Spec Kit, Kiro, OpenSpec, Claude Code plan mode, GitHub Agent HQ, LoopTroop | shown by their pages |
| Records what each agent did, per run | Entire, git-ai, Agent Trace, the agents' own logs | shown by their pages |
| Treats agreement between lanes as weak evidence | The work on correlated failures supports it, and Trae Agent and Agentless choose by majority vote, which treats agreement as evidence | controlled studies, see [above](#do-independently-produced-versions-fail-independently) |

### What it adds

Three things were not found elsewhere. How hard the search was is stated with each, and where it could
not look.

**1. The whole combination in one process.** A person signs off a spec. Several vendors' models implement
it in separate worktrees. One agent that is a different model from every lane composes a synthesis from the
base commit part by part, with a reason recorded for each part and a record of what came from which lane.
Several models review it under several lenses in a loop that is capped at three rounds, after which the
user decides. A ship card ends the run [@articles/postmaster-repository/passages.md]. Scored on five elements, the closest of 28
tools and six write-ups was 7 of 10 (Voratiq, LoopTroop), and none had all five. Voratiq has no sign-off
in the pages read, and LoopTroop has one implementer. The web search budget of 200 calls was spent
across all groups. The closest-tools group alone took 34 web searches, 16 GitHub searches and about
100 page and file reads. The search could not look inside closed products, and it did not search
Reddit, X, Discord or video.
OpenAI, Perplexity and the original Ars Technica article refused or blocked the fetch tool. A tool
that combines these may exist unseen. Strength: not found.

**2. A synthesis written by an agent that is not a lane.** No tool read does this for code. Voratiq's
`reduce` writes a summary from several artifacts. LoopTroop's winning draft refines itself with ideas from the
losing drafts, for plans. Trae Agent, Augment and OpenHands pick. This is also the part the evidence
warns about. The one controlled comparison found a model asked to write the final patch from a pool
solving 317 of 500 issues where the same model choosing solved 396 [@papers/yang-2026-patchfusion/passages.md]. The
coachman composes from the base commit, with reasons, and runs the gate and the reviews afterwards, which
is not that setup. But no run shipped one lane alone, so this wiki has no choose-one baseline either
([several lanes](several-lanes.md)). Strength: not found elsewhere, and untested here.

**3. A measured account of its own flow.** [The lane audit](several-lanes.md) reads the records of 31 real runs and 25
fixture runs, of which 18 and 24 reached synthesis, counts 264 verified serious findings by which lane
named each, scores each fixture lane on hidden tests, and gives a control for every count
[@trials/2026-10-03-lane-audit/method.md]. No other project read publishes an audit of its own flow.
The closest are one-off benchmark runs in a flow's own paper, such as CAID and AgentRoom, and
ai-jury's benchmark of five diffs. [Fixture runs](fixture-runs.md) go further: a small app whose
tickets have hidden tests, scored from the run's own records, and required before a change to the
coachman contract merges. Nothing like it was found. ai-jury and PAL MCP test their own code with
golden files and simulated sessions, and AEVAL, a workshop paper read in abstract only, proposes
deterministic tests for agent skill workflows. The search for this one was weak, since the search
budget ran out partway through. Strength: shown, for the audit, as one team's records. The
fixture runs' power to catch a broken contract is **claimed**, as [that page](fixture-runs.md) says.

### What it claims that the evidence does not support

The README's section "Why several models rather than one good one" and a few other lines, set beside
this wiki's audit. Line numbers are those of `README.md` at commit `8ea503d`.

| The README says | The evidence | Verdict |
| --- | --- | --- |
| "the synthesis took contributions from **both** lanes every time" (lines 36 to 38) | The runbook requires the record to name something taken from every lane, so the record cannot fail: all 25 syntheses in the first audit name both [@trials/2026-09-29-synthesis-audit/method.md]. Counted in git, the second lane's text was 2% or less of the synthesis in 8 of those 25, and in the five later real runs that have counts it wrote 0.5%, 25%, 14.6%, 0% and 4.8% of the code [@trials/2026-10-03-lane-audit/results/numbers.md] | Not supported as stated. True of the record by construction, not of the code |
| "not 'pick the winner', but one lane's mechanism plus the other's test, wiring or edge case" (line 37) | By the coachman's own cards the second lane's part was a fix or a missing part in 12 of 18 real runs, small items in 4 and nothing in 2. Each lane alone passed every hidden test in all 22 fixture runs that could be scored. No run had one workhorse | Supported in part, by the coachman's account. Not tested against a one-lane run |
| "a second lane finding the same defect independently is corroboration you can act on" (lines 38 and 39) | Only 59 of 264 verified serious findings were named by two or more lanes. Whether those held up better is not measured, since every logged finding was verified and the dismissed ones carry no lane. In the review of #36, 4 of 48 findings were made by both reviewers and all held up, and so did 42 of the other 44 [@runs/2026-09-26-postmaster-36/reports]. Outside work finds that models' errors are correlated, so agreement is weak evidence | Not supported. The audit shows a second reviewer adds coverage, which is a different claim |
| "Disagreement is also diagnostic ... the coachman records the gap as a proposed rule" (lines 41 to 43) | No measurement that a recorded rule stopped the same fork recurring ([combining models](combining-models.md), H3) | Not supported yet |
| lanes "unable to see each other's work" (lines 7 and 19) | Lanes have a worktree each. In a trial, every harness in bypass mode read another lane's worktree when asked, a worktree shares its repository's store, and the flow does not record whether any lane looked. A sandbox stops it, and confinement is off by default ([lane confinement](lane-confinement.md)) | Holds by instruction and layout, enforced only with confinement on |
| "Because they disagree usefully", as the reason for several models rather than one (line 36) | The audit's measured case is the reviewers: one lane alone would have missed 42% to 48% of the serious findings. A second implementer is "not shown to be needed" ([several lanes](several-lanes.md)) | The evidence supports the audit's reading, not the README's |
| a script "saves tokens" (lines 29 and 30) | Not measured. The coachman writes a median 58% of a run's output tokens and read 1,478M input tokens over the 18 real runs | Argued, not measured |
| resume cost "prompt caching mostly absorbs" (lines 239 and 240) | Not measured. The audit's token reader leaves out cache reads for Claude Code | Argued, not measured |
| "Nothing is reconstructed afterwards ... Audits ... work from the log" (lines 65 and 66) | The audit counted findings, launches and times from the action log. It read the second lane's part from the coachman's prose cards, by two readers, and counted six-word runs in git | Overstated. Part of the audit reads prose |
| "nothing in the flow depends on one provider's tools" (lines 47 to 49) | Adapters cover seven harnesses. Bug and security review use each harness's own review skill where there is one ([own review skills](own-review-skills.md)). A usage wall hit every codex lane at once and the run went on with the other vendor's lane, once | Supported in design, with one hedge observed |
| "Claims trace to evidence" (lines 67 and 68) and "start there marked as claims" (lines 89 and 90) | Each claim in the wiki has a standing and cites its records. Almost all standings are claimed | Supported, and honest about it |

**Which does the evidence support, the README or the audit?** The audit. Its reading is that reviewers
earn their keep and a second implementer has not been shown to be needed. The README says several
models help because the implementers disagree usefully. The record behind that is the coachman's, and
it cannot fail. The README states the claim from an unrecorded sample, as
[combining models](combining-models.md) says, and the audits that followed do not bear it out. The
experiment that would settle it is under way, a single-thread mode beside synthesis mode, alternating
over the next 16 tickets
([#270, A run can be single-thread: the coachman writes the change itself and no workhorse lane runs](https://github.com/brindlewick/postmaster/issues/270),
[#271, Run the next 16 tickets in alternating modes, and judge single-thread against synthesis by review rounds](https://github.com/brindlewick/postmaster/issues/271)).

## What can and cannot be said in public

Each line gives the strength of the evidence behind it. A statement about this project is the project's
to make, and this page only says what the records support.

**Can say**

| Statement | Strength | Basis |
| --- | --- | --- |
| Postmaster has several models implement one ticket independently in separate worktrees, builds one synthesis from their work, and reviews it with several models under several lenses. | shown | The README and runbooks at the commit named above, which anyone can read [@articles/postmaster-repository/passages.md] |
| In 18 real runs, two reviewer lanes together found 91% of the serious findings the coachman verified, and one lane alone found 52% or 58%. | one report | [The lane audit](several-lanes.md): one repository, 264 findings, the coachman's verification as the key, and no outside ground truth. Every count has a control [@trials/2026-10-03-lane-audit/results/controls.md] |
| More reviewers, or more runs of one model, find more defects than one does, at the cost of more false alarms. | several small studies | [Claim 4 above](#claim-4-independent-reviewers-find-defects-that-a-single-reviewer-misses). Not shown for different vendors against repeated runs at equal cost |
| Postmaster publishes an audit of its own flow, with the records and a control for each count, so a reader can count again. | shown | The trial folders under `raw/` hold the method and the derived tables [@trials/2026-10-03-lane-audit/method.md] |
| Independent lanes do not give independent failures, and the runbook treats agreement between lanes as no evidence. | controlled studies | [The independence section above](#do-independently-produced-versions-fail-independently) |
| Whether mixing models beats one model is not settled in the literature, and this project's own audit does not show a second implementer to be needed. | this page's reading | [The four answers](#the-four-answers-together) and [several lanes](several-lanes.md) |
| As far as was found on 2026-10-04, no tool read combines these elements, and the closest scored 7 of 10 on a count of five. | not found | A limited search. It describes the search and not the world |
| Fixture runs score a run against hidden tests that are kept out of the lanes' worktrees. | shown, as a description | [Fixture runs](fixture-runs.md). It is not a wall, and nothing records whether a lane looked. That the runs catch a broken contract is **claimed** |

**Must not say**

| Statement | Why not | Strength of the evidence against |
| --- | --- | --- |
| That postmaster is first, only or unique, or that nothing like it exists. | Every part exists elsewhere, and no search shows that something does not exist. Closed products and community channels were not searched | not found, and the parts are shown to exist |
| That mixing models gives better code than one model. | Not settled in the literature, and the project's own audit does not show it for implementers | controlled studies pointing both ways |
| That the synthesis takes the best of both lanes every time. | The record names both lanes because the runbook requires it. The second lane wrote 0% to 25% of the code in the five real runs with counts | shown, by the audit |
| That a defect two lanes find independently is more likely to be real. | Not measured. Only 59 of 264 serious findings were named by two or more lanes, and outside work finds correlated errors | unmeasured here, and controlled studies of correlated errors |
| That lanes cannot see each other's work, without saying it depends on confinement being on. | A trial found every harness in bypass mode could read another lane's worktree, and the flow does not record whether any did | one trial, claimed |
| That scripts save tokens, or that caching absorbs the cost of a resume. | Not measured. The coachman is the largest token cost the audit found | not measured |
| That it is open source. | The repository has no licence file at the commit named above, and the API reports none. Without a licence, others have no right to reuse the code. "Public repository" is accurate | shown, by the repository |
| That it works on macOS. | No trial on macOS is recorded in the wiki. The lane-confinement trial ran on one Linux machine | the absence of a record |
| That it beats another tool, with a number. | No head-to-head was run against any tool | not found |
| "Adversarial review" without saying what it means here. | The literature uses the term for a protocol in which a critic audits a reviewer's review [@papers/qiu-2026-adversarial-review/passages.md]. Postmaster's lenses review independently and the coachman verifies each finding | a wording matter |

The wiki's own standing for each combining-models claim is **claimed**, and a public statement can carry
that word.

## What was not read, and what was not found

Every claim above is tied to a capture or to a count with a control in the search record. This section
lists what could not be read. A source in this list is not used as evidence, and nothing is inferred from
its contents. The full lists, one per group, are in
[the search record](../../raw/trials/2026-10-04-landscape-search/method.md).

**Blocked, empty, paywalled or unreadable.**

- openai.com returned HTTP 403 on four address variants, so OpenAI's "Harness engineering" post and its own
  statement of what Codex review measured were not read. Perplexity's Model Council post returned 403 and
  a second address 404. The fetch tool refused arstechnica.com, so Ars Technica's Minesweeper test was
  read only through a secondary summary.
- The fetch tool could not read any PDF. Full texts are arXiv HTML pages, author manuscripts or a PDF-to-text
  conversion that may drop words. Fagan (1976), Eick and others (1992), the full texts of Rigby and others
  (2014) and Rigby and Bird (2013), the Porter and Votta reports, Cohen's book, and Knight and Leveson's 1990
  reply were not read. The 1990 reply sits on an author page that refused the connection.
- Abstract only: Avizienis (1985), Avizienis, Lyu and Schütz (1988), Littlewood and Miller (1989), Brilliant,
  Knight and Leveson (1990), Stone (2026), SLEAN, Diaz and others, Piskala, the SWE-bench illusion paper, and
  the Porter, Votta and Martin and Tsai inspection studies.
- Appendices cut off by the fetch tool: Appendix E of Beyond Consensus, which names the heterogeneous pools,
  and the multi-model results of AB-MCTS, which were read through the developer's post. The Terminal-Bench
  paper's results came back as a contents list only.
- Pages that needed scripts or returned errors: the Terminal-Bench leaderboards, PyPI pages, the Agent
  Trace repository (404), Devin's interactive-planning page, Windsurf's planning docs, and Claude Code's
  permission-modes and settings pages, which were too large to return.
- Not searched at all: Reddit, X, Discord, video, and the inside of closed products. Tools that call
  themselves swarms, harnesses or workspace managers may have been missed, since the first queries used
  the words worktrees and orchestrator.
- The web search budget of 200 calls was spent partway through, and every group's later queries ran by
  direct fetch of pages and listing queries. Items seen only in a search snippet or a list title are named in
  the search record as unverified and are not used.

**Not found, in the searches made.** Each is a statement about the search, with its queries in the record.

- A tool or write-up with all five elements of the count.
- A tool that audits and tests its own multi-model flow with scored runs.
- A coding result, among the tools, that compares writing one result from several candidates with choosing.
  One controlled comparison was found among the papers.
- A tool that has a person sign off a spec which several vendors' independent implementers then build, with a
  combined result.
- A write-up by a practitioner that merges several vendors' results on one coding task, with numbers.
- Evidence that mixing vendors beats running one model several times, for implementation, at equal cost.
- For people, a study that gives defects found by one reviewer, by two and by the union.
- A standard or tool that attests a coding agent's run, from in-toto, SLSA or similar.

**What the checks could not do.** A passage marked `not checked` was seen in one read only. The fetch tool
returned three different layouts of one figure on three reads of the same page, which left that figure
unresolved, and a wrong count on another page, which a second read caught. A check by two reads cannot show
that the page itself is right. Most headline numbers come from preprints and vendor posts.

## What would settle it

The answers above are open for two reasons. Outside work has not tested the claims at equal cost with
frontier models on realistic software, and this project's own audit has no run made the other way. These
tests would move them.

- **A single-thread mode beside synthesis mode, over alternating tickets.** This is already planned
  ([#270](https://github.com/brindlewick/postmaster/issues/270) and
  [#271](https://github.com/brindlewick/postmaster/issues/271)). It answers whether a second
  implementer is needed, judged by review rounds with the severe findings of round 1, time and tokens.
  Eight tickets in each mode can show a difference of two rounds, and about 29 are needed for one
  round [@trials/2026-10-03-lane-audit/method.md]. It does not test vendor diversity.
- **A same-model arm.** Two lanes on one model against two lanes on two vendors, on the same tickets,
  scored by blind tests, review rounds and each lane's share of the synthesis. This is the direct test of
  claim 2 inside the flow, and it is the open question "Does vendor diversity matter?" in
  [combining models](combining-models.md). If the same-model pair does as well, the vendor argument for
  several lanes falls and the hedge against a usage wall remains.
- **A choose-one baseline.** On tickets with blind tests, ship the better lane alone, and compare it with the
  synthesis on the same tests and on later findings. This tests claim 3 for the coachman, and it is the
  check the one controlled comparison of writing and choosing in code calls for
  [@papers/yang-2026-patchfusion/passages.md].
- **Failure overlap between lanes.** On a ticket hard enough that lanes sometimes fail the blind tests, count
  the inputs where both fail against what independence predicts, as Knight and Leveson did. The one fixture
  ticket passes every lane, so there are no failures to count. A hard fixture ticket is candidate 7 in
  [several lanes](several-lanes.md).
- **Reviewers.** Record each finding with its lane, lens, severity, verdict and how it was verified, and plant
  bugs ([#104, Research: test each leg on its own, starting with planted bugs for the review leg](https://github.com/brindlewick/postmaster/issues/104)).
  Then false alarms by lane, and recall against planted bugs, can be counted, which no outside study read
  gives at equal cost.
- **Blinkers.** Turn confinement on and record whether any lane reads another lane's worktree or commits.
  No run records that today.
- **An outside check.** Run another project's flow, or one strong agent at equal cost, on the same fixture
  tickets and score both on the hidden tests.

If single-thread runs need about as many review rounds as synthesis runs, the second implementer stops
earning its keep, and the README's section on why several models should say so. If they need clearly
more, it does.

## Sources

Every source cited above, with the day it was read. Each has a folder under `raw/papers/` or
`raw/articles/` holding its address and the passages relied on. The records this page rests on are
three trials under `raw/trials/`: [the lane audit](several-lanes.md)
[@trials/2026-10-03-lane-audit/method.md], the earlier synthesis audit
[@trials/2026-09-29-synthesis-audit/method.md], and the search record for this page
[@trials/2026-10-04-landscape-search/method.md].

| Source | Read | Capture |
| --- | --- | --- |
| [SpecMine: A Large-Scale Corpus of Spec-Driven Development Artifacts](https://arxiv.org/abs/2608.25202) | 2026-10-04 | [@papers/agarwal-2026-specmine] |
| [Specification-Driven Development as the Foundation of AI-Native Enterprise Software Engineering](https://arxiv.org/abs/2607.16680) | 2026-10-04 | [@papers/alenezi-2026-sdd-enterprise] |
| [Effectiveness of LLM-based Software Diversity for Reliability Improvement -- an Empirical Study](https://arxiv.org/html/2607.03174) | 2026-10-04 | [@papers/almeida-2026-llm-diversity] |
| [AEVAL: From Anecdotal to Deterministic Testing for Agentic Skill Workflows](https://arxiv.org/abs/2607.16345) | 2026-10-04 | [@papers/anand-2026-aeval] |
| [SWE-Search: Enhancing Software Agents with Monte Carlo Tree Search and Iterative Refinement](https://arxiv.org/abs/2410.20285) | 2026-10-04 | [@papers/antoniades-2024-swesearch] |
| [Industrial LLM-based Code Optimization under Regulation: A Mixture-of-Agents Approach](https://arxiv.org/abs/2508.03329) | 2026-10-04 | [@papers/ashiga-2025-moacodeopt] |
| [Style, Not Self: Surface Cues Explain Zero-Shot Code Attribution by Large Language Models](https://arxiv.org/html/2609.30048) | 2026-10-04 | [@papers/barkhordar-2026-code-attribution] |
| [Analysis of faults in an N-version software experiment](https://ntrs.nasa.gov/api/citations/19900041359) | 2026-10-04 | [@papers/brilliant-1990-faults] |
| [Large Language Monkeys: Scaling Inference Compute with Repeated Sampling](https://arxiv.org/abs/2407.21787) | 2026-10-04 | [@papers/brown-2024-largemonkeys] |
| [Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657v3) | 2026-10-04 | [@papers/cemri-2025-mast] |
| [CodeT: Code Generation with Generated Tests](https://arxiv.org/abs/2207.10397) | 2026-10-04 | [@papers/chen-2022-codet] |
| [ReConcile: Round-Table Conference Improves Reasoning via Consensus among Diverse LLMs](https://arxiv.org/html/2309.13007v3) | 2026-10-04 | [@papers/chen-2023-reconcile] |
| [Universal Self-Consistency for Large Language Model Generation](https://arxiv.org/html/2311.17311) | 2026-10-04 | [@papers/chen-2023-usc] |
| [Are More LLM Calls All You Need? Towards Scaling Laws of Compound Inference Systems](https://arxiv.org/html/2403.02419) | 2026-10-04 | [@papers/chen-2024-llmcalls] |
| [Multi-LLM Orchestration for High-Quality Code Generation: Exploiting Complementary Model Strengths](https://arxiv.org/abs/2510.01379) | 2026-10-04 | [@papers/chen-2025-perforch] |
| [When Does Combining Language Models Help? A Co-Failure Ceiling on Routing, Voting, and Mixture-of-Agents Across 67 Frontier Models](https://arxiv.org/html/2606.27288) | 2026-10-04 | [@papers/chen-2026-cofailure] |
| [AgentRoom: Concurrent Multi-Agent Coding in a CRDT-Backed Shared Workspace](https://arxiv.org/abs/2608.23740v1) | 2026-10-04 | [@papers/cho-2026-agentroom] |
| [Debate or Vote: Which Yields Better Decisions in Multi-Agent Large Language Models?](https://arxiv.org/html/2508.17536v2) | 2026-10-04 | [@papers/choi-2025-debate-or-vote] |
| [Argus: A Systems-Aware Agentic Code Review Harness (July 2026; a company technical paper)](https://www.redesignhealth.com/content/agentic-code-review-harness) | 2026-10-04 | [@papers/costanza-2026-argus] |
| [Human oversight of agentic systems in practice: Examining the oversight work, challenges, and heuristics of developers using software agents](https://arxiv.org/abs/2606.05391) | 2026-10-04 | [@papers/dhanorkar-2026-human-oversight] |
| [Spec-Driven Development for Agentic Software Engineering: Harnessing Human-Agent Teamwork](https://arxiv.org/abs/2609.00252) | 2026-10-04 | [@papers/diaz-2026-sdd-human-agent-teamwork] |
| [Improving Factuality and Reasoning in Language Models through Multiagent Debate](https://ar5iv.labs.arxiv.org/html/2305.14325) | 2026-10-04 | [@papers/du-2023-debate] |
| [A Theoretical Basis for the Analysis of Redundant Software Subject to Coincident Errors](https://ntrs.nasa.gov/api/citations/19850015006/downloads/19850015006.pdf) | 2026-10-04 | [@papers/eckhardt-1985-coincident-errors] |
| [An Experimental Evaluation of Software Redundancy As a Strategy for Improving Reliability](https://ntrs.nasa.gov/api/citations/19900014642/downloads/19900014642.pdf) | 2026-10-04 | [@papers/eckhardt-1991-redundancy] |
| [Ask or Assume? Uncertainty-Aware Clarification-Seeking in Coding Agents](https://arxiv.org/abs/2603.26233) | 2026-10-04 | [@papers/edwards-2026-ask-or-assume] |
| [CodeMonkeys: Scaling Test-Time Compute for Software Engineering](https://arxiv.org/abs/2501.14723) | 2026-10-04 | [@papers/ehrlich-2025-codemonkeys] |
| [Beyond Consensus: Trace-Level Synthesis in Mixture of Agents](https://arxiv.org/html/2605.29116v1) | 2026-10-04 | [@papers/fadnavis-2026-trace-synthesis] |
| [Do More Agents Help? Controlled and Protocol-Aligned Evaluation of LLM Agent Workflows](https://arxiv.org/abs/2606.05670v1) | 2026-10-04 | [@papers/fu-2026-benchagent] |
| [Trae Agent: An LLM-based Agent for Software Engineering with Test-time Scaling](https://arxiv.org/abs/2507.23370) | 2026-10-04 | [@papers/gao-2025-trae-agent] |
| [Effective Strategies for Asynchronous Software Engineering Agents](https://arxiv.org/abs/2603.21489v2) | 2026-10-04 | [@papers/geng-2026-caid] |
| [Great Models Think Alike and this Undermines AI Oversight](https://arxiv.org/html/2502.04313v2) | 2026-10-04 | [@papers/goel-2025-great-models] |
| [AgentCoder: Multi-Agent-based Code Generation with Iterative Testing and Optimisation](https://arxiv.org/abs/2312.13010) | 2026-10-04 | [@papers/huang-2023-agentcoder] |
| [DeepSWE: Measuring Frontier Coding Agents on Original, Long-Horizon Engineering Tasks](https://arxiv.org/abs/2607.07946) | 2026-10-04 | [@papers/huang-2026-deepswe] |
| [Wider or Deeper? Scaling LLM Inference-Time Compute with Adaptive Branching Tree Search](https://arxiv.org/html/2503.04412v5) | 2026-10-04 | [@papers/inoue-2025-abmcts] |
| [MapCoder: Multi-Agent Code Generation for Competitive Problem Solving](https://arxiv.org/abs/2405.11403) | 2026-10-04 | [@papers/islam-2024-mapcoder] |
| [R2E-Gym: Procedural Environments and Hybrid Verifiers for Scaling Open-Weights SWE Agents](https://arxiv.org/abs/2504.07164) | 2026-10-04 | [@papers/jain-2025-r2egym] |
| [LLM-Blender: Ensembling Large Language Models with Pairwise Ranking and Generative Fusion](https://ar5iv.labs.arxiv.org/html/2306.02561) | 2026-10-04 | [@papers/jiang-2023-llmblender] |
| [SWE-bench: Can Language Models Resolve Real-World GitHub Issues?](https://arxiv.org/abs/2310.06770v3) | 2026-10-04 | [@papers/jimenez-2023-swe-bench] |
| [Holistic Agent Leaderboard: The Missing Infrastructure for AI Agent Evaluation](https://arxiv.org/abs/2510.11977v1) | 2026-10-04 | [@papers/kapoor-2025-hal] |
| [The Impact of Design and Code Reviews on Software Quality: An Empirical Study Based on PSP Data](https://sites.pitt.edu/~ckemerer/PSP_Data.pdf) | 2026-09-26 | [@papers/kemerer-paulk-2009-review-rate] |
| [Making, not Taking, the Best of N](https://arxiv.org/html/2510.00931v1) | 2026-10-04 | [@papers/khairi-2025-fusion-of-n] |
| [CooperBench: Why Coding Agents Cannot be Your Teammates Yet](https://arxiv.org/abs/2601.13295v2) | 2026-10-04 | [@papers/khatua-2026-cooperbench] |
| [Correlated Errors in Large Language Models](https://arxiv.org/html/2506.07962) | 2026-10-04 | [@papers/kim-2025-correlated-errors] |
| [Towards a Science of Scaling Agent Systems](https://arxiv.org/abs/2512.08296v3) | 2026-10-04 | [@papers/kim-2025-scaling-agents] |
| [An Experimental Evaluation of the Assumption of Independence in Multi-Version Programming](https://dspace.mit.edu/server/api/core/bitstreams/1331578f-65c1-4665-a0be-1bc3cdc001d5/content) | 2026-10-04 | [@papers/knight-1986-independence] |
| [Nine Judges, Two Effective Votes: Correlated Errors Undermine LLM Evaluation Panels](https://arxiv.org/html/2605.29800) | 2026-10-04 | [@papers/kohli-2026-nine-judges] |
| [Bigger Isn't Always Better: A Comparative Evaluation of LLMs for Automated Code Review](https://arxiv.org/html/2606.15689) | 2026-10-04 | [@papers/kumar-2026-bigger-isnt-better] |
| [LLM-as-a-Verifier: A General-Purpose Verification Framework](https://arxiv.org/abs/2607.05391) | 2026-10-04 | [@papers/kwok-2026-llmverifier] |
| [ShinkaEvolve: Towards Open-Ended And Sample-Efficient Program Evolution](https://arxiv.org/abs/2509.19349) | 2026-10-04 | [@papers/lange-2025-shinkaevolve] |
| [Competition-Level Code Generation with AlphaCode](https://arxiv.org/abs/2203.07814) | 2026-10-04 | [@papers/li-2022-alphacode] |
| [More Agents Is All You Need](https://arxiv.org/abs/2402.05120) | 2026-10-04 | [@papers/li-2024-moreagents] |
| [Rethinking Mixture-of-Agents: Is Mixing Different Large Language Models Beneficial?](https://arxiv.org/html/2502.00674) | 2026-10-04 | [@papers/li-2025-selfmoa] |
| [The SWE-Bench Illusion: When State-of-the-Art LLMs Remember Instead of Reason](https://arxiv.org/abs/2506.12286) | 2026-10-04 | [@papers/liang-2025-swebenchillusion] |
| [Conceptual modeling of coincident failures in multiversion software](https://ntrs.nasa.gov/api/citations/19900036555) | 2026-10-04 | [@papers/littlewood-1989-forced-diversity] |
| [Modeling software design diversity: a review](https://openaccess.city.ac.uk/id/eprint/1951/1/Modelling%20software%20design%20diversity.pdf) | 2026-10-04 | [@papers/littlewood-2001-diversity-review] |
| [Coding Agents Have Converged: Why the SWE-bench Leaderboard Can No Longer Order Its Top Entries, and What to Measure Instead](https://arxiv.org/abs/2609.17394) | 2026-10-04 | [@papers/liu-2026-converged] |
| [From Prompt to Process: a Process Taxonomy and Comparative Assessment of Frameworks Supporting AI Software Development Agents](https://arxiv.org/abs/2606.04967) | 2026-10-04 | [@papers/macedo-2026-prompt-to-process] |
| [Enhancing LLM Code Generation with Ensembles: A Similarity-Based Selection Approach](https://arxiv.org/abs/2503.15838) | 2026-10-04 | [@papers/mahmud-2025-enslm] |
| [Constitutional Spec-Driven Development: Enforcing Security by Construction in AI-Assisted Code Generation](https://arxiv.org/abs/2602.02584) | 2026-10-04 | [@papers/marri-2026-constitutional-sdd] |
| [Dissecting the SWE-Bench Leaderboards: Profiling Submitters and Architectures of LLM- and Agent-Based Repair Systems](https://arxiv.org/abs/2506.17208v3) | 2026-10-04 | [@papers/martinez-2025-swebench-leaderboards] |
| [Terminal-Bench: Benchmarking Agents on Hard, Realistic Tasks in Command Line Interfaces](https://arxiv.org/abs/2601.11868) | 2026-10-04 | [@papers/merrill-2026-terminal-bench] |
| [Review Beats Planning: Dual-Model Interaction Patterns for Code Synthesis](https://arxiv.org/abs/2603.03406) | 2026-10-04 | [@papers/miller-2026-review-beats-planning] |
| [A Systematic Methodology for Evaluating Failure Independence in LLM-Generated Code](https://arxiv.org/abs/2607.02808) | 2026-10-04 | [@papers/nogueira-2026-failure-independence] |
| [AlphaEvolve: A coding agent for scientific and algorithmic discovery](https://arxiv.org/abs/2506.13131) | 2026-10-04 | [@papers/novikov-2025-alphaevolve] |
| [REFINE: Enhancing Program Repair Agents through Context-Aware Patch Refinement](https://arxiv.org/abs/2510.03588) | 2026-10-04 | [@papers/pabba-2025-refine] |
| [LLM Evaluators Recognize and Favor Their Own Generations](https://arxiv.org/html/2404.13076) | 2026-10-04 | [@papers/panickssery-2024-self-preference] |
| [Capture-recapture in Software Inspections after 10 Years Research – Theory, Evaluation and Application](https://wohlin.eu/jss04-1.pdf) | 2026-09-26 | [@papers/petersson-2004-capture-recapture] |
| [VeriMoA: A Mixture-of-Agents Framework for Spec-to-HDL Generation](https://arxiv.org/abs/2510.27617) | 2026-10-04 | [@papers/ping-2025-verimoa] |
| [Spec-Driven Development: From Code to Contract in the Age of AI Coding Assistants](https://arxiv.org/abs/2602.00180) | 2026-10-04 | [@papers/piskala-2026-code-to-contract] |
| [Comparing detection methods for software requirements inspections: a replicated experiment](https://api.openalex.org/works/doi:10.1109/32.391380) | 2026-10-04 | [@papers/porter-1995-requirements-inspection-replication] |
| [An experiment to assess the cost-benefits of code inspections in large scale software development](https://api.openalex.org/works/doi:10.1109/32.601071) | 2026-10-04 | [@papers/porter-1997-code-inspections-cost-benefits] |
| [Adversarial Review: Structured Disagreement for Grounded Agentic Code Review](https://arxiv.org/html/2608.18167) | 2026-10-04 | [@papers/qiu-2026-adversarial-review] |
| [MultiVer: Zero-Shot Multi-Agent Vulnerability Detection](https://arxiv.org/html/2602.17875v1) | 2026-10-04 | [@papers/rajan-2026-multiver] |
| [AgentLogs: A Dataset for Opening the Black Box of GitHub's Cloud Agent](https://arxiv.org/abs/2608.29204) | 2026-10-01 | [@papers/richards-2026-agentlogs] |
| [N-Version Programming with Coding Agents](https://arxiv.org/abs/2606.20158) | 2026-10-04 | [@papers/ron-2026-nvp-coding-agents] |
| [Archon: An Architecture Search Framework for Inference-Time Techniques](https://arxiv.org/html/2409.15254v6) | 2026-10-04 | [@papers/saad-falcon-2024-archon] |
| [Wisdom of the Silicon Crowd: LLM Ensemble Prediction Capabilities Rival Human Crowd Accuracy](https://arxiv.org/html/2402.19379v6) | 2026-10-04 | [@papers/schoenegger-2024-silicon-crowd] |
| [Natural Language to Code Translation with Execution](https://arxiv.org/abs/2204.11454) | 2026-10-04 | [@papers/shi-2022-mbrexec] |
| [Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs](https://arxiv.org/html/2311.17371v3) | 2026-10-04 | [@papers/smit-2024-mad] |
| [A Single LLM Is an Incomplete Code Reviewer: Evidence that Independent Review by Multiple LLM Families Recovers Code Defects Any One Model Misses](https://zenodo.org/records/21328807) | 2026-10-04 | [@papers/stone-2026-single-llm-incomplete-reviewer] |
| [Agentic Systems as Boosting Weak Reasoning Models](https://arxiv.org/abs/2605.14163) | 2026-10-04 | [@papers/sunkaraneni-2026-boosting] |
| [Spec Kit Agents: Context-Grounded Agentic Workflows](https://arxiv.org/abs/2604.05278) | 2026-10-04 | [@papers/taghavi-2026-spec-kit-agents] |
| [Single-Agent LLMs Outperform Multi-Agent Systems on Multi-Hop Reasoning Under Equal Thinking Token Budgets](https://arxiv.org/abs/2604.02460v2) | 2026-10-04 | [@papers/tran-2026-single-agent-budget] |
| [Grounding AI Agents in Contracts: An Empirical Evaluation of Spec-Driven Test Generation](https://arxiv.org/abs/2608.17177) | 2026-10-04 | [@papers/tufano-2026-spec-driven-test-generation] |
| [Wisdom and Delusion of LLM Ensembles for Code Generation and Repair](https://arxiv.org/abs/2510.21513) | 2026-10-04 | [@papers/vallecillosruiz-2025-ensembles] |
| [SLEAN: Simple Lightweight Ensemble Analysis Network for Multi-Provider LLM Coordination: Design, Implementation, and Vibe Coding Bug Investigation Case Study](https://arxiv.org/abs/2510.10010) | 2026-10-04 | [@papers/vargas-2025-slean] |
| [Replacing Judges with Juries: Evaluating LLM Generations with a Panel of Diverse Models](https://arxiv.org/html/2404.18796) | 2026-10-04 | [@papers/verga-2024-poll] |
| [One Developer Is All You Need: A Case Study of an AI-Augmented One-Person Squad in a Brownfield Enterprise](https://arxiv.org/abs/2605.18461) | 2026-10-04 | [@papers/vilasboas-2026-one-person-squad] |
| [Does every inspection need a meeting?](https://api.openalex.org/works/doi:10.1145/167049.167070) | 2026-10-04 | [@papers/votta-1993-inspection-meeting] |
| [Self-Consistency Improves Chain of Thought Reasoning in Language Models](https://ar5iv.labs.arxiv.org/html/2203.11171) | 2026-10-04 | [@papers/wang-2022-selfconsistency] |
| [Mixture-of-Agents Enhances Large Language Model Capabilities](https://arxiv.org/html/2406.04692v1) | 2026-10-04 | [@papers/wang-2024-moa] |
| [Planning In Natural Language Improves LLM Search For Code Generation](https://arxiv.org/abs/2409.03733) | 2026-10-04 | [@papers/wang-2024-plansearch] |
| [Inference Scaling Laws: An Empirical Analysis of Compute-Optimal Inference for Problem-Solving with Language Models](https://arxiv.org/html/2408.00724v3) | 2026-10-04 | [@papers/wu-2024-inference-scaling] |
| [Talk Isn't Always Cheap: Understanding Failure Modes in Multi-Agent Debate](https://arxiv.org/html/2509.05396v1) | 2026-10-04 | [@papers/wynn-2025-talk-not-cheap] |
| [Agentless: Demystifying LLM-based Software Engineering Agents](https://arxiv.org/abs/2407.01489v2) | 2026-10-04 | [@papers/xia-2024-agentless] |
| [Cross-Model LLM Code Review: Should you use Claude to review Codex or vice versa?](https://arxiv.org/abs/2607.21656) | 2026-10-04 | [@papers/xiang-2026-cross-model-review] |
| [A Single Patch Is Not Enough: Deterministic Fusion of Repair Candidates](https://arxiv.org/abs/2607.01597) | 2026-10-04 | [@papers/yang-2026-patchfusion] |
| [A Comprehensive Empirical Evaluation of Agent Frameworks on Code-centric Software Engineering Tasks](https://arxiv.org/abs/2511.00872v1) | 2026-10-04 | [@papers/yin-2025-agent-frameworks] |
| [Benchmarking and Studying the LLM-based Agent System in End-to-End Software Development](https://arxiv.org/abs/2511.04064v1) | 2026-10-04 | [@papers/zeng-2025-e2edevbench] |
| [SWR-Bench: Assessing LLM Performance in Real-World Code Review Comment Generation](https://arxiv.org/html/2509.01494) | 2026-10-04 | [@papers/zeng-2025-swr-bench] |
| [Coder Reviewer Reranking for Code Generation](https://arxiv.org/abs/2211.16490) | 2026-10-04 | [@papers/zhang-2022-coderreviewer] |
| [Diversity Empowers Intelligence: Integrating Expertise of Software Engineering Agents](https://arxiv.org/abs/2408.07060) | 2026-10-04 | [@papers/zhang-2024-dei] |
| [Scaling LLM Inference with Optimized Sample Compute Allocation](https://arxiv.org/html/2410.22480) | 2026-10-04 | [@papers/zhang-2024-osca] |
| [Stop Overvaluing Multi-Agent Debate -- We Must Rethink Evaluation and Embrace Model Heterogeneity](https://arxiv.org/html/2502.08788v3) | 2026-10-04 | [@papers/zhang-2025-stop-overvaluing-mad] |
| [AACR-Bench: Evaluating Automatic Code Review with Holistic Repository-Level Context](https://arxiv.org/html/2601.19494) | 2026-10-04 | [@papers/zhang-2026-aacr-bench] |
| [Right to History: A Sovereignty Kernel for Verifiable AI Agent Execution](https://arxiv.org/abs/2602.20214) | 2026-10-04 | [@papers/zhang-2026-right-to-history] |
| [The Majority is not always right: RL training for solution aggregation](https://arxiv.org/html/2509.06870) | 2026-10-04 | [@papers/zhao-2025-agglm] |
| [AgentSight: System-Level Observability for AI Agents Using eBPF](https://arxiv.org/abs/2508.02736) | 2026-10-04 | [@papers/zheng-2025-agentsight] |
| [MultiAgentBench: Evaluating the Collaboration and Competition of LLM agents](https://arxiv.org/abs/2503.01935v1) | 2026-10-04 | [@papers/zhu-2025-multiagentbench] |
| [Diverse LLMs vs. Vulnerabilities: Who Detects and Fixes Them Better?](https://arxiv.org/html/2512.12536v1) | 2026-10-04 | [@papers/zibaeirad-2025-dvdr-llm] |
| [MultiAgentBench: Evaluating the Collaboration and Competition of LLM agents (ACL Anthology page)](https://aclanthology.org/2025.acl-long.421/) | 2026-10-04 | [@articles/aclanthology-multiagentbench-2025] |
| [adverse (README)](https://raw.githubusercontent.com/addyosmani/adverse/main/README.md) | 2026-10-04 | [@articles/addyosmani-adverse] |
| [unknown (the fetch tool returned no title; the url slug is code-agent-orchestra; post dated 2026-03-26)](https://addyosmani.com/blog/code-agent-orchestra/) | 2026-10-04 | [@articles/addyosmani-code-agent-orchestra] |
| [AgentOps (repository README)](https://github.com/AgentOps-AI/agentops/blob/f8e907b92dabe47232978023fdcb01e2a7d4b752/README.md) | 2026-10-04 | [@articles/agentops-ai-agentops] |
| [Git integration (Aider documentation)](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/website/docs/git.md) | 2026-10-04 | [@articles/aider-ai-aider] |
| [Aider blog post of 2024-09-26 on Architect/Editor mode (the fetch tool did not return the post's title)](https://aider.chat/2024/09/26/architect.html) | 2026-10-04 | [@articles/aider-architect] |
| [Aider blog post of 2025-01-24 on R1 as architect with Sonnet as editor (the fetch tool did not return the post's title)](https://aider.chat/2025/01/24/r1-sonnet.html) | 2026-10-04 | [@articles/aider-r1-sonnet] |
| [Adversarial Review (README)](https://raw.githubusercontent.com/alecnielsen/adversarial-review/main/README.md) | 2026-10-04 | [@articles/alecnielsen-adversarial-review] |
| [Building a C compiler with a team of parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler) | 2026-10-04 | [@articles/anthropic-building-c-compiler] |
| [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams) | 2026-10-04 | [@articles/anthropic-claude-code-agent-teams] |
| [Hooks reference (Claude Code documentation)](https://code.claude.com/docs/en/hooks) | 2026-10-04 | [@articles/anthropic-claude-code-hooks] |
| [Monitoring (Claude Code documentation page on OpenTelemetry export)](https://code.claude.com/docs/en/monitoring-usage) | 2026-10-04 | [@articles/anthropic-claude-code-monitoring] |
| [Claude Code documentation: Best practices; Common workflows (Plan before editing); Ultraplan is no longer available](https://code.claude.com/docs/en/best-practices) | 2026-10-04 | [@articles/anthropic-claude-code-plan-mode-docs] |
| [not returned by the fetch (vendor blog post announcing its Code Review feature; the fetch gave the post date as March 9, 2026)](https://claude.com/blog/code-review) | 2026-10-04 | [@articles/anthropic-claude-code-review-blog] |
| [Code Review (Claude Code documentation)](https://code.claude.com/docs/en/code-review) | 2026-10-04 | [@articles/anthropic-claude-code-review-docs] |
| [Introducing Claude Sonnet 4.5 (the fetch tool did not return the title; the address names the model)](https://www.anthropic.com/news/claude-sonnet-4-5) | 2026-10-04 | [@articles/anthropic-claude-sonnet-4-5-post] |
| [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps) | 2026-10-04 | [@articles/anthropic-harness-design] |
| [Quantifying infrastructure noise in agentic coding evals](https://www.anthropic.com/engineering/infrastructure-noise) | 2026-10-04 | [@articles/anthropic-infrastructure-noise] |
| [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) | 2026-10-04 | [@articles/anthropic-multi-agent-research-system] |
| [Code Review Plugin (README)](https://raw.githubusercontent.com/anthropics/claude-code/main/plugins/code-review/README.md) | 2026-10-04 | [@articles/anthropics-claude-code-code-review-plugin] |
| [Deliberation (README)](https://github.com/antonbabenko/deliberation) | 2026-10-04 | [@articles/antonbabenko-deliberation] |
| [Structure (the page title as the fetch reported it; a research web page on software inspections)](https://www.cs.umd.edu/~aporter/html/structure.html) | 2026-10-04 | [@articles/aporter-inspection-structure] |
| [augment-swebench-agent (README)](https://github.com/augmentcode/augment-swebench-agent) | 2026-10-04 | [@articles/augmentcode-augment-swebench-agent] |
| [#1 open-source agent on SWE-Bench Verified by combining Claude 3.7 and O1 (title as shown in a search listing)](https://www.augmentcode.com/blog/1-open-source-agent-on-swe-bench-verified-by-combining-claude-3-7-and-o1) | 2026-10-04 | [@articles/augmentcode-blog-claude-o1] |
| [unknown (the fetch tool returned no title; the url slug is open-source-agent-orchestrators)](https://www.augmentcode.com/tools/open-source-agent-orchestrators) | 2026-10-04 | [@articles/augmentcode-open-source-agent-orchestrators] |
| [Autopus-ADK (README)](https://github.com/autopus-ai/autopus-adk) | 2026-10-04 | [@articles/autopus-ai-autopus-adk] |
| [Autopus-ADK: harness value and comparison](https://github.com/autopus-ai/autopus-adk/blob/main/docs/harness-assessment.md) | 2026-10-04 | [@articles/autopus-ai-harness-assessment] |
| [PAL MCP: Many Workflows. One Context. (README)](https://github.com/BeehiveInnovations/pal-mcp-server) | 2026-10-04 | [@articles/beehiveinnovations-pal-mcp-server] |
| [ai-jury (README)](https://github.com/berkayturanci/ai-jury) | 2026-10-04 | [@articles/berkayturanci-ai-jury] |
| [Benchmark: does the panel actually help? — v1.1.0 · 2026-06-05](https://github.com/berkayturanci/ai-jury/blob/main/docs/benchmark-results.md) | 2026-10-04 | [@articles/berkayturanci-ai-jury-benchmark-results] |
| [Vibe Kanban (README)](https://github.com/BloopAI/vibe-kanban/blob/d5cbb5380fa0b32e98ef9b8d987f63decce4be3a/README.md) | 2026-10-04 | [@articles/bloopai-vibe-kanban] |
| [BMAD-METHOD (BMad Method): Agile AI Driven Development (README and docs)](https://github.com/bmad-code-org/BMAD-METHOD/tree/3cae711ea5274cf7c7cf6e173bb8d7f29cd71497) | 2026-10-04 | [@articles/bmad-code-org-bmad-method] |
| [AgentOps (repository README; a different project from AgentOps-AI/agentops)](https://github.com/boshu2/agentops/blob/2a9c825244a39ac40042a43b48ff36fb56b0fc78/README.md) | 2026-10-04 | [@articles/boshu2-agentops] |
| [Trae Agent (README)](https://github.com/bytedance/trae-agent) | 2026-10-04 | [@articles/bytedance-trae-agent] |
| [Blog post of 2025-05-19 on Trae's 70.6% SWE-bench Verified result (the page title was not returned by the fetch tool; the address ends in "71")](https://se-research.bytedance.com/blogs/trae-on-swe-bench-verified-71) | 2026-10-04 | [@articles/bytedance-trae-swebench-verified-blog] |
| [ccusage (README of the ccusage app)](https://github.com/ccusage/ccusage/blob/b4a72f6d54974381289dc3660eeebf066bbc6535/apps/ccusage/README.md) | 2026-10-04 | [@articles/ccusage-ccusage] |
| [Plan and Act modes (Cline documentation)](https://docs.cline.bot/features/plan-and-act) | 2026-10-04 | [@articles/cline-plan-and-act] |
| [The System Behind Every Review Comment](https://docs.coderabbit.ai/overview/architecture) | 2026-10-04 | [@articles/coderabbit-docs-architecture] |
| [Ask Devin (Devin documentation)](https://docs.devin.ai/work-with-devin/ask-devin.md) | 2026-10-04 | [@articles/cognition-devin-ask-devin] |
| [Advanced Capabilities, section Managed Devins (Devin documentation)](https://docs.devin.ai/work-with-devin/advanced-capabilities.md) | 2026-10-04 | [@articles/cognition-devin-managed-devins] |
| [Don't Build Multi-Agents](https://cognition.com/blog/dont-build-multi-agents) | 2026-10-04 | [@articles/cognition-dont-build-multi-agents] |
| [Multi-Agents: What's Actually Working (the title as given in the fetch output)](https://cognition.com/blog/multi-agents-working) | 2026-10-04 | [@articles/cognition-multi-agents-working] |
| [Conductor (home page and documentation index)](https://www.conductor.build) | 2026-10-04 | [@articles/conductor-home] |
| [Agent Trace](https://agent-trace.dev/) | 2026-10-04 | [@articles/cursor-agent-trace] |
| [Building a better Bugbot (title as listed in a search result; the fetch returned no title line; the fetch gave the post date as January 15, 2026)](https://cursor.com/blog/building-bugbot) | 2026-10-04 | [@articles/cursor-building-bugbot] |
| [New Coding Model and Agent Interface (Cursor changelog 2.0, page dated 2025-10-29)](https://cursor.com/changelog/2-0) | 2026-10-04 | [@articles/cursor-changelog-2-0] |
| [Cursor changelog 2.2 (page dated 2025-12-10; headings: Debug Mode; Browser layout and style editor; Plan Mode improvements; Multi-agent judging; Pinned chats; Improvements)](https://cursor.com/changelog/2-2) | 2026-10-04 | [@articles/cursor-changelog-2-2] |
| [Worktrees (Cursor documentation)](https://cursor.com/docs/configuration/worktrees) | 2026-10-04 | [@articles/cursor-docs-worktrees] |
| [Best-of-N does not actually use the specified models (title taken from the URL; Cursor community forum)](https://forum.cursor.com/t/best-of-n-does-not-actually-use-the-specified-models/156908) | 2026-10-04 | [@articles/cursor-forum-best-of-n-models-bug] |
| [Cursor: Plan Mode (docs page), Introducing Plan Mode (blog), Cursor 2.0 and Composer (blog)](https://cursor.com/docs/agent/plan-mode) | 2026-10-04 | [@articles/cursor-plan-mode] |
| [Scaling long-running autonomous coding (the title as given in the fetch tool's heading; the address ends in scaling-agents)](https://cursor.com/blog/scaling-agents) | 2026-10-04 | [@articles/cursor-scaling-agents] |
| [container-use (README)](https://github.com/dagger/container-use/blob/2e43e625e95216b719ec9338f4034fd3a0be2734/README.md) | 2026-10-04 | [@articles/dagger-container-use] |
| [DeepSWE (blog post; the page title was not returned)](https://deepswe.datacurve.ai/blog/deepswe) | 2026-10-04 | [@articles/datacurve-deepswe-blog] |
| [Entire CLI (repository README)](https://github.com/entireio/cli/blob/f3f598a4731652e04ac64e5b8514b043cc04ffbb/README.md) | 2026-10-04 | [@articles/entireio-cli] |
| [Entire CLI, architecture and known-limitations documents](https://github.com/entireio/cli/tree/f3f598a4731652e04ac64e5b8514b043cc04ffbb/docs) | 2026-10-04 | [@articles/entireio-cli-architecture] |
| [unknown (the fetch tool returned no title; the url slug is codex-multi-agent-orchestration)](https://www.firecrawl.dev/blog/codex-multi-agent-orchestration) | 2026-10-04 | [@articles/firecrawl-codex-multi-agent-orchestration] |
| [OpenSpec: Spec-driven development (SDD) for AI coding assistants (README and docs)](https://github.com/Fission-AI/OpenSpec/tree/2500d6da971336167548b53731a35b2127df35ac) | 2026-10-04 | [@articles/fission-ai-openspec] |
| [Gas Town (README)](https://github.com/gastownhall/gastown/blob/649b832b7672bc7a2dbef26f5983aba6198b819b/README.md) | 2026-10-04 | [@articles/gastownhall-gastown] |
| [Conductor Plugin (spec-driven development for AI coding agents)](https://github.com/gemini-cli-extensions/conductor/tree/6e8f9a860bcdd6a2c423473c12e745200688c633) | 2026-10-04 | [@articles/gemini-cli-extensions-conductor] |
| [Emdash (README, and release notes of the release tagged v0)](https://github.com/generalaction/emdash/blob/a39d9c8339ebf2d96c287fa78bf28b7b5e41d2ba/README.md) | 2026-10-04 | [@articles/generalaction-emdash] |
| [git-ai (repository README)](https://github.com/git-ai-project/git-ai/blob/0670e7ef27590af0e8ff5409267f3f4b09b8fcb4/README.md) | 2026-10-04 | [@articles/git-ai-project-git-ai] |
| [Pick your agent: Use Claude and Codex on Agent HQ (blog post dated 2026-02-04)](https://github.blog/news-insights/company-news/pick-your-agent-use-claude-and-codex-on-agent-hq/) | 2026-10-04 | [@articles/github-blog-pick-your-agent] |
| [Welcome home, agents (title taken from the URL; the fetch tool did not return a title)](https://github.blog/news-insights/company-news/welcome-home-agents/) | 2026-10-04 | [@articles/github-blog-welcome-home-agents] |
| [60 million Copilot code reviews and counting (title as given in the URL; the fetch gave the post date as March 5, 2026)](https://github.blog/ai-and-ml/github-copilot/60-million-copilot-code-reviews-and-counting/) | 2026-10-04 | [@articles/github-copilot-60-million-reviews] |
| [Managing agent sessions (GitHub Docs; the title as one fetch returned it; the other fetch headed its answer "Tracking and Auditing Copilot Agent Activities")](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/track-copilot-sessions) | 2026-10-04 | [@articles/github-docs-copilot-agent-sessions] |
| [Spec Kit (README)](https://github.com/github/spec-kit) | 2026-10-04 | [@articles/github-spec-kit] |
| [Implementation plan (Antigravity documentation)](https://antigravity.google/docs/implementation-plan) | 2026-10-04 | [@articles/google-antigravity-implementation-plan] |
| [cc-sdd: Turn approved specs into long-running autonomous implementation](https://github.com/gotalab/cc-sdd/tree/e2a0c671aef37a482404905b409ab5c27092b25b) | 2026-10-04 | [@articles/gotalab-cc-sdd] |
| [The effectiveness and limitations of AI code review](https://graphite.com/guides/effectiveness-and-limitations-of-ai-code-review) | 2026-10-04 | [@articles/graphite-effectiveness-guide] |
| [not returned by the fetch (vendor home page)](https://www.greptile.com/) | 2026-10-04 | [@articles/greptile-homepage] |
| [Model inversion (Greptile blog; title taken from the URL, the fetch tool did not return a title)](https://greptile.com/blog/model-inversion) | 2026-10-04 | [@articles/greptile-model-inversion] |
| [GSD Has Moved (archived repository "get-shit-done")](https://github.com/gsd-build/get-shit-done/tree/bdcaab2c752d9a33a1a1ca9acf3a3c81fb991815) | 2026-10-04 | [@articles/gsd-build-get-shit-done] |
| [Helix, a private agent fleet with spec-driven coding (README)](https://github.com/helixml/helix/blob/0787c98ea75f70b7b95105be4c0e12d5188f831d/README.md) | 2026-10-04 | [@articles/helixml-helix] |
| [Agent Audit Trail: A Standard Logging Format for Autonomous AI Systems (Internet-Draft draft-sharif-agent-audit-trail-06)](https://www.ietf.org/archive/id/draft-sharif-agent-audit-trail-06.txt) | 2026-10-04 | [@articles/ietf-draft-sharif-agent-audit-trail] |
| [When Spec-Driven Development Pays off](https://www.infoq.com/articles/when-spec-driven-development-pays-off/) | 2026-10-04 | [@articles/infoq-garg-spec-driven-pays-off] |
| [LLM Council (README)](https://github.com/karpathy/llm-council) | 2026-10-04 | [@articles/karpathy-llm-council] |
| [Agent Manager: Run Multiple Agents Without the Chaos (title taken from a search listing)](https://blog.kilo.ai/p/agent-manager-run-multiple-agents) | 2026-10-04 | [@articles/kilo-agent-manager-blog] |
| [Kiro documentation, blog posts and home page (specs, plan mode, Quick Spec, crew task runner, workflows)](https://kiro.dev/docs/specs/) | 2026-10-04 | [@articles/kiro-dev-docs] |
| [Trace Claude Code applications (LangSmith documentation)](https://docs.langchain.com/langsmith/trace-claude-code) | 2026-10-04 | [@articles/langchain-langsmith-claude-code] |
| [Tracing coding agents: Claude Code, Codex, Copilot & more](https://langfuse.com/resources/engineering/coding-agent-tracing) | 2026-10-04 | [@articles/langfuse-coding-agent-tracing] |
| [Magpie (README)](https://github.com/liliu-z/magpie) | 2026-10-04 | [@articles/liliu-z-magpie] |
| [AI Coding Assistants (Linux kernel documentation, process guide)](https://docs.kernel.org/process/coding-assistants.html) | 2026-10-04 | [@articles/linux-kernel-coding-assistants] |
| [LoopTroop (README)](https://github.com/looptroop-ai/LoopTroop) | 2026-10-04 | [@articles/looptroop-ai-looptroop] |
| [Understanding Spec-Driven-Development: Kiro, spec-kit, and Tessl](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) | 2026-10-04 | [@articles/martinfowler-bockeler-sdd-three-tools] |
| [MCO (README)](https://github.com/mco-org/mco/blob/d7fef6c96dca10a3ed0fd7c5ecd505e665ca455e/README.md) | 2026-10-04 | [@articles/mco-org-mco] |
| [Planning with agents in Visual Studio Code (GitHub Copilot Plan agent)](https://code.visualstudio.com/docs/copilot/agents/planning) | 2026-10-04 | [@articles/microsoft-vscode-copilot-plan-agent] |
| [AI code review gets better when models debate: Claude vs Gemini vs Codex vs Qwen vs MiniMax (title as shown in the URL)](https://milvus.io/blog/ai-code-review-gets-better-when-models-debate-claude-vs-gemini-vs-codex-vs-qwen-vs-minimax.md) | 2026-10-04 | [@articles/milvus-magpie-debate-benchmark] |
| [The Star Chamber: multi-LLM consensus for code quality (title as shown in the URL)](https://blog.mozilla.ai/the-star-chamber-multi-llm-consensus-for-code-quality/) | 2026-10-04 | [@articles/mozilla-ai-star-chamber] |
| [adversarial-review (README)](https://raw.githubusercontent.com/ng/adversarial-review/main/README.md) | 2026-10-04 | [@articles/ng-adversarial-review] |
| [Superpowers: an agentic skills framework and software development methodology](https://github.com/obra/superpowers/tree/8ca22dba9a94f28898bbce59f2537ff4d87c747d) | 2026-10-04 | [@articles/obra-superpowers] |
| [Omnigent (README, the Polly example agent, and the harness test bench)](https://github.com/omnigent-ai/omnigent/tree/ee3ca7cca758015de6a4de68615657486d9d1f81) | 2026-10-04 | [@articles/omnigent-ai-omnigent] |
| [GSD Core (Git. Ship. Done - Core)](https://github.com/open-gsd/gsd-core/tree/943dc11ac3227e6a8fc51ec90f6e688ce703efe9) | 2026-10-04 | [@articles/open-gsd-gsd-core] |
| [Codex generates multiple responses simultaneously (forum post dated 2025-06-13 that quotes the vendor's announcement on X)](https://community.openai.com/t/codex-generates-multiple-responses-simultaneously/1287639) | 2026-10-04 | [@articles/openai-codex-best-of-n-announcement] |
| [codex-rs/cloud-tasks/src/cli.rs (command-line definitions for Codex cloud tasks, in the open-source Codex CLI repository)](https://github.com/openai/codex/blob/afb436df8b70bb5bc57b86d9a3e829968988cd21/codex-rs/cloud-tasks/src/cli.rs) | 2026-10-04 | [@articles/openai-codex-cloud-tasks-cli] |
| [not returned by the fetch (OpenAI documentation page on Codex code review in GitHub)](https://learn.chatgpt.com/docs/third-party/github) | 2026-10-04 | [@articles/openai-codex-github-docs] |
| [Codex plugin for Claude Code (README)](https://github.com/openai/codex-plugin-cc) | 2026-10-04 | [@articles/openai-codex-plugin-cc] |
| [Rollout Trace (README of the codex-rs/rollout-trace crate)](https://github.com/openai/codex/blob/afb436df8b70bb5bc57b86d9a3e829968988cd21/codex-rs/rollout-trace/README.md) | 2026-10-04 | [@articles/openai-codex-rollout-trace] |
| [Symphony (README and SPEC.md)](https://github.com/openai/symphony/tree/be10a1b79df723d6d7612b5651c8522704dafb2e) | 2026-10-04 | [@articles/openai-symphony] |
| [SOTA on SWE-Bench Verified with Inference-Time Scaling and Critic Model (title as shown in a search listing)](https://openhands.dev/blog/sota-on-swe-bench-verified-with-inference-time-scaling-and-critic-model) | 2026-10-04 | [@articles/openhands-blog-inference-time-scaling] |
| [Semantic Conventions for GenAI agent and framework spans](https://github.com/open-telemetry/semantic-conventions-genai/blob/e07f4ebacb08f56db8c4c882d117720333fbca04/docs/gen-ai/gen-ai-agent-spans.md) | 2026-10-04 | [@articles/opentelemetry-semantic-conventions-genai] |
| [tapes (repository README)](https://github.com/papercomputeco/tapes/blob/35ded6d9365f099430747adc118fa0ffd55dff30/README.md) | 2026-10-04 | [@articles/papercomputeco-tapes] |
| [postmaster README at commit 8ea503d, and the repository's public numbers](https://github.com/brindlewick/postmaster/blob/8ea503d/README.md) | 2026-10-04 | [@articles/postmaster-repository] |
| [Introducing Qodo 2.0 (title as in the URL; the fetch gave the post date as February 4, 2026)](https://www.qodo.ai/blog/introducing-qodo-2-0/) | 2026-10-04 | [@articles/qodo-introducing-qodo-2-0] |
| [Ruflo, formerly Claude Flow (README)](https://github.com/ruvnet/ruflo/blob/caf5078be6627c6496fa2497a63b72e80a0bcf14/README.md) | 2026-10-04 | [@articles/ruvnet-ruflo] |
| [Sakana AI blog post on AB-MCTS and Multi-LLM AB-MCTS (the fetch tool did not return the title)](https://sakana.ai/ab-mcts/) | 2026-10-04 | [@articles/sakana-ab-mcts] |
| [TreeQuest (README)](https://github.com/SakanaAI/treequest) | 2026-10-04 | [@articles/sakanaai-treequest] |
| [Agents Observe (repository README)](https://github.com/simple10/agents-observe/blob/b3a7238b3913976c10da052f75c73e29ad084c61/README.md) | 2026-10-04 | [@articles/simple10-agents-observe] |
| [Claude Squad (README)](https://github.com/smtg-ai/claude-squad/blob/ce1ffb4392b01f38e2c4599c7c84d2a93973b138/README.md) | 2026-10-04 | [@articles/smtg-ai-claude-squad] |
| [SpecStory (repository README and CLI README)](https://github.com/specstoryai/getspecstory/blob/2722e74896036c3269dbbd3b25b3c1456dc5a691/README.md) | 2026-10-04 | [@articles/specstoryai-getspecstory] |
| [Parallel Worktrees Skill for Claude Code (README)](https://github.com/SpillwaveSolutions/parallel-worktrees/blob/89eae06db5df402fe223f83258cc5c85095db10d/README.md) | 2026-10-04 | [@articles/spillwavesolutions-parallel-worktrees] |
| [Orca (README)](https://github.com/stablyai/orca/blob/87bc51d3710332ea8b0f7f0e5610a31413a79582/README.md) | 2026-10-04 | [@articles/stablyai-orca] |
| [Superset (README)](https://github.com/superset-sh/superset/blob/84fa11a1f45a2ac9d06d528a2711dc71056f9fac/README.md) | 2026-10-04 | [@articles/superset-sh-superset] |
| [mini-swe-agent (repository README): The minimal AI software engineering agent](https://raw.githubusercontent.com/SWE-agent/mini-swe-agent/main/README.md) | 2026-10-04 | [@articles/sweagent-mini-swe-agent] |
| [Terminal-Bench 2.1](https://www.tbench.ai/news/terminal-bench-2-1) | 2026-10-04 | [@articles/tbench-terminal-bench-2-1] |
| [Spec-driven development (tile, version 2.0.1 by tessl-labs); Tessl launches spec-driven framework and registry](https://tessl.io/registry/tessl-labs/spec-driven-development) | 2026-10-04 | [@articles/tessl-spec-driven-tile] |
| [PR-Agent: The Original Open-Source PR Reviewer (README)](https://raw.githubusercontent.com/The-PR-Agent/pr-agent/main/README.md) | 2026-10-04 | [@articles/the-pr-agent-pr-agent] |
| [Agent Trace (Thoughtworks Technology Radar entry)](https://www.thoughtworks.com/radar/platforms/agent-trace) | 2026-10-04 | [@articles/thoughtworks-agent-trace] |
| [Mixture-of-Agents (MoA) (README)](https://github.com/togethercomputer/MoA) | 2026-10-04 | [@articles/togethercomputer-moa] |
| [Traycer home page and documentation home](https://traycer.ai/) | 2026-10-04 | [@articles/traycer-traycer] |
| [Agent Orchestrator (README)](https://github.com/Untrivial-ai/agent-orchestrator/blob/fb55fdc159106c2d1f7dc2bba2afab87e1a71c87/README.md) | 2026-10-04 | [@articles/untrivial-ai-agent-orchestrator] |
| [Goodbye bloop (blog post dated 2026-04-10)](https://www.vibekanban.com/blog/shutdown) | 2026-10-04 | [@articles/vibekanban-goodbye-bloop] |
| [How It Works (Voratiq documentation)](https://github.com/voratiq/voratiq/blob/96edc62fd9d5/docs/how-it-works.md) | 2026-10-04 | [@articles/voratiq-how-it-works] |
| [Voratiq (README)](https://github.com/voratiq/voratiq) | 2026-10-04 | [@articles/voratiq-voratiq] |
| [Run multiple AI coding agents (Warp documentation guide, 'last updated Sep 24, 2026' as shown by the fetch tool)](https://docs.warp.dev/guides/agent-workflows/how-to-run-multiple-ai-coding-agents) | 2026-10-04 | [@articles/warp-run-multiple-agents] |
| [Arena Mode (Windsurf Cascade documentation, hosted on docs.devin.ai)](https://docs.devin.ai/desktop/cascade/arena.md) | 2026-10-04 | [@articles/windsurf-arena-mode] |
| [OMP Best Of (README)](https://github.com/wolfiesch/omp-best-of/blob/b5d2c1e298e948d5ffe43b4e6e26ff528019bcc5/README.md) | 2026-10-04 | [@articles/wolfiesch-omp-best-of] |
| [oh-my-claudecode (README)](https://github.com/Yeachan-Heo/oh-my-claudecode/blob/13543f9d6fc1a13a15b68fe5c97baeb3268569e2/README.md) | 2026-10-04 | [@articles/yeachan-heo-oh-my-claudecode] |
| [I Make Codex Review Every Diff Claude Writes](https://zackproser.com/blog/codex-reviews-claudes-diffs) | 2026-10-04 | [@articles/zackproser-codex-reviews-claude] |
