---
title: Herdr reads most agents' state from the screen, and a settled state is not a finished turn
type: concept
standing: settled
sources: [trials/herdr-agent-lifecycle]
updated: 2026-09-26
---

# Herdr reads most agents' state from the screen, and a settled state is not a finished turn

**Claim.** In Herdr 0.9.1, the lifecycle state of a claude, codex, grok, agy or muse agent is
inferred from its screen, and pi's is reported by pi itself only when Herdr's pi integration
is loaded. A settled state from `agent wait` or `agent prompt --wait` means the agent looked
ready for input. It does not mean the turn it was given has finished: an agent killed
mid-turn is reported `done`, and a wait issued after a prompt can return the previous turn's
state.

**Standing: settled**, for Herdr 0.9.1 with the detection manifests it had cached on
2026-09-26, by a controlled trial against a stand-in model [@trials/herdr-agent-lifecycle].
Each finding below was reproduced, and the documented usage that should have avoided it was
tried.

## Where each state comes from

An integration is the hook or extension that `herdr integration install` writes into a
harness's own config. Most report only a session reference, which Herdr uses to resume a pane
into its native session after a server restart. The state comes from screen rules: a manifest
per harness, matching the terminal title or a region of the screen
[@trials/herdr-agent-lifecycle/integrations.txt].

| harness | its integration reports | the state comes from |
|---|---|---|
| claude, codex, grok, agy | a session reference, at session start | screen rules |
| pi | working, idle and blocked, from pi's own events, in the interactive UI only | the integration when loaded, screen rules otherwise |
| muse | no integration | screen rules |

pi's screen rules only recognise `working`, so a pi without its integration is `idle`
whenever it is not visibly working, and is never reported `blocked`. With the integration
loaded, Herdr stops reading pi's screen for that pane
[@trials/herdr-agent-lifecycle/integrations.txt].

Screen rules change without a Herdr upgrade. By default Herdr fetches the manifests from
herdr.dev in the background, and the codex manifest in use on the day had been published three
days earlier [@trials/herdr-agent-lifecycle/integrations.txt]. A measurement that depends on
detection has to record the manifest versions it ran with.

## Documented against observed

| Herdr documents | the trial saw |
|---|---|
| `agent prompt --wait` waits for observed activity, then for the first settled state | Held `working` through a turn of three tool calls on every agent, and settled 0.5 to 0.7 s after the final reply [@trials/herdr-agent-lifecycle/multistep.txt]. |
| A standalone `agent wait` uses the same settled-state defaults | Issued straight after a prompt, it returned within 40 to 140 ms with the previous turn's `idle` or `done`, before the reply existed, in 6 of 6 tries [@trials/herdr-agent-lifecycle/stale-wait.txt]. Only `agent prompt --wait` has the activity gate. |
| `idle` and `done` both mean ready for input; an agent's name is cleared when it exits | An agent killed mid-turn was reported `done`. Under `agent prompt --wait` the waiter got exit 0 and `done` about 0.4 s after the kill, with and without pi's integration. Herdr's own release event followed within 0.1 s and also gave the final status as `done`, and `agent get` then found no agent by that name [@trials/herdr-agent-lifecycle/kill-mid-turn.txt]. |
| No observed activity within five seconds returns `agent_prompt_stalled` | Returned for two turns that had run and finished: a pi turn on screen rules whose reply came back at once, and a claude turn given a 20 KB prompt [@trials/herdr-agent-lifecycle/false-stall.txt]. |
| `agent start` returns `agent_not_ready` for an agent blocked during startup | claude, started in a directory its config had not seen, stopped at its workspace trust question, even with `--dangerously-skip-permissions`. Headless `claude -p` never asks it [@trials/herdr-agent-lifecycle/startup.txt]. |
| `agent prompt` sends the text and Enter as one submission, with bracketed paste | A 20,498-byte prompt of 282 lines reached pi and claude as one message, identical to what was sent [@trials/herdr-agent-lifecycle/long-prompt.txt]. |
| `events.subscribe` pushes `pane.agent_status_changed` | Every state change arrived as a pushed event, and so did the release of each killed agent [@trials/herdr-agent-lifecycle/herdr-events.jsonl]. |

Herdr's control commands accept any caller holding the session's socket, which Herdr puts in
every pane's environment. In the trial every agent was prompted from another pane of the same
session, and nothing checked who sent the prompt [@trials/herdr-agent-lifecycle/method.md].

## What a live agent costs, and how fast it answers

Against a stand-in model on the loopback interface, one machine
[@trials/herdr-agent-lifecycle/timings]:

- From `agent prompt` to the request reaching the model: 325 to 521 ms with a small session,
  and 635 to 674 ms for pi holding a 4.2 MB session.
- From the model's final reply to `agent prompt --wait` returning: 454 to 771 ms for pi on
  screen rules, 86 to 304 ms for pi with its integration, 143 to 614 ms for claude.
- Idle, after a turn: one process per agent. pi held 98 to 108 MiB of proportional memory
  with a small session and 142 MiB with a 4.2 MB one. claude held 155 MiB and three
  established connections to external hosts, although its model was on the loopback
  interface. None used more than 1.5 s of CPU per idle minute
  [@trials/herdr-agent-lifecycle/idle-cost.txt].

## What it means for anything that waits on Herdr

- The safe wait is `agent prompt --wait`, one per agent. A prompt followed by a separate
  `agent wait` can return before the new turn has started.
- A settled state needs checking before it is believed: that the agent still exists, that
  no release event came for it, and that whatever it was meant to leave on disk is there.
  The flow's markers already work this way. A marker says only that a process exited, and
  the coachman reads what was left.
- `agent_prompt_stalled` is not proof that nothing ran. The harness's own session record
  says what did. Herdr's documentation says the same about a stall or a timeout
  [@trials/herdr-agent-lifecycle/method.md].
- A live agent can meet interactive questions that a headless one never sees, such as
  claude's trust question for a new directory.

## Where it bears

[Live agents against markers and resumes](live-agents.md), issue #16, rests on these facts.
They also bear on issue #10, whose host adapter sends the interactive postmaster a message and
waits for it to settle: that wait has to be `agent prompt --wait`, for the reason in the
second row above.

## What would overturn it

A Herdr version or manifest in which these integrations report state, a standalone
`agent wait` waits for new activity, or the waiter of a released agent is told something other
than `done`. Any of these is a change of version, not a refutation of this page: the page then
says which version it describes, and the trial's method repeats against the new one.
