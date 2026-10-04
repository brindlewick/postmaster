# Passages

Quoted from the file at the url in `source.md`, read with `git show` at the commit named there on 2026-10-04.
Each passage is the README's own text, with its line breaks joined, and names its section and lines.
Every passage was matched by string comparison against the file, so each is marked checked.

> Get one ticket implemented by several models at once, then judged before it lands.

opening line, line 3; checked

> Two or more models implement the same ticket **independently, in separate worktrees, unable to see each other's work**.

opening paragraph, lines 7-8; checked

> A coachman combines what each got right, puts the result through the adversarial review rounds its ticket names, then leaves a ship card for the project's landing route.

opening paragraph, lines 8-10; checked

> A check written once as a script runs the same way every time, instead of being worked out again by a model on every run, which saves tokens.

section Lean on the harnesses, lines 29-30; checked

> Because they disagree usefully. Across a sample of runs, the synthesis took contributions from **both** lanes every time: not "pick the winner", but one lane's mechanism plus the other's test, wiring or edge case.

section Why several models rather than one good one, lines 36-38; checked

> And a second lane finding the same defect independently is corroboration you can act on; a single lane agreeing with itself is not.

same section, lines 38-39; checked

> Disagreement is also diagnostic. When two lanes build the same mechanism and name it differently, the project's own conventions did not decide it, and the coachman records the gap as a proposed rule rather than flipping a coin the next run will flip again.

same section, lines 41-43; checked

> postmaster runs several side by side, so it is not locked into anyone's ecosystem. A lane is a harness plus a model, each harness sits behind an adapter, and nothing in the flow depends on one provider's tools.

same section, lines 47-49; checked

> **Nothing is reconstructed afterwards.** The narrative in `run-log.md` is for reading. Audits, and changes to the flow, work from the log.

section Logging, auditing and tracing, lines 65-66; checked

> **Claims trace to evidence.** The [wiki](wiki/index.md) gives every claim a standing and cites the recorded runs and trials behind it.

same section, lines 67-68; checked

> The claims above about combining models start there marked as claims, and the wiki grows one record at a time.

section Wiki, lines 89-90; checked

> The resume costs the tokens of reloading the thread, which prompt caching mostly absorbs, and it leaves the harness's own record as the durable one.

section Native sessions, lines 239-240; checked

> a bug review is the harness's own code-review skill, and a security review its own security-review skill.

section Lean on the harnesses, lines 24-26; checked

## Numbers from the GitHub API and git, 2026-10-04

`gh api repos/brindlewick/postmaster`, a plain read: stargazers_count 0, forks_count 1, watchers_count 0, created_at 2026-09-21T13:44:16Z, license null, description null, private false.
Releases: `gh api repos/brindlewick/postmaster/releases` returned no entries.
`git rev-list --count origin/main` at 8ea503d: 886 commits. `git ls-tree` of origin/main at that commit lists no LICENSE or COPYING file.

Numbers; checked (read from the API and from git directly, not through a fetch tool)
