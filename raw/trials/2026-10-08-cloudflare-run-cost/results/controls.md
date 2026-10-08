# Controls

Each count in the trial has a control that reads non-zero or a known number and one that reads zero,
through the same code. `bun controls.ts` writes this file; `controls.test.ts` runs the same checks.

| | Kind | What | Expected | Got | Result |
| --- | --- | --- | --- | --- | --- |
| C1 | positive | gate runs on lane branches, counted through summarizeRole | 36 runs and 6.5 hours, as the lane audit published | 36 runs, 6.5 hours | pass |
| C2 | positive | gate runs on the synthesis, through the same code | 260 runs and 43.5 hours, as the lane audit published | 260 runs, 43.5 hours | pass |
| C3 | positive | one lane's implementSeconds against its start and finish timestamps (run 201, lane sol) | 2001 seconds both ways | field 2001, timestamps 2001 | pass |
| C4 | positive | that lane's container cost at standard-4, memory and disk only | 2001 x (12 x 0.0000025 + 20 x 0.00000007) = $0.0628314 | $0.0628314 | pass |
| C5 | negative | a run with no lanes, gates, stages or reviewers, through runTime and cost | 0 seconds in every role and $0 | 0 seconds, $0 | pass |
| C6 | positive | the coachman's floor (session uptime) against its ceiling (stage seconds), run by run | floor at most ceiling in all runs that have both | 14 of 14 runs | pass |
| C7 | negative | the same comparison with floor and ceiling swapped | it must fail in at least one run, or the comparison tells nothing | 14 of 14 runs fail when swapped | pass |
| C8 | positive | coachman tokens from the session exports (14 runs) | about 1478M in and 5253k out, as the lane audit published | 1478.0M in, 5253k out | pass |
| C9 | positive | codex reviewer tokens, input counting cache reads as codex reports it | 119 launches, about 240M in, 2934k out | 119 launches, 240.2M in, 2934k out | pass |
| C10 | positive | codex workhorse tokens | 18 launches, about 438M in, 2583k out | 18 launches, 438.1M in, 2583k out | pass |
| C11 | positive | MiMo uncached input, which is what the audit counted as input (the audit left out cache reads) | reviewers 118 launches and 17M, workhorses 18 launches and 7.8M | reviewers 118 and 17.1M, workhorses 18 and 7.8M | pass |
| C12 | positive | Opus reviewer launches and the dollars Claude Code reported | 71 launches and $644.17, as the lane audit published | 71 launches, $644.17 | pass |
| C13 | negative | a harness with no launches in the data (grok), through the same selection | 0 launches and 0 tokens | 0 launches | pass |
| C14 | positive | MiMo output differs from the audit's by its reasoning tokens, which the audit left out | more than the audit's 1019k reviewer output, since reasoning tokens are counted as output (how Xiaomi bills them is not stated, so this is an assumption) | 4510k | pass |
| C15 | positive | each Opus launch's reported dollars against its own tokens at the published Opus 5.5 prices, between all cache writes at 5 minutes and all at 1 hour | inside the bracket for every launch that used no other model | 61 of 61 launches (9 used another Claude model besides, 1 recorded no usage) | pass |
| C16 | negative | the same bracket with Opus 4.1's prices ($15 in, $75 out), which are not Opus 5.5's | the reported dollars fall inside for almost no launch | 0 launches | pass |
| C17 | positive | every price in prices.json names its page and the day it was read | none missing | 0 missing of 8 | pass |
| C19 | positive | the coachman's dollars at Meta's standard tier, summed launch by launch and recomputed from the summed tokens | the two agree to a cent | $330.89 and $330.89 (14 runs) | pass |
| C20 | negative | the same re-pricing for a model no launch used | the coachman's dollars do not move | $11.75 before and $11.75 after | pass |
| C18 | positive | median of the audit helper on a case worked by hand | median of 1, 2, 9 is 2 and of 1, 2, 3, 10 is 2.5 | 2 and 2.5 | pass |
