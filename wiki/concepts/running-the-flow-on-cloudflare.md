---
title: The flow could run on Cloudflare as a control plane and one container per launch, but not on a Worker, and not yet on subscription logins
type: concept
standing: claimed
sources: [articles/cloudflare-containers-sandboxes, articles/cloudflare-containers-issue-reports, articles/cloudflare-control-plane, articles/cloudflare-ai-gateway, articles/openai-codex-login-and-terms, articles/anthropic-claude-code-login-and-terms, articles/meta-muse-code-login-and-terms, articles/xiaomi-mimo-code-login-and-terms, articles/other-harnesses-login-and-terms, articles/model-api-prices, trials/2026-10-08-cloudflare-run-cost, trials/2026-10-03-lane-audit]
updated: 2026-10-08
---

# Running the flow on Cloudflare

**Claim.** The flow could run on Cloudflare with Workers, Durable Objects and Workflows as the control plane and one
container for each lane, reviewer and coachman leg. A Worker alone cannot run a lane. Cloudflare's own tutorials run
Claude Code, Codex and Pi headless in a container with the model key held in the Worker. They use API credentials; an
earlier example in Cloudflare's sandbox repository held a Claude subscription token the same way, and is gone from the
current examples. Whether a Worker may hold a subscription login and use it from a vendor-neutral cloud container is not
settled by any vendor's words: each documents a login on its own runner, and the terms leave the rest open. The Cloudflare
bill is container time, with the control plane at cents: about $1 to $4.50 for a typical run, and up to about $4 to $7 for
the average run. The model bill is the same on any host, so it is a side note at the end of [Cost](#cost).
[Issue #341](https://github.com/brindlewick/postmaster/issues/341), "Research: could postmaster's
flow run on Cloudflare, with Workers as the control plane and Containers for the lanes?", asks the question.

**Standing: claimed.** Everything below about Cloudflare and the vendors is what their documents, code and
changelogs say on 2026-10-08. Nothing was run on Cloudflare: no account, no deploy, no instance. The counts made from
this fleet's records are arithmetic on the lane audit's times and tokens, on the uptime of each coachman's last process and
the tokens of each launch's own stream, and a scan of the flow's scripts
[@trials/2026-10-08-cloudflare-run-cost/method.md]. Their [controls](../../raw/trials/2026-10-08-cloudflare-run-cost/results/controls.md)
show the code applies each rule the same way to cases that must read non-zero and cases that must read zero. They
cannot show that Cloudflare behaves as documented. By [the schema](../schema.md) outside documents do not move a
standing.

## The answer

1. **A Worker cannot run a lane.** It has 128 MB of memory, `node:child_process` is a non-working stub, and its
   filesystem is held in that memory [@articles/cloudflare-control-plane/passages.md] (B1, B3, B4).
2. **A container can.** "Each instance is a microVM with its own kernel and network, so no other workload shares it."
   The largest self-serve size is 4 vCPU, 12 GiB and 20 GB, and Cloudflare says to ask for larger ones
   [@articles/cloudflare-containers-sandboxes/passages.md] (A6.2, A3.1).
   Cloudflare publishes a runnable tutorial for Claude Code, Codex, Pi and OpenCode (A7). Three of those are among
   the flow's seven harnesses.
3. **Cloudflare's current material shows the model key staying outside the sandbox for API credentials.** The sandbox holds a
   placeholder; the Worker adds the real key, through AI Gateway credits or a stored provider key. No page of the Sandbox,
   Containers, Agents or AI Gateway documentation shows a subscription login
   [@articles/cloudflare-containers-sandboxes/passages.md] (A7.6) [@articles/cloudflare-ai-gateway/passages.md] (B12, B13, B21;
   a search of those folders for a subscription login found none). Cloudflare's sandbox repository did, for Claude Code: from
   2026-04-20 until 2026-09-02 an example let a Claude subscription token sit in the Worker and sent the container a placeholder
   `CLAUDE_CODE_OAUTH_TOKEN`, and a contributor wrote that it worked. The folder went in a commit that changed 300 files, and
   the current examples have no such route; no reason is given (A7.7). That shows a mechanism, not that any vendor allows it.
4. **The vendors' words leave a subscription login open.** OpenAI says "The right way to authenticate automation is
   with an API key", documents a ChatGPT login on a trusted private runner as an advanced option, and says not to share
   one `auth.json` across concurrent jobs or machines. Anthropic documents a one-year token for CI, requires its Commercial
   Terms for Claude Code run "in hosted sandboxes or other agent infrastructure", and bars third-party developers from
   routing or intermediating plan credentials. Meta limits a subscription credential to its own harness. Xiaomi limits a
   Token Plan to programming tools and gives "automated scripts" as an example of a use it bars. Details in
   [Logins and terms](#logins-and-terms).
5. **The Cloudflare bill is container time, and it is small.** A typical (median) real run, with every launch in a
   container of its own, costs $0.98 to $2.68 on 2 vCPU, 8 GiB machines and $1.61 to $4.43 on 4 vCPU, 12 GiB machines, with a
   quarter of the CPU busy; over every size and CPU use the extremes are $0.50 and $9.60. The average run costs more, up to
   about $4 or $7, because a few long runs dominate, and the 18 audited runs together, which span 2026-09-28 to 2026-10-03,
   would have cost roughly $20 to $125. The widest uncertainty is the coachman's process time, which the records bracket at
   3.6 to 18.8 hours. The control plane is cents, and the plan is $5 a month
   [@trials/2026-10-08-cloudflare-run-cost/results/cost.md]. The model bill is the same on any host and is a side note.
6. **A container per lane would stop every reach the isolation scan found inside the machine**, by the documented design
   (argued, not tried), and leaves open the destinations the network handler allows, the git remote, the hand-back of work and
   where the blind tests live ([Isolation](#isolation)).
7. **What breaks is mostly the single-machine assumptions.** Code in a container is not "activity" to the platform, the
   control plane must keep it alive and poll it, the disk is ephemeral, the scheduling policy the documentation lists as
   best for sandboxes, which Sandbox SDK 1.0 uses, is in public beta, and the scripts lean on one machine's files and
   processes ([What breaks](#what-breaks-or-must-be-ported)).
8. **The smallest trial is one fixture lane in a sandbox.** It costs the $5 plan fee and a few dollars of credit ([The smallest trial](#the-smallest-trial)).

## The map

Each row sets a part of the flow against what Cloudflare offers for it. Every Cloudflare page below was read on
2026-10-08, as repository text of the documentation at commit 6e1b964, and for the claims that decide most also on the
published page [@articles/cloudflare-containers-sandboxes/source.md] [@articles/cloudflare-control-plane/source.md].

| Part of the flow | Today | What Cloudflare offers | Fit |
| --- | --- | --- | --- |
| Dispatch, rulings, tracker calls | Scripts the postmaster runs | Workers: 128 MB, up to 5 minutes of CPU a request, no limit on a request whose client stays connected; Queues (128 KB a message) for events | Fits (B1, B2, B20) |
| Postmaster and booking clerk | Interactive sessions that poll files, run scripts, call the tracker and merge | A Durable Object per project for state, an Agents SDK `Agent` (a Durable Object with state, schedules and WebSockets), and Workflows for supervision, with waits of up to 365 days, up to 25,000 steps and events from outside. The SDK's Pi harness (beta) runs the pi agent loop in a Durable Object and is not the pi program. The session itself needs a shell, so a container, reached by a browser terminal over WebSocket and tmux | The control plane fits (B5, B9, B10, A5.12). The session is a harness process and needs a container |
| Coachman leg | A headless harness session of hours that reads and writes the run folder, starts lanes, runs the gate | A container started from a Durable Object, kept alive by an alarm, its session store saved by a snapshot or a directory backup | Fits with work: lifetime, 12 GiB ceiling, resume (A1.15, A2.2, A2.4) |
| Workhorse lanes | A headless harness in a worktree | A container each, microVM isolated; the model key held by the Worker | Fits; shown by the Claude Code, Codex and Pi tutorials (A7.1 to A7.4) |
| Reviewers | A headless harness in a detached scratch worktree, or in a shared clone for the security review | A container each | Fits, as lanes do |
| The gate | The project's checks, a median 12 minutes, run in the coachman's worktree | Inside the coachman's container, or a fresh one to run in parallel; at most 4 vCPU and 20 GB; the image must carry the target's toolchain | Unknown speed. Not measured here |
| Scripts | TypeScript on Bun that read and write files and start processes | Run unchanged in a Linux amd64 container | A port: 69 scripts of the flow, 44 import the shared process helpers, 10 name marker, pid or lock files ([script table](../../raw/trials/2026-10-08-cloudflare-run-cost/results/script-primitives.md)) |
| Run records, action log, event streams | Files under the project's run folder, appended by several processes | R2 for blobs (strongly consistent, no append call listed, one write a second to a key); Durable Object SQLite for the ledger (10 GB an object); D1 for queries across runs; Queues for fan-in (128 KB a message). A bucket mount is not a local disk: "File locks, hard links, ownership, permissions, and atomic replacement do not work as they do on a local filesystem" | A port (B18 to B20, A2.5) |
| Session host and dashboard | Herdr or tmux panes, a read-only page over Tailscale | A browser terminal on tmux is a documented pattern; Workers with Access could serve a dashboard; nothing like Herdr | A fourth host to write |
| Model access | Each harness's own login or key | AI Gateway: stored keys (Beta), Cloudflare credits with a 5% fee, spend limits (Beta), logs, a scan for secrets | Covers API credentials (B12 to B17, B22) |
| Tracker and git | GitHub | Unchanged; a container reaches GitHub over HTTPS through a Worker handler that adds the token | Fits; SSH cannot be intercepted (A4.5, A6.4) |

Two things in the ticket's own text are corrected by the pages. A Worker does have a filesystem, held in memory. And the
ten idle minutes are the `Container` class's default `sleepAfter`, not a platform rule: the Durable Object Container API
has no default timeout, and its maximum is six hours. A rollout that sends SIGTERM and then SIGKILL after fifteen minutes
replaces instances only under the `default` scheduling policy; the `durable_object` policy, which the documentation lists
as best for sandboxes and agent environments and which Sandbox SDK 1.0 uses, takes no part in rollouts. The same
fifteen-minute drain also precedes a host move under either policy (A1.6, A1.18).

## Logins and terms

### What each harness needs to log in and run headless

The seven harnesses are in [the adapter file](../../skills/postmaster/harnesses.md). Four ran in the audited runs (codex,
mimo, claude, muse). The table says what each takes, whether it can be pointed at another base URL with a placeholder
credential (the Cloudflare pattern), and whether Cloudflare shows it.

| Harness | Headless routes | Another base URL, placeholder key | Cloudflare shows it | Pattern covers |
| --- | --- | --- | --- | --- |
| codex | `CODEX_API_KEY`; `codex login --device-auth`; a copied `auth.json`; access tokens on Business and Enterprise | A custom provider with `base_url` and `env_key`; only the Responses API | AI Gateway page and sandbox tutorial | API key: yes. A ChatGPT login: OpenAI documents a gateway for it on its Enterprise pages, Cloudflare does not show it |
| claude | `ANTHROPIC_API_KEY`; `CLAUDE_CODE_OAUTH_TOKEN`, a one-year token from `claude setup-token` | `ANTHROPIC_BASE_URL` and a custom header | AI Gateway page and sandbox tutorial | API key: yes. A subscription login: Anthropic's gateway page says a gateway can carry it if it forwards the `anthropic-beta` header. Cloudflare's current pages do not show it; its retired sandbox example did, with the token held in the Worker (A7.7) |
| muse | `META_API_KEY`; a stored key; a browser login | No documented setting. Meta's own SDK quickstart writes `endpoint_transport.base_url` into `settings.json` | No | An API key only through that undocumented setting |
| mimo | `XIAOMI_API_KEY`; `auth.json`; the whole file in `MIMOCODE_AUTH_CONTENT` | Documented: `baseURL` and `apiKey` with `{env:NAME}` | No (AI Gateway custom providers, Beta, could front it) | API key: yes |
| pi | The provider's own variable; `/login` | `models.json` `baseUrl`, and a built-in AI Gateway provider | AI Gateway page and sandbox tutorial | API key: yes |
| grok | `XAI_API_KEY`; `grok login --device-auth` | `[model.<id>]` with `base_url` and `env_key` | No | API key: technically |
| agy | A cached Google sign-in; `GEMINI_API_KEY` with `GOOGLE_GEMINI_BASE_URL` | `GOOGLE_GEMINI_BASE_URL`, for the key route | No | API key: technically |

Sources: [@articles/openai-codex-login-and-terms/passages.md] [@articles/anthropic-claude-code-login-and-terms/passages.md]
[@articles/meta-muse-code-login-and-terms/passages.md] [@articles/xiaomi-mimo-code-login-and-terms/passages.md]
[@articles/other-harnesses-login-and-terms/passages.md] and the Cloudflare pages above.

Two facts about a copied login. A ChatGPT login refreshes itself, and the refresh token is used once: Codex's own
message for the second copy to refresh is "Your access token could not be refreshed because your refresh token was
already used. Please log out and sign in again." [@articles/openai-codex-login-and-terms/passages.md] (H2-codex-2, from
the Codex source). So parallel containers cannot share one `auth.json`; each would need its own chain, or the Worker would
be the only holder. By the comments in pi's code (a third party's account of Meta's behaviour, not Meta's own words), a
login to Meta's Muse subscription gives an identity token that cannot be renewed and is exchanged for a key that lives about
a day and is minted again from the token; how long the token itself lasts is not stated anywhere read, and a person must
repeat the device login when it is rejected [@articles/other-harnesses-login-and-terms/passages.md] (H1 pi, about Meta).
Meta's contributor tier is also limited to 100 requests a minute and 3,000,000 tokens a minute for a whole team, which a
fleet of parallel lanes would share [@articles/meta-muse-code-login-and-terms/passages.md].

### What the vendors' terms say

The deciding sentences, with the document that holds each. "Not said" means the documents were read for it and are
silent; silence is not read as permission.

| Vendor | Documents allow | Documents bar or discourage | Not said |
| --- | --- | --- | --- |
| OpenAI (Codex) | Copying your own `auth.json` to your own headless machine. A ChatGPT-managed login on a trusted private CI runner, "an advanced workflow for enterprise and other trusted private automation". API keys, the documented default for automation | "Do not share the same file across concurrent jobs or multiple machines." "Do not use this workflow for public or open-source repositories." The consumer terms bar sharing credentials or making the account "available to anyone else"; the Services Agreement for Business and Enterprise bars sharing login credentials between users and gives each account one end user. "App-server authentication has never been permitted for commercial or hosted services." (about app-server sign-in, not `codex exec`) | Whether a Plus or Pro login may run in a vendor-neutral cloud container. Whether "Automatically or programmatically extract data or Output" reaches `codex exec` |
| Anthropic (Claude Code) | `claude setup-token` and `CLAUDE_CODE_OAUTH_TOKEN` "for CI pipelines and scripts"; the same token as a GitHub Actions secret on Pro, Max, Team and Enterprise. Not barred: an end user signing in to "the unmodified Claude Code binary with their own Claude subscription, including where a platform hosts Claude Code", under the conditions on the next column | Running Claude Code "in hosted sandboxes or other agent infrastructure" "requires agreeing to our Commercial Terms of Service", on conditions: the binary unmodified, and "Each end user must authenticate with their own Anthropic API key, Claude subscription plan credentials, or 3P inference provider credential", with no paying for, reselling or intermediating usage on end users' behalf. Third-party developers may not "route requests through Free, Pro, or Max plan credentials on behalf of their users" and "may not collect, store, or intermediate Claude.ai credentials or session tokens". The consumer terms bar automated or non-human access "except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it". A usage policy page dated to take effect 2026-11-12 bars to "Resell, proxy, or otherwise provide access to Claude through unauthorized means, including services that route requests through consumer subscriptions or misrepresent the product or client being used"; "unauthorized" is not defined on the page | Whether one person's own agents in their own container count as offering Claude Code "in your products or services". Whether the user's own CI job on a rented machine is "automated or non-human means" or is access Anthropic has explicitly permitted. Whether a Worker that holds the user's own token is an "intermediary". Whether the November bullet reaches a person's own automation. A cap on concurrent sessions |
| Meta (Muse Code) | Pay-as-you-go keys in the applications its Terms let you build, and in the configurations its pages publish for OpenCode, Codex and Claude Code. `muse exec` in CI with `META_API_KEY`. `--yolo` "in a disposable, isolated container" | A subscription credential "is for use only with the coding harness under your Coding Harness Subscription". Keys may not be shared with a third party, including through "any model aggregator, API gateway, proxy, or similar offering". The binary may not be modified to run with a model not provided by Meta. Access is limited to the jurisdictions Meta has enabled | Whether baking the binary into an image is to "make available any Downloadable Materials to any third party". Whether your own egress proxy is a third party's. Whether a container's location counts as access from there |
| Xiaomi (MiMo Code) | MiMo Code is a listed tool; the same package works in several tools | "The quota of the Token Plan package is only available for use in programming tools ... and it is prohibited to use it in the form of API calls for request behaviors in obvious non-coding scenarios such as automated scripts and custom application backends." | Whether an unattended coding agent in a container is on either side. The user agreement could not be read |
| xAI (grok), Google (agy) | Headless is a feature of each; API keys | Google: "Using third party software, tools, or services to access the Service (e.g. using OpenClaw with Antigravity OAuth) is a breach of this Agreement" | xAI's terms returned 403; Google's say nothing on CI or cloud machines |

OpenAI's own policy pages answered 403 to the fetch tool. The consumer terms were read as Open Terms Archive copies, a
third party's capture of the vendor's pages, and the rest-of-world Terms of Use through a public text converter that
fetches the vendor's page; both are marked in the entries, which also note that the archive's EU copy says "extracting"
where the rest-of-world page says "extract" [@articles/openai-codex-login-and-terms/passages.md] (H4-codex-2b, H4-codex-2e).

What the Cloudflare pattern changes (argued, not tried). A Worker that holds one OAuth token and injects it would be the only
refresher, so OpenAI's single-use refresh problem would not arise. It would also make the Worker a store and intermediary of
subscription tokens, which is the thing Anthropic's page bars third-party developers from and OpenAI's app-server page calls
never permitted for hosted services. The vendors' own gateway pages do not describe that arrangement: OpenAI's has Codex
send its ChatGPT credentials to a gateway that can see them, and Anthropic's keeps the saved login on the client and asks
the gateway to forward the `anthropic-beta` header (H3-codex-3, H3-claude-3). Anthropic's compliance page also says that
running Claude Code in hosted sandboxes needs its Commercial Terms and that each end user authenticate with their own
credentials (H4-claude-2); whether one person's own sandbox counts as "offering" it is not defined. For a person's own
account the pages do not say. This is an ambiguity to take to the vendors in writing, and not one to settle by inference.

Two more facts that bear on a choice. Meta's `muse-spark-1.3-contributor` is the discounted tier "in exchange for
permission to use your prompts and completions to train future Meta models"; its terms bar submitting "sensitive,
confidential, or personal information" to it, including code a user must keep confidential, and a subscription gives no
discount for choosing it. And
Anthropic's own sanctioned cloud routes exist: cloud sessions on Pro, Max, Team and Enterprise with premium seats, and
self-hosted environments (public beta) on Team and Enterprise
[@articles/anthropic-claude-code-login-and-terms/passages.md] (H6-claude-3, H1-claude-8).

## Cost

### What Cloudflare would charge

The model bill is left out here; it is the same on any host and is at the end of this section. What Cloudflare itself
charges, at list rates read on 2026-10-08:

| Part | What it charges | What it comes to |
| --- | --- | --- |
| Plan | Workers Paid, $5 a month. It includes 25 GiB-hours of container memory, 375 vCPU-minutes and 200 GB-hours of disk, which is 2 to 3 container-hours (A10.1, B7) | $5 a month; list rates apply from the first run |
| Containers | Memory and disk as the instance type provisions them, for as long as the instance runs, idle or not, and CPU for active use only, in 10 ms steps (A10.1) | nearly all of the bill, below |
| Durable Object in front of a container | 128 MB for each active second, $12.50 per million GB-s with 400,000 GB-s a month included; each request or alarm is a billed request, $0.15 per million after the first million (A8.5) | $0.0056 an hour while active, about $0.13 for 24 hours |
| Workers and Workflows | Workers: 10 million requests a month then $0.30 per million, 30 million CPU ms then $0.02 per million. Workflows: 500,000 steps then $0.80 per 100,000 (B6, B7) | cents at this scale; request counts were not measured |
| R2, D1, Queues | Read for limits, not priced here (B18 to B20) | argued to be cents: a few JSON-lines segments a run |
| Egress | 1 TB a month included in North America and Europe (A10.1) | far below it (argued) |
| AI Gateway | Core features are free; a 5% fee applies only to credits bought through Cloudflare (B14, B17) | none with your own keys |

### Container time

Every launch in a container of its own, from the lane audit's times
[@trials/2026-10-08-cloudflare-run-cost/results/instance-time.md]. A launch is one lane, one reviewer or one coachman
leg.

| Role (18 real runs) | Launches | Total hours | Median run, hours | Median launch, minutes |
| --- | --- | --- | --- | --- |
| Workhorse lanes | 36 | 65.8 | 2.1 (both lanes) | 64 |
| Reviewers | 289 | 122.3 | 3.1 | 17 |
| Coachman, floor (last process of each thread, 14 runs with session exports) | | | 3.6 | |
| Coachman, ceiling over the same 14 runs (every stage a leg can run in) | 14 runs | | 18.8 | |
| Coachman, ceiling over all 18 runs | 18 runs | 476.5 | 23.8 | |
| Gate runs on lane branches, inside the coachman | 36 | 6.5 | 0.4 | 12 |
| Gate runs on the synthesis, inside the coachman | 260 | 43.5 | 2.1 | 12 |

The coachman is bracketed because the records do not hold its process time for every leg. The floor leaves out earlier
processes of a resumed thread, and the ceiling counts the user's wait for a spec review. The four runs without session
exports are the longest by stage seconds (39.6 to 68.2 hours), so the floor and its ceiling describe the shorter runs; the
table below uses both over the same 14 runs, and with the 18-run ceiling its largest cell would read $12, not $9.60. The
reviewer row covers the 289 reviewers that have a recorded time; the model bill below counts 308 reviewer launches, and
the 19 others have none, so reviewer hours read low. Lanes ran longer than an hour in
22 of 36 launches, longer than two hours in 5 and longer than six in 2, the longest 15 hours with restarts.

Cloudflare bills memory and disk for what the instance type provisions, for as long as it runs, and CPU for active use
only [@articles/cloudflare-containers-sandboxes/passages.md] (A10.1). One standard-4 hour is $0.113 with the CPU idle
and $0.401 with all four vCPUs busy; the audit has no CPU measurement, so the table brackets it. The Workers Paid plan,
$5 a month, includes 25 GiB-hours of memory, a little over two standard-4 hours.

| Scenario for the median real run | Container time, $ (CPU 0% busy) | (CPU 25% busy) | (CPU 100% busy) |
| --- | --- | --- | --- |
| Everything on standard-2 (1 vCPU, 6 GiB) | 0.50 to 1.37 | 0.65 to 1.80 | 1.12 to 3.09 |
| Everything on standard-3 (2 vCPU, 8 GiB) | 0.66 to 1.82 | 0.98 to 2.68 | 1.92 to 5.27 |
| Everything on standard-4 (4 vCPU, 12 GiB) | 0.98 to 2.71 | 1.61 to 4.43 | 3.49 to 9.60 |

Each cell runs from the coachman at its floor (3.6 hours) to the coachman at its ceiling (18.8 hours). That bracket is the
widest spread in the table: at standard-2 with the CPU idle it alone takes a cell from $0.50 to $1.37. Controls: the audit's published gate totals
come out of the new code unchanged (36 lane-branch runs and 6.5 hours, 260 synthesis runs and 43.5 hours); a lane's
2001 seconds are recomputed from its two timestamps; the same lane priced by hand ($0.0628314) matches; a run with
nothing in it reads zero everywhere. A second reader's arithmetic for one standard-4 hour agrees: $0.40104 busy and
$0.18504 at a quarter (A10.3). The Durable Object in front of a container adds $0.0056 an hour while it stays in
memory (A8.5). Egress is well under the 1 TB included: all input tokens of the 18 runs come to about 12 GB at four bytes a
token (argued).

The machine's own limits point the other way for sizing. The host capped a launch at 8 GiB, and a coachman was killed at that
cap and the cap raised to 16 GiB [@trials/2026-10-03-lane-audit/results/incidents.md]. The largest self-serve Cloudflare
instance has 12 GiB, so the standard-2 and standard-3 rows, at 6 and 8 GiB, may not fit a coachman or a gate.
Whether either fits was not measured.

### All 18 audited runs together

The 18 runs' records span 2026-09-28 to 2026-10-03. Together they hold 188 hours of lanes and reviewers and 48 to 477
hours of coachman: 48 is the floor over the 14 runs with session exports, and 477 is every stage hour of all 18. At list
rates, with no allowance taken off [@trials/2026-10-08-cloudflare-run-cost/results/cost.md]:

| Size | CPU busy | All 18 runs | Average run |
| --- | --- | --- | --- |
| standard-3 (2 vCPU, 8 GiB) | none | $18 to $51 | $2.81 |
| standard-3 | a quarter | $26 to $74 | $4.14 |
| standard-3 | all | $52 to $146 | $8.12 |
| standard-4 (4 vCPU, 12 GiB) | none | $27 to $75 | $4.17 |
| standard-4 | a quarter | $44 to $123 | $6.83 |
| standard-4 | all | $95 to $267 | $15 |

The low end leaves out the coachman of the four runs with no session export. The average run is the high end divided by
18. It is above the median run's cost because a few long runs dominate: the four longest by coachman stage time run 40 to
68 hours. CPU use was not measured. An agent that mostly waits on a model is likely nearer a quarter busy than all busy,
which is argued, not measured. The results file also has standard-2 (1 vCPU, 6 GiB), which may not fit a coachman. The
totals agree to a cent when summed from hours and when summed run by run, and read zero for no runs
([controls](../../raw/trials/2026-10-08-cloudflare-run-cost/results/controls.md), C21 to C23).

### Against a flat monthly price

A machine billed by the month costs the same however many runs it does. Cloudflare costs the $5 plan fee plus the average
run's cost for each run, which is $4.14 on standard-3 and $6.83 on standard-4 with a quarter of the CPU busy. The runs a
month at which the two cost the same, for example prices that a reader's own price replaces:

| Flat price a month | Runs a month, standard-3 | Runs a month, standard-4 |
| --- | --- | --- |
| $25 | 5 | 3 |
| $50 | 11 | 7 |
| $100 | 23 | 14 |
| $200 | 47 | 29 |

Below that many runs a month Cloudflare is cheaper, because idle time costs nothing; above it the flat machine is. The
table assumes the flat machine is big enough for the work, and this trial did not size that: the most launches running at
once was not measured. Cost is not the only difference. A flat machine runs the scripts as they are, has no 12 GiB ceiling
and needs none of the port work under [What breaks](#what-breaks-or-must-be-ported). Subscription logins sit on that one
machine, as they do today; the terms table's question about a cloud machine applies to it as it does to a container, but
the question of a Worker holding the token does not arise.

### The model bill, a side note

The same tokens cost the same on any host, so this does not bear on a comparison of Cloudflare with a flat-priced machine.
It is here because it is the larger figure. From the audit's token counts, split by kind from each launch's own stream, at each vendor's published price
[@trials/2026-10-08-cloudflare-run-cost/results/model-bill.md] [@articles/model-api-prices/passages.md]. About 95% of input
is cache reads, so the price of a cache read matters more than the plain input price.

| Role and model (18 real runs) | Launches | Dollars as measured | If no cache hit |
| --- | --- | --- | --- |
| Opus security review (`claude-opus-5-5`, the harness's own figure at list price) | 71 | 644 | 2,909 |
| Coachman (`muse-spark-1.3-contributor`, one row per run) | 14 runs | 11.75 | 149 |
| Codex lanes and reviewers (`gpt-6-luna`, `-sol`, `-astra`) | 137 | 28.3 | 186 |
| MiMo lanes and reviewers (`mimo-v2.6-pro`, pay-as-you-go price) | 136 | 19.6 | 321 |
| **All** | | **704** | |

Per run: mean $39.10, median $16.13, most $301. The Opus security review is 92% of the dollars: $35.79 a run on average,
$14.56 at the median. Everything else is $3.31 a run on average, $2.12 at the median. So the line that API credentials
would make costly is the Opus security review. The lanes cost little at API prices because their input is almost all cache
reads, at 1% to 10% of the plain input price. Whether the security review runs on a flat plan today is not in the records.

The coachman's price is the other lever. The table puts it on Meta's contributor tier ($0.10 / $0.002 / $0.20 per million
tokens: input, cached input, output), which lets Meta train on what is sent. On the standard tier ($1.25 / $0.15 / $4.25)
the coachman's tokens cost $331, not $11.75; the mean run is then $56.83 and the median $34.63, the Opus security
review is 63% of the dollars, and everything else is $19.05 a run at the median, not $2.12
[@trials/2026-10-08-cloudflare-run-cost/results/model-bill.md].

Controls: the token totals by role reproduce the audit's published ones (coachman 1478M in and 5253k out; codex
reviewers 119 launches and 240M in; codex workhorses 18 launches and 438M in; Opus 71 launches and $644.17). MiMo's output is
larger than the audit's because reasoning tokens, which MiMo reports apart, are counted as output; how Xiaomi bills
them is not stated, so that is an assumption. Claude Code's
reported dollars are list price: recomputed from each launch's own per-model tokens at the Opus 5.5 prices they fall inside
the bracket from all cache writes at five minutes to all at one hour for 61 of 61 launches that used only that model, and for
0 launches at Opus 4.1's prices. The audit's own token counts leave out cache reads for Claude Code and MiMo Code, so they
could not be priced as they stood. The standard-tier figure agrees to a cent whether it is summed launch by launch or
recomputed from the summed tokens, and re-pricing a model no launch used moves nothing
([controls](../../raw/trials/2026-10-08-cloudflare-run-cost/results/controls.md), C19 and C20).

Limits. The audited runs were not billed at these prices, so this is the price of the alternative and not a bill anyone
paid. The contributor model gives no discount under a subscription. Four of the 18 runs have no coachman session export. A
fixture lane's tokens were not measured; the audit's medians are 0.8M in and 20k out per workhorse.

## Isolation

The [lane isolation scan](https://github.com/brindlewick/postmaster/blob/cff24d1e493bf3083f04a0548808b4343c8a2d4a/raw/trials/2026-10-05-lane-isolation-scan/results.md)
(pull request 285, still open) read 60 workhorse-lane streams in 30 runs; the coachman, the reviewers and the postmaster
were not read. Nothing there is retested. This table sets what it found against what a container per lane is documented
to isolate. Whether each reach would really be stopped is argued from the documented design, not tried.

| Reach the scan found | Streams | A container per lane, with a clone of the base only | What stays open |
| --- | --- | --- | --- |
| A lane read the other lane's plan commit through `git log --all` | 1 | Stopped: no object store is shared | If lanes push to one remote, a lane that can fetch it can read the others' branches |
| The run's shared worktree reached, with the blind tests inside | 2 | Stopped: the container holds no shared worktree | The tests are safe only if they are on no ref the container can fetch, and are run by the coachman in another container |
| Other branches and worktrees listed or searched | 8 | Stopped for any branch not in the clone | A clone of the whole remote shows every remote branch |
| The machine config, the run's records, the agent's private memory read | 6 | Stopped: none is on the container's disk unless copied in | What is copied in, the ticket, the brief, the harness's own login, is readable |
| The other lane's launch command seen in a process list (not a reach) | 6 | Stopped: the instance is a microVM with its own process space | |
| A review lane is said to have signalled every process of the session on 2026-10-01 (an incident; the cause is the ticket's account, unverified, and the audit's, not the scan's) | | Stopped: a signal reaches only the instance | |

What no container changes. Inside a deployed container "every process has the same Linux capabilities as `root`", so the
container is the smallest unit of trust, and one container per lane, not one per tool call [@articles/cloudflare-containers-sandboxes/passages.md]
(A5.6, A6.2). Anything put in a sandbox, a key or a file, "all the code there can read ... and send it anywhere the
sandbox can reach" (A6.3). The pages disagree on the network default: the Sandbox 1.0 pages say a container has no
Internet unless `start()` passes `enableInternet: true`, and the `Container` class page says the option defaults to `true`,
so a design passes it explicitly. Either way a handler can intercept HTTP and HTTPS, not SSH or other ports (A4.1, A4.5,
A4.12). A clone can be limited to one repository by
a Worker gateway that allows `git-upload-pack` for it alone, so a push from the sandbox fails with 403 (A6.4); that
limits the repository, and a limit by branch is not shown (A6.6). Handing work back is the part the lane cannot be trusted
with: the documented way is a `git diff` read with `exec` (A6.5); a bundle or a patch could be made and read the same way, and
a container can reach an R2 bucket through a virtual host the Worker resolves (A4.8), though no page does either for a lane.
Whatever the lane writes there is its own word.

A local route to most of this exists without Cloudflare. [#203, Cut each lane as a shared clone of the repository, so it cannot
read another lane's commits](https://github.com/brindlewick/postmaster/issues/203) and [#221, Run every lane with only the
files, hosts and sockets it needs, on Linux and macOS](https://github.com/brindlewick/postmaster/issues/221) are filed, as is
[#342, Every reviewer works in its own copy of the repository](https://github.com/brindlewick/postmaster/issues/342), and
[the confinement page](lane-confinement.md) records that a sandbox around the harness stopped every reach in its trial. A
virtual machine per lane on any provider gives the same isolation properties; nothing in this section is special to Cloudflare.

## What breaks or must be ported

- **Instance lifetime.** "Code that runs inside the instance does not count as activity." A lane in a container is not
  alive to the platform unless a request, an alarm or a held-open call keeps its Durable Object active. The inactivity
  timeout is at most 6 hours. The documented fix is an alarm every minute that checks the work (A1.15, A7.1). When no client
  stays connected, each pending call keeps a Durable Object in memory for at most 15 minutes, so a held-open call alone is
  not enough; while a connected client's request is open the object stays active, which is argued, not stated, for `exec()`
  (A1.13, A1.25). Cloudflare "does not guarantee that any container instance will run for a set period", and a stop for a
  host move gives `SIGTERM`, up to 15 minutes, then `SIGKILL` (A1.5, A1.6); after an inactivity timeout every process in the
  instance gets `SIGTERM` and the instance stops "shortly after", whether or not the processes exit (A1.26). A lane must be
  resumable, and the flow's lanes already commit and resume.
- **The runtime does not tell the control plane when a container stops**, and the handle `exec()` returns dies with the
  request that made it. The pattern is `setsid`, a pid file, an exit-code file and polling (A1.22, A5.3, A5.4). The
  exception is `monitor()`, which reports the main process's exit while the Durable Object is in memory (A1.10).
- **Deploys.** The sequence of SIGTERM, up to 15 minutes, then SIGKILL is for `default`-policy rollouts, and for host
  moves under either policy. Under the `durable_object` policy, which the documentation lists as best for sandboxes and
  agent environments, "A running instance keeps running" through a deploy; the restarted Durable Object
  loses its timeout and must set it again (A1.17). That policy and snapshots are in public beta, Sandbox SDK 1.0 runs only
  on them (the SDK itself is "available"), and the policy has no `max_instances` and no placement constraints (A9.1,
  A3.7). In AI Gateway, stored keys and spend limits are badged Beta, and Unified Billing sits in a Beta-badged sidebar
  group (B13, B22). Containers and Sandboxes were announced generally
  available on 2026-04-13. Users report a rollout shown complete while the old image served, capacity errors on start,
  and a Worker deleted with its container application still billing (A-TP.2, A-TP.3, A-TP.6, in
  [@articles/cloudflare-containers-issue-reports/passages.md]).
- **The disk is ephemeral**, 20 GB at most. A stop, a sleep or a host move loses it. A snapshot (beta) keeps the root
  filesystem, not processes, 20 GB at most for 30 days; a directory backup to R2 is documented. The harnesses' session
  stores must survive for a resume, and for Muse Code and MiMo Code the flow checks that a thread is in the launch's own
  data directory before it resumes (A2.1 to A2.4; [the adapter file](../../skills/postmaster/harnesses.md)).
- **The gate.** A median 12 minutes and at most 21 in the audit's 296 runs, on the shared machine. A container has its own CPU, up to 4
  vCPU and 12 GiB. The speed there was not measured. The target's toolchain must be in an image, and the image counts
  against 50 GB of image storage.
- **The scripts.** Of the 69 scripts of the flow, 44 import the shared process helpers, 18 read the home directory or
  `~/.postmaster`, 13 start processes directly, 10 name marker, pid or lock files, 6 run `git worktree`, 6 signal
  processes, 5 read `/proc`, 2 make symbolic links, 2 use `bwrap` or `sandbox-exec` (one to wrap a harness, one to probe
  for them), 1 uses systemd scopes and 1 drives Herdr or tmux. The seven scripts that test the flow itself are not counted.
  They assume the roles share one filesystem and one process table. In containers each role has a private disk, so the
  run folder needs a store the roles reach over the network ([the script table](../../raw/trials/2026-10-08-cloudflare-run-cost/results/script-primitives.md),
  which names the files behind each count).
- **Event streams and the action log.** Several processes append to a JSON-lines file. No append call is listed for R2,
  which takes one write a second to a key, and a bucket mount renames by copying and has no locks (B18, A2.5). Segments in
  R2 or rows in Durable Object SQLite fit; a shared file does not.
- **The host.** Herdr and tmux have no counterpart. A browser terminal over WebSocket on a tmux session is documented.
  [#332, Sessions the flow opens for the user run the harness as the pane's own process, so the chat app lists
  them](https://github.com/brindlewick/postmaster/issues/332) shows the user's chat app lists a session by the process that
  leads its pane; a terminal in a container would have to meet the same rule (unverified).
- **Bubblewrap and systemd inside the instance.** Whether user namespaces, `bwrap` or cgroups work inside a container is
  undocumented (A3.5). The flow's `confine` setting would not be needed there. Muse Code's own sandbox needs bubblewrap
  unless `--yolo` is passed, and the flow passes it.
- **Self-updating harnesses and first downloads.** Muse Code downloads its binary from its vendor's hosts at first use and
  updates itself unless told not to; an image would pin versions. Muse's terms do not say whether putting the binary in an
  image is making it available to a third party.
- **Concurrency and accounts.** An account may run 1,500 vCPU at once, which is 375 standard-4 instances or 750 standard-3,
  against about 8 containers for a run (argued from A3.2). The cap on runs is the user's, not the platform's.

## The smallest trial

One lane of one fixture run in a sandbox. What to build is a ticket's work, not this page's. What it would show:

1. A harness runs headless in a sandbox from an image to the end of a fixture lane (a median 7 minutes in the audit).
2. The model key never enters the sandbox: the lane sends a placeholder and the Worker adds the key.
3. The lane's branch comes back by a diff or bundle through the Worker and scores the same on the fixture's hidden tests as
   a local lane's did: every one of the 44 fixture lane branches that could be scored passed all of them
   [@trials/2026-10-03-lane-audit/results/workhorses-fixture.md].
4. How many container seconds and dollars one lane costs, and how the alarm keeps the instance alive.

Prerequisites that are the user's to decide: a Cloudflare account on the Workers Paid plan ($5 a month), a model
credential in AI Gateway (Cloudflare credits carry a 5% fee on what is bought), and which harness. Of the audited lanes whose
harness Cloudflare has a tutorial for (claude and codex), the cheapest is codex on `gpt-6-luna`, at $0.10 per million input
tokens and $0.01 cached; the Muse contributor and MiMo flash lanes cost less per token and have no tutorial. At the audit's
fixture medians a lane's container time is cents, so the Cloudflare cost of a first trial is the $5 plan fee and cents.
The model spend for one lane is a few cents more, paid from a few dollars of credit (with the 5% fee on the top-up) or on
the user's own key. The effort to build it was not estimated.

It would not show parallel lanes, a coachman, a lane over an hour, a forced deploy, the gate on 4 vCPU, or a subscription
login. A second trial would cover a 90-minute lane and a deploy during it, which is what the lifetime pages say matters.

## What was not checked

- Nothing was run on Cloudflare. Every Cloudflare finding is what the documents, the changelog, open-source code and
  issue reports say. Whether a lane fits 12 GiB, how fast the gate runs on 4 vCPU, how often a platform stop happens,
  and whether `bwrap` works inside an instance are not known.
- Dynamic Workers, Workers Logs pricing, Secrets Store, whether each intercepted request is billed as a Worker request, and
  any SLA outside the Containers and Sandbox pages.
- The Wrangler configuration reference was read only through the fetch tool, and the tool did not read its last 3,261
  characters [@articles/cloudflare-containers-sandboxes/passages.md] (A-NOTCHECKED).
- The documentation text was read as a repository checkout. Ten claims were also read on the published pages
  (A-CHECK), and for the control-plane pages B1, B2, B3, B5 and B12 to B14 were (B-SECOND); the rest were not
  [@articles/cloudflare-control-plane/passages.md] (B-NOTCHECKED). Fetch-tool answers are cut at about 125 characters, so
  long quotations were compared against the repository text instead
  ([quote check](../../raw/trials/2026-10-08-cloudflare-run-cost/results/quote-check.md)).
- Vendor terms: OpenAI's policy pages were read as third-party copies. xAI's terms returned 403. Xiaomi's user agreement is
  rendered by script and was not read. Anthropic's Commercial Terms were read in one pass. The 2026-11-12 usage policy
  page has no announcement anywhere that was found. OpenAI's and Anthropic's plan prices were not gathered; Meta's and
  Xiaomi's are in the captures.
- The lane isolation scan was read from its branch and not re-run. The coachman's process time, the CPU use of any
  launch and the gate's speed in a container are bracketed or unknown.
- Whether a subscription login held in a Worker and injected in place of a placeholder works for Codex or Claude Code at
  all was not tried. The vendors' gateway pages describe a gateway that forwards a login the client holds; Cloudflare's
  retired example, whose contributor wrote that it worked, covers Claude Code only, and nothing found shows Codex.

## What would change the answer

- A trial on Cloudflare that runs a fixture lane to a passing score with the key outside the sandbox: toward supported
  for the lane. A trial that cannot keep a 90-minute lane alive through a deploy names what the lifetime pages lack.
- A vendor's written answer on a subscription login in a cloud container, for Anthropic or OpenAI. Either answer
  changes what the lanes' model access costs, and whether the Cloudflare pattern can carry a subscription login at all,
  more than any other fact here.
- The `durable_object` policy and snapshots leaving beta, or Cloudflare adding an SSH egress proxy or placement
  constraints for that policy.

## Proposed tickets

None is filed. Titles are in the form the repository uses.

1. **A fixture lane runs in a Cloudflare sandbox with its model key held outside it.** The smallest trial above.
   Needs the user's account, the $5 plan fee and a few dollars of credit.
2. **A run's records are kept behind one store that roles on different machines can reach.** The run folder as a service
   (an action log, event streams, markers), before any role moves off the machine it runs on. It helps any second
   machine, not only Cloudflare.
3. **A run chooses, for each role, a subscription login or an API key, and the choice is checked before the run starts.**
   The decision the terms leave open, made visible. This is model-side, the same on any host. The Opus security review is
   the line that decides it, at $14.56 to $35.79 a run at API prices.
4. **The security review runs only where a change touches a risk surface.** From the lane audit's candidate list, now
   with a price (model-side, the same on any host): 92% of the model dollars at list price while the coachman is on Meta's
   contributor tier, 63% on its standard tier.
5. **The gate is timed on a machine with 4 vCPU and nothing else running.** Any cloud machine will do. It separates the
   gate's own time from the machine's load, which is half of the reason for this research.
6. **Not new: finish #203, #221 and #342 first.** They give most of the isolation locally and are filed.

Not a ticket: ask Anthropic and OpenAI, in writing, whether a person's own subscription login may be held by their
own Worker and used from their own containers. Only the user can ask.

## Evidence

[@trials/2026-10-08-cloudflare-run-cost/method.md] and its results; the captures
[@articles/cloudflare-containers-sandboxes/source.md], [@articles/cloudflare-containers-issue-reports/source.md],
[@articles/cloudflare-control-plane/source.md], [@articles/cloudflare-ai-gateway/source.md],
[@articles/openai-codex-login-and-terms/source.md], [@articles/anthropic-claude-code-login-and-terms/source.md],
[@articles/meta-muse-code-login-and-terms/source.md], [@articles/xiaomi-mimo-code-login-and-terms/source.md],
[@articles/other-harnesses-login-and-terms/source.md], [@articles/model-api-prices/source.md]; the audit it builds on,
[@trials/2026-10-03-lane-audit/method.md]. See also [several lanes](several-lanes.md), [lane confinement](lane-confinement.md)
and [the adapter files](../../skills/postmaster/harnesses.md).
