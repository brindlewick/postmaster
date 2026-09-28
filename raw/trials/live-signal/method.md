---
kind: trial
subject: Live agents on codex, muse and MiMo Code with no Herdr integration, on Herdr 0.9.1
date: 2026-09-28
---

# Method

**Question.** Can a harness whose Herdr integration reports nothing still run as a live agent,
the lane signalling its own finish with a file and its thread read from the harness's own
records? For each harness on the fleet's own team with no integration in use, codex, muse and
MiMo Code: how Herdr starts it, when it takes input, how a prompt reaches it, what it asks before
it runs, where it keeps its thread and how that record shows a turn's end, and how it ends.

**Versions.** Herdr 0.9.1, codex-cli 0.157.1, MiMo Code 0.1.15, Muse Code 1.4.0 (1.4.0-R4302.1),
and for the live test's other lanes pi 0.87.0 and claude 2.1.283.

**Setup.** As in `live-option`: the stand-in model `scripts/live.sh` carries, on the loopback
interface, and agents in spaces the checks opened in the machine's running Herdr session and
closed afterwards. codex ran on the stand-in's Responses API from a scratch `CODEX_HOME`; MiMo
Code on its chat completions API, from scratch XDG directories; muse on its own echo provider,
since its Meta provider speaks a stream of its own that the stand-in does not (probe 8). No
integration was installed for any of the three, no tokens were spent, and no config or data
directory of the machine's own harnesses changed; the live test checks the second.

**The controls.** `scripts/live.sh --live-test`, at the commit that adds these lanes. Its output
is `live-test.txt`.

**The probes.** By hand, one at a time; what each showed is in `probes.txt`, with scratch paths
written as `<scratch>`.

1. A custom agent report, a name and a prompt, for a pane Herdr has no agent kind for.
2. MiMo Code's bypass flag on a terminal, and its variable instead; its code read from its
   executable.
3. When MiMo Code's interface takes input, and a pasted prompt of two lines.
4. Where MiMo Code's interface takes its variant: a flag, its agent config, its state.
5. MiMo Code's session list and export.
6. MiMo Code's processes, and what a TERM to their process group leaves.
7. codex's interactive form under Herdr: trust in a git worktree, its rollout, a resume.
8. Muse Code started as Herdr's muse kind: what Herdr detects, what muse's own plugin reports,
   its record, and what its providers accept.

**Not established here.** A real model, a real turn of many minutes, or a whole run: that is issue
#67's sixth criterion, a scored run on issue #37's fixture. A muse tool call under the flow: the
echo provider runs no command, so a live muse lane's finish file, and a muse leg's hand-off, are
checked only against the stub harness of `scripts/live.sh --self-test`. codex with Herdr's codex
integration installed: a live codex lane runs on its own signal whether it is installed or not.
