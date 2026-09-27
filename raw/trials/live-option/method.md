---
kind: trial
subject: The live option of issue #67 on Herdr 0.9.1, and six facts building it turned on
date: 2026-09-27
---

# Method

**Question.** Does the live option behave as issue #67's acceptance criteria say, on a running
Herdr server with real harnesses? And six facts the build turned on, which the trial of the
same week, `herdr-agent-lifecycle`, did not cover: how claude's trust question treats a git
worktree, where claude keeps a long path's session record, what claude does when it inherits a
claude session's variables, when Herdr will start an agent in a pane, where Herdr's
integration commands look for a harness's config, and how claude saves its config.

**Versions.** Herdr 0.9.1, pi 0.87.0, claude 2.1.283. Herdr's pi integration v9 and claude
integration v10.

**Setup.** As in `herdr-agent-lifecycle`: a stand-in model provider on the loopback interface,
pi and claude on scratch configs, and agents in spaces the checks opened in the machine's running
Herdr session and closed afterwards. The stand-in is the one `scripts/live.sh` carries; beside a
reply held with `SLEEP=<s>`, `RUN=<command>` in a prompt has the harness run that command with its
own shell tool, so a lane can write its final act. The integrations were installed into the
scratch configs by `herdr integration install`, with `PI_CODING_AGENT_DIR` and
`CLAUDE_CONFIG_DIR` set, and nowhere else. No tokens were spent, and no config of the machine's
own harnesses changed; the live test checks the second.

**The controls.** `scripts/live.sh --live-test`, at the commit that adds it. Its output, run
twice with the same result, is `live-test.txt`. Earlier runs failed controls, each fixed in the
same change: fourteen with every live start refused as busy (probe 4); five with claude's
session records missing (probe 3); and one where Herdr saw no start of an instant claude turn,
which the record showed had run, and the lane was recorded lost with the cause "ran" rather than
"settled without its final act".

**The probes.** By hand, one at a time, with the stand-in and the scratch configs; what each
showed is in `probes.txt`, with the scratch paths written as `<scratch>`.

1. claude in a linked git worktree, when a folder above the repository was trusted in its config
   and the repository was not; then with the repository trusted.
2. The folder claude keeps a session record in, for a working directory of 143 characters and one
   of 222.
3. claude started in a pane whose shell exported the variables a claude session exports to its
   own tool calls, with made-up values; then the same start without them.
4. `herdr agent start` in a pane whose shell had been replaced, by exec, with `bash --noprofile
   --norc -i`: through a script and Python's `execvpe`, with the pane's environment and with a
   minimal one; and the same with a process substitution on the script's exec.
5. `herdr integration status` and `herdr integration install` with each harness's config dir set
   to a scratch directory.
6. How claude saves its config file, read from its executable, and the race a writer that skips
   claude's lock loses, run by `scripts/launch.sh --self-test`.

**Not established here.** codex, grok and agy as live agents: their forms are from their help
and the headless forms, not run. A real model, a real turn of many minutes, or a whole run: the
fixture run of issue #67's sixth criterion waits on issue #37's fixture.
