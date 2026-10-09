# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> For changes you want to review before they touch disk, switch to plan mode. Claude reads files and proposes a plan but makes no edits until you approve.

common-workflows, section "Plan before editing"; checked (two fetches returned identical raw text)

> Letting Claude jump straight to coding can produce code that solves the wrong problem.

best-practices, section "Explore first, then plan, then code"; checked (two fetches, identical raw text)

> Press `Ctrl+G` to open the plan in your text editor for direct editing before Claude proceeds.

best-practices, step "Plan"; checked

> Switch out of plan mode by approving the plan or pressing `Shift+Tab`, then let Claude code, verifying against its plan.

best-practices, step "Implement"; checked

> Planning is most useful when you're uncertain about the approach, when the change modifies multiple files, or when you're unfamiliar with the code being modified. If you could describe the diff in one sentence, skip the plan.

best-practices, callout after the four steps; checked

> Once the spec is complete, start a fresh session to execute it.

best-practices, section "Let Claude interview you" (the page's prompt asks Claude to "write a complete spec to SPEC.md"); checked

> Time spent making the spec precise pays off more than time spent watching the implementation.

best-practices, section "Let Claude interview you" (a statement of the vendor; no number or study is given on the page); checked

> to have Claude split the change across 5 to 30 subagents. Each subagent works in its own worktree.

best-practices, section "Fan out across files" (after the `/batch` command); checked

> A fresh context improves code review since Claude won't be biased toward code it just wrote.

best-practices, section "Run multiple Claude sessions" (Writer/Reviewer pattern); checked

> experimental and disabled by default. Automated coordination of multiple sessions with shared tasks, messaging, and a team lead

best-practices, list entry "Agent teams"; checked

> A reviewer prompted to find gaps will usually report some, even when the work is sound, because that is what it was asked to do.

best-practices, section "Add an adversarial review step", callout; checked

> Anthropic has removed the Ultraplan research preview.

ultraplan page, first paragraph (the page lists the removed `/ultraplan` command, the `ultraplan` keyword and an option in the plan approval dialog); checked

No number, benchmark or study about plan quality was found on the three pages read.
