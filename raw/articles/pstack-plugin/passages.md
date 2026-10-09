# Passages

Quoted from the plugin at the url in `source.md`, at the commit named there, retrieved
2026-10-03. Only the passages the wiki relies on are kept. Nothing else is changed. Each
passage names its file, relative to the plugin's folder, and the part of the file.

> but personally, i don't believe in planning. the best spec is code.

`README.md`, why are there no planning skills?.

> it comes with twenty-three playbooks

`README.md`, usage, the twenty-three playbooks.

> twenty-four short skills, one principle each.

`README.md`, principles.

> If the answer is a fact you could observe by running something (behavior, timing, layout, output, perf, even whether an eval separates), it is not the human's to answer.

`skills/poteto-mode/SKILL.md`, Non-negotiables, the question filter.

> A step you choose not to do stays in the list with a one-line `skip: <reason>`.

`skills/poteto-mode/SKILL.md`, Playbooks.

> After a second miss, record a gap. A gap does not count as a pass.

`skills/swarm/SKILL.md`, Phase C: Aggregate.

> When N candidates converge on the same shape, that is a strong agreement signal.

`skills/arena/SKILL.md`, Phase E: Graft.

> When N candidates wildly diverge, Phase A was under-specified. Reframe and re-run rather than averaging the divergence.

`skills/arena/SKILL.md`, Phase E: Graft.

> Findings raised by 2+ models independently are highest signal.

`skills/interrogate/SKILL.md`, Step 4, Synthesize.

> The "Dismissed" section is not busywork. It's a trust mechanism.

`skills/interrogate/references/lead-judgment.md`, Verdict Calibration.

> You said so. Worthless on its own.

`skills/blast-radius/SKILL.md`, How sure are you.

> You ran it. A script or test that calls the real code and fails loud if you're wrong.

`skills/blast-radius/SKILL.md`, How sure are you.

> Run each side at least 5 times, and alternate the sides (A, B, A, B, and so on) so that warmup, lazy initialization, caches, and drift do not favor one side.

`skills/benchmark-checklist/SKILL.md`, The questions, 5.

> Append-only. A wrong call gets a new row that supersedes it. Never edit or delete history.

`skills/show-me-your-work/SKILL.md`, Rules.

> Before handing back, spawn a subagent on a different model family from the one that did the work. Self-review is not a substitute.

`skills/show-me-your-work/SKILL.md`, Cross-model review of the trail.

> Name the failing-before test or executable check and the failure it produced.

`skills/tdd/SKILL.md`, Final Response.

> Answer these from the codebase and only ask the user what you cannot observe:

`skills/create-verification-skill/SKILL.md`, 1. Interview the repo, not the user.

> A generated skill that was never executed is a draft, not a deliverable.

`skills/create-verification-skill/SKILL.md`, 4. Prove the generated skill before handing it over.

> Never kill by process name; kill what you started.

`skills/create-verification-skill/SKILL.md`, 2. Generate the skill, Cleanup.

> A feature map rots the moment the app changes.

`skills/maintain-verification-skill/SKILL.md`, opening.

> Only edit the verification skill's own directory

`skills/maintain-verification-skill/SKILL.md`, Edit scope.

> What happens if this runs twice? What happens if the previous run crashed halfway?

`skills/principle-make-operations-idempotent/SKILL.md`, opening.

> The check: before you keep a test, ask whether it would still pass if every function it imports returned `undefined`.

`skills/principle-test-behavior-not-implementation/SKILL.md`, opening.

> A measured number is a claim about a system.

`skills/principle-explain-the-number/SKILL.md`, opening.

> comes from the human. *Execution* should not block.

`skills/principle-never-block-on-the-human/SKILL.md`, Boundaries.

> Applying this principle produces a file.

`skills/principle-build-the-lever/SKILL.md`, Pattern.

> Textual instructions are easy to miss.

`skills/principle-encode-lessons-in-structure/SKILL.md`, Why.

> Do not start the next fix before the premise is written down and the census exists.

`skills/principle-attack-the-premise/SKILL.md`, Stop.

> Instructions and conventions are not concurrency control.

`skills/principle-separate-before-serializing-shared-state/SKILL.md`, opening.

> Treat temporary adapters as exceptional and time-boxed, not default architecture

`skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md`, Rule.

> Route verbose outputs, screenshots, and large documents to subagents.

`skills/principle-guard-the-context-window/SKILL.md`, Pattern.

> If a worker games the gate, reset and harden the contract. If the gate itself is wrong, fix the gate in its own change rather than routing around it.

`skills/figure-it-out/SKILL.md`, Phase C: Run the loop.

> One-offs are not learnings.

`skills/reflect/SKILL.md`, When to invoke.

> Never write a real slug you have not confirmed is available.

`skills/setup-pstack/SKILL.md`, 1. Detect available models.

> Avoid em dashes entirely.

`skills/unslop/SKILL.md`, Style, rule 13.

> Substituting `generalPurpose` skips that read and drifts.

`agents/poteto-agent.md`, description.

> Every spawn and every resume carries the standing orders verbatim.

`skills/poteto-mode/playbooks/orchestrate.md`, opening, three rules.

> Every file has exactly one writer.

`skills/poteto-mode/playbooks/orchestrate.md`, Store layout.

> `gates.md` parks human gates (question, options, default on no answer).

`skills/poteto-mode/playbooks/orchestrate.md`, Store layout.

> The pilot exists to falsify the brief template, the verify recipe, and the unit size while that costs one agent instead of fifty.

`skills/poteto-mode/playbooks/orchestrate.md`, Steps, 3. Pilot.

> A new head SHA voids the row, so re-verify after restack.

`skills/poteto-mode/playbooks/orchestrate.md`, Verification.

> Never resume an agent to check on it.

`skills/poteto-mode/playbooks/orchestrate.md`, Liveness and failure.

> Transcript mtime is not liveness.

`skills/poteto-mode/playbooks/orchestrate.md`, Liveness and failure.

> Retry by mode: cap-hit or oom, respawn with smaller scope. Network-drop, retry as-is. Tool-error, retry on a different model. Unknown, retry once. Two retries, then abandon the unit and replan around it.

`skills/poteto-mode/playbooks/orchestrate.md`, Liveness and failure.

> Count only side effects as progress: commits, pushes, PR or check deltas, and store reports.

`skills/poteto-mode/playbooks/autopilot-full.md`, step 6.

> Run the same load-bearing scenario on current trunk.

`skills/poteto-mode/playbooks/autopilot-full.md`, step 4.

> Record the verdict head SHA, base SHA, and stable `git patch-id` of that PR's base-to-head diff.

`skills/poteto-mode/playbooks/shipping.md`, step 3.

> Safe means a verdict from an agent that did not write the code.

`skills/poteto-mode/playbooks/shipping.md`, step 1.

> Stage the commits so the failing repro lands before the fix in git history.

`skills/poteto-mode/playbooks/bug-fix.md`, step 5.

> No `eval`, `test`, `judge`, `experiment`, `rubric`, `score`, `compare`, `benchmark`, `candidate`, or `arena` in any directory, file, or prompt the candidate sees.

`skills/poteto-mode/playbooks/eval.md`, Non-negotiables for blinding.

> Grade chain-following from the files it really read plus the shape of the code, never from the candidate's own claims.

`skills/poteto-mode/playbooks/eval.md`, step 6.

> The bucket is advice, not permission.

`skills/poteto-mode/playbooks/worktree-cleanup.md`, step 2.

> a duration is not a finish condition.

`docs/guide/07-overnight.md`, end of the page.

> The exact discriminating symptom must appear twice through real UI interaction.

`automations/benny/skills/reproduce-and-fix-issues/SKILL.md`, Hard safety rules.

> No confirmed repro means no authored fix.

`automations/benny/skills/reproduce-and-fix-issues/SKILL.md`, Hard safety rules.

> If the symptom does not appear twice on the baseline, there is no baseline. Do not claim that the fix works.

`automations/benny/skills/reproduce-and-fix-issues/references/verify-existing-fix.md`, Measure the baseline.

> Prefer no ticket over a guessed or duplicate ticket.

`automations/benny/skills/triage-issue-reports/SKILL.md`, Hard safety rules.

> Repro accepts the marker only from the configured triage identity.

`automations/benny/skills/setup-benny/SKILL.md`, 8. Test thread safety.
