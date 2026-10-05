# Passages

Quoted from the plugin at the url in `source.md`, at the commit named there, retrieved
2026-10-05. Only the passages the wiki relies on are kept. Nothing else is changed. Each
passage names its file, relative to the plugin's folder, and the part of the file. Every passage
was read twice and the two reads agree word for word. For a file the commits changed, the reads are the comparison of
`23e4138` with `e43c7ee` and the file at `e43c7ee`; for the two files quoted that they did not change, the principle on
test shapes and the maintain-verification skill, they are two reads of the file at `e43c7ee`.

> Find the mistakes agents keep repeating in this repo and make each one impossible.

`skills/correct/SKILL.md`, description.

> Try architecture first, then types, then a lint whose error names the fix, then a test, and write docs last.

`skills/correct/SKILL.md`, description.

> A class counts once it has happened twice.

`skills/correct/SKILL.md`, Find the mistake classes.

> Write docs or agent rules last, only for judgment calls. Nothing fails when an agent skips them.

`skills/correct/SKILL.md`, Fix each class at the highest level that works, step 4.

> Fix or delete any test that would still pass if every function it calls returned nothing.

`skills/correct/SKILL.md`, Fix each class at the highest level that works, step 3.

> Prove each new check fails on a real past mistake.

`skills/correct/SKILL.md`, Fix and prove.

> Exceptions go on the offending line with a reason, an expiry date, and a human's approval.

`skills/correct/SKILL.md`, Fix and prove.

> keep a table in the agent instruction file that pairs each rule with what enforces it.

`skills/correct/SKILL.md`, Keep the rule table.

> If the rule was already there and nothing enforces it, that's a repeat, so fix it at the highest level in the same change.

`skills/correct/SKILL.md`, Keep the rule table.

> Replace hand-synced lists with one source of truth.

`skills/correct/SKILL.md`, Fix each class at the highest level that works, step 1.

> you keep correcting agents for the same mistakes.

`README.md`, the table of skills, the `/correct` row.

> Assume the next contributor is an agent that sees only the files it opened, copies the nearest example, and takes the shortest path that compiles.

`skills/architect/SKILL.md`, the paragraph that begins "Screen every candidate".

> More than one module writes the same state or keeps its own copy of it.

`skills/architect/references/design-red-flags.md`, Split ownership.

> The design supports more than one way to do the same task.

`skills/architect/references/design-red-flags.md`, Two ways to do one task.

> A caller can import a module's internals.

`skills/architect/references/design-red-flags.md`, Importable internals.

> Two or more places list the same items, and adding an item means editing every list.

`skills/architect/references/design-red-flags.md`, Hand-synced list.

> Keep one list and derive the others from it. If a list can't be derived, make the build fail when the lists disagree.

`skills/architect/references/design-red-flags.md`, Hand-synced list.

> Try the performance mantras in order, cheapest first:

`skills/poteto-mode/playbooks/perf-issue.md`, step 2.

> Don't do it. Stop work whose result nothing uses rather than cheapening it.

`skills/poteto-mode/playbooks/perf-issue.md`, step 2, mantra 1.

> When an earlier mantra meets the target, stop.

`skills/poteto-mode/playbooks/perf-issue.md`, step 2.

> "version": "0.15.9",

`.cursor-plugin/plugin.json`.

> The **Perf issue** playbook finds and fixes slowness, and the performance mantras in its step 2 generate the fixes.

`skills/benchmark-checklist/SKILL.md`, How this fits the other perf material. This is the one line of that file the
commit changed. The line the first report quoted from the file is in The questions, 5.

> Five shapes that still pass when every imported function returns `undefined`:

`skills/principle-test-behavior-not-implementation/SKILL.md`, the line after Why. The file did not change in the three commits. The five
shapes are named there, in this order: "Weak or no assertion.", "Mock or absence only.", "Self-referential.", "Constant pin." and
"Fixture asserts fixture."

> One read-only subagent per feature file, launched concurrently.

`skills/maintain-verification-skill/SKILL.md`, Pass, 2. Source wave. The file did not change in the three commits.

> Live pass. Required even when source looks clean.

`skills/maintain-verification-skill/SKILL.md`, Pass, 4.

> a product regression (report it, don't paper over it in docs)

`skills/maintain-verification-skill/SKILL.md`, Edit scope. The full sentence says a behavior the map describes that the app no
longer does is either doc drift, to fix in the map, or this.

> Most fixes come from eight strategy families.

`skills/poteto-mode/playbooks/perf-issue.md`, step 2, as it stood at `23e4138`: the text the third commit replaced. It was read twice,
in the file at `23e4138` and as the removed line of the comparison with `e43c7ee`, and the two reads agree word for word.
