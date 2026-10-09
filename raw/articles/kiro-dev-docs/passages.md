# Passages

Quoted from the page at the url in `source.md`, retrieved 2026-10-04, read through a fetch tool that
returns the page as text. Only the passages the report relies on are kept. Each passage names
its section, table or page.

> Instead of approving each phase before the next begins, you answer clarifying questions up front and land directly on an actionable task list.

https://kiro.dev/docs/specs/quick-spec/, opening paragraph; checked

> Quick Spec runs all three phases automatically without approval gates between them.

https://kiro.dev/docs/specs/feature-specs/ (part of a longer sentence that begins "For well-understood features where you trust Kiro's output,"); checked

> Use standard Feature Specs when you're exploring unfamiliar territory, when requirements need iteration, or when the review gates genuinely add value for your team.

https://kiro.dev/docs/specs/quick-spec/, "when to use" section; not checked

> Plan mode intentionally cannot modify your project.

https://kiro.dev/docs/specs/plan/; checked

> Once you approve the plan, execution begins automatically

https://kiro.dev/docs/specs/plan/; checked

> In classic mode, you are prompted to confirm the handoff before execution begins.

https://kiro.dev/docs/specs/plan/ (the same page says automatic plan execution needs the v3 engine in the CLI); not checked

> Up to 3 concurrent task runs are allowed

https://kiro.dev/docs/crew/features/task-runner/; checked

> Each step passes through an independent reviewer using a separate session

https://kiro.dev/docs/crew/features/task-runner/ (the page continues with a task-id label for the review session); checked

> Hand the Task Runner a spec in markdown and it decomposes it into ordered steps, runs each one in its own session, tests the result, retries on failure, and checkpoints progress.

https://kiro.dev/docs/crew/features/task-runner/, first paragraph; not checked

> A workflow is an authored Python script that orchestrates many agents through explicit stages, running them in parallel, chaining their output, and checking results before moving on.

https://kiro.dev/docs/crew/features/workflows/, first paragraph; checked

> Each stage can fan out to subagents, wait for their results, and pass a synthesized output to the next stage.

https://kiro.dev/docs/crew/features/workflows/; not checked (a second fetch returned a different sentence for the fan-out pattern)

> Independent code reviewers then run in parallel.

https://kiro.dev/blog/introducing-workflows/ (post dated 2026-09-30 on the blog index), description of the bundled feature-pipeline recipe; checked

> Today, we're introducing Kiro workflows, allowing you to carry out complex tasks from start to finish with multiple agents and less supervision.

https://kiro.dev/blog/introducing-workflows/, opening paragraph; not checked

Also on that post (one fetch each, not checked, kept as notes and not as quotes): a YAML recipe whose loop is capped at max-iterations 3 and ends "until: verdict.json says APPROVED", with two parallel steps both using the agent "reviewer" and an "aggregate" step that merges both reviews; a table that names claude-opus-5.5 and gpt-5.6-sol (one fetch said these are the two reviewers' models; another said only that the table names them).

> Kiro turns your prompts into requirements, architectural designs, and sequenced tasks, then implements them with parallel agents.

https://kiro.dev/ (home page; the page links "requirements, architectural designs, and sequenced tasks" to /docs/specs/ and "parallel agents" to /docs/chat/subagents/); checked

> Anthropic Claude, OpenAI GPT, open-weight models like DeepSeek and Qwen

https://kiro.dev/ (home page, list of supported models); checked

> Last week, the three of us building Kiro Crew full time merged 1,000 pull requests in seven days. Over 120 a day, every one went through CI and review.

https://kiro.dev/blog/software-factory-1000-prs/ (post dated 2026-09-18 on the blog index); not checked

Adoption: no number of users or developers was found on the pages read (two fetches of the home page gave none; the blog index gave none).
