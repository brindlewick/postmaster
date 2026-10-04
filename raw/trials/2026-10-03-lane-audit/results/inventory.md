# Every run with activity in the window

| Runs | With activity in the window | Set aside | Reached synthesis | of them, synthesis in the window | Finished | Not finished |
| --- | --- | --- | --- | --- | --- | --- |
| this repository's tickets | 31 | 6 | 18 | 8 | 23 | 8 |
| fixture runs | 25 | 0 | 24 | 21 | 25 | 0 |

| Run | Ticket | Workhorses | First to last action (UTC) | Stage at the end | Synthesis | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| [#57](https://github.com/brindlewick/postmaster/issues/57) | A leg's launch, resume and takeover are run by a script that records how each ended | luna, mimo | 09-29 10:09 to 10-01 13:01 | done | luna first | – |
| [#75](https://github.com/brindlewick/postmaster/issues/75) | Dispatch refuses a run directory or branch that already exists | luna, mimo | 09-30 10:05 to 09-30 16:25 | done | mimo first | – |
| [#98](https://github.com/brindlewick/postmaster/issues/98) | A fixture run's postmaster runs headless, so it never stops at a trust prompt | luna, mimo | 09-30 14:01 to 10-01 16:42 | done | luna first | – |
| [#109](https://github.com/brindlewick/postmaster/issues/109) | Rewrite the scripts in TypeScript, run by Bun | luna, mimo | 09-28 09:37 to 10-02 00:42 | done | luna first | synthesis audited earlier |
| [#110](https://github.com/brindlewick/postmaster/issues/110) | A project's gate never sees the run's own working copies | luna, mimo | 09-30 10:06 to 10-01 08:16 | done | mimo first | – |
| [#122](https://github.com/brindlewick/postmaster/issues/122) | The watcher takes the mechanical steps itself, and wakes the postmaster only for decisions | luna, mimo | 09-29 06:18 to 09-30 23:02 | done | luna first | synthesis audited earlier |
| [#124](https://github.com/brindlewick/postmaster/issues/124) | The review leg ends with the run ready for the user's merge, with no separate ship leg | luna, mimo | 09-29 02:57 to 10-01 01:11 | done | luna first | synthesis audited earlier |
| [#135](https://github.com/brindlewick/postmaster/issues/135) | A gate check refuses any change that carries personal data or a secret | luna, mimo | 09-29 03:45 to 10-02 02:44 | shipping | luna first | synthesis audited earlier; not finished |
| [#158](https://github.com/brindlewick/postmaster/issues/158) | Measure each lane's share of the shipped synthesis from git, beside the coachman's own account | luna, mimo | 09-29 23:40 to 09-30 21:04 | done | luna first | – |
| [#159](https://github.com/brindlewick/postmaster/issues/159) | A fixture run scores each lane's own branch against the hidden tests | luna, mimo | 09-29 23:46 to 09-30 20:52 | done | mimo first | – |
| [#160](https://github.com/brindlewick/postmaster/issues/160) | Record each launch's tokens and cost where its harness reports them | luna, mimo | 09-30 10:08 to 09-30 15:49 | done | luna first | – |
| [#163](https://github.com/brindlewick/postmaster/issues/163) | The coachman contract is defined in one place, and a script decides whether a change touches it | luna, mimo | 09-29 21:43 to 10-01 19:22 | done | luna first | – |
| [#165](https://github.com/brindlewick/postmaster/issues/165) | A finished launch's tab closes, and teardown closes every space a run opened | luna, mimo | 09-29 20:49 to 10-01 01:35 | done | luna first | – |
| [#170](https://github.com/brindlewick/postmaster/issues/170) | The coachman writes one spec that every workhorse implements, and the user reviews it once | luna, mimo | 09-30 00:55 to 10-01 10:49 | done | mimo first | – |
| [#179](https://github.com/brindlewick/postmaster/issues/179) | A workhorse shows every acceptance criterion working, and keeps at it until it can | luna, mimo | 09-30 21:12 to 10-01 22:09 | done | luna first | – |
| [#182](https://github.com/brindlewick/postmaster/issues/182) | A fixture run runs every agent at its harness's lowest effort | sol, mimo | 10-02 11:55 to 10-03 04:56 | done | sol first | – |
| [#182](https://github.com/brindlewick/postmaster/issues/182)-parked-20261001 | A fixture run runs every agent at its harness's lowest effort | luna, mimo | 09-30 23:11 to 10-01 01:19 | abandoned | no | set aside |
| [#200](https://github.com/brindlewick/postmaster/issues/200) | Run every lane in its own process space, so it cannot kill processes it did not start | astra, mimo | 10-02 23:27 to 10-03 11:01 | done | mimo first | – |
| [#200](https://github.com/brindlewick/postmaster/issues/200)-parked-20261002 | Run every lane in its own process space, so it cannot kill processes it did not start | sol, mimo | 10-01 09:20 to 10-02 23:27 | done | no | set aside |
| [#201](https://github.com/brindlewick/postmaster/issues/201) | Setup and the probe say whether lane confinement can run on this machine, and what finishes it | sol, mimo | 10-01 09:21 to 10-03 00:23 | done | sol first | – |
| [#202](https://github.com/brindlewick/postmaster/issues/202) | After the workhorses and after each review round, check for a lane's reach outside its own worktree | luna, mimo | 10-03 15:33 to 10-03 16:00 | workhorses-running | no | not finished |
| [#202](https://github.com/brindlewick/postmaster/issues/202)-parked-20261003 | After the workhorses and after each review round, check for a lane's reach outside its own worktree | luna, mimo | 10-03 06:01 to 10-03 15:33 | done | no | set aside |
| [#216](https://github.com/brindlewick/postmaster/issues/216) | The private-data check is TypeScript run by Bun, and flags little of the project's own code | luna, mimo | 10-03 15:31 to 10-03 16:07 | workhorses-running | no | not finished |
| [#216](https://github.com/brindlewick/postmaster/issues/216)-parked-20261003 | The private-data check is TypeScript run by Bun, and flags little of the project's own code | luna, mimo | 10-02 06:07 to 10-03 15:30 | done | no | set aside |
| [#217](https://github.com/brindlewick/postmaster/issues/217) | Postmaster runs on macOS, shown by a macOS job in CI and a fixture run on a Mac | luna, mimo | 10-02 10:25 to 10-03 08:13 | planning | no | not finished |
| [#217](https://github.com/brindlewick/postmaster/issues/217)-parked-20261002 | Postmaster runs on macOS, shown by a macOS job in CI and a fixture run on a Mac | sol, mimo | 10-02 09:48 to 10-02 10:11 | done | no | set aside |
| [#218](https://github.com/brindlewick/postmaster/issues/218) | Every script runs as its TypeScript file, with no .sh wrapper left | sol, mimo | 10-02 09:58 to 10-03 15:34 | workhorses-running | no | not finished |
| [#227](https://github.com/brindlewick/postmaster/issues/227) | Teardown closes a run's spaces when its logs hold review findings lists | luna, mimo | 10-03 00:52 to 10-03 08:13 | planning | no | not finished |
| [#237](https://github.com/brindlewick/postmaster/issues/237) | A lane that hits a provider limit pauses its run and tells the user at once | luna, mimo | 10-03 05:47 to 10-03 08:13 | planning | no | not finished |
| [#237](https://github.com/brindlewick/postmaster/issues/237)-parked-20261003 | A lane that hits a provider limit pauses its run and tells the user at once | sol, mimo | 10-03 05:43 to 10-03 05:47 | done | no | set aside |
| [#251](https://github.com/brindlewick/postmaster/issues/251) | A booking clerk prepares every ticket that is not ready to run | luna, mimo | 10-03 14:00 to 10-03 16:23 | synthesis | no | not finished |
| fixture-15 | fixture, Remove tasks by id | luna, mimo | 09-30 23:19 to 10-01 00:43 | done | mimo first | – |
| fixture-16 | fixture, Remove tasks by id | luna, mimo | 10-01 00:09 to 10-01 00:45 | abandoned | mimo first | – |
| fixture-17 | fixture, Remove tasks by id | luna, mimo | 10-01 02:15 to 10-01 08:29 | done | mimo first | – |
| fixture-18 | fixture, Remove tasks by id | luna, mimo | 10-01 02:31 to 10-01 08:12 | done | mimo first | – |
| fixture-19 | fixture, Remove tasks by id | sol, mimo | 10-01 09:05 to 10-01 10:21 | done | mimo first | – |
| fixture-20 | fixture, Remove tasks by id | sol, mimo | 10-01 09:13 to 10-01 10:53 | done | sol first | – |
| fixture-21 | fixture, Remove tasks by id | sol, mimo | 10-01 09:52 to 10-01 11:05 | done | mimo first | – |
| fixture-22 | fixture, Remove tasks by id | – | 10-01 10:47 to 10-01 10:47 | abandoned | no | – |
| fixture-23 | fixture, Remove tasks by id | sol, mimo | 10-01 11:37 to 10-01 13:04 | done | mimo first | – |
| fixture-24 | fixture, Remove tasks by id | sol, mimo | 10-01 11:38 to 10-01 13:22 | done | sol first | – |
| fixture-25 | fixture, Remove tasks by id | sol, mimo | 10-01 11:58 to 10-01 12:55 | done | sol first | – |
| fixture-26 | fixture, Remove tasks by id | sol, mimo | 10-01 12:06 to 10-01 13:17 | done | mimo first | – |
| fixture-27 | fixture, Remove tasks by id | sol, mimo | 10-01 14:03 to 10-01 16:43 | done | mimo first | – |
| fixture-28 | fixture, Remove tasks by id | sol, mimo | 10-01 14:03 to 10-01 16:08 | done | mimo first | – |
| fixture-29 | fixture, Remove tasks by id | sol, mimo | 10-01 15:37 to 10-01 17:15 | done | mimo first | – |
| fixture-30 | fixture, Remove tasks by id | sol, mimo | 10-01 17:15 to 10-01 18:48 | done | mimo first | – |
| fixture-31 | fixture, Remove tasks by id | sol, mimo | 10-01 17:15 to 10-01 19:22 | done | mimo first | – |
| fixture-32 | fixture, Remove tasks by id | sol, mimo | 10-01 20:24 to 10-01 22:07 | done | sol first | – |
| fixture-33 | fixture, Remove tasks by id | sol, mimo | 10-01 20:24 to 10-01 22:58 | done | mimo first | – |
| fixture-34 | fixture, Remove tasks by id | sol, mimo | 10-01 22:40 to 10-02 00:38 | done | mimo first | – |
| fixture-35 | fixture, Remove tasks by id | sol, mimo | 10-02 02:44 to 10-02 04:26 | done | mimo first | – |
| fixture-36 | fixture, Remove tasks by id | sol, mimo | 10-02 21:11 to 10-02 23:55 | done | mimo first | – |
| fixture-37 | fixture, Remove tasks by id | astra, mimo | 10-02 22:45 to 10-03 02:22 | done | mimo first | – |
| fixture-38 | fixture, Remove tasks by id | astra, mimo | 10-03 03:56 to 10-03 04:54 | done | astra first | – |
| fixture-39 | fixture, Remove tasks by id | sol, mimo | 10-03 07:44 to 10-03 10:57 | done | mimo first | – |
