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
Claude Code, Codex and Pi headless in a container with the model key held in the Worker, and they show that for API
credentials only. Whether a subscription login may be used from a cloud container is not settled by any vendor's
words. Container time is the small part of the cost. The large part is the model bill at pay-per-token prices, and 92% of
that is the Opus security review. [Issue #341](https://github.com/brindlewick/postmaster/issues/341), "Research: could postmaster's
flow run on Cloudflare, with Workers as the control plane and Containers for the lanes?", asks the question.

**Standing: claimed.** Everything below about Cloudflare and the vendors is what their documents, code and
changelogs say on 2026-10-08. Nothing was run on Cloudflare: no account, no deploy, no instance. The one count made from
this fleet's records is arithmetic on the lane audit's times and tokens
[@trials/2026-10-08-cloudflare-run-cost/method.md]. Its [controls](../../raw/trials/2026-10-08-cloudflare-run-cost/results/controls.md)
show the code applies each rule the same way to cases that must read non-zero and cases that must read zero. They
cannot show that Cloudflare behaves as documented. By [the schema](../schema.md) outside documents do not move a
standing.

## The answer

1. **A Worker cannot run a lane.** It has 128 MB of memory, `node:child_process` is a non-working stub, and its
   filesystem is held in that memory [@articles/cloudflare-control-plane/passages.md] (B1, B3, B4).
2. **A container can.** "Each instance is a microVM with its own kernel and network, so no other workload shares it."
   The largest is 4 vCPU, 12 GiB and 20 GB [@articles/cloudflare-containers-sandboxes/passages.md] (A6.2, A3.1).
   Cloudflare publishes a runnable tutorial for Claude Code, Codex, Pi and OpenCode (A7). Three of those are among
   the flow's seven harnesses.
3. **Cloudflare shows the model key staying outside the sandbox for API credentials only.** The sandbox holds a placeholder;
   the Worker adds the real key, through AI Gateway credits or a stored provider key. No Cloudflare page shows a subscription login
   [@articles/cloudflare-containers-sandboxes/passages.md] (A7.6) [@articles/cloudflare-ai-gateway/passages.md] (B12, B13, B21; a search of the AI Gateway, Agents, Sandbox and Containers documentation for a subscription login found none).
4. **The vendors' words leave a subscription login open.** OpenAI says "The right way to authenticate automation is
   with an API key", documents a ChatGPT login on a trusted private runner as an advanced option, and says not to share
   one `auth.json` across concurrent jobs or machines. Anthropic documents a one-year token for CI and bars third-party
   developers from routing or intermediating plan credentials. Meta limits a subscription credential to its own harness.
   Xiaomi limits a Token Plan to programming tools and names "automated scripts". Details in
   [Logins and terms](#logins-and-terms).
5. **Container time costs little.** A median real run, with every launch in a container of its own, is $0.50 to $12 at
   list rates, depending on the instance size and how busy the CPUs are, and $0.65 to $5.37 with a quarter of the
   CPU busy. The same run's model tokens at API prices are $16 (median) or $39 (mean), of which the Opus security
   review is $14.56 (median) or $35.79 (mean) [@trials/2026-10-08-cloudflare-run-cost/results/cost.md]
   [@trials/2026-10-08-cloudflare-run-cost/results/model-bill.md].
6. **A container per lane stops every reach the isolation scan found inside the machine** and leaves open the network, the
   git remote, the hand-back of work and where the blind tests live ([Isolation](#isolation)).
7. **What breaks is mostly the single-machine assumptions.** Code in a container is not "activity" to the platform, the
   control plane must keep it alive and poll it, the disk is ephemeral, the platform piece Cloudflare steers new
   projects to is in public beta, and the scripts lean on one machine's files and processes ([What breaks](#what-breaks-or-must-be-ported)).
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
| Reviewers | A headless harness in a scratch clone | A container each | Fits, as lanes do |
| The gate | The project's checks, a median 12 minutes, run in the coachman's worktree | Inside the coachman's container, or a fresh one to run in parallel; at most 4 vCPU and 20 GB; the image must carry the target's toolchain | Unknown speed. Not measured here |
| Scripts | TypeScript on Bun that read and write files and start processes | Run unchanged in a Linux amd64 container | A port: 76 scripts, 46 import the shared process helpers, 23 touch marker, pid or lock files ([script table](../../raw/trials/2026-10-08-cloudflare-run-cost/results/script-primitives.md)) |
| Run records, action log, event streams | Files under the project's run folder, appended by several processes | R2 for blobs (strongly consistent, no append, one write a second to a key); Durable Object SQLite for the ledger (10 GB an object); D1 for queries across runs; Queues for fan-in (128 KB a message). A bucket mount is not a local disk: "File locks, hard links, ownership, permissions, and atomic replacement do not work as they do on a local filesystem" | A port (B18 to B20, A2.5) |
| Session host and dashboard | Herdr or tmux panes, a read-only page over Tailscale | A browser terminal on tmux is a documented pattern; Workers with Access could serve a dashboard; nothing like Herdr | A fourth host to write |
| Model access | Each harness's own login or key | AI Gateway: stored keys, Cloudflare credits with a 5% fee, spend limits, logs, a scan for secrets | Covers API credentials (B12 to B17) |
| Tracker and git | GitHub | Unchanged; a container reaches GitHub over HTTPS through a Worker handler that adds the token | Fits; SSH cannot be intercepted (A4.5, A6.4) |

Two things in the ticket's own text are corrected by the pages. A Worker does have a filesystem, held in memory. And the
ten idle minutes, and a deploy that sends SIGTERM and then SIGKILL after fifteen, belong to the `default` scheduling
policy, not to the one Cloudflare steers new projects to (A1.18).

## Logins and terms

### What each harness needs to log in and run headless

The seven harnesses are in [the adapter file](../../skills/postmaster/harnesses.md). Four ran in the audited runs (codex,
mimo, claude, muse). The table says what each takes, whether it can be pointed at another base URL with a placeholder
credential (the Cloudflare pattern), and whether Cloudflare shows it.

| Harness | Headless routes | Another base URL, placeholder key | Cloudflare shows it | Pattern covers |
| --- | --- | --- | --- | --- |
| codex | `CODEX_API_KEY`; `codex login --device-auth`; a copied `auth.json`; access tokens on Business and Enterprise | A custom provider with `base_url` and `env_key`; only the Responses API | AI Gateway page and sandbox tutorial | API key: yes. A ChatGPT login: OpenAI documents a gateway for it on its Enterprise pages, Cloudflare does not show it |
| claude | `ANTHROPIC_API_KEY`; `CLAUDE_CODE_OAUTH_TOKEN`, a one-year token from `claude setup-token` | `ANTHROPIC_BASE_URL` and a custom header | AI Gateway page and sandbox tutorial | API key: yes. A subscription login: Anthropic's gateway page says a gateway can carry it if it forwards the `anthropic-beta` header; Cloudflare does not show it |
| muse | `META_API_KEY`; a stored key; a browser login | No documented setting. Meta's own SDK test fixture sets `endpoint_transport.base_url` in `settings.json` | No | An API key only through that undocumented setting |
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
be the only holder. A login to Meta's subscription yields a key that lives about a day, and its identity token cannot be
renewed, by the comments in pi's code (a third party's account of Meta's behaviour, not Meta's own words)
[@articles/other-harnesses-login-and-terms/passages.md]. Meta's contributor tier is also limited to 100 requests a minute and
3,000,000 tokens a minute for a whole team, which a fleet of parallel lanes would share
[@articles/meta-muse-code-login-and-terms/passages.md].

### What the vendors' terms say

The deciding sentences, with the document that holds each. "Not said" means the documents were read for it and are
silent; silence is not read as permission.

| Vendor | Documents allow | Documents bar or discourage | Not said |
| --- | --- | --- | --- |
| OpenAI (Codex) | Copying your own `auth.json` to your own headless machine. A ChatGPT-managed login on a trusted private CI runner, "an advanced workflow for enterprise and other trusted private automation". API keys for any automation | "Do not share the same file across concurrent jobs or multiple machines." "Do not use this workflow for public or open-source repositories." The consumer terms bar sharing credentials or making the account "available to anyone else". "App-server authentication has never been permitted for commercial or hosted services." (about app-server sign-in, not `codex exec`) | Whether a Plus or Pro login may run in a vendor-neutral cloud container. Whether "Automatically or programmatically extract data or Output" reaches `codex exec` |
| Anthropic (Claude Code) | `claude setup-token` and `CLAUDE_CODE_OAUTH_TOKEN` "for CI pipelines and scripts"; the same token as a GitHub Actions secret on Pro, Max, Team and Enterprise. An end user signing in to "the unmodified Claude Code binary with their own Claude subscription, including where a platform hosts Claude Code" | Third-party developers may not "route requests through Free, Pro, or Max plan credentials on behalf of their users" and "may not collect, store, or intermediate Claude.ai credentials or session tokens". The consumer terms bar automated or non-human access "except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it". A usage policy page dated to take effect 2026-11-12 adds a bar on services that "route requests through consumer subscriptions" | Whether the user's own CI job on a rented machine is "automated or non-human means" or is access Anthropic has explicitly permitted. Whether a Worker that holds the user's own token is an "intermediary". A cap on concurrent sessions |
| Meta (Muse Code) | Pay-as-you-go keys in any tool. `muse exec` in CI with `META_API_KEY`. `--yolo` "in a disposable, isolated container" | A subscription credential "is for use only with the coding harness under your Coding Harness Subscription". Keys may not be shared with a third party, including through "any model aggregator, API gateway, proxy, or similar offering" | Whether baking the binary into an image "makes it available to a third party". Whether your own egress proxy is a third party's |
| Xiaomi (MiMo Code) | MiMo Code is a listed tool; the same package works in several tools | "The quota of the Token Plan package is only available for use in programming tools ... and it is prohibited to use it in the form of API calls for request behaviors in obvious non-coding scenarios such as automated scripts and custom application backends." | Whether an unattended coding agent in a container is on either side. The user agreement could not be read |
| xAI (grok), Google (agy) | Headless is a feature of each; API keys | Google: "Using third party software, tools, or services to access the Service (e.g. using OpenClaw with Antigravity OAuth) is a breach of this Agreement" | xAI's terms returned 403; Google's say nothing on CI or cloud machines |

OpenAI's own policy pages answered 403 to the fetch tool. The Terms of Use text was read through a public text
converter and the Open Terms Archive copies, which are third-party copies of the vendor's pages
[@articles/openai-codex-login-and-terms/source.md]. That is stated where the passages are.

What the Cloudflare pattern changes (argued, not tried). A Worker that holds one OAuth token and injects it would be the only
refresher, so OpenAI's single-use refresh problem would not arise. It would also make the Worker a store and intermediary of
subscription tokens, which is the thing Anthropic's page bars third-party developers from and OpenAI's app-server page calls
never permitted for hosted services. For a person's own account the pages do not say. This is an ambiguity to take to the
vendors in writing, and not one to settle by inference.

Two more facts that bear on a choice. Meta's `muse-spark-1.3-contributor` is the discounted tier "in exchange for
permission to use your prompts and completions to train future Meta models"; its terms tell users not to send code they
must keep confidential to it, and a subscription gives no discount for choosing it. And Anthropic's own sanctioned cloud
routes exist: cloud sessions on Pro, Max and Team, and self-hosted environments (public beta) on Team and Enterprise
[@articles/anthropic-claude-code-login-and-terms/passages.md].

## Cost

### Container time

Every launch in a container of its own, from the lane audit's times
[@trials/2026-10-08-cloudflare-run-cost/results/instance-time.md]. A launch is one lane, one reviewer or one coachman
leg.

| Role (18 real runs) | Launches | Total hours | Median run, hours | Median launch, minutes |
| --- | --- | --- | --- | --- |
| Workhorse lanes | 36 | 65.8 | 2.1 (both lanes) | 64 |
| Reviewers | 289 | 122.3 | 3.1 | 17 |
| Coachman, floor (last process of each thread, 14 runs) | | | 3.6 | |
| Coachman, ceiling (every stage a leg can run in, 18 runs) | 18 runs | 476.5 | 23.8 | |
| Gate runs on lane branches, inside the coachman | 36 | 6.5 | 0.4 | 12 |
| Gate runs on the synthesis, inside the coachman | 260 | 43.5 | 2.1 | 12 |

The coachman is bracketed because the records do not hold its process time for every leg. The floor leaves out earlier
processes of a resumed thread, and the ceiling counts the user's wait for a spec review. Lanes ran longer than an hour in
22 of 36 launches, longer than two hours in 5 and longer than six in 2, the longest 15 hours with restarts.

Cloudflare bills memory and disk for what the instance type provisions, for as long as it runs, and CPU for active use
only [@articles/cloudflare-containers-sandboxes/passages.md] (A10.1). One standard-4 hour is $0.113 with the CPU idle
and $0.401 with all four vCPUs busy; the audit has no CPU measurement, so the table brackets it. The Workers Paid plan,
$5 a month, includes 25 GiB-hours of memory, a little over two standard-4 hours.

| Scenario for the median real run | Container time, $ (CPU 0% busy) | (CPU 25% busy) | (CPU 100% busy) |
| --- | --- | --- | --- |
| Everything on standard-2 (1 vCPU, 6 GiB) | 0.50 to 1.65 | 0.65 to 2.18 | 1.12 to 3.74 |
| Everything on standard-3 (2 vCPU, 8 GiB) | 0.66 to 2.21 | 0.98 to 3.25 | 1.92 to 6.38 |
| Everything on standard-4 (4 vCPU, 12 GiB) | 0.98 to 3.28 | 1.61 to 5.37 | 3.49 to 12 |

Each cell runs from the coachman at its floor to the coachman at its ceiling. Controls: the audit's published gate totals
come out of the new code unchanged (36 lane-branch runs and 6.5 hours, 260 synthesis runs and 43.5 hours); a lane's
2001 seconds are recomputed from its two timestamps; the same lane priced by hand ($0.0628314) matches; a run with
nothing in it reads zero everywhere. A second reader's arithmetic for one standard-4 hour agrees: $0.40104 busy and
$0.18504 at a quarter (A10.3). The Durable Object in front of a container adds $0.0056 an hour while it stays in
memory (A8.5). Egress is well under the 1 TB included: all input tokens of the 18 runs come to about 12 GB at four bytes a
token (argued).

The machine's own limits point the other way for sizing. The host capped a launch at 8 GiB, and a coachman was killed at that
cap and the cap raised to 16 GiB [@trials/2026-10-03-lane-audit/results/incidents.md]. The largest Cloudflare instance has 12 GiB.
Whether a coachman or a gate fits was not measured.

### The model bill, if API keys replace subscription logins

From the audit's token counts, split by kind from each launch's own stream, at each vendor's published price
[@trials/2026-10-08-cloudflare-run-cost/results/model-bill.md] [@articles/model-api-prices/passages.md]. About 95% of input
is cache reads, so the price of a cache read matters more than the plain input price.

| Role and model (18 real runs) | Launches | Dollars as measured | If no cache hit |
| --- | --- | --- | --- |
| Opus security review (`claude-opus-5-5`, the harness's own figure at list price) | 71 | 644 | 2,909 |
| Coachman (`muse-spark-1.3-contributor`, 14 runs) | 14 | 11.75 | 149 |
| Codex lanes and reviewers (`gpt-6-luna`, `-sol`, `-astra`) | 137 | 28.3 | 186 |
| MiMo lanes and reviewers (`mimo-v2.6-pro`, pay-as-you-go price) | 136 | 19.6 | 321 |
| **All** | | **704** | |

Per run: mean $39.10, median $16.13, most $301. The Opus security review is 92% of the dollars: $35.79 a run on average,
$14.56 at the median. Everything else is $3.31 a run on average, $2.12 at the median. So the line that API credentials
would make costly is the Opus security review. The lanes cost little at API prices because their input is almost all cache
reads, at 1% to 10% of the plain input price. Whether the security review runs on a flat plan today is not in the records.

Controls: the token totals by role reproduce the audit's published ones (coachman 1478M in and 5253k out; codex
reviewers 119 launches and 240M in; codex workhorses 18 launches and 438M in; Opus 71 launches and $644.17). MiMo's output is
larger than the audit's because reasoning tokens, which MiMo reports apart and bills as output, are counted. Claude Code's
reported dollars are list price: recomputed from each launch's own per-model tokens at the Opus 5.5 prices they fall inside
the bracket from all cache writes at five minutes to all at one hour for 61 of 61 launches that used only that model, and for
0 launches at Opus 4.1's prices. The audit's own token counts leave out cache reads for Claude Code and MiMo Code, so they
could not be priced as they stood.

Limits. The lanes ran on subscriptions, so this is the price of the alternative and not a bill anyone paid. The
contributor model gives no discount under a subscription. Four of the 18 runs have no coachman session export. A fixture
lane's tokens were not measured; the audit's medians are 0.8M in and 20k out per workhorse.

## Isolation

The [lane isolation scan](https://github.com/brindlewick/postmaster/blob/cff24d1e493bf3083f04a0548808b4343c8a2d4a/raw/trials/2026-10-05-lane-isolation-scan/results.md)
(pull request 285, still open) read 60 lane streams in 30 runs. Nothing there is retested. This table sets what it found
against what a container per lane is documented to isolate. Whether each reach would really be stopped is argued from the
documented design, not tried.

| Reach the scan found | Streams | A container per lane, with a clone of the base only | What stays open |
| --- | --- | --- | --- |
| A lane read the other lane's plan commit through `git log --all` | 1 | Stopped: no object store is shared | If lanes push to one remote, a lane that can fetch it can read the others' branches |
| The run's shared worktree reached, with the blind tests inside | 2 | Stopped: the container holds no shared worktree | The tests are safe only if they are on no ref the container can fetch, and are run by the coachman in another container |
| Other branches and worktrees listed or searched | 8 | Stopped for any branch not in the clone | A clone of the whole remote shows every remote branch |
| The machine config, the run's records, the agent's private memory read | 6 | Stopped: none is on the container's disk unless copied in | What is copied in, the ticket, the brief, the harness's own login, is readable |
| The other lane's launch command seen in a process list (not a reach) | 6 | Stopped: the instance is a microVM with its own process space | |
| A review lane signalled every process of the session on 2026-10-01 (an incident) | | Stopped: a signal reaches only the instance | |

What no container changes. Inside a deployed container "every process has the same Linux capabilities as `root`", so the
container is the smallest unit of trust, and one container per lane, not one per tool call [@articles/cloudflare-containers-sandboxes/passages.md]
(A5.6, A6.2). Anything put in a sandbox, a key or a file, "all the code there can read ... and send it anywhere the
sandbox can reach" (A6.3). The network is open unless closed: a container starts without Internet only when asked, and
a handler can intercept HTTP and HTTPS, not SSH or other ports (A4.1, A4.5). A clone can be limited to one repository by
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
  timeout is at most 6 hours. The documented fix is an alarm every minute that checks the work (A1.15, A7.1). A pending
  call keeps a Durable Object in memory for 15 minutes at a time, so a single held-open call is not enough (A1.13).
  Cloudflare "does not guarantee that any container instance will run for a set period", and a stop for a host move gives
  `SIGTERM`, up to 15 minutes, then `SIGKILL` (A1.5, A1.6). A lane must be resumable, and the flow's lanes already commit
  and resume.
- **The runtime does not tell the control plane when a container stops**, and the handle `exec()` returns dies with the
  request that made it. The pattern is `setsid`, a pid file, an exit-code file and polling (A1.22, A5.3, A5.4).
- **Deploys.** The sequence of SIGTERM, up to 15 minutes, then SIGKILL is for `default`-policy rollouts. Under the
  `durable_object` policy, which new projects are steered to, "A running instance keeps running" through a deploy; the restarted Durable Object
  loses its timeout and must set it again (A1.17). That policy, snapshots and Sandbox SDK 1.0 are in public beta, and the
  policy has no `max_instances` and no placement constraints (A9.1, A3.7). Containers and Sandboxes were announced generally
  available on 2026-04-13. Users report a rollout shown complete while the old image served, capacity errors on start,
  and a Worker deleted with its container application still billing (A-TP.2, A-TP.3, A-TP.6, in
  [@articles/cloudflare-containers-issue-reports/passages.md]).
- **The disk is ephemeral**, 20 GB at most. A stop, a sleep or a host move loses it. A snapshot (beta) keeps the root
  filesystem, not processes, 20 GB at most for 30 days; a directory backup to R2 is documented. The harnesses' session
  stores must survive for a resume, and the flow checks that a thread is in the launch's own data directory before it
  resumes (A2.1 to A2.4; [the adapter file](../../skills/postmaster/harnesses.md)).
- **The gate.** A median 12 minutes and at most 21 in the audit's 296 runs, on the shared machine. A container has its own CPU, up to 4
  vCPU and 12 GiB. The speed there was not measured. The target's toolchain must be in an image, and the image counts
  against 50 GB of image storage.
- **The scripts.** Of 76 scripts, 46 import the shared process helpers, 23 touch marker, pid or lock files, 21 read the home
  directory or `~/.postmaster`, 19 run `git worktree`, 18 start processes directly, 9 signal processes, 8 read `/proc`, 4
  drive Herdr or tmux, 2 use systemd scopes and 2 wrap a harness in `bwrap` or `sandbox-exec`. They all assume the
  roles share one filesystem and one process table. In containers each role has a private disk, so the run folder
  needs a store the roles reach over the network ([the script table](../../raw/trials/2026-10-08-cloudflare-run-cost/results/script-primitives.md)).
- **Event streams and the action log.** Several processes append to a JSON-lines file. R2 has no append, one write a
  second to a key, and a bucket mount renames by copying and has no locks (B18, A2.5). Segments in R2 or rows in Durable Object
  SQLite fit; a shared file does not.
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
credential in AI Gateway (Cloudflare credits carry a 5% fee on what is bought), and which harness. The cheapest lane is
codex on `gpt-6-luna`, at $0.10 per million input tokens and $0.01 cached. At the audit's fixture medians the model cost
of a lane is a few cents and its container time is cents, so a first trial costs the $5 plan fee and a credit top-up of a few dollars, with the 5% fee on the top-up. The effort to build it was not estimated.

It would not show parallel lanes, a coachman, a lane over an hour, a forced deploy, the gate on 4 vCPU, or a subscription
login. A second trial would cover a 90-minute lane and a deploy during it, which is what the lifetime pages say matters.

## What was not checked

- Nothing was run on Cloudflare. Every Cloudflare finding is what the documents, the changelog, open-source code and
  issue reports say. Whether a lane fits 12 GiB, how fast the gate runs on 4 vCPU, how often a platform stop happens,
  and whether `bwrap` works inside an instance are not known.
- Dynamic Workers, Workers Logs pricing, Secrets Store, whether each intercepted request is billed as a Worker request, and
  any SLA outside the Containers and Sandbox pages.
- The Wrangler configuration reference was read only through the fetch tool, and the tool did not read its last 3,261
  characters.
- The documentation text was read as a repository checkout; ten claims were also read on the published pages, and the
  six control-plane figures. Fetch-tool answers are cut at about 125 characters, so long quotations were compared
  against the repository text instead ([quote check](../../raw/trials/2026-10-08-cloudflare-run-cost/results/quote-check.md)).
- Vendor terms: OpenAI's policy pages were read as third-party copies. xAI's terms returned 403. Xiaomi's user agreement is
  rendered by script and was not read. Anthropic's Commercial Terms were read in one pass. The 2026-11-12 usage policy
  page has no announcement anywhere that was found. Plan prices for the subscriptions the lanes use were not gathered.
- The lane isolation scan was read from its branch and not re-run. The coachman's process time, the CPU use of any
  launch and the gate's speed in a container are bracketed or unknown.
- Whether a subscription login inside a Worker-injected placeholder works for Codex or Claude Code at all was not
  tried; the vendors' gateway pages describe it and Cloudflare does not.

## What would change the answer

- A trial on Cloudflare that runs a fixture lane to a passing score with the key outside the sandbox: toward supported
  for the lane. A trial that cannot keep a 90-minute lane alive through a deploy names what the lifetime pages lack.
- A vendor's written answer on a subscription login in a cloud container, for Anthropic or OpenAI. Either answer
  changes the cost line more than any other fact here.
- The `durable_object` policy and snapshots leaving beta, or Cloudflare adding an SSH egress proxy or placement
  constraints for that policy.

## Proposed tickets

None is filed. Titles are in the form the repository uses.

1. **A fixture lane runs in a Cloudflare sandbox with its model key held outside it.** The smallest trial above.
   Needs the user's account, the $5 plan fee and a few dollars of credit.
2. **A run's records are kept behind one store that roles on different machines can reach.** The run folder as a service
   (an action log, event streams, markers), before any role moves off this machine. It helps any second machine, not
   only Cloudflare.
3. **A run chooses, for each role, a subscription login or an API key, and the choice is checked before the run starts.**
   The decision the terms leave open, made visible. The Opus security review is the line that decides it at $14.56 to
   $35.79 a run at API prices.
4. **The security review runs only where a change touches a risk surface.** From the lane audit's candidate list, now
   with a price: 92% of the model dollars at list price.
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
