# Marks

Read on 2026-10-05 at postmaster commit `a265197`. `by` is who the ticket says made the decision.

| ticket | decision | by | mark | reason, in one line |
|---|---|---|---|---|
| #251 | D1 | user | U | the user's own naming |
| #251 | D2 | prop. | U | what "ready" means is a sign-off policy |
| #251 | D3 | prop. | U | label or board column changes what the user sees; "all trackers keep labels" is under Verified at |
| #251 | D4 | prop. | U | policy for edits to a ready ticket |
| #251 | D5 | prop. | U | what the user's sign-off covers |
| #251 | D6 | user | U | the user's own word |
| #251 | D7 | user | U | the user's own word |
| #251 | D8 | prop. | U | which role drafts missing parts |
| #251 | D9 | prop. | U | how the user starts the clerk |
| #251 | D10 | prop. | U | what happens with no session host |
| #251 | D11 | prop. | U | what a machine set up earlier must do |
| #251 | D12 | prop. | U | which lane is the fresh reader (later withdrawn by #253) |
| #251 | D13 | prop. | U | how the draft reaches the user's phone |
| #251 | D14 | prop. | U | no committed copy; the reason is a past incident, but the trade-off stays |
| #251 | D15 | prop. | U (borderline R) | "costs the run no time" is a timing claim stage timings could test; the independence trade-off is the user's |
| #251 | D16 | prop. | U (borderline R) | "most changes to a file leave what a ticket says about it true" is a count over git history nobody ran; the tolerance is the user's |
| #251 | D17 | prop. | U | who rules when a premise fails |
| #251 | D18 | prop. | K | `AGENTS.md` already says a run finishes on the version it started with |
| #251 | D19 | prop. | K | fixture runs ask nobody, as for specs and merges today (existing rule) |
| #251 | D20 | user | U | the user's own word |
| #252 | D1 | user | U | the user's own word |
| #252 | D2 | prop. | U | scope: which steps the script takes |
| #252 | D3 | prop. | U | what stays with the postmaster |
| #252 | D4 | prop. | U | relying on the shipped mark instead of re-confirming is a risk choice; the fact it rests on is in the runbook |
| #252 | D5 | prop. | U | what counts as the run's folders, including one a person made |
| #252 | D6 | prop. | U | what is kept and what is dropped |
| #252 | D7 | user | U | the user's own word |
| #252 | D8 | prop. | U (borderline K) | fixture window and score stay with the supervisor; follows from how fixture runs work |
| #252 | D9 | user | U | the user's own word |
| #252 | D10 | prop. | U | what the summary shows |
| #252 | D11 | prop. | U (lanes' detail?) | four exit statuses |
| #252 | D12 | prop. | U | policy for a stuck folder |
| #252 | D13 | prop. | U | policy for a fault in the command |
| #252 | D14 | prop. | U | order of two tickets |
| #259 | D1 | prop. | U | where the Mac differences are written |
| #259 | D2 | prop. | U | scope of the readme list |
| #259 | D3 | user | U | the user's own word |
| #259 | D4 | prop. | U | setup and launch use one test |
| #259 | D5 | prop. | U | defer capping on a Mac; needs a real Mac |
| #259 | D6 | prop. | U | defer the data-apart check; "only a Mac with those agents logged in can show it" (observable, but not by the clerk) |
| #259 | D7 | prop. | U | accept a rare lost entry without `flock` (a risk choice) |
| #259 | D8 | prop. | U | `~user` paths stay as written |
| #259 | D9 | prop. | U | bad bytes replaced on a Mac |
| #259 | D10 | prop. | U | accept clock-following; "observable only on a Mac" |
| #259 | D11 | prop. | U | write up, do not fix |
| #237 | D1 | user | U | the user's own word |
| #237 | D2 | prop. | R | settled by a count over past runs: the old check called most endings walls that were not (the count is from the run records, per Verified at); the narrow rule is what is left |
| #237 | D3 | prop. | U | accepts false walls for one list of words |
| #237 | D4 | prop. | U (lanes' detail?) | how a time-only reset message is read |
| #237 | D5 | prop. | U | fail safe: say "no reset time" rather than guess |
| #237 | D6 | user | U | the user's own word |
| #237 | D7 | prop. | K | the fixture brief already says "this fixture run asks nobody" (`postmaster.md` Stage B step 8) |
| #237 | D8 | user | U | the user's own word |
| #265 | D1 | user | U | the one-hour target is the user's number (the measurements are context) |
| #265 | D2 | user | U | a slow run still scores clean |
| #265 | D3 | user | U | the 10-minute wait threshold |
| #291 | D1 | prop. | U | guidance, not a check; the reason is a general argument, not a run |
| #291 | D2 | user | U | the user's own word |
| #291 | D3 | prop. | U | the direction states what a check guards against |
| #287 | D1 | user | U | the user's own word |
| #287 | D2 | user | U | the user's own word |
| #287 | D3 | prop. | U (lanes' detail?) | an empty heading is left out |
| #227 | D1 | prop. | R | settled on scratch copies: a fix that skips only the findings lists fails a decoy file and a fix that names the round records passes (last Verified at bullet) |
| #227 | D2 | prop. | U (lanes' detail?) | wording of one refusal line |
| #227 | D3 | prop. | U (lanes' detail?) | how the line number is counted |
| #227 | D4 | prop. | U (lanes' detail?) | name one damaged record, not all |
| #227 | D5 | prop. | U | other silent failures go to another ticket |
| #227 | D6 | prop. | U (lanes' detail?) | tests also hold what the ticket keeps |

**Totals.** 68 decisions: **U 63**, **R 2** (#237 D2, #227 D1), **K 3** (#251 D18, #251 D19, #237 D7). All 17
decisions the ticket marks as given by the user are U. Three U marks are close calls (#251 D15 and D16 toward
R, #252 D8 toward K). Seven U marks look like details the lanes could decide (#227 D2, D3, D4 and D6, #237 D4,
#252 D11, #287 D3), which the ticket template already says to leave to them; that is a different filter and was
not the question. So the second kind, a choice that running or an existing rule settles, is 5 of 68 (7%): 2 by
running and 3 by reading. Whether any of the five was the user's to make is for the user to say.
