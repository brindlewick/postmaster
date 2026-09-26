---
kind: trial
subject: Herdr 0.9.1 agent lifecycle, against the flow's markers and resumes
date: 2026-09-26
---

# Method

**Question.** Issue #16, as opened, proposed running lanes as live agents in Herdr panes, with
Herdr's lifecycle states for completion detection and `agent prompt` for rulings. What does
Herdr actually offer for each of the four measures the issue named when it was opened, set
against what it documents, and how do its timings compare with the flow's own marker and resume
mechanism on the same harnesses?

**Versions.** Herdr 0.9.1 (stable channel, protocol 22), with the agent-detection manifests
it had cached on the day (versions in `integrations.txt`). pi 0.87.0. claude 2.1.283. The
flow's scripts at commit ad604e2.

**What Herdr documents.** Taken from the installed binary: `herdr --skill`, the help of each
command group, `herdr api schema` and `herdr --default-config`. The statements tested:

- `agent start` returns once the agent is ready, and returns `agent_not_ready` if it is blocked
  during startup.
- `agent prompt --wait` must observe `working` or `blocked` within five seconds of submission,
  or it returns `agent_prompt_stalled`; after that it waits for the first settled state:
  `idle`, `done` or `blocked`.
- "Without --until, standalone `agent wait` uses the same settled-state defaults."
- "`idle` and `done` both mean the agent is ready for input."
- A live agent's name "is cleared when that agent exits".
- `events.subscribe` pushes `pane.agent_status_changed` for a pane.
- "A timeout or stalled response does not prove the prompt was never delivered; do not
  blindly submit it again."
- `agent prompt --wait` "does not track turns: if the agent is already working, that active
  turn's completion may match" (`herdr agent prompt --help`).
- `agent.prompt` takes a target, the text and the wait options; nothing in it names who sent
  the prompt (`herdr api schema`).
- Integrations report state or session references over the socket (`pane.report_agent`,
  `pane.report_agent_session`).

**Setup.** A stand-in model provider on the loopback interface (`apparatus/standin.py`) answers
OpenAI chat completions for pi and Anthropic messages for claude, streamed, with a fixed
reply. For every request whose reply it finishes writing, it logs when the request arrived
and when the reply finished, and it never logs headers. A request whose client goes away first
is not logged at all, which is why the killed turns have no line.
Knobs in the prompt text hold the reply (`SLEEP=<s>`), pad it (`PAD=<KB>`), or answer with
shell tool calls running `sleep` (`TOOL=<s>x<n>`). A stand-in makes the timings exact: the
reply's finishing time is the moment the lane finished, as the model side saw it. The
stand-in was restarted once, before the multi-step checks, to add the `TOOL` knob, so lines
before then have no `tool_call` key. The committed `standin.py` is the later version; without
`TOOL` it answers as the earlier one did.

Every harness ran on an isolated config except the first claude start, which used the
machine's own config and exited at claude's trust question without accepting it. Nothing in
the machine's own harness setup changed. pi ran through `PI_CODING_AGENT_DIR`, with a `models.json` registering the stand-in; claude through
`CLAUDE_CONFIG_DIR`, with the trial's directories already trusted, and `ANTHROPIC_BASE_URL` and
`ANTHROPIC_AUTH_TOKEN` pointing at the stand-in. The flow's own `scripts/launch.sh` drove the
headless forms, from a scratch config naming one lane per harness.

Every live agent was started by the trial, with `herdr agent start`, in a tab the trial created
in the machine's running Herdr session, and was removed with it afterwards. Three panes:
pane-a held pi on screen rules (named `t16-pi`); pane-b held pi with Herdr's own pi integration
loaded from a file with `-e` rather than installed (`t16-pix`); pane-c held claude (`t16-cl`).
Herdr puts the session's socket path in every pane's environment (`HERDR_SOCKET_PATH`), and
every command was issued through it from another pane of the same session, with nothing asked
of the caller. `apparatus/events.py` recorded the pushed events from a subscription.

**The comparison.** One turn at a time, five turns per variant, with the reply held 3, 7, 11,
16 and 23 s, recorded per turn by `apparatus/bench.py`:

- live: `herdr agent prompt <agent> <text> --wait`. Delivered is when the request reached the
  stand-in; detected is when the wait returned. Variants: pi on screen rules, pi with its
  integration, claude on screen rules.
- marker: `scripts/launch.sh resume` inside the coachman's own wrapper, which touches a marker
  on exit, followed in the same command by `scripts/wait-for-markers.sh`, exactly as
  `coachman.md` writes them. Delivered and detected as above. Variants: pi and claude.

Then three turns per variant with sessions grown to about 4 MB by four 1 MB replies: pi live
with its integration, and pi and claude by resume.

**Further checks, same session.**

- Stale wait: `agent prompt` without `--wait`, then a separate `agent wait`, three times on
  each pi variant, with the reply held 6 s (`stale-wait.txt`). After each try, once the stale
  wait had returned, a prompt "noop" was sent while the held turn was still running, which pi
  queued and ran next, and two waits (until `working`, then settled) brought the agent back to
  rest before the next try.
- Kill mid-turn: pi sent SIGTERM about four seconds into a turn held 30 s, three times: under
  a separate wait on pi with screen rules, and under `agent prompt --wait` on each pi variant
  (`kill-mid-turn.txt`). Only pi was killed; claude was not.
- A turn of three tool calls and a closing reply on each agent (`multistep.txt`).
- A 20,498-byte, 282-line prompt to pi with its integration and to claude. The sha256 of the
  text sent was compared with that of the user message each harness recorded in its own
  session, and the hashes are kept here; the session files are not (`long-prompt.txt`).
- Startup outcomes, including claude in a directory its config had not seen (`startup.txt`).
- Idle cost: the process tree under each idle agent's pid, read from `/proc` over 30 to 60 s
  (`apparatus/idle.py`, `idle-cost.txt`), beside the size of the native session files.
- Where each state comes from, per harness: the text of every integration embedded in the
  herdr binary, and the rules in each cached manifest (`integrations.txt`).

**Recorded here.** `apparatus/checks.sh`, the commands the trial ran for everything but the
timed turns, in the order it ran them. `timings/*.jsonl`, one line per turn, as `bench.py`
wrote them: `pi-live`
is pi on screen rules, `pix-live` pi with its integration, `cl-live` claude, `pi-marker` and
`cl-marker` the headless forms, and `-big` the grown sessions.
`standin-requests.jsonl`, every request the stand-in answered. `herdr-events.jsonl`, the pushed
events for the three panes, reduced to time, event, pane, agent, state and release fields, with
working directories and terminal details removed. The text files named above.

**Not established here.** Anything about a real model, a real provider, or a real lane turn,
which runs for minutes and makes many tool calls. How often runs end spent or need a remount,
which needs runs. What happens across a Herdr server restart, including
`resume_agents_on_restore`, since the server was not restarted. codex, grok, agy and muse as
live agents: only their integrations and manifests were read. The Herdr server's own memory
per pane. Whether headless `claude -p` asks claude's trust question in a directory its config
has not seen: every headless run here used a config that already trusted its directory. The
timings come from one machine that had other agents running on it.

**Repeating it.** `apparatus/checks.sh` holds each step as a function, from `isolate`, which
writes the isolated configs and starts the stand-in, to `long_prompt`, in the order the trial
ran them. The timed turns are `bench.py live <agent> <out> 3,7,11,16,23` and
`bench.py marker <lane> <cwd> <thread-id> <out> 3,7,11,16,23`, with `STANDIN_LOG`, `TOOL` and,
for marker, `POSTMASTER_CONFIG` set. `bench.py`'s `--separate-wait` was not used. Any stand-in
that logs when a request arrives and when its reply finishes will do, and one that logs
arrival at once would also record the killed turns.
