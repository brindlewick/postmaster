---
title: "pstack (poteto, 2026): skills and principles for verified agent work"
type: source
sources: [articles/pstack-plugin, articles/pstack-guide-part-1, trials/pstack-verification-skill, trials/not-shown-evidence]
updated: 2026-10-04
---

# What pstack holds, and what postmaster can take from it

[pstack][pstack] is a public plugin for coding agents by poteto. Its folder holds 49 skills (25
working skills and 24 one-rule principles), 23 playbooks that a router skill chooses between,
two subagents, two bundled programs with a handful of small scripts, and a dormant pack of Slack
automations. The README's counts of playbooks and principles match the folder. A guide of ten
chapters sits in the plugin, and a series of posts on X opens with [Part 1][part1], on
verification. [Issue #256][i256] asked how pstack can help postmaster. This page gives a verdict
for every skill and principle, ranks the changes worth making, and lists what was read.

## The answer

Postmaster already holds most of what pstack teaches about verification, and holds much of it as
scripts, where pstack holds it mostly as prose. Of the 52 skills, 22 are already done here, 5 are
worth adopting and 25 are not a fit. Of the 23 playbooks, 11 are already done, 2 are worth
adopting and 10 are not a fit. Nine changes are worth making. They are small, and five of the
nine belong in tickets that are already open. One of them is not about verification. Pstack's
habit of treating text from outside as data, not instructions, turned up a gap here. Part 1's
largest idea, a standing driver and feature map for each target with a daily upkeep pass, has
no counterpart here. It fits as an input to the QA turnpike, after a trial. A first look at the
skill on a small command-line app found that its record mostly restates what the app already
declares, so the trial belongs on a project with a user interface.

## What pstack claims

- Verification, meaning an agent can check its own work, is the most important skill, and it is
  infrastructure to keep up, not a skill to write once [@articles/pstack-guide-part-1/passages.md].
- Give agents tools rather than markdown, and make a tool's commands safe to use, with a dry run
  for anything destructive and errors that say what to do next
  [@articles/pstack-guide-part-1/passages.md].
- Keep a map of the app's features as "materialized memory", and check it against the app every
  day [@articles/pstack-guide-part-1/passages.md].
- Worktrees cap parallelism at about ten agents on one machine, so run agents elsewhere
  [@articles/pstack-guide-part-1/passages.md].
- Use a swarm of runs to check a change with a big enough sample
  [@articles/pstack-guide-part-1/passages.md].

## On what evidence

An account of one person's practice and a plugin, not a study. Part 1 gives its figures without a
method, and none of the guide's chapters gives one. The plugin is MIT licensed, and its two
bundled programs have tests. One pstack skill was run, once, by hand, on a small app, and the
first look below bears on candidate 7. Every verdict sets text beside text.

## Verdicts

Three verdicts, the words of the ticket. **Already done** names the file or ticket that holds the
idea here. **Worth adopting** says what it would change, and the ranked list below says what it
costs. **Not a fit** says why. A row's account of a pstack file rests on that file at the commit
in Sources. The quotes the verdicts lean on are in
[@articles/pstack-plugin/passages.md].

### The 25 working skills

| skill and what it does | verdict | why, or where it is held |
|---|---|---|
| [/poteto-mode][s-poteto-mode], a sticky router that copies a playbook's steps into a todo list, a skipped step staying listed with its reason | Already done, differently | Postmaster has no router. A stage cannot be skipped quietly, because [`scripts/run stage`][stage] holds the stage order and [`scripts/run handoff-check`][handoff-check] refuses an incomplete hand-off ([coachman][coachman], Legs and hand-offs). Its question filter is candidate 8. |
| [/how][s-how], [/why][s-why], [/teach][s-teach], [/recall][s-recall], read-only research and context skills | Not a fit | Model-side skills that each harness would have to ship, which design rule 2 in [AGENTS.md][agents] rules out. The ticket session verifies premises at a base commit ([ticket-template][ticket-template]), the hand-off is the whole of what the next leg knows, and the postmaster keeps nothing outside `<runs>` ([postmaster][postmaster], Memory is the disk). The confidence tiers inside `/why` are what [the schema][schema] asks of a wiki page: cite a claim or mark it unverified, and say what could not be shown. |
| [/architect][s-architect], sketch types and signatures through competing candidates before code, and scrap the design when the same friction keeps coming back | Already done | The spec is written and approved before any code ([planning-stage][planning-stage], [workhorse-spec][workhorse-spec]). Scrapping is [review-convergence][review-convergence]: a mechanism whose fixes keep breaking is redesigned, not fixed again. |
| [/arena][s-arena], N candidates, a rubric held back from them, a judge from another family, a base chosen and the best parts grafted | Already done | This is what a run is. Lanes work in blinkers, the coachman is never a lane's model ([postmaster][postmaster], Stage C), and a blind oracle no lane wrote ranks the lanes. Two differences are deliberate. The coachman composes from BASE with no base lane, and it treats agreement between lanes as no evidence ([coachman][coachman], Stage 1), where arena reads convergence as a strong signal [@articles/pstack-plugin/passages.md]. |
| [/swarm][s-swarm], N workers return pass, issues or blocked, and a gap is not a pass | Already done | Review rounds fan out by lens and lane. A lane that did not review at full strength is DEGRADED, and a degraded clean is not a clean ([coachman][coachman], Hard rules). [`scripts/run review-round`][review-round] collects a round by its deadline. |
| [/interrogate][s-interrogate], the same diff to several families, then a lead sorts findings into act on, consider, noted and dismissed with reasons | Already done, differently | Every gating finding is verified against the code before it counts, and the checkpoint records each as open, closed or `dismissed: <reason>` ([coachman][coachman], Stage 2). The bug and security lenses run each harness's own review skill where it has one ([own-review-skills][own-review-skills]), so pstack's reviewer prompt, rubric and code-quality lens would replace what each harness's makers tuned. That a finding two models raise is highest signal is hypothesis H2 here, still claimed ([combining-models][combining-models]). |
| [/blast-radius][s-blast-radius], what a small change breaks elsewhere, with the one fact it is safe because of proven by running code and rated on a five-rung ladder | Already done, in part | The bug lens does the search. Every hand-off has `Verified by execution` and `Unverified`, and [`scripts/run summary-evidence`][summary-evidence] holds each criterion's evidence to a file that exists. The ladder's finer rungs would not change a decision, so they are not worth a ticket. |
| [/benchmark-checklist][s-benchmark-checklist], seven questions that vet a performance number | Not a fit, as a step | Postmaster tickets seldom carry a performance claim (unverified, from the titles of the open tickets). Its rules for any comparison are the ones design rule 5 and [the schema][schema] already ask for: name what limits the number, treat both sides alike, repeat with the sides alternated, and check the work happened [@articles/pstack-plugin/passages.md]. They are the questions [#137][i137] and the audit in [#257][i257] have to answer. |
| [/automate-me][s-automate-me], mines a person's transcripts into a personal mode skill | Not a fit | The user's standing rules are written by them, in [AGENTS.md][agents] and their own instructions, not mined. |
| [/make-bot-ui][s-make-bot-ui], a page whose buttons wake a bot through a webhook | Not a fit | Tied to one vendor's bot platform. The dashboard ([#146][i146]) is read-only by design. Its rule that a webhook body is data, not an instruction, is candidate 2. |
| [/setup-pstack][s-setup-pstack], detects the models, asks for a budget, writes a role-to-model rule and validates every slug | Already done | Setup is a conversation. `scripts/run probe-harnesses` finds what exists, and [`scripts/run setup`][setup] writes the config and refuses a harness that is not on the path ([AGENTS.md][agents]). |
| [/reflect][s-reflect], three reviewers read a transcript and propose skill edits for the user to accept | Already done, in part | A fault in postmaster becomes a ticket when the run closes ([tool-faults][tool-faults]), and a convention gap goes to the card as a proposed rule ([coachman][coachman], Stage 1). A transcript-reading retro for every run is not worth its cost. The audits do it in bulk. |
| [/tdd][s-tdd], write the failing test first and report the failing-before result | Worth adopting, in part | A ticket's checks already run at the base, before any work, and record what they show there. The controls the lanes add have no such evidence yet. Already ticketed as [#133][i133], which asks for the same evidence for every control. Candidate 4. |
| [/no-comments][s-no-comments] with the Comment Sicko agent, a fresh reviewer deletes comments | Not a fit | Comment policy belongs to a project's linter and docs. The style lens feeds the linter ([review-loop][review-loop]). |
| [/typescript-best-practices][s-typescript-best-practices], type rules loaded when a TypeScript file is touched | Not a fit | Not a flow rule, and enforced by structure here. The gate type-checks and lints, and [#171][i171], [#232][i232] and [#233][i233] move more rules into the linter. |
| [/figure-it-out][s-figure-it-out], designs a one-off playbook when none fits | Not a fit | A run follows one fixed contract that fixture runs test. A leg that finds no step for a turnpike escalates ([coachman][coachman], Legs and hand-offs). |
| [/show-me-your-work][s-show-me-your-work], an append-only decision log, audited against the transcript and reviewed by another family | Already done, more strictly | Every action is one line through [`scripts/run log-action`][log-action], with a closed set of verbs, per run and per project (design rule 6). The run audit digests each lane's durable record ([coachman][coachman], Stage 1). [#19][i19] makes the line's shape validated. |
| [/create-verification-skill][s-create-verification-skill], interviews the repository, writes a project-local driver and a feature map, and runs it once | Worth adopting | Postmaster declares or discovers a project's checks and holds a journey report to the ticket ([verification][verification]). It keeps no standing driver or map. Candidate 7, as a trial on a project with a user interface. A first look at the skill is below. |
| [/maintain-verification-skill][s-maintain-verification-skill], the upkeep pass, a read-only reader per feature and one live pass | Worth adopting, elsewhere | The same pass fits what the flow depends on, the harness versions its settled facts name. Candidate 3. |
| [/unslop][s-unslop], a catalogue of writing patterns to cut | Not a fit | The project has no rule against any of those patterns, so there is nothing to check. Pstack's plan checker enforces three of them by script, which is the model if the user wants such a rule. |
| [/bro][s-bro], restate the last message plainly | Not a fit | A one-line prompt. |
| [/technical-writing][s-technical-writing], a layered standard for docs | Already done, in kind | One document, one mode is the line between a runbook and a concept ([the schema][schema]). [`scripts/run ticket-parts`][ticket-parts] checks that a ticket's plain part is plain. |

### The 24 principles

| principles | verdict | why, or where it is held |
|---|---|---|
| build-the-lever, encode-lessons-in-structure, prove-it-works, explain-the-number, fix-root-causes | Already done | Design rules 3 and 5 and "Fix an open pull request instead of deferring its gaps" in [AGENTS.md][agents], and the list of controls ([controls][controls]). [`scripts/run runs-status`][runs-status] reads the attempt record and never classifies an attempt from `.err`. [The schema][schema] asks for a number with its control. [#255][i255] pairs detection ([#202][i202]) with prevention. |
| separate-before-serializing-shared-state, guard-the-context-window, sequence-verifiable-units, redesign-from-first-principles, attack-the-premise, migrate-callers-then-delete-legacy-apis, exhaust-the-design-space | Already done | The marker ownership table gives every marker one writer, and each lane has a worktree of its own ([coachman][coachman], Marker ownership, [lane-confinement][lane-confinement]). Legs are fresh and a watcher takes the mechanical steps ([postmaster][postmaster], Stage D). The spec commit comes first, then the oracle, then the synthesis. [review-convergence][review-convergence] redesigns a mechanism instead of fixing it again, with the census of where findings sit made by hand. [#218][i218] removed the shell wrappers, so each script now runs as its TypeScript file. Every run is several lanes, and [#238][i238] asks every model for a prototype before the dashboard is built. |
| make-operations-idempotent, test-behavior-not-implementation | Worth adopting | Candidates 1 and 4. Rerun-safety is a criterion [#252][i252] lacks, and the test shapes that cannot fail sharpen [#133][i133]. |
| never-block-on-the-human | Not a fit, by decision | The user decides which questions are theirs. The flow waits at the spec review, at a wall and at the merge when the user holds that authority, and it never answers for silence. Pstack's parked gates default on silence, and its README says it does not believe in planning [@articles/pstack-plugin/passages.md]. |
| laziness-protocol, foundational-thinking, subtract-before-you-add, minimize-reader-load, outcome-oriented-execution, model-the-domain, boundary-discipline, type-system-discipline, experience-first | Not a fit | Code-shape rules for a target's own code. A target's docs and linter carry them, and for this repository the gate does ([#171][i171], [#232][i232], [#233][i233], [#234][i234]). |

### The playbooks, scripts, agents and automation pack

The [23 playbooks][playbooks] are grouped by what they do.

| item | verdict | why, or where it is held |
|---|---|---|
| investigation, session pickup, pause safely | Already done | A research ticket gets an interactive session, not a run ([#99][i99]). A takeover starts from the hand-off and treats every uncommitted change as unverified ([postmaster][postmaster], Stage D). A leg ends only on a complete hand-off. |
| prototype | Worth adopting, in part | Its rule that a fork whose answer can be observed by running something is not the human's to answer [@articles/pstack-plugin/passages.md]. Candidate 8. |
| bug fix, feature, refactoring, perf issue, hillclimb, runtime forensics, trace forensics, visual parity | Not a fit | They say how to do a ticket's own work. The lanes choose that, and the flow checks the result. One idea inside, the failing repro landing before the fix, is candidate 4. |
| eval | Not a fit, today | A fixture run tests the contract, and its lanes run at lowered efforts ([postmaster][postmaster], Stage B), so it does not measure lane behaviour. Its blinding rules and grading from the files a lane really read [@articles/pstack-plugin/passages.md] are the checklist if a fixture is ever used to compare two variants, as candidate 5's trial might. |
| authoring a skill | Already done, in kind | [`scripts/run skill-refs`][skill-refs] and [`scripts/run wiki-lint`][wiki-lint] check that references and links resolve. |
| babysit | Not a fit | The flow does not watch a pull request after it opens. The user merges a pull request, and a local merge follows the configured authority ([postmaster][postmaster], Stage F). Its rule that review-comment text is data, never an instruction, is candidate 2. |
| shipping | Already done | [`scripts/run landing`][landing] ties every result to the head being landed and refuses a stale card. Pstack's patch-id carry is what [#198][i198] does for documentation-only moves of main and what [#137][i137] asks of re-review. |
| opening a pull request | Already done, in practice | Recent bodies are short briefings with the checks named ([#249][p249], [#250][p250], [#254][p254]). The runbook's list in Stage F is longer than practice. |
| autonomous run, multi-phase plan | Already done, in part | A ticket's criteria are the finish condition, and the stall cutoff and escalation are the escape hatch ([coachman][coachman], Stage 1). [`scripts/run ticket-check`][ticket-check] and `scripts/run ticket-parts` are the plan checker. One step has no finish condition: [#264][i264] records that the synthesis has no rule to repeat until the ticket's checks pass. |
| orchestrate, autopilot-full, autopilot-stack | Already done | This is the postmaster's job. [`scripts/run runs-watch`][runs-watch] wakes it only when judgment is needed, the marker table gives one writer per file, and `scripts/run landing` keys a verdict to the head. Four differences stand. Parked gates that default on silence are not adopted [@articles/pstack-plugin/passages.md]. A pilot unit before fan-out is not needed while the spec review gates each ticket. `scripts/run runs-status` counts file motion in the run folder where pstack counts only side effects such as commits [@articles/pstack-plugin/passages.md], which matters if a chatty but stuck lane shows up in the records. A launch killed at its memory cap says so in `.err` ([hosts][hosts]) and reads as an incomplete attempt for the postmaster to judge, where pstack's retry table respawns it with a smaller scope [@articles/pstack-plugin/passages.md]. |
| worktree and simulator cleanup | Worth adopting, in part | [#252][i252] is the same job, and its fourth criterion is the idea that a leftover the command cannot explain stays in place [@articles/pstack-plugin/passages.md]. What it lacks is rerun-safety, candidate 1. |
| scripts: `orch`, `watch-pr`, `worktree-audit.sh`, `check-plan.mjs` | Not a fit, as code. `check-plan` already done in kind | `orch` installs a runtime package at first use, and postmaster's scripts take only Bun and Node built-ins ([AGENTS.md][agents]). `watch-pr` babysits GitHub checks. `worktree-audit.sh` reads one harness's chat store. The checks they make are held by `scripts/run ticket-check`, `scripts/run ticket-parts` and the ownership table. |
| agents: [poteto-agent and Comment Sicko][agents-dir] | Not a fit | The first exists because a general subagent skips reading the mode skill [@articles/pstack-plugin/passages.md]. Harnesses here read [AGENTS.md][agents] natively, and one that does not is pointed at it by its brief. |
| [benny pack][benny]: triage-issue-reports, reproduce-and-fix-issues, setup-benny | Not a fit, now | It triages and reproduces reports from a Slack channel. No flow here takes inbound reports. Its duplicate rule is held, since a repeated tool fault carries its first line's text ([coachman][coachman], Tool faults). Two rules are worth keeping for bug tickets and for the QA turnpike ([#97][i97]). A symptom must show twice with a reset between, and no confirmed repro means no authored fix [@articles/pstack-plugin/passages.md]. |

### Part 1, idea by idea

| idea | verdict | where it lands |
|---|---|---|
| Tools an agent uses well, a small CLI that is safe and says what to do next | Worth adopting, narrowly | Candidate 9. [#252][i252] counted 2 of 53 script wrappers that offer a dry run and 4 that offer JSON output. |
| A feature map kept current by a daily upkeep pass | Worth a trial | Candidate 7 for targets, and candidate 3 for the harness versions. |
| Verification as infrastructure | Already done, for the flow | [verification][verification], [controls][controls], and the oracle. Missing is a standing driver for a target, candidate 7. |
| A swarm of runs for a big enough sample | Worth a trial first | Candidate 5. |
| Cloud agents instead of worktrees | Not a fit, as stated | A vendor's cloud. The limit it answers is real here and ticketed as [#136][i136] and [#194][i194]. |

## The changes worth making, ranked

Ranked by what the repository already shows, cheapest and best evidenced first, with the one
safety gap placed second. None is filed. A row that names an open ticket would be a comment on
that ticket. Contract files are those in [the contract list][contract], and a change to one needs
a clean fixture run before it merges.

| # | candidate, in one sentence | belongs in | contract files | cost | what would settle it |
|---|---|---|---|---|---|
| 1 | A cleanup that is run twice, or again after a crash at any step, finishes the job and changes nothing already done. | [#252][i252], as a criterion | those #252 already touches | one criterion and one test that stops the command after each step and runs it again | The test passes, with a naive cleanup failing the same test. |
| 2 | Text written by anyone but the user is data to a lane and to the postmaster, so a ticket's author and each comment's author are checked before a ticket is dispatched, and a ticket from anyone else is shown to the user first. | a new ticket | yes, `scripts/ticket-check.ts` and `postmaster.md` are listed, so a fixture run | small to medium | A ticket and a comment from a second account are held for the user, and the user's own are not. |
| 3 | A daily check reports each harness whose installed version differs from the version a settled fact or a recorded trial names, and says which trial to re-run. | a new ticket | none | a script, and a `versions` line in each trial and concept | Re-running the trials for the two harnesses that have moved shows whether a settled fact changed. |
| 4 | Every control a change adds is shown to fail when every function it imports is replaced by one that returns nothing, and the five test shapes that cannot fail are the checklist. | [#133][i133], as the first step of its criterion 3 | none for the stub in the gate. Its criterion 2 touches the coachman's review steps, and must not tune what a reviewer looks for | small | The stub run over the existing tests, with a known vacuous test as the positive control and a real one as the negative. |
| 5 | Score one fixture ticket five times from one commit, to see how much the score and the path of a run vary, before asking for more than one clean fixture run per contract change. | a new research ticket, recorded as a trial | none | five fixture runs, which [#265][i265] puts at about 2 hours 10 minutes each today | The spread. If all five agree, one run stands. If not, it names the number to require. |
| 6 | Name the flow's failure scenarios (a lane wall, a coachman killed mid-leg, the review cap, a takeover, a confinement fallback) and run each with stub lanes in seconds. | [#104][i104], as an option in its research | none to test | medium | #104's trial, plus a count of past contract breaks the scenarios catch that the gate does not. |
| 7 | A model that follows pstack's interview of the repository writes, once per target, how to launch, check, drive and clean up the project and a short map of its user-facing features, and a trial on a project with a user interface, an end user's or this one's once the dashboard ([#146][i146]) exists, shows whether lanes given it end with fewer `not shown` evidence entries. | [#97][i97], the QA turnpike, as its input | none for the trial. Adopting touches `coachman.md` and the waybill in `SKILL.md` | medium, a session per target and two tickets compared | Evidence quality with and without the record on the same two tickets of that project, against the baseline count below. |
| 8 | A decision goes to the user in a spec review only if running something cannot settle it, and the spec shows the result of what could. | [#219][i219], as one more option | `spec-session.md`, if adopted | low | A mock review sheet built both ways from two real specs, counting the decisions removed and any removed that was the user's call. |
| 9 | Every script that removes or rewrites something offers a dry run that changes nothing, and a test fails one that does not. | a new ticket, after #252 | yes, `scripts/host.ts`, `scripts/landing.ts` and `scripts/stage.ts` are listed, so a fixture run | medium | The count of state-changing scripts with a dry run, with a script that lacks one as the negative control. |

Two pstack ideas were weighed and left out of the ranking. The pilot unit before fan-out has no
evidence here, and the spec review already gates each ticket. A re-read of the runbook at every
resume has no failure in the records to point at, so the cheaper first step is to count resumes
per leg.

Candidate 2 comes from a search of the runbooks and scripts at `40d50ce`, repeated on main at
`5c58c83` on 2026-10-04 with the same result. The GitHub adapter's `read` prints every comment
on a ticket with its author's login, whoever that is, and the waybill carries the ticket
verbatim to lanes that run in bypass mode ([coachman][coachman], Lane capability). Nothing there
checks who wrote either. No runbook treats ticket or comment text as untrusted input, and the
word appears only for Codex's untrusted worktrees in [harnesses.md][harnesses].
[`scripts/run ticket-check`][ticket-check] has no author part. The ticket session and the user's
sign-off of the plain part are a human check on the way, and confinement ([#221][i221]) limits
what a lane can reach. Neither looks at the author. Pstack's benny pack does look at it: its
reproduce automation trusts a triage verdict only from one configured account
[@articles/pstack-plugin/passages.md]. This has not been tried against a hostile ticket.

## Two trials that bear on candidate 7

Both are small. Each settles only what it was built for, and each is recorded as a trial.

### First look at the verification skill

On 2026-10-04 an agent session followed [/create-verification-skill][s-create-verification-skill]
by hand, once, on a scratch copy of the `todo` fixture app [@trials/pstack-verification-skill/method.md].
The app has three commands and a stored list. The look took 8 minutes and about 80,000 tokens
(unverified: the session's own counters, not kept).

- **What it made.** Eight files and 400 lines [@trials/pstack-verification-skill/skill/SKILL.md]: the
  skill (57 lines), a helper that runs each command against a list file of its own and keeps proof
  (144), and a feature map of an index (44) and five features (30 to 32 lines each). The skill's own
  proof passed the first time: a health check, one feature driven, and the proof still there after
  cleanup (unverified: that output was not kept).
- **How accurate the map is.** It makes 37 claims, and a walk through every recipe held all 37
  [@trials/pstack-verification-skill/walk.out]. A wrong expectation run first was reported as a
  failure, which is the control. The first walk held 36 (unverified: its output was not kept). The
  miss was the walk's own check, which counted proof blocks. A proof file grows across runs, and a
  sentence saying so was added to the skill.
- **What it added.** The app already declares three checks: its gate, the transcripts of a ticket
  and one process-level add and list ([the declared checks][app-checks]). The skill added
  process-level checks of `done`, a missing id and a bad list file, a health check, saved proof and
  one finding. Thirty parallel `add` commands on one list file stored between 6 and 12 tasks in each
  of six rounds, and no id repeated [@trials/pstack-verification-skill/walk.out]
  [@trials/pstack-verification-skill/walk-after-remove.out]. The look itself saw 9 to 14 in six
  rounds (unverified, not kept). Each process reads and rewrites the whole file with no lock
  ([the app's store][app-store]). The skill's question whether two instances can run side by side
  led to the test, and the unit tests run one command at a time and could not show it. The app is a
  single-user tool, so this is a limit and not a defect.
- **What went wrong.** The look found the app's gate red once the skill's files were in place. Biome
  checks `.cursor/`, the helper was not formatted to the project's rules, and `npm run check` stopped
  before the tests ran (unverified: the failing run was not kept). A search of the skill's file for
  `lint`, `format`, `gate`, `npm run` and `biome` finds none, with `feature map` found as the control,
  so the skill never tells the agent to hold its output to the project's own gate. One run of the
  project's formatter fixed it. Its recipe for command-line apps, an isolated terminal session, is
  meant for interactive programs, and a plain process with its own list file was enough here. It
  writes into `.cursor/skills/`, a folder Cursor reads, and whether other tools read it was not
  tested.
- **Upkeep.** The reference solution of the fixture ticket `remove` was applied to a copy, and the
  same walk run on it. 22 of the 37 claims held and 15 had gone stale
  [@trials/pstack-verification-skill/walk-after-remove.out]. 13 failed because the usage line gained
  a command, and 2 because the stored list gained a field. The map has no recipe for the new command.
  This is the work the upkeep pass of [/maintain-verification-skill][s-maintain-verification-skill]
  exists for.

The record was cheap to make, and its claims held. On a three-command command-line app it mostly
restates what the app already declares, and the first ticket makes it stale. It also needs the
project's formatter run over it. Whether lanes do better with it is untested, and that is the
two-ticket comparison of candidate 7, which belongs on a project with a user interface.

### How often a lane says `not shown`

Each workhorse's summary has an Evidence section with one entry per acceptance criterion. An entry
names a file under `.postmaster/verify/`, or says `not shown: <reason>` ([coachman][coachman]).
Candidate 7's trial counts the second kind, so this count is its baseline. It reads the summary at
the tip of each lane branch, in this repository's runs and in the fixture repositories, as they stood
on 2026-10-04 [@trials/not-shown-evidence/counts.out].

- **This repository's runs.** 21 summaries have an Evidence section, dated 2026-10-01 to 2026-10-04,
  and 57 others have none. The 21 hold 249 entries, 214 shown and 35 not shown. 16 of them have no
  `not shown`. One has all 29 of its entries, one has 3 of 10, and three have 1 each
  [@trials/not-shown-evidence/per-summary.out].
- **The fixture repositories.** 19 summaries and 152 entries, all shown.
- **The control.** Every entry was one kind or the other, with none left over. A made-up summary of two
  shown entries and one not shown counted 2 and 1, and a text with no Evidence section read as having
  none.
- **The reasons.** None of the 35 is about a browser or a user interface. Three say the user dropped or
  moved the criterion. Three name a check that could only run elsewhere: a Mac score, twice, and a
  fixture run at landing. The other 29 are one summary's, and they mix "not implemented" and "not run"
  with "tested" and no evidence file kept [@trials/not-shown-evidence/reasons.out]. Classified by
  reading, not by a script.

The check does not bound the number. On the fixture ticket `remove`, which numbers eight criteria,
[`scripts/run summary-evidence`][summary-evidence] exits 0 on a summary of eight `not shown` entries and
prints `(8 not shown)`. It exits 2 on a summary with one entry missing and on one that cites a file
that does not exist, which are the controls [@trials/not-shown-evidence/summary-evidence-controls.out].
A summary like the one with 29 of 29 therefore passes the shape check, and whether that is acceptable
rests on whoever reads the line it prints.

For candidate 7: where the evidence is checked, `not shown` is rare. 16 of 21 summaries and every
fixture summary have none, and 29 of the 35 sit in one summary. The tickets behind these summaries
change scripts and runbooks, which have no user interface to show, so no reason is about showing one.
A fall in `not shown` can be measured only where criteria need a user interface, which is why
candidate 7's trial is set on such a project. Not counted: the runs of other projects, and whether
any `not shown` was right.

## What was measured

- The README's counts match the folder, which is the control that the whole set was listed. It
  says twenty-three playbooks and twenty-four principles, and the folder holds 23 playbook files
  and 24 principle folders.
- Two of the five harness commands on the machine report a newer version than the ones the wiki's
  settled facts name. Claude Code is at 2.1.288 where the facts name 2.1.283 and 2.1.286, and Muse
  Code is at 1.4.2 where they name 1.4.0. Codex 0.157.1, pi 0.87.0 and MiMo Code 0.1.15 match,
  as do Herdr 0.9.1 and Bun 1.4.2. Unverified: counted by hand on 2026-10-03 with each command's
  `--version` against the versions in [harnesses.md][harnesses] and the concept pages, and not
  recorded as a trial.
- The script counts are [#252][i252]'s, taken at its commit: 2 of 53 wrappers offer a dry run and
  4 offer JSON output. Not recounted.

## What this page does not show

One pstack skill was run once, by hand, on one small command-line app, and no candidate has been
tried. "Already done" means the idea is in this repository at the commit below, not that it works
well. Only the review rounds of #36 are promoted as a run record, so no standing here rests on a run
about these ideas. The version count is a single reading by hand. The first look is one run on one
app, and its first walk was not kept. The count of `not shown` entries reads branches as they stood
on one day, and its reasons were sorted by reading.

## Sources

- The plugin at commit [`23e4138`][pstack-commit] (2026-10-03, version 0.15.6, MIT), captured in
  `raw/articles/pstack-plugin/`. Read in full: every `SKILL.md` (49 under `skills/` and 3 in the
  benny pack), every reference file except the six per-source playbooks of `/why` for Databricks,
  Datadog, Linear, Notion, Sentry and Slack, the 23 playbooks and the one reference under
  `skills/poteto-mode/`, the two agents, the plugin README and manifest, the benny pack's other
  files, and the guide's index and ten chapters. The bundled programs `orch` and `watch-pr` were
  read at their entry points and types, not line by line, and their tests were not read. 153 text
  files were downloaded, each checked against its size in the repository's tree. Seven image
  files were not read.
- [Part 1][part1] of the guide on X, 2026-08-31, captured in `raw/articles/pstack-guide-part-1/`.
  It ends "stay tuned for Part 2". Two web searches on 2026-10-03 found no later part. The
  plugin's own ten chapters cover the later topics: overnight runs, the principles, writing your
  own mode, and recipes.
- The [example verification skill][example] the post links, at commit `d5abe70`. Read its skill,
  its feature map index and one feature file. It states no licence, so nothing is captured from
  it.
- One sibling skill outside the folder, [verify-this][verify-this] in the same repository's
  team-kit plugin, read for context and given no verdict. It captures a baseline and a treatment
  and returns one of three verdicts.
- Postmaster at `40d50ce`: [AGENTS.md][agents], the runbooks under `skills/postmaster/`, the
  scripts, the wiki, and the open tickets and recent pull requests named above.
- Postmaster on main at `5c58c83`, 2026-10-04, after [#218][i218] ended the `.sh` wrappers.
  Script names here are in the `scripts/run <name>` form, and every link target exists. Since
  `40d50ce`, [AGENTS.md][agents], the runbooks and the concept pages cited here changed in script
  names, in how scripts are called and in shell syntax made to run under zsh. None of that
  changes a rule or a section this page cites, read as a diff with the script names made alike.
  The contract list still names the files the ranked table says it does. Each ticket linked here
  was read again, and all are open except #218.
- Two trials of this repository's own, recorded for this page: [@trials/pstack-verification-skill],
  a first look at the verification skill, and [@trials/not-shown-evidence], a count of `not shown`
  evidence entries and a check of whether the evidence check bounds them.

Bears on [each project defines how a change to it is verified][verification] and on
[a fixture run tests the flow end to end][fixture-runs]. Outside work does not move a standing,
so neither changes.

[pstack]: https://github.com/cursor/plugins/tree/23e4138daa01c42d4969f7a5465f82704e64f798/pstack
[pstack-commit]: https://github.com/cursor/plugins/commit/23e4138daa01c42d4969f7a5465f82704e64f798
[part1]: https://x.com/poteto/status/2094457600259842065
[example]: https://github.com/poteto/verification-skill-example/tree/d5abe70d0d8c671672b6cef4069363f26c488feb
[verify-this]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/cursor-team-kit/skills/verify-this/SKILL.md
[playbooks]: https://github.com/cursor/plugins/tree/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/poteto-mode/playbooks
[agents-dir]: https://github.com/cursor/plugins/tree/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/agents
[benny]: https://github.com/cursor/plugins/tree/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/automations/benny
[s-poteto-mode]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/poteto-mode/SKILL.md
[s-how]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/how/SKILL.md
[s-why]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/why/SKILL.md
[s-teach]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/teach/SKILL.md
[s-recall]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/recall/SKILL.md
[s-architect]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/architect/SKILL.md
[s-arena]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/arena/SKILL.md
[s-swarm]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/swarm/SKILL.md
[s-interrogate]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/interrogate/SKILL.md
[s-blast-radius]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/blast-radius/SKILL.md
[s-benchmark-checklist]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/benchmark-checklist/SKILL.md
[s-automate-me]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/automate-me/SKILL.md
[s-make-bot-ui]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/make-bot-ui/SKILL.md
[s-setup-pstack]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/setup-pstack/SKILL.md
[s-reflect]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/reflect/SKILL.md
[s-tdd]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/tdd/SKILL.md
[s-no-comments]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/no-comments/SKILL.md
[s-typescript-best-practices]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/typescript-best-practices/SKILL.md
[s-figure-it-out]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/figure-it-out/SKILL.md
[s-show-me-your-work]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/show-me-your-work/SKILL.md
[s-create-verification-skill]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/create-verification-skill/SKILL.md
[s-maintain-verification-skill]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/maintain-verification-skill/SKILL.md
[s-unslop]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/unslop/SKILL.md
[s-bro]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/bro/SKILL.md
[s-technical-writing]: https://github.com/cursor/plugins/blob/23e4138daa01c42d4969f7a5465f82704e64f798/pstack/skills/technical-writing/SKILL.md
[agents]: ../../AGENTS.md
[app-checks]: ../../fixtures/app/.postmaster/project.toml
[app-store]: ../../fixtures/app/src/store.ts
[contract]: ../../docs/coachman-contract.toml
[coachman]: ../../skills/postmaster/coachman.md
[postmaster]: ../../skills/postmaster/postmaster.md
[controls]: ../../skills/postmaster/controls.md
[harnesses]: ../../skills/postmaster/harnesses.md
[hosts]: ../../skills/postmaster/hosts.md
[ticket-template]: ../../skills/postmaster/ticket-template.md
[schema]: ../schema.md
[verification]: ../concepts/verification.md
[fixture-runs]: ../concepts/fixture-runs.md
[planning-stage]: ../concepts/planning-stage.md
[workhorse-spec]: ../concepts/workhorse-spec.md
[review-convergence]: ../concepts/review-convergence.md
[own-review-skills]: ../concepts/own-review-skills.md
[combining-models]: ../concepts/combining-models.md
[tool-faults]: ../concepts/tool-faults.md
[review-loop]: ../concepts/review-loop.md
[lane-confinement]: ../concepts/lane-confinement.md
[stage]: ../../scripts/stage.ts
[handoff-check]: ../../scripts/handoff-check.ts
[review-round]: ../../scripts/review-round.ts
[summary-evidence]: ../../scripts/summary-evidence.ts
[setup]: ../../scripts/setup.ts
[log-action]: ../../scripts/log-action.ts
[ticket-parts]: ../../scripts/ticket-parts.ts
[ticket-check]: ../../scripts/ticket-check.ts
[runs-status]: ../../scripts/runs-status.ts
[runs-watch]: ../../scripts/runs-watch.ts
[landing]: ../../scripts/landing.ts
[skill-refs]: ../../scripts/skill-refs.ts
[wiki-lint]: ../../scripts/wiki-lint.ts
[i19]: https://github.com/brindlewick/postmaster/issues/19
[i97]: https://github.com/brindlewick/postmaster/issues/97
[i99]: https://github.com/brindlewick/postmaster/issues/99
[i104]: https://github.com/brindlewick/postmaster/issues/104
[i133]: https://github.com/brindlewick/postmaster/issues/133
[i136]: https://github.com/brindlewick/postmaster/issues/136
[i137]: https://github.com/brindlewick/postmaster/issues/137
[i146]: https://github.com/brindlewick/postmaster/issues/146
[i171]: https://github.com/brindlewick/postmaster/issues/171
[i194]: https://github.com/brindlewick/postmaster/issues/194
[i198]: https://github.com/brindlewick/postmaster/issues/198
[i202]: https://github.com/brindlewick/postmaster/issues/202
[i218]: https://github.com/brindlewick/postmaster/issues/218
[i219]: https://github.com/brindlewick/postmaster/issues/219
[i221]: https://github.com/brindlewick/postmaster/issues/221
[i232]: https://github.com/brindlewick/postmaster/issues/232
[i233]: https://github.com/brindlewick/postmaster/issues/233
[i234]: https://github.com/brindlewick/postmaster/issues/234
[i238]: https://github.com/brindlewick/postmaster/issues/238
[i252]: https://github.com/brindlewick/postmaster/issues/252
[i255]: https://github.com/brindlewick/postmaster/issues/255
[i256]: https://github.com/brindlewick/postmaster/issues/256
[i257]: https://github.com/brindlewick/postmaster/issues/257
[i264]: https://github.com/brindlewick/postmaster/issues/264
[i265]: https://github.com/brindlewick/postmaster/issues/265
[p249]: https://github.com/brindlewick/postmaster/pull/249
[p250]: https://github.com/brindlewick/postmaster/pull/250
[p254]: https://github.com/brindlewick/postmaster/pull/254
