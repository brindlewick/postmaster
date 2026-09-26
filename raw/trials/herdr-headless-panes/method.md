---
kind: trial
subject: Herdr 0.9.1 and a headless claude 2.1.283 launch in a pane
date: 2026-09-26
---

# Method

**Question.** Can Herdr be the window onto a headless fleet as it stands, or does a host have to
do something for the view to be true? Five narrower questions: does a worktree opened under a
repository's space nest there; what state does Herdr give a headless harness left to itself;
does a state the host reports hold, and can it be ended; where does a harness's own Herdr
integration report; and does a headless harness title its pane?

**Setup.** Herdr 0.9.1 with its claude integration installed, and claude 2.1.283 on its
cheapest model. `probe.sh`, beside this file, is what was run, from inside a Herdr pane. It
makes a scratch repository with one worktree, opens the repository as a space and the worktree
under it with `herdr worktree open --workspace`, runs each step in a pane or tab of its own, and
closes both spaces at the end. It reads Herdr's view of a pane with `herdr pane get`, once a
second where a step watches over time. `probe-output.txt` is its output, with local paths, the
host name and the user name replaced.

**The steps, and the control each has.**

1. Nesting: the worktree's space as Herdr describes it, and whether the repository's space can
   be closed while the worktree's is open.
2. A headless `claude -p` in a pane, nothing reported: Herdr's state for the pane once a second
   while it runs, against the stream's own record that it was working.
3. A state reported by the host around a headless claude: `working` before, `idle` after it
   exits, `idle` again ten seconds later, then `pane release-agent`. The control is the same
   reports around `sleep`, a child that is not an agent.
4. A headless claude run outside any pane, with a pane's id in `HERDR_PANE_ID`: the pane's
   session before and after, against the session id in the run's own stream.
5. A pane that sets its own title, then runs `claude -p --name` with its output redirected: the
   pane's title once a second while it runs, and the escape bytes in the harness's streams.

**Not established here.** How codex, pi, grok or agy behave in a pane; the trial ran claude
only. Herdr's own reasons: the trial records what it does, not why.

**Repeating it.** Run `probe.sh` from a Herdr pane with claude on PATH and `herdr integration
install claude` done. It costs a handful of calls to the cheapest model. The findings are the
lines of `probe-output.txt`; space and pane ids and session ids differ from run to run.
