# Workhorse spec: #200 Run every lane in its own process space, so it cannot kill processes it did not start

(Started from the coachman's unified spec, per the user's one-spec ruling on 2026-10-01: both lanes implement from this one spec, in blinkers as before. Rewritten with the user on 2026-10-02: the confinement is for crash prevention, not isolation; it must work on Linux and macOS; and the run is re-dispatched on current main, which has the TypeScript port from #109. Isolation of files, network and sockets is a separate ticket.)

## Summary

With `confine = "on"`, [`scripts/launch.sh`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/launch.sh) starts every lane's harness in a process space of its own, so the lane cannot signal, and so cannot kill, any process it did not start; nothing else changes for the lane. The mechanism is the system's own, looked up in one table: Bubblewrap's process namespace on Linux, a Seatbelt profile on macOS.

## Technical context

- **Language and version**: TypeScript run by Bun, on current main.
- **Dependencies used or added**: none added to [`package.json`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/package.json). Bubblewrap on Linux and `sandbox-exec` on macOS are system programs, used at whatever version is installed.
- **Testing**: [`bun test scripts/launch.test.ts`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/launch.test.ts) (the confinement battery, with paired controls); `bun test` on the new and changed test files; the full project gate, `bun run check`; a real confined harness task against a [`fixture.sh new`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/fixture.sh) app. Per-criterion checks are under Checks below.
- **Constraints**: bypass flags untouched; the launch path names no operating system; absent `confine` means off; a lane whose confinement cannot start runs unconfined and says so; files, network and sockets stay as they are today; [`setup.sh`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/setup.sh) and [`config.example.toml`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/config.example.toml) are #201's; no wiki/`raw/` reads; work in blinkers.

## Direction check

| Constraint (ticket direction and project rules) | How this plan meets it |
| --- | --- |
| Crash prevention, not isolation (the user's word, 2026-10-02) | A lane gets a process space of its own and nothing else. Files, network and sockets are untouched; a separate ticket isolates them. |
| Works on Linux and macOS (a hard rule for this project) | One table maps each system to its mechanism: on Linux, Bubblewrap with a new process namespace over the filesystem as it is; on macOS, `sandbox-exec` with a profile that allows everything except signals to processes outside the sandbox. A system with no row runs the lane unconfined, with the warning. |
| Wrap from the outside at the point [`launch.sh`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/launch.sh) runs it | [`launch.ts`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/launch.ts) builds the existing harness command, then one wrap step puts the system's form around it for a lane. Launch, resume and review share it. |
| Bypass mode stays on, one mechanism for every harness | The wrap sits outside the harness's form and is the same for every harness. |
| Pin the research preview | Dropped with criterion 8, by the user's word (2026-10-01); no version is pinned or recorded. |
| Deterministic work in scripts, system facts in an adapter | The table, the start check and the wrap are TypeScript with tests; [`harnesses.md`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/skills/postmaster/harnesses.md) documents the table. |
| A prompt lives in argv | Unchanged. |
| Every count needs a control | Every battery item runs unconfined and confined. |
| TypeScript rule | Main already has the TypeScript port from #109; every change is made in the TypeScript, with tests beside it, and in the two runbooks. |

## Structure

Work on current main; copy nothing. Add `scripts/lib/confine.ts` and `scripts/lib/confine.test.ts` (the table of systems, the start check and the wrap); change [`scripts/launch.ts`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/launch.ts) (read `confine`, wrap lane spawns, fall back when the confinement cannot start) and [`scripts/launch.test.ts`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/launch.test.ts) (the confinement battery), [`scripts/run-meta.ts`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/run-meta.ts) (record the confinement mode) with its tests beside it, [`skills/postmaster/harnesses.md`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/skills/postmaster/harnesses.md) (a Confinement section with the table) and [`skills/postmaster/coachman.md`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/skills/postmaster/coachman.md) (Lane capability).

## Complexity tracking

| Departure | Why needed | Simpler alternative rejected because |
| --- | --- | --- |
| Coachman and postmaster launches stay unconfined | The coachman watches and stops lanes by pid | A process space of its own would hide the lanes it must watch |
| The battery skips by name when the confinement cannot start, exit 0 | The gate must stay green on machines without Bubblewrap, and inside a confined lane on a system that cannot start one confinement inside another | Requiring it would redden those gates; the coachman's gate is unconfined and runs the battery for real |
| A lane can still stop things through a socket, such as `tmux kill-server` or `systemctl --user` | Blocking sockets is isolation, which the user moved to a separate ticket | Blocking them here brings back the allow-lists this ticket dropped |

## Decisions

1. **What is confined.** A launch, resume or review whose name is a lane in the effective `[lanes]` table. Coachman, fallback and postmaster are not.
2. **The table.** One row per system, kept in `scripts/lib/confine.ts` and documented in [`harnesses.md`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/skills/postmaster/harnesses.md): Linux runs Bubblewrap with a new process namespace and a fresh `/proc` over the filesystem as it is; macOS runs `sandbox-exec` with a profile that allows everything except signals to processes outside the sandbox, as sandbox-runtime's own profile does. [`launch.ts`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/launch.ts) names no system. The macOS row is untested here, since no Mac is available; the macOS trial in #205 checks it.
3. **The wrap.** One step puts the system's form around the harness command. The harness argv inside is byte-identical to the off run, bypass flag included. `form` prints the wrapped command when on and the bare form when off. Exit codes pass through, and a lane stopped with SIGTERM or SIGINT ends the launch by that signal, as it does unconfined.
4. **When the confinement cannot start.** With `confine` on, the launch first starts the confinement with a no-op command. If that fails (no Bubblewrap, Bubblewrap refused as on Ubuntu 24.04 without its AppArmor rule, or a system with no row), the lane runs unconfined, exactly as with `confine` off, by the user's word (2026-10-02). The launch says so on stderr, naming the cause, and logs the fallback as an action, so the run's record shows which lanes ran unconfined.
5. **What `run.json` records.** `run-meta` writes at dispatch `"confinement": {"mode": "on"|"off"}`. Mode disagreeing with recorded `config.confine` fails; a run without the object is accepted only when its config resolves to off.
6. **The battery inside a confined lane.** Bubblewrap starts inside itself, so on Linux the battery runs in a confined lane too. Where the confinement cannot start inside itself, the battery in [`scripts/launch.test.ts`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/launch.test.ts) names each confinement item `skipped (inside a confinement)` and passes; the coachman's gate is not confined and runs it for real. A ticket that changes the confinement itself runs with `confine` off (the user's word, 2026-10-02).
7. **Docs.** [`harnesses.md`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/skills/postmaster/harnesses.md) gains a Confinement section with the table. [`coachman.md`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/skills/postmaster/coachman.md) Lane capability says lanes run in a process space of their own and cannot signal processes they did not start, and that the worktree is still what keeps their writes apart. Neither restates wiki reasoning.
8. **Fixture (AC9).** The lane runs [`fixture.sh new`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/fixture.sh) plus a real confined harness task; the dispatched, scored fixture run is the coachman/postmaster's from the branch, per the merge rule.

## Tasks

- [ ] T001 [P] [AC1] Start from current main and confirm `bun run check` is green before any change.
- [ ] T002 [AC1] [AC3] Add `scripts/lib/confine.ts` and `scripts/lib/confine.test.ts`: the table of systems, the no-op start check and the wrap.
- [ ] T003 [AC1] [AC7] Wire [`launch.ts`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/launch.ts): wrap lane launch, resume and review when on, keep the harness form byte-identical, and when the confinement cannot start run the lane unconfined, naming the cause and logging the fallback.
- [ ] T004 [AC7] Extend [`run-meta.ts`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/run-meta.ts) with the `confinement` object.
- [ ] T005 [AC2] [AC3] [AC6] Extend [`launch.test.ts`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/launch.test.ts) with the plain-shell battery: every AC2 and AC3 item unconfined and confined, with paired controls; loud skip by name when the confinement cannot start.
- [ ] T006 [AC9] Run [`fixture.sh new`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/fixture.sh) plus a real confined harness task (gate, commit, a signal to an outside process refused); record what the dispatched scored run must still show.
- [ ] T007 [AC10] Add the Confinement section to [`harnesses.md`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/skills/postmaster/harnesses.md), update [`coachman.md`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/skills/postmaster/coachman.md) Lane capability, and run [`skill-refs.sh`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/skill-refs.sh).
- [ ] T008 [AC1] [AC2] [AC3] [AC6] [AC7] Run the full gate to green, then [`<tool>/scripts/verify.sh run .`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/verify.sh), then write the summary.

## Checks

How a lane shows each acceptance criterion working the way it will really be used.

### AC1 — wrapped, form unchanged, the launch path names no system

With `confine = "on"` in `POSTMASTER_CONFIG`: [`scripts/launch.sh form t`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/launch.sh) prints the system's form around `codex exec … --dangerously-bypass-approvals-and-sandbox …` and a wrapped `resume:` line; with `off` both lines are the bare BASE form. A stub harness launched under `on` records argv byte-identical to the `off` run. `grep -rinE 'linux|darwin|bwrap|sandbox-exec' scripts/launch.ts` prints nothing. Sending SIGTERM to a confined `launch` of a stub harness ends it the same way as with `confine` off: by that signal, never with exit 0.

### AC2 — a confined lane does its work as before

[`bun test scripts/launch.test.ts`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/launch.test.ts) with Bubblewrap available exits 0 and names each work item twice: the gate, a commit in its own worktree, a write outside its worktree, a network reach and a Unix socket connection, with `unconfined: ok` and `confined: ok` on every line.

### AC3 — a confined lane cannot signal what it did not start

Same run: signalling a process started outside the lane reads `unconfined: reached` then `confined: refused`, and that process is still running afterwards; signalling a process the lane started itself reads `confined: ok`.

### AC4 — moved

Moved to the isolation ticket, by the user's word (2026-10-02).

### AC5 — moved

Moved to the isolation ticket, by the user's word (2026-10-02).

### AC6 — the battery, with controls

[`bun test scripts/launch.test.ts`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/launch.test.ts) exits 0; its output names every AC2 and AC3 item once unconfined and once confined. Without Bubblewrap the same command exits 0 with each confinement item `skipped (no confinement)` by name. Run through the wrap, the way a confined lane's gate runs it, the same command exits 0 and runs the items. The output ends with a count of items run and skipped, and the lane's own run of this check shows none skipped.

### AC7 — unconfined fallback, mode recorded

`confine = "on"` with a confinement that cannot start (no Bubblewrap; Bubblewrap refused): the stub harness runs, unconfined; stderr names the cause; the action log records the fallback. `off` runs as BASE. A dispatch with `on` records `"mode": "on"` in `run.json`; with `off` or absent, `"off"`.

### AC8 — dropped

Dropped by the user's word (2026-10-01): no version is pinned or recorded, so there is nothing to check.

### AC9 — fixture run scores clean

The lane's real confined harness task against a [`fixture.sh new`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/fixture.sh) app passes that app's gate, commits, and cannot signal a process outside it; [`scripts/fixture.sh score`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/scripts/fixture.sh) on the dispatched all-confined run from this branch prints clean (run by the coachman/postmaster, not the lane). The scored run also shows it was confined: its `run.json` records `"mode": "on"` and its action log records no fallback. It needs `confine = "on"` in the config it is dispatched with, and until #201 lands that line is added by hand, which the coachman's hand-off says.

### AC10 — runbooks say confined

[`coachman.md`](https://github.com/brindlewick/postmaster/blob/0620bfc90eb32a35124279d9780df42174e6ccd9/skills/postmaster/coachman.md) Lane capability says lanes run in a process space of their own and cannot signal processes they did not start, and still names the worktree as what keeps their writes apart; neither runbook repeats the wiki's `lane-confinement` reasoning (judged by reading, not grep).
