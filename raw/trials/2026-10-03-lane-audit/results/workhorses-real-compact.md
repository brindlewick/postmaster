| Run | Ticket | Ranked | Blind tests | Second lane's part | Its own share of the code | Slower lane's extra wait, min |
| --- | --- | --- | --- | --- | --- | --- |
| [#57](https://github.com/brindlewick/postmaster/issues/57) | A leg's launch, resume and takeover are run by a script that records how each ended | luna, mimo | mimo:17/20,luna:12/20 | A | – | 5 (luna) |
| [#75](https://github.com/brindlewick/postmaster/issues/75) | Dispatch refuses a run directory or branch that already exists | mimo, luna | none | A | – | 3 (luna) |
| [#98](https://github.com/brindlewick/postmaster/issues/98) | A fixture run's postmaster runs headless, so it never stops at a trust prompt | luna, mimo | luna:12/12,mimo:12/12 | B | – | 22 (luna) |
| [#109](https://github.com/brindlewick/postmaster/issues/109) | Rewrite the scripts in TypeScript, run by Bun | luna, mimo | luna:fail,mimo:fail | A, earlier audit | – | 145 (luna) |
| [#110](https://github.com/brindlewick/postmaster/issues/110) | A project's gate never sees the run's own working copies | mimo, luna | none | A | – | 1 (luna) |
| [#122](https://github.com/brindlewick/postmaster/issues/122) | The watcher takes the mechanical steps itself, and wakes the postmaster only for decisions | luna, mimo | luna:pass,mimo:pass | A, earlier audit | – | 48 (mimo) |
| [#124](https://github.com/brindlewick/postmaster/issues/124) | The review leg ends with the run ready for the user's merge, with no separate ship leg | luna, mimo | luna:fail,mimo:fail | A, earlier audit | – | 15 (mimo) |
| [#135](https://github.com/brindlewick/postmaster/issues/135) | A gate check refuses any change that carries personal data or a secret | luna, mimo | luna:fail,mimo:fail | B, earlier audit | – | 34 (luna) |
| [#158](https://github.com/brindlewick/postmaster/issues/158) | Measure each lane's share of the shipped synthesis from git, beside the coachman's own account | luna, mimo | luna:4/4,mimo:4/4 | B | 0.5% | 14 (luna) |
| [#159](https://github.com/brindlewick/postmaster/issues/159) | A fixture run scores each lane's own branch against the hidden tests | mimo, luna | none | A | – | 3 (luna) |
| [#160](https://github.com/brindlewick/postmaster/issues/160) | Record each launch's tokens and cost where its harness reports them | luna, mimo | none | A | – | 27 (luna) |
| [#163](https://github.com/brindlewick/postmaster/issues/163) | The coachman contract is defined in one place, and a script decides whether a change touches it | luna, mimo | none | A | – | 31 (mimo) |
| [#165](https://github.com/brindlewick/postmaster/issues/165) | A finished launch's tab closes, and teardown closes every space a run opened | luna, mimo | none | C | – | – |
| [#170](https://github.com/brindlewick/postmaster/issues/170) | The coachman writes one spec that every workhorse implements, and the user reviews it once | mimo, luna | none | A | – | 26 (luna) |
| [#179](https://github.com/brindlewick/postmaster/issues/179) | A workhorse shows every acceptance criterion working, and keeps at it until it can | luna, mimo | none | A | 25% | 11 (mimo) |
| [#182](https://github.com/brindlewick/postmaster/issues/182) | A fixture run runs every agent at its harness's lowest effort | sol, mimo | sol:pass,mimo:pass | A | 14.6% | 55 (mimo) |
| [#200](https://github.com/brindlewick/postmaster/issues/200) | Run every lane in its own process space, so it cannot kill processes it did not start | mimo, astra | mimo:pass,astra:fail | C | 0% | – |
| [#201](https://github.com/brindlewick/postmaster/issues/201) | Setup and the probe say whether lane confinement can run on this machine, and what finishes it | sol, mimo | sol:fail,mimo:fail | B | 4.8% | 7 (mimo) |
