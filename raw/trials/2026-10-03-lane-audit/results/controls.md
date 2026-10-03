# Controls

Each count is run through the same code on a run where it must read non-zero (the positive control) and on a run where it must read zero (the negative control), or against a second program's figure.

| | Count | Positive control | Negative control |
| --- | --- | --- | --- |
| ok | a run counts as in the window by its action times | #200 has 141 actions in the window | #92 is among the 22 folders left out: true |
| ok | every line of every action log is an action | a line that is not one is counted (parse.test.ts) | 6385 lines read, 0 bad |
| ok | a finding named by two lanes reads shared, by one lane reads alone | #200's scripts/lib/confine.ts:58 names astra and opus | #200's scripts/lib/confine.ts:55 names opus only |
| ok | severe findings that name no lane are counted, not guessed | a line with no source names none (parse.test.ts) | 1 of 301 severe findings name no lane |
| ok | tokens read again from a launch's stream equal its usage file | 312 launch groups agree exactly | 3 differ (57: reviewer opus security 5; fixture-23: workhorse mimo - -; fixture-23: workhorse sol - -); 0 records have no stream |
| ok | a coachman leg's session record never holds fewer tokens than its usage file | 4 legs hold more (resumed after the file was written), for example #200's review leg | 0 legs hold fewer; 49 equal |
| ok | a run's total time equals the total scripts/run-times.ts prints | 48 runs compared, 48 within a minute | no run differs |
| ok | incident candidates are found where an incident happened and not in a clean run | #218 has 5 candidates | fixture-39 has 0, fixture-26 has 0 |
| ok | every curated incident cites an action that exists | 30 cited actions, 0 missing | a made-up citation is reported missing: true |
| ok | a lane's share of the synthesis reads zero for the lane that wrote nothing | #200 mimo (the producing lane): 63.9% of code runs only it wrote | #200 astra (walled, no implementation): 0% |
| ok | a lane's exit time is not after the coachman's harvest of it | 82 lanes have both times | 0 exit after the harvest |
| ok | a lane's own gate result is read from its branch's gate runs only | #200 mimo reads pass | #200 astra, which never ran the gate, reads none |
| ok | review rounds and launches are counted from the launch lines | #200 has 4 rounds and 12 launches | fixture-22, which never reached review, has 0 launches |
| ok | a review round's length is launch to last exit | #200 has 4 rounds with exit markers | fixture-22 has 0 |
| ok | a lane family groups the three codex assignments and nothing else | codex, codex, codex | mimo, opus |

- tokens read again from a launch's stream equal its usage file: A usage file and a stream differ where a lane was launched again and its stream holds only the last launch, or where a usage file holds no figures.
- a lane's exit time is not after the coachman's harvest of it: A lane resumed after the coachman's last harvest line exits later than that line.

## Who named a finding, read by hand

45 of the 92 severe finding lines in the window, drawn with a fixed generator (seed 7). Each was read on 2026-10-03 against the lanes it was parsed to name: all 45 match, and the one that names no lane says none.

| Run | Lanes parsed | The line, as written |
| --- | --- | --- |
| 158 | mimo | gating P2 r1 style+mimo bug+mimo verified by execution (verify.sh checks resolves only the declared shell gate; nothing runs bun test or oxlint) |
| 158 | mimo | gating P2 r1 style+mimo verified by execution (cwd inside test/ exits 0 on a test with sibling target; reproduced) |
| 158 | luna, mimo | gating P2 r2 bug+luna bug+mimo verified by execution (R079 rename of oracle-touched lib.ts: excl [] and 1 run counted) |
| 158 | luna, mimo | gating P2 r2 bug+luna bug+mimo verified by execution (root named test spuriously fails exit 1; cwd deep in test tree silently exits 0) |
| 170 | luna | gating P2 r1 bug:luna verified by reading: bun is required by the new wrappers but README still lists only Python and jq, and nothing declares it |
| 179 | luna | gating P2 r1 style luna execution: evidence loop parses fenced numbered lines, so an example counts as evidence (lane probe re-run) |
| 179 | mimo | gating P2 r1 style mimo execution: criteria indent rule is === base where ticket-check uses <= base+2; control reads 3, script reads [1,2]; header cl… |
| 179 | mimo | gating P2 r1 bug mimo execution: bare-token fallback reads slash prose as paths; not-shown reason with CLI/iOS fails as mixes, bare and/or invented a… |
| 179 | luna | gating P2 r2 bug luna execution: comment opener inside a code span hides later criteria; control reads 2, script reads [1] |
| 179 | luna | gating P2 r3 bug luna execution: code-span branch continues past bare paths, so a missing or escaping second citation on the line is never checked |
| 179 | mimo | gating P2 r3 bug mimo execution: entries start only at <= base where criteria use <= base+2, so an indented entry folds and its criterion reports mis… |
| 179 | mimo | gating P2 r4 bug mimo execution: transcript citation has no legal home when all criteria are not-shown; mixes on an entry, not-in-ticket as a new one |
| 182 | sol, mimo | gating P2 r1 bug sol mimo style sol mimo, verified by execution |
| 200 | astra | gating P2 r1 bug-astra:public DNS probe reds an offline gate:verified by execution |
| 200 | mimo | gating P2 r1 style-mimo:checkPin skips the confinement check on the unpinned path:verified by execution |
| 200 | astra | gating P2 r2 bug-astra:socket probes ignore skipPython, red without python3:verified by execution |
| 201 | sol | gating P2 r2 bug sol, verified by execution |
| 98 | mimo | gating P2 r1 style mimo, verified by execution: GIT_DIR steers the mark write to the wrong repo (probe reproduced) |
| 109 | luna, mimo | gating P2 r12 bug/luna+mimo: MESSAGE_KEYS capital Detail never matches the lowercased lookup, detail-held transient prose misclassifies not-transient… |
| 109 | opus | gating P2 r12 security/opus near-miss, fidelity: fence open/close exactly-3 vs BASE 3+, longer runs misread; verified by execution, 3 controls plus p… |
| 109 | coachman | gating P1 card-withheld coachman: withPinLock waits 120s on the bash flow's empty .pin.lock, every TS dispatch fails; empty now steals at once, exclu… |
| 109 | coachman | gating P2 card-withheld coachman: store .lock empty from bash flock stalls every TS write up to 60s; empty now steals at once; verified by execution,… |
| 124 | luna, mimo | gating P2 round 20 lens bug lanes luna,mimo verified by execution: step-3 re-verify covers only the ticket-moved cause, restore-branch loops on a rep… |
| 135 | coachman | gating r5 coachman execution: round-5 P2 fixes ANSI strip, merge names, tree -m, dotenv+alphabet, PuTTY v3, host-pathed homes, pass names+suffixes, s… |
| fixture-15 | luna | gating P2 r1 bug luna, verified by execution |
| fixture-17 | luna | gating P2 r1 bug luna style luna verified-by-execution: highestId MAX_SAFE_INTEGER loads, addTask yields unsafe id 2^53, next load rejects file |
| fixture-19 | sol, mimo | gating P2 r1 bug sol bug mimo style sol, verified by execution |
| fixture-20 | sol, mimo | gating P2 r2 bug:sol,bug:mimo verified by execution; round-1 bound made files the tool saves unloadable at MAX-1 |
| fixture-24 | sol | gating P2 r1 bug sol verified-by-execution |
| fixture-24 | sol | gating P2 r1 bug sol,style-sol verified-by-execution |
| fixture-24 | sol, mimo | gating P2 r2 bug sol,mimo verified-by-execution |
| fixture-25 | sol, mimo | gating P2 r1 bug sol+mimo, verified by execution: removeTasks on a mark-free list leaves no high-water mark, next add reuses the removed id |
| fixture-27 | sol, mimo | gating P2 r1 bug sol mimo style sol mimo, verified by execution |
| fixture-27 | sol, mimo | gating P2 r1 bug sol mimo style mimo, verified by execution |
| fixture-27 | mimo | gating P2 r2 bug mimo, verified by execution |
| fixture-27 | sol, mimo | gating P2 r2 bug sol mimo, verified by execution |
| fixture-28 | sol | gating P2 r1 bug sol, verified by execution |
| fixture-31 | sol | gating P2 r1 bug sol verified-by-execution: id exhaustion bricks store (remove on MAX_SAFE_INTEGER id saves nextId 2^53, file unloadable) |
| fixture-33 | sol, mimo | gating P2 r1 bug sol+mimo security-clean style-mimo-F1 verified-by-execution: malformed nextId absorbed as absent, counter reset reuses removed id |
| fixture-34 | none | gating P2 r1 bug+style lenses, verified by execution |
| fixture-36 | sol, mimo | gating P2 r1 bug sol mimo style verified-by-execution: Math.max spread throws RangeError on large lists |
| fixture-37 | astra, mimo | gating P2 r1 bug-astra bug-mimo verified-by-execution: exhausted nextId (2^53) rejected on reload, falls back to highest+1, add reuses id 1 instead o… |
| fixture-37 | mimo | gating P2 r2 bug-mimo verified-by-execution: stored out-of-range literal loads as Infinity, save writes null, reload falls back to highest+1 and reus… |
| fixture-39 | sol | gating P2 r3 bug sol verified-by-reading: load guard rejects previously valid MAX-id files, breaking list/done/remove |
| fixture-39 | mimo | gating P2 r3 bug mimo verified-by-execution: isTask allows MAX id but parseList refuses the file; add refuses one id early; prescribed: parseList > a… |

